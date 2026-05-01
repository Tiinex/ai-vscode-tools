# Test Companion: agent-architect

## Purpose
Define the minimum user-facing proof needed to judge whether `agent-architect` meets its current target outcome, without turning this file into a prompt template or a long micro-test catalog.

## Goal to Prove
`agent-architect` should be judged satisfactory for the current phase only when it can take one explicit runtime-agent target from request to honest outcome through the declared surface, with explicit blockers when needed, bounded mutation when justified, preserved evidence after mutation, and no stronger readiness or orchestration claims than the run can actually prove.

## Proof Families
### Proof Family: target and lifecycle honesty
Goal:
Show that `agent-architect` resolves one explicit target at a time and blocks instead of guessing when the target, scope, or lifecycle is not sufficiently resolved.

Primary Surface:
Current user-facing `agent-architect` invocation surface under evaluation.

Evidentiary Lane:
Artifact-trusted runtime role on the exercised surface; constrained subagent runs count only as bounded process evidence.

Minimum Proof:
- one neutral positive run with one explicit target and directly relevant artifact inputs
- one neutral boundary run where target identity, scope, or build context is insufficient

Required Evidence:
- returned target and lifecycle decision bound to one explicit artifact or one explicit blocker
- changed-file set or verified no-mutation result that matches that decision

Not Enough:
- success that depends on a prompt that already names the expected lifecycle, helper stages, or exact internal process steps

### Proof Family: CREATE outcome
Goal:
Show that a legitimate CREATE request produces the first runtime artifact immediately and honestly, with preserved stage evidence and post-write validation.

Primary Surface:
Current user-facing `agent-architect` invocation surface under evaluation.

Evidentiary Lane:
Artifact-trusted runtime role on the exercised surface; if topology limits prevent direct helper proof, the run must preserve explicit equivalent stage evidence instead of implying helper execution.

Minimum Proof:
- one neutral positive CREATE run on a clean target that depends only on explicit workspace artifacts
- one neutral boundary run where CREATE must block because required inputs, writable scope, or minimum build context are missing

Required Evidence:
- created runtime artifact plus preserved read-after-write confirmation
- preserved evidence for design, tool selection, frontmatter, compilation, and post-write structure validation

Not Enough:
- artifact creation without preserved stage evidence
- a result that looks plausible but relies on companion text, support text, or benchmark text as an answer template

### Proof Family: bounded update outcome
Goal:
Show that PATCH or REPAIR work stays narrow, verifies the resulting mutation, and does not spill into unrelated artifacts.

Primary Surface:
Current user-facing `agent-architect` invocation surface under evaluation.

Evidentiary Lane:
Artifact-trusted runtime role on the exercised surface.

Minimum Proof:
- one neutral positive bounded update run against one explicit existing runtime artifact
- one neutral boundary run where the request would require guessed targets, broad refactoring, or unsupported side effects

Required Evidence:
- changed-file set limited to the justified artifact set for the request
- preserved read-after-write confirmation and validation summary for the touched runtime artifact

Not Enough:
- a helpful-looking change that widened to sibling artifacts, companions, or benchmark files without direct justification

### Proof Family: evidence and release honesty
Goal:
Show that `agent-architect` does not overclaim readiness, release state, or helper-orchestration beyond what the preserved evidence supports.

Primary Surface:
Current user-facing `agent-architect` invocation surface under evaluation.

Evidentiary Lane:
Artifact-trusted runtime role on the exercised surface, with explicit downgrade when the topology or surface cannot prove helper execution directly.

Minimum Proof:
- one run where preserved mutation, validation, and explicit release-gate mapping evidence allow the stronger claim that is being tested
- one boundary run where release-gate evidence, repeated-run evidence, or helper proof is missing and the output must stay weaker

Required Evidence:
- explicit preserved `agent-architect.release-gate` mapping when `release_state` is reported
- explicit blocker, omission, or downgraded claim when topology or evidence limits prevent a stronger statement

Not Enough:
- persuasive narration without preserved release-gate evidence
- surrogate evidence upgraded into full orchestration proof

### Proof Family: cleanup and recovery discipline
Goal:
Show that probe work does not leave accidental spill state behind and that unclear failed mutation paths are reset before retry.

Primary Surface:
The same surface exercised by the proof run, plus artifact and UI-state verification surfaces needed for cleanup checks.

Evidentiary Lane:
Surface-specific; claim strength depends on explicit artifact absence, restored baseline state, or explicit retained-support justification.

Minimum Proof:
- one run that creates probe-only file or UI state and then verifies that the baseline was restored or that the retained artifacts are explicitly justified
- one boundary run where a wrong or unclear intermediate mutation state is undone or reset before another path is attempted

Required Evidence:
- verified absence, reversion, or explicit justified retention of test-created files or UI state
- preserved note showing whether undo, reset, or explicit retained-support treatment was used

Not Enough:
- silent leftover files, tabs, chats, or support-state drift after the run

## Non-Leading Rules
- do not encode the desired behavior in the prompt
- do not smuggle tool choice, transport path, helper-role sequence, or internal process steps into the prompt unless that exact choice is under test
- do not use this companion as a ready-made prompt template; any executable prompt must be generated neutrally from the proof need, not copied from this file's explanatory language

## Execution Rules
- run each proof family through the same user-visible or tool-visible surface that the behavior is meant to support
- verify outcomes from artifacts or returned payloads, not from `agent-architect`'s own narration alone
- keep prompts neutral enough that the runtime artifact, not the prompt writer, must supply the process discipline
- keep the main companion compact; detailed prompt variants and microcases belong in benchmark or testdata artifacts only when they become necessary

## Re-Grounding Gate
- before accepting a proof run, re-read the current `agent-architect` runtime artifact and the minimum support artifacts that govern the same proof family
- if the runtime artifact, this companion, testdata support, or process support disagree on scope, surface, phase boundary, or claim strength, stop the run or mark it `INCONCLUSIVE`; do not count it as proof until the support layer is refreshed
- after soft reset, compaction, long pause, or meaningful artifact edits, regenerate any executable probe from current artifact state instead of reusing an earlier drafted prompt or cached interpretation
- record which artifacts were re-grounded and which surface was exercised in the benchmark artifact, harness record, or returned payload for that run; without that provenance, the run cannot count as proof

## Pass / Fail Gate
- PASS requires the current-phase goal to be supported by the proof families that were actually exercised, with the required evidence preserved and with no stronger claim than that evidence supports
- FAIL includes guessed targets, missing read-after-write where mutation is claimed, prompt-led success, spill edits outside justified scope, stale unreconciled support state, or release or helper claims that exceed the preserved evidence

## Regression Activation
- regression is secondary to proof: add recurring regression only after a proof family has been demonstrated and needs protection against future drift
- do not turn the main companion into a long-running catalog of micro-tests; when detailed variants become necessary, place them in benchmark or testdata artifacts

## Provenance and Contamination Checks
- note whether unrelated helpers, skills, memory, instructions, open support artifacts, active editor state, or visible companion files could have contaminated the run
- note any surface, transport, topology, or observability limit that constrains what the run can honestly prove
- when companion omission or companion creation matters for the claim, record the companion decision explicitly in the benchmark artifact, harness record, or returned payload
- if a helper or sub-role companion is allowed as an exception, record the affected role, exact named gap, and why parent-role artifacts were insufficient

Minimum companion decision fields when relevant:
- `companion_decision`: `not-relevant` | `parent-proof-sufficient` | `exception-approved`
- `companion_target_role`: exact role name when the decision concerns a helper or sub-role
- `companion_exception_gap`: exact named gap when `companion_decision` is `exception-approved`
- `companion_exception_reason`: why parent-role artifacts were insufficient when `companion_decision` is `exception-approved`

Preferred placement:
- in markdown benchmark or harness artifacts, place these fields in a dedicated `Companion Decision Record` block adjacent to run provenance
- in structured returned payloads, place these fields under a top-level `companion_decision_record` object
- when contamination cannot be ruled out, downgrade the claim or rerun from a cleaner baseline instead of silently accepting the result

## Cleanup and Recovery
- remove or revert test-created spill artifacts that are not intended to persist as benchmark or support artifacts
- restore UI state when the test opened tabs, chats, or other visible state only for the probe
- if a mutation-oriented test takes a wrong path, prefer undo or reset to a known baseline over iterative patching on top of an unclear intermediate state