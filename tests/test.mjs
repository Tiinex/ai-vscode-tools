import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import initSqlJs from "sql.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const execFileAsync = promisify(execFile);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const workspaceRoot = packageRoot;
const distCli = path.join(packageRoot, "dist", "tools", "cli.js");
const distOfflineLocalChatCleanupCli = path.join(packageRoot, "dist", "tools", "offlineLocalChatCleanupCli.js");
const distServer = path.join(packageRoot, "dist", "tools", "mcp-server.js");
const benchmarkSessionFile = path.join(
  workspaceRoot,
  "tests",
  "assets",
  "transcript-emitter-transcript-jsonl-sample.jsonl"
);
const distChatInteropCapabilities = path.join(packageRoot, "dist", "chatInterop", "capabilities.js");
const distChatInteropEditorFocusCommands = path.join(packageRoot, "dist", "chatInterop", "editorFocusCommands.js");
const distChatInteropEditorTabMatcher = path.join(packageRoot, "dist", "chatInterop", "editorTabMatcher.js");
const distChatInteropFocusTargets = path.join(packageRoot, "dist", "chatInterop", "focusTargets.js");
const distChatInteropPromptDispatch = path.join(packageRoot, "dist", "chatInterop", "promptDispatch.js");
const distChatInteropSelfTargetGuard = path.join(packageRoot, "dist", "chatInterop", "selfTargetGuard.js");
const distChatInteropSupportMatrix = path.join(packageRoot, "dist", "chatInterop", "supportMatrix.js");
const distChatInteropTypes = path.join(packageRoot, "dist", "chatInterop", "types.js");
const distChatInteropService = path.join(packageRoot, "dist", "chatInterop", "service.js");
const distChatInteropStorage = path.join(packageRoot, "dist", "chatInterop", "storage.js");
const distChatInteropSessionSendWorkflow = path.join(packageRoot, "dist", "chatInterop", "sessionSendWorkflow.js");
const distChatInteropUnsettledDiagnostics = path.join(packageRoot, "dist", "chatInterop", "unsettledDiagnostics.js");
const distOfflineLocalChatCleanup = path.join(packageRoot, "dist", "offlineLocalChatCleanup.js");
const distRuntimeFileHygiene = path.join(packageRoot, "dist", "runtimeFileHygiene.js");
const distFirstSlice = path.join(packageRoot, "dist", "firstSlice.js");
const distExtension = path.join(packageRoot, "dist", "extension.js");
const distCopilotCliSummary = path.join(packageRoot, "dist", "chatInterop", "copilotCliSummary.js");
const distLocalToCopilotCliHandoff = path.join(packageRoot, "dist", "chatInterop", "localToCopilotCliHandoff.js");
const distCopilotCliTools = path.join(packageRoot, "dist", "tools", "copilot-cli.js");
const distAgentArchitectProcessEvidence = path.join(packageRoot, "dist", "tools", "agentArchitectProcessEvidence.js");
const distToolsCore = path.join(packageRoot, "dist", "tools", "core.js");
const distLanguageModelTools = path.join(packageRoot, "dist", "languageModelTools.js");
const distTraceableSubagent = path.join(packageRoot, "dist", "traceableSubagent.js");
const distTraceableSubagentEvidence = path.join(packageRoot, "dist", "traceableSubagentEvidence.js");
const distTraceableSubagentStatusBar = path.join(packageRoot, "dist", "traceableSubagentStatusBar.js");
const distTraceableSubagentStatusDetail = path.join(packageRoot, "dist", "traceableSubagentStatusDetail.js");
const distTraceableSubagentStatusPanel = path.join(packageRoot, "dist", "traceableSubagentStatusPanel.js");
const distToolNameNormalization = path.join(packageRoot, "dist", "toolNameNormalization.js");
const packageJsonPath = path.join(packageRoot, "package.json");
const readmePath = path.join(packageRoot, "README.md");
const extensionSourcePath = path.join(packageRoot, "src", "extension.ts");
const toolingValidationInstructionPath = path.join(packageRoot, ".github", "instructions", "tooling-validation.instructions.md");
const localChatCreateSendSkillPath = path.join(packageRoot, ".github", "skills", "local-chat-create-send-workflows", "SKILL.md");
const languageModelToolsSourcePath = path.join(packageRoot, "src", "languageModelTools.ts");
const vscodeStubModulePath = path.join(packageRoot, "node_modules", "vscode", "index.js");
const disposableProbeFallbackScriptPath = path.join(packageRoot, "tools", "create-disposable-local-chat-probe.ps1");
const sqlJsDistRoot = path.join(packageRoot, "node_modules", "sql.js", "dist");
const expectedToolNames = [
  "listSessions",
  "getSessionIndex",
  "getSessionWindow",
  "exportSessionMarkdown",
  "exportEvidenceTranscript",
  "getSessionSnapshot",
  "estimateContextBreakdown",
  "getSessionProfile",
  "surveySessions"
];
const invalidSessionFile = path.join(workspaceRoot, "README.md");
const tempOutputFile = path.join(workspaceRoot, "tools", ".test-session-output.md");
const invalidStorageRoot = "/tmp";
const expectedLanguageModelToolNames = [
  "list_agent_sessions",
  "get_agent_session_index",
  "get_agent_session_window",
  "export_agent_session_markdown",
  "export_agent_evidence_transcript",
  "get_agent_session_snapshot",
  "estimate_agent_context_breakdown",
  "get_agent_session_profile",
  "survey_agent_sessions",
  "list_traceable_agents",
  "list_traceable_models",
  "view_traceable_subagent",
  "run_traceable_subagent",
  "list_live_agent_chats",
  "inspect_live_agent_chat_quiescence",
  "create_live_agent_chat",
  "close_visible_live_chat_tabs",
  "delete_live_agent_chat_artifacts",
  "send_message_to_live_agent_chat",
  "reveal_live_agent_chat"
];

const expectedExtensionCommandNames = [
  "tiinex.aiVscodeTools.refreshSessions",
  "tiinex.aiVscodeTools.openLatestSnapshot",
  "tiinex.aiVscodeTools.openLatestTranscriptEvidence",
  "tiinex.aiVscodeTools.openLatestContextEstimate",
  "tiinex.aiVscodeTools.openLatestProfile",
  "tiinex.aiVscodeTools.surveyRecentSessions",
  "tiinex.aiVscodeTools.openTranscriptEvidence",
  "tiinex.aiVscodeTools.openSnapshot",
  "tiinex.aiVscodeTools.openContextEstimate",
  "tiinex.aiVscodeTools.openProfile",
  "tiinex.aiVscodeTools.openIndex",
  "tiinex.aiVscodeTools.openSessionFile",
  "tiinex.aiVscodeTools.listLiveChats",
  "tiinex.aiVscodeTools.revealLiveChat",
  "tiinex.aiVscodeTools.closeVisibleLiveChatTabs",
  "tiinex.aiVscodeTools.deleteLiveChatArtifacts",
  "tiinex.aiVscodeTools.createLiveChat",
  "tiinex.aiVscodeTools.sendMessageToLiveChat"
];

const liveToolManifestParityNames = new Set([
  "list_traceable_agents",
  "list_traceable_models",
  "view_traceable_subagent",
  "run_traceable_subagent",
  "list_live_agent_chats",
  "inspect_live_agent_chat_quiescence",
  "create_live_agent_chat",
  "close_visible_live_chat_tabs",
  "delete_live_agent_chat_artifacts",
  "send_message_to_live_agent_chat",
  "reveal_live_agent_chat"
]);

let sqlJsPromise;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function countRegisterToolOccurrences(sourceText, toolName) {
  const escapedToolName = toolName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`register(?:Live)?Tool\\(\\s*\"${escapedToolName}\"`, "g");
  return Array.from(sourceText.matchAll(pattern)).length;
}

async function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file) => path.join(sqlJsDistRoot, file)
    });
  }
  return sqlJsPromise;
}

async function writeWorkspaceStateValue(dbPath, key, value) {
  const SQL = await getSqlJs();
  let db;
  try {
    const bytes = await fs.readFile(dbPath);
    db = new SQL.Database(bytes);
  } catch {
    db = new SQL.Database();
    db.run("CREATE TABLE IF NOT EXISTS ItemTable (key TEXT PRIMARY KEY, value BLOB)");
  }

  try {
    db.run("INSERT OR REPLACE INTO ItemTable(key, value) VALUES (?, ?)", [key, value]);
    await fs.writeFile(dbPath, Buffer.from(db.export()));
  } finally {
    db.close();
  }
}

async function readWorkspaceStateValue(dbPath, key) {
  const SQL = await getSqlJs();
  const bytes = await fs.readFile(dbPath);
  const db = new SQL.Database(bytes);
  try {
    const statement = db.prepare("SELECT CAST(value AS TEXT) AS value FROM ItemTable WHERE key = ?");
    try {
      statement.bind([key]);
      if (!statement.step()) {
        return undefined;
      }
      const row = statement.getAsObject();
      return typeof row.value === "string" ? row.value : undefined;
    } finally {
      statement.free();
    }
  } finally {
    db.close();
  }
}

async function createCompactionSessionFixture() {
  const rootDir = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-compaction-session-"));
  const sessionFile = path.join(rootDir, "compaction-session.jsonl");
  const rows = [
    {
      kind: 0,
      v: {
        version: 3,
        creationDate: 1,
        sessionId: "compaction-session",
        responderUsername: "GitHub Copilot"
      }
    },
    {
      kind: 2,
      k: ["requests"],
      v: [
        {
          requestId: "request-1",
          timestamp: 1,
          message: { text: "before compact 1" }
        }
      ]
    },
    {
      kind: 1,
      k: ["requests", 0, "response"],
      v: [
        {
          value: "Initial response before compaction"
        }
      ]
    },
    {
      kind: 1,
      k: ["requests", 0, "result"],
      v: {
        value: "Initial result before compaction",
        metadata: {}
      }
    },
    {
      kind: 2,
      k: ["requests"],
      v: [
        {
          requestId: "request-2",
          timestamp: 2,
          message: { text: "before compact 2" }
        }
      ]
    },
    {
      kind: 1,
      k: ["requests", 1, "response"],
      v: [
        {
          value: "Compacting conversation..."
        }
      ]
    },
    {
      kind: 1,
      k: ["requests", 1, "result"],
      v: {
        value: "Compaction boundary result",
        metadata: {}
      }
    },
    {
      kind: 2,
      k: ["requests"],
      v: [
        {
          requestId: "request-3",
          timestamp: 3,
          message: { text: "diagnosis-start" }
        }
      ]
    },
    {
      kind: 1,
      k: ["requests", 2, "response"],
      v: [
        {
          value: "Diagnosis response"
        }
      ]
    },
    {
      kind: 1,
      k: ["requests", 2, "result"],
      v: {
        value: "Diagnosis result",
        metadata: {}
      }
    },
    {
      kind: 2,
      k: ["requests"],
      v: [
        {
          requestId: "request-4",
          timestamp: 4,
          message: { text: "follow-up after diagnosis" }
        }
      ]
    },
    {
      kind: 1,
      k: ["requests", 3, "response"],
      v: [
        {
          value: "Follow-up answer"
        }
      ]
    },
    {
      kind: 1,
      k: ["requests", 3, "result"],
      v: {
        value: "Follow-up result",
        metadata: {}
      }
    }
  ];
  await fs.writeFile(sessionFile, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8");
  return { rootDir, sessionFile };
}

async function createNoCompactionSessionFixture() {
  const rootDir = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-no-compaction-session-"));
  const sessionFile = path.join(rootDir, "no-compaction-session.jsonl");
  const rows = [
    {
      kind: 0,
      v: {
        version: 3,
        creationDate: 1,
        sessionId: "no-compaction-session",
        responderUsername: "GitHub Copilot"
      }
    },
    {
      kind: 2,
      k: ["requests"],
      v: [
        {
          requestId: "request-1",
          timestamp: 1,
          message: { text: "ordinary request 1" }
        }
      ]
    },
    {
      kind: 1,
      k: ["requests", 0, "response"],
      v: [
        {
          value: "Ordinary response without compaction boundary"
        }
      ]
    },
    {
      kind: 1,
      k: ["requests", 0, "result"],
      v: {
        value: "Ordinary result 1",
        metadata: {}
      }
    },
    {
      kind: 2,
      k: ["requests"],
      v: [
        {
          requestId: "request-2",
          timestamp: 2,
          message: { text: "ordinary request 2" }
        }
      ]
    },
    {
      kind: 1,
      k: ["requests", 1, "response"],
      v: [
        {
          value: "Another ordinary response"
        }
      ]
    },
    {
      kind: 1,
      k: ["requests", 1, "result"],
      v: {
        value: "Ordinary result 2",
        metadata: {}
      }
    }
  ];
  await fs.writeFile(sessionFile, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8");
  return { rootDir, sessionFile };
}

async function createCompactionTranscriptFixture() {
  const rootDir = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-compaction-transcript-"));
  const sessionFile = path.join(rootDir, "compaction-transcript.jsonl");
  const rows = [
    {
      id: "user-1",
      type: "user.message",
      timestamp: "2026-04-12T10:00:00.000Z",
      data: {
        content: "before compact"
      }
    },
    {
      id: "assistant-1",
      type: "assistant.message",
      parentId: "user-1",
      timestamp: "2026-04-12T10:00:01.000Z",
      data: {
        content: "Compacting conversation..."
      }
    },
    {
      id: "user-2",
      type: "user.message",
      timestamp: "2026-04-12T10:00:02.000Z",
      data: {
        content: "diagnosis-start"
      }
    },
    {
      id: "assistant-2",
      type: "assistant.message",
      parentId: "user-2",
      timestamp: "2026-04-12T10:00:03.000Z",
      data: {
        content: "Diagnosis response"
      }
    },
    {
      id: "assistant-3",
      type: "assistant.message",
      parentId: "user-2",
      timestamp: "2026-04-12T10:00:04.000Z",
      data: {
        content: "Follow-up after diagnosis"
      }
    }
  ];
  await fs.writeFile(sessionFile, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8");
  return { rootDir, sessionFile };
}

async function createTranscriptAnchorSelfMatchFixture() {
  const rootDir = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-transcript-anchor-self-match-"));
  const sessionFile = path.join(rootDir, "transcript-anchor-self-match.jsonl");
  const rows = [
    {
      id: "user-1",
      type: "user.message",
      timestamp: "2026-04-12T10:10:00.000Z",
      data: {
        content: "Start diagnostic run"
      }
    },
    {
      id: "assistant-1",
      type: "assistant.message",
      parentId: "user-1",
      timestamp: "2026-04-12T10:10:01.000Z",
      data: {
        content: "Running a helper tool now",
        toolRequests: [
          {
            toolCallId: "call-self-match",
            toolName: "debug_lookup",
            arguments: {
              query: "self-only-anchor"
            }
          }
        ]
      }
    },
    {
      id: "user-2",
      type: "user.message",
      timestamp: "2026-04-12T10:10:02.000Z",
      data: {
        content: "real-anchor"
      }
    },
    {
      id: "assistant-2",
      type: "assistant.message",
      parentId: "user-2",
      timestamp: "2026-04-12T10:10:03.000Z",
      data: {
        content: "real-anchor resolved"
      }
    }
  ];
  await fs.writeFile(sessionFile, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8");
  return { rootDir, sessionFile };
}

async function runCli(args, expectSuccess = true) {
  try {
    const result = await execFileAsync("node", [distCli, ...args], {
      cwd: packageRoot,
      maxBuffer: 2_000_000
    });
    if (!expectSuccess) {
      throw new Error(`Expected CLI failure but command succeeded: ${args.join(" ")}`);
    }
    return result;
  } catch (error) {
    if (expectSuccess) {
      throw error;
    }
    const stdout = typeof error.stdout === "string" ? error.stdout : "";
    const stderr = typeof error.stderr === "string" ? error.stderr : "";
    return { stdout, stderr };
  }
}

async function runOfflineCleanupCli(args, expectSuccess = true) {
  try {
    const result = await execFileAsync("node", [distOfflineLocalChatCleanupCli, ...args], {
      cwd: packageRoot,
      maxBuffer: 2_000_000,
      windowsHide: true
    });
    if (!expectSuccess) {
      throw new Error(`Expected offline cleanup CLI failure but command succeeded: ${args.join(" ")}`);
    }
    return result;
  } catch (error) {
    if (expectSuccess) {
      throw error;
    }
    const stdout = typeof error.stdout === "string" ? error.stdout : "";
    const stderr = typeof error.stderr === "string" ? error.stderr : "";
    return { stdout, stderr };
  }
}

async function runCliChecks() {
  const snapshot = await runCli([
    "snapshot",
    "--session-file",
    benchmarkSessionFile,
    "--mode",
    "inline-if-safe"
  ]);
  assert(snapshot.stdout.includes("# Session Snapshot"), "Snapshot test did not return snapshot markdown.");

  const profile = await runCli([
    "profile",
    "--session-file",
    benchmarkSessionFile,
    "--assumed-window-tokens",
    "400000",
    "--reserved-response-tokens",
    "70600",
    "--mode",
    "inline-if-safe"
  ]);
  assert(profile.stdout.includes("# Session Profile"), "Profile test did not return profile markdown.");

  const delivery = await runCli([
    "export",
    "--session-file",
    benchmarkSessionFile,
    "--mode",
    "inline-if-safe",
    "--max-inline-chars",
    "20"
  ]);
  assert(delivery.stdout.includes("# Output Delivery"), "Inline-threshold test did not trigger delivery summary.");

  const transcript = await runCli([
    "transcript",
    "--session-file",
    benchmarkSessionFile,
    "--mode",
    "inline-if-safe"
  ]);
  assert(transcript.stdout.includes("# Evidence Transcript"), "Transcript test did not return evidence transcript markdown.");
  assert(transcript.stdout.includes("## Tool Invocation"), "Transcript test did not emit tool invocation evidence blocks.");

  const transcriptGap = await runCli([
    "transcript",
    "--session-file",
    path.join(workspaceRoot, "tests", "assets", "transcript-emitter-transcript-jsonl-descendant-gap-sample.jsonl"),
    "--mode",
    "inline-if-safe"
  ]);
  assert(transcriptGap.stdout.includes("Missing descendant result"), "Transcript gap test did not report the missing descendant result.");

  const compactionFixture = await createCompactionSessionFixture();
  try {
    const compactWindow = await runCli([
      "window",
      "--session-file",
      compactionFixture.sessionFile,
      "--after-latest-compact",
      "--anchor-text",
      "diagnosis-start",
      "--anchor-occurrence",
      "last"
    ]);
    assert(compactWindow.stdout.includes("- After latest compact: yes"), "CLI window filter test did not report the compaction filter in scope.");
    assert(compactWindow.stdout.includes("diagnosis-start"), "CLI window filter test did not include the anchored diagnostic row.");

    const compactionTranscriptFixture = await createCompactionTranscriptFixture();
    try {
      const compactTranscript = await runCli([
      "transcript",
      "--session-file",
      compactionTranscriptFixture.sessionFile,
      "--after-latest-compact",
      "--anchor-text",
      "diagnosis-start",
      "--max-blocks",
      "2",
      "--mode",
      "inline-if-safe"
      ]);
      assert(compactTranscript.stdout.includes("# Evidence Transcript"), "CLI transcript filter test did not return transcript markdown.");
      assert(compactTranscript.stdout.includes("- After latest compact: yes"), "CLI transcript filter test did not render the compaction scope flag.");
      assert(compactTranscript.stdout.includes("- Max blocks: 2"), "CLI transcript filter test did not render the maxBlocks filter metadata.");
    } finally {
      await fs.rm(compactionTranscriptFixture.rootDir, { recursive: true, force: true });
    }

    const compactEstimate = await runCli([
      "estimate-context",
      "--session-file",
      compactionFixture.sessionFile,
      "--after-latest-compact",
      "--latest-request-families",
      "1",
      "--mode",
      "inline-if-safe"
    ]);
    assert(compactEstimate.stdout.includes("- After latest compact: yes"), "CLI context-estimate filter test did not render the compaction scope flag.");
    assert(compactEstimate.stdout.includes("- Compaction boundary applied: yes"), "CLI context-estimate filter test did not report that the persisted compaction boundary was applied.");
    assert(compactEstimate.stdout.includes("Latest request families limit: 1"), "CLI context-estimate filter test did not render the latest request family limit.");

    const noCompactionFixture = await createNoCompactionSessionFixture();
    try {
      const fallbackEstimate = await runCli([
        "estimate-context",
        "--session-file",
        noCompactionFixture.sessionFile,
        "--after-latest-compact",
        "--mode",
        "inline-if-safe"
      ]);
      assert(fallbackEstimate.stdout.includes("- After latest compact: yes"), "CLI compact-fallback estimate must preserve the requested compact scope flag.");
      assert(fallbackEstimate.stdout.includes("- Compaction boundary applied: no (fell back to bounded active tail)"), "CLI compact-fallback estimate must report the bounded-tail fallback when no persisted compaction boundary exists.");
    } finally {
      await fs.rm(noCompactionFixture.rootDir, { recursive: true, force: true });
    }

    const selfMatchTranscriptFixture = await createTranscriptAnchorSelfMatchFixture();
    try {
      const blockedSelfMatchTranscript = await runCli([
        "transcript",
        "--session-file",
        selfMatchTranscriptFixture.sessionFile,
        "--anchor-text",
        "self-only-anchor",
        "--mode",
        "inline-if-safe"
      ], false);
      assert(blockedSelfMatchTranscript.stderr.includes("No transcript evidence block matched anchor text: self-only-anchor"), "CLI transcript self-match regression must fail when the anchor appears only inside tool invocation arguments.");

      const realAnchorTranscript = await runCli([
        "transcript",
        "--session-file",
        selfMatchTranscriptFixture.sessionFile,
        "--anchor-text",
        "real-anchor",
        "--anchor-occurrence",
        "last",
        "--max-blocks",
        "1",
        "--mode",
        "inline-if-safe"
      ]);
      assert(realAnchorTranscript.stdout.includes("real-anchor resolved"), "CLI transcript anchor regression must still match real transcript message content.");
    } finally {
      await fs.rm(selfMatchTranscriptFixture.rootDir, { recursive: true, force: true });
    }
  } finally {
    await fs.rm(compactionFixture.rootDir, { recursive: true, force: true });
  }

  await fs.rm(tempOutputFile, { force: true });
  const fileOnly = await runCli([
    "snapshot",
    "--session-file",
    benchmarkSessionFile,
    "--mode",
    "file-only",
    "--output",
    tempOutputFile
  ]);
  assert(fileOnly.stdout.includes("# Output Delivery"), "File-only test did not return delivery summary.");
  const saved = await fs.readFile(tempOutputFile, "utf-8");
  assert(saved.includes("# Session Snapshot"), "File-only test did not write snapshot markdown.");
  await fs.rm(tempOutputFile, { force: true });

  const blockedOutput = await runCli(
    [
      "snapshot",
      "--session-file",
      benchmarkSessionFile,
      "--mode",
      "file-only",
      "--output",
      "/tmp/tiinex-ai-vscode-tools-test.md"
    ],
    false
  );
  assert(
    blockedOutput.stderr.includes("Rejected outputFile outside workspace root"),
    "Blocked output-path test did not fail with the expected guardrail."
  );

  const blockedSessionFile = await runCli(
    ["snapshot", "--session-file", invalidSessionFile, "--mode", "inline-if-safe"],
    false
  );
  assert(
    blockedSessionFile.stderr.includes("Rejected sessionFile without .jsonl extension"),
    "Invalid session-file test did not fail with the expected guardrail."
  );

  const blockedStorageRoot = await runCli([
    "list",
    "--storage-root",
    invalidStorageRoot
  ], false);
  assert(
    blockedStorageRoot.stderr.includes("Rejected storageRoot outside allowed locations"),
    "Blocked storage-root test did not fail with the expected guardrail."
  );

}

async function runChatInteropCapabilityChecks() {
  const capabilitiesModule = await import(pathToFileURL(distChatInteropCapabilities).href);
  const {
    buildUnsupportedFocusedSendReason,
    buildUnsupportedRevealReason,
    findFocusedChatInputCommand,
    findFocusedChatSubmitCommand,
    getExactSessionInteropSupport,
    getFocusedChatInteropSupport,
    findExactSessionOpenCommand
  } = capabilitiesModule;

  assert(
    findExactSessionOpenCommand(["workbench.action.chat.openSession"]) === undefined,
    "Chat interop capability test still accepted the generic openSession command even though ordinary Local reveal is now editor-group-only."
  );

  assert(
    findExactSessionOpenCommand(["workbench.action.chat.openSessionInEditorGroup"]) === "workbench.action.chat.openSessionInEditorGroup",
    "Chat interop capability test did not accept the editor-group session-open command as a valid Local reveal surface."
  );

  assert(
    findExactSessionOpenCommand([
      "workbench.action.chat.openSession",
      "workbench.action.chat.openSessionInEditorGroup"
    ]) === "workbench.action.chat.openSessionInEditorGroup",
    "Chat interop capability test did not resolve to the editor-group session-open command when both generic and editor-group surfaces exist."
  );

  assert(
    buildUnsupportedRevealReason(["workbench.action.chat.openSession.copilotcli"]).includes("Copilot CLI-specific openSession command"),
    "Chat interop capability test did not explain the CLI-only reveal limitation."
  );

  assert(
    findFocusedChatInputCommand(["workbench.action.chat.focusInput"]) === "workbench.action.chat.focusInput",
    "Chat interop capability test did not find the focused Local chat input command when present."
  );

  assert(
    findFocusedChatSubmitCommand(["workbench.action.chat.submit"]) === "workbench.action.chat.submit",
    "Chat interop capability test did not find the focused Local chat submit command when present."
  );

  assert(
    buildUnsupportedFocusedSendReason([]).includes("Neither workbench.action.chat.focusInput nor workbench.action.chat.submit was found"),
    "Chat interop capability test did not explain the missing focused Local submit commands boundary case."
  );

  const genericSupport = getExactSessionInteropSupport([
    "workbench.action.chat.openSession",
    "workbench.action.chat.openSessionWithPrompt"
  ]);
  assert(
    genericSupport.canRevealExactSession === false,
    "Chat interop capability test incorrectly reported generic exact-session reveal support even though ordinary Local reveal is editor-group-only."
  );
  assert(
    genericSupport.canSendExactSessionMessage === true,
    "Chat interop capability test did not report generic exact-session send support when openSessionWithPrompt exists."
  );

  const cliOnlySupport = getExactSessionInteropSupport([
    "workbench.action.chat.openSessionWithPrompt.copilotcli"
  ]);
  assert(
    cliOnlySupport.canRevealExactSession === false,
    "Chat interop capability test incorrectly marked CLI-only exact-session reveal support as available for ordinary local chats."
  );

  const focusedSupport = getFocusedChatInteropSupport([
    "workbench.action.chat.focusInput",
    "workbench.action.chat.submit"
  ]);
  assert(
    focusedSupport.canSubmitFocusedChatMessage === true,
    "Chat interop capability test did not report focused Local submit support when both commands exist."
  );
}

async function runChatInteropSelectionChecks() {
  const capabilitiesModule = await import(pathToFileURL(distChatInteropCapabilities).href);
  const typesModule = await import(pathToFileURL(distChatInteropTypes).href);
  const promptDispatchModule = await import(pathToFileURL(distChatInteropPromptDispatch).href);
  const {
    buildCreateChatSelectionBlocker,
    buildPromptWithAgentSelector,
    hasObservedCustomAgentMismatch,
    buildSelectionVerification,
    buildSendChatSelectionBlocker
  } = typesModule;
  const { findDirectAgentOpenCommand } = capabilitiesModule;
  const {
    buildPromptFileContent,
    buildPromptFileDispatchArtifact,
    parsePromptDispatchAgent,
    shouldUsePromptFileDispatch
  } = promptDispatchModule;

  const dispatchedPrompt = buildPromptWithAgentSelector("Inspect the target artifact.", "agent-architect");
  assert(
    dispatchedPrompt === "#agent-architect\nInspect the target artifact.",
    "Live chat selection test did not prefix the requested custom agent selector into the dispatched prompt."
  );

  const alreadyPrefixedPrompt = buildPromptWithAgentSelector("#agent-architect\nInspect the target artifact.", "agent-architect");
  assert(
    alreadyPrefixedPrompt === "#agent-architect\nInspect the target artifact.",
    "Live chat selection test duplicated an already present custom agent selector."
  );

  const verifiedSelection = buildSelectionVerification(
    {
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect",
      mode: "Agent",
      modelSelector: { id: "gpt-5.4", vendor: "copilot" }
    },
    {
      id: "session-1",
      title: "Selection Test",
      lastUpdated: "2026-04-09T19:00:00.000Z",
      mode: "Agent",
      agent: "agent-architect",
      requestAgentId: "agent-architect",
      model: "copilot/gpt-5.4",
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/session-1.jsonl"
    },
    {
      surface: "chat-open",
      dispatchedPrompt
    }
  );
  assert(verifiedSelection.mode.status === "verified", "Live chat selection test did not verify matching mode metadata.");
  assert(verifiedSelection.model.status === "verified", "Live chat selection test did not verify matching model metadata.");
  assert(
    verifiedSelection.agent.status === "verified",
    "Live chat selection test did not verify matching persisted custom-agent metadata."
  );
  assert(
    verifiedSelection.allRequestedVerified === true,
    "Live chat selection test did not treat matching agent/mode/model metadata as fully verified selection."
  );

  const unverifiedModel = buildSelectionVerification(
    {
      prompt: "Inspect the target artifact.",
      mode: "Agent",
      modelSelector: { id: "gpt-5.4", vendor: "copilot" }
    },
    {
      id: "session-2",
      title: "Selection Test",
      lastUpdated: "2026-04-09T19:00:00.000Z",
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/session-2.jsonl"
    },
    {
      surface: "chat-open",
      dispatchedPrompt: "Inspect the target artifact."
    }
  );
  assert(unverifiedModel.mode.status === "unverified", "Live chat selection test did not mark missing mode metadata as unverified.");
  assert(unverifiedModel.model.status === "unverified", "Live chat selection test did not mark missing model metadata as unverified.");

  const promptArtifactSelection = buildSelectionVerification(
    {
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect"
    },
    {
      id: "session-3",
      title: "Selection Test",
      lastUpdated: "2026-04-09T19:00:00.000Z",
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/session-3.jsonl"
    },
    {
      surface: "prompt-file-slash-command",
      dispatchedPrompt: "Inspect the target artifact.",
      slashCommand: "/aa-live-chat-agent-architect-dispatch"
    }
  );
  assert(
    promptArtifactSelection.agent.status === "dispatched-via-artifact",
    "Live chat selection test did not preserve prompt-artifact dispatch evidence when persisted agent metadata was absent."
  );
  assert(
    hasObservedCustomAgentMismatch("agent-architect", promptArtifactSelection) === false,
    "Live chat selection test incorrectly treated prompt-artifact dispatch evidence as a persisted wrong-agent mismatch."
  );

  const persistedWrongAgentSelection = buildSelectionVerification(
    {
      prompt: "Inspect the target artifact.",
      agentName: "anchor-candidate"
    },
    {
      id: "session-3a",
      title: "Selection Test",
      lastUpdated: "2026-04-09T19:00:00.000Z",
      mode: "agent",
      agent: "github.copilot.editsAgent",
      requestAgentId: "github.copilot.editsAgent",
      requestAgentName: "GitHub Copilot",
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/session-3a.jsonl"
    },
    {
      surface: "focused-chat-submit",
      dispatchedPrompt: "#anchor-candidate\nInspect the target artifact."
    }
  );
  assert(
    persistedWrongAgentSelection.agent.status === "mismatch",
    "Live chat selection test did not surface a persisted wrong-agent participant as a mismatch."
  );
  assert(
    hasObservedCustomAgentMismatch("anchor-candidate", persistedWrongAgentSelection) === true,
    "Live chat selection test did not classify a persisted wrong-agent participant as an observed custom-agent mismatch."
  );

  const modeBackedCustomAgentSelection = buildSelectionVerification(
    {
      prompt: "Inspect the target artifact.",
      agentName: "anchor-candidate"
    },
    {
      id: "session-3aa",
      title: "Selection Test",
      lastUpdated: "2026-04-09T19:00:00.000Z",
      mode: "file:///tmp/anchor-candidate.agent.md",
      agent: "anchor-candidate",
      requestAgentId: "github.copilot.editsAgent",
      requestAgentName: "GitHub Copilot",
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/session-3aa.jsonl"
    },
    {
      surface: "focused-chat-submit",
      dispatchedPrompt: "#anchor-candidate\nInspect the target artifact."
    }
  );
  assert(
    modeBackedCustomAgentSelection.agent.status === "verified",
    "Live chat selection test did not treat matching custom mode evidence as valid custom-agent verification."
  );
  assert(
    modeBackedCustomAgentSelection.agent.observed === "file:///tmp/anchor-candidate.agent.md",
    "Live chat selection test did not report the matching custom mode as the observed custom-agent evidence."
  );
  assert(
    hasObservedCustomAgentMismatch("anchor-candidate", modeBackedCustomAgentSelection) === false,
    "Live chat selection test incorrectly treated matching custom mode evidence as a wrong-agent mismatch."
  );

  const modeInferredAgentSelection = buildSelectionVerification(
    {
      prompt: "Inspect the target artifact.",
      agentName: "anchor-candidate"
    },
    {
      id: "session-3b",
      title: "Selection Test",
      lastUpdated: "2026-04-09T19:00:00.000Z",
      mode: "file:///tmp/anchor-candidate.agent.md",
      agent: "anchor-candidate",
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/session-3b.jsonl"
    },
    {
      surface: "prompt-file-slash-command",
      dispatchedPrompt: "Inspect the target artifact.",
      slashCommand: "/aa-live-chat-anchor-candidate-dispatch"
    }
  );
  assert(
    modeInferredAgentSelection.agent.status === "verified",
    "Live chat selection test did not treat latest-request custom mode evidence as valid custom-agent verification."
  );
  assert(
    modeInferredAgentSelection.agent.observed === "file:///tmp/anchor-candidate.agent.md",
    "Live chat selection test did not preserve the latest-request custom mode as the observed agent-selection evidence."
  );
  assert(
    modeInferredAgentSelection.allRequestedVerified === true,
    "Live chat selection test did not mark custom-agent selection as fully verified when the latest request carried the matching custom mode."
  );

  const slugEquivalentSelection = buildSelectionVerification(
    {
      prompt: "Inspect the target artifact.",
      agentName: "support-doc.fresh-reader"
    },
    {
      id: "session-4",
      title: "Selection Test",
      lastUpdated: "2026-04-09T19:00:00.000Z",
      agent: "support-doc-fresh-reader",
      requestAgentId: "support-doc-fresh-reader",
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/session-4.jsonl"
    },
    {
      surface: "prompt-file-slash-command",
      dispatchedPrompt: "Inspect the target artifact.",
      slashCommand: "/aa-live-chat-support-doc-fresh-reader-dispatch"
    }
  );
  assert(
    slugEquivalentSelection.agent.status === "verified",
    "Live chat selection test did not treat slug-equivalent persisted prompt-dispatch agent evidence as verified."
  );

  const promptFileContent = buildPromptFileContent("Inspect the target artifact.", "agent-architect");
  assert(promptFileContent.includes('agent: "agent-architect"'), "Prompt-file dispatch test did not encode agent frontmatter.");
  assert(!promptFileContent.includes("Temporary live chat dispatch"), "Prompt-file dispatch test should not emit explanatory description copy in the temporary prompt artifact.");
  assert(promptFileContent.endsWith("Inspect the target artifact.\n"), "Prompt-file dispatch test did not preserve the original prompt body.");

  const promptFileContentWithAgentName = buildPromptFileContent("Inspect the target artifact.", "Agent Architect");
  assert(promptFileContentWithAgentName.includes('agent: "Agent Architect"'), "Prompt-file dispatch test did not preserve a resolved custom-agent display name in the prompt frontmatter.");

  const promptArtifact = buildPromptFileDispatchArtifact(
    {
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect"
    },
    "/tmp/prompts",
    "20260409190000-abcdef"
  );
  assert(
    promptArtifact.filePath === path.join("/tmp/prompts", "aa-live-chat-agent-architect-20260409190000-abcdef.prompt.md"),
    "Prompt-file dispatch test did not derive the expected prompt file path."
  );
  assert(promptArtifact.slashCommand === "aa-live-chat-agent-architect-20260409190000-abcdef", "Prompt-file dispatch test did not derive the expected slash command name.");
  const promptArtifactWithResolvedAgent = buildPromptFileDispatchArtifact(
    {
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect"
    },
    "/tmp/prompts",
    "20260409190000-abcdef",
    "Agent Architect"
  );
  assert(promptArtifactWithResolvedAgent.slashCommand === promptArtifact.slashCommand, "Prompt-file dispatch test should not change slash-command naming when using a resolved custom-agent display name.");
  assert(promptArtifactWithResolvedAgent.content.includes('agent: "Agent Architect"'), "Prompt-file dispatch test did not encode the resolved custom-agent display name in the prompt artifact content.");
  assert(parsePromptDispatchAgent(promptArtifact.filePath) === "agent-architect", "Prompt-file dispatch test did not recover the agent slug from the persisted prompt file path.");
  assert(parsePromptDispatchAgent(promptArtifact.slashCommand) === "agent-architect", "Prompt-file dispatch test did not recover the agent slug from the persisted slash command name.");
  assert(shouldUsePromptFileDispatch({ prompt: "Inspect the target artifact.", agentName: "agent-architect" }) === true, "Prompt-file dispatch test did not enable artifact dispatch for custom agent requests.");
  assert(shouldUsePromptFileDispatch({ prompt: "Inspect the target artifact.", agentName: "agent-architect", partialQuery: true }) === false, "Prompt-file dispatch test should not use prompt files for partial-query requests.");
  assert(
    findDirectAgentOpenCommand([
      "workbench.action.chat.openagent-architect",
      "workbench.action.chat.open",
      "workbench.action.openChat"
    ], "agent-architect") === "workbench.action.chat.openagent-architect",
    "Direct agent-open command test did not recover the runtime openagent-architect command."
  );

  assert(
    buildCreateChatSelectionBlocker({
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect",
      mode: "Agent",
      modelSelector: { id: "gpt-5.4", vendor: "copilot" },
      requireSelectionEvidence: true
    })?.includes("explicit mode or model selection is unsupported") === true,
    "Live chat selection blocker test did not hard-block createChat selection overrides on the current Local build."
  );

  assert(
    buildCreateChatSelectionBlocker({
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect",
      mode: "Agent",
      modelSelector: { id: "gpt-5.4", vendor: "copilot" }
    })?.includes("create_live_agent_chat") === true,
    "Live chat selection blocker test did not name the public create_live_agent_chat surface in the create-time selection blocker."
  );

  assert(
    buildCreateChatSelectionBlocker({
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect",
      mode: "Agent",
      modelSelector: { id: "gpt-5.4", vendor: "copilot" }
    })?.includes("createChat") === false,
    "Live chat selection blocker test should not leak the internal createChat name in the public create-time selection blocker."
  );

  assert(
    buildCreateChatSelectionBlocker({
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect",
      mode: "Agent",
      modelSelector: { id: "gpt-5.4", vendor: "copilot" }
    })?.includes("inherit the active chat UI state") === true,
    "Live chat selection blocker test did not block best-effort Local createChat role dispatch after the observed selection-drift failure."
  );

  assert(
    buildCreateChatSelectionBlocker({
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect",
      mode: "Agent",
      modelSelector: { id: "gpt-5.4", vendor: "copilot" },
      requireSelectionEvidence: true,
      partialQuery: true
    })?.includes("explicit mode or model selection is unsupported") === true,
    "Live chat selection blocker test did not block draft-prefill selection overrides after the observed create-time drift failure."
  );

  assert(
    buildCreateChatSelectionBlocker({
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect",
      partialQuery: true
    })?.includes("can open an editor draft without producing a persisted created session id") === true,
    "Live chat selection blocker test should fail fast on partialQuery create requests when the host cannot provide a persisted created session id."
  );

  assert(
    buildCreateChatSelectionBlocker({
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect"
    }, {
      directAgentOpenAvailable: true
    }) === undefined,
    "Live chat selection blocker test should still allow createChat custom-agent requests when a first-class direct agent-open command is available."
  );

  assert(
    buildCreateChatSelectionBlocker({
      prompt: "Inspect the target artifact."
    })?.includes("without an explicit agentName is unsafe") === true,
    "Live chat selection blocker test did not block a plain createChat after the observed inherited-mode neutral-create failure."
  );

  assert(
    buildCreateChatSelectionBlocker({
      prompt: "Inspect the target artifact."
    })?.includes("agentName") === true,
    "Live chat selection blocker test did not tell the caller to provide agentName explicitly on the public create surface."
  );

  assert(
    buildCreateChatSelectionBlocker({
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect",
      requireSelectionEvidence: true
    }) === undefined,
    "Live chat selection blocker test should defer strict custom-agent verification to post-create persisted evidence instead of hard-blocking create-time dispatch."
  );

  assert(
    buildSendChatSelectionBlocker({
      sessionId: "session-1",
      prompt: "Inspect the target artifact.",
      mode: "Agent"
    })?.includes("mode/model selection") === true,
    "Live chat selection blocker test did not block exact-session mode/model override requests."
  );

  assert(
    buildSendChatSelectionBlocker({
      sessionId: "session-1",
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect",
      requireSelectionEvidence: true
    })?.includes("custom agent prompt selector") === true,
    "Live chat selection blocker test did not block exact-session agent verification requests."
  );
}

async function runFocusedSendBehaviorChecks() {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const storageModule = require(distChatInteropStorage);
  const originalChatSessionStorage = storageModule.ChatSessionStorage;

  // Simple mock ChatSessionStorage that yields a predetermined sequence of listSnapshots
  class MockChatSessionStorage {
    constructor(_context, _options) {
      this._call = 0;
    }
    static setBehaviors(behaviors) {
      MockChatSessionStorage._behaviors = behaviors || [];
    }
    async listSessions() {
      this._call = (this._call || 0) + 1;
      const seq = MockChatSessionStorage._behaviors || [];
      const idx = Math.min(this._call - 1, Math.max(0, seq.length - 1));
      const behavior = seq[idx] || [];
      return typeof behavior === 'function' ? await behavior(this._call) : behavior;
    }
    async getSessionById(sessionId) {
      return (await this.listSessions()).find((s) => s.id === sessionId);
    }
  }

  try {
    // Replace the real storage implementation with our mock for the duration of these tests
    storageModule.ChatSessionStorage = MockChatSessionStorage;

    // Ensure a tolerant vscode shim is available for command execution used by the service
    let vscodeModule;
    try {
      vscodeModule = require('vscode');
    } catch (e) {
      vscodeModule = { commands: { getCommands: async () => [], executeCommand: async () => undefined }, window: { tabGroups: { all: [] } } };
    }
    vscodeModule.workspace = vscodeModule.workspace || {};
    const originalGetCommands = vscodeModule.commands.getCommands;
    const originalExecuteCommand = vscodeModule.commands.executeCommand;
    const executedCommands = [];
    vscodeModule.commands.getCommands = async () => [
      'workbench.action.chat.focusInput',
      'workbench.action.chat.submit'
    ];
    vscodeModule.commands.executeCommand = async (command, args) => {
      executedCommands.push({ command, args });
      return undefined;
    };

    const originalMkdir = fs.mkdir;
    const originalWriteFile = fs.writeFile;
    const originalRm = fs.rm;
    const fsOps = [];
    fs.mkdir = async (...args) => {
      const targetPath = typeof args[0] === 'string' ? args[0] : String(args[0]);
      if (targetPath.includes(`${path.sep}User${path.sep}prompts`)) {
        fsOps.push({ op: 'mkdir', args });
        return undefined;
      }

      return originalMkdir(...args);
    };
    fs.writeFile = async (...args) => {
      const targetPath = typeof args[0] === 'string' ? args[0] : String(args[0]);
      if (targetPath.endsWith('.prompt.md')) {
        fsOps.push({ op: 'writeFile', args });
        return undefined;
      }

      return originalWriteFile(...args);
    };
    fs.rm = async (...args) => {
      const targetPath = typeof args[0] === 'string' ? args[0] : String(args[0]);
      if (targetPath.endsWith('.prompt.md')) {
        fsOps.push({ op: 'rm', args });
        return undefined;
      }

      return originalRm(...args);
    };

    const serviceModule = await import(pathToFileURL(distChatInteropService).href);
    const unsettledDiagnosticsModule = await import(pathToFileURL(distChatInteropUnsettledDiagnostics).href);
    const { ChatInteropService } = serviceModule;
    const { getSessionQuiescenceState } = unsettledDiagnosticsModule;

    // Non-blocking scenario: immediate persisted touch observed
    MockChatSessionStorage.setBehaviors([
      [
        {
          id: 's1',
          title: 'session-1',
          lastUpdated: '2026-04-11T00:00:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s1.jsonl'
        }
      ],
      [
        {
          id: 's1',
          title: 'session-1',
          lastUpdated: '2026-04-11T00:00:01.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s1.jsonl'
        }
      ]
    ]);

    const service = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 1000, waitForPersistedDefault: true });
    service.getFocusedChatInteropSupport = async () => ({
      canSubmitFocusedChatMessage: true,
      focusInputCommand: 'workbench.action.chat.focusInput',
      submitCommand: 'workbench.action.chat.submit',
      unsupportedReason: undefined
    });

    const nbResult = await service.sendFocusedMessage({ prompt: 'hello', agentName: 'agent-architect', requireSelectionEvidence: false, waitForPersisted: false });
    assert(nbResult.ok === true, `Non-blocking focused-send did not succeed when persisted touch occurred. Got: ${nbResult.reason}`);
    assert(nbResult.session && nbResult.session.id === 's1', 'Non-blocking focused-send returned wrong session id');
    assert(executedCommands[0]?.command === 'workbench.action.chat.focusInput', 'Non-blocking focused-send did not focus the chat input before dispatch.');
    assert(executedCommands[1]?.command === 'workbench.action.chat.open', 'Non-blocking focused-send did not prefill the focused chat input through chat-open.');
    assert(String(executedCommands[1]?.args?.query).startsWith('/aa-live-chat-agent-architect-') === true, `Non-blocking focused-send did not use the expected prompt-file slash command. Got: ${executedCommands[1]?.args?.query}`);
    assert(executedCommands[1]?.args?.isPartialQuery === false, 'Non-blocking focused-send did not dispatch the prompt-file slash command as a real query.');
    assert(executedCommands[2]?.command === 'workbench.action.chat.focusInput', 'Non-blocking focused-send did not refocus the chat input after slash-command prefill.');
    assert(executedCommands[3]?.command === 'workbench.action.chat.submit', 'Non-blocking focused-send did not submit the prompt-file slash command.');
    assert(fsOps.some((entry) => entry.op === 'writeFile') === true, 'Non-blocking focused-send did not write a temporary prompt artifact for agent-bound dispatch.');
    assert(fsOps.some((entry) => entry.op === 'rm') === true, 'Non-blocking focused-send did not clean up the temporary prompt artifact for agent-bound dispatch.');
    executedCommands.length = 0;
    fsOps.length = 0;

    const modelPrefillResult = await service.sendFocusedMessage({
      prompt: 'hello with model',
      agentName: 'agent-architect',
      modelSelector: { id: 'gpt-5-mini', vendor: 'copilot' },
      requireSelectionEvidence: false,
      waitForPersisted: false
    });
    assert(modelPrefillResult.ok === true, 'Focused-send with model prefill did not succeed when persisted touch occurred');
    assert(executedCommands[0]?.command === 'workbench.action.chat.focusInput', 'Focused-send with model prefill did not focus the chat input before dispatch.');
    assert(executedCommands[1]?.command === 'workbench.action.chat.open', 'Focused-send with model prefill did not prefill the focused chat input through chat-open.');
    assert(String(executedCommands[1]?.args?.query).startsWith('/aa-live-chat-agent-architect-') === true, `Focused-send with model prefill did not use the expected prompt-file slash command. Got: ${executedCommands[1]?.args?.query}`);
    assert(executedCommands[1]?.args?.isPartialQuery === false, 'Focused-send with model prefill did not dispatch the prompt-file slash command as a real query.');
    assert(executedCommands[1]?.args?.modelSelector?.id === 'gpt-5-mini', `Focused-send with model prefill did not pass the requested model id. Got: ${executedCommands[1]?.args?.modelSelector?.id}`);
    assert(executedCommands[1]?.args?.modelSelector?.vendor === 'copilot', `Focused-send with model prefill did not pass the requested model vendor. Got: ${executedCommands[1]?.args?.modelSelector?.vendor}`);
    assert(executedCommands[2]?.command === 'workbench.action.chat.focusInput', 'Focused-send with model prefill did not refocus the chat input after slash-command prefill.');
    assert(executedCommands[3]?.command === 'workbench.action.chat.submit', 'Focused-send with model prefill did not submit the prompt-file slash command.');
    executedCommands.length = 0;
    fsOps.length = 0;

    // Blocking scenario: no persisted mutation appears within the timeout
    MockChatSessionStorage.setBehaviors([
      [
        {
          id: 's2',
          title: 'session-2',
          lastUpdated: '2026-04-11T01:00:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s2.jsonl'
        }
      ]
    ]);

    const service2 = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 250, waitForPersistedDefault: true });
    service2.getFocusedChatInteropSupport = service.getFocusedChatInteropSupport;

    const bResult = await service2.sendFocusedMessage({ prompt: 'hello', agentName: 'agent-architect', requireSelectionEvidence: false });
    assert(bResult.ok === false, 'Blocking focused-send unexpectedly reported success when no persisted touch occurred');
    assert(
      typeof bResult.reason === 'string' && bResult.reason.includes('no persisted session mutation'),
      'Blocking focused-send did not return the expected timeout reason'
    );

    // Blocking scenario: once a mutation is seen, success should wait until pending work settles.
    MockChatSessionStorage.setBehaviors([
      [
        {
          id: 's3',
          title: 'session-3',
          lastUpdated: '2026-04-11T02:00:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3.jsonl'
        }
      ],
      [
        {
          id: 's3',
          title: 'session-3',
          lastUpdated: '2026-04-11T02:00:01.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: true,
          pendingRequestCount: 1,
          lastRequestCompleted: false,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3.jsonl'
        }
      ],
      [
        {
          id: 's3',
          title: 'session-3',
          lastUpdated: '2026-04-11T02:00:01.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3.jsonl'
        }
      ]
    ]);

    const service3 = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 1000, waitForPersistedDefault: true });
    service3.getFocusedChatInteropSupport = service.getFocusedChatInteropSupport;

    const settledResult = await service3.sendFocusedMessage({ prompt: 'hello', agentName: 'agent-architect', requireSelectionEvidence: false, blockOnResponse: true });
    assert(settledResult.ok === true, 'Blocking focused-send did not wait for the session to settle after the first mutation.');
    assert(settledResult.session?.id === 's3', 'Blocking focused-send returned the wrong settled session.');
    assert(settledResult.session?.lastRequestCompleted === true, 'Blocking focused-send returned before the final request completion state was observed.');

    MockChatSessionStorage.setBehaviors([
      [
        {
          id: 's3-target',
          title: 'session-3-target',
          lastUpdated: '2026-04-11T02:30:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-target.jsonl'
        },
        {
          id: 's3-background',
          title: 'session-3-background',
          lastUpdated: '2026-04-11T02:30:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-background.jsonl'
        }
      ],
      [
        {
          id: 's3-target',
          title: 'session-3-target',
          lastUpdated: '2026-04-11T02:30:01.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: true,
          pendingRequestCount: 1,
          lastRequestCompleted: false,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-target.jsonl'
        },
        {
          id: 's3-background',
          title: 'session-3-background',
          lastUpdated: '2026-04-11T02:30:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-background.jsonl'
        }
      ],
      [
        {
          id: 's3-target',
          title: 'session-3-target',
          lastUpdated: '2026-04-11T02:30:01.500Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-target.jsonl'
        },
        {
          id: 's3-background',
          title: 'session-3-background',
          lastUpdated: '2026-04-11T02:30:02.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-background.jsonl'
        }
      ]
    ]);

    const competingTouchService = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 1000, waitForPersistedDefault: true });
    competingTouchService.getFocusedChatInteropSupport = service.getFocusedChatInteropSupport;
    competingTouchService.traceCreateDebug = async () => {};

    const competingTouchResult = await competingTouchService.sendFocusedMessage({ prompt: 'hello', agentName: 'agent-architect', requireSelectionEvidence: false, blockOnResponse: true });
    assert(competingTouchResult.ok === true, 'Blocking focused-send did not succeed when the first observed target settled before a later unrelated touched session.');
    assert(competingTouchResult.session?.id === 's3-target', `Blocking focused-send drifted to a later unrelated touched session instead of preserving the first observed target. Got: ${JSON.stringify(competingTouchResult.session)}`);

    MockChatSessionStorage.setBehaviors([
      [
        {
          id: 's3-parent',
          title: 'session-3-parent',
          lastUpdated: '2026-04-11T02:40:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-parent.jsonl'
        },
        {
          id: 's3-child',
          title: 'session-3-child',
          lastUpdated: '2026-04-11T02:40:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-child.jsonl'
        }
      ],
      [
        {
          id: 's3-parent',
          title: 'session-3-parent',
          lastUpdated: '2026-04-11T02:40:01.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-parent.jsonl'
        },
        {
          id: 's3-child',
          title: 'session-3-child',
          lastUpdated: '2026-04-11T02:40:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-child.jsonl'
        }
      ],
      [
        {
          id: 's3-parent',
          title: 'session-3-parent',
          lastUpdated: '2026-04-11T02:40:02.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-parent.jsonl'
        },
        {
          id: 's3-child',
          title: 'session-3-child',
          lastUpdated: '2026-04-11T02:40:01.500Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-child.jsonl'
        }
      ]
    ]);

    const exactTargetFocusedService = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 1000, waitForPersistedDefault: true });
    exactTargetFocusedService.getFocusedChatInteropSupport = service.getFocusedChatInteropSupport;
    exactTargetFocusedService.traceCreateDebug = async () => {};

    const exactTargetFocusedResult = await exactTargetFocusedService.sendFocusedMessage({
      prompt: 'hello',
      agentName: 'agent-architect',
      requireSelectionEvidence: false,
      blockOnResponse: true,
      expectedFocusedSessionId: 's3-child'
    });
    assert(exactTargetFocusedResult.ok === true, 'Blocking focused-send did not succeed when an exact focused target lagged behind an unrelated parent mutation.');
    assert(exactTargetFocusedResult.session?.id === 's3-child', `Blocking focused-send ignored the exact focused target hint and pinned to an unrelated touched session. Got: ${JSON.stringify(exactTargetFocusedResult.session)}`);

    MockChatSessionStorage.setBehaviors([
      [
        {
          id: 's3-stale-list',
          title: 'session-3-stale-list',
          lastUpdated: '2026-04-11T02:45:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-stale-list.jsonl'
        }
      ]
    ]);

    const exactFreshGetByIdService = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 200, waitForPersistedDefault: true });
    exactFreshGetByIdService.getFocusedChatInteropSupport = service.getFocusedChatInteropSupport;
    exactFreshGetByIdService.traceCreateDebug = async () => {};
    let staleExactGetByIdCalls = 0;
    exactFreshGetByIdService.storage.getSessionById = async (sessionId) => {
      staleExactGetByIdCalls += 1;
      if (sessionId !== 's3-stale-list') {
        return undefined;
      }

      if (staleExactGetByIdCalls === 1) {
        return {
          id: 's3-stale-list',
          title: 'session-3-stale-list',
          lastUpdated: '2026-04-11T02:45:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-stale-list.jsonl'
        };
      }

      return {
        id: 's3-stale-list',
        title: 'session-3-stale-list',
        lastUpdated: '2026-04-11T02:45:03.000Z',
        mode: undefined,
        agent: 'agent-architect',
        model: undefined,
        hasPendingEdits: false,
        pendingRequestCount: 0,
        lastRequestCompleted: true,
        archived: false,
        provider: 'workspaceStorage',
        sessionFile: '/tmp/s3-stale-list.jsonl'
      };
    };

    const exactFreshGetByIdResult = await exactFreshGetByIdService.sendFocusedMessage({
      prompt: 'hello',
      agentName: 'agent-architect',
      requireSelectionEvidence: false,
      blockOnResponse: true,
      expectedFocusedSessionId: 's3-stale-list'
    });
    assert(exactFreshGetByIdResult.ok === true, `Blocking focused-send did not use exact-session polling when listSessions stayed stale but getSessionById was fresh. Got: ${exactFreshGetByIdResult.reason}`);
    assert(exactFreshGetByIdResult.session?.id === 's3-stale-list', `Blocking focused-send exact-session polling regression returned the wrong session. Got: ${JSON.stringify(exactFreshGetByIdResult.session)}`);
    assert(staleExactGetByIdCalls >= 2, `Blocking focused-send exact-session polling regression did not poll getSessionById as expected. Got calls: ${staleExactGetByIdCalls}`);

    MockChatSessionStorage.setBehaviors([
      [
        {
          id: 's3-unlocked',
          title: 'session-3-unlocked',
          lastUpdated: '2026-04-11T02:00:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-unlocked.jsonl'
        }
      ],
      [
        {
          id: 's3-unlocked',
          title: 'session-3-unlocked',
          lastUpdated: '2026-04-11T02:00:01.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s3-unlocked.jsonl'
        }
      ]
    ]);

    const unlockedFocusedService = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 1000, waitForPersistedDefault: true });
    unlockedFocusedService.getFocusedChatInteropSupport = service.getFocusedChatInteropSupport;
    const originalWaitForFocusedSessionMutation = unlockedFocusedService.waitForFocusedSessionMutation;
    unlockedFocusedService.waitForFocusedSessionMutation = async function (...args) {
      assert(this.mutex?.isLocked?.() === false, 'Focused send kept the live-chat mutex locked while waiting for persisted settle state.');
      return originalWaitForFocusedSessionMutation.apply(this, args);
    };

    const unlockedFocusedResult = await unlockedFocusedService.sendFocusedMessage({ prompt: 'hello', agentName: 'agent-architect', requireSelectionEvidence: false, blockOnResponse: true });
    assert(unlockedFocusedResult.ok === true, 'Focused-send mutex-release test did not succeed after dispatch.');

    // Host full-state snapshots can retain hasPendingEdits=true even after the request has completed.
    MockChatSessionStorage.setBehaviors([
      [
        {
          id: 's4',
          title: 'session-4',
          lastUpdated: '2026-04-11T03:00:00.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s4.jsonl'
        }
      ],
      [
        {
          id: 's4',
          title: 'session-4',
          lastUpdated: '2026-04-11T03:00:01.000Z',
          mode: undefined,
          agent: 'agent-architect',
          model: undefined,
          hasPendingEdits: true,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/s4.jsonl'
        }
      ]
    ]);

    const service4 = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 1000, waitForPersistedDefault: true });
    service4.getFocusedChatInteropSupport = service.getFocusedChatInteropSupport;

    const stalePendingFlagResult = await service4.sendFocusedMessage({ prompt: 'hello', agentName: 'agent-architect', requireSelectionEvidence: false, blockOnResponse: true });
    assert(stalePendingFlagResult.ok === true, 'Blocking focused-send incorrectly treated a stale hasPendingEdits flag as unsettled after completion.');
    assert(stalePendingFlagResult.session?.id === 's4', 'Blocking focused-send returned the wrong session for the stale hasPendingEdits case.');

    const unsettledRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-unsettled-session-'));
    try {
      const unsettledSessionFile = path.join(unsettledRoot, 'chatSessions', 's5.jsonl');
      const unsettledTranscriptFile = path.join(unsettledRoot, 'GitHub.copilot-chat', 'transcripts', 's5.jsonl');
      await fs.mkdir(path.dirname(unsettledSessionFile), { recursive: true });
      await fs.mkdir(path.dirname(unsettledTranscriptFile), { recursive: true });
      await fs.writeFile(unsettledSessionFile, '{}\n', 'utf8');
      await fs.writeFile(unsettledTranscriptFile, `${[
        JSON.stringify({ type: 'session.start', data: { sessionId: 's5' } }),
        JSON.stringify({ type: 'user.message', data: { content: 'hello' } }),
        JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '0' } }),
        JSON.stringify({
          type: 'assistant.message',
          data: {
            content: 'Planning step',
            toolRequests: [{ toolCallId: 'call-1', name: 'manage_todo_list', type: 'function' }]
          }
        }),
        JSON.stringify({ type: 'assistant.turn_end', data: { turnId: '0' } }),
        JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '1' } })
      ].join('\n')}\n`, 'utf8');

      MockChatSessionStorage.setBehaviors([
        [
          {
            id: 's5',
            title: 'session-5',
            lastUpdated: '2026-04-11T04:00:00.000Z',
            mode: undefined,
            agent: 'agent-architect',
            model: undefined,
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true,
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: unsettledSessionFile
          }
        ],
        [
          {
            id: 's5',
            title: 'session-5',
            lastUpdated: '2026-04-11T04:00:01.000Z',
            mode: undefined,
            agent: 'agent-architect',
            model: undefined,
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: false,
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: unsettledSessionFile
          }
        ]
      ]);

      const service5 = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 80, waitForPersistedDefault: true });
      service5.getFocusedChatInteropSupport = service.getFocusedChatInteropSupport;

      const unfinishedAgentTurnResult = await service5.sendFocusedMessage({ prompt: 'hello', agentName: 'agent-architect', requireSelectionEvidence: false, blockOnResponse: true });
      assert(unfinishedAgentTurnResult.ok === false, 'Blocking focused-send unexpectedly succeeded for an unfinished assistant tool turn.');
      assert(
        typeof unfinishedAgentTurnResult.reason === 'string' && unfinishedAgentTurnResult.reason.includes('no tool result or final answer was ever persisted'),
        'Blocking focused-send did not diagnose the unfinished assistant tool turn after timeout.'
      );
    } finally {
      await fs.rm(unsettledRoot, { recursive: true, force: true });
    }

    const laggingTranscriptRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-lagging-transcript-session-'));
    try {
      const laggingSessionFile = path.join(laggingTranscriptRoot, 'chatSessions', 's6.jsonl');
      const laggingTranscriptFile = path.join(laggingTranscriptRoot, 'GitHub.copilot-chat', 'transcripts', 's6.jsonl');
      await fs.mkdir(path.dirname(laggingSessionFile), { recursive: true });
      await fs.mkdir(path.dirname(laggingTranscriptFile), { recursive: true });
      await fs.writeFile(laggingSessionFile, `${[
        JSON.stringify({
          kind: 0,
          v: {
            version: 3,
            creationDate: 1778251857000,
            sessionId: 's6',
            responderUsername: 'GitHub Copilot',
            requests: [{
              requestId: 'request-lagging',
              timestamp: 1778251857321,
              response: [{ value: 'LIVE_WAIT_OK' }],
              result: { details: 'GPT-5.4 • 1x' },
              completionTokens: 37,
              elapsedMs: 3758,
              message: { text: 'hello' }
            }]
          }
        })
      ].join('\n')}\n`, 'utf8');
      await fs.writeFile(laggingTranscriptFile, `${[
        JSON.stringify({ type: 'session.start', data: { sessionId: 's6' } }),
        JSON.stringify({ type: 'user.message', data: { content: 'hello' } }),
        JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '0' } })
      ].join('\n')}\n`, 'utf8');

      MockChatSessionStorage.setBehaviors([
        [
          {
            id: 's6',
            title: 'session-6',
            lastUpdated: '2026-05-08T14:50:56.000Z',
            mode: undefined,
            agent: 'agent-architect',
            model: undefined,
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true,
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: laggingSessionFile
          }
        ],
        [
          {
            id: 's6',
            title: 'session-6',
            lastUpdated: '2026-05-08T14:50:57.321Z',
            mode: undefined,
            agent: 'agent-architect',
            model: undefined,
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true,
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: laggingSessionFile
          }
        ]
      ]);

      const laggingTranscriptService = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 250, waitForPersistedDefault: true });
      laggingTranscriptService.getFocusedChatInteropSupport = service.getFocusedChatInteropSupport;

      const laggingTranscriptResult = await laggingTranscriptService.sendFocusedMessage({ prompt: 'hello', agentName: 'agent-architect', requireSelectionEvidence: false, blockOnResponse: true });
      assert(laggingTranscriptResult.ok === true, `Blocking focused-send did not accept a lagging transcript once the latest request had a persisted response and result. Got: ${laggingTranscriptResult.reason}`);
      assert(laggingTranscriptResult.session?.id === 's6', 'Blocking focused-send lagging-transcript override returned the wrong session.');
    } finally {
      await fs.rm(laggingTranscriptRoot, { recursive: true, force: true });
    }

      const staticTimestampFocusedRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-static-timestamp-focused-'));
      try {
        const staticTimestampFocusedSessionFile = path.join(staticTimestampFocusedRoot, 'chatSessions', 's7.jsonl');
        const staticTimestampFocusedTranscriptFile = path.join(staticTimestampFocusedRoot, 'GitHub.copilot-chat', 'transcripts', 's7.jsonl');
        await fs.mkdir(path.dirname(staticTimestampFocusedSessionFile), { recursive: true });
        await fs.mkdir(path.dirname(staticTimestampFocusedTranscriptFile), { recursive: true });
        await fs.writeFile(staticTimestampFocusedSessionFile, '{}\n', 'utf8');
        await fs.writeFile(staticTimestampFocusedTranscriptFile, `${[
          JSON.stringify({ type: 'session.start', data: { sessionId: 's7' }, timestamp: '2026-05-08T14:40:00.000Z' }),
          JSON.stringify({ type: 'user.message', data: { content: 'hello' }, timestamp: '2026-05-08T14:40:00.100Z' }),
          JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '0' }, timestamp: '2026-05-08T14:40:00.200Z' })
        ].join('\n')}\n`, 'utf8');

        let staticTimestampFocusedAppended = false;
        MockChatSessionStorage.setBehaviors([
          [
            {
              id: 's7',
              title: 'session-7',
              lastUpdated: '2026-04-11T06:00:00.000Z',
              mode: undefined,
              agent: 'agent-architect',
              model: undefined,
              hasPendingEdits: false,
              pendingRequestCount: 0,
              lastRequestCompleted: true,
              archived: false,
              provider: 'workspaceStorage',
              sessionFile: staticTimestampFocusedSessionFile
            }
          ],
          async () => {
            if (!staticTimestampFocusedAppended) {
              staticTimestampFocusedAppended = true;
              await fs.appendFile(staticTimestampFocusedSessionFile, `${JSON.stringify({
                kind: 2,
                k: ['requests'],
                v: [{
                  requestId: 'request-static-timestamp-focused',
                  timestamp: 1778251857321,
                  result: { details: 'GPT-5.4 • 1x' },
                  message: { text: 'hello' }
                }]
              })}\n`, 'utf8');
            }

            return [{
              id: 's7',
              title: 'session-7',
              lastUpdated: '2026-04-11T06:00:00.000Z',
              mode: undefined,
              agent: 'agent-architect',
              model: undefined,
              hasPendingEdits: false,
              pendingRequestCount: 0,
              lastRequestCompleted: true,
              archived: false,
              provider: 'workspaceStorage',
              sessionFile: staticTimestampFocusedSessionFile
            }];
          }
        ]);

        const staticTimestampFocusedService = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 1500, waitForPersistedDefault: true });
        staticTimestampFocusedService.getFocusedChatInteropSupport = service.getFocusedChatInteropSupport;
        let staticTimestampFocusedWaitResult;
        let staticTimestampFocusedBeforeBaseline;
        const originalStaticTimestampFocusedWait = staticTimestampFocusedService.waitForFocusedSessionMutation;
        staticTimestampFocusedService.waitForFocusedSessionMutation = async function (...args) {
          staticTimestampFocusedBeforeBaseline = args[0]?.get?.('s7');
          staticTimestampFocusedWaitResult = await originalStaticTimestampFocusedWait.apply(this, args);
          return staticTimestampFocusedWaitResult;
        };

        const staticTimestampFocusedResult = await staticTimestampFocusedService.sendFocusedMessage({ prompt: 'hello', agentName: 'agent-architect', requireSelectionEvidence: false, blockOnResponse: true });
        const staticTimestampFocusedCurrentStats = await fs.stat(staticTimestampFocusedSessionFile);
        assert(staticTimestampFocusedResult.ok === true, `Blocking focused-send did not accept a session-file mutation when lastUpdated stayed unchanged. Got: ${staticTimestampFocusedResult.reason}. Wait result: ${JSON.stringify(staticTimestampFocusedWaitResult)}. Baseline: ${JSON.stringify(staticTimestampFocusedBeforeBaseline)}. Current file stats: ${JSON.stringify({ size: staticTimestampFocusedCurrentStats.size, mtimeMs: staticTimestampFocusedCurrentStats.mtimeMs })}`);
        assert(staticTimestampFocusedResult.session?.id === 's7', 'Blocking focused-send static-timestamp test returned the wrong session.');
      } finally {
        await fs.rm(staticTimestampFocusedRoot, { recursive: true, force: true });
      }

    fs.mkdir = originalMkdir;
    fs.writeFile = originalWriteFile;
    fs.rm = originalRm;
    vscodeModule.commands.getCommands = originalGetCommands;
    vscodeModule.commands.executeCommand = originalExecuteCommand;
  } finally {
    storageModule.ChatSessionStorage = originalChatSessionStorage;
  }

}

async function runCreateChatDirectAgentCommandChecks() {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const vscodeModule = require('vscode');
  vscodeModule.workspace = vscodeModule.workspace || {};
  const storageModule = require(distChatInteropStorage);
  const originalChatSessionStorage = storageModule.ChatSessionStorage;

  class MockChatSessionStorage {
    constructor(_context, _options) {
      this._call = 0;
    }
    static setBehaviors(behaviors) {
      MockChatSessionStorage._behaviors = behaviors || [];
    }
    async listSessions() {
      this._call = (this._call || 0) + 1;
      const seq = MockChatSessionStorage._behaviors || [];
      const idx = Math.min(this._call - 1, Math.max(0, seq.length - 1));
      return seq[idx] || [];
    }
    async getSessionById(id) {
      return (await this.listSessions()).find((item) => item.id === id);
    }
  }

  storageModule.ChatSessionStorage = MockChatSessionStorage;

  const executedCommands = [];
  const originalExecuteCommand = vscodeModule.commands.executeCommand;
  const originalGetCommands = vscodeModule.commands.getCommands;
  const originalMkdir = fs.mkdir;
  const originalWriteFile = fs.writeFile;
  const originalRm = fs.rm;
  const fsOps = [];

  try {
    vscodeModule.commands.getCommands = async () => [
      'workbench.action.openChat',
      'workbench.action.chat.open',
      'workbench.action.chat.focusInput',
      'workbench.action.chat.submit',
      'workbench.action.chat.openagent-architect'
    ];
    vscodeModule.commands.executeCommand = async (command, args) => {
      executedCommands.push({ command, args });
      return undefined;
    };
    fs.mkdir = async (...args) => {
      const targetPath = typeof args[0] === 'string' ? args[0] : String(args[0]);
      if (targetPath.includes(`${path.sep}User${path.sep}prompts`)) {
        fsOps.push({ op: 'mkdir', args });
        return undefined;
      }

      return originalMkdir(...args);
    };
    fs.writeFile = async (...args) => {
      const targetPath = typeof args[0] === 'string' ? args[0] : String(args[0]);
      if (targetPath.endsWith('.prompt.md')) {
        fsOps.push({ op: 'writeFile', args });
        return undefined;
      }

      return originalWriteFile(...args);
    };
    fs.rm = async (...args) => {
      const targetPath = typeof args[0] === 'string' ? args[0] : String(args[0]);
      if (targetPath.endsWith('.prompt.md')) {
        fsOps.push({ op: 'rm', args });
        return undefined;
      }

      return originalRm(...args);
    };

    MockChatSessionStorage.setBehaviors([
      [],
      [
        {
          id: 'session-direct-agent',
          title: 'Direct Agent Open Session',
          lastUpdated: '2026-04-17T20:00:00.000Z',
          mode: 'file:///tmp/agent-architect.agent.md',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-direct-agent.jsonl',
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true
        }
      ]
    ]);

    const serviceModule = await import(pathToFileURL(distChatInteropService).href);
    const unsettledDiagnosticsModule = await import(pathToFileURL(distChatInteropUnsettledDiagnostics).href);
    const { ChatInteropService } = serviceModule;
    const { getSessionQuiescenceState } = unsettledDiagnosticsModule;
    const service = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 250 });

    const result = await service.createChat({
      prompt: 'Create a local recovery tools helper named artifact-list-item-checker using the provided build input.',
      agentName: 'agent-architect',
      requireSelectionEvidence: false,
      blockOnResponse: true
    });

    assert(result.ok === true, 'Agent-bound createChat test did not succeed when a session was created and settled.');
    assert(executedCommands[0]?.command === 'workbench.action.openChat', 'Agent-bound createChat test did not open a new chat editor first.');
    assert(executedCommands[1]?.command === 'workbench.action.focusActiveEditorGroup', 'Agent-bound createChat test did not refocus the new editor chat group after opening it.');
    assert(executedCommands[2]?.command === 'workbench.action.chat.openagent-architect', 'Agent-bound createChat test did not use the direct agent-open command when the host exposed one.');
    assert(executedCommands[3]?.command === 'workbench.action.chat.open', 'Agent-bound createChat test did not dispatch the real prompt through chat-open after direct agent selection.');
    assert(executedCommands[3]?.args?.query === 'Create a local recovery tools helper named artifact-list-item-checker using the provided build input.', `Agent-bound createChat test did not dispatch the original prompt after direct agent-open. Got: ${executedCommands[3]?.args?.query}`);
    assert(executedCommands[3]?.args?.isPartialQuery === false, 'Agent-bound createChat test did not dispatch the generated slash command as a real query.');
    assert(executedCommands[3]?.args?.blockOnResponse === true, 'Agent-bound createChat test did not preserve awaited dispatch on the direct agent-open path.');
    assert(executedCommands.length === 4, `Agent-bound createChat test executed unexpected extra commands on the direct agent-open path. Got: ${JSON.stringify(executedCommands)}`);
    assert(fsOps.length === 0, 'Agent-bound createChat test should not create prompt artifacts when a direct agent-open command is available.');

    executedCommands.length = 0;
    fsOps.length = 0;
    MockChatSessionStorage.setBehaviors([
      [],
      [
        {
          id: 'session-direct-agent-verified',
          title: 'Direct Agent Open Verified Session',
          lastUpdated: '2026-04-17T20:02:00.000Z',
          mode: 'file:///tmp/agent-architect.agent.md',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-direct-agent-verified.jsonl',
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true
        }
      ]
    ]);

    const strictVerifiedService = new ChatInteropService({}, { openDelayMs: 0, postCreateDelayMs: 10, postCreateTimeoutMs: 250 });
    const strictVerifiedResult = await strictVerifiedService.createChat({
      prompt: 'Require post-create participant evidence for this direct agent-open session.',
      agentName: 'agent-architect',
      requireSelectionEvidence: true,
      blockOnResponse: true
    });

    assert(strictVerifiedResult.ok === true, `Strict createChat verification did not accept matching mode-backed evidence after dispatch. Got: ${strictVerifiedResult.reason}`);
    assert(strictVerifiedResult.selection?.agent.status === 'verified', 'Strict createChat verification did not preserve verified agent evidence for the direct agent-open path.');

    executedCommands.length = 0;
    fsOps.length = 0;
    MockChatSessionStorage.setBehaviors([
      [],
      [
        {
          id: 'session-unlocked-wait',
          title: 'Unlocked Wait Session',
          lastUpdated: '2026-04-17T20:05:00.000Z',
          mode: 'file:///tmp/agent-architect.agent.md',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-unlocked-wait.jsonl',
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true
        }
      ]
    ]);

    const unlockedWaitService = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 250 });
    const originalWaitForCreatedSession = unlockedWaitService.waitForCreatedSession;
    unlockedWaitService.waitForCreatedSession = async function (...args) {
      assert(this.mutex?.isLocked?.() === false, 'CreateChat kept the live-chat mutex locked while waiting for persisted settle state.');
      return originalWaitForCreatedSession.apply(this, args);
    };

    const unlockedWaitResult = await unlockedWaitService.createChat({
      prompt: 'Verify that the create mutex is released before the settle wait begins.',
      agentName: 'agent-architect',
      requireSelectionEvidence: false,
      blockOnResponse: true
    });

    assert(unlockedWaitResult.ok === true, 'CreateChat mutex-release test did not succeed after dispatch.');

    executedCommands.length = 0;
    fsOps.length = 0;
    MockChatSessionStorage.setBehaviors([
      [],
      [
        {
          id: 'session-placeholder',
          title: 'Placeholder Session',
          lastUpdated: '2026-04-17T20:10:00.000Z',
          mode: 'file:///tmp/agent-architect.agent.md',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-placeholder.jsonl',
          hasPendingEdits: true,
          pendingRequestCount: 1,
          lastRequestCompleted: false
        }
      ],
      [
        {
          id: 'session-placeholder',
          title: 'Placeholder Session',
          lastUpdated: '2026-04-17T20:10:00.000Z',
          mode: 'file:///tmp/agent-architect.agent.md',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-placeholder.jsonl',
          hasPendingEdits: true,
          pendingRequestCount: 1,
          lastRequestCompleted: false
        },
        {
          id: 'session-real',
          title: 'Real Session',
          lastUpdated: '2026-04-17T20:10:05.000Z',
          mode: 'file:///tmp/agent-architect.agent.md',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-real.jsonl',
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true
        }
      ]
    ]);

    const serviceLatest = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 1000 });
    const latestResult = await serviceLatest.createChat({
      prompt: 'Prefer the newest created session.',
      agentName: 'agent-architect',
      requireSelectionEvidence: false,
      blockOnResponse: true
    });

    assert(latestResult.ok === true, 'Direct agent-open createChat test did not recover when the host created a placeholder session before the real session.');
    assert(latestResult.session?.id === 'session-real', `Direct agent-open createChat test did not pick the latest real session. Got: ${latestResult.session?.id}`);

    MockChatSessionStorage.setBehaviors([
      [],
      [
        {
          id: 'session-contaminated',
          title: 'Contaminated Session',
          lastUpdated: '2026-04-17T20:11:00.000Z',
          mode: 'file:///tmp/agent-architect.agent.md',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-contaminated.jsonl',
          hasControlThreadArtifacts: true,
          controlThreadArtifactKinds: ['manage_todo_list'],
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true
        }
      ],
      [
        {
          id: 'session-contaminated',
          title: 'Contaminated Session',
          lastUpdated: '2026-04-17T20:11:00.000Z',
          mode: 'file:///tmp/agent-architect.agent.md',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-contaminated.jsonl',
          hasControlThreadArtifacts: true,
          controlThreadArtifactKinds: ['manage_todo_list'],
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true
        },
        {
          id: 'session-clean',
          title: 'Clean Session',
          lastUpdated: '2026-04-17T20:11:05.000Z',
          mode: 'file:///tmp/agent-architect.agent.md',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-clean.jsonl',
          hasControlThreadArtifacts: false,
          controlThreadArtifactKinds: [],
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true
        }
      ]
    ]);

    const serviceClean = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 1000 });
    const cleanResult = await serviceClean.createChat({
      prompt: 'Prefer a clean created session over a contaminated one.',
      agentName: 'agent-architect',
      requireSelectionEvidence: false,
      blockOnResponse: true
    });

    assert(cleanResult.ok === true, 'Direct agent-open createChat test did not succeed when a clean session arrived after a contaminated one.');
    assert(cleanResult.session?.id === 'session-clean', `Direct agent-open createChat test did not prefer the clean created session. Got: ${cleanResult.session?.id}`);

    MockChatSessionStorage.setBehaviors([
      [],
      []
    ]);

    const timeoutCreateService = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 50 });
    const timeoutCreateResult = await timeoutCreateService.createChat({
      prompt: 'This create should time out without any persisted session appearing.',
      agentName: 'agent-architect',
      requireSelectionEvidence: false,
      blockOnResponse: true
    });

    assert(timeoutCreateResult.ok === false, 'Direct agent-open createChat test incorrectly treated create-time timeout as success.');
    assert(
      timeoutCreateResult.reason === 'Create chat dispatched but no persisted created session was observed within the expected timeout.',
      `Direct agent-open createChat test did not surface the expected create-time timeout failure. Got: ${timeoutCreateResult.reason}`
    );

    const laggingTranscriptCreateRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-lagging-transcript-create-'));
    try {
      const laggingCreateSessionFile = path.join(laggingTranscriptCreateRoot, 'chatSessions', 'create-lagging.jsonl');
      const laggingCreateTranscriptFile = path.join(laggingTranscriptCreateRoot, 'GitHub.copilot-chat', 'transcripts', 'create-lagging.jsonl');
      await originalMkdir(path.dirname(laggingCreateSessionFile), { recursive: true });
      await originalMkdir(path.dirname(laggingCreateTranscriptFile), { recursive: true });
      await originalWriteFile(laggingCreateSessionFile, `${[
        JSON.stringify({
          kind: 0,
          v: {
            version: 3,
            creationDate: 1778251857000,
            sessionId: 'create-lagging',
            responderUsername: 'GitHub Copilot',
            requests: [{
              requestId: 'request-create-lagging',
              timestamp: 1778251857321,
              response: [{ value: 'LIVE_WAIT_OK' }],
              result: { details: 'GPT-5.4 • 1x' },
              completionTokens: 37,
              elapsedMs: 3758,
              message: { text: 'Svara endast LIVE_WAIT_OK.' }
            }]
          }
        })
      ].join('\n')}\n`, 'utf8');
      await originalWriteFile(laggingCreateTranscriptFile, `${[
        JSON.stringify({ type: 'session.start', data: { sessionId: 'create-lagging' } }),
        JSON.stringify({ type: 'user.message', data: { content: 'Svara endast LIVE_WAIT_OK.' } }),
        JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '0' } })
      ].join('\n')}\n`, 'utf8');

      MockChatSessionStorage.setBehaviors([
        [],
        [
          {
            id: 'create-lagging',
            title: 'Create Lagging Transcript Session',
            lastUpdated: '2026-05-08T14:50:57.321Z',
            mode: 'file:///tmp/agent-architect.agent.md',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: laggingCreateSessionFile,
            hasPendingEdits: false,
            pendingRequestCount: 1,
            lastRequestCompleted: false
          }
        ]
      ]);

      const laggingCreateService = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 250 });
      const laggingCreateResult = await laggingCreateService.createChat({
        prompt: 'Create should succeed when the session file has a final result even if the transcript lags.',
        agentName: 'agent-architect',
        requireSelectionEvidence: false,
        blockOnResponse: true
      });

      assert(laggingCreateResult.ok === true, `CreateChat did not accept a lagging transcript once the latest request had a persisted response and result, even when the summary still looked stale. Got: ${laggingCreateResult.reason}`);
      assert(laggingCreateResult.session?.id === 'create-lagging', 'CreateChat lagging-transcript override returned the wrong session.');

      const laggingCreateQuiescence = await getSessionQuiescenceState({
        id: 'create-lagging',
        title: 'Create Lagging Transcript Session',
        lastUpdated: '2026-05-08T14:50:57.321Z',
        mode: 'file:///tmp/agent-architect.agent.md',
        agent: 'github.copilot.editsAgent',
        model: 'copilot/gpt-5-mini',
        archived: false,
        provider: 'workspaceStorage',
        sessionFile: laggingCreateSessionFile,
        hasPendingEdits: false,
        pendingRequestCount: 1,
        lastRequestCompleted: false
      });

      assert(laggingCreateQuiescence.settled === true, 'Lagging-transcript quiescence should settle once the persisted latest request has both response and result.');
      assert(laggingCreateQuiescence.transcriptSettled === true, 'Lagging-transcript quiescence should mark the transcript slice settled once the persisted tail overrides it.');
      assert(laggingCreateQuiescence.transcriptReason === undefined, `Lagging-transcript quiescence should not retain an unsettled transcriptReason after the persisted tail override. Got: ${laggingCreateQuiescence.transcriptReason}`);
    } finally {
      await originalRm(laggingTranscriptCreateRoot, { recursive: true, force: true });
    }

    const unsettledCreateRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-unsettled-create-'));
    try {
      const unsettledCreateSessionFile = path.join(unsettledCreateRoot, 'chatSessions', 'create-unsettled.jsonl');
      const unsettledCreateTranscriptFile = path.join(unsettledCreateRoot, 'GitHub.copilot-chat', 'transcripts', 'create-unsettled.jsonl');
      await originalMkdir(path.dirname(unsettledCreateSessionFile), { recursive: true });
      await originalMkdir(path.dirname(unsettledCreateTranscriptFile), { recursive: true });
      await originalWriteFile(unsettledCreateSessionFile, '{}\n', 'utf8');
      await originalWriteFile(unsettledCreateTranscriptFile, `${[
        JSON.stringify({ type: 'session.start', data: { sessionId: 'create-unsettled' } }),
        JSON.stringify({ type: 'user.message', data: { content: 'create probe' } }),
        JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '0' } }),
        JSON.stringify({
          type: 'assistant.message',
          data: {
            content: 'Planning follow-up',
            toolRequests: [{ toolCallId: 'create-call-1', name: 'read_file', type: 'function' }]
          }
        })
      ].join('\n')}\n`, 'utf8');

      MockChatSessionStorage.setBehaviors([
        [],
        [
          {
            id: 'create-unsettled',
            title: 'Create Unsettled Session',
            lastUpdated: '2026-05-08T18:00:00.000Z',
            mode: 'file:///tmp/agent-architect.agent.md',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: unsettledCreateSessionFile,
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true
          }
        ]
      ]);

      const unsettledCreateService = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 80 });
      const unsettledCreateResult = await unsettledCreateService.createChat({
        prompt: 'Create a session that looks settled in summary but still has transcript-side tool activity.',
        agentName: 'agent-architect',
        requireSelectionEvidence: false,
        blockOnResponse: true
      });

      assert(unsettledCreateResult.ok === false, 'CreateChat unexpectedly succeeded when summary looked settled but the companion transcript still showed unfinished tool activity.');
      assert(
        typeof unsettledCreateResult.reason === 'string' && unsettledCreateResult.reason.includes('unfinished assistant step after requesting a tool'),
        `CreateChat did not preserve the transcript-aware unsettled diagnostic for false settled summaries. Got: ${unsettledCreateResult.reason}`
      );
    } finally {
      await originalRm(unsettledCreateRoot, { recursive: true, force: true });
    }

    const missingTranscriptCreateRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-missing-transcript-create-'));
    try {
      const missingTranscriptSessionFile = path.join(missingTranscriptCreateRoot, 'chatSessions', 'create-missing-transcript.jsonl');
      await originalMkdir(path.dirname(missingTranscriptSessionFile), { recursive: true });
      await originalWriteFile(missingTranscriptSessionFile, `${[
        JSON.stringify({
          kind: 2,
          k: ['requests'],
          v: [{
            requestId: 'request-create-missing-transcript',
            timestamp: 1778251857321,
            message: { text: 'still running' }
          }]
        })
      ].join('\n')}\n`, 'utf8');

      MockChatSessionStorage.setBehaviors([
        [],
        [
          {
            id: 'create-missing-transcript',
            title: 'Create Missing Transcript Session',
            lastUpdated: new Date().toISOString(),
            mode: 'file:///tmp/agent-architect.agent.md',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: missingTranscriptSessionFile,
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true
          }
        ]
      ]);

      const missingTranscriptCreateService = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 80 });
      const missingTranscriptCreateResult = await missingTranscriptCreateService.createChat({
        prompt: 'Create should not settle from summary alone when the transcript is missing and the session tail is incomplete.',
        agentName: 'agent-architect',
        requireSelectionEvidence: false,
        blockOnResponse: true
      });

      assert(missingTranscriptCreateResult.ok === false, 'CreateChat incorrectly treated a missing transcript plus incomplete session tail as settled.');
      assert(
        typeof missingTranscriptCreateResult.reason === 'string' && missingTranscriptCreateResult.reason.includes('companion transcript is not yet readable'),
        `CreateChat did not surface the missing-transcript unsettled diagnostic. Got: ${missingTranscriptCreateResult.reason}`
      );
    } finally {
      await originalRm(missingTranscriptCreateRoot, { recursive: true, force: true });
    }

    executedCommands.length = 0;
    fsOps.length = 0;

    let promptAgentRoot;
    const originalWorkspace = vscodeModule.workspace;
    const originalWorkspaceFolders = originalWorkspace?.workspaceFolders;
    try {
      promptAgentRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-prompt-agent-'));
      const promptAgentDir = path.join(promptAgentRoot, '.github', 'agents');
      await originalMkdir(promptAgentDir, { recursive: true });
      await originalWriteFile(path.join(promptAgentDir, 'anchor-senior.agent.md'), '---\nname: Anchor Senior\n---\n\n# test\n', 'utf8');
      vscodeModule.workspace = vscodeModule.workspace || {};
      vscodeModule.workspace.workspaceFolders = [{ uri: { fsPath: promptAgentRoot } }];

      vscodeModule.commands.getCommands = async () => [
        'workbench.action.openChat',
        'workbench.action.chat.open',
        'workbench.action.chat.focusInput',
        'workbench.action.chat.submit'
      ];

      MockChatSessionStorage.setBehaviors([
        [],
        [
          {
            id: 'session-prompt-file',
            title: 'Prompt File Session',
            lastUpdated: '2026-05-07T10:40:00.000Z',
            mode: 'file:///tmp/anchor-senior.agent.md',
            agent: 'anchor-senior',
            model: 'copilot/gpt-5.4',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: '/tmp/session-prompt-file.jsonl',
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true
          }
        ]
      ]);

      const promptFileService = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 250, promptRegistrationDelayMs: 0 });
      const promptFileResult = await promptFileService.createChat({
        prompt: 'Run the disposable probe.',
        agentName: 'anchor-senior',
        requireSelectionEvidence: false,
        blockOnResponse: true
      });

      assert(promptFileResult.ok === true, `Prompt-file createChat test did not succeed when a session was created and settled. Got: ${promptFileResult.reason}`);
      assert(executedCommands[0]?.command === 'workbench.action.openChat', 'Prompt-file createChat test did not open a new chat editor first.');
      assert(executedCommands[1]?.command === 'workbench.action.focusActiveEditorGroup', 'Prompt-file createChat test did not refocus the new editor chat group after opening it.');
      assert(executedCommands[2]?.command === 'workbench.action.chat.focusInput', 'Prompt-file createChat test did not focus the chat input before slash-command prefill.');
      assert(executedCommands[3]?.command === 'workbench.action.chat.open', 'Prompt-file createChat test did not dispatch the generated slash command through chat-open.');
      assert(executedCommands[3]?.args?.query?.startsWith('/aa-live-chat-anchor-senior-') === true, `Prompt-file createChat test did not dispatch the generated slash command. Got: ${executedCommands[3]?.args?.query}`);
      assert(executedCommands[3]?.args?.isPartialQuery === false, 'Prompt-file createChat test did not dispatch the generated slash command as a real query.');
      assert(executedCommands[4]?.command === 'workbench.action.chat.focusInput', 'Prompt-file createChat test did not refocus the chat input after slash-command prefill.');
      assert(executedCommands[5]?.command === 'workbench.action.chat.submit', 'Prompt-file createChat test did not explicitly submit the slash-command dispatch.');
      assert(fsOps.some((entry) => entry.op === 'writeFile') === true, 'Prompt-file createChat test did not write the temporary prompt artifact.');
      assert(fsOps.some((entry) => entry.op === 'writeFile' && String(entry.args?.[1]).includes('agent: "Anchor Senior"')) === true, 'Prompt-file createChat test did not encode the resolved workspace custom-agent name in the temporary prompt artifact.');
      assert(fsOps.some((entry) => entry.op === 'rm') === true, 'Prompt-file createChat test did not clean up the temporary prompt artifact.');

      executedCommands.length = 0;
      fsOps.length = 0;
      MockChatSessionStorage.setBehaviors([
        [],
        [
          {
            id: 'session-prompt-file-verified',
            title: 'Prompt File Verified Session',
            lastUpdated: '2026-05-07T10:41:00.000Z',
            mode: 'file:///tmp/anchor-senior.agent.md',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5.4',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: '/tmp/session-prompt-file-verified.jsonl',
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true
          }
        ]
      ]);

      const strictPromptFileService = new ChatInteropService({}, { openDelayMs: 0, postCreateDelayMs: 10, postCreateTimeoutMs: 250, promptRegistrationDelayMs: 0 });
      const strictPromptFileResult = await strictPromptFileService.createChat({
        prompt: 'Require post-create participant evidence for this prompt-file session.',
        agentName: 'anchor-senior',
        requireSelectionEvidence: true,
        blockOnResponse: true
      });

      assert(strictPromptFileResult.ok === true, `Strict prompt-file createChat verification did not accept matching mode-backed evidence after dispatch. Got: ${strictPromptFileResult.reason}`);
      assert(strictPromptFileResult.selection?.agent.status === 'verified', 'Strict prompt-file createChat verification did not preserve verified agent evidence after fallback dispatch.');

      executedCommands.length = 0;
      fsOps.length = 0;
      MockChatSessionStorage.setBehaviors([
        [],
        [
          {
            id: 'session-prompt-file-unverified',
            title: 'Prompt File Unverified Session',
            lastUpdated: '2026-05-07T10:42:00.000Z',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5.4',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: '/tmp/session-prompt-file-unverified.jsonl',
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true
          }
        ],
        [
          {
            id: 'session-prompt-file-unverified',
            title: 'Prompt File Unverified Session',
            lastUpdated: '2026-05-07T10:42:00.000Z',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5.4',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: '/tmp/session-prompt-file-unverified.jsonl',
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true
          }
        ]
      ]);

      const strictPromptFileFailureService = new ChatInteropService({}, { openDelayMs: 0, postCreateDelayMs: 10, postCreateTimeoutMs: 1000, promptRegistrationDelayMs: 0 });
      const strictPromptFileFailureStartedAt = Date.now();
      const strictPromptFileFailureResult = await strictPromptFileFailureService.createChat({
        prompt: 'Fail quickly when fallback dispatch never yields persisted participant proof.',
        agentName: 'anchor-senior',
        requireSelectionEvidence: true,
        blockOnResponse: true
      });
      const strictPromptFileFailureElapsedMs = Date.now() - strictPromptFileFailureStartedAt;

      assert(strictPromptFileFailureResult.ok === false, 'Strict prompt-file createChat verification unexpectedly succeeded without persisted participant evidence.');
      assert(
        typeof strictPromptFileFailureResult.reason === 'string' && strictPromptFileFailureResult.reason.includes('Requested selection could not be fully evidenced'),
        `Strict prompt-file createChat verification did not report a post-dispatch selection-evidence failure. Got: ${strictPromptFileFailureResult.reason}`
      );
      assert(
        strictPromptFileFailureElapsedMs < 1500,
        `Strict prompt-file createChat verification waited too long after a settled unverified session. Got: ${strictPromptFileFailureElapsedMs}ms`
      );
    } finally {
      if (originalWorkspace) {
        originalWorkspace.workspaceFolders = originalWorkspaceFolders;
      } else {
        delete vscodeModule.workspace;
      }
      if (promptAgentRoot) {
        await originalRm(promptAgentRoot, { recursive: true, force: true });
      }
      fs.mkdir = originalMkdir;
      fs.writeFile = originalWriteFile;
      fs.rm = originalRm;
    }
  } finally {
    storageModule.ChatSessionStorage = originalChatSessionStorage;
    vscodeModule.commands.executeCommand = originalExecuteCommand;
    vscodeModule.commands.getCommands = originalGetCommands;
    fs.mkdir = originalMkdir;
    fs.writeFile = originalWriteFile;
    fs.rm = originalRm;
  }
}

async function runDeleteChatSafetyChecks() {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const vscodeModule = require('vscode');
  const storageModule = require(distChatInteropStorage);
  const originalChatSessionStorage = storageModule.ChatSessionStorage;

  class MockChatSessionStorage {
    constructor(_context, _options) {}
    static setSessions(sessions) {
      MockChatSessionStorage._sessions = sessions.map((session) => ({ ...session }));
      MockChatSessionStorage._deletedSessionIds = [];
      MockChatSessionStorage._artifactDeletionOverride = undefined;
    }
    static setArtifactDeletionOverride(report) {
      MockChatSessionStorage._artifactDeletionOverride = report ? { ...report } : undefined;
    }
    static getDeletedSessionIds() {
      return [...(MockChatSessionStorage._deletedSessionIds ?? [])];
    }
    async listSessions() {
      return (MockChatSessionStorage._sessions ?? []).map((session) => ({ ...session }));
    }
    async getSessionById(sessionId) {
      return (MockChatSessionStorage._sessions ?? []).find((session) => session.id === sessionId || session.id.startsWith(sessionId));
    }
    async getExactSessionById(sessionId) {
      return (MockChatSessionStorage._sessions ?? []).find((session) => session.id === sessionId);
    }
    async deleteSessionArtifacts(session) {
      MockChatSessionStorage._deletedSessionIds = [...(MockChatSessionStorage._deletedSessionIds ?? []), session.id];
      MockChatSessionStorage._sessions = (MockChatSessionStorage._sessions ?? []).filter((candidate) => candidate.id !== session.id);
      if (MockChatSessionStorage._artifactDeletionOverride) {
        return {
          attemptedPaths: [session.sessionFile],
          deletedPaths: [session.sessionFile],
          missingPaths: [],
          lingeringPaths: [],
          ...MockChatSessionStorage._artifactDeletionOverride
        };
      }
      return {
        attemptedPaths: [session.sessionFile],
        deletedPaths: [session.sessionFile],
        missingPaths: [],
        lingeringPaths: []
      };
    }
  }

  const originalTabGroupsDescriptor = Object.getOwnPropertyDescriptor(vscodeModule.window, 'tabGroups');
  const closedTabs = [];

  storageModule.ChatSessionStorage = MockChatSessionStorage;

  try {
    const serviceModule = await import(pathToFileURL(distChatInteropService).href);
    const { ChatInteropService } = serviceModule;
    const baseSessions = [
      {
        id: 'session-delete-target',
        title: 'Delete Target',
        lastUpdated: '2026-05-06T10:00:00.000Z',
        mode: 'agent',
        agent: 'github.copilot.editsAgent',
        model: 'copilot/gpt-5-mini',
        archived: false,
        provider: 'workspaceStorage',
        sessionFile: '/tmp/session-delete-target.jsonl'
      },
      {
        id: 'session-delete-target-sibling',
        title: 'Delete Target Sibling',
        lastUpdated: '2026-05-06T09:59:00.000Z',
        mode: 'agent',
        agent: 'github.copilot.editsAgent',
        model: 'copilot/gpt-5-mini',
        archived: false,
        provider: 'workspaceStorage',
        sessionFile: '/tmp/session-delete-target-sibling.jsonl'
      }
    ];

    Object.defineProperty(vscodeModule.window, 'tabGroups', {
      configurable: true,
      value: {
        all: [],
        close: async (tabs) => {
          closedTabs.push(...tabs.map((tab) => tab.label));
        }
      }
    });

    MockChatSessionStorage.setSessions(baseSessions);
    const serviceExact = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 250 });
    const exactResult = await serviceExact.deleteChat('session-delete-target');
    assert(exactResult.ok === true, 'Delete safety test expected the exact session id to delete successfully.');
    assert(MockChatSessionStorage.getDeletedSessionIds().includes('session-delete-target') === true, 'Delete safety test did not delete the exact target session id.');
    assert(MockChatSessionStorage.getDeletedSessionIds().includes('session-delete-target-sibling') === false, 'Delete safety test incorrectly deleted the prefix sibling session.');

    MockChatSessionStorage.setSessions(baseSessions);
    const servicePrefix = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 250 });
    const prefixResult = await servicePrefix.deleteChat('session-delete-target-sib');
    assert(prefixResult.ok === false, 'Delete safety test incorrectly accepted a prefix session id.');
    assert(
      typeof prefixResult.reason === 'string' && prefixResult.reason.includes('requires an exact session id'),
      'Delete safety test did not explain that deleteChat requires an exact session id.'
    );
    assert(MockChatSessionStorage.getDeletedSessionIds().length === 0, 'Delete safety test should not delete anything when the input is only a prefix.');

    MockChatSessionStorage.setSessions(baseSessions);
    closedTabs.length = 0;
    Object.defineProperty(vscodeModule.window, 'tabGroups', {
      configurable: true,
      value: {
        all: [
          {
            isActive: true,
            viewColumn: 1,
            tabs: [
              {
                label: 'Delete Target',
                isActive: true,
                isDirty: false,
                isPinned: false,
                isPreview: false,
                input: {
                  constructor: { name: 'ChatEditorInput' },
                  viewType: 'chat-view'
                }
              }
            ]
          }
        ],
        close: async (tabs) => {
          closedTabs.push(...tabs.map((tab) => tab.label));
        }
      }
    });

    const serviceTitleOnly = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 250 });
    const titleOnlyResult = await serviceTitleOnly.deleteChat('session-delete-target');
    assert(titleOnlyResult.ok === false, 'Delete safety test incorrectly deleted when only a title-only tab match was visible.');
    assert(
      typeof titleOnlyResult.reason === 'string' && titleOnlyResult.reason.includes('matched only by title'),
      'Delete safety test did not explain the title-only tab attribution block.'
    );
    assert(MockChatSessionStorage.getDeletedSessionIds().length === 0, 'Delete safety test should not delete artifacts when only a title-only tab match is visible.');
    assert(closedTabs.length === 0, 'Delete safety test should not close tabs before failing on a title-only tab match.');

    MockChatSessionStorage.setSessions(baseSessions);
    closedTabs.length = 0;
    const targetResource = 'vscode-chat-session://local/c2Vzc2lvbi1kZWxldGUtdGFyZ2V0';
    const siblingResource = 'vscode-chat-session://local/c2Vzc2lvbi1kZWxldGUtdGFyZ2V0LXNpYmxpbmc=';
    let visibleTabs = [
      {
        label: 'Delete Target',
        isActive: true,
        isDirty: false,
        isPinned: false,
        isPreview: false,
        input: {
          constructor: { name: 'ChatEditorInput' },
          viewType: 'chat-view',
          uri: { toString: () => targetResource }
        }
      },
      {
        label: 'Delete Target Sibling',
        isActive: false,
        isDirty: false,
        isPinned: false,
        isPreview: false,
        input: {
          constructor: { name: 'ChatEditorInput' },
          viewType: 'chat-view',
          uri: { toString: () => siblingResource }
        }
      }
    ];
    Object.defineProperty(vscodeModule.window, 'tabGroups', {
      configurable: true,
      value: {
        get all() {
          return [
            {
              isActive: true,
              viewColumn: 1,
              tabs: visibleTabs
            }
          ];
        },
        close: async (tabs) => {
          closedTabs.push(...tabs.map((tab) => tab.label));
          const labelsToClose = new Set(tabs.map((tab) => tab.label));
          visibleTabs = visibleTabs.filter((tab) => !labelsToClose.has(tab.label));
        }
      }
    });

    const serviceResourceOnly = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 250 });
    const resourceOnlyResult = await serviceResourceOnly.deleteChat('session-delete-target');
    assert(resourceOnlyResult.ok === true, 'Delete safety test did not delete when an exact resource-matched tab could be closed safely.');
    assert(MockChatSessionStorage.getDeletedSessionIds().includes('session-delete-target') === true, 'Delete safety test did not delete the exact resource-matched target session.');
    assert(MockChatSessionStorage.getDeletedSessionIds().includes('session-delete-target-sibling') === false, 'Delete safety test incorrectly deleted the resource-matched sibling session.');
    assert(closedTabs.includes('Delete Target') === true, 'Delete safety test did not close the exact resource-matched tab before deleting.');
    assert(closedTabs.includes('Delete Target Sibling') === false, 'Delete safety test incorrectly closed the sibling tab during exact resource-only delete.');

    MockChatSessionStorage.setSessions(baseSessions);
    MockChatSessionStorage.setArtifactDeletionOverride({
      attemptedPaths: ['/tmp/session-delete-target.jsonl', '/tmp/chatEditingSessions/session-delete-target'],
      deletedPaths: ['/tmp/session-delete-target.jsonl'],
      missingPaths: [],
      lingeringPaths: ['/tmp/chatEditingSessions/session-delete-target']
    });
    const serviceLingeringArtifacts = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 250 });
    const lingeringArtifactResult = await serviceLingeringArtifacts.deleteChat('session-delete-target');
    assert(lingeringArtifactResult.ok === false, 'Delete safety test incorrectly reported success when a targeted artifact path still lingered after deletion.');
    assert(
      typeof lingeringArtifactResult.reason === 'string' && lingeringArtifactResult.reason.includes('artifact path(s) remained after deletion'),
      'Delete safety test did not explain that lingering artifact paths block a successful delete result.'
    );
  } finally {
    storageModule.ChatSessionStorage = originalChatSessionStorage;
    if (originalTabGroupsDescriptor) {
      Object.defineProperty(vscodeModule.window, 'tabGroups', originalTabGroupsDescriptor);
    }
  }
}

async function runChatSessionStorageDeltaChecks() {
  const storageModule = await import(pathToFileURL(distChatInteropStorage).href);
  const { ChatSessionStorage } = storageModule;

  const tempDir = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-storage-delta-"));
  try {
    const workspaceStorageRoot = path.join(tempDir, "workspaceStorage");
    const workspaceId = "workspace-1";
    const scopedWorkspaceRoot = path.join(workspaceStorageRoot, workspaceId);
    const chatSessionsDir = path.join(scopedWorkspaceRoot, "chatSessions");
    await fs.mkdir(chatSessionsDir, { recursive: true });

    const sessionFile = path.join(chatSessionsDir, "session-1.jsonl");
    const fullState = {
    version: 3,
    sessionId: "session-1",
    customTitle: "Delta Parsing Session",
    requests: [
      {
        requestId: "request-1",
        timestamp: 1775930000000,
        agent: {
          id: "github.copilot.editsAgent",
          name: "agent",
          fullName: "GitHub Copilot"
        },
        modelId: "copilot/gpt-5-mini",
        modeInfo: {
          kind: "agent",
          isBuiltin: true,
          modeId: "agent",
          modeName: "agent"
        },
        message: {
          text: "seed"
        }
      }
    ],
    inputState: {
      mode: {
        id: "agent",
        kind: "agent"
      },
      selectedModel: {
        identifier: "copilot/gpt-5-mini",
        metadata: {
          name: "GPT-5 mini"
        }
      }
    }
  };

    const lines = [
    JSON.stringify({ kind: 0, v: fullState }),
    JSON.stringify({
      kind: 1,
      k: ["inputState", "mode"],
      v: {
        id: "file:///tmp/support-doc.fresh-reader.agent.md",
        kind: "agent"
      }
    }),
    JSON.stringify({
      kind: 1,
      k: ["inputState", "selectedModel"],
      v: {
        identifier: "copilot/gpt-5.4",
        metadata: {
          name: "GPT-5.4"
        }
      }
    }),
    JSON.stringify({
      kind: 1,
      k: ["hasPendingEdits"],
      v: true
    }),
    JSON.stringify({
      kind: 2,
      k: ["requests"],
      v: [
        {
          requestId: "request-2",
          timestamp: 1775930001000,
          agent: {
            id: "github.copilot.editsAgent",
            name: "agent",
            fullName: "GitHub Copilot"
          },
          modelId: "copilot/gpt-5.4",
          modeInfo: {
            kind: "agent",
            isBuiltin: false,
            modeInstructions: {
              uri: {
                external: "file:///tmp/support-doc.fresh-reader.agent.md"
              }
            },
            modeId: "custom",
            modeName: "fresh-reader"
          },
          message: {
            text: "follow-up"
          },
          response: {
            modelState: {
              value: 0
            }
          }
        }
      ]
    }),
    JSON.stringify({
      kind: 1,
      k: ["requests", 1, "response", "modelState"],
      v: {
        value: 1,
        completedAt: "2026-04-12T10:30:00.000Z"
      }
    }),
    JSON.stringify({
      kind: 1,
      k: ["hasPendingEdits"],
      v: false
    })
  ];
    await fs.writeFile(sessionFile, `${lines.join("\n")}\n`, "utf8");

    const storage = new ChatSessionStorage({}, { workspaceStorageRoots: [scopedWorkspaceRoot] });
    const sessions = await storage.listSessions();
    const session = sessions.find((item) => item.id === "session-1");

  assert(session, "Storage delta test did not discover the temp session.");
  assert((await storage.getExactSessionById("session-1"))?.id === "session-1", 'Storage exact-id test did not resolve the exact session id.');
  assert(await storage.getExactSessionById("session") === undefined, 'Storage exact-id test incorrectly resolved a prefix-only session id.');
  assert(
    session.mode === "file:///tmp/support-doc.fresh-reader.agent.md",
    `Storage delta test did not prefer the later inputState/mode delta. Got: ${session.mode}`
  );
  assert(
    session.model === "copilot/gpt-5.4",
    `Storage delta test did not prefer the later inputState/selectedModel delta. Got: ${session.model}`
  );
  assert(
    session.agent === "support-doc.fresh-reader",
    `Storage delta test did not infer the custom workspace-agent identity from persisted mode evidence. Got: ${session.agent}`
  );
  assert(session.hasPendingEdits === false, 'Storage delta test did not track the latest hasPendingEdits state.');
  assert(session.pendingRequestCount === 0, `Storage delta test did not resolve the request pending count after completion. Got: ${session.pendingRequestCount}`);
  assert(session.lastRequestCompleted === true, 'Storage delta test did not mark the final request as completed after the modelState completion delta.');

    const contaminatedSessionFile = path.join(chatSessionsDir, 'session-contaminated.jsonl');
    await fs.writeFile(contaminatedSessionFile, `${JSON.stringify({
    kind: 0,
    v: {
      version: 3,
      sessionId: 'session-contaminated',
      customTitle: 'Contaminated Session',
      requests: [
        {
          requestId: 'request-contaminated',
          timestamp: 1775930003000,
          message: {
            text: '<reminderInstructions>control</reminderInstructions>\n<importantReminders>more control</importantReminders>\n<todoList></todoList>'
          }
        }
      ],
      inputState: {}
    }
  })}
${JSON.stringify({
    kind: 1,
    k: ['requests', 0, 'response'],
    v: [
      {
        kind: 'toolInvocationSerialized',
        toolSpecificData: {
          kind: 'todoList'
        },
        toolId: 'manage_todo_list'
      }
    ]
  })}
`, 'utf8');

    const contaminationSession = (await storage.listSessions()).find((item) => item.id === 'session-contaminated');
    assert(contaminationSession, 'Storage contamination test did not discover the contaminated temp session.');
    assert(contaminationSession.hasControlThreadArtifacts === true, 'Storage contamination test did not flag control-thread artifacts from raw JSONL.');
    assert(
    JSON.stringify(contaminationSession.controlThreadArtifactKinds) === JSON.stringify(['todoList', 'manage_todo_list']),
    `Storage contamination test did not preserve the detected control-thread artifact kinds. Got: ${JSON.stringify(contaminationSession.controlThreadArtifactKinds)}`
    );

    const stalePendingSessionFile = path.join(chatSessionsDir, 'session-2.jsonl');
    await fs.writeFile(stalePendingSessionFile, `${JSON.stringify({
    kind: 0,
    v: {
      version: 3,
      sessionId: 'session-2',
      customTitle: 'Stale Pending Full State',
      hasPendingEdits: true,
      pendingRequests: [],
      requests: [
        {
          requestId: 'request-3',
          timestamp: 1775930002000,
          modelId: 'copilot/gpt-5.4',
          response: {
            modelState: {
              value: 1,
              completedAt: '2026-04-12T10:31:00.000Z'
            }
          }
        }
      ],
      inputState: {}
    }
  })}\n`, 'utf8');

    const refreshedSessions = await storage.listSessions();
    const stalePendingSession = refreshedSessions.find((item) => item.id === 'session-2');
  assert(stalePendingSession, 'Storage delta test did not discover the stale pending full-state session.');
  assert(stalePendingSession.pendingRequestCount === 0, `Storage delta test did not prefer full-state pendingRequests for stale pending sessions. Got: ${stalePendingSession.pendingRequestCount}`);
  assert(stalePendingSession.lastRequestCompleted === true, 'Storage delta test did not preserve lastRequestCompleted for stale pending full-state sessions.');

    const pendingSessionFile = path.join(chatSessionsDir, 'session-pending.jsonl');
    await fs.writeFile(pendingSessionFile, `${JSON.stringify({
    kind: 0,
    v: {
      version: 3,
      sessionId: 'session-pending',
      customTitle: 'Pending Latest Request',
      pendingRequests: [],
      requests: [],
      inputState: {}
    }
  })}
${JSON.stringify({
    kind: 2,
    k: ['requests'],
    v: [
      {
        requestId: 'request-pending',
        timestamp: 1775930004000,
        message: { text: 'still running' },
        response: [{ value: 'partial response text' }],
        modelState: { value: 0 }
      }
    ]
  })}
`, 'utf8');

    const pendingLatestSession = (await storage.listSessions()).find((item) => item.id === 'session-pending');
  assert(pendingLatestSession, 'Storage delta test did not discover the pending latest-request session.');
  assert(pendingLatestSession.pendingRequestCount === 1, `Storage delta test did not infer a pending request from an unsettled latest request. Got: ${pendingLatestSession.pendingRequestCount}`);
  assert(pendingLatestSession.lastRequestCompleted === false, 'Storage delta test incorrectly marked a latest request with modelState.value=0 as completed.');

    const deleteTargetSessionFile = path.join(chatSessionsDir, 'session-3.jsonl');
    const deleteTargetEditingDir = path.join(scopedWorkspaceRoot, 'chatEditingSessions', 'session-3');
    const deleteTargetEditingFile = path.join(scopedWorkspaceRoot, 'chatEditingSessions', 'session-3.jsonl');
    const deleteTargetTranscriptFile = path.join(scopedWorkspaceRoot, 'transcripts', 'session-3.jsonl');
    const deleteTargetNestedTranscriptFile = path.join(scopedWorkspaceRoot, 'GitHub.copilot-chat', 'transcripts', 'session-3.jsonl');
    const deleteTargetResourceDir = path.join(scopedWorkspaceRoot, 'GitHub.copilot-chat', 'chat-session-resources', 'session-3');
    const stateDbPath = path.join(scopedWorkspaceRoot, 'state.vscdb');
    const backupStateDbPath = path.join(scopedWorkspaceRoot, 'state.vscdb.backup');
    await fs.mkdir(path.join(deleteTargetEditingDir, 'contents'), { recursive: true });
    await fs.mkdir(path.dirname(deleteTargetTranscriptFile), { recursive: true });
    await fs.mkdir(path.dirname(deleteTargetNestedTranscriptFile), { recursive: true });
    await fs.mkdir(deleteTargetResourceDir, { recursive: true });
    await fs.writeFile(deleteTargetSessionFile, `${JSON.stringify({ kind: 0, v: { sessionId: 'session-3', requests: [], inputState: {} } })}\n`, 'utf8');
    await fs.writeFile(path.join(deleteTargetEditingDir, 'state.json'), '{}\n', 'utf8');
    await fs.writeFile(path.join(deleteTargetEditingDir, 'contents', 'chunk.md'), 'probe', 'utf8');
    await fs.writeFile(deleteTargetEditingFile, '{}\n', 'utf8');
    await fs.writeFile(deleteTargetTranscriptFile, '{}\n', 'utf8');
    await fs.writeFile(deleteTargetNestedTranscriptFile, '{}\n', 'utf8');
    await fs.writeFile(path.join(deleteTargetResourceDir, 'content.txt'), 'resource', 'utf8');
    await writeWorkspaceStateValue(stateDbPath, 'chat.ChatSessionStore.index', JSON.stringify({
    version: 1,
    entries: {
      'session-3': {
        sessionId: 'session-3',
        title: 'Disposable Probe Session',
        lastMessageDate: 1775930003000,
        isEmpty: false,
        isExternal: false
      },
      'session-keep': {
        sessionId: 'session-keep',
        title: 'Keep Session',
        lastMessageDate: 1775930004000,
        isEmpty: false,
        isExternal: false
      }
    }
  }));
  await writeWorkspaceStateValue(stateDbPath, 'agentSessions.model.cache', JSON.stringify([
    {
      providerType: 'local',
      providerLabel: 'Local',
      resource: 'vscode-chat-session://local/c2Vzc2lvbi0z',
      label: 'Disposable Probe Session'
    },
    {
      providerType: 'local',
      providerLabel: 'Local',
      resource: 'vscode-chat-session://local/c2Vzc2lvbi1rZWVw',
      label: 'Keep Session'
    }
  ]));
  await writeWorkspaceStateValue(stateDbPath, 'agentSessions.state.cache', JSON.stringify([
    {
      resource: 'vscode-chat-session://local/c2Vzc2lvbi0z',
      read: 1775930005000
    },
    {
      resource: 'vscode-chat-session://local/c2Vzc2lvbi1rZWVw',
      read: 1775930006000
    }
  ]));
  await writeWorkspaceStateValue(stateDbPath, 'memento/chat-todo-list', JSON.stringify({
    'session-3': [
      {
        id: 1,
        title: 'Disposable todo',
        status: 'completed'
      }
    ],
    'session-keep': [
      {
        id: 1,
        title: 'Keep todo',
        status: 'not-started'
      }
    ]
  }));
  await writeWorkspaceStateValue(backupStateDbPath, 'chat.ChatSessionStore.index', JSON.stringify({
    version: 1,
    entries: {
      'session-3': {
        sessionId: 'session-3',
        title: 'Disposable Probe Session',
        lastMessageDate: 1775930003000,
        isEmpty: false,
        isExternal: false
      },
      'session-keep': {
        sessionId: 'session-keep',
        title: 'Keep Session',
        lastMessageDate: 1775930004000,
        isEmpty: false,
        isExternal: false
      }
    }
  }));
  await writeWorkspaceStateValue(backupStateDbPath, 'agentSessions.model.cache', JSON.stringify([
    {
      providerType: 'local',
      providerLabel: 'Local',
      resource: 'vscode-chat-session://local/c2Vzc2lvbi0z',
      label: 'Disposable Probe Session'
    },
    {
      providerType: 'local',
      providerLabel: 'Local',
      resource: 'vscode-chat-session://local/c2Vzc2lvbi1rZWVw',
      label: 'Keep Session'
    }
  ]));
  await writeWorkspaceStateValue(backupStateDbPath, 'agentSessions.state.cache', JSON.stringify([
    {
      resource: 'vscode-chat-session://local/c2Vzc2lvbi0z',
      read: 1775930005000
    },
    {
      resource: 'vscode-chat-session://local/c2Vzc2lvbi1rZWVw',
      read: 1775930006000
    }
  ]));
  await writeWorkspaceStateValue(backupStateDbPath, 'memento/chat-todo-list', JSON.stringify({
    'session-3': [
      {
        id: 1,
        title: 'Disposable todo',
        status: 'completed'
      }
    ],
    'session-keep': [
      {
        id: 1,
        title: 'Keep todo',
        status: 'not-started'
      }
    ]
  }));

    const deleteTargetSession = await storage.getSessionById('session-3');
    assert(deleteTargetSession, 'Storage deletion test did not discover the session targeted for artifact cleanup.');

    const deletionReport = await storage.deleteSessionArtifacts(deleteTargetSession);
    assert(deletionReport.deletedPaths.includes(deleteTargetSessionFile), 'Storage deletion test did not delete the chatSessions JSONL file.');
    assert(deletionReport.deletedPaths.includes(deleteTargetEditingDir), 'Storage deletion test did not delete the chatEditingSessions directory.');
    assert(deletionReport.deletedPaths.includes(deleteTargetEditingFile), 'Storage deletion test did not delete the chatEditingSessions JSONL file.');
    assert(deletionReport.deletedPaths.includes(deleteTargetTranscriptFile), 'Storage deletion test did not delete the top-level transcript JSONL file.');
    assert(deletionReport.deletedPaths.includes(deleteTargetNestedTranscriptFile), 'Storage deletion test did not delete the nested GitHub.copilot-chat transcript JSONL file.');
    assert(deletionReport.deletedPaths.includes(deleteTargetResourceDir), 'Storage deletion test did not delete the chat-session-resources directory.');
    await assertMissing(deleteTargetSessionFile, 'Storage deletion test left the chatSessions JSONL file on disk.');
    await assertMissing(deleteTargetEditingDir, 'Storage deletion test left the chatEditingSessions directory on disk.');
    await assertMissing(deleteTargetEditingFile, 'Storage deletion test left the chatEditingSessions JSONL file on disk.');
    await assertMissing(deleteTargetTranscriptFile, 'Storage deletion test left the top-level transcript JSONL file on disk.');
    await assertMissing(deleteTargetNestedTranscriptFile, 'Storage deletion test left the nested transcript JSONL file on disk.');
    await assertMissing(deleteTargetResourceDir, 'Storage deletion test left the chat-session-resources directory on disk.');
    assert(await storage.getSessionById('session-3') === undefined, 'Storage deletion test still resolved the deleted session after artifact cleanup.');
    const prunedIndexRaw = await readWorkspaceStateValue(stateDbPath, 'chat.ChatSessionStore.index');
    assert(prunedIndexRaw && !prunedIndexRaw.includes('session-3'), 'Storage deletion test left the deleted session in chat.ChatSessionStore.index.');
    assert(prunedIndexRaw && prunedIndexRaw.includes('session-keep'), 'Storage deletion test removed unrelated chat.ChatSessionStore.index entries.');
    const prunedModelCacheRaw = await readWorkspaceStateValue(stateDbPath, 'agentSessions.model.cache');
    assert(prunedModelCacheRaw && !prunedModelCacheRaw.includes('c2Vzc2lvbi0z'), 'Storage deletion test left the deleted session in agentSessions.model.cache.');
    assert(prunedModelCacheRaw && prunedModelCacheRaw.includes('c2Vzc2lvbi1rZWVw'), 'Storage deletion test removed unrelated agentSessions.model.cache entries.');
    const prunedStateCacheRaw = await readWorkspaceStateValue(stateDbPath, 'agentSessions.state.cache');
    assert(prunedStateCacheRaw && !prunedStateCacheRaw.includes('c2Vzc2lvbi0z'), 'Storage deletion test left the deleted session in agentSessions.state.cache.');
    assert(prunedStateCacheRaw && prunedStateCacheRaw.includes('c2Vzc2lvbi1rZWVw'), 'Storage deletion test removed unrelated agentSessions.state.cache entries.');
    const prunedTodoListRaw = await readWorkspaceStateValue(stateDbPath, 'memento/chat-todo-list');
    assert(prunedTodoListRaw && !prunedTodoListRaw.includes('session-3'), 'Storage deletion test left the deleted session in memento/chat-todo-list.');
    assert(prunedTodoListRaw && prunedTodoListRaw.includes('session-keep'), 'Storage deletion test removed unrelated memento/chat-todo-list entries.');
    const prunedBackupIndexRaw = await readWorkspaceStateValue(backupStateDbPath, 'chat.ChatSessionStore.index');
    assert(prunedBackupIndexRaw && !prunedBackupIndexRaw.includes('session-3'), 'Storage deletion test left the deleted session in state.vscdb.backup chat.ChatSessionStore.index.');
    assert(prunedBackupIndexRaw && prunedBackupIndexRaw.includes('session-keep'), 'Storage deletion test removed unrelated state.vscdb.backup chat.ChatSessionStore.index entries.');
    const prunedBackupModelCacheRaw = await readWorkspaceStateValue(backupStateDbPath, 'agentSessions.model.cache');
    assert(prunedBackupModelCacheRaw && !prunedBackupModelCacheRaw.includes('c2Vzc2lvbi0z'), 'Storage deletion test left the deleted session in state.vscdb.backup agentSessions.model.cache.');
    assert(prunedBackupModelCacheRaw && prunedBackupModelCacheRaw.includes('c2Vzc2lvbi1rZWVw'), 'Storage deletion test removed unrelated state.vscdb.backup agentSessions.model.cache entries.');
    const prunedBackupStateCacheRaw = await readWorkspaceStateValue(backupStateDbPath, 'agentSessions.state.cache');
    assert(prunedBackupStateCacheRaw && !prunedBackupStateCacheRaw.includes('c2Vzc2lvbi0z'), 'Storage deletion test left the deleted session in state.vscdb.backup agentSessions.state.cache.');
    assert(prunedBackupStateCacheRaw && prunedBackupStateCacheRaw.includes('c2Vzc2lvbi1rZWVw'), 'Storage deletion test removed unrelated state.vscdb.backup agentSessions.state.cache entries.');
    const prunedBackupTodoListRaw = await readWorkspaceStateValue(backupStateDbPath, 'memento/chat-todo-list');
    assert(prunedBackupTodoListRaw && !prunedBackupTodoListRaw.includes('session-3'), 'Storage deletion test left the deleted session in state.vscdb.backup memento/chat-todo-list.');
    assert(prunedBackupTodoListRaw && prunedBackupTodoListRaw.includes('session-keep'), 'Storage deletion test removed unrelated state.vscdb.backup memento/chat-todo-list entries.');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function runOfflineLocalChatCleanupChecks() {
  const cleanupModule = await import(pathToFileURL(distOfflineLocalChatCleanup).href);
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const vscodeModule = require('vscode');
  vscodeModule.ThemeIcon ??= class ThemeIcon {
    constructor(id) {
      this.id = id;
    }
  };
  const globalStorageDir = path.join(workspaceRoot, ".tmp-offline-cleanup-global");
  const directWorkspaceStorageDir = path.join(workspaceRoot, ".tmp-offline-cleanup-workspace");
  const queuedIntegrationGlobalStorageDir = path.join(workspaceRoot, ".tmp-offline-cleanup-queued-global");
  const queuedIntegrationWorkspaceStorageDir = path.join(workspaceRoot, ".tmp-offline-cleanup-queued-workspace");
  const queuedPrefixSiblingWorkspaceStorageDir = path.join(workspaceRoot, ".tmp-offline-cleanup-queued-workspace-sibling");
  const requestsPath = cleanupModule.getOfflineLocalChatCleanupRequestsPath(globalStorageDir);
  const reportsDir = cleanupModule.getOfflineLocalChatCleanupReportsDir(globalStorageDir);
  const spec = cleanupModule.buildOfflineLocalChatCleanupLaunchSpec({
    extensionRoot: packageRoot,
    globalStorageDir,
    waitForPid: 4242
  });

  assert(spec.executable === process.execPath, "Offline cleanup launch test did not target the current runtime executable.");
  assert(spec.args.includes(distOfflineLocalChatCleanupCli), "Offline cleanup launch test did not point at the offline cleanup CLI.");
  assert(spec.args.includes("schedule"), "Offline cleanup launch test did not invoke the schedule command.");
  assert(spec.args.includes("--global-storage-dir") && spec.args.includes(globalStorageDir), "Offline cleanup launch test did not preserve the global storage directory.");
  assert(spec.args.includes("--wait-for-pid") && spec.args.includes("4242"), "Offline cleanup launch test did not preserve the invoking process pid for exact post-exit scheduling.");
  assert(spec.args.includes("--workspace-storage-dir") === false, "Offline cleanup launch test still exposed workspace-targeted keep semantics.");
  assert(spec.options.detached === true && spec.options.stdio === "ignore", "Offline cleanup launch test did not configure detached background execution.");
  assert(spec.options.env?.ELECTRON_RUN_AS_NODE === "1", "Offline cleanup launch test did not force the scheduled runtime into Node mode.");

  await fs.mkdir(globalStorageDir, { recursive: true });
  const firstQueuedRequest = cleanupModule.buildWorkspaceStorageOfflineLocalChatCleanupRequest("C:/tmp/workspaceStorage/example", "session-drop-1");
  firstQueuedRequest.targetSessionIds.push("session-drop-1", "session-drop-2");
  await cleanupModule.queueOfflineLocalChatCleanupRequest(globalStorageDir, firstQueuedRequest);
  await cleanupModule.queueOfflineLocalChatCleanupRequest(
    globalStorageDir,
    cleanupModule.buildWorkspaceStorageOfflineLocalChatCleanupRequest("C:/tmp/workspaceStorage/example", "session-drop-3")
  );

  const queuedLines = (await fs.readFile(requestsPath, "utf8"))
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert(queuedLines.length === 2, "Offline cleanup queue test did not append one JSONL request per scheduled cleanup.");
  assert(queuedLines[0].targetSessionIds.length === 2, "Offline cleanup queue test did not de-duplicate target session ids within one request.");
  assert(
    Array.isArray(queuedLines[0].artifactPaths)
      && queuedLines[0].artifactPaths.some((value) => value.replace(/\\/g, "/").endsWith("chatSessions/session-drop-1.jsonl")),
    "Offline cleanup queue test did not persist exact artifact paths for the target session."
  );

  await fs.mkdir(reportsDir, { recursive: true });
  const reportFilePathA = cleanupModule.createOfflineLocalChatCleanupReportPath(globalStorageDir);
  const reportFilePathB = cleanupModule.createOfflineLocalChatCleanupReportPath(globalStorageDir);
  await fs.writeFile(reportFilePathA, `${JSON.stringify([
    {
      dbPath: "state.vscdb",
      removedTargetSessionIds: ["session-drop-1"],
      deletedArtifactPaths: ["C:/tmp/workspaceStorage/example/chatSessions/session-drop-1.jsonl"],
      missingArtifactPaths: ["C:/tmp/workspaceStorage/example/transcripts/session-drop-1.jsonl"],
      removedIndexEntries: 5,
      removedModelEntries: 5,
      removedStateEntries: 11,
      removedTodoEntries: 1
    }
  ])}\n`, "utf8");
  await fs.writeFile(reportFilePathB, `${JSON.stringify([
    {
      dbPath: "state.vscdb.backup",
      removedTargetSessionIds: ["session-drop-1"],
      deletedArtifactPaths: ["C:/tmp/workspaceStorage/example/GitHub.copilot-chat/chat-session-resources/session-drop-1"],
      missingArtifactPaths: [],
      removedIndexEntries: 5,
      removedModelEntries: 5,
      removedStateEntries: 11,
      removedTodoEntries: 1
    }
  ])}\n`, "utf8");

  const summary = await cleanupModule.readAndDeleteOfflineLocalChatCleanupReports(globalStorageDir);
  assert(summary && summary.reports.length === 2, "Offline cleanup report test did not read the stored report payload.");
  assert(summary.reportFilePaths.length === 2, "Offline cleanup report test did not surface every consumed report path.");
  await assertMissing(reportFilePathA, "Offline cleanup report test did not remove the first consumed report file.");
  await assertMissing(reportFilePathB, "Offline cleanup report test did not remove the second consumed report file.");
  assert(
    cleanupModule.formatOfflineLocalChatCleanupSummary(summary).includes("Deleted queued artifacts: 2."),
    "Offline cleanup summary test did not aggregate deleted artifact totals."
  );
  assert(
    cleanupModule.formatOfflineLocalChatCleanupSummary(summary).includes("Missing queued artifacts: 1."),
    "Offline cleanup summary test did not aggregate missing artifact totals."
  );
  assert(
    cleanupModule.formatOfflineLocalChatCleanupSummary(summary).includes("Removed state cache entries: 22."),
    "Offline cleanup summary test did not aggregate report totals."
  );
  assert(
    cleanupModule.formatOfflineLocalChatCleanupSummary(summary).includes("Removed editor chat view state entries: 0."),
    "Offline cleanup summary test did not include editor chat view state totals."
  );
  assert(
    JSON.stringify(cleanupModule.collectRemovedTargetSessionIds(summary)) === JSON.stringify(['session-drop-1']),
    'Offline cleanup summary test did not expose the exact removed session ids from the consumed reports.'
  );

  const extensionModule = await import(pathToFileURL(distExtension).href);
  assert(
    extensionModule.shouldKeepTraceablePanelPinned({ reason: 'manual', autoHideMode: 'yes', currentlyPinnedOpen: false }) === true
      && extensionModule.shouldKeepTraceablePanelPinned({ reason: 'auto', autoHideMode: 'no', currentlyPinnedOpen: false }) === true
      && extensionModule.shouldKeepTraceablePanelPinned({ reason: 'auto', autoHideMode: 'yes', currentlyPinnedOpen: false }) === false
      && extensionModule.shouldKeepTraceablePanelPinned({ reason: 'auto', autoHideMode: 'yes', currentlyPinnedOpen: true }) === true,
    'TRACEABLE panel pin policy must keep manual reveals open, treat autoHide=no as pinned-by-policy, and preserve an already pinned panel.'
  );
  const carryRequestSummary = extensionModule.buildTraceableRequestSummary({
    userInput: 'Continue from the earlier bounded inspection',
    parentTask: 'Continue the earlier trace run without reopening broad exploration',
    inputMode: 'NON_LEADING_EPISTEMIC',
    validationMode: 'WARN',
    carriedContext: {
      priorTurnsSummary: 'Earlier run found the controlling guard in src/traceableSubagent.ts and stopped after a bounded read-only pass.',
      fileContext: ['src/traceableSubagent.ts', 'tests/test.mjs'],
      reductions: ['stay read-only', 'prefer exact file anchors first']
    }
  });
  const modeSummaryItem = carryRequestSummary.find((item) => item.label === 'Mode');
  const carrySummaryItem = carryRequestSummary.find((item) => item.label === 'Carry');
  assert(
    modeSummaryItem
      && modeSummaryItem.value === 'NLE-W'
      && String(modeSummaryItem.title ?? '').includes('Declared input mode: NON_LEADING_EPISTEMIC')
      && String(modeSummaryItem.title ?? '').includes('Declared validation mode: WARN')
      && String(modeSummaryItem.title ?? '').includes('Declared mode code: NLE-W'),
    `TRACEABLE request summary must merge input mode and validation into one compact Mode badge. Got: ${JSON.stringify(carryRequestSummary)}`
  );
  assert(
    carrySummaryItem
      && String(carrySummaryItem.value ?? '').includes('context')
      && String(carrySummaryItem.value ?? '').includes('2 files')
      && String(carrySummaryItem.value ?? '').includes('2 reductions')
      && String(carrySummaryItem.title ?? '').includes('Prior context summary carried into this trace run')
      && String(carrySummaryItem.title ?? '').includes('File anchors: src/traceableSubagent.ts, tests/test.mjs')
      && String(carrySummaryItem.title ?? '').includes('Reductions: stay read-only | prefer exact file anchors first'),
    `TRACEABLE request summary must surface carried prior context for later panel and export evidence. Got: ${JSON.stringify(carryRequestSummary)}`
  );
  const traceableEvidenceUri = vscodeModule.Uri.file(path.join(packageRoot, '..', 'feedback', 'topics', '01-leo.trace.md'));
  assert(
    extensionModule.isRelatedTraceableEvidenceTab({
      label: '01-leo.trace.md',
      input: {
        constructor: { name: 'TabInputText' },
        uri: traceableEvidenceUri
      }
    }, traceableEvidenceUri) === true,
    'TRACEABLE evidence tab matching must recognize the exact source markdown tab for the same .trace.md resource.'
  );
  assert(
    extensionModule.isRelatedTraceableEvidenceTab({
      label: 'Preview 01-leo.trace.md',
      input: {
        constructor: { name: 'TabInputWebview' },
        viewType: 'markdown.preview.editor'
      }
    }, traceableEvidenceUri) === true,
    'TRACEABLE evidence tab matching must recognize the built-in markdown preview tab for the same .trace.md resource.'
  );
  assert(
    extensionModule.isRelatedTraceableEvidenceTab({
      label: '01-leo.trace.md',
      input: {
        constructor: { name: 'TabInputWebview' },
        viewType: 'tiinexTraceableEvidenceEditor'
      }
    }, traceableEvidenceUri) === false,
    'TRACEABLE evidence tab matching must not treat the reconstructed TRACEABLE webview itself as a source/preview tab to replace.'
  );
  assert(
    extensionModule.resolveActiveTraceableEvidenceUri(traceableEvidenceUri)?.fsPath === traceableEvidenceUri.fsPath,
    'TRACEABLE evidence target resolution must preserve an explicit URI target.'
  );
  const originalTabGroupsDescriptor = Object.getOwnPropertyDescriptor(vscodeModule.window, 'tabGroups');
  const originalActiveTextEditorDescriptor = Object.getOwnPropertyDescriptor(vscodeModule.window, 'activeTextEditor');
  let visibleTabs = [
    {
      label: 'Deleted Session Tab',
      isActive: true,
      isDirty: false,
      isPinned: false,
      isPreview: false,
      input: {
        constructor: { name: 'ChatEditorInput' },
        viewType: 'chat-view',
        uri: { toString: () => `vscode-chat-session://local/${Buffer.from('session-drop-1').toString('base64')}` }
      }
    },
    {
      label: 'Keep Session Tab',
      isActive: false,
      isDirty: false,
      isPinned: false,
      isPreview: false,
      input: {
        constructor: { name: 'ChatEditorInput' },
        viewType: 'chat-view',
        uri: { toString: () => `vscode-chat-session://local/${Buffer.from('session-keep').toString('base64')}` }
      }
    },
    {
      label: 'Title Only Session Drop',
      isActive: false,
      isDirty: false,
      isPinned: false,
      isPreview: false,
      input: {
        constructor: { name: 'ChatEditorInput' },
        viewType: 'chat-view'
      }
    }
  ];
  try {
    Object.defineProperty(vscodeModule.window, 'activeTextEditor', {
      configurable: true,
      value: undefined
    });
    Object.defineProperty(vscodeModule.window, 'tabGroups', {
      configurable: true,
      value: {
        get all() {
          return [{ isActive: true, viewColumn: 1, tabs: visibleTabs }];
        },
        activeTabGroup: {
          get activeTab() {
            return visibleTabs.find((tab) => tab.isActive);
          }
        },
        close: async (tabs) => {
          const labelsToClose = new Set(tabs.map((tab) => tab.label));
          visibleTabs = visibleTabs.filter((tab) => !labelsToClose.has(tab.label));
        }
      }
    });

    visibleTabs = [
      {
        label: 'Preview 01-leo.trace.md',
        isActive: true,
        isDirty: false,
        isPinned: false,
        isPreview: true,
        input: {
          constructor: { name: 'TabInputWebview' },
          viewType: 'markdown.preview',
          uri: traceableEvidenceUri
        }
      }
    ];
    assert(
      extensionModule.resolveActiveTraceableEvidenceUri()?.fsPath === traceableEvidenceUri.fsPath,
      'TRACEABLE evidence target resolution must recover the .trace.md source URI from the active markdown preview tab.'
    );

    visibleTabs = [
      {
        label: 'Deleted Session Tab',
        isActive: true,
        isDirty: false,
        isPinned: false,
        isPreview: false,
        input: {
          constructor: { name: 'ChatEditorInput' },
          viewType: 'chat-view',
          uri: { toString: () => `vscode-chat-session://local/${Buffer.from('session-drop-1').toString('base64')}` }
        }
      },
      {
        label: 'Keep Session Tab',
        isActive: false,
        isDirty: false,
        isPinned: false,
        isPreview: false,
        input: {
          constructor: { name: 'ChatEditorInput' },
          viewType: 'chat-view',
          uri: { toString: () => `vscode-chat-session://local/${Buffer.from('session-keep').toString('base64')}` }
        }
      },
      {
        label: 'Title Only Session Drop',
        isActive: false,
        isDirty: false,
        isPinned: false,
        isPreview: false,
        input: {
          constructor: { name: 'ChatEditorInput' },
          viewType: 'chat-view'
        }
      }
    ];

    const reconcileResult = await extensionModule.reconcileOfflineLocalChatCleanupUx({
      reportFilePaths: [],
      reports: [
        {
          removedTargetSessionIds: ['session-drop-1', 'session-drop-1']
        }
      ]
    });
    assert(reconcileResult.reconciledSessionIds.length === 1 && reconcileResult.reconciledSessionIds[0] === 'session-drop-1', 'Offline cleanup UX reconcile test did not de-duplicate exact removed session ids.');
    assert(reconcileResult.closedCount === 1, `Offline cleanup UX reconcile test did not close exactly one matching editor tab. Got ${reconcileResult.closedCount}.`);
    assert(visibleTabs.some((tab) => tab.label === 'Deleted Session Tab') === false, 'Offline cleanup UX reconcile test left the exact deleted-session tab visible.');
    assert(visibleTabs.some((tab) => tab.label === 'Keep Session Tab') === true, 'Offline cleanup UX reconcile test incorrectly closed an unrelated editor chat tab.');
    assert(visibleTabs.some((tab) => tab.label === 'Title Only Session Drop') === true, 'Offline cleanup UX reconcile test incorrectly closed a title-only editor chat tab.');
  } finally {
    if (originalTabGroupsDescriptor) {
      Object.defineProperty(vscodeModule.window, 'tabGroups', originalTabGroupsDescriptor);
    }
    if (originalActiveTextEditorDescriptor) {
      Object.defineProperty(vscodeModule.window, 'activeTextEditor', originalActiveTextEditorDescriptor);
    }
  }

  const directSessionFile = path.join(directWorkspaceStorageDir, "chatSessions", "session-drop-1.jsonl");
  const directEditingDir = path.join(directWorkspaceStorageDir, 'chatEditingSessions', 'session-drop-1');
  const directTranscriptFile = path.join(directWorkspaceStorageDir, "transcripts", "session-drop-1.jsonl");
  const directResourceDir = path.join(directWorkspaceStorageDir, "GitHub.copilot-chat", "chat-session-resources", "session-drop-1");
  const directStateDbPath = path.join(directWorkspaceStorageDir, "state.vscdb");
  await fs.mkdir(path.dirname(directSessionFile), { recursive: true });
  await fs.mkdir(directEditingDir, { recursive: true });
  await fs.mkdir(path.dirname(directTranscriptFile), { recursive: true });
  await fs.mkdir(directResourceDir, { recursive: true });
  await fs.writeFile(directSessionFile, '{"kind":0}\n', 'utf8');
  await fs.writeFile(path.join(directEditingDir, 'state.json'), '{"label":"Disposable Probe Session"}\n', 'utf8');
  await fs.writeFile(directTranscriptFile, '{}\n', 'utf8');
  await fs.writeFile(path.join(directResourceDir, 'content.txt'), 'resource', 'utf8');
  await writeWorkspaceStateValue(directStateDbPath, 'chat.ChatSessionStore.index', JSON.stringify({
    version: 1,
    entries: {
      'session-drop-1': {
        sessionId: 'session-drop-1',
        title: 'Disposable Probe Session',
        lastMessageDate: 1775930003000,
        isEmpty: false,
        isExternal: false
      },
      'session-keep': {
        sessionId: 'session-keep',
        title: 'Keep Session',
        lastMessageDate: 1775930004000,
        isEmpty: false,
        isExternal: false
      }
    }
  }));
  await writeWorkspaceStateValue(directStateDbPath, 'agentSessions.model.cache', JSON.stringify([
    {
      providerType: 'local',
      providerLabel: 'Local',
      resource: 'vscode-chat-session://local/c2Vzc2lvbi1kcm9wLTE=',
      label: 'Disposable Probe Session'
    },
    {
      providerType: 'local',
      providerLabel: 'Local',
      resource: 'vscode-chat-session://local/c2Vzc2lvbi1rZWVw',
      label: 'Keep Session'
    }
  ]));
  await writeWorkspaceStateValue(directStateDbPath, 'agentSessions.state.cache', JSON.stringify([
    {
      resource: 'vscode-chat-session://local/c2Vzc2lvbi1kcm9wLTE=',
      read: 1775930005000
    },
    {
      resource: 'vscode-chat-session://local/c2Vzc2lvbi1rZWVw',
      read: 1775930006000
    }
  ]));
  await writeWorkspaceStateValue(directStateDbPath, 'memento/chat-todo-list', JSON.stringify({
    'session-drop-1': [
      {
        id: 1,
        title: 'Disposable todo',
        status: 'completed'
      }
    ],
    'session-keep': [
      {
        id: 1,
        title: 'Keep todo',
        status: 'not-started'
      }
    ]
  }));
  await writeWorkspaceStateValue(directStateDbPath, 'memento/workbench.editor.chatSession', JSON.stringify({
    chatEditorViewState: [
      ['vscode-chat-session://local/c2Vzc2lvbi1kcm9wLTE=', { 0: { scrollTop: 0 } }],
      ['vscode-chat-session://local/c2Vzc2lvbi1rZWVw', { 0: { scrollTop: 0 } }]
    ]
  }));

  await runOfflineCleanupCli([
    'prune',
    '--allow-code-process',
    '--workspace-storage-dir', directWorkspaceStorageDir,
    '--target-session-id', 'session-drop-1'
  ]);

  await assertMissing(directSessionFile, 'Offline cleanup script test did not delete the queued session JSONL file.');
  await assertMissing(directEditingDir, 'Offline cleanup script test did not delete the queued chatEditingSessions directory.');
  await assertMissing(directTranscriptFile, 'Offline cleanup script test did not delete the queued transcript JSONL file.');
  await assertMissing(directResourceDir, 'Offline cleanup script test did not delete the queued resource directory.');
  const directPrunedIndexRaw = await readWorkspaceStateValue(directStateDbPath, 'chat.ChatSessionStore.index');
  assert(directPrunedIndexRaw && !directPrunedIndexRaw.includes('session-drop-1'), 'Offline cleanup script test left the deleted session in chat.ChatSessionStore.index.');
  assert(directPrunedIndexRaw && directPrunedIndexRaw.includes('session-keep'), 'Offline cleanup script test removed unrelated index entries.');
  const directPrunedWorkbenchEditorChatSessionRaw = await readWorkspaceStateValue(directStateDbPath, 'memento/workbench.editor.chatSession');
  assert(directPrunedWorkbenchEditorChatSessionRaw && !directPrunedWorkbenchEditorChatSessionRaw.includes('c2Vzc2lvbi1kcm9wLTE='), 'Offline cleanup script test left the deleted session in memento/workbench.editor.chatSession.');
  assert(directPrunedWorkbenchEditorChatSessionRaw && directPrunedWorkbenchEditorChatSessionRaw.includes('c2Vzc2lvbi1rZWVw'), 'Offline cleanup script test removed unrelated workbench editor chat state entries.');

  const queuedIntegrationRequestsPath = cleanupModule.getOfflineLocalChatCleanupRequestsPath(queuedIntegrationGlobalStorageDir);
  const queuedIntegrationSessionFile = path.join(queuedIntegrationWorkspaceStorageDir, 'chatSessions', 'session-drop-queued.jsonl');
  const queuedIntegrationTranscriptFile = path.join(queuedIntegrationWorkspaceStorageDir, 'transcripts', 'session-drop-queued.jsonl');
  const queuedPrefixSiblingSessionFile = path.join(queuedPrefixSiblingWorkspaceStorageDir, 'chatSessions', 'session-drop-queued.jsonl');
  await fs.mkdir(path.dirname(queuedIntegrationSessionFile), { recursive: true });
  await fs.mkdir(path.dirname(queuedIntegrationTranscriptFile), { recursive: true });
  await fs.mkdir(path.dirname(queuedPrefixSiblingSessionFile), { recursive: true });
  await fs.writeFile(queuedIntegrationSessionFile, '{"kind":0}\n', 'utf8');
  await fs.writeFile(queuedIntegrationTranscriptFile, '{}\n', 'utf8');
  await fs.writeFile(queuedPrefixSiblingSessionFile, '{"kind":0}\n', 'utf8');
  await cleanupModule.queueOfflineLocalChatCleanupRequest(queuedIntegrationGlobalStorageDir, {
    workspaceStorageDir: queuedIntegrationWorkspaceStorageDir,
    targetSessionIds: ['session-drop-queued'],
    artifactPaths: [
      queuedIntegrationSessionFile,
      queuedIntegrationTranscriptFile,
      queuedPrefixSiblingSessionFile
    ]
  });
  await fs.appendFile(queuedIntegrationRequestsPath, '{not-valid-json\n', 'utf8');

  await runOfflineCleanupCli([
    'prune',
    '--allow-code-process',
    '--global-storage-dir', queuedIntegrationGlobalStorageDir
  ]);

  await assertMissing(queuedIntegrationSessionFile, 'Offline cleanup queue-hardening test did not delete the in-scope queued session artifact.');
  await assertMissing(queuedIntegrationTranscriptFile, 'Offline cleanup queue-hardening test did not delete the in-scope queued transcript artifact.');
  assert(await fs.stat(queuedPrefixSiblingSessionFile).then(() => true).catch(() => false), 'Offline cleanup queue-hardening test incorrectly deleted a sibling-path artifact that only shared the workspace prefix.');
  await assertMissing(queuedIntegrationRequestsPath, 'Offline cleanup queue-hardening test did not remove the consumed queued-requests file after a successful run.');

  await fs.rm(globalStorageDir, { recursive: true, force: true });
  await fs.rm(directWorkspaceStorageDir, { recursive: true, force: true });
  await fs.rm(queuedIntegrationGlobalStorageDir, { recursive: true, force: true });
  await fs.rm(queuedIntegrationWorkspaceStorageDir, { recursive: true, force: true });
  await fs.rm(queuedPrefixSiblingWorkspaceStorageDir, { recursive: true, force: true });
}

async function runRuntimeFileHygieneChecks() {
  const hygieneModule = await import(pathToFileURL(distRuntimeFileHygiene).href);
  const cleanupModule = await import(pathToFileURL(distOfflineLocalChatCleanup).href);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-vscode-tools-runtime-hygiene-"));
  try {
    const rollingLogPath = path.join(tempDir, "traceable-subagent-debug.jsonl");
    await hygieneModule.appendLineToRollingLog(rollingLogPath, JSON.stringify({ entry: "alpha", value: "1" }), {
      maxBytes: 90,
      retainBytes: 60
    });
    await hygieneModule.appendLineToRollingLog(rollingLogPath, JSON.stringify({ entry: "beta", value: "2" }), {
      maxBytes: 90,
      retainBytes: 60
    });
    await hygieneModule.appendLineToRollingLog(rollingLogPath, JSON.stringify({ entry: "gamma", value: "3" }), {
      maxBytes: 90,
      retainBytes: 60
    });

    const rollingLogText = await fs.readFile(rollingLogPath, "utf8");
    const rollingLogStat = await fs.stat(rollingLogPath);
    assert(rollingLogText.includes('"gamma"'), "Runtime file hygiene test did not retain the newest rolling-log entry.");
    assert(!rollingLogText.includes('"alpha"'), "Runtime file hygiene test did not trim the oldest rolling-log entry.");
    assert(rollingLogStat.size <= 90, `Runtime file hygiene test let the rolling log exceed its max size. Got: ${rollingLogStat.size}`);

    const globalStorageDir = path.join(tempDir, "global-storage");
    const reportsDir = cleanupModule.getOfflineLocalChatCleanupReportsDir(globalStorageDir);
    const lockPath = cleanupModule.getOfflineLocalChatCleanupLockPath(globalStorageDir);
    const requestsPath = cleanupModule.getOfflineLocalChatCleanupRequestsPath(globalStorageDir);
    await fs.mkdir(reportsDir, { recursive: true });

    const staleReportPath = path.join(reportsDir, "stale-report.json");
    const freshReportPath = path.join(reportsDir, "fresh-report.json");
    await fs.writeFile(staleReportPath, "[]\n", "utf8");
    await fs.writeFile(freshReportPath, "[]\n", "utf8");
    await fs.writeFile(lockPath, "locked\n", "utf8");
    await fs.writeFile(requestsPath, "", "utf8");

    const nowMs = Date.now();
    const staleMs = nowMs - (10 * 24 * 60 * 60 * 1000);
    const freshMs = nowMs - (2 * 60 * 1000);
    await fs.utimes(staleReportPath, staleMs / 1000, staleMs / 1000);
    await fs.utimes(freshReportPath, freshMs / 1000, freshMs / 1000);
    await fs.utimes(lockPath, staleMs / 1000, staleMs / 1000);

    const cleanupResult = await hygieneModule.cleanupGlobalStorageArtifacts(globalStorageDir, {
      nowMs,
      reportRetentionMs: 24 * 60 * 60 * 1000,
      staleLockMs: 60 * 60 * 1000,
      maxReportFiles: 5
    });

    assert(cleanupResult.removedReportFilePaths.includes(staleReportPath), "Runtime file hygiene test did not remove the stale cleanup report.");
    assert(cleanupResult.removedLockFilePath === lockPath, "Runtime file hygiene test did not remove the stale cleanup lock.");
    assert(cleanupResult.removedEmptyRequestsPath === requestsPath, "Runtime file hygiene test did not remove the empty cleanup requests file.");
    await assertMissing(staleReportPath, "Runtime file hygiene test did not delete the stale cleanup report file.");
    await assertExists(freshReportPath, "Runtime file hygiene test removed a fresh cleanup report unexpectedly.");
    await assertMissing(lockPath, "Runtime file hygiene test did not delete the stale cleanup lock file.");
    await assertMissing(requestsPath, "Runtime file hygiene test did not delete the empty cleanup requests file.");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function runSessionSendWorkflowChecks() {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const vscodeModule = require('vscode');
  const workflowModule = await import(pathToFileURL(distChatInteropSessionSendWorkflow).href);
  const { sendMessageToSession } = workflowModule;

  const originalTabGroupsDescriptor = Object.getOwnPropertyDescriptor(vscodeModule.window, 'tabGroups');
  const originalExecuteCommand = vscodeModule.commands.executeCommand;
  const originalGetCommands = vscodeModule.commands.getCommands;

  Object.defineProperty(vscodeModule.window, 'tabGroups', {
    configurable: true,
    value: {
      all: [
        {
          isActive: true,
          viewColumn: 1,
          tabs: [
            {
              label: 'Fallback Target',
              isActive: true,
              isDirty: false,
              isPinned: false,
              isPreview: false,
              input: { viewType: 'chat-editor' }
            }
          ]
        }
      ]
    }
  });
  vscodeModule.commands.getCommands = async () => [
    'workbench.action.focusActiveEditorGroup',
    'workbench.action.chat.focusInput',
    'workbench.action.chat.submit'
  ];
  vscodeModule.commands.executeCommand = async () => undefined;

  try {
    let exactSendCalls = 0;
    let exactSendRevealCalls = 0;
    let exactSendFocusedCalls = 0;
    const exactSendResult = await sendMessageToSession({
      getPostCreateTimeoutMs() {
        return 1_000;
      },
      async getExactSessionInteropSupport() {
        return {
          canRevealExactSession: true,
          canSendExactSessionMessage: true,
          revealUnsupportedReason: undefined,
          sendUnsupportedReason: undefined
        };
      },
      async sendMessage(request) {
        exactSendCalls += 1;
        return {
          ok: true,
          session: {
            id: request.sessionId,
            title: 'Exact Target',
            lastUpdated: '2026-05-07T10:04:01.000Z',
            mode: 'agent',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: '/tmp/session-exact.jsonl'
          },
          selection: {
            mode: { status: 'not-requested' },
            model: { status: 'not-requested' },
            agent: { status: 'verified', requested: '#agent-architect', observed: 'agent-architect' },
            dispatchedPrompt: request.prompt,
            dispatchSurface: 'chat-open',
            allRequestedVerified: true
          },
          dispatch: {
            surface: 'chat-open',
            dispatchedPrompt: request.prompt
          }
        };
      },
      async revealChat() {
        exactSendRevealCalls += 1;
        throw new Error('Exact-send workflow test should not reveal when direct exact send is available.');
      },
      async sendFocusedMessage() {
        exactSendFocusedCalls += 1;
        throw new Error('Exact-send workflow test should not use focused send when direct exact send is available.');
      }
    }, {
      sessionId: 'session-exact',
      prompt: 'exact prompt',
      agentName: 'agent-architect',
      blockOnResponse: true,
      requireSelectionEvidence: false
    });

    assert(exactSendResult.ok === true, 'Session send workflow test did not succeed through direct exact send when the host exposed that capability.');
    assert(exactSendCalls === 1, `Session send workflow test did not call exact send exactly once. Got: ${exactSendCalls}`);
    assert(exactSendRevealCalls === 0, `Session send workflow test revealed even though exact send was available. Got: ${exactSendRevealCalls}`);
    assert(exactSendFocusedCalls === 0, `Session send workflow test used focused send even though exact send was available. Got: ${exactSendFocusedCalls}`);

    let focusedSendCalls = 0;
    let revealCalls = 0;
    let focusedFallbackModelSelector;
    let focusedFallbackWaitForPersisted;
    const fallbackResult = await sendMessageToSession({
      getPostCreateTimeoutMs() {
        return 1_000;
      },
      async getExactSessionInteropSupport() {
        return {
          canRevealExactSession: true,
          canSendExactSessionMessage: false,
          revealUnsupportedReason: undefined,
          sendUnsupportedReason: 'Exact session-targeted Local send is unsupported on this build.'
        };
      },
      async listChats() {
        return [{
          id: 'session-fallback',
          title: 'Fallback Target',
          lastUpdated: focusedSendCalls > 0 ? '2026-05-07T10:05:01.000Z' : '2026-05-07T10:05:00.000Z',
          mode: 'agent',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-fallback.jsonl'
        }];
      },
      async revealChat(sessionId) {
        revealCalls += 1;
        return {
          ok: true,
          session: {
            id: sessionId,
            title: 'Fallback Target',
            lastUpdated: '2026-05-07T10:05:00.000Z',
            mode: 'agent',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: '/tmp/session-fallback.jsonl'
          },
          revealLifecycle: {
            closedMatchingVisibleTabs: 0,
            closedTabLabels: []
          }
        };
      },
      async sendFocusedMessage(request) {
        focusedSendCalls += 1;
        focusedFallbackModelSelector = request.modelSelector;
        focusedFallbackWaitForPersisted = request.waitForPersisted;
        return {
          ok: true,
          session: {
            id: 'session-fallback',
            title: 'Fallback Target',
            lastUpdated: '2026-05-07T10:05:01.000Z',
            mode: 'agent',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: '/tmp/session-fallback.jsonl'
          },
          selection: {
            mode: { status: 'verified', requested: undefined, observed: 'agent' },
            model: { status: 'verified', requested: undefined, observed: 'copilot/gpt-5-mini' },
            agent: { status: 'verified', requested: '#agent-architect', observed: 'agent-architect' },
            dispatchedPrompt: request.prompt,
            dispatchSurface: 'focused-chat-submit',
            allRequestedVerified: true
          },
          revealLifecycle: {
            closedMatchingVisibleTabs: 0,
            closedTabLabels: [],
            timingMs: {
              focusedInputMs: 1,
              prefillMs: 1,
              submitMs: 1
            }
          }
        };
      },
      async sendMessage() {
        throw new Error('Session send workflow test should not call sendMessage when exact session send is unsupported but fallback reveal is available.');
      }
    }, {
      sessionId: 'session-fallback',
      prompt: 'fallback prompt',
      agentName: 'agent-architect',
      blockOnResponse: true,
      requireSelectionEvidence: false
    });

    assert(fallbackResult.ok === true, 'Session send workflow test did not succeed through explicit reveal-plus-focus fallback when exact send was unsupported.');
    assert(revealCalls === 1, `Session send workflow test did not reveal the target session exactly once before focused fallback send. Got: ${revealCalls}`);
    assert(focusedSendCalls === 1, `Session send workflow test did not call focused send exactly once in fallback mode. Got: ${focusedSendCalls}`);
    assert(fallbackResult.session?.id === 'session-fallback', 'Session send workflow fallback test did not preserve the exact target session id.');
    assert(focusedFallbackModelSelector === undefined, 'Session send workflow fallback test should keep model unset when no model was requested.');
    assert(focusedFallbackWaitForPersisted === true, 'Session send workflow fallback test did not preserve persisted waiting when blockOnResponse=true.');

    const staticTimestampWorkflowRoot = await fs.mkdtemp(path.join(workspaceRoot, 'session-send-static-timestamp-'));
    try {
      const staticTimestampWorkflowSessionFile = path.join(staticTimestampWorkflowRoot, 'session-static-target.jsonl');
      const staticTimestampWorkflowTranscriptFile = path.join(staticTimestampWorkflowRoot, 'transcripts', 'session-static-target.jsonl');
      await fs.mkdir(path.dirname(staticTimestampWorkflowSessionFile), { recursive: true });
      await fs.mkdir(path.dirname(staticTimestampWorkflowTranscriptFile), { recursive: true });
      await fs.writeFile(staticTimestampWorkflowSessionFile, '{}\n', 'utf8');
      await fs.writeFile(staticTimestampWorkflowTranscriptFile, `${[
        JSON.stringify({ type: 'session.start', data: { sessionId: 'session-static-target' }, timestamp: '2026-05-08T14:42:00.000Z' }),
        JSON.stringify({ type: 'user.message', data: { content: 'hello' }, timestamp: '2026-05-08T14:42:00.100Z' }),
        JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '0' }, timestamp: '2026-05-08T14:42:00.200Z' })
      ].join('\n')}\n`, 'utf8');

      let staticTimestampWorkflowAppended = false;
      const staticTimestampWorkflowResult = await sendMessageToSession({
        getPostCreateTimeoutMs() {
          return 1_500;
        },
        async getExactSessionInteropSupport() {
          return {
            canRevealExactSession: true,
            canSendExactSessionMessage: false,
            revealUnsupportedReason: undefined,
            sendUnsupportedReason: 'Exact session-targeted Local send is unsupported on this build.'
          };
        },
        async listChats() {
          return [{
            id: 'session-static-target',
            title: 'Fallback Target',
            lastUpdated: '2026-05-07T10:07:00.000Z',
            mode: 'agent',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true,
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: staticTimestampWorkflowSessionFile
          }];
        },
        async revealChat(sessionId) {
          return {
            ok: true,
            session: {
              id: sessionId,
              title: 'Fallback Target',
              lastUpdated: '2026-05-07T10:07:00.000Z',
              mode: 'agent',
              agent: 'github.copilot.editsAgent',
              model: 'copilot/gpt-5-mini',
              archived: false,
              provider: 'workspaceStorage',
              sessionFile: staticTimestampWorkflowSessionFile
            },
            revealLifecycle: {
              closedMatchingVisibleTabs: 0,
              closedTabLabels: []
            }
          };
        },
        async sendFocusedMessage(request) {
          if (!staticTimestampWorkflowAppended) {
            staticTimestampWorkflowAppended = true;
            await fs.appendFile(staticTimestampWorkflowSessionFile, `${JSON.stringify({
              kind: 2,
              k: ['requests'],
              v: [{
                requestId: 'request-static-timestamp-workflow',
                timestamp: 1778251857321,
                result: { details: 'GPT-5.4 • 1x' },
                message: { text: request.prompt }
              }]
            })}\n`, 'utf8');
          }

          return {
            ok: true,
            session: {
              id: 'session-static-target',
              title: 'Fallback Target',
              lastUpdated: '2026-05-07T10:07:00.000Z',
              mode: 'agent',
              agent: 'github.copilot.editsAgent',
              model: 'copilot/gpt-5-mini',
              archived: false,
              provider: 'workspaceStorage',
              sessionFile: staticTimestampWorkflowSessionFile
            },
            selection: {
              mode: { status: 'verified', requested: undefined, observed: 'agent' },
              model: { status: 'verified', requested: undefined, observed: 'copilot/gpt-5-mini' },
              agent: { status: 'verified', requested: '#agent-architect', observed: 'agent-architect' },
              dispatchedPrompt: request.prompt,
              dispatchSurface: 'focused-chat-submit',
              allRequestedVerified: true
            },
            revealLifecycle: {
              closedMatchingVisibleTabs: 0,
              closedTabLabels: [],
              timingMs: {
                focusedInputMs: 1,
                prefillMs: 1,
                submitMs: 1
              }
            }
          };
        },
        async sendMessage() {
          throw new Error('Session send workflow static-timestamp test should not call exact send when fallback reveal is available.');
        }
      }, {
        sessionId: 'session-static-target',
        prompt: 'hello',
        agentName: 'agent-architect',
        blockOnResponse: true,
        requireSelectionEvidence: false
      });

      assert(staticTimestampWorkflowResult.ok === true, `Session send workflow did not accept a target session-file mutation when lastUpdated stayed unchanged. Got: ${staticTimestampWorkflowResult.reason}`);
      assert(staticTimestampWorkflowResult.session?.id === 'session-static-target', 'Session send workflow static-timestamp test returned the wrong target session.');
    } finally {
      await fs.rm(staticTimestampWorkflowRoot, { recursive: true, force: true });
    }

    let focusedFallbackModelAwareCalls = 0;
    let focusedFallbackModelAwareSelector;
    const fallbackModelAwareResult = await sendMessageToSession({
      getPostCreateTimeoutMs() {
        return 1_000;
      },
      async getExactSessionInteropSupport() {
        return {
          canRevealExactSession: true,
          canSendExactSessionMessage: false,
          revealUnsupportedReason: undefined,
          sendUnsupportedReason: 'Exact session-targeted Local send is unsupported on this build.'
        };
      },
      async listChats() {
        return [{
          id: 'session-fallback-model',
          title: 'Fallback Target',
          lastUpdated: focusedFallbackModelAwareCalls > 0 ? '2026-05-07T10:05:11.000Z' : '2026-05-07T10:05:10.000Z',
          mode: 'agent',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-fallback-model.jsonl'
        }];
      },
      async revealChat(sessionId) {
        return {
          ok: true,
          session: {
            id: sessionId,
            title: 'Fallback Target',
            lastUpdated: '2026-05-07T10:05:10.000Z',
            mode: 'agent',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: '/tmp/session-fallback-model.jsonl'
          },
          revealLifecycle: {
            closedMatchingVisibleTabs: 0,
            closedTabLabels: []
          }
        };
      },
      async sendFocusedMessage(request) {
        focusedFallbackModelAwareCalls += 1;
        focusedFallbackModelAwareSelector = request.modelSelector;
        return {
          ok: true,
          session: {
            id: 'session-fallback-model',
            title: 'Fallback Target',
            lastUpdated: '2026-05-07T10:05:11.000Z',
            mode: 'agent',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: '/tmp/session-fallback-model.jsonl'
          },
          selection: {
            mode: { status: 'verified', requested: undefined, observed: 'agent' },
            model: { status: 'verified', requested: 'copilot/gpt-5-mini', observed: 'copilot/gpt-5-mini' },
            agent: { status: 'verified', requested: '#agent-architect', observed: 'agent-architect' },
            dispatchedPrompt: request.prompt,
            dispatchSurface: 'focused-chat-submit',
            allRequestedVerified: true
          },
          revealLifecycle: {
            closedMatchingVisibleTabs: 0,
            closedTabLabels: [],
            timingMs: {
              focusedInputMs: 1,
              prefillMs: 1,
              submitMs: 1
            }
          }
        };
      },
      async sendMessage() {
        throw new Error('Session send workflow model-aware fallback test should not call sendMessage when exact session send is unsupported but fallback reveal is available.');
      }
    }, {
      sessionId: 'session-fallback-model',
      prompt: 'fallback prompt with model',
      agentName: 'agent-architect',
      modelSelector: { id: 'gpt-5-mini', vendor: 'copilot' },
      blockOnResponse: true,
      requireSelectionEvidence: false
    });

    assert(fallbackModelAwareResult.ok === true, 'Session send workflow model-aware fallback test did not succeed through explicit reveal-plus-focus fallback when exact send was unsupported.');
    assert(focusedFallbackModelAwareCalls === 1, `Session send workflow model-aware fallback test did not call focused send exactly once. Got: ${focusedFallbackModelAwareCalls}`);
    assert(focusedFallbackModelAwareSelector?.id === 'gpt-5-mini', `Session send workflow model-aware fallback test did not preserve the requested model id. Got: ${focusedFallbackModelAwareSelector?.id}`);
    assert(focusedFallbackModelAwareSelector?.vendor === 'copilot', `Session send workflow model-aware fallback test did not preserve the requested model vendor. Got: ${focusedFallbackModelAwareSelector?.vendor}`);

    const settledFocusedShortCircuitRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'session-send-focused-short-circuit-'));
    try {
      Object.defineProperty(vscodeModule.window, 'tabGroups', {
        configurable: true,
        value: {
          all: [
            {
              isActive: true,
              viewColumn: 1,
              tabs: [
                {
                  label: 'Settled Target',
                  isActive: true,
                  isDirty: false,
                  isPinned: false,
                  isPreview: false,
                  input: { viewType: 'chat-editor' }
                }
              ]
            }
          ]
        }
      });

      const settledFocusedStorageRoot = path.join(settledFocusedShortCircuitRoot, 'workspace-storage');
      const settledFocusedSessionFile = path.join(settledFocusedStorageRoot, 'chatSessions', 'session-settled-target.jsonl');
      const settledFocusedTranscriptFile = path.join(settledFocusedStorageRoot, 'transcripts', 'session-settled-target.jsonl');
      const settledFocusedSettledAt = new Date('2026-05-09T07:20:20.809Z');
      await fs.mkdir(path.dirname(settledFocusedSessionFile), { recursive: true });
      await fs.mkdir(path.dirname(settledFocusedTranscriptFile), { recursive: true });
      await fs.writeFile(settledFocusedSessionFile, `${JSON.stringify({
        kind: 2,
        k: ['requests'],
        v: [{
          requestId: 'request-settled-short-circuit',
          timestamp: 1778251857321,
          result: { details: 'GPT-5.4 • 1x' },
          message: { text: 'hello' },
          response: [{ value: 'Steg 3 bekräftat.' }],
          modelState: { value: 1, completedAt: 1778251887421 }
        }]
      })}\n`, 'utf8');
      await fs.writeFile(settledFocusedTranscriptFile, `${[
        JSON.stringify({ type: 'session.start', data: { sessionId: 'session-settled-target' }, timestamp: '2026-05-09T07:19:50.716Z' }),
        JSON.stringify({ type: 'user.message', data: { content: 'hello' }, timestamp: '2026-05-09T07:19:50.716Z' }),
        JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '0' }, timestamp: '2026-05-09T07:19:50.717Z' }),
        JSON.stringify({ type: 'assistant.message', data: { content: 'Steg 3 bekräftat.', toolRequests: [] }, timestamp: '2026-05-09T07:20:20.784Z' }),
        JSON.stringify({ type: 'assistant.turn_end', data: { turnId: '0' }, timestamp: '2026-05-09T07:20:20.809Z' })
      ].join('\n')}\n`, 'utf8');
      await fs.utimes(settledFocusedSessionFile, settledFocusedSettledAt, settledFocusedSettledAt);
      await fs.utimes(settledFocusedTranscriptFile, settledFocusedSettledAt, settledFocusedSettledAt);

      let settledFocusedListChatsCalls = 0;
  let settledFocusedSendFocusedCalled = false;
      const settledFocusedShortCircuitResult = await sendMessageToSession({
        getPostCreateTimeoutMs() {
          return 1_000;
        },
        async getExactSessionInteropSupport() {
          return {
            canRevealExactSession: true,
            canSendExactSessionMessage: false,
            revealUnsupportedReason: undefined,
            sendUnsupportedReason: 'Exact session-targeted Local send is unsupported on this build.'
          };
        },
        async listChats() {
          settledFocusedListChatsCalls += 1;
          if (settledFocusedSendFocusedCalled) {
            throw new Error('Session send workflow should not poll listChats after focused fallback already returned the exact settled target.');
          }

          return [{
            id: 'session-settled-target',
            title: 'Settled Target',
            lastUpdated: '2026-05-09T07:20:20.809Z',
            mode: 'agent',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true,
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: settledFocusedSessionFile
          }];
        },
        async revealChat(sessionId) {
          return {
            ok: true,
            session: {
              id: sessionId,
              title: 'Settled Target',
              lastUpdated: '2026-05-09T07:19:50.716Z',
              mode: 'agent',
              agent: 'github.copilot.editsAgent',
              model: 'copilot/gpt-5-mini',
              archived: false,
              provider: 'workspaceStorage',
              sessionFile: settledFocusedSessionFile
            },
            revealLifecycle: {
              closedMatchingVisibleTabs: 0,
              closedTabLabels: []
            }
          };
        },
        async sendFocusedMessage(request) {
          settledFocusedSendFocusedCalled = true;
          return {
            ok: true,
            session: {
              id: 'session-settled-target',
              title: 'Settled Target',
              lastUpdated: '2026-05-09T07:20:20.809Z',
              mode: 'agent',
              agent: 'github.copilot.editsAgent',
              model: 'copilot/gpt-5-mini',
              hasPendingEdits: false,
              pendingRequestCount: 0,
              lastRequestCompleted: true,
              archived: false,
              provider: 'workspaceStorage',
              sessionFile: settledFocusedSessionFile
            },
            selection: {
              mode: { status: 'verified', requested: undefined, observed: 'agent' },
              model: { status: 'verified', requested: undefined, observed: 'copilot/gpt-5-mini' },
              agent: { status: 'verified', requested: undefined, observed: 'agent-architect' },
              dispatchedPrompt: request.prompt,
              dispatchSurface: 'focused-chat-submit',
              allRequestedVerified: true
            },
            revealLifecycle: {
              closedMatchingVisibleTabs: 0,
              closedTabLabels: [],
              timingMs: {
                focusedInputMs: 1,
                prefillMs: 1,
                submitMs: 1,
                focusedMutationWaitMs: 30107,
                focusedMutationPollCount: 1,
                focusedMutationPollIntervalMs: 250,
                focusedMutationScanMs: 1
              }
            }
          };
        },
        async sendMessage() {
          throw new Error('Session send workflow settled-short-circuit test should not call exact send when fallback reveal is available.');
        }
      }, {
        sessionId: 'session-settled-target',
        prompt: 'hello',
        blockOnResponse: true,
        requireSelectionEvidence: false
      });

      assert(
        settledFocusedShortCircuitResult.ok === true,
        `Session send workflow did not return immediately from an already settled exact target returned by focused fallback. Got: ${JSON.stringify(settledFocusedShortCircuitResult)}`
      );
      assert(settledFocusedShortCircuitResult.session?.id === 'session-settled-target', 'Session send workflow settled-short-circuit test returned the wrong target session.');
      assert(settledFocusedListChatsCalls >= 1, `Session send workflow settled-short-circuit test expected at least one pre-send target lookup. Got: ${settledFocusedListChatsCalls}`);
    } finally {
      Object.defineProperty(vscodeModule.window, 'tabGroups', {
        configurable: true,
        value: {
          all: [
            {
              isActive: true,
              viewColumn: 1,
              tabs: [
                {
                  label: 'Fallback Target',
                  isActive: true,
                  isDirty: false,
                  isPinned: false,
                  isPreview: false,
                  input: { viewType: 'chat-editor' }
                }
              ]
            }
          ]
        }
      });
      await fs.rm(settledFocusedShortCircuitRoot, { recursive: true, force: true });
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-send-workflow-'));
    try {
      const customModeSessionFile = path.join(tempDir, 'session-custom-mode.jsonl');
      await fs.writeFile(customModeSessionFile, JSON.stringify({ kind: 0, v: { sessionId: 'session-custom-mode', requests: [], inputState: {} } }) + '\n', 'utf8');
      let customModeListChatsCalls = 0;
      let customModeRevealCalls = 0;

      const repairedCustomModeResult = await sendMessageToSession({
        getPostCreateTimeoutMs() {
          return 1_000;
        },
        async getExactSessionInteropSupport() {
          return {
            canRevealExactSession: true,
            canSendExactSessionMessage: false,
            revealUnsupportedReason: undefined,
            sendUnsupportedReason: 'Exact session-targeted Local send is unsupported on this build.'
          };
        },
        async listChats() {
          customModeListChatsCalls += 1;
          const modeId = customModeRevealCalls >= 2
            ? 'file:///tmp/anchor.agent.md'
            : customModeListChatsCalls >= 4
              ? 'file:///tmp/anchor-senior.agent.md'
              : 'file:///tmp/anchor.agent.md';
          return [{
            id: 'session-custom-mode',
            title: 'Fallback Target',
            lastUpdated: customModeListChatsCalls >= 4 ? '2026-05-07T10:06:01.000Z' : '2026-05-07T10:06:00.000Z',
            mode: modeId,
            agent: modeId.endsWith('anchor.agent.md') ? 'anchor' : 'anchor-senior',
            model: 'copilot/gpt-5.4',
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true,
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: customModeSessionFile
          }];
        },
        async revealChat(sessionId) {
          customModeRevealCalls += 1;
          return {
            ok: true,
            session: {
              id: sessionId,
              title: 'Fallback Target',
              lastUpdated: '2026-05-07T10:06:00.000Z',
              mode: 'file:///tmp/anchor.agent.md',
              agent: 'anchor',
              model: 'copilot/gpt-5.4',
              archived: false,
              provider: 'workspaceStorage',
              sessionFile: customModeSessionFile
            },
            revealLifecycle: {
              closedMatchingVisibleTabs: 0,
              closedTabLabels: []
            }
          };
        },
        async sendFocusedMessage(request) {
          await fs.appendFile(customModeSessionFile, `${[
            JSON.stringify({
              kind: 2,
              k: ['requests'],
              v: [{
                requestId: 'request-custom-mode',
                timestamp: 1778251857321,
                message: { text: request.prompt }
              }]
            }),
            JSON.stringify({
              kind: 1,
              k: ['requests', 0, 'response'],
              v: [{ value: 'custom mode settled response' }]
            }),
            JSON.stringify({
              kind: 1,
              k: ['requests', 0, 'result'],
              v: { metadata: {}, value: 'GPT-5.4 • 1x' }
            })
          ].join('\n')}\n`, 'utf8');

          return {
            ok: true,
            session: {
              id: 'session-custom-mode',
              title: 'Fallback Target',
              lastUpdated: '2026-05-07T10:06:01.000Z',
              mode: 'file:///tmp/anchor-senior.agent.md',
              agent: 'anchor-senior',
              model: 'copilot/gpt-5.4',
              archived: false,
              provider: 'workspaceStorage',
              sessionFile: customModeSessionFile
            },
            selection: {
              mode: { status: 'verified', requested: undefined, observed: 'file:///tmp/anchor-senior.agent.md' },
              model: { status: 'verified', requested: undefined, observed: 'copilot/gpt-5.4' },
              agent: { status: 'not-requested' },
              dispatchedPrompt: request.prompt,
              dispatchSurface: 'focused-chat-submit',
              allRequestedVerified: true
            },
            revealLifecycle: {
              closedMatchingVisibleTabs: 0,
              closedTabLabels: [],
              timingMs: {
                focusedInputMs: 1,
                prefillMs: 1,
                submitMs: 1
              }
            }
          };
        },
        async sendMessage() {
          throw new Error('Session send workflow custom-mode repair test should not call exact send when only fallback is available.');
        }
      }, {
        sessionId: 'session-custom-mode',
        prompt: 'follow-up prompt',
        blockOnResponse: true,
        requireSelectionEvidence: false
      });

      const customModeSessionRaw = await fs.readFile(customModeSessionFile, 'utf8');
      const customModeRows = customModeSessionRaw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      assert(repairedCustomModeResult.ok === true, 'Session send workflow custom-mode repair test did not succeed through fallback send.');
      assert(customModeRevealCalls === 2, `Session send workflow custom-mode repair test did not re-reveal the repaired target session. Got: ${customModeRevealCalls}`);
      assert(repairedCustomModeResult.session?.mode === 'file:///tmp/anchor.agent.md', `Session send workflow custom-mode repair test did not restore the original custom mode. Got: ${repairedCustomModeResult.session?.mode}`);
      assert(
        customModeRows.some((row) => row.kind === 1 && Array.isArray(row.k) && row.k.join('/') === 'inputState/mode' && row.v?.id === 'file:///tmp/anchor.agent.md'),
        'Session send workflow custom-mode repair test did not append a restoring mode patch to the target session file.'
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } finally {
    vscodeModule.commands.executeCommand = originalExecuteCommand;
    vscodeModule.commands.getCommands = originalGetCommands;
    if (originalTabGroupsDescriptor) {
      Object.defineProperty(vscodeModule.window, 'tabGroups', originalTabGroupsDescriptor);
    }
  }

  let unsupportedSendCalls = 0;
  const unsupportedResult = await sendMessageToSession({
    getPostCreateTimeoutMs() {
      return 1_000;
    },
    async getExactSessionInteropSupport() {
      return {
        canRevealExactSession: false,
        canSendExactSessionMessage: false,
        revealUnsupportedReason: 'Exact session reveal is unsupported on this build.',
        sendUnsupportedReason: 'Exact session-targeted Local send is unsupported on this build.'
      };
    },
    async sendMessage() {
      unsupportedSendCalls += 1;
      throw new Error('Session send workflow test should not call sendMessage when exact session send is unsupported.');
    }
  }, {
    sessionId: 'session-unsupported',
    prompt: 'unsupported prompt',
    blockOnResponse: true,
    requireSelectionEvidence: false
  });

  assert(unsupportedResult.ok === false, 'Session send workflow test incorrectly reported success when exact session send was unsupported.');
  assert(unsupportedSendCalls === 0, `Session send workflow test called sendMessage despite missing exact-session support. Got: ${unsupportedSendCalls}`);
  assert(
    unsupportedResult.reason?.includes('Exact session reveal is unsupported on this build.') === true,
    `Session send workflow test did not preserve the unsupported-build diagnostic. Got: ${unsupportedResult.reason}`
  );
  assert(
    unsupportedResult.reason?.includes('Session-targeted Local follow-up send depends on either exact send or exact reveal before focused submit on this build.') === true,
    `Session send workflow test did not explain that canonical Local follow-up send requires exact send or exact reveal. Got: ${unsupportedResult.reason}`
  );
}

async function runLiveChatQuiescenceChecks() {
  const unsettledDiagnosticsModule = await import(pathToFileURL(distChatInteropUnsettledDiagnostics).href);
  const { getSessionQuiescenceState } = unsettledDiagnosticsModule;

  const settledRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-live-chat-quiescence-settled-'));
  try {
    const settledSessionFile = path.join(settledRoot, 'chatSessions', 'settled-session.jsonl');
    const settledTranscriptFile = path.join(settledRoot, 'GitHub.copilot-chat', 'transcripts', 'settled-session.jsonl');
    await fs.mkdir(path.dirname(settledSessionFile), { recursive: true });
    await fs.mkdir(path.dirname(settledTranscriptFile), { recursive: true });
    await fs.writeFile(settledSessionFile, `${[
      JSON.stringify({
        kind: 0,
        v: {
          version: 3,
          creationDate: 1778251857000,
          sessionId: 'settled-session',
          responderUsername: 'GitHub Copilot',
          requests: [{
            requestId: 'request-settled',
            timestamp: 1778251857321,
            response: [{ value: 'SETTLED_OK' }],
            result: { details: 'GPT-5 mini • 0x' },
            message: { text: 'say settled' }
          }]
        }
      })
    ].join('\n')}\n`, 'utf8');
    await fs.writeFile(settledTranscriptFile, `${[
      JSON.stringify({ type: 'session.start', data: { sessionId: 'settled-session' }, timestamp: '2026-05-08T17:33:00.000Z' }),
      JSON.stringify({ type: 'user.message', data: { content: 'say settled' }, timestamp: '2026-05-08T17:33:00.100Z' }),
      JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '0' }, timestamp: '2026-05-08T17:33:00.200Z' })
    ].join('\n')}\n`, 'utf8');

    const settledState = await getSessionQuiescenceState({
      id: 'settled-session',
      title: 'Settled Session',
      lastUpdated: '2026-05-08T17:33:01.000Z',
      provider: 'workspaceStorage',
      sessionFile: settledSessionFile,
      archived: false,
      pendingRequestCount: 1,
      lastRequestCompleted: false,
      hasPendingEdits: false
    });

    assert(settledState.settled === true, 'Live chat quiescence test did not recognize a session with persisted response and result as settled.');
    assert(settledState.transcriptSettled === true, 'Live chat quiescence test did not allow the persisted session tail to override a lagging transcript.');
    assert(settledState.transcriptReason === undefined, `Live chat quiescence test kept an unsettled transcript reason for a settled session. Got: ${settledState.transcriptReason}`);
  } finally {
    await fs.rm(settledRoot, { recursive: true, force: true });
  }

  const resultOnlySettledRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-live-chat-quiescence-result-only-'));
  try {
    const resultOnlySessionFile = path.join(resultOnlySettledRoot, 'chatSessions', 'result-only-settled-session.jsonl');
    const resultOnlyTranscriptFile = path.join(resultOnlySettledRoot, 'GitHub.copilot-chat', 'transcripts', 'result-only-settled-session.jsonl');
    await fs.mkdir(path.dirname(resultOnlySessionFile), { recursive: true });
    await fs.mkdir(path.dirname(resultOnlyTranscriptFile), { recursive: true });
    await fs.writeFile(resultOnlySessionFile, `${[
      JSON.stringify({
        kind: 2,
        k: ['requests'],
        v: [{
          requestId: 'request-result-only-settled',
          timestamp: 1778251857321,
          result: { details: 'GPT-5.4 • 1x' },
          message: { text: 'say result only settled' }
        }]
      })
    ].join('\n')}\n`, 'utf8');
    await fs.writeFile(resultOnlyTranscriptFile, `${[
      JSON.stringify({ type: 'session.start', data: { sessionId: 'result-only-settled-session' }, timestamp: '2026-05-08T17:33:00.000Z' }),
      JSON.stringify({ type: 'user.message', data: { content: 'say result only settled' }, timestamp: '2026-05-08T17:33:00.100Z' }),
      JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '0' }, timestamp: '2026-05-08T17:33:00.200Z' })
    ].join('\n')}\n`, 'utf8');

    const resultOnlySettledState = await getSessionQuiescenceState({
      id: 'result-only-settled-session',
      title: 'Result Only Settled Session',
      lastUpdated: '2026-05-08T17:33:01.000Z',
      provider: 'workspaceStorage',
      sessionFile: resultOnlySessionFile,
      archived: false,
      pendingRequestCount: 1,
      lastRequestCompleted: false,
      hasPendingEdits: false
    });

    assert(resultOnlySettledState.settled === true, 'Live chat quiescence test did not recognize a session with a persisted final result but no separate response field as settled.');
    assert(resultOnlySettledState.transcriptSettled === true, 'Live chat quiescence test did not allow a result-only persisted tail to override a lagging transcript.');
    assert(resultOnlySettledState.transcriptReason === undefined, `Live chat quiescence test kept an unsettled transcript reason for a result-only settled session. Got: ${resultOnlySettledState.transcriptReason}`);
  } finally {
    await fs.rm(resultOnlySettledRoot, { recursive: true, force: true });
  }

  const missingTranscriptSettledRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-live-chat-quiescence-missing-transcript-settled-'));
  try {
    const missingTranscriptSettledSessionFile = path.join(missingTranscriptSettledRoot, 'chatSessions', 'missing-transcript-settled-session.jsonl');
    await fs.mkdir(path.dirname(missingTranscriptSettledSessionFile), { recursive: true });
    await fs.writeFile(missingTranscriptSettledSessionFile, `${[
      JSON.stringify({
        kind: 2,
        k: ['requests'],
        v: [{
          requestId: 'request-missing-transcript-settled',
          timestamp: 1778251857321,
          result: { details: 'GPT-5.4 • 1x' },
          message: { text: 'say missing transcript settled' }
        }]
      })
    ].join('\n')}\n`, 'utf8');
    const missingTranscriptSettledStats = await fs.stat(missingTranscriptSettledSessionFile);

    const missingTranscriptSettledState = await getSessionQuiescenceState({
      id: 'missing-transcript-settled-session',
      title: 'Missing Transcript Settled Session',
      lastUpdated: '2026-05-08T17:34:01.000Z',
      provider: 'workspaceStorage',
      sessionFile: missingTranscriptSettledSessionFile,
      archived: false,
      pendingRequestCount: 1,
      lastRequestCompleted: false,
      hasPendingEdits: false
    }, {
      quietWindowMs: 1_000,
      now: missingTranscriptSettledStats.mtimeMs + 2_000
    });

    assert(missingTranscriptSettledState.transcriptPresent === false, 'Live chat quiescence missing-transcript settled test unexpectedly found a transcript.');
    assert(missingTranscriptSettledState.transcriptSettled === true, 'Live chat quiescence missing-transcript settled test did not allow the persisted final result to settle the session.');
    assert(missingTranscriptSettledState.settled === true, 'Live chat quiescence missing-transcript settled test did not classify the session as settled.');
    assert(missingTranscriptSettledState.transcriptReason === undefined, `Live chat quiescence missing-transcript settled test kept an unsettled reason after persisted settlement. Got: ${missingTranscriptSettledState.transcriptReason}`);
  } finally {
    await fs.rm(missingTranscriptSettledRoot, { recursive: true, force: true });
  }

  const bootstrapOnlyRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-live-chat-quiescence-bootstrap-only-'));
  try {
    const bootstrapOnlySessionFile = path.join(bootstrapOnlyRoot, 'chatSessions', 'bootstrap-only-session.jsonl');
    await fs.mkdir(path.dirname(bootstrapOnlySessionFile), { recursive: true });
    await fs.writeFile(bootstrapOnlySessionFile, `${[
      JSON.stringify({
        kind: 0,
        v: {
          version: 3,
          creationDate: 1778251857000,
          sessionId: 'bootstrap-only-session',
          responderUsername: 'GitHub Copilot',
          requests: []
        }
      })
    ].join('\n')}\n`, 'utf8');
    const bootstrapOnlyStats = await fs.stat(bootstrapOnlySessionFile);

    const bootstrapOnlyState = await getSessionQuiescenceState({
      id: 'bootstrap-only-session',
      title: 'Bootstrap Only Session',
      lastUpdated: '2026-05-08T17:20:00.000Z',
      provider: 'workspaceStorage',
      sessionFile: bootstrapOnlySessionFile,
      archived: false,
      pendingRequestCount: 0,
      lastRequestCompleted: true,
      hasPendingEdits: false
    }, {
      quietWindowMs: 1_000,
      now: bootstrapOnlyStats.mtimeMs + 2_000
    });

    assert(bootstrapOnlyState.transcriptPresent === false, 'Live chat quiescence bootstrap-only test unexpectedly found a transcript.');
    assert(bootstrapOnlyState.quietWindowSatisfied === true, 'Live chat quiescence bootstrap-only test unexpectedly violated the quiet window.');
    assert(bootstrapOnlyState.settled === false, 'Live chat quiescence bootstrap-only test incorrectly treated a request-less bootstrap session as settled.');
    assert(typeof bootstrapOnlyState.transcriptReason === 'string' && bootstrapOnlyState.transcriptReason.includes('has not recorded a request'), `Live chat quiescence bootstrap-only test did not preserve the expected bootstrap-only reason. Got: ${bootstrapOnlyState.transcriptReason}`);
  } finally {
    await fs.rm(bootstrapOnlyRoot, { recursive: true, force: true });
  }

  const responseOnlyRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-live-chat-quiescence-response-only-'));
  try {
    const responseOnlySessionFile = path.join(responseOnlyRoot, 'chatSessions', 'response-only-session.jsonl');
    const responseOnlyTranscriptFile = path.join(responseOnlyRoot, 'GitHub.copilot-chat', 'transcripts', 'response-only-session.jsonl');
    await fs.mkdir(path.dirname(responseOnlySessionFile), { recursive: true });
    await fs.mkdir(path.dirname(responseOnlyTranscriptFile), { recursive: true });
    await fs.writeFile(responseOnlySessionFile, `${[
      JSON.stringify({
        kind: 2,
        k: ['requests'],
        v: [{
          requestId: 'request-response-only',
          timestamp: 1778251857321,
          response: [{ value: 'PARTIAL_ONLY' }],
          message: { text: 'say response only' }
        }]
      })
    ].join('\n')}\n`, 'utf8');
    await fs.writeFile(responseOnlyTranscriptFile, `${[
      JSON.stringify({ type: 'session.start', data: { sessionId: 'response-only-session' }, timestamp: '2026-05-08T17:35:00.000Z' }),
      JSON.stringify({ type: 'user.message', data: { content: 'say response only' }, timestamp: '2026-05-08T17:35:00.100Z' }),
      JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '0' }, timestamp: '2026-05-08T17:35:00.200Z' })
    ].join('\n')}\n`, 'utf8');

    const responseOnlyState = await getSessionQuiescenceState({
      id: 'response-only-session',
      title: 'Response Only Session',
      lastUpdated: '2026-05-08T17:35:01.000Z',
      provider: 'workspaceStorage',
      sessionFile: responseOnlySessionFile,
      archived: false,
      pendingRequestCount: 0,
      lastRequestCompleted: true,
      hasPendingEdits: false
    });

    assert(responseOnlyState.settled === false, 'Live chat quiescence test incorrectly treated a response-without-result session as settled.');
    assert(responseOnlyState.transcriptSettled === false, 'Live chat quiescence test incorrectly treated a response-without-result transcript tail as settled.');
    assert(typeof responseOnlyState.transcriptReason === 'string', 'Live chat quiescence test did not preserve any unsettled reason for a response-without-result session.');
  } finally {
    await fs.rm(responseOnlyRoot, { recursive: true, force: true });
  }

  const quietWindowRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-live-chat-quiescence-quiet-window-'));
  try {
    const quietWindowSessionFile = path.join(quietWindowRoot, 'chatSessions', 'quiet-window-session.jsonl');
    const quietWindowTranscriptFile = path.join(quietWindowRoot, 'GitHub.copilot-chat', 'transcripts', 'quiet-window-session.jsonl');
    await fs.mkdir(path.dirname(quietWindowSessionFile), { recursive: true });
    await fs.mkdir(path.dirname(quietWindowTranscriptFile), { recursive: true });
    await fs.writeFile(quietWindowSessionFile, `${[
      JSON.stringify({
        kind: 2,
        k: ['requests'],
        v: [{
          requestId: 'request-quiet-window',
          timestamp: 1778251857321,
          result: { details: 'GPT-5.4 • 1x' },
          message: { text: 'say quiet window' }
        }]
      })
    ].join('\n')}\n`, 'utf8');
    await fs.writeFile(quietWindowTranscriptFile, `${[
      JSON.stringify({ type: 'session.start', data: { sessionId: 'quiet-window-session' }, timestamp: '2026-05-08T17:36:00.000Z' }),
      JSON.stringify({ type: 'user.message', data: { content: 'say quiet window' }, timestamp: '2026-05-08T17:36:00.100Z' }),
      JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '0' }, timestamp: '2026-05-08T17:36:00.900Z' })
    ].join('\n')}\n`, 'utf8');

    const quietWindowState = await getSessionQuiescenceState({
      id: 'quiet-window-session',
      title: 'Quiet Window Session',
      lastUpdated: '2026-05-08T17:36:00.950Z',
      provider: 'workspaceStorage',
      sessionFile: quietWindowSessionFile,
      archived: false,
      pendingRequestCount: 0,
      lastRequestCompleted: true,
      hasPendingEdits: false
    }, {
      quietWindowMs: 1_000,
      now: Date.parse('2026-05-08T17:36:01.100Z')
    });

    assert(quietWindowState.summarySettled === true, 'Live chat quiescence quiet-window test unexpectedly lost summary-settled state.');
    assert(quietWindowState.transcriptSettled === true, 'Live chat quiescence quiet-window test unexpectedly lost transcript-settled state.');
    assert(quietWindowState.quietWindowSatisfied === false, 'Live chat quiescence quiet-window test did not detect the violated quiet window.');
    assert(quietWindowState.settled === false, 'Live chat quiescence quiet-window test incorrectly ignored the quiet-window gate.');
  } finally {
    await fs.rm(quietWindowRoot, { recursive: true, force: true });
  }

  const missingTranscriptRecentActivityRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-live-chat-quiescence-missing-transcript-recent-'));
  try {
    const missingTranscriptRecentSessionFile = path.join(missingTranscriptRecentActivityRoot, 'chatSessions', 'missing-transcript-recent-session.jsonl');
    await fs.mkdir(path.dirname(missingTranscriptRecentSessionFile), { recursive: true });
    await fs.writeFile(missingTranscriptRecentSessionFile, '', 'utf8');

    const missingTranscriptRecentState = await getSessionQuiescenceState({
      id: 'missing-transcript-recent-session',
      title: 'Missing Transcript Recent Session',
      lastUpdated: '2026-05-08T17:37:00.950Z',
      provider: 'workspaceStorage',
      sessionFile: missingTranscriptRecentSessionFile,
      archived: false,
      pendingRequestCount: 0,
      lastRequestCompleted: true,
      hasPendingEdits: false
    }, {
      quietWindowMs: 1_000,
      now: Date.parse('2026-05-08T17:37:01.100Z')
    });

    assert(missingTranscriptRecentState.transcriptPresent === false, 'Live chat quiescence missing-transcript recent-activity test unexpectedly found a transcript.');
    assert(missingTranscriptRecentState.quietWindowSatisfied === false, 'Live chat quiescence missing-transcript recent-activity test did not detect recent activity.');
    assert(missingTranscriptRecentState.settled === false, 'Live chat quiescence missing-transcript recent-activity test incorrectly treated the session as settled.');
    assert(typeof missingTranscriptRecentState.transcriptReason === 'string' && missingTranscriptRecentState.transcriptReason.includes('still showing recent activity'), `Live chat quiescence missing-transcript recent-activity test did not preserve the expected reason. Got: ${missingTranscriptRecentState.transcriptReason}`);
  } finally {
    await fs.rm(missingTranscriptRecentActivityRoot, { recursive: true, force: true });
  }

  const ongoingRoot = await fs.mkdtemp(path.join(workspaceRoot, '.tmp-live-chat-quiescence-ongoing-'));
  try {
    const ongoingSessionFile = path.join(ongoingRoot, 'chatSessions', 'ongoing-session.jsonl');
    const ongoingTranscriptFile = path.join(ongoingRoot, 'GitHub.copilot-chat', 'transcripts', 'ongoing-session.jsonl');
    await fs.mkdir(path.dirname(ongoingSessionFile), { recursive: true });
    await fs.mkdir(path.dirname(ongoingTranscriptFile), { recursive: true });
    await fs.writeFile(ongoingSessionFile, `${[
      JSON.stringify({
        kind: 2,
        k: ['requests'],
        v: [{
          requestId: 'request-ongoing',
          timestamp: 1778251857321,
          message: { text: 'say ongoing' }
        }]
      })
    ].join('\n')}\n`, 'utf8');
    await fs.writeFile(ongoingTranscriptFile, `${[
      JSON.stringify({ type: 'session.start', data: { sessionId: 'ongoing-session' }, timestamp: '2026-05-08T17:34:00.000Z' }),
      JSON.stringify({ type: 'user.message', data: { content: 'say ongoing' }, timestamp: '2026-05-08T17:34:00.100Z' }),
      JSON.stringify({ type: 'assistant.turn_start', data: { turnId: '0' }, timestamp: '2026-05-08T17:34:00.200Z' })
    ].join('\n')}\n`, 'utf8');

    const ongoingState = await getSessionQuiescenceState({
      id: 'ongoing-session',
      title: 'Ongoing Session',
      lastUpdated: '2026-05-08T17:34:00.250Z',
      provider: 'workspaceStorage',
      sessionFile: ongoingSessionFile,
      archived: false,
      pendingRequestCount: 0,
      lastRequestCompleted: true,
      hasPendingEdits: false
    }, {
      quietWindowMs: 1_000,
      now: Date.parse('2026-05-08T17:34:00.400Z')
    });

    assert(ongoingState.settled === false, 'Live chat quiescence test incorrectly marked an in-flight session as settled.');
    assert(ongoingState.transcriptSettled === false, 'Live chat quiescence test incorrectly treated an in-flight transcript as settled.');
    assert(typeof ongoingState.transcriptReason === 'string' && ongoingState.transcriptReason.includes('assistant turn'), `Live chat quiescence test did not preserve the expected in-flight transcript reason. Got: ${ongoingState.transcriptReason}`);
  } finally {
    await fs.rm(ongoingRoot, { recursive: true, force: true });
  }
}

async function runLiveChatWorkspaceQuiescenceProbe() {
  const unsettledDiagnosticsModule = await import(pathToFileURL(distChatInteropUnsettledDiagnostics).href);
  const { getSessionQuiescenceState } = unsettledDiagnosticsModule;

  const storageRoot = await findWorkspaceStorageRootForPackage(packageRoot);
  assert(storageRoot, `Could not locate a VS Code workspaceStorage root for ${packageRoot}.`);

  const sessionDir = path.join(storageRoot, 'chatSessions');
  const sessionEntries = await fs.readdir(sessionDir, { withFileTypes: true });
  const sessionFiles = await Promise.all(sessionEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map(async (entry) => {
      const sessionFile = path.join(sessionDir, entry.name);
      const stats = await fs.stat(sessionFile);
      return {
        sessionFile,
        lastUpdatedMs: stats.mtimeMs
      };
    }));

  sessionFiles.sort((left, right) => right.lastUpdatedMs - left.lastUpdatedMs);
  assert(sessionFiles.length >= 2, 'Expected at least two persisted workspace chat sessions for the live quiescence probe.');

  const allSessions = [];
  for (const sessionFile of sessionFiles) {
    const session = await loadWorkspaceProbeSession(sessionFile.sessionFile, sessionFile.lastUpdatedMs);
    const quiescence = await getSessionQuiescenceState(session, {
      quietWindowMs: 1_000
    });
    allSessions.push({ session, quiescence, lastUpdatedMs: sessionFile.lastUpdatedMs });
  }
  const recentSessions = allSessions.slice(0, 12);

  const requestedCurrentSessionId = process.env.TIINEX_LIVE_CHAT_CURRENT_SESSION_ID?.trim();
  const requestedSettledSessionId = process.env.TIINEX_LIVE_CHAT_SETTLED_SESSION_ID?.trim();
  const requestedUnsettledSessionIds = parseSessionIdList(process.env.TIINEX_LIVE_CHAT_UNSETTLED_SESSION_IDS);
  const requestedSettledSessionIds = parseSessionIdList(process.env.TIINEX_LIVE_CHAT_SETTLED_SESSION_IDS);

  const currentSession = requestedCurrentSessionId
    ? allSessions.find((candidate) => candidate.session.id === requestedCurrentSessionId || candidate.session.id.startsWith(requestedCurrentSessionId))
    : allSessions[0];
  assert(currentSession, `Could not resolve the requested current live chat session ${JSON.stringify(requestedCurrentSessionId)}.`);

  for (const sessionId of requestedUnsettledSessionIds) {
    const unsettledCandidate = allSessions.find((candidate) => candidate.session.id === sessionId || candidate.session.id.startsWith(sessionId));
    assert(unsettledCandidate, `Could not resolve requested unsettled workspace chat ${JSON.stringify(sessionId)}.`);
    assert(unsettledCandidate.quiescence.settled === false, `Expected workspace chat ${unsettledCandidate.session.id} to stay unsettled, but it classified as settled.`);
  }

  const settledCandidates = allSessions.filter((candidate) => candidate.session.id !== currentSession.session.id && candidate.quiescence.settled);
  const settledSession = requestedSettledSessionId
    ? allSessions.find((candidate) => candidate.session.id === requestedSettledSessionId || candidate.session.id.startsWith(requestedSettledSessionId))
    : settledCandidates[0];
  assert(
    settledSession,
    `Could not find a settled workspace chat${requestedSettledSessionId ? ` matching ${JSON.stringify(requestedSettledSessionId)}` : ' among the persisted sessions in this workspace'}. Settled candidate count: ${settledCandidates.length}. Recent sessions: ${recentSessions.map((candidate) => `${candidate.session.id}:${candidate.quiescence.settled ? 'settled' : 'ongoing'}`).join(', ')}`
  );
  assert(
    settledSession.quiescence.settled === true,
    `Expected the settled live chat ${settledSession.session.id} to classify as settled.`
  );

  for (const sessionId of requestedSettledSessionIds) {
    const settledCandidate = allSessions.find((candidate) => candidate.session.id === sessionId || candidate.session.id.startsWith(sessionId));
    assert(settledCandidate, `Could not resolve requested settled workspace chat ${JSON.stringify(sessionId)}.`);
    assert(settledCandidate.quiescence.settled === true, `Expected workspace chat ${settledCandidate.session.id} to stay settled, but it classified as ongoing.`);
  }

  process.stdout.write([
    'Live workspace quiescence probe:',
    `- workspaceStorage root: ${storageRoot}`,
    `- current chat report: ${currentSession.session.id} => settled=${currentSession.quiescence.settled} reason=${currentSession.quiescence.transcriptReason ?? 'none'}`,
    `- settled chat: ${settledSession.session.id} => settled=${settledSession.quiescence.settled} reason=${settledSession.quiescence.transcriptReason ?? 'none'}`,
    `- explicit unsettled controls: ${requestedUnsettledSessionIds.length > 0 ? requestedUnsettledSessionIds.join(', ') : 'none'}`,
    `- explicit settled controls: ${requestedSettledSessionIds.length > 0 ? requestedSettledSessionIds.join(', ') : 'none'}`,
    '- recent sessions:',
    ...recentSessions.map((candidate) => `  - ${candidate.session.id} | settled=${candidate.quiescence.settled} | summary=${candidate.quiescence.summarySettled} | transcript=${candidate.quiescence.transcriptSettled} | quiet=${candidate.quiescence.quietWindowSatisfied} | reason=${candidate.quiescence.transcriptReason ?? 'none'}`)
  ].join('\n') + '\n');
}

function parseSessionIdList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function findWorkspaceStorageRootForPackage(targetPackageRoot) {
  const workspaceStorageRoot = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'Code', 'User', 'workspaceStorage');
  const entries = await fs.readdir(workspaceStorageRoot, { withFileTypes: true });
  const normalizedTargetPath = normalizeFsPath(targetPackageRoot);
  const matchingRoots = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const storageRoot = path.join(workspaceStorageRoot, entry.name);
    const workspaceJsonPath = path.join(storageRoot, 'workspace.json');
    let workspaceDescriptor;
    try {
      workspaceDescriptor = JSON.parse(await fs.readFile(workspaceJsonPath, 'utf8'));
    } catch {
      continue;
    }

    const workspaceRef = typeof workspaceDescriptor?.workspace === 'string'
      ? workspaceDescriptor.workspace
      : undefined;
    if (!workspaceRef) {
      continue;
    }

    const resolvedWorkspaceRef = await resolveWorkspaceReference(workspaceRef);
    if (!resolvedWorkspaceRef) {
      continue;
    }

    if (resolvedWorkspaceRef.kind === 'folder') {
      if (normalizeFsPath(resolvedWorkspaceRef.path) === normalizedTargetPath) {
        matchingRoots.push(storageRoot);
      }
      continue;
    }

    try {
      const workspaceFile = JSON.parse(await fs.readFile(resolvedWorkspaceRef.path, 'utf8'));
      const workspaceDir = path.dirname(resolvedWorkspaceRef.path);
      const folders = Array.isArray(workspaceFile?.folders) ? workspaceFile.folders : [];
      const matchesTargetFolder = folders.some((folder) => {
        const folderPath = typeof folder?.path === 'string'
          ? path.resolve(workspaceDir, folder.path)
          : typeof folder?.uri === 'string' && folder.uri.startsWith('file://')
            ? fileURLToPath(folder.uri)
            : undefined;
        return folderPath ? normalizeFsPath(folderPath) === normalizedTargetPath : false;
      });

      if (matchesTargetFolder) {
        matchingRoots.push(storageRoot);
      }
    } catch {
      // Ignore unreadable or deleted workspace file references.
    }
  }

  if (matchingRoots.length === 0) {
    return undefined;
  }

  if (matchingRoots.length === 1) {
    return matchingRoots[0];
  }

  const rankedRoots = await Promise.all(matchingRoots.map(async (storageRoot) => ({
    storageRoot,
    lastChatSessionUpdateMs: await getLatestChatSessionUpdateMs(storageRoot)
  })));
  rankedRoots.sort((left, right) => right.lastChatSessionUpdateMs - left.lastChatSessionUpdateMs);
  return rankedRoots[0]?.storageRoot;
}

async function resolveWorkspaceReference(workspaceRef) {
  if (!workspaceRef.startsWith('file://')) {
    return undefined;
  }

  try {
    const resolvedPath = fileURLToPath(workspaceRef);
    if (resolvedPath.toLowerCase().endsWith('.code-workspace')) {
      return {
        kind: 'workspace-file',
        path: resolvedPath
      };
    }

    return {
      kind: 'folder',
      path: resolvedPath
    };
  } catch {
    return undefined;
  }
}

async function loadWorkspaceProbeSession(sessionFile, lastUpdatedMs) {
  const tailState = await readWorkspaceProbeSessionTailState(sessionFile);
  const latestRequestSettled = Boolean(tailState && tailState.requestCount > 0 && tailState.latestRequestHasResponse && tailState.latestRequestHasResult);
  const hasLatestRequest = Boolean(tailState && tailState.requestCount > 0);

  return {
    id: path.basename(sessionFile, '.jsonl'),
    title: path.basename(sessionFile, '.jsonl'),
    lastUpdated: new Date(lastUpdatedMs).toISOString(),
    archived: false,
    provider: 'workspaceStorage',
    sessionFile,
    hasPendingEdits: false,
    pendingRequestCount: hasLatestRequest && !latestRequestSettled ? 1 : 0,
    lastRequestCompleted: hasLatestRequest ? latestRequestSettled : true
  };
}

async function readWorkspaceProbeSessionTailState(sessionFile) {
  try {
    const raw = await fs.readFile(sessionFile, 'utf8');
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-160);
    if (lines.length === 0) {
      return undefined;
    }

    let requestCount = 0;
    let latestRequestHasResponse = false;
    let latestRequestHasResult = false;

    for (const line of lines) {
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }

      if (row?.kind === 0 && Array.isArray(row?.v?.requests) && row.v.requests.length > 0) {
        requestCount = Math.max(requestCount, row.v.requests.length);
        const latestRequest = row.v.requests[row.v.requests.length - 1];
        latestRequestHasResponse = latestRequest?.response !== undefined;
        latestRequestHasResult = latestRequest?.result !== undefined;
        continue;
      }

      const keyPath = Array.isArray(row?.k) ? row.k : [];
      if (keyPath.length === 1 && keyPath[0] === 'requests' && Array.isArray(row?.v) && row.v.length > 0) {
        requestCount += row.v.length;
        const latestRequest = row.v[row.v.length - 1];
        latestRequestHasResponse = latestRequest?.response !== undefined;
        latestRequestHasResult = latestRequest?.result !== undefined;
        continue;
      }

      if (keyPath[0] !== 'requests') {
        continue;
      }

      if (typeof keyPath[1] === 'number') {
        requestCount = Math.max(requestCount, keyPath[1] + 1);
      }

      if (keyPath[2] === 'response') {
        latestRequestHasResponse = true;
      }

      if (keyPath[2] === 'result') {
        latestRequestHasResult = true;
      }
    }

    return {
      requestCount,
      latestRequestHasResponse,
      latestRequestHasResult
    };
  } catch {
    return undefined;
  }
}

async function getLatestChatSessionUpdateMs(storageRoot) {
  try {
    const sessionDir = path.join(storageRoot, 'chatSessions');
    const entries = await fs.readdir(sessionDir, { withFileTypes: true });
    let latestUpdateMs = -Infinity;

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
        continue;
      }

      const stats = await fs.stat(path.join(sessionDir, entry.name));
      latestUpdateMs = Math.max(latestUpdateMs, stats.mtimeMs);
    }

    return latestUpdateMs;
  } catch {
    return -Infinity;
  }
}

function normalizeFsPath(value) {
  return String(value).replace(/\\/g, '/').toLowerCase();
}

async function runChatFocusTargetChecks() {
  const focusTargetsModule = await import(pathToFileURL(distChatInteropFocusTargets).href);
  const {
    findEditorChatTargetCandidate,
    isLikelyEditorChatTab,
    renderChatFocusReportMarkdown,
    summarizeChatFocusGroups,
    summarizeTabInput,
    renderChatFocusDebugMarkdown
  } = focusTargetsModule;

  const liveChats = [
    {
      id: "session-1",
      title: "Local follow-up attempt request",
      lastUpdated: "2026-04-10T08:43:07.369Z",
      mode: "agent",
      agent: "github.copilot.editsAgent",
      model: "copilot/gpt-5-mini",
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/session-1.jsonl"
    }
  ];

  const customInput = summarizeTabInput({
    constructor: { name: "TabInputCustom" },
    viewType: "github.copilot.chat.editor",
    uri: { toString: () => "vscode-chat-editor://local-follow-up" },
    metadata: {
      title: "Local follow-up attempt request"
    }
  });
  assert(customInput.viewType === "github.copilot.chat.editor", "Chat focus target test did not preserve custom editor viewType metadata.");
  assert(customInput.uri === "vscode-chat-editor://local-follow-up", "Chat focus target test did not preserve custom editor uri metadata.");
  assert(customInput.stringHints.some((value) => value.includes("Local follow-up attempt request")), "Chat focus target test did not collect nested tab-input string hints.");
  assert(customInput.objectKeys.includes("metadata"), "Chat focus target test did not expose shallow tab-input object keys.");

  assert(
    isLikelyEditorChatTab({
      label: "Local follow-up attempt request",
      input: { constructor: { name: "TabInputUnknown" } }
    }, liveChats.map((chat) => chat.title)) === true,
    "Chat focus target test did not recognize a tab whose label matches a known live chat title."
  );

  assert(
    isLikelyEditorChatTab({
      label: "Scratch",
      input: {
        constructor: { name: "TabInputCustom" },
        viewType: "github.copilot.chat.editor",
        uri: { toString: () => "vscode-chat-editor://scratch" }
      }
    }, liveChats.map((chat) => chat.title)) === true,
    "Chat focus target test did not recognize chat-like custom editor metadata."
  );

  const report = summarizeChatFocusGroups([
    {
      isActive: false,
      viewColumn: 1,
      tabs: [
        {
          label: "README.md",
          isActive: true,
          input: {
            constructor: { name: "TabInputText" },
            uri: { toString: () => "file:///tmp/README.md" }
          }
        }
      ]
    },
    {
      isActive: true,
      viewColumn: 2,
      tabs: [
        {
          label: "Local follow-up attempt request",
          isActive: true,
          input: {
            constructor: { name: "TabInputCustom" },
            viewType: "github.copilot.chat.editor",
            uri: { toString: () => "vscode-chat-editor://local-follow-up" }
          }
        }
      ]
    }
  ], liveChats);

  assert(report.activeGroupIndex === 1, "Chat focus target test did not preserve the active tab group index.");
  assert(report.groups[1].tabs[0].isLikelyChatEditor === true, "Chat focus target test did not mark the editor chat tab as likely chat editor.");

  const targetedReport = summarizeChatFocusGroups([
    {
      isActive: true,
      viewColumn: 1,
      tabs: [
        {
          label: "README.md",
          isActive: true,
          input: {
            constructor: { name: "TabInputText" },
            uri: { toString: () => "file:///tmp/README.md" }
          }
        }
      ]
    },
    {
      isActive: false,
      viewColumn: 2,
      tabs: [
        {
          label: "Local follow-up attempt request",
          isActive: false,
          input: {
            constructor: { name: "TabInputCustom" },
            viewType: "github.copilot.chat.editor",
            uri: { toString: () => "vscode-chat-editor://local-follow-up" }
          }
        },
        {
          label: "Focus follow-up probe request",
          isActive: true,
          input: {
            constructor: { name: "TabInputCustom" },
            viewType: "github.copilot.chat.editor",
            uri: { toString: () => "vscode-chat-editor://focus-follow-up" }
          }
        }
      ]
    }
  ], [
    ...liveChats,
    {
      id: "session-2",
      title: "Focus follow-up probe request",
      lastUpdated: "2026-04-10T08:44:07.369Z",
      mode: "agent",
      agent: "github.copilot.editsAgent",
      model: "copilot/gpt-5-mini",
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/session-2.jsonl"
    }
  ]);

  const defaultCandidate = findEditorChatTargetCandidate(targetedReport);
  assert(
    defaultCandidate?.groupIndex === 1 && defaultCandidate?.tabIndex === 1,
    "Chat focus target test did not prefer the active chat-like tab when no explicit target title was requested."
  );

  const targetedCandidate = findEditorChatTargetCandidate(targetedReport, "Local follow-up attempt request");
  assert(
    targetedCandidate?.groupIndex === 1 && targetedCandidate?.tabIndex === 0,
    "Chat focus target test did not locate the requested visible editor chat tab by title."
  );

  const hintedReport = summarizeChatFocusGroups([
    {
      isActive: true,
      viewColumn: 1,
      tabs: [
        {
          label: "Chat",
          isActive: false,
          input: {
            constructor: { name: "TabInputCustom" },
            viewType: "github.copilot.chat.editor",
            metadata: {
              title: "Local follow-up attempt request"
            }
          }
        },
        {
          label: "Focus follow-up probe request",
          isActive: true,
          input: {
            constructor: { name: "TabInputCustom" },
            viewType: "github.copilot.chat.editor"
          }
        }
      ]
    }
  ], [
    ...liveChats,
    {
      id: "session-2",
      title: "Focus follow-up probe request",
      lastUpdated: "2026-04-10T08:44:07.369Z",
      mode: "agent",
      agent: "github.copilot.editsAgent",
      model: "copilot/gpt-5-mini",
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/session-2.jsonl"
    }
  ]);

  const hintedCandidate = findEditorChatTargetCandidate(hintedReport, "Local follow-up attempt request");
  assert(
    hintedCandidate?.groupIndex === 0 && hintedCandidate?.tabIndex === 0,
    "Chat focus target test did not locate the requested editor chat tab by hidden string hints when the label differed."
  );

  const aliasedReport = summarizeChatFocusGroups([
    {
      isActive: true,
      viewColumn: 1,
      tabs: [
        {
          label: "Follow-up attempt request",
          isActive: false,
          input: {
            constructor: { name: "TabInputCustom" },
            viewType: "github.copilot.chat.editor"
          }
        },
        {
          label: "Focus follow-up probe request",
          isActive: true,
          input: {
            constructor: { name: "TabInputCustom" },
            viewType: "github.copilot.chat.editor"
          }
        }
      ]
    }
  ], [
    ...liveChats,
    {
      id: "session-2",
      title: "Focus follow-up probe request",
      lastUpdated: "2026-04-10T08:44:07.369Z",
      mode: "agent",
      agent: "github.copilot.editsAgent",
      model: "copilot/gpt-5-mini",
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/session-2.jsonl"
    }
  ]);

  const aliasedCandidate = findEditorChatTargetCandidate(aliasedReport, "Local follow-up attempt request");
  assert(
    aliasedCandidate?.groupIndex === 0 && aliasedCandidate?.tabIndex === 0,
    "Chat focus target test did not match a visible editor chat label after stripping the Local prefix from the persisted session title."
  );

  const markdown = renderChatFocusReportMarkdown(report);
  assert(markdown.includes("# Chat Focus Targets"), "Chat focus target markdown did not include the expected heading.");
  assert(markdown.includes("likelyChatEditor=yes"), "Chat focus target markdown did not render the likely-chat-editor signal.");
  assert(markdown.includes("hints="), "Chat focus target markdown did not render collected tab-input string hints.");

  const debugMarkdown = renderChatFocusDebugMarkdown(report);
  assert(debugMarkdown.includes("# Chat Focus Debug"), "Chat focus debug markdown did not include the expected heading.");
  assert(debugMarkdown.includes("objectKeys="), "Chat focus debug markdown did not render shallow tab-input object keys.");
  assert(debugMarkdown.includes("stringHints="), "Chat focus debug markdown did not render collected tab-input string hints.");

  const debugSummaryMarkdown = renderChatFocusDebugMarkdown(report, { detailLevel: "summary" });
  assert(debugSummaryMarkdown.includes("## Likely Chat Tabs"), "Chat focus debug summary markdown did not include the compact likely-tab section.");
  assert(!debugSummaryMarkdown.includes("objectKeys="), "Chat focus debug summary markdown must omit raw object keys.");
}

async function runEditorFocusCommandChecks() {
  const editorFocusModule = await import(pathToFileURL(distChatInteropEditorFocusCommands).href);
  const {
    findEditorGroupFocusCommand,
    findNextEditorInGroupCommand,
    findOpenEditorAtIndexCommand,
    findPreviousEditorInGroupCommand
  } = editorFocusModule;

  const commands = new Set([
    "workbench.action.focusFirstEditorGroup",
    "workbench.action.focusSecondEditorGroup",
    "workbench.action.nextEditorInGroup",
    "workbench.action.openEditorAtIndex1",
    "workbench.action.openEditorAtIndex2",
    "workbench.action.previousEditorInGroup"
  ]);

  assert(
    findEditorGroupFocusCommand(commands, 1) === "workbench.action.focusSecondEditorGroup",
    "Editor focus command test did not resolve the expected focus-editor-group command."
  );

  assert(
    findEditorGroupFocusCommand(commands, 4) === undefined,
    "Editor focus command test incorrectly resolved an unavailable focus-editor-group command."
  );

  assert(
    findOpenEditorAtIndexCommand(commands, 1) === "workbench.action.openEditorAtIndex2",
    "Editor focus command test did not resolve the expected open-editor-at-index command."
  );

  assert(
    findOpenEditorAtIndexCommand(commands, 4) === undefined,
    "Editor focus command test incorrectly resolved an unavailable open-editor-at-index command."
  );

  assert(
    findNextEditorInGroupCommand(commands) === "workbench.action.nextEditorInGroup",
    "Editor focus command test did not resolve the expected next-editor-in-group command."
  );

  assert(
    findPreviousEditorInGroupCommand(commands) === "workbench.action.previousEditorInGroup",
    "Editor focus command test did not resolve the expected previous-editor-in-group command."
  );
}

async function runEditorTabMatcherChecks() {
  const editorTabMatcherModule = await import(pathToFileURL(distChatInteropEditorTabMatcher).href);
  const { getLocalChatEditorTabMatchKind, isMatchingLocalChatEditorTab } = editorTabMatcherModule;

  assert(
    isMatchingLocalChatEditorTab(
      {
        label: "Local follow-up attempt request",
        input: {
          constructor: { name: "TabInputCustom" },
          viewType: "github.copilot.chat.editor"
        }
      },
      {
        sessionId: "7ae206a1-089f-40d3-b173-8afaa002177b",
        sessionTitle: "Local follow-up attempt request"
      }
    ) === true,
    "Editor tab matcher test did not match a visible chat tab by exact Local title when no session-resource metadata was available."
  );
  assert(
    getLocalChatEditorTabMatchKind(
      {
        label: "Local follow-up attempt request",
        input: {
          constructor: { name: "TabInputCustom" },
          viewType: "github.copilot.chat.editor"
        }
      },
      {
        sessionId: "7ae206a1-089f-40d3-b173-8afaa002177b",
        sessionTitle: "Local follow-up attempt request"
      }
    ) === "title",
    "Editor tab matcher test did not classify a fallback title-only chat tab correctly."
  );
  assert(
    isMatchingLocalChatEditorTab(
      {
        label: "Local follow-up attempt request",
        input: {
          constructor: { name: "TabInputCustom" },
          viewType: "github.copilot.chat.editor"
        }
      },
      {
        sessionId: "7ae206a1-089f-40d3-b173-8afaa002177b",
        sessionTitle: "Local follow-up attempt request",
        matchMode: "resource-only"
      }
    ) === false,
    "Editor tab matcher test incorrectly allowed a title-only chat tab when resource-only matching was requested."
  );

  assert(
    isMatchingLocalChatEditorTab(
      {
        label: "Chat",
        input: {
          constructor: { name: "TabInputCustom" },
          viewType: "github.copilot.chat.editor",
          uri: {
            toString: () => "vscode-chat-session://local/N2FlMjA2YTEtMDg5Zi00MGQzLWIxNzMtOGFmYWEwMDIxNzdi"
          }
        }
      },
      {
        sessionId: "7ae206a1-089f-40d3-b173-8afaa002177b",
        sessionTitle: "Different visible label"
      }
    ) === true,
    "Editor tab matcher test did not match a visible chat tab by exact Local session resource metadata."
  );
  assert(
    getLocalChatEditorTabMatchKind(
      {
        label: "Chat",
        input: {
          constructor: { name: "TabInputCustom" },
          viewType: "github.copilot.chat.editor",
          uri: {
            toString: () => "vscode-chat-session://local/N2FlMjA2YTEtMDg5Zi00MGQzLWIxNzMtOGFmYWEwMDIxNzdi"
          }
        }
      },
      {
        sessionId: "7ae206a1-089f-40d3-b173-8afaa002177b",
        sessionTitle: "Different visible label",
        matchMode: "resource-only"
      }
    ) === "resource",
    "Editor tab matcher test did not preserve exact Local session-resource matches under resource-only mode."
  );

  assert(
    getLocalChatEditorTabMatchKind(
      {
        label: "Live chat anchor request",
        input: {
          constructor: { name: "Sm" },
          resource: {
            toString: () => "vscode-chat-session://local/N2FlMjA2YTEtMDg5Zi00MGQzLWIxNzMtOGFmYWEwMDIxNzdi"
          }
        }
      },
      {
        sessionId: "7ae206a1-089f-40d3-b173-8afaa002177b",
        sessionTitle: "Live chat anchor request",
        matchMode: "resource-only"
      }
    ) === "resource",
    "Editor tab matcher test did not recognize an exact Local session resource when the tab input exposed it only through a nested object toString()."
  );

  assert(
    isMatchingLocalChatEditorTab(
      {
        label: "Local follow-up attempt request",
        input: {
          constructor: { name: "TabInputCustom" },
          viewType: "github.copilot.chat.editor",
          uri: {
            toString: () => "vscode-chat-session://local/c29tZS1vdGhlci1zZXNzaW9u"
          }
        }
      },
      {
        sessionId: "7ae206a1-089f-40d3-b173-8afaa002177b",
        sessionTitle: "Local follow-up attempt request"
      }
    ) === false,
    "Editor tab matcher test incorrectly matched another Local session when explicit resource metadata pointed at a different chat."
  );

  assert(
    isMatchingLocalChatEditorTab(
      {
        label: "Local follow-up attempt request",
        input: {
          constructor: { name: "Sm" }
        }
      },
      {
        sessionId: "7ae206a1-089f-40d3-b173-8afaa002177b",
        sessionTitle: "Local follow-up attempt request"
      }
    ) === true,
    "Editor tab matcher test did not preserve title-based matching for chat tabs that expose opaque tab-input metadata on this build."
  );

  assert(
    isMatchingLocalChatEditorTab(
      {
        label: "Local follow-up attempt request",
        input: {
          constructor: { name: "TabInputText" },
          uri: {
            toString: () => "file:///tmp/Local%20follow-up%20attempt%20request.md"
          }
        }
      },
      {
        sessionId: "7ae206a1-089f-40d3-b173-8afaa002177b",
        sessionTitle: "Local follow-up attempt request"
      }
    ) === false,
    "Editor tab matcher test incorrectly matched a non-chat file tab that only shared the Local chat title."
  );
}

async function runSelfTargetGuardChecks() {
  const selfTargetGuardModule = await import(pathToFileURL(distChatInteropSelfTargetGuard).href);
  const {
    findRecentLikelyInvokingChat,
    getExactDeleteTerminalBoundSessionId,
    getExactDeleteSelfTargetingReasonFromTerminalSessionIds,
    getExactSelfTargetingReason,
    getFocusedSelfTargetingReason
  } = selfTargetGuardModule;

  const now = Date.parse("2026-04-10T19:30:00.000Z");
  const chats = [
    {
      id: "recent-session",
      title: "Greeting and Introduction",
      lastUpdated: "2026-04-10T19:28:30.000Z",
      mode: "agent",
      agent: "github.copilot.editsAgent",
      model: "copilot/gpt-5.4",
      pendingRequestCount: 0,
      lastRequestCompleted: true,
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/recent-session.jsonl"
    },
    {
      id: "older-session",
      title: "Local follow-up attempt request",
      lastUpdated: "2026-04-10T18:00:00.000Z",
      mode: "agent",
      agent: "github.copilot.editsAgent",
      model: "copilot/gpt-5-mini",
      pendingRequestCount: 0,
      lastRequestCompleted: true,
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/older-session.jsonl"
    }
  ];

  const executingChats = [
    {
      ...chats[0],
      id: "executing-session",
      pendingRequestCount: 1,
      lastRequestCompleted: false
    },
    chats[1]
  ];

  assert(
    findRecentLikelyInvokingChat(chats, now)?.id === "recent-session",
    "Self-target guard test did not identify the recent likely invoking chat."
  );

  assert(
    findRecentLikelyInvokingChat([chats[1], chats[0]], now)?.id === "recent-session",
    "Self-target guard test depended on pre-sorted chat order instead of picking the newest valid chat."
  );

  assert(
    findRecentLikelyInvokingChat([
      {
        ...chats[1],
        id: "invalid-first-session",
        lastUpdated: "not-a-timestamp"
      },
      chats[0]
    ], now)?.id === "recent-session",
    "Self-target guard test did not ignore an invalid leading timestamp when a newer valid chat was present."
  );

  assert(
    getExactSelfTargetingReason(chats, "recent-session", "reveal", now) === undefined,
    "Self-target guard test incorrectly blocked exact reveal for the likely invoking chat heuristic case."
  );

  assert(
    getExactSelfTargetingReason(chats, "recent-session", "send", now) === undefined,
    "Self-target guard test incorrectly blocked an exact send to the likely invoking chat."
  );

  assert(
    getExactSelfTargetingReason(chats, "older-session", "send", now) === undefined,
    "Self-target guard test incorrectly blocked an exact send to a different chat."
  );

  assert(
    getExactSelfTargetingReason(chats, "recent-session", "close-visible-tabs", now) === undefined,
    "Self-target guard test incorrectly blocked exact close-visible-tabs cleanup for the likely invoking chat heuristic case."
  );

  assert(
    getExactSelfTargetingReason(chats, "recent-session", "delete-artifacts", now) === undefined,
    "Self-target guard test incorrectly blocked exact delete-artifacts cleanup for the likely invoking chat heuristic case."
  );

  assert(
    getExactSelfTargetingReason(chats, "older-session", "delete-artifacts", now) === undefined,
    "Self-target guard test incorrectly blocked exact delete-artifacts cleanup for a different chat."
  );

  assert(
    getExactDeleteSelfTargetingReasonFromTerminalSessionIds("recent-session", ["recent-session", "another-session"])?.includes("terminal-bound conversation") === true,
    "Self-target guard test did not block delete-artifacts cleanup for the exact terminal-bound current chat."
  );

  assert(
    getExactDeleteSelfTargetingReasonFromTerminalSessionIds("older-session", ["recent-session", "another-session"]) === undefined,
    "Self-target guard test incorrectly blocked delete-artifacts cleanup for a different chat when using exact terminal-bound current-chat evidence."
  );

  assert(
    getExactDeleteSelfTargetingReasonFromTerminalSessionIds(
      "recent-session",
      ["recent-session", "another-session"],
      { allowTerminalBoundSelfTarget: true }
    ) === undefined,
    "Self-target guard test did not allow terminal-bound current-chat inspection when delete-artifacts is dry-run only."
  );

  assert(
    await getExactDeleteTerminalBoundSessionId(chats, "recent-session") === undefined,
    "Self-target guard test incorrectly resolved a terminal-bound current chat without any workspace state backing it."
  );

  const executingReason = await selfTargetGuardModule.getExactDeleteSelfTargetingReason(executingChats, "executing-session");
  assert(
    executingReason?.includes("pending request") === true,
    "Self-target guard test did not block delete-artifacts cleanup for a target chat that is still executing."
  );

  assert(
    executingReason?.includes("scheduleExactSelfDelete=true") === true,
    "Self-target guard test did not explain the deferred parameter to use when delete-artifacts was blocked for a running chat."
  );

  assert(
    (await selfTargetGuardModule.getExactDeleteSelfTargetingReason([
      {
        ...chats[1],
        id: "ambiguous-session",
        pendingRequestCount: 0,
        lastRequestCompleted: undefined
      }
    ], "ambiguous-session"))?.includes("explicit persisted settled-state evidence") === true,
    "Self-target guard test did not require explicit settled-state evidence before allowing delete-artifacts cleanup."
  );

  assert(
    await selfTargetGuardModule.getExactDeleteSelfTargetingReason(chats, "older-session") === undefined,
    "Self-target guard test incorrectly blocked settled delete-artifacts cleanup when no exact current-chat or executing evidence was present."
  );

  assert(
    getFocusedSelfTargetingReason(chats, "focused-send", undefined, now)?.includes("no explicit target session was provided") === true,
    "Self-target guard test did not block ambiguous focused send without an explicit target."
  );

  assert(
    getFocusedSelfTargetingReason(chats, "focused-editor-send", "recent-session", now)?.includes("queued self-injection") === true,
    "Self-target guard test did not block focused editor send when the requested target matches the likely invoking chat."
  );

  assert(
    getFocusedSelfTargetingReason(chats, "focused-editor-send", "older-session", now) === undefined,
    "Self-target guard test incorrectly blocked focused editor send to a different explicit target."
  );
}

async function runLiveChatSupportMatrixChecks() {
  const supportMatrixModule = await import(pathToFileURL(distChatInteropSupportMatrix).href);
  const {
    buildLiveChatSupportMatrix,
    collectRelevantManifestCommands,
    collectRelevantRuntimeCommands,
    renderLiveChatSupportMatrixMarkdown,
    renderRuntimeChatCommandInventoryMarkdown
  } = supportMatrixModule;

  const matrix = buildLiveChatSupportMatrix({
    commands: [
      "workbench.action.openChat",
      "workbench.action.chat.open",
      "workbench.action.chat.focusInput",
      "workbench.action.chat.submit",
      "workbench.action.chat.openSessionInEditorGroup",
      "workbench.action.chat.openSession.copilotcli",
      "workbench.action.chat.openSessionWithPrompt.copilotcli"
    ],
    exactSessionInterop: {
      canRevealExactSession: true,
      canSendExactSessionMessage: false,
      revealUnsupportedReason: undefined,
      sendUnsupportedReason: "No generic Local exact-session send command was found."
    },
    copilotChatPackageJson: {
      contributes: {
        commands: [
          {
            command: "github.copilot.chat.openModelPicker",
            title: "Change Completions Model"
          }
        ],
        chatParticipants: [
          {
            id: "github.copilot.editsAgent",
            name: "agent",
            fullName: "GitHub Copilot",
            modes: ["agent"],
            isDefault: true,
            isAgent: true
          }
        ],
        languageModelTools: [
          {
            inputSchema: {
              properties: {
                agentName: {
                  enum: ["Plan"]
                }
              }
            }
          }
        ]
      }
    }
  });

  assert(matrix.localNewChatPrompt.status === "best-effort", "Live chat support matrix test did not downgrade Local new-chat prompt support after the observed neutral-create inheritance risk.");
  assert(matrix.localNewChatModel.status === "best-effort", "Live chat support matrix test did not mark Local new-chat model support as best-effort.");
  assert(matrix.localNewChatCustomRolePrompt.status === "best-effort", "Live chat support matrix test did not expose best-effort Local custom role prompt dispatch.");
  assert(matrix.localNewChatCustomAgent.status === "unsupported", "Live chat support matrix test did not keep Local custom-agent support blocked.");
  assert(matrix.localFocusedPromptSubmit.status === "best-effort", "Live chat support matrix test did not expose focused Local prompt submit as best-effort when focusInput and submit exist.");
  assert(matrix.localExactReveal.status === "supported", "Live chat support matrix test did not expose the supported exact Local reveal surface.");
  assert(matrix.localExactSend.status === "unsupported", "Live chat support matrix test did not reflect the missing generic exact Local send command.");
  assert(matrix.localSessionFollowUpSend.status === "supported", "Live chat support matrix test did not reflect the supported Local session follow-up send surface.");
  assert(matrix.manifestParticipants[0]?.id === "github.copilot.editsAgent", "Live chat support matrix test did not expose manifest chat participants.");
  assert(matrix.manifestModelCommands[0]?.includes("Change Completions Model"), "Live chat support matrix test did not expose manifest model commands.");
  assert(matrix.switchAgentOptions.includes("Plan"), "Live chat support matrix test did not expose the manifest switch-agent options.");

  const markdown = renderLiveChatSupportMatrixMarkdown(matrix);
  assert(markdown.includes("Local new chat custom role prompt: best-effort"), "Live chat support matrix markdown did not include the Local custom role prompt dispatch status.");
  assert(markdown.includes("Local new chat custom agent: unsupported"), "Live chat support matrix markdown did not include the Local custom-agent limitation.");
  assert(markdown.includes("Local focused prompt submit: best-effort"), "Live chat support matrix markdown did not include the focused Local prompt submit status.");
  assert(markdown.includes("Local exact reveal: supported"), "Live chat support matrix markdown did not include the supported Local exact reveal status.");
  assert(markdown.includes("Local exact send: unsupported"), "Live chat support matrix markdown did not include the exact Local send status.");
  assert(markdown.includes("Local session follow-up send: supported"), "Live chat support matrix markdown did not include the Local session follow-up send status.");
  assert(markdown.includes("workbench.action.chat.openSessionInEditorGroup: yes"), "Live chat support matrix markdown did not include the editor-group Local reveal command evidence.");
  assert(markdown.includes("github.copilot.chat.openModelPicker => Change Completions Model"), "Live chat support matrix markdown did not include the manifest model command evidence.");

  const summaryMarkdown = renderLiveChatSupportMatrixMarkdown(matrix, { detailLevel: "summary" });
  assert(summaryMarkdown.includes("## Additional Signals"), "Live chat support matrix summary markdown did not include the compact additional-signals section.");
  assert(!summaryMarkdown.includes("## Runtime Commands"), "Live chat support matrix summary markdown must omit the full runtime command section.");

  const runtimeCommandInventory = collectRelevantRuntimeCommands([
    "workbench.action.openChat",
    "workbench.action.chat.open",
    "workbench.action.chat.openSessionWithPrompt.copilotcli",
    "github.copilot.cli.sessions.resumeInTerminal",
    "editor.action.clipboardCopyAction",
    "vscode.editorChat.start"
  ]);
  assert(runtimeCommandInventory.includes("workbench.action.openChat"), "Runtime command inventory test did not include openChat.");
  assert(runtimeCommandInventory.includes("vscode.editorChat.start"), "Runtime command inventory test did not include editorChat.start.");
  assert(runtimeCommandInventory.includes("github.copilot.cli.sessions.resumeInTerminal"), "Runtime command inventory test did not include a Copilot CLI session command.");
  assert(!runtimeCommandInventory.includes("editor.action.clipboardCopyAction"), "Runtime command inventory test incorrectly included an unrelated editor command.");

  const manifestCommandInventory = collectRelevantManifestCommands({
    contributes: {
      commands: [
        { command: "github.copilot.cli.sessions.resumeInTerminal" },
        { command: "github.copilot.chat.openModelPicker" },
        { command: "workbench.action.chat.openSession" },
        { command: "editor.action.clipboardCopyAction" }
      ]
    }
  });
  assert(manifestCommandInventory.includes("github.copilot.cli.sessions.resumeInTerminal"), "Manifest command inventory test did not include a session command.");
  assert(manifestCommandInventory.includes("workbench.action.chat.openSession"), "Manifest command inventory test did not include the generic Local reopen command when declared.");
  assert(!manifestCommandInventory.includes("github.copilot.chat.openModelPicker"), "Manifest command inventory test incorrectly included a non-session chat command.");

  const inventoryMarkdown = renderRuntimeChatCommandInventoryMarkdown({
    runtimeCommands: [
      "workbench.action.openChat",
      "workbench.action.chat.open",
      "vscode.editorChat.start",
      "github.copilot.cli.sessions.resumeInTerminal"
    ],
    copilotChatPackageJson: {
      contributes: {
        commands: [
          { command: "workbench.action.chat.openSession" },
          { command: "github.copilot.cli.sessions.resumeInTerminal" }
        ]
      }
    }
  });
  assert(inventoryMarkdown.includes("# Runtime Chat Command Inventory"), "Runtime chat command inventory markdown did not include the expected heading.");
  assert(inventoryMarkdown.includes("workbench.action.chat.openSession"), "Runtime chat command inventory markdown did not include manifest-declared reopen commands.");

  const inventorySummaryMarkdown = renderRuntimeChatCommandInventoryMarkdown({
    runtimeCommands: [
      "workbench.action.openChat",
      "workbench.action.chat.open",
      "vscode.editorChat.start",
      "github.copilot.cli.sessions.resumeInTerminal"
    ],
    copilotChatPackageJson: {
      contributes: {
        commands: [
          { command: "workbench.action.chat.openSession" },
          { command: "github.copilot.cli.sessions.resumeInTerminal" }
        ]
      }
    },
    detailLevel: "summary"
  });
  assert(inventorySummaryMarkdown.includes("## Open Or Resume Candidates"), "Runtime chat command inventory summary markdown did not include the compact candidate section.");
  assert(!inventorySummaryMarkdown.includes("## Runtime Commands"), "Runtime chat command inventory summary markdown must omit the full runtime command list.");
}

async function runLocalToCopilotCliHandoffChecks() {
  const handoffModule = await import(pathToFileURL(distLocalToCopilotCliHandoff).href);
  const { renderLocalToCopilotCliHandoffMarkdown, buildLocalToCopilotCliWorkerPrompt, buildLocalToCopilotCliExecutionPrompt } = handoffModule;

  const session = {
    sessionId: "local-session-123",
    title: "Broken Local Incident",
    jsonlPath: "/tmp/local-session-123.jsonl",
    workspaceStorageDir: "/tmp/workspaceStorage/abc",
    mtime: Date.parse("2026-04-09T12:00:00.000Z"),
    size: 1024
  };
  const support = {
    canRevealExactSession: false,
    canSendExactSessionMessage: false,
    sendUnsupportedReason: "Exact session-targeted send for ordinary local chats is not supported in this VS Code/Copilot build."
  };
  const latestCli = {
    sessionId: "cli-session-456",
    sessionDir: "/home/test/.copilot/session-state/cli-session-456",
    eventsPath: "/home/test/.copilot/session-state/cli-session-456/events.jsonl",
    workspaceYamlPath: "/home/test/.copilot/session-state/cli-session-456/workspace.yaml",
    summary: "worker lane",
    cwd: "/workspace",
    updatedAt: "2026-04-09T12:30:00.000Z",
    canonicalResource: "copilotcli:/cli-session-456",
    latestLoggedResource: "copilotcli:/cli-session-456",
    candidateResources: ["copilotcli:/cli-session-456"]
  };

  const prompt = buildLocalToCopilotCliWorkerPrompt(session, latestCli);
  assert(prompt.includes("Do not claim Local-to-CLI session continuity."), "Local-to-CLI handoff prompt must preserve the no-identity-bridge rule.");
  assert(prompt.includes("Worker canonical resource: copilotcli:/cli-session-456"), "Local-to-CLI handoff prompt must include the CLI canonical resource when available.");

  const markdown = renderLocalToCopilotCliHandoffMarkdown({
    session,
    support,
    latestCli,
    snapshotMarkdown: "# Session Snapshot\n\n- Snapshot body",
    profileMarkdown: "# Session Profile\n\n- [high] Finding body",
    indexMarkdown: "# Session Index\n\n- L10 | preview"
  });

  assert(markdown.includes("# Local To Copilot CLI Handoff"), "Local-to-CLI handoff markdown must render the handoff header.");
  assert(markdown.includes("- Canonical session or resource: copilotcli:/cli-session-456"), "Local-to-CLI handoff markdown must include the CLI canonical resource.");
  assert(markdown.includes("Current Local follow-up transport"), "Local-to-CLI handoff markdown must preserve the Local follow-up transport provenance.");
  assert(markdown.includes("## Exact Handoff Prompt"), "Local-to-CLI handoff markdown must include the exact handoff prompt section.");
  assert(markdown.includes("Latest logged Copilot CLI resource") === false, "Local-to-CLI handoff markdown should prefer the exact canonical resource over noisy logged-resource hints.");

  const executionPrompt = buildLocalToCopilotCliExecutionPrompt({
    session,
    support,
    latestCli,
    snapshotMarkdown: "# Session Snapshot\n\n- Snapshot body",
    profileMarkdown: "# Session Profile\n\n- [high] Finding body",
    indexMarkdown: "# Session Index\n\n- L10 | preview"
  });

  assert(executionPrompt.includes("You are working in a Copilot CLI session as a separate worker lane"), "Local-to-CLI execution prompt must include the worker-lane instruction block.");
  assert(executionPrompt.includes("# Local To Copilot CLI Handoff"), "Local-to-CLI execution prompt must include the incident package content.");
  assert(executionPrompt.includes("## Exact Handoff Prompt") === false, "Local-to-CLI execution prompt must not recursively include the embedded handoff prompt section.");
}

async function runPendingRequestHeuristicChecks() {
  const toolsModule = await import(pathToFileURL(distToolsCore).href);
  const {
    buildWindow,
    buildContextEstimate,
    buildSnapshot,
    buildTranscriptEvidence,
    renderWindowMarkdown,
    renderContextEstimateMarkdown,
    renderSnapshotMarkdown,
    renderTranscriptEvidenceMarkdown
  } = toolsModule;
  const tempDir = path.join(workspaceRoot, "tools", ".test-pending-request-heuristics");
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });

  const falsePositivePath = path.join(tempDir, "false-positive.jsonl");
  await fs.writeFile(falsePositivePath, [
    JSON.stringify({ kind: 0, v: { version: 3, creationDate: 1, sessionId: "false-positive", responderUsername: "GitHub Copilot" } }),
    JSON.stringify({ kind: 2, k: ["requests"], v: [{ requestId: "request-1", timestamp: 1, message: "hello" }] }),
    JSON.stringify({ kind: 1, k: ["requests", 0, "modelState"], v: { value: 1, completedAt: 2 } }),
    JSON.stringify({ kind: 2, k: ["requests", 0, "response"], v: [{ kind: "thinking", value: "", id: "opaque-thinking-id" }, { value: "Hello there" }] }),
    JSON.stringify({ kind: 1, k: ["requests", 0, "result"], v: { metadata: {} } })
  ].join("\n") + "\n", "utf-8");

  const falsePositiveSnapshot = await buildSnapshot({ sessionFile: falsePositivePath });
  assert(falsePositiveSnapshot.pendingRequestCount === 0, "Pending-request heuristic must not treat opaque response ids as pending requests.");
  assert(falsePositiveSnapshot.pendingRequestIds.length === 0, "Pending-request heuristic must not emit fake pending request ids from response payloads.");

  const explicitPendingPath = path.join(tempDir, "explicit-pending.jsonl");
  await fs.writeFile(explicitPendingPath, [
    JSON.stringify({ kind: 0, v: { version: 3, creationDate: 1, sessionId: "explicit-pending", pendingRequests: [{ id: "request-pending" }] } }),
    JSON.stringify({ kind: 2, k: ["requests"], v: [{ requestId: "request-pending", timestamp: 1, message: "hello" }] }),
    JSON.stringify({ kind: 1, k: ["requests", 0, "modelState"], v: { value: 0 } })
  ].join("\n") + "\n", "utf-8");

  const explicitPendingSnapshot = await buildSnapshot({ sessionFile: explicitPendingPath });
  assert(explicitPendingSnapshot.pendingRequestCount === 1, "Pending-request heuristic must still honor explicit pendingRequests rows.");
  assert(explicitPendingSnapshot.pendingRequestIds[0] === "request-pending", "Pending-request heuristic must preserve explicit pending request ids.");

  const persistedSelectionPath = path.join(tempDir, "persisted-selection.jsonl");
  await fs.writeFile(persistedSelectionPath, [
    JSON.stringify({
      kind: 0,
      v: {
        version: 3,
        creationDate: 1,
        sessionId: "persisted-selection",
        inputState: {
          mode: { id: "agent", kind: "agent" },
          selectedModel: { identifier: "copilot/gpt-5.4", metadata: { name: "GPT-5.4" } }
        },
        requests: [
          {
            requestId: "request-1",
            timestamp: 1,
            message: { text: "hello" },
            agent: { id: "github.copilot.editsAgent", name: "agent", fullName: "GitHub Copilot" },
            modelId: "copilot/gpt-5.4",
            modeInfo: { modeId: "agent", modeName: "Agent" }
          }
        ]
      }
    }),
    JSON.stringify({ kind: 1, k: ["inputState", "mode"], v: { id: "file:///tmp/agent-architect.agent.md", kind: "agent" } }),
    JSON.stringify({ kind: 1, k: ["inputState", "selectedModel"], v: { identifier: "copilot/gpt-5-mini", metadata: { name: "GPT-5 mini" } } }),
    JSON.stringify({
      kind: 2,
      k: ["requests"],
      v: [
        {
          requestId: "request-1",
          timestamp: 1,
          message: { text: "hello" },
          agent: { id: "github.copilot.editsAgent", name: "agent", fullName: "GitHub Copilot" },
          modelId: "copilot/gpt-5.4",
          modeInfo: { modeId: "agent", modeName: "Agent" }
        },
        {
          requestId: "request-2",
          timestamp: 2,
          message: { text: "follow-up" },
          agent: { id: "agent-architect", name: "agent-architect", fullName: "agent-architect" },
          modelId: "copilot/gpt-5-mini",
          modeInfo: { modeId: "custom", modeName: "agent-architect" }
        }
      ]
    })
  ].join("\n") + "\n", "utf-8");

  const persistedSelectionSnapshot = await buildSnapshot({ sessionFile: persistedSelectionPath });
  assert(
    persistedSelectionSnapshot.persistedSelection.inputModeId === "file:///tmp/agent-architect.agent.md",
    "Snapshot must recover the persisted input mode id even when it arrives through a later inputState delta row."
  );
  assert(
    persistedSelectionSnapshot.persistedSelection.selectedModelId === "copilot/gpt-5-mini",
    "Snapshot must recover the persisted selected model id even when it arrives through a later inputState delta row."
  );
  assert(
    persistedSelectionSnapshot.persistedSelection.latestRequestAgentId === "agent-architect",
    "Snapshot must recover the latest request agent id from the newest persisted request batch."
  );
  assert(
    persistedSelectionSnapshot.persistedSelection.latestRequestModelId === "copilot/gpt-5-mini",
    "Snapshot must recover the latest request model id from the newest persisted request batch."
  );
  const persistedSelectionMarkdown = renderSnapshotMarkdown(persistedSelectionSnapshot);
  assert(
    persistedSelectionMarkdown.includes("- Selected model id: copilot/gpt-5-mini"),
    "Snapshot markdown must render the persisted selected model id."
  );
  assert(
    persistedSelectionMarkdown.includes("- Latest request agent id: agent-architect"),
    "Snapshot markdown must render the latest request agent id."
  );

  const transcriptEvidence = await buildTranscriptEvidence({ sessionFile: benchmarkSessionFile });
  const transcriptSummaryMarkdown = renderTranscriptEvidenceMarkdown(transcriptEvidence, { detailLevel: "summary" });
  assert(
    transcriptSummaryMarkdown.includes("## Evidence Block Inventory"),
    "Transcript summary markdown must render the compact evidence block inventory section."
  );
  assert(
    !transcriptSummaryMarkdown.includes("```"),
    "Transcript summary markdown must omit verbatim fenced payload bodies."
  );

  const laggingTranscriptRoot = path.join(tempDir, "lagging-transcript");
  const laggingSessionFile = path.join(laggingTranscriptRoot, "chatSessions", "lagging.jsonl");
  const laggingTranscriptFile = path.join(laggingTranscriptRoot, "GitHub.copilot-chat", "transcripts", "lagging.jsonl");
  await fs.mkdir(path.dirname(laggingSessionFile), { recursive: true });
  await fs.mkdir(path.dirname(laggingTranscriptFile), { recursive: true });
  await fs.writeFile(laggingSessionFile, [
    JSON.stringify({ kind: 0, v: { version: 3, creationDate: 1, sessionId: "lagging", responderUsername: "GitHub Copilot" } }),
    JSON.stringify({ kind: 2, k: ["requests"], v: [{ requestId: "request-1", timestamp: 1, message: { text: "hello" } }] }),
    JSON.stringify({ kind: 1, k: ["requests", 0, "response"], v: [{ value: "Final answer from session JSONL" }] }),
    JSON.stringify({ kind: 1, k: ["requests", 0, "result"], v: { metadata: {}, value: "GPT-5 mini • 0x" } })
  ].join("\n") + "\n", "utf-8");
  await fs.writeFile(laggingTranscriptFile, [
    JSON.stringify({ type: "session.start", data: { sessionId: "lagging" } }),
    JSON.stringify({ type: "user.message", data: { content: "hello" } }),
    JSON.stringify({ type: "assistant.turn_start", data: { turnId: "0" } })
  ].join("\n") + "\n", "utf-8");

  const laggingTranscriptEvidence = await buildTranscriptEvidence({ sessionFile: laggingSessionFile });
  assert(
    laggingTranscriptEvidence.transcriptAvailable === false,
    "Transcript evidence must fall back to session-derived evidence when the transcript file stalls before the latest settled assistant turn."
  );
  assert(
    typeof laggingTranscriptEvidence.unavailableReason === "string"
      && laggingTranscriptEvidence.unavailableReason.includes("latest settled assistant turn"),
    "Transcript fallback must explain that the canonical transcript ended before the latest settled assistant turn."
  );
  assert(
    laggingTranscriptEvidence.fallbackSnapshot?.latestAssistantMessage?.preview.includes("Final answer from session JSONL"),
    "Transcript fallback must expose the settled assistant answer from the session JSONL snapshot."
  );
  const laggingTranscriptMarkdown = renderTranscriptEvidenceMarkdown(laggingTranscriptEvidence, { detailLevel: "summary" });
  assert(
    laggingTranscriptMarkdown.includes("# Session-Derived Evidence"),
    "Transcript fallback markdown must switch to the session-derived evidence view when the transcript artifact is incomplete."
  );
  assert(
    laggingTranscriptMarkdown.includes("## Persisted Session Summary"),
    "Transcript fallback markdown must render the persisted session summary for an incomplete transcript artifact."
  );

  const contextEstimate = await buildContextEstimate({
    sessionFile: benchmarkSessionFile,
    assumedWindowTokens: 400000
  });
  const contextEstimateSummaryMarkdown = renderContextEstimateMarkdown(contextEstimate, { detailLevel: "summary" });
  assert(
    contextEstimateSummaryMarkdown.includes("## Top Contributors"),
    "Context estimate summary markdown must render the compact top-contributors section."
  );
  assert(
    !contextEstimateSummaryMarkdown.includes("## Estimated Breakdown"),
    "Context estimate summary markdown must omit the full estimated-breakdown section."
  );

  const compactionFixture = await createCompactionSessionFixture();
  try {
    const compactWindow = await buildWindow({
      sessionFile: compactionFixture.sessionFile,
      afterLatestCompact: true,
      anchorText: "diagnosis-start",
      anchorOccurrence: "last",
      before: 1,
      after: 1,
      maxMatches: 1
    });
    assert(compactWindow.afterLatestCompact === true, "Window filter test must record that the latest-compaction filter was applied.");
    assert(compactWindow.anchorOccurrence === "last", "Window filter test must preserve the requested anchor occurrence.");
    assert(compactWindow.compactionBoundaryLine !== undefined, "Window filter test must surface the applied compaction boundary line.");
    assert(compactWindow.matches.length === 1, "Window filter test must emit exactly one bounded match window for the filtered anchor.");
    assert(compactWindow.matches[0].some((entry) => entry.preview?.includes("diagnosis-start")), "Window filter test must include the anchored diagnosis row in the filtered window.");

    const compactWindowMarkdown = renderWindowMarkdown(compactWindow);
    assert(compactWindowMarkdown.includes("- After latest compact: yes"), "Window markdown must render the latest-compaction scope flag.");

    const compactionTranscriptFixture = await createCompactionTranscriptFixture();
    try {
      const filteredTranscript = await buildTranscriptEvidence({
      sessionFile: compactionTranscriptFixture.sessionFile,
      afterLatestCompact: true,
      anchorText: "diagnosis-start",
      maxBlocks: 2
    });
      assert(filteredTranscript.transcriptAvailable === true, "Transcript filter test must use the transcript-format fixture as canonical evidence.");
      assert(filteredTranscript.compactionBoundaryApplied === true, "Transcript filter test must record that the compaction boundary was applied.");
      assert(filteredTranscript.maxBlocks === 2, "Transcript filter test must preserve the requested maxBlocks value.");

      const filteredTranscriptMarkdown = renderTranscriptEvidenceMarkdown(filteredTranscript, { detailLevel: "summary" });
      assert(filteredTranscriptMarkdown.includes("- After latest compact: yes"), "Transcript markdown must render the latest-compaction filter metadata.");
      assert(filteredTranscriptMarkdown.includes("- Max blocks: 2"), "Transcript markdown must render the maxBlocks metadata for transcript-backed filters.");
    } finally {
      await fs.rm(compactionTranscriptFixture.rootDir, { recursive: true, force: true });
    }

    const selfMatchTranscriptFixture = await createTranscriptAnchorSelfMatchFixture();
    try {
      let selfMatchError;
      try {
        await buildTranscriptEvidence({
          sessionFile: selfMatchTranscriptFixture.sessionFile,
          anchorText: "self-only-anchor"
        });
      } catch (error) {
        selfMatchError = error;
      }
      assert(selfMatchError instanceof Error, "Transcript self-match regression must reject anchors that appear only inside tool invocation arguments.");
      assert(selfMatchError.message.includes("No transcript evidence block matched anchor text: self-only-anchor"), "Transcript self-match regression must report a no-match error for tool-invocation-only anchors.");

      const realAnchorTranscript = await buildTranscriptEvidence({
        sessionFile: selfMatchTranscriptFixture.sessionFile,
        anchorText: "real-anchor",
        anchorOccurrence: "last",
        maxBlocks: 1
      });
      assert(realAnchorTranscript.blocks.length === 1, "Transcript anchor regression must still emit the anchored transcript slice for real content matches.");
      assert(realAnchorTranscript.blocks[0].payloads.some((payload) => payload.content.includes("real-anchor")), "Transcript anchor regression must preserve real transcript message matches.");
    } finally {
      await fs.rm(selfMatchTranscriptFixture.rootDir, { recursive: true, force: true });
    }

    const filteredContextEstimate = await buildContextEstimate({
      sessionFile: compactionFixture.sessionFile,
      assumedWindowTokens: 400000,
      afterLatestCompact: true,
      latestRequestFamilies: 1
    });
    assert(filteredContextEstimate.afterLatestCompact === true, "Context estimate filter test must record the latest-compaction flag.");
    assert(filteredContextEstimate.compactionBoundaryApplied === true, "Context estimate filter test must report that the persisted compaction boundary was applied.");
    assert(filteredContextEstimate.latestRequestFamiliesLimit === 1, "Context estimate filter test must preserve the requested latest request family limit.");
    assert(filteredContextEstimate.activeRequestFamilies === 1, "Context estimate filter test must cap the active request families to the requested limit.");

    const filteredContextEstimateMarkdown = renderContextEstimateMarkdown(filteredContextEstimate, { detailLevel: "summary" });
    assert(filteredContextEstimateMarkdown.includes("- Compaction boundary applied: yes"), "Context estimate markdown must report that the persisted compaction boundary was applied.");
    assert(filteredContextEstimateMarkdown.includes("Latest request families limit: 1"), "Context estimate markdown must render the latest request family limit.");

    const noCompactionFixture = await createNoCompactionSessionFixture();
    try {
      const fallbackContextEstimate = await buildContextEstimate({
        sessionFile: noCompactionFixture.sessionFile,
        afterLatestCompact: true
      });
      assert(fallbackContextEstimate.afterLatestCompact === true, "Compact-fallback estimate must preserve the requested latest-compaction flag.");
      assert(fallbackContextEstimate.compactionBoundaryApplied === false, "Compact-fallback estimate must report that no persisted compaction boundary was applied.");
      assert(fallbackContextEstimate.signals.some((signal) => signal.includes("could not be applied") && signal.includes("falls back to the bounded active request tail")), "Compact-fallback estimate must explain why it fell back to the bounded active request tail.");

      const fallbackContextEstimateMarkdown = renderContextEstimateMarkdown(fallbackContextEstimate, { detailLevel: "summary" });
      assert(fallbackContextEstimateMarkdown.includes("- After latest compact: yes"), "Compact-fallback markdown must preserve the requested latest-compaction flag.");
      assert(fallbackContextEstimateMarkdown.includes("- Compaction boundary applied: no (fell back to bounded active tail)"), "Compact-fallback markdown must report the bounded-tail fallback.");
    } finally {
      await fs.rm(noCompactionFixture.rootDir, { recursive: true, force: true });
    }
  } finally {
    await fs.rm(compactionFixture.rootDir, { recursive: true, force: true });
  }

  await fs.rm(tempDir, { recursive: true, force: true });
}

async function runCopilotCliInspectionChecks() {
  const copilotCliSummaryModule = await import(pathToFileURL(distCopilotCliSummary).href);
  const { renderCopilotCliLatestTurnLines, summarizeCopilotCliEventStream } = copilotCliSummaryModule;
  const copilotCliToolsModule = await import(pathToFileURL(distCopilotCliTools).href);
  const { inspectCopilotCliSession, listCopilotCliSessions, renderCopilotCliSessionInspectionMarkdown } = copilotCliToolsModule;

  const raw = [
    JSON.stringify({ type: "session.resume", data: { eventCount: 5 }, timestamp: "2026-04-09T16:00:00.000Z" }),
    JSON.stringify({ type: "user.message", data: { content: "Investigate the pending request count", interactionId: "interaction-123" }, timestamp: "2026-04-09T16:00:01.000Z" }),
    JSON.stringify({ type: "assistant.message", data: { content: "", toolRequests: [{ name: "bash" }, { name: "report_intent" }] }, timestamp: "2026-04-09T16:00:02.000Z" }),
    JSON.stringify({ type: "tool.execution_start", data: { toolName: "bash" }, timestamp: "2026-04-09T16:00:03.000Z" }),
    JSON.stringify({ type: "assistant.message", data: { content: "The pending count looks wrong.", toolRequests: [] }, timestamp: "2026-04-09T16:00:04.000Z" }),
    JSON.stringify({ type: "assistant.turn_end", data: { turnId: "3" }, timestamp: "2026-04-09T16:00:05.000Z" })
  ].join("\n");

  const latestTurn = summarizeCopilotCliEventStream(raw);
  assert(latestTurn.userMessage === "Investigate the pending request count", "Copilot CLI inspection must capture the latest user message from events.jsonl.");
  assert(latestTurn.assistantMessage === "The pending count looks wrong.", "Copilot CLI inspection must capture the latest assistant message from events.jsonl.");
  assert(latestTurn.toolRequestNames.join(",") === "bash,report_intent", "Copilot CLI inspection must preserve declared tool requests for the latest turn.");
  assert(latestTurn.toolExecutionCount === 1, "Copilot CLI inspection must count tool executions observed after the latest user message.");
  assert(latestTurn.completed === true, "Copilot CLI inspection must recognize a completed latest turn when assistant.turn_end is present.");

  const latestTurnLines = renderCopilotCliLatestTurnLines(latestTurn);
  assert(latestTurnLines.some((line) => line === "- Latest assistant message: The pending count looks wrong."), "Copilot CLI latest-turn rendering must include the latest assistant message preview.");
  assert(latestTurnLines.some((line) => line === "- Events scanned to derive latest turn: 6"), "Copilot CLI latest-turn rendering must clearly label the event scan count as a derivation detail.");

  const fixture = await createCopilotCliSessionFixture();
  try {
    const sessions = await listCopilotCliSessions({ sessionStateRoot: fixture.sessionStateRoot });
    assert(sessions.length === 2, "Copilot CLI tools list test did not discover both fixture sessions.");
    const inspection = await inspectCopilotCliSession({ sessionStateRoot: fixture.sessionStateRoot, sessionId: "cli-session-aaa" });
    assert(inspection?.latestTurn?.assistantMessage === "Investigated via worker lane.", "Copilot CLI tools inspect test did not recover the latest assistant message from the fixture.");
    const markdown = renderCopilotCliSessionInspectionMarkdown(inspection, { sessionStateRoot: fixture.sessionStateRoot });
    assert(markdown.includes("Workspace YAML summary: fixture summary"), "Copilot CLI tools inspection markdown did not render workspace metadata.");
    assert(markdown.includes("Latest assistant message: Investigated via worker lane."), "Copilot CLI tools inspection markdown did not render the latest assistant message.");
  } finally {
    await fs.rm(fixture.rootDir, { recursive: true, force: true });
  }
}

async function runAgentArchitectProcessEvidenceChecks() {
  const processEvidenceModule = await import(pathToFileURL(distAgentArchitectProcessEvidence).href);
  const { validateAgentArchitectProcessEvidenceFile } = processEvidenceModule;

  const rootDir = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-agent-architect-process-evidence-"));
  try {
    const tempAgentsDir = path.join(rootDir, ".github", "agents");
    const tempCompanionsDir = path.join(tempAgentsDir, "companions");
    await fs.mkdir(tempCompanionsDir, { recursive: true });

    const canonicalRuntimeArtifact = [
      "---",
      'name: tmp-process-evidence-agent',
      'description: "Temporary process evidence artifact."',
      "model: GPT-5 mini",
      "target: vscode",
      "disable-model-invocation: false",
      "tools: [read]",
      "user-invocable: true",
      "---",
      "",
      "## 0 IDENTITY",
      "",
      "You are `tmp-process-evidence-agent`.",
      "",
      "## 1 PURPOSE",
      "",
      "Temporary purpose.",
      "",
      "## 2 SCOPE",
      "",
      "Temporary scope.",
      "",
      "## 3 NON-GOALS",
      "",
      "Temporary non-goals.",
      "",
      "## 4 OPERATING MODEL",
      "",
      "Temporary operating model.",
      "",
      "## 5 INPUTS",
      "",
      "Temporary inputs.",
      "",
      "## 6 OUTPUTS",
      "",
      "Temporary outputs.",
      "",
      "## 7 PROCESS",
      "",
      "Temporary process.",
      "",
      "## 8 DECISION RULES",
      "",
      "Temporary decision rules.",
      "",
      "## 9 CONSTRAINTS",
      "",
      "Temporary constraints.",
      "",
      "## 10 HANDOFF RULES",
      "",
      "Temporary handoff rules.",
      "",
      "## 11 VALIDATION",
      "",
      "Temporary validation.",
      "",
      "## 12 MAINTENANCE RULES",
      "",
      "Temporary maintenance rules.",
      ""
    ].join("\n");

    const contaminatedRuntimeArtifact = canonicalRuntimeArtifact.replace(
      "Temporary validation.",
      [
        "Temporary validation.",
        "",
        "Creation evidence:",
        "- created_by: test-run",
        "- created_path: .github/agents/tmp-process-evidence.agent.md",
        "- basis: tmp-brief.txt"
      ].join("\n")
    );

    const nonCanonicalRuntimeArtifact = [
      "## 0 IDENTITY",
      "Name: tmp-process-evidence-agent",
      "",
      "## 1 PURPOSE",
      "Temporary purpose.",
      "",
      "## 2 SCOPE",
      "Temporary scope.",
      "",
      "## 3 INTENDED AUDIENCE",
      "Temporary audience.",
      "",
      "## 4 CAPABILITIES",
      "Temporary capabilities.",
      "",
      "## 5 INVOCATION",
      "Temporary invocation.",
      "",
      "## 6 CONSTRAINTS",
      "Temporary constraints.",
      "",
      "## 7 FAILURE MODES",
      "Temporary failure modes.",
      "",
      "## 8 SECURITY",
      "Temporary security.",
      "",
      "## 9 LIFECYCLE",
      "Temporary lifecycle.",
      "",
      "## 10 DESIGN NOTES",
      "Temporary design notes.",
      "",
      "## 11 MAINTENANCE RULES",
      "Temporary maintenance.",
      "",
      "## 12 USAGE EXAMPLE",
      "Temporary usage example.",
      ""
    ].join("\n");

    const createPassArtifactPath = path.join(tempAgentsDir, "tmp-create-pass.agent.md");
    await fs.writeFile(createPassArtifactPath, canonicalRuntimeArtifact, "utf8");

    const passEvidencePath = path.join(rootDir, "agent-architect-pass.evidence.json");
    await fs.writeFile(passEvidencePath, JSON.stringify({
      target_name: "agent-architect",
      stage_sequence: [
        "target_resolution",
        "scope_resolution",
        "lifecycle_classification",
        "mutation",
        "read_after_write",
        "companion_decision",
        "structure_validation",
        "behavioral_assessment",
        "release_mapping"
      ],
      provenance: {
        exercised_entrypoint: "tests/test.mjs#runAgentArchitectProcessEvidenceChecks",
        resolved_target: ".github/agents/agent-architect.agent.md",
        verification_artifacts: [
          "/tmp/agent-architect-read-after-write.md",
          "/tmp/agent-architect-structure.md"
        ]
      },
      lifecycle: {
        target_resolution: { status: "PASS", artifact: "/tmp/target-resolution.md" },
        scope_resolution: { status: "PASS", artifact: "/tmp/scope-resolution.md" },
        classification: { status: "PASS", value: "PATCH", artifact: "/tmp/classification.md" }
      },
      mutation: {
        claimed: true,
        changed_files: [".github/agents/agent-architect.agent.md"],
        read_after_write: { status: "PASS", artifact: "/tmp/read-after-write.md" }
      },
      companion_decision_record: {
        companion_decision: "parent-proof-sufficient",
        decided_after_runtime_exists: true
      },
      structure_validation: { status: "PASS", artifact: "/tmp/structure-validation.md" },
      behavioral_assessment: {
        status: "PASS",
        artifact: "/tmp/behavioral-assessment.md",
        claims_readiness: true
      },
      release_mapping: {
        requested: true,
        artifact: "/tmp/release-gate.md",
        release_state: "READY",
        reason: "All hard validators and repeated-run evidence passed."
      },
      regression: {
        expectations_defined: true,
        runs: [
          { run_id: "positive-a", variant: "positive phrasing a", artifact: "/tmp/run-a.md" },
          { run_id: "positive-b", variant: "positive phrasing b", artifact: "/tmp/run-b.md" }
        ]
      }
    }, null, 2), "utf8");

    const passResult = await validateAgentArchitectProcessEvidenceFile(passEvidencePath);
    assert(passResult.process_verdict === "PASS", "Agent Architect process-evidence harness test did not PASS for a complete evidence package.");
    assert(passResult.provenance.evidence_package_path === passEvidencePath, "Agent Architect process-evidence harness test did not preserve the evidence package path in provenance.");
    assert(passResult.satisfied_gates.includes("companion_decision_fields"), "Agent Architect process-evidence harness test did not treat the companion decision as satisfied for parent-proof-sufficient evidence.");
    assert(passResult.satisfied_gates.includes("behavioral_assessment_for_release_mapping"), "Agent Architect process-evidence harness test did not require preserved behavioral assessment before release mapping.");
    assert(passResult.satisfied_gates.includes("release_mapping_result"), "Agent Architect process-evidence harness test did not require an explicit release-gate mapping result for release mapping evidence.");
    assert(passResult.satisfied_gates.includes("repeated_validation"), "Agent Architect process-evidence harness test did not recognize varied repeated-run evidence for a readiness claim.");

    const missingReleaseMappingResultPath = path.join(rootDir, "agent-architect-missing-release-mapping-result.evidence.json");
    await fs.writeFile(missingReleaseMappingResultPath, JSON.stringify({
      target_name: "agent-architect",
      stage_sequence: [
        "target_resolution",
        "scope_resolution",
        "lifecycle_classification",
        "mutation",
        "read_after_write",
        "companion_decision",
        "structure_validation",
        "behavioral_assessment",
        "release_mapping"
      ],
      provenance: {
        exercised_entrypoint: "tests/test.mjs#runAgentArchitectProcessEvidenceChecks",
        resolved_target: ".github/agents/agent-architect.agent.md",
        verification_artifacts: [
          "/tmp/agent-architect-read-after-write.md",
          "/tmp/agent-architect-structure.md"
        ]
      },
      lifecycle: {
        target_resolution: { status: "PASS", artifact: "/tmp/target-resolution.md" },
        scope_resolution: { status: "PASS", artifact: "/tmp/scope-resolution.md" },
        classification: { status: "PASS", value: "PATCH", artifact: "/tmp/classification.md" }
      },
      mutation: {
        claimed: true,
        changed_files: [".github/agents/agent-architect.agent.md"],
        read_after_write: { status: "PASS", artifact: "/tmp/read-after-write.md" }
      },
      companion_decision_record: {
        companion_decision: "parent-proof-sufficient",
        decided_after_runtime_exists: true
      },
      structure_validation: { status: "PASS", artifact: "/tmp/structure-validation.md" },
      behavioral_assessment: {
        status: "PASS",
        artifact: "/tmp/behavioral-assessment.md",
        claims_readiness: false
      },
      release_mapping: {
        requested: true,
        artifact: "/tmp/release-gate.md"
      }
    }, null, 2), "utf8");

    const missingReleaseMappingResult = await validateAgentArchitectProcessEvidenceFile(missingReleaseMappingResultPath);
    assert(missingReleaseMappingResult.process_verdict === "FAIL", "Agent Architect process-evidence harness test did not FAIL when release mapping omitted the explicit mapped release state.");
    assert(missingReleaseMappingResult.missing_or_failed_gates.includes("release_mapping_result"), "Agent Architect process-evidence harness test did not report the missing explicit release mapping result gate.");

    const degradedReleaseEvidencePath = path.join(rootDir, "agent-architect-degraded-release.evidence.json");
    await fs.writeFile(degradedReleaseEvidencePath, JSON.stringify({
      target_name: "agent-architect",
      stage_sequence: [
        "target_resolution",
        "scope_resolution",
        "lifecycle_classification",
        "mutation",
        "read_after_write",
        "companion_decision",
        "structure_validation",
        "behavioral_assessment",
        "release_mapping"
      ],
      provenance: {
        exercised_entrypoint: "tests/test.mjs#runAgentArchitectProcessEvidenceChecks",
        resolved_target: ".github/agents/agent-architect.agent.md",
        verification_artifacts: [
          "/tmp/agent-architect-read-after-write.md",
          "/tmp/agent-architect-structure.md"
        ]
      },
      lifecycle: {
        target_resolution: { status: "PASS", artifact: "/tmp/target-resolution.md" },
        scope_resolution: { status: "PASS", artifact: "/tmp/scope-resolution.md" },
        classification: { status: "PASS", value: "PATCH", artifact: "/tmp/classification.md" }
      },
      mutation: {
        claimed: true,
        changed_files: [".github/agents/agent-architect.agent.md"],
        read_after_write: { status: "PASS", artifact: "/tmp/read-after-write.md" }
      },
      companion_decision_record: {
        companion_decision: "parent-proof-sufficient",
        decided_after_runtime_exists: true
      },
      structure_validation: { status: "PASS", artifact: "/tmp/structure-validation.md" },
      behavioral_assessment: {
        status: "INCONCLUSIVE",
        artifact: "/tmp/behavioral-assessment.md",
        claims_readiness: false
      },
      release_mapping: {
        requested: true,
        artifact: "/tmp/release-gate.md",
        release_state: "DEGRADED",
        reason: "Behavioral evidence remains inconclusive on the exercised surface."
      }
    }, null, 2), "utf8");

    const degradedReleaseResult = await validateAgentArchitectProcessEvidenceFile(degradedReleaseEvidencePath);
    assert(degradedReleaseResult.process_verdict === "PASS", "Agent Architect process-evidence harness test did not PASS when a preserved DEGRADED release mapping omitted repeated-run evidence that was not required for readiness.");
    assert(!degradedReleaseResult.missing_or_failed_gates.includes("repeated_validation"), "Agent Architect process-evidence harness test incorrectly required repeated-run evidence for a preserved DEGRADED release mapping that did not claim readiness.");

    const createPassEvidencePath = path.join(rootDir, "agent-architect-create-pass.evidence.json");
    await fs.writeFile(createPassEvidencePath, JSON.stringify({
      target_name: "tmp-create-pass",
      stage_sequence: [
        "target_resolution",
        "scope_resolution",
        "lifecycle_classification",
        "mutation",
        "read_after_write",
        "structure_validation"
      ],
      provenance: {
        exercised_entrypoint: "tests/test.mjs#runAgentArchitectProcessEvidenceChecks",
        resolved_target: createPassArtifactPath,
        verification_artifacts: [
          "/tmp/read-after-write.md",
          "/tmp/structure-validation.md"
        ]
      },
      lifecycle: {
        target_resolution: { status: "PASS", artifact: "/tmp/target-resolution.md" },
        scope_resolution: { status: "PASS", artifact: "/tmp/scope-resolution.md" },
        classification: { status: "PASS", value: "CREATE", artifact: "/tmp/classification.md" }
      },
      mutation: {
        claimed: true,
        changed_files: [createPassArtifactPath],
        read_after_write: { status: "PASS", artifact: "/tmp/read-after-write.md" }
      },
      structure_validation: { status: "PASS", artifact: "/tmp/structure-validation.md" }
    }, null, 2), "utf8");

    const createPassResult = await validateAgentArchitectProcessEvidenceFile(createPassEvidencePath);
    assert(createPassResult.process_verdict === "PASS", "Agent Architect process-evidence harness test did not PASS for a valid CREATE evidence package with a canonical runtime artifact.");
    assert(createPassResult.satisfied_gates.includes("create_structure_validation"), "Agent Architect process-evidence harness test did not require CREATE structure validation for a valid CREATE evidence package.");
    assert(createPassResult.satisfied_gates.includes("runtime_artifact_contract"), "Agent Architect process-evidence harness test did not confirm the created runtime artifact contract for a valid CREATE evidence package.");
    assert(createPassResult.satisfied_gates.includes("runtime_support_boundary"), "Agent Architect process-evidence harness test did not confirm that runtime support evidence stayed out of the runtime artifact body for a valid CREATE evidence package.");

    const missingReadAfterWritePath = path.join(rootDir, "agent-architect-missing-read-after-write.evidence.json");
    await fs.writeFile(missingReadAfterWritePath, JSON.stringify({
      target_name: "agent-architect",
      stage_sequence: [
        "target_resolution",
        "scope_resolution",
        "lifecycle_classification",
        "mutation",
        "structure_validation",
        "behavioral_assessment"
      ],
      provenance: {
        exercised_entrypoint: "tests/test.mjs#runAgentArchitectProcessEvidenceChecks",
        resolved_target: ".github/agents/agent-architect.agent.md",
        verification_artifacts: ["/tmp/behavioral-assessment.md"]
      },
      lifecycle: {
        target_resolution: { status: "PASS", artifact: "/tmp/target-resolution.md" },
        scope_resolution: { status: "PASS", artifact: "/tmp/scope-resolution.md" },
        classification: { status: "PASS", value: "PATCH", artifact: "/tmp/classification.md" }
      },
      mutation: {
        claimed: true
      },
      structure_validation: { status: "PASS", artifact: "/tmp/structure-validation.md" },
      behavioral_assessment: {
        status: "INCONCLUSIVE",
        artifact: "/tmp/behavioral-assessment.md",
        claims_readiness: false
      }
    }, null, 2), "utf8");

    const missingReadAfterWriteResult = await validateAgentArchitectProcessEvidenceFile(missingReadAfterWritePath);
    assert(missingReadAfterWriteResult.process_verdict === "FAIL", "Agent Architect process-evidence harness test did not FAIL when read-after-write evidence was missing after a claimed mutation.");
    assert(missingReadAfterWriteResult.missing_or_failed_gates.includes("read_after_write"), "Agent Architect process-evidence harness test did not report the missing read-after-write gate.");

    const companionExceptionGapPath = path.join(rootDir, "agent-architect-companion-exception-gap.evidence.json");
    await fs.writeFile(companionExceptionGapPath, JSON.stringify({
      target_name: "agent-architect",
      stage_sequence: [
        "target_resolution",
        "scope_resolution",
        "lifecycle_classification",
        "mutation",
        "read_after_write",
        "companion_decision",
        "structure_validation"
      ],
      provenance: {
        exercised_entrypoint: "tests/test.mjs#runAgentArchitectProcessEvidenceChecks",
        resolved_target: ".github/agents/agent-architect.agent.md",
        verification_artifacts: ["/tmp/read-after-write.md", "/tmp/structure-validation.md"]
      },
      lifecycle: {
        target_resolution: { status: "PASS", artifact: "/tmp/target-resolution.md" },
        scope_resolution: { status: "PASS", artifact: "/tmp/scope-resolution.md" },
        classification: { status: "PASS", value: "PATCH", artifact: "/tmp/classification.md" }
      },
      mutation: {
        claimed: true,
        read_after_write: { status: "PASS", artifact: "/tmp/read-after-write.md" }
      },
      companion_decision_record: {
        companion_decision: "exception-approved",
        companion_target_role: "session-artifact.tail-reader",
        decided_after_runtime_exists: true
      },
      structure_validation: { status: "PASS", artifact: "/tmp/structure-validation.md" }
    }, null, 2), "utf8");

    const companionExceptionGapResult = await validateAgentArchitectProcessEvidenceFile(companionExceptionGapPath);
    assert(companionExceptionGapResult.process_verdict === "FAIL", "Agent Architect process-evidence harness test did not FAIL when companion exception evidence omitted the named gap and reason.");
    assert(companionExceptionGapResult.missing_or_failed_gates.includes("companion_decision_fields"), "Agent Architect process-evidence harness test did not report missing companion-decision fields for an exception-approved decision.");

    const contaminatedArtifactPath = path.join(tempAgentsDir, "tmp-contaminated-create.agent.md");
    await fs.writeFile(contaminatedArtifactPath, contaminatedRuntimeArtifact, "utf8");
    const contaminatedEvidencePath = path.join(rootDir, "agent-architect-contaminated-runtime.evidence.json");
    await fs.writeFile(contaminatedEvidencePath, JSON.stringify({
      target_name: "tmp-contaminated-create",
      stage_sequence: [
        "target_resolution",
        "scope_resolution",
        "lifecycle_classification",
        "mutation",
        "read_after_write",
        "structure_validation"
      ],
      provenance: {
        exercised_entrypoint: "tests/test.mjs#runAgentArchitectProcessEvidenceChecks",
        resolved_target: contaminatedArtifactPath,
        verification_artifacts: ["/tmp/read-after-write.md", "/tmp/structure-validation.md"]
      },
      lifecycle: {
        target_resolution: { status: "PASS", artifact: "/tmp/target-resolution.md" },
        scope_resolution: { status: "PASS", artifact: "/tmp/scope-resolution.md" },
        classification: { status: "PASS", value: "CREATE", artifact: "/tmp/classification.md" }
      },
      mutation: {
        claimed: true,
        changed_files: [contaminatedArtifactPath],
        read_after_write: { status: "PASS", artifact: "/tmp/read-after-write.md" }
      },
      structure_validation: { status: "PASS", artifact: "/tmp/structure-validation.md" }
    }, null, 2), "utf8");

    const contaminatedResult = await validateAgentArchitectProcessEvidenceFile(contaminatedEvidencePath);
    assert(contaminatedResult.process_verdict === "FAIL", "Agent Architect process-evidence harness test did not FAIL when runtime support evidence was embedded in the created runtime artifact.");
    assert(contaminatedResult.missing_or_failed_gates.includes("runtime_support_boundary"), "Agent Architect process-evidence harness test did not report embedded runtime support evidence as a failed gate.");

    const invalidCompanionEvidencePath = path.join(rootDir, "agent-architect-invalid-companion-shape.evidence.json");
    const invalidCompanionPath = path.join(tempCompanionsDir, "tmp-create.validation.md");
    await fs.writeFile(invalidCompanionPath, "temporary validation companion", "utf8");
    await fs.writeFile(invalidCompanionEvidencePath, JSON.stringify({
      target_name: "tmp-invalid-companion",
      stage_sequence: [
        "target_resolution",
        "scope_resolution",
        "lifecycle_classification",
        "mutation",
        "read_after_write",
        "structure_validation"
      ],
      provenance: {
        exercised_entrypoint: "tests/test.mjs#runAgentArchitectProcessEvidenceChecks",
        resolved_target: createPassArtifactPath,
        verification_artifacts: ["/tmp/read-after-write.md", "/tmp/structure-validation.md"]
      },
      lifecycle: {
        target_resolution: { status: "PASS", artifact: "/tmp/target-resolution.md" },
        scope_resolution: { status: "PASS", artifact: "/tmp/scope-resolution.md" },
        classification: { status: "PASS", value: "CREATE", artifact: "/tmp/classification.md" }
      },
      mutation: {
        claimed: true,
        changed_files: [createPassArtifactPath, invalidCompanionPath],
        read_after_write: { status: "PASS", artifact: "/tmp/read-after-write.md" }
      },
      structure_validation: { status: "PASS", artifact: "/tmp/structure-validation.md" }
    }, null, 2), "utf8");

    const invalidCompanionResult = await validateAgentArchitectProcessEvidenceFile(invalidCompanionEvidencePath);
    assert(invalidCompanionResult.process_verdict === "FAIL", "Agent Architect process-evidence harness test did not FAIL when CREATE evidence created an unsupported companion artifact shape.");
    assert(invalidCompanionResult.missing_or_failed_gates.includes("companion_artifact_shape"), "Agent Architect process-evidence harness test did not report the unsupported companion artifact shape gate.");
    assert(invalidCompanionResult.missing_or_failed_gates.includes("companion_decision_record_present"), "Agent Architect process-evidence harness test did not require explicit companion-decision evidence when companion artifacts were created.");

    const nonCanonicalArtifactPath = path.join(tempAgentsDir, "tmp-noncanonical-create.agent.md");
    await fs.writeFile(nonCanonicalArtifactPath, nonCanonicalRuntimeArtifact, "utf8");
    const nonCanonicalEvidencePath = path.join(rootDir, "agent-architect-noncanonical-runtime.evidence.json");
    await fs.writeFile(nonCanonicalEvidencePath, JSON.stringify({
      target_name: "tmp-noncanonical-create",
      stage_sequence: [
        "target_resolution",
        "scope_resolution",
        "lifecycle_classification",
        "mutation",
        "read_after_write",
        "structure_validation"
      ],
      provenance: {
        exercised_entrypoint: "tests/test.mjs#runAgentArchitectProcessEvidenceChecks",
        resolved_target: nonCanonicalArtifactPath,
        verification_artifacts: ["/tmp/read-after-write.md", "/tmp/structure-validation.md"]
      },
      lifecycle: {
        target_resolution: { status: "PASS", artifact: "/tmp/target-resolution.md" },
        scope_resolution: { status: "PASS", artifact: "/tmp/scope-resolution.md" },
        classification: { status: "PASS", value: "CREATE", artifact: "/tmp/classification.md" }
      },
      mutation: {
        claimed: true,
        changed_files: [nonCanonicalArtifactPath],
        read_after_write: { status: "PASS", artifact: "/tmp/read-after-write.md" }
      },
      structure_validation: { status: "PASS", artifact: "/tmp/structure-validation.md" }
    }, null, 2), "utf8");

    const nonCanonicalResult = await validateAgentArchitectProcessEvidenceFile(nonCanonicalEvidencePath);
    assert(nonCanonicalResult.process_verdict === "FAIL", "Agent Architect process-evidence harness test did not FAIL when a noncanonical CREATE artifact was self-certified by a weak local structure check.");
    assert(nonCanonicalResult.missing_or_failed_gates.includes("runtime_artifact_contract"), "Agent Architect process-evidence harness test did not report the invalid runtime artifact contract gate for a noncanonical CREATE artifact.");
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}

async function runManifestChecks() {
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
  const languageModelToolsModule = await import(pathToFileURL(distLanguageModelTools).href);
  const activationEvents = packageJson.activationEvents;
  const languageModelTools = packageJson.contributes?.languageModelTools;
  const extensionCommands = packageJson.contributes?.commands;
  const panelViews = packageJson.contributes?.views?.tiinexAiVscodeToolsTraceablePanel ?? [];
  const panelContainers = packageJson.contributes?.viewsContainers?.panel ?? [];
  const viewTitleMenu = packageJson.contributes?.menus?.["view/title"] ?? [];
  const viewItemContextMenu = packageJson.contributes?.menus?.["view/item/context"] ?? [];
  const commandPaletteMenu = packageJson.contributes?.menus?.["commandPalette"] ?? [];
  const sourceToolContributions = Array.isArray(languageModelToolsModule.EXTENSION_TOOL_CONTRIBUTIONS)
    ? languageModelToolsModule.EXTENSION_TOOL_CONTRIBUTIONS
    : [];

  assert(Array.isArray(activationEvents), "package.json activationEvents must be an array.");
  assert(Array.isArray(languageModelTools), "package.json contributes.languageModelTools must be an array.");
  assert(Array.isArray(extensionCommands), "package.json contributes.commands must be an array.");
  assert(Array.isArray(panelViews), "package.json contributes.views.tiinexAiVscodeToolsTraceablePanel must be an array.");
  assert(Array.isArray(panelContainers), "package.json contributes.viewsContainers.panel must be an array.");

  for (const toolName of expectedLanguageModelToolNames) {
    assert(
      activationEvents.includes(`onLanguageModelTool:${toolName}`),
      `package.json is missing the activation event for language model tool ${toolName}.`
    );
  }

  const contributedToolNames = languageModelTools.map((tool) => tool.name);
  for (const toolName of expectedLanguageModelToolNames) {
    assert(
      contributedToolNames.includes(toolName),
      `package.json is missing the language model tool contribution ${toolName}.`
    );
  }

  for (const toolName of liveToolManifestParityNames) {
    assert(
      sourceToolContributions.some((tool) => tool.name === toolName),
      `src/languageModelTools.ts is missing the source-defined live language model tool contribution ${toolName}.`
    );
  }

  for (const sourceTool of sourceToolContributions.filter((tool) => liveToolManifestParityNames.has(tool.name))) {
    const manifestTool = languageModelTools.find((tool) => tool.name === sourceTool.name);

    assert(manifestTool, `package.json is missing the source-defined language model tool contribution ${sourceTool.name}.`);
    assert(manifestTool.canBeReferencedInPrompt === true, `package.json tool ${sourceTool.name} must remain referenceable in prompt.`);

    const manifestShape = JSON.stringify({
      name: manifestTool.name,
      displayName: manifestTool.displayName,
      userDescription: manifestTool.userDescription,
      modelDescription: manifestTool.modelDescription,
      toolReferenceName: manifestTool.toolReferenceName,
      inputSchema: manifestTool.inputSchema
    });
    const sourceShape = JSON.stringify({
      name: sourceTool.name,
      displayName: sourceTool.displayName,
      userDescription: sourceTool.userDescription,
      modelDescription: sourceTool.modelDescription,
      toolReferenceName: sourceTool.toolReferenceName,
      inputSchema: sourceTool.inputSchema
    });

    assert(
      manifestShape === sourceShape,
      `package.json language model tool ${sourceTool.name} drifted from src/languageModelTools.ts.`
    );
  }

  const contributedCommandNames = extensionCommands.map((command) => command.command);
  for (const commandName of expectedExtensionCommandNames) {
    assert(
      contributedCommandNames.includes(commandName),
      `package.json is missing the command contribution ${commandName}.`
    );
  }

  const windowTool = languageModelTools.find((tool) => tool.name === "get_agent_session_window");
  const traceablePanelView = panelViews.find((view) => view.id === "tiinex.aiVscodeTools.traceableStatus");
  const traceablePanelContainer = panelContainers.find((container) => container.id === "tiinexAiVscodeToolsTraceablePanel");
  const transcriptTool = languageModelTools.find((tool) => tool.name === "export_agent_evidence_transcript");
  const estimateTool = languageModelTools.find((tool) => tool.name === "estimate_agent_context_breakdown");
  const deleteTool = languageModelTools.find((tool) => tool.name === "delete_live_agent_chat_artifacts");
  const rawSessionCommand = extensionCommands.find((command) => command.command === "tiinex.aiVscodeTools.openSessionFile");
  const rawSessionMenuEntry = viewItemContextMenu.find((item) => item.command === "tiinex.aiVscodeTools.openSessionFile");

  assert(windowTool?.inputSchema?.properties?.afterLatestCompact, "package.json window tool schema must expose afterLatestCompact.");
  assert(traceablePanelView?.type === "webview", "package.json traceable panel view must remain a webview contribution.");
  assert(traceablePanelView?.visibility === "hidden", "package.json traceable panel view must stay hidden until explicitly revealed from the status surface.");
  assert(traceablePanelView?.when === "tiinex.aiVscodeTools.traceablePanelVisible", "package.json traceable panel view must stay gated behind the explicit traceable panel visibility context.");
  assert(traceablePanelContainer?.title === "Traceable", "package.json traceable panel container must contribute the Traceable panel title.");
  assert(windowTool?.inputSchema?.properties?.anchorOccurrence, "package.json window tool schema must expose anchorOccurrence.");
  assert(!windowTool?.inputSchema?.required, "package.json window tool schema must not require anchorText when compaction-only windows are allowed.");
  assert(transcriptTool?.inputSchema?.properties?.maxBlocks, "package.json transcript tool schema must expose maxBlocks.");
  assert(transcriptTool?.inputSchema?.properties?.afterLatestCompact, "package.json transcript tool schema must expose afterLatestCompact.");
  assert(estimateTool?.inputSchema?.properties?.latestRequestFamilies, "package.json context estimate tool schema must expose latestRequestFamilies.");
  assert(deleteTool?.inputSchema?.properties?.dryRun, "package.json delete live chat tool schema must expose dryRun.");
  assert(deleteTool?.inputSchema?.properties?.scheduleExactSelfDelete, "package.json delete live chat tool schema must expose scheduleExactSelfDelete.");
  const traceableAutoRevealSetting = packageJson.contributes?.configuration?.properties?.["tiinex.aiVscodeTools.traceableAutoReveal"];
  const traceableAutoHideSetting = packageJson.contributes?.configuration?.properties?.["tiinex.aiVscodeTools.traceableAutoHide"];
  const traceablePreferredModelsSetting = packageJson.contributes?.configuration?.properties?.["tiinex.aiVscodeTools.traceablePreferredModels"];
  const traceableBlockedModelsSetting = packageJson.contributes?.configuration?.properties?.["tiinex.aiVscodeTools.traceableBlockedModels"];
  assert(traceableAutoRevealSetting?.default === "yes", "package.json TRACEABLE auto-reveal setting must default to yes.");
  assert(Array.isArray(traceableAutoRevealSetting?.enum) && traceableAutoRevealSetting.enum.join(",") === "yes,no,always", "package.json TRACEABLE auto-reveal setting must expose yes/no/always enum values.");
  assert(traceableAutoHideSetting?.default === "yes", "package.json TRACEABLE auto-hide setting must default to yes.");
  assert(Array.isArray(traceableAutoHideSetting?.enum) && traceableAutoHideSetting.enum.join(",") === "yes,no", "package.json TRACEABLE auto-hide setting must expose yes/no enum values.");
  assert(traceablePreferredModelsSetting?.type === "array" && Array.isArray(traceablePreferredModelsSetting?.default) && traceablePreferredModelsSetting.default.length === 0, "package.json TRACEABLE preferred-models setting must expose an empty array default.");
  assert(traceablePreferredModelsSetting?.items?.type === "string", "package.json TRACEABLE preferred-models setting must store human-readable string declarations.");
  assert(traceableBlockedModelsSetting?.type === "array" && Array.isArray(traceableBlockedModelsSetting?.default) && traceableBlockedModelsSetting.default.length === 0, "package.json TRACEABLE blocked-models setting must expose an empty array default.");
  assert(traceableBlockedModelsSetting?.items?.type === "string", "package.json TRACEABLE blocked-models setting must store human-readable string declarations.");
  assert(rawSessionCommand?.title === "Tiinex: Open Raw Session File (Last Resort)", "package.json raw session command must remain explicitly marked as last resort.");
  assert(rawSessionMenuEntry?.group === "z_lastResort", "package.json session context menu must keep raw session file access in the last-resort group.");

  const viewTitleCommands = viewTitleMenu.map((item) => item.command);
  const viewItemCommands = viewItemContextMenu.map((item) => item.command);
  const hiddenCommandPaletteCommands = new Map(commandPaletteMenu.map((item) => [item.command, item.when]));
  assert(!viewTitleCommands.includes("tiinex.aiVscodeTools.createDisposableLocalDeleteProbe"), "package.json view/title menu must not expose Create Disposable Local Delete Probe.");
  assert(viewTitleCommands.includes("tiinex.aiVscodeTools.createLiveChat"), "package.json view/title menu must expose Create Local Chat.");
  assert(viewTitleCommands.includes("tiinex.aiVscodeTools.listLiveChats"), "package.json view/title menu must expose List Local Chats.");
  assert(viewItemCommands.includes("tiinex.aiVscodeTools.revealLiveChat"), "package.json session context menu must expose Reveal Local Chat.");
  assert(viewItemCommands.includes("tiinex.aiVscodeTools.closeVisibleLiveChatTabs"), "package.json session context menu must expose Close Visible Local Chat Tabs.");
  assert(viewItemCommands.includes("tiinex.aiVscodeTools.deleteLiveChatArtifacts"), "package.json session context menu must expose Delete Local Chat Artifacts.");
  assert(viewItemCommands.includes("tiinex.aiVscodeTools.sendMessageToLiveChat"), "package.json session context menu must expose Send Message To Local Chat.");
  for (const commandName of [
    "tiinex.aiVscodeTools.listLiveChats",
    "tiinex.aiVscodeTools.revealLiveChat",
    "tiinex.aiVscodeTools.closeVisibleLiveChatTabs",
    "tiinex.aiVscodeTools.deleteLiveChatArtifacts",
    "tiinex.aiVscodeTools.createLiveChat",
    "tiinex.aiVscodeTools.sendMessageToLiveChat"
  ]) {
    assert(
      hiddenCommandPaletteCommands.get(commandName) === "false",
      `package.json command palette must hide the mirrored live-chat command ${commandName}.`
    );
  }
}

async function runRoutingGuardChecks() {
  const firstSliceModule = await import(pathToFileURL(distFirstSlice).href);
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
  const readme = await fs.readFile(readmePath, "utf-8");
  const extensionSource = await fs.readFile(extensionSourcePath, "utf-8");
  const sessionSendWorkflowSource = await fs.readFile(path.join(packageRoot, "src", "chatInterop", "sessionSendWorkflow.ts"), "utf-8");
  const toolingValidationInstructions = await fs.readFile(toolingValidationInstructionPath, "utf-8");
  const localChatCreateSendSkill = await fs.readFile(localChatCreateSendSkillPath, "utf-8");
  const languageModelToolsSource = await fs.readFile(languageModelToolsSourcePath, "utf-8");

  assert(
    firstSliceModule.isFirstSliceSessionCommand("tiinex.aiVscodeTools.openSessionFile") === false,
    "Routing guard must keep raw session file access out of the default first-slice session commands."
  );
  assert(
    firstSliceModule.isEnabledSessionCommand("tiinex.aiVscodeTools.openSessionFile") === true,
    "Routing guard must keep raw session file access available as an explicit non-default escape hatch."
  );
  assert(
    firstSliceModule.isFirstSliceSessionCommand("tiinex.aiVscodeTools.openSnapshot") === true,
    "Routing guard must keep bounded snapshot inspection in the default first-slice session commands."
  );
  assert(
    readme.includes("Open Raw Session File (Last Resort)"),
    "README routing guard must keep raw session file access marked as last resort."
  );
  assert(
    readme.includes("Bounded inspection surfaces should be preferred over opening raw session JSONL directly."),
    "README routing guard must keep bounded inspection surfaces preferred over raw session JSONL."
  );
  assert(
    readme.includes("run_traceable_subagent"),
    "README must document the experimental traceable subagent LM tool."
  );
  assert(
    readme.includes("prefer non-leading parent input"),
    "README must keep the non-leading input guidance for run_traceable_subagent."
  );
  assert(
    readme.includes("do not let raw user wording outweigh the child lane's bounded investigative contract"),
    "README must keep the userInput versus parentTask weighting guidance for run_traceable_subagent."
  );
  assert(
    readme.includes("The canonical public live-chat workflow surface is the language-model tool family"),
    "README routing guard must keep the live-chat LM tool family marked as the canonical public workflow surface."
  );
  assert(
    readme.includes("commands are kept as Tiinex Sessions view UI affordances"),
    "README routing guard must keep mirrored live-chat commands downgraded to sessions-view UI affordances rather than peer workflows."
  );
  assert(
    extensionSource.includes('postCreateTimeoutMs", 900000'),
    "Extension wiring must keep the intended 15-minute default timeout for live chat interop waits."
  );
  assert(
    packageJson?.contributes?.configuration?.properties?.["tiinex.aiVscodeTools.postCreateTimeoutMs"]?.default === 900000,
    "Extension manifest settings must keep the intended 15-minute default timeout for live chat interop waits."
  );
  assert(
    !languageModelToolsSource.includes("create_disposable_local_delete_probe"),
    "Language-model tooling must not keep the removed disposable delete probe surface."
  );
  assert(
    languageModelToolsSource.includes("Prefer snapshot, index, window, profile, transcript, or export surfaces over opening raw session files"),
    "Language-model routing note must keep bounded inspection surfaces preferred over raw session files."
  );
  await assertMissing(
    disposableProbeFallbackScriptPath,
    "Disposable local delete probe PowerShell fallback must stay removed after the public probe tooling was removed."
  );
  assert(
    !toolingValidationInstructions.includes("create-disposable-local-chat-probe.ps1"),
    "Maintained validation instructions must not point back to the removed disposable probe PowerShell fallback."
  );
  assert(
    toolingValidationInstructions.includes("explicit targeted tool lookup"),
    "Maintained validation instructions must require an explicit targeted tool lookup before treating a canonical Local-chat tool as unavailable in a long conversation or after reload."
  );
  assert(
    localChatCreateSendSkill.includes("explicit targeted tool lookup"),
    "Local-chat create/send skill must require an explicit targeted tool lookup before concluding that a canonical Local-chat tool is unavailable."
  );

  for (const toolName of [
    "list_live_agent_chats",
    "create_live_agent_chat",
    "close_visible_live_chat_tabs",
    "delete_live_agent_chat_artifacts",
    "send_message_to_live_agent_chat",
    "reveal_live_agent_chat"
  ]) {
    assert(
      countRegisterToolOccurrences(languageModelToolsSource, toolName) === 1,
      `Language-model tool source must register ${toolName} exactly once to avoid legacy/runtime duplication.`
    );
  }

  assert(
    !languageModelToolsSource.includes('name: "send_message_to_focused_live_chat"'),
    "Focused-send fallback must not remain exposed as a competing language-model tool surface."
  );
  assert(
    !extensionSource.includes('registerCommand("tiinex.aiVscodeTools.sendMessageToFocusedLiveChat"'),
    "Focused-send fallback command surface must not survive as a separate extension command."
  );
  assert(
    sessionSendWorkflowSource.includes("focusLikelyEditorChat(chatInterop"),
    "Canonical session send must keep the editor-hosted focused fallback available behind the canonical path when direct exact send is unavailable."
  );
}

async function runTraceableSubagentChecks() {
  const vscodeModule = await import(pathToFileURL(vscodeStubModulePath).href);
  const vscode = vscodeModule.default ?? vscodeModule;
  vscode.workspace = vscode.workspace || {};
  vscode.lm = vscode.lm || { tools: [] };
  vscode.LanguageModelChatToolMode = vscode.LanguageModelChatToolMode || { Auto: "auto" };
  vscode.LanguageModelTextPart = vscode.LanguageModelTextPart || class LanguageModelTextPart {
    constructor(value) {
      this.value = value;
    }
  };
  vscode.LanguageModelToolResult = vscode.LanguageModelToolResult || class LanguageModelToolResult {
    constructor(content) {
      this.content = content;
    }
  };
  vscode.LanguageModelToolCallPart = vscode.LanguageModelToolCallPart || class LanguageModelToolCallPart {
    constructor(callId, name, input) {
      this.callId = callId;
      this.name = name;
      this.input = input;
    }
  };
  vscode.LanguageModelToolResultPart = vscode.LanguageModelToolResultPart || class LanguageModelToolResultPart {
    constructor(callId, content) {
      this.callId = callId;
      this.content = content;
    }
  };
  vscode.LanguageModelDataPart = vscode.LanguageModelDataPart || class LanguageModelDataPart {};
  vscode.LanguageModelChatMessage = vscode.LanguageModelChatMessage || {
    User(content) {
      return { role: "user", content };
    },
    Assistant(content) {
      return { role: "assistant", content };
    },
    Tool(content) {
      return { role: "tool", content };
    }
  };
  const originalCreateStatusBarItem = vscode.window?.createStatusBarItem;
  const originalOpenTextDocument = vscode.workspace?.openTextDocument;
  const originalExecuteCommand = vscode.commands?.executeCommand;
  const originalShowTextDocument = vscode.window?.showTextDocument;
  const originalStatusBarAlignment = vscode.StatusBarAlignment;
  const fakeStatusBarItems = [];
  const executedCommands = [];
  const openedDocuments = [];
  const shownDocuments = [];
  vscode.window = vscode.window || {};
  vscode.workspace = vscode.workspace || {};
  vscode.commands = vscode.commands || {};
  vscode.StatusBarAlignment = vscode.StatusBarAlignment || { Left: 1 };
  vscode.Uri = vscode.Uri || {
    from(value) {
      const scheme = value?.scheme || "file";
      const pathValue = value?.path || "";
      return {
        scheme,
        path: pathValue,
        toString() {
          return `${scheme}:${pathValue}`;
        }
      };
    },
    file(filePath) {
      return {
        fsPath: filePath,
        toString() {
          const normalizedPath = String(filePath).replace(/\\/g, "/");
          return `file://${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`;
        }
      };
    }
  };
  vscode.EventEmitter = vscode.EventEmitter || class EventEmitter {
    constructor() {
      this.listeners = [];
      this.event = (listener) => {
        this.listeners.push(listener);
        return { dispose() {} };
      };
    }
    fire(value) {
      for (const listener of this.listeners) {
        listener(value);
      }
    }
    dispose() {
      this.listeners = [];
    }
  };
  vscode.window.createStatusBarItem = (_alignment, priority) => {
    const item = {
      text: "",
      name: "",
      tooltip: "",
      command: undefined,
      priority,
      showCount: 0,
      hideCount: 0,
      disposed: false,
      show() {
        this.showCount += 1;
      },
      hide() {
        this.hideCount += 1;
      },
      dispose() {
        this.disposed = true;
      }
    };
    fakeStatusBarItems.push(item);
    return item;
  };
  vscode.workspace.openTextDocument = async (value) => {
    openedDocuments.push(value);
    return { uri: value };
  };
  vscode.commands.executeCommand = async (command, ...args) => {
    executedCommands.push({ command, args });
    return undefined;
  };
  vscode.window.showTextDocument = async (document) => {
    shownDocuments.push(document);
    return document;
  };

  const traceableSubagent = await import(`${pathToFileURL(distTraceableSubagent).href}?traceable-subagent=${Date.now()}`);
  const traceableSubagentEvidence = await import(`${pathToFileURL(distTraceableSubagentEvidence).href}?traceable-subagent-evidence=${Date.now()}`);
  const traceableSubagentStatusBar = await import(`${pathToFileURL(distTraceableSubagentStatusBar).href}?traceable-subagent-status-bar=${Date.now()}`);
  const traceableSubagentStatusDetail = await import(`${pathToFileURL(distTraceableSubagentStatusDetail).href}?traceable-subagent-status-detail=${Date.now()}`);
  const traceableSubagentStatusPanel = await import(`${pathToFileURL(distTraceableSubagentStatusPanel).href}?traceable-subagent-status-panel=${Date.now()}`);
  const languageModelToolsModule = await import(`${pathToFileURL(distLanguageModelTools).href}?language-model-tools=${Date.now()}`);
  const toolNameNormalization = await import(`${pathToFileURL(distToolNameNormalization).href}?tool-name-normalization=${Date.now()}`);

  const detailController = new traceableSubagentStatusDetail.TraceableSubagentStatusDetailController();

  const statusBarController = new traceableSubagentStatusBar.TraceableSubagentStatusBarController({
    detailCommandId: "tiinex.aiVscodeTools.openTraceableSubagentStatusDetail",
    updateDetailView: (snapshot) => detailController.update(snapshot)
  });
  const formattedStatusReporter = statusBarController.startRun({
    agentName: "Anchor (GPT-5 mini) (Live Feedback Loop) (Experimental)",
    modelLabel: "gpt-5-mini"
  });
  const fakeStatusBarItem = fakeStatusBarItems[0];
  assert(
    fakeStatusBarItem.command === "tiinex.aiVscodeTools.openTraceableSubagentStatusDetail",
    `Traceable subagent status bar main item must open the shared detail markdown view when clicked. Got: ${String(fakeStatusBarItem.command)}`
  );
  formattedStatusReporter.update("queued");
  assert(
    fakeStatusBarItem.text === "$(sync~spin) Anchor: gpt-5-mini: queued",
    `Traceable subagent status bar must surface queued trace lanes in the same structured slot without introducing a separate grouping surface. Got: ${fakeStatusBarItem.text}`
  );
  formattedStatusReporter.update("continuing analysis");
  assert(
    fakeStatusBarItem.text === "$(sync~spin) Anchor: gpt-5-mini: reasoning: continuing",
    `Traceable subagent status bar must format reasoning status with agent and model context. Got: ${fakeStatusBarItem.text}`
  );
  formattedStatusReporter.update("running copilot_readFile");
  assert(
    fakeStatusBarItem.text === "$(sync~spin) Anchor: gpt-5-mini: tool: readFile",
    `Traceable subagent status bar must surface the current tool in a compact structured form. Got: ${fakeStatusBarItem.text}`
  );
  formattedStatusReporter.update("reading 2/4");
  assert(
    fakeStatusBarItem.text === "$(sync~spin) Anchor: gpt-5-mini: reading: 2/4",
    `Traceable subagent status bar must surface bounded file-read progress in the structured format. Got: ${fakeStatusBarItem.text}`
  );
  formattedStatusReporter.setHeader?.({ modelLabel: "gpt-5" });
  formattedStatusReporter.finish("completed", { detail: "grounded ok" });
  assert(
    fakeStatusBarItem.text === "$(check) Anchor: gpt-5: completed",
    `Traceable subagent status bar must keep the structured header on completion while updating the terminal message. Got: ${fakeStatusBarItem.text}`
  );
  assert(
    String(fakeStatusBarItem.tooltip).includes("Status: completed")
      && String(fakeStatusBarItem.tooltip).includes("Detail: grounded ok"),
    `Traceable subagent status bar must keep long-form completion detail in the tooltip instead of the visible label. Got: ${String(fakeStatusBarItem.tooltip)}`
  );
  formattedStatusReporter.setHeader?.({ modelLabel: "GPT-5.4" });
  assert(
    String(fakeStatusBarItem.tooltip).includes("Anchor: GPT-5.4"),
    `Traceable subagent status bar must preserve human-readable model display names from the runtime header. Got: ${String(fakeStatusBarItem.tooltip)}`
  );
  formattedStatusReporter.recordToolCall?.({
    callId: "call-1",
    toolName: "copilot_readFile",
    phase: "running",
    input: {
      filePath: path.join(packageRoot, "src", "extension.ts"),
      startLine: 1,
      endLine: 120
    }
  });
  formattedStatusReporter.recordToolCall?.({
    callId: "call-2",
    toolName: "copilot_readFile",
    phase: "deferred",
    input: {
      filePath: path.join(packageRoot, "README.md"),
      startLine: 1,
      endLine: 120
    },
    note: "Deferred to preserve synthesis."
  });
  const latestTrailItem = fakeStatusBarItems[2];
  const olderTrailItem = fakeStatusBarItems[1];
  assert(
    fakeStatusBarItem.priority > latestTrailItem.priority
      && latestTrailItem.priority > olderTrailItem.priority,
    `Traceable subagent status bar must keep the main header item to the left of the tool trail while ordering trail items by recency. Got: ${JSON.stringify(fakeStatusBarItems.map((item) => ({ text: item.text, priority: item.priority })))} `
  );
  assert(
    latestTrailItem.text === "$(warning) defer README.md"
      && olderTrailItem.text === "$(sync~spin) read extension.ts"
      && latestTrailItem.priority > olderTrailItem.priority,
    `Traceable subagent status bar must place the latest tool trail item first with compact labels. Got: ${JSON.stringify(fakeStatusBarItems.map((item) => ({ text: item.text, priority: item.priority })))} `
  );
  assert(
    String(latestTrailItem.tooltip).includes("Tool: copilot_readFile")
      && String(latestTrailItem.tooltip).includes("File: ")
      && String(latestTrailItem.tooltip).includes("Deferred to preserve synthesis."),
    `Traceable subagent status bar tool trail must expose tool metadata in the tooltip. Got: ${String(latestTrailItem.tooltip)}`
  );
  assert(
    latestTrailItem.command === "tiinex.aiVscodeTools.openTraceableSubagentStatusDetail"
      && olderTrailItem.command === "tiinex.aiVscodeTools.openTraceableSubagentStatusDetail",
    `Traceable subagent status bar trail items must also open the shared detail markdown view. Got: ${JSON.stringify(fakeStatusBarItems.map((item) => ({ text: item.text, command: item.command })))} `
  );
  const renderedDetailMarkdown = traceableSubagentStatusDetail.renderTraceableSubagentDetailMarkdown({
    header: {
      agentName: "Anchor",
      agentResolved: true,
      modelLabel: "gpt-5",
      candidate: true,
      experimental: true,
      humanRole: true,
      toolsetNames: ["read/readFile", "search/textSearch", "execute/runInTerminal", "tiinex.ai-vscode-tools/listAgentSessions"]
    },
    status: {
      phase: "warning",
      message: "incomplete",
      detail: "Grounding remained partial after deferred reads."
    },
    requestSummary: [],
    statusHistory: [],
    recentTools: [
      {
        callId: "call-2",
        toolName: "copilot_readFile",
        phase: "deferred",
        input: { filePath: path.join(packageRoot, "README.md"), startLine: 1, endLine: 120 },
        note: "Deferred to preserve synthesis."
      }
    ],
    startedAt: "2026-05-19T22:32:20.000Z",
    updatedAt: "2026-05-19T22:33:00.000Z"
  });
  assert(
    renderedDetailMarkdown.includes("⚠ Traceable Subagent Status")
      && renderedDetailMarkdown.includes("Anchor · gpt-5 · candidate · experimental · human-role · incomplete")
      && renderedDetailMarkdown.includes("Toolset: read\\_file, text\\_search, run\\_in\\_terminal, list\\_agent\\_sessions")
      && renderedDetailMarkdown.includes("⚠ defer README.md · copilot\\_readFile · lines 1-120 · [README.md](file:///")
      && renderedDetailMarkdown.includes("[README.md](file:///"),
    `Traceable subagent detail markdown must render compact inline event layout plus header metadata. Got: ${renderedDetailMarkdown}`
  );
  const panelSnapshot = {
    header: {
      agentName: "Anchor",
      agentFilePath: path.join(packageRoot, ".github", "agents", "Anchor.agent.md"),
      agentResolved: true,
      modelLabel: "GPT-5.4 mini (Copilot)",
      candidate: true,
      experimental: true,
      humanRole: true,
      toolsetNames: ["read/readFile", "search/textSearch", "execute/runInTerminal", "tiinex.ai-vscode-tools/listAgentSessions"],
      selectedToolNames: ["read/readFile", "tiinex.ai-vscode-tools/listAgentSessions"],
      toolSelectionRestricted: true
    },
    status: {
      phase: "warning",
      message: "incomplete",
      detail: "Grounding remained partial after deferred reads."
    },
    requestSummary: [
      {
        label: "Parent Frame",
        value: "Inspect missing final payloads",
        title: "Inspect missing final payloads in the current runtime and explain the bounded result clearly."
      },
      {
        label: "User Input",
        value: "Inspect whether the workspace contains a README",
        title: "Inspect whether the current workspace contains a README in ai-vscode-tools and report a compact summary of what it is for."
      },
      {
        label: "Mode",
        value: "NLE-W",
        title: "Declared input mode: NON_LEADING_EPISTEMIC\nTreat the input as inquiry-shaped framing and avoid smuggling the target conclusion into the task contract.\nDeclared validation mode: WARN\nSurface input-mode mismatches as trace-visible warnings while preserving the original userInput and parentFrame text unchanged.\nDeclared mode code: NLE-W"
      },
      {
        label: "Role",
        value: "Anchor",
        title: "Anchor"
      },
      {
        label: "Model",
        value: "gpt-5-mini",
        title: "gpt-5-mini"
      },
      {
        label: "Carry",
        value: "context · 2 files · 2 reductions",
        title: "Prior context summary carried into this trace run\nFile anchors: src/traceableSubagent.ts, tests/test.mjs\nReductions: stay read-only | prefer exact file anchors first"
      },
      {
        label: "Budget",
        value: "4i · 6t",
        title: "This child run may use up to 4 model turns and up to 6 tool calls."
      },
      {
        label: "Allowlist",
        value: "2 tools",
        title: "Allowed tools: read/readFile, search/textSearch"
      }
    ],
    statusHistory: [
      {
        id: "status-1",
        phase: "running",
        message: "starting",
        occurredAt: "2026-05-19T22:32:20.000Z"
      },
      {
        id: "status-2",
        phase: "running",
        message: "requesting analysis",
        occurredAt: "2026-05-19T22:32:21.000Z"
      },
      {
        id: "status-3",
        phase: "running",
        message: "reading 1/2",
        occurredAt: "2026-05-19T22:32:24.000Z"
      },
      {
        id: "status-4",
        phase: "warning",
        message: "incomplete",
        detail: "Grounding remained partial after deferred reads.",
        occurredAt: "2026-05-19T22:33:00.000Z"
      }
    ],
    recentTools: [
      {
        callId: "call-2",
        toolName: "copilot_readFile",
        phase: "deferred",
        input: { filePath: path.join(packageRoot, "README.md"), startLine: 1, endLine: 120 },
        note: "Deferred to preserve synthesis.",
        elapsedMs: 0,
        occurredAt: "2026-05-19T22:32:40.000Z"
      },
      {
        callId: "call-1b",
        toolName: "copilot_readFile",
        phase: "success",
        input: { filePath: path.join(packageRoot, "src", "extension.ts"), startLine: 121, endLine: 240 },
        elapsedMs: 210,
        occurredAt: "2026-05-19T22:32:26.000Z"
      },
      {
        callId: "call-1",
        toolName: "copilot_readFile",
        phase: "success",
        input: { filePath: path.join(packageRoot, "src", "extension.ts"), startLine: 1, endLine: 120 },
        elapsedMs: 180,
        occurredAt: "2026-05-19T22:32:24.000Z"
      },
      {
        callId: "call-3",
        toolName: "list_agent_sessions",
        phase: "failure",
        input: {},
        note: "Tool unavailable.",
        elapsedMs: 320,
        occurredAt: "2026-05-19T22:32:55.000Z"
      }
    ],
    startedAt: "2026-05-19T22:32:20.000Z",
    updatedAt: "2026-05-19T22:33:00.000Z"
  };
  const renderedPanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml(panelSnapshot, "codicon.css", { pinnedOpen: false });
  const renderedPinnedPanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml(panelSnapshot, "codicon.css", { pinnedOpen: true });
  const renderedRunningPanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    ...panelSnapshot,
    status: {
      phase: "running",
      message: "requesting analysis"
    },
    statusHistory: [
      {
        id: "status-run-1",
        phase: "running",
        message: "requesting analysis",
        occurredAt: "2026-05-19T22:32:21.000Z"
      }
    ],
    evidenceFile: {
      status: "writing",
      filePath: path.join(packageRoot, "evidence", "01-anchor.trace.md"),
      fileName: "01-anchor.trace.md",
      requestedBy: "tool-input",
      outputMode: "summary-with-evidence-path"
    }
  }, "codicon.css", { pinnedOpen: false });
  const renderedQueuedPanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    ...panelSnapshot,
    status: {
      phase: "running",
      message: "queued"
    },
    statusHistory: [
      {
        id: "status-queued-1",
        phase: "running",
        message: "queued",
        occurredAt: "2026-05-19T22:32:21.000Z"
      }
    ]
  }, "codicon.css", { pinnedOpen: false });
  const renderedReadyEvidencePanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    ...panelSnapshot,
    evidenceFile: {
      status: "ready",
      filePath: path.join(packageRoot, "evidence", "01-anchor.trace.md"),
      fileName: "01-anchor.trace.md",
      requestedBy: "tool-input",
      outputMode: "summary-with-evidence-path"
    }
  }, "codicon.css", { pinnedOpen: false });
  assert(
    renderedPanelHtml.includes("position: sticky;")
      && renderedPanelHtml.includes("<link rel=\"stylesheet\" href=\"codicon.css\" />")
      && renderedPanelHtml.includes("<button class=\"header-badge header-badge-role-human header-badge-role-resolved\" type=\"button\"")
      && renderedPanelHtml.includes("title=\"Model: GPT-5.4 mini (Copilot)\"")
      && renderedPanelHtml.includes("<span class=\"header-badge-label\">Activities</span>")
      && renderedPanelHtml.includes("<li class=\"event-row event-request\"")
      && renderedPanelHtml.includes("data-request-expandable=\"true\"")
      && renderedPanelHtml.includes("event-request-detail")
      && renderedPanelHtml.includes("event-summary-preview")
      && renderedPanelHtml.includes(">Parent Frame<")
      && renderedPanelHtml.includes(">User Input<")
      && renderedPanelHtml.includes(">Mode<")
      && renderedPanelHtml.includes(">Role<")
      && renderedPanelHtml.includes(">Model<")
      && renderedPanelHtml.includes(">Track<")
      && renderedPanelHtml.includes(">Carry<")
      && renderedPanelHtml.includes(">Budget<")
      && renderedPanelHtml.includes(">Allowlist<")
      && renderedPanelHtml.includes(">Tools<")
      && renderedPanelHtml.includes("Declared input mode: NON_LEADING_EPISTEMIC")
      && renderedPanelHtml.includes("Declared validation mode: WARN")
      && renderedPanelHtml.includes("Declared mode code: NLE-W")
      && renderedPanelHtml.includes("Prior context summary carried into this trace run")
      && renderedPanelHtml.includes("File anchors: src/traceableSubagent.ts, tests/test.mjs")
      && renderedPanelHtml.includes("Reductions: stay read-only | prefer exact file anchors first")
      && renderedPanelHtml.includes("This child run may use up to 4 model turns and up to 6 tool calls.")
      && renderedPanelHtml.includes(">GPT-5.4 mini (Copilot)<")
      && renderedPanelHtml.includes(">Experimental<")
      && renderedPanelHtml.includes(">read/readFile, search/textSearch<")
      && renderedPanelHtml.includes(".event-request.request-expanded .event-chips {")
      && !renderedPanelHtml.includes("<span class=\"header-badge-label\">Parent Frame</span>")
      && renderedPanelHtml.includes("<span class=\"header-badge activity-request-badge\" title=\"Declared input mode: NON_LEADING_EPISTEMIC\nTreat the input as inquiry-shaped framing and avoid smuggling the target conclusion into the task contract.\nDeclared validation mode: WARN\nSurface input-mode mismatches as trace-visible warnings while preserving the original userInput and parentFrame text unchanged.\nDeclared mode code: NLE-W\"><span class=\"header-badge-label\">Mode</span><span class=\"header-badge-value\">NLE-W</span></span>")
      && renderedPanelHtml.includes("<button class=\"header-badge activity-request-badge header-badge-role-human header-badge-role-resolved\" type=\"button\" title=\"Human role\n")
      && renderedPanelHtml.includes("<span class=\"header-badge activity-request-badge header-badge-model\" title=\"Model: GPT-5.4 mini (Copilot)\"><span class=\"header-badge-label\">Model</span><span class=\"header-badge-value\">GPT-5.4 mini (Copilot)</span></span>")
      && renderedPanelHtml.includes("<span class=\"header-badge activity-request-badge header-badge-track-experimental\" title=\"Track: Experimental\"><span class=\"header-badge-label\">Track</span><span class=\"header-badge-value\">Experimental</span></span>")
      && renderedPanelHtml.includes("<span class=\"header-badge activity-request-badge\" title=\"Prior context summary carried into this trace run\nFile anchors: src/traceableSubagent.ts, tests/test.mjs\nReductions: stay read-only | prefer exact file anchors first\"><span class=\"header-badge-label\">Carry</span><span class=\"header-badge-value\">context · 2 files · 2 reductions</span></span>")
      && renderedPanelHtml.includes("<span class=\"header-badge activity-request-badge activity-request-badge-count\" title=\"2 allowed tools\"><span class=\"header-badge-label\">Tools</span><span class=\"header-badge-value\">2</span></span>")
      && renderedPanelHtml.includes("<span class=\"header-badge activity-request-badge\" title=\"Allowed tools: read/readFile, search/textSearch\"><span class=\"header-badge-label\">Allowlist</span><span class=\"header-badge-value\">2 tools</span></span>"),
    `Traceable subagent status panel must render header metadata and expandable request details. Got: ${renderedPanelHtml}`
  );
  assert(
    renderedPanelHtml.includes("<li class=\"event-row event-status event-status-running event-status-settled\"")
      && renderedPanelHtml.includes("title=\"requesting analysis\"")
      && renderedPanelHtml.includes(">requesting analysis<")
      && renderedPanelHtml.includes("Awaiting the first child response.")
      && renderedPanelHtml.includes("<span class=\"activity-duration-label\">For</span><span class=\"activity-duration-value\">3.0s</span>")
      && renderedPanelHtml.includes("<span class=\"chip chip-status-phase chip-status-phase-warning\">warning</span><span class=\"chip chip-time\"")
      && renderedPanelHtml.includes("Grounding remained partial after deferred reads."),
    `Traceable subagent status panel must render status activity rows with derived transparency notes. Got: ${renderedPanelHtml}`
  );
  assert(
    renderedQueuedPanelHtml.includes("title=\"queued\"")
      && renderedQueuedPanelHtml.includes(">queued<")
      && renderedQueuedPanelHtml.includes("Waiting for the traceable single-flight queue to hand this lane the active slot."),
    `Traceable subagent status panel must render queued runs through the existing running-status activity path instead of introducing a separate grouping surface. Got: ${renderedQueuedPanelHtml}`
  );
  assert(
    renderedPanelHtml.includes("status-group-severity-warning")
      && renderedPanelHtml.includes(".status-group.status-group-severity-error .event-status-group-toggle")
      && renderedPanelHtml.includes(".status-group.status-group-severity-warning .event-status-group-toggle"),
    `Traceable subagent status panel must color collapsed status-group toggles by highest-severity child status. Got: ${renderedPanelHtml}`
  );
  assert(
    renderedPanelHtml.includes("Tool access")
      && renderedPanelHtml.includes("<div class=\"toolset-root-heading\"><span class=\"toolset-root-heading-main\"><span class=\"toolset-root-label\">Native Tools</span>")
      && renderedPanelHtml.includes("<div class=\"toolset-root-heading\"><span class=\"toolset-root-heading-main\"><span class=\"toolset-root-label\">Extension Tools</span>")
      && renderedPanelHtml.includes("data-namespace-id=\"Extension Tools/tiinex/ai-vscode-tools\"")
      && renderedPanelHtml.includes("<li class=\"event-row event-tool event-kind-read event-outcome-deferred\"")
      && renderedPanelHtml.includes("<div class=\"event-note\">Deferred to preserve synthesis.</div>")
      && renderedPanelHtml.includes("event-kind-tool event-outcome-failure")
      && renderedPanelHtml.includes(">Export<")
      && renderedRunningPanelHtml.includes(">View<")
      && renderedRunningPanelHtml.includes("toolbar-button-export-live")
      && renderedRunningPanelHtml.includes("toolbar-live-indicator")
      && !renderedRunningPanelHtml.includes(">Export<")
      && renderedReadyEvidencePanelHtml.includes(">View<")
      && renderedReadyEvidencePanelHtml.includes("toolbar-button-export-ready")
      && !renderedReadyEvidencePanelHtml.includes(">Export<")
      && renderedPanelHtml.includes("\"type\":\"stayOpen\"")
      && renderedPinnedPanelHtml.includes("\"type\":\"closePanel\"")
      && renderedPanelHtml.indexOf("read extension.ts") < renderedPanelHtml.indexOf("read README.md"),
    `Traceable subagent status panel must render tool access, event rows, and export affordances. Got: ${renderedPanelHtml}`
  );
  const renderedEvidenceEditorPanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml(panelSnapshot, "codicon.css", {
    pinnedOpen: true,
    hideToolbarControls: true
  });
  assert(
    !renderedEvidenceEditorPanelHtml.includes(">Export<")
      && !renderedEvidenceEditorPanelHtml.includes(">View<")
      && !renderedEvidenceEditorPanelHtml.includes(">Close<")
      && !renderedEvidenceEditorPanelHtml.includes(">Stay<"),
    `Traceable evidence editor rendering must hide sticky-header toolbar controls when the shared panel HTML is reused inside an editor tab. Got: ${renderedEvidenceEditorPanelHtml}`
  );
  assert(
    renderedPanelHtml.includes("const BOTTOM_FOLLOW_THRESHOLD_PX = 24;")
      && renderedPanelHtml.includes("vscodeApi.getState()")
      && renderedPanelHtml.includes("toolsetDisclosureOpen: false")
      && renderedPanelHtml.includes("requestExpanded: false")
      && renderedPanelHtml.includes("namespaceOpenById: {}")
      && renderedPanelHtml.includes("runId: ''")
      && renderedPanelHtml.includes(`const currentRunId = ${JSON.stringify(panelSnapshot.startedAt)};`)
      && renderedPanelHtml.includes("const requestRow = document.querySelector('.event-request[data-request-expandable=\"true\"]');")
      && renderedPanelHtml.includes("window.addEventListener('message'")
      && renderedPanelHtml.includes("const effectiveReferenceIso = timerNode.dataset.running === 'true'")
      && renderedPanelHtml.includes(": (updatedAt || referenceIso || new Date().toISOString());")
      && renderedPanelHtml.includes("followLatest: isNearBottom()")
      && renderedPanelHtml.includes("setTimeout(applyScroll, 120);"),
    `Traceable subagent status panel must preserve panel state and follow-latest wiring. Got: ${renderedPanelHtml}`
  );
  const renderedRestrictedPolicyPanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    header: {
      agentName: "Anchor",
      agentResolved: true,
      modelLabel: "gpt-5",
      candidate: false,
      experimental: false,
      humanRole: false,
      toolsetNames: ["read/readFile", "search/textSearch", "execute/runInTerminal", "tiinex.ai-vscode-tools/listAgentSessions"],
      selectedToolNames: ["read/readFile", "search/textSearch"],
      toolSelectionRestricted: true
    },
    status: {
      phase: "running",
      message: "requesting analysis"
    },
    requestSummary: [],
    statusHistory: [
      {
        id: "status-policy-1",
        phase: "running",
        message: "requesting analysis",
        occurredAt: "2026-05-20T05:42:41.000Z"
      }
    ],
    recentTools: [],
    startedAt: "2026-05-20T05:42:41.000Z",
    updatedAt: "2026-05-20T05:42:42.000Z"
  }, "codicon.css");
  assert(
    renderedRestrictedPolicyPanelHtml.includes("data-namespace-id=\"Native Tools/search\"")
      && renderedRestrictedPolicyPanelHtml.includes("data-namespace-id=\"Extension Tools/tiinex\"")
      && renderedRestrictedPolicyPanelHtml.includes("data-namespace-id=\"Extension Tools/tiinex/ai-vscode-tools\"")
      && renderedRestrictedPolicyPanelHtml.includes("toolset-item toolset-tree-node toolset-runtime-idle toolset-node-last\" title=\"search/textSearch\"")
      && renderedRestrictedPolicyPanelHtml.includes("toolset-item toolset-tree-node toolset-runtime-inactive toolset-node-last\" title=\"tiinex.ai-vscode-tools/listAgentSessions\""),
    `Traceable subagent panel must keep allowlisted-but-uninvoked namespaces neutral while propagating inactive state through fully policy-blocked namespaces. Got: ${renderedRestrictedPolicyPanelHtml}`
  );
  const renderedDottedCustomNamespacePanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    header: {
      agentName: "Anchor",
      agentResolved: true,
      modelLabel: "gpt-5",
      candidate: false,
      experimental: false,
      humanRole: false,
      toolsetNames: ["search/textSearch", "tiinex.tiinex-youtube-tools/createWorkingTopic"],
      selectedToolNames: ["search/textSearch", "tiinex.tiinex-youtube-tools/createWorkingTopic"],
      toolSelectionRestricted: false
    },
    status: {
      phase: "running",
      message: "requesting analysis"
    },
    requestSummary: [],
    statusHistory: [],
    recentTools: [],
    startedAt: "2026-05-20T05:42:41.000Z",
    updatedAt: "2026-05-20T05:42:42.000Z"
  }, "codicon.css");
  assert(
    renderedDottedCustomNamespacePanelHtml.includes("data-namespace-id=\"Extension Tools/tiinex\"")
      && renderedDottedCustomNamespacePanelHtml.includes("data-namespace-id=\"Extension Tools/tiinex/tiinex-youtube-tools\"")
      && renderedDottedCustomNamespacePanelHtml.includes("title=\"tiinex.tiinex-youtube-tools/createWorkingTopic\"")
      && !renderedDottedCustomNamespacePanelHtml.includes("data-namespace-id=\"Native Tools/tiinex.tiinex-youtube-tools\""),
    `Traceable subagent panel must classify dotted extension namespaces under Extension Tools instead of treating them as native tools. Got: ${renderedDottedCustomNamespacePanelHtml}`
  );
  const renderedUndottedCustomNamespacePanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    header: {
      agentName: "Anchor",
      agentResolved: true,
      modelLabel: "gpt-5",
      candidate: false,
      experimental: false,
      humanRole: false,
      toolsetNames: [
        "read/readFile",
        "gitkraken/git_blame",
        "tiinexaivscodetools/estimateContextBreakdown"
      ],
      selectedToolNames: [
        "read/readFile",
        "gitkraken/git_blame",
        "tiinexaivscodetools/estimateContextBreakdown"
      ],
      toolSelectionRestricted: false
    },
    status: {
      phase: "running",
      message: "requesting analysis"
    },
    requestSummary: [],
    statusHistory: [],
    recentTools: [],
    startedAt: "2026-05-20T05:42:41.000Z",
    updatedAt: "2026-05-20T05:42:42.000Z"
  }, "codicon.css");
  assert(
    renderedUndottedCustomNamespacePanelHtml.includes("data-namespace-id=\"Extension Tools/gitkraken\"")
      && renderedUndottedCustomNamespacePanelHtml.includes("title=\"gitkraken/git_blame\"")
      && renderedUndottedCustomNamespacePanelHtml.includes("data-namespace-id=\"Extension Tools/tiinexaivscodetools\"")
      && renderedUndottedCustomNamespacePanelHtml.includes("title=\"tiinexaivscodetools/estimateContextBreakdown\"")
      && !renderedUndottedCustomNamespacePanelHtml.includes("data-namespace-id=\"Native Tools/gitkraken\"")
      && !renderedUndottedCustomNamespacePanelHtml.includes("data-namespace-id=\"Native Tools/tiinexaivscodetools\""),
    `Traceable subagent panel must classify undotted extension namespaces under Extension Tools instead of treating them as native tools. Got: ${renderedUndottedCustomNamespacePanelHtml}`
  );
  const renderedIdleLandingPanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    header: {
      agentName: "Trace lane",
      agentResolved: false,
      modelLabel: "model",
      candidate: false,
      experimental: false,
      humanRole: false,
      toolsetNames: []
    },
    status: {
      phase: "idle",
      message: "idle"
    },
    requestSummary: [],
    statusHistory: [],
    recentTools: [],
    startedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  }, "codicon.css");
  assert(
    renderedIdleLandingPanelHtml.includes("Waiting for a trace run")
      && renderedIdleLandingPanelHtml.includes("Start a TRACEABLE run, or reopen one from the status bar")
      && !renderedIdleLandingPanelHtml.includes(">No role<")
      && !renderedIdleLandingPanelHtml.includes("No workspace role selected. This run is using the direct TRACEABLE lane")
      && renderedIdleLandingPanelHtml.includes(">Ready<")
      && !renderedIdleLandingPanelHtml.includes('<span class="meta-stopwatch-label">Total</span>')
      && !renderedIdleLandingPanelHtml.includes('<span class="meta-stopwatch-label">Tools</span>')
      && !renderedIdleLandingPanelHtml.includes('<span class="meta-stopwatch-label">Think</span>')
      && !renderedIdleLandingPanelHtml.includes("Trace lane (requested)")
      && !renderedIdleLandingPanelHtml.includes("No activity yet."),
    `Traceable subagent panel must render a neutral landing state without timers before any activity exists. Got: ${renderedIdleLandingPanelHtml}`
  );
  const renderedNormalizedSearchBadgePanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    header: {
      agentName: "Sigma",
      agentResolved: false,
      modelLabel: "gpt-5",
      candidate: false,
      experimental: false,
      humanRole: false,
      toolsetNames: []
    },
    status: {
      phase: "running",
      message: "working"
    },
    requestSummary: [],
    statusHistory: [],
    recentTools: [
      {
        callId: "call-search-1",
        toolName: "copilot_find_files",
        phase: "success",
        input: {
          query: "src/*traceable*",
          maxResults: 5
        },
        elapsedMs: 140,
        occurredAt: "2026-05-19T22:33:01.000Z"
      }
    ],
    startedAt: "2026-05-19T22:33:00.000Z",
    updatedAt: "2026-05-19T22:33:05.000Z"
  }, "codicon.css");
  assert(
    renderedNormalizedSearchBadgePanelHtml.includes("<span class=\"chip-icon\"><span class=\"codicon codicon-files\" aria-hidden=\"true\"></span></span>")
      && renderedNormalizedSearchBadgePanelHtml.includes("<span class=\"header-badge-icon\"><span class=\"codicon codicon-hubot\" aria-hidden=\"true\"></span></span>")
      && renderedNormalizedSearchBadgePanelHtml.includes("header-badge-role-pending")
      && renderedNormalizedSearchBadgePanelHtml.includes("Requested AI role\nNot yet resolved to a workspace .agent.md artifact.")
      && renderedNormalizedSearchBadgePanelHtml.includes(">Sigma (requested)<")
      && renderedNormalizedSearchBadgePanelHtml.includes("event-kind-search event-outcome-success")
      && renderedNormalizedSearchBadgePanelHtml.includes(">✓</span><span class=\"event-label\">found files</span>")
      && renderedNormalizedSearchBadgePanelHtml.includes("<div class=\"event-note\">Query: src/*traceable* · up to 5 results</div>")
      && renderedNormalizedSearchBadgePanelHtml.includes("<span class=\"chip-hover-label\">find_files</span>")
      && renderedNormalizedSearchBadgePanelHtml.includes("Observed tools 1 total")
      && renderedNormalizedSearchBadgePanelHtml.includes("<div class=\"toolset-root-heading\"><span class=\"toolset-root-heading-main\"><span class=\"toolset-root-label\">Native Tools</span>")
      && renderedNormalizedSearchBadgePanelHtml.includes(">find_files<"),
    `Traceable subagent panel must show an explicit AI role icon and normalize equivalent tool-name spellings before icon lookup. Got: ${renderedNormalizedSearchBadgePanelHtml}`
  );
  const renderedGenericToolOutcomePanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    header: {
      agentName: "Anchor",
      modelLabel: "gpt-5.4",
      candidate: false,
      experimental: false,
      humanRole: false,
      toolsetNames: []
    },
    status: {
      phase: "completed",
      message: "completed"
    },
    requestSummary: [],
    statusHistory: [],
    recentTools: [
      {
        callId: "call-tool-1",
        toolName: "copilot_runInTerminal",
        phase: "success",
        input: { command: "echo ok" },
        elapsedMs: 220,
        occurredAt: "2026-05-19T22:33:06.000Z"
      },
      {
        callId: "call-tool-2",
        toolName: "copilot_runInTerminal",
        phase: "failure",
        input: { command: "exit 1" },
        note: "Command failed.",
        elapsedMs: 180,
        occurredAt: "2026-05-19T22:33:08.000Z"
      }
    ],
    startedAt: "2026-05-19T22:33:00.000Z",
    updatedAt: "2026-05-19T22:33:10.000Z"
  }, "codicon.css");
  assert(
    renderedGenericToolOutcomePanelHtml.includes("event-kind-tool event-outcome-success")
      && renderedGenericToolOutcomePanelHtml.includes("event-kind-tool event-outcome-failure")
      && renderedGenericToolOutcomePanelHtml.includes(">✓</span><span class=\"event-label\">runInTerminal</span>")
      && renderedGenericToolOutcomePanelHtml.includes(">✕</span><span class=\"event-label\">runInTerminal</span>")
      && renderedGenericToolOutcomePanelHtml.includes(".event-tool.event-outcome-success .event-icon {")
      && renderedGenericToolOutcomePanelHtml.includes(".event-tool.event-outcome-failure .event-icon {"),
    `Traceable subagent panel must drive generic tool icons and colors from tool outcome, not a hardcoded tool-name allowlist. Got: ${renderedGenericToolOutcomePanelHtml}`
  );
  const renderedGappedRangePanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    header: {
      agentName: "Anchor",
      modelLabel: "gpt-5",
      candidate: false,
      experimental: false,
      humanRole: false,
      toolsetNames: []
    },
    status: {
      phase: "completed",
      message: "completed"
    },
    requestSummary: [],
    statusHistory: [],
    recentTools: [
      {
        callId: "call-gap-2",
        toolName: "copilot_readFile",
        phase: "success",
        input: { filePath: path.join(packageRoot, "src", "extension.ts"), startLine: 401, endLine: 520 },
        elapsedMs: 150,
        occurredAt: "2026-05-19T22:32:50.000Z"
      },
      {
        callId: "call-gap-1",
        toolName: "copilot_readFile",
        phase: "success",
        input: { filePath: path.join(packageRoot, "src", "extension.ts"), startLine: 1, endLine: 120 },
        elapsedMs: 110,
        occurredAt: "2026-05-19T22:32:10.000Z"
      }
    ],
    startedAt: "2026-05-19T22:32:05.000Z",
    updatedAt: "2026-05-19T22:33:10.000Z"
  }, "codicon.css");
  assert(
    renderedGappedRangePanelHtml.includes("<span class=\"chip\" title=\"Merged 2 tool calls\">2x</span>")
      && renderedGappedRangePanelHtml.includes("<span class=\"chip chip-range chip-collapsible\" title=\"Lines 1-120\">")
      && renderedGappedRangePanelHtml.includes("<span class=\"chip-separator\" aria-hidden=\"true\">|</span>")
      && renderedGappedRangePanelHtml.includes("<span class=\"chip chip-range chip-collapsible\" title=\"Lines 401-520\">")
      && !renderedGappedRangePanelHtml.includes("<span class=\"chip chip-range chip-collapsible\" title=\"Lines 1-520\">")
      && renderedGappedRangePanelHtml.includes("&quot;filePath&quot;:&quot;")
      && renderedGappedRangePanelHtml.includes("extension.ts</button>")
      && !renderedGappedRangePanelHtml.includes("&quot;startLine&quot;")
      && !renderedGappedRangePanelHtml.includes("&quot;endLine&quot;"),
    `Traceable subagent panel must keep non-contiguous line spans as separate badges instead of implying one continuous range. Got: ${renderedGappedRangePanelHtml}`
  );
  const renderedMixedOutcomePanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    header: {
      agentName: "Anchor",
      modelLabel: "gpt-5",
      candidate: false,
      experimental: false,
      humanRole: false,
      toolsetNames: []
    },
    status: {
      phase: "completed",
      message: "completed"
    },
    requestSummary: [],
    statusHistory: [],
    recentTools: [
      {
        callId: "call-mixed-2",
        toolName: "copilot_readFile",
        phase: "failure",
        input: { filePath: path.join(packageRoot, "src", "extension.ts"), startLine: 121, endLine: 240 },
        note: "Read failed.",
        elapsedMs: 120,
        occurredAt: "2026-05-19T22:32:20.000Z"
      },
      {
        callId: "call-mixed-1",
        toolName: "copilot_readFile",
        phase: "success",
        input: { filePath: path.join(packageRoot, "src", "extension.ts"), startLine: 1, endLine: 120 },
        elapsedMs: 100,
        occurredAt: "2026-05-19T22:32:10.000Z"
      }
    ],
    startedAt: "2026-05-19T22:32:05.000Z",
    updatedAt: "2026-05-19T22:33:10.000Z"
  }, "codicon.css");
  assert(
    (renderedMixedOutcomePanelHtml.match(/<li class=\"event-row event-tool /g)?.length ?? 0) === 2
      && renderedMixedOutcomePanelHtml.includes("event-outcome-success")
      && renderedMixedOutcomePanelHtml.includes("event-outcome-failure")
      && !renderedMixedOutcomePanelHtml.includes("<span class=\"chip\" title=\"Merged 2 tool calls\">2x</span>"),
    `Traceable subagent panel must keep differing tool outcomes on separate rows instead of grouping them together. Got: ${renderedMixedOutcomePanelHtml}`
  );
  const renderedDeferredPanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    header: {
      agentName: "Anchor",
      modelLabel: "gpt-5",
      candidate: false,
      experimental: false,
      humanRole: false,
      toolsetNames: []
    },
    status: {
      phase: "warning",
      message: "incomplete"
    },
    requestSummary: [],
    statusHistory: [],
    recentTools: [
      {
        callId: "call-deferred-2",
        toolName: "copilot_readFile",
        phase: "deferred",
        input: { filePath: path.join(packageRoot, "src", "extension.ts"), startLine: 860, endLine: 1060 },
        note: "Deferred to preserve a final synthesis turn.",
        elapsedMs: 0,
        occurredAt: "2026-05-19T22:32:20.000Z"
      },
      {
        callId: "call-deferred-1",
        toolName: "copilot_readFile",
        phase: "deferred",
        input: { filePath: path.join(packageRoot, "src", "extension.ts"), startLine: 1061, endLine: 1260 },
        note: "Deferred to preserve a final synthesis turn.",
        elapsedMs: 0,
        occurredAt: "2026-05-19T22:32:10.000Z"
      }
    ],
    startedAt: "2026-05-19T22:32:05.000Z",
    updatedAt: "2026-05-19T22:33:10.000Z"
  }, "codicon.css");
  assert(
    (renderedDeferredPanelHtml.match(/<li class=\"event-row event-tool event-kind-read event-outcome-deferred\"/g)?.length ?? 0) === 2
      && !renderedDeferredPanelHtml.includes("<span class=\"chip\" title=\"Merged 2 tool calls\">2x</span>")
      && renderedDeferredPanelHtml.includes("<span class=\"chip chip-range chip-collapsible\" title=\"Lines 860-1060\">")
      && renderedDeferredPanelHtml.includes("<span class=\"chip chip-range chip-collapsible\" title=\"Lines 1061-1260\">"),
    `Traceable subagent panel must keep deferred tool calls on separate rows instead of grouping them into one ambiguous 2x row. Got: ${renderedDeferredPanelHtml}`
  );
  const renderedCompletedOutputPanelHtml = traceableSubagentStatusPanel.renderTraceableSubagentPanelHtml({
    header: {
      agentName: "Anchor",
      modelLabel: "gpt-5-mini",
      candidate: false,
      experimental: true,
      humanRole: false,
      toolsetNames: ["read/readFile"]
    },
    status: {
      phase: "completed",
      message: "completed",
      detail: "Successfully read lines 1-400 of traceableSubagent.ts and returned a bounded summary."
    },
    requestSummary: [],
    statusHistory: [
      {
        id: "status-complete-1",
        phase: "running",
        message: "requesting analysis",
        occurredAt: "2026-05-20T04:04:02.000Z"
      },
      {
        id: "status-complete-2",
        phase: "running",
        message: "synthesizing",
        occurredAt: "2026-05-20T04:04:53.000Z"
      },
      {
        id: "status-complete-3",
        phase: "completed",
        message: "completed",
        detail: "Successfully read lines 1-400 of traceableSubagent.ts and returned a bounded summary.",
        occurredAt: "2026-05-20T04:04:57.000Z"
      }
    ],
    recentTools: [
      {
        callId: "complete-call-1",
        toolName: "copilot_readFile",
        phase: "success",
        input: { filePath: path.join(packageRoot, "src", "traceableSubagent.ts"), startLine: 1, endLine: 400 },
        elapsedMs: 12,
        occurredAt: "2026-05-20T04:04:16.000Z"
      }
    ],
    startedAt: "2026-05-20T04:04:02.000Z",
    updatedAt: "2026-05-20T04:04:57.000Z"
  }, "codicon.css");
  assert(
    renderedCompletedOutputPanelHtml.includes("<span class=\"event-label\">Output</span>")
      && renderedCompletedOutputPanelHtml.includes("Successfully read lines 1-400 of traceableSubagent.ts and returned a bounded summary.")
      && renderedCompletedOutputPanelHtml.includes("<li class=\"event-row event-output\"")
      && !renderedCompletedOutputPanelHtml.includes("chip-status-phase\">returned</span>")
      && renderedCompletedOutputPanelHtml.indexOf(">completed<") < renderedCompletedOutputPanelHtml.indexOf(">Output<"),
    `Traceable subagent panel must append a dedicated output activity after completion. Got: ${renderedCompletedOutputPanelHtml}`
  );
  assert(
    renderedCompletedOutputPanelHtml.match(/Successfully read lines 1-400 of traceableSubagent\.ts and returned a bounded summary\./g)?.length === 1,
    `Traceable subagent panel must avoid duplicating the final output text once the dedicated output row is present. Got: ${renderedCompletedOutputPanelHtml}`
  );
  await detailController.open();
  assert(
    executedCommands.length === 1
      && executedCommands[0].command === "markdown.showPreview"
      && openedDocuments.length === 0
      && shownDocuments.length === 0,
    `Traceable subagent detail controller must prefer markdown preview when opening the shared detail view. Got: commands=${JSON.stringify(executedCommands)}, opened=${openedDocuments.length}, shown=${shownDocuments.length}`
  );
  detailController.dispose();
  statusBarController.dispose();
  vscode.window.createStatusBarItem = originalCreateStatusBarItem;
  vscode.workspace.openTextDocument = originalOpenTextDocument;
  vscode.commands.executeCommand = originalExecuteCommand;
  vscode.window.showTextDocument = originalShowTextDocument;
  vscode.StatusBarAlignment = originalStatusBarAlignment;

  assert(
    toolNameNormalization.normalizeToolReferenceKey("tiinex.ai-vscode-tools/listAgentSessions") === "list_agent_sessions"
      && toolNameNormalization.normalizeToolReferenceKey("tiinex.ai-vscode-tools/invoke-youtube-host-command") === "invoke_youtube_host_command"
      && toolNameNormalization.normalizeToolReferenceKey("read/readFile") === "read_file",
    "Tool-name normalization must collapse namespaced prompt aliases, hyphenated aliases, and slash-scoped runtime names to one comparison key."
  );
  assert(
    JSON.stringify(toolNameNormalization.expandToolReferenceKeys("read/readFile")) === JSON.stringify(["read_file", "copilot_read_file"])
      && JSON.stringify(toolNameNormalization.expandToolReferenceKeys("search/textSearch")) === JSON.stringify(["text_search", "copilot_find_text_in_files"]),
    "Tool-name normalization must expand legacy read/search aliases to the current copilot runtime tool names."
  );

  const selectedTools = traceableSubagent.selectTraceableSubagentTools([
    { name: "run_traceable_subagent", description: "self" },
    { name: "list_agent_sessions", description: "read only" },
    { name: "create_live_agent_chat", description: "mutation" },
    { name: "runSubagent", description: "native" }
  ], {
    userInput: "show me the controlling code path",
    parentTask: "inspect the code path",
    blockedToolNames: []
  });

  assert(
    selectedTools.some((tool) => tool.name === "list_agent_sessions"),
    "Traceable subagent tool selection must keep safe read-only tools available by default."
  );
  assert(
    !selectedTools.some((tool) => tool.name === "run_traceable_subagent"),
    "Traceable subagent tool selection must block self-reentry by default."
  );
  assert(
    !selectedTools.some((tool) => tool.name === "create_live_agent_chat"),
    "Traceable subagent tool selection must block live mutation tools by default."
  );
  assert(
    !selectedTools.some((tool) => tool.name === "runSubagent"),
    "Traceable subagent tool selection must block native runSubagent so the lane cannot spawn opaque child work."
  );

  const oversizedDefaultSelection = traceableSubagent.selectTraceableSubagentTools([
    { name: "list_agent_sessions", description: "read only" },
    { name: "copilot_readFile", description: "file read" },
    { name: "copilot_findFiles", description: "file search" },
    ...Array.from({ length: 200 }, (_, index) => ({ name: `other_tool_${index}`, description: "other" }))
  ], {
    userInput: "inspect a code path",
    parentTask: "use the default safe surface"
  });

  assert(
    oversizedDefaultSelection.length < 128
      && oversizedDefaultSelection.some((tool) => tool.name === "list_agent_sessions")
      && oversizedDefaultSelection.some((tool) => tool.name === "copilot_readFile")
      && oversizedDefaultSelection.some((tool) => tool.name === "copilot_findFiles")
      && !oversizedDefaultSelection.some((tool) => tool.name === "other_tool_0"),
    `Traceable subagent default tool selection must stay on a bounded safe surface instead of forwarding the full host tool catalog. Got: ${JSON.stringify(oversizedDefaultSelection)}`
  );

  const inheritedSelectedTools = traceableSubagent.selectTraceableSubagentTools([
    { name: "read/readFile", description: "file read" },
    { name: "search/textSearch", description: "search" },
    { name: "create_live_agent_chat", description: "mutation" }
  ], {
    userInput: "inspect a file",
    parentTask: "use inherited role tools",
    blockedToolNames: [],
    defaultAllowedToolNames: ["read/readFile", "search/textSearch"]
  });

  assert(
    inheritedSelectedTools.length === 2
      && inheritedSelectedTools.some((tool) => tool.name === "read/readFile")
      && inheritedSelectedTools.some((tool) => tool.name === "search/textSearch"),
    `Traceable subagent tool selection must inherit the resolved agent role tool declarations when no explicit allowlist is provided. Got: ${JSON.stringify(inheritedSelectedTools)}`
  );
  assert(
    !inheritedSelectedTools.some((tool) => tool.name === "create_live_agent_chat"),
    "Traceable subagent inherited tool selection must still enforce the default blocked tool set."
  );

  const inheritedPromptReferenceTools = traceableSubagent.selectTraceableSubagentTools([
    { name: "list_agent_sessions", description: "session list" },
    { name: "run_traceable_subagent", description: "self" },
    { name: "create_live_agent_chat", description: "mutation" },
    { name: "invoke_youtube_host_command", description: "live host mutation" }
  ], {
    userInput: "inspect available sessions",
    parentTask: "use inherited namespaced prompt references",
    blockedToolNames: [],
    defaultAllowedToolNames: [
      "tiinex.ai-vscode-tools/listAgentSessions",
      "tiinex.ai-vscode-tools/runTraceableSubagent",
      "tiinex.ai-vscode-tools/createLiveAgentChat",
      "tiinex.ai-vscode-tools/invoke-youtube-host-command"
    ]
  });

  assert(
    JSON.stringify(inheritedPromptReferenceTools.map((tool) => tool.name)) === JSON.stringify(["list_agent_sessions"]),
    `Traceable subagent tool selection must translate inherited namespaced prompt references to host runtime tool names while preserving the default blocked set. Got: ${JSON.stringify(inheritedPromptReferenceTools)}`
  );

  const blockedPromptReferenceTools = traceableSubagent.selectTraceableSubagentTools([
    { name: "list_agent_sessions", description: "session list" },
    { name: "reveal_live_agent_chat", description: "safe reveal" },
    { name: "search/textSearch", description: "search" }
  ], {
    userInput: "inspect available sessions",
    parentTask: "block a tool through a namespaced prompt reference",
    blockedToolNames: ["tiinex.ai-vscode-tools/listAgentSessions"]
  });

  assert(
    JSON.stringify(blockedPromptReferenceTools.map((tool) => tool.name)) === JSON.stringify(["search/textSearch"]),
    `Traceable subagent tool selection must translate blocked namespaced prompt references to host runtime tool names. Got: ${JSON.stringify(blockedPromptReferenceTools)}`
  );

  const explicitPromptReferenceTools = traceableSubagent.selectTraceableSubagentTools([
    { name: "list_agent_sessions", description: "session list" },
    { name: "search/textSearch", description: "search" },
    { name: "create_live_agent_chat", description: "mutation" }
  ], {
    userInput: "inspect available sessions",
    parentTask: "explicit allowlist should accept namespaced prompt references",
    allowedToolNames: ["tiinex.ai-vscode-tools/listAgentSessions"],
    blockedToolNames: []
  });

  assert(
    JSON.stringify(explicitPromptReferenceTools.map((tool) => tool.name)) === JSON.stringify(["list_agent_sessions"]),
    `Traceable subagent tool selection must let explicit namespaced prompt aliases resolve to host runtime tool names. Got: ${JSON.stringify(explicitPromptReferenceTools)}`
  );

  const inheritedDependencySurface = traceableSubagent.selectTraceableSubagentTools([
    { name: "read/readFile", description: "file read" },
    { name: "search/textSearch", description: "text search" },
    { name: "search/fileSearch", description: "file search" },
    { name: "search/listDirectory", description: "directory listing" },
    { name: "search/codebase", description: "broader search" },
    { name: "create_live_agent_chat", description: "mutation" }
  ], {
    userInput: "inspect two workspace roots",
    parentTask: "use the inherited child-lane dependency surface",
    blockedToolNames: [],
    defaultAllowedToolNames: [
      "read/readFile",
      "search/textSearch",
      "search/fileSearch",
      "search/listDirectory",
      "search/missingTool"
    ]
  });

  const inheritedDependencyToolNames = inheritedDependencySurface.map((tool) => tool.name);
  assert(
    JSON.stringify(inheritedDependencyToolNames) === JSON.stringify([
      "read/readFile",
      "search/textSearch",
      "search/fileSearch",
      "search/listDirectory"
    ]),
    `Traceable subagent inherited tool selection must keep the concrete read/search dependency surface and ignore unavailable declarations. Got: ${JSON.stringify(inheritedDependencyToolNames)}`
  );

  const inheritedCopilotDependencySurface = traceableSubagent.selectTraceableSubagentTools([
    { name: "copilot_readFile", description: "file read" },
    { name: "copilot_findTextInFiles", description: "text search" },
    { name: "copilot_findFiles", description: "file search" },
    { name: "copilot_listDirectory", description: "directory listing" },
    { name: "create_live_agent_chat", description: "mutation" }
  ], {
    userInput: "inspect the workspace",
    parentTask: "use legacy inherited aliases against the current copilot runtime tool names",
    blockedToolNames: [],
    defaultAllowedToolNames: [
      "read/readFile",
      "search/textSearch",
      "search/fileSearch",
      "search/listDirectory"
    ]
  });

  assert(
    JSON.stringify(inheritedCopilotDependencySurface.map((tool) => tool.name)) === JSON.stringify([
      "copilot_readFile",
      "copilot_findTextInFiles",
      "copilot_findFiles",
      "copilot_listDirectory"
    ]),
    `Traceable subagent inherited tool selection must let legacy read/search aliases resolve to the current copilot runtime tool names. Got: ${JSON.stringify(inheritedCopilotDependencySurface)}`
  );

  const explicitNarrowingSelectedTools = traceableSubagent.selectTraceableSubagentTools([
    { name: "read/readFile", description: "file read" },
    { name: "search/textSearch", description: "search" }
  ], {
    userInput: "inspect a file",
    parentTask: "explicit allowlist narrows inherited role tools",
    allowedToolNames: ["search/textSearch"],
    blockedToolNames: [],
    defaultAllowedToolNames: ["read/readFile", "search/textSearch"]
  });

  assert(
    explicitNarrowingSelectedTools.length === 1 && explicitNarrowingSelectedTools[0]?.name === "search/textSearch",
    `Traceable subagent tool selection must let an explicit caller allowlist narrow inherited role tools. Got: ${JSON.stringify(explicitNarrowingSelectedTools)}`
  );

  const explicitNoExpansionSelectedTools = traceableSubagent.selectTraceableSubagentTools([
    { name: "read/readFile", description: "file read" },
    { name: "search/textSearch", description: "search" }
  ], {
    userInput: "inspect a file",
    parentTask: "explicit allowlist cannot expand inherited role tools",
    allowedToolNames: ["search/textSearch"],
    blockedToolNames: [],
    defaultAllowedToolNames: ["read/readFile"]
  });

  assert(
    explicitNoExpansionSelectedTools.length === 0,
    `Traceable subagent tool selection must not let an explicit caller allowlist expand inherited role tools. Got: ${JSON.stringify(explicitNoExpansionSelectedTools)}`
  );

  const defaultSelectors = traceableSubagent.buildTraceableSubagentModelSelectors({});
  assert(
    defaultSelectors.length === 0,
    "Traceable subagent model selection must fail closed when no exact model selector is provided."
  );

  const explicitSelectors = traceableSubagent.buildTraceableSubagentModelSelectors({
    modelSelector: {
      vendor: "openai",
      family: "gpt-5",
      id: "gpt-5.4"
    }
  });
  assert(
    explicitSelectors.length === 1 && explicitSelectors[0]?.vendor === "openai" && explicitSelectors[0]?.family === "gpt-5" && explicitSelectors[0]?.id === "gpt-5.4",
    "Traceable subagent model selection must preserve an explicit caller-provided exact model selector without adding fallback selectors."
  );

  vscode.workspace.workspaceFolders = [{ uri: { fsPath: packageRoot } }];

  const promptSections = traceableSubagent.buildTraceableSubagentPromptSections({
    userInput: "original wording",
    parentTask: "inspect the controlling code path",
    inputMode: "NON_LEADING_EPISTEMIC",
    validationMode: "WARN",
    parentExpectations: {
      expectedSteps: ["search", "read"],
      disallowStrongConclusionWithoutEvidence: true
    },
    carriedContext: {
      fileContext: ["src/traceableSubagent.ts"]
    },
    wrapperPolicy: {
      name: "tiinex-traceable-subagent-v1",
      closureMode: "bounded-summary"
    }
  }, ["list_agent_sessions", "search/textSearch"]);

  assert(
    promptSections.requestEnvelope.userInput === "original wording",
    "Traceable subagent request envelope must keep userInput as a first-class field."
  );
  assert(
    promptSections.requestEnvelope.parentFrame === "inspect the controlling code path",
    "Traceable subagent request envelope must keep parentFrame separate from userInput."
  );
  assert(
    promptSections.requestEnvelope.inputMode === "NON_LEADING_EPISTEMIC",
    "Traceable subagent request envelope must preserve the declared input mode as first-class metadata."
  );
  assert(
    promptSections.requestEnvelope.validationMode === "WARN",
    "Traceable subagent request envelope must preserve the declared validation mode as first-class metadata."
  );
  assert(
    promptSections.promptTexts.some((section) => section.includes('"userInput": "original wording"')),
    "Traceable subagent prompt sections must expose userInput explicitly."
  );
  assert(
    promptSections.promptTexts.some((section) => section.includes('"parentFrame": "inspect the controlling code path"')),
    "Traceable subagent prompt sections must expose parentFrame explicitly."
  );
  assert(
    promptSections.promptTexts.some((section) => section.includes('"inputMode": "NON_LEADING_EPISTEMIC"')),
    "Traceable subagent prompt sections must expose the declared input mode explicitly."
  );
  assert(
    promptSections.promptTexts.some((section) => section.includes('"validationMode": "WARN"')),
    "Traceable subagent prompt sections must expose the declared validation mode explicitly."
  );
  assert(
    promptSections.promptTexts.some((section) => section.includes('Declared validation mode for this run: WARN. The runtime may warn or stop on input-mode mismatches, but it must not rewrite or filter the original userInput or parentFrame text.')),
    "Traceable subagent prompt sections must describe validation mode as declarative framing rather than hidden rewriting."
  );
  assert(
    promptSections.promptTexts.some((section) => section.toLowerCase().includes(JSON.stringify(path.resolve(packageRoot, "src", "traceableSubagent.ts")).slice(1, -1).toLowerCase())),
    `Traceable subagent prompt sections must surface resolved absolute file anchors for carried file context. Got: ${JSON.stringify(promptSections.promptTexts)}`
  );
  assert(
    promptSections.promptTexts.some((section) => section.includes("Task file anchor rule:")),
    "Traceable subagent prompt sections must tell the child lane to prefer task file anchors over nearby role-artifact files when they exist."
  );
  assert(
    promptSections.promptTexts.some((section) => section.includes("Do not call native runSubagent from inside this lane.")),
    "Traceable subagent prompt sections must explicitly block native runSubagent from inside the lane."
  );

  const multiFilePromptSections = traceableSubagent.buildTraceableSubagentPromptSections({
    userInput: "compare the anchored files",
    parentTask: "inspect the requested files without drifting into unrelated sources",
    carriedContext: {
      fileContext: ["src/traceableSubagent.ts", "tests/test.mjs", "package.json"]
    }
  }, ["copilot_readFile"]);

  assert(
    multiFilePromptSections.promptTexts.some((section) => section.includes("cover each anchored file at least once before drilling deeper into one file"))
      && multiFilePromptSections.promptTexts.some((section) => section.includes("Do not spend a second top-of-file read on one anchored file while another anchored file remains unread"))
      && multiFilePromptSections.promptTexts.some((section) => section.includes("stop broad rereads and emit the best partial or unresolved JSON object you can from the evidence already gathered")),
    `Traceable subagent prompt sections must tell the child lane how to spend read budget across multiple anchored files. Got: ${JSON.stringify(multiFilePromptSections.promptTexts)}`
  );

  const followUpPromptSections = traceableSubagent.buildTraceableSubagentPromptSections({
    userInput: "answer the narrower follow-up",
    parentTask: "refine the earlier finding with one bounded follow-up judgment",
    carriedContext: {
      priorTurnsSummary: "Earlier run found the controlling guard in src/traceableSubagent.ts and stopped after a bounded read-only pass.",
      fileContext: ["src/traceableSubagent.ts"]
    }
  }, ["copilot_readFile"]);

  assert(
    followUpPromptSections.promptTexts.some((section) => section.includes("Prior turns summary for this run:"))
      && followUpPromptSections.promptTexts.some((section) => section.includes("Follow-up rule:"))
      && followUpPromptSections.promptTexts.some((section) => section.includes("answer that question directly rather than re-solving the whole previous frame"))
      && followUpPromptSections.promptTexts.some((section) => section.includes("start from that finding and only reread the minimum source needed"))
      && followUpPromptSections.promptTexts.some((section) => section.includes("Do not restart from the top of a large file")),
    `Traceable subagent prompt sections must surface carried prior-turn context and explicit follow-up discipline. Got: ${JSON.stringify(followUpPromptSections.promptTexts)}`
  );

  const parsedPayload = traceableSubagent.extractTraceableSubagentPayload('```json\n{"steps":[],"expectedButMissing":[],"stopReason":"completed","completionClaim":"partial","finalSummary":"ok"}\n```');

  assert(
    parsedPayload?.stopReason === "completed" && parsedPayload?.completionClaim === "partial",
    "Traceable subagent payload extraction must parse fenced JSON child output."
  );

  const parsedPayloadWithTrailingText = traceableSubagent.extractTraceableSubagentPayload(
    '{"steps":[],"expectedButMissing":[],"stopReason":"completed","completionClaim":"complete","finalSummary":"ok"}\n\nI will now read more.\n\n{"filePath":"c:\\\\repo\\\\src\\\\traceableSubagent.ts","startLine":1,"endLine":200}'
  );

  assert(
    parsedPayloadWithTrailingText?.stopReason === "completed"
      && parsedPayloadWithTrailingText?.completionClaim === "complete"
      && parsedPayloadWithTrailingText?.finalSummary === "ok",
    "Traceable subagent payload extraction must recover the first balanced JSON object when extra trailing text or filePath blocks follow it."
  );

  const parsedPayloadWithShapeDrift = traceableSubagent.extractTraceableSubagentPayload(`{
    "steps": [
      "Read extension.ts to inspect activation wiring.",
      "Read languageModelTools.ts to inspect tool registration wiring."
    ],
    "expectedButMissing": [
      "src/traceableSubagentStatusBar.ts: controller implementation was not gathered."
    ],
    "stopReason": "insufficient_grounding",
    "completionClaim": "partial_evidence_only",
    "finalSummary": "Grounded partial evidence only."
  }`);

  assert(
    parsedPayloadWithShapeDrift?.completionClaim === "partial"
      && parsedPayloadWithShapeDrift?.steps.length === 2
      && parsedPayloadWithShapeDrift?.expectedButMissing.length === 1
      && parsedPayloadWithShapeDrift?.expectedButMissing[0]?.label.includes("src/traceableSubagentStatusBar.ts"),
    `Traceable subagent payload extraction must tolerate the live child-shape drift seen in host runs. Got: ${JSON.stringify(parsedPayloadWithShapeDrift)}`
  );

  const parsedPayloadWithCustomCompletionClaim = traceableSubagent.extractTraceableSubagentPayload(`{
    "steps": [
      "Read extension.ts activation wiring.",
      "Read languageModelTools.ts declaration wiring."
    ],
    "expectedButMissing": [
      "src/traceableSubagent.ts runtime hook body was not gathered."
    ],
    "stopReason": "insufficient_grounding",
    "completionClaim": "activation_and_tool_declaration_observed_but_runtime_hooks_not_verified",
    "finalSummary": "Grounded partial evidence only."
  }`);

  assert(
    parsedPayloadWithCustomCompletionClaim?.completionClaim === "unresolved"
      && parsedPayloadWithCustomCompletionClaim?.stopReason === "insufficient_grounding"
      && parsedPayloadWithCustomCompletionClaim?.steps.length === 2,
    `Traceable subagent payload extraction must not discard an otherwise valid payload just because the child emitted a drifted completionClaim string. Got: ${JSON.stringify(parsedPayloadWithCustomCompletionClaim)}`
  );

  const parsedPayloadWithNaturalLanguageOutcome = traceableSubagent.extractTraceableSubagentPayload(`{
    "steps": [
      "Read c:\\\\Users\\\\micro\\\\Documents\\\\Repos\\\\Tiinex\\\\ai-vscode-tools\\\\src\\\\traceableSubagentStatusPanel.ts",
      "Verified request-row rendering behavior"
    ],
    "expectedButMissing": [],
    "stopReason": "Completed: target file inspected; bounded summary produced.",
    "completionClaim": "Confirmed from the file: the task item is rendered as the request-row note and not as a request badge.",
    "finalSummary": "Task text is rendered as the primary request-row note, not as a badge."
  }`);

  assert(
    parsedPayloadWithNaturalLanguageOutcome?.stopReason === "completed"
      && parsedPayloadWithNaturalLanguageOutcome?.completionClaim === "complete"
      && parsedPayloadWithNaturalLanguageOutcome?.steps.length === 2,
    `Traceable subagent payload extraction must tolerate natural-language stopReason/completionClaim drift from live child output. Got: ${JSON.stringify(parsedPayloadWithNaturalLanguageOutcome)}`
  );

  const parsedPayloadWithSucceededCompletionClaim = traceableSubagent.extractTraceableSubagentPayload(`{
    "steps": [
      "Read target file",
      "Returned bounded summary"
    ],
    "expectedButMissing": [],
    "stopReason": "completed",
    "completionClaim": "succeeded",
    "finalSummary": "Grounded summary returned successfully."
  }`);

  assert(
    parsedPayloadWithSucceededCompletionClaim?.stopReason === "completed"
      && parsedPayloadWithSucceededCompletionClaim?.completionClaim === "complete"
      && parsedPayloadWithSucceededCompletionClaim?.steps.length === 2,
    `Traceable subagent payload extraction must treat success-style completion claims as complete. Got: ${JSON.stringify(parsedPayloadWithSucceededCompletionClaim)}`
  );

  const parsedPayloadWithUnderscoredCompletedStopReason = traceableSubagent.extractTraceableSubagentPayload(`{
    "steps": [
      "Read target file",
      "Returned bounded summary"
    ],
    "expectedButMissing": [],
    "stopReason": "completed_read_and_analysis",
    "completionClaim": "success",
    "finalSummary": "Grounded summary returned successfully."
  }`);

  assert(
    parsedPayloadWithUnderscoredCompletedStopReason?.stopReason === "completed"
      && parsedPayloadWithUnderscoredCompletedStopReason?.completionClaim === "complete"
      && parsedPayloadWithUnderscoredCompletedStopReason?.steps.length === 2,
    `Traceable subagent payload extraction must treat underscore-separated completed stop reasons as completed. Got: ${JSON.stringify(parsedPayloadWithUnderscoredCompletedStopReason)}`
  );

  const parsedPayloadWithBoundedReadCompleteStopReason = traceableSubagent.extractTraceableSubagentPayload(`{
    "steps": [
      "Read target file",
      "Covered request-row rendering path"
    ],
    "expectedButMissing": [],
    "stopReason": "bounded-read-complete: request-row rendering path fully covered in target file.",
    "completionClaim": "I inspected the target file and confirmed the task item is rendered as the request row's primary event-note.",
    "finalSummary": "Request-row rendering path fully covered and summarized."
  }`);

  assert(
    parsedPayloadWithBoundedReadCompleteStopReason?.stopReason === "completed"
      && parsedPayloadWithBoundedReadCompleteStopReason?.completionClaim === "complete"
      && parsedPayloadWithBoundedReadCompleteStopReason?.steps.length === 2,
    `Traceable subagent payload extraction must treat bounded-read-complete stop reasons as completed. Got: ${JSON.stringify(parsedPayloadWithBoundedReadCompleteStopReason)}`
  );

  const parsedPayloadWithCompletionLedStopReasonRecovery = traceableSubagent.extractTraceableSubagentPayload(`{
    "steps": [
      "Read c:\\\\Users\\\\micro\\\\Documents\\\\Repos\\\\Tiinex\\\\ai-vscode-tools\\\\src\\\\traceableSubagentStatusPanel.ts (lines 1-400).",
      "Inspected splitRequestSummary, renderRequestSummaryBadge, renderRequestSummaryChips, and renderRequestActivity to verify the request-row rendering path."
    ],
    "expectedButMissing": [
      "Runtime verification of the TRACEABLE panel reveal on the host (UI open) — not executed in this read-only probe."
    ],
    "stopReason": "Sufficient static evidence from file read; live UI/runtime checks were out of scope for this read-only run.",
    "completionClaim": "Static analysis complete: the task value is rendered as the primary note in the request row, not as a request badge.",
    "finalSummary": "The task value is rendered as the primary request-row note, while metadata items render as badges."
  }`);

  assert(
    parsedPayloadWithCompletionLedStopReasonRecovery?.stopReason === "completed"
      && parsedPayloadWithCompletionLedStopReasonRecovery?.completionClaim === "complete"
      && parsedPayloadWithCompletionLedStopReasonRecovery?.steps.length === 2,
    `Traceable subagent payload extraction must recover completed payloads when stopReason drifts but the completionClaim is clearly complete. Got: ${JSON.stringify(parsedPayloadWithCompletionLedStopReasonRecovery)}`
  );

  const markdown = traceableSubagent.renderTraceableSubagentMarkdown({
    request: {
      userInput: "original wording",
      parentTask: "inspect the controlling code path",
      notes: "x".repeat(2500),
      exportToFolder: "/tmp/evidence"
    },
    model: {
      vendor: "copilot",
      family: "gpt-5",
      id: "gpt-5-mini",
      version: "test"
    },
    allowedToolNames: ["list_agent_sessions", "search/textSearch"],
    toolCalls: [
      {
        callId: "call-0",
        toolName: "copilot_readFile",
        argsSummary: JSON.stringify({ filePath: "c:\\repo\\src\\traceableSubagent.ts", startLine: 1, endLine: 120 }),
        result: "success"
      },
      {
        callId: "call-1",
        toolName: "search/textSearch",
        argsSummary: "{}",
        result: "success"
      }
    ],
    traceStatus: "trace-incomplete",
    steps: [
      {
        id: "step-1",
        intent: "Inspect the controlling code path",
        status: "completed",
        note: "Observed the bounded trace surface."
      }
    ],
    expectedButMissing: [
      {
        kind: "step",
        label: "Read exact file slice",
        reason: "The child stopped after a bounded partial pass."
      }
    ],
    stopReason: "completed",
    completionClaim: "partial",
    finalSummary: "ok; export folder: /tmp/evidence",
    opaqueDelegations: [],
    usage: {
      provenance: "unavailable",
      note: "No token usage surfaced on the current VS Code language model response."
    },
    iterationMetrics: [
      {
        iteration: 0,
        isFinalRecoveryIteration: false,
        elapsedMs: 9500,
        assistantTextLength: 20,
        toolCallCount: 2,
        requestedToolCallCount: 2,
        executedToolCallCount: 2,
        deferredToolCallCount: 0,
        remainingToolCalls: 4,
        usage: {
          provenance: "unavailable",
          note: "No token usage surfaced on the current VS Code language model response."
        }
      }
    ],
    rawModelText: "{\"finalSummary\":\"ok\"}",
    debugLogPath: "/tmp/traceable-subagent-debug.jsonl",
    evidenceFile: {
      status: "ready",
      filePath: "/tmp/evidence/01-anchor.trace.md",
      fileName: "01-anchor.trace.md",
      requestedBy: "tool-input",
      outputMode: "summary-with-evidence-path"
    },
    elapsedMs: 9500
  }, {
    mode: "relative-markdown",
    baseDir: "/tmp/evidence"
  });

  assert(
    markdown.includes("# Traceable Subagent Result"),
    "Traceable subagent markdown renderer must emit the result heading."
  );
  assert(
    markdown.includes("## At a Glance"),
    "Traceable subagent markdown renderer must surface a compact at-a-glance section before the longer outcome details."
  );
  assert(
    markdown.includes("## Quick Read")
      && markdown.includes("Read: traceableSubagent.ts")
      && markdown.includes("Took: 9.5s")
      && markdown.includes("Usage: No token usage surfaced on the current VS Code language model response.")
      && markdown.includes("Missing: Read exact file slice: The child stopped after a bounded partial pass."),
    "Traceable subagent markdown renderer must surface a short semantic quick-read section near the top of the result."
  );
  assert(
    markdown.includes("Concluded: ok; export folder: [evidence](../evidence)"),
    "Traceable subagent markdown renderer must rewrite known absolute path mentions inside the quick-read conclusion using the active path render policy."
  );
  assert(
    markdown.indexOf("## Quick Read") < markdown.indexOf("## At a Glance"),
    "Traceable subagent markdown renderer must prioritize the semantic quick-read block ahead of numeric at-a-glance counts."
  );
  assert(
    markdown.includes("Completed Steps: 1/1")
      && markdown.includes("Successful Tool Calls: 2/2")
      && markdown.includes("Iterations: 1")
      && markdown.includes("Elapsed: 9.5s")
      && markdown.includes("Observed Read Targets: 1 unique")
      && markdown.includes("Outstanding Gaps: 1")
      && markdown.includes("Opaque Delegations: 0"),
    "Traceable subagent markdown renderer must expose compact counts for completed steps, successful tool calls, elapsed time, observed read targets, remaining gaps, and opaque delegations."
  );
  assert(
    markdown.includes("Final Summary: ok; export folder: [evidence](../evidence)"),
    "Traceable subagent markdown renderer must rewrite known absolute path mentions inside free-text summaries using the active path render policy."
  );

  const unresolvedMarkdown = traceableSubagent.renderTraceableSubagentMarkdown({
    request: {},
    model: null,
    allowedToolNames: ["copilot_readFile"],
    toolCalls: [
      {
        callId: "call-1",
        toolName: "copilot_readFile",
        argsSummary: "{}",
        result: "success"
      }
    ],
    traceStatus: "trace-incomplete",
    steps: [],
    expectedButMissing: [],
    stopReason: "budget_exhausted",
    completionClaim: "partial",
    finalSummary: "Traceable subagent iteration budget was exhausted before the child produced a final trace payload.",
    opaqueDelegations: [],
    debugLogPath: "/tmp/traceable-subagent-debug.jsonl"
  });

  assert(
    unresolvedMarkdown.includes("Completed Steps: - (no final child steps captured)"),
    "Traceable subagent markdown renderer must avoid implying a meaningful 0/0 completed-step status when no final child steps were captured."
  );
  assert(
    markdown.includes("## Outcome"),
    "Traceable subagent markdown renderer must lead with an outcome section rather than raw JSON only."
  );
  assert(
    markdown.includes("## Observed Scope")
      && markdown.includes("traceableSubagent.ts"),
    "Traceable subagent markdown renderer must surface the concrete observed read scope near the top of the result."
  );
  assert(
    markdown.includes("## Recent Steps"),
    "Traceable subagent markdown renderer must surface recent steps in a readable section."
  );
  assert(
    markdown.includes("## Tool Activity"),
    "Traceable subagent markdown renderer must surface tool activity in a readable section."
  );
  assert(
    markdown.includes("## Expected But Missing"),
    "Traceable subagent markdown renderer must surface expected-but-missing items as a readable section."
  );
  assert(
    markdown.includes("Read exact file slice: The child stopped after a bounded partial pass."),
    "Traceable subagent markdown renderer must surface expected-but-missing details outside raw JSON only."
  );
  assert(
    markdown.includes("## Technical Details"),
    "Traceable subagent markdown renderer must keep the full technical trace available after the readable summary sections."
  );
  assert(
    markdown.includes("### Usage Summary") && markdown.includes('"provenance": "unavailable"'),
    "Traceable subagent markdown renderer must preserve usage provenance in technical details even when exact token usage is unavailable."
  );
  assert(
    markdown.includes("### Iteration Metrics Preview") && markdown.includes('"elapsedMs": 9500'),
    "Traceable subagent markdown renderer must preserve per-iteration timing in technical details."
  );
  assert(
    markdown.includes("### Request Contract Preview"),
    "Traceable subagent markdown renderer must label technical request details as a bounded preview for chat readability."
  );
  assert(
    markdown.includes("[truncated]"),
    "Traceable subagent markdown renderer must bound oversized technical JSON blocks instead of emitting one giant blob."
  );
  assert(
    markdown.includes("[traceable-subagent-debug.jsonl](../traceable-subagent-debug.jsonl)")
      && markdown.includes("ready | [01-anchor.trace.md](01-anchor.trace.md)"),
    "Traceable subagent markdown renderer must preserve parent-directory relative markdown links when a relative evidence render base is provided."
  );

  const evidenceTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "traceable-evidence-"));
  try {
    const evidenceController = new traceableSubagentEvidence.TraceableSubagentEvidenceController({
      header: {
        agentName: "Trace lane",
        agentFilePath: "",
        agentResolved: false,
        modelLabel: "GPT-5 mini",
        candidate: false,
        experimental: false,
        humanRole: false,
        toolsetNames: [],
        selectedToolNames: [],
        toolSelectionRestricted: false
      },
      status: {
        phase: "running",
        message: "requesting analysis",
        detail: "bounded ok"
      },
      evidenceFile: { status: "idle" },
      requestSummary: [],
      statusHistory: [],
      recentTools: [
        {
          callId: "call-export-1",
          toolName: "copilot_readFile",
          phase: "success",
          input: {
            filePath: path.join(packageRoot, "src", "traceableSubagentStatusBar.ts"),
            startLine: 1,
            endLine: 120
          },
          occurredAt: "2026-05-21T01:20:50.000Z"
        }
      ],
      startedAt: "2026-05-21T01:20:25.634Z",
      updatedAt: "2026-05-21T01:21:12.235Z"
    });
    await evidenceController.prepareRequestedExport({
      outputMode: "summary-with-evidence-path",
      exportToFolder: evidenceTempDir,
      userInput: "Return the exact JSON final payload only."
    });
    const exportedResult = await evidenceController.finalizeRequestedExport({
      request: { exportToFolder: evidenceTempDir },
      outputMode: "summary-with-evidence-path",
      model: {
        vendor: "copilot",
        family: "gpt-5-mini",
        id: "gpt-5-mini",
        version: "test"
      },
      allowedToolNames: [],
      toolCalls: [],
      traceStatus: "trace-supported",
      steps: [],
      expectedButMissing: [],
      stopReason: "completed",
      completionClaim: "complete",
      finalSummary: "ok",
      validationIssues: [],
      opaqueDelegations: [],
      debugLogPath: "/tmp/traceable-subagent-debug.jsonl",
      elapsedMs: 1000
    }, traceableSubagent.renderTraceableSubagentMarkdown({
      request: { exportToFolder: evidenceTempDir },
      outputMode: "summary-with-evidence-path",
      model: {
        vendor: "copilot",
        family: "gpt-5-mini",
        id: "gpt-5-mini",
        version: "test"
      },
      allowedToolNames: [],
      toolCalls: [],
      traceStatus: "trace-supported",
      steps: [],
      expectedButMissing: [],
      stopReason: "completed",
      completionClaim: "complete",
      finalSummary: "ok",
      validationIssues: [],
      opaqueDelegations: [],
      debugLogPath: "/tmp/traceable-subagent-debug.jsonl",
      elapsedMs: 1000
    }));
    const exportedEvidenceMarkdown = await fs.readFile(exportedResult.evidenceFile.filePath, "utf8");
    assert(
      !exportedEvidenceMarkdown.includes("Debug Log:"),
      `Traceable evidence export must omit debug log support artifacts so the evidence file does not imply they are part of rehydratable state. Got: ${exportedEvidenceMarkdown}`
    );
    assert(
      exportedEvidenceMarkdown.includes("# GPT-5 mini Evidence")
        && exportedEvidenceMarkdown.includes("- Role: -")
        && !exportedEvidenceMarkdown.includes("# Trace lane Evidence"),
      `Traceable evidence export must not present the generic trace lane label as if it were a real role name. Got: ${exportedEvidenceMarkdown}`
    );
    assert(
      exportedResult.evidenceFile.fileName === "01-gpt-5-mini.trace.md"
        && !exportedResult.evidenceFile.fileName.includes("trace-lane"),
      `Traceable evidence export must not keep the fake trace-lane slug in future filenames when only the generic lane header is present. Got: ${exportedResult.evidenceFile.fileName}`
    );
    assert(
      exportedEvidenceMarkdown.includes("## Traceable State")
        && exportedEvidenceMarkdown.includes('"schema": "tiinex.traceable-state.v1"')
        && exportedEvidenceMarkdown.includes('"snapshot"')
        && exportedEvidenceMarkdown.includes('"result"'),
      `Traceable evidence export must include a machine-readable traceable-state block for future view rehydration. Got: ${exportedEvidenceMarkdown}`
    );
    const parsedEvidenceState = traceableSubagentEvidence.parseTraceableEvidenceStateMarkdown(exportedEvidenceMarkdown);
    assert(
      parsedEvidenceState?.snapshot?.header?.modelLabel === "GPT-5 mini"
        && parsedEvidenceState?.snapshot?.evidenceFile?.fileName?.endsWith(".trace.md")
        && parsedEvidenceState?.result?.completionClaim === "complete"
        && parsedEvidenceState?.snapshot?.recentTools?.length === 1
        && parsedEvidenceState?.snapshot?.recentTools?.[0]?.callId === "call-export-1",
      `Traceable evidence export must be parseable back into a reusable traceable state snapshot and result. Got: ${JSON.stringify(parsedEvidenceState)}`
    );
    const expectedSiblingRepoRelativePath = path.relative(
      path.dirname(exportedResult.evidenceFile.filePath),
      path.join(packageRoot, "src", "traceableSubagentStatusBar.ts")
    ).replace(/\\/g, "/");
    assert(
      exportedEvidenceMarkdown.includes(`[traceableSubagentStatusBar.ts](${expectedSiblingRepoRelativePath})`),
      `Traceable evidence export must preserve relative markdown links for sibling-repo paths instead of forcing absolute file URIs. Got: ${exportedEvidenceMarkdown}`
    );
    evidenceController.updateSnapshot({
      header: {
        agentName: "Trace lane",
        agentFilePath: "",
        agentResolved: false,
        modelLabel: "GPT-5 mini",
        candidate: false,
        experimental: false,
        humanRole: false,
        toolsetNames: [],
        selectedToolNames: [],
        toolSelectionRestricted: false
      },
      status: {
        phase: "running",
        message: "starting"
      },
      evidenceFile: { status: "idle" },
      requestSummary: [],
      statusHistory: [],
      recentTools: [],
      startedAt: "2026-05-21T01:30:00.000Z",
      updatedAt: "2026-05-21T01:30:01.000Z"
    });
    const preservedEvidenceMarkdown = await fs.readFile(exportedResult.evidenceFile.filePath, "utf8");
    const preservedEvidenceState = traceableSubagentEvidence.parseTraceableEvidenceStateMarkdown(preservedEvidenceMarkdown);
    assert(
      preservedEvidenceState?.snapshot?.startedAt === "2026-05-21T01:20:25.634Z"
        && preservedEvidenceState?.snapshot?.recentTools?.length === 1
        && preservedEvidenceState?.snapshot?.recentTools?.[0]?.callId === "call-export-1"
        && evidenceController.getSnapshot().evidenceFile?.status === "idle",
      `Traceable evidence export must stay bound to the run that created it instead of being overwritten by later live snapshots. Got snapshot=${JSON.stringify(preservedEvidenceState?.snapshot)} current=${JSON.stringify(evidenceController.getSnapshot())}`
    );

    const viewEvidenceFilePath = path.join(evidenceTempDir, "02-view-summary.trace.md");
    await fs.writeFile(viewEvidenceFilePath, [
      "# View Summary Evidence",
      "",
      "## Traceable State",
      "```json",
      JSON.stringify({
        schema: traceableSubagentEvidence.TRACEABLE_EVIDENCE_STATE_SCHEMA,
        snapshot: {
          ...parsedEvidenceState.snapshot,
          status: {
            phase: "completed",
            message: "completed"
          },
          statusHistory: [
            {
              id: "status-1",
              phase: "running",
              message: "starting",
              occurredAt: "2026-05-21T01:20:25.634Z"
            },
            {
              id: "status-2",
              phase: "running",
              message: "reading 1/2",
              occurredAt: "2026-05-21T01:20:40.000Z"
            },
            {
              id: "status-3",
              phase: "completed",
              message: "completed",
              occurredAt: "2026-05-21T01:21:12.235Z"
            }
          ]
        },
        result: {
          ...parsedEvidenceState.result,
          toolCalls: [
            {
              callId: "call-1",
              toolName: "copilot_readFile",
              argsSummary: JSON.stringify({
                filePath: path.join(packageRoot, "src", "traceableSubagent.ts"),
                startLine: 1,
                endLine: 120
              }),
              result: "success",
              note: "Read the main runtime entry."
            },
            {
              callId: "call-2",
              toolName: "search/textSearch",
              argsSummary: JSON.stringify({
                query: "Traceable State"
              }),
              result: "failure",
              note: "No exact match in the first pass."
            },
            {
              callId: "call-3",
              toolName: "copilot_readFile",
              argsSummary: JSON.stringify({
                filePath: path.join(packageRoot, "src", "languageModelTools.ts"),
                startLine: 1600,
                endLine: 1800
              }),
              result: "success",
              note: "Read the traceable view renderer."
            }
          ]
        }
      }, null, 2),
      "```",
      ""
    ].join("\n"), "utf8");

    const registeredTools = new Map();
    vscode.lm.registerTool = (name, tool) => {
      registeredTools.set(name, tool);
      return { dispose() {} };
    };
    const fakeContext = {
      subscriptions: [],
      storageUri: {
        fsPath: path.join(evidenceTempDir, "workspaceStorage")
      },
      globalStorageUri: {
        fsPath: path.join(evidenceTempDir, "globalStorage")
      }
    };
    const fakeAdapter = new Proxy({}, { get: () => async () => "" });
    const fakeChatInterop = new Proxy({}, { get: () => async () => ({}) });
    languageModelToolsModule.registerLanguageModelTools(fakeContext, fakeAdapter, fakeChatInterop);

    const viewTraceableTool = registeredTools.get("view_traceable_subagent");
    assert(
      viewTraceableTool && typeof viewTraceableTool.invoke === "function",
      "Traceable view regression test could not capture the view_traceable_subagent tool registration."
    );

    const toolSummaryResult = await viewTraceableTool.invoke({
      input: {
        evidenceFilePath: viewEvidenceFilePath,
        surface: "tool-summary",
        maxItems: 5
      },
      tokenizationOptions: {
        tokenBudget: 4000
      }
    });
    const toolSummaryMarkdown = String(toolSummaryResult.content[0]?.value ?? "");
    assert(
      toolSummaryMarkdown.includes("# Traceable Evidence Tool Summary")
        && toolSummaryMarkdown.includes("Distinct Tools: 2")
        && toolSummaryMarkdown.includes("- copilot_readFile")
        && toolSummaryMarkdown.includes("Total Calls: 2")
        && toolSummaryMarkdown.includes("- search/textSearch"),
      `view_traceable_subagent must expose an aggregated tool-summary surface for parent-agent recovery reads. Got: ${toolSummaryMarkdown}`
    );

    const fileSummaryResult = await viewTraceableTool.invoke({
      input: {
        evidenceFilePath: viewEvidenceFilePath,
        surface: "file-summary",
        maxItems: 5
      },
      tokenizationOptions: {
        tokenBudget: 4000
      }
    });
    const fileSummaryMarkdown = String(fileSummaryResult.content[0]?.value ?? "");
    assert(
      fileSummaryMarkdown.includes("# Traceable Evidence File Summary")
        && fileSummaryMarkdown.includes("Distinct Read Targets: 2")
        && fileSummaryMarkdown.includes("traceableSubagent.ts")
        && fileSummaryMarkdown.includes("languageModelTools.ts"),
      `view_traceable_subagent must expose an aggregated file-summary surface for parent-agent recovery reads. Got: ${fileSummaryMarkdown}`
    );

    const pagedToolLedgerResult = await viewTraceableTool.invoke({
      input: {
        evidenceFilePath: viewEvidenceFilePath,
        surface: "tool-ledger",
        maxItems: 1,
        offset: 1
      },
      tokenizationOptions: {
        tokenBudget: 4000
      }
    });
    const pagedToolLedgerMarkdown = String(pagedToolLedgerResult.content[0]?.value ?? "");
    assert(
      pagedToolLedgerMarkdown.includes("# Traceable Evidence Tool Ledger")
        && pagedToolLedgerMarkdown.includes("- search/textSearch")
        && !pagedToolLedgerMarkdown.includes("- copilot_readFile\n  - Result: success\n  - Call Id: call-1")
        && pagedToolLedgerMarkdown.includes("Showing tool calls 2-2 of 3."),
      `view_traceable_subagent must support offset paging for list-like ledger surfaces. Got: ${pagedToolLedgerMarkdown}`
    );

    const pagedStatusHistoryResult = await viewTraceableTool.invoke({
      input: {
        evidenceFilePath: viewEvidenceFilePath,
        surface: "status-history",
        maxItems: 1,
        offset: 1
      },
      tokenizationOptions: {
        tokenBudget: 4000
      }
    });
    const pagedStatusHistoryMarkdown = String(pagedStatusHistoryResult.content[0]?.value ?? "");
    assert(
      pagedStatusHistoryMarkdown.includes("# Traceable Evidence Status History")
        && pagedStatusHistoryMarkdown.includes("- running | reading 1/2")
        && pagedStatusHistoryMarkdown.includes("Showing status events 2-2 of 3."),
      `view_traceable_subagent must support offset paging for status-history windows. Got: ${pagedStatusHistoryMarkdown}`
    );

    const staleSelfReadController = new traceableSubagentEvidence.TraceableSubagentEvidenceController({
      header: {
        agentName: "Trace lane",
        agentFilePath: "",
        agentResolved: false,
        modelLabel: "GPT-5 mini",
        candidate: false,
        experimental: false,
        humanRole: false,
        toolsetNames: [],
        selectedToolNames: [],
        toolSelectionRestricted: false
      },
      status: { phase: "running", message: "requesting analysis" },
      evidenceFile: { status: "idle" },
      requestSummary: [],
      statusHistory: [],
      recentTools: [],
      startedAt: "2026-05-21T02:05:34.559Z",
      updatedAt: "2026-05-21T02:06:00.747Z"
    });
    await staleSelfReadController.prepareRequestedExport({
      outputMode: "summary-with-evidence-path",
      exportToFolder: evidenceTempDir
    });
    const staleSelfReadResult = await staleSelfReadController.finalizeRequestedExport({
      request: {},
      outputMode: "summary-with-evidence-path",
      model: {
        vendor: "copilot",
        family: "gpt-5-mini",
        id: "gpt-5-mini",
        version: "test"
      },
      allowedToolNames: [],
      toolCalls: [],
      iterationMetrics: [],
      traceStatus: "trace-supported",
      steps: [],
      expectedButMissing: [
        {
          kind: "step",
          label: "Finalized run output (Final Output shows: _Pending final result._)",
          reason: "Reported by the child lane while it was still reading its own writing-state evidence file."
        }
      ],
      stopReason: "completed",
      completionClaim: "partial",
      finalSummary: "Self-read captured evidenceFile.status == \"writing\" before finalization.",
      validationIssues: [],
      opaqueDelegations: [],
      elapsedMs: 1000,
      evidenceFile: {
        status: "writing"
      }
    }, [
      "# Traceable Subagent Result",
      "",
      "## Outcome",
      "",
      "- Final Summary: Self-read captured evidenceFile.status == \"writing\" before finalization.",
      "- Missing: Final Output shows: _Pending final result._"
    ].join("\n"));
    const staleSelfReadMarkdown = await fs.readFile(staleSelfReadResult.evidenceFile.filePath, "utf8");
    assert(
      staleSelfReadMarkdown.includes("this lane inspected its own evidence file while it was still being written")
        && staleSelfReadMarkdown.includes("The authoritative artifact state")
        && staleSelfReadMarkdown.includes("Export Status: ready"),
      `Traceable evidence export must reconcile stale self-read writing-state claims once the final artifact is ready. Got: ${staleSelfReadMarkdown}`
    );
  } finally {
    await fs.rm(evidenceTempDir, { recursive: true, force: true });
  }

  const originalWorkspace = vscode.workspace;
  const originalWorkspaceFolders = originalWorkspace?.workspaceFolders;
  const originalGetConfiguration = originalWorkspace?.getConfiguration;
  const originalLm = vscode.lm;
  const originalToolMode = vscode.LanguageModelChatToolMode;
  const originalTextPart = vscode.LanguageModelTextPart;
  const originalToolCallPart = vscode.LanguageModelToolCallPart;
  const originalToolResultPart = vscode.LanguageModelToolResultPart;
  const originalDataPart = vscode.LanguageModelDataPart;
  const originalChatMessage = vscode.LanguageModelChatMessage;
  const tempRoots = [];
  const traceableConfig = {};

  const traceableLintRoot = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-traceable-agent-lint-"));
  tempRoots.push(traceableLintRoot);
  const traceableLintAgentsDir = path.join(traceableLintRoot, ".github", "agents");
  await fs.mkdir(traceableLintAgentsDir, { recursive: true });
  await fs.writeFile(path.join(traceableLintAgentsDir, "valid.agent.md"), [
    "---",
    "name: Valid",
    "description: Valid traceable agent.",
    "model: GPT-5 mini (copilot)",
    "---",
    "",
    "You are valid."
  ].join("\n"), "utf8");
  await fs.writeFile(path.join(traceableLintAgentsDir, "invalid.agent.md"), [
    "---",
    "name: Invalid",
    "description: Invalid traceable agent.",
    "model: GPT-5 mini (copilot)",
    "models: [GPT-5.4 mini (copilot)]",
    "---",
    "",
    "You are invalid."
  ].join("\n"), "utf8");
  vscode.workspace.workspaceFolders = [{ uri: { fsPath: traceableLintRoot }, name: "traceable-lint" }];
  const lintCatalogEntries = await traceableSubagent.listTraceableAgentCatalogEntries();
  const lintFindings = await traceableSubagent.listTraceableAgentCatalogLintFindings();
  assert(
    lintCatalogEntries.some((entry) => entry.artifactStem === "valid")
      && !lintCatalogEntries.some((entry) => entry.artifactStem === "invalid"),
    `Traceable agent catalog scan must keep valid agents while excluding invalid frontmatter artifacts from the runnable catalog. Got: ${JSON.stringify(lintCatalogEntries)}`
  );
  assert(
    lintFindings.some((finding) => finding.artifactStem === "invalid" && finding.message.includes("must not declare both model and models")),
    `Traceable agent catalog scan must surface invalid agent frontmatter as explicit lint findings instead of silently dropping the artifact. Got: ${JSON.stringify(lintFindings)}`
  );
  vscode.workspace.workspaceFolders = originalWorkspaceFolders;

  vscode.LanguageModelChatToolMode = { Auto: "auto" };
  vscode.LanguageModelTextPart = class LanguageModelTextPart {
    constructor(value) {
      this.value = value;
    }
  };
  vscode.LanguageModelToolCallPart = class LanguageModelToolCallPart {
    constructor(callId, name, input) {
      this.callId = callId;
      this.name = name;
      this.input = input;
    }
  };
  vscode.LanguageModelToolResultPart = class LanguageModelToolResultPart {
    constructor(callId, content) {
      this.callId = callId;
      this.content = content;
    }
  };
  vscode.LanguageModelDataPart = class LanguageModelDataPart {};
  vscode.LanguageModelChatMessage = {
    User(content) {
      return { role: "user", content };
    },
    Assistant(content) {
      return { role: "assistant", content };
    },
    Tool(content) {
      return { role: "tool", content };
    }
  };
  vscode.workspace.getConfiguration = () => ({
    get(key, defaultValue) {
      return Object.prototype.hasOwnProperty.call(traceableConfig, key)
        ? traceableConfig[key]
        : defaultValue;
    }
  });

  try {
    const groundedRoot = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-traceable-grounded-"));
    tempRoots.push(groundedRoot);
    const groundedAgentsDir = path.join(groundedRoot, ".github", "agents");
    await fs.mkdir(groundedAgentsDir, { recursive: true });
    await fs.writeFile(path.join(groundedAgentsDir, "anchor.gpt-5-mini.live-feedback-loop.experimental.agent.md"), [
      "---",
      "name: Anchor (GPT-5 mini) (Live Feedback Loop) (Experimental)",
      "description: Grounded traceable test agent.",
      "argument-hint: Test only.",
      "models: [Claude Opus 4.7 (copilot), GPT-5 mini (copilot)]",
      "tools: [read/readFile, search/textSearch, search/fileSearch, search/listDirectory]",
      "experimental: true",
      "handoffs:",
      "  - label: Continue",
      "    agent: Anchor (GPT-5 mini) (Live Feedback Loop) (Experimental)",
      "    prompt: Continue",
      "    send: true",
      "---",
      "",
      "You are a grounded test agent.",
      "Return the bounded trace payload."
    ].join("\n"), "utf8");

    let selectedTraceableSelector;
    let groundedSendRequestTools = [];
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: groundedRoot } }];
    vscode.lm = {
      tools: [
        { name: "read/readFile", description: "file read" },
        { name: "search/textSearch", description: "text search" },
        { name: "search/fileSearch", description: "file search" },
        { name: "search/listDirectory", description: "directory listing" },
        { name: "create_live_agent_chat", description: "mutation" }
      ],
      async selectChatModels(selector) {
        selectedTraceableSelector = selector;
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5-mini",
          version: "test",
          async sendRequest(_messages, options) {
            groundedSendRequestTools = Array.isArray(options?.tools) ? options.tools.map((tool) => tool.name) : [];
            async function* stream() {
              yield new vscode.LanguageModelTextPart('{"steps":[],"expectedButMissing":[],"stopReason":"completed","completionClaim":"complete","finalSummary":"grounded ok"}');
            }
            return { stream: stream() };
          }
        }];
      },
      async invokeTool() {
        throw new Error("Traceable grounded test should not invoke tools.");
      }
    };

    const groundedDebugDir = path.join(groundedRoot, ".traceable-debug");
    const groundedStatuses = [];
    const unsupportedStatuses = [];
    const groundedHeaderUpdates = [];

    const groundedResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect the grounded agent role.",
      parentTask: "Use the grounded agent artifact and return a bounded trace payload.",
      agentRole: { name: "Anchor (GPT-5 mini) (Live Feedback Loop) (Experimental)" }
    }, {
      debugLogDir: groundedDebugDir,
      statusReporter: {
        update(message) {
          groundedStatuses.push(`update:${message}`);
        },
        setHeader(header) {
          groundedHeaderUpdates.push(header);
        },
        finish(message, options) {
          groundedStatuses.push(`finish:${options?.error === true ? "error" : options?.warning === true ? "warning" : "ok"}:${message}`);
        }
      }
    });

    assert(
      selectedTraceableSelector?.vendor === "copilot" && selectedTraceableSelector?.id === "gpt-5-mini",
      `Traceable subagent grounded-role test did not translate the agent artifact models list to the expected exact selector. Got: ${JSON.stringify(selectedTraceableSelector)}`
    );
    assert(
      groundedResult.model?.id === "gpt-5-mini" && groundedResult.stopReason === "completed" && groundedResult.finalSummary === "grounded ok",
      `Traceable subagent grounded-role test did not complete through the agent artifact models-list path. Got: ${JSON.stringify(groundedResult)}`
    );
    assert(
      JSON.stringify(groundedResult.allowedToolNames) === JSON.stringify([
        "read/readFile",
        "search/textSearch",
        "search/fileSearch",
        "search/listDirectory"
      ])
        && JSON.stringify(groundedSendRequestTools) === JSON.stringify([
          "read/readFile",
          "search/textSearch",
          "search/fileSearch",
          "search/listDirectory"
        ]),
      `Traceable subagent grounded-role test did not inherit the agent artifact tool declarations into the runtime tool allowlist. Result: ${JSON.stringify({ allowedToolNames: groundedResult.allowedToolNames, groundedSendRequestTools })}`
    );
    assert(
      groundedResult.debugLogPath === path.join(groundedDebugDir, "traceable-subagent-debug.jsonl"),
      `Traceable subagent grounded-role test did not return the expected debug log path. Got: ${groundedResult.debugLogPath}`
    );
    assert(
      Number.isFinite(groundedResult.elapsedMs) && groundedResult.elapsedMs >= 0,
      `Traceable subagent grounded-role test did not return a concrete elapsedMs measurement. Got: ${groundedResult.elapsedMs}`
    );
    assert(
      groundedResult.usage?.provenance === "unavailable",
      `Traceable subagent grounded-role test did not preserve usage provenance when exact token usage was unavailable. Got: ${JSON.stringify(groundedResult.usage)}`
    );
    assert(
      Array.isArray(groundedResult.iterationMetrics)
        && groundedResult.iterationMetrics.length === 1
        && Number.isFinite(groundedResult.iterationMetrics[0]?.elapsedMs),
      `Traceable subagent grounded-role test did not return one concrete per-iteration timing record. Got: ${JSON.stringify(groundedResult.iterationMetrics)}`
    );
    const groundedDebugLog = await fs.readFile(groundedResult.debugLogPath, "utf8");
    const groundedDebugRows = groundedDebugLog
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert(
      groundedDebugLog.includes('"phase":"model_selected"') && groundedDebugLog.includes('"id":"gpt-5-mini"'),
      `Traceable subagent grounded-role test did not write the expected model-selection debug entry. Got: ${groundedDebugLog}`
    );

    let configuredSelector;
    let configuredSendRequestCount = 0;
    traceableConfig.traceablePreferredModels = ["GPT-5.4 mini (copilot)", "GPT-5 mini (copilot)"];
    traceableConfig.traceableBlockedModels = ["GPT-5.4 mini (copilot)"];
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: packageRoot } }];
    vscode.lm = {
      tools: [],
      async selectChatModels(selector) {
        configuredSelector = selector;
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5-mini",
          version: "test",
          async sendRequest() {
            configuredSendRequestCount += 1;
            async function* stream() {
              yield new vscode.LanguageModelTextPart('{"steps":[],"expectedButMissing":[],"stopReason":"completed","completionClaim":"complete","finalSummary":"configured model ok"}');
            }
            return { stream: stream() };
          }
        }];
      },
      async invokeTool() {
        throw new Error("Traceable configured-model test should not invoke tools.");
      }
    };

    const configuredModelResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect a bounded slice.",
      parentTask: "Use the configured TRACEABLE model policy when no explicit selector is supplied."
    });

    assert(
      configuredSelector?.vendor === "copilot" && configuredSelector?.id === "gpt-5-mini",
      `Traceable subagent configured-model policy test did not apply the preferred-model declarations after blocking the earlier entry. Got: ${JSON.stringify(configuredSelector)}`
    );
    assert(
      configuredSendRequestCount === 1
        && configuredModelResult.stopReason === "completed"
        && configuredModelResult.model?.id === "gpt-5-mini"
        && configuredModelResult.finalSummary === "configured model ok",
      `Traceable subagent configured-model policy test did not complete through the filtered settings fallback path. Got: ${JSON.stringify({ configuredSendRequestCount, configuredModelResult })}`
    );
    delete traceableConfig.traceablePreferredModels;
    delete traceableConfig.traceableBlockedModels;
    assert(
      groundedDebugRows.some((row) => Number.isFinite(row.elapsedMs) && row.elapsedMs >= 0),
      `Traceable subagent grounded-role test did not persist elapsedMs into the debug log. Got: ${groundedDebugLog}`
    );
    assert(
      groundedStatuses.includes("update:starting")
        && groundedStatuses.includes("update:resolving role")
        && groundedStatuses.includes("update:selecting model")
        && groundedStatuses.some((entry) => entry.startsWith("finish:ok:completed")),
      `Traceable subagent grounded-role test did not emit the expected status reporter messages. Got: ${JSON.stringify(groundedStatuses)}`
    );

    let validationWarningSendRequests = 0;
    const validationWarningStatuses = [];
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: groundedRoot } }];
    vscode.lm = {
      tools: [],
      async selectChatModels() {
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5.4-mini",
          version: "test",
          async sendRequest() {
            validationWarningSendRequests += 1;
            async function* stream() {
              yield new vscode.LanguageModelTextPart('{"steps":[],"expectedButMissing":[],"stopReason":"completed","completionClaim":"complete","finalSummary":"warning path ok"}');
            }
            return { stream: stream() };
          }
        }];
      },
      async invokeTool() {
        throw new Error("Traceable input-validation warning test should not invoke tools.");
      }
    };

    const validationWarningResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Prove that the cache bug is real.",
      parentTask: "Prove that the cache bug is real.",
      inputMode: "NON_LEADING_EPISTEMIC",
      validationMode: "WARN",
      modelSelector: { vendor: "copilot", family: "gpt-5", id: "gpt-5.4-mini", version: "test" }
    }, {
      statusReporter: {
        update(message) {
          validationWarningStatuses.push(`update:${message}`);
        },
        finish(message, options) {
          validationWarningStatuses.push(`finish:${options?.error === true ? "error" : options?.warning === true ? "warning" : "ok"}:${message}`);
        }
      }
    });

    assert(
      validationWarningSendRequests === 1,
      `Traceable subagent WARN validation test must continue into model execution. Got sendRequest count: ${validationWarningSendRequests}`
    );
    assert(
      validationWarningResult.stopReason === "completed"
        && validationWarningResult.validationIssues.length >= 1
        && validationWarningResult.validationIssues.some((issue) => issue.includes("NON_LEADING_EPISTEMIC")),
      `Traceable subagent WARN validation test must preserve visible validation issues on an otherwise completed run. Got: ${JSON.stringify(validationWarningResult)}`
    );
    assert(
      validationWarningStatuses.some((entry) => entry.startsWith("finish:warning:completed")),
      `Traceable subagent WARN validation test must mark the completed run as warning-state in the status reporter. Got: ${JSON.stringify(validationWarningStatuses)}`
    );
    assert(
      traceableSubagent.renderTraceableSubagentMarkdown(validationWarningResult).includes("## Validation Issues"),
      "Traceable subagent WARN validation test must render validation issues explicitly in markdown output."
    );

    let validationErrorSelectCalls = 0;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: groundedRoot } }];
    vscode.lm = {
      tools: [],
      async selectChatModels() {
        validationErrorSelectCalls += 1;
        return [];
      },
      async invokeTool() {
        throw new Error("Traceable input-validation error test should not invoke tools.");
      }
    };

    const validationErrorResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Show that the hypothesis is already true.",
      parentTask: "Show that the hypothesis is already true.",
      inputMode: "NON_LEADING_EPISTEMIC",
      validationMode: "ERROR",
      modelSelector: { vendor: "copilot", family: "gpt-5", id: "gpt-5.4-mini", version: "test" }
    });

    assert(
      validationErrorSelectCalls === 0,
      `Traceable subagent ERROR validation test must stop before model selection. Got selectChatModels count: ${validationErrorSelectCalls}`
    );
    assert(
      validationErrorResult.stopReason === "policy_stop"
        && validationErrorResult.validationIssues.length >= 1
        && validationErrorResult.finalSummary.includes("input validation failed"),
      `Traceable subagent ERROR validation test must fail fast with preserved validation issues. Got: ${JSON.stringify(validationErrorResult)}`
    );

    let invalidNleSelectCalls = 0;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: groundedRoot } }];
    vscode.lm = {
      tools: [],
      async selectChatModels() {
        invalidNleSelectCalls += 1;
        return [];
      },
      async invokeTool() {
        throw new Error("Traceable invalid-NLE test should not invoke tools.");
      }
    };

    const invalidNleResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect the hypothesis without leading it.",
      parentTask: "Inspect the hypothesis without leading it.",
      inputMode: "NON_LEADING_EPISTEMIC",
      modelSelector: { vendor: "copilot", family: "gpt-5", id: "gpt-5.4-mini", version: "test" }
    });

    assert(
      invalidNleSelectCalls === 0,
      `Traceable subagent invalid NLE contract test must stop before model selection when validationMode is omitted. Got selectChatModels count: ${invalidNleSelectCalls}`
    );
    assert(
      invalidNleResult.stopReason === "policy_stop"
        && invalidNleResult.validationIssues.some((issue) => issue.includes("requires validationMode WARN or ERROR")),
      `Traceable subagent invalid NLE contract test must fail fast when validationMode is omitted. Got: ${JSON.stringify(invalidNleResult)}`
    );
    assert(
      groundedHeaderUpdates.some((header) => JSON.stringify(header.toolsetNames) === JSON.stringify([
        "read/readFile",
        "search/textSearch",
        "search/fileSearch",
        "search/listDirectory"
      ]))
        && groundedHeaderUpdates.some((header) => JSON.stringify(header.selectedToolNames) === JSON.stringify([
          "read/readFile",
          "search/textSearch",
          "search/fileSearch",
          "search/listDirectory"
        ]) && header.toolSelectionRestricted === true),
      `Traceable subagent grounded-role test did not preserve namespaced toolsetNames while also publishing selectedToolNames policy state. Got: ${JSON.stringify(groundedHeaderUpdates)}`
    );
    assert(
      groundedDebugRows.some((row) => Number.isFinite(row.iterationElapsedMs) && row.usageProvenance === "unavailable"),
      `Traceable subagent grounded-role test did not persist per-iteration timing and usage provenance into the debug log. Got: ${groundedDebugLog}`
    );

    const unsupportedRoot = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-traceable-unsupported-model-"));
    tempRoots.push(unsupportedRoot);
    const unsupportedAgentsDir = path.join(unsupportedRoot, ".github", "agents");
    await fs.mkdir(unsupportedAgentsDir, { recursive: true });
    await fs.writeFile(path.join(unsupportedAgentsDir, "parallax.experimental.agent.md"), [
      "---",
      "name: Parallax (Experimental)",
      "description: Unsupported model declaration test.",
      "argument-hint: Test only.",
      "model: Claude Opus 4.7 (copilot)",
      "tools: [read/readFile]",
      "experimental: true",
      "---",
      "",
      "You are a test agent with an unsupported model declaration."
    ].join("\n"), "utf8");

    let unsupportedSelectCalls = 0;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: unsupportedRoot } }];
    vscode.lm = {
      tools: [],
      async selectChatModels() {
        unsupportedSelectCalls += 1;
        return [];
      },
      async invokeTool() {
        throw new Error("Traceable unsupported-model test should not invoke tools.");
      }
    };

    const unsupportedModelResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect the unsupported model declaration.",
      parentTask: "Fail closed if the agent artifact model declaration cannot be translated safely.",
      agentRole: { name: "Parallax (Experimental)" }
    }, {
      statusReporter: {
        update(message) {
          unsupportedStatuses.push(`update:${message}`);
        },
        finish(message, options) {
          unsupportedStatuses.push(`finish:${options?.error === true ? "error" : options?.warning === true ? "warning" : "ok"}:${message}`);
        }
      }
    });

    assert(
      unsupportedSelectCalls === 1,
      `Traceable subagent unsupported-model test should probe the broad runtime model list exactly once for recovery context. Got calls: ${unsupportedSelectCalls}`
    );
    assert(
      unsupportedModelResult.stopReason === "tool_blocked"
        && unsupportedModelResult.finalSummary.includes("no supported unblocked declaration")
        && unsupportedModelResult.finalSummary.includes("availableRuntimeModels="),
      `Traceable subagent unsupported-model test did not fail closed on an unrecognized model declaration. Got: ${JSON.stringify(unsupportedModelResult)}`
    );
    assert(
      unsupportedStatuses.some((entry) => entry.startsWith("finish:error:failed")),
      `Traceable subagent unsupported-model test did not report a hard failure status. Got: ${JSON.stringify(unsupportedStatuses)}`
    );

    const unavailableToolsRoot = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-traceable-unavailable-tools-"));
    tempRoots.push(unavailableToolsRoot);
    const unavailableToolsAgentsDir = path.join(unavailableToolsRoot, ".github", "agents");
    await fs.mkdir(unavailableToolsAgentsDir, { recursive: true });
    await fs.writeFile(path.join(unavailableToolsAgentsDir, "echo.gpt-5-mini.candidate.agent.md"), [
      "---",
      "name: Echo (GPT-5 mini) (Candidate)",
      "description: Unavailable tool surface test.",
      "argument-hint: Test only.",
      "model: GPT-5 mini (copilot)",
      "tools: [tiinex.ai-vscode-tools/listAgentSessions]",
      "candidate: true",
      "---",
      "",
      "You are a test agent with a tool surface that cannot be satisfied on this host snapshot."
    ].join("\n"), "utf8");

    let unavailableToolsSelectCalls = 0;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: unavailableToolsRoot } }];
    vscode.lm = {
      tools: [
        { name: "create_live_agent_chat", description: "mutation" }
      ],
      async selectChatModels() {
        unavailableToolsSelectCalls += 1;
        return [];
      },
      async invokeTool() {
        throw new Error("Traceable unavailable-tools test should not invoke tools.");
      }
    };

    const unavailableToolsResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect the unavailable tool surface.",
      parentTask: "Fail closed if the declared tool surface resolves to no runnable tools.",
      agentRole: { name: "Echo (GPT-5 mini) (Candidate)" }
    });

    assert(
      unavailableToolsSelectCalls === 0,
      `Traceable subagent unavailable-tools test reached model selection unexpectedly. Got calls: ${unavailableToolsSelectCalls}`
    );
    assert(
      unavailableToolsResult.stopReason === "tool_blocked"
        && unavailableToolsResult.finalSummary.includes("resolved no runnable tools")
        && unavailableToolsResult.finalSummary.includes("listAgentSessions"),
      `Traceable subagent unavailable-tools test did not fail closed on an unusable declared tool surface. Got: ${JSON.stringify(unavailableToolsResult)}`
    );

    let synthesisReservationSendCount = 0;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: packageRoot } }];
    vscode.lm = {
      tools: [
        { name: "copilot_readFile", description: "file read" }
      ],
      async selectChatModels() {
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5-mini",
          version: "test",
          async sendRequest() {
            synthesisReservationSendCount += 1;
            async function* firstStream() {
              yield new vscode.LanguageModelToolCallPart("call-1", "copilot_readFile", { filePath: "a", startLine: 1, endLine: 10 });
              yield new vscode.LanguageModelToolCallPart("call-2", "copilot_readFile", { filePath: "a", startLine: 11, endLine: 20 });
              yield new vscode.LanguageModelToolCallPart("call-3", "copilot_readFile", { filePath: "a", startLine: 21, endLine: 30 });
              yield new vscode.LanguageModelToolCallPart("call-4", "copilot_readFile", { filePath: "a", startLine: 31, endLine: 40 });
            }
            async function* secondStream() {
              yield new vscode.LanguageModelTextPart('{"steps":[{"id":"step-1","intent":"inspect file slices","status":"completed"}],"expectedButMissing":[],"stopReason":"completed","completionClaim":"complete","finalSummary":"synthesized ok"}');
            }
            return { stream: synthesisReservationSendCount === 1 ? firstStream() : secondStream() };
          }
        }];
      },
      async invokeTool() {
        return {
          content: [new vscode.LanguageModelTextPart("read ok")]
        };
      }
    };

    const synthesisReservationResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect a local guard.",
      parentTask: "Use read-only evidence and return a final bounded trace payload.",
      modelSelector: { vendor: "copilot", id: "gpt-5-mini" },
      allowedToolNames: ["copilot_readFile"],
      budgetPolicy: { maxIterations: 4, maxToolCalls: 4 }
    });

    assert(
      synthesisReservationResult.stopReason === "completed"
        && synthesisReservationResult.completionClaim === "complete"
        && synthesisReservationResult.finalSummary === "synthesized ok",
      `Traceable subagent synthesis-reservation test did not reach a final payload after deferring the last batched tool call. Got: ${JSON.stringify(synthesisReservationResult)}`
    );

    let repeatedAnchoredReadInvokeCount = 0;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: packageRoot } }];
    vscode.lm = {
      tools: [
        { name: "copilot_readFile", description: "file read" }
      ],
      async selectChatModels() {
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5-mini",
          version: "test",
          async sendRequest(messages) {
            const serializedMessages = JSON.stringify(messages);
            async function* firstStream() {
              yield new vscode.LanguageModelToolCallPart("anchor-call-1", "copilot_readFile", { filePath: path.resolve(packageRoot, "package.json"), startLine: 1, endLine: 200 });
              yield new vscode.LanguageModelToolCallPart("anchor-call-2", "copilot_readFile", { filePath: path.resolve(packageRoot, "package.json"), startLine: 201, endLine: 400 });
            }
            async function* secondStream() {
              yield new vscode.LanguageModelTextPart('{"steps":[{"id":"step-anchor-coverage","intent":"cover anchors before rereading one file","status":"completed"}],"expectedButMissing":[],"stopReason":"completed","completionClaim":"complete","finalSummary":"anchor coverage ok"}');
            }
            const sawDeferredRepeatReadNote = serializedMessages.includes("Deferred repeated read of package.json until the remaining anchored files are covered once");
            return { stream: sawDeferredRepeatReadNote ? secondStream() : firstStream() };
          }
        }];
      },
      async invokeTool() {
        repeatedAnchoredReadInvokeCount += 1;
        return {
          content: [new vscode.LanguageModelTextPart("read ok")]
        };
      }
    };

    const repeatedAnchoredReadResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect the anchored runtime files.",
      parentTask: "Cover each anchored file once before rereading one anchored file under bounded read budget.",
      modelSelector: { vendor: "copilot", id: "gpt-5-mini" },
      allowedToolNames: ["copilot_readFile"],
      budgetPolicy: { maxIterations: 4, maxToolCalls: 4 },
      carriedContext: {
        fileContext: ["package.json", "README.md"]
      }
    });

    assert(
      repeatedAnchoredReadInvokeCount === 1
        && repeatedAnchoredReadResult.stopReason === "completed"
        && repeatedAnchoredReadResult.toolCalls.some((entry) => entry.result === "notRun"
          && entry.note?.includes("Next action: read one of these unread anchored files now")
          && entry.note.includes(path.resolve(packageRoot, "README.md"))),
      `Traceable subagent anchored-read guard did not defer the repeated anchored read before unread anchors were covered. Got: ${JSON.stringify({ repeatedAnchoredReadInvokeCount, repeatedAnchoredReadResult })}`
    );

    let retryCreditSendCount = 0;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: packageRoot } }];
    vscode.lm = {
      tools: [
        { name: "copilot_readFile", description: "file read" }
      ],
      async selectChatModels() {
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5-mini",
          version: "test",
          async sendRequest(messages) {
            retryCreditSendCount += 1;
            const serializedMessages = JSON.stringify(messages);
            async function* firstStream() {
              yield new vscode.LanguageModelToolCallPart("retry-credit-call-1", "copilot_readFile", { filePath: path.resolve(packageRoot, "package.json"), startLine: 1, endLine: 120 });
            }
            async function* secondStream() {
              yield new vscode.LanguageModelToolCallPart("retry-credit-call-2", "copilot_readFile", { filePath: path.resolve(packageRoot, "package.json"), startLine: 121, endLine: 240 });
            }
            async function* thirdStream() {
              yield new vscode.LanguageModelToolCallPart("retry-credit-call-3", "copilot_readFile", { filePath: path.resolve(packageRoot, "README.md"), startLine: 1, endLine: 120 });
            }
            async function* fourthStream() {
              yield new vscode.LanguageModelTextPart('{"steps":[{"id":"step-retry-credit","intent":"use the retry credit to reach the unread anchor","status":"completed"}],"expectedButMissing":[],"stopReason":"completed","completionClaim":"complete","finalSummary":"retry credit ok"}');
            }
            if (serializedMessages.includes("Traceable subagent retry credit:")) {
              return { stream: fourthStream() };
            }
            return {
              stream: retryCreditSendCount === 1
                ? firstStream()
                : retryCreditSendCount === 2
                  ? secondStream()
                  : thirdStream()
            };
          }
        }];
      },
      async invokeTool() {
        return {
          content: [new vscode.LanguageModelTextPart("read ok")]
        };
      }
    };

    const retryCreditResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect the anchored runtime files.",
      parentTask: "Cover each anchored file once before rereading one anchored file under bounded read budget.",
      modelSelector: { vendor: "copilot", id: "gpt-5-mini" },
      allowedToolNames: ["copilot_readFile"],
      budgetPolicy: { maxIterations: 3, maxToolCalls: 4 },
      carriedContext: {
        fileContext: ["package.json", "README.md"]
      }
    });

    assert(
      retryCreditSendCount === 3
        && retryCreditResult.stopReason === "completed"
        && retryCreditResult.finalSummary === "retry credit ok"
        && retryCreditResult.iterationMetrics?.some((entry) => entry.nonConsumingRetryGranted === true)
        && retryCreditResult.iterationMetrics.some((entry) => entry.executedToolCallCount === 0 && entry.deferredToolCallCount === 1),
      `Traceable subagent pure-defer retry credit did not preserve a regular iteration for the unread anchor. Got: ${JSON.stringify({ retryCreditSendCount, retryCreditResult })}`
    );
    assert(
      JSON.stringify(synthesisReservationResult.toolCalls.map((entry) => entry.result)) === JSON.stringify(["success", "success", "success", "notRun"])
        && synthesisReservationResult.toolCalls[3]?.note?.includes("preserve a final synthesis turn"),
      `Traceable subagent synthesis-reservation test did not defer the last batched tool call to preserve a synthesis turn. Got: ${JSON.stringify(synthesisReservationResult.toolCalls)}`
    );

    let finalRecoverySendCount = 0;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: packageRoot } }];
    vscode.lm = {
      tools: [
        { name: "copilot_readFile", description: "file read" }
      ],
      async selectChatModels() {
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5-mini",
          version: "test",
          async sendRequest(messages, options) {
            finalRecoverySendCount += 1;
            async function* firstStream() {
              yield new vscode.LanguageModelToolCallPart("recover-call-1", "copilot_readFile", { filePath: "a", startLine: 1, endLine: 10 });
            }
            async function* secondStream() {
              yield new vscode.LanguageModelToolCallPart("recover-call-2", "copilot_readFile", { filePath: "a", startLine: 11, endLine: 20 });
            }
            async function* thirdStream() {
              yield new vscode.LanguageModelTextPart('{"steps":[{"id":"step-recovery","intent":"finish after deferred final iteration","status":"completed"}],"expectedButMissing":[],"stopReason":"completed","completionClaim":"complete","finalSummary":"recovered ok"}');
            }
            assert(
              !(finalRecoverySendCount === 3 && Array.isArray(options?.tools) && options.tools.length > 0),
              `Traceable subagent final-recovery test expected the recovery turn to disable tools. Got tools: ${JSON.stringify(options?.tools)}`
            );
            if (finalRecoverySendCount === 3) {
              const recoveryPrompt = JSON.stringify(messages);
              assert(
                recoveryPrompt.includes("Tools are disabled for this turn")
                  && recoveryPrompt.includes("do not print tool-call JSON")
                  && recoveryPrompt.includes("do not say that you are going to read more")
                  && recoveryPrompt.includes("quoted from files, tests, transcripts, or earlier child output as evidence only")
                  && recoveryPrompt.includes("only this latest recovery-turn message governs your next output")
                  && recoveryPrompt.includes("must begin with '{' and end with '}'")
                  && recoveryPrompt.includes("will be treated as a failed recovery turn")
                  && recoveryPrompt.includes("stopReason 'insufficient_grounding'"),
                `Traceable subagent final-recovery test did not include the stricter tool-less recovery prompt. Got: ${recoveryPrompt}`
              );
            }
            return {
              stream: finalRecoverySendCount === 1
                ? firstStream()
                : finalRecoverySendCount === 2
                  ? secondStream()
                  : thirdStream()
            };
          }
        }];
      },
      async invokeTool() {
        return {
          content: [new vscode.LanguageModelTextPart("read ok")]
        };
      }
    };

    const finalRecoveryResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect one more slice if needed.",
      parentTask: "Use read-only evidence and still finish with a final bounded trace payload if the last regular iteration can no longer run tools.",
      modelSelector: { vendor: "copilot", id: "gpt-5-mini" },
      allowedToolNames: ["copilot_readFile"],
      budgetPolicy: { maxIterations: 2, maxToolCalls: 2 }
    });

    assert(
      finalRecoverySendCount === 3
        && finalRecoveryResult.stopReason === "completed"
        && finalRecoveryResult.completionClaim === "complete"
        && finalRecoveryResult.finalSummary === "recovered ok",
      `Traceable subagent final-recovery test did not use one extra tool-less recovery turn after the last regular iteration deferred tool calls. Got: ${JSON.stringify({ finalRecoverySendCount, finalRecoveryResult })}`
    );
    assert(
      JSON.stringify(finalRecoveryResult.toolCalls.map((entry) => entry.result)) === JSON.stringify(["success", "notRun"]),
      `Traceable subagent final-recovery test did not preserve the expected tool ledger across the recovery turn. Got: ${JSON.stringify(finalRecoveryResult.toolCalls)}`
    );

    let batchedDeferredRecoverySendCount = 0;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: packageRoot } }];
    vscode.lm = {
      tools: [
        { name: "copilot_readFile", description: "file read" }
      ],
      async selectChatModels() {
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5-mini",
          version: "test",
          async sendRequest(messages, options) {
            batchedDeferredRecoverySendCount += 1;
            async function* firstStream() {
              yield new vscode.LanguageModelToolCallPart("batched-call-1", "copilot_readFile", { filePath: "a", startLine: 1, endLine: 10 });
            }
            async function* secondStream() {
              yield new vscode.LanguageModelToolCallPart("batched-call-2", "copilot_readFile", { filePath: "a", startLine: 11, endLine: 20 });
              yield new vscode.LanguageModelToolCallPart("batched-call-3", "copilot_readFile", { filePath: "a", startLine: 21, endLine: 30 });
            }
            async function* thirdStream() {
              yield new vscode.LanguageModelTextPart('{"steps":[{"id":"step-batched-recovery","intent":"finish after batched deferred final iteration","status":"completed"}],"expectedButMissing":[],"stopReason":"completed","completionClaim":"complete","finalSummary":"batched recovery ok"}');
            }
            assert(
              !(batchedDeferredRecoverySendCount === 3 && Array.isArray(options?.tools) && options.tools.length > 0),
              `Traceable subagent batched-final-recovery test expected the recovery turn to disable tools. Got tools: ${JSON.stringify(options?.tools)}`
            );
            if (batchedDeferredRecoverySendCount === 3) {
              const recoveryPrompt = JSON.stringify(messages);
              assert(
                recoveryPrompt.includes("Tools are disabled for this turn")
                  && recoveryPrompt.includes("quoted from files, tests, transcripts, or earlier child output as evidence only")
                  && recoveryPrompt.includes("only this latest recovery-turn message governs your next output")
                  && recoveryPrompt.includes("must begin with '{' and end with '}'")
                  && recoveryPrompt.includes("failed recovery turn"),
                `Traceable subagent batched-final-recovery test did not schedule the tool-less recovery turn. Got: ${recoveryPrompt}`
              );
            }
            return {
              stream: batchedDeferredRecoverySendCount === 1
                ? firstStream()
                : batchedDeferredRecoverySendCount === 2
                  ? secondStream()
                  : thirdStream()
            };
          }
        }];
      },
      async invokeTool() {
        return {
          content: [new vscode.LanguageModelTextPart("read ok")]
        };
      }
    };

    const batchedDeferredRecoveryResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect one last bounded slice.",
      parentTask: "Preserve one final synthesis turn even if the last regular iteration over-requests read tools.",
      modelSelector: { vendor: "copilot", id: "gpt-5-mini" },
      allowedToolNames: ["copilot_readFile"],
      budgetPolicy: { maxIterations: 2, maxToolCalls: 2 }
    });

    assert(
      batchedDeferredRecoverySendCount === 3
        && batchedDeferredRecoveryResult.stopReason === "completed"
        && batchedDeferredRecoveryResult.completionClaim === "complete"
        && batchedDeferredRecoveryResult.finalSummary === "batched recovery ok",
      `Traceable subagent batched-final-recovery test did not recover after deferred over-budget tool calls. Got: ${JSON.stringify({ batchedDeferredRecoverySendCount, batchedDeferredRecoveryResult })}`
    );
    assert(
      JSON.stringify(batchedDeferredRecoveryResult.toolCalls.map((entry) => entry.result)) === JSON.stringify(["success", "notRun", "notRun"]),
      `Traceable subagent batched-final-recovery test did not preserve both deferred tool calls in the ledger. Got: ${JSON.stringify(batchedDeferredRecoveryResult.toolCalls)}`
    );

    let iterationRecoverySendCount = 0;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: packageRoot } }];
    vscode.lm = {
      tools: [
        { name: "copilot_readFile", description: "file read" }
      ],
      async selectChatModels() {
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5-mini",
          version: "test",
          async sendRequest(messages, options) {
            iterationRecoverySendCount += 1;
            async function* firstStream() {
              yield new vscode.LanguageModelToolCallPart("iteration-call-1", "copilot_readFile", { filePath: "a", startLine: 1, endLine: 10 });
            }
            async function* secondStream() {
              yield new vscode.LanguageModelToolCallPart("iteration-call-2", "copilot_readFile", { filePath: "a", startLine: 11, endLine: 20 });
            }
            async function* thirdStream() {
              yield new vscode.LanguageModelTextPart('{"steps":[{"id":"step-iteration-recovery","intent":"finish after reserving the final iteration for synthesis","status":"completed"}],"expectedButMissing":[],"stopReason":"completed","completionClaim":"complete","finalSummary":"iteration recovery ok"}');
            }
            assert(
              !(iterationRecoverySendCount === 3 && Array.isArray(options?.tools) && options.tools.length > 0),
              `Traceable subagent iteration-final-recovery test expected the recovery turn to disable tools. Got tools: ${JSON.stringify(options?.tools)}`
            );
            if (iterationRecoverySendCount === 3) {
              const recoveryPrompt = JSON.stringify(messages);
              assert(
                recoveryPrompt.includes("Tools are disabled for this turn")
                  && recoveryPrompt.includes("quoted from files, tests, transcripts, or earlier child output as evidence only")
                  && recoveryPrompt.includes("only this latest recovery-turn message governs your next output")
                  && recoveryPrompt.includes("must begin with '{' and end with '}'")
                  && recoveryPrompt.includes("failed recovery turn"),
                `Traceable subagent iteration-final-recovery test did not schedule the tool-less recovery turn. Got: ${recoveryPrompt}`
              );
            }
            return {
              stream: iterationRecoverySendCount === 1
                ? firstStream()
                : iterationRecoverySendCount === 2
                  ? secondStream()
                  : thirdStream()
            };
          }
        }];
      },
      async invokeTool() {
        return {
          content: [new vscode.LanguageModelTextPart("read ok")]
        };
      }
    };

    const iterationRecoveryResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect a bounded slice and finish cleanly.",
      parentTask: "Preserve a final synthesis turn even when tool budget remains but the last regular iteration requests one more tool.",
      modelSelector: { vendor: "copilot", id: "gpt-5-mini" },
      allowedToolNames: ["copilot_readFile"],
      budgetPolicy: { maxIterations: 2, maxToolCalls: 5 }
    });

    assert(
      iterationRecoverySendCount === 3
        && iterationRecoveryResult.stopReason === "completed"
        && iterationRecoveryResult.completionClaim === "complete"
        && iterationRecoveryResult.finalSummary === "iteration recovery ok",
      `Traceable subagent iteration-final-recovery test did not reserve the last regular iteration for a synthesis turn. Got: ${JSON.stringify({ iterationRecoverySendCount, iterationRecoveryResult })}`
    );
    assert(
      JSON.stringify(iterationRecoveryResult.toolCalls.map((entry) => entry.result)) === JSON.stringify(["success", "notRun"])
        && iterationRecoveryResult.toolCalls[1]?.note?.includes("iteration budget is exhausted"),
      `Traceable subagent iteration-final-recovery test did not preserve the deferred final-iteration tool call in the ledger. Got: ${JSON.stringify(iterationRecoveryResult.toolCalls)}`
    );

    let anchoredFinalReadRecoverySendCount = 0;
    let anchoredFinalReadInvokeCount = 0;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: packageRoot } }];
    vscode.lm = {
      tools: [
        { name: "copilot_readFile", description: "file read" }
      ],
      async selectChatModels() {
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5-mini",
          version: "test",
          async sendRequest(messages, options) {
            anchoredFinalReadRecoverySendCount += 1;
            async function* firstStream() {
              yield new vscode.LanguageModelToolCallPart("anchor-final-call-1", "copilot_readFile", { filePath: path.resolve(packageRoot, "package.json"), startLine: 1, endLine: 120 });
              yield new vscode.LanguageModelToolCallPart("anchor-final-call-2", "copilot_readFile", { filePath: path.resolve(packageRoot, "README.md"), startLine: 1, endLine: 120 });
            }
            async function* secondStream() {
              yield new vscode.LanguageModelToolCallPart("anchor-final-call-3", "copilot_readFile", { filePath: path.resolve(packageRoot, "package.json"), startLine: 121, endLine: 240 });
            }
            async function* thirdStream() {
              yield new vscode.LanguageModelTextPart('{"steps":[{"id":"step-anchor-final-recovery","intent":"use one final anchored reread and then synthesize cleanly","status":"completed"}],"expectedButMissing":[],"stopReason":"completed","completionClaim":"complete","finalSummary":"anchored final read recovery ok"}');
            }
            if (anchoredFinalReadRecoverySendCount === 3) {
              const recoveryPrompt = JSON.stringify(messages);
              assert(
                recoveryPrompt.includes("Tools are disabled for this turn")
                  && recoveryPrompt.includes("one final anchored read to close a local evidence gap"),
                `Traceable subagent anchored-final-read recovery test did not schedule the tool-less recovery turn after the last anchored reread. Got: ${recoveryPrompt}`
              );
              assert(
                !(Array.isArray(options?.tools) && options.tools.length > 0),
                `Traceable subagent anchored-final-read recovery test expected tools to be disabled on the recovery turn. Got tools: ${JSON.stringify(options?.tools)}`
              );
            }
            return {
              stream: anchoredFinalReadRecoverySendCount === 1
                ? firstStream()
                : anchoredFinalReadRecoverySendCount === 2
                  ? secondStream()
                  : thirdStream()
            };
          }
        }];
      },
      async invokeTool() {
        anchoredFinalReadInvokeCount += 1;
        return {
          content: [new vscode.LanguageModelTextPart("read ok")]
        };
      }
    };

    const anchoredFinalReadRecoveryResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Close the last anchored evidence gap and finish cleanly.",
      parentTask: "Use the explicit file anchors first, allow one final anchored reread only when those anchors are already covered, and still finish with a bounded trace payload.",
      modelSelector: { vendor: "copilot", id: "gpt-5-mini" },
      allowedToolNames: ["copilot_readFile"],
      budgetPolicy: { maxIterations: 2, maxToolCalls: 5 },
      carriedContext: {
        fileContext: [path.resolve(packageRoot, "package.json"), path.resolve(packageRoot, "README.md")]
      }
    });

    assert(
      anchoredFinalReadRecoverySendCount === 3
        && anchoredFinalReadInvokeCount === 3
        && anchoredFinalReadRecoveryResult.stopReason === "completed"
        && anchoredFinalReadRecoveryResult.completionClaim === "complete"
        && anchoredFinalReadRecoveryResult.finalSummary === "anchored final read recovery ok",
      `Traceable subagent anchored-final-read recovery test did not complete after one final anchored reread plus a tool-less recovery turn. Got: ${JSON.stringify({ anchoredFinalReadRecoverySendCount, anchoredFinalReadInvokeCount, anchoredFinalReadRecoveryResult })}`
    );
    assert(
      JSON.stringify(anchoredFinalReadRecoveryResult.toolCalls.map((entry) => entry.result)) === JSON.stringify(["success", "success", "success"]),
      `Traceable subagent anchored-final-read recovery test did not preserve the expected successful tool ledger. Got: ${JSON.stringify(anchoredFinalReadRecoveryResult.toolCalls)}`
    );

    let unbatchedToolReplaySendCount = 0;
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: packageRoot } }];
    vscode.lm = {
      tools: [
        { name: "copilot_readFile", description: "file read" }
      ],
      async selectChatModels() {
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5-mini",
          version: "test",
          async sendRequest(messages) {
            unbatchedToolReplaySendCount += 1;
            async function* firstStream() {
              yield new vscode.LanguageModelToolCallPart("unbatched-call-1", "copilot_readFile", { filePath: "a", startLine: 1, endLine: 10 });
              yield new vscode.LanguageModelToolCallPart("unbatched-call-2", "copilot_readFile", { filePath: "b", startLine: 1, endLine: 10 });
            }
            async function* secondStream() {
              yield new vscode.LanguageModelTextPart('{"steps":[{"id":"step-unbatched-tool-replay","intent":"finish after replaying tool results separately","status":"completed"}],"expectedButMissing":[],"stopReason":"completed","completionClaim":"complete","finalSummary":"unbatched tool replay ok"}');
            }
            if (unbatchedToolReplaySendCount === 2) {
              const trailingMessages = messages.slice(-3);
              assert(
                trailingMessages[0]?.role === "assistant"
                  && trailingMessages[1]?.role === "user"
                  && trailingMessages[2]?.role === "user"
                  && Array.isArray(trailingMessages[1]?.content)
                  && trailingMessages[1].content.length === 1
                  && trailingMessages[1].content[0]?.callId === "unbatched-call-1"
                  && Array.isArray(trailingMessages[2]?.content)
                  && trailingMessages[2].content.length === 1
                  && trailingMessages[2].content[0]?.callId === "unbatched-call-2",
                `Traceable subagent tool-result replay test did not emit one user message per tool result part. Got: ${JSON.stringify(trailingMessages)}`
              );
            }
            return {
              stream: unbatchedToolReplaySendCount === 1 ? firstStream() : secondStream()
            };
          }
        }];
      },
      async invokeTool() {
        return {
          content: [new vscode.LanguageModelTextPart("read ok")]
        };
      }
    };

    const unbatchedToolReplayResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Compare two bounded slices and finish cleanly.",
      parentTask: "Replay multiple tool results back into the child lane without batching them into one host message.",
      modelSelector: { vendor: "copilot", id: "gpt-5-mini" },
      allowedToolNames: ["copilot_readFile"],
      budgetPolicy: { maxIterations: 2, maxToolCalls: 4 }
    });

    assert(
      unbatchedToolReplaySendCount === 2
        && unbatchedToolReplayResult.stopReason === "completed"
        && unbatchedToolReplayResult.completionClaim === "complete"
        && unbatchedToolReplayResult.finalSummary === "unbatched tool replay ok",
      `Traceable subagent tool-result replay test did not complete after replaying tool results in separate user messages. Got: ${JSON.stringify({ unbatchedToolReplaySendCount, unbatchedToolReplayResult })}`
    );

    vscode.workspace.workspaceFolders = [{ uri: { fsPath: packageRoot } }];
    vscode.lm = {
      tools: [
        { name: "copilot_readFile", description: "file read" }
      ],
      async selectChatModels() {
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5-mini",
          version: "test",
          async sendRequest() {
            async function* stream() {
              yield new vscode.LanguageModelTextPart("I will read the remainder of tests/test.mjs to find explicit traceable-subagent tests.\n\n{\"filePath\":\"c:\\\\repo\\\\tests\\\\test.mjs\",\"startLine\":1200,\"endLine\":2400}");
            }
            return { stream: stream() };
          }
        }];
      },
      async invokeTool() {
        return {
          content: [new vscode.LanguageModelTextPart("read ok")]
        };
      }
    };

    const unparseablePayloadResult = await traceableSubagent.runTraceableSubagent({
      userInput: "inspect current status",
      parentTask: "return a bounded summary",
      modelSelector: { vendor: "copilot", id: "gpt-5-mini" },
      allowedToolNames: ["copilot_readFile"],
      budgetPolicy: { maxIterations: 2, maxToolCalls: 2 }
    });

    assert(
      unparseablePayloadResult.stopReason === "insufficient_grounding"
        && unparseablePayloadResult.completionClaim === "unresolved"
        && unparseablePayloadResult.finalSummary.includes("did not emit a final JSON payload")
        && unparseablePayloadResult.expectedButMissing.some((item) => item.label === "Final JSON payload"),
      `Traceable subagent unparseable-payload fallback test did not produce a disciplined unresolved summary. Got: ${JSON.stringify(unparseablePayloadResult)}`
    );
    assert(
      unparseablePayloadResult.rawModelText?.includes("I will read the remainder")
        && !unparseablePayloadResult.finalSummary.includes("I will read the remainder"),
      "Traceable subagent unparseable-payload fallback must keep raw child output available without promoting it into the final summary."
    );

    vscode.workspace.workspaceFolders = [{ uri: { fsPath: packageRoot } }];
    vscode.lm = {
      tools: [
        { name: "copilot_readFile", description: "file read" }
      ],
      async selectChatModels() {
        return [{
          vendor: "copilot",
          family: "gpt-5",
          id: "gpt-5-mini",
          version: "test",
          async sendRequest() {
            async function* stream() {
            }
            return { stream: stream() };
          }
        }];
      },
      async invokeTool() {
        throw new Error("Traceable empty-response test should not invoke tools.");
      }
    };

    const emptyResponseResult = await traceableSubagent.runTraceableSubagent({
      userInput: "inspect current status",
      parentTask: "return a bounded summary",
      modelSelector: { vendor: "copilot", id: "gpt-5-mini" },
      allowedToolNames: ["copilot_readFile"],
      budgetPolicy: { maxIterations: 2, maxToolCalls: 2 }
    });

    assert(
      emptyResponseResult.stopReason === "tool_blocked"
        && emptyResponseResult.completionClaim === "unresolved"
        && emptyResponseResult.finalSummary.includes("empty response stream")
        && emptyResponseResult.finalSummary.includes("no-choices response")
        && emptyResponseResult.expectedButMissing.some((item) => item.label === "Final JSON payload")
        && emptyResponseResult.rawModelText === "",
      `Traceable subagent empty-response fallback did not produce the expected no-choices style failure surface. Got: ${JSON.stringify(emptyResponseResult)}`
    );

    const ambiguousRootA = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-traceable-ambiguous-a-"));
    const ambiguousRootB = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-traceable-ambiguous-b-"));
    tempRoots.push(ambiguousRootA, ambiguousRootB);
    for (const ambiguousRoot of [ambiguousRootA, ambiguousRootB]) {
      const ambiguousAgentsDir = path.join(ambiguousRoot, ".github", "agents");
      await fs.mkdir(ambiguousAgentsDir, { recursive: true });
      await fs.writeFile(path.join(ambiguousAgentsDir, "anchor.gpt-5-mini.agent.md"), [
        "---",
        "name: Anchor (GPT-5 mini)",
        "description: Ambiguous direct-match test agent.",
        "argument-hint: Test only.",
        "model: GPT-5 mini (copilot)",
        "tools: [read/readFile]",
        "---",
        "",
        "You are an ambiguous test agent."
      ].join("\n"), "utf8");
    }

    vscode.workspace.workspaceFolders = [{ uri: { fsPath: ambiguousRootA } }, { uri: { fsPath: ambiguousRootB } }];
    vscode.lm = {
      tools: [],
      async selectChatModels() {
        throw new Error("Traceable ambiguity test should fail before model selection.");
      },
      async invokeTool() {
        throw new Error("Traceable ambiguity test should not invoke tools.");
      }
    };

    const ambiguousResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect the ambiguous role.",
      parentTask: "Fail closed if multiple direct agent artifact matches exist.",
      agentRole: { name: "Anchor (GPT-5 mini)" }
    });

    assert(
      ambiguousResult.stopReason === "tool_blocked"
        && ambiguousResult.finalSummary.includes("matched multiple direct workspace agent artifacts")
        && ambiguousResult.finalSummary.includes("availableDisplayNames="),
      `Traceable subagent ambiguity test did not fail closed on multiple direct matches. Got: ${JSON.stringify(ambiguousResult)}`
    );

    vscode.workspace.workspaceFolders = [{ uri: { fsPath: ambiguousRootA } }];
    const unresolvedRoleResult = await traceableSubagent.runTraceableSubagent({
      userInput: "Inspect the unresolved role.",
      parentTask: "Fail closed if the requested role does not exist.",
      agentRole: { name: "Not A Real Traceable Agent" }
    });

    assert(
      unresolvedRoleResult.stopReason === "tool_blocked"
        && unresolvedRoleResult.finalSummary.includes("could not be resolved")
        && unresolvedRoleResult.finalSummary.includes("availableDisplayNames=")
        && unresolvedRoleResult.finalSummary.includes("Anchor (GPT-5 mini)"),
      `Traceable subagent unresolved-role test did not return available display-name guidance. Got: ${JSON.stringify(unresolvedRoleResult)}`
    );
  } finally {
    if (originalWorkspace) {
      originalWorkspace.workspaceFolders = originalWorkspaceFolders;
      if (originalGetConfiguration === undefined) {
        delete originalWorkspace.getConfiguration;
      } else {
        originalWorkspace.getConfiguration = originalGetConfiguration;
      }
    } else {
      delete vscode.workspace;
    }

    if (originalLm === undefined) {
      delete vscode.lm;
    } else {
      vscode.lm = originalLm;
    }

    if (originalToolMode === undefined) {
      delete vscode.LanguageModelChatToolMode;
    } else {
      vscode.LanguageModelChatToolMode = originalToolMode;
    }

    if (originalTextPart === undefined) {
      delete vscode.LanguageModelTextPart;
    } else {
      vscode.LanguageModelTextPart = originalTextPart;
    }

    if (originalToolCallPart === undefined) {
      delete vscode.LanguageModelToolCallPart;
    } else {
      vscode.LanguageModelToolCallPart = originalToolCallPart;
    }

    if (originalToolResultPart === undefined) {
      delete vscode.LanguageModelToolResultPart;
    } else {
      vscode.LanguageModelToolResultPart = originalToolResultPart;
    }

    if (originalDataPart === undefined) {
      delete vscode.LanguageModelDataPart;
    } else {
      vscode.LanguageModelDataPart = originalDataPart;
    }

    if (originalChatMessage === undefined) {
      delete vscode.LanguageModelChatMessage;
    } else {
      vscode.LanguageModelChatMessage = originalChatMessage;
    }

    await Promise.all(tempRoots.map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })));
  }
}

async function assertMissing(targetPath, message) {
  try {
    await fs.stat(targetPath);
    throw new Error(message);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

async function assertExists(targetPath, message) {
  try {
    await fs.stat(targetPath);
  } catch {
    throw new Error(message);
  }
}

async function runMcpChecks() {
  const client = new Client({
    name: "tiinex-ai-vscode-tools-test",
    version: "0.1.0"
  });
  const transport = new StdioClientTransport({
    command: "node",
    args: [distServer],
    cwd: packageRoot
  });

  try {
    await client.connect(transport);

    const listFixtureRoot = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-mcp-list-sessions-"));
    try {
      const listFixtureSessionFile = path.join(listFixtureRoot, "chatSessions", "session-listed.jsonl");
      await fs.mkdir(path.dirname(listFixtureSessionFile), { recursive: true });
      await fs.writeFile(listFixtureSessionFile, '{"kind":0}\n', 'utf8');
      await writeWorkspaceStateValue(path.join(listFixtureRoot, "state.vscdb"), 'chat.ChatSessionStore.index', JSON.stringify({
        version: 1,
        entries: {
          'session-listed': {
            sessionId: 'session-listed',
            title: 'Listed Session',
            lastMessageDate: 1775930005000,
            isEmpty: false,
            isExternal: false
          }
        }
      }));

      const listResult = await client.callTool({
        name: "listSessions",
        arguments: {
          storageRoots: [listFixtureRoot],
          limit: 5,
          maxOutputChars: 4000
        }
      });
      const listText = listResult.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");
      assert(listResult.isError !== true, "MCP listSessions success test unexpectedly returned an error.");
      assert(listText.includes("session-listed"), "MCP listSessions success test did not include the indexed session id.");
      assert(listText.includes("Listed Session"), "MCP listSessions success test did not include the indexed session title.");
    } finally {
      await fs.rm(listFixtureRoot, { recursive: true, force: true });
    }

    const toolList = await client.listTools();
    const advertisedToolNames = toolList.tools.map((tool) => tool.name);
    assert(
      JSON.stringify(advertisedToolNames) === JSON.stringify(expectedToolNames),
      `MCP tool-list test did not advertise the expected tools. Got: ${advertisedToolNames.join(", ")}`
    );
    assert(!advertisedToolNames.includes("listCopilotCliSessions"), "MCP tool-list must not expose listCopilotCliSessions while Copilot CLI is out of active scope.");
    assert(!advertisedToolNames.includes("inspectCopilotCliSession"), "MCP tool-list must not expose inspectCopilotCliSession while Copilot CLI is out of active scope.");
    for (const tool of toolList.tools) {
      assert(typeof tool.title === "string" && tool.title.trim().length > 0, `MCP tool ${tool.name} is missing a title.`);
      assert(typeof tool.description === "string" && tool.description.trim().length > 0, `MCP tool ${tool.name} is missing a description.`);
      if (tool.name === "exportSessionMarkdown" || tool.name === "exportEvidenceTranscript") {
        assert(tool.annotations?.readOnlyHint === false, `MCP export tool ${tool.name} should not be marked read-only.`);
      } else {
        assert(tool.annotations?.readOnlyHint === true, `MCP read tool ${tool.name} should be marked read-only.`);
      }
    }

    const snapshotResult = await client.callTool({
      name: "getSessionSnapshot",
      arguments: {
        sessionFile: benchmarkSessionFile,
        deliveryMode: "inline-if-safe"
      }
    });
    const snapshotText = snapshotResult.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");
    assert(snapshotResult.isError !== true, "MCP snapshot test unexpectedly returned an error.");
    assert(snapshotText.includes("# Session Snapshot"), "MCP snapshot test did not return snapshot markdown.");

    const transcriptResult = await client.callTool({
      name: "exportEvidenceTranscript",
      arguments: {
        sessionFile: benchmarkSessionFile,
        deliveryMode: "inline-if-safe"
      }
    });
    const transcriptText = transcriptResult.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");
    assert(transcriptResult.isError !== true, "MCP transcript test unexpectedly returned an error.");
    assert(transcriptText.includes("# Evidence Transcript"), "MCP transcript test did not return transcript markdown.");

    const compactionFixture = await createCompactionSessionFixture();
    try {
      const filteredWindowResult = await client.callTool({
        name: "getSessionWindow",
        arguments: {
          sessionFile: compactionFixture.sessionFile,
          afterLatestCompact: true,
          anchorText: "diagnosis-start",
          anchorOccurrence: "last"
        }
      });
      const filteredWindowText = filteredWindowResult.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");
      assert(filteredWindowResult.isError !== true, "MCP filtered window test unexpectedly returned an error.");
      assert(filteredWindowText.includes("- After latest compact: yes"), "MCP filtered window test did not render the compaction scope flag.");
      assert(filteredWindowText.includes("diagnosis-start"), "MCP filtered window test did not include the anchored diagnostic row.");

      const compactionTranscriptFixture = await createCompactionTranscriptFixture();
      try {
        const filteredTranscriptResult = await client.callTool({
        name: "exportEvidenceTranscript",
        arguments: {
          sessionFile: compactionTranscriptFixture.sessionFile,
          afterLatestCompact: true,
          anchorText: "diagnosis-start",
          maxBlocks: 2,
          deliveryMode: "inline-if-safe"
        }
      });
        const filteredTranscriptText = filteredTranscriptResult.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");
        assert(filteredTranscriptResult.isError !== true, "MCP filtered transcript test unexpectedly returned an error.");
        assert(filteredTranscriptText.includes("# Evidence Transcript"), "MCP filtered transcript test did not return transcript markdown.");
        assert(filteredTranscriptText.includes("- Max blocks: 2"), "MCP filtered transcript test did not render the maxBlocks filter metadata.");
      } finally {
        await fs.rm(compactionTranscriptFixture.rootDir, { recursive: true, force: true });
      }

      const filteredEstimateResult = await client.callTool({
        name: "estimateContextBreakdown",
        arguments: {
          sessionFile: compactionFixture.sessionFile,
          afterLatestCompact: true,
          latestRequestFamilies: 1,
          deliveryMode: "inline-if-safe"
        }
      });
      const filteredEstimateText = filteredEstimateResult.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");
      assert(filteredEstimateResult.isError !== true, "MCP filtered context-estimate test unexpectedly returned an error.");
      assert(filteredEstimateText.includes("Latest request families limit: 1"), "MCP filtered context-estimate test did not render the latest request family limit.");

      const selfMatchTranscriptFixture = await createTranscriptAnchorSelfMatchFixture();
      try {
        const blockedSelfMatchTranscriptResult = await client.callTool({
          name: "exportEvidenceTranscript",
          arguments: {
            sessionFile: selfMatchTranscriptFixture.sessionFile,
            anchorText: "self-only-anchor",
            deliveryMode: "inline-if-safe"
          }
        });
        const blockedSelfMatchTranscriptText = blockedSelfMatchTranscriptResult.content
          .filter((item) => item.type === "text")
          .map((item) => item.text)
          .join("\n");
        assert(blockedSelfMatchTranscriptResult.isError === true, "MCP transcript self-match regression must return an error when the anchor appears only inside tool invocation arguments.");
        assert(blockedSelfMatchTranscriptText.includes("No transcript evidence block matched anchor text: self-only-anchor"), "MCP transcript self-match regression must report the no-match error.");

        const realAnchorTranscriptResult = await client.callTool({
          name: "exportEvidenceTranscript",
          arguments: {
            sessionFile: selfMatchTranscriptFixture.sessionFile,
            anchorText: "real-anchor",
            anchorOccurrence: "last",
            maxBlocks: 1,
            deliveryMode: "inline-if-safe"
          }
        });
        const realAnchorTranscriptText = realAnchorTranscriptResult.content
          .filter((item) => item.type === "text")
          .map((item) => item.text)
          .join("\n");
        assert(realAnchorTranscriptResult.isError !== true, "MCP transcript anchor regression must still succeed for real transcript content matches.");
        assert(realAnchorTranscriptText.includes("real-anchor resolved"), "MCP transcript anchor regression must still emit the anchored real-content slice.");
      } finally {
        await fs.rm(selfMatchTranscriptFixture.rootDir, { recursive: true, force: true });
      }
    } finally {
      await fs.rm(compactionFixture.rootDir, { recursive: true, force: true });
    }

    const blockedResult = await client.callTool({
      name: "getSessionSnapshot",
      arguments: {
        sessionFile: benchmarkSessionFile,
        deliveryMode: "file-only",
        outputFile: "/tmp/tiinex-ai-vscode-tools-test-mcp.md"
      }
    });
    const blockedText = blockedResult.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");
    assert(blockedResult.isError === true, "MCP blocked-path test did not surface an error result.");
    assert(
      blockedText.includes("Rejected outputFile outside workspace root"),
      "MCP blocked-path test did not return the expected guardrail text."
    );

    const blockedStorageRootResult = await client.callTool({
      name: "listSessions",
      arguments: {
        storageRoots: [invalidStorageRoot]
      }
    });
    const blockedStorageRootText = blockedStorageRootResult.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");
    assert(
      blockedStorageRootResult.isError === true,
      "MCP blocked storage-root test did not surface an error result."
    );
    assert(
      blockedStorageRootText.includes("Rejected storageRoot outside allowed locations"),
      "MCP blocked storage-root test did not return the expected guardrail text."
    );

  } finally {
    await transport.close();
  }
}

async function createCopilotCliSessionFixture() {
  const rootDir = path.join(workspaceRoot, "tools", ".test-copilot-cli-session-state");
  const sessionStateRoot = path.join(rootDir, "session-state");
  await fs.rm(rootDir, { recursive: true, force: true });
  await fs.mkdir(sessionStateRoot, { recursive: true });

  await writeCopilotCliFixtureSession(sessionStateRoot, {
    sessionId: "cli-session-aaa",
    summary: "fixture summary",
    cwd: "/fixture/workspace",
    updatedAt: "2026-04-09T16:00:05.000Z",
    events: [
      { type: "session.resume", data: { eventCount: 3 }, timestamp: "2026-04-09T16:00:00.000Z" },
      { type: "user.message", data: { content: "Inspect the worker lane", interactionId: "interaction-aaa" }, timestamp: "2026-04-09T16:00:01.000Z" },
      { type: "assistant.message", data: { content: "", toolRequests: [{ name: "bash" }] }, timestamp: "2026-04-09T16:00:02.000Z" },
      { type: "tool.execution_start", data: { toolName: "bash" }, timestamp: "2026-04-09T16:00:03.000Z" },
      { type: "assistant.message", data: { content: "Investigated via worker lane.", toolRequests: [] }, timestamp: "2026-04-09T16:00:04.000Z" },
      { type: "assistant.turn_end", data: { turnId: "2" }, timestamp: "2026-04-09T16:00:05.000Z" }
    ],
    mtime: new Date("2026-04-09T16:00:05.000Z")
  });

  await writeCopilotCliFixtureSession(sessionStateRoot, {
    sessionId: "cli-session-bbb",
    summary: "older fixture",
    cwd: "/fixture/older",
    updatedAt: "2026-04-09T15:00:00.000Z",
    events: [
      { type: "user.message", data: { content: "older message", interactionId: "interaction-bbb" }, timestamp: "2026-04-09T15:00:00.000Z" },
      { type: "assistant.message", data: { content: "Older reply", toolRequests: [] }, timestamp: "2026-04-09T15:00:01.000Z" },
      { type: "assistant.turn_end", data: { turnId: "1" }, timestamp: "2026-04-09T15:00:02.000Z" }
    ],
    mtime: new Date("2026-04-09T15:00:02.000Z")
  });

  return { rootDir, sessionStateRoot };
}

async function writeCopilotCliFixtureSession(sessionStateRoot, fixture) {
  const sessionDir = path.join(sessionStateRoot, fixture.sessionId);
  await fs.mkdir(sessionDir, { recursive: true });
  await fs.writeFile(path.join(sessionDir, "events.jsonl"), fixture.events.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf-8");
  await fs.writeFile(path.join(sessionDir, "workspace.yaml"), [
    `summary: ${fixture.summary}`,
    `cwd: ${fixture.cwd}`,
    `updated_at: ${fixture.updatedAt}`
  ].join("\n") + "\n", "utf-8");
  await fs.utimes(path.join(sessionDir, "events.jsonl"), fixture.mtime, fixture.mtime);
}

async function cleanupWorkspaceTempArtifacts() {
  const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
  const tempDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(".tmp-"))
    .map((entry) => path.join(workspaceRoot, entry.name));

  await Promise.all(tempDirs.map((tempDir) => fs.rm(tempDir, { recursive: true, force: true })));
}

async function runLiveToolMutexChecks() {
  const vscodeModule = await import(`${pathToFileURL(vscodeStubModulePath).href}?live-tool-mutex=${Date.now()}`);
  const vscode = vscodeModule.default ?? vscodeModule;
  const originalLm = vscode.lm;
  const originalLanguageModelToolResult = vscode.LanguageModelToolResult;
  const originalLanguageModelTextPart = vscode.LanguageModelTextPart;
  const registeredTools = new Map();

  const successResult = {
    ok: true,
    session: {
      id: "tool-mutex-session",
      title: "Tool Mutex Session",
      lastUpdated: "2026-05-10T18:30:00.000Z",
      mode: "file:///tmp/agent-architect.agent.md",
      agent: "agent-architect",
      requestAgentId: "github.copilot.editsAgent",
      requestAgentName: "GitHub Copilot",
      model: "copilot/gpt-5-mini",
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/tool-mutex-session.jsonl"
    },
    selection: {
      mode: { status: "not-requested" },
      model: { status: "not-requested" },
      agent: {
        status: "verified",
        requested: "#agent-architect",
        observed: "file:///tmp/agent-architect.agent.md"
      },
      dispatchedPrompt: "hello from mutex test",
      dispatchSurface: "direct-agent-open",
      allRequestedVerified: true
    }
  };

  let releaseFirstCreate;
  const createResponses = [
    () => new Promise((resolve) => {
      releaseFirstCreate = () => resolve(successResult);
    }),
    () => Promise.resolve(successResult),
    () => Promise.reject(new Error("Synthetic create failure.")),
    () => Promise.resolve(successResult)
  ];
  let createCallCount = 0;

  vscode.lm = {
    registerTool(name, tool) {
      registeredTools.set(name, tool);
      return { dispose() {} };
    }
  };
  vscode.LanguageModelTextPart = class LanguageModelTextPart {
    constructor(value) {
      this.value = value;
    }
  };
  vscode.LanguageModelToolResult = class LanguageModelToolResult {
    constructor(content) {
      this.content = content;
    }
  };

  try {
    const languageModelToolsModule = await import(pathToFileURL(distLanguageModelTools).href);
    const contextRoot = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-live-tool-mutex-"));
    const fakeContext = {
      subscriptions: [],
      storageUri: {
        fsPath: path.join(contextRoot, "workspaceStorage", "test-workspace")
      },
      globalStorageUri: {
        fsPath: path.join(contextRoot, "globalStorage")
      }
    };
    const fakeAdapter = new Proxy({}, { get: () => async () => "" });
    const fakeChatInterop = {
      async createChat() {
        createCallCount += 1;
        const nextResponseFactory = createResponses.shift();
        assert(nextResponseFactory, "Live tool mutex test exhausted the queued create responses unexpectedly.");
        return await nextResponseFactory();
      }
    };

    languageModelToolsModule.registerLanguageModelTools(fakeContext, fakeAdapter, fakeChatInterop);

    const createTool = registeredTools.get("create_live_agent_chat");
    assert(createTool && typeof createTool.invoke === "function", "Live tool mutex test could not capture the create_live_agent_chat tool registration.");

    const traceableTool = registeredTools.get("run_traceable_subagent");
    assert(
      traceableTool && typeof traceableTool.prepareInvocation === "function",
      "Live tool mutex test could not capture the run_traceable_subagent tool registration."
    );

    const traceableModelsTool = registeredTools.get("list_traceable_models");
    assert(
      traceableModelsTool && typeof traceableModelsTool.prepareInvocation === "function",
      "Live tool mutex test could not capture the list_traceable_models tool registration."
    );

    const traceablePrepared = traceableTool.prepareInvocation({
      input: {
        userInput: "compare plan and implementation",
        parentTask: "determine what crossed from plan into verified implementation and what remains open",
        carriedContext: {
          fileContext: ["a.ts", "b.ts"]
        },
        allowedToolNames: ["copilot_readFile"]
      }
    });

    assert(
      String(traceablePrepared?.invocationMessage ?? "") === "Trace lane: 2 files for gaps",
      `Traceable subagent invocation message must stay short and action-shaped for anchored read runs. Got: ${String(traceablePrepared?.invocationMessage ?? "")}`
    );
    assert(
      !String(traceablePrepared?.invocationMessage ?? "").includes("determine what crossed from plan into verified implementation"),
      "Traceable subagent invocation message must avoid carrying long task prose into the collapsed running row for anchored runs."
    );

    const invocationOptions = {
      input: {
        prompt: "hello from mutex test",
        agentName: "agent-architect",
        requireSelectionEvidence: false
      },
      tokenizationOptions: {
        tokenBudget: 4000
      }
    };

    const firstInvoke = createTool.invoke(invocationOptions);

    let parallelError;
    try {
      await createTool.invoke(invocationOptions);
    } catch (error) {
      parallelError = error instanceof Error ? error.message : String(error);
    }

    assert(
      typeof parallelError === "string" && parallelError.includes("Run these tools serially instead of in parallel."),
      `Live tool mutex test did not reject the parallel invocation immediately. Got: ${parallelError}`
    );
    assert(createCallCount === 1, `Live tool mutex test let a parallel invocation reach chatInterop.createChat. Got calls: ${createCallCount}`);

    releaseFirstCreate();
    const firstResult = await firstInvoke;
    assert(
      Array.isArray(firstResult.content) && String(firstResult.content[0]?.value ?? "").includes("Live Agent Chat Created"),
      "Live tool mutex test did not return the expected success result after the first invocation was released."
    );

    const secondSuccessResult = await createTool.invoke(invocationOptions);
    assert(
      Array.isArray(secondSuccessResult.content) && String(secondSuccessResult.content[0]?.value ?? "").includes("Live Agent Chat Created"),
      "Live tool mutex test did not allow a fresh invocation after the first success released the mutex."
    );

    let failureMessage;
    try {
      await createTool.invoke(invocationOptions);
    } catch (error) {
      failureMessage = error instanceof Error ? error.message : String(error);
    }

    assert(
      typeof failureMessage === "string" && failureMessage.includes("Synthetic create failure."),
      `Live tool mutex test did not surface the underlying create failure. Got: ${failureMessage}`
    );

    const recoveryResult = await createTool.invoke(invocationOptions);
    assert(
      Array.isArray(recoveryResult.content) && String(recoveryResult.content[0]?.value ?? "").includes("Live Agent Chat Created"),
      "Live tool mutex test did not release the mutex after a failing invocation."
    );
    assert(createCallCount === 4, `Live tool mutex test observed an unexpected number of createChat calls. Got: ${createCallCount}`);
  } finally {
    if (originalLm === undefined) {
      delete vscode.lm;
    } else {
      vscode.lm = originalLm;
    }

    if (originalLanguageModelToolResult === undefined) {
      delete vscode.LanguageModelToolResult;
    } else {
      vscode.LanguageModelToolResult = originalLanguageModelToolResult;
    }

    if (originalLanguageModelTextPart === undefined) {
      delete vscode.LanguageModelTextPart;
    } else {
      vscode.LanguageModelTextPart = originalLanguageModelTextPart;
    }
  }
}

const namedChecks = [
  ["cli", runCliChecks],
  ["mcp", runMcpChecks],
  ["chat-interop-capabilities", runChatInteropCapabilityChecks],
  ["chat-focus-targets", runChatFocusTargetChecks],
  ["editor-focus-commands", runEditorFocusCommandChecks],
  ["editor-tab-matcher", runEditorTabMatcherChecks],
  ["self-target-guard", runSelfTargetGuardChecks],
  ["chat-interop-selection", runChatInteropSelectionChecks],
  ["focused-send", runFocusedSendBehaviorChecks],
  ["create-chat-direct-agent-command", runCreateChatDirectAgentCommandChecks],
  ["delete-chat-safety", runDeleteChatSafetyChecks],
  ["chat-session-storage-delta", runChatSessionStorageDeltaChecks],
  ["offline-local-chat-cleanup", runOfflineLocalChatCleanupChecks],
  ["runtime-file-hygiene", runRuntimeFileHygieneChecks],
  ["session-send-workflow", runSessionSendWorkflowChecks],
  ["live-chat-quiescence", runLiveChatQuiescenceChecks],
  ["live-tool-mutex", runLiveToolMutexChecks],
  ["live-chat-support-matrix", runLiveChatSupportMatrixChecks],
  ["local-to-copilot-cli-handoff", runLocalToCopilotCliHandoffChecks],
  ["pending-request-heuristics", runPendingRequestHeuristicChecks],
  ["copilot-cli-inspection", runCopilotCliInspectionChecks],
  ["agent-architect-process-evidence", runAgentArchitectProcessEvidenceChecks],
  ["traceable-subagent", runTraceableSubagentChecks],
  ["manifest", runManifestChecks],
  ["routing-guard", runRoutingGuardChecks]
];

const optInNamedChecks = [
  ["live-chat-quiescence-workspace", runLiveChatWorkspaceQuiescenceProbe]
];

const allNamedChecks = [...namedChecks, ...optInNamedChecks];
const namedCheckMap = new Map(allNamedChecks);

async function runDefaultChecksIsolated() {
  for (const [checkName] of namedChecks) {
    try {
      await execFileAsync(process.execPath, [fileURLToPath(import.meta.url), checkName], {
        cwd: workspaceRoot,
        env: process.env
      });
    } catch (error) {
      const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
      const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
      const output = [stdout, stderr].filter(Boolean).join('\n');
      throw new Error(output || `Default test check \"${checkName}\" failed.`);
    }
  }
}

function resolveSelectedChecks(argv) {
  if (argv.length === 0) {
    return namedChecks;
  }

  return argv.map((checkName) => {
    const runner = namedCheckMap.get(checkName);
    if (!runner) {
      throw new Error(`Unknown test check \"${checkName}\". Available checks: ${allNamedChecks.map(([name]) => name).join(", ")}`);
    }
    return [checkName, runner];
  });
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    await cleanupWorkspaceTempArtifacts();
    await runDefaultChecksIsolated();
    process.stdout.write("Tests passed.\n");
    await cleanupWorkspaceTempArtifacts();
    return;
  }

  await cleanupWorkspaceTempArtifacts();
  const selectedChecks = resolveSelectedChecks(argv);

  try {
    for (const [, runner] of selectedChecks) {
      await runner();
    }
    process.stdout.write("Tests passed.\n");
  } finally {
    await cleanupWorkspaceTempArtifacts();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});