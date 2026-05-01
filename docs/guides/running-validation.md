# Running Validation

Validation in this repo is both mechanical and epistemic.

This guide is for contributors who are validating repository changes, not for end users asking the agent to do ordinary work.

Mechanical means you run the checks.
Epistemic means you do not claim more than those checks actually prove.

In plain language: do the check, then be honest about what the check actually proved.

That distinction matters because Agent Architect is trying to recover trustworthy judgment from visible evidence, not just produce a successful-looking command log.

## The practical baseline

From the repo root:

```bash
npm run build
npm run test
```

That is the minimum healthy loop for most changes.

## What validation should answer

Good validation should help you answer:

- is the artifact structurally valid?
- was the process followed in the right order?
- does the behavior match the intended contract?
- what uncertainty remains after the check?
- did the result survive on artifact state, or are you still leaning on current-session inference?

## Important caution

Do not treat every successful command as equal proof.

Examples:

- a successful dispatch is not always proof that the correct chat or target was reached
- a successful mutation is not enough without read-after-write verification
- a plausible behavioral result is not enough if the evidence chain is incomplete

This is the same reason the repo prefers deterministic re-grounding over smooth continuity.
If the result cannot be re-established from artifacts and evidence, confidence should stay bounded.

## Validation layers in this repo

Depending on the task, validation may involve:

- structure validation
- process validation
- behavior checks
- repeated varied runs
- release-state reasoning

## Where to look for stronger truth

The most honest validation story usually emerges from a combination of:

- test results
- preserved benchmark or session artifacts
- current support-layer status in [ROADMAP.md](../../ROADMAP.md)
- boundary notes in [CO-DESIGNER.md](../../CO-DESIGNER.md)

## Practical rule

When validation is ambiguous, separate three things explicitly:

- artifact state: what is now present on disk or in persisted session records
- tool evidence: what the route actually proved
- current-session inference: what still feels likely but is not yet anchored strongly enough