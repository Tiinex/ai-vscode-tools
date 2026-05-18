import * as vscode from "vscode";

export const TRACEABLE_SUBAGENT_TOOL_NAME = "run_traceable_subagent";

const DEFAULT_MODEL_VENDOR = "copilot";
const DEFAULT_MAX_ITERATIONS = 4;
const DEFAULT_MAX_TOOL_CALLS = 6;
const DEFAULT_OUTPUT_TEXT_CHARS = 1600;

const DEFAULT_BLOCKED_TOOL_NAMES = new Set([
  TRACEABLE_SUBAGENT_TOOL_NAME,
  "create_live_agent_chat",
  "close_visible_live_chat_tabs",
  "delete_live_agent_chat_artifacts",
  "send_message_to_live_agent_chat",
  "reveal_live_agent_chat",
  "invoke_youtube_host_command"
]);

type TraceableStopReason =
  | "completed"
  | "budget_exhausted"
  | "insufficient_grounding"
  | "tool_blocked"
  | "awaiting_input"
  | "policy_stop";

type TraceableCompletionClaim = "complete" | "partial" | "unresolved";
type TraceableStepStatus = "planned" | "attempted" | "completed" | "failed" | "skipped";
type TraceableToolResult = "success" | "failure" | "timeout" | "inputNeeded" | "notRun";
type TraceableStatus = "trace-supported" | "trace-incomplete" | "trace-conflicted";

interface TraceableRequestExpectations {
  expectedSteps?: string[];
  expectedToolFamilies?: string[];
  disallowStrongConclusionWithoutEvidence?: boolean;
}

interface TraceableCarriedContext {
  priorTurnsSummary?: string;
  fileContext?: string[];
  reductions?: string[];
}

interface TraceableWrapperPolicy {
  name?: string;
  closureMode?: "open" | "bounded-summary" | "explicit-final";
}

interface TraceableBudgetPolicy {
  maxIterations?: number;
  maxToolCalls?: number;
}

interface TraceableModelSelector {
  vendor?: string;
  family?: string;
  id?: string;
  version?: string;
}

export interface TraceableSubagentInput {
  userInput: string;
  parentTask: string;
  parentExpectations?: TraceableRequestExpectations;
  carriedContext?: TraceableCarriedContext;
  wrapperPolicy?: TraceableWrapperPolicy;
  budgetPolicy?: TraceableBudgetPolicy;
  modelSelector?: TraceableModelSelector;
  allowedToolNames?: string[];
  blockedToolNames?: string[];
}

export interface TraceableSubagentStep {
  id: string;
  intent: string;
  status: TraceableStepStatus;
  note?: string;
}

export interface TraceableSubagentMissingItem {
  kind: "step" | "toolCall";
  label: string;
  reason: string;
}

export interface TraceableOpaqueDelegation {
  toolName: string;
  note: string;
}

export interface TraceableSubagentChildPayload {
  steps: TraceableSubagentStep[];
  expectedButMissing: TraceableSubagentMissingItem[];
  stopReason: TraceableStopReason;
  completionClaim: TraceableCompletionClaim;
  finalSummary: string;
  opaqueDelegations?: TraceableOpaqueDelegation[];
}

export interface TraceableSubagentToolCallRecord {
  callId: string;
  toolName: string;
  argsSummary: string;
  result: TraceableToolResult;
  note?: string;
}

export interface TraceableSubagentRunResult {
  request: Record<string, unknown>;
  model: {
    vendor: string;
    family: string;
    id: string;
    version: string;
  } | null;
  allowedToolNames: string[];
  toolCalls: TraceableSubagentToolCallRecord[];
  traceStatus: TraceableStatus;
  steps: TraceableSubagentStep[];
  expectedButMissing: TraceableSubagentMissingItem[];
  stopReason: TraceableStopReason;
  completionClaim: TraceableCompletionClaim;
  finalSummary: string;
  opaqueDelegations: TraceableOpaqueDelegation[];
  rawModelText?: string;
}

type ToolLike = Pick<vscode.LanguageModelToolInformation, "name"> & Partial<Pick<vscode.LanguageModelToolInformation, "description" | "inputSchema">>;

function uniqueStrings(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 16))}... [truncated]`;
}

function summarizeJson(value: unknown, maxChars = 180): string {
  try {
    return truncate(JSON.stringify(value), maxChars);
  } catch {
    return truncate(String(value), maxChars);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeBudgetPolicy(input: TraceableSubagentInput): Required<TraceableBudgetPolicy> {
  const maxIterations = Number.isInteger(input.budgetPolicy?.maxIterations) && (input.budgetPolicy?.maxIterations ?? 0) > 0
    ? input.budgetPolicy!.maxIterations!
    : DEFAULT_MAX_ITERATIONS;
  const maxToolCalls = Number.isInteger(input.budgetPolicy?.maxToolCalls) && (input.budgetPolicy?.maxToolCalls ?? 0) > 0
    ? input.budgetPolicy!.maxToolCalls!
    : DEFAULT_MAX_TOOL_CALLS;
  return {
    maxIterations,
    maxToolCalls
  };
}

function normalizedWrapperPolicy(input: TraceableSubagentInput): Required<TraceableWrapperPolicy> {
  return {
    name: input.wrapperPolicy?.name?.trim() || "tiinex-traceable-subagent-v1",
    closureMode: input.wrapperPolicy?.closureMode || "bounded-summary"
  };
}

export function defaultTraceableSubagentBlockedToolNames(): string[] {
  return [...DEFAULT_BLOCKED_TOOL_NAMES];
}

export function buildTraceableSubagentRequestEnvelope(input: TraceableSubagentInput): Record<string, unknown> {
  const wrapperPolicy = normalizedWrapperPolicy(input);
  const budgetPolicy = normalizeBudgetPolicy(input);
  const request: Record<string, unknown> = {
    userInput: input.userInput,
    parentTask: input.parentTask,
    wrapperPolicy,
    budgetPolicy
  };

  if (input.parentExpectations) {
    request.parentExpectations = input.parentExpectations;
  }
  if (input.carriedContext) {
    request.carriedContext = input.carriedContext;
  }
  if (input.modelSelector) {
    request.modelSelector = {
      vendor: input.modelSelector.vendor || DEFAULT_MODEL_VENDOR,
      family: input.modelSelector.family,
      id: input.modelSelector.id,
      version: input.modelSelector.version
    };
  }
  const allowedToolNames = uniqueStrings(input.allowedToolNames);
  const blockedToolNames = uniqueStrings(input.blockedToolNames);
  if (allowedToolNames.length > 0) {
    request.allowedToolNames = allowedToolNames;
  }
  if (blockedToolNames.length > 0) {
    request.blockedToolNames = blockedToolNames;
  }
  return request;
}

export function buildTraceableSubagentPromptSections(
  input: TraceableSubagentInput,
  selectedToolNames: string[]
): { requestEnvelope: Record<string, unknown>; promptTexts: string[] } {
  const requestEnvelope = buildTraceableSubagentRequestEnvelope(input);
  const wrapperPolicy = normalizedWrapperPolicy(input);
  const promptTexts = [
    [
      "Traceable subagent runtime contract:",
      "- This is a bounded Tiinex child lane.",
      "- Keep the original user input distinct from the parent task.",
      "- Use tools only when they materially improve grounding.",
      `- Do not call ${TRACEABLE_SUBAGENT_TOOL_NAME} from inside this lane.`,
      "- If you rely materially on native runSubagent, report that as opaque delegation.",
      "- Final output must be one JSON object and nothing else.",
      "- The JSON object must contain: steps, expectedButMissing, stopReason, completionClaim, finalSummary, and optionally opaqueDelegations.",
      `- Wrapper policy is explicit and infrastructural only: ${JSON.stringify(wrapperPolicy)}.`
    ].join("\n"),
    `Request contract:\n${JSON.stringify(requestEnvelope, null, 2)}`,
    selectedToolNames.length > 0
      ? `Allowed tool names for this run:\n${JSON.stringify(selectedToolNames, null, 2)}`
      : "Allowed tool names for this run: []"
  ];
  return {
    requestEnvelope,
    promptTexts
  };
}

function buildTraceableSubagentMessages(
  input: TraceableSubagentInput,
  selectedToolNames: string[]
): vscode.LanguageModelChatMessage[] {
  const promptSections = buildTraceableSubagentPromptSections(input, selectedToolNames);
  return promptSections.promptTexts.map((text) => vscode.LanguageModelChatMessage.User(text));
}

function normalizeMissingItems(value: unknown): TraceableSubagentMissingItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecord)
    .map((item) => ({
      kind: item.kind === "toolCall" ? "toolCall" : "step",
      label: typeof item.label === "string" ? item.label : "unknown",
      reason: typeof item.reason === "string" ? item.reason : "No reason provided."
    }));
}

function normalizeSteps(value: unknown): TraceableSubagentStep[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecord)
    .map((item, index) => ({
      id: typeof item.id === "string" ? item.id : `step-${index + 1}`,
      intent: typeof item.intent === "string" ? item.intent : "unspecified",
      status: item.status === "planned"
        || item.status === "attempted"
        || item.status === "completed"
        || item.status === "failed"
        || item.status === "skipped"
        ? item.status
        : "attempted",
      note: typeof item.note === "string" ? item.note : undefined
    }));
}

function normalizeOpaqueDelegations(value: unknown): TraceableOpaqueDelegation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecord)
    .map((item) => ({
      toolName: typeof item.toolName === "string" ? item.toolName : "unknown",
      note: typeof item.note === "string" ? item.note : "Opaque delegation was reported without a note."
    }));
}

function normalizeParsedPayload(value: unknown): TraceableSubagentChildPayload | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const stopReason = value.stopReason === "completed"
    || value.stopReason === "budget_exhausted"
    || value.stopReason === "insufficient_grounding"
    || value.stopReason === "tool_blocked"
    || value.stopReason === "awaiting_input"
    || value.stopReason === "policy_stop"
    ? value.stopReason
    : undefined;
  const completionClaim = value.completionClaim === "complete"
    || value.completionClaim === "partial"
    || value.completionClaim === "unresolved"
    ? value.completionClaim
    : undefined;
  const finalSummary = typeof value.finalSummary === "string" ? value.finalSummary.trim() : "";
  if (!stopReason || !completionClaim || !finalSummary) {
    return undefined;
  }
  return {
    steps: normalizeSteps(value.steps),
    expectedButMissing: normalizeMissingItems(value.expectedButMissing),
    stopReason,
    completionClaim,
    finalSummary,
    opaqueDelegations: normalizeOpaqueDelegations(value.opaqueDelegations)
  };
}

export function extractTraceableSubagentPayload(rawText: string): TraceableSubagentChildPayload | undefined {
  const candidates = [rawText.trim()];
  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }
  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(rawText.slice(firstBrace, lastBrace + 1).trim());
  }

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate);
      const normalized = normalizeParsedPayload(parsed);
      if (normalized) {
        return normalized;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function summarizeToolError(error: unknown): { result: TraceableToolResult; note: string } {
  if (error instanceof vscode.LanguageModelError) {
    return {
      result: error.code === vscode.LanguageModelError.Blocked().code ? "inputNeeded" : "failure",
      note: error.message
    };
  }
  if (error instanceof Error) {
    return {
      result: /timeout/i.test(error.message) ? "timeout" : "failure",
      note: error.message
    };
  }
  return {
    result: "failure",
    note: String(error)
  };
}

function isOpaqueNativeDelegationTool(toolName: string): boolean {
  return /^runSubagent$/i.test(toolName) || /^run_subagent$/i.test(toolName);
}

function resolveTraceStatus(
  parsedPayload: TraceableSubagentChildPayload | undefined,
  toolCalls: TraceableSubagentToolCallRecord[],
  opaqueDelegations: TraceableOpaqueDelegation[]
): TraceableStatus {
  if (!parsedPayload) {
    return "trace-incomplete";
  }
  if (parsedPayload.completionClaim === "complete" && toolCalls.some((entry) => entry.result === "failure" || entry.result === "notRun" || entry.result === "timeout")) {
    return "trace-conflicted";
  }
  if (opaqueDelegations.length > 0 || toolCalls.some((entry) => entry.result === "failure" || entry.result === "timeout" || entry.result === "inputNeeded")) {
    return "trace-incomplete";
  }
  return "trace-supported";
}

function fallbackResult(
  input: TraceableSubagentInput,
  toolCalls: TraceableSubagentToolCallRecord[],
  finalSummary: string,
  stopReason: TraceableStopReason,
  completionClaim: TraceableCompletionClaim,
  extra: Partial<TraceableSubagentRunResult> = {}
): TraceableSubagentRunResult {
  return {
    request: buildTraceableSubagentRequestEnvelope(input),
    model: extra.model ?? null,
    allowedToolNames: extra.allowedToolNames ?? [],
    toolCalls,
    traceStatus: extra.traceStatus ?? "trace-incomplete",
    steps: extra.steps ?? [],
    expectedButMissing: extra.expectedButMissing ?? [],
    stopReason,
    completionClaim,
    finalSummary,
    opaqueDelegations: extra.opaqueDelegations ?? [],
    rawModelText: extra.rawModelText
  };
}

export function selectTraceableSubagentTools<T extends ToolLike>(availableTools: readonly T[], input: Pick<TraceableSubagentInput, "allowedToolNames" | "blockedToolNames">): T[] {
  const blocked = new Set([...DEFAULT_BLOCKED_TOOL_NAMES, ...uniqueStrings(input.blockedToolNames)]);
  const allowed = uniqueStrings(input.allowedToolNames);
  const filtered = availableTools.filter((tool) => !blocked.has(tool.name));
  if (allowed.length === 0) {
    return [...filtered];
  }
  const allowedSet = new Set(allowed);
  return filtered.filter((tool) => allowedSet.has(tool.name));
}

export async function runTraceableSubagent(
  input: TraceableSubagentInput,
  options: {
    accessInformation?: vscode.LanguageModelAccessInformation;
    token?: vscode.CancellationToken;
  } = {}
): Promise<TraceableSubagentRunResult> {
  const selectedTools = selectTraceableSubagentTools(vscode.lm.tools, input);
  const selectedToolNames = selectedTools.map((tool) => tool.name);
  const selector = {
    vendor: input.modelSelector?.vendor || DEFAULT_MODEL_VENDOR,
    family: input.modelSelector?.family,
    id: input.modelSelector?.id,
    version: input.modelSelector?.version
  } satisfies vscode.LanguageModelChatSelector;

  const budgetPolicy = normalizeBudgetPolicy(input);
  const toolCalls: TraceableSubagentToolCallRecord[] = [];
  const opaqueDelegations: TraceableOpaqueDelegation[] = [];

  let model: vscode.LanguageModelChat | undefined;
  try {
    const availableModels = await vscode.lm.selectChatModels(selector);
    const sendableModels = options.accessInformation
      ? availableModels.filter((candidate) => options.accessInformation?.canSendRequest(candidate))
      : availableModels;
    model = sendableModels[0];
  } catch (error) {
    return fallbackResult(
      input,
      toolCalls,
      error instanceof Error ? error.message : String(error),
      "tool_blocked",
      "unresolved",
      {
        allowedToolNames: selectedToolNames
      }
    );
  }

  if (!model) {
    return fallbackResult(
      input,
      toolCalls,
      "No accessible language model matched the requested traceable-subagent selector.",
      "tool_blocked",
      "unresolved",
      {
        allowedToolNames: selectedToolNames
      }
    );
  }

  const modelInfo = {
    vendor: model.vendor,
    family: model.family,
    id: model.id,
    version: model.version
  };

  const messages = buildTraceableSubagentMessages(input, selectedToolNames);
  let lastRawModelText = "";

  for (let iteration = 0; iteration < budgetPolicy.maxIterations; iteration += 1) {
    let response: vscode.LanguageModelChatResponse;
    try {
      response = await model.sendRequest(
        messages,
        {
          justification: "Run a bounded Tiinex traceable subagent lane.",
          tools: selectedTools,
          toolMode: selectedTools.length > 0 ? vscode.LanguageModelChatToolMode.Auto : undefined
        },
        options.token
      );
    } catch (error) {
      return fallbackResult(
        input,
        toolCalls,
        error instanceof Error ? error.message : String(error),
        "tool_blocked",
        "unresolved",
        {
          model: modelInfo,
          allowedToolNames: selectedToolNames,
          rawModelText: lastRawModelText
        }
      );
    }

    const assistantParts: Array<vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart | vscode.LanguageModelDataPart> = [];
    const toolCallParts: vscode.LanguageModelToolCallPart[] = [];
    let textBuffer = "";

    try {
      for await (const part of response.stream) {
        if (part instanceof vscode.LanguageModelTextPart) {
          textBuffer += part.value;
          assistantParts.push(part);
          continue;
        }
        if (part instanceof vscode.LanguageModelToolCallPart) {
          toolCallParts.push(part);
          assistantParts.push(part);
          continue;
        }
        if (part instanceof vscode.LanguageModelDataPart) {
          assistantParts.push(part);
        }
      }
    } catch (error) {
      return fallbackResult(
        input,
        toolCalls,
        error instanceof Error ? error.message : String(error),
        "tool_blocked",
        "partial",
        {
          model: modelInfo,
          allowedToolNames: selectedToolNames,
          rawModelText: textBuffer || lastRawModelText
        }
      );
    }

    lastRawModelText = textBuffer.trim();
    if (toolCallParts.length === 0) {
      const parsedPayload = extractTraceableSubagentPayload(lastRawModelText);
      if (!parsedPayload) {
        return fallbackResult(
          input,
          toolCalls,
          lastRawModelText || "Child lane returned no parseable trace payload.",
          "insufficient_grounding",
          "unresolved",
          {
            model: modelInfo,
            allowedToolNames: selectedToolNames,
            rawModelText: lastRawModelText
          }
        );
      }

      const allOpaqueDelegations = [...opaqueDelegations, ...(parsedPayload.opaqueDelegations ?? [])];
      return {
        request: buildTraceableSubagentRequestEnvelope(input),
        model: modelInfo,
        allowedToolNames: selectedToolNames,
        toolCalls,
        traceStatus: resolveTraceStatus(parsedPayload, toolCalls, allOpaqueDelegations),
        steps: parsedPayload.steps,
        expectedButMissing: parsedPayload.expectedButMissing,
        stopReason: parsedPayload.stopReason,
        completionClaim: parsedPayload.completionClaim,
        finalSummary: parsedPayload.finalSummary,
        opaqueDelegations: allOpaqueDelegations,
        rawModelText: lastRawModelText
      };
    }

    messages.push(vscode.LanguageModelChatMessage.Assistant(assistantParts));

    const toolResultParts: vscode.LanguageModelToolResultPart[] = [];
    for (const call of toolCallParts) {
      if (toolCalls.length >= budgetPolicy.maxToolCalls) {
        const note = `Tool-call budget exhausted before ${call.name} could run.`;
        toolCalls.push({
          callId: call.callId,
          toolName: call.name,
          argsSummary: summarizeJson(call.input),
          result: "notRun",
          note
        });
        toolResultParts.push(
          new vscode.LanguageModelToolResultPart(call.callId, [new vscode.LanguageModelTextPart(note)])
        );
        continue;
      }

      if (call.name === TRACEABLE_SUBAGENT_TOOL_NAME) {
        const note = `${TRACEABLE_SUBAGENT_TOOL_NAME} is non-reentrant and cannot call itself.`;
        toolCalls.push({
          callId: call.callId,
          toolName: call.name,
          argsSummary: summarizeJson(call.input),
          result: "failure",
          note
        });
        toolResultParts.push(
          new vscode.LanguageModelToolResultPart(call.callId, [new vscode.LanguageModelTextPart(note)])
        );
        continue;
      }

      try {
        const toolResult = await vscode.lm.invokeTool(call.name, {
          input: isRecord(call.input) ? call.input : {},
          toolInvocationToken: undefined
        }, options.token);

        if (isOpaqueNativeDelegationTool(call.name)) {
          opaqueDelegations.push({
            toolName: call.name,
            note: "Native runSubagent delegation remains opaque from the parent trace lane."
          });
        }

        toolCalls.push({
          callId: call.callId,
          toolName: call.name,
          argsSummary: summarizeJson(call.input),
          result: "success"
        });
        toolResultParts.push(new vscode.LanguageModelToolResultPart(call.callId, toolResult.content));
      } catch (error) {
        const failure = summarizeToolError(error);
        toolCalls.push({
          callId: call.callId,
          toolName: call.name,
          argsSummary: summarizeJson(call.input),
          result: failure.result,
          note: failure.note
        });
        toolResultParts.push(
          new vscode.LanguageModelToolResultPart(call.callId, [new vscode.LanguageModelTextPart(failure.note)])
        );
      }
    }

    messages.push(vscode.LanguageModelChatMessage.User(toolResultParts));
  }

  return fallbackResult(
    input,
    toolCalls,
    "Traceable subagent iteration budget was exhausted before the child produced a final trace payload.",
    "budget_exhausted",
    "partial",
    {
      model: modelInfo,
      allowedToolNames: selectedToolNames,
      expectedButMissing: toolCalls
        .filter((entry) => entry.result === "notRun")
        .map((entry) => ({
          kind: "toolCall" as const,
          label: entry.toolName,
          reason: entry.note || "Tool call was not run before budget exhaustion."
        })),
      opaqueDelegations,
      rawModelText: lastRawModelText,
      traceStatus: toolCalls.some((entry) => entry.result === "notRun") ? "trace-conflicted" : "trace-incomplete"
    }
  );
}

export function renderTraceableSubagentMarkdown(result: TraceableSubagentRunResult): string {
  const lines = [
    "# Traceable Subagent Result",
    "",
    `- Trace Status: ${result.traceStatus}`,
    `- Stop Reason: ${result.stopReason}`,
    `- Completion Claim: ${result.completionClaim}`,
    `- Final Summary: ${result.finalSummary}`,
    `- Model: ${result.model ? `${result.model.vendor}/${result.model.family}/${result.model.id}` : "-"}`,
    `- Allowed Tool Count: ${result.allowedToolNames.length}`,
    `- Runtime Tool Calls: ${result.toolCalls.length}`,
    "",
    "## Request Contract",
    "```json",
    JSON.stringify(result.request, null, 2),
    "```",
    "",
    "## Runtime Tool Ledger",
    "```json",
    JSON.stringify(result.toolCalls, null, 2),
    "```",
    "",
    "## Child Trace",
    "```json",
    JSON.stringify({
      steps: result.steps,
      expectedButMissing: result.expectedButMissing,
      opaqueDelegations: result.opaqueDelegations,
      stopReason: result.stopReason,
      completionClaim: result.completionClaim,
      finalSummary: result.finalSummary
    }, null, 2),
    "```"
  ];

  if (result.rawModelText?.trim()) {
    lines.push(
      "",
      "## Raw Child Output",
      "```text",
      truncate(result.rawModelText.trim(), DEFAULT_OUTPUT_TEXT_CHARS),
      "```"
    );
  }

  return `${lines.join("\n")}\n`;
}