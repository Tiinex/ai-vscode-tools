import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ChatSessionSummary } from "./types";

interface TranscriptRow {
  type?: string;
  data?: {
    toolRequests?: unknown[];
  };
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
    return undefined;
  }

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

function renderToolRequestCount(count: number): string {
  return count === 1 ? "a tool" : `${count} tools`;
}