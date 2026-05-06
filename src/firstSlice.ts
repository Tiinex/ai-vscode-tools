const FIRST_SLICE_SESSION_COMMANDS = new Set([
  "tiinex.aiVscodeTooling.openTranscriptEvidence",
  "tiinex.aiVscodeTooling.openSnapshot",
  "tiinex.aiVscodeTooling.openContextEstimate",
  "tiinex.aiVscodeTooling.openProfile",
  "tiinex.aiVscodeTooling.openIndex"
]);

const FIRST_SLICE_SESSION_TOOL_NAMES = new Set([
  "list_agent_sessions",
  "get_agent_session_index",
  "get_agent_session_window",
  "export_agent_session_markdown",
  "export_agent_evidence_transcript",
  "get_agent_session_snapshot",
  "estimate_agent_context_breakdown",
  "get_agent_session_profile",
  "survey_agent_sessions"
]);

const LAST_RESORT_SESSION_COMMANDS = new Set([
  "tiinex.aiVscodeTooling.openSessionFile"
]);

const LOCAL_CHAT_CONTROL_COMMANDS = new Set([
  "tiinex.aiVscodeTooling.listLiveChats",
  "tiinex.aiVscodeTooling.revealLiveChat",
  "tiinex.aiVscodeTooling.closeVisibleLiveChatTabs"
]);

const LOCAL_CHAT_MUTATION_COMMANDS = new Set([
  "tiinex.aiVscodeTooling.createDisposableLocalDeleteProbe",
  "tiinex.aiVscodeTooling.createLiveChat",
  "tiinex.aiVscodeTooling.deleteLiveChatArtifacts",
  "tiinex.aiVscodeTooling.sendMessageToLiveChat",
  "tiinex.aiVscodeTooling.sendMessageToFocusedLiveChat"
]);

export const FIRST_SLICE_INTERACTIVE_SURFACES_ENABLED = false;
export const FIRST_SLICE_COPILOT_CLI_SURFACES_ENABLED = false;
export const LOCAL_CHAT_CONTROL_SURFACES_ENABLED = true;
export const LOCAL_CHAT_MUTATION_SURFACES_ENABLED = true;
export const LOCAL_CHAT_RUNTIME_SURFACES_ENABLED = LOCAL_CHAT_CONTROL_SURFACES_ENABLED || LOCAL_CHAT_MUTATION_SURFACES_ENABLED;

export function isFirstSliceSessionCommand(command: string): boolean {
  return FIRST_SLICE_SESSION_COMMANDS.has(command);
}

export function isEnabledSessionCommand(command: string): boolean {
  return FIRST_SLICE_SESSION_COMMANDS.has(command)
    || LAST_RESORT_SESSION_COMMANDS.has(command)
    || (LOCAL_CHAT_CONTROL_SURFACES_ENABLED && LOCAL_CHAT_CONTROL_COMMANDS.has(command))
    || (LOCAL_CHAT_MUTATION_SURFACES_ENABLED && LOCAL_CHAT_MUTATION_COMMANDS.has(command));
}

export function isFirstSliceSessionTool(toolName: string): boolean {
  return FIRST_SLICE_SESSION_TOOL_NAMES.has(toolName);
}