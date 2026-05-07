import * as fs from "node:fs/promises";
import { focusLikelyEditorChat } from "./editorFocus";
import { getLocalChatEditorTabMatchKind } from "./editorTabMatcher";
import type { ChatFocusReport } from "./focusTargets";
import type { ChatCommandResult, ChatInteropApi, SendChatMessageRequest } from "./types";
import { appendUnsettledSessionDiagnostic } from "./unsettledDiagnostics";

const TARGET_MUTATION_TIMEOUT_MS = 90_000;
const TARGET_MUTATION_POLL_DELAY_MS = 250;
const TARGET_MUTATION_POLL_ATTEMPTS = Math.ceil(TARGET_MUTATION_TIMEOUT_MS / TARGET_MUTATION_POLL_DELAY_MS);

export async function sendMessageToSession(
  chatInterop: ChatInteropApi,
  request: SendChatMessageRequest
): Promise<ChatCommandResult> {
  const exactSupport = await chatInterop.getExactSessionInteropSupport();
  if (exactSupport.canSendExactSessionMessage) {
    return chatInterop.sendMessage(request);
  }

  const fallbackReason = exactSupport.sendUnsupportedReason
    ?? "Exact session-targeted Local send is unsupported on this build.";
  if (!exactSupport.canRevealExactSession) {
    return {
      ok: false,
      reason: `${fallbackReason} Fallback unavailable because exact Local reveal is also unsupported on this build.`
    };
  }

  const beforeTarget = await getSessionSummary(chatInterop, request.sessionId);

  const fallbackStartedAt = Date.now();
  let totalRevealMs = 0;
  let totalFocusMs = 0;
  let focusedSendCallMs = 0;

  const revealStartedAt = Date.now();
  const revealResult = await chatInterop.revealChat(request.sessionId);
  totalRevealMs += Date.now() - revealStartedAt;
  if (!revealResult.ok) {
    return {
      ...revealResult,
      reason: `${fallbackReason} Fallback reveal failed: ${revealResult.reason ?? revealResult.error ?? "Unknown reveal failure."}`
    };
  }

  const focusStartedAt = Date.now();
  let focusResult = await focusLikelyEditorChat(chatInterop, {
    sessionId: request.sessionId
  });
  totalFocusMs += Date.now() - focusStartedAt;
  let genericActiveChatFallback = canTrustGenericActiveChatAfterReveal(focusResult.report, {
    sessionId: request.sessionId,
    sessionTitle: revealResult.session?.title ?? beforeTarget?.title
  });
  if (!focusResult.ok && !genericActiveChatFallback) {
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
      genericActiveChatFallback = canTrustGenericActiveChatAfterReveal(focusResult.report, {
        sessionId: request.sessionId,
        sessionTitle: retriedRevealResult.session?.title ?? beforeTarget?.title
      });
    }
  }

  if (!focusResult.ok && !genericActiveChatFallback) {
    return {
      ok: false,
      reason: `${fallbackReason} Fallback focus failed: ${focusResult.reason ?? "Unable to focus the revealed editor-hosted chat."}`,
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
    waitForPersisted: request.requireSelectionEvidence === true ? undefined : false
  });
  focusedSendCallMs = Date.now() - focusedSendStartedAt;
  const focusedSendTiming = focusedResult.revealLifecycle?.timingMs;
  const revealLifecycle = withFallbackTiming(
    revealResult.revealLifecycle ?? focusedResult.revealLifecycle,
    {
      totalFallbackMs: Date.now() - fallbackStartedAt,
      revealMs: totalRevealMs,
      focusMs: totalFocusMs,
      focusedSendCallMs,
      focusedInputMs: focusedSendTiming?.focusedInputMs,
      prefillMs: focusedSendTiming?.prefillMs,
      submitMs: focusedSendTiming?.submitMs,
      focusedMutationWaitMs: focusedSendTiming?.focusedMutationWaitMs,
      focusedMutationPollCount: focusedSendTiming?.focusedMutationPollCount,
      focusedMutationScanMs: focusedSendTiming?.focusedMutationScanMs
    }
  );

  if (!focusedResult.ok) {
    return {
      ...focusedResult,
      revealLifecycle,
      reason: `${fallbackReason} ${focusedResult.reason ?? focusedResult.error ?? "Fallback focused submit failed."}`.trim()
    };
  }

  if (
    focusedResult.session?.id === request.sessionId
    && request.blockOnResponse !== true
    && isSessionSettled(focusedResult.session)
  ) {
    return {
      ...focusedResult,
      revealLifecycle
    };
  }

  const verifiedTarget = await waitForTargetSessionMutation(
    chatInterop,
    request.sessionId,
    beforeTarget?.lastUpdated,
    request.blockOnResponse === true
  );
  if (!verifiedTarget.observedMutation) {
    return {
      ok: false,
      reason: `${fallbackReason} Fallback submit did not produce an observed persisted mutation for target session ${request.sessionId}.`,
      revealLifecycle
    };
  }

  if (!verifiedTarget.settled) {
    return {
      ok: false,
      reason: await appendUnsettledSessionDiagnostic(
        `${fallbackReason} Fallback submit touched target session ${request.sessionId}, but it did not reach a settled state within the expected timeout.`,
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

function withFallbackTiming(
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
  return (await chatInterop.listChats()).find((session) => session.id === sessionId);
}

async function waitForTargetSessionMutation(
  chatInterop: ChatInteropApi,
  sessionId: string,
  previousLastUpdated: string | undefined,
  requireSettled: boolean
): Promise<{ session: ChatCommandResult["session"] | undefined; observedMutation: boolean; settled: boolean }> {
  let target = await getSessionSummary(chatInterop, sessionId);
  let observedMutation = Boolean(target && (!previousLastUpdated || target.lastUpdated !== previousLastUpdated));

  for (let attempt = 0; attempt < TARGET_MUTATION_POLL_ATTEMPTS; attempt += 1) {
    const settled = observedMutation && (!requireSettled || isSessionSettled(target));
    if (settled) {
      return { session: target, observedMutation, settled };
    }

    await delay(TARGET_MUTATION_POLL_DELAY_MS);
    target = await getSessionSummary(chatInterop, sessionId);
    if (!target) {
      return { session: undefined, observedMutation, settled: false };
    }
    observedMutation = observedMutation || !previousLastUpdated || target.lastUpdated !== previousLastUpdated;
  }

  return {
    session: target,
    observedMutation,
    settled: observedMutation && (!requireSettled || isSessionSettled(target))
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function canTrustGenericActiveChatAfterReveal(
  report: ChatFocusReport | undefined,
  target?: { sessionId: string; sessionTitle?: string }
): boolean {
  const activeGroup = report?.groups[report.activeGroupIndex];
  const activeTab = activeGroup?.tabs.find((tab) => tab.isActive);
  if (activeTab?.isLikelyChatEditor !== true || normalize(activeTab.label) !== "chat") {
    return false;
  }

  if (!target?.sessionTitle) {
    return false;
  }

  return getLocalChatEditorTabMatchKind(
    {
      label: activeTab.label,
      input: activeTab.input
    },
    {
      sessionId: target.sessionId,
      sessionTitle: target.sessionTitle,
      matchMode: "resource-only"
    }
  ) === "resource";
}

function isSessionSettled(session: ChatCommandResult["session"] | undefined): boolean {
  if (!session) {
    return false;
  }

  if ((session.pendingRequestCount ?? 0) > 0) {
    return false;
  }

  if (session.lastRequestCompleted === false) {
    return false;
  }

  if (session.hasPendingEdits === true) {
    return session.lastRequestCompleted === true && (session.pendingRequestCount ?? 0) === 0;
  }

  return true;
}

function normalize(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
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