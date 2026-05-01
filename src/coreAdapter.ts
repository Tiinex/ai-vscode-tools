import path from "node:path";

export type RenderDetailLevel = "summary" | "full";
export type AnchorOccurrence = "first" | "last";

export interface SessionDescriptor {
  sessionId: string;
  title?: string;
  jsonlPath: string;
  workspaceStorageDir: string;
  mtime: number;
  size: number;
}

export interface SessionTarget {
  storageRoots?: string[];
  includeNoise?: boolean;
  latest?: boolean;
  sessionId?: string;
  sessionFile?: string;
  detailLevel?: RenderDetailLevel;
  maxChars?: number;
  anchorText?: string;
  anchorOccurrence?: AnchorOccurrence;
  afterLatestCompact?: boolean;
  maxBlocks?: number;
  latestRequestFamilies?: number;
}

interface CoreModule {
  DEFAULT_ASSUMED_WINDOW_TOKENS: number;
  discoverSessions(storageRoots?: string[]): Promise<SessionDescriptor[]>;
  renderListText(candidates: SessionDescriptor[], limit: number, options?: { maxChars?: number }): string;
  buildTranscriptEvidence(options: SessionTarget & {
    anchorText?: string;
    anchorOccurrence?: AnchorOccurrence;
    afterLatestCompact?: boolean;
    maxBlocks?: number;
  }): Promise<unknown>;
  renderTranscriptEvidenceMarkdown(result: unknown, options?: { detailLevel?: RenderDetailLevel; maxChars?: number }): string;
  buildWindow(options: SessionTarget & {
    anchorText?: string;
    anchorOccurrence?: AnchorOccurrence;
    afterLatestCompact?: boolean;
    before: number;
    after: number;
    maxMatches: number;
    includeNoise?: boolean;
  }): Promise<unknown>;
  renderWindowMarkdown(result: unknown, options?: { maxChars?: number }): string;
  buildExport(options: SessionTarget & { includeNoise?: boolean }): Promise<unknown>;
  renderExportMarkdown(result: unknown): string;
  buildSnapshot(options: SessionTarget): Promise<unknown>;
  renderSnapshotMarkdown(result: unknown): string;
  buildContextEstimate(options: SessionTarget & {
    assumedWindowTokens: number;
    afterLatestCompact?: boolean;
    latestRequestFamilies?: number;
  }): Promise<unknown>;
  renderContextEstimateMarkdown(result: unknown, options?: { maxChars?: number; detailLevel?: RenderDetailLevel }): string;
  buildProfile(options: SessionTarget & { assumedWindowTokens: number }): Promise<unknown>;
  renderProfileMarkdown(result: unknown): string;
  buildIndex(options: SessionTarget & { tail: number }): Promise<unknown>;
  renderIndexMarkdown(result: unknown): string;
  buildSurvey(options: { storageRoots?: string[]; limit: number; assumedWindowTokens: number }): Promise<unknown>;
  renderSurveyMarkdown(result: unknown): string;
}

let corePromise: Promise<CoreModule> | undefined;

async function loadCore(): Promise<CoreModule> {
  if (!corePromise) {
    const modulePath = path.resolve(__dirname, "./tooling/core.js");
    corePromise = Promise.resolve(require(modulePath) as CoreModule);
  }
  return corePromise;
}

export class SessionToolingAdapter {
  async discoverSessions(storageRoots?: string[]): Promise<SessionDescriptor[]> {
    const core = await loadCore();
    return core.discoverSessions(storageRoots ?? []);
  }

  async renderList(limit = 10, maxChars?: number, storageRoots?: string[]): Promise<string> {
    const core = await loadCore();
    const sessions = await core.discoverSessions(storageRoots ?? []);
    return core.renderListText(sessions, limit, { maxChars });
  }

  async renderTranscriptEvidence(target: SessionTarget): Promise<string> {
    const core = await loadCore();
    const result = await core.buildTranscriptEvidence({ ...target });
    return core.renderTranscriptEvidenceMarkdown(result, {
      detailLevel: target.detailLevel,
      maxChars: target.maxChars
    });
  }

  async renderWindow(target: SessionTarget & {
    anchorText?: string;
    anchorOccurrence?: AnchorOccurrence;
    afterLatestCompact?: boolean;
    before?: number;
    after?: number;
    maxMatches?: number;
    includeNoise?: boolean;
    maxChars?: number;
  }): Promise<string> {
    const core = await loadCore();
    const result = await core.buildWindow({
      ...target,
      anchorText: target.anchorText,
      anchorOccurrence: target.anchorOccurrence,
      afterLatestCompact: target.afterLatestCompact,
      before: target.before ?? 4,
      after: target.after ?? 8,
      maxMatches: target.maxMatches ?? 2,
      includeNoise: target.includeNoise ?? false
    });
    return core.renderWindowMarkdown(result, { maxChars: target.maxChars });
  }

  async renderExport(target: SessionTarget & { includeNoise?: boolean }): Promise<string> {
    const core = await loadCore();
    const result = await core.buildExport({
      ...target,
      includeNoise: target.includeNoise ?? false
    });
    return core.renderExportMarkdown(result);
  }

  async renderSnapshot(target: SessionTarget): Promise<string> {
    const core = await loadCore();
    const result = await core.buildSnapshot({ ...target });
    return core.renderSnapshotMarkdown(result);
  }

  async renderContextEstimate(target: SessionTarget): Promise<string> {
    const core = await loadCore();
    const result = await core.buildContextEstimate({
      ...target,
      assumedWindowTokens: core.DEFAULT_ASSUMED_WINDOW_TOKENS,
      afterLatestCompact: target.afterLatestCompact,
      latestRequestFamilies: target.latestRequestFamilies
    });
    return core.renderContextEstimateMarkdown(result, {
      detailLevel: target.detailLevel,
      maxChars: target.maxChars
    });
  }

  async renderProfile(target: SessionTarget): Promise<string> {
    const core = await loadCore();
    const result = await core.buildProfile({
      ...target,
      assumedWindowTokens: core.DEFAULT_ASSUMED_WINDOW_TOKENS
    });
    return core.renderProfileMarkdown(result);
  }

  async renderIndex(target: SessionTarget, tail = 80): Promise<string> {
    const core = await loadCore();
    const result = await core.buildIndex({ ...target, tail });
    return core.renderIndexMarkdown(result);
  }

  async renderSurvey(limit = 8, storageRoots?: string[]): Promise<string> {
    const core = await loadCore();
    const result = await core.buildSurvey({
      storageRoots,
      limit,
      assumedWindowTokens: core.DEFAULT_ASSUMED_WINDOW_TOKENS
    });
    return core.renderSurveyMarkdown(result);
  }
}