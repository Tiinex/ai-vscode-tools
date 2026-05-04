import path from "node:path";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import readline from "node:readline";
import * as vscode from "vscode";
import { registerChatInterop } from "./chatInterop";
import type { ChatCommandResult, ChatInteropApi, ChatSessionSummary } from "./chatInterop";
import { sendMessageToSessionWithFallback } from "./chatInterop/sessionSendWorkflow";
import { getExactSelfTargetingReason, getFocusedSelfTargetingReason } from "./chatInterop/selfTargetGuard";
import { SessionToolingAdapter, type SessionDescriptor } from "./coreAdapter";
import {
  FIRST_SLICE_INTERACTIVE_SURFACES_ENABLED,
  LOCAL_CHAT_CONTROL_SURFACES_ENABLED,
  LOCAL_CHAT_MUTATION_SURFACES_ENABLED,
  LOCAL_CHAT_RUNTIME_SURFACES_ENABLED
} from "./firstSlice";
import { registerLanguageModelTools } from "./languageModelTools";
import {
  formatOfflineLocalChatCleanupSummary,
  getOfflineLocalChatCleanupReportPath,
  launchOfflineLocalChatCleanup,
  readAndDeleteOfflineLocalChatCleanupReport
} from "./offlineLocalChatCleanup";
import { loadWorkspaceSessionIndex } from "./sessionIndex";
import { SessionInspectorTreeDataProvider } from "./sessionInspectorTree";

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
  const summary = await readAndDeleteOfflineLocalChatCleanupReport(
    getOfflineLocalChatCleanupReportPath(context.globalStorageUri.fsPath)
  );

  if (!summary) {
    return;
  }

  void vscode.window.showInformationMessage(formatOfflineLocalChatCleanupSummary(summary));
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
  return vscode.workspace.getConfiguration("aiRecoveryTooling").get<DiscoveryScope>("sessionDiscoveryScope", "current-workspace");
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
  chatInterop?: ChatInteropApi
): void {
  const getSessionStorageRoots = () => scopedSessionStorageRoots(context);
  context.subscriptions.push(
    vscode.commands.registerCommand("aiRecoveryTooling.refreshSessions", () => {
      tree.refresh();
    }),
    vscode.commands.registerCommand("aiRecoveryTooling.surveyRecentSessions", async () => {
      await runCommand(async () => {
        const markdown = await runWithProgress("Surveying recent agent sessions", () => adapter.renderSurvey(8, getSessionStorageRoots()));
        await openMarkdownDocument(markdown);
      });
    }),
    vscode.commands.registerCommand("aiRecoveryTooling.openLatestTranscriptEvidence", async () => {
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
    vscode.commands.registerCommand("aiRecoveryTooling.openLatestSnapshot", async () => {
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering latest session snapshot", () => adapter.renderSnapshot({ latest: true, storageRoots: getSessionStorageRoots() }));
        await openMarkdownDocument(markdown);
      });
    }),
    vscode.commands.registerCommand("aiRecoveryTooling.openLatestContextEstimate", async () => {
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering latest context estimate", () => adapter.renderContextEstimate({ latest: true, storageRoots: getSessionStorageRoots() }));
        await openMarkdownDocument(markdown);
      });
    }),
    vscode.commands.registerCommand("aiRecoveryTooling.openLatestProfile", async () => {
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering latest session profile", () => adapter.renderProfile({ latest: true, storageRoots: getSessionStorageRoots() }));
        await openMarkdownDocument(markdown);
      });
    }),
    vscode.commands.registerCommand("aiRecoveryTooling.openTranscriptEvidence", async (session?: SessionDescriptor) => {
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
    vscode.commands.registerCommand("aiRecoveryTooling.openSnapshot", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering session snapshot", () => adapter.renderSnapshot(withSessionTarget(resolved, getSessionStorageRoots())));
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("aiRecoveryTooling.openContextEstimate", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering context estimate", () => adapter.renderContextEstimate(withSessionTarget(resolved, getSessionStorageRoots())));
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("aiRecoveryTooling.openProfile", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering session profile", () => adapter.renderProfile(withSessionTarget(resolved, getSessionStorageRoots())));
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("aiRecoveryTooling.openIndex", async (session?: SessionDescriptor) => {
      const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
      if (!resolved) {
        return;
      }
      await runCommand(async () => {
        const markdown = await runWithProgress("Rendering session tail index", () => adapter.renderIndex(withSessionTarget(resolved, getSessionStorageRoots())));
        await openMarkdownDocument(markdown);
      }, resolved);
    }),
    vscode.commands.registerCommand("aiRecoveryTooling.openSessionFile", async (session?: SessionDescriptor) => {
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
      vscode.commands.registerCommand("aiRecoveryTooling.listLiveChats", async () => {
        await runCommand(async () => {
          const chats = await runWithProgress("Listing live chats", () => chatInterop.listChats());
          await openMarkdownDocument(renderChatListMarkdown(chats));
        });
      }),
      vscode.commands.registerCommand("aiRecoveryTooling.revealLiveChat", async (session?: SessionDescriptor) => {
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
      vscode.commands.registerCommand("aiRecoveryTooling.closeVisibleLiveChatTabs", async (session?: SessionDescriptor) => {
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
      vscode.commands.registerCommand("aiRecoveryTooling.deleteLiveChatArtifacts", async (session?: SessionDescriptor) => {
        const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
        if (!resolved) {
          return;
        }
        await runCommand(async () => {
          const selfTargetReason = getExactSelfTargetingReason(await chatInterop.listChats(), resolved.sessionId, "delete-artifacts");
          if (selfTargetReason) {
            throw new Error(selfTargetReason);
          }
          const result = await runWithProgress("Deleting Local chat artifacts", () => chatInterop.deleteChat(resolved.sessionId));
          if (!result.ok) {
            throw new Error(commandResultMessage(result, "Unable to delete Local chat artifacts"));
          }
          const message = commandResultMessage(result, "Deleted Local chat artifacts");
          const scheduleAction = "Schedule offline cleanup";
          const choice = resolved.workspaceStorageDir
            ? await vscode.window.showInformationMessage(message, scheduleAction)
            : await vscode.window.showInformationMessage(message);
          if (choice === scheduleAction) {
            const liveChats = await chatInterop.listChats();
            const keepSessionIds = liveChats
              .filter((item) => item.provider === "workspaceStorage" && item.workspaceId === resolved.workspaceStorageDir.split(path.sep).at(-1))
              .map((item) => item.id);
            launchOfflineLocalChatCleanup({
              extensionRoot: context.extensionPath,
              workspaceStorageDir: resolved.workspaceStorageDir,
              keepSessionIds,
              reportFilePath: getOfflineLocalChatCleanupReportPath(context.globalStorageUri.fsPath)
            });
            void vscode.window.showInformationMessage("Offline Local chat cleanup scheduled. Close VS Code completely to let the helper finish pruning workspace state.");
          }
        }, resolved);
      }),
      vscode.commands.registerCommand("aiRecoveryTooling.scheduleOfflineLocalChatCleanup", async (session?: SessionDescriptor) => {
        const resolved = await resolveSession(adapter, getSessionStorageRoots(), session);
        if (!resolved) {
          return;
        }
        await runCommand(async () => {
          const liveChats = await chatInterop.listChats();
          const keepSessionIds = liveChats
            .filter((item) => item.provider === "workspaceStorage" && item.workspaceId === resolved.workspaceStorageDir.split(path.sep).at(-1))
            .map((item) => item.id);
          launchOfflineLocalChatCleanup({
            extensionRoot: context.extensionPath,
            workspaceStorageDir: resolved.workspaceStorageDir,
            keepSessionIds,
            reportFilePath: getOfflineLocalChatCleanupReportPath(context.globalStorageUri.fsPath)
          });
          void vscode.window.showInformationMessage("Offline Local chat cleanup scheduled. Close VS Code completely to let the helper finish pruning workspace state.");
        }, resolved);
      })
    );
  }

  if (LOCAL_CHAT_MUTATION_SURFACES_ENABLED) {
    context.subscriptions.push(
      vscode.commands.registerCommand("aiRecoveryTooling.createLiveChat", async () => {
        const prompt = await promptForChatPrompt("Create Local Chat");
        if (!prompt) {
          return;
        }
        await runCommand(async () => {
          const result = await runWithProgress("Creating Local chat", () => chatInterop.createChat({
            prompt,
            blockOnResponse: false
          }));
          if (!result.ok) {
            throw new Error(commandResultMessage(result, "Unable to create Local chat"));
          }
          void vscode.window.showInformationMessage(commandResultMessage(result, "Created Local chat"));
        });
      }),
      vscode.commands.registerCommand("aiRecoveryTooling.sendMessageToLiveChat", async (session?: SessionDescriptor) => {
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
          const workflow = await runWithProgress("Sending message to Local chat", () => sendMessageToSessionWithFallback(chatInterop, {
            sessionId: resolved.sessionId,
            prompt,
            blockOnResponse: false
          }));
          if (!workflow.result.ok) {
            throw new Error(commandResultMessage(workflow.result, "Unable to send message to Local chat"));
          }
          void vscode.window.showInformationMessage(
            commandResultMessage(
              workflow.result,
              workflow.usedFallback
                ? "Sent message to Local chat via reveal + focused-chat fallback"
                : "Sent message to Local chat"
            )
          );
        }, resolved);
      }),
      vscode.commands.registerCommand("aiRecoveryTooling.sendMessageToFocusedLiveChat", async () => {
        const prompt = await promptForChatPrompt("Send Message To Focused Local Chat");
        if (!prompt) {
          return;
        }
        await runCommand(async () => {
          const selfTargetReason = getFocusedSelfTargetingReason(await chatInterop.listChats(), "focused-send");
          if (selfTargetReason) {
            throw new Error(selfTargetReason);
          }
          const result = await runWithProgress("Sending message to focused Local chat", () => chatInterop.sendFocusedMessage({
            prompt,
            blockOnResponse: false
          }));
          if (!result.ok) {
            throw new Error(commandResultMessage(result, "Unable to send message to focused Local chat"));
          }
          void vscode.window.showInformationMessage(commandResultMessage(result, "Sent message to focused Local chat"));
        });
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
    vscode.commands.executeCommand("setContext", "aiRecoveryTooling.exactLiveChatRevealSupported", support.canRevealExactSession),
    vscode.commands.executeCommand("setContext", "aiRecoveryTooling.exactLiveChatSendSupported", support.canSendExactSessionMessage),
    vscode.commands.executeCommand("setContext", "aiRecoveryTooling.focusedLiveChatSendSupported", focusedSupport.canSubmitFocusedChatMessage)
  ]);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await maybeReportOfflineLocalChatCleanup(context);
  const adapter = new SessionToolingAdapter();
  const tree = new SessionInspectorTreeDataProvider(
    adapter,
    () => scopedSessionStorageRoots(context)
  );
  context.subscriptions.push(
    tree,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("aiRecoveryTooling.sessionDiscoveryScope")) {
        tree.refresh();
      }
    }),
    vscode.window.createTreeView("aiRecoveryTooling.sessions", {
      treeDataProvider: tree,
      showCollapseAll: true
    })
  );

  let chatInterop: ChatInteropApi | undefined;
  if (FIRST_SLICE_INTERACTIVE_SURFACES_ENABLED || LOCAL_CHAT_RUNTIME_SURFACES_ENABLED) {
    const config = vscode.workspace.getConfiguration("aiRecoveryTooling");
    const chatInteropOptions = {
      workspaceStorageRoots: currentWorkspaceStorageRoots(context),
      postCreateTimeoutMs: config.get<number>("postCreateTimeoutMs", 180000),
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