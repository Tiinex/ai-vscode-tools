import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
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
  HARD_MAX_OUTPUT_CHARS,
  discoverSessions,
  normalizeSource,
  renderContextEstimateMarkdown,
  renderExportMarkdown,
  renderIndexMarkdown,
  renderProfileMarkdown,
  renderListText,
  renderSnapshotMarkdown,
  renderSurveyMarkdown,
  renderTranscriptEvidenceMarkdown,
  renderWindowMarkdown
} from "./core.js";

const deliveryModeSchema = z.enum(["file-only", "file-and-inline-if-safe", "inline-if-safe"]);

const server = new McpServer({
  name: "aiRecoveryTooling",
  version: "0.1.0"
});

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
} as const;

const WORKSPACE_WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
} as const;

server.registerTool(
  "listSessions",
  {
    title: "List Sessions",
    description: "List recent stored local chat sessions from allowed workspaceStorage roots.",
    inputSchema: {
      storageRoots: z.array(z.string()).optional(),
      limit: z.number().int().positive().max(100).optional(),
      maxOutputChars: z.number().int().positive().max(HARD_MAX_OUTPUT_CHARS).optional()
    },
    annotations: READ_ONLY_ANNOTATIONS
  },
  async ({ storageRoots, limit = 10, maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS }) => {
    const sessions = await discoverSessions(storageRoots ?? []);
    return {
      content: [
        {
          type: "text",
          text: renderListText(
            sessions.map((session) => ({
              ...session,
              jsonlPath: normalizeSource(session.jsonlPath)
            })),
            limit,
            { maxChars: maxOutputChars }
          )
        }
      ]
    };
  }
);

server.registerTool(
  "getSessionIndex",
  {
    title: "Get Session Index",
    description: "Render a bounded trailing index of persisted rows for one stored chat session.",
    inputSchema: {
      storageRoots: z.array(z.string()).optional(),
      sessionId: z.string().optional(),
      sessionFile: z.string().optional(),
      latest: z.boolean().optional(),
      tail: z.number().int().positive().max(500).optional(),
      includeNoise: z.boolean().optional(),
      maxOutputChars: z.number().int().positive().max(HARD_MAX_OUTPUT_CHARS).optional()
    },
    annotations: READ_ONLY_ANNOTATIONS
  },
  async ({ storageRoots, sessionId, sessionFile, latest, tail = 80, includeNoise = false, maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS }) => {
    const result = await buildIndex({
      storageRoots,
      sessionId,
      sessionFile,
      latest,
      tail,
      includeNoise
    });
    return {
      content: [
        {
          type: "text",
          text: renderIndexMarkdown(result, { maxChars: maxOutputChars })
        }
      ]
    };
  }
);

server.registerTool(
  "getSessionWindow",
  {
    title: "Get Session Window",
    description: "Render a bounded window of persisted rows around matching anchor text in one session.",
    inputSchema: {
      storageRoots: z.array(z.string()).optional(),
      sessionId: z.string().optional(),
      sessionFile: z.string().optional(),
      latest: z.boolean().optional(),
      anchorText: z.string().min(1).optional(),
      anchorOccurrence: z.enum(["first", "last"]).optional(),
      afterLatestCompact: z.boolean().optional(),
      before: z.number().int().min(0).max(30).optional(),
      after: z.number().int().min(0).max(40).optional(),
      maxMatches: z.number().int().positive().max(10).optional(),
      includeNoise: z.boolean().optional(),
      maxOutputChars: z.number().int().positive().max(HARD_MAX_OUTPUT_CHARS).optional()
    },
    annotations: READ_ONLY_ANNOTATIONS
  },
  async ({ storageRoots, sessionId, sessionFile, latest, anchorText, anchorOccurrence, afterLatestCompact, before = 4, after = 8, maxMatches = 2, includeNoise = false, maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS }) => {
    const result = await buildWindow({
      storageRoots,
      sessionId,
      sessionFile,
      latest,
      anchorText,
      anchorOccurrence,
      afterLatestCompact,
      before,
      after,
      maxMatches,
      includeNoise
    });
    return {
      content: [
        {
          type: "text",
          text: renderWindowMarkdown(result, { maxChars: maxOutputChars })
        }
      ]
    };
  }
);

server.registerTool(
  "exportSessionMarkdown",
  {
    title: "Export Session Markdown",
    description: "Render a markdown export of one stored session, optionally writing it to a workspace file.",
    inputSchema: {
      storageRoots: z.array(z.string()).optional(),
      sessionId: z.string().optional(),
      sessionFile: z.string().optional(),
      latest: z.boolean().optional(),
      includeNoise: z.boolean().optional(),
      deliveryMode: deliveryModeSchema.optional(),
      outputFile: z.string().optional(),
      maxInlineChars: z.number().int().positive().max(HARD_MAX_OUTPUT_CHARS).optional()
    },
    annotations: WORKSPACE_WRITE_ANNOTATIONS
  },
  async ({
    storageRoots,
    sessionId,
    sessionFile,
    latest,
    includeNoise = false,
    deliveryMode = "file-only",
    outputFile,
    maxInlineChars = DEFAULT_MAX_OUTPUT_CHARS
  }) => {
    const result = await buildExport({
      storageRoots,
      sessionId,
      sessionFile,
      latest,
      includeNoise
    });
    const delivery = await deliverRenderedOutput(renderExportMarkdown(result), {
      mode: deliveryMode,
      outputFile,
      maxInlineChars
    });
    return {
      content: [
        {
          type: "text",
          text: delivery.responseText
        }
      ]
    };
  }
);

server.registerTool(
  "exportEvidenceTranscript",
  {
    title: "Export Evidence Transcript",
    description: "Render a canonical evidence transcript from persisted transcript JSONL for one session.",
    inputSchema: {
      storageRoots: z.array(z.string()).optional(),
      sessionId: z.string().optional(),
      sessionFile: z.string().optional(),
      latest: z.boolean().optional(),
      anchorText: z.string().min(1).optional(),
      anchorOccurrence: z.enum(["first", "last"]).optional(),
      afterLatestCompact: z.boolean().optional(),
      maxBlocks: z.number().int().positive().max(200).optional(),
      deliveryMode: deliveryModeSchema.optional(),
      outputFile: z.string().optional(),
      maxInlineChars: z.number().int().positive().max(HARD_MAX_OUTPUT_CHARS).optional()
    },
    annotations: WORKSPACE_WRITE_ANNOTATIONS
  },
  async ({
    storageRoots,
    sessionId,
    sessionFile,
    latest,
    anchorText,
    anchorOccurrence,
    afterLatestCompact,
    maxBlocks,
    deliveryMode = "inline-if-safe",
    outputFile,
    maxInlineChars = DEFAULT_MAX_OUTPUT_CHARS
  }) => {
    const result = await buildTranscriptEvidence({
      storageRoots,
      sessionId,
      sessionFile,
      latest,
      anchorText,
      anchorOccurrence,
      afterLatestCompact,
      maxBlocks
    });
    const delivery = await deliverRenderedOutput(renderTranscriptEvidenceMarkdown(result), {
      mode: deliveryMode,
      outputFile,
      maxInlineChars
    });
    return {
      content: [
        {
          type: "text",
          text: delivery.responseText
        }
      ]
    };
  }
);

server.registerTool(
  "getSessionSnapshot",
  {
    title: "Get Session Snapshot",
    description: "Render a compact current-state snapshot for one stored chat session, including persisted mode, selected model, and latest request agent/model fields when recoverable.",
    inputSchema: {
      storageRoots: z.array(z.string()).optional(),
      sessionId: z.string().optional(),
      sessionFile: z.string().optional(),
      latest: z.boolean().optional(),
      includeNoise: z.boolean().optional(),
      deliveryMode: deliveryModeSchema.optional(),
      outputFile: z.string().optional(),
      maxInlineChars: z.number().int().positive().max(HARD_MAX_OUTPUT_CHARS).optional()
    },
    annotations: READ_ONLY_ANNOTATIONS
  },
  async ({ storageRoots, sessionId, sessionFile, latest, includeNoise = false, deliveryMode = "inline-if-safe", outputFile, maxInlineChars = DEFAULT_MAX_OUTPUT_CHARS }) => {
    const result = await buildSnapshot({
      storageRoots,
      sessionId,
      sessionFile,
      latest,
      includeNoise
    });
    const delivery = await deliverRenderedOutput(renderSnapshotMarkdown(result, { maxChars: maxInlineChars }), {
      mode: deliveryMode,
      outputFile,
      maxInlineChars
    });
    return {
      content: [
        {
          type: "text",
          text: delivery.responseText
        }
      ]
    };
  }
);

server.registerTool(
  "estimateContextBreakdown",
  {
    title: "Estimate Context Breakdown",
    description: "Estimate persisted context pressure by category for one stored chat session.",
    inputSchema: {
      storageRoots: z.array(z.string()).optional(),
      sessionId: z.string().optional(),
      sessionFile: z.string().optional(),
      latest: z.boolean().optional(),
      includeNoise: z.boolean().optional(),
      afterLatestCompact: z.boolean().optional(),
      latestRequestFamilies: z.number().int().positive().optional(),
      reservedResponseTokens: z.number().int().min(0).max(2_000_000).optional(),
      assumedWindowTokens: z.number().int().positive().max(2_000_000).optional(),
      deliveryMode: deliveryModeSchema.optional(),
      outputFile: z.string().optional(),
      maxInlineChars: z.number().int().positive().max(HARD_MAX_OUTPUT_CHARS).optional()
    },
    annotations: READ_ONLY_ANNOTATIONS
  },
  async ({
    storageRoots,
    sessionId,
    sessionFile,
    latest,
    includeNoise = false,
    afterLatestCompact,
    latestRequestFamilies,
    reservedResponseTokens = 0,
    assumedWindowTokens = DEFAULT_ASSUMED_WINDOW_TOKENS,
    deliveryMode = "inline-if-safe",
    outputFile,
    maxInlineChars = DEFAULT_MAX_OUTPUT_CHARS
  }) => {
    const result = await buildContextEstimate({
      storageRoots,
      sessionId,
      sessionFile,
      latest,
      includeNoise,
      afterLatestCompact,
      latestRequestFamilies,
      reservedResponseTokens,
      assumedWindowTokens
    });
    const delivery = await deliverRenderedOutput(renderContextEstimateMarkdown(result, { maxChars: maxInlineChars }), {
      mode: deliveryMode,
      outputFile,
      maxInlineChars
    });
    return {
      content: [
        {
          type: "text",
          text: delivery.responseText
        }
      ]
    };
  }
);

server.registerTool(
  "getSessionProfile",
  {
    title: "Get Session Profile",
    description: "Render a findings-first diagnostic profile for one stored chat session.",
    inputSchema: {
      storageRoots: z.array(z.string()).optional(),
      sessionId: z.string().optional(),
      sessionFile: z.string().optional(),
      latest: z.boolean().optional(),
      includeNoise: z.boolean().optional(),
      reservedResponseTokens: z.number().int().min(0).max(2_000_000).optional(),
      assumedWindowTokens: z.number().int().positive().max(2_000_000).optional(),
      deliveryMode: deliveryModeSchema.optional(),
      outputFile: z.string().optional(),
      maxInlineChars: z.number().int().positive().max(HARD_MAX_OUTPUT_CHARS).optional()
    },
    annotations: READ_ONLY_ANNOTATIONS
  },
  async ({
    storageRoots,
    sessionId,
    sessionFile,
    latest,
    includeNoise = false,
    reservedResponseTokens = 0,
    assumedWindowTokens = DEFAULT_ASSUMED_WINDOW_TOKENS,
    deliveryMode = "inline-if-safe",
    outputFile,
    maxInlineChars = DEFAULT_MAX_OUTPUT_CHARS
  }) => {
    const result = await buildProfile({
      storageRoots,
      sessionId,
      sessionFile,
      latest,
      includeNoise,
      reservedResponseTokens,
      assumedWindowTokens
    });
    const delivery = await deliverRenderedOutput(renderProfileMarkdown(result, { maxChars: maxInlineChars }), {
      mode: deliveryMode,
      outputFile,
      maxInlineChars
    });
    return {
      content: [
        {
          type: "text",
          text: delivery.responseText
        }
      ]
    };
  }
);

server.registerTool(
  "surveySessions",
  {
    title: "Survey Sessions",
    description: "Compare several recent stored sessions with compact diagnostic metrics.",
    inputSchema: {
      storageRoots: z.array(z.string()).optional(),
      includeNoise: z.boolean().optional(),
      limit: z.number().int().positive().max(20).optional(),
      reservedResponseTokens: z.number().int().min(0).max(2_000_000).optional(),
      assumedWindowTokens: z.number().int().positive().max(2_000_000).optional(),
      deliveryMode: deliveryModeSchema.optional(),
      outputFile: z.string().optional(),
      maxInlineChars: z.number().int().positive().max(HARD_MAX_OUTPUT_CHARS).optional()
    },
    annotations: READ_ONLY_ANNOTATIONS
  },
  async ({
    storageRoots,
    includeNoise = false,
    limit = 5,
    reservedResponseTokens = 0,
    assumedWindowTokens = DEFAULT_ASSUMED_WINDOW_TOKENS,
    deliveryMode = "inline-if-safe",
    outputFile,
    maxInlineChars = DEFAULT_MAX_OUTPUT_CHARS
  }) => {
    const result = await buildSurvey({
      storageRoots,
      includeNoise,
      limit,
      reservedResponseTokens,
      assumedWindowTokens
    });
    const delivery = await deliverRenderedOutput(renderSurveyMarkdown(result, { maxChars: maxInlineChars }), {
      mode: deliveryMode,
      outputFile,
      maxInlineChars
    });
    return {
      content: [
        {
          type: "text",
          text: delivery.responseText
        }
      ]
    };
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
