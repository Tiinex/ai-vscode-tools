import { focusLikelyEditorChat } from "./editorFocus";
import type { ChatFocusReport } from "./focusTargets";
import type { ChatCommandResult, ChatInteropApi, SendChatMessageRequest } from "./types";

// Increase polling window so total wait ≈ 60 seconds (60 * 1000ms)
const TARGET_MUTATION_POLL_ATTEMPTS = 60;
const TARGET_MUTATION_POLL_DELAY_MS = 1000;

export interface SessionSendWorkflowResult {
  result: ChatCommandResult;
  usedFallback: boolean;
  fallbackReason?: string;
}

export async function sendMessageToSessionWithFallback(
  chatInterop: ChatInteropApi,
  request: SendChatMessageRequest
): Promise<SessionSendWorkflowResult> {
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

  const revealResult = await chatInterop.revealChat(request.sessionId);
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

  const focusResult = await focusLikelyEditorChat(chatInterop, {
    sessionId: request.sessionId
  });
  const genericActiveChatFallback = canTrustGenericActiveChatAfterReveal(focusResult.report);
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

  const focusedResult = await chatInterop.sendFocusedMessage({
    prompt: request.prompt,
    agentName: request.agentName,
    mode: request.mode,
    modelSelector: request.modelSelector,
    partialQuery: request.partialQuery,
    blockOnResponse: request.blockOnResponse,
    requireSelectionEvidence: request.requireSelectionEvidence
  });

  if (!focusedResult.ok) {
    if (isPersistedMutationTimeout(focusedResult)) {
      const recoveredTarget = await waitForTargetSessionMutation(
        chatInterop,
        request.sessionId,
        beforeTarget?.lastUpdated,
        request.blockOnResponse === true
      );
      if (recoveredTarget.session && recoveredTarget.observedMutation && recoveredTarget.settled) {
        return {
          result: {
            ok: true,
            session: recoveredTarget.session,
            selection: focusedResult.selection,
            dispatch: focusedResult.dispatch,
            revealLifecycle: revealResult.revealLifecycle ?? focusedResult.revealLifecycle
          },
          usedFallback: true,
          fallbackReason
        };
      }

      if (recoveredTarget.observedMutation && !recoveredTarget.settled) {
        return {
          result: {
            ok: false,
            reason: `${fallbackReason} Fallback submit touched the target session, but it did not reach a settled state within the expected timeout.`,
            session: recoveredTarget.session,
            revealLifecycle: revealResult.revealLifecycle ?? focusedResult.revealLifecycle
          },
          usedFallback: true,
          fallbackReason
        };
      }
    }

    return {
      result: {
        ...focusedResult,
        revealLifecycle: revealResult.revealLifecycle ?? focusedResult.revealLifecycle
      },
      usedFallback: true,
      fallbackReason
    };
  }

  if (focusedResult.session?.id === request.sessionId) {
    return {
      result: {
        ...focusedResult,
        revealLifecycle: revealResult.revealLifecycle ?? focusedResult.revealLifecycle
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
        revealLifecycle: revealResult.revealLifecycle ?? focusedResult.revealLifecycle
      },
      usedFallback: true,
      fallbackReason
    };
  }

  if (!verifiedTarget.settled) {
    return {
      result: {
        ok: false,
        reason: `${fallbackReason} Fallback submit touched target session ${request.sessionId}, but it did not reach a settled state within the expected timeout.`,
        session: verifiedTarget.session,
        revealLifecycle: revealResult.revealLifecycle ?? focusedResult.revealLifecycle
      },
      usedFallback: true,
      fallbackReason
    };
  }

  return {
    result: {
      ...focusedResult,
      session: verifiedTarget.session,
      revealLifecycle: revealResult.revealLifecycle ?? focusedResult.revealLifecycle
    },
    usedFallback: true,
    fallbackReason
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

export function canTrustGenericActiveChatAfterReveal(report: ChatFocusReport | undefined): boolean {
  const activeGroup = report?.groups[report.activeGroupIndex];
  const activeTab = activeGroup?.tabs.find((tab) => tab.isActive);
  return activeTab?.isLikelyChatEditor === true && normalize(activeTab.label) === "chat";
}

function isPersistedMutationTimeout(result: ChatCommandResult): boolean {
  const rendered = `${result.reason ?? ""} ${result.error ?? ""}`.toLowerCase();
  return rendered.includes("no persisted session mutation");
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