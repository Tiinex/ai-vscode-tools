import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { loadWorkspaceSessionIndex } from "../sessionIndex";

const ROLE_NOISE_KEYS = new Set(["encrypted", "statefulMarker", "promptText", "description"]);
const NOISE_PATH_SNIPPETS = [
  "inputState/selections",
  "followups",
  "modelState",
  "responseMarkdownInfo",
  "hasPendingEdits",
  "responderUsername"
];
const GENERIC_PREVIEWS = new Set([
  "inputState",
  "inputText",
  "attachments",
  "contrib",
  "requests",
  "modelState",
  "responseMarkdownInfo",
  "commentary",
  "hasPendingEdits",
  "responderUsername"
]);

export const DEFAULT_MAX_OUTPUT_CHARS = 12_000;
export const HARD_MAX_OUTPUT_CHARS = 20_000;
const DEFAULT_ACTIVE_REQUEST_FAMILY_WINDOW = 16;
const IMPLICIT_TOOL_DEFINITION_CHAR_RATIO = 0.06;
const IMPLICIT_TOOL_DEFINITION_CHARS_PER_INVOCATION = 260;
const MAX_IMPLICIT_TOOL_DEFINITION_CHARS = 30_000;
const IMPLICIT_SYSTEM_INSTRUCTION_CHAR_MULTIPLIER = 2.1;
const MAX_RESULT_TOOL_CALL_RESULT_CHARS_PER_CALL = 3_500;
const RESULT_TOOL_CALL_RESULT_HIDDEN_CHAR_RATIO = 0.2;
const MAX_RESULT_TOOL_CALL_RESULT_HIDDEN_CHARS_PER_CALL = 1_800;
const MAX_RESPONSE_EDIT_TEXT_CHARS_PER_ENTRY = 120;
const MAX_RESPONSE_EDIT_SUMMARY_CHARS_PER_GROUP = 600;
const MAX_RESPONSE_EDIT_PROXY_CHARS_PER_GROUP = 16_000;
const RESPONSE_EDIT_PROXY_CHAR_RATIO = 0.26;
const MAX_LIST_LIMIT = 30;
const MAX_TAIL_RECORDS = 200;
const MAX_WINDOW_BEFORE = 12;
const MAX_WINDOW_AFTER = 20;
const MAX_WINDOW_MATCHES = 5;
const MAX_SURVEY_LIMIT = 8;
const REQUEST_RESULT_PATH = /^requests\/\d+\/result$/;
const REQUEST_RESPONSE_PATH = /^requests\/\d+\/response$/;

export const DEFAULT_ASSUMED_WINDOW_TOKENS = 400_000;

const MODULE_DIR = __dirname;
const PACKAGE_ROOT = path.resolve(MODULE_DIR, "..", "..");
const WORKSPACE_ROOT = PACKAGE_ROOT;
const TRANSCRIPT_ARTIFACT_MISSING_CODE = "COPILOT_TRANSCRIPT_ARTIFACT_MISSING";

type ContextCategoryName = "systemInstructions" | "toolDefinitions" | "userContext" | "messages" | "files" | "toolResults" | "unknown";

export interface SessionCandidate {
  sessionId: string;
  title?: string;
  jsonlPath: string;
  workspaceStorageDir: string;
  mtime: number;
  size: number;
}

export interface RecordSummary {
  lineNo: number;
  kind: unknown;
  keyPath: string;
  timestamp?: string;
  requestId?: string;
  preview: string;
}

export interface SessionSelector {
  storageRoots?: string[];
  sessionId?: string;
  sessionFile?: string;
  latest?: boolean;
}

export interface IndexResult {
  candidate: SessionCandidate;
  entries: RecordSummary[];
}

export interface WindowResult {
  candidate: SessionCandidate;
  anchorText?: string;
  anchorOccurrence?: AnchorOccurrence;
  before: number;
  after: number;
  matches: RecordSummary[][];
  afterLatestCompact: boolean;
  compactionBoundaryLine?: number;
}

export interface ExportResult {
  candidate: SessionCandidate;
  entries: RecordSummary[];
  includeNoise: boolean;
}

type EvidenceFlow = "Main thread" | "Descendant" | "Artifact anchor";
type EvidenceHeading = "User Message" | "Assistant Message" | "Tool Invocation" | "Tool Result" | "Access Limit";

interface EvidencePayload {
  label?: string;
  language: "text" | "json" | "markdown";
  content: string;
}

export interface TranscriptEvidenceBlock {
  id: string;
  heading: EvidenceHeading;
  flow: EvidenceFlow;
  parent: string;
  source: string;
  verbatim: true;
  tool?: string;
  timestamp?: string;
  payloads: EvidencePayload[];
}

export interface TranscriptEvidenceResult {
  candidate: SessionCandidate;
  transcriptPath?: string;
  transcriptAvailable: boolean;
  selectorPath?: string;
  totalRows: number;
  blocks: TranscriptEvidenceBlock[];
  omissions: string[];
  unavailableReason?: string;
  attemptedPaths?: string[];
  supplementaryResourcePath?: string;
  fallbackSnapshot?: SnapshotResult;
  fallbackIndex?: IndexResult;
  fallbackWindow?: WindowResult;
  anchorText?: string;
  anchorOccurrence?: AnchorOccurrence;
  afterLatestCompact: boolean;
  maxBlocks?: number;
  compactionBoundaryApplied: boolean;
}

export interface SnapshotResult {
  candidate: SessionCandidate;
  includeNoise: boolean;
  totalRows: number;
  includedRows: number;
  activityKind: SessionActivityKind;
  activitySummary: string;
  latestTimestamp?: string;
  latestUserMessage?: RecordSummary;
  latestAssistantMessage?: RecordSummary;
  latestToolActivity?: RecordSummary;
  latestRequest?: RecordSummary;
  pendingRequestCount: number;
  pendingRequestIds: string[];
  requestCount: number;
  responseCount: number;
  resultCount: number;
  toolInvocationCount: number;
  parseErrorCount: number;
  persistedSelection: PersistedSelectionState;
}

export interface PersistedSelectionState {
  inputModeId?: string;
  inputModeKind?: string;
  selectedModelId?: string;
  selectedModelName?: string;
  latestRequestId?: string;
  latestRequestAgentId?: string;
  latestRequestAgentName?: string;
  latestRequestModelId?: string;
  latestRequestModeId?: string;
  latestRequestModeName?: string;
}

export interface ContextCategoryEstimate {
  chars: number;
  estimatedTokens: number;
  rows: number;
}

export interface ContextEstimateResult {
  candidate: SessionCandidate;
  includeNoise: boolean;
  exactUiParity: false;
  activityKind: SessionActivityKind;
  activitySummary: string;
  tokenHeuristic: string;
  totalRows: number;
  includedRows: number;
  activeRows: number;
  activeRequestFamilies: number;
  categories: Record<ContextCategoryName, ContextCategoryEstimate>;
  observedPromptChars: number;
  observedPromptTokens: number;
  reservedResponseTokens: number;
  assumedWindowTokens: number;
  estimatedTotalWithReserveTokens: number;
  utilizationRatio: number;
  pressureLevel: "low" | "medium" | "high";
  signals: string[];
  afterLatestCompact: boolean;
  latestRequestFamiliesLimit?: number;
  compactionBoundaryApplied: boolean;
}

export type AnchorOccurrence = "first" | "last";

export interface SessionProfileFinding {
  severity: "high" | "medium" | "low";
  summary: string;
}

export interface SessionProfileResult {
  snapshot: SnapshotResult;
  contextEstimate: ContextEstimateResult;
  findings: SessionProfileFinding[];
}

export interface SessionSurveyItem {
  candidate: SessionCandidate;
  activityKind: SessionActivityKind;
  latestTimestamp?: string;
  latestUserMessage?: string;
  activeRequestFamilies: number;
  pendingRequestCount: number;
  requestCount: number;
  toolInvocationCount: number;
  contextPressure: "low" | "medium" | "high";
  utilizationRatio: number;
  topSignals: string[];
}

export interface SessionSurveyResult {
  includeNoise: boolean;
  reservedResponseTokens: number;
  assumedWindowTokens: number;
  items: SessionSurveyItem[];
}

export type SessionActivityKind = "bootstrap-stub" | "draft-only" | "sparse-interaction" | "interactive";

export interface SessionActivityAssessment {
  kind: SessionActivityKind;
  summary: string;
}

export interface IndexOptions extends SessionSelector {
  tail: number;
  includeNoise?: boolean;
}

export interface WindowOptions extends SessionSelector {
  anchorText?: string;
  anchorOccurrence?: AnchorOccurrence;
  before: number;
  after: number;
  maxMatches: number;
  includeNoise?: boolean;
  afterLatestCompact?: boolean;
}

export interface ExportOptions extends SessionSelector {
  includeNoise?: boolean;
}

export interface SnapshotOptions extends SessionSelector {
  includeNoise?: boolean;
}

export interface TranscriptEvidenceOptions extends SessionSelector {
  anchorText?: string;
  anchorOccurrence?: AnchorOccurrence;
  afterLatestCompact?: boolean;
  maxBlocks?: number;
}

export interface ContextEstimateOptions extends SessionSelector {
  includeNoise?: boolean;
  reservedResponseTokens?: number;
  assumedWindowTokens?: number;
  afterLatestCompact?: boolean;
  latestRequestFamilies?: number;
}

export interface ProfileOptions extends SessionSelector {
  includeNoise?: boolean;
  reservedResponseTokens?: number;
  assumedWindowTokens?: number;
}

export interface SurveyOptions {
  storageRoots?: string[];
  includeNoise?: boolean;
  limit: number;
  reservedResponseTokens?: number;
  assumedWindowTokens?: number;
}

export interface RenderBudgetOptions {
  maxChars?: number;
  detailLevel?: RenderDetailLevel;
}

export type RenderDetailLevel = "summary" | "full";

export type DeliveryMode = "file-only" | "file-and-inline-if-safe" | "inline-if-safe";

export interface DeliveryOptions {
  mode: DeliveryMode;
  outputFile?: string;
  maxInlineChars?: number;
}

export interface DeliveryResult {
  responseText: string;
  inlineIncluded: boolean;
  outputFile?: string;
  contentChars: number;
  maxInlineChars: number;
}

interface TranscriptArtifactMissingError extends Error {
  code: typeof TRANSCRIPT_ARTIFACT_MISSING_CODE;
  sessionId: string;
  attemptedPaths: string[];
}

export function candidateStorageRoots(extraRoots: string[] = []): string[] {
  const home = os.homedir();
  const validatedExtraRoots = extraRoots.map((root) => validateStorageRoot(root));
  const roots = validatedExtraRoots.length > 0
    ? validatedExtraRoots.map((root) => path.resolve(root.replace(/^~(?=$|\/|\\)/, home)))
    : [
        path.join(home, ".config/Code/User/workspaceStorage"),
        path.join(home, ".config/Code - Insiders/User/workspaceStorage"),
        path.join(home, ".vscode-server/data/User/workspaceStorage"),
        path.join(home, ".vscode-server-insiders/data/User/workspaceStorage"),
        path.join(home, "Library/Application Support/Code/User/workspaceStorage"),
        path.join(home, "Library/Application Support/Code - Insiders/User/workspaceStorage"),
        ...(process.env.APPDATA ? [path.join(process.env.APPDATA, "Code/User/workspaceStorage")] : []),
        ...(process.env.APPDATA ? [path.join(process.env.APPDATA, "Code - Insiders/User/workspaceStorage")] : [])
      ];

  const dedup = new Set<string>();
  for (const root of roots) {
    dedup.add(path.resolve(root));
  }
  return [...dedup];
}

function isPathWithin(basePath: string, targetPath: string): boolean {
  const relative = path.relative(basePath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function hasWorkspaceStorageSegment(targetPath: string): boolean {
  return targetPath.replace(/\\/g, "/").split("/").includes("workspaceStorage");
}

function validateStorageRoot(root: string): string {
  const resolved = path.resolve(root.replace(/^~(?=$|\/|\\)/, os.homedir()));
  if (isPathWithin(WORKSPACE_ROOT, resolved) || hasWorkspaceStorageSegment(resolved)) {
    return resolved;
  }
  throw new Error(`Rejected storageRoot outside allowed locations: ${resolved}`);
}

function validateSessionFilePath(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (!resolved.endsWith(".jsonl")) {
    throw new Error(`Rejected sessionFile without .jsonl extension: ${resolved}`);
  }
  if (isPathWithin(WORKSPACE_ROOT, resolved) || hasWorkspaceStorageSegment(resolved)) {
    return resolved;
  }
  throw new Error(`Rejected sessionFile outside workspace or workspaceStorage roots: ${resolved}`);
}

function validateOutputFilePath(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (!isPathWithin(WORKSPACE_ROOT, resolved)) {
    throw new Error(`Rejected outputFile outside workspace root: ${resolved}`);
  }
  return resolved;
}

async function buildSessionCandidateFromJsonlPath(jsonlPath: string): Promise<SessionCandidate> {
  const stat = await fs.stat(jsonlPath);
  return {
    sessionId: path.basename(jsonlPath, ".jsonl"),
    title: await inferSessionTitle(jsonlPath),
    jsonlPath,
    workspaceStorageDir: path.dirname(path.dirname(jsonlPath)),
    mtime: stat.mtimeMs,
    size: stat.size
  };
}

async function hydrateCandidateFromWorkspaceIndex(candidate: SessionCandidate): Promise<SessionCandidate> {
  const indexedEntries = await loadWorkspaceSessionIndex(candidate.workspaceStorageDir);
  const indexedEntry = indexedEntries?.get(candidate.sessionId);
  if (!indexedEntry) {
    return candidate;
  }
  return {
    ...candidate,
    title: normalizeSessionTitle(indexedEntry.title) ?? candidate.title,
    mtime: indexedEntry.lastMessageDate ?? candidate.mtime
  };
}

function normalizeSessionTitle(value: string | undefined, maxLen = 90): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized === "<no text preview>" || GENERIC_PREVIEWS.has(normalized)) {
    return undefined;
  }
  return normalized.slice(0, maxLen);
}

async function inferSessionTitle(jsonlPath: string): Promise<string | undefined> {
  let fallback: string | undefined;
  let scannedRows = 0;

  for await (const { row } of iterJsonlRows(jsonlPath)) {
    scannedRows += 1;
    if (!row || typeof row !== "object") {
      if (scannedRows >= 24) {
        break;
      }
      continue;
    }

    const record = row as Record<string, unknown>;
    if (record._parseError === true) {
      if (scannedRows >= 24) {
        break;
      }
      continue;
    }

    const keyPath = stringifyKeyPath(record);
    if (keyPath === "requests") {
      const requestTitle = normalizeSessionTitle(requestBatchPreview(record));
      if (requestTitle) {
        return requestTitle;
      }
    }

    if (keyPath === "inputState/inputText" && typeof record.v === "string") {
      const inputTitle = normalizeSessionTitle(record.v);
      if (inputTitle) {
        return inputTitle;
      }
    }

    fallback ??= normalizeSessionTitle(bestPreview(record, 120));
    if (scannedRows >= 24) {
      break;
    }
  }

  return fallback;
}

function buildTranscriptArtifactMissingError(sessionId: string, attemptedPaths: string[]): TranscriptArtifactMissingError {
  const error = new Error(
    `No evidence transcript artifact was found for session ${sessionId}. Checked: ${attemptedPaths.join(", ")}`
  ) as TranscriptArtifactMissingError;
  error.code = TRANSCRIPT_ARTIFACT_MISSING_CODE;
  error.sessionId = sessionId;
  error.attemptedPaths = attemptedPaths;
  return error;
}

function shiftMarkdownHeadings(markdown: string, levels: number): string {
  return markdown.replace(/^(#{1,6})\s/gm, (_match, hashes: string) => `${"#".repeat(Math.min(6, hashes.length + levels))} `);
}

function summarizePendingRequestIds(ids: string[], limit = 3, previewLength = 24): string {
  if (ids.length === 0) {
    return "-";
  }
  const summarized = ids.slice(0, limit).map((id) => id.length > previewLength ? `${id.slice(0, previewLength)}...` : id);
  if (ids.length > limit) {
    summarized.push(`+${ids.length - limit} more`);
  }
  return summarized.join(", ");
}

async function resolveTranscriptPath(candidate: SessionCandidate): Promise<string> {
  const attemptedPaths = [
    path.join(candidate.workspaceStorageDir, "transcripts", `${candidate.sessionId}.jsonl`),
    path.join(candidate.workspaceStorageDir, "GitHub.copilot-chat", "transcripts", `${candidate.sessionId}.jsonl`)
  ].map((candidatePath) => validateSessionFilePath(candidatePath));

  for (const transcriptPath of attemptedPaths) {
    try {
      const stat = await fs.stat(transcriptPath);
      if (stat.isFile()) {
        return transcriptPath;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw buildTranscriptArtifactMissingError(candidate.sessionId, attemptedPaths);
}

async function resolveChatSessionResourcesPath(candidate: SessionCandidate): Promise<string | undefined> {
  const resourcePath = path.join(
    candidate.workspaceStorageDir,
    "GitHub.copilot-chat",
    "chat-session-resources",
    candidate.sessionId
  );
  try {
    const stat = await fs.stat(resourcePath);
    return stat.isDirectory() ? resourcePath : undefined;
  } catch {
    return undefined;
  }
}

export async function discoverSessions(extraRoots: string[] = []): Promise<SessionCandidate[]> {
  const found = new Map<string, SessionCandidate>();
  for (const root of candidateStorageRoots(extraRoots)) {
    try {
      const rootStat = await fs.stat(root);
      if (!rootStat.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    const directCandidates = await discoverSessionsInStorageDir(root);
    if (directCandidates.length > 0) {
      for (const candidate of directCandidates) {
        found.set(candidate.jsonlPath, candidate);
      }
      continue;
    }

    const storageDirs = await fs.readdir(root, { withFileTypes: true });
    for (const entry of storageDirs) {
      if (!entry.isDirectory()) {
        continue;
      }
      const storageDir = path.join(root, entry.name);
      const candidates = await discoverSessionsInStorageDir(storageDir);
      for (const candidate of candidates) {
        found.set(candidate.jsonlPath, candidate);
      }
    }
  }

  const ordered = [...found.values()];
  ordered.sort((a, b) => b.mtime - a.mtime || b.size - a.size || a.sessionId.localeCompare(b.sessionId));
  return ordered;
}

function renderToolRequestCount(count: number): string {
  return count === 1 ? "a tool" : `${count} tools`;
}

function describeTranscriptTailGap(entries: ParsedTranscriptEntry[]): string | undefined {
  let lastUserIndex = -1;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.type === "user.message") {
      lastUserIndex = index;
      break;
    }
  }

  const relevantEntries = lastUserIndex >= 0 ? entries.slice(lastUserIndex + 1) : entries;
  const lastRelevantType = relevantEntries.at(-1)?.type;
  const lastAssistantMessage = [...relevantEntries].reverse().find((entry) => entry.type === "assistant.message");
  const lastAssistantData = lastAssistantMessage ? asRecord(lastAssistantMessage.data) : undefined;
  const toolRequestCount = Array.isArray(lastAssistantData?.toolRequests)
    ? lastAssistantData.toolRequests.length
    : 0;

  if (toolRequestCount > 0 && lastRelevantType === "assistant.turn_start") {
    return `Transcript persisted a new assistant turn after an earlier assistant message requested ${renderToolRequestCount(toolRequestCount)}, but no tool result or final answer was ever written.`;
  }

  if (toolRequestCount > 0) {
    return `Transcript persisted an unfinished assistant step after requesting ${renderToolRequestCount(toolRequestCount)}.`;
  }

  if (lastRelevantType === "assistant.turn_start") {
    return "Transcript persisted an assistant turn start for the latest request, but no matching assistant message or turn end was written.";
  }

  return undefined;
}

function snapshotLooksMoreSettledThanTranscript(snapshot: SnapshotResult): boolean {
  if (snapshot.pendingRequestCount > 0) {
    return false;
  }

  if (snapshot.requestCount === 0) {
    return false;
  }

  if (snapshot.responseCount < snapshot.requestCount || snapshot.resultCount < snapshot.requestCount) {
    return false;
  }

  if (!snapshot.latestAssistantMessage) {
    return false;
  }

  if (snapshot.latestUserMessage && snapshot.latestAssistantMessage.lineNo < snapshot.latestUserMessage.lineNo) {
    return false;
  }

  return true;
}

async function buildSessionDerivedTranscriptEvidenceResult(
  candidate: SessionCandidate,
  options: {
    afterLatestCompact: boolean;
    anchorText?: string;
    anchorOccurrence?: AnchorOccurrence;
    maxBlocks?: number;
    unavailableReason: string;
    omissions: string[];
    attemptedPaths?: string[];
    totalRows?: number;
    transcriptPath?: string;
    fallbackSnapshot?: SnapshotResult;
  }
): Promise<TranscriptEvidenceResult> {
  const supplementaryResourcePath = await resolveChatSessionResourcesPath(candidate);
  const fallbackSnapshot = options.fallbackSnapshot ?? await buildSnapshot({ sessionFile: candidate.jsonlPath });
  return {
    candidate,
    transcriptPath: options.transcriptPath,
    transcriptAvailable: false,
    selectorPath: candidate.jsonlPath,
    totalRows: options.totalRows ?? 0,
    blocks: [],
    omissions: options.omissions,
    unavailableReason: options.unavailableReason,
    attemptedPaths: options.attemptedPaths,
    supplementaryResourcePath,
    fallbackSnapshot,
    fallbackIndex: !options.afterLatestCompact && !options.anchorText
      ? await buildIndex({ sessionFile: candidate.jsonlPath, tail: 20 })
      : undefined,
    fallbackWindow: options.afterLatestCompact || options.anchorText
      ? await buildWindow({
        sessionFile: candidate.jsonlPath,
        anchorText: options.anchorText,
        anchorOccurrence: options.anchorOccurrence,
        afterLatestCompact: options.afterLatestCompact,
        before: 0,
        after: options.maxBlocks ? Math.max(0, options.maxBlocks - 1) : 12,
        maxMatches: 1
      })
      : undefined,
    anchorText: options.anchorText,
    anchorOccurrence: options.anchorOccurrence,
    afterLatestCompact: options.afterLatestCompact,
    maxBlocks: options.maxBlocks,
    compactionBoundaryApplied: options.afterLatestCompact
  };
}

async function discoverSessionsInStorageDir(storageDir: string): Promise<SessionCandidate[]> {
  const chatDir = path.join(storageDir, "chatSessions");
  try {
    const chatStat = await fs.stat(chatDir);
    if (!chatStat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const indexedEntries = await loadWorkspaceSessionIndex(storageDir);
  if (indexedEntries) {
    const indexedCandidates: SessionCandidate[] = [];
    for (const entry of indexedEntries.values()) {
      const jsonlPath = path.join(chatDir, `${entry.sessionId}.jsonl`);
      try {
        const stat = await fs.stat(jsonlPath);
        if (!stat.isFile()) {
          continue;
        }
        indexedCandidates.push({
          sessionId: entry.sessionId,
          title: normalizeSessionTitle(entry.title) ?? await inferSessionTitle(jsonlPath),
          jsonlPath,
          workspaceStorageDir: storageDir,
          mtime: entry.lastMessageDate ?? stat.mtimeMs,
          size: stat.size
        });
      } catch {
        continue;
      }
    }
    return indexedCandidates;
  }

  const files = await fs.readdir(chatDir, { withFileTypes: true });
  const candidates: SessionCandidate[] = [];
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".jsonl")) {
      continue;
    }
    candidates.push(await buildSessionCandidateFromJsonlPath(path.join(chatDir, file.name)));
  }
  return candidates;
}

function clampPositive(value: number, fallback: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(value), max);
}

function clampNonNegative(value: number, fallback: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.min(Math.floor(value), max);
}

function effectiveOutputBudget(maxChars?: number): number {
  if (maxChars === undefined) {
    return DEFAULT_MAX_OUTPUT_CHARS;
  }
  return clampPositive(maxChars, DEFAULT_MAX_OUTPUT_CHARS, HARD_MAX_OUTPUT_CHARS);
}

function usesFileDelivery(mode: DeliveryMode): boolean {
  return mode === "file-only" || mode === "file-and-inline-if-safe";
}

function renderWithinBudget(lines: string[], maxChars?: number, truncatedLines?: string[]): string {
  const budget = effectiveOutputBudget(maxChars);
  const footer = truncatedLines ?? ["", "## Safety Limit", `- Output truncated to stay within the ${budget}-character safety budget.`];
  let text = "";
  for (let index = 0; index < lines.length; index += 1) {
    const next = index === 0 ? lines[index] : `${text}\n${lines[index]}`;
    const candidate = `${next}\n`;
    const footerText = `${footer.join("\n")}\n`;
    if (candidate.length + footerText.length > budget) {
      return `${text}${text ? "\n" : ""}${footerText}`;
    }
    text = candidate.trimEnd();
  }
  return `${text}\n`;
}

function normalizeInlinePreview(value: string | undefined, maxChars = 140): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars - 3)}...` : normalized;
}

function summarizeEvidencePayloads(payloads: EvidencePayload[]): string {
  const preview = normalizeInlinePreview(payloads[0]?.content, 120);
  return preview ? `payloads=${payloads.length} | preview=${preview}` : `payloads=${payloads.length}`;
}

function compactSnapshotLines(result: SnapshotResult): string[] {
  const lines = [
    `- Pending requests: ${result.pendingRequestCount}`,
    `- Latest user message: ${result.latestUserMessage?.preview ?? "-"}`,
    `- Latest request preview: ${result.latestRequest?.preview ?? "-"}`,
    `- Latest assistant result: ${result.latestAssistantMessage?.preview ?? "-"}`,
    `- Latest tool activity: ${result.latestToolActivity?.preview ?? "-"}`
  ];

  if (result.pendingRequestIds.length > 0) {
    lines.push(`- Pending request IDs: ${summarizePendingRequestIds(result.pendingRequestIds)}`);
  }

  return lines;
}

export async function selectSession(selector: SessionSelector): Promise<SessionCandidate> {
  if (selector.sessionFile) {
    const jsonlPath = validateSessionFilePath(selector.sessionFile);
    return hydrateCandidateFromWorkspaceIndex(await buildSessionCandidateFromJsonlPath(jsonlPath));
  }

  const candidates = await discoverSessions(selector.storageRoots ?? []);
  if (selector.latest) {
    if (candidates.length === 0) {
      throw new Error("No chatSessions/*.jsonl files were found under the searched workspaceStorage roots.");
    }
    return candidates[0];
  }
  if (!selector.sessionId) {
    throw new Error("Provide sessionId, sessionFile, or latest.");
  }
  const ident = selector.sessionId.trim();
  const matches = candidates.filter((candidate) =>
    candidate.sessionId === ident || candidate.sessionId.startsWith(ident) || candidate.jsonlPath.includes(ident)
  );
  if (matches.length === 0) {
    throw new Error(`No session matched identifier: ${ident}`);
  }
  if (matches.length > 1) {
    const rendered = matches.slice(0, 20).map((m) => `- ${m.sessionId} :: ${m.jsonlPath}`).join("\n");
    throw new Error(`Identifier was ambiguous; matched ${matches.length} sessions:\n${rendered}`);
  }
  return matches[0];
}

async function resolveTranscriptArtifact(selector: SessionSelector): Promise<{
  candidate: SessionCandidate;
  transcriptPath: string;
  selectorPath?: string;
}> {
  if (selector.sessionFile) {
    const selectedPath = validateSessionFilePath(selector.sessionFile);
    const normalized = selectedPath.replace(/\\/g, "/");
    if (normalized.includes("/chatSessions/")) {
      const candidate = await buildSessionCandidateFromJsonlPath(selectedPath);
      const validatedTranscriptPath = await resolveTranscriptPath(candidate);
      return {
        candidate,
        transcriptPath: validatedTranscriptPath,
        selectorPath: candidate.jsonlPath
      };
    }
    const candidate = await buildSessionCandidateFromJsonlPath(selectedPath);
    return {
      candidate,
      transcriptPath: selectedPath
    };
  }

  const candidate = await selectSession(selector);
  const transcriptPath = await resolveTranscriptPath(candidate);
  return {
    candidate,
    transcriptPath,
    selectorPath: candidate.jsonlPath
  };
}

export async function* iterJsonlRows(jsonlPath: string): AsyncGenerator<{ lineNo: number; row: unknown }> {
  const stream = createReadStream(jsonlPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNo = 0;
  try {
    for await (const line of rl) {
      lineNo += 1;
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        yield { lineNo, row: JSON.parse(trimmed) };
      } catch {
        yield { lineNo, row: { _parseError: true, raw: trimmed.slice(0, 500) } };
      }
    }
  } finally {
    rl.close();
    stream.close();
  }
}

function safeIso(ts: unknown): string | undefined {
  if (ts === null || ts === undefined) {
    return undefined;
  }
  if (typeof ts === "string") {
    return ts;
  }
  if (typeof ts === "number") {
    const epoch = ts > 10_000_000_000 ? ts / 1000 : ts;
    return new Date(epoch * 1000).toISOString();
  }
  return String(ts);
}

function exactStoredValue(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return typeof value === "string" ? value : String(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function safeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function safeJsonStringify(value: unknown): string | undefined {
  try {
    const serialized = JSON.stringify(value, null, 2);
    return typeof serialized === "string" ? serialized : undefined;
  } catch {
    return undefined;
  }
}

function buildMessagePayload(value: unknown, label?: string): EvidencePayload | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return { label, language: "text", content: value };
  }
  const serialized = safeJsonStringify(value);
  if (serialized !== undefined) {
    return { label, language: "text", content: serialized };
  }
  return { label, language: "text", content: String(value) };
}

function buildStructuredPayload(value: unknown, label?: string): EvidencePayload | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return { label, language: "text", content: value };
  }
  const serialized = safeJsonStringify(value);
  if (serialized !== undefined) {
    return { label, language: "json", content: serialized };
  }
  return { label, language: "text", content: String(value) };
}

function formatEvidenceBlockId(index: number): string {
  return `M${String(index).padStart(3, "0")}`;
}

function codeFenceTicks(content: string): string {
  let ticks = "```";
  while (content.includes(ticks)) {
    ticks += "`";
  }
  return ticks;
}

interface ParsedTranscriptEntry {
  lineNo: number;
  type: string;
  id?: string;
  parentId?: string;
  timestamp?: string;
  data: unknown;
  raw: unknown;
}

function parseTranscriptEntry(lineNo: number, row: unknown): ParsedTranscriptEntry {
  const record = asRecord(row);
  if (!record) {
    return {
      lineNo,
      type: "unknown",
      data: undefined,
      raw: row
    };
  }
  if (record._parseError) {
    return {
      lineNo,
      type: "parse.error",
      data: undefined,
      raw: row
    };
  }
  return {
    lineNo,
    type: typeof record.type === "string" ? record.type : "unknown",
    id: exactStoredValue(record.id),
    parentId: exactStoredValue(record.parentId),
    timestamp: exactStoredValue(record.timestamp),
    data: record.data,
    raw: row
  };
}

function transcriptSourceLabel(transcriptPath: string, entry: ParsedTranscriptEntry, detail?: string): string {
  const parts = [normalizeSource(transcriptPath), `L${entry.lineNo}`, entry.type];
  if (entry.id) {
    parts.push(entry.id);
  }
  if (detail) {
    parts.push(detail);
  }
  return parts.join(" :: ");
}

function inferAccessLimitFlow(hasMainThread: boolean, parent: string): EvidenceFlow {
  if (parent !== "none") {
    return "Descendant";
  }
  return hasMainThread ? "Main thread" : "Artifact anchor";
}

function stringifyKeyPath(row: unknown): string {
  if (!row || typeof row !== "object") {
    return "-";
  }
  const keyPath = (row as Record<string, unknown>).k;
  if (Array.isArray(keyPath)) {
    return keyPath.map((part) => String(part)).join("/");
  }
  return typeof keyPath === "string" ? keyPath : "-";
}

function isNoiseString(value: string): boolean {
  const stripped = value.trim();
  if (!stripped) {
    return true;
  }
  if (stripped.length > 4000 && /^[A-Za-z0-9+/=_-]+$/.test(stripped)) {
    return true;
  }
  return stripped.startsWith("file://");
}

function* iterStrings(obj: unknown, parentKey?: string): Iterable<string> {
  if (typeof obj === "string") {
    if (!ROLE_NOISE_KEYS.has(parentKey ?? "") && !isNoiseString(obj)) {
      yield obj;
    }
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      yield* iterStrings(item, parentKey);
    }
    return;
  }
  if (obj && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      yield* iterStrings(value, key);
    }
  }
}

function messageTextFromRequestObj(request: unknown): string | undefined {
  if (!request || typeof request !== "object") {
    return undefined;
  }
  const requestRecord = request as Record<string, unknown>;
  const message = requestRecord.message;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }
  if (message && typeof message === "object") {
    const msg = message as Record<string, unknown>;
    if (typeof msg.text === "string" && msg.text.trim()) {
      return msg.text.trim();
    }
    if (Array.isArray(msg.parts)) {
      for (const part of msg.parts) {
        if (part && typeof part === "object") {
          const text = (part as Record<string, unknown>).text;
          if (typeof text === "string" && text.trim()) {
            return text.trim();
          }
        }
      }
    }
  }
  return undefined;
}

function requestBatchItemsFromRow(row: unknown): unknown[] {
  if (!row || typeof row !== "object") {
    return [];
  }
  const record = row as Record<string, unknown>;
  if (stringifyKeyPath(record) === "requests" && Array.isArray(record.v)) {
    return record.v;
  }
  const sessionState = record.kind === 0 && record.v && typeof record.v === "object"
    ? (record.v as Record<string, unknown>)
    : undefined;
  return Array.isArray(sessionState?.requests) ? sessionState.requests : [];
}

function responsePayloadItemsFromRow(row: unknown): unknown[] {
  if (!row || typeof row !== "object") {
    return [];
  }
  const record = row as Record<string, unknown>;
  if (REQUEST_RESPONSE_PATH.test(stringifyKeyPath(record)) && Array.isArray(record.v)) {
    return record.v;
  }
  const items: unknown[] = [];
  for (const request of requestBatchItemsFromRow(row)) {
    if (!request || typeof request !== "object") {
      continue;
    }
    const response = (request as Record<string, unknown>).response;
    if (Array.isArray(response)) {
      items.push(...response);
    }
  }
  return items;
}

function resultPayloadsFromRow(row: unknown): Record<string, unknown>[] {
  if (!row || typeof row !== "object") {
    return [];
  }
  const record = row as Record<string, unknown>;
  if (REQUEST_RESULT_PATH.test(stringifyKeyPath(record)) && record.v && typeof record.v === "object") {
    return [record.v as Record<string, unknown>];
  }
  const payloads: Record<string, unknown>[] = [];
  for (const request of requestBatchItemsFromRow(row)) {
    if (!request || typeof request !== "object") {
      continue;
    }
    const result = (request as Record<string, unknown>).result;
    if (result && typeof result === "object") {
      payloads.push(result as Record<string, unknown>);
    }
  }
  return payloads;
}

function rowContainsRequestBatch(row: unknown): boolean {
  return requestBatchItemsFromRow(row).length > 0;
}

function rowContainsResponsePayload(row: unknown): boolean {
  return responsePayloadItemsFromRow(row).length > 0;
}

function rowContainsResultPayload(row: unknown): boolean {
  return resultPayloadsFromRow(row).length > 0;
}

interface PersistedSelectionAccumulator {
  state: PersistedSelectionState;
  latestRequestIndex: number;
}

function createPersistedSelectionAccumulator(): PersistedSelectionAccumulator {
  return {
    state: {},
    latestRequestIndex: -1
  };
}

function mergePersistedSelectionState(target: PersistedSelectionState, patch: PersistedSelectionState): void {
  for (const [key, value] of Object.entries(patch) as Array<[keyof PersistedSelectionState, string | undefined]>) {
    if (value !== undefined) {
      target[key] = value;
    }
  }
}

function extractPersistedInputSelection(value: unknown): PersistedSelectionState {
  const container = asRecord(value);
  const inputState = asRecord(container?.inputState) ?? container;
  const directRecord = asRecord(value);
  const mode = asRecord(inputState?.mode)
    ?? ((safeString(directRecord?.id) || safeString(directRecord?.kind)) ? directRecord : undefined);
  const selectedModel = asRecord(inputState?.selectedModel)
    ?? (safeString(directRecord?.identifier) ? directRecord : undefined);
  const selectedModelMetadata = asRecord(selectedModel?.metadata);
  return {
    inputModeId: safeString(mode?.id),
    inputModeKind: safeString(mode?.kind),
    selectedModelId: safeString(selectedModel?.identifier),
    selectedModelName: safeString(selectedModelMetadata?.name) ?? safeString(selectedModel?.name)
  };
}

function extractPersistedRequestSelection(request: unknown): PersistedSelectionState {
  const requestRecord = asRecord(request);
  const agent = asRecord(requestRecord?.agent);
  const modeInfo = asRecord(requestRecord?.modeInfo);
  return {
    latestRequestId: safeString(requestRecord?.requestId),
    latestRequestAgentId: safeString(agent?.id),
    latestRequestAgentName: safeString(agent?.fullName) ?? safeString(agent?.name),
    latestRequestModelId: safeString(requestRecord?.modelId),
    latestRequestModeId: safeString(modeInfo?.modeId),
    latestRequestModeName: safeString(modeInfo?.modeName)
  };
}

function applyPersistedSelectionRow(accumulator: PersistedSelectionAccumulator, row: unknown): void {
  const record = asRecord(row);
  if (!record) {
    return;
  }

  const keyPath = stringifyKeyPath(record);

  if (record.kind === 0 && record.v && typeof record.v === "object") {
    mergePersistedSelectionState(accumulator.state, extractPersistedInputSelection(record.v));
  }

  if (keyPath === "inputState/mode") {
    mergePersistedSelectionState(accumulator.state, extractPersistedInputSelection({ mode: record.v }));
  }

  if (keyPath === "inputState/selectedModel") {
    mergePersistedSelectionState(accumulator.state, extractPersistedInputSelection({ selectedModel: record.v }));
  }

  const requests = requestBatchItemsFromRow(row);
  if (requests.length > 0) {
    const latestRequestIndex = requests.length - 1;
    if (latestRequestIndex >= accumulator.latestRequestIndex) {
      accumulator.latestRequestIndex = latestRequestIndex;
      mergePersistedSelectionState(accumulator.state, extractPersistedRequestSelection(requests[latestRequestIndex]));
    }
  }

  if (!Array.isArray(record.k) || record.k.length !== 3) {
    return;
  }

  const [scope, requestIndex, leaf] = record.k;
  if (scope !== "requests" || typeof requestIndex !== "number") {
    return;
  }
  if (requestIndex < accumulator.latestRequestIndex) {
    return;
  }
  accumulator.latestRequestIndex = Math.max(accumulator.latestRequestIndex, requestIndex);

  if (leaf === "agent") {
    mergePersistedSelectionState(accumulator.state, extractPersistedRequestSelection({ agent: record.v }));
  } else if (leaf === "modelId") {
    mergePersistedSelectionState(accumulator.state, { latestRequestModelId: safeString(record.v) });
  } else if (leaf === "modeInfo") {
    mergePersistedSelectionState(accumulator.state, extractPersistedRequestSelection({ modeInfo: record.v }));
  }
}

function scorePreviewCandidate(value: string): [number, number] {
  const stripped = value.trim().replace(/\n/g, " ");
  let score = 0;
  if (stripped.length >= 12 && stripped.length <= 260) {
    score += 3;
  }
  if (stripped.includes(" ")) {
    score += 3;
  }
  if (/[.!?]/.test(stripped)) {
    score += 1;
  }
  if (GENERIC_PREVIEWS.has(stripped)) {
    score -= 5;
  }
  if (/^[A-Za-z0-9_.:/-]+$/.test(stripped) && !stripped.includes(" ")) {
    score -= 3;
  }
  return [score, -stripped.length];
}

function requestBatchPreview(row: Record<string, unknown>): string | undefined {
  const payload = row.v;
  if (!Array.isArray(payload)) {
    return undefined;
  }
  const requestCandidates: string[] = [];
  const responseCandidates: string[] = [];
  for (const request of payload) {
    const requestText = messageTextFromRequestObj(request);
    if (requestText) {
      requestCandidates.push(requestText);
    }
    if (request && typeof request === "object") {
      const response = (request as Record<string, unknown>).response;
      if (Array.isArray(response)) {
        for (const item of response) {
          if (item && typeof item === "object") {
            const value = (item as Record<string, unknown>).value;
            if (typeof value === "string" && value.trim()) {
              responseCandidates.push(value.trim());
            }
          }
        }
      }
    }
  }
  const candidates = requestCandidates.length > 0 ? requestCandidates : responseCandidates;
  if (candidates.length === 0) {
    return undefined;
  }
  candidates.sort((a, b) => {
    const [scoreA, lenA] = scorePreviewCandidate(a);
    const [scoreB, lenB] = scorePreviewCandidate(b);
    return scoreB - scoreA || lenB - lenA;
  });
  return candidates[0];
}

function trimPreview(value: string | undefined, maxLen = 180): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().replace(/\n/g, " ");
  return normalized ? normalized.slice(0, maxLen) : undefined;
}

function withPreview(summary: RecordSummary, preview: string | undefined): RecordSummary | undefined {
  const normalized = trimPreview(preview);
  return normalized ? { ...summary, preview: normalized } : undefined;
}

function latestRequestPreviewFromRow(row: unknown): string | undefined {
  const requests = requestBatchItemsFromRow(row);
  for (let index = requests.length - 1; index >= 0; index -= 1) {
    const preview = messageTextFromRequestObj(requests[index]);
    if (preview) {
      return preview;
    }
  }
  return undefined;
}

function latestAssistantPreviewFromRow(row: unknown): string | undefined {
  const responseItems = responsePayloadItemsFromRow(row);
  for (let index = responseItems.length - 1; index >= 0; index -= 1) {
    const item = responseItems[index];
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const kind = record.kind;
    const value = record.value;
    if ((kind === undefined || kind === null) && typeof value === "string" && value.trim()) {
      return value;
    }
  }

  const results = resultPayloadsFromRow(row);
  for (let resultIndex = results.length - 1; resultIndex >= 0; resultIndex -= 1) {
    const metadata = results[resultIndex].metadata as Record<string, unknown> | undefined;
    const rounds = Array.isArray(metadata?.toolCallRounds) ? metadata.toolCallRounds : [];
    for (let roundIndex = rounds.length - 1; roundIndex >= 0; roundIndex -= 1) {
      const round = rounds[roundIndex];
      if (!round || typeof round !== "object") {
        continue;
      }
      const response = (round as Record<string, unknown>).response;
      if (typeof response === "string" && response.trim()) {
        return response;
      }
    }
  }

  return undefined;
}

function latestToolActivityPreviewFromRow(row: unknown): string | undefined {
  const responseItems = responsePayloadItemsFromRow(row);
  for (let index = responseItems.length - 1; index >= 0; index -= 1) {
    const item = responseItems[index];
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const kind = record.kind;
    if (!isRuntimeResponseKind(kind)) {
      continue;
    }
    const contentValue = record.content && typeof record.content === "object"
      ? (record.content as Record<string, unknown>).value
      : undefined;
    const invocationValue = record.invocationMessage && typeof record.invocationMessage === "object"
      ? (record.invocationMessage as Record<string, unknown>).value
      : undefined;
    const pastTenseValue = record.pastTenseMessage && typeof record.pastTenseMessage === "object"
      ? (record.pastTenseMessage as Record<string, unknown>).value
      : undefined;
    for (const candidate of [contentValue, pastTenseValue, invocationValue, record.value]) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }
  }
  return undefined;
}

function extractRequestId(row: unknown): string | undefined {
  if (!row || typeof row !== "object") {
    return undefined;
  }
  const record = row as Record<string, unknown>;
  if (typeof record.requestId === "string") {
    return record.requestId;
  }
  if (Array.isArray(record.v)) {
    for (const item of record.v) {
      if (item && typeof item === "object" && typeof (item as Record<string, unknown>).requestId === "string") {
        return (item as Record<string, string>).requestId;
      }
    }
  }
  for (const item of requestBatchItemsFromRow(row)) {
    if (item && typeof item === "object" && typeof (item as Record<string, unknown>).requestId === "string") {
      return (item as Record<string, string>).requestId;
    }
  }
  return undefined;
}

function extractTimestamp(row: unknown): string | undefined {
  if (!row || typeof row !== "object") {
    return undefined;
  }
  const record = row as Record<string, unknown>;
  if ("timestamp" in record) {
    return safeIso(record.timestamp);
  }
  if (Array.isArray(record.v)) {
    for (const item of record.v) {
      if (item && typeof item === "object" && "timestamp" in (item as Record<string, unknown>)) {
        return safeIso((item as Record<string, unknown>).timestamp);
      }
    }
  }
  for (const item of requestBatchItemsFromRow(row)) {
    if (item && typeof item === "object" && "timestamp" in (item as Record<string, unknown>)) {
      return safeIso((item as Record<string, unknown>).timestamp);
    }
  }
  if (record.kind === 0 && record.v && typeof record.v === "object") {
    const sessionState = record.v as Record<string, unknown>;
    return safeIso(sessionState.creationDate) ?? safeIso(sessionState.updatedAt) ?? safeIso(sessionState.lastUpdated);
  }
  return undefined;
}

function bestPreview(row: unknown, maxLen = 180): string {
  if (!row || typeof row !== "object") {
    return String(row).slice(0, maxLen);
  }
  const record = row as Record<string, unknown>;
  const keyPath = stringifyKeyPath(record);
  if (record.kind === 1 && typeof record.v === "string" && record.v.trim()) {
    return record.v.trim().replace(/\n/g, " ").slice(0, maxLen);
  }
  if (keyPath === "requests") {
    const preview = requestBatchPreview(record);
    if (preview) {
      return preview.replace(/\n/g, " ").slice(0, maxLen);
    }
  }
  const embeddedRequests = requestBatchItemsFromRow(row);
  if (embeddedRequests.length > 0) {
    const preview = requestBatchPreview({ v: embeddedRequests });
    if (preview) {
      return preview.replace(/\n/g, " ").slice(0, maxLen);
    }
  }
  const candidates: string[] = [];
  for (const value of iterStrings(row)) {
    const stripped = value.trim().replace(/\n/g, " ");
    if (!stripped) {
      continue;
    }
    candidates.push(stripped);
    if (candidates.length >= 40) {
      break;
    }
  }
  if (candidates.length === 0) {
    return "<no text preview>";
  }
  candidates.sort((a, b) => {
    const [scoreA, lenA] = scorePreviewCandidate(a);
    const [scoreB, lenB] = scorePreviewCandidate(b);
    return scoreB - scoreA || lenB - lenA;
  });
  return candidates[0].slice(0, maxLen);
}

function rowSearchText(row: unknown): string {
  if (!row || typeof row !== "object") {
    return String(row);
  }
  const record = row as Record<string, unknown>;
  const keyPath = stringifyKeyPath(record);
  const values: string[] = [];
  if (keyPath === "requests") {
    const preview = requestBatchPreview(record);
    if (preview) {
      values.push(preview);
    }
  }
  const embeddedRequests = requestBatchItemsFromRow(row);
  if (embeddedRequests.length > 0) {
    const preview = requestBatchPreview({ v: embeddedRequests });
    if (preview) {
      values.push(preview);
    }
  }
  for (const value of iterStrings(record)) {
    const stripped = value.trim();
    if (!stripped) {
      continue;
    }
    values.push(stripped);
    if (values.length >= 60) {
      break;
    }
  }
  return values.join("\n");
}

function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

function textCharsFromRow(row: unknown): number {
  let total = 0;
  let seen = 0;
  for (const value of iterStrings(row)) {
    const stripped = value.trim();
    if (!stripped) {
      continue;
    }
    total += stripped.length;
    seen += 1;
    if (seen >= 200) {
      break;
    }
  }
  return total;
}

function collectLeafStrings(obj: unknown, prefix = "", out: Array<{ path: string; value: string }> = []): Array<{ path: string; value: string }> {
  if (typeof obj === "string") {
    out.push({ path: prefix, value: obj });
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => collectLeafStrings(item, `${prefix}[${index}]`, out));
    return out;
  }
  if (obj && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      collectLeafStrings(value, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

function sumRequestMessageChars(row: unknown): number {
  const requests = requestBatchItemsFromRow(row);
  if (requests.length === 0) {
    return 0;
  }
  let total = 0;
  for (const request of requests) {
    const text = messageTextFromRequestObj(request);
    if (text) {
      total += text.length;
    }
  }
  return total;
}

function sanitizeFileLikeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeFileLikeValue(entry));
  }
  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === "$base64") {
        continue;
      }
      sanitized[key] = sanitizeFileLikeValue(entry);
    }
    return sanitized;
  }
  return value;
}

function sumSanitizedFileLikeChars(value: unknown): number {
  let total = 0;
  for (const leaf of collectLeafStrings(sanitizeFileLikeValue(value), "v")) {
    if (leaf.value.trim()) {
      total += leaf.value.length;
    }
  }
  return total;
}

function sumInputStateInputTextChars(row: unknown): number {
  if (!row || typeof row !== "object") {
    return 0;
  }
  const record = row as Record<string, unknown>;
  if (stringifyKeyPath(record) === "inputState/inputText" && typeof record.v === "string") {
    return record.v.length;
  }
  if (record.kind === 0 && record.v && typeof record.v === "object") {
    const inputText = ((record.v as Record<string, unknown>).inputState as Record<string, unknown> | undefined)?.inputText;
    return typeof inputText === "string" ? inputText.length : 0;
  }
  return 0;
}

function sumInputStateFileContextChars(row: unknown): number {
  if (!row || typeof row !== "object") {
    return 0;
  }
  const record = row as Record<string, unknown>;
  const keyPath = stringifyKeyPath(record);
  if (keyPath !== "inputState/attachments" && keyPath !== "inputState/contrib") {
    return 0;
  }
  return sumSanitizedFileLikeChars(record.v);
}

function sumRequestFileContextChars(row: unknown): number {
  const requests = requestBatchItemsFromRow(row);
  if (requests.length === 0) {
    return 0;
  }
  let total = 0;
  for (const request of requests) {
    if (!request || typeof request !== "object") {
      continue;
    }
    const requestRecord = request as Record<string, unknown>;
    const variables = requestRecord.variableData && typeof requestRecord.variableData === "object" && Array.isArray((requestRecord.variableData as Record<string, unknown>).variables)
      ? ((requestRecord.variableData as Record<string, unknown>).variables as unknown[])
      : [];
    for (const variable of variables) {
      if (!variable || typeof variable !== "object") {
        continue;
      }
      const variableRecord = variable as Record<string, unknown>;
      const kind = String(variableRecord.kind ?? "");
      if (kind === "file" || kind === "directory" || kind === "image") {
        total += sumSanitizedFileLikeChars(variableRecord.value);
      }
    }
    const contentReferences = Array.isArray(requestRecord.contentReferences) ? requestRecord.contentReferences : [];
    for (const reference of contentReferences) {
      if (!reference || typeof reference !== "object") {
        continue;
      }
      const referenceValue = ((reference as Record<string, unknown>).reference as Record<string, unknown> | undefined)?.value;
      total += sumSanitizedFileLikeChars(referenceValue);
    }
  }
  return total;
}

function sumResultRoundResponseChars(row: unknown): number {
  let total = 0;
  for (const result of resultPayloadsFromRow(row)) {
    const metadata = result.metadata as Record<string, unknown> | undefined;
    const rounds = Array.isArray(metadata?.toolCallRounds) ? metadata.toolCallRounds : [];
    for (const round of rounds) {
      if (!round || typeof round !== "object") {
        continue;
      }
      const response = (round as Record<string, unknown>).response;
      if (typeof response === "string" && response.trim()) {
        total += response.length;
      }
    }
  }
  return total;
}

function sumResultRoundThinkingChars(row: unknown): number {
  let total = 0;
  for (const result of resultPayloadsFromRow(row)) {
    const metadata = result.metadata as Record<string, unknown> | undefined;
    const rounds = Array.isArray(metadata?.toolCallRounds) ? metadata.toolCallRounds : [];
    for (const round of rounds) {
      if (!round || typeof round !== "object") {
        continue;
      }
      const thinking = (round as Record<string, unknown>).thinking;
      const tokens = thinking && typeof thinking === "object" ? (thinking as Record<string, unknown>).tokens : undefined;
      if (typeof tokens === "number" && Number.isFinite(tokens) && tokens > 0) {
        total += Math.ceil(tokens) * 4;
      }
    }
  }
  return total;
}

function sumRenderedUserContextChars(row: unknown): number {
  let total = 0;
  for (const result of resultPayloadsFromRow(row)) {
    const metadata = result.metadata as Record<string, unknown> | undefined;
    const rendered = Array.isArray(metadata?.renderedUserMessage) ? metadata.renderedUserMessage : [];
    for (const item of rendered) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const text = (item as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) {
        total += text.length;
      }
    }
  }
  return total;
}

function sumUniqueSummaryChars(row: unknown): number {
  if (!row || typeof row !== "object") {
    return 0;
  }
  const record = row as Record<string, unknown>;
  if (!REQUEST_RESULT_PATH.test(stringifyKeyPath(record))) {
    return 0;
  }
  const metadata = record.v && typeof record.v === "object" ? ((record.v as Record<string, unknown>).metadata as Record<string, unknown> | undefined) : undefined;
  const summaries = Array.isArray(metadata?.summaries) ? metadata.summaries : [];
  const uniqueTexts = new Set<string>();
  for (const item of summaries) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const text = (item as Record<string, unknown>).text;
    if (typeof text === "string" && text.trim()) {
      uniqueTexts.add(text);
    }
  }
  let total = 0;
  for (const text of uniqueTexts) {
    total += text.length;
  }
  return total;
}

function isVisibleResponseLeaf(pathText: string, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (pathText.includes(".encrypted") || pathText.includes(".id") || pathText.endsWith(".uri")) {
    return false;
  }
  if (trimmed.startsWith("file://")) {
    return false;
  }
  if (trimmed.length > 4_000 && /^[A-Za-z0-9+/=_-]+$/.test(trimmed)) {
    return false;
  }
  return pathText.endsWith(".value") || pathText.endsWith(".text") || pathText.includes(".invocationMessage.value");
}

function sumNestedVisibleChars(obj: unknown): number {
  let total = 0;
  for (const leaf of collectLeafStrings(obj, "v")) {
    if (isVisibleResponseLeaf(leaf.path, leaf.value)) {
      total += leaf.value.length;
    }
  }
  return total;
}

function sumRangeSummaryChars(range: unknown): number {
  if (!range || typeof range !== "object") {
    return 0;
  }
  const rangeRecord = range as Record<string, unknown>;
  let total = 0;
  let sawValue = false;
  for (const key of ["startLineNumber", "startColumn", "endLineNumber", "endColumn"]) {
    const value = rangeRecord[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      total += String(Math.trunc(value)).length;
      sawValue = true;
    }
  }
  return sawValue ? total + 6 : 0;
}

function sumResponseEditSummaryChars(uri: unknown, edits: unknown): number {
  let total = typeof uri === "string" && uri.trim() ? uri.length : 0;
  let remainingTextBudget = MAX_RESPONSE_EDIT_SUMMARY_CHARS_PER_GROUP;
  let editCount = 0;
  const stack: unknown[] = [edits];

  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      for (const item of current) {
        stack.push(item);
      }
      continue;
    }
    if (!current || typeof current !== "object") {
      continue;
    }
    const record = current as Record<string, unknown>;
    if ("text" in record || "range" in record) {
      editCount += 1;
      total += sumRangeSummaryChars(record.range);
      const text = record.text;
      if (typeof text === "string" && text.trim() && remainingTextBudget > 0) {
        const slice = Math.min(text.length, MAX_RESPONSE_EDIT_TEXT_CHARS_PER_ENTRY, remainingTextBudget);
        total += slice;
        remainingTextBudget -= slice;
      }
      continue;
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  if (editCount > 0) {
    total += Math.min(editCount * 16, 160);
  }
  return Math.min(total, MAX_RESPONSE_EDIT_SUMMARY_CHARS_PER_GROUP);
}

function sumResponseEditProxyChars(uri: unknown, edits: unknown): number {
  const structuralChars = sumResponseEditSummaryChars(uri, edits);
  const rawEditChars = JSON.stringify(edits ?? "").length;
  const scaledChars = Math.min(
    Math.ceil(rawEditChars * RESPONSE_EDIT_PROXY_CHAR_RATIO),
    MAX_RESPONSE_EDIT_PROXY_CHARS_PER_GROUP
  );
  const uriChars = typeof uri === "string" && uri.trim() ? Math.min(uri.length, 200) : 0;
  return Math.max(structuralChars, scaledChars + uriChars);
}

function isRuntimeResponseKind(kind: unknown): boolean {
  return kind === "toolInvocationSerialized" || kind === "progressTaskSerialized" || kind === "textEditGroup";
}

function sumResponseMessageChars(row: unknown): number {
  let total = 0;
  const items = responsePayloadItemsFromRow(row);
  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const entry = item as Record<string, unknown>;
    const kind = entry.kind;
    const value = entry.value;
    if (kind === "thinking" && typeof value === "string" && value.trim()) {
      total += value.length;
    }
    if ((kind === undefined || kind === null) && typeof value === "string" && value.trim()) {
      total += value.length;
    }
    if (entry.invocationMessage && typeof entry.invocationMessage === "object") {
      const invocationValue = (entry.invocationMessage as Record<string, unknown>).value;
      if (typeof invocationValue === "string" && invocationValue.trim()) {
        total += invocationValue.length;
      }
    }
    if (entry.pastTenseMessage && typeof entry.pastTenseMessage === "object") {
      const pastTenseValue = (entry.pastTenseMessage as Record<string, unknown>).value;
      if (typeof pastTenseValue === "string" && pastTenseValue.trim()) {
        total += pastTenseValue.length;
      }
    }
  }
  return total;
}

function sumResponseToolResultChars(row: unknown): number {
  let total = 0;
  const items = responsePayloadItemsFromRow(row);
  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const entry = item as Record<string, unknown>;
    const kind = entry.kind;
    if (
      kind === "toolInvocationSerialized" ||
      kind === "progressTaskSerialized" ||
      kind === "textEditGroup"
    ) {
      total += sumNestedVisibleChars(entry.toolSpecificData);
      total += sumNestedVisibleChars(entry.resultDetails);
      total += sumResponseEditProxyChars(entry.uri, entry.edits);
      total += sumNestedVisibleChars(entry.content);
    }
  }
  return total;
}

function sumResultToolCallResultChars(row: unknown, seenCallIds: Set<string>): number {
  let total = 0;
  for (const result of resultPayloadsFromRow(row)) {
    const metadata = result.metadata as Record<string, unknown> | undefined;
    const toolCallResults = metadata?.toolCallResults;
    if (!toolCallResults || typeof toolCallResults !== "object") {
      continue;
    }
    for (const [callId, payload] of Object.entries(toolCallResults as Record<string, unknown>)) {
      if (seenCallIds.has(callId)) {
        continue;
      }
      seenCallIds.add(callId);
      const visibleChars = sumNestedVisibleChars(payload);
      const boundedVisibleChars = Math.min(visibleChars, MAX_RESULT_TOOL_CALL_RESULT_CHARS_PER_CALL);
      const rawChars = JSON.stringify(payload ?? "").length;
      const hiddenChars = Math.max(0, rawChars - visibleChars);
      const boundedHiddenChars = Math.min(
        Math.ceil(hiddenChars * RESULT_TOOL_CALL_RESULT_HIDDEN_CHAR_RATIO),
        MAX_RESULT_TOOL_CALL_RESULT_HIDDEN_CHARS_PER_CALL
      );
      total += boundedVisibleChars + boundedHiddenChars;
    }
  }
  return total;
}

function rowHasCompactionBoundary(row: unknown): boolean {
  if (!row || typeof row !== "object") {
    return false;
  }
  const record = row as Record<string, unknown>;
  if (!REQUEST_RESPONSE_PATH.test(stringifyKeyPath(record)) || !Array.isArray(record.v)) {
    return false;
  }
  for (const item of record.v) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const entry = item as Record<string, unknown>;
    const candidates: string[] = [];
    const value = entry.value;
    if (typeof value === "string" && value.trim() && value.trim().length <= 120) {
      candidates.push(value);
    }
    if (entry.invocationMessage && typeof entry.invocationMessage === "object") {
      const invocationValue = (entry.invocationMessage as Record<string, unknown>).value;
      if (typeof invocationValue === "string" && invocationValue.trim() && invocationValue.trim().length <= 120) {
        candidates.push(invocationValue);
      }
    }
    if (entry.pastTenseMessage && typeof entry.pastTenseMessage === "object") {
      const pastTenseValue = (entry.pastTenseMessage as Record<string, unknown>).value;
      if (typeof pastTenseValue === "string" && pastTenseValue.trim() && pastTenseValue.trim().length <= 120) {
        candidates.push(pastTenseValue);
      }
    }
    if (entry.content && typeof entry.content === "object") {
      const contentValue = (entry.content as Record<string, unknown>).value;
      if (typeof contentValue === "string" && contentValue.trim() && contentValue.trim().length <= 120) {
        candidates.push(contentValue);
      }
    }
    if (candidates.some((text) => /^compact(?:ing|ed)? conversation(?:\.\.\.)?$/i.test(text.replace(/\s+/g, " ").trim()))) {
      return true;
    }
  }
  return false;
}

function isCompactionBoundaryText(text: string): boolean {
  return /^compact(?:ing|ed)? conversation(?:\.\.\.)?$/i.test(text.replace(/\s+/g, " ").trim());
}

function normalizeAnchorOccurrence(value: AnchorOccurrence | undefined): AnchorOccurrence {
  return value === "last" ? "last" : "first";
}

function blockSearchText(block: TranscriptEvidenceBlock): string {
  const payloadLabels = block.payloads.map((payload) => payload.label);
  const payloadContents = block.payloads.map((payload) => payload.content);
  if (block.heading === "Tool Invocation") {
    return [block.tool].filter((value): value is string => typeof value === "string" && value.length > 0).join("\n");
  }
  if (block.heading === "Access Limit") {
    return [block.tool, ...payloadLabels].filter((value): value is string => typeof value === "string" && value.length > 0).join("\n");
  }
  return [
    block.tool,
    ...payloadLabels,
    ...payloadContents
  ].filter((value): value is string => typeof value === "string" && value.length > 0).join("\n");
}

function blockHasCompactionBoundary(block: TranscriptEvidenceBlock): boolean {
  return block.payloads.some((payload) => isCompactionBoundaryText(payload.content));
}

function addCategoryChars(
  categories: Record<ContextCategoryName, ContextCategoryEstimate>,
  category: ContextCategoryName,
  chars: number
): void {
  if (chars <= 0) {
    return;
  }
  categories[category].chars += chars;
  categories[category].rows += 1;
}

function sumRootPromptCustomizationChars(row: unknown, recentRequestFamilies: number): number {
  if (!row || typeof row !== "object") {
    return 0;
  }
  const record = row as Record<string, unknown>;
  if (record.kind !== 0 || !record.v || typeof record.v !== "object") {
    return 0;
  }
  const requests = Array.isArray((record.v as Record<string, unknown>).requests)
    ? ((record.v as Record<string, unknown>).requests as unknown[])
    : [];
  const uniqueValues = new Set<string>();
  for (const request of requests.slice(-recentRequestFamilies)) {
    if (!request || typeof request !== "object") {
      continue;
    }
    const variableData = (request as Record<string, unknown>).variableData;
    const variables = variableData && typeof variableData === "object" && Array.isArray((variableData as Record<string, unknown>).variables)
      ? ((variableData as Record<string, unknown>).variables as unknown[])
      : [];
    for (const variable of variables) {
      if (!variable || typeof variable !== "object") {
        continue;
      }
      const name = String((variable as Record<string, unknown>).name ?? (variable as Record<string, unknown>).id ?? "");
      const value = (variable as Record<string, unknown>).value;
      if (!name.startsWith("prompt:") || typeof value !== "string" || !value.trim()) {
        continue;
      }
      uniqueValues.add(value);
    }
  }
  let total = 0;
  for (const value of uniqueValues) {
    total += value.length;
  }
  return total;
}

function sumRootSlashCommandChars(row: unknown, recentRequestFamilies: number): number {
  if (!row || typeof row !== "object") {
    return 0;
  }
  const record = row as Record<string, unknown>;
  if (record.kind !== 0 || !record.v || typeof record.v !== "object") {
    return 0;
  }
  const requests = Array.isArray((record.v as Record<string, unknown>).requests)
    ? ((record.v as Record<string, unknown>).requests as unknown[])
    : [];
  const uniqueDescriptions = new Set<string>();
  for (const request of requests.slice(-recentRequestFamilies)) {
    if (!request || typeof request !== "object") {
      continue;
    }
    const agent = (request as Record<string, unknown>).agent;
    const slashCommands = agent && typeof agent === "object" && Array.isArray((agent as Record<string, unknown>).slashCommands)
      ? ((agent as Record<string, unknown>).slashCommands as unknown[])
      : [];
    for (const command of slashCommands) {
      if (!command || typeof command !== "object") {
        continue;
      }
      const commandRecord = command as Record<string, unknown>;
      const parts: string[] = [];
      for (const key of ["name", "description", "sampleRequest", "when"]) {
        const value = commandRecord[key];
        if (typeof value === "string" && value.trim()) {
          parts.push(value);
        }
      }
      const disambiguation = Array.isArray(commandRecord.disambiguation) ? commandRecord.disambiguation : [];
      for (const item of disambiguation) {
        if (!item || typeof item !== "object") {
          continue;
        }
        const disambiguationRecord = item as Record<string, unknown>;
        for (const key of ["category", "description"]) {
          const value = disambiguationRecord[key];
          if (typeof value === "string" && value.trim()) {
            parts.push(value);
          }
        }
        const examples = Array.isArray(disambiguationRecord.examples) ? disambiguationRecord.examples : [];
        for (const example of examples) {
          if (typeof example === "string" && example.trim()) {
            parts.push(example);
          }
        }
      }
      const fullText = parts.join("\n").trim();
      if (fullText) {
        uniqueDescriptions.add(fullText);
      }
    }
  }
  let total = 0;
  for (const description of uniqueDescriptions) {
    total += description.length;
  }
  return total;
}

function estimateImplicitSystemInstructionChars(systemInstructionChars: number): number {
  if (systemInstructionChars <= 0) {
    return 0;
  }
  return Math.ceil(systemInstructionChars * IMPLICIT_SYSTEM_INSTRUCTION_CHAR_MULTIPLIER);
}

function estimateImplicitToolDefinitionChars(toolResultChars: number, toolInvocationCount: number): number {
  if (toolResultChars <= 0 && toolInvocationCount <= 0) {
    return 0;
  }
  const runtimeProxyChars = Math.min(toolInvocationCount * IMPLICIT_TOOL_DEFINITION_CHARS_PER_INVOCATION, MAX_IMPLICIT_TOOL_DEFINITION_CHARS);
  return runtimeProxyChars + Math.floor(toolResultChars * IMPLICIT_TOOL_DEFINITION_CHAR_RATIO);
}

function countResponseToolInvocations(row: unknown): number {
  let total = 0;
  for (const item of responsePayloadItemsFromRow(row)) {
    if (item && typeof item === "object" && (item as Record<string, unknown>).kind === "toolInvocationSerialized") {
      total += 1;
    }
  }
  return total;
}

function summaryKeyMatches(summary: RecordSummary, pattern: RegExp): boolean {
  return pattern.test(summary.keyPath);
}

function extractPendingRequestIds(row: unknown): string[] {
  if (!row || typeof row !== "object") {
    return [];
  }
  const record = row as Record<string, unknown>;
  const keyPath = Array.isArray(record.k) ? record.k : [];
  const isPendingRequestsRow = keyPath.length === 1 && keyPath[0] === "pendingRequests";
  const rootPending = record.kind === 0 && record.v && typeof record.v === "object"
    ? ((record.v as Record<string, unknown>).pendingRequests as unknown)
    : undefined;
  const value = rootPending ?? (isPendingRequestsRow ? record.v : undefined);
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: string[] = [];
  for (const item of value) {
    if (item && typeof item === "object") {
      const id = (item as Record<string, unknown>).id;
      if (typeof id === "string" && id.trim()) {
        ids.push(id.trim());
      }
    }
  }
  return ids;
}

function rowHasExplicitPendingRequests(row: unknown): boolean {
  if (!row || typeof row !== "object") {
    return false;
  }
  const record = row as Record<string, unknown>;
  if (record.kind === 0 && record.v && typeof record.v === "object" && "pendingRequests" in (record.v as Record<string, unknown>)) {
    return true;
  }
  return Array.isArray(record.k) && record.k.length === 1 && record.k[0] === "pendingRequests";
}

function extractRequestModelStateValue(row: unknown): { requestIndex: number; value: number } | undefined {
  if (!row || typeof row !== "object") {
    return undefined;
  }
  const record = row as Record<string, unknown>;
  if (!Array.isArray(record.k) || record.k.length !== 3) {
    return undefined;
  }
  const [scope, requestIndex, leaf] = record.k;
  if (scope !== "requests" || typeof requestIndex !== "number" || leaf !== "modelState") {
    return undefined;
  }
  if (!record.v || typeof record.v !== "object") {
    return undefined;
  }
  const value = (record.v as Record<string, unknown>).value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return {
    requestIndex,
    value
  };
}

function derivePendingRequestState(
  explicitPendingIds: string[],
  sawExplicitPendingRequests: boolean,
  requestModelStates: Map<number, number>
): { pendingRequestCount: number; pendingRequestIds: string[] } {
  if (sawExplicitPendingRequests) {
    return {
      pendingRequestCount: explicitPendingIds.length,
      pendingRequestIds: explicitPendingIds
    };
  }
  let pendingRequestCount = 0;
  for (const value of requestModelStates.values()) {
    if (value !== 1) {
      pendingRequestCount += 1;
    }
  }
  return {
    pendingRequestCount,
    pendingRequestIds: []
  };
}

function createEmptyContextCategories(): Record<ContextCategoryName, ContextCategoryEstimate> {
  return {
    systemInstructions: { chars: 0, estimatedTokens: 0, rows: 0 },
    toolDefinitions: { chars: 0, estimatedTokens: 0, rows: 0 },
    userContext: { chars: 0, estimatedTokens: 0, rows: 0 },
    messages: { chars: 0, estimatedTokens: 0, rows: 0 },
    files: { chars: 0, estimatedTokens: 0, rows: 0 },
    toolResults: { chars: 0, estimatedTokens: 0, rows: 0 },
    unknown: { chars: 0, estimatedTokens: 0, rows: 0 }
  };
}

function rowHasObjectKey(row: unknown, targetKey: string, depth = 0): boolean {
  if (!row || typeof row !== "object" || depth > 8) {
    return false;
  }
  if (Array.isArray(row)) {
    return row.some((item) => rowHasObjectKey(item, targetKey, depth + 1));
  }
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (key === targetKey) {
      return true;
    }
    if (value && typeof value === "object" && rowHasObjectKey(value, targetKey, depth + 1)) {
      return true;
    }
  }
  return false;
}

function classifyContextCategory(summary: RecordSummary, row: unknown): ContextCategoryName {
  const keyPath = summary.keyPath;
  const searchText = rowSearchText(row).toLowerCase();
  if (rowHasObjectKey(row, "systemInstructions")) {
    return "systemInstructions";
  }
  if (rowHasObjectKey(row, "toolDefinitions")) {
    return "toolDefinitions";
  }
  if (keyPath === "inputState/attachments" || keyPath === "inputState/contrib") {
    return "files";
  }
  if (keyPath === "pendingRequests" || keyPath.startsWith("inputState/")) {
    return "userContext";
  }
  if (
    searchText.includes("renderedusermessage") ||
    searchText.includes("<context>") ||
    searchText.includes("<editorcontext>") ||
    searchText.includes("<workspace_info>") ||
    searchText.includes("<conversation-summary>") ||
    searchText.includes("<attachments>")
  ) {
    return "userContext";
  }
  if (summaryKeyMatches(summary, REQUEST_RESPONSE_PATH)) {
    return "toolResults";
  }
  if (summaryKeyMatches(summary, REQUEST_RESULT_PATH) || keyPath === "requests") {
    return "messages";
  }
  if (searchText.includes("\"message\"") || searchText.includes("assistant") || searchText.includes("user")) {
    return "messages";
  }
  return "unknown";
}

function pressureLevelFromRatio(ratio: number): "low" | "medium" | "high" {
  if (ratio >= 0.75) {
    return "high";
  }
  if (ratio >= 0.4) {
    return "medium";
  }
  return "low";
}

function describeSessionActivityKind(kind: SessionActivityKind): string {
  switch (kind) {
    case "bootstrap-stub":
      return "bootstrap stub";
    case "draft-only":
      return "draft only";
    case "sparse-interaction":
      return "sparse interaction";
    case "interactive":
      return "interactive";
  }
}

function classifySessionActivity(metrics: {
  includedRows: number;
  latestUserMessage?: RecordSummary;
  latestRequest?: RecordSummary;
  pendingRequestCount: number;
  requestCount: number;
  responseCount: number;
  resultCount: number;
  toolInvocationCount: number;
}): SessionActivityAssessment {
  const hasDraftText = Boolean(metrics.latestUserMessage);
  const hasRequestBatch = metrics.requestCount > 0 || Boolean(metrics.latestRequest);
  const hasRuntimeArtifacts = metrics.responseCount > 0 || metrics.resultCount > 0 || metrics.toolInvocationCount > 0;

  if (!hasDraftText && !hasRequestBatch && !hasRuntimeArtifacts && metrics.includedRows <= 1) {
    return {
      kind: "bootstrap-stub",
      summary: "Only bootstrap or model metadata was persisted; no draft text, request batch, assistant result, or tool activity was observed."
    };
  }

  if (hasDraftText && !hasRequestBatch && !hasRuntimeArtifacts && metrics.pendingRequestCount === 0) {
    return {
      kind: "draft-only",
      summary: "A local draft was persisted in input state, but no request batch or assistant/runtime activity was observed."
    };
  }

  if (
    (!hasRequestBatch && hasRuntimeArtifacts) ||
    (metrics.requestCount <= 1 && metrics.responseCount + metrics.resultCount <= 2 && metrics.toolInvocationCount <= 1 && metrics.includedRows <= 6)
  ) {
    return {
      kind: "sparse-interaction",
      summary: "Some persisted interaction exists, but it is too small or structurally incomplete to treat as a normal full conversation."
    };
  }

  return {
    kind: "interactive",
    summary: "Persisted request batches or repeated assistant/runtime activity indicate a real conversation rather than a bootstrap stub."
  };
}

function summarizeFindings(snapshot: SnapshotResult, contextEstimate: ContextEstimateResult): SessionProfileFinding[] {
  const findings: SessionProfileFinding[] = [];
  if (snapshot.activityKind === "bootstrap-stub") {
    findings.push({
      severity: "low",
      summary: "This session looks like a bootstrap-only artifact rather than a real conversation."
    });
  }
  if (snapshot.activityKind === "draft-only") {
    findings.push({
      severity: "low",
      summary: "This session looks like a persisted draft with no observed request dispatch or assistant response."
    });
  }
  if (snapshot.activityKind === "sparse-interaction") {
    findings.push({
      severity: "low",
      summary: "This session contains only sparse interaction artifacts, so conclusions should be treated as low-confidence." 
    });
  }
  if (contextEstimate.pressureLevel === "high") {
    findings.push({
      severity: "high",
      summary: `Estimated context utilization is ${(contextEstimate.utilizationRatio * 100).toFixed(1)}%, which suggests the session is operating close to the assumed window.`
    });
  }
  if (snapshot.pendingRequestCount > 0) {
    findings.push({
      severity: "high",
      summary: `There are ${snapshot.pendingRequestCount} pending request(s), so the persisted snapshot may reflect in-flight work rather than a settled state.`
    });
  }
  if (snapshot.toolInvocationCount > snapshot.resultCount && snapshot.toolInvocationCount >= 3) {
    findings.push({
      severity: "medium",
      summary: `Tool/runtime activity (${snapshot.toolInvocationCount}) exceeds assistant result rows (${snapshot.resultCount}), which can make root-cause inspection tool-heavy.`
    });
  }
  if ((contextEstimate.categories.userContext.estimatedTokens + contextEstimate.categories.files.estimatedTokens) > contextEstimate.categories.messages.estimatedTokens * 2) {
    findings.push({
      severity: "medium",
      summary: "User-context payload dominates visible messages, so prompts or attached context may be the main pressure source rather than conversation turns." 
    });
  }
  for (const signal of contextEstimate.signals) {
    findings.push({
      severity: signal.includes("not observed") ? "low" : "medium",
      summary: signal
    });
  }
  if (findings.length === 0) {
    findings.push({
      severity: "low",
      summary: "No obvious anomaly stood out from the persisted snapshot and current heuristics."
    });
  }
  const rank = { high: 0, medium: 1, low: 2 } as const;
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.summary.localeCompare(b.summary));
  return findings;
}

export function summarizeRow(lineNo: number, row: unknown): RecordSummary {
  const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  return {
    lineNo,
    kind: record.kind,
    keyPath: stringifyKeyPath(row),
    timestamp: extractTimestamp(row),
    requestId: extractRequestId(row),
    preview: bestPreview(row)
  };
}

export function isNoiseRecord(entry: RecordSummary): boolean {
  if (NOISE_PATH_SNIPPETS.some((snippet) => entry.keyPath.includes(snippet))) {
    return true;
  }
  if (!entry.preview || entry.preview === "<no text preview>") {
    return true;
  }
  if (GENERIC_PREVIEWS.has(entry.preview)) {
    return true;
  }
  return false;
}

export async function buildIndex(options: IndexOptions): Promise<IndexResult> {
  const candidate = await selectSession(options);
  const entries: RecordSummary[] = [];
  const tail = clampPositive(options.tail, 120, MAX_TAIL_RECORDS);
  for await (const { lineNo, row } of iterJsonlRows(candidate.jsonlPath)) {
    const summary = summarizeRow(lineNo, row);
    if (!options.includeNoise && isNoiseRecord(summary)) {
      continue;
    }
    entries.push(summary);
    if (entries.length > tail) {
      entries.shift();
    }
  }
  return { candidate, entries };
}

export async function buildWindow(options: WindowOptions): Promise<WindowResult> {
  const candidate = await selectSession(options);
  const before = clampNonNegative(options.before, 4, MAX_WINDOW_BEFORE);
  const after = clampNonNegative(options.after, 6, MAX_WINDOW_AFTER);
  const maxMatches = clampPositive(options.maxMatches, 2, MAX_WINDOW_MATCHES);
  const anchor = safeString(options.anchorText)?.toLowerCase();
  const anchorOccurrence = normalizeAnchorOccurrence(options.anchorOccurrence);
  const afterLatestCompact = options.afterLatestCompact === true;
  if (!anchor && !afterLatestCompact) {
    throw new Error("Provide anchorText or set afterLatestCompact=true.");
  }

  const entries: Array<{ summary: RecordSummary; haystack: string }> = [];
  let requestFamilyIndex = -1;
  let latestCompactionEntryIndex = -1;

  for await (const { lineNo, row } of iterJsonlRows(candidate.jsonlPath)) {
    const summary = summarizeRow(lineNo, row);
    if (!options.includeNoise && isNoiseRecord(summary)) {
      continue;
    }
    if (summary.keyPath === "requests" || rowContainsRequestBatch(row)) {
      requestFamilyIndex += 1;
    }
    if (requestFamilyIndex >= 0 && rowHasCompactionBoundary(row)) {
      latestCompactionEntryIndex = entries.length;
    }
    entries.push({ summary, haystack: rowSearchText(row).toLowerCase() });
  }

  if (entries.length === 0) {
    throw new Error("No persisted rows were available after filtering.");
  }

  if (afterLatestCompact && latestCompactionEntryIndex < 0) {
    throw new Error("No persisted compaction boundary was found in the selected session window scope.");
  }

  const searchStartIndex = afterLatestCompact && latestCompactionEntryIndex >= 0 ? latestCompactionEntryIndex : 0;
  const matchingIndexes = anchor
    ? entries
      .map((entry, index) => entry.haystack.includes(anchor) && index >= searchStartIndex ? index : -1)
      .filter((value) => value >= 0)
    : (afterLatestCompact && latestCompactionEntryIndex >= 0 ? [latestCompactionEntryIndex] : []);

  if (matchingIndexes.length === 0) {
    throw new Error(anchor
      ? `No match found for anchor text: ${options.anchorText}`
      : "No persisted compaction boundary was available to anchor the requested session window.");
  }

  const selectedMatchIndexes = anchorOccurrence === "last"
    ? matchingIndexes.slice(-maxMatches)
    : matchingIndexes.slice(0, maxMatches);

  const matches = selectedMatchIndexes.map((matchIndex) => {
    const start = Math.max(searchStartIndex, matchIndex - before);
    const end = Math.min(entries.length - 1, matchIndex + after);
    return entries.slice(start, end + 1).map((entry) => entry.summary);
  });

  return {
    candidate,
    anchorText: options.anchorText,
    anchorOccurrence: anchor ? anchorOccurrence : undefined,
    before,
    after,
    matches,
    afterLatestCompact,
    compactionBoundaryLine: latestCompactionEntryIndex >= 0 ? entries[latestCompactionEntryIndex].summary.lineNo : undefined
  };
}

export async function buildExport(options: ExportOptions): Promise<ExportResult> {
  const candidate = await selectSession(options);
  const entries: RecordSummary[] = [];
  for await (const { lineNo, row } of iterJsonlRows(candidate.jsonlPath)) {
    const summary = summarizeRow(lineNo, row);
    if (!options.includeNoise && isNoiseRecord(summary)) {
      continue;
    }
    entries.push(summary);
  }
  return {
    candidate,
    entries,
    includeNoise: Boolean(options.includeNoise)
  };
}

export async function buildTranscriptEvidence(options: TranscriptEvidenceOptions): Promise<TranscriptEvidenceResult> {
  const afterLatestCompact = options.afterLatestCompact === true;
  const anchorText = safeString(options.anchorText);
  const anchorOccurrence = normalizeAnchorOccurrence(options.anchorOccurrence);
  const maxBlocks = options.maxBlocks !== undefined ? clampPositive(options.maxBlocks, 12, 200) : undefined;
  let candidate: SessionCandidate;
  let transcriptPath: string | undefined;
  let selectorPath: string | undefined;

  try {
    const resolved = await resolveTranscriptArtifact(options);
    candidate = resolved.candidate;
    transcriptPath = resolved.transcriptPath;
    selectorPath = resolved.selectorPath;
  } catch (error) {
    const transcriptError = error as TranscriptArtifactMissingError | undefined;
    if (transcriptError?.code !== TRANSCRIPT_ARTIFACT_MISSING_CODE) {
      throw error;
    }

    candidate = await selectSession(options);
    return buildSessionDerivedTranscriptEvidenceResult(candidate, {
      afterLatestCompact,
      anchorText,
      anchorOccurrence,
      maxBlocks,
      unavailableReason: transcriptError.message,
      attemptedPaths: transcriptError.attemptedPaths,
      omissions: [
        "Transcript artifact was unavailable, so this result falls back to persisted session-derived evidence rather than canonical transcript rows."
      ]
    });
  }

  const entries: ParsedTranscriptEntry[] = [];
  let totalRows = 0;

  for await (const { lineNo, row } of iterJsonlRows(transcriptPath)) {
    totalRows += 1;
    entries.push(parseTranscriptEntry(lineNo, row));
  }

  const transcriptTailGap = describeTranscriptTailGap(entries);
  if (transcriptTailGap) {
    const fallbackSnapshot = await buildSnapshot({ sessionFile: candidate.jsonlPath });
    if (snapshotLooksMoreSettledThanTranscript(fallbackSnapshot)) {
      return buildSessionDerivedTranscriptEvidenceResult(candidate, {
        afterLatestCompact,
        anchorText,
        anchorOccurrence,
        maxBlocks,
        transcriptPath,
        attemptedPaths: [transcriptPath],
        totalRows,
        fallbackSnapshot,
        unavailableReason: `Canonical transcript artifact was present at ${normalizeSource(transcriptPath)}, but it ended before the latest settled assistant turn was fully persisted. ${transcriptTailGap}`,
        omissions: [
          "Canonical transcript artifact was present but incomplete for the latest settled turn, so this result falls back to persisted session-derived evidence rather than canonical transcript rows."
        ]
      });
    }
  }

  const standaloneToolCallIds = new Set<string>();
  const completedToolCallIds = new Set<string>();
  let hasMainThread = false;

  for (const entry of entries) {
    const data = asRecord(entry.data);
    if (entry.type === "tool.execution_start") {
      const toolCallId = safeString(data?.toolCallId);
      if (toolCallId) {
        standaloneToolCallIds.add(toolCallId);
      }
    }
    if (entry.type === "tool.execution_complete") {
      const toolCallId = safeString(data?.toolCallId);
      if (toolCallId) {
        completedToolCallIds.add(toolCallId);
      }
    }
    if (entry.type === "user.message" || entry.type === "assistant.message") {
      hasMainThread = true;
    }
  }

  const blocks: TranscriptEvidenceBlock[] = [];
  const entryBlockIds = new Map<string, string>();
  const entryToolNames = new Map<string, string>();
  const omissions: string[] = [];
  const omissionSet = new Set<string>();
  let omittedTurnBoundaryCount = 0;
  let omittedSessionStartCount = 0;
  let bundledToolRequestCount = 0;

  function addOmission(text: string): void {
    if (!omissionSet.has(text)) {
      omissionSet.add(text);
      omissions.push(text);
    }
  }

  function resolveParent(entry: ParsedTranscriptEntry): string {
    if (!entry.parentId) {
      return "none";
    }
    const parent = entryBlockIds.get(entry.parentId);
    if (parent) {
      return parent;
    }
    addOmission(`Parent gap: ${entry.type}${entry.id ? ` ${entry.id}` : ""} points to transcript parentId ${entry.parentId}, but that parent was not emitted as an evidence block.`);
    return "none";
  }

  function pushBlock(block: Omit<TranscriptEvidenceBlock, "id">, entry?: ParsedTranscriptEntry): string {
    const blockId = formatEvidenceBlockId(blocks.length + 1);
    const completeBlock: TranscriptEvidenceBlock = {
      id: blockId,
      ...block
    };
    blocks.push(completeBlock);
    if (entry?.id) {
      entryBlockIds.set(entry.id, blockId);
      if (completeBlock.tool) {
        entryToolNames.set(entry.id, completeBlock.tool);
      }
    }
    return blockId;
  }

  for (const entry of entries) {
    const data = asRecord(entry.data);

    if (entry.type === "session.start") {
      omittedSessionStartCount += 1;
      continue;
    }

    if (entry.type === "assistant.turn_start" || entry.type === "assistant.turn_end") {
      omittedTurnBoundaryCount += 1;
      continue;
    }

    if (entry.type === "user.message") {
      const payload = buildMessagePayload(data?.content);
      if (!payload) {
        pushBlock(
          {
            heading: "Access Limit",
            flow: inferAccessLimitFlow(hasMainThread, resolveParent(entry)),
            parent: resolveParent(entry),
            source: transcriptSourceLabel(transcriptPath, entry, "missing user content"),
            verbatim: true,
            timestamp: entry.timestamp,
            payloads: [buildStructuredPayload(entry.raw) ?? { language: "text", content: "<unreadable>" }]
          },
          entry
        );
        addOmission(`Unreadable payload: user.message${entry.id ? ` ${entry.id}` : ""} did not expose recoverable content, so it was emitted as Access Limit.`);
        continue;
      }
      pushBlock(
        {
          heading: "User Message",
          flow: "Main thread",
          parent: resolveParent(entry),
          source: transcriptSourceLabel(transcriptPath, entry),
          verbatim: true,
          timestamp: entry.timestamp,
          payloads: [payload]
        },
        entry
      );
      continue;
    }

    if (entry.type === "assistant.message") {
      const payloads: EvidencePayload[] = [];
      const hasReasoningText = data?.reasoningText !== undefined;
      const contentPayload = buildMessagePayload(data?.content, hasReasoningText ? "Content" : undefined);
      const reasoningPayload = buildMessagePayload(data?.reasoningText, contentPayload ? "Reasoning Text" : undefined);
      if (contentPayload) {
        payloads.push(contentPayload);
      }
      if (reasoningPayload) {
        payloads.push(reasoningPayload);
        addOmission(`Collapsed boundary: assistant.message${entry.id ? ` ${entry.id}` : ""} stored reasoningText inside the same atomic transcript entry, so content and reasoning remain in one evidence block.`);
      }

      if (payloads.length === 0) {
        pushBlock(
          {
            heading: "Access Limit",
            flow: inferAccessLimitFlow(hasMainThread, resolveParent(entry)),
            parent: resolveParent(entry),
            source: transcriptSourceLabel(transcriptPath, entry, "missing assistant content"),
            verbatim: true,
            timestamp: entry.timestamp,
            payloads: [buildStructuredPayload(entry.raw) ?? { language: "text", content: "<unreadable>" }]
          },
          entry
        );
        addOmission(`Unreadable payload: assistant.message${entry.id ? ` ${entry.id}` : ""} did not expose recoverable content or reasoning text, so it was emitted as Access Limit.`);
        continue;
      }

      const assistantBlockId = pushBlock(
        {
          heading: "Assistant Message",
          flow: "Main thread",
          parent: resolveParent(entry),
          source: transcriptSourceLabel(transcriptPath, entry),
          verbatim: true,
          timestamp: entry.timestamp,
          payloads
        },
        entry
      );

      const toolRequests = Array.isArray(data?.toolRequests) ? data.toolRequests : [];
      for (const request of toolRequests) {
        const requestRecord = asRecord(request);
        const toolCallId = safeString(requestRecord?.toolCallId);
        if (toolCallId && standaloneToolCallIds.has(toolCallId)) {
          continue;
        }
        const toolName = safeString(requestRecord?.toolName);
        const argumentsPayload = buildStructuredPayload(requestRecord?.arguments);
        if (!toolName && !argumentsPayload) {
          continue;
        }
        bundledToolRequestCount += 1;
        pushBlock({
          heading: "Tool Invocation",
          flow: "Descendant",
          parent: assistantBlockId,
          source: transcriptSourceLabel(transcriptPath, entry, toolCallId ? `bundled.toolRequest ${toolCallId}` : "bundled.toolRequest"),
          verbatim: true,
          tool: toolName,
          timestamp: entry.timestamp,
          payloads: [argumentsPayload ?? buildStructuredPayload(requestRecord) ?? { language: "text", content: "<unreadable>" }]
        });
      }

      continue;
    }

    if (entry.type === "tool.execution_start") {
      const toolName = safeString(data?.toolName);
      const payload = buildStructuredPayload(data?.arguments) ?? buildStructuredPayload(data);
      pushBlock(
        {
          heading: payload ? "Tool Invocation" : "Access Limit",
          flow: payload ? "Descendant" : inferAccessLimitFlow(hasMainThread, resolveParent(entry)),
          parent: resolveParent(entry),
          source: transcriptSourceLabel(transcriptPath, entry),
          verbatim: true,
          tool: toolName,
          timestamp: entry.timestamp,
          payloads: [payload ?? buildStructuredPayload(entry.raw) ?? { language: "text", content: "<unreadable>" }]
        },
        entry
      );
      if (!payload) {
        addOmission(`Unreadable payload: tool.execution_start${entry.id ? ` ${entry.id}` : ""} did not expose recoverable arguments, so the raw row was emitted as Access Limit.`);
      }
      continue;
    }

    if (entry.type === "tool.execution_complete") {
      const resolvedParent = resolveParent(entry);
      const parentToolName = entry.parentId ? entryToolNames.get(entry.parentId) : undefined;
      const toolName = safeString(data?.toolName) ?? parentToolName;
      const payload = buildStructuredPayload(data?.result) ?? buildStructuredPayload(data?.error) ?? buildStructuredPayload(data);
      pushBlock(
        {
          heading: payload ? "Tool Result" : "Access Limit",
          flow: payload ? "Descendant" : inferAccessLimitFlow(hasMainThread, resolvedParent),
          parent: resolvedParent,
          source: transcriptSourceLabel(transcriptPath, entry),
          verbatim: true,
          tool: toolName,
          timestamp: entry.timestamp,
          payloads: [payload ?? buildStructuredPayload(entry.raw) ?? { language: "text", content: "<unreadable>" }]
        },
        entry
      );
      if (!payload) {
        addOmission(`Unreadable payload: tool.execution_complete${entry.id ? ` ${entry.id}` : ""} did not expose recoverable result content, so the raw row was emitted as Access Limit.`);
      }
      continue;
    }

    const resolvedParent = resolveParent(entry);
    pushBlock(
      {
        heading: "Access Limit",
        flow: inferAccessLimitFlow(hasMainThread, resolvedParent),
        parent: resolvedParent,
        source: transcriptSourceLabel(transcriptPath, entry),
        verbatim: true,
        timestamp: entry.timestamp,
        payloads: [buildStructuredPayload(entry.raw) ?? { language: "text", content: "<unreadable>" }]
      },
      entry
    );
    addOmission(`Access limit: transcript entry type ${entry.type} was not mapped to a semantic evidence block and was emitted as Access Limit instead.`);
  }

  if (omittedSessionStartCount > 0) {
    addOmission(`Bootstrap metadata omitted: ${omittedSessionStartCount} session.start entr${omittedSessionStartCount === 1 ? "y was" : "ies were"} not emitted because they only carried transcript bootstrap metadata.`);
  }
  if (omittedTurnBoundaryCount > 0) {
    addOmission(`Turn-boundary metadata omitted: ${omittedTurnBoundaryCount} assistant.turn_start / assistant.turn_end entr${omittedTurnBoundaryCount === 1 ? "y was" : "ies were"} not emitted because they only carried turn-boundary metadata.`);
  }
  if (bundledToolRequestCount > 0) {
    addOmission(`Bundled tool fallback: ${bundledToolRequestCount} tool request entr${bundledToolRequestCount === 1 ? "y was" : "ies were"} emitted from assistant.message metadata because no separate tool.execution_start entry was stored for that request.`);
  }

  for (const toolCallId of standaloneToolCallIds) {
    if (!completedToolCallIds.has(toolCallId)) {
      addOmission(`Missing descendant result: tool call ${toolCallId} has a stored tool.execution_start entry but no separately stored tool.execution_complete entry in the transcript file.`);
    }
  }

  if (blocks.length === 0) {
    addOmission("No safe atomic evidence blocks were recoverable from the transcript file.");
  }

  let filteredBlocks = blocks;
  let compactionBoundaryApplied = false;
  let startIndex = 0;
  if (afterLatestCompact) {
    const compactionIndex = filteredBlocks.map((block, index) => blockHasCompactionBoundary(block) ? index : -1).filter((index) => index >= 0).at(-1) ?? -1;
    if (compactionIndex < 0) {
      throw new Error("No compaction boundary block was found in the selected evidence transcript.");
    }
    startIndex = compactionIndex;
    compactionBoundaryApplied = true;
  }

  if (anchorText) {
    const normalizedAnchor = anchorText.toLowerCase();
    const anchorIndexes = filteredBlocks
      .map((block, index) => index >= startIndex && blockSearchText(block).toLowerCase().includes(normalizedAnchor) ? index : -1)
      .filter((index) => index >= 0);
    if (anchorIndexes.length === 0) {
      throw new Error(`No transcript evidence block matched anchor text: ${anchorText}`);
    }
    startIndex = anchorOccurrence === "last" ? anchorIndexes.at(-1)! : anchorIndexes[0];
  }

  filteredBlocks = filteredBlocks.slice(startIndex, maxBlocks ? startIndex + maxBlocks : undefined);

  return {
    candidate,
    transcriptAvailable: true,
    transcriptPath,
    selectorPath,
    totalRows,
    blocks: filteredBlocks,
    omissions,
    anchorText,
    anchorOccurrence,
    afterLatestCompact,
    maxBlocks,
    compactionBoundaryApplied
  };
}

export async function buildSnapshot(options: SnapshotOptions): Promise<SnapshotResult> {
  const candidate = await selectSession(options);
  let totalRows = 0;
  let includedRows = 0;
  let latestTimestamp: string | undefined;
  let latestUserMessage: RecordSummary | undefined;
  let latestAssistantMessage: RecordSummary | undefined;
  let latestToolActivity: RecordSummary | undefined;
  let latestRequest: RecordSummary | undefined;
  let latestAssistantResponsePreview: string | undefined;
  let pendingRequestCount = 0;
  let pendingRequestIds: string[] = [];
  let requestCount = 0;
  let responseCount = 0;
  let resultCount = 0;
  let toolInvocationCount = 0;
  let parseErrorCount = 0;
  let sawExplicitPendingRequests = false;
  const requestModelStates = new Map<number, number>();
  const persistedSelection = createPersistedSelectionAccumulator();

  for await (const { lineNo, row } of iterJsonlRows(candidate.jsonlPath)) {
    totalRows += 1;
    applyPersistedSelectionRow(persistedSelection, row);
    const record = row && typeof row === "object" ? (row as Record<string, unknown>) : undefined;
    if (record?._parseError) {
      parseErrorCount += 1;
    }
    const summary = summarizeRow(lineNo, row);
    if (!options.includeNoise && isNoiseRecord(summary)) {
      continue;
    }
    includedRows += 1;
    const requestPreview = latestRequestPreviewFromRow(row);
    const assistantPreview = latestAssistantPreviewFromRow(row);
    const toolActivityPreview = latestToolActivityPreviewFromRow(row);
    if (summary.timestamp) {
      latestTimestamp = summary.timestamp;
    }
    if (summary.keyPath === "inputState/inputText" || sumInputStateInputTextChars(row) > 0) {
      latestUserMessage = summary;
    } else if (requestPreview) {
      latestUserMessage = withPreview(summary, requestPreview);
    }
    if (summary.keyPath === "requests" || rowContainsRequestBatch(row)) {
      latestRequest = withPreview(summary, requestPreview ?? summary.preview) ?? summary;
      requestCount += Math.max(1, requestBatchItemsFromRow(row).length);
    }
    if (rowHasExplicitPendingRequests(row)) {
      sawExplicitPendingRequests = true;
      pendingRequestIds = extractPendingRequestIds(row);
    }
    const modelState = extractRequestModelStateValue(row);
    if (modelState) {
      requestModelStates.set(modelState.requestIndex, modelState.value);
    }
    if (summaryKeyMatches(summary, REQUEST_RESPONSE_PATH) || rowContainsResponsePayload(row)) {
      latestToolActivity = withPreview(summary, toolActivityPreview);
      if (assistantPreview) {
        latestAssistantResponsePreview = assistantPreview;
      }
      responseCount += 1;
      toolInvocationCount += countResponseToolInvocations(row);
    }
    if (summaryKeyMatches(summary, REQUEST_RESULT_PATH) || rowContainsResultPayload(row)) {
      latestAssistantMessage = withPreview(summary, assistantPreview ?? latestAssistantResponsePreview ?? summary.preview) ?? summary;
      resultCount += 1;
    }
  }

  ({ pendingRequestCount, pendingRequestIds } = derivePendingRequestState(
    pendingRequestIds,
    sawExplicitPendingRequests,
    requestModelStates
  ));

  const activity = classifySessionActivity({
    includedRows,
    latestUserMessage,
    latestRequest,
    pendingRequestCount,
    requestCount,
    responseCount,
    resultCount,
    toolInvocationCount
  });

  return {
    candidate,
    includeNoise: Boolean(options.includeNoise),
    totalRows,
    includedRows,
    activityKind: activity.kind,
    activitySummary: activity.summary,
    latestTimestamp,
    latestUserMessage,
    latestAssistantMessage,
    latestToolActivity,
    latestRequest,
    pendingRequestCount,
    pendingRequestIds,
    requestCount,
    responseCount,
    resultCount,
    toolInvocationCount,
    parseErrorCount,
    persistedSelection: persistedSelection.state
  };
}

export async function buildContextEstimate(options: ContextEstimateOptions): Promise<ContextEstimateResult> {
  const candidate = await selectSession(options);
  const categories = createEmptyContextCategories();
  const afterLatestCompact = options.afterLatestCompact === true;
  let compactionBoundaryApplied = false;
  const latestRequestFamiliesLimit = options.latestRequestFamilies !== undefined
    ? clampPositive(options.latestRequestFamilies, 1, DEFAULT_ACTIVE_REQUEST_FAMILY_WINDOW)
    : undefined;
  let totalRows = 0;
  let includedRows = 0;
  let activeRows = 0;
  let latestUserMessage: RecordSummary | undefined;
  let latestRequest: RecordSummary | undefined;
  let pendingRequestCount = 0;
  let requestCount = 0;
  let responseCount = 0;
  let resultCount = 0;
  let toolInvocationCount = 0;
  let requestFamilyIndex = -1;
  let latestCompactionFamilyIndex = -1;
  let rootSessionRow: unknown;
  const includedEntries: Array<{ summary: RecordSummary; row: unknown; requestFamilyIndex: number }> = [];
  let sawExplicitPendingRequests = false;
  let explicitPendingRequestIds: string[] = [];
  const requestModelStates = new Map<number, number>();

  for await (const { lineNo, row } of iterJsonlRows(candidate.jsonlPath)) {
    totalRows += 1;
    const summary = summarizeRow(lineNo, row);
    if (!options.includeNoise && isNoiseRecord(summary)) {
      continue;
    }
    includedRows += 1;
    if (summary.keyPath === "inputState/inputText" || sumInputStateInputTextChars(row) > 0) {
      latestUserMessage = summary;
    }
    if (summary.keyPath === "requests" || rowContainsRequestBatch(row)) {
      latestRequest = summary;
      requestCount += Math.max(1, requestBatchItemsFromRow(row).length);
    }
    if (rowHasExplicitPendingRequests(row)) {
      sawExplicitPendingRequests = true;
      explicitPendingRequestIds = extractPendingRequestIds(row);
    }
    const modelState = extractRequestModelStateValue(row);
    if (modelState) {
      requestModelStates.set(modelState.requestIndex, modelState.value);
    }
    if (summaryKeyMatches(summary, REQUEST_RESPONSE_PATH) || rowContainsResponsePayload(row)) {
      responseCount += 1;
      toolInvocationCount += countResponseToolInvocations(row);
    }
    if (summaryKeyMatches(summary, REQUEST_RESULT_PATH) || rowContainsResultPayload(row)) {
      resultCount += 1;
    }
    if (summary.kind === 0 && summary.keyPath === "-") {
      rootSessionRow = row;
    }
    if (summary.keyPath === "requests" || rowContainsRequestBatch(row)) {
      requestFamilyIndex += 1;
    }
    if (requestFamilyIndex >= 0 && rowHasCompactionBoundary(row)) {
      latestCompactionFamilyIndex = requestFamilyIndex;
    }
    includedEntries.push({ summary, row, requestFamilyIndex });
  }

  pendingRequestCount = derivePendingRequestState(
    explicitPendingRequestIds,
    sawExplicitPendingRequests,
    requestModelStates
  ).pendingRequestCount;

  let activeRequestFamilies = 0;
  if (requestFamilyIndex < 0) {
    for (const entry of includedEntries) {
      const category = classifyContextCategory(entry.summary, entry.row);
      addCategoryChars(categories, category, textCharsFromRow(entry.row));
    }
    activeRows = includedEntries.length;
  } else {
    const requestedFamilyWindow = latestRequestFamiliesLimit ?? DEFAULT_ACTIVE_REQUEST_FAMILY_WINDOW;
    const boundedActiveRequestFamilies = Math.min(requestedFamilyWindow, requestFamilyIndex + 1);
    const boundedFirstActiveFamilyIndex = Math.max(0, requestFamilyIndex - boundedActiveRequestFamilies + 1);
    compactionBoundaryApplied = afterLatestCompact && latestCompactionFamilyIndex >= 0;
    const firstActiveFamilyIndex = latestCompactionFamilyIndex >= 0
      ? Math.max(boundedFirstActiveFamilyIndex, latestCompactionFamilyIndex)
      : boundedFirstActiveFamilyIndex;
    activeRequestFamilies = requestFamilyIndex - firstActiveFamilyIndex + 1;
    const seenToolCallResultIds = new Set<string>();
    let activeToolInvocationCount = 0;
    for (const entry of includedEntries) {
      if (entry.requestFamilyIndex < boundedFirstActiveFamilyIndex) {
        continue;
      }
      const fileChars = sumInputStateFileContextChars(entry.row) + sumRequestFileContextChars(entry.row);
      if (fileChars > 0 || entry.requestFamilyIndex >= firstActiveFamilyIndex) {
        activeRows += 1;
      }
      addCategoryChars(categories, "files", fileChars);
      if (entry.requestFamilyIndex < firstActiveFamilyIndex) {
        continue;
      }
      addCategoryChars(categories, "messages", sumInputStateInputTextChars(entry.row));
      addCategoryChars(categories, "messages", sumRequestMessageChars(entry.row));
      addCategoryChars(categories, "messages", sumResultRoundResponseChars(entry.row));
      addCategoryChars(categories, "messages", sumResultRoundThinkingChars(entry.row));
      addCategoryChars(categories, "messages", sumUniqueSummaryChars(entry.row));
      addCategoryChars(categories, "messages", sumResponseMessageChars(entry.row));
      addCategoryChars(categories, "messages", sumRenderedUserContextChars(entry.row));
      activeToolInvocationCount += countResponseToolInvocations(entry.row);
      addCategoryChars(categories, "toolResults", sumResultToolCallResultChars(entry.row, seenToolCallResultIds));
      addCategoryChars(categories, "toolResults", sumResponseToolResultChars(entry.row));
    }
    addCategoryChars(
      categories,
      "systemInstructions",
      estimateImplicitSystemInstructionChars(sumRootPromptCustomizationChars(rootSessionRow, boundedActiveRequestFamilies))
    );
    addCategoryChars(categories, "toolDefinitions", sumRootSlashCommandChars(rootSessionRow, boundedActiveRequestFamilies));
    const implicitToolDefinitionChars = Math.min(
      categories.toolResults.chars,
      estimateImplicitToolDefinitionChars(categories.toolResults.chars, activeToolInvocationCount)
    );
    if (implicitToolDefinitionChars > 0) {
      categories.toolResults.chars -= implicitToolDefinitionChars;
      categories.toolDefinitions.chars += implicitToolDefinitionChars;
      categories.toolDefinitions.rows += 1;
    }
  }

  for (const bucket of Object.values(categories)) {
    bucket.estimatedTokens = estimateTokens(bucket.chars);
  }

  const observedPromptChars = Object.values(categories).reduce((sum, bucket) => sum + bucket.chars, 0);
  const observedPromptTokens = Object.values(categories).reduce((sum, bucket) => sum + bucket.estimatedTokens, 0);
  const reservedResponseTokens = clampNonNegative(options.reservedResponseTokens ?? 0, 0, DEFAULT_ASSUMED_WINDOW_TOKENS);
  const assumedWindowTokens = clampPositive(options.assumedWindowTokens ?? DEFAULT_ASSUMED_WINDOW_TOKENS, DEFAULT_ASSUMED_WINDOW_TOKENS, 2_000_000);
  const estimatedTotalWithReserveTokens = observedPromptTokens + reservedResponseTokens;
  const utilizationRatio = estimatedTotalWithReserveTokens / assumedWindowTokens;
  const signals: string[] = [];
  if (requestFamilyIndex >= 0) {
    signals.push(
      `Estimate is bounded to the active persisted request families; current active tail = ${activeRequestFamilies || 0} ${activeRequestFamilies === 1 ? "family" : "families"} (cap ${Math.min(DEFAULT_ACTIVE_REQUEST_FAMILY_WINDOW, requestFamilyIndex + 1)}) instead of full-session accumulation.`
    );
    if (compactionBoundaryApplied) {
      signals.push("Latest persisted conversation compaction is treated as an active-context boundary.");
    } else if (afterLatestCompact) {
      signals.push("Requested latest-compaction scoping could not be applied because no persisted compaction boundary was found; estimate falls back to the bounded active request tail.");
    }
    if (latestRequestFamiliesLimit !== undefined) {
      signals.push(`Requested latestRequestFamilies limit: ${latestRequestFamiliesLimit}.`);
    }
    signals.push(
      "Tool definitions include a bounded proxy derived from recent tool/runtime load because full tool schemas are not persisted in the session artifact."
    );
  }
  if (reservedResponseTokens === 0) {
    signals.push("Reserved response budget is not persisted; totals are a lower-bound estimate.");
  }
  if (categories.toolResults.estimatedTokens > categories.messages.estimatedTokens) {
    signals.push("Tool and runtime results outweigh visible message text in the persisted session.");
  }
  if (categories.unknown.estimatedTokens > Math.max(estimateTokens(1), Math.floor(observedPromptTokens * 0.2))) {
    signals.push("Unknown or unclassified content is non-trivial; heuristics may need refinement.");
  }
  if (categories.systemInstructions.rows === 0 && categories.toolDefinitions.rows === 0) {
    signals.push("System instructions and tool definitions were not directly recoverable from the persisted carriers used by this heuristic.");
  }

  const activity = classifySessionActivity({
    includedRows,
    latestUserMessage,
    latestRequest,
    pendingRequestCount,
    requestCount,
    responseCount,
    resultCount,
    toolInvocationCount
  });
  signals.unshift(`Session classification: ${describeSessionActivityKind(activity.kind)}. ${activity.summary}`);

  return {
    candidate,
    includeNoise: Boolean(options.includeNoise),
    exactUiParity: false,
    activityKind: activity.kind,
    activitySummary: activity.summary,
    tokenHeuristic: "Approximate tokens = ceil(chars / 4)",
    totalRows,
    includedRows,
    activeRows,
    activeRequestFamilies,
    categories,
    observedPromptChars,
    observedPromptTokens,
    reservedResponseTokens,
    assumedWindowTokens,
    estimatedTotalWithReserveTokens,
    utilizationRatio,
    pressureLevel: pressureLevelFromRatio(utilizationRatio),
    signals,
    afterLatestCompact,
    latestRequestFamiliesLimit,
    compactionBoundaryApplied
  };
}

export async function buildProfile(options: ProfileOptions): Promise<SessionProfileResult> {
  const snapshot = await buildSnapshot(options);
  const contextEstimate = await buildContextEstimate(options);
  return {
    snapshot,
    contextEstimate,
    findings: summarizeFindings(snapshot, contextEstimate)
  };
}

export async function buildSurvey(options: SurveyOptions): Promise<SessionSurveyResult> {
  const limit = clampPositive(options.limit, 5, MAX_SURVEY_LIMIT);
  const candidates = await discoverSessions(options.storageRoots ?? []);
  const selected = candidates.slice(0, limit);
  const items: SessionSurveyItem[] = [];
  const reservedResponseTokens = clampNonNegative(options.reservedResponseTokens ?? 0, 0, DEFAULT_ASSUMED_WINDOW_TOKENS);
  const assumedWindowTokens = clampPositive(options.assumedWindowTokens ?? DEFAULT_ASSUMED_WINDOW_TOKENS, DEFAULT_ASSUMED_WINDOW_TOKENS, 2_000_000);
  for (const candidate of selected) {
    const selector: SessionSelector = { sessionFile: candidate.jsonlPath };
    const snapshot = await buildSnapshot({ ...selector, includeNoise: options.includeNoise });
    const contextEstimate = await buildContextEstimate({
      ...selector,
      includeNoise: options.includeNoise,
      reservedResponseTokens,
      assumedWindowTokens
    });
    items.push({
      candidate,
      activityKind: snapshot.activityKind,
      latestTimestamp: snapshot.latestTimestamp,
      latestUserMessage: snapshot.latestUserMessage?.preview,
      activeRequestFamilies: contextEstimate.activeRequestFamilies,
      pendingRequestCount: snapshot.pendingRequestCount,
      requestCount: snapshot.requestCount,
      toolInvocationCount: snapshot.toolInvocationCount,
      contextPressure: contextEstimate.pressureLevel,
      utilizationRatio: contextEstimate.utilizationRatio,
      topSignals: summarizeFindings(snapshot, contextEstimate).slice(0, 2).map((item) => item.summary)
    });
  }
  return {
    includeNoise: Boolean(options.includeNoise),
    reservedResponseTokens,
    assumedWindowTokens,
    items
  };
}

export function renderListText(candidates: SessionCandidate[], limit: number, options: RenderBudgetOptions = {}): string {
  const safeLimit = clampPositive(limit, 10, MAX_LIST_LIMIT);
  const lines = candidates.slice(0, safeLimit).map((candidate) => {
    const ts = new Date(candidate.mtime).toISOString().replace(".000Z", "");
    const label = candidate.title && candidate.title !== candidate.sessionId
      ? `${candidate.title}\t${candidate.sessionId}`
      : candidate.sessionId;
    return `${label}\t${ts}\t${candidate.size}\t${candidate.jsonlPath}`;
  });
  return renderWithinBudget(lines, options.maxChars, [
    "",
    "# Safety Limit",
    `# Output truncated to stay within the ${effectiveOutputBudget(options.maxChars)}-character safety budget.`
  ]).trimEnd();
}

export function renderIndexMarkdown(result: IndexResult, options: RenderBudgetOptions = {}): string {
  const { candidate, entries } = result;
  const lines = [
    "# Session Index",
    "",
    "## Scope",
    `- Session ID: ${candidate.sessionId}`,
    `- Session file: ${normalizeSource(candidate.jsonlPath)}`,
    `- Entries: ${entries.length}`,
    "",
    "## Records"
  ];
  for (const entry of entries) {
    lines.push(
      `- L${entry.lineNo} | kind=${String(entry.kind ?? "-")} | k=${entry.keyPath} | ts=${entry.timestamp ?? "-"} | requestId=${entry.requestId ?? "-"} | preview=${entry.preview}`
    );
  }
  const budget = effectiveOutputBudget(options.maxChars);
  return renderWithinBudget(lines, budget, [
    "",
    "## Safety Limit",
    `- Output truncated to stay within the ${budget}-character safety budget.`,
    "- Narrow the query further or lower the record count for a smaller result."
  ]);
}

export function renderWindowMarkdown(result: WindowResult, options: RenderBudgetOptions = {}): string {
  const { candidate, anchorText, anchorOccurrence, before, after, matches, afterLatestCompact, compactionBoundaryLine } = result;
  const lines = [
    "# Session Window",
    "",
    "## Scope",
    `- Session ID: ${candidate.sessionId}`,
    `- Session file: ${normalizeSource(candidate.jsonlPath)}`,
    `- Anchor text: ${anchorText ?? "latest compaction boundary"}`,
    anchorOccurrence ? `- Anchor occurrence: ${anchorOccurrence}` : undefined,
    `- After latest compact: ${afterLatestCompact ? "yes" : "no"}`,
    compactionBoundaryLine !== undefined ? `- Latest compaction boundary line: ${compactionBoundaryLine}` : undefined,
    `- Context: ${before} records before and ${after} records after each match`,
    `- Match count: ${matches.length}`
  ].filter((line): line is string => Boolean(line));
  matches.forEach((match, index) => {
    lines.push("", `## Match ${index + 1}`);
    for (const entry of match) {
      lines.push(
        `- L${entry.lineNo} | kind=${String(entry.kind ?? "-")} | k=${entry.keyPath} | ts=${entry.timestamp ?? "-"} | requestId=${entry.requestId ?? "-"} | preview=${entry.preview}`
      );
    }
  });
  const budget = effectiveOutputBudget(options.maxChars);
  return renderWithinBudget(lines, budget, [
    "",
    "## Safety Limit",
    `- Output truncated to stay within the ${budget}-character safety budget.`,
    "- Reduce before/after or maxMatches for a tighter window."
  ]);
}

export function renderExportMarkdown(result: ExportResult): string {
  const { candidate, entries, includeNoise } = result;
  const lines = [
    "# Session Export",
    "",
    "## Scope",
    `- Session ID: ${candidate.sessionId}`,
    `- Session file: ${normalizeSource(candidate.jsonlPath)}`,
    `- Records: ${entries.length}`,
    `- Noise filtering: ${includeNoise ? "included" : "filtered"}`,
    "",
    "## Records"
  ];
  for (const entry of entries) {
    lines.push(
      `- L${entry.lineNo} | kind=${String(entry.kind ?? "-")} | k=${entry.keyPath} | ts=${entry.timestamp ?? "-"} | requestId=${entry.requestId ?? "-"} | preview=${entry.preview}`
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderTranscriptEvidenceMarkdown(result: TranscriptEvidenceResult, options: RenderBudgetOptions = {}): string {
  const detailLevel = options.detailLevel ?? "full";
  if (!result.transcriptAvailable) {
    if (detailLevel === "summary") {
      const lines = [
        "# Session-Derived Evidence",
        "",
        "## Summary",
        `- ${result.unavailableReason ?? "Canonical transcript artifact was unavailable, so session-derived evidence is summarized below."}`,
        `- Session ID: ${result.candidate.sessionId}`,
        `- Session file: ${normalizeSource(result.candidate.jsonlPath)}`,
        `- Supplementary resource directory present: ${result.supplementaryResourcePath ? "yes" : "no"}`,
        "- Request detailLevel=full when you need the embedded snapshot/index fallback sections instead of this compact summary."
      ];

      if (result.attemptedPaths && result.attemptedPaths.length > 0) {
        lines.push("", "## Checked Paths", ...result.attemptedPaths.map((candidatePath) => `- ${normalizeSource(candidatePath)}`));
      }

      if (result.fallbackSnapshot) {
        lines.push("", "## Persisted Session Summary", ...compactSnapshotLines(result.fallbackSnapshot));
      }

      if (result.fallbackIndex && result.fallbackIndex.entries.length > 0) {
        lines.push(
          "",
          "## Recent Persisted Rows",
          ...result.fallbackIndex.entries.slice(0, 5).map((entry) =>
            `- L${entry.lineNo} | kind=${String(entry.kind ?? "-")} | k=${entry.keyPath} | preview=${entry.preview}`
          )
        );
      }

      lines.push(
        "",
        "## Omissions / Limits",
        ...result.omissions.map((omission) => `- ${omission}`),
        "",
        "## Provenance Summary",
        "- This compact view is derived from the persisted session JSONL because no usable canonical transcript artifact was available.",
        "- It preserves the checked transcript paths and a bounded fallback summary without embedding the full snapshot/index sections."
      );

      const budget = effectiveOutputBudget(options.maxChars);
      return renderWithinBudget(lines, budget, [
        "",
        "## Safety Limit",
        `- Session-derived evidence summary truncated to stay within the ${budget}-character safety budget.`
      ]);
    }

    const lines = [
      "# Session-Derived Evidence",
      "",
      "## Summary",
      `- ${result.unavailableReason ?? "Canonical transcript artifact was unavailable, so session-derived evidence is shown below."}`,
      `- Session ID: ${result.candidate.sessionId}`,
      `- Session file: ${normalizeSource(result.candidate.jsonlPath)}`
    ];

    lines.push(
      "- Current upstream evidence suggests canonical transcript files are hook-gated rather than the default persistence path for ordinary live sessions.",
      "- For ordinary live sessions, persisted session JSONL is typically the reliable source of truth when no usable canonical transcript artifact exists."
    );

    if (result.supplementaryResourcePath) {
      lines.push(
        `- Supplementary chat-session-resources were observed at ${normalizeSource(result.supplementaryResourcePath)}.`
      );
    }

    if (result.attemptedPaths && result.attemptedPaths.length > 0) {
      lines.push("", "## Checked Paths", ...result.attemptedPaths.map((candidatePath) => `- ${normalizeSource(candidatePath)}`));
    }

    lines.push(
      ...[
        `- After latest compact: ${result.afterLatestCompact ? "yes" : "no"}`,
        result.anchorText ? `- Anchor text: ${result.anchorText}` : undefined,
        result.anchorText ? `- Anchor occurrence: ${result.anchorOccurrence ?? "first"}` : undefined,
        result.maxBlocks !== undefined ? `- Max rows requested after filter: ${result.maxBlocks}` : undefined
      ].filter((line): line is string => Boolean(line))
    );

    lines.push(
      "",
      "## Persisted Session Evidence",
      "- The sections below are derived directly from the persisted session JSONL and are provided as a bounded fallback when no usable canonical transcript artifact is available."
    );

    if (result.fallbackSnapshot) {
      lines.push("", shiftMarkdownHeadings(renderSnapshotMarkdown(result.fallbackSnapshot).trimEnd(), 2));
    }
    if (result.fallbackWindow) {
      lines.push("", shiftMarkdownHeadings(renderWindowMarkdown(result.fallbackWindow).trimEnd(), 2));
    }
    if (result.fallbackIndex) {
      lines.push("", shiftMarkdownHeadings(renderIndexMarkdown(result.fallbackIndex).trimEnd(), 2));
    }

    lines.push(
      "",
      "## Omissions / Limits",
      ...result.omissions.map((omission) => `- ${omission}`),
      result.supplementaryResourcePath
        ? "- chat-session-resources can hold spilled payloads such as large tool results, but they are not treated as canonical transcript rows by this renderer."
        : "- No supplementary chat-session-resources directory was observed for this session.",
      "",
      "## Provenance Summary",
      "- This evidence view is derived from the persisted session JSONL rather than a usable canonical transcript artifact.",
      "- Session Snapshot and Session Index sections are rendered from the same stored session file used elsewhere in the tooling.",
      "- If VS Code later persists a transcript artifact for this session, the canonical transcript view will replace this session-derived view automatically."
    );

    return `${lines.join("\n")}\n`;
  }

  const transcriptPath = result.transcriptPath ?? result.selectorPath ?? result.candidate.jsonlPath;

  if (detailLevel === "summary") {
    const lines = [
      "# Evidence Transcript",
      "",
      "## Scope",
      `- Session ID: ${result.candidate.sessionId}`,
      `- Transcript file: ${normalizeSource(transcriptPath)}`,
      `- After latest compact: ${result.afterLatestCompact ? "yes" : "no"}`,
      result.anchorText ? `- Anchor text: ${result.anchorText}` : undefined,
      result.anchorText ? `- Anchor occurrence: ${result.anchorOccurrence ?? "first"}` : undefined,
      result.maxBlocks !== undefined ? `- Max blocks: ${result.maxBlocks}` : undefined,
      `- Transcript rows scanned: ${result.totalRows}`,
      `- Evidence blocks emitted: ${result.blocks.length}`,
      "- Request detailLevel=full when you need verbatim payload contents instead of the compact block inventory below.",
      "",
      "## Evidence Block Inventory"
    ].filter((line): line is string => Boolean(line));

    if (result.blocks.length === 0) {
      lines.push("- No evidence blocks were emitted from the transcript artifact.");
    } else {
      for (const block of result.blocks) {
        lines.push(
          [
            `- ${block.id}`,
            block.heading,
            `flow=${block.flow}`,
            `parent=${block.parent}`,
            block.tool ? `tool=${block.tool}` : undefined,
            block.timestamp ? `ts=${block.timestamp}` : undefined,
            `source=${block.source}`,
            summarizeEvidencePayloads(block.payloads)
          ].filter(Boolean).join(" | ")
        );
      }
    }

    lines.push("", "## Omissions / Limits");
    if (result.omissions.length === 0) {
      lines.push("- No additional omissions or reconstruction limits were detected for this transcript export.");
    } else {
      for (const omission of result.omissions) {
        lines.push(`- ${omission}`);
      }
    }

    lines.push(
      "",
      "## Provenance Summary",
      "- Each inventory row identifies one evidence block plus its source row and a short payload preview.",
      "- Verbatim payload bodies are intentionally omitted from this compact view to reduce inline context pressure."
    );

    const budget = effectiveOutputBudget(options.maxChars);
    return renderWithinBudget(lines, budget, [
      "",
      "## Safety Limit",
      `- Evidence transcript summary truncated to stay within the ${budget}-character safety budget.`
    ]);
  }

  const lines = [
    "# Evidence Transcript",
    "",
    "## Scope",
    `- Session ID: ${result.candidate.sessionId}`,
    `- Transcript file: ${normalizeSource(transcriptPath)}`,
    `- After latest compact: ${result.afterLatestCompact ? "yes" : "no"}`,
    result.anchorText ? `- Anchor text: ${result.anchorText}` : undefined,
    result.anchorText ? `- Anchor occurrence: ${result.anchorOccurrence ?? "first"}` : undefined,
    result.maxBlocks !== undefined ? `- Max blocks: ${result.maxBlocks}` : undefined,
    `- Requested window: full transcript file`,
    `- Anchor rule: transcript file order`,
    `- Descendant flows: included only when directly evidenced by transcript parent linkage or stored bundled tool-request payloads`,
    `- Artifact families used: ${normalizeSource(transcriptPath)}`,
    `- Transcript rows scanned: ${result.totalRows}`,
    `- Evidence blocks emitted: ${result.blocks.length}`
  ].filter((line): line is string => Boolean(line));

  if (result.selectorPath && result.selectorPath !== result.transcriptPath) {
    lines.push(`- Selector session file: ${normalizeSource(result.selectorPath)}`);
  }

  result.blocks.forEach((block, index) => {
    lines.push(
      "",
      `## ${block.heading}`,
      `**ID:** ${block.id}`,
      `**Flow:** ${block.flow}`,
      `**Parent:** ${block.parent}`,
      `**Source:** ${block.source}`,
      "**Verbatim:** yes"
    );
    if (block.tool) {
      lines.push(`**Tool:** ${block.tool}`);
    }
    if (block.timestamp) {
      lines.push(`**Timestamp:** ${block.timestamp}`);
    }
    for (const payload of block.payloads) {
      if (payload.label) {
        lines.push(`### ${payload.label}`);
      }
      const ticks = codeFenceTicks(payload.content);
      lines.push(`${ticks}${payload.language}`, payload.content, ticks);
    }
    if (index < result.blocks.length - 1) {
      lines.push("", "---");
    }
  });

  lines.push("", "## Omissions / Limits");
  if (result.omissions.length === 0) {
    lines.push("- No additional omissions or reconstruction limits were detected for this transcript export.");
  } else {
    for (const omission of result.omissions) {
      lines.push(`- ${omission}`);
    }
  }

  lines.push(
    "",
    "## Provenance Summary",
    "- Each block is one atomic evidence unit recovered from the persisted transcript file or a directly stored bundled tool-request payload.",
    "- Parent identifies the nearest direct origin block that was explicitly recoverable from transcript linkage.",
    "- Source names the persisted transcript row that carried the payload.",
    "- Verbatim yes means payload text was copied from stored transcript fields without paraphrase."
  );

  return `${lines.join("\n")}\n`;
}

export function renderSnapshotMarkdown(result: SnapshotResult, options: RenderBudgetOptions = {}): string {
  const lines = [
    "# Session Snapshot",
    "",
    "## Scope",
    `- Session ID: ${result.candidate.sessionId}`,
    `- Session file: ${normalizeSource(result.candidate.jsonlPath)}`,
    `- Noise filtering: ${result.includeNoise ? "included" : "filtered"}`,
    `- Rows scanned: ${result.totalRows}`,
    `- Rows included: ${result.includedRows}`,
    `- Session classification: ${describeSessionActivityKind(result.activityKind)}`,
    `- Latest persisted timestamp: ${result.latestTimestamp ?? "-"}`,
    "",
    "## Current Signals",
    `- Pending requests: ${result.pendingRequestCount}`,
    `- Request batches: ${result.requestCount}`,
    `- Assistant result rows: ${result.resultCount}`,
    `- Tool/runtime response rows: ${result.responseCount}`,
    `- Tool invocation rows: ${result.toolInvocationCount}`,
    `- Parse errors: ${result.parseErrorCount}`,
    `- Assessment: ${result.activitySummary}`,
    "",
    "## Persisted Selection State",
    `- Input mode id: ${result.persistedSelection.inputModeId ?? "-"}`,
    `- Input mode kind: ${result.persistedSelection.inputModeKind ?? "-"}`,
    `- Selected model id: ${result.persistedSelection.selectedModelId ?? "-"}`,
    `- Selected model name: ${result.persistedSelection.selectedModelName ?? "-"}`,
    `- Latest request id: ${result.persistedSelection.latestRequestId ?? "-"}`,
    `- Latest request agent id: ${result.persistedSelection.latestRequestAgentId ?? "-"}`,
    `- Latest request agent name: ${result.persistedSelection.latestRequestAgentName ?? "-"}`,
    `- Latest request model id: ${result.persistedSelection.latestRequestModelId ?? "-"}`,
    `- Latest request mode id: ${result.persistedSelection.latestRequestModeId ?? "-"}`,
    `- Latest request mode name: ${result.persistedSelection.latestRequestModeName ?? "-"}`,
    "",
    "## Latest Visible Items",
    `- Latest user message: ${result.latestUserMessage?.preview ?? "-"}`,
    `- Latest request preview: ${result.latestRequest?.preview ?? "-"}`,
    `- Latest assistant result: ${result.latestAssistantMessage?.preview ?? "-"}`,
    `- Latest tool activity: ${result.latestToolActivity?.preview ?? "-"}`
  ];
  if (result.pendingRequestIds.length > 0) {
    lines.push(`- Pending request IDs: ${summarizePendingRequestIds(result.pendingRequestIds)}`);
  }
  lines.push(
    "",
    "## Notes",
    "- Snapshot is derived from persisted session artifacts and can lag behind live UI state.",
    "- Persisted selection state is derived from root session state plus later persisted delta rows when present."
  );
  const budget = effectiveOutputBudget(options.maxChars);
  return renderWithinBudget(lines, budget, [
    "",
    "## Safety Limit",
    `- Snapshot truncated to stay within the ${budget}-character safety budget.`
  ]);
}

export function renderContextEstimateMarkdown(result: ContextEstimateResult, options: RenderBudgetOptions = {}): string {
  const detailLevel = options.detailLevel ?? "full";
  const categoryLabels: Record<ContextCategoryName, string> = {
    systemInstructions: "System instructions",
    toolDefinitions: "Tool definitions",
    userContext: "User context",
    messages: "Messages",
    files: "Files",
    toolResults: "Tool/runtime results",
    unknown: "Unknown / unclassified"
  };

  if (detailLevel === "summary") {
    const rankedCategories = (Object.keys(categoryLabels) as ContextCategoryName[])
      .map((category) => ({ category, bucket: result.categories[category] }))
      .filter(({ bucket }) => bucket.estimatedTokens > 0)
      .sort((left, right) => right.bucket.estimatedTokens - left.bucket.estimatedTokens)
      .slice(0, 3);

    const lines = [
      "# Context Estimate",
      "",
      "## Scope",
      `- Session ID: ${result.candidate.sessionId}`,
      `- Session file: ${normalizeSource(result.candidate.jsonlPath)}`,
      `- Session classification: ${describeSessionActivityKind(result.activityKind)}`,
      `- Noise filtering: ${result.includeNoise ? "included" : "filtered"}`,
      `- After latest compact: ${result.afterLatestCompact ? "yes" : "no"}`,
      `- Compaction boundary applied: ${result.compactionBoundaryApplied ? "yes" : result.afterLatestCompact ? "no (fell back to bounded active tail)" : "not requested"}`,
      result.latestRequestFamiliesLimit !== undefined ? `- Latest request families limit: ${result.latestRequestFamiliesLimit}` : undefined,
      `- Active request families: ${result.activeRequestFamilies || "fallback"}`,
      "",
      "## Totals",
      `- Observed prompt tokens: ${result.observedPromptTokens}`,
      `- Reserved response tokens: ${result.reservedResponseTokens}`,
      `- Estimated total with reserve: ${result.estimatedTotalWithReserveTokens}`,
      `- Estimated utilization: ${(result.utilizationRatio * 100).toFixed(1)}%`,
      `- Context pressure: ${result.pressureLevel}`,
      "",
      "## Top Contributors"
    ].filter((line): line is string => Boolean(line));

    if (rankedCategories.length === 0) {
      lines.push("- No non-zero context categories were detected in the bounded estimate.");
    } else {
      for (const { category, bucket } of rankedCategories) {
        lines.push(`- ${categoryLabels[category]}: estTokens=${bucket.estimatedTokens} | chars=${bucket.chars} | rows=${bucket.rows}`);
      }
    }

    lines.push("", "## Signals");
    if (result.signals.length === 0) {
      lines.push("- No obvious pressure or classification issues were detected.");
    } else {
      for (const signal of result.signals.slice(0, 3)) {
        lines.push(`- ${signal}`);
      }
      if (result.signals.length > 3) {
        lines.push(`- +${result.signals.length - 3} more signal(s); request detailLevel=full for the complete list.`);
      }
    }

    const budget = effectiveOutputBudget(options.maxChars);
    return renderWithinBudget(lines, budget, [
      "",
      "## Safety Limit",
      `- Context estimate summary truncated to stay within the ${budget}-character safety budget.`
    ]);
  }

  const lines = [
    "# Context Estimate",
    "",
    "## Scope",
    `- Session ID: ${result.candidate.sessionId}`,
    `- Session file: ${normalizeSource(result.candidate.jsonlPath)}`,
    `- Exact UI parity: ${result.exactUiParity ? "yes" : "no"}`,
    `- Session classification: ${describeSessionActivityKind(result.activityKind)}`,
    `- Noise filtering: ${result.includeNoise ? "included" : "filtered"}`,
    `- After latest compact: ${result.afterLatestCompact ? "yes" : "no"}`,
    `- Compaction boundary applied: ${result.compactionBoundaryApplied ? "yes" : result.afterLatestCompact ? "no (fell back to bounded active tail)" : "not requested"}`,
    result.latestRequestFamiliesLimit !== undefined ? `- Latest request families limit: ${result.latestRequestFamiliesLimit}` : undefined,
    `- Token heuristic: ${result.tokenHeuristic}`,
    `- Rows scanned: ${result.totalRows}`,
    `- Rows included: ${result.includedRows}`,
    `- Active rows used: ${result.activeRows}`,
    `- Active request families: ${result.activeRequestFamilies || "fallback"}`,
    "",
    "## Estimated Breakdown"
  ].filter((line): line is string => Boolean(line));
  (Object.keys(categoryLabels) as ContextCategoryName[]).forEach((category) => {
    const bucket = result.categories[category];
    lines.push(`- ${categoryLabels[category]}: chars=${bucket.chars} | estTokens=${bucket.estimatedTokens} | rows=${bucket.rows}`);
  });
  lines.push(
    "",
    "## Totals",
    `- Observed prompt chars: ${result.observedPromptChars}`,
    `- Observed prompt tokens: ${result.observedPromptTokens}`,
    `- Reserved response tokens: ${result.reservedResponseTokens}`,
    `- Assumed context window: ${result.assumedWindowTokens}`,
    `- Estimated total with reserve: ${result.estimatedTotalWithReserveTokens}`,
    `- Estimated utilization: ${(result.utilizationRatio * 100).toFixed(1)}%`,
    `- Context pressure: ${result.pressureLevel}`,
    "",
    "## Signals"
  );
  if (result.signals.length === 0) {
    lines.push("- No obvious pressure or classification issues were detected.");
  } else {
    for (const signal of result.signals) {
      lines.push(`- ${signal}`);
    }
  }
  const budget = effectiveOutputBudget(options.maxChars);
  return renderWithinBudget(lines, budget, [
    "",
    "## Safety Limit",
    `- Context estimate truncated to stay within the ${budget}-character safety budget.`
  ]);
}

export function renderProfileMarkdown(result: SessionProfileResult, options: RenderBudgetOptions = {}): string {
  const { snapshot, contextEstimate, findings } = result;
  const lines = [
    "# Session Profile",
    "",
    "## Findings"
  ];
  for (const finding of findings) {
    lines.push(`- [${finding.severity}] ${finding.summary}`);
  }
  lines.push(
    "",
    "## Scope",
    `- Session ID: ${snapshot.candidate.sessionId}`,
    `- Session title: ${snapshot.candidate.title ?? "-"}`,
    `- Session file: ${normalizeSource(snapshot.candidate.jsonlPath)}`,
    `- Session classification: ${describeSessionActivityKind(snapshot.activityKind)}`,
    `- Latest persisted timestamp: ${snapshot.latestTimestamp ?? "-"}`,
    `- Context pressure: ${contextEstimate.pressureLevel}`,
    `- Estimated utilization: ${(contextEstimate.utilizationRatio * 100).toFixed(1)}%`,
    `- Active request families: ${contextEstimate.activeRequestFamilies || 0}`,
    `- Active rows used: ${contextEstimate.activeRows}`,
    `- Pending requests: ${snapshot.pendingRequestCount}`,
    `- Tool invocation rows: ${snapshot.toolInvocationCount}`,
    `- Latest user message: ${snapshot.latestUserMessage?.preview ?? "-"}`
  );
  const budget = effectiveOutputBudget(options.maxChars);
  return renderWithinBudget(lines, budget, [
    "",
    "## Safety Limit",
    `- Profile truncated to stay within the ${budget}-character safety budget.`
  ]);
}

export function renderSurveyMarkdown(result: SessionSurveyResult, options: RenderBudgetOptions = {}): string {
  const lines = [
    "# Session Survey",
    "",
    "## Scope",
    `- Sessions included: ${result.items.length}`,
    `- Noise filtering: ${result.includeNoise ? "included" : "filtered"}`,
    `- Reserved response tokens: ${result.reservedResponseTokens}`,
    `- Assumed context window: ${result.assumedWindowTokens}`,
    "",
    "## Sessions"
  ];
  result.items.forEach((item, index) => {
    const label = item.candidate.title && item.candidate.title !== item.candidate.sessionId
      ? `${item.candidate.title} | ${item.candidate.sessionId}`
      : item.candidate.sessionId;
    lines.push(
      `- ${index + 1}. ${label} | class=${describeSessionActivityKind(item.activityKind)} | pressure=${item.contextPressure} | util=${(item.utilizationRatio * 100).toFixed(1)}% | activeFamilies=${item.activeRequestFamilies || 0} | pending=${item.pendingRequestCount} | requests=${item.requestCount} | tools=${item.toolInvocationCount}`,
      `  latestTs=${item.latestTimestamp ?? "-"}`,
      `  latestUser=${item.latestUserMessage ?? "-"}`
    );
    for (const signal of item.topSignals) {
      lines.push(`  signal=${signal}`);
    }
  });
  const budget = effectiveOutputBudget(options.maxChars);
  return renderWithinBudget(lines, budget, [
    "",
    "## Safety Limit",
    `- Survey truncated to stay within the ${budget}-character safety budget.`
  ]);
}

export async function deliverRenderedOutput(content: string, options: DeliveryOptions): Promise<DeliveryResult> {
  const maxInlineChars = effectiveOutputBudget(options.maxInlineChars);
  let writtenFile: string | undefined;

  if (usesFileDelivery(options.mode)) {
    if (!options.outputFile) {
      throw new Error(`outputFile is required when mode=${options.mode}`);
    }
    writtenFile = validateOutputFilePath(options.outputFile);
    await fs.mkdir(path.dirname(writtenFile), { recursive: true });
    await fs.writeFile(writtenFile, content, "utf-8");
  }

  const inlineIncluded = options.mode !== "file-only" && content.length <= maxInlineChars;
  if (inlineIncluded) {
    return {
      responseText: content,
      inlineIncluded: true,
      outputFile: writtenFile,
      contentChars: content.length,
      maxInlineChars
    };
  }

  const lines = [
    "# Output Delivery",
    "",
    "## Scope",
    `- Mode: ${options.mode}`,
    `- Content chars: ${content.length}`,
    `- Max inline chars: ${maxInlineChars}`
  ];
  if (writtenFile) {
    lines.push(`- Saved file: ${writtenFile}`);
  }
  lines.push("", "## Outcome");
  if (options.mode === "file-only") {
    lines.push("- Content saved to file only.");
  } else if (writtenFile) {
    lines.push("- Inline content omitted because it exceeded the max inline threshold; file was still written.");
  } else {
    lines.push("- Inline content omitted because it exceeded the max inline threshold.");
    lines.push("- Rerun with file-only or file-and-inline-if-safe to persist the full markdown.");
  }

  return {
    responseText: `${lines.join("\n")}\n`,
    inlineIncluded: false,
    outputFile: writtenFile,
    contentChars: content.length,
    maxInlineChars
  };
}

export function normalizeSource(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (isPathWithin(WORKSPACE_ROOT, resolved)) {
    return path.relative(WORKSPACE_ROOT, resolved).replace(/\\/g, "/");
  }
  const normalized = filePath.replace(/\\/g, "/");
  const workspaceStorageMarker = "/workspaceStorage/";
  const workspaceStorageIndex = normalized.indexOf(workspaceStorageMarker);
  if (workspaceStorageIndex >= 0) {
    return normalized.slice(workspaceStorageIndex + 1);
  }
  for (const marker of ["/chatSessions/", "/chatEditingSessions/", "/transcripts/", "chatSessions/", "chatEditingSessions/", "transcripts/"]) {
    const index = normalized.indexOf(marker);
    if (index >= 0) {
      return normalized[index] === "/" ? normalized.slice(index + 1) : normalized.slice(index);
    }
  }
  return normalized;
}
