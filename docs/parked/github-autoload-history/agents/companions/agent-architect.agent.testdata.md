# Test Data Companion: agent-architect

## Purpose
Hold compact canonical proof cases and preflight constraints for `agent-architect` so the main test companion can stay goal-first and small.

## Execution Preflight
- begin from a clean baseline: no unresolved probe-only file edits, no accidental spill artifacts, and no intentionally open UI state left over from an earlier run unless that state is itself the subject of the proof
- for contamination-sensitive runs, avoid having visible companion files, support-only artifacts, or benchmark-answer artifacts open in the active editor unless the proof explicitly studies that contamination channel
- re-read the current `agent-architect` runtime artifact plus the minimum support artifacts for the proof family before the run starts
- if a soft reset, compaction, long pause, or support-layer edit happened after a probe was drafted, rebuild that probe from current artifacts before using it
- record the exercised surface, evidentiary lane, and any retained support artifacts before the run starts
- if runtime and support artifacts disagree on scope, surface, phase boundary, or claim strength, stop the run or mark it `INCONCLUSIVE`; do not count it as proof until the support layer is refreshed
- if the re-grounded artifact set is not recorded in the benchmark artifact, harness record, or returned payload for that run, the run must be treated as `INCONCLUSIVE`
- if companion omission or companion creation matters for the proof, record the companion decision before the run is accepted
- if a helper or sub-role companion is allowed as an exception, record the affected role, exact named gap, and why parent-role artifacts were insufficient

Minimum companion decision fields when relevant:
- `companion_decision`: `not-relevant` | `parent-proof-sufficient` | `exception-approved`
- `companion_target_role`: exact role name when the decision concerns a helper or sub-role
- `companion_exception_gap`: exact named gap when `companion_decision` is `exception-approved`
- `companion_exception_reason`: why parent-role artifacts were insufficient when `companion_decision` is `exception-approved`

Preferred placement:
- in markdown benchmark or harness artifacts, place these fields in a dedicated `Companion Decision Record` block adjacent to run provenance
- in structured returned payloads, place these fields under a top-level `companion_decision_record` object
- if contamination cannot be ruled out after the run, downgrade the claim or rerun from a cleaner baseline instead of silently accepting the result

## Canonical Cases
### Case: explicit-target create proof
Goal:
Prove that `agent-architect` can take one clean explicit CREATE target to an honest created artifact with preserved stage evidence.

Input:
User-facing request to create one new runtime agent from one clean brief under `docs/targets/`, using a target that depends only on explicit workspace artifacts.

Setup Constraints:
- the target runtime artifact must not already exist
- no companion for the target may be pre-created before the proof run
- only the target brief should exist as the build input for that new target

Lane Constraints:
- use the same user-facing invocation surface that is being claimed for the proof
- if topology prevents direct helper proof, record that equivalent stage evidence is the strongest available claim on that surface

Use This For:
- the first proof of CREATE outcome for a clean target such as `Support Claim Checker` or `Section Syncer`

Expected Constraints:
- the result must either create the runtime artifact with preserved read-after-write and post-write structure validation, or block explicitly
- the run must not rely on companion text, support text, or benchmark text as an answer template

Cleanup Expectations:
- remove probe-only spill artifacts created only to support the run
- keep only the intended runtime artifact and any explicitly justified support-only evidence

### Case: explicit-target bounded update proof
Goal:
Prove that `agent-architect` can perform one bounded PATCH or REPAIR on an explicit existing runtime artifact without widening scope.

Input:
User-facing request to improve or repair one named existing runtime artifact with one bounded outcome.

Setup Constraints:
- the target runtime artifact must already exist
- the request must not require terminal execution, broad refactoring, or multiple implied targets

Lane Constraints:
- exercise the same surface that would be claimed for bounded update support
- verify from artifacts after the write, not from narration alone

Use This For:
- bounded single-artifact update proof before recurring regression is added

Expected Constraints:
- changed files stay within the justified artifact set
- read-after-write and validation evidence are preserved for the touched artifact

Cleanup Expectations:
- if the update path goes wrong or becomes unclear, restore a known baseline before trying another correction path
- do not leave accidental spill edits in sibling runtime or support artifacts

### Case: blocker and honesty proof
Goal:
Prove that `agent-architect` blocks instead of guessing when target, scope, lifecycle, or release evidence is insufficient.

Input:
User-facing request where one critical prerequisite is ambiguous, missing, or unsupported on the exercised surface.

Setup Constraints:
- choose only one ambiguity or unsupported prerequisite per run so the blocking reason is interpretable
- do not name the expected blocker text in the prompt

Lane Constraints:
- use the same surface where the limitation would matter in real use
- if the limitation is surface-specific, record that explicitly

Use This For:
- target ambiguity, missing build context, missing release-gate evidence, or unsupported helper proof boundaries

Expected Constraints:
- the run blocks or downgrades honestly rather than guessing or overclaiming
- no runtime artifact mutation occurs unless the request still justified one independently of the blocker

Cleanup Expectations:
- confirm that no unintended mutation or residual probe state was left behind
- retain only explicitly justified support-only evidence of the blocker

### Case: cleanup and recovery proof
Goal:
Prove that test-created spill state and unclear intermediate mutation state are cleaned up or reset before a proof is accepted.

Input:
One proof run that intentionally creates probe-only file or UI state, or one controlled wrong-path mutation scenario that should trigger undo/reset.

Setup Constraints:
- the retained baseline must be recorded before the run
- the proof must distinguish intentional support artifacts from accidental spill

Lane Constraints:
- use the same surface that created the state being cleaned up
- when UI state is involved, verify cleanup through the same UI-capable route that exposed that state

Use This For:
- cleanup verification and undo-first confirmation without bloating the main companion

Expected Constraints:
- file or UI spill is absent afterward, or its retention is explicitly justified as support-only
- unclear failed mutation paths are reset before another corrective path is attempted

Cleanup Expectations:
- restore baseline file and UI state before closing the proof run
- record any intentionally retained support artifact and why it remains

## Fixtures
- clean CREATE targets under `docs/targets/` that do not depend on out-of-band attachments
- one existing explicit runtime artifact for bounded update proof
- declared clean baseline snapshot of retained runtime and support artifacts when cleanup or contamination risk matters

## External Dependencies
- none