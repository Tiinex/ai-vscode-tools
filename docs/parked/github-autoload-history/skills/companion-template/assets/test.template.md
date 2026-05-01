# Test Companion: <agent-name>

## Purpose
Short statement of what this file governs.

## Goal to Prove
Short statement of the target outcome this companion is meant to prove.

## Proof Families
### Proof Family: <name>
Goal:
<what this proof family must establish>

Primary Surface:
<surface>

Evidentiary Lane:
<lane and claimed strength>

Minimum Proof:
- neutral positive run type
- required boundary or denial run type

Required Evidence:
- artifact or returned payload
- artifact or returned payload

Not Enough:
- leading prompt shape, wrong surface, or weak evidence that must not count as proof

## Non-Leading Rules
- do not encode the desired behavior in the prompt
- do not smuggle tool choice, transport path, or internal process steps into the prompt unless that exact choice is under test
- treat this companion as proof-governance, not as a prompt template

## Execution Rules
- run through the same user-visible or tool-visible surface that the behavior is meant to support
- verify outcomes from artifacts or returned payloads, not from the agent's own narration alone
- keep prompts neutral enough that the runtime artifact, not the test writer, must supply the process discipline

## Re-Grounding Gate
- before accepting a proof run, re-read the current runtime artifact and the minimum support artifacts that govern the same behavior
- if runtime and support artifacts disagree on scope, surface, lifecycle, phase boundary, or claim strength, stop the run or mark it `INCONCLUSIVE`; do not accept it as proof until the support layer is refreshed
- after soft reset, compaction, long pause, or meaningful support-layer change, rebuild any executable probe from current artifact state instead of reusing older prompt material
- record which artifacts were re-grounded for the run and which surface was exercised in the benchmark artifact, harness record, or returned payload for that run; without that provenance, the run cannot count as proof

## Pass / Fail Gate
- proof passes only when the declared goal is supported by the required evidence on the declared surface
- proof fails when success depends on a leading prompt, the wrong surface, missing read-after-write, stale unreconciled support state, or stronger claims than the evidence supports

## Regression Activation
- add regression only after the goal or proof family has been demonstrated and needs to be guarded against future drift
- keep the main companion compact; detailed prompt variants and microcases belong in benchmark or testdata artifacts when they become necessary

## Provenance and Contamination Checks
- note whether unrelated helpers, skills, instructions, memory, open support artifacts, or active editor state could have contaminated the run
- note any surface, transport, or observability limit that weakens the claim strength
- when companion omission or companion creation is part of the claim, record the companion decision explicitly in the run artifact or harness record
- if a helper or sub-role companion is allowed as an exception, record the affected role, exact named gap, and why parent-role artifacts were insufficient

Minimum companion decision fields when relevant:
- `companion_decision`: `not-relevant` | `parent-proof-sufficient` | `exception-approved`
- `companion_target_role`: exact role name when the decision concerns a helper or sub-role
- `companion_exception_gap`: exact named gap when `companion_decision` is `exception-approved`
- `companion_exception_reason`: why parent-role artifacts were insufficient when `companion_decision` is `exception-approved`

Preferred placement:
- in markdown benchmark or harness artifacts, place these fields in a dedicated `Companion Decision Record` block adjacent to run provenance
- in structured returned payloads, place these fields under a top-level `companion_decision_record` object

## Cleanup and Recovery
- remove or revert test-created spill artifacts that are not intended to persist as benchmark or support artifacts
- restore UI state when the test opened tabs, chats, or other visible state only for the probe
- if a mutation-oriented test takes a wrong path, prefer undo or reset to a known baseline over iterative patching on top of an unclear intermediate state
