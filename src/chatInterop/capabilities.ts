const GENERIC_SESSION_OPEN_COMMAND_CANDIDATES = [
  "workbench.action.chat.openSessionInEditorGroup"
] as const;

const GENERIC_SESSION_OPEN_WITH_PROMPT_COMMAND_CANDIDATES = [
  "workbench.action.chat.openSessionWithPrompt"
] as const;

const CLI_SESSION_OPEN_COMMAND_CANDIDATES = [
  "workbench.action.chat.openSession.copilotcli"
] as const;

const CLI_SESSION_OPEN_WITH_PROMPT_COMMAND_CANDIDATES = [
  "workbench.action.chat.openSessionWithPrompt.copilotcli"
] as const;

const FOCUSED_CHAT_INPUT_COMMAND_CANDIDATES = [
  "workbench.action.chat.focusInput"
] as const;

const FOCUSED_CHAT_SUBMIT_COMMAND_CANDIDATES = [
  "workbench.action.chat.submit"
] as const;

const DIRECT_AGENT_OPEN_COMMAND_PREFIX = "workbench.action.chat.open";

export interface ExactSessionInteropSupport {
  canRevealExactSession: boolean;
  canSendExactSessionMessage: boolean;
  revealUnsupportedReason?: string;
  sendUnsupportedReason?: string;
}

export interface FocusedChatInteropSupport {
  canSubmitFocusedChatMessage: boolean;
  focusInputCommand?: string;
  submitCommand?: string;
  unsupportedReason?: string;
}

export function findExactSessionOpenCommand(commands: Iterable<string>): string | undefined {
  return findRegisteredCommand(commands, GENERIC_SESSION_OPEN_COMMAND_CANDIDATES);
}

export function findExactSessionSendCommand(commands: Iterable<string>): string | undefined {
  return findRegisteredCommand(commands, GENERIC_SESSION_OPEN_WITH_PROMPT_COMMAND_CANDIDATES);
}

export function findFocusedChatInputCommand(commands: Iterable<string>): string | undefined {
  return findRegisteredCommand(commands, FOCUSED_CHAT_INPUT_COMMAND_CANDIDATES);
}

export function findFocusedChatSubmitCommand(commands: Iterable<string>): string | undefined {
  return findRegisteredCommand(commands, FOCUSED_CHAT_SUBMIT_COMMAND_CANDIDATES);
}

export function findDirectAgentOpenCommand(commands: Iterable<string>, agentName: string | undefined): string | undefined {
  const normalized = agentName?.trim().replace(/^#+/, "").toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const fragments = new Set<string>([
    normalized,
    normalized.replace(/[^a-z0-9-]+/g, "-"),
    normalized.replace(/[^a-z0-9]+/g, "")
  ]);
  const commandSet = new Set(commands);
  for (const fragment of fragments) {
    const trimmed = fragment.replace(/^-+|-+$/g, "");
    if (!trimmed) {
      continue;
    }

    const candidate = `${DIRECT_AGENT_OPEN_COMMAND_PREFIX}${trimmed}`;
    if (commandSet.has(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export function buildUnsupportedRevealReason(commands: Iterable<string>): string {
  const registeredCommands = new Set(commands);
  if (CLI_SESSION_OPEN_COMMAND_CANDIDATES.some((command) => registeredCommands.has(command))) {
    return "Exact session reveal for ordinary local chats is not supported in this VS Code/Copilot build. Only a Copilot CLI-specific openSession command is present, and it does not target normal local chat sessions.";
  }
  return "Exact session reveal is not supported in this VS Code/Copilot build. No supported Local session-reveal command was found for ordinary local chat sessions.";
}

export function buildUnsupportedSendReason(commands: Iterable<string>): string {
  const registeredCommands = new Set(commands);
  if (CLI_SESSION_OPEN_WITH_PROMPT_COMMAND_CANDIDATES.some((command) => registeredCommands.has(command))) {
    return "Exact session-targeted send for ordinary local chats is not supported in this VS Code/Copilot build. Only a Copilot CLI-specific openSessionWithPrompt command is present, and it rejects normal local chat session resources.";
  }
  return "Exact session-targeted send is not supported in this VS Code/Copilot build. No generic internal openSessionWithPrompt chat command was found for ordinary local chat sessions.";
}

export function getExactSessionInteropSupport(commands: Iterable<string>): ExactSessionInteropSupport {
  const commandList = [...commands];
  const canRevealExactSession = Boolean(findExactSessionOpenCommand(commandList));
  const canSendExactSessionMessage = Boolean(findExactSessionSendCommand(commandList));

  return {
    canRevealExactSession,
    canSendExactSessionMessage,
    revealUnsupportedReason: canRevealExactSession ? undefined : buildUnsupportedRevealReason(commandList),
    sendUnsupportedReason: canSendExactSessionMessage ? undefined : buildUnsupportedSendReason(commandList)
  };
}

export function buildUnsupportedFocusedSendReason(commands: Iterable<string>): string {
  const commandList = [...commands];
  const focusInputCommand = findFocusedChatInputCommand(commandList);
  const submitCommand = findFocusedChatSubmitCommand(commandList);

  if (!focusInputCommand && !submitCommand) {
    return "Focused Local chat submit is not supported in this VS Code/Copilot build. Neither workbench.action.chat.focusInput nor workbench.action.chat.submit was found.";
  }

  if (!focusInputCommand) {
    return "Focused Local chat submit is not supported in this VS Code/Copilot build. workbench.action.chat.focusInput was not found.";
  }

  return "Focused Local chat submit is not supported in this VS Code/Copilot build. workbench.action.chat.submit was not found.";
}

export function getFocusedChatInteropSupport(commands: Iterable<string>): FocusedChatInteropSupport {
  const commandList = [...commands];
  const focusInputCommand = findFocusedChatInputCommand(commandList);
  const submitCommand = findFocusedChatSubmitCommand(commandList);
  const canSubmitFocusedChatMessage = Boolean(focusInputCommand && submitCommand);

  return {
    canSubmitFocusedChatMessage,
    focusInputCommand,
    submitCommand,
    unsupportedReason: canSubmitFocusedChatMessage ? undefined : buildUnsupportedFocusedSendReason(commandList)
  };
}

function findRegisteredCommand(commands: Iterable<string>, candidates: readonly string[]): string | undefined {
  const registeredCommands = new Set(commands);
  return candidates.find((command) => registeredCommands.has(command));
}
