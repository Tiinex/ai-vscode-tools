const FIRST_SLICE_SESSION_COMMANDS = new Set([
  "tiinex.aiVscodeTools.openTranscriptEvidence",
  "tiinex.aiVscodeTools.openSnapshot",
  "tiinex.aiVscodeTools.openContextEstimate",
  "tiinex.aiVscodeTools.openProfile",
  "tiinex.aiVscodeTools.openIndex"
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
  "tiinex.aiVscodeTools.openSessionFile"
]);

const LOCAL_CHAT_CONTROL_COMMANDS = new Set([
  "tiinex.aiVscodeTools.listLiveChats",
  "tiinex.aiVscodeTools.revealLiveChat",
  "tiinex.aiVscodeTools.closeVisibleLiveChatTabs"
]);

const LOCAL_CHAT_MUTATION_COMMANDS = new Set([
  "tiinex.aiVscodeTools.createLiveChat",
  "tiinex.aiVscodeTools.deleteLiveChatArtifacts",
  "tiinex.aiVscodeTools.sendMessageToLiveChat",
  "tiinex.aiVscodeTools.sendMessageToFocusedLiveChat"
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