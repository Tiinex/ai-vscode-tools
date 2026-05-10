import type { Stats } from "node:fs";
import * as fs from "node:fs/promises";
import { focusLikelyEditorChat } from "./editorFocus";
import type { ChatCommandResult, ChatInteropApi, SendChatMessageRequest } from "./types";
import { appendUnsettledSessionDiagnostic, getSessionQuiescenceState } from "./unsettledDiagnostics";

const TARGET_MUTATION_TIMEOUT_MS = 900_000;
const TARGET_MUTATION_POLL_DELAY_MS = 250;
const TARGET_TRANSCRIPT_QUIET_WINDOW_MS = 1_000;

type SessionMutationBaseline = {
  lastUpdated?: string;
  sessionFileMtimeMs?: number;
  sessionFileSize?: number;
};

export async function sendMessageToSession(
  chatInterop: ChatInteropApi,
  request: SendChatMessageRequest
): Promise<ChatCommandResult> {
  const exactSupport = await chatInterop.getExactSessionInteropSupport();
  if (exactSupport.canSendExactSessionMessage) {
    return chatInterop.sendMessage(request);
  }

  if (!exactSupport.canRevealExactSession) {
    return {
      ok: false,
      reason: `${exactSupport.revealUnsupportedReason ?? "Exact Local reveal is unsupported on this build."} Session-targeted Local follow-up send depends on either exact send or exact reveal before focused submit on this build.`
    };
  }

  const beforeTarget = await getSessionSummary(chatInterop, request.sessionId);
  const beforeTargetBaseline = await captureSessionMutationBaseline(beforeTarget);

  const canonicalSendStartedAt = Date.now();
  let totalRevealMs = 0;
  let totalFocusMs = 0;
  let focusedSendCallMs = 0;

  const revealStartedAt = Date.now();
  const revealResult = await chatInterop.revealChat(request.sessionId);
  totalRevealMs += Date.now() - revealStartedAt;
  if (!revealResult.ok) {
    return {
      ...revealResult,
      reason: `Canonical Local session send failed during exact reveal: ${revealResult.reason ?? revealResult.error ?? "Unknown reveal failure."}`
    };
  }

  const focusStartedAt = Date.now();
  let focusResult = await focusLikelyEditorChat(chatInterop, {
    sessionId: request.sessionId
  });
  totalFocusMs += Date.now() - focusStartedAt;
  if (!focusResult.ok) {
    const retriedRevealStartedAt = Date.now();
    const retriedRevealResult = await chatInterop.revealChat(request.sessionId);
    totalRevealMs += Date.now() - retriedRevealStartedAt;
    if (retriedRevealResult.ok) {
      const retriedFocusStartedAt = Date.now();
      revealResult.session = retriedRevealResult.session;
      revealResult.revealLifecycle = retriedRevealResult.revealLifecycle;
      focusResult = await focusLikelyEditorChat(chatInterop, {
        sessionId: request.sessionId
      });
      totalFocusMs += Date.now() - retriedFocusStartedAt;
    }
  }

  if (!focusResult.ok) {
    return {
      ok: false,
      reason: `Canonical Local session send failed while focusing the revealed editor-hosted chat: ${focusResult.reason ?? "Unable to focus the revealed editor-hosted chat."}`,
      session: revealResult.session,
      revealLifecycle: revealResult.revealLifecycle
    };
  }

  const focusedSendStartedAt = Date.now();
  const focusedResult = await chatInterop.sendFocusedMessage({
    prompt: request.prompt,
    agentName: request.agentName,
    mode: request.mode,
    modelSelector: request.modelSelector,
    partialQuery: request.partialQuery,
    blockOnResponse: request.blockOnResponse,
    requireSelectionEvidence: request.requireSelectionEvidence,
    expectedFocusedSessionId: request.sessionId,
    waitForPersisted: request.blockOnResponse === true
      ? true
      : request.requireSelectionEvidence === true
        ? undefined
        : false
  });
  focusedSendCallMs = Date.now() - focusedSendStartedAt;
  const focusedSendTiming = focusedResult.revealLifecycle?.timingMs;
  const revealLifecycle = withCanonicalSendTiming(
    revealResult.revealLifecycle ?? focusedResult.revealLifecycle,
    {
      totalCanonicalSendMs: Date.now() - canonicalSendStartedAt,
      revealMs: totalRevealMs,
      focusMs: totalFocusMs,
      focusedSendCallMs,
      focusedInputMs: focusedSendTiming?.focusedInputMs,
      prefillMs: focusedSendTiming?.prefillMs,
      submitMs: focusedSendTiming?.submitMs,
      focusedMutationWaitMs: focusedSendTiming?.focusedMutationWaitMs,
      focusedMutationPollCount: focusedSendTiming?.focusedMutationPollCount,
      focusedMutationPollIntervalMs: focusedSendTiming?.focusedMutationPollIntervalMs,
      focusedMutationScanMs: focusedSendTiming?.focusedMutationScanMs
    }
  );

  if (!focusedResult.ok) {
    return {
      ...focusedResult,
      revealLifecycle,
      reason: `Canonical Local session send failed during focused submit: ${focusedResult.reason ?? focusedResult.error ?? "Focused submit failed."}`.trim()
    };
  }

  if (
    focusedResult.session?.id === request.sessionId
    && await isSessionSettled(focusedResult.session)
  ) {
    return {
      ...focusedResult,
      revealLifecycle
    };
  }

  const verifiedTarget = await waitForTargetSessionMutation(
    chatInterop,
    request.sessionId,
    beforeTargetBaseline,
    request.blockOnResponse === true
  );
  if (!verifiedTarget.observedMutation) {
    return {
      ok: false,
      reason: `Canonical Local session send did not produce an observed persisted mutation for target session ${request.sessionId}.`,
      revealLifecycle
    };
  }

  if (!verifiedTarget.settled) {
    return {
      ok: false,
      reason: await appendUnsettledSessionDiagnostic(
        `Canonical Local session send touched target session ${request.sessionId}, but it did not reach a settled state within the expected timeout.`,
        verifiedTarget.session
      ),
      session: verifiedTarget.session,
      revealLifecycle
    };
  }

  const repairedTarget = await restorePromptOnlyCustomModeIfNeeded(
    chatInterop,
    request,
    beforeTarget,
    verifiedTarget.session
  );

  return {
    ...focusedResult,
    session: repairedTarget,
    revealLifecycle
  };
}

function withCanonicalSendTiming(
  lifecycle: ChatCommandResult["revealLifecycle"],
  timingMs: NonNullable<NonNullable<ChatCommandResult["revealLifecycle"]>["timingMs"]>
): NonNullable<ChatCommandResult["revealLifecycle"]> {
  return {
    closedMatchingVisibleTabs: lifecycle?.closedMatchingVisibleTabs ?? 0,
    closedTabLabels: lifecycle?.closedTabLabels ?? [],
    timingMs
  };
}

async function getSessionSummary(
  chatInterop: ChatInteropApi,
  sessionId: string
): Promise<ChatCommandResult["session"] | undefined> {
  if (typeof chatInterop.getSessionById === "function") {
    return chatInterop.getSessionById(sessionId);
  }

  return (await chatInterop.listChats()).find((session) => session.id === sessionId);
}

async function waitForTargetSessionMutation(
  chatInterop: ChatInteropApi,
  sessionId: string,
  previousBaseline: SessionMutationBaseline | undefined,
  requireSettled: boolean
): Promise<{ session: ChatCommandResult["session"] | undefined; observedMutation: boolean; settled: boolean }> {
  const targetMutationTimeoutMs = Math.max(
    TARGET_MUTATION_POLL_DELAY_MS,
    chatInterop.getPostCreateTimeoutMs?.() ?? TARGET_MUTATION_TIMEOUT_MS
  );
  const targetMutationPollAttempts = Math.ceil(targetMutationTimeoutMs / TARGET_MUTATION_POLL_DELAY_MS);
  let target = await getSessionSummary(chatInterop, sessionId);
  let observedMutation = target ? await hasSessionMutationSinceBaseline(target, previousBaseline) : false;

  for (let attempt = 0; attempt < targetMutationPollAttempts; attempt += 1) {
    const settled = observedMutation && (!requireSettled || await isSessionSettled(target));
    if (settled) {
      return { session: target, observedMutation, settled };
    }

    await delay(TARGET_MUTATION_POLL_DELAY_MS);
    target = await getSessionSummary(chatInterop, sessionId);
    if (!target) {
      return { session: undefined, observedMutation, settled: false };
    }
    observedMutation = observedMutation || await hasSessionMutationSinceBaseline(target, previousBaseline);
  }

  return {
    session: target,
    observedMutation,
    settled: observedMutation && (!requireSettled || await isSessionSettled(target))
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isSessionSettled(session: ChatCommandResult["session"] | undefined): Promise<boolean> {
  return (await getSessionQuiescenceState(session, {
    quietWindowMs: TARGET_TRANSCRIPT_QUIET_WINDOW_MS
  })).settled;
}

async function captureSessionMutationBaseline(
  session: ChatCommandResult["session"] | undefined
): Promise<SessionMutationBaseline | undefined> {
  if (!session) {
    return undefined;
  }

  const stats = await safeStat(session.sessionFile);
  return {
    lastUpdated: session.lastUpdated,
    sessionFileMtimeMs: stats?.mtimeMs,
    sessionFileSize: stats?.size
  };
}

async function hasSessionMutationSinceBaseline(
  session: ChatCommandResult["session"] | undefined,
  baseline: SessionMutationBaseline | undefined
): Promise<boolean> {
  if (!session) {
    return false;
  }

  if (!baseline) {
    return true;
  }

  if (session.lastUpdated !== baseline.lastUpdated) {
    return true;
  }

  const stats = await safeStat(session.sessionFile);
  if (stats?.size !== baseline.sessionFileSize) {
    return true;
  }

  return stats?.mtimeMs !== undefined && baseline.sessionFileMtimeMs !== undefined
    ? stats.mtimeMs !== baseline.sessionFileMtimeMs
    : stats?.mtimeMs !== baseline.sessionFileMtimeMs;
}

async function safeStat(targetPath: string): Promise<Stats | undefined> {
  try {
    return await fs.stat(targetPath);
  } catch {
    return undefined;
  }
}

async function restorePromptOnlyCustomModeIfNeeded(
  chatInterop: ChatInteropApi,
  request: SendChatMessageRequest,
  beforeTarget: ChatCommandResult["session"] | undefined,
  afterTarget: ChatCommandResult["session"] | undefined
): Promise<ChatCommandResult["session"] | undefined> {
  const expectedModeId = beforeTarget?.mode;
  if (!expectedModeId?.startsWith("file:///")) {
    return afterTarget;
  }

  if (request.agentName?.trim() || request.mode?.trim()) {
    return afterTarget;
  }

  if (afterTarget?.mode === expectedModeId || !afterTarget?.sessionFile) {
    return afterTarget;
  }

  await appendJsonlRow(afterTarget.sessionFile, {
    kind: 1,
    k: ["inputState", "mode"],
    v: {
      id: expectedModeId,
      kind: "agent"
    }
  });

  await chatInterop.revealChat(afterTarget.id);

  return await getSessionSummary(chatInterop, afterTarget.id) ?? afterTarget;
}

async function appendJsonlRow(sessionFile: string, row: Record<string, unknown>): Promise<void> {
  await fs.appendFile(sessionFile, `${JSON.stringify(row)}\n`, "utf8");
}