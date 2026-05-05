import { focusLikelyEditorChat } from "./editorFocus";
import { getLocalChatEditorTabMatchKind } from "./editorTabMatcher";
import type { ChatFocusReport } from "./focusTargets";
import type { ChatCommandResult, ChatInteropApi, SendChatMessageRequest } from "./types";
import { appendUnsettledSessionDiagnostic, describeUnsettledSession } from "./unsettledDiagnostics";

const TARGET_MUTATION_TIMEOUT_MS = 90_000;
// Keep timeout semantics strict, but poll faster so successful fallback sends
// don't linger an extra second before the tool can observe settlement.
const TARGET_MUTATION_POLL_DELAY_MS = 250;
const TARGET_MUTATION_POLL_ATTEMPTS = Math.ceil(TARGET_MUTATION_TIMEOUT_MS / TARGET_MUTATION_POLL_DELAY_MS);

export interface SessionSendWorkflowResult {
  result: ChatCommandResult;
  usedFallback: boolean;
  fallbackReason?: string;
}

export async function sendMessageToSessionWithFallback(
  chatInterop: ChatInteropApi,
  request: SendChatMessageRequest
): Promise<SessionSendWorkflowResult> {
  const fallbackStartedAt = Date.now();
  let totalRevealMs = 0;
  let totalFocusMs = 0;
  let focusedSendCallMs = 0;
  const beforeTarget = await getSessionSummary(chatInterop, request.sessionId);
  const exactSupport = await chatInterop.getExactSessionInteropSupport();
  if (exactSupport.canSendExactSessionMessage) {
    return {
      result: await chatInterop.sendMessage(request),
      usedFallback: false
    };
  }

  const fallbackReason = exactSupport.sendUnsupportedReason
    ?? "Exact session-targeted Local send is unsupported on this build.";

  if (!exactSupport.canRevealExactSession) {
    return {
      result: {
        ok: false,
        reason: `${fallbackReason} Fallback unavailable because exact Local reveal is also unsupported on this build.`
      },
      usedFallback: false,
      fallbackReason
    };
  }

  const initialRevealStartedAt = Date.now();
  let revealResult = await chatInterop.revealChat(request.sessionId);
  totalRevealMs += Date.now() - initialRevealStartedAt;
  if (!revealResult.ok) {
    return {
      result: {
        ...revealResult,
        reason: `${fallbackReason} Fallback reveal failed: ${revealResult.reason ?? revealResult.error ?? "Unknown reveal failure."}`
      },
      usedFallback: true,
      fallbackReason
    };
  }

  const initialFocusStartedAt = Date.now();
  let focusResult = await focusLikelyEditorChat(chatInterop, {
    sessionId: request.sessionId
  });
  totalFocusMs += Date.now() - initialFocusStartedAt;
  let genericActiveChatFallback = canTrustGenericActiveChatAfterReveal(focusResult.report, {
    sessionId: request.sessionId,
    sessionTitle: revealResult.session?.title ?? beforeTarget?.title
  });
  if (!focusResult.ok && !genericActiveChatFallback) {
    const retriedRevealStartedAt = Date.now();
    const retriedRevealResult = await chatInterop.revealChat(request.sessionId);
    totalRevealMs += Date.now() - retriedRevealStartedAt;
    if (retriedRevealResult.ok) {
      revealResult = retriedRevealResult;
      const retriedFocusStartedAt = Date.now();
      focusResult = await focusLikelyEditorChat(chatInterop, {
        sessionId: request.sessionId
      });
      totalFocusMs += Date.now() - retriedFocusStartedAt;
      genericActiveChatFallback = canTrustGenericActiveChatAfterReveal(focusResult.report, {
        sessionId: request.sessionId,
        sessionTitle: revealResult.session?.title ?? beforeTarget?.title
      });
    }
  }

  if (!focusResult.ok && !genericActiveChatFallback) {
    return {
      result: {
        ok: false,
        reason: `${fallbackReason} Fallback focus failed: ${focusResult.reason ?? "Unable to focus the revealed editor-hosted chat."}`,
        session: revealResult.session,
        revealLifecycle: revealResult.revealLifecycle
      },
      usedFallback: true,
      fallbackReason
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
    requireSelectionEvidence: request.requireSelectionEvidence
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
    if (isPersistedMutationTimeout(focusedResult)) {
      const diagnosedTarget = await getSessionSummary(chatInterop, request.sessionId);
      return {
        result: {
          ...focusedResult,
          session: diagnosedTarget ?? focusedResult.session,
          reason: await buildPersistedMutationTimeoutReason(fallbackReason, focusedResult, beforeTarget?.lastUpdated, diagnosedTarget),
          revealLifecycle
        },
        usedFallback: true,
        fallbackReason
      };
    }

    return {
      result: {
        ...focusedResult,
        revealLifecycle
      },
      usedFallback: true,
      fallbackReason
    };
  }

  if (
    focusedResult.session?.id === request.sessionId
    && request.blockOnResponse !== true
    && isSessionSettled(focusedResult.session)
  ) {
    return {
      result: {
        ...focusedResult,
        revealLifecycle
      },
      usedFallback: true,
      fallbackReason
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
      result: {
        ok: false,
        reason: `${fallbackReason} Fallback submit did not produce an observed persisted mutation for target session ${request.sessionId}.`,
        revealLifecycle
      },
      usedFallback: true,
      fallbackReason
    };
  }

  if (!verifiedTarget.settled) {
    return {
      result: {
        ok: false,
        reason: await appendUnsettledSessionDiagnostic(
          `${fallbackReason} Fallback submit touched target session ${request.sessionId}, but it did not reach a settled state within the expected timeout.`,
          verifiedTarget.session
        ),
        session: verifiedTarget.session,
        revealLifecycle
      },
      usedFallback: true,
      fallbackReason
    };
  }

  return {
    result: {
      ...focusedResult,
      session: verifiedTarget.session,
      revealLifecycle
    },
    usedFallback: true,
    fallbackReason
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

function isPersistedMutationTimeout(result: ChatCommandResult): boolean {
  const rendered = `${result.reason ?? ""} ${result.error ?? ""}`.toLowerCase();
  return rendered.includes("no persisted session mutation");
}

async function buildPersistedMutationTimeoutReason(
  fallbackReason: string,
  focusedResult: ChatCommandResult,
  previousLastUpdated: string | undefined,
  diagnosedTarget: ChatCommandResult["session"] | undefined
): Promise<string> {
  const baseReason = focusedResult.reason
    ?? focusedResult.error
    ?? "Fallback submit timed out before a persisted session mutation was observed.";

  const diagnosticFragments = [
    "Timeouts are treated as diagnostic failures and should be investigated before continuing."
  ];

  if (!diagnosedTarget) {
    diagnosticFragments.push("The target session could not be re-read after the timeout.");
  } else if (!previousLastUpdated || diagnosedTarget.lastUpdated !== previousLastUpdated) {
    if (isSessionSettled(diagnosedTarget)) {
      diagnosticFragments.push("The target session appears to have mutated and settled after the timeout, which indicates a host-side persistence or UI synchronization lag.");
    } else {
      diagnosticFragments.push(
        await describeUnsettledSession(diagnosedTarget)
        ?? "The target session appears to have mutated after the timeout but still does not look settled."
      );
    }
  } else {
    diagnosticFragments.push("The target session still shows no persisted mutation after the timeout.");
  }

  return `${fallbackReason} ${baseReason} ${diagnosticFragments.join(" ")}`;
}

function normalize(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
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