#!/usr/bin/env node

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import initSqlJs from "sql.js";
import {
  buildWorkspaceStorageOfflineLocalChatCleanupRequest,
  createOfflineLocalChatCleanupReportPath,
  getOfflineLocalChatCleanupLockPath,
  getOfflineLocalChatCleanupRequestsPath,
  type OfflineLocalChatCleanupReport
} from "../offlineLocalChatCleanup";

const DB_NAMES = ["state.vscdb", "state.vscdb.backup"];
const CLEANUP_REPORTS_DIR_NAME = "offline-local-chat-cleanup-reports";
const INDEX_KEY = "chat.ChatSessionStore.index";
const MODEL_KEY = "agentSessions.model.cache";
const STATE_KEY = "agentSessions.state.cache";
const TODO_KEY = "memento/chat-todo-list";
const WORKBENCH_EDITOR_CHAT_SESSION_KEY = "memento/workbench.editor.chatSession";

type SqlDatabaseLike = any;

interface CleanupJob {
  workspaceStorageDir: string;
  targetSessionIds: string[];
  artifactPaths: string[];
}

let sqlPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | undefined;

function normalizeSessionIds(sessionIds: string[]): string[] {
  return [...new Set(sessionIds.map((sessionId) => sessionId.trim()).filter(Boolean))];
}

function normalizeArtifactPaths(artifactPaths: string[]): string[] {
  return [...new Set(artifactPaths.map((artifactPath) => artifactPath.trim()).filter(Boolean))];
}

function normalizeComparablePath(candidatePath: string | undefined): string | undefined {
  if (!candidatePath?.trim()) {
    return undefined;
  }

  return path.resolve(candidatePath)
    .replace(/[\\/]+/g, path.sep)
    .replace(/[\\/]+$/, "")
    .toLowerCase();
}

function isPathInsideWorkspaceRoot(workspaceStorageDir: string, artifactPath: string): boolean {
  const normalizedWorkspaceRoot = normalizeComparablePath(workspaceStorageDir);
  const normalizedArtifactPath = normalizeComparablePath(artifactPath);
  if (!normalizedWorkspaceRoot || !normalizedArtifactPath) {
    return false;
  }

  return normalizedArtifactPath === normalizedWorkspaceRoot
    || normalizedArtifactPath.startsWith(`${normalizedWorkspaceRoot}${path.sep}`);
}

function filterArtifactPathsForWorkspace(workspaceStorageDir: string, artifactPaths: string[]): string[] {
  return normalizeArtifactPaths(artifactPaths).filter((artifactPath) => isPathInsideWorkspaceRoot(workspaceStorageDir, artifactPath));
}

function decodeSessionId(resource: unknown): string | undefined {
  const prefix = "vscode-chat-session://local/";
  if (typeof resource !== "string" || !resource.startsWith(prefix)) {
    return undefined;
  }

  try {
    return Buffer.from(resource.slice(prefix.length), "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

async function getSqlJs(): Promise<Awaited<ReturnType<typeof initSqlJs>>> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => path.resolve(__dirname, "..", "vendor", "sql.js", file)
    });
  }
  return sqlPromise;
}

function readValue(db: SqlDatabaseLike, key: string): string | undefined {
  const stmt = db.prepare("select CAST(value as text) as value from ItemTable where key = ?");
  try {
    stmt.bind([key]);
    if (!stmt.step()) {
      return undefined;
    }
    const row = stmt.getAsObject();
    return typeof row.value === "string" ? row.value : undefined;
  } finally {
    stmt.free();
  }
}

function writeValue(db: SqlDatabaseLike, key: string, value: string): void {
  const stmt = db.prepare("update ItemTable set value = ? where key = ?");
  try {
    stmt.run([value, key]);
  } finally {
    stmt.free();
  }
}

function filterCacheEntries(entries: unknown, targetIds: Set<string>): { filtered: unknown; removed: number } {
  if (!Array.isArray(entries)) {
    return { filtered: entries, removed: 0 };
  }

  const filtered = entries.filter((entry) => {
    const sessionId = decodeSessionId((entry as { resource?: unknown })?.resource);
    return !sessionId || !targetIds.has(sessionId);
  });
  return {
    filtered,
    removed: entries.length - filtered.length
  };
}

function filterTodoMap(map: unknown, targetIds: Set<string>): { filtered: unknown; removed: number } {
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    return { filtered: map, removed: 0 };
  }

  const entries = Object.entries(map);
  const filtered = Object.fromEntries(entries.filter(([sessionId]) => !targetIds.has(sessionId)));
  return {
    filtered,
    removed: entries.length - Object.keys(filtered).length
  };
}

function filterIndexPayload(payload: unknown, targetIds: Set<string>): { filtered: unknown; removed: number } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { filtered: payload, removed: 0 };
  }

  const entries = "entries" in payload && payload.entries && typeof payload.entries === "object" && !Array.isArray(payload.entries)
    ? payload.entries as Record<string, unknown>
    : {};
  const filteredEntries = Object.fromEntries(Object.entries(entries).filter(([sessionId]) => !targetIds.has(sessionId)));
  return {
    filtered: {
      ...(payload as Record<string, unknown>),
      entries: filteredEntries
    },
    removed: Object.keys(entries).length - Object.keys(filteredEntries).length
  };
}

function filterWorkbenchEditorChatSessionState(payload: unknown, targetIds: Set<string>): { filtered: unknown; removed: number } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { filtered: payload, removed: 0 };
  }

  const entries = Array.isArray((payload as { chatEditorViewState?: unknown }).chatEditorViewState)
    ? ((payload as { chatEditorViewState: unknown[] }).chatEditorViewState)
    : [];
  const filteredEntries = entries.filter((entry) => {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") {
      return true;
    }

    const sessionId = decodeSessionId(entry[0]);
    return !sessionId || !targetIds.has(sessionId);
  });

  return {
    filtered: {
      ...(payload as Record<string, unknown>),
      chatEditorViewState: filteredEntries
    },
    removed: entries.length - filteredEntries.length
  };
}

async function deleteArtifactPaths(artifactPaths: string[], dryRun: boolean): Promise<{ deletedArtifactPaths: string[]; missingArtifactPaths: string[] }> {
  const deletedArtifactPaths: string[] = [];
  const missingArtifactPaths: string[] = [];

  for (const artifactPath of artifactPaths) {
    try {
      await fs.stat(artifactPath);
    } catch {
      missingArtifactPaths.push(artifactPath);
      continue;
    }

    if (!dryRun) {
      await fs.rm(artifactPath, { recursive: true, force: false });
    }

    deletedArtifactPaths.push(artifactPath);
  }

  return {
    deletedArtifactPaths,
    missingArtifactPaths
  };
}

async function loadQueueJobs(globalStorageDir: string): Promise<{ jobs: CleanupJob[]; requestsPath: string }> {
  const requestsPath = getOfflineLocalChatCleanupRequestsPath(globalStorageDir);
  try {
    const raw = (await fs.readFile(requestsPath, "utf8")).replace(/^\uFEFF/, "");
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const workspaceTargets = new Map<string, Set<string>>();
    const workspaceArtifacts = new Map<string, Set<string>>();

    for (const line of lines) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      if (!parsed || typeof parsed !== "object") {
        continue;
      }

      const workspaceStorageDir = typeof (parsed as { workspaceStorageDir?: unknown }).workspaceStorageDir === "string"
        ? (parsed as { workspaceStorageDir: string }).workspaceStorageDir
        : undefined;
      if (!workspaceStorageDir) {
        continue;
      }

      const targetSessionIds = normalizeSessionIds(Array.isArray((parsed as { targetSessionIds?: unknown }).targetSessionIds)
        ? ((parsed as { targetSessionIds: unknown[] }).targetSessionIds.filter((value): value is string => typeof value === "string"))
        : []);
      if (targetSessionIds.length === 0) {
        continue;
      }

      const targetSet = workspaceTargets.get(workspaceStorageDir) ?? new Set<string>();
      for (const sessionId of targetSessionIds) {
        targetSet.add(sessionId);
      }
      workspaceTargets.set(workspaceStorageDir, targetSet);

      const artifactSet = workspaceArtifacts.get(workspaceStorageDir) ?? new Set<string>();
      const rawArtifactPaths = Array.isArray((parsed as { artifactPaths?: unknown }).artifactPaths)
        ? ((parsed as { artifactPaths: unknown[] }).artifactPaths.filter((value): value is string => typeof value === "string"))
        : [];
      for (const artifactPath of filterArtifactPathsForWorkspace(workspaceStorageDir, rawArtifactPaths)) {
        artifactSet.add(artifactPath);
      }
      workspaceArtifacts.set(workspaceStorageDir, artifactSet);
    }

    return {
      jobs: [...workspaceTargets.entries()].map(([workspaceStorageDir, targetSessionIds]) => ({
        workspaceStorageDir,
        targetSessionIds: [...targetSessionIds],
        artifactPaths: [...(workspaceArtifacts.get(workspaceStorageDir) ?? new Set<string>())]
      })),
      requestsPath
    };
  } catch {
    return {
      jobs: [],
      requestsPath
    };
  }
}

async function runCleanupJobs(
  jobs: CleanupJob[],
  options: { dryRun: boolean; globalStorageDir?: string; requestsPath?: string }
): Promise<OfflineLocalChatCleanupReport[]> {
  const SQL = await getSqlJs();
  const reports: OfflineLocalChatCleanupReport[] = [];

  for (const job of jobs) {
    const targetIds = new Set(job.targetSessionIds);
    const artifactDeletion = await deleteArtifactPaths(job.artifactPaths, options.dryRun);
    let artifactReportPending = true;

    for (const dbName of DB_NAMES) {
      const dbPath = path.join(job.workspaceStorageDir, dbName);
      let dbBytes: Buffer;
      try {
        dbBytes = await fs.readFile(dbPath);
      } catch {
        reports.push({
          dbPath,
          missing: true,
          requestedWorkspaceStorageDir: job.workspaceStorageDir,
          removedTargetSessionIds: [...targetIds],
          deletedArtifactPaths: artifactReportPending ? artifactDeletion.deletedArtifactPaths : [],
          missingArtifactPaths: artifactReportPending ? artifactDeletion.missingArtifactPaths : []
        });
        artifactReportPending = false;
        continue;
      }

      const db: SqlDatabaseLike = new SQL.Database(dbBytes);
      try {
        const indexRaw = readValue(db, INDEX_KEY);
        const modelRaw = readValue(db, MODEL_KEY);
        const stateRaw = readValue(db, STATE_KEY);
        const todoRaw = readValue(db, TODO_KEY);
        const workbenchEditorChatSessionRaw = readValue(db, WORKBENCH_EDITOR_CHAT_SESSION_KEY);

        const indexResult = filterIndexPayload(indexRaw ? JSON.parse(indexRaw) : undefined, targetIds);
        const modelResult = filterCacheEntries(modelRaw ? JSON.parse(modelRaw) : undefined, targetIds);
        const stateResult = filterCacheEntries(stateRaw ? JSON.parse(stateRaw) : undefined, targetIds);
        const todoResult = filterTodoMap(todoRaw ? JSON.parse(todoRaw) : undefined, targetIds);
        const editorChatStateResult = filterWorkbenchEditorChatSessionState(workbenchEditorChatSessionRaw ? JSON.parse(workbenchEditorChatSessionRaw) : undefined, targetIds);

        if (!options.dryRun) {
          if (typeof indexRaw === "string") {
            writeValue(db, INDEX_KEY, JSON.stringify(indexResult.filtered));
          }
          if (typeof modelRaw === "string") {
            writeValue(db, MODEL_KEY, JSON.stringify(modelResult.filtered));
          }
          if (typeof stateRaw === "string") {
            writeValue(db, STATE_KEY, JSON.stringify(stateResult.filtered));
          }
          if (typeof todoRaw === "string") {
            writeValue(db, TODO_KEY, JSON.stringify(todoResult.filtered));
          }
          if (typeof workbenchEditorChatSessionRaw === "string") {
            writeValue(db, WORKBENCH_EDITOR_CHAT_SESSION_KEY, JSON.stringify(editorChatStateResult.filtered));
          }

          await fs.writeFile(dbPath, Buffer.from(db.export()));
        }

        reports.push({
          dbPath,
          dryRun: options.dryRun,
          requestedWorkspaceStorageDir: job.workspaceStorageDir,
          removedTargetSessionIds: [...targetIds],
          deletedArtifactPaths: artifactReportPending ? artifactDeletion.deletedArtifactPaths : [],
          missingArtifactPaths: artifactReportPending ? artifactDeletion.missingArtifactPaths : [],
          removedIndexEntries: indexResult.removed,
          removedModelEntries: modelResult.removed,
          removedStateEntries: stateResult.removed,
          removedTodoEntries: todoResult.removed,
          removedEditorChatViewStateEntries: editorChatStateResult.removed
        });
        artifactReportPending = false;
      } finally {
        db.close();
      }
    }
  }

  if (options.globalStorageDir && !options.dryRun && reports.length > 0) {
    const reportPath = createOfflineLocalChatCleanupReportPath(options.globalStorageDir);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
  }

  if (options.globalStorageDir && !options.dryRun && jobs.length > 0 && options.requestsPath) {
    await fs.rm(options.requestsPath, { force: true });
  }

  return reports;
}

async function listCodeProcessNames(): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    execFile("tasklist.exe", ["/FO", "CSV", "/NH"], { windowsHide: true }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }

      const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      resolve(lines
        .filter((line) => /^"Code[^\"]*\.exe"/i.test(line))
        .map((line) => line.replace(/^"/, "").split('","')[0] ?? line));
    });
  });
}

async function assertCodeProcessesStopped(allowCodeProcess: boolean): Promise<void> {
  if (allowCodeProcess || process.platform !== "win32") {
    return;
  }

  const codeProcesses = [...new Set(await listCodeProcessNames())];
  if (codeProcesses.length > 0) {
    throw new Error(`VS Code still appears to be running (${codeProcesses.join(", ")}). Close it completely or re-run with --allow-code-process if you intentionally want to bypass this guard.`);
  }
}

async function waitForVsCodeExit(pollIntervalMs: number): Promise<void> {
  while ((await listCodeProcessNames()).length > 0) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

async function waitForProcessExit(pid: number, pollIntervalMs: number): Promise<void> {
  while (true) {
    try {
      process.kill(pid, 0);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
      if (code === "ESRCH") {
        return;
      }
      if (code === "EPERM") {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        continue;
      }
      throw error;
    }
  }
}

async function runSchedule(globalStorageDir: string, pollIntervalMs: number, waitForPid?: number): Promise<OfflineLocalChatCleanupReport[]> {
  await fs.mkdir(globalStorageDir, { recursive: true });
  if (typeof waitForPid === "number" && waitForPid > 0) {
    await waitForProcessExit(waitForPid, pollIntervalMs);
  } else {
    await waitForVsCodeExit(pollIntervalMs);
  }

  const lockPath = getOfflineLocalChatCleanupLockPath(globalStorageDir);
  let lockHandle;
  try {
    lockHandle = await fs.open(lockPath, "wx");
  } catch {
    return [];
  }

  try {
    const { jobs, requestsPath } = await loadQueueJobs(globalStorageDir);
    return await runCleanupJobs(jobs, {
      dryRun: false,
      globalStorageDir,
      requestsPath
    });
  } finally {
    await lockHandle.close();
    await fs.rm(lockPath, { force: true });
  }
}

async function runPrune(values: ReturnType<typeof parseArgs>["values"]): Promise<OfflineLocalChatCleanupReport[]> {
  const allowCodeProcess = Boolean(values["allow-code-process"]);
  const dryRun = Boolean(values["dry-run"]);
  const globalStorageDir = values["global-storage-dir"] as string | undefined;
  const workspaceStorageDir = values["workspace-storage-dir"] as string | undefined;
  const targetSessionIds = ((values["target-session-id"] as string[] | undefined) ?? []);
  const artifactPaths = ((values["artifact-path"] as string[] | undefined) ?? []);

  await assertCodeProcessesStopped(allowCodeProcess);

  if (globalStorageDir) {
    const { jobs, requestsPath } = await loadQueueJobs(globalStorageDir);
    return runCleanupJobs(jobs, {
      dryRun,
      globalStorageDir,
      requestsPath
    });
  }

  if (!workspaceStorageDir) {
    throw new Error("prune requires --global-storage-dir or --workspace-storage-dir");
  }

  const normalizedTargetSessionIds = normalizeSessionIds(targetSessionIds);
  if (normalizedTargetSessionIds.length === 0) {
    throw new Error("prune requires at least one --target-session-id in direct mode");
  }

  const defaultArtifactPaths = normalizedTargetSessionIds.flatMap((sessionId) =>
    buildWorkspaceStorageOfflineLocalChatCleanupRequest(workspaceStorageDir, sessionId).artifactPaths
  );

  const jobs: CleanupJob[] = [{
    workspaceStorageDir,
    targetSessionIds: normalizedTargetSessionIds,
    artifactPaths: filterArtifactPathsForWorkspace(workspaceStorageDir, [...defaultArtifactPaths, ...artifactPaths])
  }];
  return runCleanupJobs(jobs, { dryRun });
}

function usage(): string {
  return [
    "Usage:",
    "  offline-local-chat-cleanup schedule --global-storage-dir <path> [--poll-interval-ms <n>]",
    "  offline-local-chat-cleanup prune --global-storage-dir <path> [--allow-code-process] [--dry-run]",
    "  offline-local-chat-cleanup prune --workspace-storage-dir <path> --target-session-id <id>... [--artifact-path <path>...] [--allow-code-process] [--dry-run]"
  ].join("\n");
}

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  if (command === "schedule") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "global-storage-dir": { type: "string" },
        "poll-interval-ms": { type: "string" },
        "wait-for-pid": { type: "string" }
      },
      allowPositionals: false
    });
    const globalStorageDir = values["global-storage-dir"] as string | undefined;
    if (!globalStorageDir) {
      throw new Error("schedule requires --global-storage-dir");
    }
    const waitForPid = values["wait-for-pid"] ? Number(values["wait-for-pid"]) : undefined;
    const reports = await runSchedule(globalStorageDir, Number(values["poll-interval-ms"] ?? "1000"), waitForPid);
    process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
    return 0;
  }

  if (command === "prune") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "global-storage-dir": { type: "string" },
        "workspace-storage-dir": { type: "string" },
        "target-session-id": { type: "string", multiple: true },
        "artifact-path": { type: "string", multiple: true },
        "allow-code-process": { type: "boolean" },
        "dry-run": { type: "boolean" }
      },
      allowPositionals: false
    });
    const reports = await runPrune(values);
    process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
    return 0;
  }

  throw new Error(`Unsupported command: ${command}`);
}

void main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});