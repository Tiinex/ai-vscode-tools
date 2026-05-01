---
name: tool-surface-routing
description: 'Use when choosing between VS Code extension tools, VS Code commands, MCP, the repo CLI harness, Local chat, or Copilot CLI surfaces; use for canonical tool routing, duplicate-route avoidance, soft-reset re-grounding, live-chat focus or send flows, same-surface regression discipline, Local-chat-vs-workspace-tool confusion, create_new_workspace misroutes, folder picker or open-workspace dialog contamination, and blocking route guards for Local chat creation or follow-up.'
---

# Tool Surface Routing

## When to Use

- Choose the correct surface for a new capability.
- Decide whether an existing capability belongs on extension-host tools, MCP, the repo CLI harness, or only as a manual command.
- Avoid duplicate agent-facing routes for the same capability.
- Re-ground after soft reset when prior tool-routing decisions may no longer be trustworthy.
- Plan or review regression for live-chat, focus, reveal, submit, or cross-surface transport work.

## Canonical Surface Rules

- VS Code extension-host language-model tools are the canonical agent-facing route for repo-local tooling in this workspace.
- Prefer extension-host tools or MCP over terminal fallback whenever one of those routes already exposes the needed repo-local capability.
- For persisted session, transcript, context-breakdown, or contentReferences inspection, prefer the repo's dedicated session-inspection tools over VS Code's built-in chat reference-inspection UI.
- Treat VS Code chat reference-inspection surfaces such as workbench.action.chat.inspectChatModelReferences as manual auxiliary observability only, not as the primary evidence route, unless exact parity with the repo's persisted session and transcript inspection model is freshly evidenced.
- Do not assume Copilot CLI as baseline developer tooling for this repo's normal process; treat it as an optional adjacent surface used only when a narrower worker-lane or observability question explicitly justifies it.
- VS Code commands are manual human or regression entrypoints only. They may wrap the same implementation, but they are not the primary agent route.
- MCP is the supported headless agent-facing route for capabilities that remain honest without VS Code UI state, such as persisted artifact inspection, bounded exports, headless summaries, or explicitly external transport.
- The repo CLI harness is internal support only for scripts, tests, or explicit harness work; do not choose it as the normal agent-facing route when extension-host tools or MCP already cover the capability.
- Use the terminal only when no repo-local tooling surface exposes the capability or when the work is genuinely terminal-native, such as builds, package installation, or process control.
- Local chat, Copilot CLI, MCP, the repo CLI harness, and extension-host tool surfaces are distinct until exact equivalence is evidenced.
- Do not route session-evidence triage, transcript inspection, or Local-chat observability through `agent-architect`; use the dedicated session-inspection or support-reader routes instead.

## Blocking Route Guard For Local Chat

- When the task is to create, reveal, continue, focus, inspect, or regress an ordinary Local chat, use only the extension-host live-chat route or an explicitly documented command wrapper over that same implementation.
- Do not use workspace, project, or notebook scaffolding tools as substitutes for Local chat creation or Local chat routing.
- In particular, do not call `create_new_workspace`, `get_project_setup_info`, or `create_new_jupyter_notebook` for Local chat tasks.
- If a folder picker, workspace picker, or setup dialog opens during Local chat work, treat that as route contamination rather than partial progress. Stop, get the dialog dismissed, and restart from a clean UI state.

## Classification Procedure

1. Classify the capability first.
2. If it depends on live VS Code UI state, command focus, visible tabs, active editor groups, or chat submit or reveal behavior, route it to extension-host tools.
3. If it only inspects persisted artifacts or produces bounded headless output, it may belong on MCP.
4. Use the repo CLI harness only when the task is explicitly about that harness, scripts, or tests.
5. If it exists only to let a person invoke or inspect the same behavior manually inside VS Code, keep it as a command wrapper.
6. If two surfaces appear possible, choose one canonical agent-facing route and record why the others are wrappers, harnesses, external transports, or intentionally unsupported.

## Verification Rules

1. Regress through the same entrypoint the user or agent will actually invoke.
2. When a tool path writes files or session state, verify by read-after-write artifact inspection or explicit returned payload.
3. For bounded persisted-session inspection, treat session JSONL and transcript JSONL as distinct evidence families: compaction-aware row windows or context estimates may succeed on persisted session rows even when transcript-block filtering has no matching compaction boundary to anchor from.
4. When a flow could target the wrong chat, session, or resource, verify both the intended target and the previously plausible wrong target.
5. Do not treat tool invocation success alone as proof of correct routing.

## Duplicate-Route Discipline

- Shared implementation is good.
- Duplicate agent-facing product surfaces are not.
- If extension-host tools already expose a capability correctly, do not mirror it into MCP just for symmetry.
- If MCP already exposes a headless artifact capability correctly, do not add a second agent-facing route unless the new surface solves a real boundary problem.
- Do not promote the repo CLI harness to an agent-facing product surface just because it can reach the same core implementation.

## Reset Re-Grounding

1. Re-check current support artifacts and current tool execution before trusting remembered routing claims.
2. Prefer the benchmark or support artifact that names the exact surface under discussion.
3. If the surface claim is not freshly evidenced, downgrade confidence until the surface is rechecked.

## Anti-Patterns

- routing UI-bound chat focus or submit through stdio-MCP
- using the repo CLI harness for ordinary agent process work when extension-host tools or MCP already cover the task
- defaulting to terminal commands for repo-local inspection, evidence gathering, or routing work when extension-host tools or MCP already cover the task
- treating manual command palette commands as the primary agent surface
- adding the same capability to extension-host tools and MCP without an explicit boundary reason
- claiming two surfaces are equivalent because they touch the same core function
- treating persisted session JSONL compaction rows as proof that a transcript JSONL artifact will expose a matching compaction block
- using chat narration instead of artifacts or returned payloads as routing proof
- using workspace or project creation flows to start or steer a Local chat session
- continuing a Local-chat regression run after an unexpected blocking setup dialog has appeared
- using VS Code's chat reference-inspection UI as the default evidence route when the repo's persisted session or transcript tools already cover the question
- delegating session-evidence triage or transcript inspection to `agent-architect` instead of a dedicated inspection route