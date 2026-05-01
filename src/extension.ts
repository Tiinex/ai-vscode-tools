import path from "node:path";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import readline from "node:readline";
import * as vscode from "vscode";
import { registerChatInterop } from "./chatInterop";
import type { ChatCommandResult, ChatInteropApi, ChatSessionSummary } from "./chatInterop";
import { captureCurrentChatFocusReport, focusLikelyEditorChat } from "./chatInterop/editorFocus";
import { renderChatFocusDebugMarkdown, renderChatFocusReportMarkdown, type ChatFocusReport } from "./chatInterop/focusTargets";
import { probeLocalReopenCandidates, renderLocalReopenProbeMarkdown } from "./chatInterop/reopenProbe";
import { getFocusedSelfTargetingReason } from "./chatInterop/selfTargetGuard";
import {
  buildLiveChatSupportMatrix,
  renderLiveChatSupportMatrixMarkdown,
  renderRuntimeChatCommandInventoryMarkdown
} from "./chatInterop/supportMatrix";
import {
  inspectCopilotCliSession,
  inspectLatestCopilotCliSession,
  listCopilotCliSessions,
  prepareCopilotCliCapabilityProbePack,
  probeLatestCopilotCliReadAccess,
  probeLatestCopilotCliSession,
  probeLatestCopilotCliToolApproval,
  probeLatestCopilotCliWorkspaceMutation,
  renderCopilotCliSessionMarkdown,
  sendPromptToCopilotCliResource,
  renderCopilotCliCapabilityProbePackMarkdown
} from "./chatInterop/copilotCliDebug";
import type { CopilotCliSessionDescriptor } from "./chatInterop/copilotCliDebug";
import { buildLocalToCopilotCliExecutionPrompt, renderLocalToCopilotCliHandoffMarkdown } from "./chatInterop/localToCopilotCliHandoff";
import { sendMessageToSessionWithFallback } from "./chatInterop/sessionSendWorkflow";
import { SessionToolingAdapter, type SessionDescriptor } from "./coreAdapter";
import { registerLanguageModelTools } from "./languageModelTools";
import { loadWorkspaceSessionIndex } from "./sessionIndex";
import { SessionInspectorTreeDataProvider } from "./sessionInspectorTree";
import { renderMissingCopilotCliSessionStateMessage, renderMissingCopilotCliSessionsMessage } from "./tooling/copilot-cli";

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
    if (result.revealLifecycle) {
      return `${sessionMessage} | closedMatchingVisibleTabs=${result.revealLifecycle.closedMatchingVisibleTabs}`;
    }
    return sessionMessage;
  }
  return result.reason ?? result.error ?? "Chat interop command failed.";
}

function getActiveChatFocusLabel(report: ChatFocusReport): string | undefined {
  const activeGroup = report.groups[report.activeGroupIndex];
  return activeGroup?.tabs.find((tab) => tab.isActive)?.label;
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
  adapter?: SessionToolingAdapter
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
        "- The sections below are derived directly from the persisted session JSONL, which is the normal live-session evidence path when no canonical transcript artifact is present.",
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
    "- Use Open Snapshot, Open Tail Index, or Open Session File for the same session.",
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
  adapter: SessionToolingAdapter,
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
  return vscode.workspace.getConfiguration("agentArchitectTools").get<DiscoveryScope>("sessionDiscoveryScope", "current-workspace");
}

function scopedSessionStorageRoots(context: vscode.ExtensionContext): string[] | undefined {
  return configuredDiscoveryScope() === "current-workspace" ? (currentWorkspaceStorageRoots(context) ?? []) : undefined;
}

async function pickSession(adapter: SessionToolingAdapter, storageRoots?: string[]): Promise<SessionDescriptor | undefined> {
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

async function resolveSession(adapter: SessionToolingAdapter, storageRoots: string[] | undefined, sessionLike?: unknown): Promise<SessionDescriptor | undefined> {
  return extractSessionDescriptor(sessionLike) ?? pickSession(adapter, storageRoots);
}

function isChatSessionSummary(value: unknown): value is ChatSessionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.sessionFile === "string";
}

function asChatSessionSummary(sessionLike: unknown): ChatSessionSummary | undefined {
  if (isChatSessionSummary(sessionLike)) {
    return sessionLike;
  }
  return undefined;
}

async function promptForChatPrompt(title: string, value = ""): Promise<string | undefined> {
  const prompt = await vscode.window.showInputBox({
    title,
    prompt: "Enter the message to send to the live chat.",
    value,
    ignoreFocusOut: true,
    validateInput: (input) => input.trim() ? undefined : "A prompt is required."
  });
  return prompt?.trim() ? prompt.trim() : undefined;
}

async function pickLiveChatSession(chatInterop: ChatInteropApi, sessionLike?: unknown): Promise<ChatSessionSummary | undefined> {
  const explicit = asChatSessionSummary(sessionLike);
  if (explicit) {
    return explicit;
  }
  const persisted = extractSessionDescriptor(sessionLike);
  const explicitSessionId = typeof sessionLike === "string" && sessionLike.trim() ? sessionLike.trim() : undefined;
  const chats = await chatInterop.listChats();
  const matched = persisted
    ? chats.find((chat) => chat.id === persisted.sessionId || chat.id.startsWith(persisted.sessionId) || persisted.sessionId.startsWith(chat.id))
    : explicitSessionId
      ? chats.find((chat) => chat.id === explicitSessionId || chat.id.startsWith(explicitSessionId) || explicitSessionId.startsWith(chat.id))
    : undefined;
  if (matched) {
    return matched;
  }
  if (chats.length === 0) {
    void vscode.window.showWarningMessage("No local live chat sessions were found for chat interop.");
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    chats.slice(0, 30).map((chat, index) => ({
      label: chat.title || chat.id,
      description: index === 0 ? "latest" : new Date(chat.lastUpdated).toLocaleString(),
      detail: `${chat.id} • ${chat.mode ?? "mode unknown"} • ${chat.model ?? "model unknown"}`,
      chat
    })),
    {
      placeHolder: "Select a live chat session"
    }
  );
  return picked?.chat;
}

async function pickCopilotCliSession(sessionLike?: unknown): Promise<CopilotCliSessionDescriptor | undefined> {
  const explicit = sessionLike && typeof sessionLike === "object" && "canonicalResource" in (sessionLike as Record<string, unknown>)
    ? sessionLike as CopilotCliSessionDescriptor
    : undefined;
  if (explicit) {
    return explicit;
  }
  const sessions = await listCopilotCliSessions(20);
  if (sessions.length === 0) {
    void vscode.window.showWarningMessage(renderMissingCopilotCliSessionsMessage());
    return undefined;
  }
  if (sessions.length === 1) {
    return sessions[0];
  }
  const picked = await vscode.window.showQuickPick(
    sessions.map((session, index) => ({
      label: session.summary?.trim() || session.cwd?.trim() || session.sessionId,
      description: index === 0 ? "latest" : new Date(session.mtime).toLocaleString(),
      detail: `${session.sessionId} • ${session.canonicalResource}`,
      session
    })),
    {
      placeHolder: "Select a Copilot CLI worker session"
    }
  );
  return picked?.session;
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

function currentWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function openOptionalFile(filePath: string | undefined, missingMessage: string): Promise<void> {
  if (!filePath) {
    throw new Error(missingMessage);
  }
  await openFileInWorkbench(vscode.Uri.file(filePath));
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
  adapter: SessionToolingAdapter,
  tree: SessionInspectorTreeDataProvider,
  chatInterop: ChatInteropApi
): void {
  const getSessionStorageRoots = () => scopedSessionStorageRoots(context);
  context.subscriptions.push(
    vscode.commands.registerCommand("agentArchitectTools.refreshSessions", () => {
      tree.refresh();
    }),
    vscode.commands.registerCommand("agentArchitectTools.surveyRecentSessions", async () => {
      await runCommand(async () => {
        const markdown = await runWithProgress("Surveying recent agent sessions", () => adapter.renderSurvey(8, getSessionStorageRoots()));
        await openMarkdownDocument(markdown);
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.openLatestTranscriptEvidence", async () => {
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
    vscode.commands.registerCommand("agentArchitectTools.openLatestSnapshot", async () => {
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering latest session snapshot", () => adapter.renderSnapshot({ latest: true, storageRoots: getSessionStorageRoots() }));
        await openMarkdownDocument(markdown);
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.openLatestContextEstimate", async () => {
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering latest context estimate", () => adapter.renderContextEstimate({ latest: true, storageRoots: getSessionStorageRoots() }));
        await openMarkdownDocument(markdown);
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.openLatestProfile", async () => {
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering latest session profile", () => adapter.renderProfile({ latest: true, storageRoots: getSessionStorageRoots() }));
        await openMarkdownDocument(markdown);
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.openTranscriptEvidence", async (session?: SessionDescriptor) => {
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
    vscode.commands.registerCommand("agentArchitectTools.openSnapshot", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering session snapshot", () => adapter.renderSnapshot(withSessionTarget(resolved, getSessionStorageRoots())));
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("agentArchitectTools.openContextEstimate", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering context estimate", () => adapter.renderContextEstimate(withSessionTarget(resolved, getSessionStorageRoots())));
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("agentArchitectTools.openProfile", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering session profile", () => adapter.renderProfile(withSessionTarget(resolved, getSessionStorageRoots())));
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("agentArchitectTools.openIndex", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering session tail index", () => adapter.renderIndex(withSessionTarget(resolved, getSessionStorageRoots())));
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("agentArchitectTools.openSessionFile", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        await runWithProgress("Opening session file", () => openSessionFileOrPreview(resolved));
      }, resolved);
    }),
    vscode.commands.registerCommand("agentArchitectTools.prepareLocalToCopilotCliHandoff", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const [support, snapshotMarkdown, profileMarkdown, indexMarkdown, latestCli] = await runWithProgress(
          "Preparing Local to Copilot CLI handoff",
          async () => Promise.all([
            chatInterop.getExactSessionInteropSupport(),
            adapter.renderSnapshot({ sessionFile: resolved.jsonlPath }),
            adapter.renderProfile({ sessionFile: resolved.jsonlPath }),
            adapter.renderIndex({ sessionFile: resolved.jsonlPath }, 16),
            inspectLatestCopilotCliSession()
          ])
        );
        await openMarkdownDocument(renderLocalToCopilotCliHandoffMarkdown({
          session: resolved,
          support,
          latestCli: latestCli ?? undefined,
          snapshotMarkdown,
          profileMarkdown,
          indexMarkdown
        }));
      }, resolved);
    }),
    vscode.commands.registerCommand("agentArchitectTools.sendLocalToCopilotCliHandoff", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      const cliSession = await pickCopilotCliSession();
      if (!cliSession) {
        return;
      }
      await runCommand(async () => {
        const [support, snapshotMarkdown, profileMarkdown, indexMarkdown] = await runWithProgress(
          "Building Local to Copilot CLI execution payload",
          async () => Promise.all([
            chatInterop.getExactSessionInteropSupport(),
            adapter.renderSnapshot({ sessionFile: resolved.jsonlPath }),
            adapter.renderProfile({ sessionFile: resolved.jsonlPath }),
            adapter.renderIndex({ sessionFile: resolved.jsonlPath }, 16)
          ])
        );
        const options = {
          session: resolved,
          support,
          latestCli: cliSession,
          snapshotMarkdown,
          profileMarkdown,
          indexMarkdown
        };
        const executionPrompt = buildLocalToCopilotCliExecutionPrompt(options);
        await runWithProgress("Sending Local handoff to Copilot CLI", () => sendPromptToCopilotCliResource(cliSession.canonicalResource, executionPrompt));
        void vscode.window.showInformationMessage(`Sent Local handoff to Copilot CLI resource: ${cliSession.canonicalResource}`);
      }, resolved);
    }),
    vscode.commands.registerCommand("agentArchitectTools.listLiveChats", async () => {
      await runCommand(async () => {
        const chats = await runWithProgress("Listing live chats", () => chatInterop.listChats());
        await openMarkdownDocument(renderChatListMarkdown(chats));
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.inspectLiveChatSupport", async () => {
      await runCommand(async () => {
        const matrix = buildLiveChatSupportMatrix({
          commands: await vscode.commands.getCommands(true),
          exactSessionInterop: await chatInterop.getExactSessionInteropSupport(),
          copilotChatPackageJson: vscode.extensions.getExtension("GitHub.copilot-chat")?.packageJSON
        });
        await openMarkdownDocument(renderLiveChatSupportMatrixMarkdown(matrix));
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.inspectRuntimeChatCommands", async () => {
      await runCommand(async () => {
        await openMarkdownDocument(renderRuntimeChatCommandInventoryMarkdown({
          runtimeCommands: await vscode.commands.getCommands(true),
          copilotChatPackageJson: vscode.extensions.getExtension("GitHub.copilot-chat")?.packageJSON
        }));
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.probeLocalReopenCandidates", async (sessionLike?: unknown) => {
      const chat = await pickLiveChatSession(chatInterop, sessionLike);
      if (!chat) {
        return;
      }
      await runCommand(async () => {
        const result = await runWithProgress("Probing Local reopen candidates", () => probeLocalReopenCandidates(chatInterop, chat.id));
        await openMarkdownDocument(renderLocalReopenProbeMarkdown(result));
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.inspectChatFocusTargets", async () => {
      await runCommand(async () => {
        const chats = await runWithProgress("Inspecting chat focus targets", () => chatInterop.listChats());
        await openMarkdownDocument(renderChatFocusReportMarkdown(captureCurrentChatFocusReport(chats)));
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.inspectChatFocusDebug", async () => {
      await runCommand(async () => {
        const chats = await runWithProgress("Inspecting chat focus debug", () => chatInterop.listChats());
        await openMarkdownDocument(renderChatFocusDebugMarkdown(captureCurrentChatFocusReport(chats)));
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.createLiveChat", async () => {
      const prompt = await promptForChatPrompt("Create Live Chat");
      if (!prompt) {
        return;
      }
      await runCommand(async () => {
        const result = await runWithProgress("Creating live chat", () => chatInterop.createChat({ prompt }));
        if (!result.ok) {
          throw new Error(commandResultMessage(result, "Unable to create live chat"));
        }
        void vscode.window.showInformationMessage(commandResultMessage(result, "Created live chat"));
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.revealLiveChat", async (sessionLike?: unknown) => {
      const chat = await pickLiveChatSession(chatInterop, sessionLike);
      if (!chat) {
        return;
      }
      await runCommand(async () => {
        const result = await runWithProgress("Revealing live chat", () => chatInterop.revealChat(chat.id));
        if (!result.ok) {
          throw new Error(commandResultMessage(result, "Unable to reveal live chat"));
        }
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.closeVisibleLiveChatTabs", async (sessionLike?: unknown) => {
      const chat = await pickLiveChatSession(chatInterop, sessionLike);
      if (!chat) {
        return;
      }
      await runCommand(async () => {
        const result = await runWithProgress("Closing visible live chat tabs", () => chatInterop.closeVisibleTabs(chat.id));
        if (!result.ok) {
          throw new Error(commandResultMessage(result, "Unable to close visible live chat tabs"));
        }
        void vscode.window.showInformationMessage(commandResultMessage(result, "Closed visible live chat tabs"));
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.sendMessageToLiveChat", async (sessionLike?: unknown) => {
      const chat = await pickLiveChatSession(chatInterop, sessionLike);
      if (!chat) {
        return;
      }
      const prompt = await promptForChatPrompt("Send Message To Live Chat (Exact Session)");
      if (!prompt) {
        return;
      }
      await runCommand(async () => {
        const workflow = await runWithProgress("Sending message to live chat", () => sendMessageToSessionWithFallback(chatInterop, {
          sessionId: chat.id,
          prompt
        }));
        if (!workflow.result.ok) {
          throw new Error(commandResultMessage(workflow.result, "Unable to send message to live chat"));
        }
        void vscode.window.showInformationMessage(
          commandResultMessage(
            workflow.result,
            workflow.usedFallback
              ? "Sent message to live chat via reveal + focused editor fallback"
              : "Sent message to live chat"
          )
        );
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.sendMessageToFocusedLiveChat", async () => {
      const prompt = await promptForChatPrompt("Send Message To Focused Visible Live Chat");
      if (!prompt) {
        return;
      }
      await runCommand(async () => {
        const selfTargetReason = getFocusedSelfTargetingReason(await chatInterop.listChats(), "focused-send");
        if (selfTargetReason) {
          throw new Error(selfTargetReason);
        }
        const result = await runWithProgress("Sending message to focused live chat", () => chatInterop.sendFocusedMessage({
          prompt
        }));
        if (!result.ok) {
          throw new Error(commandResultMessage(result, "Unable to send message to focused live chat"));
        }
        void vscode.window.showInformationMessage(commandResultMessage(result, "Sent message to focused live chat"));
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.focusVisibleEditorLiveChat", async (sessionLike?: unknown) => {
      const chat = await pickLiveChatSession(chatInterop, sessionLike);
      if (!chat) {
        return;
      }
      await runCommand(async () => {
        const focusResult = await runWithProgress("Focusing editor chat", () => focusLikelyEditorChat(chatInterop, {
          sessionId: chat?.id
        }));
        if (!focusResult.ok) {
          throw new Error(focusResult.reason ?? "Unable to focus an editor chat.");
        }
        const report = focusResult.report ?? captureCurrentChatFocusReport(await chatInterop.listChats());
        const activeLabel = getActiveChatFocusLabel(report);
        void vscode.window.showInformationMessage(
          activeLabel
            ? `Focused editor chat: ${activeLabel}`
            : "Focused an editor chat."
        );
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.sendMessageToFocusedEditorChat", async (sessionLike?: unknown) => {
      const chat = await pickLiveChatSession(chatInterop, sessionLike);
      if (!chat) {
        return;
      }
      const prompt = await promptForChatPrompt("Send Message To Focused Editor Chat");
      if (!prompt) {
        return;
      }
      await runCommand(async () => {
        const selfTargetReason = getFocusedSelfTargetingReason(await chatInterop.listChats(), "focused-editor-send", chat?.id);
        if (selfTargetReason) {
          throw new Error(selfTargetReason);
        }
        const focusResult = await runWithProgress("Focusing editor chat", () => focusLikelyEditorChat(chatInterop, {
          sessionId: chat?.id
        }));
        if (!focusResult.ok) {
          throw new Error(focusResult.reason ?? "Unable to focus an editor chat.");
        }
        const result = await runWithProgress("Sending message to focused editor chat", () => chatInterop.sendFocusedMessage({
          prompt
        }));
        if (!result.ok) {
          throw new Error(commandResultMessage(result, "Unable to send message to focused editor chat"));
        }
        void vscode.window.showInformationMessage(commandResultMessage(result, "Sent message to focused editor chat"));
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.inspectLatestCopilotCliSession", async () => {
      await runCommand(async () => {
        const inspection = await runWithProgress("Inspecting latest Copilot CLI session", async () => {
          const snapshot = await inspectLatestCopilotCliSession();
          if (!snapshot) {
            return undefined;
          }
          return inspectCopilotCliSession(snapshot);
        });
        if (!inspection) {
          throw new Error(renderMissingCopilotCliSessionStateMessage());
        }
        await openMarkdownDocument(renderCopilotCliSessionMarkdown(inspection));
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.inspectCopilotCliSession", async (sessionLike?: unknown) => {
      const session = sessionLike && typeof sessionLike === "object" ? sessionLike : undefined;
      if (!session) {
        const latest = await runWithProgress("Listing Copilot CLI sessions", () => listCopilotCliSessions(1));
        if (latest.length === 0) {
          throw new Error(renderMissingCopilotCliSessionStateMessage());
        }
        await openMarkdownDocument(renderCopilotCliSessionMarkdown(await inspectCopilotCliSession(latest[0])));
        return;
      }
      await openMarkdownDocument(renderCopilotCliSessionMarkdown(await inspectCopilotCliSession(session as any)));
    }),
    vscode.commands.registerCommand("agentArchitectTools.sendPromptToCopilotCliSession", async (sessionLike?: unknown) => {
      const session = await pickCopilotCliSession(sessionLike);
      if (!session) {
        return;
      }
      const prompt = await promptForChatPrompt("Send Prompt To Copilot CLI Session");
      if (!prompt) {
        return;
      }
      await runCommand(async () => {
        await runWithProgress("Sending prompt to Copilot CLI session", () => sendPromptToCopilotCliResource(session.canonicalResource, prompt));
        void vscode.window.showInformationMessage(`Sent prompt to Copilot CLI resource: ${session.canonicalResource}`);
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.openCopilotCliEventsFile", async (sessionLike?: unknown) => {
      await runCommand(async () => {
        const session = sessionLike as { eventsPath?: string } | undefined;
        await openOptionalFile(session?.eventsPath, "This Copilot CLI session does not expose an events.jsonl file.");
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.openCopilotCliWorkspaceYaml", async (sessionLike?: unknown) => {
      await runCommand(async () => {
        const session = sessionLike as { workspaceYamlPath?: string } | undefined;
        await openOptionalFile(session?.workspaceYamlPath, "This Copilot CLI session does not have a workspace.yaml file.");
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.probeLatestCopilotCliSession", async () => {
      const prompt = await promptForChatPrompt("Probe Latest Copilot CLI Session", "say hello again and stop");
      if (!prompt) {
        return;
      }
      await runCommand(async () => {
        const result = await runWithProgress("Probing latest Copilot CLI session", () => probeLatestCopilotCliSession(prompt));
        void vscode.window.showInformationMessage(`Copilot CLI probe used resource: ${result.usedResource}`);
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.prepareCopilotCliCapabilityProbes", async () => {
      await runCommand(async () => {
        const workspaceRoot = currentWorkspaceRoot();
        if (!workspaceRoot) {
          throw new Error("Open a workspace folder in the Extension Development Host before preparing Copilot CLI capability probes.");
        }
        const probePack = await runWithProgress("Preparing Copilot CLI capability probes", () => prepareCopilotCliCapabilityProbePack(workspaceRoot));
        await openMarkdownDocument(renderCopilotCliCapabilityProbePackMarkdown(probePack));
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.probeLatestCopilotCliReadAccess", async () => {
      await runCommand(async () => {
        const workspaceRoot = currentWorkspaceRoot();
        if (!workspaceRoot) {
          throw new Error("Open a workspace folder in the Extension Development Host before running Copilot CLI capability probes.");
        }
        const result = await runWithProgress("Probing Copilot CLI read access", () => probeLatestCopilotCliReadAccess(workspaceRoot));
        void vscode.window.showInformationMessage(`Copilot CLI read probe used resource: ${result.usedResource}`);
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.probeLatestCopilotCliWorkspaceMutation", async () => {
      await runCommand(async () => {
        const workspaceRoot = currentWorkspaceRoot();
        if (!workspaceRoot) {
          throw new Error("Open a workspace folder in the Extension Development Host before running Copilot CLI capability probes.");
        }
        const result = await runWithProgress("Probing Copilot CLI workspace mutation", () => probeLatestCopilotCliWorkspaceMutation(workspaceRoot));
        void vscode.window.showInformationMessage(`Copilot CLI mutation probe used resource: ${result.usedResource}`);
      });
    }),
    vscode.commands.registerCommand("agentArchitectTools.probeLatestCopilotCliToolApproval", async () => {
      await runCommand(async () => {
        const workspaceRoot = currentWorkspaceRoot();
        if (!workspaceRoot) {
          throw new Error("Open a workspace folder in the Extension Development Host before running Copilot CLI capability probes.");
        }
        const result = await runWithProgress("Probing Copilot CLI tool approval", () => probeLatestCopilotCliToolApproval(workspaceRoot));
        void vscode.window.showInformationMessage(`Copilot CLI tool/approval probe used resource: ${result.usedResource}`);
      });
    })
  );
}

async function syncLiveChatInteropContext(chatInterop: ChatInteropApi): Promise<void> {
  const [support, focusedSupport] = await Promise.all([
    chatInterop.getExactSessionInteropSupport(),
    chatInterop.getFocusedChatInteropSupport()
  ]);
  await Promise.all([
    vscode.commands.executeCommand("setContext", "agentArchitectTools.exactLiveChatRevealSupported", support.canRevealExactSession),
    vscode.commands.executeCommand("setContext", "agentArchitectTools.exactLiveChatSendSupported", support.canSendExactSessionMessage),
    vscode.commands.executeCommand("setContext", "agentArchitectTools.focusedLiveChatSendSupported", focusedSupport.canSubmitFocusedChatMessage)
  ]);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const adapter = new SessionToolingAdapter();
  const config = vscode.workspace.getConfiguration("agentArchitectTools");
  const chatInteropOptions = {
    workspaceStorageRoots: currentWorkspaceStorageRoots(context),
    postCreateTimeoutMs: config.get<number>("postCreateTimeoutMs", 60000),
    waitForPersistedDefault: config.get<boolean>("waitForPersistedDefault", true)
  };

  const chatInterop = registerChatInterop(context, chatInteropOptions);
  await syncLiveChatInteropContext(chatInterop);
  const tree = new SessionInspectorTreeDataProvider(
    adapter,
    () => scopedSessionStorageRoots(context),
    () => chatInterop.getExactSessionInteropSupport(),
    () => listCopilotCliSessions(12)
  );
  context.subscriptions.push(
    tree,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("agentArchitectTools.sessionDiscoveryScope")) {
        tree.refresh();
      }
    }),
    vscode.window.createTreeView("agentArchitectTools.sessions", {
      treeDataProvider: tree,
      showCollapseAll: true
    })
  );
  registerLanguageModelTools(context, adapter, chatInterop);
  registerCommands(context, adapter, tree, chatInterop);
}

export function deactivate(): void {
  // no-op
}