---
name: regression-protocol
description: "Use when Agent Architect or test-governor must decide how repeated validation and regression checks should run after a behavior change, including tool-backed flows such as commands, CLI, MCP, session reopen/send, or handoff paths."
---

# Baseline Regression Requirements
- run more than once
- vary phrasing where relevant
- include boundary checks when relevant
- include epistemic checks when relevant
- re-ground from current runtime and relevant support artifacts before accepting repeated runs as current proof
- include handoff checks when the target exposes handoffs
- when the changed behavior depends on a tool entrypoint, rerun through that same entrypoint instead of substituting a looser artifact-only check

# Tool-Backed Regression Rules
- prefer the narrowest real tool path that exercises the changed behavior, such as an extension command, CLI command, MCP call, or session reopen/send flow
- preserve the exact surface under test; do not claim coverage from a different surface that merely reaches similar code
- verify externally visible side effects from artifacts or returned payloads, not from chat narration alone
- when a tool path writes files or session state, include read-after-write verification against the touched artifact
- when a tool path is currently unsupported or unobservable, record that gap explicitly instead of silently downgrading coverage
- when ordinary Local exact-session send is unsupported and the question is about the first real post-create behavior, a host-bounded stabilization pattern is acceptable: inert first turn, then exact reveal or reopen or focus of the intended session, then the first real prompt; if the current tool guard blocks the target as the latest or invoking session, break that ambiguity first with a decoy session and then resume the intended target flow
- treat that Local stabilization pattern as behavior-oriented coverage only; it does not upgrade the evidence into exact custom-agent participant proof

# Boundary Definitions
- `Local` means the ordinary VS Code local chat/session surface backed by the current workspace or empty-window chat-session storage, not Copilot CLI, MCP, or another adjacent surface
- `same entrypoint` means the same user-visible command, session reopen/send path, CLI command family, or MCP method family that the changed behavior is expected to support

# Minimum Provenance For Tool Checks
- record the exercised entrypoint
- record the resolved target, session, or canonical resource when one exists
- record the verification artifact or returned payload that proved the observed outcome
- record that provenance in the benchmark artifact, harness record, or returned payload for the run, not only in chat narration
- when companion creation or companion omission is part of the claimed outcome, record the companion decision explicitly
- if a helper or sub-role companion is allowed as an exception, record the affected role, the exact named gap, and why parent-role artifacts could not keep that gap honest

Minimum companion decision fields when relevant:
- `companion_decision`: `not-relevant` | `parent-proof-sufficient` | `exception-approved`
- `companion_target_role`: exact role name when the decision concerns a helper or sub-role
- `companion_exception_gap`: exact named gap when `companion_decision` is `exception-approved`
- `companion_exception_reason`: why parent-role artifacts were insufficient when `companion_decision` is `exception-approved`

Preferred placement:
- in markdown benchmark or harness artifacts, place these fields in a dedicated `Companion Decision Record` block adjacent to run provenance
- in structured returned payloads, place these fields under a top-level `companion_decision_record` object

# Freshness And Re-Grounding Gate
- before a regression pack, re-read the current runtime artifact plus the minimum support artifacts that describe the same behavior, lane, or proof boundary
- if prompt material, testdata, or execution notes were prepared before a soft reset, compaction, or later support-layer edit, rebuild them from current artifacts before rerunning
- if runtime and support artifacts disagree, treat the run as `INCONCLUSIVE` or invalid until the disagreement is reconciled; do not silently count it as a pass
- record which artifacts were re-grounded for the run in the benchmark artifact, harness record, or returned payload, and record any unresolved freshness risk as part of failure triage or downgraded confidence

# Minimum Tooling Regression Pack
- a positive run through the intended tool surface
- a boundary, denial, or mismatch run through the same surface when relevant
- a provenance check that the result came from the intended target, session, or command surface
- a handoff or transport check when the flow crosses Local, CLI, MCP, or writable-scope boundaries

# Failure Triage
- if a tool-backed regression fails, distinguish artifact-contract failure from tool-transport failure, probe-design failure, harness limitation, or environment drift before patching
