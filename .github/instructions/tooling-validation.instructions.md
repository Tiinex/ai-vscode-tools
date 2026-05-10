---
description: Maintained validation protocol for ai-vscode-tools Local-chat and workflow tooling work.
applyTo: "**/*"
---

# Tooling Validation Protocol

Use this file as the maintained validation protocol for ai-vscode-tools.

Use skills for task-shaped operating behavior. Use this file for phase structure, live-pass criteria, fallback-versus-public boundary, and definition-of-done discipline.

## Canonical Workflow Boundary

- Treat the language-model tool surface as the canonical public live-chat workflow surface for this repo on the current host unless a newer maintained artifact explicitly replaces that decision.
- For same-session live-chat operations on the current host, treat the language-model tools as the only public workflow surface.
- Current canonical public Local-chat operations are `list_live_agent_chats`, `create_live_agent_chat`, `inspect_live_agent_chat_quiescence`, `reveal_live_agent_chat`, `send_message_to_live_agent_chat`, `close_visible_live_chat_tabs`, and `delete_live_agent_chat_artifacts`.
- Treat focused send as internal fallback transport or support-only diagnostic coverage, not as a peer public workflow beside exact-session send.
- Treat mirrored VS Code commands, fallback transport, debug commands, and support commands as non-peer surfaces unless a maintained artifact explicitly grants a separate operator role.
- Treat Local-chat LM tool operations as serial single-flight work against shared host state. Concurrent invocation should fail fast rather than queue silently, overlap optimistically, or wait indefinitely.

## Evidence Hierarchy

- When surfaces disagree, use this authority order:
  - exact live-tool behavior and exact-session persisted evidence
  - this instruction file
  - maintained workflow skills
  - README text, package command contributions, tasks, tests, and other convenience surfaces
- For exact-session send and wait decisions, prefer exact request-scoped persisted evidence over transcript lag or broad session listings.
- Prefer exact-session persisted fields such as matching `requestId`, request timing, and completion state over transcript lag when deciding whether the exact request itself is complete.
- Treat transcript tail state as secondary evidence for receiver awareness and lag diagnosis, not as the primary authority for exact request completion.
- Treat broad session listings as tertiary evidence that must not overrule fresher exact-session reads.
- For custom-agent create validation on the current host, matching mode-backed or selection-backed agent evidence outranks the generic persisted request-agent field.

## Phase 1

- Phase 1 is tooling-first validation with no skill-resolution burden.
- Source-led explicit direction is acceptable in Phase 1 when that is needed to test the canonical tooling path itself.
- Use the canonical Local-chat operations directly in this order when the full sequence is under test: list, create, inspect, reveal, exact-session send, close visible tabs, delete artifacts.
- The first real request in the create step must be long-running enough to exercise wait logic meaningfully. Prefer a read-only first request that normally runs longer than 20 seconds.
- The create proof is not complete until one awaited follow-up message has been sent in the same created chat after the first response completes.
- If focused send is exercised during this phase, treat it as explicit fallback-diagnostic coverage only, not as a canonical workflow step.
- If any canonical public operation is unavailable on the current execution surface, stop or defer. Do not substitute another route, manual workaround, or convenience path for the same operation.
- If the canonical path is blocked, do not offload routine operator work to the human unless the missing capability is genuinely unreachable from the agent side.

## Live Pass Bar

- Prefer the exact-session live-send surface over weaker focused-only fallbacks when validating send and wait behavior.
- Compare three layers together when validating live behavior:
  - tool wall time
  - persisted session request timing
  - transcript tail state
- Capture the exact `sessionId` and matching `requestId` when available so those layers can be correlated to one concrete request.
- For the current host, treat a provisional live send pass as `tool wall time <= max(5000 ms, 2 x persisted totalElapsed)` for the same exact request.
- Minute-scale tool wait after low-single-digit persisted completion remains a failure.
- If persisted completion is fast but live tool return still lags badly, treat that as evidence that an active dispatch path is still waiting on the wrong signal.

## Phase 2

- Phase 2 begins only after Phase 1 is good enough.
- Phase 2 validates the preferred operational flow through normal skill resolution and a target role in a non-leading way.
- Do not spoon-feed the tool list in the prompt during Phase 2.
- The role should choose the canonical path, preserve ordering discipline, avoid duplicate or conflicting routes, and avoid improvising fallback routes when the canonical path is absent.
- Evaluate role behavior against the canonical/public-vs-fallback boundary from this file, not against convenience wording from older artifacts.

## Definition Of Done

- All canonical Local-chat operations relevant to the intended sequence complete their own role reliably enough on the current OS, host environment, and IDE surface.
- The create proof includes a long-running read-only first request plus one awaited follow-up in the same created chat.
- Repeated create probes do not reuse the same role or close role variation in a way that hides inheritance or retargeting defects.
- Exact-session send is judged against observed live wall time together with exact persisted timing, not by repo tests alone and not by persisted evidence alone.
- Focused send, if retained, is explicitly downgraded to fallback or support-only status and does not survive as a peer public workflow beside exact-session send.
- Canonical public live-chat operations are not duplicated by separate first-class command surfaces, README guidance, or workflow skills for the same operational intent on the current host.
- Closure includes a duplicate-surface audit across package command contributions, enabled-command sets, command registrations, README guidance, tasks, tests, and workflow skills.
- The preferred best-practice operational flow is captured in the relevant skill files after tooling-first validation is good enough.
- Phase 1 tooling validation has been completed in a source-led way where needed.
- Phase 2 has then been tested through a target role in a non-leading way where skill resolution happens through the normal resolve path.
- Human involvement remains passive observation and feedback unless the execution surface truly lacks the canonical path.

## Maintenance Rules

- If validation discipline changes, update this file first, then update skills, README text, tasks, tests, and any temporary repair artifacts that depend on it.
- Temporary repair files may point here, but they should not remain parallel homes for durable phase, DoD, or pass-bar guidance.
- If a temporary repair file no longer carries unique local value, delete it rather than leaving a competing shadow protocol behind.
- Treat “passed at the moment” as scoped to the current OS, host environment, and IDE surface unless a maintained artifact explicitly broadens that claim.