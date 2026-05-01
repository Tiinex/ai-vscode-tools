#!/usr/bin/env node

const blockedTools = new Set([
  "create_new_workspace",
  "get_project_setup_info",
  "create_new_jupyter_notebook"
]);

let input = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  let payload;

  try {
    payload = input.trim() ? JSON.parse(input) : {};
  } catch (error) {
    process.stderr.write(`Hook parse error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
    return;
  }

  const toolName = typeof payload?.tool_name === "string" ? payload.tool_name : "";
  if (!blockedTools.has(toolName)) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow"
      }
    }));
    return;
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Blocked by workspace policy: Local chat work in this repo must not route through workspace, project, or notebook scaffolding tools. Use the extension-host live-chat tooling instead.",
      additionalContext: "This repo has repeated evidence of Local-chat misroutes into create_new_workspace and related setup tools, which can open blocking folder dialogs and contaminate regression runs."
    },
    systemMessage: "Workspace policy blocked a scaffolding tool that is forbidden for Local chat work in this repo."
  }));
});