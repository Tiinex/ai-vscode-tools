import { getFocusedChatInteropSupport, type ExactSessionInteropSupport } from "./capabilities";

const NEW_CHAT_EDITOR_COMMAND = "workbench.action.openChat";
const OPEN_CHAT_COMMAND = "workbench.action.chat.open";
const GENERIC_SESSION_OPEN_COMMAND = "workbench.action.chat.openSession";
const EDITOR_GROUP_SESSION_OPEN_COMMAND = "workbench.action.chat.openSessionInEditorGroup";
const GENERIC_SESSION_OPEN_WITH_PROMPT_COMMAND = "workbench.action.chat.openSessionWithPrompt";
const CLI_SESSION_OPEN_COMMAND = "workbench.action.chat.openSession.copilotcli";
const CLI_SESSION_OPEN_WITH_PROMPT_COMMAND = "workbench.action.chat.openSessionWithPrompt.copilotcli";
const FOCUSED_CHAT_INPUT_COMMAND = "workbench.action.chat.focusInput";
const FOCUSED_CHAT_SUBMIT_COMMAND = "workbench.action.chat.submit";
const EDITOR_CHAT_START_COMMAND = "vscode.editorChat.start";

const RUNTIME_COMMAND_INVENTORY_PATTERNS: ReadonlyArray<RegExp> = [
  /^workbench\.action\.openChat$/,
  /^workbench\.action\.chat\./,
  /^vscode\.editorChat\./,
  /^github\.copilot\.(cli\.sessions\.|sessions\.|cloud\.sessions\.)/,
  /^github\.copilot\.chat\..*(session|Session|continueInChat|continueInInlineChat)/
];

export type SupportStatus = "supported" | "best-effort" | "unsupported";

export interface SupportCell {
  status: SupportStatus;
  reason: string;
}

export interface ManifestParticipantSummary {
  id: string;
  name?: string;
  fullName?: string;
  modes: string[];
  isDefault: boolean;
  isAgent: boolean;
}

export interface LiveChatSupportMatrix {
  localNewChatPrompt: SupportCell;
  localNewChatMode: SupportCell;
  localNewChatModel: SupportCell;
  localNewChatCustomRolePrompt: SupportCell;
  localNewChatCustomAgent: SupportCell;
  localFocusedPromptSubmit: SupportCell;
  localExactReveal: SupportCell;
  localExactSend: SupportCell;
  localSessionFollowUpSend: SupportCell;
  localExactModeModelOverride: SupportCell;
  localExactCustomAgent: SupportCell;
  runtimeCommands: {
    openChat: boolean;
    chatOpen: boolean;
    focusInput: boolean;
    chatSubmit: boolean;
    genericOpenSession: boolean;
    editorGroupOpenSession: boolean;
    genericOpenSessionWithPrompt: boolean;
    copilotCliOpenSession: boolean;
    copilotCliOpenSessionWithPrompt: boolean;
  };
  manifestParticipants: ManifestParticipantSummary[];
  manifestModelCommands: string[];
  switchAgentOptions: string[];
}

export type SupportRenderDetailLevel = "summary" | "full";

export function buildLiveChatSupportMatrix(options: {
  commands: Iterable<string>;
  exactSessionInterop: ExactSessionInteropSupport;
  copilotChatPackageJson?: any;
}): LiveChatSupportMatrix {
  const commandSet = new Set(options.commands);
  const runtimeCommands = {
    openChat: commandSet.has(NEW_CHAT_EDITOR_COMMAND),
    chatOpen: commandSet.has(OPEN_CHAT_COMMAND),
    focusInput: commandSet.has(FOCUSED_CHAT_INPUT_COMMAND),
    chatSubmit: commandSet.has(FOCUSED_CHAT_SUBMIT_COMMAND),
    genericOpenSession: commandSet.has(GENERIC_SESSION_OPEN_COMMAND),
    editorGroupOpenSession: commandSet.has(EDITOR_GROUP_SESSION_OPEN_COMMAND),
    genericOpenSessionWithPrompt: commandSet.has(GENERIC_SESSION_OPEN_WITH_PROMPT_COMMAND),
    copilotCliOpenSession: commandSet.has(CLI_SESSION_OPEN_COMMAND),
    copilotCliOpenSessionWithPrompt: commandSet.has(CLI_SESSION_OPEN_WITH_PROMPT_COMMAND)
  };

  const focusedChatInterop = getFocusedChatInteropSupport(commandSet);

  const manifestParticipants = extractManifestParticipants(options.copilotChatPackageJson);
  const manifestModelCommands = extractManifestModelCommands(options.copilotChatPackageJson);
  const switchAgentOptions = extractSwitchAgentOptions(options.copilotChatPackageJson);

  const createPathAvailable = runtimeCommands.openChat && runtimeCommands.chatOpen;

  return {
    localNewChatPrompt: createPathAvailable
      ? {
          status: "best-effort",
          reason: `The Local new-chat path can open a chat through ${NEW_CHAT_EDITOR_COMMAND} and dispatch through ${OPEN_CHAT_COMMAND}, but a plain new chat can still inherit active chat mode or model state on this host instead of starting from a trustworthy neutral default.`
        }
      : {
          status: "unsupported",
          reason: `The Local new-chat path is missing ${!runtimeCommands.openChat ? NEW_CHAT_EDITOR_COMMAND : OPEN_CHAT_COMMAND}.`
        },
    localNewChatMode: createPathAvailable
      ? {
          status: "best-effort",
          reason: "Mode can be requested on Local createChat and has been observed in persisted session metadata on some hosts, but the current host can still inherit active chat UI state on create. Treat create-time mode as host-bounded and verify with persisted state rather than assuming a neutral new-chat start."
        }
      : {
          status: "unsupported",
          reason: "Mode selection cannot be exercised because the Local createChat path itself is unavailable."
        },
    localNewChatModel: createPathAvailable
      ? {
          status: "best-effort",
          reason: "Model can be requested on Local createChat and has been observed in persisted session metadata on some hosts, but the current host can still inherit active chat UI state on create. There is no dedicated create-time surface that guarantees a neutral default model on new-chat start."
        }
      : {
          status: "unsupported",
          reason: "Model selection cannot be exercised because the Local createChat path itself is unavailable."
        },
    localNewChatCustomRolePrompt: createPathAvailable
      ? {
          status: "best-effort",
          reason: "Local createChat can dispatch a custom role through a temporary prompt-file slash command, and that prompt-artifact start is the safest current create-time way to avoid passive UI inheritance. The actual persisted participant can still remain the built-in Copilot agent on this build."
        }
      : {
          status: "unsupported",
          reason: "Custom role prompt dispatch cannot be exercised because the Local createChat path itself is unavailable."
        },
    localNewChatCustomAgent: {
      status: "unsupported",
      reason: "Observed Local persisted sessions keep the built-in GitHub Copilot agent even when a custom-agent prompt artifact is attached, so actual participant selection remains unsupported on this surface."
    },
    localFocusedPromptSubmit: focusedChatInterop.canSubmitFocusedChatMessage
      ? {
          status: "best-effort",
          reason: `Focused Local prompt submit can prefill the currently focused chat input through ${OPEN_CHAT_COMMAND} after ${FOCUSED_CHAT_INPUT_COMMAND}, then dispatch through ${FOCUSED_CHAT_SUBMIT_COMMAND}. This remains best-effort because it depends on the visible focused thread rather than an exact session-targeted API.`
        }
      : {
          status: "unsupported",
          reason: focusedChatInterop.unsupportedReason ?? "No focused Local prompt submit command pair was found."
        },
    localExactReveal: options.exactSessionInterop.canRevealExactSession
      ? {
          status: "supported",
          reason: commandSet.has(GENERIC_SESSION_OPEN_COMMAND)
            ? `A generic Local exact-session command is present: ${GENERIC_SESSION_OPEN_COMMAND}.`
            : `A runtime exact Local reveal command is present: ${EDITOR_GROUP_SESSION_OPEN_COMMAND}.`
        }
      : {
          status: "unsupported",
          reason: options.exactSessionInterop.revealUnsupportedReason ?? "No supported Local exact-session reveal command was found."
        },
    localExactSend: options.exactSessionInterop.canSendExactSessionMessage
      ? {
          status: "supported",
          reason: `A generic Local exact-session send command is present: ${GENERIC_SESSION_OPEN_WITH_PROMPT_COMMAND}.`
        }
      : {
          status: "unsupported",
          reason: options.exactSessionInterop.sendUnsupportedReason ?? "No generic Local exact-session send command was found."
        },
    localSessionFollowUpSend: options.exactSessionInterop.canRevealExactSession && focusedChatInterop.canSubmitFocusedChatMessage
      ? {
          status: "supported",
          reason: `Verified Local follow-up send uses exact reveal through ${commandSet.has(GENERIC_SESSION_OPEN_COMMAND) ? GENERIC_SESSION_OPEN_COMMAND : EDITOR_GROUP_SESSION_OPEN_COMMAND} and then submits through focused chat input via ${FOCUSED_CHAT_INPUT_COMMAND} and ${FOCUSED_CHAT_SUBMIT_COMMAND}.`
        }
      : {
          status: "unsupported",
        reason: !options.exactSessionInterop.canRevealExactSession
          ? options.exactSessionInterop.revealUnsupportedReason ?? "No supported Local exact-session reveal command was found."
          : focusedChatInterop.unsupportedReason ?? "Focused Local prompt submit commands were not available."
        },
    localExactModeModelOverride: {
      status: "unsupported",
      reason: "Session-targeted Local follow-up send uses focused submit on this build, so mode/model override cannot be enforced or proven independently during the follow-up transport."
    },
    localExactCustomAgent: {
      status: "unsupported",
      reason: "Session-targeted Local follow-up send cannot independently verify a custom agent prompt selector on this build, and Local createChat cannot select a real custom agent either."
    },
    runtimeCommands,
    manifestParticipants,
    manifestModelCommands,
    switchAgentOptions
  };
}

export function renderLiveChatSupportMatrixMarkdown(
  matrix: LiveChatSupportMatrix,
  options: { detailLevel?: SupportRenderDetailLevel } = {}
): string {
  const detailLevel = options.detailLevel ?? "full";
  const lines = [
    "# Live Chat Support Matrix",
    "",
    "## Capability Status",
    renderSupportLine("Local new chat prompt", matrix.localNewChatPrompt),
    renderSupportLine("Local new chat mode", matrix.localNewChatMode),
    renderSupportLine("Local new chat model", matrix.localNewChatModel),
    renderSupportLine("Local new chat custom role prompt", matrix.localNewChatCustomRolePrompt),
    renderSupportLine("Local new chat custom agent", matrix.localNewChatCustomAgent),
    renderSupportLine("Local focused prompt submit", matrix.localFocusedPromptSubmit),
    renderSupportLine("Local exact reveal", matrix.localExactReveal),
    renderSupportLine("Local exact send", matrix.localExactSend),
    renderSupportLine("Local session follow-up send", matrix.localSessionFollowUpSend),
    renderSupportLine("Local exact mode/model override", matrix.localExactModeModelOverride),
    renderSupportLine("Local exact custom agent", matrix.localExactCustomAgent)
  ];

  if (detailLevel === "summary") {
    lines.push(
      "",
      "## Additional Signals",
      `- Exact-session reveal commands present: ${yesNo(matrix.runtimeCommands.genericOpenSession || matrix.runtimeCommands.editorGroupOpenSession)}`,
      `- Focused submit command pair present: ${yesNo(matrix.runtimeCommands.focusInput && matrix.runtimeCommands.chatSubmit)}`,
      `- Manifest participants discovered: ${matrix.manifestParticipants.length}`,
      `- Manifest model commands discovered: ${matrix.manifestModelCommands.length}`,
      `- Switch-agent options discovered: ${matrix.switchAgentOptions.length}`,
      "",
      "## Interpretation",
      "- This compact view is intended for agent-facing triage when you mainly need capability status rather than raw command or manifest listings.",
      "- Request detailLevel=full when you need exact runtime command evidence, full manifest participant rows, or the switch-agent option list.",
      "- Verified Local follow-up send on this build means exact reveal plus focused submit when a direct exact-send command is unavailable."
    );
    return `${lines.join("\n")}\n`;
  }

  lines.push(
    "",
    "## Runtime Commands",
    `- ${NEW_CHAT_EDITOR_COMMAND}: ${yesNo(matrix.runtimeCommands.openChat)}`,
    `- ${OPEN_CHAT_COMMAND}: ${yesNo(matrix.runtimeCommands.chatOpen)}`,
    `- ${FOCUSED_CHAT_INPUT_COMMAND}: ${yesNo(matrix.runtimeCommands.focusInput)}`,
    `- ${FOCUSED_CHAT_SUBMIT_COMMAND}: ${yesNo(matrix.runtimeCommands.chatSubmit)}`,
    `- ${GENERIC_SESSION_OPEN_COMMAND}: ${yesNo(matrix.runtimeCommands.genericOpenSession)}`,
    `- ${EDITOR_GROUP_SESSION_OPEN_COMMAND}: ${yesNo(matrix.runtimeCommands.editorGroupOpenSession)}`,
    `- ${GENERIC_SESSION_OPEN_WITH_PROMPT_COMMAND}: ${yesNo(matrix.runtimeCommands.genericOpenSessionWithPrompt)}`,
    `- ${CLI_SESSION_OPEN_COMMAND}: ${yesNo(matrix.runtimeCommands.copilotCliOpenSession)}`,
    `- ${CLI_SESSION_OPEN_WITH_PROMPT_COMMAND}: ${yesNo(matrix.runtimeCommands.copilotCliOpenSessionWithPrompt)}`,
    "",
    "## Copilot Chat Manifest Participants"
  );

  if (matrix.manifestParticipants.length === 0) {
    lines.push("- No chat participants were readable from the installed Copilot Chat manifest.");
  } else {
    for (const participant of matrix.manifestParticipants) {
      lines.push(
        `- ${participant.id} | name=${participant.name ?? "-"} | fullName=${participant.fullName ?? "-"} | modes=${participant.modes.join(",") || "-"} | default=${yesNo(participant.isDefault)} | agent=${yesNo(participant.isAgent)}`
      );
    }
  }

  lines.push("", "## Copilot Chat Manifest Model Commands");
  if (matrix.manifestModelCommands.length === 0) {
    lines.push("- No model-related contributed commands were found in the installed Copilot Chat manifest.");
  } else {
    for (const command of matrix.manifestModelCommands) {
      lines.push(`- ${command}`);
    }
  }

  lines.push("", "## Switch-Agent Surface");
  if (matrix.switchAgentOptions.length === 0) {
    lines.push("- No explicit switch-agent options were readable from the installed Copilot Chat manifest.");
  } else {
    lines.push(`- Supported switch-agent options from the manifest: ${matrix.switchAgentOptions.join(", ")}`);
  }

  lines.push(
    "",
    "## Interpretation",
    "- Local createChat is a viable transport for opening a new Copilot Chat thread and requesting mode/model.",
    "- Verified Local follow-up send on this build uses exact reveal to steer the target session and then focused prompt submit to dispatch the follow-up.",
    "- Local createChat can still dispatch a custom role prompt for the first turn, but that role should be interpreted as request-artifact guidance rather than a verified participant switch.",
    "- Local custom-agent participant selection is not a viable transport on this build because persisted sessions still keep the built-in agent.",
    "- Exact Local reveal remains a real building block, but ordinary Local direct exact-send is not carried as a separate product path in this repo."
  );

  return `${lines.join("\n")}\n`;
}

export function collectRelevantRuntimeCommands(commands: Iterable<string>): string[] {
  return [...new Set([...commands].filter((command: string) => RUNTIME_COMMAND_INVENTORY_PATTERNS.some((pattern) => pattern.test(command))))]
    .sort((left: string, right: string) => left.localeCompare(right));
}

export function collectRelevantManifestCommands(packageJson: any): string[] {
  const commands = Array.isArray(packageJson?.contributes?.commands)
    ? packageJson.contributes.commands
    : [];

  return commands
    .map((command: any) => typeof command?.command === "string" ? command.command : undefined)
    .filter((command: string | undefined): command is string => Boolean(command))
    .filter((command: string) => RUNTIME_COMMAND_INVENTORY_PATTERNS.some((pattern) => pattern.test(command)))
    .sort((left: string, right: string) => left.localeCompare(right));
}

export function renderRuntimeChatCommandInventoryMarkdown(options: {
  runtimeCommands: Iterable<string>;
  copilotChatPackageJson?: any;
  detailLevel?: SupportRenderDetailLevel;
}): string {
  const detailLevel = options.detailLevel ?? "full";
  const runtimeCommands = collectRelevantRuntimeCommands(options.runtimeCommands);
  const manifestCommands = collectRelevantManifestCommands(options.copilotChatPackageJson);
  const openLikeRuntimeCommands = runtimeCommands.filter((command) => /open|reveal|resume|continue/i.test(command));

  const lines: string[] = [
    "# Runtime Chat Command Inventory",
    "",
    `- Matched runtime commands: ${runtimeCommands.length}`,
    `- Matched manifest-declared commands: ${manifestCommands.length}`,
    "",
    "## Open Or Resume Candidates"
  ];

  if (openLikeRuntimeCommands.length === 0) {
    lines.push("- No runtime command matched open/reveal/resume/continue patterns inside the selected chat/session command families.");
  } else {
    for (const command of openLikeRuntimeCommands) {
      lines.push(`- ${command}`);
    }
  }

  if (detailLevel === "summary") {
    lines.push(
      "",
      "## Interpretation",
      `- ${GENERIC_SESSION_OPEN_COMMAND} remains the primary exact Local reopen candidate; request detailLevel=full when you need the full runtime and manifest command lists for route analysis.`,
      `- ${EDITOR_CHAT_START_COMMAND} may create a new editor chat, but it is not evidence of reopening an existing Local session.`,
      "- Copilot CLI and cloud session commands remain separate surfaces and do not count as Local reopen support without direct bridge evidence."
    );
    return `${lines.join("\n")}\n`;
  }

  lines.push("", "## Runtime Commands");
  if (runtimeCommands.length === 0) {
    lines.push("- No relevant runtime chat/session commands were found.");
  } else {
    for (const command of runtimeCommands) {
      lines.push(`- ${command}`);
    }
  }

  lines.push("", "## Manifest-Declared Commands");
  if (manifestCommands.length === 0) {
    lines.push("- No relevant chat/session commands were declared in the installed Copilot Chat manifest.");
  } else {
    for (const command of manifestCommands) {
      lines.push(`- ${command}`);
    }
  }

  lines.push(
    "",
    "## Interpretation",
    `- ${GENERIC_SESSION_OPEN_COMMAND} is still the primary exact Local reopen candidate; if it is absent at runtime, a listed command only counts as a real workaround after target-specific execution evidence on the Local surface.`,
    `- ${EDITOR_CHAT_START_COMMAND} can start a new editor chat session but does not by itself prove reopening of an existing Local session.`,
    "- Copilot CLI and cloud session commands do not count as Local reopen support unless a direct bridge to ordinary Local sessions is evidenced."
  );

  return `${lines.join("\n")}\n`;
}

function extractManifestParticipants(packageJson: any): ManifestParticipantSummary[] {
  const rawParticipants = Array.isArray(packageJson?.contributes?.chatParticipants)
    ? packageJson.contributes.chatParticipants
    : [];

  return rawParticipants.map((participant: any) => ({
    id: typeof participant?.id === "string" ? participant.id : "-",
    name: typeof participant?.name === "string" ? participant.name : undefined,
    fullName: typeof participant?.fullName === "string" ? participant.fullName : undefined,
    modes: Array.isArray(participant?.modes)
      ? participant.modes.filter((value: unknown): value is string => typeof value === "string")
      : [],
    isDefault: participant?.isDefault === true,
    isAgent: participant?.isAgent === true
  }));
}

function extractManifestModelCommands(packageJson: any): string[] {
  const commands = Array.isArray(packageJson?.contributes?.commands)
    ? packageJson.contributes.commands
    : [];

  return commands
    .filter((command: any) => {
      const commandId = typeof command?.command === "string" ? command.command.toLowerCase() : "";
      const title = typeof command?.title === "string" ? command.title.toLowerCase() : "";
      return commandId.includes("model") || title.includes("model");
    })
    .map((command: any) => `${command.command} => ${command.title}`);
}

function extractSwitchAgentOptions(packageJson: any): string[] {
  const tools = Array.isArray(packageJson?.contributes?.languageModelTools)
    ? packageJson.contributes.languageModelTools
    : [];

  const switchAgentTool = tools.find((tool: any) => {
    const properties = tool?.inputSchema?.properties;
    return properties && typeof properties === "object" && Array.isArray(properties.agentName?.enum);
  });

  return Array.isArray(switchAgentTool?.inputSchema?.properties?.agentName?.enum)
    ? switchAgentTool.inputSchema.properties.agentName.enum.filter((value: unknown): value is string => typeof value === "string")
    : [];
}

function renderSupportLine(label: string, cell: SupportCell): string {
  return `- ${label}: ${cell.status} | ${cell.reason}`;
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}