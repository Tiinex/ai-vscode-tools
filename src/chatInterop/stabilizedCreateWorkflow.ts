import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { sendMessageToSessionWithFallback, type SessionSendWorkflowResult } from "./sessionSendWorkflow";
import type { ChatCommandResult, ChatInteropApi, ChatModelSelector, ChatSessionSummary, CreateChatRequest } from "./types";

export interface StabilizedCreateAndSendResult {
  createResult: ChatCommandResult;
  workflow: SessionSendWorkflowResult;
  seedPrompt: string;
  patchedModeId?: string;
  patchedModelId?: string;
  resolvedModeId?: string;
}

export async function createStabilizedChatAndSend(
  chatInterop: ChatInteropApi,
  request: CreateChatRequest
): Promise<StabilizedCreateAndSendResult> {
  const seedPrompt = buildSeedPrompt();
  const createResult = await chatInterop.createChat({
    prompt: seedPrompt,
    agentName: request.agentName,
    mode: request.mode,
    modelSelector: request.modelSelector,
    partialQuery: false,
    blockOnResponse: true,
    requireSelectionEvidence: false
  });

  if (!createResult.ok || !createResult.session) {
    return {
      createResult,
      workflow: {
        result: createResult,
        usedFallback: false
      },
      seedPrompt
    };
  }

  const resolvedModeId = request.mode?.trim() || await resolveWorkspaceAgentModeUri(request.agentName);
  const patchedModeId = shouldPatchCustomMode(resolvedModeId)
    ? await appendModePatch(createResult.session, resolvedModeId)
    : undefined;

  const patchedModelId = shouldPatchModel(createResult, request.modelSelector)
    ? await appendModelPatch(createResult.session, request.modelSelector)
    : undefined;

  const workflow = await sendMessageToSessionWithFallback(chatInterop, {
    sessionId: createResult.session.id,
    prompt: request.prompt,
    agentName: request.agentName,
    // Mode/model stabilization happens during create plus persisted patching.
    // The follow-up send must stay prompt-only because current Local send paths
    // cannot prove or enforce mode/model selection on this build.
    mode: undefined,
    modelSelector: undefined,
    partialQuery: false,
    blockOnResponse: request.blockOnResponse,
    requireSelectionEvidence: request.requireSelectionEvidence
  });

  return {
    createResult,
    workflow,
    seedPrompt,
    patchedModeId,
    patchedModelId,
    resolvedModeId
  };
}

function buildSeedPrompt(): string {
  const token = `AA_STABLE_INIT_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return `Svara exakt med ${token} och inget mer.`;
}

function shouldPatchCustomMode(modeId: string | undefined): modeId is string {
  return Boolean(modeId && modeId.startsWith("file:///"));
}

function shouldPatchModel(
  createResult: ChatCommandResult,
  modelSelector: ChatModelSelector | undefined
): modelSelector is ChatModelSelector {
  return Boolean(modelSelector?.id) && createResult.selection?.model.status !== "verified";
}

async function resolveWorkspaceAgentModeUri(agentName: string | undefined): Promise<string | undefined> {
  const normalized = agentName?.trim().replace(/^#+/, "");
  if (!normalized) {
    return undefined;
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    // Resolve against workspace-owned runtime agent files when a workspace provides them.
    // This is separate from the parked historical repo-owned agent pack in this checkout.
    const candidate = path.join(folder.uri.fsPath, ".github", "agents", `${normalized}.agent.md`);
    if (await fileExists(candidate)) {
      return vscode.Uri.file(candidate).toString();
    }
  }

  return undefined;
}

async function appendModePatch(session: ChatSessionSummary, modeId: string): Promise<string | undefined> {
  await appendJsonlRow(session.sessionFile, {
    kind: 1,
    k: ["inputState", "mode"],
    v: {
      id: modeId,
      kind: "agent"
    }
  });
  return modeId;
}

async function appendModelPatch(
  session: ChatSessionSummary,
  modelSelector: ChatModelSelector
): Promise<string | undefined> {
  const selectedModel = await findSelectedModelPayload(session.sessionFile, modelSelector);
  if (!selectedModel) {
    return undefined;
  }

  await appendJsonlRow(session.sessionFile, {
    kind: 1,
    k: ["inputState", "selectedModel"],
    v: selectedModel
  });
  return typeof selectedModel.identifier === "string" ? selectedModel.identifier : normalizeRequestedModelId(modelSelector);
}

async function findSelectedModelPayload(sessionFile: string, modelSelector: ChatModelSelector): Promise<Record<string, unknown> | undefined> {
  const requestedId = normalizeRequestedModelId(modelSelector);
  if (!requestedId) {
    return undefined;
  }

  const directory = path.dirname(sessionFile);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
    .map(async (entry) => {
      const filePath = path.join(directory, entry.name);
      const stats = await fs.stat(filePath);
      return {
        filePath,
        mtimeMs: stats.mtimeMs
      };
    }));

  files.sort((left, right) => right.mtimeMs - left.mtimeMs);

  for (const file of files) {
    const payload = await readSelectedModelPayloadFromFile(file.filePath, requestedId);
    if (payload) {
      return payload;
    }
  }

  return undefined;
}

async function readSelectedModelPayloadFromFile(
  filePath: string,
  requestedId: string
): Promise<Record<string, unknown> | undefined> {
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).reverse();

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const key = normalizeJsonlKey(parsed?.k);
      if (key === "inputState/selectedModel" && modelIdentifierMatches(parsed?.v?.identifier, requestedId)) {
        return parsed.v as Record<string, unknown>;
      }

      const selectedModel = parsed?.kind === 0 ? parsed?.v?.inputState?.selectedModel : undefined;
      if (selectedModel && modelIdentifierMatches(selectedModel.identifier, requestedId)) {
        return selectedModel as Record<string, unknown>;
      }
    } catch {
      // Ignore malformed or unrelated rows.
    }
  }

  return undefined;
}

function normalizeRequestedModelId(modelSelector: ChatModelSelector | undefined): string | undefined {
  if (!modelSelector?.id?.trim()) {
    return undefined;
  }

  const rawId = modelSelector.id.trim();
  if (rawId.includes("/")) {
    return rawId;
  }

  return modelSelector.vendor?.trim()
    ? `${modelSelector.vendor.trim()}/${rawId}`
    : rawId;
}

function modelIdentifierMatches(observed: unknown, requestedId: string): boolean {
  if (typeof observed !== "string" || !observed.trim()) {
    return false;
  }

  return observed.trim().toLowerCase() === requestedId.trim().toLowerCase();
}

function normalizeJsonlKey(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value.join("/");
  }

  return typeof value === "string" ? value : undefined;
}

async function appendJsonlRow(sessionFile: string, row: unknown): Promise<void> {
  const prefix = await needsJsonlLineBreakPrefix(sessionFile) ? "\n" : "";
  await fs.appendFile(sessionFile, `${prefix}${JSON.stringify(row)}\n`, "utf8");
}

async function fileExists(target: string): Promise<boolean> {
  try {
    const stats = await fs.stat(target);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function needsJsonlLineBreakPrefix(sessionFile: string): Promise<boolean> {
  const handle = await fs.open(sessionFile, "r");
  try {
    const stats = await handle.stat();
    if (stats.size === 0) {
      return false;
    }

    const buffer = Buffer.alloc(1);
    await handle.read(buffer, 0, 1, stats.size - 1);
    return buffer[0] !== 0x0a;
  } finally {
    await handle.close();
  }
}