import path from "node:path";
import { appendFileSync, mkdirSync } from "node:fs";
import * as vscode from "vscode";
import { type ChatCommandResult, type ChatInteropApi, type ChatSessionSummary, type CreateChatRequest, type SendChatMessageRequest } from "./chatInterop";
import { sendPromptToCopilotCliResource } from "./chatInterop/copilotCliDebug";
import { captureCurrentChatFocusReport, focusLikelyEditorChat } from "./chatInterop/editorFocus";
import { renderChatFocusDebugMarkdown, renderChatFocusReportMarkdown } from "./chatInterop/focusTargets";
import { RejectingMutex } from "./chatInterop/mutex";
import { probeLocalReopenCandidates, renderLocalReopenProbeMarkdown } from "./chatInterop/reopenProbe";
import { sendMessageToSession } from "./chatInterop/sessionSendWorkflow";
import { getExactDeleteSelfTargetingReason, getExactDeleteTerminalBoundSessionId, getExactSelfTargetingReason, getFocusedSelfTargetingReason } from "./chatInterop/selfTargetGuard";
import {
  buildLiveChatSupportMatrix,
  renderLiveChatSupportMatrixMarkdown,
  renderRuntimeChatCommandInventoryMarkdown
} from "./chatInterop/supportMatrix";
import { getSessionQuiescenceState } from "./chatInterop/unsettledDiagnostics";
import type { SessionTarget, SessionToolsAdapter } from "./coreAdapter";
import {
  describeCopilotCliSessionStateRoot,
  inspectCopilotCliSession,
  listCopilotCliSessions,
  renderCopilotCliSessionInspectionMarkdown,
  renderCopilotCliSessionListText
} from "./tools/copilot-cli";
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

const liveChatToolMutex = new RejectingMutex();

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

type YouTubeHostCommandAction =
  | "validate-provider-setup"
  | "generate-openai-image"
  | "open-openai-artifact"
  | "close-active-openai-artifact"
  | "create-working-topic"
  | "add-feedback-topic-evidence"
  | "add-feedback-topic-decision"
  | "focus-feedback-topic";

interface InvokeYouTubeHostCommandInput {
  action: YouTubeHostCommandAction;
  prompt?: string;
  purpose?: string;
  size?: string;
  model?: string;
  critiqueModel?: string;
  autoCritique?: boolean;
  showMetadata?: boolean;
  openArtifact?: boolean;
  artifact?: string;
  jobId?: string;
  topicId?: string;
  title?: string;
  summary?: string;
  sourceKey?: string;
  sourceLabel?: string;
  type?: string;
  status?: string;
  source?: string;
  reference?: string;
  whyItMatters?: string;
  capturedBy?: string;
  note?: string;
  by?: string;
  section?: string;
  highlightText?: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return String(error);
}

const YOUTUBE_HOST_COMMAND_SPECS: Record<YouTubeHostCommandAction, { commandId: string; label: string }> = {
  "validate-provider-setup": {
    commandId: "tiinex.youtubeTools.validateProviderSetup",
    label: "Validate Provider Setup"
  },
  "generate-openai-image": {
    commandId: "tiinex.youtubeTools.generateOpenAiImage",
    label: "Generate OpenAI Image"
  },
  "open-openai-artifact": {
    commandId: "tiinex.youtubeTools.openOpenAiArtifact",
    label: "Open OpenAI Artifact"
  },
  "close-active-openai-artifact": {
    commandId: "tiinex.youtubeTools.closeActiveOpenAiArtifact",
    label: "Close Active OpenAI Artifact"
  },
  "create-working-topic": {
    commandId: "tiinex.youtubeTools.createWorkingTopic",
    label: "Create Working Topic"
  },
  "add-feedback-topic-evidence": {
    commandId: "tiinex.youtubeTools.addFeedbackTopicEvidence",
    label: "Add Feedback Topic Evidence"
  },
  "add-feedback-topic-decision": {
    commandId: "tiinex.youtubeTools.addFeedbackTopicDecision",
    label: "Add Feedback Topic Decision"
  },
  "focus-feedback-topic": {
    commandId: "tiinex.youtubeTools.focusFeedbackTopic",
    label: "Focus Feedback Topic"
  }
};

const YOUTUBE_OPENAI_ARTIFACT_KEYS = new Set(["final", "pass-1", "pass-2", "job", "operator", "viewer", "tts"]);

function normalizeYouTubeOpenAiArtifact(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  return YOUTUBE_OPENAI_ARTIFACT_KEYS.has(normalized) ? normalized : undefined;
}

function buildYouTubeHostCommandArgs(input: InvokeYouTubeHostCommandInput): Record<string, unknown> | undefined {
  switch (input.action) {
    case "validate-provider-setup":
      return {
        silent: true,
        showNotifications: false,
        revealOutput: false
      };
    case "close-active-openai-artifact":
      return undefined;
    case "create-working-topic":
      return {
        title: input.title,
        summary: input.summary,
        sourceKey: input.sourceKey,
        sourceLabel: input.sourceLabel,
        silent: true,
        showNotifications: false,
        revealOutput: false
      };
    case "generate-openai-image":
      return {
        prompt: input.prompt,
        purpose: input.purpose,
        size: input.size,
        model: input.model,
        critiqueModel: input.critiqueModel,
        autoCritique: input.autoCritique,
        silent: true,
        showNotifications: false,
        revealOutput: false,
        showMetadata: input.showMetadata,
        openArtifact: input.openArtifact
      };
    case "open-openai-artifact":
      return {
        artifact: normalizeYouTubeOpenAiArtifact(input.artifact),
        jobId: input.jobId
      };
    case "add-feedback-topic-evidence":
      return {
        topicId: input.topicId,
        type: input.type,
        status: input.status,
        source: input.source,
        reference: input.reference,
        whyItMatters: input.whyItMatters,
        summary: input.summary,
        capturedBy: input.capturedBy,
        silent: true,
        showNotifications: false,
        revealOutput: false
      };
    case "add-feedback-topic-decision":
      return {
        topicId: input.topicId,
        note: input.note,
        by: input.by,
        silent: true,
        showNotifications: false,
        revealOutput: false
      };
    case "focus-feedback-topic":
      return {
        topicId: input.topicId,
        section: input.section,
        highlightText: input.highlightText,
        silent: true,
        showNotifications: false,
        revealOutput: false
      };
  }
}

function renderYouTubeHostCommandResult(
  input: InvokeYouTubeHostCommandInput,
  commandId: string,
  result: unknown,
  budget: number
): string {
  const lines = [
    "# YouTube Host Command Result",
    "",
    `- action: ${input.action}`,
    `- commandId: ${commandId}`,
    `- returnedValue: ${result === undefined ? "no" : "yes"}`
  ];

  if (result && typeof result === "object") {
    const objectResult = result as Record<string, unknown>;
    if (typeof objectResult.jobId === "string") {
      lines.push(`- jobId: ${objectResult.jobId}`);
    }
    if (typeof objectResult.finalImageFilePath === "string") {
      lines.push(`- finalImageFilePath: ${objectResult.finalImageFilePath}`);
    }
    if (typeof objectResult.artifact === "string") {
      lines.push(`- artifact: ${objectResult.artifact}`);
    }
    if (typeof objectResult.artifactPath === "string") {
      lines.push(`- artifactPath: ${objectResult.artifactPath}`);
    }
  } else if (typeof result === "string" && result.trim()) {
    lines.push(`- result: ${result.trim()}`);
  }

  if (result !== undefined) {
    const serialized = JSON.stringify(result, null, 2);
    if (serialized) {
      const remainingBudget = Math.max(0, budget - lines.join("\n").length - 32);
      if (remainingBudget > 0) {
        const trimmed = serialized.length > remainingBudget
          ? `${serialized.slice(0, Math.max(0, remainingBudget - 15))}\n... [truncated]`
          : serialized;
        lines.push("", "```json", trimmed, "```");
      }
    }
  }

  return lines.join("\n");
}

function youtubeHostCommandInvocationMessage(input: InvokeYouTubeHostCommandInput): string {
  switch (input.action) {
    case "generate-openai-image":
      return "Generating image";
    case "open-openai-artifact":
      return "Opening image artifact";
    case "close-active-openai-artifact":
      return "Closing image artifact";
    case "create-working-topic":
      return "Creating working topic";
    case "add-feedback-topic-evidence":
      return "Adding topic evidence";
    case "add-feedback-topic-decision":
      return "Recording topic decision";
    case "focus-feedback-topic":
      return "Focusing topic";
    case "validate-provider-setup":
      return "Validating provider setup";
  }
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

interface InspectLiveChatQuiescenceInput {
  sessionId: string;
}

interface CloseVisibleLiveChatTabsInput {
  sessionId: string;
}

interface DeleteLiveChatArtifactsInput {
  sessionId: string;
  dryRun?: boolean;
  scheduleExactSelfDelete?: boolean;
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

interface FocusedLiveChatMutationInput extends LiveChatMutationInput {}

interface FocusedEditorChatMutationInput extends LiveChatMutationInput {
  sessionId?: string;
}

interface SendLiveChatMessageInput extends LiveChatMutationInput {
  sessionId: string;
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
    description: "Exact or prefix session identifier."
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
    name: "invoke_youtube_host_command",
    displayName: "Invoke YouTube Host Command",
    userDescription: "Run one bounded YouTube extension command through the current VS Code host.",
    modelDescription: "Run one bounded YouTube extension command through the current VS Code host so the installed YouTube extension can use its real SecretStorage, workspace-scoped settings, and UI-side behavior instead of terminal fallback. This surface is intentionally allowlisted to provider validation, OpenAI image generation, OpenAI artifact open, and active artifact close. For generate-openai-image, prefer supplying prompt and purpose so the command does not need to stop on interactive UI questions. This tool affects the VS Code UI and rejects concurrent host-bound invocations.",
    toolReferenceName: "invoke-youtube-host-command",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Which YouTube host command to run through VS Code.",
          enum: [
            "validate-provider-setup",
            "generate-openai-image",
            "open-openai-artifact",
            "close-active-openai-artifact"
          ]
        },
        prompt: {
          type: "string",
          description: "Image prompt for generate-openai-image. If omitted for that action, the YouTube extension will prompt interactively."
        },
        purpose: {
          type: "string",
          description: "Image purpose for generate-openai-image, for example story-beat, concept-frame, thumbnail, or moodboard."
        },
        size: {
          type: "string",
          description: "Optional OpenAI image size override for generate-openai-image."
        },
        model: {
          type: "string",
          description: "Optional OpenAI image model override for generate-openai-image."
        },
        critiqueModel: {
          type: "string",
          description: "Optional critique model override for generate-openai-image."
        },
        autoCritique: {
          type: "boolean",
          description: "Optional override for whether the YouTube extension runs its bounded critique/regenerate pass."
        },
        showMetadata: {
          type: "boolean",
          description: "When false, suppress the generated job metadata preview during generate-openai-image."
        },
        openArtifact: {
          type: "boolean",
          description: "When false, suppress opening the final image after generate-openai-image."
        },
        artifact: {
          type: "string",
          description: "Artifact key for open-openai-artifact. Allowed values: final, pass-1, pass-2, job, operator, viewer, tts."
        },
        jobId: {
          type: "string",
          description: "Optional exact job id for open-openai-artifact. If omitted, the YouTube extension may prompt or use the latest job depending on the action path."
        }
      },
      required: ["action"]
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
    name: "inspect_live_agent_chat_quiescence",
    displayName: "Inspect Live Agent Chat Quiescence",
    userDescription: "Inspect whether one live agent chat currently looks ongoing or settled from persisted evidence.",
    modelDescription: "Inspect whether one exact live agent chat currently looks ongoing or settled from persisted evidence using the same quiescence logic that the Local create/send wait path uses. This is a read-only diagnostic surface: it checks the persisted summary, companion transcript, quiet-window gate, and session-tail override, then reports whether the chat currently looks settled enough to return or still in-flight.",
    toolReferenceName: "inspect-live-agent-chat-quiescence",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Exact or prefix session identifier for the live agent chat to inspect."
        }
      },
      required: ["sessionId"]
    }
  },
  {
    name: "create_live_agent_chat",
    displayName: "Create Live Agent Chat",
    userDescription: "Preferred clean new-chat route when the first visible message should carry the requested agent.",
    modelDescription: "Direct Local new-chat create route. Opens a new chat and sends the first prompt. When agentName is supplied, the host will prefer a direct agent-open command when one is exposed; otherwise it may use bounded temporary prompt-file slash dispatch as fallback transport for the requested role. Prefer this tool for normal agent-chat creation, but treat prompt-file dispatch as fallback rather than the preferred semantic carrier. When strict selection evidence is requested, this tool evaluates that from the created session after dispatch rather than pretending it can prove create-time participant state before the session exists. This tool affects the VS Code UI and rejects concurrent live-chat operations.",
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
          description: "Optional custom agent name for the first message in a new chat. When supplied, the host will prefer a direct agent-open route when available and otherwise use bounded temporary prompt-file slash dispatch as fallback transport. For ordinary follow-ups in an already-correct chat, omit agentName instead of repeating it."
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
          description: "Fail after dispatch if the requested agent, mode, or model selection cannot be explicitly evidenced from the created session."
        }
      },
      required: ["prompt"]
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
    userDescription: "Close visible editor-hosted tabs, delete persisted artifacts, and queue exact offline cleanup for one live chat session, or dry-run the same target-resolution path without deleting anything.",
    modelDescription: "Close visible editor-hosted Local chat tabs for one exact session identifier, delete that session's persisted session JSONL plus known transcript and chat-resource companion artifacts from disk, and then queue exact offline cleanup for the same session target. This destructive route requires the full session id, refuses heuristic title-only editor matches, and is intended only for probe or test-chat cleanup. This tool affects the VS Code UI and relies on exact close-before-delete checks in the delete path rather than the heuristic exact-session self-targeting guard. When dryRun=true, the tool still resolves the exact target session and applies the settled-state execution guard, but it returns before any tab close, artifact deletion, or offline cleanup is attempted; dry runs may inspect the current terminal-bound chat without enabling real deletion. When scheduleExactSelfDelete=true, the tool queues exact offline cleanup instead of attempting live deletion; it may also best-effort close visible editor-hosted chat tabs immediately when the target already looks settled and is not the current terminal-bound conversation.",
    toolReferenceName: "delete-live-agent-chat-artifacts",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Exact session identifier for the live chat whose persisted artifacts should be deleted from disk. Prefixes are rejected for this destructive route."
        },
        dryRun: {
          type: "boolean",
          description: "If true, resolve and validate the exact target session, apply settled-state safety checks, and return before any tabs are closed, artifacts are deleted, or offline cleanup is queued. Dry runs may inspect the current terminal-bound chat without enabling real deletion."
        },
        scheduleExactSelfDelete: {
          type: "boolean",
          description: "If true, queue exact offline cleanup for this session instead of attempting live deletion. This explicit deferred path should be used when the target is still running or when immediate live deletion is not desired; if the target already looks settled and is not the current terminal-bound conversation, the tool may also best-effort close visible editor-hosted chat tabs now."
        }
      },
      required: ["sessionId"]
    }
  },
  {
    name: "send_message_to_live_agent_chat",
    displayName: "Send Message To Live Agent Chat",
    userDescription: "Continue an existing live chat by session id.",
    modelDescription: "Continue an existing live chat by session id. On this build the verified follow-up transport is: reveal the exact Local session, focus the resulting editor-hosted chat, then submit through the focused chat input. For ordinary follow-ups in an already-correct chat, omit agentName so the send stays on the normal session path. Supply agentName only when you intentionally want to rebind or change role on the existing conversation, knowing that focused send surfaces may then use bounded temporary prompt-file slash dispatch as fallback transport.",
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
          description: "Optional custom agent name for an intentional role rebind on the continued request. Omit this for ordinary follow-ups in an already-correct chat. On focused fallback surfaces a supplied agentName may route through bounded temporary prompt-file slash dispatch rather than a literal #agentName prefix."
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
        }
      },
      required: ["sessionId", "prompt"]
    }
  },
  {
    name: "reveal_live_agent_chat",
    displayName: "Reveal Live Agent Chat",
    userDescription: "Re-open an existing live chat so the visible thread reloads current persisted state.",
    modelDescription: "Re-open an existing live chat session in an editor group when the current build supports internal session-targeted chat commands. When a matching editor-hosted Local chat tab is already open, this path closes that tab first so the reopened session reloads current persisted state. Use this before inspection or best-effort follow-up when the visible thread must match persisted state.",
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
  "inspect_live_agent_chat_quiescence",
  "close_visible_live_chat_tabs",
  "reveal_live_agent_chat"
]);

const LOCAL_CHAT_MUTATION_TOOL_NAMES = new Set([
  "create_live_agent_chat",
  "delete_live_agent_chat_artifacts",
  "send_message_to_live_agent_chat"
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

async function renderLiveChatQuiescence(chatInterop: ChatInteropApi, sessionId: string): Promise<string> {
  const session = (await chatInterop.listChats()).find((item) => item.id === sessionId || item.id.startsWith(sessionId));
  if (!session) {
    throw new Error(`No live agent chat matched ${JSON.stringify(sessionId)}.`);
  }

  const quiescence = await getSessionQuiescenceState(session);
  const lines = [
    "# Live Agent Chat Quiescence",
    "",
    "## Session",
    `- Session ID: ${session.id}`,
    `- Title: ${session.title}`,
    `- Last Updated: ${session.lastUpdated}`,
    `- Session File: ${session.sessionFile}`,
    "",
    "## Current State",
    `- Classification: ${quiescence.settled ? "settled" : "ongoing"}`,
    `- Settled: ${quiescence.settled ? "yes" : "no"}`,
    `- Summary Settled: ${quiescence.summarySettled ? "yes" : "no"}`,
    `- Transcript Present: ${quiescence.transcriptPresent ? "yes" : "no"}`,
    `- Transcript Settled: ${quiescence.transcriptSettled ? "yes" : "no"}`,
    `- Quiet Window Satisfied: ${quiescence.quietWindowSatisfied ? "yes" : "no"}`,
    `- Pending Request Count: ${session.pendingRequestCount ?? 0}`,
    `- Last Request Completed: ${session.lastRequestCompleted === undefined ? "-" : session.lastRequestCompleted ? "yes" : "no"}`,
    `- Pending Edits: ${session.hasPendingEdits === undefined ? "-" : session.hasPendingEdits ? "yes" : "no"}`,
    `- Reason: ${quiescence.transcriptReason ?? (quiescence.settled ? "Persisted evidence currently looks settled enough to return." : "No specific unsettled reason was available.")}`
  ];

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

function toSendChatMessageRequest(input: SendLiveChatMessageInput): SendChatMessageRequest {
  return {
    sessionId: input.sessionId,
    ...toCreateChatRequest(input)
  };
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
        `- Canonical Send Total Duration Ms: ${revealLifecycle.timingMs.totalCanonicalSendMs ?? "-"}`,
        `- Reveal Duration Ms: ${revealLifecycle.timingMs.revealMs ?? "-"}`,
        `- Focus Duration Ms: ${revealLifecycle.timingMs.focusMs ?? "-"}`,
        `- Focused Send Call Duration Ms: ${revealLifecycle.timingMs.focusedSendCallMs ?? "-"}`,
        `- Focused Input Duration Ms: ${revealLifecycle.timingMs.focusedInputMs ?? "-"}`,
        `- Focused Prefill Duration Ms: ${revealLifecycle.timingMs.prefillMs ?? "-"}`,
        `- Focused Submit Duration Ms: ${revealLifecycle.timingMs.submitMs ?? "-"}`,
        `- Focused Mutation Wait Duration Ms: ${revealLifecycle.timingMs.focusedMutationWaitMs ?? "-"}`,
        `- Focused Mutation Poll Count: ${revealLifecycle.timingMs.focusedMutationPollCount ?? "-"}`,
        `- Focused Mutation Poll Interval Ms: ${revealLifecycle.timingMs.focusedMutationPollIntervalMs ?? "-"}`,
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

function formatArtifactDeletionNotes(report: ChatCommandResult["artifactDeletion"]): string[] {
  if (!report) {
    return [];
  }

  return [
    `Deleted Artifact Count: ${report.deletedPaths.length}`,
    `Missing Artifact Count: ${report.missingPaths.length}`,
    `Lingering Artifact Count: ${report.lingeringPaths?.length ?? 0}`,
    `Deleted Artifact Paths: ${report.deletedPaths.length > 0 ? report.deletedPaths.map((artifactPath) => JSON.stringify(artifactPath)).join(", ") : "-"}`,
    `Missing Artifact Paths: ${report.missingPaths.length > 0 ? report.missingPaths.map((artifactPath) => JSON.stringify(artifactPath)).join(", ") : "-"}`,
    `Lingering Artifact Paths: ${(report.lingeringPaths?.length ?? 0) > 0 ? report.lingeringPaths!.map((artifactPath) => JSON.stringify(artifactPath)).join(", ") : "-"}`
  ];
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
  operation: "reveal" | "send" | "close-visible-tabs" | "delete-artifacts",
  options: { allowTerminalBoundDeleteSelfTarget?: boolean } = {}
): Promise<void> {
  const chats = await chatInterop.listChats();
  const reason = operation === "delete-artifacts"
    ? await getExactDeleteSelfTargetingReason(chats, targetSessionId, {
      allowTerminalBoundSelfTarget: options.allowTerminalBoundDeleteSelfTarget
    })
    : getExactSelfTargetingReason(chats, targetSessionId, operation);
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

async function queueOfflineLiveChatCleanupForResolvedSession(
  context: vscode.ExtensionContext,
  session: ChatSessionSummary,
  workspaceStorageDir: string,
  globalStorageDir = context.globalStorageUri.fsPath
): Promise<string> {
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
    let lease: { release(): void } | undefined;
    try {
      lease = liveChatToolMutex.tryAcquire("live chat tool invocation");
    } catch (error) {
      throw new Error(
        `Another live chat or host-bound tool invocation is already running. Run these tools serially instead of in parallel. ${errorMessage(error)}`
      );
    }

    const budget = outputBudget(options.tokenizationOptions?.tokenBudget);
    try {
      const content = await this.invokeImpl(options.input, budget);
      return textResult(content);
    } finally {
      lease.release();
    }
  }
}

class LocalChatTool<TInput> implements vscode.LanguageModelTool<TInput> {
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
    let lease: { release(): void } | undefined;
    try {
      lease = liveChatToolMutex.tryAcquire("live chat tool invocation");
    } catch (error) {
      throw new Error(
        `Another live chat or host-bound tool invocation is already running. Run these tools serially instead of in parallel. ${errorMessage(error)}`
      );
    }

    const budget = outputBudget(options.tokenizationOptions?.tokenBudget);
    try {
      const content = await this.invokeImpl(options.input, budget);
      return textResult(content);
    } finally {
      lease.release();
    }
  }
}

export function registerLanguageModelTools(context: vscode.ExtensionContext, adapter: SessionToolsAdapter, chatInterop?: ChatInteropApi): void {
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
    const liveToolLogPath = path.join(context.globalStorageUri.fsPath, "live-tool-register.log");
    const logLiveToolRegistration = (phase: "start" | "done" | "error", toolName: string, detail?: string): void => {
      mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
      appendFileSync(
        liveToolLogPath,
        `${new Date().toISOString()} ${phase} ${toolName}${detail ? ` ${detail}` : ""}\n`,
        "utf8"
      );
    };
    const registerLiveTool = (toolName: string, tool: any): vscode.Disposable => {
      logLiveToolRegistration("start", toolName);
      try {
        const disposable = vscode.lm.registerTool(toolName, tool);
        logLiveToolRegistration("done", toolName);
        return disposable;
      } catch (error) {
        logLiveToolRegistration("error", toolName, errorMessage(error));
        throw error;
      }
    };

    if (LOCAL_CHAT_CONTROL_SURFACES_ENABLED) {
      liveToolRegistrations.push(
        registerLiveTool(
          "list_live_agent_chats",
          new LocalChatTool<ListLiveChatsInput>(
            () => "Listing live agent chat sessions",
            async (input) => renderLiveChatList(await chatInterop.listChats(), input.limit ?? 20)
          )
        ),
        registerLiveTool(
          "inspect_live_agent_chat_quiescence",
          new LocalChatTool<InspectLiveChatQuiescenceInput>(
            (input) => `Inspecting live agent chat quiescence for ${JSON.stringify(input.sessionId)}`,
            async (input) => renderLiveChatQuiescence(chatInterop, input.sessionId)
          )
        ),
        registerLiveTool(
          "close_visible_live_chat_tabs",
          new LocalChatTool<CloseVisibleLiveChatTabsInput>(
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
        registerLiveTool(
          "delete_live_agent_chat_artifacts",
          new LocalChatTool<DeleteLiveChatArtifactsInput>(
            (input) => `${input.dryRun ? "Dry-running" : input.scheduleExactSelfDelete ? "Scheduling offline delete for" : "Deleting"} live agent chat artifacts for ${JSON.stringify(input.sessionId)}`,
            async (input) => {
              if (input.dryRun && input.scheduleExactSelfDelete) {
                throw new Error("delete_live_agent_chat_artifacts does not allow dryRun=true together with scheduleExactSelfDelete=true. Choose either inspection or deferred self-delete.");
              }

              const { session, workspaceStorageDir } = await resolveExactWorkspaceStorageLiveChatForOfflineCleanup(chatInterop, input.sessionId);
              if (input.scheduleExactSelfDelete) {
                const chats = await chatInterop.listChats();
                const terminalBoundSessionId = await getExactDeleteTerminalBoundSessionId(chats, input.sessionId);
                const targetLooksSettled = (session.pendingRequestCount ?? 0) === 0 && session.lastRequestCompleted === true;
                const canCloseNow = targetLooksSettled && !terminalBoundSessionId;
                let closeNotes: string[];

                if (canCloseNow) {
                  const closeResult = await chatInterop.closeVisibleTabs(input.sessionId);
                  closeNotes = [
                    `Visible Tab Close Executed: ${closeResult.ok ? "yes" : "no"}`,
                    closeResult.ok
                      ? `Visible Tab Close Result: closedMatchingVisibleTabs=${closeResult.revealLifecycle?.closedMatchingVisibleTabs ?? 0}`
                      : `Visible Tab Close Result: ${closeResult.reason ?? closeResult.error ?? "close-visible-tabs failed"}`
                  ];
                } else {
                  closeNotes = [
                    "Visible Tab Close Executed: no",
                    terminalBoundSessionId
                      ? `Visible Tab Close Result: skipped because target matches the current terminal-bound conversation ${terminalBoundSessionId}`
                      : "Visible Tab Close Result: skipped because the target does not yet look settled"
                  ];
                }

                const queuedResult = await queueOfflineLiveChatCleanupForResolvedSession(context, session, workspaceStorageDir);
                return formatChatMutationResult(
                  "Live Agent Chat Offline Delete Scheduled",
                  session,
                  undefined,
                  undefined,
                  [
                    "Deferred Offline Delete: yes",
                    "Delete Executed Now: no",
                    "Offline Cleanup Queued: yes",
                    ...closeNotes,
                    ...queuedResult.split(/\r?\n/).filter((line) => line.startsWith("- ")).map((line) => line.slice(2))
                  ]
                );
              }

              await assertNotSelfTargetingLiveChat(chatInterop, input.sessionId, "delete-artifacts", {
                allowTerminalBoundDeleteSelfTarget: input.dryRun === true
              });
              if (input.dryRun) {
                return formatChatMutationResult(
                  "Live Agent Chat Artifact Delete Dry Run",
                  session,
                  undefined,
                  undefined,
                  [
                    "Dry Run: yes",
                    "Delete Executed: no",
                    "Visible Tab Close Executed: no",
                    "Offline Cleanup Queued: no",
                    `Workspace Storage Dir Resolved: ${workspaceStorageDir ? "yes" : "no"}`
                  ]
                );
              }
              const result = await chatInterop.deleteChat(input.sessionId);
              if (!result.ok) {
                throw new Error(result.reason ?? result.error ?? `Failed to delete live agent chat artifacts for ${input.sessionId}.`);
              }
              const notes = formatArtifactDeletionNotes(result.artifactDeletion);
              try {
                const queuedResult = await queueOfflineLiveChatCleanupForResolvedSession(context, session, workspaceStorageDir);
                notes.push(
                  "Offline Cleanup Queued: yes",
                  ...queuedResult.split(/\r?\n/).filter((line) => line.startsWith("- ")).map((line) => line.slice(2))
                );
              } catch (error) {
                notes.push(
                  "Offline Cleanup Queued: no",
                  `Offline Cleanup Queue Error: ${errorMessage(error)}`
                );
              }
              return formatChatMutationResult(
                "Live Agent Chat Artifacts Deleted",
                result.session,
                result.selection,
                result.revealLifecycle,
                notes
              );
            }
          )
        ),
        registerLiveTool(
          "reveal_live_agent_chat",
          new LocalChatTool<LiveChatSelectionInput>(
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
        registerLiveTool(
          "create_live_agent_chat",
          new LocalChatTool<LiveChatMutationInput>(
            () => "Creating a new live agent chat",
            async (input) => {
              const result = await chatInterop.createChat(toCreateChatRequest(input));
              if (!result.ok) {
                throw new Error(result.reason ?? result.error ?? "Failed to create live agent chat.");
              }
              return formatChatMutationResult(
                "Live Agent Chat Created",
                result.session,
                result.selection,
                result.revealLifecycle
              );
            }
          )
        ),
        registerLiveTool(
          "send_message_to_live_agent_chat",
          new LocalChatTool<SendLiveChatMessageInput>(
            (input) => `Sending a message to live agent chat ${JSON.stringify(input.sessionId)}`,
            async (input) => {
              const request = toSendChatMessageRequest(input);
              const result = await sendMessageToSession(chatInterop, request);
              if (!result.ok) {
                throw new Error(result.reason ?? result.error ?? `Failed to send a message to live agent chat ${input.sessionId}.`);
              }
              return formatChatMutationResult(
                "Live Agent Chat Updated",
                result.session,
                result.selection,
                result.revealLifecycle
              );
            }
          )
        )
      );
    }

    context.subscriptions.push(...liveToolRegistrations);
  }

  context.subscriptions.push(
    vscode.lm.registerTool(
      "invoke_youtube_host_command",
      new LiveChatTool<InvokeYouTubeHostCommandInput>(
        (input) => youtubeHostCommandInvocationMessage(input),
        async (input, budget) => {
          const spec = YOUTUBE_HOST_COMMAND_SPECS[input.action];
          if (!spec) {
            throw new Error(`Unsupported YouTube host command action: ${String(input.action)}`);
          }

          const commands = await vscode.commands.getCommands(true);
          if (!commands.includes(spec.commandId)) {
            throw new Error(`The YouTube host command ${spec.commandId} is not currently registered in this VS Code window.`);
          }

          const args = buildYouTubeHostCommandArgs(input);
          const result = args === undefined
            ? await vscode.commands.executeCommand(spec.commandId)
            : await vscode.commands.executeCommand(spec.commandId, args);
          return renderYouTubeHostCommandResult(input, spec.commandId, result, budget);
        }
      )
    )
  );

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
    )
  );
}