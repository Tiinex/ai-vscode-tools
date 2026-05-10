import type { Stats } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  buildUnsupportedSendReason,
  buildUnsupportedFocusedSendReason,
  buildUnsupportedRevealReason,
  findDirectAgentOpenCommand as resolveDirectAgentOpenCommand,
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
import { appendUnsettledSessionDiagnostic, getSessionQuiescenceState } from "./unsettledDiagnostics";
import { closeVisibleEditorChatTabsForSession, inspectVisibleEditorChatTabsForSession } from "./editorTabLifecycle";
import { captureCurrentChatFocusReport } from "./editorFocus";
import { toLocalChatSessionResourceString } from "./sessionResource";

const NEW_CHAT_EDITOR_COMMAND = "workbench.action.openChat";
const OPEN_CHAT_COMMAND = "workbench.action.chat.open";
const FOCUS_ACTIVE_EDITOR_GROUP_COMMAND = "workbench.action.focusActiveEditorGroup";
const DEFAULT_OPEN_DELAY_MS = 200;
const DEFAULT_SLASH_COMMAND_SETTLE_DELAY_MS = 900;
const DEFAULT_POST_CREATE_DELAY_MS = 350;
// Treat persistence waits as diagnostic gates, not soft fallbacks. Use a long wall-clock
// budget so agent-led development slices can survive slower model turns without the Local
// tooling bailing out early on otherwise healthy sessions.
const DEFAULT_POST_CREATE_TIMEOUT_MS = 900_000;
const DEFAULT_PROMPT_REGISTRATION_DELAY_MS = 350;
const DEFAULT_TRANSCRIPT_QUIET_WINDOW_MS = 1_000;

type SessionMutationBaseline = {
  lastUpdated?: string;
  sessionFileMtimeMs?: number;
  sessionFileSize?: number;
};

export class ChatInteropService implements ChatInteropApi {
  private readonly mutex = new RejectingMutex();
  private readonly storage: ChatSessionStorage;
  private readonly openDelayMs: number;
  private readonly postCreateDelayMs: number;
  private readonly postCreateTimeoutMs: number;
  private readonly defaultWaitForPersisted: boolean;
  private readonly promptRegistrationDelayMs: number;
  private readonly slashCommandSettleDelayMs: number;
  private readonly transcriptQuietWindowMs: number;

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
    this.transcriptQuietWindowMs = Math.max(this.postCreateDelayMs, DEFAULT_TRANSCRIPT_QUIET_WINDOW_MS);
  }

  async listChats(): Promise<ChatSessionSummary[]> {
    return this.storage.listSessions();
  }

  async getSessionById(sessionId: string): Promise<ChatSessionSummary | undefined> {
    return this.storage.getSessionById(sessionId);
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

    const selectionBlocker = buildCreateChatSelectionBlocker(request, {
      directAgentOpenAvailable: Boolean(await this.findDirectAgentOpenCommand(request.agentName))
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
      lease?.release();
      lease = undefined;
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
        const waitResult = await this.waitForExactSessionMutation(target.id, undefined, true);
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
            reason: "Exact session send dispatched and a persisted mutation was observed, but the target session did not reach a settled state within the expected timeout.",
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
  const beforeBaselines = await captureSessionMutationBaselines(before);
      let cleanup: (() => Promise<void>) | undefined;
      let focusedInputMs = 0;
      let prefillMs = 0;
      let submitMs = 0;
      let focusedMutationWaitMs = 0;
      let focusedMutationPollCount = 0;
      let focusedMutationPollIntervalMs = this.postCreateDelayMs;
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
          focusedMutationPollIntervalMs,
          focusedMutationScanMs
        }
      });

      try {
        let dispatch: ChatDispatchInfo;

        if (shouldUsePromptFileDispatch(request)) {
          const promptFileDispatch = await this.dispatchViaPromptFile(request);
          cleanup = promptFileDispatch.cleanup;
          dispatch = promptFileDispatch.dispatch;
        } else {
          const dispatchedPrompt = buildPromptWithAgentSelector(request.prompt, request.agentName);
          dispatch = {
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
        }

        lease?.release();
        lease = undefined;

        const waitForPersisted = request.waitForPersisted !== undefined ? request.waitForPersisted : this.defaultWaitForPersisted;

        if (!waitForPersisted) {
          // Non-blocking/one-shot path: check once for an immediate persisted touch and return.
          const after = await this.storage.listSessions();
          const candidate = request.expectedFocusedSessionId
            ? after.find((item) => item.id === request.expectedFocusedSessionId)
            : await pickTouchedSession(beforeBaselines, after);
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
        let session: ChatSessionSummary | undefined;
        let selection: ReturnType<typeof buildSelectionVerification>;
        let observedMutation = false;
        let settled = false;

        if (request.expectedFocusedSessionId?.trim()) {
          const exactWait = await this.waitForExactSessionMutation(
            request.expectedFocusedSessionId,
            beforeBaselines.get(request.expectedFocusedSessionId),
            request.blockOnResponse === true
          );
          focusedMutationWaitMs = Date.now() - focusedMutationWaitStartedAt;
          focusedMutationPollCount = 0;
          focusedMutationScanMs = 0;
          session = exactWait.session;
          observedMutation = exactWait.observedMutation;
          settled = exactWait.settled;
          selection = buildSelectionVerification(request, session, dispatch);
        } else {
          const focusedWait = await this.waitForFocusedSessionMutation(beforeBaselines, request, dispatch);
          focusedMutationWaitMs = Date.now() - focusedMutationWaitStartedAt;
          focusedMutationPollCount = focusedWait.pollCount;
          focusedMutationScanMs = focusedWait.scanMs;
          session = focusedWait.session;
          selection = focusedWait.selection;
          observedMutation = focusedWait.observedMutation;
          settled = focusedWait.settled;
        }

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
      } finally {
        if (cleanup) {
          try {
            await cleanup();
          } catch {
            // Prompt-file cleanup must not change send behavior.
          }
        }
      }
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

  private async findDirectAgentOpenCommand(agentName: string | undefined): Promise<string | undefined> {
    return resolveDirectAgentOpenCommand(await vscode.commands.getCommands(true), agentName);
  }

  private async findExactSessionSendCommand(): Promise<string | undefined> {
    return findExactSessionSendCommand(await vscode.commands.getCommands(true));
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
      modelSelector: toModelSelector(request.modelSelector),
      blockOnResponse: false
    };

    await vscode.commands.executeCommand(OPEN_CHAT_COMMAND, options);
  }

  private async dispatchViaFocusedChatSubmit(
    request: CreateChatRequest,
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
    const directAgentOpenCommand = await this.findDirectAgentOpenCommand(request.agentName);
    await this.traceCreateDebug("direct-agent-open.lookup", {
      agentName: request.agentName,
      foundCommand: directAgentOpenCommand ?? null
    });
    if (directAgentOpenCommand) {
      await this.traceCreateDebug("direct-agent-open.before-dispatch", {
        agentName: request.agentName,
        command: directAgentOpenCommand
      });
      await vscode.commands.executeCommand(directAgentOpenCommand);
      await delay(this.openDelayMs);
      await this.dispatchToActiveChat(
        {
          ...request,
          agentName: undefined
        },
        request.prompt
      );
      return {
        dispatch: {
          surface: "direct-agent-open",
          dispatchedPrompt: request.prompt.trim()
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

  private async dispatchViaPromptFile(
    request: CreateChatRequest
  ): Promise<{ dispatch: ChatDispatchInfo; cleanup: () => Promise<void> }> {
    const promptsDirectory = getDefaultUserPromptsDirectory();
    const promptAgentName = await this.resolvePromptFileAgentName(request.agentName);
    const artifact = buildPromptFileDispatchArtifact(
      request,
      promptsDirectory,
      createPromptDispatchUniqueSuffix(),
      promptAgentName
    );

    const cleanup = async (): Promise<void> => {
      await fs.rm(artifact.filePath, { force: true });
    };

    try {
      await fs.mkdir(promptsDirectory, { recursive: true });
      await fs.writeFile(artifact.filePath, artifact.content, "utf8");
      await this.traceCreateDebug("prompt-file.after-write", {
        filePath: artifact.filePath,
        slashCommand: artifact.slashCommand,
        promptAgentName
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

  private async resolvePromptFileAgentName(agentName: string | undefined): Promise<string | undefined> {
    const normalized = agentName?.trim().replace(/^#+/, "");
    if (!normalized) {
      return undefined;
    }

    const workspaceAgentFile = await this.findWorkspaceAgentFile(normalized);
    if (!workspaceAgentFile) {
      return normalized;
    }

    let raw: string;
    try {
      raw = await fs.readFile(workspaceAgentFile, "utf8");
    } catch {
      return normalized;
    }

    const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
    const nameLine = frontmatterMatch?.[1]
      .split(/\r?\n/u)
      .map((line) => line.match(/^name\s*:\s*(.+)\s*$/u))
      .find((match): match is RegExpMatchArray => Boolean(match?.[1]));
    const resolvedName = nameLine?.[1]?.trim().replace(/^['"]|['"]$/g, "");
    return resolvedName || normalized;
  }

  private async findWorkspaceAgentFile(agentName: string): Promise<string | undefined> {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const candidate = path.join(folder.uri.fsPath, ".github", "agents", `${agentName}.agent.md`);
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // Continue searching remaining workspace folders.
      }
    }

    return undefined;
  }

  private async dispatchToActiveChat(request: CreateChatRequest, query: string): Promise<void> {
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
      const quiescence = requireSettled
        ? await getSessionQuiescenceState(session, { quietWindowMs: this.transcriptQuietWindowMs })
        : undefined;
      const settled = !requireSettled || Boolean(quiescence?.settled);
      const clean = isSessionCleanForCreateSelection(session);

      if (session && requireSettled) {
        await this.traceCreateDebug("create.wait-poll", {
          sessionId: session.id,
          lastUpdated: session.lastUpdated,
          pendingRequestCount: session.pendingRequestCount,
          lastRequestCompleted: session.lastRequestCompleted,
          hasPendingEdits: session.hasPendingEdits,
          settled,
          clean,
          quiescence
        });
      }

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
      settled: !requireSettled || await this.isSessionSettled(session)
    };
  }

  private async waitForFocusedSessionMutation(
    beforeBaselines: Map<string, SessionMutationBaseline>,
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
    const deadline = Date.now() + this.postCreateTimeoutMs;
    let candidate: ChatSessionSummary | undefined;
    let observedMutation = false;
    let pollCount = 0;
    let scanMs = 0;
    const requireSettled = request.blockOnResponse === true;
    const expectedFocusedSessionId = request.expectedFocusedSessionId?.trim();

    while (Date.now() <= deadline) {
      await delay(this.postCreateDelayMs);
      pollCount += 1;
      const scanStartedAt = Date.now();
      const after = await this.storage.listSessions();
      scanMs += Date.now() - scanStartedAt;

      if (expectedFocusedSessionId) {
        const targeted = after.find((item) => item.id === expectedFocusedSessionId);
        if (targeted) {
          candidate = targeted;
          observedMutation = observedMutation || await hasSessionMutationSinceBaseline(
            targeted,
            beforeBaselines.get(expectedFocusedSessionId)
          );
        }
      } else if (!candidate) {
        const touched = await pickTouchedSession(beforeBaselines, after);
        if (touched) {
          candidate = touched;
          observedMutation = true;
        }
      } else {
        const candidateId = candidate.id;
        candidate = after.find((item) => item.id === candidateId) ?? candidate;
      }
      const selection = buildSelectionVerification(request, candidate, dispatch);
      const settled = observedMutation && (!requireSettled || await this.isSessionSettled(candidate));
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
      settled: observedMutation && (!requireSettled || await this.isSessionSettled(candidate)),
      pollCount,
      scanMs
    };
  }

  private async waitForExactSessionMutation(
    sessionId: string,
    previousBaseline: SessionMutationBaseline | undefined,
    requireSettled: boolean
  ): Promise<{ session: ChatSessionSummary | undefined; observedMutation: boolean; settled: boolean }> {
    const deadline = Date.now() + this.postCreateTimeoutMs;
    let candidate = await this.storage.getSessionById(sessionId);
    let observedMutation = candidate ? await hasSessionMutationSinceBaseline(candidate, previousBaseline) : false;

    while (Date.now() <= deadline) {
      const settled = observedMutation && (!requireSettled || await this.isSessionSettled(candidate));
      if (settled) {
        return { session: candidate, observedMutation, settled };
      }

      await delay(this.postCreateDelayMs);
      candidate = await this.storage.getSessionById(sessionId);
      observedMutation = observedMutation || Boolean(candidate && await hasSessionMutationSinceBaseline(candidate, previousBaseline));
    }

    return {
      session: candidate,
      observedMutation,
      settled: observedMutation && (!requireSettled || await this.isSessionSettled(candidate))
    };
  }

  private async isSessionSettled(session: ChatSessionSummary | undefined): Promise<boolean> {
    return (await getSessionQuiescenceState(session, {
      quietWindowMs: this.transcriptQuietWindowMs
    })).settled;
  }
}

function toLocalChatSessionUri(sessionId: string): vscode.Uri {
  return vscode.Uri.parse(toLocalChatSessionResourceString(sessionId));
}

function pickCreatedSession(beforeIds: Set<string>, after: ChatSessionSummary[]): ChatSessionSummary | undefined {
  return pickPreferredCreatedSession(after.filter((item) => !beforeIds.has(item.id)));
}

function pickTouchedSession(
  beforeBaselines: Map<string, SessionMutationBaseline>,
  after: ChatSessionSummary[]
): Promise<ChatSessionSummary | undefined> {
  return pickTouchedSessionAsync(beforeBaselines, after);
}

async function pickTouchedSessionAsync(
  beforeBaselines: Map<string, SessionMutationBaseline>,
  after: ChatSessionSummary[]
): Promise<ChatSessionSummary | undefined> {
  const touchedFlags = await Promise.all(after.map(async (item) => ({
    item,
    touched: await hasSessionMutationSinceBaseline(item, beforeBaselines.get(item.id))
  })));

  return pickPreferredCreatedSession(touchedFlags.filter((entry) => entry.touched).map((entry) => entry.item));
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

async function captureSessionMutationBaselines(sessions: ChatSessionSummary[]): Promise<Map<string, SessionMutationBaseline>> {
  const baselines = await Promise.all(sessions.map(async (session) => {
    const baseline = await captureSessionMutationBaseline(session);
    return baseline ? [session.id, baseline] as const : undefined;
  }));
  return new Map(baselines.filter((entry): entry is readonly [string, SessionMutationBaseline] => Boolean(entry)));
}

async function captureSessionMutationBaseline(session: ChatSessionSummary | undefined): Promise<SessionMutationBaseline | undefined> {
  if (!session) {
    return undefined;
  }

  const stats = await safeStat(session.sessionFile);
  return {
    lastUpdated: session.lastUpdated,
    sessionFileMtimeMs: stats?.mtimeMs,
    sessionFileSize: stats?.size
  };
}

async function hasSessionMutationSinceBaseline(
  session: ChatSessionSummary | undefined,
  baseline: SessionMutationBaseline | undefined
): Promise<boolean> {
  if (!session) {
    return false;
  }

  if (!baseline) {
    return true;
  }

  if (session.lastUpdated !== baseline.lastUpdated) {
    return true;
  }

  const stats = await safeStat(session.sessionFile);
  if (stats?.size !== baseline.sessionFileSize) {
    return true;
  }

  return stats?.mtimeMs !== undefined && baseline.sessionFileMtimeMs !== undefined
    ? stats.mtimeMs !== baseline.sessionFileMtimeMs
    : stats?.mtimeMs !== baseline.sessionFileMtimeMs;
}

async function safeStat(targetPath: string): Promise<Stats | undefined> {
  try {
    return await fs.stat(targetPath);
  } catch {
    return undefined;
  }
}