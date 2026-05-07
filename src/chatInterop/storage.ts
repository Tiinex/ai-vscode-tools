import type { Stats } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { loadWorkspaceSessionIndex, pruneWorkspaceSessionState, type WorkspaceSessionIndexEntry } from "../sessionIndex";
import { parsePromptDispatchAgent } from "./promptDispatch";
import { ChatArtifactDeletionReport, ChatInteropOptions, ChatSessionSummary } from "./types";

interface SessionContainer {
  provider: "workspaceStorage" | "emptyWindow";
  workspaceId?: string;
  sessionFile: string;
  indexEntry?: WorkspaceSessionIndexEntry;
}

interface ParsedMetadata {
  title?: string;
  mode?: string;
  agent?: string;
  requestAgentId?: string;
  requestAgentName?: string;
  model?: string;
  hasControlThreadArtifacts?: boolean;
  controlThreadArtifactKinds?: string[];
  hasPendingEdits?: boolean;
  pendingRequestCount?: number;
  lastRequestCompleted?: boolean;
  archived?: boolean;
  updatedAt?: string;
}

interface SessionDeltaState {
  inputMode?: any;
  selectedModel?: any;
  hasPendingEdits?: boolean;
  pendingRequests?: any[];
}

export class ChatSessionStorage {
  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly options: ChatInteropOptions = {}
  ) {}

  async listSessions(): Promise<ChatSessionSummary[]> {
    const containers = await this.findSessionFiles();
    const summaries = await Promise.all(containers.map(async (container) => this.readSummary(container)));

    return summaries
      .filter((item): item is ChatSessionSummary => Boolean(item))
      .filter((item) => !item.archived)
      .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
  }

  async getSessionById(sessionId: string): Promise<ChatSessionSummary | undefined> {
    const sessions = await this.listSessions();
    return sessions.find((session) => session.id === sessionId || session.id.startsWith(sessionId));
  }

  async getExactSessionById(sessionId: string): Promise<ChatSessionSummary | undefined> {
    const sessions = await this.listSessions();
    return sessions.find((session) => session.id === sessionId);
  }

  async deleteSessionArtifacts(session: ChatSessionSummary): Promise<ChatArtifactDeletionReport> {
    const attemptedPaths = this.buildArtifactPaths(session);
    const deletedPaths = new Set<string>();
    const missingPaths = new Set<string>();

    for (const artifactPath of attemptedPaths) {
      const stat = await safeStat(artifactPath);
      if (!stat) {
        missingPaths.add(artifactPath);
        continue;
      }

      await fs.rm(artifactPath, {
        recursive: stat.isDirectory(),
        force: false
      });
      deletedPaths.add(artifactPath);
    }

    if (session.provider === "workspaceStorage") {
      const workspaceStorageDir = path.dirname(path.dirname(session.sessionFile));
      await pruneWorkspaceSessionState(workspaceStorageDir, session.id);
    }

    const lingeringPaths: string[] = [];
    for (const artifactPath of attemptedPaths) {
      const stat = await safeStat(artifactPath);
      if (!stat) {
        continue;
      }

      try {
        await fs.rm(artifactPath, {
          recursive: stat.isDirectory(),
          force: false
        });
      } catch {
        // Fall through to the post-delete stat so the caller gets an exact lingering path.
      }

      const remaining = await safeStat(artifactPath);
      if (remaining) {
        lingeringPaths.push(artifactPath);
      } else {
        deletedPaths.add(artifactPath);
      }
    }

    return {
      attemptedPaths,
      deletedPaths: [...deletedPaths],
      missingPaths: [...missingPaths],
      lingeringPaths
    };
  }

  private async readSummary(container: SessionContainer): Promise<ChatSessionSummary | undefined> {
    const stats = await safeStat(container.sessionFile);
    if (!stats?.isFile()) {
      return undefined;
    }

    const metadata = await this.parseSessionMetadata(container.sessionFile);
    const id = path.basename(container.sessionFile).replace(/\.jsonl?$/i, "");
    const lastUpdated = metadata.updatedAt ?? new Date(stats.mtimeMs).toISOString();

    return {
      id,
      title: container.indexEntry?.title?.trim() || metadata.title || id,
      lastUpdated: container.indexEntry?.lastMessageDate
        ? new Date(container.indexEntry.lastMessageDate).toISOString()
        : lastUpdated,
      mode: metadata.mode,
      agent: metadata.agent,
      requestAgentId: metadata.requestAgentId,
      requestAgentName: metadata.requestAgentName,
      model: metadata.model,
      hasControlThreadArtifacts: metadata.hasControlThreadArtifacts,
      controlThreadArtifactKinds: metadata.controlThreadArtifactKinds,
      hasPendingEdits: metadata.hasPendingEdits,
      pendingRequestCount: metadata.pendingRequestCount,
      lastRequestCompleted: metadata.lastRequestCompleted,
      archived: metadata.archived === true,
      provider: container.provider,
      workspaceId: container.workspaceId,
      sessionFile: container.sessionFile
    };
  }

  private async findSessionFiles(): Promise<SessionContainer[]> {
    const containers: SessionContainer[] = [];

    for (const root of this.getWorkspaceStorageRoots()) {
      const rootStat = await safeStat(root);
      if (!rootStat?.isDirectory()) {
        continue;
      }

      const directContainers = await this.findSessionFilesInWorkspaceStorageDir(root);
      if (directContainers.length > 0) {
        containers.push(...directContainers);
        continue;
      }

      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        containers.push(...await this.findSessionFilesInWorkspaceStorageDir(path.join(root, entry.name), entry.name));
      }
    }

    for (const root of this.getEmptyWindowRoots()) {
      const rootStat = await safeStat(root);
      if (!rootStat?.isDirectory()) {
        continue;
      }

      const files = await fs.readdir(root, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".jsonl")) {
          continue;
        }

        containers.push({
          provider: "emptyWindow",
          sessionFile: path.join(root, file.name)
        });
      }
    }

    return containers;
  }

  private async findSessionFilesInWorkspaceStorageDir(storageDir: string, workspaceId?: string): Promise<SessionContainer[]> {
    const chatSessionsDir = path.join(storageDir, "chatSessions");
    const dirStat = await safeStat(chatSessionsDir);
    if (!dirStat?.isDirectory()) {
      return [];
    }

    const indexedEntries = await loadWorkspaceSessionIndex(storageDir);
    if (indexedEntries) {
      const containers: SessionContainer[] = [];
      for (const entry of indexedEntries.values()) {
        const sessionFile = path.join(chatSessionsDir, `${entry.sessionId}.jsonl`);
        const stats = await safeStat(sessionFile);
        if (!stats?.isFile()) {
          continue;
        }
        containers.push({
          provider: "workspaceStorage",
          workspaceId,
          sessionFile,
          indexEntry: entry
        });
      }
      return containers;
    }

    const files = await fs.readdir(chatSessionsDir, { withFileTypes: true });
    return files
      .filter((file) => file.isFile() && file.name.endsWith(".jsonl"))
      .map((file) => ({
        provider: "workspaceStorage" as const,
        workspaceId,
        sessionFile: path.join(chatSessionsDir, file.name)
      }));
  }

  private async parseSessionMetadata(sessionFile: string): Promise<ParsedMetadata> {
    const raw = await fs.readFile(sessionFile, "utf8");
    const controlThreadArtifactKinds = detectControlThreadArtifacts(raw);
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    let lastFullState: any | undefined;
    const requestRows: any[] = [];
    const deltaState: SessionDeltaState = {};
    let updatedAt: string | undefined;
    let archived = false;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed?.kind === 0 && parsed?.v) {
          lastFullState = parsed.v;
          requestRows.length = 0;
          if (Array.isArray(parsed.v?.requests)) {
            requestRows.push(...parsed.v.requests);
          }
          archived = archived || parsed.v?.archived === true;
          updatedAt = coerceDate(parsed.v?.updatedAt)
            ?? coerceDate(parsed.v?.lastUpdated)
            ?? coerceDate(parsed.v?.timing?.updatedAt)
            ?? updatedAt;
        } else if (parsed?.kind === 0 && parsed?.request) {
          requestRows.push(parsed.request);
          archived = archived || parsed?.archived === true;
          updatedAt = coerceDate(parsed?.updatedAt) ?? updatedAt;
        } else if (parsed?.kind === 1) {
          const key = normalizeJsonlKey(parsed?.k);
          if (key === "inputState/mode") {
            deltaState.inputMode = parsed?.v;
          } else if (key === "inputState/selectedModel") {
            deltaState.selectedModel = parsed?.v;
          } else if (key === "hasPendingEdits") {
            deltaState.hasPendingEdits = coerceBoolean(parsed?.v);
          } else if (key === "pendingRequests" && Array.isArray(parsed?.v)) {
            deltaState.pendingRequests = parsed.v;
          } else if (key?.startsWith("requests/")) {
            applyRequestDelta(requestRows, key, parsed?.v);
          }
          archived = archived || parsed?.v?.archived === true || parsed?.archived === true;
          updatedAt = coerceDate(parsed?.updatedAt) ?? updatedAt;
        } else if (parsed?.kind === 2) {
          const key = normalizeJsonlKey(parsed?.k);
          if (key === "requests" && Array.isArray(parsed?.v)) {
            requestRows.push(...parsed.v);
          } else if (key?.startsWith("requests/")) {
            applyRequestDelta(requestRows, key, parsed?.v);
          }
          updatedAt = coerceDate(parsed?.updatedAt) ?? updatedAt;
        }
      } catch {
        // Ignore malformed rows and keep going.
      }
    }

    const metadata = extractMetadata(lastFullState, requestRows, deltaState);
    return {
      ...metadata,
      hasControlThreadArtifacts: controlThreadArtifactKinds.length > 0,
      controlThreadArtifactKinds,
      archived,
      updatedAt
    };
  }

  private getWorkspaceStorageRoots(): string[] {
    if (this.options.workspaceStorageRoots?.length) {
      return this.options.workspaceStorageRoots;
    }

    return [path.join(getUserDataRoot(), "User", "workspaceStorage")];
  }

  private getEmptyWindowRoots(): string[] {
    if (this.options.emptyWindowChatRoots?.length) {
      return this.options.emptyWindowChatRoots;
    }

    return [path.join(getUserDataRoot(), "User", "globalStorage", "emptyWindowChatSessions")];
  }

  private buildArtifactPaths(session: ChatSessionSummary): string[] {
    const attemptedPaths = new Set<string>([session.sessionFile]);

    if (session.provider === "workspaceStorage") {
      const storageDir = path.dirname(path.dirname(session.sessionFile));
      attemptedPaths.add(path.join(storageDir, "chatEditingSessions", session.id));
      attemptedPaths.add(path.join(storageDir, "chatEditingSessions", `${session.id}.jsonl`));
      attemptedPaths.add(path.join(storageDir, "transcripts", `${session.id}.jsonl`));
      attemptedPaths.add(path.join(storageDir, "GitHub.copilot-chat", "transcripts", `${session.id}.jsonl`));
      attemptedPaths.add(path.join(storageDir, "GitHub.copilot-chat", "chat-session-resources", session.id));
    }

    return [...attemptedPaths];
  }
}

function extractMetadata(fullState: any | undefined, requestRows: any[], deltaState: SessionDeltaState): ParsedMetadata {
  const requestCandidates: any[] = [];

  requestCandidates.push(...requestRows);

  const lastRequest = requestCandidates.at(-1);
  const requestPayload = lastRequest?.request ?? lastRequest;
  const responsePayload = lastRequest?.response ?? lastRequest?.result?.response ?? lastRequest?.result;
  const currentInputState = {
    ...(fullState?.inputState ?? {}),
    mode: deltaState.inputMode ?? fullState?.inputState?.mode,
    selectedModel: deltaState.selectedModel ?? fullState?.inputState?.selectedModel
  };

  const title =
    firstString(
      fullState?.title,
      fullState?.label,
      fullState?.name,
      fullState?.sessionTitle,
      requestPayload?.title
    )
    ?? inferTitleFromPrompt(requestPayload);

  const mode = firstString(
    currentInputState?.mode?.id,
    currentInputState?.mode?.kind,
    requestPayload?.modeInfo?.modeInstructions?.uri?.external,
    requestPayload?.mode,
    requestPayload?.modeId,
    requestPayload?.modeName,
    requestPayload?.chatMode,
    fullState?.mode,
    fullState?.inputState?.mode?.id,
    fullState?.inputState?.mode?.kind
  );

  const inferredAgent = firstString(
    inferAgentFromModeUri(currentInputState?.mode?.id),
    inferAgentFromModeUri(requestPayload?.modeInfo?.modeInstructions?.uri?.external),
    inferAgentFromModeUri(requestPayload?.mode),
    inferAgentFromModeUri(fullState?.mode),
    inferPromptDispatchAgent(requestPayload),
    inferPromptDispatchAgent(fullState)
  );

  const agent = firstString(
    inferredAgent,
    requestPayload?.participant,
    requestPayload?.agentName,
    requestPayload?.agentId,
    requestPayload?.agent?.id,
    requestPayload?.agent?.name,
    requestPayload?.agent?.fullName,
    fullState?.participant,
    fullState?.agentName,
    fullState?.agentId,
    fullState?.agent?.id,
    fullState?.agent?.name,
    fullState?.agent?.fullName
  );

  const requestAgentId = firstString(
    requestPayload?.agent?.id,
    requestPayload?.agentId,
    requestPayload?.participant
  );

  const requestAgentName = firstString(
    requestPayload?.agent?.fullName,
    requestPayload?.agent?.name,
    requestPayload?.agentName
  );

  const model = firstString(
    currentInputState?.selectedModel?.identifier,
    requestPayload?.modelId,
    requestPayload?.model,
    requestPayload?.selectedModelId,
    requestPayload?.modelName,
    responsePayload?.modelId,
    fullState?.modelId,
    fullState?.inputState?.selectedModel?.identifier
  );

  const hasPendingEdits = deltaState.hasPendingEdits ?? coerceBoolean(fullState?.hasPendingEdits);
  const lastRequestCompleted = lastRequest ? isRequestCompleted(lastRequest) : undefined;
  const derivedPendingRequestCount = requestCandidates.filter((request) => isRequestCompleted(request) === false).length;
  const explicitPendingRequestCount = getPendingRequestCount(deltaState.pendingRequests)
    ?? getPendingRequestCount(fullState?.pendingRequests);
  const pendingRequestCount = explicitPendingRequestCount === undefined
    ? derivedPendingRequestCount
    : Math.max(explicitPendingRequestCount, derivedPendingRequestCount);

  return {
    title,
    mode,
    agent,
    requestAgentId,
    requestAgentName,
    model,
    hasPendingEdits,
    pendingRequestCount,
    lastRequestCompleted
  };
}

function detectControlThreadArtifacts(raw: string): string[] {
  const hits: string[] = [];

  if (raw.includes("<todoList>")) {
    hits.push("todoList");
  }

  if (raw.includes('"toolId":"manage_todo_list"')) {
    hits.push("manage_todo_list");
  }

  return hits;
}

function inferTitleFromPrompt(requestPayload: any): string | undefined {
  const prompt = firstString(
    requestPayload?.prompt,
    requestPayload?.message?.text,
    requestPayload?.message,
    requestPayload?.text
  );

  if (!prompt) {
    return undefined;
  }

  const normalized = prompt.replace(/\s+/g, " ").trim();
  return normalized.length <= 80 ? normalized : `${normalized.slice(0, 77)}...`;
}

function inferPromptDispatchAgent(payload: any): string | undefined {
  if (!payload) {
    return undefined;
  }

  const direct = parsePromptDispatchAgent(
    firstString(
      payload?.name,
      payload?.slashCommand,
      payload?.command,
      payload?.promptName
    )
  );
  if (direct) {
    return direct;
  }

  for (const part of asArray<any>(payload?.message?.parts)) {
    const fromPart = parsePromptDispatchAgent(firstString(part?.name, part?.command));
    if (fromPart) {
      return fromPart;
    }
  }

  for (const reference of asArray<any>(payload?.contentReferences)) {
    const fromReference = parsePromptDispatchAgent(
      firstString(
        reference?.reference?.fsPath,
        reference?.reference?.path,
        reference?.reference?.external,
        reference?.reference?.name,
        reference?.fsPath,
        reference?.path,
        reference?.external,
        reference?.name
      )
    );
    if (fromReference) {
      return fromReference;
    }
  }

  return undefined;
}

function inferAgentFromModeUri(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "file:") {
      return undefined;
    }

    const basename = path.posix.basename(parsed.pathname);
    if (!/\.agent\.md$/i.test(basename)) {
      return undefined;
    }

    return basename.replace(/\.agent\.md$/i, "");
  } catch {
    return undefined;
  }
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeJsonlKey(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value.join("/");
  }

  return typeof value === "string" ? value : undefined;
}

function coerceDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function coerceBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function applyRequestDelta(requestRows: any[], key: string, value: unknown): void {
  const segments = key.split("/");
  if (segments.length < 2 || segments[0] !== "requests") {
    return;
  }

  const requestIndex = Number(segments[1]);
  if (!Number.isInteger(requestIndex) || requestIndex < 0) {
    return;
  }

  if (segments.length === 2) {
    requestRows[requestIndex] = value;
    return;
  }

  if (!isRecord(requestRows[requestIndex])) {
    requestRows[requestIndex] = {};
  }

  setJsonPathValue(requestRows[requestIndex], segments.slice(2), value);
}

function setJsonPathValue(target: Record<string, unknown>, pathSegments: string[], value: unknown): void {
  let cursor: any = target;

  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index];
    const nextSegment = pathSegments[index + 1];
    const existing = cursor[segment];
    if (!isRecord(existing) && !Array.isArray(existing)) {
      cursor[segment] = isNumericSegment(nextSegment) ? [] : {};
    }
    cursor = cursor[segment];
  }

  cursor[pathSegments.at(-1)!] = value;
}

function isNumericSegment(value: string | undefined): boolean {
  return value !== undefined && /^\d+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequestCompleted(request: any): boolean | undefined {
  const modelState = request?.response?.modelState
    ?? request?.result?.response?.modelState
    ?? request?.result?.modelState
    ?? request?.modelState;

  if (modelState && typeof modelState === "object") {
    if (modelState.completedAt) {
      return true;
    }
    if (modelState.value === 1 || modelState.value === true || modelState.value === "completed") {
      return true;
    }
    if (modelState.value === 0 || modelState.value === false || modelState.value === "pending") {
      return false;
    }
  }

  if (request?.response || request?.result?.response || request?.result?.timings) {
    return true;
  }

  return undefined;
}

function getPendingRequestCount(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined;
}

async function safeStat(target: string): Promise<Stats | undefined> {
  try {
    return await fs.stat(target);
  } catch {
    return undefined;
  }
}

function getUserDataRoot(): string {
  if (process.platform === "linux") {
    return path.join(os.homedir(), ".config", "Code");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Code");
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new Error("APPDATA is not set");
    }

    return path.join(appData, "Code");
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}