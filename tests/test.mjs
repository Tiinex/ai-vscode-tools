import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const execFileAsync = promisify(execFile);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const workspaceRoot = packageRoot;
const distCli = path.join(packageRoot, "dist", "tooling", "cli.js");
const distServer = path.join(packageRoot, "dist", "tooling", "mcp-server.js");
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
const distChatInteropStabilizedCreateWorkflow = path.join(packageRoot, "dist", "chatInterop", "stabilizedCreateWorkflow.js");
const distOfflineLocalChatCleanup = path.join(packageRoot, "dist", "offlineLocalChatCleanup.js");
const distFirstSlice = path.join(packageRoot, "dist", "firstSlice.js");
const distCopilotCliSummary = path.join(packageRoot, "dist", "chatInterop", "copilotCliSummary.js");
const distLocalToCopilotCliHandoff = path.join(packageRoot, "dist", "chatInterop", "localToCopilotCliHandoff.js");
const distCopilotCliTooling = path.join(packageRoot, "dist", "tooling", "copilot-cli.js");
const distAgentArchitectProcessEvidence = path.join(packageRoot, "dist", "tooling", "agentArchitectProcessEvidence.js");
const distToolingCore = path.join(packageRoot, "dist", "tooling", "core.js");
const packageJsonPath = path.join(packageRoot, "package.json");
const readmePath = path.join(packageRoot, "README.md");
const languageModelToolsSourcePath = path.join(packageRoot, "src", "languageModelTools.ts");
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
  "list_live_agent_chats",
  "create_live_agent_chat",
  "close_visible_live_chat_tabs",
  "delete_live_agent_chat_artifacts",
  "send_message_to_live_agent_chat",
  "send_message_to_focused_live_chat",
  "reveal_live_agent_chat"
];

const expectedExtensionCommandNames = [
  "aiRecoveryTooling.refreshSessions",
  "aiRecoveryTooling.openLatestSnapshot",
  "aiRecoveryTooling.openLatestTranscriptEvidence",
  "aiRecoveryTooling.openLatestContextEstimate",
  "aiRecoveryTooling.openLatestProfile",
  "aiRecoveryTooling.surveyRecentSessions",
  "aiRecoveryTooling.openTranscriptEvidence",
  "aiRecoveryTooling.openSnapshot",
  "aiRecoveryTooling.openContextEstimate",
  "aiRecoveryTooling.openProfile",
  "aiRecoveryTooling.openIndex",
  "aiRecoveryTooling.openSessionFile",
  "aiRecoveryTooling.listLiveChats",
  "aiRecoveryTooling.revealLiveChat",
  "aiRecoveryTooling.closeVisibleLiveChatTabs",
  "aiRecoveryTooling.deleteLiveChatArtifacts",
  "aiRecoveryTooling.scheduleOfflineLocalChatCleanup",
  "aiRecoveryTooling.createLiveChat",
  "aiRecoveryTooling.sendMessageToLiveChat",
  "aiRecoveryTooling.sendMessageToFocusedLiveChat"
];

let sqlJsPromise;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
      "/tmp/agent-architect-tools-test.md"
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
    buildUnsupportedSendReason,
    findFocusedChatInputCommand,
    findFocusedChatSubmitCommand,
    getExactSessionInteropSupport,
    getFocusedChatInteropSupport,
    findExactSessionOpenCommand,
    findExactSessionSendCommand
  } = capabilitiesModule;

  assert(
    findExactSessionOpenCommand(["workbench.action.chat.openSession"]) === "workbench.action.chat.openSession",
    "Chat interop capability test did not prefer the generic openSession command when it exists."
  );

  assert(
    findExactSessionOpenCommand(["workbench.action.chat.openSessionInEditorGroup"]) === "workbench.action.chat.openSessionInEditorGroup",
    "Chat interop capability test did not accept the editor-group session-open command as a valid Local reveal surface."
  );

  assert(
    findExactSessionSendCommand([
      "workbench.action.chat.openSessionWithPrompt",
      "workbench.action.chat.openSessionWithPrompt.copilotcli"
    ]) === "workbench.action.chat.openSessionWithPrompt",
    "Chat interop capability test did not prefer the generic openSessionWithPrompt command over the CLI-specific variant."
  );

  assert(
    findExactSessionSendCommand(["workbench.action.chat.openSessionWithPrompt.copilotcli"]) === undefined,
    "Chat interop capability test incorrectly treated the CLI-specific openSessionWithPrompt command as valid for ordinary local chats."
  );

  assert(
    buildUnsupportedRevealReason(["workbench.action.chat.openSession.copilotcli"]).includes("Copilot CLI-specific openSession command"),
    "Chat interop capability test did not explain the CLI-only reveal limitation."
  );

  assert(
    buildUnsupportedSendReason(["workbench.action.chat.openSessionWithPrompt.copilotcli"]).includes("Copilot CLI-specific openSessionWithPrompt command"),
    "Chat interop capability test did not explain the CLI-only send limitation."
  );

  assert(
    buildUnsupportedSendReason([]).includes("No generic internal openSessionWithPrompt chat command"),
    "Chat interop capability test did not report the missing generic send command boundary case."
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
    genericSupport.canRevealExactSession === true && genericSupport.canSendExactSessionMessage === true,
    "Chat interop capability test did not report generic exact-session support correctly."
  );

  const cliOnlySupport = getExactSessionInteropSupport([
    "workbench.action.chat.openSessionWithPrompt.copilotcli"
  ]);
  assert(
    cliOnlySupport.canRevealExactSession === false && cliOnlySupport.canSendExactSessionMessage === false,
    "Chat interop capability test incorrectly marked CLI-only exact-session support as available for ordinary local chats."
  );
  assert(
    cliOnlySupport.sendUnsupportedReason?.includes("Copilot CLI-specific openSessionWithPrompt command") === true,
    "Chat interop capability test did not preserve the CLI-only unsupported reason in the support summary."
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
  assert(promptFileContent.endsWith("Inspect the target artifact.\n"), "Prompt-file dispatch test did not preserve the original prompt body.");

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
    }) === undefined,
    "Live chat selection blocker test should allow partialQuery custom-agent create requests as the current best-effort prompt-file start."
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
    })?.includes("without an explicit agent is unsafe") === true,
    "Live chat selection blocker test did not block a plain createChat after the observed inherited-mode neutral-create failure."
  );

  assert(
    buildCreateChatSelectionBlocker({
      prompt: "Inspect the target artifact.",
      agentName: "agent-architect",
      requireSelectionEvidence: true
    })?.includes("cannot independently verify actual participant selection") === true,
    "Live chat selection blocker test did not preserve the verified-participant blocker for current create-time custom-agent starts."
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
      return seq[idx] || [];
    }
    async getSessionById(sessionId) {
      const last = (MockChatSessionStorage._behaviors || []).slice(-1)[0] || [];
      return last.find((s) => s.id === sessionId);
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
    vscodeModule.commands.getCommands = async () => [
      'workbench.action.chat.focusInput',
      'workbench.action.chat.submit'
    ];
    vscodeModule.commands.executeCommand = async () => undefined;

    const serviceModule = await import(pathToFileURL(distChatInteropService).href);
    const { ChatInteropService } = serviceModule;

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
    assert(nbResult.ok === true, 'Non-blocking focused-send did not succeed when persisted touch occurred');
    assert(nbResult.session && nbResult.session.id === 's1', 'Non-blocking focused-send returned wrong session id');

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
    storageModule.ChatSessionStorage = originalChatSessionStorage;
  }

}

async function runCreateChatDirectAgentCommandChecks() {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const vscodeModule = require('vscode');
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
    const { ChatInteropService } = serviceModule;
    const service = new ChatInteropService({}, { postCreateDelayMs: 10, postCreateTimeoutMs: 250 });

    const result = await service.createChat({
      prompt: 'Create a local recovery tooling helper named artifact-list-item-checker using the provided build input.',
      agentName: 'agent-architect',
      requireSelectionEvidence: false,
      blockOnResponse: true
    });

    assert(result.ok === true, 'Direct agent-open createChat test did not succeed when a session was created and settled.');
    assert(executedCommands[0]?.command === 'workbench.action.openChat', 'Direct agent-open createChat test did not open a new chat editor first.');
    assert(executedCommands[1]?.command === 'workbench.action.chat.openagent-architect', 'Direct agent-open createChat test did not prefer the runtime openagent-architect command.');
  assert(executedCommands[2]?.command === 'workbench.action.chat.focusInput', 'Direct agent-open createChat test did not focus the newly opened chat before dispatch.');
  assert(executedCommands[3]?.command === 'workbench.action.chat.open', 'Direct agent-open createChat test did not prefill the focused chat input after opening the direct agent chat.');
  assert(executedCommands[3]?.args?.query === 'Create a local recovery tooling helper named artifact-list-item-checker using the provided build input.', 'Direct agent-open createChat test did not preserve the original prompt body.');
  assert(executedCommands[3]?.args?.isPartialQuery === true, 'Direct agent-open createChat test did not use partial-query prefill for the focused submit path.');
  assert(executedCommands[4]?.command === 'workbench.action.chat.submit', 'Direct agent-open createChat test did not submit the focused chat after prefilling it.');

    executedCommands.length = 0;
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
  } finally {
    storageModule.ChatSessionStorage = originalChatSessionStorage;
    vscodeModule.commands.executeCommand = originalExecuteCommand;
    vscodeModule.commands.getCommands = originalGetCommands;
  }
}

async function runChatSessionStorageDeltaChecks() {
  const storageModule = await import(pathToFileURL(distChatInteropStorage).href);
  const { ChatSessionStorage } = storageModule;

  const tempDir = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-storage-delta-"));
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

  const deleteTargetSessionFile = path.join(chatSessionsDir, 'session-3.jsonl');
  const deleteTargetEditingFile = path.join(scopedWorkspaceRoot, 'chatEditingSessions', 'session-3.jsonl');
  const deleteTargetTranscriptFile = path.join(scopedWorkspaceRoot, 'transcripts', 'session-3.jsonl');
  const deleteTargetNestedTranscriptFile = path.join(scopedWorkspaceRoot, 'GitHub.copilot-chat', 'transcripts', 'session-3.jsonl');
  const deleteTargetResourceDir = path.join(scopedWorkspaceRoot, 'GitHub.copilot-chat', 'chat-session-resources', 'session-3');
  const stateDbPath = path.join(scopedWorkspaceRoot, 'state.vscdb');
  const backupStateDbPath = path.join(scopedWorkspaceRoot, 'state.vscdb.backup');
  await fs.mkdir(path.dirname(deleteTargetEditingFile), { recursive: true });
  await fs.mkdir(path.dirname(deleteTargetTranscriptFile), { recursive: true });
  await fs.mkdir(path.dirname(deleteTargetNestedTranscriptFile), { recursive: true });
  await fs.mkdir(deleteTargetResourceDir, { recursive: true });
  await fs.writeFile(deleteTargetSessionFile, `${JSON.stringify({ kind: 0, v: { sessionId: 'session-3', requests: [], inputState: {} } })}\n`, 'utf8');
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
  assert(deletionReport.deletedPaths.includes(deleteTargetEditingFile), 'Storage deletion test did not delete the chatEditingSessions JSONL file.');
  assert(deletionReport.deletedPaths.includes(deleteTargetTranscriptFile), 'Storage deletion test did not delete the top-level transcript JSONL file.');
  assert(deletionReport.deletedPaths.includes(deleteTargetNestedTranscriptFile), 'Storage deletion test did not delete the nested GitHub.copilot-chat transcript JSONL file.');
  assert(deletionReport.deletedPaths.includes(deleteTargetResourceDir), 'Storage deletion test did not delete the chat-session-resources directory.');
  await assertMissing(deleteTargetSessionFile, 'Storage deletion test left the chatSessions JSONL file on disk.');
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

  await fs.rm(tempDir, { recursive: true, force: true });
}

async function runStabilizedCreateWorkflowChecks() {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const vscodeModule = require("vscode");
  vscodeModule.workspace = vscodeModule.workspace || {};
  vscodeModule.Uri = vscodeModule.Uri || {};
  vscodeModule.Uri.file = vscodeModule.Uri.file || ((fsPath) => ({
    fsPath,
    toString: () => pathToFileURL(fsPath).href
  }));

  const workflowModule = await import(pathToFileURL(distChatInteropStabilizedCreateWorkflow).href);
  const { createStabilizedChatAndSend } = workflowModule;

  const tempDir = await fs.mkdtemp(path.join(workspaceRoot, ".tmp-stabilized-flow-"));
  const workspaceRuntimeAgentDir = path.join(tempDir, ".github", "agents");
  const companionDir = path.join(workspaceRuntimeAgentDir, "companions");
  const chatSessionsDir = path.join(tempDir, "chatSessions");
  await fs.mkdir(workspaceRuntimeAgentDir, { recursive: true });
  await fs.mkdir(companionDir, { recursive: true });
  await fs.mkdir(chatSessionsDir, { recursive: true });

  const agentFile = path.join(workspaceRuntimeAgentDir, "support-doc.fresh-reader.agent.md");
  await fs.writeFile(agentFile, "# test\n", "utf8");
  const targetSessionFile = path.join(chatSessionsDir, "session-1.jsonl");
  await fs.writeFile(targetSessionFile, JSON.stringify({ kind: 0, v: { sessionId: "session-1", requests: [], inputState: {} } }), "utf8");
  const siblingModelFile = path.join(chatSessionsDir, "session-2.jsonl");
  await fs.writeFile(
    siblingModelFile,
    `${JSON.stringify({ kind: 1, k: ["inputState", "selectedModel"], v: { identifier: "copilot/gpt-5.4", metadata: { name: "GPT-5.4" } } })}\n`,
    "utf8"
  );

  vscodeModule.workspace.workspaceFolders = [{ uri: { fsPath: tempDir } }];
  const expectedAgentFileUri = pathToFileURL(agentFile).href;

  const sentRequests = [];
  const chatInterop = {
    async listChats() {
      return [{
        id: "session-1",
        title: "Stabilized Session",
        lastUpdated: "2026-04-11T20:30:00.000Z",
        mode: "agent",
        agent: "github.copilot.editsAgent",
        model: "copilot/gpt-5-mini",
        archived: false,
        provider: "workspaceStorage",
        sessionFile: targetSessionFile
      }];
    },
    async getExactSessionInteropSupport() {
      return {
        canRevealExactSession: true,
        canSendExactSessionMessage: true,
        revealUnsupportedReason: undefined,
        sendUnsupportedReason: undefined
      };
    },
    async getFocusedChatInteropSupport() {
      return {
        canSubmitFocusedChatMessage: true,
        focusInputCommand: "workbench.action.chat.focusInput",
        submitCommand: "workbench.action.chat.submit",
        unsupportedReason: undefined
      };
    },
    async createChat() {
      return {
        ok: true,
        session: {
          id: "session-1",
          title: "Stabilized Session",
          lastUpdated: "2026-04-11T20:30:00.000Z",
          mode: "agent",
          agent: "github.copilot.editsAgent",
          model: "copilot/gpt-5-mini",
          archived: false,
          provider: "workspaceStorage",
          sessionFile: targetSessionFile
        },
        selection: {
          mode: { status: "mismatch", requested: expectedAgentFileUri, observed: "agent" },
          model: { status: "mismatch", requested: "copilot/gpt-5.4", observed: "copilot/gpt-5-mini" },
          agent: { status: "mismatch", requested: "#support-doc.fresh-reader", observed: "github.copilot.editsAgent" },
          dispatchedPrompt: "seed",
          dispatchSurface: "prompt-file-slash-command",
          dispatchedSlashCommand: "/tmp",
          allRequestedVerified: false
        }
      };
    },
    async sendMessage(request) {
      sentRequests.push(request);
      return {
        ok: true,
        session: {
          id: "session-1",
          title: "Stabilized Session",
          lastUpdated: "2026-04-11T20:31:00.000Z",
          mode: expectedAgentFileUri,
          agent: "support-doc.fresh-reader",
          model: "copilot/gpt-5.4",
          archived: false,
          provider: "workspaceStorage",
          sessionFile: targetSessionFile
        },
        selection: {
          mode: { status: "verified", requested: expectedAgentFileUri, observed: expectedAgentFileUri },
          model: { status: "verified", requested: "copilot/gpt-5.4", observed: "copilot/gpt-5.4" },
          agent: { status: "verified", requested: "#support-doc.fresh-reader", observed: "support-doc.fresh-reader" },
          dispatchedPrompt: request.prompt,
          dispatchSurface: "chat-open",
          allRequestedVerified: true
        }
      };
    },
    async sendFocusedMessage() {
      throw new Error("sendFocusedMessage should not be used when exact send is available in the stabilized workflow test.");
    },
    async closeVisibleTabs() {
      return { ok: true };
    },
    async revealChat() {
      return { ok: true };
    }
  };

  const result = await createStabilizedChatAndSend(chatInterop, {
    prompt: "real prompt",
    agentName: "support-doc.fresh-reader",
    modelSelector: { id: "gpt-5.4", vendor: "copilot" },
    blockOnResponse: true,
    requireSelectionEvidence: false
  });

  const targetSessionRaw = await fs.readFile(targetSessionFile, "utf8");
  const parsedPatchedRows = targetSessionRaw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert(sentRequests.length === 1, "Stabilized workflow test did not send the real prompt exactly once.");
  assert(sentRequests[0].prompt === "real prompt", "Stabilized workflow test did not preserve the real prompt for the final send.");
  assert(sentRequests[0].agentName === "support-doc.fresh-reader", "Stabilized workflow test did not preserve the requested agent name for the final send.");
  assert(sentRequests[0].mode === undefined, `Stabilized workflow test should keep the follow-up send prompt-only after mode stabilization. Got: ${sentRequests[0].mode}`);
  assert(sentRequests[0].modelSelector === undefined, "Stabilized workflow test should keep the follow-up send prompt-only after model stabilization.");
  assert(result.resolvedModeId === expectedAgentFileUri, `Stabilized workflow test did not resolve the workspace runtime-agent file URI. Got: ${result.resolvedModeId}`);
  assert(result.patchedModeId === expectedAgentFileUri, "Stabilized workflow test did not report the applied mode patch.");
  assert(result.patchedModelId === "copilot/gpt-5.4", "Stabilized workflow test did not report the applied model patch.");
  assert(targetSessionRaw.endsWith("\n"), "Stabilized workflow test did not preserve newline-terminated JSONL after patching.");
  assert(parsedPatchedRows.length === 3, `Stabilized workflow test did not keep the session file parseable JSONL. Got ${parsedPatchedRows.length} rows.`);
  assert(targetSessionRaw.includes(`"id":"${expectedAgentFileUri}"`), "Stabilized workflow test did not append the requested mode patch to the session file.");
  assert(targetSessionRaw.includes('"identifier":"copilot/gpt-5.4"'), "Stabilized workflow test did not append the requested selectedModel patch to the session file.");

  const companionOnlyFile = path.join(companionDir, "companion-only.agent.test.md");
  await fs.writeFile(companionOnlyFile, "# companion-only test\n", "utf8");
  const companionOnlySessionFile = path.join(chatSessionsDir, "session-3.jsonl");
  await fs.writeFile(companionOnlySessionFile, JSON.stringify({ kind: 0, v: { sessionId: "session-3", requests: [], inputState: {} } }), "utf8");

  const companionOnlyRequests = [];
  const companionOnlyInterop = {
    async createChat() {
      return {
        ok: true,
        session: {
          id: "session-3",
          title: "Companion Only Session",
          lastUpdated: "2026-04-12T22:30:00.000Z",
          mode: "agent",
          agent: "github.copilot.editsAgent",
          model: "copilot/gpt-5-mini",
          archived: false,
          provider: "workspaceStorage",
          sessionFile: companionOnlySessionFile
        },
        selection: {
          mode: { status: "mismatch", requested: undefined, observed: "agent" },
          model: { status: "verified", requested: undefined, observed: "copilot/gpt-5-mini" },
          agent: { status: "mismatch", requested: "#companion-only", observed: "github.copilot.editsAgent" },
          dispatchedPrompt: "seed",
          dispatchSurface: "prompt-file-slash-command",
          dispatchedSlashCommand: "/tmp",
          allRequestedVerified: false
        }
      };
    },
    async listChats() {
      return [{
        id: "session-3",
        title: "Companion Only Session",
        lastUpdated: "2026-04-12T22:30:00.000Z",
        mode: "agent",
        agent: "github.copilot.editsAgent",
        model: "copilot/gpt-5-mini",
        archived: false,
        provider: "workspaceStorage",
        sessionFile: companionOnlySessionFile
      }];
    },
    async getExactSessionInteropSupport() {
      return {
        canRevealExactSession: true,
        canSendExactSessionMessage: true,
        revealUnsupportedReason: undefined,
        sendUnsupportedReason: undefined
      };
    },
    async getFocusedChatInteropSupport() {
      return {
        canSubmitFocusedChatMessage: true,
        focusInputCommand: "workbench.action.chat.focusInput",
        submitCommand: "workbench.action.chat.submit",
        unsupportedReason: undefined
      };
    },
    async sendMessage(request) {
      companionOnlyRequests.push(request);
      return {
        ok: true,
        session: {
          id: "session-3",
          title: "Companion Only Session",
          lastUpdated: "2026-04-12T22:31:00.000Z",
          mode: "agent",
          agent: "github.copilot.editsAgent",
          model: "copilot/gpt-5-mini",
          archived: false,
          provider: "workspaceStorage",
          sessionFile: companionOnlySessionFile
        },
        selection: {
          mode: { status: "verified", requested: undefined, observed: "agent" },
          model: { status: "verified", requested: undefined, observed: "copilot/gpt-5-mini" },
          agent: { status: "mismatch", requested: "#companion-only", observed: "github.copilot.editsAgent" },
          dispatchedPrompt: request.prompt,
          dispatchSurface: "chat-open",
          allRequestedVerified: false
        }
      };
    },
    async sendFocusedMessage() {
      throw new Error("sendFocusedMessage should not be used in the companion-only stabilized workflow test.");
    },
    async closeVisibleTabs() {
      return { ok: true };
    },
    async revealChat() {
      return { ok: true };
    }
  };

  const companionOnlyResult = await createStabilizedChatAndSend(companionOnlyInterop, {
    prompt: "companion only prompt",
    agentName: "companion-only",
    blockOnResponse: true,
    requireSelectionEvidence: false
  });

  const companionOnlySessionRaw = await fs.readFile(companionOnlySessionFile, "utf8");
  assert(companionOnlyRequests.length === 1, "Companion-only stabilized workflow test did not send the real prompt exactly once.");
  assert(companionOnlyRequests[0].mode === undefined, `Companion-only stabilized workflow test should not resolve a workspace runtime mode from a companion file. Got: ${companionOnlyRequests[0].mode}`);
  assert(companionOnlyResult.resolvedModeId === undefined, `Companion-only stabilized workflow test incorrectly resolved a workspace runtime mode from a companion file. Got: ${companionOnlyResult.resolvedModeId}`);
  assert(companionOnlyResult.patchedModeId === undefined, "Companion-only stabilized workflow test should not patch mode from a companion file pretending to be a workspace runtime agent.");
  assert(companionOnlySessionRaw === JSON.stringify({ kind: 0, v: { sessionId: "session-3", requests: [], inputState: {} } }), "Companion-only stabilized workflow test should not patch the session file when no runtime agent exists.");

  await fs.rm(tempDir, { recursive: true, force: true });
}

async function runOfflineLocalChatCleanupChecks() {
  const cleanupModule = await import(pathToFileURL(distOfflineLocalChatCleanup).href);
  const globalStorageDir = path.join(workspaceRoot, ".tmp-offline-cleanup-global");
  const reportFilePath = cleanupModule.getOfflineLocalChatCleanupReportPath(globalStorageDir);
  const spec = cleanupModule.buildOfflineLocalChatCleanupLaunchSpec({
    extensionRoot: packageRoot,
    workspaceStorageDir: "C:/tmp/workspaceStorage/example",
    keepSessionIds: ["session-keep-1", "session-keep-2"],
    reportFilePath
  });

  assert(spec.executable === "powershell.exe", "Offline cleanup launch test did not target powershell.exe.");
  assert(spec.args.includes("-File"), "Offline cleanup launch test did not include the script file switch.");
  assert(spec.args.includes(path.join(packageRoot, "tools", "schedule-local-chat-state-cleanup.ps1")), "Offline cleanup launch test did not point at the scheduler script.");
  assert(spec.args.includes("-WorkspaceStorageDir") && spec.args.includes("C:/tmp/workspaceStorage/example"), "Offline cleanup launch test did not preserve the workspace storage directory.");
  assert(spec.args.filter((value) => value === "-KeepSessionId").length === 2, "Offline cleanup launch test did not emit one KeepSessionId argument per preserved session.");
  assert(spec.options.detached === true && spec.options.stdio === "ignore", "Offline cleanup launch test did not configure detached background execution.");

  await fs.mkdir(globalStorageDir, { recursive: true });
  await fs.writeFile(reportFilePath, `${JSON.stringify([
    {
      dbPath: "state.vscdb",
      removedIndexEntries: 5,
      removedModelEntries: 5,
      removedStateEntries: 11,
      removedTodoEntries: 1
    },
    {
      dbPath: "state.vscdb.backup",
      removedIndexEntries: 5,
      removedModelEntries: 5,
      removedStateEntries: 11,
      removedTodoEntries: 1
    }
  ])}\n`, "utf8");

  const summary = await cleanupModule.readAndDeleteOfflineLocalChatCleanupReport(reportFilePath);
  assert(summary && summary.reports.length === 2, "Offline cleanup report test did not read the stored report payload.");
  await assertMissing(reportFilePath, "Offline cleanup report test did not remove the consumed report file.");
  assert(
    cleanupModule.formatOfflineLocalChatCleanupSummary(summary).includes("Removed state cache entries: 22."),
    "Offline cleanup summary test did not aggregate report totals."
  );

  await fs.rm(globalStorageDir, { recursive: true, force: true });
}

async function runSessionSendWorkflowChecks() {
  const workflowModule = await import(pathToFileURL(distChatInteropSessionSendWorkflow).href);
  const { canTrustGenericActiveChatAfterReveal, sendMessageToSessionWithFallback } = workflowModule;

  assert(
    canTrustGenericActiveChatAfterReveal({
      activeGroupIndex: 0,
      liveChatTitles: ["Live chat support documentation inquiry"],
      groups: [
        {
          isActive: true,
          viewColumn: 1,
          tabs: [
            {
              label: "Chat",
              isActive: true,
              isDirty: false,
              isPinned: false,
              isPreview: false,
              isLikelyChatEditor: true,
              input: {
                kind: "custom:chat-view",
                constructorName: "ChatEditorInput",
                uri: undefined,
                viewType: "chat-view",
                stringHints: ["chat"],
                objectKeys: []
              }
            }
          ]
        }
      ]
    }) === true,
    "Session send workflow test did not accept a generic active Chat tab after exact reveal when chat-editor evidence was present."
  );

  assert(
    canTrustGenericActiveChatAfterReveal({
      activeGroupIndex: 0,
      liveChatTitles: ["Live chat support documentation inquiry"],
      groups: [
        {
          isActive: true,
          viewColumn: 1,
          tabs: [
            {
              label: "Chat",
              isActive: true,
              isDirty: false,
              isPinned: false,
              isPreview: false,
              isLikelyChatEditor: false,
              input: {
                kind: "Sm",
                constructorName: "Sm",
                uri: undefined,
                viewType: undefined,
                stringHints: [],
                objectKeys: []
              }
            }
          ]
        }
      ]
    }) === false,
    "Session send workflow test incorrectly trusted a generic Chat label without chat-editor evidence after reveal."
  );

  assert(
    canTrustGenericActiveChatAfterReveal({
      activeGroupIndex: 0,
      liveChatTitles: ["Live chat support documentation inquiry"],
      groups: [
        {
          isActive: true,
          viewColumn: 1,
          tabs: [
            {
              label: "README.md",
              isActive: true,
              isDirty: false,
              isPinned: false,
              isPreview: false,
              isLikelyChatEditor: false,
              input: {
                kind: "TabInputText",
                constructorName: "TabInputText",
                uri: "file:///tmp/README.md",
                viewType: undefined,
                stringHints: [],
                objectKeys: []
              }
            }
          ]
        }
      ]
    }) === false,
    "Session send workflow test incorrectly trusted a non-chat active tab after reveal."
  );

  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const vscodeModule = require('vscode');
  const originalWindow = vscodeModule.window;
  const originalExecuteCommand = vscodeModule.commands.executeCommand;
  const originalGetCommands = vscodeModule.commands.getCommands;

  let revealCalls = 0;
  let focusedSendCalls = 0;
  let sessionLastUpdated = '2026-04-11T04:00:00.000Z';
  let activeChatLabel = 'Retry Target';

  try {
    vscodeModule.window = vscodeModule.window || {};
    Object.defineProperty(vscodeModule.window, 'tabGroups', {
      configurable: true,
      value: {
        get all() {
          if (revealCalls < 2) {
            return [
              {
                isActive: true,
                viewColumn: 1,
                tabs: [
                  {
                    label: 'README.md',
                    isActive: true,
                    isDirty: false,
                    isPinned: false,
                    isPreview: false,
                    input: {
                      constructor: { name: 'TabInputText' },
                      uri: { toString: () => 'file:///tmp/README.md' }
                    }
                  }
                ]
              }
            ];
          }

          return [
            {
              isActive: true,
              viewColumn: 1,
              tabs: [
                {
                  label: activeChatLabel,
                  isActive: true,
                  isDirty: false,
                  isPinned: false,
                  isPreview: false,
                  input: {
                    constructor: { name: 'TabInputCustom' },
                    viewType: 'github.copilot.chat.editor'
                  }
                }
              ]
            }
          ];
        }
      }
    });
    vscodeModule.commands.getCommands = async () => ['workbench.action.focusActiveEditorGroup'];
    vscodeModule.commands.executeCommand = async () => undefined;

    const retryInterop = {
      async listChats() {
        return [{
          id: 'session-retry',
          title: 'Retry Target',
          lastUpdated: sessionLastUpdated,
          mode: 'agent',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-retry.jsonl'
        }];
      },
      async getExactSessionInteropSupport() {
        return {
          canRevealExactSession: true,
          canSendExactSessionMessage: false,
          revealUnsupportedReason: undefined,
          sendUnsupportedReason: 'Exact session-targeted Local send is unsupported on this build.'
        };
      },
      async revealChat() {
        revealCalls += 1;
        return {
          ok: true,
          session: {
            id: 'session-retry',
            title: 'Retry Target',
            lastUpdated: sessionLastUpdated,
            mode: 'agent',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: '/tmp/session-retry.jsonl'
          },
          revealLifecycle: {
            closedMatchingVisibleTabs: 0,
            closedTabLabels: []
          }
        };
      },
      async sendFocusedMessage() {
        focusedSendCalls += 1;
        sessionLastUpdated = '2026-04-11T04:00:01.000Z';
        return {
          ok: true,
          session: {
            id: 'session-retry',
            title: 'Retry Target',
            lastUpdated: sessionLastUpdated,
            mode: 'agent',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            hasPendingEdits: false,
            pendingRequestCount: 0,
            lastRequestCompleted: true,
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: '/tmp/session-retry.jsonl'
          },
          dispatch: {
            surface: 'focused-chat-submit',
            dispatchedPrompt: 'retry prompt'
          }
        };
      }
    };

    const retriedFocusResult = await sendMessageToSessionWithFallback(retryInterop, {
      sessionId: 'session-retry',
      prompt: 'retry prompt',
      blockOnResponse: false
    });

    assert(retriedFocusResult.result.ok === true, 'Session send workflow test did not recover by revealing the target chat again after focus was lost.');
    assert(revealCalls === 2, `Session send workflow test did not retry reveal after the first focus miss. Got: ${revealCalls}`);
    assert(focusedSendCalls === 1, `Session send workflow test did not send exactly once after the reveal retry. Got: ${focusedSendCalls}`);

    let timeoutListChatsCalls = 0;
    activeChatLabel = 'Timeout Target';
    const timeoutInterop = {
      async listChats() {
        timeoutListChatsCalls += 1;
        return [{
          id: 'session-timeout',
          title: 'Timeout Target',
          lastUpdated: timeoutListChatsCalls >= 2 ? '2026-04-11T05:00:01.000Z' : '2026-04-11T05:00:00.000Z',
          mode: 'agent',
          agent: 'github.copilot.editsAgent',
          model: 'copilot/gpt-5-mini',
          hasPendingEdits: false,
          pendingRequestCount: 0,
          lastRequestCompleted: true,
          archived: false,
          provider: 'workspaceStorage',
          sessionFile: '/tmp/session-timeout.jsonl'
        }];
      },
      async getExactSessionInteropSupport() {
        return {
          canRevealExactSession: true,
          canSendExactSessionMessage: false,
          revealUnsupportedReason: undefined,
          sendUnsupportedReason: 'Exact session-targeted Local send is unsupported on this build.'
        };
      },
      async revealChat() {
        return {
          ok: true,
          session: {
            id: 'session-timeout',
            title: 'Timeout Target',
            lastUpdated: '2026-04-11T05:00:00.000Z',
            mode: 'agent',
            agent: 'github.copilot.editsAgent',
            model: 'copilot/gpt-5-mini',
            archived: false,
            provider: 'workspaceStorage',
            sessionFile: '/tmp/session-timeout.jsonl'
          },
          revealLifecycle: {
            closedMatchingVisibleTabs: 0,
            closedTabLabels: []
          }
        };
      },
      async sendFocusedMessage() {
        return {
          ok: false,
          reason: 'Focused chat submit dispatched but no persisted session mutation was observed within the expected timeout.'
        };
      }
    };

    const timedOutResult = await sendMessageToSessionWithFallback(timeoutInterop, {
      sessionId: 'session-timeout',
      prompt: 'timeout prompt',
      blockOnResponse: true
    });

    assert(timedOutResult.result.ok === false, 'Session send workflow test incorrectly continued after a focused-send timeout.');
    assert(
      typeof timedOutResult.result.reason === 'string' && timedOutResult.result.reason.includes('diagnostic failures'),
      'Session send workflow test did not mark timeout as a diagnostic failure.'
    );
    assert(
      typeof timedOutResult.result.reason === 'string' && timedOutResult.result.reason.includes('mutated and settled after the timeout'),
      'Session send workflow test did not preserve late-mutation diagnostics after timeout.'
    );
  } finally {
    vscodeModule.window = originalWindow;
    vscodeModule.commands.executeCommand = originalExecuteCommand;
    vscodeModule.commands.getCommands = originalGetCommands;
  }
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
      archived: false,
      provider: "workspaceStorage",
      sessionFile: "/tmp/older-session.jsonl"
    }
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
    getExactSelfTargetingReason(chats, "recent-session", "send", now)?.includes("currently invoking conversation") === true,
    "Self-target guard test did not block an exact send to the likely invoking chat."
  );

  assert(
    getExactSelfTargetingReason(chats, "older-session", "send", now) === undefined,
    "Self-target guard test incorrectly blocked an exact send to a different chat."
  );

  assert(
    getExactSelfTargetingReason(chats, "recent-session", "close-visible-tabs", now)?.includes("currently invoking conversation") === true,
    "Self-target guard test did not preserve blocking semantics for exact close of the likely invoking chat."
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
  assert(matrix.localExactSend.status === "unsupported", "Live chat support matrix test did not reflect missing Local exact-session send support.");
  assert(matrix.manifestParticipants[0]?.id === "github.copilot.editsAgent", "Live chat support matrix test did not expose manifest chat participants.");
  assert(matrix.manifestModelCommands[0]?.includes("Change Completions Model"), "Live chat support matrix test did not expose manifest model commands.");
  assert(matrix.switchAgentOptions.includes("Plan"), "Live chat support matrix test did not expose the manifest switch-agent options.");

  const markdown = renderLiveChatSupportMatrixMarkdown(matrix);
  assert(markdown.includes("Local new chat custom role prompt: best-effort"), "Live chat support matrix markdown did not include the Local custom role prompt dispatch status.");
  assert(markdown.includes("Local new chat custom agent: unsupported"), "Live chat support matrix markdown did not include the Local custom-agent limitation.");
  assert(markdown.includes("Local focused prompt submit: best-effort"), "Live chat support matrix markdown did not include the focused Local prompt submit status.");
  assert(markdown.includes("Local exact reveal: supported"), "Live chat support matrix markdown did not include the supported Local exact reveal status.");
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
  assert(markdown.includes("Current Local exact-target limitation"), "Local-to-CLI handoff markdown must preserve the Local targeting limitation provenance.");
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
  const toolingModule = await import(pathToFileURL(distToolingCore).href);
  const {
    buildWindow,
    buildContextEstimate,
    buildSnapshot,
    buildTranscriptEvidence,
    renderWindowMarkdown,
    renderContextEstimateMarkdown,
    renderSnapshotMarkdown,
    renderTranscriptEvidenceMarkdown
  } = toolingModule;
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
  const copilotCliToolingModule = await import(pathToFileURL(distCopilotCliTooling).href);
  const { inspectCopilotCliSession, listCopilotCliSessions, renderCopilotCliSessionInspectionMarkdown } = copilotCliToolingModule;

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
    assert(sessions.length === 2, "Copilot CLI tooling list test did not discover both fixture sessions.");
    const inspection = await inspectCopilotCliSession({ sessionStateRoot: fixture.sessionStateRoot, sessionId: "cli-session-aaa" });
    assert(inspection?.latestTurn?.assistantMessage === "Investigated via worker lane.", "Copilot CLI tooling inspect test did not recover the latest assistant message from the fixture.");
    const markdown = renderCopilotCliSessionInspectionMarkdown(inspection, { sessionStateRoot: fixture.sessionStateRoot });
    assert(markdown.includes("Workspace YAML summary: fixture summary"), "Copilot CLI tooling inspection markdown did not render workspace metadata.");
    assert(markdown.includes("Latest assistant message: Investigated via worker lane."), "Copilot CLI tooling inspection markdown did not render the latest assistant message.");
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
  const activationEvents = packageJson.activationEvents;
  const languageModelTools = packageJson.contributes?.languageModelTools;
  const extensionCommands = packageJson.contributes?.commands;
  const viewTitleMenu = packageJson.contributes?.menus?.["view/title"] ?? [];
  const viewItemContextMenu = packageJson.contributes?.menus?.["view/item/context"] ?? [];

  assert(Array.isArray(activationEvents), "package.json activationEvents must be an array.");
  assert(Array.isArray(languageModelTools), "package.json contributes.languageModelTools must be an array.");
  assert(Array.isArray(extensionCommands), "package.json contributes.commands must be an array.");

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

  const contributedCommandNames = extensionCommands.map((command) => command.command);
  for (const commandName of expectedExtensionCommandNames) {
    assert(
      contributedCommandNames.includes(commandName),
      `package.json is missing the command contribution ${commandName}.`
    );
  }

  const windowTool = languageModelTools.find((tool) => tool.name === "get_agent_session_window");
  const transcriptTool = languageModelTools.find((tool) => tool.name === "export_agent_evidence_transcript");
  const estimateTool = languageModelTools.find((tool) => tool.name === "estimate_agent_context_breakdown");
  const rawSessionCommand = extensionCommands.find((command) => command.command === "aiRecoveryTooling.openSessionFile");
  const rawSessionMenuEntry = viewItemContextMenu.find((item) => item.command === "aiRecoveryTooling.openSessionFile");

  assert(windowTool?.inputSchema?.properties?.afterLatestCompact, "package.json window tool schema must expose afterLatestCompact.");
  assert(windowTool?.inputSchema?.properties?.anchorOccurrence, "package.json window tool schema must expose anchorOccurrence.");
  assert(!windowTool?.inputSchema?.required, "package.json window tool schema must not require anchorText when compaction-only windows are allowed.");
  assert(transcriptTool?.inputSchema?.properties?.maxBlocks, "package.json transcript tool schema must expose maxBlocks.");
  assert(transcriptTool?.inputSchema?.properties?.afterLatestCompact, "package.json transcript tool schema must expose afterLatestCompact.");
  assert(estimateTool?.inputSchema?.properties?.latestRequestFamilies, "package.json context estimate tool schema must expose latestRequestFamilies.");
  assert(rawSessionCommand?.title === "AI Recovery Tooling: Open Raw Session File (Last Resort)", "package.json raw session command must remain explicitly marked as last resort.");
  assert(rawSessionMenuEntry?.group === "z_lastResort", "package.json session context menu must keep raw session file access in the last-resort group.");

  const viewTitleCommands = viewTitleMenu.map((item) => item.command);
  const viewItemCommands = viewItemContextMenu.map((item) => item.command);
  assert(viewTitleCommands.includes("aiRecoveryTooling.createLiveChat"), "package.json view/title menu must expose Create Local Chat.");
  assert(viewTitleCommands.includes("aiRecoveryTooling.listLiveChats"), "package.json view/title menu must expose List Local Chats.");
  assert(viewItemCommands.includes("aiRecoveryTooling.revealLiveChat"), "package.json session context menu must expose Reveal Local Chat.");
  assert(viewItemCommands.includes("aiRecoveryTooling.closeVisibleLiveChatTabs"), "package.json session context menu must expose Close Visible Local Chat Tabs.");
  assert(viewItemCommands.includes("aiRecoveryTooling.deleteLiveChatArtifacts"), "package.json session context menu must expose Delete Local Chat Artifacts.");
  assert(viewItemCommands.includes("aiRecoveryTooling.sendMessageToLiveChat"), "package.json session context menu must expose Send Message To Local Chat.");
}

async function runRoutingGuardChecks() {
  const firstSliceModule = await import(pathToFileURL(distFirstSlice).href);
  const readme = await fs.readFile(readmePath, "utf-8");
  const languageModelToolsSource = await fs.readFile(languageModelToolsSourcePath, "utf-8");

  assert(
    firstSliceModule.isFirstSliceSessionCommand("aiRecoveryTooling.openSessionFile") === false,
    "Routing guard must keep raw session file access out of the default first-slice session commands."
  );
  assert(
    firstSliceModule.isEnabledSessionCommand("aiRecoveryTooling.openSessionFile") === true,
    "Routing guard must keep raw session file access available as an explicit non-default escape hatch."
  );
  assert(
    firstSliceModule.isFirstSliceSessionCommand("aiRecoveryTooling.openSnapshot") === true,
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
    languageModelToolsSource.includes("Prefer snapshot, index, window, profile, transcript, or export surfaces over opening raw session files"),
    "Language-model routing note must keep bounded inspection surfaces preferred over raw session files."
  );
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

async function runMcpChecks() {
  const client = new Client({
    name: "agent-architect-tools-test",
    version: "0.1.0"
  });
  const transport = new StdioClientTransport({
    command: "node",
    args: [distServer],
    cwd: packageRoot
  });

  try {
    await client.connect(transport);

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
        outputFile: "/tmp/agent-architect-tools-test-mcp.md"
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

async function main() {
  await runCliChecks();
  await runMcpChecks();
  await runChatInteropCapabilityChecks();
  await runChatFocusTargetChecks();
  await runEditorFocusCommandChecks();
  await runEditorTabMatcherChecks();
  await runSelfTargetGuardChecks();
  await runChatInteropSelectionChecks();
  await runFocusedSendBehaviorChecks();
  await runCreateChatDirectAgentCommandChecks();
  await runChatSessionStorageDeltaChecks();
  await runStabilizedCreateWorkflowChecks();
  await runOfflineLocalChatCleanupChecks();
  await runSessionSendWorkflowChecks();
  await runLiveChatSupportMatrixChecks();
  await runLocalToCopilotCliHandoffChecks();
  await runPendingRequestHeuristicChecks();
  await runCopilotCliInspectionChecks();
  await runAgentArchitectProcessEvidenceChecks();
  await runManifestChecks();
  await runRoutingGuardChecks();
  process.stdout.write("Tests passed.\n");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});