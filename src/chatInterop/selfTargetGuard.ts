import path from "node:path";
import type { ChatSessionSummary } from "./types";
import { loadWorkspaceTerminalBoundChatSessionIds } from "../sessionIndex";

export const SELF_TARGETING_GUARD_WINDOW_MS = 5 * 60 * 1000;

interface ExactDeleteSelfTargetingOptions {
  allowTerminalBoundSelfTarget?: boolean;
}

export async function getExactDeleteTerminalBoundSessionId(
  chats: readonly ChatSessionSummary[],
  targetSessionId: string
): Promise<string | undefined> {
  const target = chats.find((chat) => sessionIdMatches(targetSessionId, chat.id));
  const workspaceStorageDir = target ? tryGetWorkspaceStorageDir(target) : undefined;
  if (!workspaceStorageDir) {
    return undefined;
  }

  const terminalBoundSessionIds = await loadWorkspaceTerminalBoundChatSessionIds(workspaceStorageDir);
  return terminalBoundSessionIds?.find((sessionId) => sessionIdMatches(targetSessionId, sessionId));
}

export function getExactSelfTargetingReason(
  chats: readonly ChatSessionSummary[],
  targetSessionId: string,
  operation: "reveal" | "send" | "close-visible-tabs" | "delete-artifacts",
  now = Date.now()
): string | undefined {
  if (operation === "reveal" || operation === "close-visible-tabs" || operation === "send" || operation === "delete-artifacts") {
    return undefined;
  }

  const latest = findRecentLikelyInvokingChat(chats, now);
  if (!latest || !sessionIdMatches(targetSessionId, latest.id)) {
    return undefined;
  }

  return `Blocked live chat ${operation}: target session ${targetSessionId} appears to be the currently invoking conversation in this workspace. `
    + "This guard is heuristic and exists to avoid self-targeting loops or mutex contention. Open a different chat or wait until the active session is no longer the most recently updated one.";
}

export async function getExactDeleteSelfTargetingReason(
  chats: readonly ChatSessionSummary[],
  targetSessionId: string,
  options: ExactDeleteSelfTargetingOptions = {}
): Promise<string | undefined> {
  const target = chats.find((chat) => sessionIdMatches(targetSessionId, chat.id));
  const executionReason = getExactDeleteExecutionReason(target, targetSessionId);
  if (executionReason) {
    return executionReason;
  }

  const terminalBoundSessionId = await getExactDeleteTerminalBoundSessionId(chats, targetSessionId);
  return getExactDeleteSelfTargetingReasonFromTerminalSessionIds(
    targetSessionId,
    terminalBoundSessionId ? [terminalBoundSessionId] : [],
    options
  );
}

export function getExactDeleteSelfTargetingReasonFromTerminalSessionIds(
  targetSessionId: string,
  terminalBoundSessionIds: readonly string[],
  options: ExactDeleteSelfTargetingOptions = {}
): string | undefined {
  const blockingSessionId = terminalBoundSessionIds.find((sessionId) => sessionIdMatches(targetSessionId, sessionId));
  if (!blockingSessionId || options.allowTerminalBoundSelfTarget) {
    return undefined;
  }

  return `Blocked live chat delete-artifacts: target session ${targetSessionId} matches the current terminal-bound conversation ${blockingSessionId} in this workspace. `
    + "This guard uses the exact Local chat-to-terminal binding instead of the latest-updated heuristic. Delete a different disposable target, or run only a dry run against the current working chat.";
}

export function getExactDeleteExecutionReason(
  target: ChatSessionSummary | undefined,
  targetSessionId: string
): string | undefined {
  if (!target) {
    return undefined;
  }

  if ((target.pendingRequestCount ?? 0) > 0) {
    return `Blocked live chat delete-artifacts: target session ${targetSessionId} still has ${target.pendingRequestCount} pending request(s). `
      + "Wait until the target chat finishes executing before attempting delete, or re-run with scheduleExactSelfDelete=true to queue deferred offline cleanup instead of live delete.";
  }

  if (target.lastRequestCompleted === false) {
    return `Blocked live chat delete-artifacts: target session ${targetSessionId} has a last request that is not yet completed. `
      + "Wait until the target chat finishes executing before attempting delete, or re-run with scheduleExactSelfDelete=true to queue deferred offline cleanup instead of live delete.";
  }

  if (target.lastRequestCompleted !== true) {
    return `Blocked live chat delete-artifacts: target session ${targetSessionId} does not yet have explicit persisted settled-state evidence for its latest request. `
      + "Delete is only allowed once the target chat's latest request is explicitly recorded as settled. If you intend deferred cleanup instead of live delete, re-run with scheduleExactSelfDelete=true.";
  }

  if (target.hasPendingEdits === true && target.lastRequestCompleted !== true) {
    return `Blocked live chat delete-artifacts: target session ${targetSessionId} still carries pending edits while the latest request is unsettled. `
      + "Wait until the target chat is settled before attempting delete, or re-run with scheduleExactSelfDelete=true to queue deferred offline cleanup instead of live delete.";
  }

  return undefined;
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

function tryGetWorkspaceStorageDir(chat: ChatSessionSummary): string | undefined {
  if (chat.provider !== "workspaceStorage") {
    return undefined;
  }

  return path.dirname(path.dirname(chat.sessionFile));
}

function parseIsoTimestamp(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
