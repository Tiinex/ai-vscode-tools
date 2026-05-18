import { promises as fs } from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import { isRuntimeAgentArtifactPath, normalizeArtifactPath } from "./tools/runtimeAgentArtifactStructure";
import { normalizeToolReferenceKey } from "./toolNameNormalization";

export const TRACEABLE_SUBAGENT_TOOL_NAME = "run_traceable_subagent";

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

export interface TraceableAgentRole {
  name: string;
  filePath?: string;
}

export interface TraceableModelSelector {
  vendor?: string;
  family?: string;
  id?: string;
  version?: string;
}

function normalizeModelSelector(selector: TraceableModelSelector | undefined): TraceableModelSelector {
  return {
    vendor: selector?.vendor?.trim() || undefined,
    family: selector?.family?.trim() || undefined,
    id: selector?.id?.trim() || undefined,
    version: selector?.version?.trim() || undefined
  };
}

function hasExactModelSelector(selector: TraceableModelSelector | undefined): selector is TraceableModelSelector & { id: string } {
  return Boolean(selector?.id?.trim());
}

export interface TraceableSubagentInput {
  userInput: string;
  parentTask: string;
  agentRole?: TraceableAgentRole;
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
  debugLogPath?: string;
}

interface ResolvedTraceableAgentArtifact {
  requestedName: string;
  resolvedName: string;
  filePath: string;
  rawFrontmatter: string;
  body: string;
  modelDeclaration?: string;
  modelSelector?: TraceableModelSelector;
  toolDeclarations: string[];
  disableModelInvocation: boolean;
}

type ToolLike = Pick<vscode.LanguageModelToolInformation, "name"> & Partial<Pick<vscode.LanguageModelToolInformation, "description" | "inputSchema">>;

interface TraceableToolSelectionInput {
  allowedToolNames?: string[];
  blockedToolNames?: string[];
  defaultAllowedToolNames?: string[];
}

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

function normalizeAgentRole(input: TraceableAgentRole | undefined): TraceableAgentRole | undefined {
  const name = input?.name?.trim();
  const filePath = input?.filePath?.trim();
  if (!name && !filePath) {
    return undefined;
  }
  return {
    name: name || path.basename(filePath ?? "", ".agent.md"),
    filePath: filePath || undefined
  };
}

function normalizeHumanModelLabel(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9.\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

const SUPPORTED_AGENT_MODEL_DECLARATIONS = new Map<string, TraceableModelSelector>([
  ["gpt-5-mini-copilot", { vendor: "copilot", id: "gpt-5-mini" }],
  ["gpt-5.4-mini-copilot", { vendor: "copilot", id: "gpt-5.4" }],
  ["copilot/gpt-5-mini", { vendor: "copilot", id: "gpt-5-mini" }],
  ["copilot/gpt-5.4", { vendor: "copilot", id: "gpt-5.4" }]
]);

const TRACEABLE_AGENT_ALLOWED_FRONTMATTER_FIELDS = new Set([
  "name",
  "description",
  "argument-hint",
  "model",
  "tools",
  "disable-model-invocation",
  "target",
  "user-invocable",
  "handoffs",
  "candidate",
  "experimental",
  "human-role"
]);

function normalizeRoleStemToken(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9.\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function buildAgentArtifactStemCandidates(roleName: string): string[] {
  const candidates: string[] = [];
  const trimmed = roleName.trim();
  const pushCandidate = (value: string | undefined) => {
    const normalized = value?.trim().replace(/\.agent\.md$/i, "");
    if (!normalized || candidates.includes(normalized)) {
      return;
    }
    candidates.push(normalized);
  };

  pushCandidate(normalizeArtifactPath(trimmed).split("/").pop());
  pushCandidate(normalizeRoleStemToken(trimmed));

  const baseLabel = trimmed.replace(/\s*\([^)]*\)/gu, "").trim();
  const parentheticalTokens = [...trimmed.matchAll(/\(([^)]+)\)/gu)]
    .map((match) => normalizeRoleStemToken(match[1]))
    .filter(Boolean);
  if (baseLabel) {
    pushCandidate([normalizeRoleStemToken(baseLabel), ...parentheticalTokens].filter(Boolean).join("."));
  }

  return candidates;
}

function parseFrontmatterFields(rawFrontmatter: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of rawFrontmatter.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (/^\s/u.test(line) || /^-\s/u.test(trimmed)) {
      throw new Error(`Traceable agent frontmatter uses unsupported nested or block YAML: ${JSON.stringify(line)}`);
    }
    const match = line.match(/^([A-Za-z][A-Za-z0-9-]*)\s*:\s*(.*?)\s*$/u);
    if (!match) {
      throw new Error(`Traceable agent frontmatter contains an unsupported line: ${JSON.stringify(line)}`);
    }
    const key = match[1].trim();
    if (!TRACEABLE_AGENT_ALLOWED_FRONTMATTER_FIELDS.has(key)) {
      throw new Error(`Traceable agent frontmatter contains an unsupported field: ${key}`);
    }
    if (fields.has(key)) {
      throw new Error(`Traceable agent frontmatter contains a duplicated field: ${key}`);
    }
    fields.set(key, match[2].trim());
  }
  return fields;
}

function parseFrontmatterScalar(rawValue: string | undefined): string | undefined {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/^['"]|['"]$/g, "");
}

function parseFrontmatterStringList(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }
  const trimmed = rawValue.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [trimmed.replace(/^['"]|['"]$/g, "")].filter(Boolean);
  }
  return trimmed.slice(1, -1)
    .split(",")
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function parseFrontmatterBoolean(rawValue: string | undefined): boolean {
  return /^true$/iu.test(rawValue?.trim() ?? "");
}

function extractAgentFrontmatter(raw: string, sourceLabel: string): {
  rawFrontmatter: string;
  fields: Map<string, string>;
  body: string;
} {
  const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!frontmatterMatch) {
    throw new Error(`Resolved traceable agent artifact is missing YAML frontmatter: ${sourceLabel}`);
  }

  const rawFrontmatter = frontmatterMatch[1];
  const fields = parseFrontmatterFields(rawFrontmatter);
  const body = raw.slice(frontmatterMatch[0].length).trim();
  if (!body) {
    throw new Error(`Resolved traceable agent artifact is missing a behavior-bearing body: ${sourceLabel}`);
  }

  return { rawFrontmatter, fields, body };
}

function inferModelSelectorFromDeclaration(modelDeclaration: string | undefined): TraceableModelSelector | undefined {
  if (!modelDeclaration) {
    return undefined;
  }
  const normalized = normalizeHumanModelLabel(modelDeclaration);
  const selector = SUPPORTED_AGENT_MODEL_DECLARATIONS.get(normalized);
  if (!selector) {
    return undefined;
  }
  return { ...selector };
}

async function resolveExplicitAgentArtifactPath(filePath: string): Promise<string | undefined> {
  const normalized = normalizeArtifactPath(filePath);
  const absoluteCandidates = path.isAbsolute(filePath)
    ? [filePath]
    : (vscode.workspace.workspaceFolders ?? []).map((folder) => path.join(folder.uri.fsPath, normalized));

  const resolvedCandidates: string[] = [];

  for (const candidate of absoluteCandidates) {
    try {
      await fs.access(candidate);
      resolvedCandidates.push(candidate);
    } catch {
      // Try the next candidate.
    }
  }

  if (resolvedCandidates.length > 1) {
    throw new Error(`Traceable agent role filePath ${JSON.stringify(filePath)} resolved to multiple workspace artifacts. Use an absolute path or a more specific workspace-relative path. matches=${summarizeJson(resolvedCandidates, 320)}`);
  }

  if (resolvedCandidates[0]) {
    return resolvedCandidates[0];
  }

  return undefined;
}

async function resolveAgentArtifactPathByName(roleName: string): Promise<string | undefined> {
  const stemCandidates = buildAgentArtifactStemCandidates(roleName);
  const directMatches: string[] = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    for (const stem of stemCandidates) {
      const candidate = path.join(folder.uri.fsPath, ".github", "agents", `${stem}.agent.md`);
      try {
        await fs.access(candidate);
        if (!directMatches.includes(candidate)) {
          directMatches.push(candidate);
        }
      } catch {
        // Keep searching.
      }
    }
  }

  if (directMatches.length > 1) {
    throw new Error(`Traceable agent role ${JSON.stringify(roleName)} matched multiple direct workspace agent artifacts. Use agentRole.filePath or a more specific role name. matches=${summarizeJson(directMatches, 320)}`);
  }

  if (directMatches[0]) {
    return directMatches[0];
  }

  const namedMatches: string[] = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const agentDir = path.join(folder.uri.fsPath, ".github", "agents");
    let entries: string[];
    try {
      entries = await fs.readdir(agentDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".agent.md")) {
        continue;
      }
      const candidate = path.join(agentDir, entry);
      let raw: string;
      try {
        raw = await fs.readFile(candidate, "utf8");
      } catch {
        continue;
      }
      let resolvedName: string | undefined;
      try {
        const parsed = extractAgentFrontmatter(raw, candidate);
        resolvedName = parseFrontmatterScalar(parsed.fields.get("name"));
      } catch {
        continue;
      }
      if (resolvedName === roleName.trim()) {
        if (!namedMatches.includes(candidate)) {
          namedMatches.push(candidate);
        }
      }
    }
  }

  if (namedMatches.length > 1) {
    throw new Error(`Traceable agent role ${JSON.stringify(roleName)} matched multiple agent artifacts by frontmatter name. Use agentRole.filePath or a more specific role name. matches=${summarizeJson(namedMatches, 320)}`);
  }

  if (namedMatches[0]) {
    return namedMatches[0];
  }

  return undefined;
}

async function resolveTraceableAgentArtifact(agentRole: TraceableAgentRole | undefined): Promise<ResolvedTraceableAgentArtifact | undefined> {
  const normalizedRole = normalizeAgentRole(agentRole);
  if (!normalizedRole) {
    return undefined;
  }

  const explicitPath = normalizedRole.filePath
    ? await resolveExplicitAgentArtifactPath(normalizedRole.filePath)
    : undefined;
  const resolvedPath = explicitPath ?? await resolveAgentArtifactPathByName(normalizedRole.name);
  if (!resolvedPath) {
    throw new Error(`Traceable agent role ${JSON.stringify(normalizedRole.name)} could not be resolved to a workspace .agent.md artifact.`);
  }

  if (!isRuntimeAgentArtifactPath(resolvedPath)) {
    throw new Error(`Resolved traceable agent artifact is not a supported runtime-agent path: ${resolvedPath}`);
  }

  const raw = await fs.readFile(resolvedPath, "utf8");
  const parsed = extractAgentFrontmatter(raw, resolvedPath);
  const rawFrontmatter = parsed.rawFrontmatter;
  const body = parsed.body;
  const frontmatterFields = parsed.fields;
  const resolvedName = parseFrontmatterScalar(frontmatterFields.get("name")) || normalizedRole.name;
  const description = parseFrontmatterScalar(frontmatterFields.get("description"));
  if (!description) {
    throw new Error(`Resolved traceable agent artifact is missing a description field: ${resolvedPath}`);
  }
  const modelDeclaration = parseFrontmatterScalar(frontmatterFields.get("model"));

  return {
    requestedName: normalizedRole.name,
    resolvedName,
    filePath: resolvedPath,
    rawFrontmatter,
    body,
    modelDeclaration,
    modelSelector: inferModelSelectorFromDeclaration(modelDeclaration),
    toolDeclarations: parseFrontmatterStringList(frontmatterFields.get("tools")),
    disableModelInvocation: parseFrontmatterBoolean(frontmatterFields.get("disable-model-invocation"))
  };
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

async function appendTraceableSubagentDebugEvent(logPath: string | undefined, entry: Record<string, unknown>): Promise<void> {
  if (!logPath) {
    return;
  }
  try {
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
  } catch {
    // Debug logging must not change traceable subagent behavior.
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
  const normalizedModelSelector = normalizeModelSelector(input.modelSelector);
  const normalizedAgentRole = normalizeAgentRole(input.agentRole);
  const request: Record<string, unknown> = {
    userInput: input.userInput,
    parentTask: input.parentTask,
    wrapperPolicy,
    budgetPolicy
  };

  if (normalizedAgentRole) {
    request.agentRole = normalizedAgentRole;
  }

  if (input.parentExpectations) {
    request.parentExpectations = input.parentExpectations;
  }
  if (input.carriedContext) {
    request.carriedContext = input.carriedContext;
  }
  if (normalizedModelSelector.vendor || normalizedModelSelector.family || normalizedModelSelector.id || normalizedModelSelector.version) {
    request.modelSelector = normalizedModelSelector;
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
  selectedToolNames: string[],
  resolvedAgentArtifact?: ResolvedTraceableAgentArtifact
): { requestEnvelope: Record<string, unknown>; promptTexts: string[] } {
  const requestEnvelope = buildTraceableSubagentRequestEnvelope(input);
  const wrapperPolicy = normalizedWrapperPolicy(input);
  const promptTexts = [
    ...(resolvedAgentArtifact
      ? [
        `Resolved agent role artifact metadata:\n${JSON.stringify({
          requestedName: resolvedAgentArtifact.requestedName,
          resolvedName: resolvedAgentArtifact.resolvedName,
          filePath: resolvedAgentArtifact.filePath,
          model: resolvedAgentArtifact.modelDeclaration,
          disableModelInvocation: resolvedAgentArtifact.disableModelInvocation,
          toolDeclarations: resolvedAgentArtifact.toolDeclarations
        }, null, 2)}`,
        `Resolved agent role frontmatter:\n---\n${resolvedAgentArtifact.rawFrontmatter}\n---`,
        `Resolved agent role body:\n${resolvedAgentArtifact.body}`
      ]
      : []),
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
  selectedToolNames: string[],
  resolvedAgentArtifact?: ResolvedTraceableAgentArtifact
): vscode.LanguageModelChatMessage[] {
  const promptSections = buildTraceableSubagentPromptSections(input, selectedToolNames, resolvedAgentArtifact);
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

function summarizeModelCandidates(models: readonly vscode.LanguageModelChat[]): string {
  if (models.length === 0) {
    return "[]";
  }
  return summarizeJson(models.map((model) => ({
    vendor: model.vendor,
    family: model.family,
    id: model.id,
    version: model.version
  })), 480);
}

export function buildTraceableSubagentModelSelectors(input: Pick<TraceableSubagentInput, "modelSelector">): vscode.LanguageModelChatSelector[] {
  const normalizedSelector = normalizeModelSelector(input.modelSelector);
  if (hasExactModelSelector(normalizedSelector)) {
    return [normalizedSelector];
  }
  return [];
}

function buildTraceableSubagentModelSelectorsFromSources(
  input: Pick<TraceableSubagentInput, "modelSelector">,
  resolvedAgentArtifact?: ResolvedTraceableAgentArtifact
): vscode.LanguageModelChatSelector[] {
  if (hasExactModelSelector(resolvedAgentArtifact?.modelSelector)) {
    return [resolvedAgentArtifact.modelSelector];
  }
  return buildTraceableSubagentModelSelectors(input);
}

export function selectTraceableSubagentTools<T extends ToolLike>(availableTools: readonly T[], input: TraceableToolSelectionInput): T[] {
  const blocked = new Set([...DEFAULT_BLOCKED_TOOL_NAMES, ...uniqueStrings(input.blockedToolNames)].map(normalizeToolReferenceKey));
  const explicitAllowed = uniqueStrings(input.allowedToolNames);
  const inheritedAllowed = explicitAllowed.length === 0 ? uniqueStrings(input.defaultAllowedToolNames) : [];
  const allowed = explicitAllowed.length > 0 ? explicitAllowed : inheritedAllowed;
  const filtered = availableTools.filter((tool) => !blocked.has(normalizeToolReferenceKey(tool.name)));
  if (allowed.length === 0) {
    return [...filtered];
  }
  const allowedSet = new Set(allowed.map(normalizeToolReferenceKey));
  return filtered.filter((tool) => allowedSet.has(normalizeToolReferenceKey(tool.name)));
}

export async function runTraceableSubagent(
  input: TraceableSubagentInput,
  options: {
    accessInformation?: vscode.LanguageModelAccessInformation;
    debugLogDir?: string;
    token?: vscode.CancellationToken;
  } = {}
): Promise<TraceableSubagentRunResult> {
  const debugLogPath = options.debugLogDir ? path.join(options.debugLogDir, "traceable-subagent-debug.jsonl") : undefined;
  const finalizeResult = async (
    result: TraceableSubagentRunResult,
    phase: string,
    extra: Record<string, unknown> = {}
  ): Promise<TraceableSubagentRunResult> => {
    const resultWithDebugPath = {
      ...result,
      debugLogPath
    };
    await appendTraceableSubagentDebugEvent(debugLogPath, {
      phase,
      stopReason: result.stopReason,
      completionClaim: result.completionClaim,
      traceStatus: result.traceStatus,
      observedModel: result.model,
      allowedToolCount: result.allowedToolNames.length,
      runtimeToolCallCount: result.toolCalls.length,
      ...extra
    });
    return resultWithDebugPath;
  };

  let resolvedAgentArtifact: ResolvedTraceableAgentArtifact | undefined;
  if (input.agentRole) {
    try {
      resolvedAgentArtifact = await resolveTraceableAgentArtifact(input.agentRole);
    } catch (error) {
      return finalizeResult(fallbackResult(
        input,
        [],
        error instanceof Error ? error.message : String(error),
        "tool_blocked",
        "unresolved",
        {
          allowedToolNames: uniqueStrings(input.allowedToolNames)
        }
      ), "agent_role_unresolved", {
        agentRole: input.agentRole
      });
    }
  }

  const availableToolNames = vscode.lm.tools.map((tool) => tool.name);
  const requestedAllowedToolNames = uniqueStrings(input.allowedToolNames);
  const inheritedAllowedToolNames = resolvedAgentArtifact?.toolDeclarations ?? [];
  const selectedTools = selectTraceableSubagentTools(vscode.lm.tools, {
    allowedToolNames: requestedAllowedToolNames,
    blockedToolNames: input.blockedToolNames,
    defaultAllowedToolNames: inheritedAllowedToolNames
  });
  const selectedToolNames = selectedTools.map((tool) => tool.name);

  await appendTraceableSubagentDebugEvent(debugLogPath, {
    phase: "tool_surface_snapshot",
    availableToolCount: availableToolNames.length,
    availableToolNames,
    requestedAllowedToolNames,
    requestedBlockedToolNames: uniqueStrings(input.blockedToolNames),
    inheritedAllowedToolNames,
    selectedToolCount: selectedToolNames.length,
    selectedToolNames
  });

  if (resolvedAgentArtifact?.disableModelInvocation) {
    return finalizeResult(fallbackResult(
      input,
      [],
      `Resolved traceable agent artifact disables model invocation: ${resolvedAgentArtifact.filePath}`,
      "policy_stop",
      "unresolved",
      {
        allowedToolNames: selectedToolNames
      }
    ), "policy_stop", {
      resolvedAgentArtifact: {
        name: resolvedAgentArtifact.resolvedName,
        filePath: resolvedAgentArtifact.filePath,
        modelDeclaration: resolvedAgentArtifact.modelDeclaration
      }
    });
  }

  const selectors = buildTraceableSubagentModelSelectorsFromSources(input, resolvedAgentArtifact);

  const budgetPolicy = normalizeBudgetPolicy(input);
  const toolCalls: TraceableSubagentToolCallRecord[] = [];
  const opaqueDelegations: TraceableOpaqueDelegation[] = [];
  let availableModels: vscode.LanguageModelChat[] = [];
  let sendableModels: vscode.LanguageModelChat[] = [];
  let matchedSelector: vscode.LanguageModelChatSelector | undefined;

  if (selectors.length === 0) {
    return finalizeResult(fallbackResult(
      input,
      toolCalls,
      resolvedAgentArtifact?.modelDeclaration
        ? `Resolved traceable agent artifact ${JSON.stringify(resolvedAgentArtifact.resolvedName)} declared model ${JSON.stringify(resolvedAgentArtifact.modelDeclaration)}, but the runtime could not translate it into an exact model selector safely.`
        : "Traceable subagent model selection is not configured safely. Provide modelSelector.id explicitly. The runtime refuses implicit auto-selection to avoid hidden model-cost drift, and the current LM tool invocation API does not expose the parent chat model to this tool.",
      "tool_blocked",
      "unresolved",
      {
        allowedToolNames: selectedToolNames
      }
    ), "model_selector_unavailable", {
      resolvedAgentArtifact: resolvedAgentArtifact ? {
        name: resolvedAgentArtifact.resolvedName,
        filePath: resolvedAgentArtifact.filePath,
        modelDeclaration: resolvedAgentArtifact.modelDeclaration
      } : undefined,
      selectorAttempts: selectors
    });
  }

  if (selectedToolNames.length === 0 && (requestedAllowedToolNames.length > 0 || inheritedAllowedToolNames.length > 0)) {
    return finalizeResult(fallbackResult(
      input,
      [],
      `Traceable subagent tool selection resolved no runnable tools from the requested surface. requestedAllowed=${summarizeJson(requestedAllowedToolNames, 220)}; inheritedAllowed=${summarizeJson(inheritedAllowedToolNames, 220)}; available=${summarizeJson(availableToolNames, 260)}`,
      "tool_blocked",
      "unresolved",
      {
        allowedToolNames: selectedToolNames
      }
    ), "tool_surface_unavailable", {
      requestedAllowedToolNames,
      inheritedAllowedToolNames,
      availableToolNames,
      selectorAttempts: selectors
    });
  }

  let model: vscode.LanguageModelChat | undefined;
  try {
    for (const selector of selectors) {
      const availableForSelector = await vscode.lm.selectChatModels(selector);
      const sendableForSelector = options.accessInformation
        ? availableForSelector.filter((candidate) => options.accessInformation?.canSendRequest(candidate))
        : availableForSelector;
      if (!model && sendableForSelector[0]) {
        availableModels = availableForSelector;
        sendableModels = sendableForSelector;
        matchedSelector = selector;
        model = sendableForSelector[0];
        break;
      }
      if (availableForSelector.length > 0 || sendableForSelector.length > 0 || selector === selectors[selectors.length - 1]) {
        availableModels = availableForSelector;
        sendableModels = sendableForSelector;
        matchedSelector = selector;
      }
    }
  } catch (error) {
    return finalizeResult(fallbackResult(
      input,
      toolCalls,
      error instanceof Error ? error.message : String(error),
      "tool_blocked",
      "unresolved",
      {
        allowedToolNames: selectedToolNames
      }
    ), "model_selection_failed", {
      selectorAttempts: selectors,
      resolvedAgentArtifact: resolvedAgentArtifact ? {
        name: resolvedAgentArtifact.resolvedName,
        filePath: resolvedAgentArtifact.filePath,
        modelDeclaration: resolvedAgentArtifact.modelDeclaration
      } : undefined
    });
  }

  if (!model) {
    const selectorSummary = summarizeJson(matchedSelector ?? selectors[selectors.length - 1] ?? {}, 180);
    const selectorAttempts = summarizeJson(selectors, 260);
    const availableSummary = summarizeModelCandidates(availableModels);
    const sendableSummary = summarizeModelCandidates(sendableModels);
    const accessMode = options.accessInformation ? "access-filtered" : "unfiltered";
    return finalizeResult(fallbackResult(
      input,
      toolCalls,
      `No accessible language model matched the requested traceable-subagent selector. selector=${selectorSummary}; selectorAttempts=${selectorAttempts}; mode=${accessMode}; available=${availableModels.length}; sendable=${sendableModels.length}; availableCandidates=${availableSummary}; sendableCandidates=${sendableSummary}`,
      "tool_blocked",
      "unresolved",
      {
        allowedToolNames: selectedToolNames
      }
    ), "model_unavailable", {
      selectorAttempts: selectors,
      matchedSelector,
      availableCandidateCount: availableModels.length,
      sendableCandidateCount: sendableModels.length
    });
  }

  const modelInfo = {
    vendor: model.vendor,
    family: model.family,
    id: model.id,
    version: model.version
  };

  const messages = buildTraceableSubagentMessages(input, selectedToolNames, resolvedAgentArtifact);
  let lastRawModelText = "";

  await appendTraceableSubagentDebugEvent(debugLogPath, {
    phase: "model_selected",
    requestAgentRole: input.agentRole,
    resolvedAgentArtifact: resolvedAgentArtifact ? {
      requestedName: resolvedAgentArtifact.requestedName,
      resolvedName: resolvedAgentArtifact.resolvedName,
      filePath: resolvedAgentArtifact.filePath,
      modelDeclaration: resolvedAgentArtifact.modelDeclaration,
      modelSelector: resolvedAgentArtifact.modelSelector
    } : undefined,
    selectorAttempts: selectors,
    matchedSelector,
    selectedModel: modelInfo,
    allowedToolCount: selectedToolNames.length,
    allowedToolNames: selectedToolNames
  });

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
      return finalizeResult(fallbackResult(
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
      ), "send_request_failed", {
        matchedSelector,
        selectedModel: modelInfo,
        resolvedAgentArtifact: resolvedAgentArtifact ? {
          resolvedName: resolvedAgentArtifact.resolvedName,
          modelDeclaration: resolvedAgentArtifact.modelDeclaration
        } : undefined
      });
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
      return finalizeResult(fallbackResult(
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
      ), "response_stream_failed", {
        matchedSelector,
        selectedModel: modelInfo
      });
    }

    lastRawModelText = textBuffer.trim();
    if (toolCallParts.length === 0) {
      const parsedPayload = extractTraceableSubagentPayload(lastRawModelText);
      if (!parsedPayload) {
        return finalizeResult(fallbackResult(
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
        ), "child_payload_unparseable", {
          matchedSelector,
          selectedModel: modelInfo
        });
      }

      const allOpaqueDelegations = [...opaqueDelegations, ...(parsedPayload.opaqueDelegations ?? [])];
      return finalizeResult({
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
      }, "completed", {
        matchedSelector,
        selectedModel: modelInfo,
        resolvedAgentArtifact: resolvedAgentArtifact ? {
          resolvedName: resolvedAgentArtifact.resolvedName,
          filePath: resolvedAgentArtifact.filePath,
          modelDeclaration: resolvedAgentArtifact.modelDeclaration
        } : undefined
      });
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

  return finalizeResult(fallbackResult(
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
  ), "budget_exhausted", {
    matchedSelector,
    selectedModel: modelInfo,
    resolvedAgentArtifact: resolvedAgentArtifact ? {
      resolvedName: resolvedAgentArtifact.resolvedName,
      modelDeclaration: resolvedAgentArtifact.modelDeclaration
    } : undefined
  });
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
    `- Debug Log: ${result.debugLogPath ?? "-"}`,
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