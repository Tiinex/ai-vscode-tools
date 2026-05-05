import type { ChatSessionSummary } from "./types";

export const SELF_TARGETING_GUARD_WINDOW_MS = 5 * 60 * 1000;

export function getExactSelfTargetingReason(
  chats: readonly ChatSessionSummary[],
  targetSessionId: string,
  operation: "reveal" | "send" | "close-visible-tabs" | "delete-artifacts",
  now = Date.now()
): string | undefined {
  if (operation === "close-visible-tabs" || operation === "delete-artifacts") {
    return undefined;
  }

  const latest = findRecentLikelyInvokingChat(chats, now);
  if (!latest || !sessionIdMatches(targetSessionId, latest.id)) {
    return undefined;
  }

  return `Blocked live chat ${operation}: target session ${targetSessionId} appears to be the currently invoking conversation in this workspace. `
    + "This guard is heuristic and exists to avoid self-targeting loops or mutex contention. Open a different chat or wait until the active session is no longer the most recently updated one.";
}

export function getFocusedSelfTargetingReason(
  chats: readonly ChatSessionSummary[],
  operation: "focused-send" | "focused-editor-send",
  targetSessionId?: string,
  now = Date.now()
): string | undefined {
  const latest = findRecentLikelyInvokingChat(chats, now);
  if (!latest) {
    return undefined;
  }

  if (targetSessionId?.trim()) {
    if (!sessionIdMatches(targetSessionId, latest.id)) {
      return undefined;
    }

    return `Blocked ${operation}: requested target session ${targetSessionId} appears to be the currently invoking conversation in this workspace. `
      + "This guard is heuristic and exists to avoid self-targeting loops or queued self-injection. Choose a different visible chat session.";
  }

  return `Blocked ${operation}: no explicit target session was provided and session ${latest.id} appears to be the currently invoking conversation in this workspace. `
    + "Provide a sessionId for a different visible editor-hosted chat, or use another exact surface when available.";
}

export function findRecentLikelyInvokingChat(
  chats: readonly ChatSessionSummary[],
  now = Date.now(),
  windowMs = SELF_TARGETING_GUARD_WINDOW_MS
): ChatSessionSummary | undefined {
  let latest: ChatSessionSummary | undefined;
  let latestUpdatedAt = -Infinity;

  for (const chat of chats) {
    const updatedAt = parseIsoTimestamp(chat.lastUpdated);
    if (updatedAt === undefined || updatedAt <= latestUpdatedAt) {
      continue;
    }

    latest = chat;
    latestUpdatedAt = updatedAt;
  }

  if (!latest || !Number.isFinite(latestUpdatedAt)) {
    return undefined;
  }

  return now - latestUpdatedAt <= windowMs ? latest : undefined;
}

export function sessionIdMatches(targetSessionId: string, candidateSessionId: string): boolean {
  return targetSessionId === candidateSessionId
    || targetSessionId.startsWith(candidateSessionId)
    || candidateSessionId.startsWith(targetSessionId);
}

function parseIsoTimestamp(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
