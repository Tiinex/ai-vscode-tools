import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ChatSessionSummary } from "./types";

interface TranscriptRow {
  timestamp?: string;
  type?: string;
  data?: {
    toolRequests?: unknown[];
  };
}

interface SessionTailState {
  requestCount: number;
  latestRequestHasResponse: boolean;
  latestRequestHasResult: boolean;
}

export interface SessionQuiescenceState {
  summarySettled: boolean;
  transcriptPresent: boolean;
  transcriptSettled: boolean;
  quietWindowSatisfied: boolean;
  settled: boolean;
  transcriptReason?: string;
}

export async function appendUnsettledSessionDiagnostic(
  baseReason: string,
  session: ChatSessionSummary | undefined
): Promise<string> {
  const diagnostic = await describeUnsettledSession(session);
  return diagnostic ? `${baseReason} ${diagnostic}` : baseReason;
}

export async function describeUnsettledSession(
  session: ChatSessionSummary | undefined
): Promise<string | undefined> {
  if (!session || session.provider !== "workspaceStorage") {
    return undefined;
  }

  const rows = await readTranscriptTail(session);
  if (rows.length === 0) {
    return describeMissingTranscriptUnsettledReason(await readSessionTailState(session.sessionFile));
  }

  return describeTranscriptUnsettledReason(rows);
}

export async function getSessionQuiescenceState(
  session: ChatSessionSummary | undefined,
  options?: { quietWindowMs?: number; now?: number }
): Promise<SessionQuiescenceState> {
  const summarySettled = isSessionSummarySettled(session);
  if (!session || session.provider !== "workspaceStorage") {
    return {
      summarySettled,
      transcriptPresent: false,
      transcriptSettled: true,
      quietWindowSatisfied: true,
      settled: summarySettled
    };
  }

  const rows = await readTranscriptTail(session);
  if (rows.length === 0) {
    const sessionTailState = await readSessionTailState(session.sessionFile);
    const persistedTailSettled = Boolean(sessionTailState && sessionTailLooksMoreSettledThanTranscript(sessionTailState));
    const sessionFileActivityAt = await readSessionFileActivityAt(session.sessionFile);
    const quietWindowMs = Math.max(0, options?.quietWindowMs ?? 0);
    const now = options?.now ?? Date.now();
    const lastRelevantActivityAt = Math.max(
      parseIsoTimestamp(session.lastUpdated) ?? -Infinity,
      sessionFileActivityAt ?? -Infinity
    );
    const quietWindowSatisfied = !lastRelevantActivityAt
      || lastRelevantActivityAt === -Infinity
      || quietWindowMs === 0
      || now - lastRelevantActivityAt >= quietWindowMs;
    const transcriptReason = describeMissingTranscriptUnsettledReason(sessionTailState, quietWindowSatisfied);

    return {
      summarySettled,
      transcriptPresent: false,
      transcriptSettled: !transcriptReason,
      quietWindowSatisfied,
      settled: (summarySettled || persistedTailSettled) && !transcriptReason && quietWindowSatisfied,
      transcriptReason
    };
  }

  const transcriptReason = describeTranscriptUnsettledReason(rows);
  const sessionTailState = (transcriptReason || !summarySettled)
    ? await readSessionTailState(session.sessionFile)
    : undefined;
  const persistedTailSettled = Boolean(sessionTailState && sessionTailLooksMoreSettledThanTranscript(sessionTailState));
  const effectiveSummarySettled = summarySettled || persistedTailSettled;
  const transcriptSettled = !transcriptReason || persistedTailSettled;
  const effectiveTranscriptReason = transcriptSettled ? undefined : transcriptReason;
  const quietWindowMs = Math.max(0, options?.quietWindowMs ?? 0);
  const now = options?.now ?? Date.now();
  const lastRelevantActivityAt = getLastRelevantTranscriptActivityAt(rows);
  const quietWindowSatisfied = !lastRelevantActivityAt
    || quietWindowMs === 0
    || now - lastRelevantActivityAt >= quietWindowMs;

  return {
    summarySettled,
    transcriptPresent: true,
    transcriptSettled,
    quietWindowSatisfied,
    settled: effectiveSummarySettled && transcriptSettled && quietWindowSatisfied,
    transcriptReason: effectiveTranscriptReason
  };
}

async function readTranscriptTail(session: ChatSessionSummary): Promise<TranscriptRow[]> {
  const transcriptCandidates = buildTranscriptCandidates(session);
  for (const transcriptFile of transcriptCandidates) {
    try {
      const raw = await fs.readFile(transcriptFile, "utf8");
      const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-20);
      const rows = lines.map((line) => {
        try {
          return JSON.parse(line) as TranscriptRow;
        } catch {
          return undefined;
        }
      }).filter((row): row is TranscriptRow => Boolean(row));
      if (rows.length > 0) {
        return rows;
      }
    } catch {
      // Ignore missing or unreadable companion transcript files.
    }
  }

  return [];
}

function buildTranscriptCandidates(session: ChatSessionSummary): string[] {
  const storageDir = path.dirname(path.dirname(session.sessionFile));
  return [
    path.join(storageDir, "GitHub.copilot-chat", "transcripts", `${session.id}.jsonl`),
    path.join(storageDir, "transcripts", `${session.id}.jsonl`)
  ];
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return index;
    }
  }

  return -1;
}

function describeTranscriptUnsettledReason(rows: TranscriptRow[]): string | undefined {
  const lastUserIndex = findLastIndex(rows, (row) => row.type === "user.message");
  const relevantRows = lastUserIndex >= 0 ? rows.slice(lastUserIndex + 1) : rows;
  const lastRelevantType = relevantRows.at(-1)?.type;
  const lastAssistantMessage = [...relevantRows].reverse().find((row) => row.type === "assistant.message");
  const toolRequestCount = Array.isArray(lastAssistantMessage?.data?.toolRequests)
    ? lastAssistantMessage.data.toolRequests.length
    : 0;

  if (toolRequestCount > 0 && lastRelevantType === "assistant.turn_start") {
    return `The companion transcript shows a new assistant turn that started after an earlier assistant message requested ${renderToolRequestCount(toolRequestCount)}, but no tool result or final answer was ever persisted.`;
  }

  if (toolRequestCount > 0) {
    return `The companion transcript shows an unfinished assistant step after requesting ${renderToolRequestCount(toolRequestCount)}.`;
  }

  if (lastRelevantType === "assistant.turn_start") {
    return "The companion transcript shows an assistant turn that started but never persisted a matching assistant message or turn end.";
  }

  return undefined;
}

function describeMissingTranscriptUnsettledReason(
  state: SessionTailState | undefined,
  quietWindowSatisfied = true
): string | undefined {
  if (!state) {
    return quietWindowSatisfied
      ? undefined
      : "The companion transcript is not yet readable, and the persisted session file is still showing recent activity.";
  }

  if (sessionTailLooksMoreSettledThanTranscript(state)) {
    return undefined;
  }

  if (state.requestCount === 0) {
    return "The companion transcript is not yet readable, and the persisted session file has not recorded a request for the latest turn.";
  }

  if (!state.latestRequestHasResponse && !state.latestRequestHasResult) {
    return "The companion transcript is not yet readable, and the persisted session file shows a latest request with neither a response nor a result.";
  }

  return "The companion transcript is not yet readable, and the persisted session file shows a latest request without a final result yet.";
}

function getLastRelevantTranscriptActivityAt(rows: TranscriptRow[]): number | undefined {
  const lastUserIndex = findLastIndex(rows, (row) => row.type === "user.message");
  const relevantRows = lastUserIndex >= 0 ? rows.slice(lastUserIndex) : rows;
  for (let index = relevantRows.length - 1; index >= 0; index -= 1) {
    const timestamp = parseIsoTimestamp(relevantRows[index]?.timestamp);
    if (timestamp !== undefined) {
      return timestamp;
    }
  }

  return undefined;
}

function isSessionSummarySettled(session: ChatSessionSummary | undefined): boolean {
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

async function readSessionTailState(sessionFile: string): Promise<SessionTailState | undefined> {
  try {
    const raw = await fs.readFile(sessionFile, "utf8");
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-120);
    if (lines.length === 0) {
      return undefined;
    }

    let requestCount = 0;
    let latestRequestHasResponse = false;
    let latestRequestHasResult = false;

    for (const line of lines) {
      let row: any;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }

      if (row?.kind === 0 && Array.isArray(row?.v?.requests) && row.v.requests.length > 0) {
        requestCount = Math.max(requestCount, row.v.requests.length);
        const latestRequest = row.v.requests[row.v.requests.length - 1];
        latestRequestHasResponse = latestRequest?.response !== undefined;
        latestRequestHasResult = latestRequest?.result !== undefined;
        continue;
      }

      const keyPath = Array.isArray(row?.k) ? row.k : [];
      if (keyPath.length === 1 && keyPath[0] === "requests" && Array.isArray(row?.v) && row.v.length > 0) {
        requestCount += row.v.length;
        const latestRequest = row.v[row.v.length - 1];
        latestRequestHasResponse = latestRequest?.response !== undefined;
        latestRequestHasResult = latestRequest?.result !== undefined;
        continue;
      }

      if (keyPath[0] !== "requests") {
        continue;
      }

      if (typeof keyPath[1] === "number") {
        requestCount = Math.max(requestCount, keyPath[1] + 1);
      }

      if (keyPath[2] === "response") {
        latestRequestHasResponse = true;
      }

      if (keyPath[2] === "result") {
        latestRequestHasResult = true;
      }
    }

    return {
      requestCount,
      latestRequestHasResponse,
      latestRequestHasResult
    };
  } catch {
    return undefined;
  }
}

async function readSessionFileActivityAt(sessionFile: string): Promise<number | undefined> {
  try {
    const stats = await fs.stat(sessionFile);
    const modifiedAt = stats.mtimeMs;
    return Number.isFinite(modifiedAt) ? modifiedAt : undefined;
  } catch {
    return undefined;
  }
}

function sessionTailLooksMoreSettledThanTranscript(state: SessionTailState): boolean {
  return state.requestCount > 0 && state.latestRequestHasResult;
}

function parseIsoTimestamp(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function renderToolRequestCount(count: number): string {
  return count === 1 ? "a tool" : `${count} tools`;
}