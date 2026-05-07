import * as fs from "node:fs/promises";
import * as vscode from "vscode";
import {
  buildUnsupportedFocusedSendReason,
  buildUnsupportedRevealReason,
  buildUnsupportedSendReason,
  findDirectAgentOpenCommand,
  findFocusedChatInputCommand,
  findFocusedChatSubmitCommand,
  findExactSessionOpenCommand,
  findExactSessionSendCommand,
  getFocusedChatInteropSupport,
  getExactSessionInteropSupport,
  type ExactSessionInteropSupport,
  type FocusedChatInteropSupport
} from "./capabilities";
import { RejectingMutex } from "./mutex";
import {
  buildPromptFileDispatchArtifact,
  createPromptDispatchUniqueSuffix,
  getDefaultUserPromptsDirectory,
  shouldUsePromptFileDispatch
} from "./promptDispatch";
import { ChatSessionStorage } from "./storage";
import {
  buildCreateChatSelectionBlocker,
  buildFocusedChatSelectionBlocker,
  buildPromptWithAgentSelector,
  buildSendChatSelectionBlocker,
  buildSelectionVerification,
  ChatDispatchInfo,
  ChatCommandResult,
  ChatInteropApi,
  ChatInteropOptions,
  ChatSessionSummary,
  CreateChatRequest,
  InternalChatOpenOptions,
  SendChatMessageRequest,
  toModelSelector
} from "./types";
import { appendUnsettledSessionDiagnostic } from "./unsettledDiagnostics";
import { closeVisibleEditorChatTabsForSession, inspectVisibleEditorChatTabsForSession } from "./editorTabLifecycle";
import { captureCurrentChatFocusReport } from "./editorFocus";
import { toLocalChatSessionResourceString } from "./sessionResource";

const NEW_CHAT_EDITOR_COMMAND = "workbench.action.openChat";
const OPEN_CHAT_COMMAND = "workbench.action.chat.open";
const FOCUS_ACTIVE_EDITOR_GROUP_COMMAND = "workbench.action.focusActiveEditorGroup";
const DEFAULT_OPEN_DELAY_MS = 200;
const DEFAULT_SLASH_COMMAND_SETTLE_DELAY_MS = 900;
const DEFAULT_POST_CREATE_DELAY_MS = 350;
// Treat persistence waits as diagnostic gates, not soft fallbacks. Ninety seconds is
// long enough for slower hosts while surfacing hangs sooner as actionable failures.
const DEFAULT_POST_CREATE_TIMEOUT_MS = 90_000;
const DEFAULT_PROMPT_REGISTRATION_DELAY_MS = 350;

export class ChatInteropService implements ChatInteropApi {
  private readonly mutex = new RejectingMutex();
  private readonly storage: ChatSessionStorage;
  private readonly openDelayMs: number;
  private readonly postCreateDelayMs: number;
  private readonly postCreateTimeoutMs: number;
  private readonly defaultWaitForPersisted: boolean;
  private readonly promptRegistrationDelayMs: number;
  private readonly slashCommandSettleDelayMs: number;

  constructor(
    private readonly context: vscode.ExtensionContext,
    options: ChatInteropOptions = {}
  ) {
    this.storage = new ChatSessionStorage(context, options);
    this.openDelayMs = options.openDelayMs ?? DEFAULT_OPEN_DELAY_MS;
    this.postCreateDelayMs = options.postCreateDelayMs ?? DEFAULT_POST_CREATE_DELAY_MS;
    this.postCreateTimeoutMs = options.postCreateTimeoutMs ?? DEFAULT_POST_CREATE_TIMEOUT_MS;
    this.defaultWaitForPersisted = options.waitForPersistedDefault ?? true;
    this.promptRegistrationDelayMs = options.promptRegistrationDelayMs ?? DEFAULT_PROMPT_REGISTRATION_DELAY_MS;
    this.slashCommandSettleDelayMs = Math.max(this.openDelayMs, DEFAULT_SLASH_COMMAND_SETTLE_DELAY_MS);
  }

  async listChats(): Promise<ChatSessionSummary[]> {
    return this.storage.listSessions();
  }

  getPostCreateTimeoutMs(): number {
    return this.postCreateTimeoutMs;
  }

  async getExactSessionInteropSupport(): Promise<ExactSessionInteropSupport> {
    return getExactSessionInteropSupport(await vscode.commands.getCommands(true));
  }

  async getFocusedChatInteropSupport(): Promise<FocusedChatInteropSupport> {
    return getFocusedChatInteropSupport(await vscode.commands.getCommands(true));
  }

  async createChat(request: CreateChatRequest): Promise<ChatCommandResult> {
    if (!request.prompt?.trim()) {
      return { ok: false, reason: "prompt is required" };
    }

    const directAgentOpenAvailable = request.agentName?.trim()
      ? Boolean(await this.findDirectAgentOpenCommand(request.agentName))
      : false;
    const selectionBlocker = buildCreateChatSelectionBlocker(request, {
      directAgentOpenAvailable
    });
    if (selectionBlocker) {
      return { ok: false, reason: selectionBlocker };
    }

    let lease: { release(): void } | undefined;
    try {
      lease = this.acquireLease();
    } catch (error) {
      return toErrorResult(error);
    }

    try {
      const before = await this.storage.listSessions();
      await this.traceCreateDebug("create.before-open", { request });
      await vscode.commands.executeCommand(NEW_CHAT_EDITOR_COMMAND);
      await delay(this.openDelayMs);
      await this.traceCreateDebug("create.after-open");
      await vscode.commands.executeCommand(FOCUS_ACTIVE_EDITOR_GROUP_COMMAND);
      await delay(this.openDelayMs);
      await this.traceCreateDebug("create.after-focus-editor-group");

      const { dispatch, cleanup } = await this.dispatchCreateRequest(request);
      await this.traceCreateDebug("create.after-dispatch", { dispatch });
      const { session: created, selection, settled } = await this.waitForCreatedSession(before, request, dispatch);
      await this.traceCreateDebug("create.after-wait", {
        createdSessionId: created?.id,
        settled,
        selection
      });

      await cleanup?.();

      if (!created) {
        return {
          ok: false,
          reason: "Create chat dispatched but no persisted created session was observed within the expected timeout.",
          selection,
          dispatch
        };
      }

      if (request.blockOnResponse && created && !settled) {
        return {
          ok: false,
          reason: await appendUnsettledSessionDiagnostic(
            "Created chat session was observed, but it did not reach a settled state within the expected timeout.",
            created
          ),
          session: created,
          selection,
          dispatch
        };
      }

      if (request.requireSelectionEvidence && !selection.allRequestedVerified) {
        return {
          ok: false,
          reason: buildSelectionEvidenceFailure(selection, request.partialQuery === true),
          session: created,
          selection,
          dispatch
        };
      }

      return {
        ok: true,
        session: created,
        selection,
        dispatch
      };
    } catch (error) {
      return toErrorResult(error);
    } finally {
      lease?.release();
    }
  }

  async sendMessage(request: SendChatMessageRequest): Promise<ChatCommandResult> {
    if (!request.prompt?.trim()) {
      return { ok: false, reason: "prompt is required" };
    }

    let lease: { release(): void } | undefined;
    try {
      lease = this.acquireLease();
    } catch (error) {
      return toErrorResult(error);
    }

    try {
      const target = await this.storage.getSessionById(request.sessionId);
      if (!target) {
        return { ok: false, reason: `session not found: ${request.sessionId}` };
      }

      const selectionBlocker = buildSendChatSelectionBlocker(request);
      if (selectionBlocker) {
        return {
          ok: false,
          reason: selectionBlocker
        };
      }

      const command = await this.findExactSessionSendCommand();
      if (!command) {
        return {
          ok: false,
          reason: await this.buildUnsupportedSendReason()
        };
      }

      const dispatchedPrompt = buildPromptWithAgentSelector(request.prompt, request.agentName);
      await this.openExactSessionWithPrompt(command, target.id, dispatchedPrompt, request.blockOnResponse ?? false);

      let session = await this.storage.getSessionById(target.id);
      if (request.blockOnResponse) {
        const waitResult = await this.waitForExactSessionMutation(target.id, target.lastUpdated, true);
        session = waitResult.session;
        if (!waitResult.observedMutation) {
          return {
            ok: false,
            reason: "Exact session send dispatched but no persisted session mutation was observed within the expected timeout."
          };
        }
        if (!waitResult.settled) {
          return {
            ok: false,
            reason: await appendUnsettledSessionDiagnostic(
              "Exact session send dispatched and a persisted mutation was observed, but the target session did not reach a settled state within the expected timeout.",
              session
            ),
            session
          };
        }
      }

      const dispatch: ChatDispatchInfo = {
        surface: "chat-open",
        dispatchedPrompt
      };
      const selection = buildSelectionVerification(request, session, dispatch);

      if (request.requireSelectionEvidence && !selection.allRequestedVerified) {
        return {
          ok: false,
          reason: buildSelectionEvidenceFailure(selection, false),
          session,
          selection,
          dispatch
        };
      }

      return {
        ok: true,
        session,
        selection,
        dispatch
      };
    } catch (error) {
      return toErrorResult(error);
    } finally {
      lease?.release();
    }
  }

  async sendFocusedMessage(request: CreateChatRequest): Promise<ChatCommandResult> {
    if (!request.prompt?.trim()) {
      return { ok: false, reason: "prompt is required" };
    }

    let lease: { release(): void } | undefined;
    try {
      lease = this.acquireLease();
    } catch (error) {
      return toErrorResult(error);
    }

    try {
      const selectionBlocker = buildFocusedChatSelectionBlocker(request);
      if (selectionBlocker) {
        return {
          ok: false,
          reason: selectionBlocker
        };
      }

      const commandSupport = await this.getFocusedChatInteropSupport();
      if (!commandSupport.canSubmitFocusedChatMessage || !commandSupport.focusInputCommand || !commandSupport.submitCommand) {
        return {
          ok: false,
          reason: commandSupport.unsupportedReason ?? await this.buildUnsupportedFocusedSendReason()
        };
      }

      const before = await this.storage.listSessions();
      let focusedInputMs = 0;
      let prefillMs = 0;
      let submitMs = 0;
      let focusedMutationWaitMs = 0;
      let focusedMutationPollCount = 0;
      let focusedMutationScanMs = 0;

      const buildFocusedSendTimingLifecycle = (): NonNullable<ChatCommandResult["revealLifecycle"]> => ({
        closedMatchingVisibleTabs: 0,
        closedTabLabels: [],
        timingMs: {
          focusedInputMs,
          prefillMs,
          submitMs,
          focusedMutationWaitMs,
          focusedMutationPollCount,
          focusedMutationScanMs
        }
      });

      const dispatchedPrompt = buildPromptWithAgentSelector(request.prompt, request.agentName);
      const dispatch: ChatDispatchInfo = {
        surface: "focused-chat-submit",
        dispatchedPrompt
      };

      const focusedInputStartedAt = Date.now();
      await vscode.commands.executeCommand(commandSupport.focusInputCommand);
      focusedInputMs = Date.now() - focusedInputStartedAt;
      await delay(this.openDelayMs);

      const prefillStartedAt = Date.now();
      await this.prefillFocusedChat(request, dispatchedPrompt);
      prefillMs = Date.now() - prefillStartedAt;
      await delay(this.openDelayMs);

      const submitStartedAt = Date.now();
      await vscode.commands.executeCommand(commandSupport.submitCommand);
      submitMs = Date.now() - submitStartedAt;

      const beforeById = new Map(before.map((item) => [item.id, item.lastUpdated]));

      const waitForPersisted = request.waitForPersisted !== undefined ? request.waitForPersisted : this.defaultWaitForPersisted;

      if (!waitForPersisted) {
        // Non-blocking/one-shot path: check once for an immediate persisted touch and return.
        const after = await this.storage.listSessions();
        const candidate = pickTouchedSession(beforeById, after);
        const selection = buildSelectionVerification(request, candidate, dispatch);

        if (request.requireSelectionEvidence && !selection.allRequestedVerified) {
          return {
            ok: false,
            reason: buildSelectionEvidenceFailure(selection, false),
            session: candidate,
            selection,
            dispatch,
            revealLifecycle: buildFocusedSendTimingLifecycle()
          };
        }

        return {
          ok: true,
          session: candidate,
          selection,
          dispatch,
          revealLifecycle: buildFocusedSendTimingLifecycle()
        };
      }

      const focusedMutationWaitStartedAt = Date.now();
      const {
        session,
        selection,
        observedMutation,
        settled,
        pollCount,
        scanMs
      } = await this.waitForFocusedSessionMutation(before, request, dispatch);
      focusedMutationWaitMs = Date.now() - focusedMutationWaitStartedAt;
      focusedMutationPollCount = pollCount;
      focusedMutationScanMs = scanMs;
      if (!session || !observedMutation) {
        return {
          ok: false,
          reason: "Focused chat submit dispatched but no persisted session mutation was observed within the expected timeout.",
          selection,
          dispatch,
          revealLifecycle: buildFocusedSendTimingLifecycle()
        };
      }

      if (request.blockOnResponse && !settled) {
        return {
          ok: false,
          reason: await appendUnsettledSessionDiagnostic(
            "Focused chat submit dispatched and a persisted mutation was observed, but the session did not reach a settled state within the expected timeout.",
            session
          ),
          session,
          selection,
          dispatch,
          revealLifecycle: buildFocusedSendTimingLifecycle()
        };
      }

      if (request.requireSelectionEvidence && !selection.allRequestedVerified) {
        return {
          ok: false,
          reason: buildSelectionEvidenceFailure(selection, false),
          session,
          selection,
          dispatch,
          revealLifecycle: buildFocusedSendTimingLifecycle()
        };
      }

      return {
        ok: true,
        session,
        selection,
        dispatch,
        revealLifecycle: buildFocusedSendTimingLifecycle()
      };
    } catch (error) {
      return toErrorResult(error);
    } finally {
      lease?.release();
    }
  }

  async closeVisibleTabs(sessionId: string): Promise<ChatCommandResult> {
    let lease: { release(): void } | undefined;
    try {
      lease = this.acquireLease();
    } catch (error) {
      return toErrorResult(error);
    }

    try {
      const session = await this.storage.getSessionById(sessionId);
      if (!session) {
        return { ok: false, reason: `session not found: ${sessionId}` };
      }

      const closedTabs = await closeVisibleEditorChatTabsForSession({
        sessionId: session.id,
        sessionTitle: session.title
      });
      return {
        ok: true,
        session,
        revealLifecycle: {
          closedMatchingVisibleTabs: closedTabs.closedCount,
          closedTabLabels: closedTabs.closedLabels
        }
      };
    } catch (error) {
      return toErrorResult(error);
    } finally {
      lease?.release();
    }
  }

  async deleteChat(sessionId: string): Promise<ChatCommandResult> {
    let lease: { release(): void } | undefined;
    try {
      lease = this.acquireLease();
    } catch (error) {
      return toErrorResult(error);
    }

    try {
      const session = await this.storage.getExactSessionById(sessionId);
      if (!session) {
        const sessions = await this.storage.listSessions();
        const prefixMatches = sessions.filter((candidate) =>
          candidate.id.startsWith(sessionId) || sessionId.startsWith(candidate.id)
        );
        if (prefixMatches.length > 0) {
          const matchedIds = prefixMatches.slice(0, 3).map((candidate) => candidate.id).join(", ");
          const extraMatches = prefixMatches.length > 3 ? ` (+${prefixMatches.length - 3} more)` : "";
          return {
            ok: false,
            reason: `deleteChat requires an exact session id. Prefix input ${sessionId} matched ${matchedIds}${extraMatches}. Re-run with the full session id.`
          };
        }

        return { ok: false, reason: `session not found: ${sessionId}` };
      }

      const preDeleteInspection = inspectVisibleEditorChatTabsForSession({
        sessionId: session.id,
        sessionTitle: session.title
      });
      if (preDeleteInspection.titleOnlyMatchCount > 0) {
        const titleOnlyLabels = preDeleteInspection.titleOnlyMatchLabels.length > 0
          ? preDeleteInspection.titleOnlyMatchLabels.map((label) => JSON.stringify(label)).join(", ")
          : "-";
        return {
          ok: false,
          reason: `Delete blocked for session ${session.id}: found ${preDeleteInspection.titleOnlyMatchCount} visible editor chat tab(s) that matched only by title (${titleOnlyLabels}) and could not be safely attributed to the exact session resource. Close that editor chat explicitly first, then retry delete.`,
          session,
          revealLifecycle: {
            closedMatchingVisibleTabs: 0,
            closedTabLabels: []
          }
        };
      }

      const closedTabs = await closeVisibleEditorChatTabsForSession({
        sessionId: session.id,
        sessionTitle: session.title,
        matchMode: "resource-only"
      });
      const postCloseInspection = inspectVisibleEditorChatTabsForSession({
        sessionId: session.id,
        sessionTitle: session.title,
        matchMode: "resource-only"
      });
      if (postCloseInspection.resourceMatchCount > 0) {
        const remainingLabels = postCloseInspection.resourceMatchLabels.length > 0
          ? postCloseInspection.resourceMatchLabels.map((label) => JSON.stringify(label)).join(", ")
          : "-";
        return {
          ok: false,
          reason: `Delete blocked for session ${session.id}: ${postCloseInspection.resourceMatchCount} exact resource-matched editor chat tab(s) remained visible after the close step (${remainingLabels}).`,
          session,
          revealLifecycle: {
            closedMatchingVisibleTabs: closedTabs.closedCount,
            closedTabLabels: closedTabs.closedLabels
          }
        };
      }

      const artifactDeletion = await this.storage.deleteSessionArtifacts(session);
      if ((artifactDeletion.lingeringPaths?.length ?? 0) > 0) {
        const lingeringLabels = artifactDeletion.lingeringPaths?.map((artifactPath) => JSON.stringify(artifactPath)).join(", ") ?? "-";
        return {
          ok: false,
          reason: `Delete blocked for session ${session.id}: artifact path(s) remained after deletion (${lingeringLabels}).`,
          session,
          revealLifecycle: {
            closedMatchingVisibleTabs: closedTabs.closedCount,
            closedTabLabels: closedTabs.closedLabels
          },
          artifactDeletion
        };
      }

      const postDeleteSession = await this.storage.getExactSessionById(session.id);
      if (postDeleteSession) {
        return {
          ok: false,
          reason: `Delete blocked for session ${session.id}: the session still resolved from persisted storage after artifact deletion.`,
          session,
          revealLifecycle: {
            closedMatchingVisibleTabs: closedTabs.closedCount,
            closedTabLabels: closedTabs.closedLabels
          },
          artifactDeletion
        };
      }

      const postDeleteInspection = inspectVisibleEditorChatTabsForSession({
        sessionId: session.id,
        sessionTitle: session.title
      });
      if (postDeleteInspection.resourceMatchCount > 0 || postDeleteInspection.titleOnlyMatchCount > 0) {
        const lingeringLabels = [
          ...postDeleteInspection.resourceMatchLabels,
          ...postDeleteInspection.titleOnlyMatchLabels
        ];
        const uniqueLingeringLabels = lingeringLabels.length > 0
          ? [...new Set(lingeringLabels)].map((label) => JSON.stringify(label)).join(", ")
          : "-";
        return {
          ok: false,
          reason: `Delete blocked for session ${session.id}: matching editor chat tabs were still visible after artifact deletion (resourceMatches=${postDeleteInspection.resourceMatchCount}, titleOnlyMatches=${postDeleteInspection.titleOnlyMatchCount}; labels=${uniqueLingeringLabels}).`,
          session,
          revealLifecycle: {
            closedMatchingVisibleTabs: closedTabs.closedCount,
            closedTabLabels: closedTabs.closedLabels
          },
          artifactDeletion
        };
      }

      return {
        ok: true,
        session,
        revealLifecycle: {
          closedMatchingVisibleTabs: closedTabs.closedCount,
          closedTabLabels: closedTabs.closedLabels
        },
        artifactDeletion
      };
    } catch (error) {
      return toErrorResult(error);
    } finally {
      lease?.release();
    }
  }

  async revealChat(sessionId: string): Promise<ChatCommandResult> {
    let lease: { release(): void } | undefined;
    try {
      lease = this.acquireLease();
    } catch (error) {
      return toErrorResult(error);
    }

    try {
      const session = await this.storage.getSessionById(sessionId);
      if (!session) {
        return { ok: false, reason: `session not found: ${sessionId}` };
      }

      const command = await this.findExactSessionOpenCommand();
      if (!command) {
        return {
          ok: false,
          reason: await this.buildUnsupportedRevealReason()
        };
      }

      const closedTabs = await closeVisibleEditorChatTabsForSession({
        sessionId: session.id,
        sessionTitle: session.title
      });
      if (closedTabs.closedCount > 0) {
        await delay(this.openDelayMs);
      }

      await this.openExactSession(command, session.id);
      return {
        ok: true,
        session,
        revealLifecycle: {
          closedMatchingVisibleTabs: closedTabs.closedCount,
          closedTabLabels: closedTabs.closedLabels
        }
      };
    } catch (error) {
      return toErrorResult(error);
    } finally {
      lease?.release();
    }
  }

  private acquireLease(): { release(): void } {
    return this.mutex.tryAcquire("chat interop");
  }

  private async findExactSessionOpenCommand(): Promise<string | undefined> {
    return findExactSessionOpenCommand(await vscode.commands.getCommands(true));
  }

  private async findExactSessionSendCommand(): Promise<string | undefined> {
    return findExactSessionSendCommand(await vscode.commands.getCommands(true));
  }

  private async findDirectAgentOpenCommand(agentName: string | undefined): Promise<string | undefined> {
    return findDirectAgentOpenCommand(await vscode.commands.getCommands(true), agentName);
  }

  private async buildUnsupportedRevealReason(): Promise<string> {
    return buildUnsupportedRevealReason(await vscode.commands.getCommands(true));
  }

  private async buildUnsupportedSendReason(): Promise<string> {
    return buildUnsupportedSendReason(await vscode.commands.getCommands(true));
  }

  private async findFocusedChatInputCommand(): Promise<string | undefined> {
    return findFocusedChatInputCommand(await vscode.commands.getCommands(true));
  }

  private async findFocusedChatSubmitCommand(): Promise<string | undefined> {
    return findFocusedChatSubmitCommand(await vscode.commands.getCommands(true));
  }

  private async buildUnsupportedFocusedSendReason(): Promise<string> {
    return buildUnsupportedFocusedSendReason(await vscode.commands.getCommands(true));
  }

  private async openExactSession(command: string, sessionId: string): Promise<void> {
    await vscode.commands.executeCommand(command, {
      resource: toLocalChatSessionUri(sessionId)
    });
  }

  private async openExactSessionWithPrompt(command: string, sessionId: string, prompt: string, blockOnResponse: boolean): Promise<void> {
    await vscode.commands.executeCommand(command, {
      resource: toLocalChatSessionUri(sessionId),
      prompt,
      attachedContext: [],
      blockOnResponse
    });
  }

  private async prefillFocusedChat(request: CreateChatRequest, query: string, isPartialQuery = true): Promise<void> {
    const options: InternalChatOpenOptions = {
      query,
      isPartialQuery,
      blockOnResponse: false
    };

    await vscode.commands.executeCommand(OPEN_CHAT_COMMAND, options);
  }

  private async dispatchViaFocusedChatSubmit(
    request: CreateChatRequest | SendChatMessageRequest,
    query: string
  ): Promise<boolean> {
    const commandSupport = await this.getFocusedChatInteropSupport();
    if (!commandSupport.canSubmitFocusedChatMessage || !commandSupport.focusInputCommand || !commandSupport.submitCommand) {
      return false;
    }

    await this.traceCreateDebug("focused-submit.before-focus-input", { query });
    await vscode.commands.executeCommand(commandSupport.focusInputCommand);
    await delay(this.openDelayMs);
    await this.traceCreateDebug("focused-submit.after-focus-input", { query });
    const isSlashCommandDispatch = query.trimStart().startsWith("/");
    await this.prefillFocusedChat(request, query, !isSlashCommandDispatch);
    await this.traceCreateDebug("focused-submit.after-prefill", { query });
    if (isSlashCommandDispatch) {
      await delay(this.slashCommandSettleDelayMs);
      await vscode.commands.executeCommand(commandSupport.focusInputCommand);
      await delay(this.openDelayMs);
      await this.traceCreateDebug("focused-submit.after-slash-refocus", { query });
    } else {
      await delay(this.openDelayMs);
    }
    await this.traceCreateDebug("focused-submit.before-submit", { query });
    await vscode.commands.executeCommand(commandSupport.submitCommand);
    await this.traceCreateDebug("focused-submit.after-submit", { query });
    return true;
  }

  private async dispatchCreateRequest(
    request: CreateChatRequest
  ): Promise<{ dispatch: ChatDispatchInfo; cleanup?: () => Promise<void> }> {
    const directAgentCommand = shouldUsePromptFileDispatch(request)
      ? await this.findDirectAgentOpenCommand(request.agentName)
      : undefined;

    if (directAgentCommand) {
      const dispatchedPrompt = request.prompt.trim();
      await this.dispatchViaDirectAgentCommand(request, directAgentCommand, dispatchedPrompt);
      return {
        dispatch: {
          surface: "chat-open",
          dispatchedPrompt
        }
      };
    }

    if (!shouldUsePromptFileDispatch(request)) {
      const dispatchedPrompt = buildPromptWithAgentSelector(request.prompt, request.agentName);
      await this.dispatchToActiveChat(request, dispatchedPrompt);
      return {
        dispatch: {
          surface: "chat-open",
          dispatchedPrompt
        }
      };
    }

    return this.dispatchViaPromptFile(request);
  }

  private async dispatchViaDirectAgentCommand(
    request: CreateChatRequest,
    command: string,
    prompt: string
  ): Promise<void> {
    await vscode.commands.executeCommand(command);
    await delay(this.openDelayMs);
    const dispatched = await this.dispatchViaFocusedChatSubmit(
      {
        ...request,
        agentName: undefined
      },
      prompt
    );

    if (!dispatched) {
      await this.dispatchToActiveChat(
        {
          ...request,
          agentName: undefined
        },
        prompt
      );
    }
  }

  private async dispatchViaPromptFile(
    request: CreateChatRequest
  ): Promise<{ dispatch: ChatDispatchInfo; cleanup: () => Promise<void> }> {
    const promptsDirectory = getDefaultUserPromptsDirectory();
    const artifact = buildPromptFileDispatchArtifact(
      request,
      promptsDirectory,
      createPromptDispatchUniqueSuffix()
    );

    const cleanup = async (): Promise<void> => {
      await fs.rm(artifact.filePath, { force: true });
    };

    try {
      await fs.mkdir(promptsDirectory, { recursive: true });
      await fs.writeFile(artifact.filePath, artifact.content, "utf8");
      await this.traceCreateDebug("prompt-file.after-write", {
        filePath: artifact.filePath,
        slashCommand: artifact.slashCommand
      });
      await delay(this.promptRegistrationDelayMs);
      const dispatched = await this.dispatchViaFocusedChatSubmit(
        {
          ...request,
          agentName: undefined
        },
        `/${artifact.slashCommand}`
      );

      if (!dispatched) {
        await this.traceCreateDebug("prompt-file.focused-submit-unavailable", {
          slashCommand: artifact.slashCommand
        });
        await this.dispatchToActiveChat(
          {
            ...request,
            agentName: undefined
          },
          `/${artifact.slashCommand}`
        );
      }
    } catch (error) {
      await cleanup();
      throw error;
    }

    return {
      dispatch: {
        surface: "prompt-file-slash-command",
        dispatchedPrompt: request.prompt.trim(),
        slashCommand: `/${artifact.slashCommand}`
      },
      cleanup
    };
  }

  private async dispatchToActiveChat(request: CreateChatRequest | SendChatMessageRequest, query: string): Promise<void> {
    const options: InternalChatOpenOptions = {
      query,
      isPartialQuery: request.partialQuery ?? false,
      mode: request.mode,
      modelSelector: toModelSelector(request.modelSelector),
      blockOnResponse: request.blockOnResponse ?? false
    };

    await vscode.commands.executeCommand(OPEN_CHAT_COMMAND, options);
  }

  private async traceCreateDebug(step: string, details: Record<string, unknown> = {}): Promise<void> {
    try {
      const chats = await this.storage.listSessions();
      const focusReport = captureCurrentChatFocusReport(chats);
      const logPath = vscode.Uri.joinPath(this.context.globalStorageUri, "chat-interop-create-debug.jsonl").fsPath;
      await fs.mkdir(this.context.globalStorageUri.fsPath, { recursive: true });
      await fs.appendFile(logPath, `${JSON.stringify({
        at: new Date().toISOString(),
        step,
        details,
        focusReport
      })}\n`, "utf8");
    } catch {
      // Debug logging must not change create behavior.
    }
  }

  private async waitForCreatedSession(
    before: ChatSessionSummary[],
    request: CreateChatRequest,
    dispatch: ChatDispatchInfo
  ): Promise<{ session: ChatSessionSummary | undefined; selection: ReturnType<typeof buildSelectionVerification>; settled: boolean }> {
    const beforeIds = new Set(before.map((item) => item.id));
    const deadline = Date.now() + this.postCreateTimeoutMs;
    let candidate: ChatSessionSummary | undefined;
    let after = before;
    const requireSettled = request.blockOnResponse === true;

    while (Date.now() <= deadline) {
      await delay(this.postCreateDelayMs);
      after = await this.storage.listSessions();

      const candidateId = candidate?.id;
      candidate = pickCreatedSession(beforeIds, after)
        ?? (candidateId ? after.find((item) => item.id === candidateId) ?? candidate : undefined);
      const session = candidate;
      const selection = buildSelectionVerification(request, session, dispatch);
      const settled = !requireSettled || isSessionSettled(session);
      const clean = isSessionCleanForCreateSelection(session);

      if (!request.requireSelectionEvidence) {
        if (session && settled && clean) {
          return { session, selection, settled };
        }
        continue;
      }

      if (candidate && selection.allRequestedVerified && settled && clean) {
        return { session, selection, settled };
      }
    }

    const session = candidate;
    return {
      session,
      selection: buildSelectionVerification(request, session, dispatch),
      settled: !requireSettled || isSessionSettled(session)
    };
  }

  private async waitForFocusedSessionMutation(
    before: ChatSessionSummary[],
    request: CreateChatRequest,
    dispatch: ChatDispatchInfo
  ): Promise<{
    session: ChatSessionSummary | undefined;
    selection: ReturnType<typeof buildSelectionVerification>;
    observedMutation: boolean;
    settled: boolean;
    pollCount: number;
    scanMs: number;
  }> {
    const beforeById = new Map(before.map((item) => [item.id, item.lastUpdated]));
    const deadline = Date.now() + this.postCreateTimeoutMs;
    let candidate: ChatSessionSummary | undefined;
    let observedMutation = false;
    let pollCount = 0;
    let scanMs = 0;
    const requireSettled = request.blockOnResponse === true;

    while (Date.now() <= deadline) {
      await delay(this.postCreateDelayMs);
      pollCount += 1;
      const scanStartedAt = Date.now();
      const after = await this.storage.listSessions();
      scanMs += Date.now() - scanStartedAt;

      const touched = pickTouchedSession(beforeById, after);
      if (touched) {
        candidate = touched;
        observedMutation = true;
      } else if (candidate) {
        const candidateId = candidate.id;
        candidate = after.find((item) => item.id === candidateId) ?? candidate;
      }
      const selection = buildSelectionVerification(request, candidate, dispatch);
      const settled = observedMutation && (!requireSettled || isSessionSettled(candidate));
      const clean = isSessionCleanForCreateSelection(candidate);

      if (!request.requireSelectionEvidence) {
        if (settled && clean) {
          return { session: candidate, selection, observedMutation, settled, pollCount, scanMs };
        }
        continue;
      }

      if (candidate && selection.allRequestedVerified && settled && clean) {
        return { session: candidate, selection, observedMutation, settled, pollCount, scanMs };
      }
    }

    return {
      session: candidate,
      selection: buildSelectionVerification(request, candidate, dispatch),
      observedMutation,
      settled: observedMutation && (!requireSettled || isSessionSettled(candidate)),
      pollCount,
      scanMs
    };
  }

  private async waitForExactSessionMutation(
    sessionId: string,
    previousLastUpdated: string | undefined,
    requireSettled: boolean
  ): Promise<{ session: ChatSessionSummary | undefined; observedMutation: boolean; settled: boolean }> {
    const deadline = Date.now() + this.postCreateTimeoutMs;
    let candidate = await this.storage.getSessionById(sessionId);
    let observedMutation = Boolean(candidate && (!previousLastUpdated || candidate.lastUpdated !== previousLastUpdated));

    while (Date.now() <= deadline) {
      const settled = observedMutation && (!requireSettled || isSessionSettled(candidate));
      if (settled) {
        return { session: candidate, observedMutation, settled };
      }

      await delay(this.postCreateDelayMs);
      candidate = await this.storage.getSessionById(sessionId);
      observedMutation = observedMutation
        || Boolean(candidate && (!previousLastUpdated || candidate.lastUpdated !== previousLastUpdated));
    }

    return {
      session: candidate,
      observedMutation,
      settled: observedMutation && (!requireSettled || isSessionSettled(candidate))
    };
  }
}

function toLocalChatSessionUri(sessionId: string): vscode.Uri {
  return vscode.Uri.parse(toLocalChatSessionResourceString(sessionId));
}

function pickCreatedSession(beforeIds: Set<string>, after: ChatSessionSummary[]): ChatSessionSummary | undefined {
  return pickPreferredCreatedSession(after.filter((item) => !beforeIds.has(item.id)));
}

function pickTouchedSession(
  beforeById: Map<string, string>,
  after: ChatSessionSummary[]
): ChatSessionSummary | undefined {
  return pickPreferredCreatedSession(after.filter((item) => beforeById.get(item.id) !== item.lastUpdated));
}

function pickPreferredCreatedSession(sessions: ChatSessionSummary[]): ChatSessionSummary | undefined {
  return pickLatestSession(sessions.filter((item) => isSessionCleanForCreateSelection(item)))
    ?? pickLatestSession(sessions);
}

function pickLatestSession(sessions: ChatSessionSummary[]): ChatSessionSummary | undefined {
  let latest: ChatSessionSummary | undefined;
  let latestUpdatedAt = -Infinity;

  for (const session of sessions) {
    const updatedAt = parseIsoTimestamp(session.lastUpdated) ?? -Infinity;
    if (!latest || updatedAt >= latestUpdatedAt) {
      latest = session;
      latestUpdatedAt = updatedAt;
    }
  }

  return latest;
}

function isSessionSettled(session: ChatSessionSummary | undefined): boolean {
  if (!session) {
    return false;
  }

  if ((session.pendingRequestCount ?? 0) > 0) {
    return false;
  }

  if (session.lastRequestCompleted === false) {
    return false;
  }

  if (session.hasPendingEdits === true) {
    return session.lastRequestCompleted === true && (session.pendingRequestCount ?? 0) === 0;
  }

  return true;
}

function isSessionCleanForCreateSelection(session: ChatSessionSummary | undefined): boolean {
  return session?.hasControlThreadArtifacts !== true;
}

function toErrorResult(error: unknown): ChatCommandResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    error: message,
    reason: message
  };
}

function buildSelectionEvidenceFailure(
  selection: NonNullable<ChatCommandResult["selection"]>,
  prefilledOnly: boolean
): string {
  const failures = [
    formatSelectionFailure("agent", selection.agent),
    formatSelectionFailure("mode", selection.mode),
    formatSelectionFailure("model", selection.model)
  ].filter((value): value is string => Boolean(value));

  const prefix = prefilledOnly
    ? "Prefilled draft opened without dispatch, but requested selection could not be fully evidenced on this live chat surface."
    : "Requested selection could not be fully evidenced on this live chat surface.";

  return `${prefix} ${failures.join(" ")}`.trim();
}

function formatSelectionFailure(
  label: string,
  check: NonNullable<ChatCommandResult["selection"]>["agent"]
): string | undefined {
  if (check.status === "not-requested" || check.status === "verified") {
    return undefined;
  }
  if (check.status === "mismatch") {
    return `${label} requested ${JSON.stringify(check.requested ?? "-")} but observed ${JSON.stringify(check.observed ?? "-")}.`;
  }
  if (check.status === "dispatched-via-artifact") {
    return `${label} was dispatched through a stronger request artifact but is not independently verified in persisted session metadata yet.`;
  }
  return `${label} requested ${JSON.stringify(check.requested ?? "-")} but no explicit verification was available.`;
}

function parseIsoTimestamp(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}