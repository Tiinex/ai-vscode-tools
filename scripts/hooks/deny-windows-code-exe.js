#!/usr/bin/env node

const OVERRIDE_TOKEN = "ALLOW_CODE_EXE=1";

function allow() {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow"
    }
  }));
}

function deny(reason, context) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
      additionalContext: context
    },
    systemMessage: "Workspace policy blocked a Windows VS Code GUI binary launch from the terminal tool."
  }));
}

function readCommand(payload) {
  const candidates = [
    payload?.tool_input?.command,
    payload?.toolInput?.command,
    payload?.arguments?.command,
    payload?.input?.command,
    payload?.command
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return "";
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  let payload = {};

  try {
    payload = input.trim() ? JSON.parse(input) : {};
  } catch (error) {
    process.stderr.write(`Hook parse error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
    return;
  }

  if (process.platform !== "win32") {
    allow();
    return;
  }

  const toolName = typeof payload?.tool_name === "string" ? payload.tool_name : "";
  if (toolName !== "run_in_terminal" && toolName !== "send_to_terminal") {
    allow();
    return;
  }

  const command = readCommand(payload);
  const normalized = command.toLowerCase();
  if (!normalized) {
    allow();
    return;
  }

  if (normalized.includes(OVERRIDE_TOKEN.toLowerCase())) {
    allow();
    return;
  }

  const mentionsCodeExe = /(^|[^a-z])code\.exe(\s|$|["'])/i.test(command)
    || normalized.includes('\\microsoft vscode\\code.exe')
    || normalized.includes('/microsoft vscode/code.exe');

  if (!mentionsCodeExe) {
    allow();
    return;
  }

  deny(
    "Blocked direct Code.exe terminal launch on Windows. Use the VS Code CLI wrapper code.cmd instead so the agent does not spawn a new GUI window by accident.",
    `If you intentionally need the GUI launcher, add ${OVERRIDE_TOKEN} to the command. Otherwise prefer C:/Users/micro/AppData/Local/Programs/Microsoft VS Code/bin/code.cmd or the shell-resolved code command.`
  );
});
