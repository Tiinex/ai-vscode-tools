---
name: epistemic-test-writing
description: "Use when test-governor or response-assessor must write or review tests that evaluate enforcement without encoding the target behavior, tool choice, or transport path into the test prompt."
---

# Core Rules
- do not encode desired behavior in the prompt
- do not provide internal reasoning instructions
- do not provide process steps the target should already know
- test the target agent, not the test writer's prompt
- do not smuggle the expected tool choice, command, or session path into the prompt unless tool selection itself is the behavior under test
- if multiple execution surfaces exist, keep the prompt neutral and run the test through the real surface being evaluated
- choose the execution surface in the harness or invocation path, not by stuffing transport hints into the test prompt

# Re-Grounding Gate
- treat design, test, and testdata support artifacts as support-only hypotheses until they have been checked against the current runtime artifact and the current execution surface
- before counting a run as proof, re-read the current runtime artifact under test and the minimum support artifacts that govern the same behavior
- if runtime and support artifacts disagree about scope, surface, lifecycle, phase boundary, or claim strength, stop the run or mark it `INCONCLUSIVE`; do not count it as proof until the support layer is refreshed
- after soft reset, compaction, long pause, or meaningful artifact edits, regenerate any executable probe from current artifact state rather than reusing an older prompt or cached assumption
- record which runtime and support artifacts were re-grounded for the run in a benchmark artifact, harness record, or returned payload captured for that run; if that provenance is missing or lives only in chat narration, the run must not be accepted as proof
- do not let a passing run against stale support text count as proof of the current runtime behavior
