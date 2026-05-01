# Local Chat Session State Regression

Support-only benchmark artifact. This file is not runtime authority.

Read this file as a preserved regression record for the Local surface, not as the main explanation of the repo.
If you are new to the repo, start with [../reference/current-status.md](../reference/current-status.md) first.

## Goal

Measure what can and cannot currently be driven on the Local VS Code chat surface through:

- persisted session mutation
- ordinary `chat-open` new-chat dispatch
- follow-up attempts against an already existing Local chat
- focused visible-chat follow-up dispatch through the extension command surface
- editor-focused follow-up dispatch through the extension command surface

## Scope

- Local workspaceStorage-backed Copilot Chat only
- no Copilot CLI substitution for Local claims
- no claim of exact-session support without direct evidence on the same surface

## Current Ceiling / Known Invariants

- Current practical ceiling for ordinary Local chat on this host:
   - exact-session reveal works
   - ordinary Local exact-session send does not
   - focused visible-chat continuation remains best-effort rather than exact-session
   - persisted request participant remains the built-in Local agent even when custom mode instructions persist
   - a selected custom agent file's `model` frontmatter overrides an explicitly requested create-time model selector for the first request
- Use this ceiling as the default interpretation unless a later same-surface probe produces stronger evidence.

## Recent Tooling Changes

- Date: 2026-04-11
- The extension now uses a longer default post-create timeout for focused-send and createChat verification: `60000` ms (60s). This helps avoid false timeout failures on hosts where persisted session writes are delayed.
- New extension settings (see `package.json`): `agentArchitectTools.postCreateTimeoutMs` (number) and `agentArchitectTools.waitForPersistedDefault` (boolean). The latter controls whether focused-send waits for a persisted session mutation by default.
- New request flag: `CreateChatRequest.waitForPersisted?: boolean` — when set to `false`, focused-send will use a non-blocking one-shot path and return immediately after a single persisted-check instead of waiting the full timeout. When omitted, the request falls back to the `waitForPersistedDefault` configuration.
- Rationale: read-after-write verification remains the canonical evidence path; the increased timeout and opt-out flag reduce spurious failures while preserving artifact-backed verification for safety.

- Date: 2026-04-12
- The extension now distinguishes persisted mutation from settled completion when `blockOnResponse` is requested on Local create, focused-send, exact-send wait, and the reveal-plus-focused fallback path.
- Session summaries now parse `hasPendingEdits`, `pendingRequests`, and request completion state from persisted Local session JSONL, including request `modelState` completion rows.
- The settled heuristic now prefers explicit completion evidence plus zero pending requests over a stale full-state `hasPendingEdits: true` flag, because this host can preserve that flag in the initial full-state snapshot even after the request has completed and side effects are already visible on disk.
- Rationale: this change narrows false timeout failures where the tool-backed side effect and persisted assistant response both exist, but the first persisted full-state row still reports stale pending-edit state.

- Date: 2026-04-22
- New request flag: `SendChatMessageRequest.allowTransportWorkaround?: boolean` — when set to `true` on `send_message_to_live_agent_chat`, the tool may create a decoy Local session first if the heuristic latest-session self-targeting guard would otherwise block the send and ordinary Local exact send is still unsupported on that build.
- Rationale: this is an explicit transport-workaround lane for measurement and recovery work. It does not upgrade the host into ordinary Local exact-session send support, and any run using it must be labeled as transport-workaround evidence rather than exact-session proof.

## Inputs

- hacked Local session with custom mode and selected model persisted into session JSONL
- ordinary existing Local session with built-in agent and default GPT-5.4 state
- `create_live_agent_chat` as the exercised new-chat entrypoint
- `Agent Architect Tools: Send Message To Focused Visible Live Chat` as the exercised focused follow-up entrypoint
- `Agent Architect Tools: Send Message To Focused Editor Chat` as the exercised editor-focus steering entrypoint
- persisted session artifacts under `~/.config/Code/User/workspaceStorage/.../chatSessions/`

## Regression Steps

Targeting gate for all focused-send probes:

1. First reveal, open, or focus the intended Local target chat.
2. Confirm the target chat before any prompt send by tool output, artifact-backed identity, or stable user UI evidence.
3. If target identity is still ambiguous, stop. Do not send a prompt yet.
4. Only after the target is confirmed may a focused-send or editor-focused-send probe proceed.

5. Create a new Local chat with `create_live_agent_chat` and verify a new session artifact appears.
6. Mutate an existing Local session JSONL so that:
   - `inputState.mode.id` points at `agent-architect.agent.md`
   - `inputState.selectedModel.identifier = copilot/gpt-5-mini`
   - request 0 carries matching `modelId`
7. Re-read the touched session artifact and verify the write.
8. Observe whether an already open chat view updates live or only after the chat is closed and reopened.
9. With the hacked chat focused, invoke `create_live_agent_chat` again without explicit agent or model arguments.
10. Inspect the newly created session artifact and record:
   - `inputState.mode`
   - `inputState.selectedModel`
   - `requests[0].agent.id`
   - `requests[0].modelId`
11. Repeat step 9 with an old default Local chat focused.
12. Attempt exact follow-up send into an already existing Local chat and record whether the surface supports it.
13. Attempt exact reveal or reopen of an already existing Local chat and record whether the surface supports it.
14. With the intended Local chat visible and focused, invoke `Agent Architect Tools: Send Message To Focused Visible Live Chat`.
15. Re-read the touched session artifact and record for the follow-up request:
   - latest user message text
   - latest assistant result text
   - `requests[n].agent.id`
   - `requests[n].modelId`
   - `requests[n].modeInfo.isBuiltin`
   - `requests[n].modeInfo.modeInstructions.uri`
16. With the side-panel chat focused and the intended editor-hosted chat also open, invoke `Agent Architect Tools: Send Message To Focused Editor Chat`.
17. Record whether focus first moves from the side-panel chat to the editor chat tab before submit, and if a follow-up is produced, re-read the touched session artifact to prove which session actually received it.
18. Re-run `Agent Architect Tools: Send Message To Focused Editor Chat` with a second unique prompt and varied phrasing, then verify both:
   - the intended editor-hosted target session contains the new prompt
   - the previously focused side-panel session does not contain the full unique anchor or a distinctive shorter phrase from that prompt

## Evidence Rules

- Tool-execution claims must be backed by returned tool payloads or read-after-write artifact inspection.
- When claiming that exact Local reveal or exact Local send is unsupported, prefer a fresh runtime support-matrix check from the same host session and record the relevant command presence or absence.
- UI claims reported by the user must be labeled as user session evidence.
- Do not treat inherited `inputState.mode` as proof that the actual request participant switched to the custom agent.
- Do not treat Copilot CLI exact-session support as proof for Local exact-session support.
- Do not treat a screenshot captured during in-flight execution as proof that a follow-up failed; confirm the completed outcome from persisted artifacts or a later stable UI capture.
- Do not treat observed editor-focus movement alone as proof that the submitted prompt landed in the intended editor chat session; that still needs read-after-write session verification.
- When the editor-focused follow-up path is re-run, verify both the intended editor-hosted target session and the previously focused side-panel session so the proof covers correct target delivery rather than mere successful submission somewhere.
- Treat the repeated editor-focused run as target-delivery coverage even if the bounded artifact window does not yet expose the completed assistant response, as long as the exercised entrypoint, unique prompt, target-session match, and non-target-session absence are all verified from artifacts.
- Do not send any focused Local probe prompt before target confirmation. A reveal, open, or focus attempt without confirmed target identity is not enough to justify dispatch.
- If a focused Local prompt is accidentally queued into the invoking conversation as steering or pending state, treat that as a hard stop and clean-up event rather than partial progress.

## Current Questions

- Can a focused hacked Local chat seed a newly created Local chat with inherited mode and selected model state?
- Does the Local UI reload hacked state only after close/reopen?
- Is there any working Local exact-session tool path for follow-up into an already existing chat without relying on focused visible-chat state?
- Is there any working Local tool path for exact reveal or reopen of an already existing chat?
- When `create_live_agent_chat` already persists a non-default model and custom mode instructions on the first request, does the first real follow-up in that same still-open Local chat use that persisted state without a close/reopen cycle?
- In a composed `create -> decoy -> reveal/reopen -> follow-up` Local flow, does reopen stabilize the requested model while still collapsing varied requested custom agents back to one reloaded mode?

## Latest Agent Frontmatter Model-Override Finding

Date: 2026-04-11

- Exercised same-surface A/B entrypoint: `create_live_agent_chat`
- Requested agent selector in both runs: `agent-architect`
- Requested model in both runs: `copilot/gpt-4.1`
- Control run with the ordinary runtime agent file still declaring `model: GPT-5 mini`:
   - target session: `db2be4c9-3bce-4564-9c74-0220c266ca77`
   - persisted request `modelId = copilot/gpt-5-mini`
   - persisted `inputState.mode.id = file:///home/olle/Documents/Agents/agent-architect/.github/agents/agent-architect.agent.md`
   - later delta row persisted `inputState.selectedModel.identifier = copilot/gpt-4.1`
   - interpretation: the requested `gpt-4.1` selector was preserved in session state after create, but it did not control the first persisted request while the agent file still declared `GPT-5 mini`
- Probe run after temporarily removing the `model` frontmatter field from the same runtime agent file and then restoring it immediately after the run:
   - target session: `6690c851-8961-4d29-9540-81811d508473`
   - tool-returned session model: `copilot/gpt-4.1`
   - persisted request `modelId = copilot/gpt-4.1`
   - persisted response metadata reported `resolvedModel = gpt-4.1-2025-04-14`
   - self-report in the first answer: `MODEL=GPT-4.1`, `MODE=agent-architect`
- Interpretation:
   - on this host and this Local create surface, a custom agent file's `model` frontmatter overrides an explicitly requested create-time model selector for the first request
   - the earlier apparent `gpt-5-mini` fallback in this scenario is now explained by the `agent-architect.agent.md` frontmatter rather than by unexplained host nondeterminism alone
   - this finding is specific to create-time model selection for a custom agent-backed Local chat; it does not change the separate limitation that the actual persisted participant still remains the built-in Local agent

## Latest Create-Path Explicit-Model Findings

Date: 2026-04-11

- Exercised entrypoint: `create_live_agent_chat`
- Requested agent selector: `agent-architect`
- Requested model: `copilot/gpt-4.1`
- One direct create run produced a persisted Local session with:
   - `inputState.mode.id = file:///home/olle/Documents/Agents/agent-architect/.github/agents/agent-architect.agent.md`
   - `inputState.selectedModel.identifier = copilot/gpt-4.1`
   - request `modelId = copilot/gpt-4.1`
   - request `modeInfo.isBuiltin = false`
   - request `modeInfo.modeInstructions.uri = file:///home/olle/Documents/Agents/agent-architect/.github/agents/agent-architect.agent.md`
   - persisted request `agent.id = github.copilot.editsAgent`
- A later repeated run through the same entrypoint again returned `copilot/gpt-4.1` for the created session.
- An intermediate same-surface run instead persisted `copilot/gpt-5-mini` despite the same requested `copilot/gpt-4.1` model.
- Later A/B evidence showed that this `gpt-5-mini` outcome is explained at least in one important case by the custom agent file's own `model: GPT-5 mini` frontmatter overriding the requested create-time model selector.
- Interpretation: explicit create-time model override can succeed on this Local surface without a state hack, but it is not authoritative when the selected custom agent file declares its own runtime model.

## Latest UI Reload Observation For Direct Create

Date: 2026-04-11

- User session evidence from the direct create-path `gpt-4.1` run reported that the newly opened Local chat initially showed `GPT-5 mini` in the UI even though persisted session state already carried `copilot/gpt-4.1`.
- The same user session then reported that after closing and reopening that chat, the UI showed `GPT-4.1` selected.
- Interpretation: this is evidence for a UI reload effect after create. It is not yet proof that reopen is required for the first follow-up request to execute with the persisted model, because the attempted no-reopen second-turn checks in this investigation were contaminated by transport limitations.

## Latest No-Reopen Follow-Up Limitation

Date: 2026-04-11

- A clean no-reopen second-turn check after create was not completed.
- The exact-session send path could not be used directly because the self-targeting guard treated the just-created target chat as the likely invoking conversation.
- Subsequent exact-session send attempts fell back to reveal plus focused-editor dispatch, which reopened the target chat and therefore invalidated the no-reopen measurement.
- Interpretation: the current tooling can test create, reveal, close, and focused follow-up separately, but it still lacks a clean same-surface harness for the specific question "does the first real follow-up after create require reopen?".

## Latest Reopen-Based Create Findings

Date: 2026-04-11

- Exercised composed Local entry sequence:
   - `create_live_agent_chat` for the target session with explicit custom agent selector and explicit model selector
   - `create_live_agent_chat` again for a decoy session so the target would no longer be the latest updated Local chat
   - `reveal_live_agent_chat` for the target session, which on this build closed the matching visible tab before reopening it
   - `send_message_to_live_agent_chat` for the target session, which on this build used the documented reveal plus focused-submit fallback because exact Local session-targeted send is unsupported
- Reopen case A:
   - requested agent selector: `agent-architect.intake`
   - requested model: `copilot/claude-sonnet-4`
   - target session: `8a2ed89f-41e8-4d04-a368-0befd82013fb`
   - create-path tool return: model `copilot/claude-sonnet-4`
   - reveal-path tool return: closed matching visible tab label `Live Chat Agent Architecture Intake Request`
   - persisted follow-up self-report after reopen: `self_reported_agent_or_role = agent-architect`, `self_reported_model = Claude Sonnet 4`
- Reopen case B:
   - requested agent selector: `support-doc.fresh-reader`
   - requested model: `copilot/gpt-5.4`
   - target session: `0df1e7fd-477a-403d-89be-672d28c6f6b8`
   - create-path tool return: model `copilot/gpt-5.4`
   - reveal-path tool return: closed matching visible tab label `Live Chat Support Documentation Inquiry`
   - persisted follow-up self-report after reopen: `self_reported_agent_or_role = agent-architect`, `self_reported_model = GPT-5.4`
- Reopen case C:
   - requested agent selector: `session-artifact.tail-reader`
   - requested model: `copilot/claude-opus-4.6`
   - target session: `8880341b-7920-4cfb-8e02-ac62978096ff`
   - create-path tool return: model `copilot/claude-opus-4.6`
   - reveal-path tool return: closed matching visible tab label `Live chat session artifact tail reader inquiry`
   - persisted follow-up self-report after reopen: `self_reported_agent_or_role = agent-architect`, `self_reported_model = Claude Opus 4.6`
- Interpretation:
   - the reopen-based composed flow now has repeated same-surface evidence that the requested model can survive into the first post-reopen self-report
   - the same evidence does not support requested custom-agent selection, because three varied requested agents all converged to `agent-architect` in the persisted post-reopen self-report
   - the strongest current Local claim is therefore narrower than “new chat with requested agent and model works”: the evidence supports a reopen-based path that stabilizes model selection and reloads some consistent custom mode, but not trustworthy selection of an arbitrary requested custom agent

## Historical Blocking Finding

Date: 2026-04-11

- Exercised entrypoint: `focus_visible_editor_live_chat`
- Requested target session: `7ae206a1-089f-40d3-b173-8afaa002177b`
- Requested target title: `Local follow-up attempt request`
- Result: failed with `No visible editor-hosted chat tab matched the requested live chat title "Local follow-up attempt request".`
- Same-host verification after reload still showed the visible editor tab set as:
   - `Focus follow-up probe request`
   - `Untitled-1`
   - `Creating Path Focus Boundary 1`
- The improved focus-target report now includes shallow tab-input string hints.
- On this run, only the untitled file tab exposed string hints, and neither visible chat tab exposed any hidden string hint that matched `Local follow-up attempt request`.
- A later same-layout run through `inspect_chat_focus_debug` tightened that finding further:
   - visible chat tab `Focus follow-up probe request` reported only:
      - `kind=Sm`
      - `constructor=Sm`
      - `viewType=-`
      - `uri=-`
      - `objectKeys=-`
      - `stringHints=-`
   - visible chat tab `Creating Path Focus Boundary 1` reported only:
      - `kind=Sm`
      - `constructor=Sm`
      - `viewType=-`
      - `uri=-`
      - `objectKeys=-`
      - `stringHints=-`
   - the active untitled file tab was the only tab that exposed any reflective metadata at all.
- That raw debug output means the blocker is not just missing title matching logic in repo code. On this build, the extension-host tab input objects for the visible Local chat tabs exposed no inspectable keys or string hints that could map them back to the persisted Local session title.
- Interpretation: on this build, the extension-host tab-state surface still did not expose enough identity metadata to map the visually open Local target chat to its persisted Local session title.
- Consequence at that time: the focus-only editor-chat route was implemented and callable, but it could not yet prove or perform correct target selection for this Local session on that earlier build state.

## Latest Verified Result

Date: 2026-04-22

- Exercised fresh target session for a reload-validated exact follow-up: `cf268cc3-4e35-4eda-87ec-f31323cad9fb`
- Load-only first turn anchor: `AA_STRICT_REENTRY_20260422_T4`
- Follow-up anchor: `AA_STRICT_REENTRY_20260422_T5`
- Tool-returned result explicitly reported:
   - `Transport Workaround Used: latest-session decoy`
   - `Transport Decoy Session ID: d72560d5-71a5-4c4e-8403-3ab8d4187cf8`
   - `Fallback Used: yes`
   - `Fallback Basis: ordinary Local exact-session send remains unsupported on this build`
- Load-phase transcript evidence for the target session showed:
   - the T4 load-only prompt
   - successful `read_file` execution for [../../CO-DESIGNER.md](../../CO-DESIGNER.md)
   - successful `read_file` execution for [../reference/current-status.md](../reference/current-status.md)
- Read-after-write verification showed:
   - the target session contains the real `AA_STRICT_REENTRY_20260422_T5` request
   - the decoy session contains no match for that anchor
- Interpretation:
   - after host reload, the new `SendChatMessageRequest.allowTransportWorkaround?: true` path is now directly verified as live on this Local surface
   - this upgrades the earlier same-day manual-decoy finding from concept proof to tool-path proof
   - the claim remains deliberately narrow: the host still lacks ordinary Local exact-session send, and the verified route is explicitly transport-workaround evidence rather than exact-session proof

## Previous Same-Day Control

Date: 2026-04-22

- Exercised target session for a strict-lane-style re-entry follow-up: `e892ff75-72f8-4ce5-af86-2c99567c828f`
- Load-only first turn anchor: `AA_STRICT_REENTRY_20260422_T1`
- Load-phase artifact evidence from the same session showed successful reads of [../../CO-DESIGNER.md](../../CO-DESIGNER.md) and [../reference/current-status.md](../reference/current-status.md)
- Negative control exact-session send with no workaround on the second turn was blocked by the current heuristic self-targeting guard
- Immediate same-host attempt with `SendChatMessageRequest.allowTransportWorkaround?: true` returned the same old guard block, so that run did not yet verify the new flag as a live runtime path on the attached host
- Manual transport-workaround control:
   - decoy session: `782801f7-95c3-46e7-8801-b463a49f06cb`
   - target follow-up anchor: `AA_STRICT_REENTRY_20260422_T2`
   - returned payload title: `Live Agent Chat Updated Via Reveal And Focused Editor Fallback`
   - returned fallback basis: ordinary Local exact-session send remains unsupported on this build
   - returned reveal lifecycle: one matching visible target tab was closed before reveal
- Read-after-write verification showed:
   - the target session contains the real `AA_STRICT_REENTRY_20260422_T2` request
   - the decoy session does not contain that anchor
- Interpretation:
   - the new opt-in transport-workaround concept is operationally sound on this Local surface when a decoy breaks the latest-session ambiguity
   - this is still transport-workaround evidence rather than ordinary Local exact-session send support
   - the remaining gap from this run is runtime uptake of the new `allowTransportWorkaround` flag itself, not proof that the underlying workaround concept fails

## Previous Verified Result

Date: 2026-04-15

- Exercised create-path entrypoint: `create_live_agent_chat`
- Requested mode for the rerun pack: `Agent`
- Requested model for the rerun pack: `copilot/gpt-5-mini`
- Fresh same-surface rerun of the previously blocked harmless first-turn prompt pack still produced persisted generic refusals:
   - `807933b6-b194-4b70-95c2-d8bbb25978a1` | Swedish general project-purpose prompt | result: `I'm sorry, but I cannot assist with that request.`
   - `fe412770-5fd8-4d02-a46b-7972cb84a754` | English general project-purpose prompt | result: `I'm sorry, but I cannot assist with that request.`
   - `f039e578-f55d-42c6-8b0c-f8c3e33d7b9f` | Swedish README-anchored prompt | result: `I'm sorry, but I cannot assist with that request.`
   - `1b89ddaa-1ea8-461c-9d66-617689282050` | Spanish general project-purpose prompt | result: `I'm sorry, but I cannot assist with that request.`
   - `2c5e50de-3b10-4e45-a1ab-35bbda0c6519` | Japanese general project-purpose prompt | result: `I'm sorry, but I cannot assist with that request.`
   - `bc9bb57b-acf3-4469-a8ce-aeeacb54b868` | Swedish "what is not fully verified yet" prompt | result: `I'm sorry, but I cannot assist with that request.`
   - `d6f54157-e994-49b7-972c-8cdc1285c11e` | exact-word control `Svara exakt med ordet gran.` | result: `I'm sorry, but I cannot assist with that request.`
- Same-surface control run with `copilot/gpt-4.1` on the matched Swedish general prompt still succeeded:
   - `78a74b84-473b-4075-9c30-0f261af49074` | result: normal Swedish project summary
- Exercised lifecycle entrypoint: `send_message_with_lifecycle`
- Fresh same-surface lifecycle rerun without explicit mode or model request succeeded on the documented fallback path:
   - target session: `c1a82e9e-8d57-4bd7-aa0b-dc8a2b926a4c`
   - fallback used: yes
   - fallback basis: ordinary Local exact-session send remains unsupported on this build
   - persisted selected model: `copilot/gpt-4.1`
   - latest assistant result: normal Swedish project summary
- Interpretation:
   - the harmless first-turn refusal problem remains reproducible on the Local create surface for `copilot/gpt-5-mini`
   - the same host and same Local surface still answer normally with `copilot/gpt-4.1`
   - the lifecycle route can still complete honestly on its fallback path when no explicit mode or model proof is requested, so that path should not be conflated with the GPT-5 mini create-path refusal issue

Date: 2026-04-12

- Exercised entrypoint: `create_live_agent_chat`
- Requested mode: `Agent`
- Requested side effect: create `sandboxed-workspace/local-settled-wait-reload-20260412-c.txt` with exact content `LOCAL_SETTLED_WAIT_RELOAD_20260412_C`
- Result after host reload and settled-wait fix:
   - tool return: `ok`
   - target session: `71dd26d7-de7c-4cd3-93db-e9e4a551814e`
   - dispatch surface: `chat-open`
   - read-after-write file verification succeeded
   - persisted session index showed the request plus assistant/tool progress rows for the completed write
- Interpretation: the Local create path now has fresh same-surface evidence that `blockOnResponse` can wait through the full request rather than returning early on first persisted mutation.

- Exercised entrypoint: `send_message_with_lifecycle`
- Requested side effect: create `sandboxed-workspace/local-lifecycle-settled-reload-20260412-c.txt` with exact content `LOCAL_LIFECYCLE_SETTLED_RELOAD_20260412_C`
- Requested explicit `mode: Agent` first failed with the expected current surface blocker:
   - `Focused live chat send cannot currently prove or enforce mode/model selection on this surface; pre-select them in the UI first, or use createChat with explicit verification.`
- Re-run without explicit mode selection after the same host reload:
   - tool return: `ok`
   - target session: `3017c4d4-a03d-4837-91d7-2861bd6b8ea7`
   - fallback used: yes
   - fallback basis: ordinary Local exact-session send remains unsupported on this build
   - dispatch surface: `focused-chat-submit`
   - read-after-write file verification succeeded
- Interpretation: the stabilized Local lifecycle route now also has fresh same-surface evidence that the settled-wait logic survives the reveal-plus-focused fallback path on this host.

## Previous Verified Result

Date: 2026-04-11

- Exercised entrypoint: `Agent Architect Tools: Focus Visible Editor Chat`
- Entry route: command palette invocation with the built-in live-chat session picker
- Available picker evidence from the same host session showed at least these Local sessions as selectable targets:
   - `86388876-6ce5-4e77-8178-607f0810a0b7` with title `Greeting and Introduction`
   - `7ae206a1-089f-40d3-b173-8afaa002177b` with title `Local follow-up attempt request`
   - `d70b0bb8-1a82-42a4-addd-adc01861ff08` with title `Creating Path Focus Boundary 1`
- Stable pre-run visible editor-tab layout was confirmed from `inspect_chat_focus_debug` as:
   - `Untitled-2`
   - `Creating Path Focus Boundary 1`
   - `Untitled-1`
   - `Local follow-up attempt request`
- User session evidence after selecting `Local follow-up attempt request` in the picker: the command focused the matching open editor-hosted Local chat tab directly.
- User then repeated the same command against the other already-open non-active chat tab and reported that the command also focused that chat correctly.
- No extra markdown report tab opened during these successful manual focus-only runs.
- Interpretation: for already visible editor-hosted Local chats, the focus-only command path now has same-entrypoint user-session evidence of correct tab targeting when the intended session is resolved explicitly through the command-palette picker.
- Remaining boundary: this is still not exact Local reopen or exact Local send support. It is best-effort focus of an already open editor-hosted Local chat tab after explicit target selection.

## Latest Reopen Result

Date: 2026-04-22

- Stable pre-run focus report showed no visible Local chat tabs in the active group.
- Exercised entrypoint: `probe_local_reopen_candidates`
- Requested target session: `cf268cc3-4e35-4eda-87ec-f31323cad9fb`
- Successful same-window attempt:
   - runtime command: `workbench.action.chat.openSessionInEditorGroup`
   - argument shape: `object-resource-local-session-uri`
   - active tab label after open: `Reviewing CO-DESIGNER.md and current-status.md files`
- Fresh same-host support checks after the probe still report:
   - `Local exact reveal: supported`
   - `Local exact send: unsupported`
- Interpretation: on the current Windows host, the exact-reveal boundary remains live and measurable on the ordinary Local surface, while ordinary exact-session send remains unsupported.

Previous same-shape reopen evidence from 2026-04-11 remains preserved below through the earlier `7ae206a1-089f-40d3-b173-8afaa002177b` run.

## Latest Close-Only Result

Date: 2026-04-11

- Stable pre-run tab layout was verified from `inspect_chat_focus_debug` as:
   - `Untitled-1`
   - `Inheritance regression probe request`
   - `Local follow-up attempt request`
   - `Direct prefix alive status in README.md`
- Exercised entrypoint: `Agent Architect Tools: Close Visible Live Chat Tabs (Exact Session)`
- Requested target session: `7ae206a1-089f-40d3-b173-8afaa002177b`
- Requested target title: `Local follow-up attempt request`
- Post-run tab layout was verified from `inspect_chat_focus_debug` as:
   - `Untitled-1`
   - `Inheritance regression probe request`
   - `Direct prefix alive status in README.md`
- User session evidence then confirmed that the correctly targeted tab was the one closed.
- Interpretation: on this build, the extension command surface now has live evidence for exact session-targeted close of a visible Local editor-hosted chat tab. This is separate from exact Local send, which remains unsupported.

## Latest Explicit-Session Editor-Focused Result

Date: 2026-04-22

- Target confirmation before dispatch came from `inspect_chat_focus_targets`, which reported one active `likelyChatEditor` tab with label `Reviewing CO-DESIGNER.md and current-status.md files`.
- Exercised entrypoint: `send_message_to_live_agent_chat`
- Requested target session: `cf268cc3-4e35-4eda-87ec-f31323cad9fb`
- Unique prompt: `AA_WINDOWS_EDITOR_TARGET_20260422_T1. Svara med exakt: ACK_AA_WINDOWS_EDITOR_TARGET_20260422_T1`
- Returned payload reported:
   - `Status: ok`
   - `Fallback Used: yes`
   - `Fallback Basis: Exact session-targeted send for ordinary local chats is not supported in this VS Code/Copilot build.`
   - `Dispatch Surface: focused-chat-submit`
- Read-after-write verification against persisted transcript artifacts showed:
   - target session `cf268cc3-4e35-4eda-87ec-f31323cad9fb` contains the unique anchor as a real user message
   - the invoking main session `c35af26e-1f27-4639-ae42-44d0ff71957e` has no matching transcript evidence block for that anchor
- Interpretation: the explicit-session reveal-plus-focused-editor fallback still provides correct target delivery on the current Windows host when the intended Local session is first confirmed as the active editor-hosted chat tab. The unsupported boundary remains ordinary exact-session send, not this fallback lane.

Previous same-shape editor-focused target-delivery evidence from 2026-04-11 remains preserved below through the earlier `5895583f-119e-41d2-9180-1b90e9b5798f` run.

## Latest Internal Alias Attempt

Date: 2026-04-11

- Attempted entrypoint: `agentArchitectTools.chatInterop.sendMessageWithFallback`
- Requested target session: `5895583f-119e-41d2-9180-1b90e9b5798f`
- Unique prompt: `AA_FALLBACK_SEND_PROBE_2026_04_11_T2 exact target delivery check`
- Direct command invocation failed.
- Read-after-write verification found no matching real request message for that prompt in either:
   - `chatSessions/5895583f-119e-41d2-9180-1b90e9b5798f.jsonl`
   - `chatSessions/86388876-6ce5-4e77-8178-607f0810a0b7.jsonl`
- Interpretation: before reload, the repo code contained the alias but the attached host session had not yet reloaded the runtime registration.

## Latest Internal Alias Result After Reload

Date: 2026-04-11

- Attempted entrypoint: `agentArchitectTools.chatInterop.sendMessageWithFallback`
- Requested target session: `5895583f-119e-41d2-9180-1b90e9b5798f`
- Unique prompt: `AA_FALLBACK_SEND_PROBE_2026_04_11_T3 alias runtime verification`
- Direct command result returned:
   - `ok: true`
   - `dispatch.surface: focused-chat-submit`
   - `revealLifecycle.closedMatchingVisibleTabs: 1`
   - `revealLifecycle.closedTabLabels: ["Inheritance regression probe request"]`
- Read-after-write verification through session inspection showed:
   - `get_agent_session_index` for `5895583f-119e-41d2-9180-1b90e9b5798f` recorded the T3 prompt at `L10` with timestamp `2026-04-11T11:07:33.595Z`
   - `get_agent_session_window` for `5895583f-119e-41d2-9180-1b90e9b5798f` found one match for the T3 anchor
   - `get_agent_session_window` for `86388876-6ce5-4e77-8178-607f0810a0b7` returned no match for the same T3 anchor
- Interpretation: after host reload, the internal alias is live and callable as its own runtime entrypoint, and it delivered the prompt to the intended Local session rather than the invoking session.

## Latest Internal Alias Repetition Run

Date: 2026-04-11

- Attempted entrypoint: `agentArchitectTools.chatInterop.sendMessageWithFallback`
- Requested target session: `34870189-0343-4948-b6a4-633e50fa98fc`
- Unique prompt: `AA_FALLBACK_SEND_PROBE_2026_04_11_T4 second target varied phrasing`
- Direct command result returned:
   - `ok: true`
   - `dispatch.surface: focused-chat-submit`
   - `revealLifecycle.closedMatchingVisibleTabs: 1`
   - `revealLifecycle.closedTabLabels: ["Direct prefix alive status in README.md"]`
- Read-after-write verification through session inspection showed:
   - `get_agent_session_window` for `34870189-0343-4948-b6a4-633e50fa98fc` found one match for the T4 anchor at `L10`
   - the match in the target session is a real `k=requests` row with timestamp `2026-04-11T11:11:12.853Z`
   - `get_agent_session_window` for `86388876-6ce5-4e77-8178-607f0810a0b7` also matched the same anchor, but only on a `k=requests/.../response` narration row rather than a real request row
- Interpretation: the alias has repeated same-entrypoint target-delivery proof on a second Local target session, and the boundary check confirms that request-vs-response row type must be part of the evidence test.

## Latest Internal Alias Invalid-Target Boundary

Date: 2026-04-11

- Attempted entrypoint: `agentArchitectTools.chatInterop.sendMessageWithFallback`
- Requested target session: `00000000-0000-0000-0000-000000000000`
- Unique prompt: `AA_FALLBACK_SEND_PROBE_2026_04_11_T5 invalid session boundary`
- Direct command result returned:
   - `ok: false`
   - `reason: Exact session-targeted send for ordinary local chats is not supported in this VS Code/Copilot build. Only a Copilot CLI-specific openSessionWithPrompt command is present, and it rejects normal local chat session resources. Fallback reveal failed: session not found: 00000000-0000-0000-0000-000000000000`
- Interpretation: the alias handles a nonexistent Local target as an explicit same-surface failure rather than reporting a false successful dispatch.

## Participant-Switch Probe

Goal:
Determine whether any exercised Local path proves a real custom participant switch rather than only persisted custom mode or model state.

Probe steps:

1. Exercise a Local path that can request custom mode, model, or role guidance on the first turn.
2. Record the exact exercised entrypoint and the prompt text used for that run.
3. Re-read the persisted target session artifact after the run.
4. Identify the exact request batch for that run by a stable marker such as request timestamp, request id, or the unique exercised prompt text.
5. Inspect both the persisted input-selection fields and the actual request participant fields for that same request batch.
6. Record at minimum:
   - `inputState.mode.id`
   - `inputState.selectedModel.identifier`
   - `requests[n].agent.id`
   - `requests[n].modelId`
   - `requests[n].modeInfo`
7. Treat the run as a real participant-switch success only if the persisted request participant itself changes to the intended custom participant for that request.
8. If the request keeps the built-in Copilot participant while mode or model fields changed, record the outcome as mode or model carry-through only, not custom participant selection.

Probe interpretation rules:

- Persisted selection state is weaker evidence than persisted request participant state.
- Prompt-attached custom role guidance does not by itself prove a participant switch.
- A custom mode URI plus `copilot/gpt-5-mini` request evidence still does not prove custom participant selection if `requests[n].agent.id` remains built-in.
- Do not infer a participant switch from response style, slash-command usage, or prompt wording alone.