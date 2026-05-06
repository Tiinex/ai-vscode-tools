import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

export interface OfflineLocalChatCleanupRequest {
  workspaceStorageDir: string;
  targetSessionIds: string[];
  artifactPaths: string[];
}

export interface OfflineLocalChatCleanupLaunchRequest {
  extensionRoot: string;
  globalStorageDir: string;
  waitForPid?: number;
}

export interface OfflineLocalChatCleanupReport {
  dbPath?: string;
  dryRun?: boolean;
  requestedWorkspaceStorageDir?: string;
  removedTargetSessionIds?: string[];
  deletedArtifactPaths?: string[];
  missingArtifactPaths?: string[];
  removedIndexEntries?: number;
  removedModelEntries?: number;
  removedStateEntries?: number;
  removedTodoEntries?: number;
  missing?: boolean;
}

export interface OfflineLocalChatCleanupLaunchSpec {
  executable: string;
  args: string[];
  options: {
    detached: true;
    stdio: "ignore";
    windowsHide: true;
    env: NodeJS.ProcessEnv;
  };
}

export interface OfflineLocalChatCleanupSummary {
  reportFilePaths: string[];
  reports: OfflineLocalChatCleanupReport[];
}

const OFFLINE_LOCAL_CHAT_CLEANUP_REQUESTS_FILE = "offline-local-chat-cleanup-requests.jsonl";
const OFFLINE_LOCAL_CHAT_CLEANUP_REPORTS_DIR = "offline-local-chat-cleanup-reports";
const OFFLINE_LOCAL_CHAT_CLEANUP_REPORT_PREFIX = "offline-local-chat-cleanup-report-";
const OFFLINE_LOCAL_CHAT_CLEANUP_LOCK_FILE = "offline-local-chat-cleanup.lock";

function normalizeSessionIds(sessionIds: string[]): string[] {
  return [...new Set(sessionIds.map((sessionId) => sessionId.trim()).filter(Boolean))];
}

function normalizeArtifactPaths(artifactPaths: string[]): string[] {
  return [...new Set(artifactPaths.map((artifactPath) => artifactPath.trim()).filter(Boolean))];
}

export function buildWorkspaceStorageOfflineLocalChatCleanupRequest(
  workspaceStorageDir: string,
  sessionId: string
): OfflineLocalChatCleanupRequest {
  const normalizedSessionId = sessionId.trim();
  const artifactPaths = [
    path.join(workspaceStorageDir, "chatSessions", `${normalizedSessionId}.jsonl`),
    path.join(workspaceStorageDir, "chatEditingSessions", normalizedSessionId),
    path.join(workspaceStorageDir, "chatEditingSessions", `${normalizedSessionId}.jsonl`),
    path.join(workspaceStorageDir, "transcripts", `${normalizedSessionId}.jsonl`),
    path.join(workspaceStorageDir, "GitHub.copilot-chat", "transcripts", `${normalizedSessionId}.jsonl`),
    path.join(workspaceStorageDir, "GitHub.copilot-chat", "chat-session-resources", normalizedSessionId)
  ];

  return {
    workspaceStorageDir,
    targetSessionIds: [normalizedSessionId],
    artifactPaths
  };
}

export function getOfflineLocalChatCleanupRequestsPath(globalStorageDir: string): string {
  return path.join(globalStorageDir, OFFLINE_LOCAL_CHAT_CLEANUP_REQUESTS_FILE);
}

export function getOfflineLocalChatCleanupReportsDir(globalStorageDir: string): string {
  return path.join(globalStorageDir, OFFLINE_LOCAL_CHAT_CLEANUP_REPORTS_DIR);
}

export function getOfflineLocalChatCleanupLockPath(globalStorageDir: string): string {
  return path.join(globalStorageDir, OFFLINE_LOCAL_CHAT_CLEANUP_LOCK_FILE);
}

export function createOfflineLocalChatCleanupReportPath(globalStorageDir: string): string {
  return path.join(
    getOfflineLocalChatCleanupReportsDir(globalStorageDir),
    `${OFFLINE_LOCAL_CHAT_CLEANUP_REPORT_PREFIX}${Date.now()}-${randomUUID()}.json`
  );
}

export async function queueOfflineLocalChatCleanupRequest(
  globalStorageDir: string,
  request: OfflineLocalChatCleanupRequest
): Promise<string> {
  const requestsPath = getOfflineLocalChatCleanupRequestsPath(globalStorageDir);
  const targetSessionIds = normalizeSessionIds(request.targetSessionIds);
  const artifactPaths = normalizeArtifactPaths(request.artifactPaths);
  if (targetSessionIds.length === 0) {
    throw new Error("At least one targetSessionId is required to queue offline cleanup.");
  }

  if (artifactPaths.length === 0) {
    throw new Error("At least one artifact path is required to queue offline cleanup.");
  }

  await fs.mkdir(globalStorageDir, { recursive: true });
  await fs.appendFile(
    requestsPath,
    `${JSON.stringify({
      workspaceStorageDir: request.workspaceStorageDir,
      targetSessionIds,
      artifactPaths,
      requestedAt: new Date().toISOString()
    })}\n`,
    "utf8"
  );

  return requestsPath;
}

export function buildOfflineLocalChatCleanupLaunchSpec(
  request: OfflineLocalChatCleanupLaunchRequest
): OfflineLocalChatCleanupLaunchSpec {
  if (process.platform !== "win32") {
    throw new Error("Offline Local chat cleanup scheduling is currently implemented only for Windows hosts.");
  }

  const cleanupCliPath = path.join(request.extensionRoot, "dist", "tooling", "offlineLocalChatCleanupCli.js");

  return {
    executable: process.execPath,
    args: [
      cleanupCliPath,
      "schedule",
      "--global-storage-dir",
      request.globalStorageDir,
      ...(typeof request.waitForPid === "number" && request.waitForPid > 0
        ? ["--wait-for-pid", String(request.waitForPid)]
        : [])
    ],
    options: {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1"
      }
    }
  };
}

export function launchOfflineLocalChatCleanup(request: OfflineLocalChatCleanupLaunchRequest): string {
  const spec = buildOfflineLocalChatCleanupLaunchSpec(request);
  const child = spawn(spec.executable, spec.args, spec.options);
  child.unref();
  return request.globalStorageDir;
}

export async function readAndDeleteOfflineLocalChatCleanupReports(
  globalStorageDir: string
): Promise<OfflineLocalChatCleanupSummary | undefined> {
  try {
    const reportsDir = getOfflineLocalChatCleanupReportsDir(globalStorageDir);
    const entries = await fs.readdir(reportsDir, { withFileTypes: true });
    const reportPaths = entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(OFFLINE_LOCAL_CHAT_CLEANUP_REPORT_PREFIX) && entry.name.endsWith(".json"))
      .map((entry) => path.join(reportsDir, entry.name))
      .sort((left, right) => left.localeCompare(right));

    if (reportPaths.length === 0) {
      return undefined;
    }

    const reports: OfflineLocalChatCleanupReport[] = [];
    for (const reportPath of reportPaths) {
      const raw = await fs.readFile(reportPath, "utf8");
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
      if (Array.isArray(parsed)) {
        reports.push(...parsed as OfflineLocalChatCleanupReport[]);
      }
      await fs.rm(reportPath, { force: true });
    }

    return {
      reportFilePaths: reportPaths,
      reports
    };
  } catch {
    return undefined;
  }
}

export function formatOfflineLocalChatCleanupSummary(summary: OfflineLocalChatCleanupSummary): string {
  const totals = summary.reports.reduce<{
    dbCount: number;
    deletedArtifactCount: number;
    missingArtifactCount: number;
    removedIndexEntries: number;
    removedModelEntries: number;
    removedStateEntries: number;
    removedTodoEntries: number;
  }>((accumulator, report) => {
    accumulator.dbCount += report.missing ? 0 : 1;
    accumulator.deletedArtifactCount += report.deletedArtifactPaths?.length ?? 0;
    accumulator.missingArtifactCount += report.missingArtifactPaths?.length ?? 0;
    accumulator.removedIndexEntries += report.removedIndexEntries ?? 0;
    accumulator.removedModelEntries += report.removedModelEntries ?? 0;
    accumulator.removedStateEntries += report.removedStateEntries ?? 0;
    accumulator.removedTodoEntries += report.removedTodoEntries ?? 0;
    return accumulator;
  }, {
    dbCount: 0,
    deletedArtifactCount: 0,
    missingArtifactCount: 0,
    removedIndexEntries: 0,
    removedModelEntries: 0,
    removedStateEntries: 0,
    removedTodoEntries: 0
  });

  return [
    `Offline Local chat cleanup completed for ${totals.dbCount} database(s).`,
    `Deleted queued artifacts: ${totals.deletedArtifactCount}.`,
    `Missing queued artifacts: ${totals.missingArtifactCount}.`,
    `Removed index entries: ${totals.removedIndexEntries}.`,
    `Removed model cache entries: ${totals.removedModelEntries}.`,
    `Removed state cache entries: ${totals.removedStateEntries}.`,
    `Removed todo entries: ${totals.removedTodoEntries}.`
  ].join(" ");
}