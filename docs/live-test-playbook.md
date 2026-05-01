# Live Test Playbook

Date: 2026-04-11

This playbook describes how to run manual end-to-end tests for Local chat behavior and related interoperability work.

If you only need the short version, read `Choose the lane before you test`, `Manual test loop`, `Fresh-chat re-entry probe`, and `Final reporting rule`.

The guiding rule is simple:

- use the same surface for verification that you expect to support the behavior
- prefer artifact-backed recovery over conversational continuity
- keep lane strength explicit so you do not overclaim what a workaround proved

## Scope

This playbook assumes:

- the extension is built and loaded in VS Code
- the relevant workspace is open
- you can inspect persisted session state in workspace storage when needed

Repo scripts may help you reproduce or speed up a test, but they are not primary evidence for ordinary extension-host behavior or cross-platform support.

## Primary evidence route

For persisted session, transcript, or content-reference questions:

- start with the repo's dedicated session-inspection tools
- treat VS Code's built-in reference inspection UI as auxiliary observability only
- do not use `agent-architect` as a shortcut for bounded session-evidence triage

## Recommended settings

- `agentArchitectTools.postCreateTimeoutMs = 60000`
- `agentArchitectTools.waitForPersistedDefault = true`

## Choose the lane before you test

Always write down which lane the run belongs to before interpreting the result.

### `native-local`

Use this when the question is what an ordinary Local user can actually expect.

### `deterministic-state-hack`

Use this when the question is reproducibility from a known model or mode state, or when you need stronger host-state control for debugging.

### `transport-workaround`

Use this only when the host otherwise cannot be measured cleanly.
Examples include prompt-file transport, decoy-session steps, or other methods used to bypass self-targeting or focus limitations.

This lane can still be useful, but it is weaker evidence for ordinary user capability.

## Manual test loop

1. Identify the target session through the extension-host route.
2. Decide whether to continue an existing session or create a new one.
3. Send a probe through the intended high-level route.
4. Verify persisted artifacts through the same surface family or the bound session file.
5. Record what the route proved and what remains uncertain.

## Fresh-chat re-entry probe

Canonical benchmark pair:

- [../benchmarks/fresh-chat-re-entry-probe.md](../benchmarks/fresh-chat-re-entry-probe.md)
- [../benchmarks/fresh-chat-re-entry-probe.best-outcome.md](../benchmarks/fresh-chat-re-entry-probe.best-outcome.md)

Use this when the question is whether visible artifacts are now strong enough to recover the right inference after reset, compact, or a clean new chat.

Preferred strict lane:

1. Create a new Local chat.
2. First prompt should be load-only: instruct the fresh chat to read `CO-DESIGNER.md` and `docs/reference/current-status.md` and do nothing else.
3. Verify that load-phase evidence from the persisted transcript or session artifacts shows those files were actually read.
4. Only then send one short orientation or epistemic-boundary question in the same chat.
5. Judge the answer against the inferential-equivalence rubric in `CO-DESIGNER.md`, not by tone or surface fluency.

Weak but still useful fallback:

1. If the same-chat follow-up path is blocked by Local self-targeting or focus limitations, open a separate fresh chat for each question.
2. In each weak probe, bundle file-reading and one short question into the first prompt.
3. Record the run explicitly as a weaker first-prompt probe rather than a clean two-phase re-entry verification.

Transport-workaround note:

- if the only remaining blocker is the latest-session self-targeting heuristic on `send_message_to_live_agent_chat`, an explicit decoy workaround can now be requested with `allowTransportWorkaround: true`
- this does not upgrade the run into strict exact-session proof; it remains `transport-workaround` evidence because the route intentionally creates a decoy session to break latest-session ambiguity
- keep the decoy session id in the run note so later cleanup and interpretation stay honest

Recommended question set:

- repo goal: `What are we actually trying to achieve in this repo right now?`
- epistemic boundary: `What is the difference between artifact-backed state, current tool evidence, and current-session inference in this project?`
- action judgment: `What is the narrowest sensible next step if the goal is to improve fresh-chat re-entry without copying the whole conversation?`

Recommended interpretation:

- treat successful file reads plus a correct answer as evidence that the artifacts are carrying real inference
- treat failed exact ack wording as prompt-following friction unless the run also fails to read or reason from the artifacts
- treat same-session follow-up blocking on Local as a surface limitation, not as proof that re-grounding failed
- treat opt-in latest-session decoy use on `send_message_to_live_agent_chat` as a measurement aid, not as proof that ordinary Local exact send exists
- if bundled first-prompt probes pass but the strict two-phase lane remains blocked, report that artifact-backed recovery looks promising but the stronger Local verification lane is still operationally constrained

Suggested cleanup:

- after a probe, close any visible editor-hosted chat tabs for that exact session before opening more test chats
- prefer the exact-session cleanup routes: `close_visible_live_chat_tabs` on the LM-tool surface or `Agent Architect Tools: Close Visible Live Chat Tabs (Exact Session)` on the command surface

## Probe design

Use a unique anchor string in every test prompt.
That keeps retrieval unambiguous and makes read-after-write verification easier.

Examples:

- `AA-VERIFY-20260411-LOCAL-001`
- `AA-VERIFY-20260411-MODEL-002`

## What to verify

The right verification depends on the claim.

Examples:

- for delivery: verify the prompt reached the intended session
- for persistence: verify the relevant row or artifact exists on disk
- for boundary behavior: verify that forbidden files stayed unchanged
- for selection claims: separate UI evidence from persisted participant evidence

## Important cautions

- successful dispatch is not enough
- visible UI alignment is valuable, but not the same as persisted participant proof
- a useful workaround is not the same as ordinary product support
- a compacted or partial transcript is not automatically a contract failure if stronger artifact evidence still exists elsewhere

## Two-phase stabilization pattern

For some Local create tests, use a two-phase sequence:

1. send an inert first turn that establishes the requested state without real work
2. reopen, reveal, or refocus the exact session
3. send the real task as the second turn

Treat this as a stabilization routine, not as proof that exact participant selection is solved.

## Decoy-session workaround

If a follow-up is blocked because the target still appears to be the invoking or latest session, create a small decoy session first and then reopen or reveal the true target again.

Treat this explicitly as `transport-workaround` evidence.

## Long-session retrieval

For long sessions, prefer bounded retrieval.

- use `get_agent_session_window` when you need a compaction-aware session slice
- use `estimate_agent_context_breakdown` when you need a bounded context-pressure view
- use `export_agent_evidence_transcript` when the transcript artifact actually contains the evidence you need

Important boundary:

- a compaction boundary in persisted session JSONL does not guarantee that transcript JSONL contains an equivalent block

## Troubleshooting

If a route behaves unexpectedly:

1. reload the VS Code window
2. retry through the repo's canonical extension-host route
3. compare with the repo's MCP or CLI surface only when that comparison is relevant to the claim
4. treat remaining differences as surface-specific until proven otherwise

## Final reporting rule

Every live test note should say:

- which lane ran
- which exact surface was used
- what artifact-backed evidence was recovered
- what still remains inference rather than proof

That is the minimum needed for another reviewer to understand what the run actually proved.
