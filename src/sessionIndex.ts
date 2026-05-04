import { promises as fs } from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";
import { toLocalChatSessionResourceString } from "./chatInterop/sessionResource";

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
const AGENT_SESSIONS_MODEL_CACHE_KEY = "agentSessions.model.cache";
const AGENT_SESSIONS_STATE_CACHE_KEY = "agentSessions.state.cache";
const CHAT_TODO_LIST_KEY = "memento/chat-todo-list";

interface AgentSessionModelCacheEntry {
  resource?: string;
}

export interface WorkspaceSessionStatePruneReport {
  removedIndexEntry: boolean;
  removedModelCacheEntries: number;
  removedStateCacheEntries: number;
  removedTodoListEntry: boolean;
}

function shouldIncludeIndexedSession(entry: WorkspaceSessionIndexEntry): boolean {
  return entry.isEmpty !== true;
}

let sqlPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | undefined;

type SqlDatabaseLike = any;

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
    const db: SqlDatabaseLike = new SQL.Database(bytes);
    try {
      const raw = readItemTableTextValue(db, CHAT_SESSION_INDEX_KEY);
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

export async function pruneWorkspaceSessionState(
  workspaceStorageDir: string,
  sessionId: string
): Promise<WorkspaceSessionStatePruneReport | undefined> {
  const dbPaths = [
    path.join(workspaceStorageDir, "state.vscdb"),
    path.join(workspaceStorageDir, "state.vscdb.backup")
  ];

  let sawDatabase = false;
  let removedIndexEntry = false;
  let removedModelCacheEntries = 0;
  let removedStateCacheEntries = 0;
  let removedTodoListEntry = false;

  for (const dbPath of dbPaths) {
    const report = await pruneWorkspaceSessionStateFile(dbPath, sessionId);
    if (!report) {
      continue;
    }

    sawDatabase = true;
    removedIndexEntry = removedIndexEntry || report.removedIndexEntry;
    removedModelCacheEntries += report.removedModelCacheEntries;
    removedStateCacheEntries += report.removedStateCacheEntries;
    removedTodoListEntry = removedTodoListEntry || report.removedTodoListEntry;
  }

  if (!sawDatabase) {
    return undefined;
  }

  return {
    removedIndexEntry,
    removedModelCacheEntries,
    removedStateCacheEntries,
    removedTodoListEntry
  };
}

async function pruneWorkspaceSessionStateFile(
  dbPath: string,
  sessionId: string
): Promise<WorkspaceSessionStatePruneReport | undefined> {
  try {
    const bytes = await fs.readFile(dbPath);
    const SQL = await getSqlJs();
    const db: SqlDatabaseLike = new SQL.Database(bytes);
    try {
      let dirty = false;
      let removedIndexEntry = false;
      let removedModelCacheEntries = 0;
      let removedStateCacheEntries = 0;
      let removedTodoListEntry = false;

      const rawIndex = readItemTableTextValue(db, CHAT_SESSION_INDEX_KEY);
      if (typeof rawIndex === "string" && rawIndex.trim()) {
        const parsed = JSON.parse(rawIndex) as WorkspaceSessionIndexPayload;
        const entries = parsed.entries ?? {};
        if (entries[sessionId]) {
          delete entries[sessionId];
          parsed.entries = entries;
          writeItemTableTextValue(db, CHAT_SESSION_INDEX_KEY, JSON.stringify(parsed));
          removedIndexEntry = true;
          dirty = true;
        }
      }

      const rawModelCache = readItemTableTextValue(db, AGENT_SESSIONS_MODEL_CACHE_KEY);
      if (typeof rawModelCache === "string" && rawModelCache.trim()) {
        const parsed = JSON.parse(rawModelCache) as AgentSessionModelCacheEntry[];
        if (Array.isArray(parsed)) {
          const targetResource = toLocalChatSessionResourceString(sessionId);
          const filtered = parsed.filter((entry) => entry?.resource !== targetResource);
          removedModelCacheEntries = parsed.length - filtered.length;
          if (removedModelCacheEntries > 0) {
            writeItemTableTextValue(db, AGENT_SESSIONS_MODEL_CACHE_KEY, JSON.stringify(filtered));
            dirty = true;
          }
        }
      }

      const rawStateCache = readItemTableTextValue(db, AGENT_SESSIONS_STATE_CACHE_KEY);
      if (typeof rawStateCache === "string" && rawStateCache.trim()) {
        const parsed = JSON.parse(rawStateCache) as AgentSessionModelCacheEntry[];
        if (Array.isArray(parsed)) {
          const targetResource = toLocalChatSessionResourceString(sessionId);
          const filtered = parsed.filter((entry) => entry?.resource !== targetResource);
          removedStateCacheEntries = parsed.length - filtered.length;
          if (removedStateCacheEntries > 0) {
            writeItemTableTextValue(db, AGENT_SESSIONS_STATE_CACHE_KEY, JSON.stringify(filtered));
            dirty = true;
          }
        }
      }

      const rawTodoList = readItemTableTextValue(db, CHAT_TODO_LIST_KEY);
      if (typeof rawTodoList === "string" && rawTodoList.trim()) {
        const parsed = JSON.parse(rawTodoList) as Record<string, unknown>;
        if (parsed && typeof parsed === "object" && sessionId in parsed) {
          delete parsed[sessionId];
          writeItemTableTextValue(db, CHAT_TODO_LIST_KEY, JSON.stringify(parsed));
          removedTodoListEntry = true;
          dirty = true;
        }
      }

      if (dirty) {
        const exported = db.export();
        await fs.writeFile(dbPath, Buffer.from(exported));
      }

      return {
        removedIndexEntry,
        removedModelCacheEntries,
        removedStateCacheEntries,
        removedTodoListEntry
      };
    } finally {
      db.close();
    }
  } catch {
    return undefined;
  }
}

function readItemTableTextValue(db: SqlDatabaseLike, key: string): string | undefined {
  const statement = db.prepare("select CAST(value as text) as value from ItemTable where key = ?");
  try {
    statement.bind([key]);
    if (!statement.step()) {
      return undefined;
    }
    const row = statement.getAsObject() as { value?: unknown };
    return typeof row.value === "string" ? row.value : undefined;
  } finally {
    statement.free();
  }
}

function writeItemTableTextValue(db: SqlDatabaseLike, key: string, value: string): void {
  const statement = db.prepare("update ItemTable set value = ? where key = ?");
  try {
    statement.run([value, key]);
  } finally {
    statement.free();
  }
}