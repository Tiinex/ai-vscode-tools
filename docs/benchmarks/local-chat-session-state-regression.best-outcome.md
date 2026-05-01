# Local Chat Session State Regression Best Outcome

Support-only benchmark output. Read this file as one preserved best-known outcome, not as a general guarantee for the Local surface.
Use [local-chat-session-state-regression.md](local-chat-session-state-regression.md) for the scope, method, and evidence rules behind this output.

Support-only evidence summary. This file is not runtime authority.

## Current Ceiling / Known Invariants

- Treat the following as the current practical ceiling for ordinary Local chat on this host, based on repeated tool execution plus artifact inspection.
- Exact-session reveal is supported.
- Ordinary Local exact-session send is unsupported; any usable continuation path still depends on focused visible-chat fallback behavior.
- Focused fallback can be useful, but it is not equivalent to a trustworthy exact-session transport.
- A custom mode can persist into Local session state, but the actual persisted request participant still remains the built-in Local agent.
- When a selected custom agent file declares a `model` frontmatter field, that frontmatter model overrides an explicitly requested create-time model selector for the first persisted request.
- Reopen can help the visible UI catch up to persisted mode or model state, but current evidence does not upgrade reopen into trustworthy arbitrary custom-agent participant selection.
- The best current low-bloat Local working pattern is: create with an inert first turn, then close or reopen or focus the exact session, then send the first real prompt. Current evidence supports this as a stabilization pattern for visible mode or model state and first follow-up behavior, not as proof of exact custom-agent participant identity.
- When the current Local send guard heuristically treats the intended target as the latest or invoking session, the best current low-bloat pattern becomes: inert first turn, then a decoy session to break that ambiguity, then exact reveal or reopen or focus of the intended session, then the first real prompt. Current evidence still supports this only as a host-bounded behavior-stabilization pattern.

## Verified From Tool Execution And Artifact Inspection

- A new Local chat can be created through the ordinary `chat-open` path.
- An existing Local chat session JSONL can be mutated so that persisted session state carries:
  - `inputState.mode.id = file:///home/olle/Documents/Agents/agent-architect/.github/agents/agent-architect.agent.md`
  - `inputState.selectedModel.identifier = copilot/gpt-5-mini`
  - request 0 `modelId = copilot/gpt-5-mini`
- Read-after-write verification succeeded on mutated Local sessions including:
  - `d3dae99d-1741-42b5-be22-2cf49231278c`
  - `bfc7a37a-5dfd-4825-83a9-cd0f3c1cd5d4`
- When a hacked Local chat was focused and `create_live_agent_chat` was called without explicit agent or model arguments, a new separate session was created:
  - session `259ddba5-9c1a-45cb-8972-a6f8eb1e8be4`
  - persisted `inputState.mode = agent-architect agent file URI`
  - persisted `inputState.selectedModel.identifier = copilot/gpt-5-mini`
  - request 0 `modelId = copilot/gpt-5-mini`
- In that inherited new session, the actual request participant remained the built-in agent:
  - `requests[0].agent.id = github.copilot.editsAgent`
  - therefore the evidence supports inherited mode and model input state, not full custom-agent participant selection from `chat-open` alone.
- A later direct create-path run on the same Local surface showed that a new Local chat can carry both custom mode instructions and an explicit non-default model from the first persisted request without any disk mutation step:
  - entrypoint: `create_live_agent_chat`
  - requested agent selector: `agent-architect`
  - requested model: `copilot/gpt-4.1`
  - target session: `3704d47a-80e9-4d76-b870-f004850d1f09`
  - persisted `inputState.mode.id = file:///home/olle/Documents/Agents/agent-architect/.github/agents/agent-architect.agent.md`
  - persisted `inputState.selectedModel.identifier = copilot/gpt-4.1`
  - persisted request `modelId = copilot/gpt-4.1`
  - persisted request `modeInfo.isBuiltin = false`
  - persisted request `modeInfo.modeInstructions.uri = file:///home/olle/Documents/Agents/agent-architect/.github/agents/agent-architect.agent.md`
  - persisted response metadata reported `resolvedModel = gpt-4.1-2025-04-14`
- In that same direct create-path run, the actual persisted request participant still remained the built-in Local agent:
  - request `agent.id = github.copilot.editsAgent`
  - interpretation: this strengthens the claim that Local create can persist explicit custom mode instructions plus an explicit non-default model from zero state, but still does not prove a participant switch away from the built-in Local agent.
- A later repeated create-path run through the same entrypoint again returned a verified non-default model on first persist:
  - entrypoint: `create_live_agent_chat`
  - requested agent selector: `agent-architect`
  - requested model: `copilot/gpt-4.1`
  - target session: `f86ac6d1-5542-43e8-b97b-622cd932d0a2`
  - tool-returned session model: `copilot/gpt-4.1`
  - interpretation: repeated same-entrypoint evidence now shows that explicit model override can succeed on create without a state hack.
- An intermediate create-path run on the same surface did not honor that requested non-default model:
  - entrypoint: `create_live_agent_chat`
  - requested agent selector: `agent-architect`
  - requested model: `copilot/gpt-4.1`
  - target session: `f44d5551-fdbc-4d63-b440-b43e25705f4a`
  - tool-returned session model: `copilot/gpt-5-mini`
  - persisted request `modelId = copilot/gpt-5-mini`
  - persisted request `modeInfo.isBuiltin = false`
  - interpretation at the time: the create path was not yet proven deterministic under changing live host state.
- A later same-surface A/B probe isolated the strongest now-known explanation for that `gpt-5-mini` outcome:
  - control run with the ordinary `agent-architect.agent.md` frontmatter still declaring `model: GPT-5 mini`
    - target session: `db2be4c9-3bce-4564-9c74-0220c266ca77`
    - persisted request `modelId = copilot/gpt-5-mini`
    - later persisted delta row still carried `inputState.selectedModel.identifier = copilot/gpt-4.1`
  - paired run after temporarily removing the `model` frontmatter field from the same runtime agent file and then restoring it immediately after the probe
    - target session: `6690c851-8961-4d29-9540-81811d508473`
    - tool-returned session model: `copilot/gpt-4.1`
    - persisted request `modelId = copilot/gpt-4.1`
    - first-answer self-report: `MODEL=GPT-4.1`, `MODE=agent-architect`
  - interpretation: on this host and this Local create surface, the custom agent file's `model` frontmatter overrides an explicitly requested create-time model selector for the first request. The earlier `gpt-5-mini` create result is therefore better explained by runtime agent frontmatter than by unexplained host nondeterminism alone.
- A focused visible-chat follow-up command path now works against an already existing Local chat session:
  - entrypoint: `Agent Architect Tools: Send Message To Focused Visible Live Chat`
  - target session: `7ae206a1-089f-40d3-b173-8afaa002177b`
  - persisted latest user message changed to `Hello`
  - persisted latest assistant result became `Hello — what can I help you with?`
  - persisted request `modelId = copilot/gpt-5-mini`
  - persisted request `modeInfo.isBuiltin = false`
  - persisted request `modeInfo.modeInstructions.uri = file:///home/olle/Documents/Agents/agent-architect/.github/agents/agent-architect.agent.md`
- In that successful focused visible-chat follow-up, the actual persisted request participant still remained the built-in agent:
  - latest follow-up request `agent.id = github.copilot.editsAgent`
  - therefore the evidence now supports a real focused Local follow-up transport with `GPT-5 mini` plus `agent-architect` mode instructions, but still not a custom participant switch away from the built-in Local agent.
- An editor-focused follow-up command path now also has read-after-write verification against an already existing editor-hosted Local chat session:
  - entrypoint: `send_message_to_focused_editor_chat`
  - exercised prompt: `editor-focus-verification-20260410-0936`
  - verified target session: `7ae206a1-089f-40d3-b173-8afaa002177b`
  - persisted latest user message changed to `editor-focus-verification-20260410-0936`
  - persisted latest assistant result became `- editor-focus-verification-20260410-0936`
  - persisted latest timestamp advanced to `2026-04-10T09:32:14.791Z`
  - persisted latest request `modelId = copilot/gpt-5-mini`
  - persisted latest request `modeInfo.modeId = custom`
- In that same editor-focused verification run, the side-panel chat session `86388876-6ce5-4e77-8178-607f0810a0b7` did not receive the probe prompt and its latest persisted timestamp remained `2026-04-10T09:31:19.911Z`.
- A second editor-focused follow-up run through the same entrypoint also has target-delivery proof with varied phrasing:
  - entrypoint: `send_message_to_focused_editor_chat`
  - returned dispatch surface: `focused-chat-submit`
  - exercised prompt: `second-editor-focus-verification-20260410-1040 route this to the editor-hosted local chat and answer in one short sentence`
  - verified target session: `7ae206a1-089f-40d3-b173-8afaa002177b`
  - persisted request row matched in the target session at `2026-04-10T10:39:46.159Z`
  - side-panel session `86388876-6ce5-4e77-8178-607f0810a0b7` had no persisted match for the full unique anchor
  - side-panel session `86388876-6ce5-4e77-8178-607f0810a0b7` also had no persisted match for the shorter phrase `route this to the editor-hosted local chat`
- That second run strengthens the claim from a single happy-path proof to repeated same-entrypoint target-delivery evidence for the editor-focused Local follow-up path.
- A later same-surface reopen probe on the current VS Code host session established an exact Local reveal path for already existing chats:
  - entrypoint: `reveal_live_agent_chat`
  - runtime reveal command used: `workbench.action.chat.openSessionInEditorGroup`
  - target resource shape: `vscode-chat-session://local/<base64(sessionId)>`
  - target session: `7ae206a1-089f-40d3-b173-8afaa002177b`
  - current-window result: opened `Local follow-up attempt request`
- User session evidence on that successful reopen also confirmed that the reopened chat showed the expected agent and model selection.
- A fresh runtime support-matrix check therefore now reports exact Local reveal as supported on the current build, while exact Local send remains unavailable:
  - `Local exact reveal: supported`
  - `Local exact send: unsupported`
  - runtime commands present: `workbench.action.openChat`, `workbench.action.chat.open`, `workbench.action.chat.focusInput`, `workbench.action.chat.submit`, `workbench.action.chat.openSessionInEditorGroup`
  - runtime commands absent: `workbench.action.chat.openSession`, `workbench.action.chat.openSessionWithPrompt`
  - only Copilot CLI retains an `openSessionWithPrompt` path, which does not count as Local evidence
- Exact session-targeted Local follow-up send remains unsupported on this build.
- Exact session-targeted Local reveal or reopen is now supported on this build.
- A later close-only regression through the real extension command surface verified exact session-targeted close of a visible Local editor chat tab:
  - entrypoint: `Agent Architect Tools: Close Visible Live Chat Tabs (Exact Session)`
  - target session: `7ae206a1-089f-40d3-b173-8afaa002177b`
  - target title: `Local follow-up attempt request`
  - stable pre-run tab layout included:
    - `Untitled-1`
    - `Inheritance regression probe request`
    - `Local follow-up attempt request`
    - `Direct prefix alive status in README.md`
  - post-run tab layout removed only `Local follow-up attempt request`
  - the other visible Local chat tabs remained present
  - user session evidence then confirmed that the correctly targeted tab was the one closed
- A later explicit-session editor-focused follow-up run again proved target delivery to the intended already-open Local editor chat:
  - entrypoint: `send_message_to_focused_editor_chat`
  - requested target session: `5895583f-119e-41d2-9180-1b90e9b5798f`
  - unique prompt: `AA_FALLBACK_SEND_PROBE_2026_04_11_T1 exact target delivery check`
  - returned dispatch surface: `focused-chat-submit`
  - persisted target-session evidence: `chatSessions/5895583f-119e-41d2-9180-1b90e9b5798f.jsonl` contains that exact prompt text as a real request message
  - boundary check: `chatSessions/86388876-6ce5-4e77-8178-607f0810a0b7.jsonl` does not contain that same prompt text as a real request message
  - interpretation: the explicit-session editor-focused fallback transport remains live and has repeated read-after-write target-delivery proof on this build when the intended Local chat is already open in an editor tab
- A subsequent direct command invocation attempt against the newly added internal alias initially failed before host reload and therefore did not yet produce live evidence for that alias as a distinct runtime entrypoint:
  - attempted entrypoint: `agentArchitectTools.chatInterop.sendMessageWithFallback`
  - unique prompt: `AA_FALLBACK_SEND_PROBE_2026_04_11_T2 exact target delivery check`
  - result: command execution failed without a corresponding persisted target write
  - interpretation: at that point the alias existed in repo code, but the attached host session had not yet reloaded the new runtime registration
- After host reload, the same internal alias did produce direct live evidence as a distinct runtime entrypoint:
  - attempted entrypoint: `agentArchitectTools.chatInterop.sendMessageWithFallback`
  - requested target session: `5895583f-119e-41d2-9180-1b90e9b5798f`
  - unique prompt: `AA_FALLBACK_SEND_PROBE_2026_04_11_T3 alias runtime verification`
  - direct command result: `ok: true`
  - returned dispatch surface: `focused-chat-submit`
  - returned reveal lifecycle: `closedMatchingVisibleTabs: 1`, `closedTabLabels: ["Inheritance regression probe request"]`
  - persisted target-session evidence from `get_agent_session_index`: line `L10` in `chatSessions/5895583f-119e-41d2-9180-1b90e9b5798f.jsonl` shows the exact T3 prompt as a real request entry with timestamp `2026-04-11T11:07:33.595Z`
  - boundary check from `get_agent_session_window`: the same T3 anchor was found in the target session and returned no match in session `86388876-6ce5-4e77-8178-607f0810a0b7`
  - interpretation: after reload, the internal alias is live and callable, and it provides exact-session fallback delivery to the intended Local target with read-after-write evidence
- A second post-reload run through that same internal alias added repeated same-entrypoint target-delivery evidence with varied phrasing on a different Local target session:
  - attempted entrypoint: `agentArchitectTools.chatInterop.sendMessageWithFallback`
  - requested target session: `34870189-0343-4948-b6a4-633e50fa98fc`
  - unique prompt: `AA_FALLBACK_SEND_PROBE_2026_04_11_T4 second target varied phrasing`
  - direct command result: `ok: true`
  - returned dispatch surface: `focused-chat-submit`
  - returned reveal lifecycle: `closedMatchingVisibleTabs: 1`, `closedTabLabels: ["Direct prefix alive status in README.md"]`
  - persisted target-session evidence from `get_agent_session_window`: line `L10` in `chatSessions/34870189-0343-4948-b6a4-633e50fa98fc.jsonl` shows the T4 anchor as a real request entry with timestamp `2026-04-11T11:11:12.853Z`
  - boundary check nuance: the same T4 anchor also appeared in session `86388876-6ce5-4e77-8178-607f0810a0b7`, but only as a tool-narration response line, not as a real request entry
  - interpretation: repeated alias evidence now shows target delivery to more than one intended Local session, while also confirming that anchor-only global searches must distinguish real request rows from narration rows
- A negative boundary run through the same alias now also has exact-surface failure evidence:
  - attempted entrypoint: `agentArchitectTools.chatInterop.sendMessageWithFallback`
  - requested target session: `00000000-0000-0000-0000-000000000000`
  - unique prompt: `AA_FALLBACK_SEND_PROBE_2026_04_11_T5 invalid session boundary`
  - direct command result: `ok: false`
  - failure reason: exact Local send is unsupported as a first-class host capability and the fallback reveal failed because the session was not found
  - interpretation: the alias does not silently claim success on a nonexistent Local target; it fails on the same surface with a target-resolution error

## MCP And Tooling Findings

- `mcp_agentarchitec_listSessions` is useful for quickly discovering newly created Local sessions and did surface session `5895583f-119e-41d2-9180-1b90e9b5798f` when an earlier ad hoc CLI probe had not yet found it.
- `mcp_agentarchitec_getSessionSnapshot` is useful for confirming that a persisted session exists, that it has at least one request batch, and what the latest visible user and assistant text are.
- `mcp_agentarchitec_getSessionIndex` is useful for compact request-count and preview checks.
- `export_agent_session_markdown` is useful for preserving a concise read-only session record in markdown form.
- Repo-local tooling was then strengthened so that snapshot rendering now includes persisted selection state:
  - `inputState.mode`
  - `inputState.selectedModel.identifier`
  - latest request `agent.id`
  - latest request `modelId`
  - latest request `modeInfo`
- The strengthened snapshot renderer is verified in the built repo-local CLI output.

## Remaining Tool-Surface Gaps

- In the still-running VS Code host session used during this investigation, the live-registered `get_agent_session_snapshot` tool continued to return the older snapshot format after the repo code and tests were updated.
- This indicates a reload or re-registration gap between the built repo-local tooling and the currently attached live tool surface.
- Because of that live-surface lag, raw artifact inspection or the repo-local CLI can still be necessary immediately after code changes until the host reloads the updated tool implementation.

## Verified From User Session Evidence

- A hacked Local chat did not update live while already open.
- The hacked state became visible after the chat was closed and reopened.
- This behavior was reported as consistent in both editor-hosted chat and side-panel chat.
- With an old default Local chat focused, the next new chat behaved as default rather than inheriting the hacked state; this confirmed the inheritance explanation for the earlier false positive.
- A screenshot taken during the later focused-send probe did not yet show the final answer because it was captured before completion; later user clarification confirmed that the command appeared to work live and persisted artifact inspection then confirmed the completed response.
- With the side-panel chat focused, invoking `Agent Architect Tools: Send Message To Focused Editor Chat` moved focus over to the editor-hosted chat tab before submit.
- That focus shift is now backed by a later read-after-write verification run showing that the submitted prompt landed in the intended editor-hosted Local session instead of the side-panel chat.
- A later command-palette run through `Agent Architect Tools: Focus Visible Editor Chat` displayed the Local session picker and, after the user explicitly chose `Local follow-up attempt request`, focused the matching already-open editor-hosted chat tab directly.
- The same manual focus-only entrypoint was then repeated against the other already-open non-active Local chat tab, and the user reported that it also focused the requested tab correctly.
- No extra markdown report tab opened during those successful focus-only verification runs.
- In the direct create-path `gpt-4.1` run for session `3704d47a-80e9-4d76-b870-f004850d1f09`, the user reported that the newly opened chat initially showed `GPT-5 mini` in the UI even though persisted session state already carried `copilot/gpt-4.1`.
- The user then reported that after closing and reopening that same Local chat, the UI showed `GPT-4.1` selected.
- Interpretation: on this host session, persisted create-time selection state can be correct on disk before the visible Local chat UI reflects it. This is user session evidence for a UI reload effect, not yet proof that reopen is required for the first follow-up request to execute with the persisted model.
- A later user-facing `transcriber` boundary screenshot showed what looked like the correct role from a human point of view: the visible selector showed `transcriber`, and the answer itself followed the expected cautious transcriber contract by drafting `[[UNCERTAIN]]` content and refusing to write yet.
- Interpretation: this is meaningful user-session evidence for role-shaped behavior and visible UI selection. It still does not replace persisted participant evidence when the narrower question is whether the Local host actually switched away from the built-in participant under the hood.
- A later repeated composed Local flow now has tool-backed reopen evidence rather than UI-only reopen evidence:
  - entry sequence:
    - `create_live_agent_chat` target with explicit custom agent selector and explicit model selector
    - `create_live_agent_chat` decoy so the target was no longer the latest Local session
    - `reveal_live_agent_chat` target, which closed the visible matching tab before reopening it
    - `send_message_to_live_agent_chat` target, which on this build fell back to reveal plus focused submit because exact Local send remains unsupported
  - reopen case A target session: `8a2ed89f-41e8-4d04-a368-0befd82013fb`
    - requested agent selector: `agent-architect.intake`
    - requested model: `copilot/claude-sonnet-4`
    - persisted follow-up self-report after reopen: `agent-architect`, `Claude Sonnet 4`
  - reopen case B target session: `0df1e7fd-477a-403d-89be-672d28c6f6b8`
    - requested agent selector: `support-doc.fresh-reader`
    - requested model: `copilot/gpt-5.4`
    - persisted follow-up self-report after reopen: `agent-architect`, `GPT-5.4`
  - reopen case C target session: `8880341b-7920-4cfb-8e02-ac62978096ff`
    - requested agent selector: `session-artifact.tail-reader`
    - requested model: `copilot/claude-opus-4.6`
    - persisted follow-up self-report after reopen: `agent-architect`, `Claude Opus 4.6`
  - interpretation: repeated reopen-based evidence now supports a narrower best outcome than full requested agent-plus-model creation. On this build, the composed reopen path appears able to stabilize the requested model into the first post-reopen self-report, but varied requested custom agents still collapse to the same reloaded mode, `agent-architect`.
- A later transcriber-specific two-phase Local regression on the same host tightened that pattern into an evidence-backed operating routine for first real behavior after create:
  - positive target session: `c62a9be4-a0dc-42b2-ad7d-c092fedf5613`
  - phase 1 entrypoint: `create_live_agent_chat`
  - phase 1 effect: inert no-op first turn only
  - ambiguity-break decoy sessions: `af485a47-c40f-4d80-8273-338e47db4ab5` and later `c30eb61c-d488-48f6-9aca-ba147c23d95e`
  - exact target reveal entrypoint: `reveal_live_agent_chat`
  - real prompt entrypoints exercised after reveal: `send_message_to_focused_editor_chat` and `send_message_to_live_agent_chat` using its documented reveal-plus-focused fallback
  - read-after-write result: files `sandboxed-workspace/transcriber-two-phase-local-positive.md` and `sandboxed-workspace/transcriber-two-phase-local-positive-retry.md` were created on disk with the requested deterministic transcription content
  - provenance result: the real positive anchors landed in target session `c62a9be4-a0dc-42b2-ad7d-c092fedf5613` and did not appear as real request rows in the decoy sessions
  - interpretation: on this host, the two-phase pattern is directly evidenced as a workable first-real-behavior stabilization routine for `transcriber`
- The paired boundary case on the same surface produced the corresponding narrower no-write evidence:
  - boundary target session: `0ebd8f66-282e-43b7-8c58-bb45121d654a`
  - phase 1 entrypoint: `create_live_agent_chat`
  - ambiguity-break decoy session: `c32f6c27-7a6c-4eae-ad89-ee523bbd235c`
  - exact target reveal entrypoint: `reveal_live_agent_chat`
  - real boundary prompt entrypoint: `send_message_to_live_agent_chat` using its documented reveal-plus-focused fallback
  - target proof: the boundary anchor persisted in the intended target session and no real-request match appeared in the decoy session
  - no-write proof: no file `sandboxed-workspace/transcriber-two-phase-local-boundary.md` was created on disk
  - artifact limit: the second-turn assistant boundary reply did not fully persist in session JSONL on this host
  - interpretation: the two-phase pattern is strong enough to support a no-write boundary claim from target-delivery plus disk-state evidence, even when the full cautious assistant reply is not preserved
- A fresh post-reload Local create probe now has same-surface settled-completion evidence after the 2026-04-12 wait changes:
  - entrypoint: `create_live_agent_chat`
  - target session: `71dd26d7-de7c-4cd3-93db-e9e4a551814e`
  - requested side effect: create `sandboxed-workspace/local-settled-wait-reload-20260412-c.txt`
  - tool result: `ok`
  - read-after-write result: the file exists on disk with exact content `LOCAL_SETTLED_WAIT_RELOAD_20260412_C`
  - interpretation: the ordinary Local create path no longer times out merely because the first persisted mutation arrives before the request is fully settled
- A fresh post-reload stabilized lifecycle probe now has matching same-surface settled-completion evidence through the fallback path:
  - entrypoint: `send_message_with_lifecycle`
  - explicit `mode: Agent` request first failed with the expected current selection-enforcement blocker on that surface
  - re-run without explicit mode selection succeeded
  - target session: `3017c4d4-a03d-4837-91d7-2861bd6b8ea7`
  - fallback used: yes, because exact Local send remains unsupported
  - dispatch surface: `focused-chat-submit`
  - read-after-write result: `sandboxed-workspace/local-lifecycle-settled-reload-20260412-c.txt` exists on disk with exact content `LOCAL_LIFECYCLE_SETTLED_RELOAD_20260412_C`
  - interpretation: the settled-wait fix also holds on the reveal-plus-focused stabilized lifecycle route
- The host behavior that prompted the 2026-04-12 fix is now better bounded:
  - a completed Local session can still retain a stale full-state `hasPendingEdits: true` flag
  - explicit request completion plus zero pending requests is the more trustworthy settled signal on this host

## Not Yet Proven

- A working exact-session-targeted tool path that sends a new prompt into an already existing Local chat session without relying on focused visible-chat state or an explicit fallback composition.
- A pure non-hacked API route that explicitly selects both custom agent participant and model from zero state on Local.
- Whether a newly created Local chat must be closed and reopened before the first real follow-up request uses the persisted non-default model and custom mode instructions.
- A clean no-reopen second-turn measurement through the same Local create surface, because attempts during this investigation were contaminated either by the self-targeting guard or by fallback send paths that themselves revealed and therefore reopened the target chat.
- A trustworthy Local path that creates a new chat with an arbitrary requested custom agent and preserves that requested agent identity through the first post-reopen follow-up.
- Whether any additional create-time model-selection instability remains after accounting for explicit custom-agent frontmatter `model` overrides.

## Practical Interpretation

- The current Local workaround is plausible as a composed flow:
  1. create or pick a Local chat
  2. when create-time persistence does not already produce the needed mode or model, mutate persisted session state to the desired mode and model
  3. force the host UI to reopen that chat so the session is reloaded
  4. reopen the intended Local chat on demand through the exact-session reveal path when it is not already visible
  5. continue through the focused visible-chat follow-up command when the intended chat is already the active visible Local chat, or use the editor-focused command to steer focus to an already open editor-hosted Local chat after selecting the intended session explicitly
  6. use the internal fallback-send alias when a real exact-session entrypoint is needed and the host has reloaded the corresponding registration
- The blocking gap is no longer model discovery.
- The strongest currently evidenced create-path variant is now narrower: `new chat -> make target not latest -> reveal/reopen target -> send follow-up` can stabilize model selection into the first post-reopen self-report, but it does not yet provide trustworthy arbitrary custom-agent selection.
- The remaining blocking gap is now a real exact-session Local follow-up transport that does not depend on focused visible-chat state, plus trustworthy preservation of the specifically requested custom agent across create and reopen.