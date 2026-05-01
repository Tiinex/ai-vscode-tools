# Project Guidelines

## Tool Surface Policy

- Treat tool surfaces as distinct until an exact bridge is evidenced. VS Code extension-host tools, VS Code commands, CLI, MCP, Local chat, and Copilot CLI are not interchangeable by default.
- Use the VS Code extension-host language-model-tool surface as the canonical agent-facing route for repo-local tooling in this workspace.
- Prefer repo-local tooling surfaces over terminal fallback whenever the needed capability already exists on an extension-host tool or MCP route.
- For persisted session, transcript, context-breakdown, or contentReferences inspection, prefer the repo's dedicated session-inspection tools over VS Code's built-in chat reference-inspection UI.
- Treat VS Code chat reference-inspection surfaces such as workbench.action.chat.inspectChatModelReferences as manual auxiliary observability only, not as the primary evidence route, unless exact parity with the repo's persisted session and transcript inspection model is freshly evidenced.
- Do not assume Copilot CLI is part of the baseline developer path for this repo. Keep normal Agent Architect work on the Local plus extension-host route, and use Copilot CLI only for explicitly narrower observability, worker-handoff, or reproduction needs.
- Use extension-host tools for any capability that depends on live VS Code UI state or commands, including live chat creation, reveal, follow-up send, focused send, editor-chat steering, and support-matrix inspection.
- Treat VS Code commands as manual human or regression entrypoints only. Keep them as thin wrappers over the same underlying extension functionality instead of creating a separate logic path.
- Use MCP for capabilities that are honestly headless, artifact-oriented, or externally consumed. Do not route UI-bound capabilities through MCP.
- Do not use the repo CLI harness as an agent-facing route for repo-local inspection or process work. Treat `npm run cli` and `node dist/tooling/cli.js` as internal script or test harness entrypoints only unless the user explicitly asks to work on that harness.
- Use terminal commands only when tooling does not expose the capability or when the task is inherently terminal-native, such as build, package, dependency, or other process control work.
- For normal runtime-agent artifact design, creation, patching, repair, and support-artifact maintenance, stay on non-terminal repo-local tooling when the extension-host route already covers the task.
- Do not create duplicate agent-facing routes for the same capability unless there is an explicit surface boundary and a documented reason to keep both.
- Do not route session-evidence triage, transcript inspection, or Local-chat observability through `agent-architect`; use the dedicated session-inspection or support-reader routes instead.

## Blocking Route Guard

- For Local live-chat creation, reveal, follow-up send, focus steering, session inspection, or Local-session regression, never use workspace, project, or notebook scaffolding surfaces as substitutes for chat creation or chat routing.
- In particular, do not call `create_new_workspace`, `get_project_setup_info`, or `create_new_jupyter_notebook` when the task is to create, reveal, continue, focus, inspect, or regress an ordinary Local chat session.
- For those Local chat tasks, stay on the extension-host live-chat tool surface unless a repo artifact explicitly documents another canonical route for that exact capability.
- If an unexpected folder picker, workspace picker, or setup dialog appears during Local chat work, treat the run as contaminated. Stop issuing further tool calls, ask the user to dismiss the dialog, and re-ground before continuing.

## Verification

- Verify behavior through the same surface that is expected to support it. Do not claim coverage from a different surface that merely reaches similar code.
- When a tool path writes session state or files, require read-after-write verification from artifacts or returned payloads.
- For bounded persisted-session inspection, treat session JSONL and transcript JSONL as distinct evidence families: compaction-aware windows or context estimates may succeed on persisted session rows even when transcript-block filtering has no matching compaction boundary to anchor from.
- Do not treat successful dispatch alone as proof of correct target delivery when the surface can plausibly reach multiple chats, sessions, or resources.
- For Local chat targeting, use a two-stage gate: first reveal, open, or focus the intended chat and confirm that target from tool output, artifacts, or stable UI evidence; only after that confirmation may a prompt-send probe run.
- Until the target chat is explicitly confirmed as distinct from the currently invoking conversation, do not send a probe prompt through a focused Local chat path.

## Reset Discipline

- Expect soft resets or compaction. Do not rely on chat continuity as authority for tool-surface choices.
- Re-ground routing or capability claims from current repo artifacts and tool execution when continuity is uncertain.
- Keep support artifacts aligned when they describe the same surface or verification boundary.

## References

- See [README.md](../README.md) for current repo-state claims and surface boundaries.
- See [ROADMAP.md](../ROADMAP.md) for current surface-discipline and verification priorities.
- See [local-chat-session-state-regression.md](../docs/benchmarks/local-chat-session-state-regression.md) and [local-chat-session-state-regression.best-outcome.md](../docs/benchmarks/local-chat-session-state-regression.best-outcome.md) for current Local-chat evidence and remaining gaps.
