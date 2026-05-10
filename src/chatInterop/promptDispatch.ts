import * as os from "node:os";
import * as path from "node:path";
import type { CreateChatRequest } from "./types";

export interface PromptFileDispatchArtifact {
  filePath: string;
  slashCommand: string;
  content: string;
}

const PROMPT_DISPATCH_PATTERN = /^aa-live-chat-(.+)-\d{14}-[a-z0-9]+(?:\.prompt\.md)?$/i;

export function shouldUsePromptFileDispatch(request: CreateChatRequest): boolean {
  return Boolean(request.agentName?.trim()) && request.partialQuery !== true;
}

export function buildPromptFileDispatchArtifact(
  request: CreateChatRequest,
  promptsDirectory: string,
  uniqueSuffix: string,
  promptAgentName?: string
): PromptFileDispatchArtifact {
  const agentName = normalizeAgentName(request.agentName);
  if (!agentName) {
    throw new Error("agentName is required to build a prompt-file dispatch artifact.");
  }

  const slashCommand = [
    "aa-live-chat",
    slugify(agentName) || "agent",
    slugify(uniqueSuffix) || "dispatch"
  ].join("-");

  return {
    filePath: path.join(promptsDirectory, `${slashCommand}.prompt.md`),
    slashCommand,
    content: buildPromptFileContent(request.prompt, promptAgentName ?? agentName)
  };
}

export function buildPromptFileContent(prompt: string, agentName: string): string {
  const trimmedPrompt = prompt.trim();
  const normalizedAgent = normalizeAgentName(agentName);
  if (!trimmedPrompt) {
    throw new Error("prompt is required to build a prompt file.");
  }
  if (!normalizedAgent) {
    throw new Error("agentName is required to build a prompt file.");
  }

  return [
    "---",
    `agent: ${yamlQuote(normalizedAgent)}`,
    "---",
    "",
    trimmedPrompt,
    ""
  ].join("\n");
}

export function getDefaultUserPromptsDirectory(): string {
  return path.join(getUserDataRoot(), "User", "prompts");
}

export function createPromptDispatchUniqueSuffix(now: Date = new Date()): string {
  const iso = now.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `${iso}-${random}`;
}

export function parsePromptDispatchAgent(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const basename = path.basename(trimmed.replace(/^\/+/, ""));
  const match = PROMPT_DISPATCH_PATTERN.exec(basename);
  return match?.[1];
}

function normalizeAgentName(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/^#+/, "");
  return trimmed ? trimmed : undefined;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function yamlQuote(value: string): string {
  return JSON.stringify(value);
}

function getUserDataRoot(): string {
  if (process.platform === "linux") {
    return path.join(os.homedir(), ".config", "Code");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Code");
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new Error("APPDATA is not set");
    }

    return path.join(appData, "Code");
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}