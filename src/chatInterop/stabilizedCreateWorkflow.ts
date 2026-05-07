import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { sendMessageToSession } from "./sessionSendWorkflow";
import { type ChatCommandResult, type ChatInteropApi, type ChatModelSelector, type ChatSessionSummary, type CreateChatRequest } from "./types";

export interface StabilizedCreateAndSendResult {
  createResult: ChatCommandResult;
  workflow: ChatCommandResult;
  seedPrompt: string;
  realPromptDispatchAttempted: boolean;
  patchedModeId?: string;
  patchedModelId?: string;
  resolvedModeId?: string;
}

const SEED_SETTLEMENT_POLL_DELAY_MS = 1000;
const DEFAULT_SEED_SETTLEMENT_TIMEOUT_MS = 900_000;

interface SeedSessionReadiness {
  session?: ChatSessionSummary;
  tokenObserved: boolean;
  observedNonTokenContent: boolean;
}

export async function createStabilizedChatAndSend(
  chatInterop: ChatInteropApi,
  request: CreateChatRequest
): Promise<StabilizedCreateAndSendResult> {
  const seedPrompt = buildSeedPrompt();
  const createResult = await chatInterop.createChat({
    prompt: seedPrompt,
    partialQuery: false,
    blockOnResponse: false,
    requireSelectionEvidence: false,
    allowUnsafeCreateWithoutAgent: true
  });

  if (!createResult.ok || !createResult.session) {
    return {
      createResult,
      workflow: createResult,
      seedPrompt,
      realPromptDispatchAttempted: false
    };
  }

  const seedReadiness = await waitForSeedSessionReady(chatInterop, createResult.session, seedPrompt);
  if (!seedReadiness.session) {
    return {
      createResult,
      workflow: {
        ok: false,
        reason: seedReadiness.observedNonTokenContent
          ? "Seed create session produced non-token content before the real prompt could be sent."
          : "Seed create session did not reach a settled persisted state before the real prompt could be sent.",
        session: createResult.session,
        selection: createResult.selection,
        revealLifecycle: createResult.revealLifecycle
      },
      seedPrompt,
      realPromptDispatchAttempted: false
    };
  }

  const settledSeedSession = seedReadiness.session;

  if (seedSessionHasControlThreadArtifacts(settledSeedSession)) {
    return {
      createResult: {
        ...createResult,
        session: settledSeedSession
      },
      workflow: {
        ok: false,
        reason: `Seed create session picked up control-thread artifacts before the real prompt was sent: ${(settledSeedSession.controlThreadArtifactKinds ?? []).join(", ") || "unknown"}.`,
        session: settledSeedSession,
        selection: createResult.selection,
        revealLifecycle: createResult.revealLifecycle
      },
      seedPrompt,
      realPromptDispatchAttempted: false
    };
  }

  const resolvedWorkspaceAgent = await resolveWorkspaceAgentArtifact(request.agentName);
  const resolvedModeId = request.mode?.trim() || resolvedWorkspaceAgent?.modeId;
  const patchedModeId = shouldPatchCustomMode(resolvedModeId)
    ? await appendModePatch(createResult.session, resolvedModeId)
    : undefined;

  const effectiveModelSelector = request.modelSelector
    ?? await resolveWorkspaceAgentModelSelector(resolvedWorkspaceAgent?.filePath);
  const patchedModelId = shouldPatchModel(createResult, effectiveModelSelector)
    ? await appendModelPatch(createResult.session, effectiveModelSelector)
    : undefined;
  const exactSupport = await chatInterop.getExactSessionInteropSupport();

  const workflow = await sendMessageToSession(chatInterop, {
    sessionId: createResult.session.id,
    prompt: request.prompt,
    agentName: request.agentName,
    // Mode/model stabilization happens during create plus persisted patching.
    // The follow-up send keeps mode/model unset and lets the established
    // agent-aware create/send path carry participant selection.
    mode: undefined,
    modelSelector: exactSupport.canSendExactSessionMessage ? undefined : effectiveModelSelector,
    partialQuery: false,
    blockOnResponse: request.blockOnResponse,
    requireSelectionEvidence: request.requireSelectionEvidence
  });

  return {
    createResult,
    workflow,
    seedPrompt,
    realPromptDispatchAttempted: true,
    patchedModeId,
    patchedModelId,
    resolvedModeId
  };
}

async function waitForSeedSessionReady(
  chatInterop: ChatInteropApi,
  seedSession: ChatSessionSummary,
  seedPrompt: string
): Promise<SeedSessionReadiness> {
  let lastObservedSession: ChatSessionSummary | undefined = seedSession;
  let observedNonTokenContent = false;
  const deadline = Date.now() + Math.max(chatInterop.getPostCreateTimeoutMs?.() ?? DEFAULT_SEED_SETTLEMENT_TIMEOUT_MS, SEED_SETTLEMENT_POLL_DELAY_MS);

  while (true) {
    const session: ChatSessionSummary | undefined = (await chatInterop.listChats()).find((candidate) => candidate.id === seedSession.id) ?? lastObservedSession;
    lastObservedSession = session;
    const fileEvidence = await readSeedSessionFileEvidence(seedSession.sessionFile, seedPrompt);
    observedNonTokenContent = observedNonTokenContent || fileEvidence.observedNonTokenContent;

    if (fileEvidence.tokenObserved) {
      return {
        session,
        tokenObserved: true,
        observedNonTokenContent
      };
    }

    if (!fileEvidence.observedNonTokenContent && isSettledSession(session)) {
      return {
        session,
        tokenObserved: false,
        observedNonTokenContent
      };
    }

    if (fileEvidence.observedNonTokenContent && isSettledSession(session)) {
      return {
        session: undefined,
        tokenObserved: false,
        observedNonTokenContent: true
      };
    }

    if (Date.now() >= deadline) {
      break;
    }

    await delaySeedSettlement(SEED_SETTLEMENT_POLL_DELAY_MS);
  }

  return {
    session: undefined,
    tokenObserved: false,
    observedNonTokenContent
  };
}

async function readSeedSessionFileEvidence(
  sessionFile: string,
  seedPrompt: string
): Promise<{ tokenObserved: boolean; observedNonTokenContent: boolean }> {
  try {
    const raw = await fs.readFile(sessionFile, "utf8");
    const token = extractSeedToken(seedPrompt);
    const tokenObserved = token ? raw.includes(token) : false;
    const observedNonTokenContent = !tokenObserved && /requests\/0\/(response|result)/.test(raw);
    return {
      tokenObserved,
      observedNonTokenContent
    };
  } catch {
    return {
      tokenObserved: false,
      observedNonTokenContent: false
    };
  }
}

function extractSeedToken(seedPrompt: string): string | undefined {
  const match = seedPrompt.match(/AA_STABLE_INIT_[A-Za-z0-9_]+/);
  return match?.[0];
}

function seedSessionHasControlThreadArtifacts(session: ChatSessionSummary): boolean {
  return session.hasControlThreadArtifacts === true || (session.controlThreadArtifactKinds?.length ?? 0) > 0;
}

function isSettledSession(session: ChatSessionSummary | undefined): boolean {
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

function delaySeedSettlement(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function resolveWorkspaceAgentArtifact(
  agentName: string | undefined
): Promise<{ filePath: string; modeId: string } | undefined> {
  const normalized = agentName?.trim().replace(/^#+/, "");
  if (!normalized) {
    return undefined;
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    // Resolve against workspace-owned runtime agent files when a workspace provides them.
    // This is separate from the parked historical repo-owned agent pack in this checkout.
    const candidate = path.join(folder.uri.fsPath, ".github", "agents", `${normalized}.agent.md`);
    if (await fileExists(candidate)) {
      return {
        filePath: candidate,
        modeId: vscode.Uri.file(candidate).toString()
      };
    }
  }

  return undefined;
}

async function resolveWorkspaceAgentModelSelector(agentFilePath: string | undefined): Promise<ChatModelSelector | undefined> {
  if (!agentFilePath) {
    return undefined;
  }

  let raw: string;
  try {
    raw = await fs.readFile(agentFilePath, "utf8");
  } catch {
    return undefined;
  }

  const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!frontmatterMatch) {
    return undefined;
  }

  const modelLine = frontmatterMatch[1]
    .split(/\r?\n/u)
    .map((line) => line.match(/^model\s*:\s*(.+)\s*$/u))
    .find((match): match is RegExpMatchArray => Boolean(match?.[1]));
  if (!modelLine) {
    return undefined;
  }

  const parsed = parseAgentFrontmatterModelValue(modelLine[1]);
  if (!parsed?.id) {
    return undefined;
  }

  return parsed;
}

function parseAgentFrontmatterModelValue(rawValue: string): ChatModelSelector | undefined {
  const cleanedValue = rawValue.trim().replace(/^['"]|['"]$/g, "");
  if (!cleanedValue) {
    return undefined;
  }

  const vendorMatch = cleanedValue.match(/^(.*?)\s*\(([^()]+)\)\s*$/u);
  const rawId = vendorMatch ? vendorMatch[1].trim() : cleanedValue;
  const normalizedId = normalizeAgentFrontmatterModelId(rawId);
  if (!normalizedId) {
    return undefined;
  }

  const vendor = vendorMatch
    ? normalizeAgentFrontmatterModelToken(vendorMatch[2])
    : undefined;
  return {
    id: normalizedId,
    vendor
  };
}

function normalizeAgentFrontmatterModelId(rawId: string): string | undefined {
  const trimmed = rawId.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes("/")) {
    return trimmed.toLowerCase();
  }

  return normalizeAgentFrontmatterModelToken(trimmed);
}

function normalizeAgentFrontmatterModelToken(value: string): string | undefined {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/gu, "-")
    .replace(/[^a-z0-9./-]+/gu, "")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
  return normalized || undefined;
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
  const selectedModel = buildSelectedModelPatchPayload(modelSelector);
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

function buildSelectedModelPatchPayload(modelSelector: ChatModelSelector): Record<string, unknown> | undefined {
  const requestedId = normalizeRequestedModelId(modelSelector);
  if (!requestedId) {
    return undefined;
  }

  return {
    identifier: requestedId
  };
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