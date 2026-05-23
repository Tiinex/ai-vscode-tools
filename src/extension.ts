import path from "node:path";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import readline from "node:readline";
import * as vscode from "vscode";
import { registerChatInterop } from "./chatInterop";
import type { ChatCommandResult, ChatInteropApi, ChatSessionSummary, CreateChatRequest } from "./chatInterop";
import { sendMessageToSession } from "./chatInterop/sessionSendWorkflow";
import { getExactDeleteSelfTargetingReason, getExactSelfTargetingReason } from "./chatInterop/selfTargetGuard";
import { SessionToolsAdapter, type SessionDescriptor } from "./coreAdapter";
import {
  FIRST_SLICE_INTERACTIVE_SURFACES_ENABLED,
  LOCAL_CHAT_CONTROL_SURFACES_ENABLED,
  LOCAL_CHAT_MUTATION_SURFACES_ENABLED,
  LOCAL_CHAT_RUNTIME_SURFACES_ENABLED
} from "./firstSlice";
import { registerLanguageModelTools } from "./languageModelTools";
import {
  buildOfflineLocalChatCleanupRelaunchRequest,
  collectRemovedTargetSessionIds,
  buildWorkspaceStorageOfflineLocalChatCleanupRequest,
  formatOfflineLocalChatCleanupSummary,
  launchOfflineLocalChatCleanup,
  writeOfflineLocalChatCleanupRelaunchRequest,
  queueOfflineLocalChatCleanupRequest,
  readQueuedOfflineLocalChatCleanupRequests,
  readAndDeleteOfflineLocalChatCleanupReports,
  type OfflineLocalChatCleanupSummary
} from "./offlineLocalChatCleanup";
import { cleanupGlobalStorageArtifacts } from "./runtimeFileHygiene";
import { findOrphanedWorkspaceSessionIndexEntries, loadWorkspaceSessionIndex } from "./sessionIndex";
import { SessionInspectorTreeDataProvider } from "./sessionInspectorTree";
import { closeVisibleEditorChatTabsForSession } from "./chatInterop/editorTabLifecycle";

const MAX_DIRECT_SESSION_FILE_OPEN_BYTES = 45 * 1024 * 1024;
const SESSION_FILE_PREVIEW_HEAD_LINES = 12;
const SESSION_FILE_PREVIEW_TAIL_LINES = 160;
const TRANSCRIPT_ARTIFACT_MISSING_CODE = "COPILOT_TRANSCRIPT_ARTIFACT_MISSING";

interface ExtensionError extends Error {
  code?: string;
  sessionId?: string;
  attemptedPaths?: string[];
}

type DiscoveryScope = "current-workspace" | "all-local";

async function openMarkdownDocument(content: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    language: "markdown",
    content
  });
  await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false
  });
}

async function maybeReportOfflineLocalChatCleanup(context: vscode.ExtensionContext): Promise<void> {
  const summary = await readAndDeleteOfflineLocalChatCleanupReports(
    context.globalStorageUri.fsPath
  );

  if (!summary) {
    return;
  }

  await reconcileOfflineLocalChatCleanupUx(summary);
}

export interface QueuedOfflineLocalChatCleanupUxReconcileResult extends OfflineLocalChatCleanupUxReconcileResult {
  requestsPath: string;
  requestCount: number;
  rearmed: boolean;
  prompted: boolean;
  quitRequested: boolean;
  relaunchQueued: boolean;
}

export interface OrphanedIndexedChatCleanupResult {
  workspaceStorageDir: string;
  orphanedSessionIds: string[];
  prompted: boolean;
  quitRequested: boolean;
  relaunchQueued: boolean;
}

async function promptForQuitAndReopenGhostChatCleanup(
  context: Pick<vscode.ExtensionContext, "globalStorageUri" | "extensionPath">,
  sessionIds: string[],
  workspaceStorageDir: string,
  options: {
    buildRelaunchRequest?: typeof buildOfflineLocalChatCleanupRelaunchRequest;
    writeRelaunchRequest?: typeof writeOfflineLocalChatCleanupRelaunchRequest;
    showWarningMessage?: (message: string, ...items: string[]) => Thenable<string | undefined>;
    executeCommand?: (command: string) => Thenable<unknown>;
  } = {}
): Promise<{ prompted: boolean; quitRequested: boolean; relaunchQueued: boolean }> {
  if (process.platform !== "win32" || sessionIds.length === 0) {
    return { prompted: false, quitRequested: false, relaunchQueued: false };
  }

  const showWarningMessage = options.showWarningMessage ?? ((message: string, ...items: string[]) => vscode.window.showWarningMessage(message, ...items));
  const executeCommand = options.executeCommand ?? ((command: string) => vscode.commands.executeCommand(command));
  const buildRelaunchRequest = options.buildRelaunchRequest ?? ((requestOptions) => buildOfflineLocalChatCleanupRelaunchRequest(requestOptions));
  const writeRelaunchRequest = options.writeRelaunchRequest ?? ((globalStorageDir, request) => writeOfflineLocalChatCleanupRelaunchRequest(globalStorageDir, request));
  const sessionLabel = sessionIds.length === 1 ? "1 ghost chat" : `${sessionIds.length} ghost chats`;
  const choice = await showWarningMessage(
    `Local chat session state looks inconsistent. ${sessionLabel} still appear in the UI but no longer have persisted session files. Quit and reopen this VS Code workspace now so exact cleanup can prune the ghost chat state?`,
    "Quit And Reopen",
    "Later"
  );

  if (choice !== "Quit And Reopen") {
    return { prompted: true, quitRequested: false, relaunchQueued: false };
  }

  for (const sessionId of sessionIds) {
    await queueOfflineLocalChatCleanupRequest(
      context.globalStorageUri.fsPath,
      buildWorkspaceStorageOfflineLocalChatCleanupRequest(workspaceStorageDir, sessionId)
    );
  }

  const relaunchRequest = buildRelaunchRequest({
    executable: process.execPath,
    workspaceFilePath: vscode.workspace.workspaceFile?.fsPath,
    workspaceFolderPaths: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
    reuseWindow: true
  });
  let relaunchQueued = false;
  if (relaunchRequest) {
    await writeRelaunchRequest(context.globalStorageUri.fsPath, relaunchRequest);
    relaunchQueued = true;
  }

  launchOfflineLocalChatCleanup({
    extensionRoot: context.extensionPath,
    globalStorageDir: context.globalStorageUri.fsPath,
    waitForPid: process.pid
  });
  await executeCommand("workbench.action.quit");
  return { prompted: true, quitRequested: true, relaunchQueued };
}

export async function detectOrphanedIndexedGhostChatsOnStartup(
  context: Pick<vscode.ExtensionContext, "globalStorageUri" | "extensionPath" | "storageUri">,
  options: {
    buildRelaunchRequest?: typeof buildOfflineLocalChatCleanupRelaunchRequest;
    writeRelaunchRequest?: typeof writeOfflineLocalChatCleanupRelaunchRequest;
    showWarningMessage?: (message: string, ...items: string[]) => Thenable<string | undefined>;
    executeCommand?: (command: string) => Thenable<unknown>;
  } = {}
): Promise<OrphanedIndexedChatCleanupResult | undefined> {
  if (!context.storageUri) {
    return undefined;
  }

  const workspaceStorageRoots = [...new Set([
    ...(currentWorkspaceStorageRoots(context as vscode.ExtensionContext) ?? []),
    path.resolve(context.storageUri.fsPath)
  ])];

  for (const workspaceStorageDir of workspaceStorageRoots) {
    const orphanedEntries = await findOrphanedWorkspaceSessionIndexEntries(workspaceStorageDir);
    if (orphanedEntries.length === 0) {
      continue;
    }

    const orphanedSessionIds = [...new Set(orphanedEntries.map((entry) => entry.sessionId).filter(Boolean))];
    const decision = await promptForQuitAndReopenGhostChatCleanup(context, orphanedSessionIds, workspaceStorageDir, options);
    return {
      workspaceStorageDir,
      orphanedSessionIds,
      prompted: decision.prompted,
      quitRequested: decision.quitRequested,
      relaunchQueued: decision.relaunchQueued
    };
  }

  return undefined;
}

export async function reconcileQueuedOfflineLocalChatCleanupUx(
  context: Pick<vscode.ExtensionContext, "globalStorageUri" | "extensionPath">,
  options: {
    launchCleanup?: typeof launchOfflineLocalChatCleanup;
    buildRelaunchRequest?: typeof buildOfflineLocalChatCleanupRelaunchRequest;
    writeRelaunchRequest?: typeof writeOfflineLocalChatCleanupRelaunchRequest;
    showWarningMessage?: (message: string, ...items: string[]) => Thenable<string | undefined>;
    executeCommand?: (command: string) => Thenable<unknown>;
    waitForPid?: number;
  } = {}
): Promise<QueuedOfflineLocalChatCleanupUxReconcileResult | undefined> {
  const queued = await readQueuedOfflineLocalChatCleanupRequests(context.globalStorageUri.fsPath);
  if (!queued) {
    return undefined;
  }

  const reconciled = await reconcileOfflineLocalChatCleanupUx({
    reportFilePaths: [],
    reports: [{ removedTargetSessionIds: queued.targetSessionIds }]
  });

  let rearmed = false;
  if (process.platform === "win32") {
    (options.launchCleanup ?? launchOfflineLocalChatCleanup)({
      extensionRoot: context.extensionPath,
      globalStorageDir: context.globalStorageUri.fsPath,
      waitForPid: options.waitForPid ?? process.pid
    });
    rearmed = true;
  }

  let prompted = false;
  let quitRequested = false;
  let relaunchQueued = false;
  if (process.platform === "win32") {
    const showWarningMessage = options.showWarningMessage ?? ((message: string, ...items: string[]) => vscode.window.showWarningMessage(message, ...items));
    const executeCommand = options.executeCommand ?? ((command: string) => vscode.commands.executeCommand(command));
    const buildRelaunchRequest = options.buildRelaunchRequest ?? ((requestOptions) => buildOfflineLocalChatCleanupRelaunchRequest(requestOptions));
    const writeRelaunchRequest = options.writeRelaunchRequest ?? ((globalStorageDir, request) => writeOfflineLocalChatCleanupRelaunchRequest(globalStorageDir, request));
    const sessionLabel = queued.targetSessionIds.length === 1 ? "1 exact chat session" : `${queued.targetSessionIds.length} exact chat sessions`;
    const requestLabel = queued.requestCount === 1 ? "1 queued cleanup request" : `${queued.requestCount} queued cleanup requests`;
    const choice = await showWarningMessage(
      `Pending Local chat cleanup may leave ghost chats visible in the UI. ${requestLabel} still targets ${sessionLabel}. Quit and reopen this VS Code workspace now so cleanup can finish on shutdown?`,
      "Quit And Reopen",
      "Later"
    );
    prompted = true;
    if (choice === "Quit And Reopen") {
      const relaunchRequest = buildRelaunchRequest({
        executable: process.execPath,
        workspaceFilePath: vscode.workspace.workspaceFile?.fsPath,
        workspaceFolderPaths: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
        reuseWindow: true
      });
      if (relaunchRequest) {
        await writeRelaunchRequest(context.globalStorageUri.fsPath, relaunchRequest);
        relaunchQueued = true;
      }
      await executeCommand("workbench.action.quit");
      quitRequested = true;
    }
  }

  return {
    ...reconciled,
    requestsPath: queued.requestsPath,
    requestCount: queued.requestCount,
    rearmed,
    prompted,
    quitRequested,
    relaunchQueued
  };
}

async function queueExactOfflineLocalChatCleanup(
  context: vscode.ExtensionContext,
  workspaceStorageDir: string,
  sessionId: string
): Promise<void> {
  await queueOfflineLocalChatCleanupRequest(
    context.globalStorageUri.fsPath,
    buildWorkspaceStorageOfflineLocalChatCleanupRequest(workspaceStorageDir, sessionId)
  );
  launchOfflineLocalChatCleanup({
    extensionRoot: context.extensionPath,
    globalStorageDir: context.globalStorageUri.fsPath,
    waitForPid: process.pid
  });
}

export interface OfflineLocalChatCleanupUxReconcileResult {
  reconciledSessionIds: string[];
  closedCount: number;
  closedLabels: string[];
}

export async function reconcileOfflineLocalChatCleanupUx(
  summary: OfflineLocalChatCleanupSummary
): Promise<OfflineLocalChatCleanupUxReconcileResult> {
  const reconciledSessionIds = collectRemovedTargetSessionIds(summary);
  const closedLabels = new Set<string>();
  let closedCount = 0;

  for (const sessionId of reconciledSessionIds) {
    const result = await closeVisibleEditorChatTabsForSession({
      sessionId,
      sessionTitle: sessionId,
      matchMode: "resource-only"
    });
    closedCount += result.closedCount;
    for (const label of result.closedLabels) {
      closedLabels.add(label);
    }
  }

  return {
    reconciledSessionIds,
    closedCount,
    closedLabels: [...closedLabels]
  };
}

async function openFileInWorkbench(uri: vscode.Uri): Promise<void> {
  await vscode.commands.executeCommand("vscode.open", uri, {
    preview: false,
    preserveFocus: false
  });
}

async function buildLargeSessionFilePreview(jsonlPath: string, fileSizeBytes: number): Promise<string> {
  const headLines: string[] = [];
  const tailLines: string[] = [];
  const stream = createReadStream(jsonlPath, { encoding: "utf-8" });
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNo = 0;

  try {
    for await (const line of reader) {
      lineNo += 1;
      if (headLines.length < SESSION_FILE_PREVIEW_HEAD_LINES) {
        headLines.push(`${lineNo}: ${line}`);
      }
      tailLines.push(`${lineNo}: ${line}`);
      if (tailLines.length > SESSION_FILE_PREVIEW_TAIL_LINES) {
        tailLines.shift();
      }
    }
  } finally {
    reader.close();
    stream.close();
  }

  const headBlock = headLines.length > 0 ? headLines.join("\n") : "<empty>";
  const tailBlock = tailLines.length > 0 ? tailLines.join("\n") : "<empty>";
  return [
    "# Large Session File Preview",
    "",
    `- Path: ${jsonlPath}`,
    `- Size: ${fileSizeBytes} bytes`,
    `- Reason: files above roughly ${MAX_DIRECT_SESSION_FILE_OPEN_BYTES} bytes are shown as bounded previews to avoid extension-host synchronization limits.`,
    `- Head lines shown: ${Math.min(lineNo, SESSION_FILE_PREVIEW_HEAD_LINES)}`,
    `- Tail lines shown: ${Math.min(lineNo, SESSION_FILE_PREVIEW_TAIL_LINES)}`,
    "",
    "## File Head",
    "```text",
    headBlock,
    "```",
    "",
    "## File Tail",
    "```text",
    tailBlock,
    "```"
  ].join("\n");
}

async function openSessionFileOrPreview(session: SessionDescriptor): Promise<void> {
  const fileUri = vscode.Uri.file(session.jsonlPath);
  if (session.size <= MAX_DIRECT_SESSION_FILE_OPEN_BYTES) {
    await openFileInWorkbench(fileUri);
    return;
  }

  const stat = await fs.stat(session.jsonlPath);
  const preview = await buildLargeSessionFilePreview(session.jsonlPath, stat.size);
  await openMarkdownDocument(preview);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return String(error);
}

function commandResultMessage(result: ChatCommandResult, fallbackSuccess: string): string {
  if (result.ok) {
    const sessionMessage = result.session ? `${fallbackSuccess}: ${result.session.id}` : fallbackSuccess;
    const deletionSuffix = result.artifactDeletion
      ? ` | deletedArtifacts=${result.artifactDeletion.deletedPaths.length}`
      : "";
    if (result.revealLifecycle) {
      return `${sessionMessage} | closedMatchingVisibleTabs=${result.revealLifecycle.closedMatchingVisibleTabs}${deletionSuffix}`;
    }
    return `${sessionMessage}${deletionSuffix}`;
  }
  return result.reason ?? result.error ?? "Chat interop command failed.";
}

function asExtensionError(error: unknown): ExtensionError | undefined {
  return error instanceof Error ? (error as ExtensionError) : undefined;
}

async function countPersistedRows(jsonlPath: string): Promise<number | undefined> {
  try {
    const raw = await fs.readFile(jsonlPath, "utf-8");
    return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
  } catch {
    return undefined;
  }
}

function shiftMarkdownHeadings(markdown: string, levels: number): string {
  return markdown.replace(/^(#{1,6})\s/gm, (_match, hashes: string) => `${"#".repeat(Math.min(6, hashes.length + levels))} `);
}

async function buildTranscriptUnavailableMarkdown(
  session: SessionDescriptor | undefined,
  error: ExtensionError,
  adapter?: SessionToolsAdapter
): Promise<string> {
  const attemptedPaths = error.attemptedPaths ?? [];
  const indexEntry = session
    ? (await loadWorkspaceSessionIndex(session.workspaceStorageDir))?.get(session.sessionId)
    : undefined;
  const persistedRows = session ? await countPersistedRows(session.jsonlPath) : undefined;
  const laggingPersistenceNote = session && indexEntry && typeof persistedRows === "number" && persistedRows <= 5
    ? "- VS Code index metadata exists for this session, but the persisted session JSONL still looks bootstrap-only. The live chat UI can therefore be ahead of the on-disk artifacts used by transcript inspection."
    : undefined;
  const fallbackSections = session && adapter
    ? [
        "",
        "## Persisted Session Evidence",
        "- The sections below are derived directly from the persisted session JSONL and are provided as a bounded fallback when no canonical transcript artifact is present.",
        "",
        shiftMarkdownHeadings(await adapter.renderSnapshot({ sessionFile: session.jsonlPath }), 2),
        "",
        shiftMarkdownHeadings(await adapter.renderIndex({ sessionFile: session.jsonlPath }, 20), 2)
      ]
    : [];
  const hasFallbackSections = fallbackSections.length > 0;

  return [
    hasFallbackSections ? "# Session-Derived Evidence" : "# Evidence Transcript Unavailable",
    "",
    "## Summary",
    hasFallbackSections
      ? `- Canonical transcript artifact is unavailable for this session, so session-derived evidence is shown below. ${error.message}`
      : `- ${error.message}`,
    session ? `- Session ID: ${session.sessionId}` : undefined,
    indexEntry?.title ? `- Indexed title: ${indexEntry.title}` : undefined,
    session ? `- Session file: ${session.jsonlPath}` : undefined,
    typeof persistedRows === "number" ? `- Persisted non-empty rows: ${persistedRows}` : undefined,
    indexEntry?.lastMessageDate ? `- Indexed last message: ${new Date(indexEntry.lastMessageDate).toLocaleString()}` : undefined,
    laggingPersistenceNote,
    attemptedPaths.length > 0 ? "" : undefined,
    attemptedPaths.length > 0 ? "## Checked Paths" : undefined,
    ...attemptedPaths.map((candidatePath) => `- ${candidatePath}`),
    "",
    "## Next Steps",
    "- Use Open Snapshot or Open Tail Index first for the same session.",
    "- Use Open Raw Session File only as a last resort when the bounded inspection surfaces are insufficient.",
    "- If VS Code starts persisting transcript artifacts again, this action will use them automatically.",
    ...fallbackSections
  ].filter((line): line is string => Boolean(line)).join("\n");
}

async function reportCommandError(error: unknown, session?: SessionDescriptor): Promise<void> {
  const extensionError = asExtensionError(error);
  if (extensionError?.code === TRANSCRIPT_ARTIFACT_MISSING_CODE) {
    await openMarkdownDocument(await buildTranscriptUnavailableMarkdown(session, extensionError));
    return;
  }
  void vscode.window.showErrorMessage(errorMessage(error));
}

async function runCommand(task: () => Promise<void>, session?: SessionDescriptor): Promise<void> {
  try {
    await task();
  } catch (error) {
    await reportCommandError(error, session);
  }
}

async function renderTranscriptEvidenceWithFallback(
  adapter: SessionToolsAdapter,
  target: { latest?: true; storageRoots?: string[] } | { sessionFile: string },
  session?: SessionDescriptor
): Promise<string> {
  try {
    return await adapter.renderTranscriptEvidence(target);
  } catch (error) {
    const extensionError = asExtensionError(error);
    if (extensionError?.code === TRANSCRIPT_ARTIFACT_MISSING_CODE) {
      return buildTranscriptUnavailableMarkdown(session, extensionError, adapter);
    }
    throw error;
  }
}

function sessionQuickPickLabel(session: SessionDescriptor): string {
  return session.title?.trim() || session.sessionId;
}

function isSessionDescriptor(value: unknown): value is SessionDescriptor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.sessionId === "string" && typeof record.jsonlPath === "string";
}

function extractSessionDescriptor(value: unknown): SessionDescriptor | undefined {
  if (isSessionDescriptor(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const nested = (value as Record<string, unknown>).session;
  return isSessionDescriptor(nested) ? nested : undefined;
}

function currentWorkspaceStorageRoots(context: vscode.ExtensionContext): string[] | undefined {
  if (!context.storageUri) {
    return undefined;
  }
  const storagePath = path.resolve(context.storageUri.fsPath);
  const parentPath = path.dirname(storagePath);
  return [path.basename(parentPath) === "workspaceStorage" ? storagePath : parentPath];
}

function configuredDiscoveryScope(): DiscoveryScope {
  return vscode.workspace.getConfiguration("tiinex.aiVscodeTools").get<DiscoveryScope>("sessionDiscoveryScope", "current-workspace");
}

function scopedSessionStorageRoots(context: vscode.ExtensionContext): string[] | undefined {
  return configuredDiscoveryScope() === "current-workspace" ? (currentWorkspaceStorageRoots(context) ?? []) : undefined;
}

async function pickSession(adapter: SessionToolsAdapter, storageRoots?: string[]): Promise<SessionDescriptor | undefined> {
  const sessions = await adapter.discoverSessions(storageRoots ?? []);
  if (sessions.length === 0) {
    void vscode.window.showWarningMessage("No stored chat sessions were found under the selected storage roots.");
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    sessions.slice(0, 20).map((session, index) => ({
      label: sessionQuickPickLabel(session),
      description: index === 0 ? "latest" : new Date(session.mtime).toLocaleString(),
      detail: `${session.sessionId} | ${session.jsonlPath}`,
      session
    })),
    {
      placeHolder: "Select a stored chat session"
    }
  );
  return picked?.session;
}

function withSessionTarget(session: SessionDescriptor | undefined, storageRoots?: string[]): { latest: true; storageRoots?: string[] } | { sessionFile: string } {
  return session ? { sessionFile: session.jsonlPath } : { latest: true, storageRoots };
}

async function resolveSession(adapter: SessionToolsAdapter, storageRoots: string[] | undefined, sessionLike?: unknown): Promise<SessionDescriptor | undefined> {
  return extractSessionDescriptor(sessionLike) ?? pickSession(adapter, storageRoots);
}

function renderChatListMarkdown(chats: ChatSessionSummary[]): string {
  const lines = [
    "# Live Chats",
    "",
    `- Sessions listed: ${chats.length}`,
    ""
  ];
  for (const chat of chats.slice(0, 50)) {
    lines.push(
      `- ${chat.title || chat.id}`,
      `  id=${chat.id}`,
      `  updated=${chat.lastUpdated}`,
      `  mode=${chat.mode ?? "-"}`,
      `  model=${chat.model ?? "-"}`,
      `  provider=${chat.provider}`
    );
  }
  return `${lines.join("\n")}\n`;
}

async function promptForChatPrompt(title: string, value = ""): Promise<string | undefined> {
  const prompt = await vscode.window.showInputBox({
    title,
    prompt: "Enter the message to send to the Local chat.",
    value,
    ignoreFocusOut: true,
    validateInput: (input) => input.trim() ? undefined : "A prompt is required."
  });
  return prompt?.trim() ? prompt.trim() : undefined;
}

async function promptForAgentName(title: string, value = ""): Promise<string | undefined> {
  const agentName = await vscode.window.showInputBox({
    title,
    prompt: "Enter the agent name to use for safe new-chat creation on this host.",
    value,
    ignoreFocusOut: true,
    validateInput: (input) => input.trim() ? undefined : "An explicit agent name is required for safe new-chat creation on this host."
  });
  return agentName?.trim() ? agentName.trim() : undefined;
}

async function runWithProgress<T>(title: string, task: () => Promise<T>): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false
    },
    task
  );
}

function registerCommands(
  context: vscode.ExtensionContext,
  adapter: SessionToolsAdapter,
  tree: SessionInspectorTreeDataProvider,
  chatInterop?: ChatInteropApi
): void {
  const getSessionStorageRoots = () => scopedSessionStorageRoots(context);
  context.subscriptions.push(
    vscode.commands.registerCommand("tiinex.aiVscodeTools.refreshSessions", () => {
      tree.refresh();
    }),
    vscode.commands.registerCommand("tiinex.aiVscodeTools.surveyRecentSessions", async () => {
      await runCommand(async () => {
        const markdown = await runWithProgress("Surveying recent agent sessions", () => adapter.renderSurvey(8, getSessionStorageRoots()));
        await openMarkdownDocument(markdown);
      });
    }),
    vscode.commands.registerCommand("tiinex.aiVscodeTools.openLatestTranscriptEvidence", async () => {
      const latestSession = (await adapter.discoverSessions(getSessionStorageRoots())).at(0);
      if (!latestSession) {
        void vscode.window.showWarningMessage("No stored chat sessions were found under the selected storage roots.");
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress(
          "Rendering latest evidence transcript",
          () => renderTranscriptEvidenceWithFallback(adapter, { sessionFile: latestSession.jsonlPath }, latestSession)
        );
        await openMarkdownDocument(markdown);
      }, latestSession);
    }),
    vscode.commands.registerCommand("tiinex.aiVscodeTools.openLatestSnapshot", async () => {
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering latest session snapshot", () => adapter.renderSnapshot({ latest: true, storageRoots: getSessionStorageRoots() }));
        await openMarkdownDocument(markdown);
      });
    }),
    vscode.commands.registerCommand("tiinex.aiVscodeTools.openLatestContextEstimate", async () => {
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering latest context estimate", () => adapter.renderContextEstimate({ latest: true, storageRoots: getSessionStorageRoots() }));
        await openMarkdownDocument(markdown);
      });
    }),
    vscode.commands.registerCommand("tiinex.aiVscodeTools.openLatestProfile", async () => {
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering latest session profile", () => adapter.renderProfile({ latest: true, storageRoots: getSessionStorageRoots() }));
        await openMarkdownDocument(markdown);
      });
    }),
    vscode.commands.registerCommand("tiinex.aiVscodeTools.openTranscriptEvidence", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress(
          "Rendering evidence transcript",
          () => renderTranscriptEvidenceWithFallback(adapter, withSessionTarget(resolved, getSessionStorageRoots()), resolved)
        );
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("tiinex.aiVscodeTools.openSnapshot", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering session snapshot", () => adapter.renderSnapshot(withSessionTarget(resolved, getSessionStorageRoots())));
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("tiinex.aiVscodeTools.openContextEstimate", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering context estimate", () => adapter.renderContextEstimate(withSessionTarget(resolved, getSessionStorageRoots())));
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("tiinex.aiVscodeTools.openProfile", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering session profile", () => adapter.renderProfile(withSessionTarget(resolved, getSessionStorageRoots())));
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("tiinex.aiVscodeTools.openIndex", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering session tail index", () => adapter.renderIndex(withSessionTarget(resolved, getSessionStorageRoots())));
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("tiinex.aiVscodeTools.openSessionFile", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        await runWithProgress("Opening raw session file", () => openSessionFileOrPreview(resolved));
      }, resolved);
    })
  );

  if (!chatInterop || !LOCAL_CHAT_RUNTIME_SURFACES_ENABLED) {
    return;
  }

  if (LOCAL_CHAT_CONTROL_SURFACES_ENABLED) {
    context.subscriptions.push(
      vscode.commands.registerCommand("tiinex.aiVscodeTools.listLiveChats", async () => {
        await runCommand(async () => {
          const chats = await runWithProgress("Listing live chats", () => chatInterop.listChats());
          await openMarkdownDocument(renderChatListMarkdown(chats));
        });
      }),
      vscode.commands.registerCommand("tiinex.aiVscodeTools.revealLiveChat", async (session?: SessionDescriptor) => {
        const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
        if (!resolved) {
          return;
        }
        await runCommand(async () => {
          const selfTargetReason = getExactSelfTargetingReason(await chatInterop.listChats(), resolved.sessionId, "reveal");
          if (selfTargetReason) {
            throw new Error(selfTargetReason);
          }
          const result = await runWithProgress("Revealing Local chat", () => chatInterop.revealChat(resolved.sessionId));
          if (!result.ok) {
            throw new Error(commandResultMessage(result, "Unable to reveal Local chat"));
          }
          void vscode.window.showInformationMessage(commandResultMessage(result, "Revealed Local chat"));
        }, resolved);
      }),
      vscode.commands.registerCommand("tiinex.aiVscodeTools.closeVisibleLiveChatTabs", async (session?: SessionDescriptor) => {
        const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
        if (!resolved) {
          return;
        }
        await runCommand(async () => {
          const selfTargetReason = getExactSelfTargetingReason(await chatInterop.listChats(), resolved.sessionId, "close-visible-tabs");
          if (selfTargetReason) {
            throw new Error(selfTargetReason);
          }
          const result = await runWithProgress("Closing visible Local chat tabs", () => chatInterop.closeVisibleTabs(resolved.sessionId));
          if (!result.ok) {
            throw new Error(commandResultMessage(result, "Unable to close visible Local chat tabs"));
          }
          void vscode.window.showInformationMessage(commandResultMessage(result, "Closed visible Local chat tabs"));
        }, resolved);
      }),
      vscode.commands.registerCommand("tiinex.aiVscodeTools.deleteLiveChatArtifacts", async (session?: SessionDescriptor) => {
        const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
        if (!resolved) {
          return;
        }
        await runCommand(async () => {
          const selfTargetReason = await getExactDeleteSelfTargetingReason(await chatInterop.listChats(), resolved.sessionId);
          if (selfTargetReason) {
            throw new Error(selfTargetReason);
          }
          const result = await runWithProgress("Deleting Local chat artifacts", () => chatInterop.deleteChat(resolved.sessionId));
          if (!result.ok) {
            throw new Error(commandResultMessage(result, "Unable to delete Local chat artifacts"));
          }
          const message = commandResultMessage(result, "Deleted Local chat artifacts");
          if (resolved.workspaceStorageDir) {
            try {
              await queueExactOfflineLocalChatCleanup(context, resolved.workspaceStorageDir, resolved.sessionId);
              void vscode.window.showInformationMessage(`${message} Offline Local chat cleanup was queued for the exact session target. Close VS Code completely to let the helper delete queued Local chat artifacts and prune scheduled workspace state.`);
            } catch (error) {
              void vscode.window.showWarningMessage(`${message} Exact offline cleanup could not be queued automatically: ${errorMessage(error)}`);
            }
          } else {
            void vscode.window.showInformationMessage(message);
          }
        }, resolved);
      })
    );
  }

  if (LOCAL_CHAT_MUTATION_SURFACES_ENABLED) {
    context.subscriptions.push(
      vscode.commands.registerCommand("tiinex.aiVscodeTools.createLiveChat", async () => {
        const prompt = await promptForChatPrompt("Create Local Chat");
        if (!prompt) {
          return;
        }
        const agentName = await promptForAgentName("Create Local Chat");
        if (!agentName) {
          return;
        }
        await runCommand(async () => {
          const result = await runWithProgress("Creating Local chat", () => chatInterop.createChat({
            prompt,
            agentName,
            blockOnResponse: false
          }));
          if (!result.ok) {
            throw new Error(commandResultMessage(result, "Unable to create Local chat"));
          }
          void vscode.window.showInformationMessage(commandResultMessage(result, "Created Local chat"));
        });
      }),
      vscode.commands.registerCommand("tiinex.aiVscodeTools.sendMessageToLiveChat", async (session?: SessionDescriptor) => {
        const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
        if (!resolved) {
          return;
        }
        const prompt = await promptForChatPrompt("Send Message To Local Chat");
        if (!prompt) {
          return;
        }
        await runCommand(async () => {
          const selfTargetReason = getExactSelfTargetingReason(await chatInterop.listChats(), resolved.sessionId, "send");
          if (selfTargetReason) {
            throw new Error(selfTargetReason);
          }
          const result = await runWithProgress("Sending message to Local chat", () => sendMessageToSession(chatInterop, {
            sessionId: resolved.sessionId,
            prompt,
            blockOnResponse: false
          }));
          if (!result.ok) {
            throw new Error(commandResultMessage(result, "Unable to send message to Local chat"));
          }
          void vscode.window.showInformationMessage(
            commandResultMessage(
              result,
              "Sent message to Local chat"
            )
          );
        }, resolved);
      })
    );
  }
}

async function syncLiveChatInteropContext(chatInterop: ChatInteropApi): Promise<void> {
  const [support, focusedSupport] = await Promise.all([
    chatInterop.getExactSessionInteropSupport(),
    chatInterop.getFocusedChatInteropSupport()
  ]);
  await Promise.all([
    vscode.commands.executeCommand("setContext", "tiinex.aiVscodeTools.exactLiveChatRevealSupported", support.canRevealExactSession),
    vscode.commands.executeCommand("setContext", "tiinex.aiVscodeTools.focusedLiveChatSendSupported", focusedSupport.canSubmitFocusedChatMessage)
  ]);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await maybeReportOfflineLocalChatCleanup(context);
  await cleanupGlobalStorageArtifacts(context.globalStorageUri.fsPath);
  const queuedCleanup = await reconcileQueuedOfflineLocalChatCleanupUx(context);
  if (!queuedCleanup?.prompted) {
    await detectOrphanedIndexedGhostChatsOnStartup(context);
  }
  const adapter = new SessionToolsAdapter();
  const tree = new SessionInspectorTreeDataProvider(
    adapter,
    () => scopedSessionStorageRoots(context)
  );
  context.subscriptions.push(
    tree,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("tiinex.aiVscodeTools.sessionDiscoveryScope")) {
        tree.refresh();
      }
    }),
    vscode.window.createTreeView("tiinex.aiVscodeTools.sessions", {
      treeDataProvider: tree,
      showCollapseAll: true
    })
  );

  let chatInterop: ChatInteropApi | undefined;
  if (FIRST_SLICE_INTERACTIVE_SURFACES_ENABLED || LOCAL_CHAT_RUNTIME_SURFACES_ENABLED) {
    const config = vscode.workspace.getConfiguration("tiinex.aiVscodeTools");
    const chatInteropOptions = {
      workspaceStorageRoots: currentWorkspaceStorageRoots(context),
      postCreateTimeoutMs: config.get<number>("postCreateTimeoutMs", 900000),
      waitForPersistedDefault: config.get<boolean>("waitForPersistedDefault", true)
    };

    chatInterop = registerChatInterop(context, chatInteropOptions);
    await syncLiveChatInteropContext(chatInterop);
  }

  registerLanguageModelTools(context, adapter, chatInterop);
  registerCommands(context, adapter, tree, chatInterop);
}

export function deactivate(): void {
  // no-op
}