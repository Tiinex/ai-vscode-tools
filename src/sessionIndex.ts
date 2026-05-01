import { promises as fs } from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";

export interface WorkspaceSessionIndexEntry {
  sessionId: string;
  title?: string;
  lastMessageDate?: number;
  isEmpty?: boolean;
  isExternal?: boolean;
}

interface WorkspaceSessionIndexPayload {
  version?: number;
  entries?: Record<string, WorkspaceSessionIndexEntry>;
}

const CHAT_SESSION_INDEX_KEY = "chat.ChatSessionStore.index";

function shouldIncludeIndexedSession(entry: WorkspaceSessionIndexEntry): boolean {
  return entry.isEmpty !== true;
}

let sqlPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | undefined;

async function getSqlJs(): Promise<Awaited<ReturnType<typeof initSqlJs>>> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => path.resolve(__dirname, "..", "node_modules", "sql.js", "dist", file)
    });
  }
  return sqlPromise;
}

export async function loadWorkspaceSessionIndex(workspaceStorageDir: string): Promise<Map<string, WorkspaceSessionIndexEntry> | undefined> {
  const dbPath = path.join(workspaceStorageDir, "state.vscdb");
  try {
    const bytes = await fs.readFile(dbPath);
    const SQL = await getSqlJs();
    const db = new SQL.Database(bytes);
    try {
      const result = db.exec(`select CAST(value as text) as value from ItemTable where key = '${CHAT_SESSION_INDEX_KEY}'`);
      const raw = result[0]?.values?.[0]?.[0];
      if (typeof raw !== "string" || !raw.trim()) {
        return undefined;
      }
      const parsed = JSON.parse(raw) as WorkspaceSessionIndexPayload;
      const entries = parsed.entries ?? {};
      const mapped = new Map<string, WorkspaceSessionIndexEntry>();
      for (const entry of Object.values(entries)) {
        if (!entry || typeof entry.sessionId !== "string" || !entry.sessionId.trim()) {
          continue;
        }
        if (!shouldIncludeIndexedSession(entry)) {
          continue;
        }
        mapped.set(entry.sessionId, entry);
      }
      return mapped;
    } finally {
      db.close();
    }
  } catch {
    return undefined;
  }
}