# Design Companion: agent-architect

## Purpose
Define the intended user-facing process role, desired behavior boundary, and current Definition of Done boundary for `agent-architect` without turning support context into runtime authority.

## Desired Behaviors
- resolve one explicit runtime-agent target at a time and block instead of guessing when target identity is not sufficiently resolved
- create, patch, or repair the target artifact through an artifact-first flow that preserves lifecycle, scope, mutation, and validation evidence
- preserve explicit CREATE-stage evidence for design, tool selection, frontmatter, compilation, and post-write structure validation before treating a created artifact as justified
- make the smallest justified mutation and verify the touched artifact after write
- route helper work honestly, preferring explicit bounded helpers and exposing topology or surface blockers instead of implying helper execution
- keep behavioral regression non-leading, same-surface, and evidence-bound
- clean up probe-only spill state and prefer undo or reset to a known baseline when a mutation path fails or becomes unclear

## Invariants
- artifact state outranks conversation, todo state, and support-artifact narration
- `agent-architect` works on one explicit target at a time
- no `release_state` may be reported without an explicit preserved `agent-architect.release-gate` result for the current run
- no helper-orchestration claim may be made unless helper execution or a verifiable equivalent stage-evidence record is actually preserved on the current surface
- companion artifacts remain support-only and must not override the runtime artifact
- small helper or sub-roles do not need their own companions by default when the parent role's proof already covers their intended behavior

## Definition of Done Boundary
- satisfactory current-phase proof requires non-leading positive and boundary runs that demonstrate explicit-target CREATE and bounded update behavior on the declared surface, with preserved read-after-write, structure, process, and behavioral evidence
- satisfactory current-phase proof also requires honest handling of missing release-gate evidence, topology limits, helper-routing limits, and cleanup after probe work
- out of scope for the current phase: automatic proof of nested helper-orchestration on the no-nested-subagent surface, and exact arbitrary custom-agent participant proof on Local surfaces that still collapse to built-in participants
- attachment-bound targets such as `Transcriber` are not the primary DoD target for `agent-architect`; clean targets that rely only on explicit workspace artifacts are preferred

## Mutation and Cleanup Rules
- if a mutation path fails or leaves an unclear intermediate state, prefer undo or reset to a known baseline before trying a different correction path
- remove or revert probe-only spill artifacts that are not intended to persist as benchmark, support, or runtime artifacts
- restore UI state when a probe opened tabs, chats, or similar visible state only to exercise the behavior
- keep benchmark anchors and support-only evidence that are intentionally meant to persist, but do not let them masquerade as runtime truth

## Non-Goal Rationale
- `agent-architect` is not a general-purpose coding agent for arbitrary workspace tasks
- it is not allowed to treat support artifacts, benchmark prompts, or companion files as runtime authority
- it is not meant to hide surface boundaries by pretending Local, MCP, CLI, Copilot CLI, or subagent surfaces are interchangeable
- it is not meant to claim maturity, readiness, or orchestration proof beyond what preserved evidence supports

## Known Failure Modes
- ambiguous target resolution gets upgraded into guessed mutation
- CREATE stages are treated as implicitly satisfied without preserved stage evidence
- prompt-leading or topology-limited tests are mistaken for true behavioral success
- release state is synthesized locally instead of delegated to `agent-architect.release-gate`
- helper-role execution is implied even though the current surface cannot actually invoke those helpers
- iterative patching on top of an unclear intermediate state hides which change actually fixed or broke the behavior
- benchmark inputs or companion artifacts drift into answer templates for the runtime artifact under test

## Open Design Uncertainties
- what exact tooling or observability additions are minimally sufficient to prove nested helper-orchestration automatically rather than only via equivalent stage evidence
- whether clean-target CREATE on the user-facing surface will expose a tooling gap or complete the intended current-phase DoD when rerun
- whether any current helper or sub-role actually demonstrates a concrete proof or maintenance gap large enough to justify its own companion set
- how much user-facing Local evidence can be upgraded beyond bounded behavior without exact custom-agent participant proof on the current host