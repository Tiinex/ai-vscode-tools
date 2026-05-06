import path from "node:path";
import * as vscode from "vscode";
import { hasObservedCustomAgentMismatch, type ChatCommandResult, type ChatInteropApi, type ChatSessionSummary, type CreateChatRequest, type SendChatMessageRequest } from "./chatInterop";
import { sendPromptToCopilotCliResource } from "./chatInterop/copilotCliDebug";
import { captureCurrentChatFocusReport, focusLikelyEditorChat } from "./chatInterop/editorFocus";
import { renderChatFocusDebugMarkdown, renderChatFocusReportMarkdown } from "./chatInterop/focusTargets";
import { probeLocalReopenCandidates, renderLocalReopenProbeMarkdown } from "./chatInterop/reopenProbe";
import { sendMessageToSession } from "./chatInterop/sessionSendWorkflow";
import { createStabilizedChatAndSend } from "./chatInterop/stabilizedCreateWorkflow";
import { getExactSelfTargetingReason, getFocusedSelfTargetingReason } from "./chatInterop/selfTargetGuard";
import {
  buildLiveChatSupportMatrix,
  renderLiveChatSupportMatrixMarkdown,
  renderRuntimeChatCommandInventoryMarkdown
} from "./chatInterop/supportMatrix";
import type { SessionTarget, SessionToolingAdapter } from "./coreAdapter";
import {
  describeCopilotCliSessionStateRoot,
  inspectCopilotCliSession,
  listCopilotCliSessions,
  renderCopilotCliSessionInspectionMarkdown,
  renderCopilotCliSessionListText
} from "./tooling/copilot-cli";
import {
  FIRST_SLICE_INTERACTIVE_SURFACES_ENABLED,
  LOCAL_CHAT_CONTROL_SURFACES_ENABLED,
  LOCAL_CHAT_MUTATION_SURFACES_ENABLED,
  LOCAL_CHAT_RUNTIME_SURFACES_ENABLED,
  isFirstSliceSessionTool
} from "./firstSlice";
import {
  buildWorkspaceStorageOfflineLocalChatCleanupRequest,
  launchOfflineLocalChatCleanup,
  queueOfflineLocalChatCleanupRequest
} from "./offlineLocalChatCleanup";

type JsonSchema = Record<string, unknown>;
type DetailLevel = "summary" | "full";
type AnchorOccurrence = "first" | "last";

interface ToolContribution {
  name: string;
  displayName: string;
  userDescription: string;
  modelDescription: string;
  toolReferenceName: string;
  inputSchema: JsonSchema;
}

interface SessionSelectionInput {
  storageRoots?: string[];
  scope?: DiscoveryScope;
  sessionId?: string;
  sessionFile?: string;
  latest?: boolean;
}

interface ListSessionsInput {
  storageRoots?: string[];
  scope?: DiscoveryScope;
  limit?: number;
}

interface WindowInput extends SessionSelectionInput {
  anchorText?: string;
  anchorOccurrence?: AnchorOccurrence;
  afterLatestCompact?: boolean;
  before?: number;
  after?: number;
  maxMatches?: number;
  includeNoise?: boolean;
}

interface TranscriptEvidenceInput extends DetailSelectableSessionInput {
  anchorText?: string;
  anchorOccurrence?: AnchorOccurrence;
  afterLatestCompact?: boolean;
  maxBlocks?: number;
}

interface NoiseSelectableInput extends SessionSelectionInput {
  includeNoise?: boolean;
}

interface DetailSelectableSessionInput extends SessionSelectionInput {
  detailLevel?: DetailLevel;
}

interface NoiseSelectableDetailInput extends NoiseSelectableInput {
  detailLevel?: DetailLevel;
}

interface ContextEstimateInput extends NoiseSelectableDetailInput {
  afterLatestCompact?: boolean;
  latestRequestFamilies?: number;
}

interface SurveyInput {
  storageRoots?: string[];
  scope?: DiscoveryScope;
  limit?: number;
}

interface ListCopilotCliSessionsInput {
  sessionStateRoot?: string;
  limit?: number;
}

interface InspectCopilotCliSessionInput {
  sessionStateRoot?: string;
  sessionId?: string;
  latest?: boolean;
}

interface SendCopilotCliPromptInput {
  sessionId?: string;
  latest?: boolean;
  prompt: string;
}

type DiscoveryScope = "all-local" | "current-workspace";

interface ListLiveChatsInput {
  limit?: number;
}

interface InspectLiveChatSupportInput {
  detailLevel?: DetailLevel;
}

interface InspectRuntimeChatCommandsInput {
  detailLevel?: DetailLevel;
}

interface ProbeLocalReopenCandidatesInput {
  sessionId: string;
}

interface InspectChatFocusTargetsInput {}

interface InspectChatFocusDebugInput {
  detailLevel?: DetailLevel;
}

interface LiveChatSelectionInput {
  sessionId: string;
}

interface CloseVisibleLiveChatTabsInput {
  sessionId: string;
}

interface DeleteLiveChatArtifactsInput {
  sessionId: string;
}

interface ScheduleOfflineLiveChatCleanupInput {
  sessionId: string;
}

interface FocusedEditorChatSelectionInput {
  sessionId?: string;
}

interface LiveChatMutationInput {
  prompt: string;
  agentName?: string;
  mode?: string;
  modelId?: string;
  modelVendor?: string;
  partialQuery?: boolean;
  blockOnResponse?: boolean;
  requireSelectionEvidence?: boolean;
}

interface CreateDisposableLocalDeleteProbeInput extends Omit<LiveChatMutationInput, "prompt"> {
  prompt?: string;
  anchor?: string;
}

interface DisposableDeleteProbeCommandResult {
  anchor: string;
  prompt: string;
  result: ChatCommandResult;
}

interface StabilizedLiveChatMutationInput extends LiveChatMutationInput {}

interface FocusedLiveChatMutationInput extends LiveChatMutationInput {}

interface FocusedEditorChatMutationInput extends LiveChatMutationInput {
  sessionId?: string;
}

interface SendLiveChatMessageInput extends LiveChatMutationInput {
  sessionId: string;
  allowTransportWorkaround?: boolean;
}

const DEFAULT_MAX_OUTPUT_CHARS = 12_000;
const HARD_MAX_OUTPUT_CHARS = 20_000;
const detailLevelProperty = {
  type: "string",
  description: "Control how much inline detail is returned. Use summary for compact status or inventory output, or full for raw evidence sections and complete listings.",
  enum: ["summary", "full"]
} as const;
const anchorOccurrenceProperty = {
  type: "string",
  description: "When multiple anchor matches exist, choose the first or last match after any compaction filter.",
  enum: ["first", "last"]
} as const;
const SESSION_INSPECTION_ROUTING_NOTE = " Use these dedicated inspection tools instead of VS Code built-in chat references UI when the question is about persisted session evidence. Prefer snapshot, index, window, profile, transcript, or export surfaces over opening raw session files, and do not delegate that inspection to agent-architect." as const;
const afterLatestCompactProperty = {
  type: "boolean",
  description: "Restrict the result to rows or blocks at or after the latest persisted compaction boundary."
} as const;
const sessionSelectionProperties = {
  storageRoots: {
    type: "array",
    description: "Optional absolute workspaceStorage roots to scan instead of the defaults.",
    items: {
      type: "string"
    }
  },
  scope: {
    type: "string",
    description: "Discovery scope. Use current-workspace to filter to the active VS Code workspace when available, or all-local to scan all local workspaceStorage roots.",
    enum: ["all-local", "current-workspace"]
  },
  sessionId: {
    type: "string",
    description: "Exact or prefix session identifier. If omitted, the latest session is used unless sessionFile is provided."
  },
  sessionFile: {
    type: "string",
    description: "Absolute path to a chatSessions/<sessionId>.jsonl file."
  },
  latest: {
    type: "boolean",
    description: "Use the most recently modified discovered session."
  }
} as const;

const ALL_TOOL_CONTRIBUTIONS: ToolContribution[] = [
  {
    name: "list_agent_sessions",
    displayName: "List Agent Sessions",
    userDescription: "List recent stored local chat sessions from workspace storage.",
    modelDescription: "List recent stored local chat sessions. Use this when you need to discover available session ids before inspecting a specific session. The tool returns a bounded text list with session id, timestamp, size, and path. It is read-only and only inspects persisted local session metadata." + SESSION_INSPECTION_ROUTING_NOTE,
    toolReferenceName: "agent-sessions",
    inputSchema: {
      type: "object",
      properties: {
        storageRoots: sessionSelectionProperties.storageRoots,
        scope: sessionSelectionProperties.scope,
        limit: {
          type: "number",
          description: "Maximum number of sessions to return."
        }
      }
    }
  },
  {
    name: "get_agent_session_index",
    displayName: "Get Agent Session Index",
    userDescription: "Render a bounded trailing index of recent persisted rows for one stored session.",
    modelDescription: "Render a bounded trailing index of recent persisted rows for one stored local chat session. Use this to inspect recent activity without exporting the full session. It is read-only and returns markdown." + SESSION_INSPECTION_ROUTING_NOTE,
    toolReferenceName: "agent-session-index",
    inputSchema: {
      type: "object",
      properties: {
        ...sessionSelectionProperties
      }
    }
  },
  {
    name: "get_agent_session_window",
    displayName: "Get Agent Session Window",
    userDescription: "Render a bounded window of persisted rows around matching anchor text in one session.",
    modelDescription: "Render a bounded window of persisted rows around matching anchor text in one stored local chat session. Use this when you need local context around a phrase or event rather than a full export. You may also anchor the window at the latest persisted compaction boundary by setting afterLatestCompact=true. It is read-only and returns markdown." + SESSION_INSPECTION_ROUTING_NOTE,
    toolReferenceName: "agent-session-window",
    inputSchema: {
      type: "object",
      properties: {
        ...sessionSelectionProperties,
        anchorText: {
          type: "string",
          description: "Text to search for in persisted rows."
        },
        before: {
          type: "number",
          description: "Number of rows before each match to include."
        },
        after: {
          type: "number",
          description: "Number of rows after each match to include."
        },
        maxMatches: {
          type: "number",
          description: "Maximum number of matching windows to include."
        },
        anchorOccurrence: anchorOccurrenceProperty,
        afterLatestCompact: afterLatestCompactProperty,
        includeNoise: {
          type: "boolean",
          description: "Include low-signal rows such as selections and model-state rows."
        }
      }
    }
  },
  {
    name: "export_agent_session_markdown",
    displayName: "Export Agent Session Markdown",
    userDescription: "Render a markdown export of one stored session.",
    modelDescription: "Render a markdown export of one stored local chat session. Use this when you need a broader persisted-session view than an index, snapshot, or profile. It is read-only in this extension surface and returns markdown inline instead of writing files." + SESSION_INSPECTION_ROUTING_NOTE,
    toolReferenceName: "agent-session-export",
    inputSchema: {
      type: "object",
      properties: {
        ...sessionSelectionProperties,
        includeNoise: {
          type: "boolean",
          description: "Include low-signal rows such as selections and model-state rows."
        }
      }
    }
  },
  {
    name: "export_agent_evidence_transcript",
    displayName: "Export Agent Evidence Transcript",
    userDescription: "Render a canonical evidence transcript for one stored session.",
    modelDescription: "Render a canonical evidence transcript from persisted transcript artifacts for one stored local chat session. Use this when you need a findings-safe transcript view with explicit omissions and provenance. By default this agent-facing tool returns a compact block inventory; pass detailLevel=full when you need verbatim payload contents. You can additionally filter from the latest persisted compaction boundary, from an anchor block, or cap the emitted block count. It is read-only and returns markdown." + SESSION_INSPECTION_ROUTING_NOTE,
    toolReferenceName: "agent-session-transcript",
    inputSchema: {
      type: "object",
      properties: {
        ...sessionSelectionProperties,
        anchorText: {
          type: "string",
          description: "Optional text to search for in evidence blocks after any compaction filter."
        },
        anchorOccurrence: anchorOccurrenceProperty,
        afterLatestCompact: afterLatestCompactProperty,
        maxBlocks: {
          type: "number",
          description: "Maximum number of evidence blocks to emit after the applied filters."
        },
        detailLevel: detailLevelProperty
      }
    }
  },
  {
    name: "get_agent_session_snapshot",
    displayName: "Get Agent Session Snapshot",
    userDescription: "Render a compact current-state snapshot for one stored session.",
    modelDescription: "Render a compact current-state snapshot for one stored local chat session. Use this for a small current-state summary derived from persisted artifacts, including persisted input mode, selected model, and latest request agent/model fields when recoverable. It is read-only and returns markdown." + SESSION_INSPECTION_ROUTING_NOTE,
    toolReferenceName: "agent-session-snapshot",
    inputSchema: {
      type: "object",
      properties: {
        ...sessionSelectionProperties,
        includeNoise: {
          type: "boolean",
          description: "Include low-signal rows such as selections and model-state rows."
        }
      }
    }
  },
  {
    name: "estimate_agent_context_breakdown",
    displayName: "Estimate Agent Context Breakdown",
    userDescription: "Estimate persisted context pressure by category for one stored session.",
    modelDescription: "Estimate persisted context pressure by category for one stored local chat session. Use this when you need a bounded heuristic picture of context utilization from persisted artifacts. By default this agent-facing tool returns a compact summary; pass detailLevel=full for the complete breakdown and signal list. You can restrict the estimate to content after the latest persisted compaction boundary and optionally cap the number of latest request families included. It is read-only and returns markdown." + SESSION_INSPECTION_ROUTING_NOTE,
    toolReferenceName: "agent-context-breakdown",
    inputSchema: {
      type: "object",
      properties: {
        ...sessionSelectionProperties,
        includeNoise: {
          type: "boolean",
          description: "Include low-signal rows such as selections and model-state rows."
        },
        afterLatestCompact: afterLatestCompactProperty,
        latestRequestFamilies: {
          type: "number",
          description: "Optional cap on how many latest request families to include in the bounded estimate."
        },
        detailLevel: detailLevelProperty
      }
    }
  },
  {
    name: "get_agent_session_profile",
    displayName: "Get Agent Session Profile",
    userDescription: "Render a findings-first diagnostic profile for one stored session.",
    modelDescription: "Render a findings-first diagnostic profile for one stored local chat session. Use this when you want the main risks and context signals summarized from persisted artifacts. It is read-only and returns markdown." + SESSION_INSPECTION_ROUTING_NOTE,
    toolReferenceName: "agent-session-profile",
    inputSchema: {
      type: "object",
      properties: {
        ...sessionSelectionProperties,
        includeNoise: {
          type: "boolean",
          description: "Include low-signal rows such as selections and model-state rows."
        }
      }
    }
  },
  {
    name: "survey_agent_sessions",
    displayName: "Survey Agent Sessions",
    userDescription: "Compare several recent stored sessions with compact diagnostic metrics.",
    modelDescription: "Compare several recent stored local chat sessions with compact diagnostic metrics. Use this when you need a quick cross-session view instead of inspecting only one session. It is read-only and returns markdown." + SESSION_INSPECTION_ROUTING_NOTE,
    toolReferenceName: "agent-session-survey",
    inputSchema: {
      type: "object",
      properties: {
        storageRoots: sessionSelectionProperties.storageRoots,
        scope: sessionSelectionProperties.scope,
        limit: {
          type: "number",
          description: "Maximum number of recent sessions to include in the survey."
        }
      }
    }
  },
  {
    name: "list_copilot_cli_sessions",
    displayName: "List Copilot CLI Sessions",
    userDescription: "List recent Copilot CLI session-state directories.",
    modelDescription: `List recent Copilot CLI session-state directories from the host default root ${describeCopilotCliSessionStateRoot()} or a supplied root. Use this before inspecting a specific Copilot CLI worker lane. The tool is read-only and returns a bounded text list.`,
    toolReferenceName: "copilot-cli-sessions",
    inputSchema: {
      type: "object",
      properties: {
        sessionStateRoot: {
          type: "string",
          description: "Optional absolute root for Copilot CLI session-state instead of the host default root."
        },
        limit: {
          type: "number",
          description: "Maximum number of Copilot CLI sessions to return."
        }
      }
    }
  },
  {
    name: "inspect_copilot_cli_session",
    displayName: "Inspect Copilot CLI Session",
    userDescription: "Render a bounded inspection of one Copilot CLI session-state entry.",
    modelDescription: "Render a bounded inspection of one Copilot CLI session-state entry, including the latest persisted turn summary from events.jsonl. Use this when you need the latest worker-lane outcome without reading the raw log. The tool is read-only and returns markdown.",
    toolReferenceName: "copilot-cli-session-inspection",
    inputSchema: {
      type: "object",
      properties: {
        sessionStateRoot: {
          type: "string",
          description: "Optional absolute root for Copilot CLI session-state instead of the host default root."
        },
        sessionId: {
          type: "string",
          description: "Exact or prefix Copilot CLI session identifier. If omitted, the latest session is used."
        },
        latest: {
          type: "boolean",
          description: "Use the most recently modified Copilot CLI session-state entry."
        }
      }
    }
  },
  {
    name: "send_prompt_to_copilot_cli_session",
    displayName: "Send Prompt To Copilot CLI Session",
    userDescription: "Send a prompt to an exact Copilot CLI session-state resource.",
    modelDescription: "Send a prompt to an exact Copilot CLI session-state resource using the Copilot CLI-specific openSessionWithPrompt command. Use this when Local chat cannot target an exact session reliably and you need a verifiable worker-lane transport instead. This tool affects the VS Code UI and targets Copilot CLI sessions, not ordinary Local chats.",
    toolReferenceName: "send-copilot-cli-session-prompt",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Exact or prefix Copilot CLI session identifier. If omitted, the latest session is used unless latest is false."
        },
        latest: {
          type: "boolean",
          description: "Use the most recently modified Copilot CLI session-state entry. Defaults to true when sessionId is omitted."
        },
        prompt: {
          type: "string",
          description: "The prompt to send into the target Copilot CLI session."
        }
      },
      required: ["prompt"]
    }
  },
  {
    name: "inspect_live_chat_support",
    displayName: "Inspect Live Chat Support",
    userDescription: "Render the current Copilot Chat live-interaction support matrix for this build.",
    modelDescription: "Render the current Copilot Chat live-interaction support matrix for this build. Use this when you need an explicit, evidence-bound answer about whether Local live chat can open new chats, set mode/model, select a custom agent, or target an exact existing session. By default this agent-facing tool returns a compact capability summary; pass detailLevel=full for runtime command and manifest sections. The tool is read-only and combines current runtime commands with the installed Copilot Chat manifest.",
    toolReferenceName: "live-chat-support",
    inputSchema: {
      type: "object",
      properties: {
        detailLevel: detailLevelProperty
      }
    }
  },
  {
    name: "inspect_runtime_chat_commands",
    displayName: "Inspect Runtime Chat Commands",
    userDescription: "Render a bounded inventory of runtime and manifest chat/session commands.",
    modelDescription: "Render a bounded inventory of currently registered runtime chat/session commands plus related manifest-declared Copilot Chat commands. Use this when you need to exhaust possible Local reopen or resume workarounds before concluding that exact Local reopen is unsupported. By default this agent-facing tool returns a compact summary with candidate counts; pass detailLevel=full for complete command lists.",
    toolReferenceName: "runtime-chat-commands",
    inputSchema: {
      type: "object",
      properties: {
        detailLevel: detailLevelProperty
      }
    }
  },
  {
    name: "probe_local_reopen_candidates",
    displayName: "Probe Local Reopen Candidates",
    userDescription: "Try runtime reopen candidates against a specific Local chat session.",
    modelDescription: "Try runtime chat reopen candidates against a specific Local chat session and verify whether the requested editor-hosted Local chat actually opens in the current window. Use this when exact Local reopen appears unsupported but runtime command inventory still shows possible openSessionIn... or showAsChatSession workarounds.",
    toolReferenceName: "probe-local-reopen-candidates",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Exact or prefix Local session identifier to probe for a reopen workaround."
        }
      },
      required: ["sessionId"]
    }
  },
  {
    name: "inspect_chat_focus_targets",
    displayName: "Inspect Chat Focus Targets",
    userDescription: "Render the current chat focus target report from VS Code tab groups.",
    modelDescription: "Render the current chat focus target report from VS Code tab groups plus persisted live-chat titles. Use this before editor-focused live-chat send when you need evidence about which visible tab currently looks like the intended editor-hosted Local chat.",
    toolReferenceName: "chat-focus-targets",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "inspect_chat_focus_debug",
    displayName: "Inspect Chat Focus Debug",
    userDescription: "Render raw debug details for current editor chat tabs.",
    modelDescription: "Render a raw debug report for current editor chat tabs, including shallow object keys and collected string hints from tab input metadata. Use this when a Local editor chat appears visible in the UI but cannot be matched to a persisted session title through the normal focus-target report. By default this agent-facing tool returns a compact likely-chat-editor summary; pass detailLevel=full for raw object keys and string hints for every tab.",
    toolReferenceName: "chat-focus-debug",
    inputSchema: {
      type: "object",
      properties: {
        detailLevel: detailLevelProperty
      }
    }
  },
  {
    name: "list_live_agent_chats",
    displayName: "List Live Agent Chats",
    userDescription: "List local live chat sessions that can be reopened or continued.",
    modelDescription: "List local live chat sessions that can be reopened or continued. Use this before sending a new message into an existing chat. The tool is observational and reflects best-effort disk-backed session discovery.",
    toolReferenceName: "live-agent-chats",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of live chats to include."
        }
      }
    }
  },
  {
    name: "create_live_agent_chat",
    displayName: "Create Live Agent Chat",
    userDescription: "Host-bounded new-chat create route. Prefer Send Message With Lifecycle with an explicit agent when startup state must not drift.",
    modelDescription: "Low-level Local create route. Opens a new chat and sends the first prompt. On the current host, do not treat a plain create as a trustworthy neutral default because it can inherit active chat mode or model state. Prefer send_message_with_lifecycle with an explicit agentName when startup state must not drift, or work against an existing target via reveal plus send. This tool affects the VS Code UI and rejects concurrent live-chat operations.",
    toolReferenceName: "create-live-agent-chat",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The first prompt to send in the new live chat."
        },
        agentName: {
          type: "string",
          description: "Optional custom agent selector to prefix as #agentName in the dispatched prompt."
        },
        mode: {
          type: "string",
          description: "Optional chat mode, for example Agent."
        },
        modelId: {
          type: "string",
          description: "Optional model identifier to select for the live chat."
        },
        modelVendor: {
          type: "string",
          description: "Optional model vendor for the live chat model selector."
        },
        partialQuery: {
          type: "boolean",
          description: "Open with a partial query instead of dispatching a full request when supported."
        },
        blockOnResponse: {
          type: "boolean",
          description: "Block until a response is produced when supported by the underlying chat command."
        },
        requireSelectionEvidence: {
          type: "boolean",
          description: "Fail if the requested agent, mode, or model selection cannot be explicitly evidenced after dispatch."
        }
      },
      required: ["prompt"]
    }
  },
  {
    name: "create_disposable_local_delete_probe",
    displayName: "Create Disposable Local Delete Probe",
    userDescription: "Create a disposable Local probe chat for destructive delete verification.",
    modelDescription: "Create a disposable Local probe chat specifically for destructive delete verification. This route generates or carries a unique anchor, uses the extension-hosted create path, and returns structured probe details so the target can be verified in persisted state before any destructive cleanup step. Prefer this over shell-side bootstrap helpers when you need a disposable test chat rather than a general new Local chat.",
    toolReferenceName: "create-disposable-local-delete-probe",
    inputSchema: {
      type: "object",
      properties: {
        anchor: {
          type: "string",
          description: "Optional explicit anchor to embed in the disposable probe prompt. If omitted, a unique delete-probe anchor is generated."
        },
        prompt: {
          type: "string",
          description: "Optional probe prompt body. If omitted, the default READY probe prompt is used and prefixed with the anchor."
        },
        agentName: {
          type: "string",
          description: "Optional custom agent selector to prefix as #agentName in the dispatched probe prompt."
        },
        mode: {
          type: "string",
          description: "Optional chat mode, for example Agent."
        },
        modelId: {
          type: "string",
          description: "Optional model identifier to select for the disposable probe chat."
        },
        modelVendor: {
          type: "string",
          description: "Optional model vendor for the probe model selector."
        },
        partialQuery: {
          type: "boolean",
          description: "Open the probe with a partial query instead of dispatching a full request when supported."
        },
        blockOnResponse: {
          type: "boolean",
          description: "Block until the probe response is produced when supported by the underlying chat command."
        },
        requireSelectionEvidence: {
          type: "boolean",
          description: "Fail if the requested agent, mode, or model selection cannot be explicitly evidenced after dispatch."
        }
      }
    }
  },
  {
    name: "close_visible_live_chat_tabs",
    displayName: "Close Visible Live Chat Tabs",
    userDescription: "Close visible editor-hosted live chat tabs for one exact session.",
    modelDescription: "Close visible editor-hosted live chat tabs for an exact or prefix session identifier without deleting the persisted session itself. Use this for safe Local cleanup after probes or tests when the target chat may still be open in editor tabs. This tool affects the VS Code UI and relies on exact tab-matching checks in the close path rather than the heuristic exact-session self-targeting guard.",
    toolReferenceName: "close-visible-live-chat-tabs",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Exact or prefix session identifier for the live chat whose visible editor tabs should be closed."
        }
      },
      required: ["sessionId"]
    }
  },
  {
    name: "delete_live_agent_chat_artifacts",
    displayName: "Delete Live Agent Chat Artifacts",
    userDescription: "Close visible editor-hosted tabs and delete persisted artifacts for one live chat session.",
    modelDescription: "Close visible editor-hosted Local chat tabs for one exact session identifier and then delete that session's persisted session JSONL plus known transcript and chat-resource companion artifacts from disk. This destructive route requires the full session id, refuses heuristic title-only editor matches, and is intended only for probe or test-chat cleanup. This tool affects the VS Code UI and relies on exact close-before-delete checks in the delete path rather than the heuristic exact-session self-targeting guard.",
    toolReferenceName: "delete-live-agent-chat-artifacts",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Exact session identifier for the live chat whose persisted artifacts should be deleted from disk. Prefixes are rejected for this destructive route."
        }
      },
      required: ["sessionId"]
    }
  },
  {
    name: "send_message_with_lifecycle",
    displayName: "Send Message With Lifecycle",
    userDescription: "Preferred high-level Local create route when an explicit agent should anchor new-chat startup.",
    modelDescription: "Preferred high-level Local create route. Seeds a new chat, patches persisted mode or model when needed, and then continues through the normal Local follow-up path. Use this instead of raw create when a new chat must be anchored by an explicit agent start rather than left to active host UI state. This tool still depends on the same Local follow-up surface and cannot bypass host limits such as missing ordinary Local exact-session send.",
    toolReferenceName: "send-message-with-lifecycle",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The real prompt to send after the lifecycle has stabilized the target chat."
        },
        agentName: {
          type: "string",
          description: "Optional requested custom agent name. The lifecycle will resolve a workspace agent file when possible and patch persisted mode before the real prompt is sent."
        },
        mode: {
          type: "string",
          description: "Optional explicit mode id to patch into persisted session state before the real prompt is sent."
        },
        modelId: {
          type: "string",
          description: "Optional model identifier to request during create and patch from persisted metadata if the create path falls back."
        },
        modelVendor: {
          type: "string",
          description: "Optional model vendor for the requested model selector."
        },
        blockOnResponse: {
          type: "boolean",
          description: "Block until the real follow-up response is produced when supported by the underlying lifecycle path."
        },
        requireSelectionEvidence: {
          type: "boolean",
          description: "Fail if the final lifecycle result cannot explicitly evidence the requested selection."
        }
      },
      required: ["prompt"]
    }
  },
  {
    name: "schedule_offline_live_agent_chat_cleanup",
    displayName: "Schedule Offline Live Chat Cleanup",
    userDescription: "Queue exact offline cleanup for one live chat session after VS Code exits.",
    modelDescription: "Queue exact offline cleanup for one Local live chat session after VS Code exits. This destructive route requires the full session id, derives exact artifact paths for the target workspaceStorage session, and launches the detached offline cleanup runtime that waits for VS Code to close before pruning queued artifacts and state. Use this when direct delete should not run immediately or when you want the same exact-target semantics preserved for deferred cleanup.",
    toolReferenceName: "schedule-offline-live-chat-cleanup",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Exact session identifier for the live chat whose offline cleanup should be queued. Prefixes are rejected for this destructive route."
        }
      },
      required: ["sessionId"]
    }
  },
  {
    name: "send_message_to_live_agent_chat",
    displayName: "Send Message To Live Agent Chat",
    userDescription: "Advanced exact-session continuation for an existing live chat.",
    modelDescription: "Advanced exact-session continuation by session id. Use this only when you already have the target session and need to probe exact-session behavior. On builds where ordinary Local exact send is unsupported, this tool may still fall back to reveal plus focused submit and therefore remains subject to host limits.",
    toolReferenceName: "send-message-live-agent-chat",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Exact or prefix session identifier for the live chat to continue."
        },
        prompt: {
          type: "string",
          description: "The prompt to send into the existing live chat."
        },
        agentName: {
          type: "string",
          description: "Optional custom agent selector to prefix as #agentName in the dispatched prompt."
        },
        mode: {
          type: "string",
          description: "Optional chat mode override, for example Agent."
        },
        modelId: {
          type: "string",
          description: "Optional model identifier to select for the live chat."
        },
        modelVendor: {
          type: "string",
          description: "Optional model vendor for the live chat model selector."
        },
        partialQuery: {
          type: "boolean",
          description: "Open with a partial query instead of dispatching a full request when supported."
        },
        blockOnResponse: {
          type: "boolean",
          description: "Block until a response is produced when supported by the underlying chat command."
        },
        requireSelectionEvidence: {
          type: "boolean",
          description: "Fail if the requested agent, mode, or model selection cannot be explicitly evidenced after dispatch."
        },
        allowTransportWorkaround: {
          type: "boolean",
          description: "If true, and this build lacks ordinary Local exact send, allow a decoy-session workaround when the latest-session self-targeting guard would otherwise block the send. This is transport-workaround evidence, not strict exact-session proof."
        }
      },
      required: ["sessionId", "prompt"]
    }
  },
  {
    name: "send_message_to_focused_live_chat",
    displayName: "Send Message To Focused Live Chat",
    userDescription: "Send a prompt through the currently focused live chat input.",
    modelDescription: "Send a prompt through the currently focused live chat input using focusInput plus chat.submit when this build exposes those commands. Use this only when the intended Local chat is already visible and focused, because it is a best-effort focused-thread transport rather than an exact session-targeted API. This tool affects the VS Code UI and rejects concurrent live-chat operations. A heuristic self-targeting guard blocks use when the current invoking conversation appears to be the focused thread.",
    toolReferenceName: "send-message-focused-live-chat",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The prompt to send through the currently focused live chat input."
        },
        agentName: {
          type: "string",
          description: "Optional custom agent selector to prefix as #agentName in the dispatched prompt."
        },
        mode: {
          type: "string",
          description: "Optional chat mode override. Focused live send cannot reliably apply or prove this on the current build."
        },
        modelId: {
          type: "string",
          description: "Optional model identifier. Focused live send cannot reliably apply or prove this on the current build."
        },
        modelVendor: {
          type: "string",
          description: "Optional model vendor for the requested model selector."
        },
        partialQuery: {
          type: "boolean",
          description: "Reserved for compatibility; focused live send uses a partial prefill before submit on this build."
        },
        blockOnResponse: {
          type: "boolean",
          description: "Reserved for compatibility with other live chat mutation tools."
        },
        requireSelectionEvidence: {
          type: "boolean",
          description: "Fail if the requested agent selection cannot be explicitly evidenced after dispatch."
        }
      },
      required: ["prompt"]
    }
  },
  {
    name: "focus_visible_editor_live_chat",
    displayName: "Focus Visible Editor Live Chat",
    userDescription: "Steer focus to a visible editor-hosted live chat without sending a prompt.",
    modelDescription: "Steer focus to the active editor group, or to a visible editor-hosted chat tab matching an optional live session id, and verify that the resulting active tab still looks like an editor-hosted Local chat. Use this to satisfy the target-confirmation gate before any focused editor-chat prompt send. This tool affects the VS Code UI but does not dispatch a prompt.",
    toolReferenceName: "focus-visible-editor-live-chat",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Optional exact or prefix session identifier for the visible editor-hosted live chat to focus. When omitted, the active editor-group candidate is used."
        }
      }
    }
  },
  {
    name: "send_message_to_focused_editor_chat",
    displayName: "Send Message To Focused Editor Chat",
    userDescription: "Steer focus to the active editor chat and send a prompt there.",
    modelDescription: "Steer focus to the active editor group, or to a visible editor-hosted chat tab matching an optional live session id, verify that the resulting active tab still looks like an editor-hosted Local chat, and then dispatch a prompt through the focused chat input. Use this when a side-panel chat currently has focus but the intended Local target is already open in an editor tab. This tool affects the VS Code UI and remains best-effort until the touched session is verified from persisted artifacts. A heuristic self-targeting guard blocks ambiguous sends and prefers an explicit sessionId.",
    toolReferenceName: "send-message-focused-editor-chat",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Optional exact or prefix session identifier for the visible editor-hosted live chat to focus before submit. When omitted, the active editor-group candidate is used."
        },
        prompt: {
          type: "string",
          description: "The prompt to send through the focused editor-hosted live chat."
        },
        agentName: {
          type: "string",
          description: "Optional custom agent selector to prefix as #agentName in the dispatched prompt."
        },
        mode: {
          type: "string",
          description: "Optional chat mode override. Focused editor send cannot reliably apply or prove this on the current build."
        },
        modelId: {
          type: "string",
          description: "Optional model identifier. Focused editor send cannot reliably apply or prove this on the current build."
        },
        modelVendor: {
          type: "string",
          description: "Optional model vendor for the requested model selector."
        },
        partialQuery: {
          type: "boolean",
          description: "Reserved for compatibility; focused editor send uses a partial prefill before submit on this build."
        },
        blockOnResponse: {
          type: "boolean",
          description: "Reserved for compatibility with other live chat mutation tools."
        },
        requireSelectionEvidence: {
          type: "boolean",
          description: "Fail if the requested agent selection cannot be explicitly evidenced after dispatch."
        }
      },
      required: ["prompt"]
    }
  },
  {
    name: "reveal_live_agent_chat",
    displayName: "Reveal Live Agent Chat",
    userDescription: "Re-open an existing live chat so the visible thread reloads current persisted state.",
    modelDescription: "Re-open an existing live chat session in the side panel when the current build supports internal session-targeted chat commands. When a matching editor-hosted Local chat tab is already open, this path closes that tab first so the reopened session reloads current persisted state. Use this before inspection or best-effort follow-up when the visible thread must match persisted state.",
    toolReferenceName: "reveal-live-agent-chat",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Exact or prefix session identifier for the live chat to reveal."
        }
      },
      required: ["sessionId"]
    }
  }
];

const LOCAL_CHAT_CONTROL_TOOL_NAMES = new Set([
  "list_live_agent_chats",
  "close_visible_live_chat_tabs",
  "reveal_live_agent_chat"
]);

const LOCAL_CHAT_MUTATION_TOOL_NAMES = new Set([
  "create_live_agent_chat",
  "send_message_to_live_agent_chat",
  "send_message_to_focused_live_chat"
]);

function isEnabledToolContribution(toolName: string): boolean {
  return isFirstSliceSessionTool(toolName)
    || (LOCAL_CHAT_CONTROL_SURFACES_ENABLED && LOCAL_CHAT_CONTROL_TOOL_NAMES.has(toolName))
    || (LOCAL_CHAT_MUTATION_SURFACES_ENABLED && LOCAL_CHAT_MUTATION_TOOL_NAMES.has(toolName));
}

export const EXTENSION_TOOL_CONTRIBUTIONS: ToolContribution[] = FIRST_SLICE_INTERACTIVE_SURFACES_ENABLED
  ? ALL_TOOL_CONTRIBUTIONS
  : ALL_TOOL_CONTRIBUTIONS.filter((tool) => isEnabledToolContribution(tool.name));

function outputBudget(tokenBudget: number | undefined): number {
  if (!Number.isFinite(tokenBudget) || !tokenBudget || tokenBudget <= 0) {
    return DEFAULT_MAX_OUTPUT_CHARS;
  }
  return Math.max(2_000, Math.min(HARD_MAX_OUTPUT_CHARS, Math.floor(tokenBudget * 4)));
}

function resolveScopedStorageRoots(
  explicitStorageRoots: string[] | undefined,
  scope: DiscoveryScope | undefined,
  currentWorkspaceStorageRoots: string[] | undefined
): string[] | undefined {
  if (explicitStorageRoots?.length) {
    return explicitStorageRoots;
  }
  if (scope === "current-workspace") {
    return currentWorkspaceStorageRoots?.length ? currentWorkspaceStorageRoots : [];
  }
  return undefined;
}

function normalizeSessionTarget(input: SessionSelectionInput, currentWorkspaceStorageRoots?: string[]): SessionTarget {
  const { storageRoots, scope, sessionId, sessionFile, latest } = input;
  return {
    storageRoots: resolveScopedStorageRoots(storageRoots, scope, currentWorkspaceStorageRoots),
    sessionId,
    sessionFile,
    latest: latest ?? (!sessionId && !sessionFile)
  };
}

function textResult(content: string): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(content)]);
}

function renderLiveChatList(chats: ChatSessionSummary[], limit: number): string {
  const lines = [
    "# Live Agent Chats",
    "",
    `- Sessions listed: ${Math.min(limit, chats.length)}`,
    ""
  ];
  for (const chat of chats.slice(0, limit)) {
    lines.push(
      `- ${chat.title || chat.id}`,
      `  id=${chat.id}`,
      `  updated=${chat.lastUpdated}`,
      `  mode=${chat.mode ?? "-"}`,
      `  agent=${chat.agent ?? "-"}`,
      `  model=${chat.model ?? "-"}`,
      `  provider=${chat.provider}`
    );
  }
  return `${lines.join("\n")}\n`;
}

async function resolveCopilotCliSessionTarget(input: SendCopilotCliPromptInput): Promise<Awaited<ReturnType<typeof listCopilotCliSessions>>[number]> {
  const sessions = await listCopilotCliSessions({
    limit: 20
  });

  if (sessions.length === 0) {
    throw new Error("No Copilot CLI session-state directory with events.jsonl was found.");
  }

  if (input.sessionId?.trim()) {
    const requested = input.sessionId.trim();
    const match = sessions.find((session) => session.sessionId === requested || session.sessionId.startsWith(requested));
    if (!match) {
      throw new Error(`No Copilot CLI session matched ${JSON.stringify(requested)}.`);
    }
    return match;
  }

  if (input.latest === false) {
    throw new Error("sessionId is required when latest is false.");
  }

  return sessions[0];
}

function formatCopilotCliSendResult(session: Awaited<ReturnType<typeof listCopilotCliSessions>>[number]): string {
  return [
    "# Copilot CLI Prompt Sent",
    "",
    `- Session ID: ${session.sessionId}`,
    `- Resource: ${session.canonicalResource}`,
    `- Updated: ${session.updatedAt ?? "-"}`,
    `- Workspace: ${session.cwd ?? "-"}`,
    `- Summary: ${session.summary ?? "-"}`
  ].join("\n");
}

function toCreateChatRequest(input: LiveChatMutationInput): CreateChatRequest {
  return {
    prompt: input.prompt,
    agentName: input.agentName,
    mode: input.mode,
    modelSelector: input.modelId ? { id: input.modelId, vendor: input.modelVendor } : undefined,
    partialQuery: input.partialQuery,
    blockOnResponse: input.blockOnResponse,
    requireSelectionEvidence: input.requireSelectionEvidence
  };
}

function toDisposableDeleteProbeCommandRequest(input: CreateDisposableLocalDeleteProbeInput): Record<string, unknown> {
  return {
    anchor: input.anchor,
    prompt: input.prompt,
    agentName: input.agentName,
    mode: input.mode,
    modelSelector: input.modelId ? { id: input.modelId, vendor: input.modelVendor } : undefined,
    partialQuery: input.partialQuery,
    blockOnResponse: input.blockOnResponse,
    requireSelectionEvidence: input.requireSelectionEvidence,
    showNotification: false
  };
}

function toSendChatMessageRequest(input: SendLiveChatMessageInput): SendChatMessageRequest {
  return {
    sessionId: input.sessionId,
    allowTransportWorkaround: input.allowTransportWorkaround,
    ...toCreateChatRequest(input)
  };
}

function buildTransportDecoyPrompt(): string {
  return `AA_TRANSPORT_DECOY_${Date.now()} Reply with exactly: DECOY_ACK`;
}

async function tryPrepareLatestSessionTransportWorkaround(
  chatInterop: ChatInteropApi,
  request: SendChatMessageRequest
): Promise<string[]> {
  const chats = await chatInterop.listChats();
  const guardReason = getExactSelfTargetingReason(chats, request.sessionId, "send");
  if (!guardReason) {
    return [];
  }

  if (!request.allowTransportWorkaround) {
    throw new Error(guardReason);
  }

  const exactSupport = await chatInterop.getExactSessionInteropSupport();
  if (exactSupport.canSendExactSessionMessage) {
    throw new Error(`${guardReason} Exact Local send is available on this build, so the decoy workaround is intentionally disabled here.`);
  }

  const decoyResult = await chatInterop.createChat({
    prompt: buildTransportDecoyPrompt(),
    blockOnResponse: false,
    requireSelectionEvidence: false
  });
  if (!decoyResult.ok || !decoyResult.session?.id) {
    throw new Error(decoyResult.reason ?? decoyResult.error ?? "Failed to create the transport decoy chat needed to break latest-session ambiguity.");
  }
  return [
    "Transport Workaround Used: latest-session decoy",
    `Transport Decoy Session ID: ${decoyResult.session.id}`,
    "Transport Workaround Interpretation: this run used an explicit decoy to break the heuristic latest-session self-targeting guard before the real send. Treat it as transport-workaround evidence, not strict exact-session proof."
  ];
}

function formatChatMutationResult(
  action: string,
  session: ChatSessionSummary | undefined,
  selection: ChatCommandResult["selection"],
  revealLifecycle?: ChatCommandResult["revealLifecycle"],
  notes: string[] = []
): string {
  const lines = [
    `# ${action}`,
    "",
    `- Status: ok`,
    `- Session ID: ${session?.id ?? "-"}`,
    `- Title: ${session?.title ?? "-"}`,
    `- Updated: ${session?.lastUpdated ?? "-"}`,
    `- Mode: ${session?.mode ?? "-"}`,
    `- Agent: ${session?.agent ?? "-"}`,
    `- Persisted Request Agent: ${formatPersistedRequestAgent(session)}`,
    `- Model: ${session?.model ?? "-"}`,
    ...notes.map((note) => `- ${note}`)
  ];

  if (revealLifecycle) {
    lines.push(
      `- Closed Matching Visible Tabs Before Reveal: ${revealLifecycle.closedMatchingVisibleTabs}`,
      `- Closed Tab Labels: ${revealLifecycle.closedTabLabels.length > 0 ? revealLifecycle.closedTabLabels.map((label) => JSON.stringify(label)).join(", ") : "-"}`
    );

    if (revealLifecycle.timingMs) {
      lines.push(
        `- Fallback Total Duration Ms: ${revealLifecycle.timingMs.totalFallbackMs ?? "-"}`,
        `- Reveal Duration Ms: ${revealLifecycle.timingMs.revealMs ?? "-"}`,
        `- Focus Duration Ms: ${revealLifecycle.timingMs.focusMs ?? "-"}`,
        `- Focused Send Call Duration Ms: ${revealLifecycle.timingMs.focusedSendCallMs ?? "-"}`,
        `- Focused Input Duration Ms: ${revealLifecycle.timingMs.focusedInputMs ?? "-"}`,
        `- Focused Prefill Duration Ms: ${revealLifecycle.timingMs.prefillMs ?? "-"}`,
        `- Focused Submit Duration Ms: ${revealLifecycle.timingMs.submitMs ?? "-"}`,
        `- Focused Mutation Wait Duration Ms: ${revealLifecycle.timingMs.focusedMutationWaitMs ?? "-"}`,
        `- Focused Mutation Poll Count: ${revealLifecycle.timingMs.focusedMutationPollCount ?? "-"}`,
        `- Focused Mutation Storage Scan Ms: ${revealLifecycle.timingMs.focusedMutationScanMs ?? "-"}`
      );
    }
  }

  if (selection) {
    lines.push(
      `- Dispatch Surface: ${selection.dispatchSurface}`,
      `- Dispatch Slash Command: ${selection.dispatchedSlashCommand ?? "-"}`,
      `- Requested Agent/Role: ${formatSelectionCheck(selection.agent)}`,
      `- Mode Selection: ${formatSelectionCheck(selection.mode)}`,
      `- Model Selection: ${formatSelectionCheck(selection.model)}`,
      `- All Requested Selections Verified: ${selection.allRequestedVerified ? "yes" : "no"}`
    );

    if (selection.agent.status === "dispatched-via-artifact") {
      lines.push("- Requested Agent/Role Interpretation: prompt-file role dispatch only; persisted participant evidence is still separate.");
    }
  }

  return lines.join("\n");
}

function formatDisposableDeleteProbeResult(output: DisposableDeleteProbeCommandResult): string {
  return formatChatMutationResult(
    "Disposable Local Delete Probe Created",
    output.result.session,
    output.result.selection,
    output.result.revealLifecycle,
    [
      `Probe Anchor: ${output.anchor}`,
      `Probe Prompt: ${JSON.stringify(output.prompt)}`
    ]
  );
}

function formatArtifactDeletionNotes(report: ChatCommandResult["artifactDeletion"]): string[] {
  if (!report) {
    return [];
  }

  return [
    `Deleted Artifact Count: ${report.deletedPaths.length}`,
    `Missing Artifact Count: ${report.missingPaths.length}`,
    `Deleted Artifact Paths: ${report.deletedPaths.length > 0 ? report.deletedPaths.map((artifactPath) => JSON.stringify(artifactPath)).join(", ") : "-"}`,
    `Missing Artifact Paths: ${report.missingPaths.length > 0 ? report.missingPaths.map((artifactPath) => JSON.stringify(artifactPath)).join(", ") : "-"}`
  ];
}

function formatStabilizedLifecycleResult(
  result: Awaited<ReturnType<typeof createStabilizedChatAndSend>>,
  extraNotes: string[] = []
): string {
  if (!result.workflow.ok) {
    throw new Error(result.workflow.reason ?? result.workflow.error ?? "Failed to complete stabilized live chat lifecycle.");
  }

  const notes = [
    `Seed Prompt Used: ${JSON.stringify(result.seedPrompt)}`,
    `Initial Create Session ID: ${result.createResult.session?.id ?? "-"}`,
    `Resolved Mode For Stabilization: ${result.resolvedModeId ?? "-"}`,
    `Persisted Mode Patch Applied: ${result.patchedModeId ?? "no"}`,
    `Persisted Model Patch Applied: ${result.patchedModelId ?? "no"}`,
    ...extraNotes
  ];

  return formatChatMutationResult(
    "Live Agent Chat Updated Via Stabilized Lifecycle",
    result.workflow.session,
    result.workflow.selection,
    result.workflow.revealLifecycle,
    notes
  );
}

const STABILIZED_RECOVERY_POLL_DELAY_MS = 1000;
const STABILIZED_RECOVERY_POLL_ATTEMPTS = 8;

async function tryRecoverCompletedStabilizedLifecycle(
  chatInterop: ChatInteropApi,
  result: Awaited<ReturnType<typeof createStabilizedChatAndSend>>
): Promise<{ result: Awaited<ReturnType<typeof createStabilizedChatAndSend>>; notes: string[] } | undefined> {
  if (result.workflow.ok) {
    return undefined;
  }

  if (result.realPromptDispatchAttempted !== true) {
    return undefined;
  }

  const sessionId = result.workflow.session?.id ?? result.createResult.session?.id;
  if (!sessionId) {
    return undefined;
  }

  const recoveredSession = await waitForRecoveredSettledSession(chatInterop, sessionId);
  if (!recoveredSession) {
    return undefined;
  }

  return {
    result: {
      ...result,
      workflow: {
        ...result.workflow,
        ok: true,
        reason: undefined,
        error: undefined,
        session: recoveredSession,
        selection: result.workflow.selection ?? result.createResult.selection,
        revealLifecycle: result.workflow.revealLifecycle ?? result.createResult.revealLifecycle
      }
    },
    notes: [
      "Completion Recovery: persisted session state settled after the initial tool error, so this result was recovered from stored session evidence."
    ]
  };
}

async function waitForRecoveredSettledSession(
  chatInterop: ChatInteropApi,
  sessionId: string
): Promise<ChatSessionSummary | undefined> {
  for (let attempt = 0; attempt <= STABILIZED_RECOVERY_POLL_ATTEMPTS; attempt += 1) {
    const session = (await chatInterop.listChats()).find((candidate) => candidate.id === sessionId);
    if (isRecoveredSessionSettled(session)) {
      return session;
    }

    if (attempt < STABILIZED_RECOVERY_POLL_ATTEMPTS) {
      await delayStabilizedRecovery(STABILIZED_RECOVERY_POLL_DELAY_MS);
    }
  }

  return undefined;
}

function isRecoveredSessionSettled(session: ChatSessionSummary | undefined): boolean {
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

function delayStabilizedRecovery(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throwOnUnsafeStabilizedCreateSelection(
  chatInterop: ChatInteropApi,
  input: LiveChatMutationInput,
  result: Awaited<ReturnType<typeof createStabilizedChatAndSend>>
): Promise<void> {
  const selection = result.workflow.selection;
  if (!selection) {
    return;
  }

  const failures: string[] = [];
  if (input.mode?.trim() && selection.mode.status !== "verified") {
    failures.push(`Mode selection did not verify: ${formatSelectionCheck(selection.mode)}`);
  }
  if (hasObservedCustomAgentMismatch(input.agentName, selection)) {
    failures.push(`Agent selection resolved to the wrong persisted participant: ${formatSelectionCheck(selection.agent)}`);
  } else if (input.agentName?.trim() && input.requireSelectionEvidence && selection.agent.status !== "verified") {
    failures.push(`Agent selection did not verify: ${formatSelectionCheck(selection.agent)}`);
  }
  if (input.modelId?.trim() && selection.model.status !== "verified") {
    failures.push(`Model selection did not verify: ${formatSelectionCheck(selection.model)}`);
  }

  if (failures.length === 0) {
    return;
  }

  const sessionId = result.workflow.session?.id ?? result.createResult.session?.id;
  let cleanupNote = "";
  if (sessionId) {
    const cleanupResult = await chatInterop.closeVisibleTabs(sessionId);
    if (cleanupResult.ok) {
      const closedCount = cleanupResult.revealLifecycle?.closedMatchingVisibleTabs ?? 0;
      cleanupNote = ` Visible cleanup closed ${closedCount} matching tabs for the mismatched chat.`;
    }
  }

  throw new Error(
    `${failures.join(" ")} The requested create-time selection would otherwise inherit unsafe UI state on this build.${cleanupNote}`
  );
}

function formatSelectionCheck(check: NonNullable<ChatCommandResult["selection"]>["agent"]): string {
  const requested = check.requested ? `requested=${JSON.stringify(check.requested)}` : undefined;
  const observed = check.observed ? `observed=${JSON.stringify(check.observed)}` : undefined;
  return [check.status, requested, observed].filter(Boolean).join(" | ");
}

function formatPersistedRequestAgent(session: ChatSessionSummary | undefined): string {
  return session?.requestAgentId ?? session?.requestAgentName ?? "-";
}

async function assertNotSelfTargetingLiveChat(
  chatInterop: ChatInteropApi,
  targetSessionId: string,
  operation: "reveal" | "send" | "close-visible-tabs" | "delete-artifacts"
): Promise<void> {
  const chats = await chatInterop.listChats();
  const reason = getExactSelfTargetingReason(chats, targetSessionId, operation);
  if (reason) {
    throw new Error(reason);
  }
}

function tryGetWorkspaceStorageDir(session: ChatSessionSummary): string | undefined {
  if (session.provider !== "workspaceStorage") {
    return undefined;
  }

  return path.dirname(path.dirname(session.sessionFile));
}

async function resolveExactWorkspaceStorageLiveChatForOfflineCleanup(
  chatInterop: ChatInteropApi,
  targetSessionId: string
): Promise<{ session: ChatSessionSummary; workspaceStorageDir: string }> {
  const chats = await chatInterop.listChats();
  const exact = chats.find((chat) => chat.id === targetSessionId);
  if (!exact) {
    const prefixMatches = chats.filter((chat) => chat.id.startsWith(targetSessionId));
    if (prefixMatches.length > 0) {
      throw new Error(`Scheduled offline cleanup requires the full session id. Prefix ${JSON.stringify(targetSessionId)} matched ${prefixMatches.length} live chat(s).`);
    }
    throw new Error(`No live agent chat with exact session id ${JSON.stringify(targetSessionId)} was found.`);
  }

  const workspaceStorageDir = tryGetWorkspaceStorageDir(exact);
  if (!workspaceStorageDir) {
    throw new Error(`Live chat ${JSON.stringify(targetSessionId)} is not backed by workspaceStorage and cannot be queued for offline cleanup.`);
  }

  return {
    session: exact,
    workspaceStorageDir
  };
}

function formatOfflineCleanupQueuedResult(
  session: ChatSessionSummary,
  workspaceStorageDir: string,
  requestsPath: string,
  globalStorageDir: string
): string {
  return [
    "# Offline Live Chat Cleanup Queued",
    "",
    `- Session ID: ${session.id}`,
    `- Title: ${session.title ?? "-"}`,
    `- Workspace Storage Dir: ${workspaceStorageDir}`,
    `- Queue File: ${requestsPath}`,
    `- Global Storage Dir: ${globalStorageDir}`,
    "- Next Step: close VS Code completely so the detached offline cleanup runtime can delete queued artifacts and prune scheduled workspace state."
  ].join("\n");
}

async function scheduleOfflineLiveChatCleanup(
  context: vscode.ExtensionContext,
  chatInterop: ChatInteropApi,
  targetSessionId: string
): Promise<string> {
  // This route only queues exact-target cleanup for after VS Code exits, so it
  // must not inherit the live delete self-target heuristic.
  const { session, workspaceStorageDir } = await resolveExactWorkspaceStorageLiveChatForOfflineCleanup(chatInterop, targetSessionId);
  const globalStorageDir = context.globalStorageUri.fsPath;
  const requestsPath = await queueOfflineLocalChatCleanupRequest(
    globalStorageDir,
    buildWorkspaceStorageOfflineLocalChatCleanupRequest(workspaceStorageDir, session.id)
  );
  launchOfflineLocalChatCleanup({
    extensionRoot: context.extensionPath,
    globalStorageDir,
    waitForPid: process.pid
  });
  return formatOfflineCleanupQueuedResult(session, workspaceStorageDir, requestsPath, globalStorageDir);
}

async function assertFocusedLiveChatNotSelfTargeting(
  chatInterop: ChatInteropApi,
  operation: "focused-send" | "focused-editor-send",
  targetSessionId?: string
): Promise<void> {
  const chats = await chatInterop.listChats();
  const reason = getFocusedSelfTargetingReason(chats, operation, targetSessionId);
  if (reason) {
    throw new Error(reason);
  }
}

class ReadOnlyTool<TInput> implements vscode.LanguageModelTool<TInput> {
  constructor(
    private readonly displayName: string,
    private readonly invocationMessage: (input: TInput) => string,
    private readonly invokeImpl: (input: TInput, budget: number) => Promise<string>
  ) {}

  prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<TInput>): vscode.PreparedToolInvocation {
    return {
      invocationMessage: this.invocationMessage(options.input)
    };
  }

  async invoke(options: vscode.LanguageModelToolInvocationOptions<TInput>): Promise<vscode.LanguageModelToolResult> {
    const budget = outputBudget(options.tokenizationOptions?.tokenBudget);
    const content = await this.invokeImpl(options.input, budget);
    return textResult(content);
  }
}

class LiveChatTool<TInput> implements vscode.LanguageModelTool<TInput> {
  constructor(
    private readonly invocationMessage: (input: TInput) => string,
    private readonly invokeImpl: (input: TInput, budget: number) => Promise<string>
  ) {}

  prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<TInput>): vscode.PreparedToolInvocation {
    return {
      invocationMessage: this.invocationMessage(options.input)
    };
  }

  async invoke(options: vscode.LanguageModelToolInvocationOptions<TInput>): Promise<vscode.LanguageModelToolResult> {
    const budget = outputBudget(options.tokenizationOptions?.tokenBudget);
    const content = await this.invokeImpl(options.input, budget);
    return textResult(content);
  }
}

export function registerLanguageModelTools(context: vscode.ExtensionContext, adapter: SessionToolingAdapter, chatInterop?: ChatInteropApi): void {
  const currentWorkspaceStorageRoots = (() => {
    if (!context.storageUri) {
      return undefined;
    }
    const storagePath = path.resolve(context.storageUri.fsPath);
    const parentPath = path.dirname(storagePath);
    return [path.basename(parentPath) === "workspaceStorage" ? storagePath : parentPath];
  })();
  context.subscriptions.push(
    vscode.lm.registerTool(
      "list_agent_sessions",
      new ReadOnlyTool<ListSessionsInput>(
        "List Agent Sessions",
        () => "Listing recent stored agent sessions",
        async (input, budget) => adapter.renderList(
          input.limit ?? 10,
          budget,
          resolveScopedStorageRoots(input.storageRoots, input.scope, currentWorkspaceStorageRoots)
        )
      )
    ),
    vscode.lm.registerTool(
      "get_agent_session_index",
      new ReadOnlyTool<SessionSelectionInput>(
        "Get Agent Session Index",
        () => "Rendering a bounded session index",
        async (input) => adapter.renderIndex(normalizeSessionTarget(input, currentWorkspaceStorageRoots))
      )
    ),
    vscode.lm.registerTool(
      "get_agent_session_window",
      new ReadOnlyTool<WindowInput>(
        "Get Agent Session Window",
        (input) => input.anchorText
          ? `Rendering a bounded session window around ${JSON.stringify(input.anchorText)}`
          : "Rendering a bounded session window from the latest compaction boundary",
        async (input, budget) => adapter.renderWindow({
          ...normalizeSessionTarget(input, currentWorkspaceStorageRoots),
          anchorText: input.anchorText,
          anchorOccurrence: input.anchorOccurrence,
          afterLatestCompact: input.afterLatestCompact,
          before: input.before,
          after: input.after,
          maxMatches: input.maxMatches,
          includeNoise: input.includeNoise,
          maxChars: budget
        })
      )
    ),
    vscode.lm.registerTool(
      "export_agent_session_markdown",
      new ReadOnlyTool<NoiseSelectableInput>(
        "Export Agent Session Markdown",
        () => "Rendering a markdown export of a stored session",
        async (input) => adapter.renderExport({
          ...normalizeSessionTarget(input, currentWorkspaceStorageRoots),
          includeNoise: input.includeNoise
        })
      )
    ),
    vscode.lm.registerTool(
      "export_agent_evidence_transcript",
      new ReadOnlyTool<TranscriptEvidenceInput>(
        "Export Agent Evidence Transcript",
        () => "Rendering a canonical evidence transcript",
        async (input) => adapter.renderTranscriptEvidence({
          ...normalizeSessionTarget(input, currentWorkspaceStorageRoots),
          anchorText: input.anchorText,
          anchorOccurrence: input.anchorOccurrence,
          afterLatestCompact: input.afterLatestCompact,
          maxBlocks: input.maxBlocks,
          detailLevel: input.detailLevel ?? "summary"
        })
      )
    ),
    vscode.lm.registerTool(
      "get_agent_session_snapshot",
      new ReadOnlyTool<NoiseSelectableInput>(
        "Get Agent Session Snapshot",
        () => "Rendering a compact session snapshot",
        async (input) => adapter.renderSnapshot({
          ...normalizeSessionTarget(input, currentWorkspaceStorageRoots),
          includeNoise: input.includeNoise
        })
      )
    ),
    vscode.lm.registerTool(
      "estimate_agent_context_breakdown",
      new ReadOnlyTool<ContextEstimateInput>(
        "Estimate Agent Context Breakdown",
        () => "Estimating persisted context pressure",
        async (input, budget) => adapter.renderContextEstimate({
          ...normalizeSessionTarget(input, currentWorkspaceStorageRoots),
          includeNoise: input.includeNoise,
          afterLatestCompact: input.afterLatestCompact,
          latestRequestFamilies: input.latestRequestFamilies,
          detailLevel: input.detailLevel ?? "summary",
          maxChars: budget
        })
      )
    ),
    vscode.lm.registerTool(
      "get_agent_session_profile",
      new ReadOnlyTool<NoiseSelectableInput>(
        "Get Agent Session Profile",
        () => "Rendering a findings-first session profile",
        async (input) => adapter.renderProfile({
          ...normalizeSessionTarget(input, currentWorkspaceStorageRoots),
          includeNoise: input.includeNoise
        })
      )
    ),
    vscode.lm.registerTool(
      "survey_agent_sessions",
      new ReadOnlyTool<SurveyInput>(
        "Survey Agent Sessions",
        () => "Surveying recent stored agent sessions",
        async (input) => adapter.renderSurvey(
          input.limit ?? 8,
          resolveScopedStorageRoots(input.storageRoots, input.scope, currentWorkspaceStorageRoots)
        )
      )
    )
  );

  if (LOCAL_CHAT_RUNTIME_SURFACES_ENABLED) {
    if (!chatInterop) {
      throw new Error("Interactive chat interop is required when Local chat runtime surfaces are enabled.");
    }

    const liveToolRegistrations: vscode.Disposable[] = [];

    if (LOCAL_CHAT_CONTROL_SURFACES_ENABLED) {
      liveToolRegistrations.push(
        vscode.lm.registerTool(
          "list_live_agent_chats",
          new LiveChatTool<ListLiveChatsInput>(
            () => "Listing live agent chat sessions",
            async (input) => renderLiveChatList(await chatInterop.listChats(), input.limit ?? 20)
          )
        ),
        vscode.lm.registerTool(
          "create_disposable_local_delete_probe",
          new LiveChatTool<CreateDisposableLocalDeleteProbeInput>(
            () => "Creating a disposable Local delete probe",
            async (input) => {
              const output = await vscode.commands.executeCommand(
                "tiinex.aiVscodeTooling.createDisposableLocalDeleteProbe",
                toDisposableDeleteProbeCommandRequest(input)
              ) as DisposableDeleteProbeCommandResult | undefined;
              if (!output || !output.result.ok) {
                throw new Error(output?.result.reason ?? output?.result.error ?? "Failed to create disposable Local delete probe.");
              }
              return formatDisposableDeleteProbeResult(output);
            }
          )
        ),
        vscode.lm.registerTool(
          "close_visible_live_chat_tabs",
          new LiveChatTool<CloseVisibleLiveChatTabsInput>(
            (input) => `Closing visible live chat tabs for ${JSON.stringify(input.sessionId)}`,
            async (input) => {
              await assertNotSelfTargetingLiveChat(chatInterop, input.sessionId, "close-visible-tabs");
              const result = await chatInterop.closeVisibleTabs(input.sessionId);
              if (!result.ok) {
                throw new Error(result.reason ?? result.error ?? `Failed to close visible live chat tabs for ${input.sessionId}.`);
              }
              return formatChatMutationResult("Visible Live Chat Tabs Closed", result.session, result.selection, result.revealLifecycle);
            }
          )
        ),
        vscode.lm.registerTool(
          "delete_live_agent_chat_artifacts",
          new LiveChatTool<DeleteLiveChatArtifactsInput>(
            (input) => `Deleting live agent chat artifacts for ${JSON.stringify(input.sessionId)}`,
            async (input) => {
              await assertNotSelfTargetingLiveChat(chatInterop, input.sessionId, "delete-artifacts");
              const result = await chatInterop.deleteChat(input.sessionId);
              if (!result.ok) {
                throw new Error(result.reason ?? result.error ?? `Failed to delete live agent chat artifacts for ${input.sessionId}.`);
              }
              return formatChatMutationResult(
                "Live Agent Chat Artifacts Deleted",
                result.session,
                result.selection,
                result.revealLifecycle,
                formatArtifactDeletionNotes(result.artifactDeletion)
              );
            }
          )
        ),
        vscode.lm.registerTool(
          "schedule_offline_live_agent_chat_cleanup",
          new LiveChatTool<ScheduleOfflineLiveChatCleanupInput>(
            (input) => `Queueing offline live chat cleanup for ${JSON.stringify(input.sessionId)}`,
            async (input) => scheduleOfflineLiveChatCleanup(context, chatInterop, input.sessionId)
          )
        ),
        vscode.lm.registerTool(
          "reveal_live_agent_chat",
          new LiveChatTool<LiveChatSelectionInput>(
            (input) => `Revealing live agent chat ${JSON.stringify(input.sessionId)}`,
            async (input) => {
              await assertNotSelfTargetingLiveChat(chatInterop, input.sessionId, "reveal");
              const result = await chatInterop.revealChat(input.sessionId);
              if (!result.ok) {
                throw new Error(result.reason ?? result.error ?? `Failed to reveal live agent chat ${input.sessionId}.`);
              }
              return formatChatMutationResult("Live Agent Chat Revealed", result.session, result.selection, result.revealLifecycle);
            }
          )
        )
      );
    }

    if (LOCAL_CHAT_MUTATION_SURFACES_ENABLED) {
      liveToolRegistrations.push(
        vscode.lm.registerTool(
          "create_live_agent_chat",
          new LiveChatTool<LiveChatMutationInput>(
            () => "Creating a new live agent chat",
            async (input) => {
              const initialResult = await createStabilizedChatAndSend(chatInterop, toCreateChatRequest(input));
              const recovered = await tryRecoverCompletedStabilizedLifecycle(chatInterop, initialResult);
              const result = recovered?.result ?? initialResult;
              await throwOnUnsafeStabilizedCreateSelection(chatInterop, input, result);
              return formatStabilizedLifecycleResult(result, recovered?.notes);
            }
          )
        ),
        vscode.lm.registerTool(
          "send_message_to_live_agent_chat",
          new LiveChatTool<SendLiveChatMessageInput>(
            (input) => `Sending a message to live agent chat ${JSON.stringify(input.sessionId)}`,
            async (input) => {
              const request = toSendChatMessageRequest(input);
              const transportNotes = await tryPrepareLatestSessionTransportWorkaround(chatInterop, request);
              const result = await sendMessageToSession(chatInterop, request);
              if (!result.ok) {
                throw new Error(result.reason ?? result.error ?? `Failed to send a message to live agent chat ${input.sessionId}.`);
              }
              return formatChatMutationResult(
                "Live Agent Chat Updated",
                result.session,
                result.selection,
                result.revealLifecycle,
                transportNotes
              );
            }
          )
        ),
        vscode.lm.registerTool(
          "send_message_to_focused_live_chat",
          new LiveChatTool<FocusedLiveChatMutationInput>(
            () => "Sending a message to the currently focused live chat",
            async (input) => {
              await assertFocusedLiveChatNotSelfTargeting(chatInterop, "focused-send");
              const result = await chatInterop.sendFocusedMessage(toCreateChatRequest(input));
              if (!result.ok) {
                throw new Error(result.reason ?? result.error ?? "Failed to send a message to the currently focused live chat.");
              }
              return formatChatMutationResult("Focused Live Agent Chat Updated", result.session, result.selection, result.revealLifecycle);
            }
          )
        )
      );
    }

    context.subscriptions.push(...liveToolRegistrations);
  }

  if (!FIRST_SLICE_INTERACTIVE_SURFACES_ENABLED) {
    return;
  }

  if (!chatInterop) {
    throw new Error("Interactive chat interop is required when first-slice interactive surfaces are enabled.");
  }

  context.subscriptions.push(
    vscode.lm.registerTool(
      "list_copilot_cli_sessions",
      new ReadOnlyTool<ListCopilotCliSessionsInput>(
        "List Copilot CLI Sessions",
        () => "Listing Copilot CLI session-state directories",
        async (input, budget) => renderCopilotCliSessionListText(
          await listCopilotCliSessions({
            sessionStateRoot: input.sessionStateRoot,
            limit: input.limit ?? 10
          }),
          input.limit ?? 10,
          {
            maxChars: budget,
            sessionStateRoot: input.sessionStateRoot
          }
        )
      )
    ),
    vscode.lm.registerTool(
      "inspect_copilot_cli_session",
      new ReadOnlyTool<InspectCopilotCliSessionInput>(
        "Inspect Copilot CLI Session",
        () => "Inspecting a Copilot CLI session-state entry",
        async (input, budget) => {
          const inspection = await inspectCopilotCliSession({
            sessionStateRoot: input.sessionStateRoot,
            sessionId: input.sessionId,
            latest: input.latest
          });
          if (!inspection) {
            throw new Error("No Copilot CLI session-state directory with events.jsonl was found.");
          }
          return renderCopilotCliSessionInspectionMarkdown(inspection, {
            maxChars: budget,
            sessionStateRoot: input.sessionStateRoot
          });
        }
      )
    ),
    vscode.lm.registerTool(
      "send_prompt_to_copilot_cli_session",
      new LiveChatTool<SendCopilotCliPromptInput>(
        (input) => `Sending a prompt to Copilot CLI session ${JSON.stringify(input.sessionId ?? "latest")}`,
        async (input) => {
          const session = await resolveCopilotCliSessionTarget(input);
          await sendPromptToCopilotCliResource(session.canonicalResource, input.prompt);
          return formatCopilotCliSendResult(session);
        }
      )
    ),
    vscode.lm.registerTool(
      "inspect_live_chat_support",
      new ReadOnlyTool<InspectLiveChatSupportInput>(
        "Inspect Live Chat Support",
        () => "Inspecting current Copilot Chat live-interaction support",
        async (input) => {
          const matrix = buildLiveChatSupportMatrix({
            commands: await vscode.commands.getCommands(true),
            exactSessionInterop: await chatInterop.getExactSessionInteropSupport(),
            copilotChatPackageJson: vscode.extensions.getExtension("GitHub.copilot-chat")?.packageJSON
          });
          return renderLiveChatSupportMatrixMarkdown(matrix, {
            detailLevel: input.detailLevel ?? "summary"
          });
        }
      )
    ),
    vscode.lm.registerTool(
      "inspect_runtime_chat_commands",
      new ReadOnlyTool<InspectRuntimeChatCommandsInput>(
        "Inspect Runtime Chat Commands",
        () => "Inspecting runtime chat/session command inventory",
        async (input) => renderRuntimeChatCommandInventoryMarkdown({
          runtimeCommands: await vscode.commands.getCommands(true),
          copilotChatPackageJson: vscode.extensions.getExtension("GitHub.copilot-chat")?.packageJSON,
          detailLevel: input.detailLevel ?? "summary"
        })
      )
    ),
    vscode.lm.registerTool(
      "probe_local_reopen_candidates",
      new LiveChatTool<ProbeLocalReopenCandidatesInput>(
        (input) => `Probing Local reopen candidates for ${JSON.stringify(input.sessionId)}`,
        async (input) => renderLocalReopenProbeMarkdown(await probeLocalReopenCandidates(chatInterop, input.sessionId))
      )
    ),
    vscode.lm.registerTool(
      "inspect_chat_focus_targets",
      new ReadOnlyTool<InspectChatFocusTargetsInput>(
        "Inspect Chat Focus Targets",
        () => "Inspecting current chat focus targets",
        async () => renderChatFocusReportMarkdown(captureCurrentChatFocusReport(await chatInterop.listChats()))
      )
    ),
    vscode.lm.registerTool(
      "inspect_chat_focus_debug",
      new ReadOnlyTool<InspectChatFocusDebugInput>(
        "Inspect Chat Focus Debug",
        () => "Inspecting raw chat focus debug details",
        async (input) => renderChatFocusDebugMarkdown(
          captureCurrentChatFocusReport(await chatInterop.listChats()),
          { detailLevel: input.detailLevel ?? "summary" }
        )
      )
    ),
    vscode.lm.registerTool(
      "focus_visible_editor_live_chat",
      new LiveChatTool<FocusedEditorChatSelectionInput>(
        (input) => input.sessionId
          ? `Focusing visible editor chat ${JSON.stringify(input.sessionId)}`
          : "Focusing the active editor chat",
        async (input) => {
          const focusResult = await focusLikelyEditorChat(chatInterop, {
            sessionId: input.sessionId
          });
          if (!focusResult.ok) {
            throw new Error(focusResult.reason ?? "Failed to focus an editor-hosted chat.");
          }
          return renderChatFocusReportMarkdown(focusResult.report ?? captureCurrentChatFocusReport(await chatInterop.listChats()));
        }
      )
    ),
    vscode.lm.registerTool(
      "send_message_to_focused_editor_chat",
      new LiveChatTool<FocusedEditorChatMutationInput>(
        (input) => input.sessionId
          ? `Focusing visible editor chat ${JSON.stringify(input.sessionId)} and sending a message there`
          : "Focusing the active editor chat and sending a message there",
        async (input) => {
          await assertFocusedLiveChatNotSelfTargeting(chatInterop, "focused-editor-send", input.sessionId);
          const focusResult = await focusLikelyEditorChat(chatInterop, {
            sessionId: input.sessionId
          });
          if (!focusResult.ok) {
            throw new Error(focusResult.reason ?? "Failed to focus an editor-hosted chat.");
          }

          const result = await chatInterop.sendFocusedMessage(toCreateChatRequest(input));
          if (!result.ok) {
            throw new Error(result.reason ?? result.error ?? "Failed to send a message to the focused editor chat.");
          }
          return formatChatMutationResult("Focused Editor Live Agent Chat Updated", result.session, result.selection, result.revealLifecycle);
        }
      )
    )
  );
}