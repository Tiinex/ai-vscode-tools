import * as vscode from "vscode";
import type { ExactSessionInteropSupport, FocusedChatInteropSupport } from "./capabilities";

export type ChatModelSelector = {
  id: string;
  vendor?: string;
};

export type ChatSelectionStatus = "not-requested" | "verified" | "mismatch" | "unverified" | "dispatched-via-artifact";

export type ChatDispatchSurface = "chat-open" | "prompt-file-slash-command" | "focused-chat-submit";

export interface ChatSelectionCheck {
  status: ChatSelectionStatus;
  requested?: string;
  observed?: string;
}

export interface ChatDispatchInfo {
  surface: ChatDispatchSurface;
  dispatchedPrompt: string;
  slashCommand?: string;
}

export interface ChatSelectionVerification {
  mode: ChatSelectionCheck;
  model: ChatSelectionCheck;
  agent: ChatSelectionCheck;
  dispatchedPrompt: string;
  dispatchSurface: ChatDispatchSurface;
  dispatchedSlashCommand?: string;
  allRequestedVerified: boolean;
}

export function hasObservedCustomAgentMismatch(
  requestedAgentName: string | undefined,
  selection: ChatSelectionVerification | undefined
): boolean {
  return Boolean(requestedAgentName?.trim()) && selection?.agent.status === "mismatch";
}

export interface ChatRevealLifecycle {
  closedMatchingVisibleTabs: number;
  closedTabLabels: string[];
  timingMs?: {
    totalFallbackMs?: number;
    revealMs?: number;
    focusMs?: number;
    focusedSendCallMs?: number;
    focusedInputMs?: number;
    prefillMs?: number;
    submitMs?: number;
    focusedMutationWaitMs?: number;
    focusedMutationPollCount?: number;
    focusedMutationScanMs?: number;
  };
}

export interface ChatArtifactDeletionReport {
  attemptedPaths: string[];
  deletedPaths: string[];
  missingPaths: string[];
  lingeringPaths?: string[];
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  lastUpdated: string;
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
  archived: boolean;
  provider: "workspaceStorage" | "emptyWindow";
  workspaceId?: string;
  sessionFile: string;
}

export interface CreateChatRequest {
  prompt: string;
  agentName?: string;
  mode?: string;
  modelSelector?: ChatModelSelector;
  partialQuery?: boolean;
  blockOnResponse?: boolean;
  requireSelectionEvidence?: boolean;
  // If false, the focused-send call will return immediately after dispatch
  // without waiting for a persisted session mutation. Default: true (wait).
  waitForPersisted?: boolean;
}

export interface SendChatMessageRequest extends CreateChatRequest {
  sessionId: string;
  allowTransportWorkaround?: boolean;
}

export interface ChatInteropOptions {
  workspaceStorageRoots?: string[];
  emptyWindowChatRoots?: string[];
  openDelayMs?: number;
  postCreateDelayMs?: number;
  postCreateTimeoutMs?: number;
  promptRegistrationDelayMs?: number;
  // Configure default behaviour for focused-send when `request.waitForPersisted` is not provided
  waitForPersistedDefault?: boolean;
}

export interface CreateChatSelectionBlockerOptions {
  directAgentOpenAvailable?: boolean;
}

export interface ChatCommandResult {
  ok: boolean;
  reason?: string;
  session?: ChatSessionSummary;
  sessions?: ChatSessionSummary[];
  error?: string;
  selection?: ChatSelectionVerification;
  dispatch?: ChatDispatchInfo;
  revealLifecycle?: ChatRevealLifecycle;
  artifactDeletion?: ChatArtifactDeletionReport;
}

export type InternalChatOpenOptions = {
  query: string;
  isPartialQuery?: boolean;
  mode?: string;
  modelSelector?: { id: string; vendor?: string };
  blockOnResponse?: boolean;
};

export interface MutexLease {
  release(): void;
}

export interface ChatInteropApi {
  listChats(): Promise<ChatSessionSummary[]>;
  getPostCreateTimeoutMs?(): number;
  getExactSessionInteropSupport(): Promise<ExactSessionInteropSupport>;
  getFocusedChatInteropSupport(): Promise<FocusedChatInteropSupport>;
  createChat(request: CreateChatRequest): Promise<ChatCommandResult>;
  sendMessage(request: SendChatMessageRequest): Promise<ChatCommandResult>;
  sendFocusedMessage(request: CreateChatRequest): Promise<ChatCommandResult>;
  closeVisibleTabs(sessionId: string): Promise<ChatCommandResult>;
  deleteChat(sessionId: string): Promise<ChatCommandResult>;
  revealChat(sessionId: string): Promise<ChatCommandResult>;
}

export type CommandMap = {
  "tiinex.aiVscodeTools.chatInterop.listChats": () => Promise<ChatSessionSummary[]>;
  "tiinex.aiVscodeTools.chatInterop.createChat": (request: CreateChatRequest) => Promise<ChatCommandResult>;
  "tiinex.aiVscodeTools.chatInterop.sendMessage": (request: SendChatMessageRequest) => Promise<ChatCommandResult>;
  "tiinex.aiVscodeTools.chatInterop.sendMessageWithFallback": (sessionId: string, prompt: string) => Promise<ChatCommandResult>;
  "tiinex.aiVscodeTools.chatInterop.sendFocusedMessage": (request: CreateChatRequest) => Promise<ChatCommandResult>;
  "tiinex.aiVscodeTools.chatInterop.closeVisibleTabs": (sessionId: string) => Promise<ChatCommandResult>;
  "tiinex.aiVscodeTools.chatInterop.deleteChat": (sessionId: string) => Promise<ChatCommandResult>;
  "tiinex.aiVscodeTools.chatInterop.revealChat": (sessionId: string) => Promise<ChatCommandResult>;
};

export function toModelSelector(value: ChatModelSelector | undefined): InternalChatOpenOptions["modelSelector"] | undefined {
  if (!value?.id) {
    return undefined;
  }

  return {
    id: value.id,
    vendor: value.vendor
  };
}

export function buildPromptWithAgentSelector(prompt: string, agentName: string | undefined): string {
  const trimmedPrompt = prompt.trim();
  const trimmedAgentName = agentName?.trim();
  if (!trimmedAgentName) {
    return trimmedPrompt;
  }

  const selector = `#${trimmedAgentName.replace(/^#+/, "")}`;
  if (trimmedPrompt === selector || trimmedPrompt.startsWith(`${selector} `) || trimmedPrompt.startsWith(`${selector}\n`)) {
    return trimmedPrompt;
  }

  return `${selector}\n${trimmedPrompt}`;
}

function normalizeSelectionValue(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeAgentSelectionValue(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/^#+/, "").toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function inferAgentFromModeValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const lastPathSegment = trimmed.replace(/\\/g, "/").split("/").pop() ?? trimmed;
  const withoutExtension = lastPathSegment.replace(/\.agent\.md$/i, "");
  if (withoutExtension !== lastPathSegment) {
    return normalizeAgentSelectionValue(withoutExtension);
  }

  return undefined;
}

function modelMatches(requested: ChatModelSelector | undefined, observed: string | undefined): boolean {
  const requestedId = normalizeSelectionValue(requested?.id);
  const requestedVendor = normalizeSelectionValue(requested?.vendor);
  const observedValue = normalizeSelectionValue(observed);
  if (!requestedId || !observedValue) {
    return false;
  }

  if (observedValue === requestedId || observedValue.includes(requestedId) || requestedId.includes(observedValue)) {
    return requestedVendor ? observedValue.includes(requestedVendor) || observedValue === requestedId : true;
  }

  return false;
}

export function buildSelectionVerification(
  request: CreateChatRequest,
  session: ChatSessionSummary | undefined,
  dispatch: ChatDispatchInfo
): ChatSelectionVerification {
  const modeRequested = normalizeSelectionValue(request.mode);
  const modeObserved = normalizeSelectionValue(session?.mode);
  const modelRequested = request.modelSelector;
  const modelObserved = session?.model;
  const requestedAgentLabel = request.agentName?.trim().replace(/^#+/, "");
  const agentRequested = normalizeAgentSelectionValue(requestedAgentLabel);
  const requestAgentObservedValues = [session?.requestAgentId, session?.requestAgentName]
    .map((value) => normalizeAgentSelectionValue(value))
    .filter((value): value is string => Boolean(value));
  const requestAgentObserved = session?.requestAgentId ?? session?.requestAgentName;
  const modeObservedAgent = inferAgentFromModeValue(session?.mode);

  const mode: ChatSelectionCheck = !modeRequested
    ? { status: "not-requested" }
    : !modeObserved
      ? { status: "unverified", requested: request.mode }
      : modeObserved === modeRequested
        ? { status: "verified", requested: request.mode, observed: session?.mode }
        : { status: "mismatch", requested: request.mode, observed: session?.mode };

  const requestedModelLabel = modelRequested?.id
    ? (modelRequested.vendor ? `${modelRequested.vendor}/${modelRequested.id}` : modelRequested.id)
    : undefined;
  const model: ChatSelectionCheck = !modelRequested?.id
    ? { status: "not-requested" }
    : !modelObserved
      ? { status: "unverified", requested: requestedModelLabel }
      : modelMatches(modelRequested, modelObserved)
        ? { status: "verified", requested: requestedModelLabel, observed: modelObserved }
        : { status: "mismatch", requested: requestedModelLabel, observed: modelObserved };

  const agent: ChatSelectionCheck = !agentRequested
    ? { status: "not-requested" }
    : requestAgentObservedValues.some((value) => value === agentRequested)
      ? { status: "verified", requested: `#${requestedAgentLabel}`, observed: requestAgentObserved }
      : modeObservedAgent === agentRequested
        ? { status: "verified", requested: `#${requestedAgentLabel}`, observed: session?.mode }
      : requestAgentObserved
        ? { status: "mismatch", requested: `#${requestedAgentLabel}`, observed: requestAgentObserved }
        : {
            status: dispatch.surface === "prompt-file-slash-command"
              || dispatch.dispatchedPrompt === `#${requestedAgentLabel}`
              || dispatch.dispatchedPrompt.startsWith(`#${requestedAgentLabel} `)
              || dispatch.dispatchedPrompt.startsWith(`#${requestedAgentLabel}\n`)
              ? "dispatched-via-artifact"
              : "unverified",
            requested: `#${requestedAgentLabel}`
          };

  const allRequestedVerified = [mode, model, agent].every((item) => item.status === "not-requested" || item.status === "verified");

  return {
    mode,
    model,
    agent,
    dispatchedPrompt: dispatch.dispatchedPrompt,
    dispatchSurface: dispatch.surface,
    dispatchedSlashCommand: dispatch.slashCommand,
    allRequestedVerified
  };
}

export function buildCreateChatSelectionBlocker(
  request: CreateChatRequest,
  options: CreateChatSelectionBlockerOptions = {}
): string | undefined {
  if (request.mode?.trim() || request.modelSelector?.id?.trim()) {
    return "Live createChat with explicit mode or model selection is unsupported on this VS Code/Copilot build because observed create-time selection can inherit the active chat UI state. Use createChat only without selection overrides, or work against an existing target via reveal_live_agent_chat plus send_message_to_live_agent_chat.";
  }

  if (!request.agentName?.trim()) {
    return "Live createChat without an explicit agent is unsafe on this VS Code/Copilot build because a new chat can inherit active chat mode or model state from the currently focused conversation. Use send_message_with_lifecycle with an explicit agentName, or work against an existing target via reveal_live_agent_chat plus send_message_to_live_agent_chat.";
  }

  if (request.requireSelectionEvidence) {
    if (request.partialQuery === true) {
      return "Live chat draft prefill cannot independently verify custom agent selection on this surface. Remove requireSelectionEvidence or use another explicitly verifiable surface.";
    }

    const routeHint = options.directAgentOpenAvailable
      ? "Even with a direct agent-open command, this surface still cannot independently verify the persisted participant."
      : "This host will otherwise rely on a prompt artifact path to anchor the new chat start.";
    return `Live createChat can anchor a new chat start for a requested custom agent on this surface, but it cannot independently verify actual participant selection. ${routeHint} Remove requireSelectionEvidence to allow the current best-effort create path, or work against an existing target via reveal_live_agent_chat plus send_message_to_live_agent_chat.`;
  }

  return undefined;
}

export function buildSendChatSelectionBlocker(request: SendChatMessageRequest): string | undefined {
  if (request.mode || request.modelSelector) {
    return "Exact-session live chat send cannot currently prove or enforce mode/model selection on this surface; use createChat with explicit verification, or treat send as prompt-only dispatch.";
  }

  if (request.requireSelectionEvidence && request.agentName?.trim()) {
    return "Exact-session live chat send cannot independently verify a custom agent prompt selector on this surface. Use createChat with partialQuery: true for no-token prefill, or another explicitly verifiable surface.";
  }

  return undefined;
}

export function buildFocusedChatSelectionBlocker(request: CreateChatRequest): string | undefined {
  if (request.mode || request.modelSelector) {
    return "Focused live chat send cannot currently prove or enforce mode/model selection on this surface; pre-select them in the UI first, or use createChat with explicit verification.";
  }

  if (request.requireSelectionEvidence && request.agentName?.trim()) {
    return "Focused live chat send cannot independently verify a custom agent prompt selector on this surface. Use createChat with partialQuery: true for draft-only prefill, or another explicitly verifiable surface.";
  }

  return undefined;
}

export function normalizeFsPath(uriOrPath: vscode.Uri | string): string {
  return typeof uriOrPath === "string" ? uriOrPath : uriOrPath.fsPath;
}