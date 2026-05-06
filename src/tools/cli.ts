#!/usr/bin/env node

import { parseArgs } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  buildContextEstimate,
  buildExport,
  buildIndex,
  buildProfile,
  buildSnapshot,
  buildSurvey,
  buildTranscriptEvidence,
  buildWindow,
  DEFAULT_ASSUMED_WINDOW_TOKENS,
  DEFAULT_MAX_OUTPUT_CHARS,
  deliverRenderedOutput,
  discoverSessions,
  renderContextEstimateMarkdown,
  renderExportMarkdown,
  renderIndexMarkdown,
  renderProfileMarkdown,
  renderListText,
  renderSnapshotMarkdown,
  renderSurveyMarkdown,
  renderTranscriptEvidenceMarkdown,
  renderWindowMarkdown,
  type AnchorOccurrence,
  type ContextEstimateOptions,
  type DeliveryMode,
  type ExportOptions,
  type IndexOptions,
  type ProfileOptions,
  type SnapshotOptions,
  type SurveyOptions,
  type TranscriptEvidenceOptions,
  type SessionSelector,
  type WindowOptions
} from "./core.js";

function parseDeliveryMode(value: string | undefined, fallback: DeliveryMode): DeliveryMode {
  if (!value) {
    return fallback;
  }
  if (value === "file-only" || value === "file-and-inline-if-safe" || value === "inline-if-safe") {
    return value;
  }
  throw new Error(`Unsupported mode: ${value}`);
}

function parseAnchorOccurrence(value: string | undefined): AnchorOccurrence | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "first" || value === "last") {
    return value;
  }
  throw new Error(`Unsupported anchor occurrence: ${value}`);
}

function usage(): string {
  return [
    "Usage:",
    `  copilot-session-tool list [--storage-root <path>] [--limit <n>] [--max-output-chars <n>]`,
    `  copilot-session-tool index [--latest|--session-id <id>|--session-file <path>] [--tail <n>] [--include-noise] [--max-output-chars <n>] [--output <file>]`,
    `  copilot-session-tool window [--latest|--session-id <id>|--session-file <path>] [--anchor-text <text>] [--anchor-occurrence <first|last>] [--after-latest-compact] [--before <n>] [--after <n>] [--max-matches <n>] [--include-noise] [--max-output-chars <n>] [--output <file>]`,
    `  copilot-session-tool export [--latest|--session-id <id>|--session-file <path>] [--include-noise] [--mode <file-only|file-and-inline-if-safe|inline-if-safe>] [--output <file>] [--max-inline-chars <n>]`,
    `  copilot-session-tool transcript [--latest|--session-id <id>|--session-file <path>] [--anchor-text <text>] [--anchor-occurrence <first|last>] [--after-latest-compact] [--max-blocks <n>] [--mode <file-only|file-and-inline-if-safe|inline-if-safe>] [--output <file>] [--max-inline-chars <n>]`,
    `  copilot-session-tool snapshot [--latest|--session-id <id>|--session-file <path>] [--include-noise] [--mode <file-only|file-and-inline-if-safe|inline-if-safe>] [--output <file>] [--max-inline-chars <n>]`,
    `  copilot-session-tool estimate-context [--latest|--session-id <id>|--session-file <path>] [--include-noise] [--after-latest-compact] [--latest-request-families <n>] [--reserved-response-tokens <n>] [--assumed-window-tokens <n>] [--mode <file-only|file-and-inline-if-safe|inline-if-safe>] [--output <file>] [--max-inline-chars <n>]`,
    `  copilot-session-tool profile [--latest|--session-id <id>|--session-file <path>] [--include-noise] [--reserved-response-tokens <n>] [--assumed-window-tokens <n>] [--mode <file-only|file-and-inline-if-safe|inline-if-safe>] [--output <file>] [--max-inline-chars <n>]`,
    `  copilot-session-tool survey [--storage-root <path>] [--limit <n>] [--include-noise] [--reserved-response-tokens <n>] [--assumed-window-tokens <n>] [--mode <file-only|file-and-inline-if-safe|inline-if-safe>] [--output <file>] [--max-inline-chars <n>]`,
    "",
    `Defaults to a ${DEFAULT_MAX_OUTPUT_CHARS}-character response budget and hard-clamps larger requests.`
  ].join("\n");
}

async function writeOrPrint(content: string, output?: string): Promise<void> {
  if (!output) {
    process.stdout.write(content);
    return;
  }
  const outPath = path.resolve(output);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, content, "utf-8");
  process.stdout.write(`${output}\n`);
}

function parseSelector(values: ReturnType<typeof parseArgs>["values"]): SessionSelector {
  return {
    storageRoots: values["storage-root"] as string[] | undefined,
    sessionId: values["session-id"] as string | undefined,
    sessionFile: values["session-file"] as string | undefined,
    latest: Boolean(values.latest)
  };
}

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  if (command === "list") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "storage-root": { type: "string", multiple: true },
        limit: { type: "string" },
        "max-output-chars": { type: "string" }
      },
      allowPositionals: false
    });
    const limit = Number(values.limit ?? "20");
    const maxOutputChars = Number(values["max-output-chars"] ?? String(DEFAULT_MAX_OUTPUT_CHARS));
    const sessions = await discoverSessions((values["storage-root"] as string[] | undefined) ?? []);
    process.stdout.write(`${renderListText(sessions, limit, { maxChars: maxOutputChars })}\n`);
    return 0;
  }

  if (command === "index") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "storage-root": { type: "string", multiple: true },
        "session-id": { type: "string" },
        "session-file": { type: "string" },
        latest: { type: "boolean" },
        tail: { type: "string" },
        output: { type: "string" },
        "include-noise": { type: "boolean" },
        "max-output-chars": { type: "string" }
      },
      allowPositionals: false
    });
    const maxOutputChars = Number(values["max-output-chars"] ?? String(DEFAULT_MAX_OUTPUT_CHARS));
    const options: IndexOptions = {
      ...parseSelector(values),
      tail: Number(values.tail ?? "120"),
      includeNoise: Boolean(values["include-noise"])
    };
    const result = await buildIndex(options);
    await writeOrPrint(renderIndexMarkdown(result, { maxChars: maxOutputChars }), values.output as string | undefined);
    return 0;
  }

  if (command === "window") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "storage-root": { type: "string", multiple: true },
        "session-id": { type: "string" },
        "session-file": { type: "string" },
        latest: { type: "boolean" },
        output: { type: "string" },
        "include-noise": { type: "boolean" },
        "anchor-text": { type: "string" },
        "anchor-occurrence": { type: "string" },
        "after-latest-compact": { type: "boolean" },
        before: { type: "string" },
        after: { type: "string" },
        "max-matches": { type: "string" },
        "max-output-chars": { type: "string" }
      },
      allowPositionals: false
    });
    const anchorText = values["anchor-text"] as string | undefined;
    const afterLatestCompact = Boolean(values["after-latest-compact"]);
    if (!anchorText && !afterLatestCompact) {
      throw new Error("window requires --anchor-text or --after-latest-compact");
    }
    const options: WindowOptions = {
      ...parseSelector(values),
      anchorText,
      anchorOccurrence: parseAnchorOccurrence(values["anchor-occurrence"] as string | undefined),
      afterLatestCompact,
      before: Number(values.before ?? "4"),
      after: Number(values.after ?? "6"),
      maxMatches: Number(values["max-matches"] ?? "2"),
      includeNoise: Boolean(values["include-noise"])
    };
    const maxOutputChars = Number(values["max-output-chars"] ?? String(DEFAULT_MAX_OUTPUT_CHARS));
    const result = await buildWindow(options);
    await writeOrPrint(renderWindowMarkdown(result, { maxChars: maxOutputChars }), values.output as string | undefined);
    return 0;
  }

  if (command === "export") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "storage-root": { type: "string", multiple: true },
        "session-id": { type: "string" },
        "session-file": { type: "string" },
        latest: { type: "boolean" },
        output: { type: "string" },
        "include-noise": { type: "boolean" },
        mode: { type: "string" },
        "max-inline-chars": { type: "string" }
      },
      allowPositionals: false
    });
    const options: ExportOptions = {
      ...parseSelector(values),
      includeNoise: Boolean(values["include-noise"])
    };
    const result = await buildExport(options);
    const rendered = renderExportMarkdown(result);
    const delivery = await deliverRenderedOutput(rendered, {
      mode: parseDeliveryMode(values.mode as string | undefined, "file-only"),
      outputFile: values.output as string | undefined,
      maxInlineChars: Number(values["max-inline-chars"] ?? String(DEFAULT_MAX_OUTPUT_CHARS))
    });
    process.stdout.write(delivery.responseText);
    return 0;
  }

  if (command === "transcript") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "storage-root": { type: "string", multiple: true },
        "session-id": { type: "string" },
        "session-file": { type: "string" },
        latest: { type: "boolean" },
        output: { type: "string" },
        "anchor-text": { type: "string" },
        "anchor-occurrence": { type: "string" },
        "after-latest-compact": { type: "boolean" },
        "max-blocks": { type: "string" },
        mode: { type: "string" },
        "max-inline-chars": { type: "string" }
      },
      allowPositionals: false
    });
    const options: TranscriptEvidenceOptions = {
      ...parseSelector(values),
      anchorText: values["anchor-text"] as string | undefined,
      anchorOccurrence: parseAnchorOccurrence(values["anchor-occurrence"] as string | undefined),
      afterLatestCompact: Boolean(values["after-latest-compact"]),
      maxBlocks: values["max-blocks"] ? Number(values["max-blocks"]) : undefined
    };
    const result = await buildTranscriptEvidence(options);
    const maxInlineChars = Number(values["max-inline-chars"] ?? String(DEFAULT_MAX_OUTPUT_CHARS));
    const delivery = await deliverRenderedOutput(renderTranscriptEvidenceMarkdown(result), {
      mode: parseDeliveryMode(values.mode as string | undefined, "inline-if-safe"),
      outputFile: values.output as string | undefined,
      maxInlineChars
    });
    process.stdout.write(delivery.responseText);
    return 0;
  }

  if (command === "snapshot") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "storage-root": { type: "string", multiple: true },
        "session-id": { type: "string" },
        "session-file": { type: "string" },
        latest: { type: "boolean" },
        output: { type: "string" },
        "include-noise": { type: "boolean" },
        mode: { type: "string" },
        "max-inline-chars": { type: "string" }
      },
      allowPositionals: false
    });
    const options: SnapshotOptions = {
      ...parseSelector(values),
      includeNoise: Boolean(values["include-noise"])
    };
    const result = await buildSnapshot(options);
    const maxInlineChars = Number(values["max-inline-chars"] ?? String(DEFAULT_MAX_OUTPUT_CHARS));
    const delivery = await deliverRenderedOutput(renderSnapshotMarkdown(result, { maxChars: maxInlineChars }), {
      mode: parseDeliveryMode(values.mode as string | undefined, "inline-if-safe"),
      outputFile: values.output as string | undefined,
      maxInlineChars
    });
    process.stdout.write(delivery.responseText);
    return 0;
  }

  if (command === "estimate-context") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "storage-root": { type: "string", multiple: true },
        "session-id": { type: "string" },
        "session-file": { type: "string" },
        latest: { type: "boolean" },
        output: { type: "string" },
        "include-noise": { type: "boolean" },
        "after-latest-compact": { type: "boolean" },
        "latest-request-families": { type: "string" },
        mode: { type: "string" },
        "max-inline-chars": { type: "string" },
        "reserved-response-tokens": { type: "string" },
        "assumed-window-tokens": { type: "string" }
      },
      allowPositionals: false
    });
    const options: ContextEstimateOptions = {
      ...parseSelector(values),
      includeNoise: Boolean(values["include-noise"]),
      afterLatestCompact: Boolean(values["after-latest-compact"]),
      latestRequestFamilies: values["latest-request-families"] ? Number(values["latest-request-families"]) : undefined,
      reservedResponseTokens: Number(values["reserved-response-tokens"] ?? "0"),
      assumedWindowTokens: Number(values["assumed-window-tokens"] ?? String(DEFAULT_ASSUMED_WINDOW_TOKENS))
    };
    const result = await buildContextEstimate(options);
    const maxInlineChars = Number(values["max-inline-chars"] ?? String(DEFAULT_MAX_OUTPUT_CHARS));
    const delivery = await deliverRenderedOutput(renderContextEstimateMarkdown(result, { maxChars: maxInlineChars }), {
      mode: parseDeliveryMode(values.mode as string | undefined, "inline-if-safe"),
      outputFile: values.output as string | undefined,
      maxInlineChars
    });
    process.stdout.write(delivery.responseText);
    return 0;
  }

  if (command === "profile") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "storage-root": { type: "string", multiple: true },
        "session-id": { type: "string" },
        "session-file": { type: "string" },
        latest: { type: "boolean" },
        output: { type: "string" },
        "include-noise": { type: "boolean" },
        mode: { type: "string" },
        "max-inline-chars": { type: "string" },
        "reserved-response-tokens": { type: "string" },
        "assumed-window-tokens": { type: "string" }
      },
      allowPositionals: false
    });
    const options: ProfileOptions = {
      ...parseSelector(values),
      includeNoise: Boolean(values["include-noise"]),
      reservedResponseTokens: Number(values["reserved-response-tokens"] ?? "0"),
      assumedWindowTokens: Number(values["assumed-window-tokens"] ?? String(DEFAULT_ASSUMED_WINDOW_TOKENS))
    };
    const result = await buildProfile(options);
    const maxInlineChars = Number(values["max-inline-chars"] ?? String(DEFAULT_MAX_OUTPUT_CHARS));
    const delivery = await deliverRenderedOutput(renderProfileMarkdown(result, { maxChars: maxInlineChars }), {
      mode: parseDeliveryMode(values.mode as string | undefined, "inline-if-safe"),
      outputFile: values.output as string | undefined,
      maxInlineChars
    });
    process.stdout.write(delivery.responseText);
    return 0;
  }

  if (command === "survey") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "storage-root": { type: "string", multiple: true },
        limit: { type: "string" },
        output: { type: "string" },
        "include-noise": { type: "boolean" },
        mode: { type: "string" },
        "max-inline-chars": { type: "string" },
        "reserved-response-tokens": { type: "string" },
        "assumed-window-tokens": { type: "string" }
      },
      allowPositionals: false
    });
    const options: SurveyOptions = {
      storageRoots: values["storage-root"] as string[] | undefined,
      includeNoise: Boolean(values["include-noise"]),
      limit: Number(values.limit ?? "5"),
      reservedResponseTokens: Number(values["reserved-response-tokens"] ?? "0"),
      assumedWindowTokens: Number(values["assumed-window-tokens"] ?? String(DEFAULT_ASSUMED_WINDOW_TOKENS))
    };
    const result = await buildSurvey(options);
    const maxInlineChars = Number(values["max-inline-chars"] ?? String(DEFAULT_MAX_OUTPUT_CHARS));
    const delivery = await deliverRenderedOutput(renderSurveyMarkdown(result, { maxChars: maxInlineChars }), {
      mode: parseDeliveryMode(values.mode as string | undefined, "inline-if-safe"),
      outputFile: values.output as string | undefined,
      maxInlineChars
    });
    process.stdout.write(delivery.responseText);
    return 0;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
