import path from "node:path";
import { promises as fs } from "node:fs";
import {
  getOfflineLocalChatCleanupLockPath,
  getOfflineLocalChatCleanupReportsDir,
  getOfflineLocalChatCleanupRequestsPath
} from "./offlineLocalChatCleanup";

export interface RollingLogOptions {
  maxBytes: number;
  retainBytes?: number;
}

export interface GlobalStorageCleanupOptions {
  nowMs?: number;
  staleLockMs?: number;
  reportRetentionMs?: number;
  maxReportFiles?: number;
}

export interface GlobalStorageCleanupResult {
  removedReportFilePaths: string[];
  removedLockFilePath?: string;
  removedEmptyRequestsPath?: string;
}

const DEFAULT_RETAIN_RATIO = 0.75;
const DEFAULT_STALE_LOCK_MS = 12 * 60 * 60 * 1000;
const DEFAULT_REPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_REPORT_FILES = 20;

export async function appendLineToRollingLog(logPath: string, line: string, options: RollingLogOptions): Promise<void> {
  const normalizedLine = line.endsWith("\n") ? line : `${line}\n`;
  const retainBytes = normalizeRetainBytes(options.maxBytes, options.retainBytes);
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await trimFileIfNeeded(logPath, options.maxBytes, retainBytes);
  await fs.appendFile(logPath, normalizedLine, "utf8");
  await trimFileIfNeeded(logPath, options.maxBytes, retainBytes);
}

export async function cleanupGlobalStorageArtifacts(
  globalStorageDir: string,
  options: GlobalStorageCleanupOptions = {}
): Promise<GlobalStorageCleanupResult> {
  const nowMs = Number.isFinite(options.nowMs) ? Number(options.nowMs) : Date.now();
  const staleLockMs = Number.isFinite(options.staleLockMs) ? Number(options.staleLockMs) : DEFAULT_STALE_LOCK_MS;
  const reportRetentionMs = Number.isFinite(options.reportRetentionMs) ? Number(options.reportRetentionMs) : DEFAULT_REPORT_RETENTION_MS;
  const maxReportFiles = Number.isInteger(options.maxReportFiles) && (options.maxReportFiles ?? 0) > 0
    ? Number(options.maxReportFiles)
    : DEFAULT_MAX_REPORT_FILES;

  const result: GlobalStorageCleanupResult = { removedReportFilePaths: [] };
  const reportsDir = getOfflineLocalChatCleanupReportsDir(globalStorageDir);
  const lockPath = getOfflineLocalChatCleanupLockPath(globalStorageDir);
  const requestsPath = getOfflineLocalChatCleanupRequestsPath(globalStorageDir);

  const reportEntries = await safeReadFileEntries(reportsDir);
  const datedReports = (await Promise.all(reportEntries
    .filter((entry) => entry.isFile())
    .map(async (entry) => {
      const fullPath = path.join(reportsDir, entry.name);
      const stat = await safeStat(fullPath);
      return stat ? { fullPath, mtimeMs: stat.mtimeMs } : undefined;
    })))
    .filter((entry): entry is { fullPath: string; mtimeMs: number } => Boolean(entry))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  for (let index = 0; index < datedReports.length; index += 1) {
    const report = datedReports[index];
    const expired = nowMs - report.mtimeMs > reportRetentionMs;
    const overflow = index >= maxReportFiles;
    if (!expired && !overflow) {
      continue;
    }
    await fs.rm(report.fullPath, { force: true });
    result.removedReportFilePaths.push(report.fullPath);
  }

  const lockStat = await safeStat(lockPath);
  if (lockStat && nowMs - lockStat.mtimeMs > staleLockMs) {
    await fs.rm(lockPath, { force: true });
    result.removedLockFilePath = lockPath;
  }

  const requestsStat = await safeStat(requestsPath);
  if (requestsStat && requestsStat.size === 0) {
    await fs.rm(requestsPath, { force: true });
    result.removedEmptyRequestsPath = requestsPath;
  }

  return result;
}

function normalizeRetainBytes(maxBytes: number, retainBytes: number | undefined): number {
  if (Number.isInteger(retainBytes) && (retainBytes ?? 0) > 0 && (retainBytes ?? 0) < maxBytes) {
    return retainBytes as number;
  }
  return Math.max(1, Math.floor(maxBytes * DEFAULT_RETAIN_RATIO));
}

async function trimFileIfNeeded(logPath: string, maxBytes: number, retainBytes: number): Promise<void> {
  const stat = await safeStat(logPath);
  if (!stat || stat.size <= maxBytes) {
    return;
  }
  const bytes = await fs.readFile(logPath);
  if (bytes.length <= retainBytes) {
    return;
  }
  const retainedSlice = bytes.subarray(bytes.length - retainBytes);
  const newlineIndex = retainedSlice.indexOf(0x0a);
  const trimmed = newlineIndex >= 0 && newlineIndex + 1 < retainedSlice.length
    ? retainedSlice.subarray(newlineIndex + 1)
    : retainedSlice;
  await fs.writeFile(logPath, trimmed);
}

async function safeReadFileEntries(dirPath: string) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function safeStat(targetPath: string) {
  try {
    return await fs.stat(targetPath);
  } catch {
    return undefined;
  }
}