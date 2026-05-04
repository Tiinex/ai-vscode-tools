import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

export interface OfflineLocalChatCleanupRequest {
  extensionRoot: string;
  workspaceStorageDir: string;
  keepSessionIds: string[];
  reportFilePath: string;
}

export interface OfflineLocalChatCleanupReport {
  dbPath?: string;
  dryRun?: boolean;
  removedIndexEntries?: number;
  removedModelEntries?: number;
  removedStateEntries?: number;
  removedTodoEntries?: number;
  keptSessionIds?: string[];
  missing?: boolean;
}

export interface OfflineLocalChatCleanupLaunchSpec {
  executable: string;
  args: string[];
  options: {
    detached: true;
    stdio: "ignore";
    windowsHide: true;
  };
}

export interface OfflineLocalChatCleanupSummary {
  reportFilePath: string;
  reports: OfflineLocalChatCleanupReport[];
}

export function getOfflineLocalChatCleanupReportPath(globalStorageDir: string): string {
  return path.join(globalStorageDir, "offline-local-chat-cleanup-report.json");
}

export function buildOfflineLocalChatCleanupLaunchSpec(
  request: OfflineLocalChatCleanupRequest
): OfflineLocalChatCleanupLaunchSpec {
  const schedulerScriptPath = path.join(request.extensionRoot, "tools", "schedule-local-chat-state-cleanup.ps1");

  return {
    executable: "powershell.exe",
    args: [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      schedulerScriptPath,
      "-ExtensionRoot",
      request.extensionRoot,
      "-WorkspaceStorageDir",
      request.workspaceStorageDir,
      "-ReportFile",
      request.reportFilePath,
      ...request.keepSessionIds.flatMap((sessionId) => ["-KeepSessionId", sessionId])
    ],
    options: {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    }
  };
}

export function launchOfflineLocalChatCleanup(request: OfflineLocalChatCleanupRequest): string {
  const spec = buildOfflineLocalChatCleanupLaunchSpec(request);
  const child = spawn(spec.executable, spec.args, spec.options);
  child.unref();
  return request.reportFilePath;
}

export async function readAndDeleteOfflineLocalChatCleanupReport(
  reportFilePath: string
): Promise<OfflineLocalChatCleanupSummary | undefined> {
  try {
    const raw = await fs.readFile(reportFilePath, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    await fs.rm(reportFilePath, { force: true });
    return {
      reportFilePath,
      reports: Array.isArray(parsed) ? parsed as OfflineLocalChatCleanupReport[] : []
    };
  } catch {
    return undefined;
  }
}

export function formatOfflineLocalChatCleanupSummary(summary: OfflineLocalChatCleanupSummary): string {
  const totals = summary.reports.reduce<{
    dbCount: number;
    removedIndexEntries: number;
    removedModelEntries: number;
    removedStateEntries: number;
    removedTodoEntries: number;
  }>((accumulator, report) => {
    accumulator.dbCount += report.missing ? 0 : 1;
    accumulator.removedIndexEntries += report.removedIndexEntries ?? 0;
    accumulator.removedModelEntries += report.removedModelEntries ?? 0;
    accumulator.removedStateEntries += report.removedStateEntries ?? 0;
    accumulator.removedTodoEntries += report.removedTodoEntries ?? 0;
    return accumulator;
  }, {
    dbCount: 0,
    removedIndexEntries: 0,
    removedModelEntries: 0,
    removedStateEntries: 0,
    removedTodoEntries: 0
  });

  return [
    `Offline Local chat cleanup completed for ${totals.dbCount} database(s).`,
    `Removed index entries: ${totals.removedIndexEntries}.`,
    `Removed model cache entries: ${totals.removedModelEntries}.`,
    `Removed state cache entries: ${totals.removedStateEntries}.`,
    `Removed todo entries: ${totals.removedTodoEntries}.`
  ].join(" ");
}