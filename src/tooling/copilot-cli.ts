import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  renderCopilotCliLatestTurnLines,
  summarizeCopilotCliEventStream,
  type CopilotCliLatestTurnSummary
} from "../chatInterop/copilotCliSummary.js";

const DEFAULT_COPILOT_CLI_SESSION_STATE_ROOT = path.join(os.homedir(), ".copilot", "session-state");

export function getDefaultCopilotCliSessionStateRoot(): string {
  return DEFAULT_COPILOT_CLI_SESSION_STATE_ROOT;
}

export function describeCopilotCliSessionStateRoot(sessionStateRoot?: string): string {
  const resolved = resolveSessionStateRoot(sessionStateRoot);
  return sessionStateRoot
    ? resolved
    : `${resolved} (host default; Windows and macOS should still be verified directly)`;
}

export function renderMissingCopilotCliSessionStateMessage(sessionStateRoot?: string): string {
  return `No Copilot CLI session-state directory was found under ${describeCopilotCliSessionStateRoot(sessionStateRoot)}.`;
}

export function renderMissingCopilotCliSessionsMessage(sessionStateRoot?: string): string {
  return `No Copilot CLI session-state directories with events.jsonl were found under ${describeCopilotCliSessionStateRoot(sessionStateRoot)}.`;
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

export interface CopilotCliSessionInspection extends CopilotCliSessionDescriptor {
  latestTurn?: CopilotCliLatestTurnSummary;
}

export interface CopilotCliSessionSelection {
  sessionStateRoot?: string;
  sessionId?: string;
  latest?: boolean;
}

export async function listCopilotCliSessions(options: { sessionStateRoot?: string; limit?: number } = {}): Promise<CopilotCliSessionDescriptor[]> {
  const sessionStateRoot = resolveSessionStateRoot(options.sessionStateRoot);
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
  return typeof options.limit === "number" ? sorted.slice(0, options.limit) : sorted;
}

export async function inspectCopilotCliSession(selection: CopilotCliSessionSelection = {}): Promise<CopilotCliSessionInspection | undefined> {
  const session = await resolveCopilotCliSession(selection);
  if (!session) {
    return undefined;
  }
  let latestTurn: CopilotCliLatestTurnSummary | undefined;
  try {
    const raw = await fs.readFile(session.eventsPath, "utf-8");
    latestTurn = summarizeCopilotCliEventStream(raw);
  } catch {
    latestTurn = undefined;
  }
  return {
    ...session,
    latestTurn
  };
}

export function renderCopilotCliSessionListText(
  sessions: CopilotCliSessionDescriptor[],
  limit = 10,
  options: { maxChars?: number; sessionStateRoot?: string } = {}
): string {
  const lines = [
    "# Copilot CLI Sessions",
    "",
    `- Session-state root: ${describeCopilotCliSessionStateRoot(options.sessionStateRoot)}`,
    `- Sessions listed: ${Math.min(limit, sessions.length)}`,
    ""
  ];

  for (const session of sessions.slice(0, limit)) {
    lines.push(
      `- ${session.summary?.trim() || session.cwd?.trim() || session.sessionId}`,
      `  id=${session.sessionId}`,
      `  updated=${session.updatedAt ?? new Date(session.mtime).toISOString()}`,
      `  cwd=${session.cwd ?? "-"}`,
      `  resource=${session.canonicalResource}`,
      `  events=${session.eventsPath}`
    );
  }

  return clampRenderedOutput(`${lines.join("\n")}\n`, options.maxChars);
}

export function renderCopilotCliSessionInspectionMarkdown(
  session: CopilotCliSessionInspection,
  options: { maxChars?: number; sessionStateRoot?: string } = {}
): string {
  const lines = [
    "# Copilot CLI Session",
    "",
    `- Session-state root: ${describeCopilotCliSessionStateRoot(options.sessionStateRoot)}`,
    `- Session ID: ${session.sessionId}`,
    `- Session dir: ${session.sessionDir}`,
    `- Events file: ${session.eventsPath}`,
    `- Workspace YAML: ${session.workspaceYamlPath ?? "-"}`,
    `- Workspace YAML summary: ${session.summary ?? "-"}`,
    `- Workspace YAML cwd: ${session.cwd ?? "-"}`,
    `- Workspace YAML updated at: ${session.updatedAt ?? "-"}`,
    `- Canonical resource: ${session.canonicalResource}`,
    "- Note: Copilot CLI session-state is separate from ordinary Local chat persistence under workspaceStorage.",
    session.latestTurn
      ? "- Note: workspace.yaml metadata can describe an older session intent; trust the Latest Turn section for the newest persisted outcome."
      : undefined,
    "",
    "## Latest Turn",
    ...renderCopilotCliLatestTurnLines(session.latestTurn),
    "",
    "## Candidate Resources",
    `- ${session.canonicalResource}`
  ].filter((line): line is string => Boolean(line));

  return clampRenderedOutput(`${lines.join("\n")}\n`, options.maxChars);
}

function resolveSessionStateRoot(sessionStateRoot?: string): string {
  return sessionStateRoot ? path.resolve(sessionStateRoot) : DEFAULT_COPILOT_CLI_SESSION_STATE_ROOT;
}

async function resolveCopilotCliSession(selection: CopilotCliSessionSelection): Promise<CopilotCliSessionDescriptor | undefined> {
  const sessions = await listCopilotCliSessions({ sessionStateRoot: selection.sessionStateRoot });
  if (sessions.length === 0) {
    return undefined;
  }
  const sessionId = selection.sessionId?.trim();
  if (!sessionId) {
    return sessions[0];
  }
  const matches = sessions.filter((session) => session.sessionId === sessionId || session.sessionId.startsWith(sessionId));
  if (matches.length === 0) {
    throw new Error(`No Copilot CLI session matched: ${sessionId}`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous Copilot CLI session id ${sessionId}; matches: ${matches.map((session) => session.sessionId).join(", ")}`);
  }
  return matches[0];
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

function clampRenderedOutput(content: string, maxChars = 12_000): string {
  if (!Number.isFinite(maxChars) || maxChars <= 0 || content.length <= maxChars) {
    return content;
  }
  const budget = Math.max(1_000, maxChars);
  const truncated = content.slice(0, Math.max(0, budget - 80)).trimEnd();
  return `${truncated}\n\n## Safety Limit\n- Output truncated to stay within the ${budget}-character safety budget.\n`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}