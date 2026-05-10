import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as vscode from "vscode";
import {
  describeCopilotCliSessionStateRoot,
  renderMissingCopilotCliSessionStateMessage
} from "../tools/copilot-cli";
import {
  renderCopilotCliLatestTurnLines,
  summarizeCopilotCliEventStream,
  type CopilotCliLatestTurnSummary
} from "./copilotCliSummary";

const COPILOT_CLI_OPEN_WITH_PROMPT_COMMAND = "workbench.action.chat.openSessionWithPrompt.copilotcli";
const COPILOT_CLI_PROBE_DIRNAME = ".agent-architect-probes";
const COPILOT_CLI_PROBE_MANIFEST_FILENAME = "copilot-cli-capability-probes.json";
const COPILOT_CLI_READ_CANARY_FILENAME = "copilot-cli-read-canary.txt";
const COPILOT_CLI_MUTATION_TARGET_FILENAME = "copilot-cli-mutation-target.txt";
const COPILOT_CLI_TOOL_APPROVAL_TARGET_FILENAME = "copilot-cli-tool-approval-target.txt";

export interface LatestCopilotCliSessionSnapshot {
  sessionId: string;
  sessionDir: string;
  eventsPath: string;
  workspaceYamlPath?: string;
  summary?: string;
  cwd?: string;
  updatedAt?: string;
  canonicalResource: string;
  latestLoggedResource?: string;
  candidateResources: string[];
}

export interface CopilotCliSessionDescriptor {
  sessionId: string;
  sessionDir: string;
  eventsPath: string;
  workspaceYamlPath?: string;
  summary?: string;
  cwd?: string;
  updatedAt?: string;
  canonicalResource: string;
  mtime: number;
  size: number;
}

export interface CopilotCliSessionInspection extends LatestCopilotCliSessionSnapshot {
  latestTurn?: CopilotCliLatestTurnSummary;
}

export interface CopilotCliCapabilityProbePack {
  preparedAt: string;
  workspaceRoot: string;
  probeDir: string;
  manifestPath: string;
  readCanaryPath: string;
  readCanaryToken: string;
  mutationTargetPath: string;
  mutationTargetToken: string;
  toolApprovalTargetPath: string;
  toolApprovalToken: string;
}

export async function inspectLatestCopilotCliSession(): Promise<LatestCopilotCliSessionSnapshot | undefined> {
  const latestSession = await findLatestSessionState();
  if (!latestSession) {
    return undefined;
  }

  const metadata = await readWorkspaceYaml(latestSession.sessionDir);
  const latestLoggedResource = await findLatestLoggedCopilotCliResource();
  const canonicalResource = `copilotcli:/${latestSession.sessionId}`;
  const candidateResources = uniqueStrings([
    canonicalResource,
    latestLoggedResource
  ]);

  return {
    sessionId: latestSession.sessionId,
    sessionDir: latestSession.sessionDir,
    eventsPath: latestSession.eventsPath,
    workspaceYamlPath: latestSession.workspaceYamlPath,
    summary: metadata.summary,
    cwd: metadata.cwd,
    updatedAt: metadata.updatedAt,
    canonicalResource,
    latestLoggedResource,
    candidateResources
  };
}

export async function listCopilotCliSessions(limit?: number): Promise<CopilotCliSessionDescriptor[]> {
  const sessionStateRoot = path.join(os.homedir(), ".copilot", "session-state");
  let entries;
  try {
    entries = await fs.readdir(sessionStateRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const sessions = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const sessionDir = path.join(sessionStateRoot, entry.name);
    const eventsPath = path.join(sessionDir, "events.jsonl");
    const workspaceYamlPath = path.join(sessionDir, "workspace.yaml");
    try {
      const stat = await fs.stat(eventsPath);
      if (!stat.isFile()) {
        return undefined;
      }
      const metadata = await readWorkspaceYaml(sessionDir);
      return {
        sessionId: entry.name,
        sessionDir,
        eventsPath,
        workspaceYamlPath: await fileExists(workspaceYamlPath) ? workspaceYamlPath : undefined,
        summary: metadata.summary,
        cwd: metadata.cwd,
        updatedAt: metadata.updatedAt,
        canonicalResource: `copilotcli:/${entry.name}`,
        mtime: stat.mtimeMs,
        size: stat.size
      } satisfies CopilotCliSessionDescriptor;
    } catch {
      return undefined;
    }
  }));

  const sorted = sessions
    .flatMap((session) => session ? [session] : [])
    .sort((a, b) => b.mtime - a.mtime);
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

export async function inspectCopilotCliSession(
  session: LatestCopilotCliSessionSnapshot | CopilotCliSessionDescriptor
): Promise<CopilotCliSessionInspection> {
  const candidateResources = "candidateResources" in session ? session.candidateResources : [session.canonicalResource];
  const latestLoggedResource = "latestLoggedResource" in session ? session.latestLoggedResource : undefined;
  let latestTurn: CopilotCliLatestTurnSummary | undefined;

  try {
    const raw = await fs.readFile(session.eventsPath, "utf-8");
    latestTurn = summarizeCopilotCliEventStream(raw);
  } catch {
    latestTurn = undefined;
  }

  return {
    sessionId: session.sessionId,
    sessionDir: session.sessionDir,
    eventsPath: session.eventsPath,
    workspaceYamlPath: session.workspaceYamlPath,
    summary: session.summary,
    cwd: session.cwd,
    updatedAt: session.updatedAt,
    canonicalResource: session.canonicalResource,
    latestLoggedResource,
    candidateResources,
    latestTurn
  };
}

export function renderCopilotCliSessionMarkdown(
  session: LatestCopilotCliSessionSnapshot | CopilotCliSessionDescriptor | CopilotCliSessionInspection
): string {
  const candidateResources = "candidateResources" in session ? session.candidateResources : [session.canonicalResource];
  const latestLoggedResource = "latestLoggedResource" in session ? session.latestLoggedResource : undefined;
  const latestTurn = "latestTurn" in session ? session.latestTurn : undefined;
  return [
    "# Copilot CLI Session",
    "",
    `- Session ID: ${session.sessionId}`,
    `- Session dir: ${session.sessionDir}`,
    `- Events file: ${session.eventsPath}`,
    `- Workspace YAML: ${session.workspaceYamlPath ?? "-"}`,
    `- Workspace YAML summary: ${session.summary ?? "-"}`,
    `- Workspace YAML cwd: ${session.cwd ?? "-"}`,
    `- Workspace YAML updated at: ${session.updatedAt ?? "-"}`,
    `- Canonical resource: ${session.canonicalResource}`,
    latestLoggedResource ? `- Latest logged resource: ${latestLoggedResource}` : undefined,
    `- Note: Copilot CLI session-state is separate from ordinary Local chat persistence under workspaceStorage and currently resolves to ${describeCopilotCliSessionStateRoot()} on this host.`,
    latestLoggedResource
      ? "- Note: the latest logged resource can come from another VS Code window than the current Extension Development Host."
      : undefined,
    latestTurn
      ? "- Note: workspace.yaml metadata can describe an older session intent; trust the Latest Turn section for the newest persisted outcome."
      : undefined,
    "",
    "## Latest Turn",
    ...renderCopilotCliLatestTurnLines(latestTurn),
    "",
    "## Candidate Resources",
    ...candidateResources.map((resource) => `- ${resource}`)
  ].filter((line): line is string => Boolean(line)).join("\n");
}

export async function probeLatestCopilotCliSession(prompt: string): Promise<{ usedResource: string; snapshot: LatestCopilotCliSessionSnapshot }> {
  const snapshot = await inspectLatestCopilotCliSession();
  if (!snapshot) {
    throw new Error(renderMissingCopilotCliSessionStateMessage());
  }

  const commands = new Set(await vscode.commands.getCommands(true));
  if (!commands.has(COPILOT_CLI_OPEN_WITH_PROMPT_COMMAND)) {
    throw new Error(`Required command is unavailable: ${COPILOT_CLI_OPEN_WITH_PROMPT_COMMAND}`);
  }

  const failures: string[] = [];
  for (const resource of snapshot.candidateResources) {
    try {
      await vscode.commands.executeCommand(COPILOT_CLI_OPEN_WITH_PROMPT_COMMAND, {
        resource: vscode.Uri.parse(resource),
        prompt,
        attachedContext: []
      });
      return { usedResource: resource, snapshot };
    } catch (error) {
      failures.push(`${resource}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`No Copilot CLI resource candidate succeeded.\n${failures.join("\n")}`);
}

export async function sendPromptToCopilotCliResource(resource: string, prompt: string): Promise<void> {
  const commands = new Set(await vscode.commands.getCommands(true));
  if (!commands.has(COPILOT_CLI_OPEN_WITH_PROMPT_COMMAND)) {
    throw new Error(`Required command is unavailable: ${COPILOT_CLI_OPEN_WITH_PROMPT_COMMAND}`);
  }
  await vscode.commands.executeCommand(COPILOT_CLI_OPEN_WITH_PROMPT_COMMAND, {
    resource: vscode.Uri.parse(resource),
    prompt,
    attachedContext: []
  });
}

export async function prepareCopilotCliCapabilityProbePack(workspaceRoot: string): Promise<CopilotCliCapabilityProbePack> {
  const probeDir = path.join(workspaceRoot, COPILOT_CLI_PROBE_DIRNAME);
  const manifestPath = path.join(probeDir, COPILOT_CLI_PROBE_MANIFEST_FILENAME);
  const readCanaryPath = path.join(probeDir, COPILOT_CLI_READ_CANARY_FILENAME);
  const mutationTargetPath = path.join(probeDir, COPILOT_CLI_MUTATION_TARGET_FILENAME);
  const toolApprovalTargetPath = path.join(probeDir, COPILOT_CLI_TOOL_APPROVAL_TARGET_FILENAME);
  const preparedAt = new Date().toISOString();
  const probePack: CopilotCliCapabilityProbePack = {
    preparedAt,
    workspaceRoot,
    probeDir,
    manifestPath,
    readCanaryPath,
    readCanaryToken: `read-${randomUUID()}`,
    mutationTargetPath,
    mutationTargetToken: `mutation-${randomUUID()}`,
    toolApprovalTargetPath,
    toolApprovalToken: `approval-${randomUUID()}`
  };

  await fs.mkdir(probeDir, { recursive: true });
  await Promise.all([
    fs.writeFile(readCanaryPath, [
      "probe_kind: copilot-cli-read-access",
      `prepared_at: ${preparedAt}`,
      `read_token: ${probePack.readCanaryToken}`
    ].join("\n") + "\n", "utf-8"),
    fs.writeFile(mutationTargetPath, [
      "probe_kind: copilot-cli-workspace-mutation",
      `prepared_at: ${preparedAt}`,
      "status: pending"
    ].join("\n") + "\n", "utf-8"),
    fs.writeFile(toolApprovalTargetPath, [
      "probe_kind: copilot-cli-tool-approval",
      `prepared_at: ${preparedAt}`,
      "status: pending"
    ].join("\n") + "\n", "utf-8")
  ]);
  await fs.writeFile(manifestPath, JSON.stringify(probePack, null, 2) + "\n", "utf-8");
  return probePack;
}

export async function ensureCopilotCliCapabilityProbePack(workspaceRoot: string): Promise<CopilotCliCapabilityProbePack> {
  const manifestPath = path.join(workspaceRoot, COPILOT_CLI_PROBE_DIRNAME, COPILOT_CLI_PROBE_MANIFEST_FILENAME);
  try {
    const raw = await fs.readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (isCapabilityProbePack(parsed) && parsed.workspaceRoot === workspaceRoot) {
      return parsed;
    }
  } catch {
    // prepare a fresh probe pack below
  }
  return prepareCopilotCliCapabilityProbePack(workspaceRoot);
}

export function buildCopilotCliReadAccessProbePrompt(probePack: CopilotCliCapabilityProbePack): string {
  return [
    "Use workspace tools if it is available in this chat mode.",
    `Read the file at: ${probePack.readCanaryPath}`,
    "Find the line that starts with read_token: and return the token value exactly.",
    "Do not guess from memory, filenames, or prior chat context.",
    "If you cannot read workspace files from this chat, respond exactly with:",
    "RESULT: NO_FILE_ACCESS",
    "METHOD: none",
    "Otherwise respond with exactly two lines:",
    "RESULT: <exact token>",
    "METHOD: <how you obtained it in 1-4 words>"
  ].join("\n");
}

export function buildCopilotCliMutationProbePrompt(probePack: CopilotCliCapabilityProbePack): string {
  return [
    "Use workspace tools if it is available in this chat mode.",
    `Create or overwrite the file at: ${probePack.mutationTargetPath}`,
    "Write exactly this single line into the file:",
    `mutation_token: ${probePack.mutationTargetToken}`,
    "Do not modify any other file.",
    "After attempting the write, respond with exactly one line:",
    "MUTATION: WROTE",
    "If file writing is unavailable, respond instead with exactly:",
    "MUTATION: NO_WRITE_ACCESS"
  ].join("\n");
}

export function buildCopilotCliToolApprovalProbePrompt(probePack: CopilotCliCapabilityProbePack): string {
  return [
    "Use a real workspace-writing tool if one is available in this chat mode.",
    `Append exactly this line to the file at ${probePack.toolApprovalTargetPath}:`,
    `approval_token: ${probePack.toolApprovalToken}`,
    "If a tool or approval request is required, request it rather than pretending the write succeeded.",
    "Do not modify any other file.",
    "After the attempt, respond with exactly one line and choose the most accurate status:",
    "APPROVAL: WROTE",
    "APPROVAL: NEEDS_TOOL_APPROVAL",
    "APPROVAL: NO_TOOLS"
  ].join("\n");
}

export function renderCopilotCliCapabilityProbePackMarkdown(probePack: CopilotCliCapabilityProbePack): string {
  return [
    "# Copilot CLI Capability Probes",
    "",
    `- Prepared at: ${probePack.preparedAt}`,
    `- Workspace root: ${probePack.workspaceRoot}`,
    `- Probe dir: ${probePack.probeDir}`,
    `- Read canary file: ${probePack.readCanaryPath}`,
    `- Mutation target file: ${probePack.mutationTargetPath}`,
    `- Tool/approval target file: ${probePack.toolApprovalTargetPath}`,
    "- Note: this report intentionally omits the probe tokens so the read-access probe does not get contaminated by the active editor.",
    "",
    "## Commands",
    "- Tiinex AI Tools: Probe Latest Copilot CLI Read Access",
    "- Tiinex AI Tools: Probe Latest Copilot CLI Workspace Mutation",
    "- Tiinex AI Tools: Probe Latest Copilot CLI Tool Approval",
    "",
    "## What To Observe",
    "- Read access probe: whether the assistant returns the exact token from the canary file, rather than a guess or refusal.",
    "- Workspace mutation probe: whether the target file is actually overwritten with the requested token line.",
    "- Tool approval probe: whether the UI shows any tool or approval signal, and whether the target file is actually appended.",
    "",
    "## Validation Notes",
    "- The read probe is epistemic only if the token stays hidden from the active editor and chat prompt.",
    "- The mutation and tool/approval probes should be validated from on-disk artifacts after the run, not from the assistant's self-report alone."
  ].join("\n");
}

export async function probeLatestCopilotCliReadAccess(workspaceRoot: string): Promise<{ usedResource: string; snapshot: LatestCopilotCliSessionSnapshot; probePack: CopilotCliCapabilityProbePack }> {
  const probePack = await ensureCopilotCliCapabilityProbePack(workspaceRoot);
  const result = await probeLatestCopilotCliSession(buildCopilotCliReadAccessProbePrompt(probePack));
  return { ...result, probePack };
}

export async function probeLatestCopilotCliWorkspaceMutation(workspaceRoot: string): Promise<{ usedResource: string; snapshot: LatestCopilotCliSessionSnapshot; probePack: CopilotCliCapabilityProbePack }> {
  const probePack = await ensureCopilotCliCapabilityProbePack(workspaceRoot);
  const result = await probeLatestCopilotCliSession(buildCopilotCliMutationProbePrompt(probePack));
  return { ...result, probePack };
}

export async function probeLatestCopilotCliToolApproval(workspaceRoot: string): Promise<{ usedResource: string; snapshot: LatestCopilotCliSessionSnapshot; probePack: CopilotCliCapabilityProbePack }> {
  const probePack = await ensureCopilotCliCapabilityProbePack(workspaceRoot);
  const result = await probeLatestCopilotCliSession(buildCopilotCliToolApprovalProbePrompt(probePack));
  return { ...result, probePack };
}

async function findLatestSessionState(): Promise<{
  sessionId: string;
  sessionDir: string;
  eventsPath: string;
  workspaceYamlPath?: string;
} | undefined> {
  const latest = (await listCopilotCliSessions(1))[0];
  if (!latest) {
    return undefined;
  }
  return {
    sessionId: latest.sessionId,
    sessionDir: latest.sessionDir,
    eventsPath: latest.eventsPath,
    workspaceYamlPath: latest.workspaceYamlPath
  };
}

async function readWorkspaceYaml(sessionDir: string): Promise<{ summary?: string; cwd?: string; updatedAt?: string }> {
  const workspaceYamlPath = path.join(sessionDir, "workspace.yaml");
  try {
    const raw = await fs.readFile(workspaceYamlPath, "utf-8");
    return {
      summary: matchYamlScalar(raw, "summary"),
      cwd: matchYamlScalar(raw, "cwd"),
      updatedAt: matchYamlScalar(raw, "updated_at")
    };
  } catch {
    return {};
  }
}

function matchYamlScalar(content: string, key: string): string | undefined {
  const match = content.match(new RegExp(`^${escapeRegex(key)}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() || undefined;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findLatestLoggedCopilotCliResource(): Promise<string | undefined> {
  const logsRoot = path.join(os.homedir(), ".config", "Code", "logs");
  let logRoots;
  try {
    logRoots = await fs.readdir(logsRoot, { withFileTypes: true });
  } catch {
    return undefined;
  }

  const datedRoots = await Promise.all(logRoots.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const fullPath = path.join(logsRoot, entry.name);
    try {
      const stat = await fs.stat(fullPath);
      return { fullPath, mtimeMs: stat.mtimeMs };
    } catch {
      return undefined;
    }
  }));

  for (const root of datedRoots.filter((entry): entry is { fullPath: string; mtimeMs: number } => Boolean(entry)).sort((a, b) => b.mtimeMs - a.mtimeMs)) {
    const resource = await findLatestResourceInLogRoot(root.fullPath);
    if (resource) {
      return resource;
    }
  }
  return undefined;
}

async function findLatestResourceInLogRoot(logRoot: string): Promise<string | undefined> {
  let windows;
  try {
    windows = await fs.readdir(logRoot, { withFileTypes: true });
  } catch {
    return undefined;
  }

  for (const entry of windows) {
    if (!entry.isDirectory() || !entry.name.startsWith("window")) {
      continue;
    }
    const rendererLogPath = path.join(logRoot, entry.name, "renderer.log");
    try {
      const raw = await fs.readFile(rendererLogPath, "utf-8");
      const matches = [...raw.matchAll(/copilotcli:\/[^\s"'),]+/g)];
      const latest = matches.at(-1)?.[0];
      if (latest) {
        return latest.trim();
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function isCapabilityProbePack(value: unknown): value is CopilotCliCapabilityProbePack {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return [
    "preparedAt",
    "workspaceRoot",
    "probeDir",
    "manifestPath",
    "readCanaryPath",
    "readCanaryToken",
    "mutationTargetPath",
    "mutationTargetToken",
    "toolApprovalTargetPath",
    "toolApprovalToken"
  ].every((key) => typeof record[key] === "string");
}