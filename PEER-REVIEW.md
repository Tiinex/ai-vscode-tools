# Peer Review Guide

This guide is for a reviewer who:

- is comfortable working with AI tools
- is not already deep in this repo's domain model
- can read code and docs critically
- should not be expected to infer the whole architecture alone

The goal is not to turn you into a maintainer in one sitting.
The goal is to help you give useful, reality-bound feedback.

## If you only have 15 minutes

Use [README.md](README.md) `Fast Peer-Review Path` as the canonical start path.

If you only have 15 minutes, use this shortened packet:

1. [docs/reference/current-status.md](docs/reference/current-status.md)
2. [README.md](README.md)
3. [docs/benchmarks/agent-architect-flagship-reliability-workflow.md](docs/benchmarks/agent-architect-flagship-reliability-workflow.md)

After that, answer three simple questions:

- do you understand what the repo is trying to do?
- do you understand what is actually proven today?
- do any parts sound more certain than the evidence justifies?

## Before you start

For the documented local review path, assume these baseline prerequisites:

- Node.js 20 or newer
- VS Code 1.99 or newer
- the current review posture treats Windows as the primary truth surface, while Linux remains the broader reference host for adjacent historical evidence

If your local environment is below those baselines, treat resulting setup failures as environment mismatches first, not as evidence that the repo's higher-level claims are false.

## What kind of review is useful here

The most useful peer review for this repo is not:

- “I skimmed it and it feels impressive”
- “the architecture seems big and probably good”
- “I assume the harder claims are true because the docs sound rigorous”

The most useful peer review is closer to:

- “I can understand what this repo is trying to do”
- “I can tell which claims are strong and which are intentionally bounded”
- “I can build it and follow the documented review workflow on the current host path”
- “I can see where the docs are clear, unclear, persuasive, or overstated”

## What this repo is actually claiming today

Before reviewing, anchor yourself on [docs/reference/current-status.md](docs/reference/current-status.md).

That page is the short status boundary for what is and is not being claimed today.

If you want to inspect the current evidence surfaces behind the docs, go next to [docs/reference/current-status.md](docs/reference/current-status.md), then [docs/benchmarks](docs/benchmarks), and then [tests/README.md](tests/README.md).

If you want one concrete bounded PoC before browsing the rest of the benchmarks, use [docs/benchmarks/agent-architect-flagship-reliability-workflow.md](docs/benchmarks/agent-architect-flagship-reliability-workflow.md) and start with `First Reviewer-Facing PoC` plus `Inspect Or Reproduce This PoC On The Current Surface`.

## How to read old and new material together

For peer review, use this simple reading rule:

- current active docs explain what the project is saying now
- preserved benchmarks and session artifacts show what was actually exercised
- parked or older materials show history and design lineage, but are not automatically the current contract

So the right reviewer posture is neither "trust only the newest text" nor "treat everything old and new as equally current".

The confidence-maximizing posture is:

- preserve historical material when it still carries provenance or design lineage
- demote it clearly when it is no longer the primary live surface
- route reviewers through the bounded current packet first

Unless the repository owner explicitly decides otherwise, preservation plus explicit demotion is safer than silent deletion.

## Short forward text

If you are sending this repo out for peer review on short notice, you can use this text:

> This is a bounded technical review request for Agent Architect.
> Please focus on whether the repo clearly explains what it is, what is actually proven today, what is still incomplete, and whether the reviewer path is inspectable and honest.
> The smallest review packet is `README.md`, `docs/reference/current-status.md`, `docs/benchmarks/agent-architect-flagship-reliability-workflow.md`, `docs/guides/getting-started.md`, and `PEER-REVIEW.md`.
> Please do not treat the current flagship PoC as a public all-surface rerun; today it is a bounded proof artifact on an internal reviewer route (`runSubagent`) plus a local mechanical baseline via `npm run test`. A useful public review can still judge whether that boundary is clearly stated, whether the Windows-first evidence is inspectable, and whether the repo is honest about what remains unproven.

## What governance means here

If the word `governance` appears unclear, read it in a narrow engineering sense.

Here it means the control rules around agent work:

- how the exact target is resolved
- which execution gate decides whether work may proceed
- what must be verified after mutation
- what validation evidence is needed before trust increases
- what bounded release state is justified at the end

For review purposes, governance is not a slogan.
It means the repo tries to make agent work controllable and checkable instead of leaving it to hidden context.

In practical terms, governance here is the combination of artifact authority, explicit gates, read-after-write verification, validation layers, and bounded release states.

If those mechanics are clear and consistently evidenced, the governance story is working.
If the docs use the word but the mechanics are fuzzy, the governance story is not yet landing.

## Governance inspection map

If you want to inspect the governance story directly instead of inferring it from prose, use this map:

| Governance mechanic | What to inspect |
| --- | --- |
| Artifact authority | [docs/concepts/artifact-model.md](docs/concepts/artifact-model.md) and [docs/philosophy/design-principles.md](docs/philosophy/design-principles.md) |
| Execution gates and target control | [docs/concepts/execution-model.md](docs/concepts/execution-model.md) and [docs/agent-architect.md](docs/agent-architect.md) |
| Read-after-write verification | [docs/concepts/execution-model.md](docs/concepts/execution-model.md), [docs/concepts/validation-model.md](docs/concepts/validation-model.md), and [docs/guides/running-validation.md](docs/guides/running-validation.md) |
| Validation layers | [docs/concepts/validation-model.md](docs/concepts/validation-model.md) |
| Bounded release states | [docs/reference/release-gate.md](docs/reference/release-gate.md) |
| One preserved reviewer-facing proof path | [docs/benchmarks/agent-architect-flagship-reliability-workflow.md](docs/benchmarks/agent-architect-flagship-reliability-workflow.md) |
| Current claim boundary | [docs/reference/current-status.md](docs/reference/current-status.md) |

That set is enough for a reviewer to judge whether `governance` here corresponds to real execution mechanics or only to architecture language.

## Next peer-review packet

If you want the smallest useful packet for the next peer review, send these artifacts in this order:

1. [README.md](README.md)
2. [docs/reference/current-status.md](docs/reference/current-status.md)
3. [docs/benchmarks/agent-architect-flagship-reliability-workflow.md](docs/benchmarks/agent-architect-flagship-reliability-workflow.md)
4. [docs/guides/getting-started.md](docs/guides/getting-started.md)
5. [tests/README.md](tests/README.md)

Important packet caveats:

- the bounded PoC in the flagship benchmark comes from the internal constrained same-surface `runSubagent` route to `agent-architect`
- reviewers who do not have that exact route should treat the PoC recipe as an evidence-reading and inference guide, not as a guaranteed public rerun path
- the quick runnable repo baseline (`npm install`, `npm run test`) is useful, but it proves only the local mechanical baseline on the current host; it does not upgrade the PoC into a public one-command reproduction of the same constrained surface
- treat [docs/guides/getting-started.md](docs/guides/getting-started.md) and [tests/README.md](tests/README.md) as baseline and inspection artifacts, not as a substitute for the constrained same-surface PoC route
- treat Windows as the current primary truth surface for the packet's review posture; treat Linux as the broader reference host for adjacent historical evidence; do not infer a verified macOS path from this packet
- even without access to the internal PoC route, reviewers can still evaluate the current public-review question: whether the repo's bounded claims are clear, evidence-backed, and proportionate to what is actually exercised today

What this packet is meant to let a reviewer infer:

- what the repo is trying to do
- what the current status boundary is
- one concrete bounded PoC on the constrained subagent surface
- how to separate the local mechanical baseline from broader runtime claims

What this packet is not meant to imply:

- full release-readiness
- full helper-orchestration proof
- equal evidence across Linux, Windows, and macOS
- exact equivalence between constrained subagent, Local chat, MCP, CLI, or Copilot CLI surfaces

Why this packet is the right one:

- it gives reviewers the current normative story first
- it keeps proof and ambition separate
- it avoids making historical runtime or skill material look like required live context for understanding the repo today

If that packet already feels too dense, stop after the status page and README and give feedback on clarity first.
That is still useful review.

## Recommended review path

This section is optional expansion after the canonical start path in [README.md](README.md).

If you want the concept-first path, read in this order:

1. [README.md](README.md)
2. [docs/agent-architect.md](docs/agent-architect.md)
3. [docs/reference/current-status.md](docs/reference/current-status.md)
4. [docs/guides/getting-started.md](docs/guides/getting-started.md)

If you want the proof-first path, read in this order:

1. [README.md](README.md)
2. [docs/reference/current-status.md](docs/reference/current-status.md)
3. [docs/benchmarks/agent-architect-flagship-reliability-workflow.md](docs/benchmarks/agent-architect-flagship-reliability-workflow.md)
4. [docs/guides/getting-started.md](docs/guides/getting-started.md)
5. [docs/agent-architect.md](docs/agent-architect.md)

If you still want more context after that:

1. [docs/guides/using-agent-architect.md](docs/guides/using-agent-architect.md)
2. [docs/concepts/artifact-model.md](docs/concepts/artifact-model.md)
3. [ROADMAP.md](ROADMAP.md)

## Host workflow to use during review

For this repo, the current review path should start from the documented Windows main-host workflow, because Windows is the active primary truth surface for review hardening.

Use [docs/guides/getting-started.md](docs/guides/getting-started.md) for the exact command path.

If you are reviewing from Linux, use that same guide as broader reference evidence and do not treat it as a contradiction of the current Windows-first review posture.

## What you can review well even without domain depth

You are well positioned to review these things:

- whether the README and core docs are understandable
- whether the project's claimed boundaries are clear
- whether the repo distinguishes ambition from verified reality
- whether the current documented review onboarding flow is practical
- whether the documentation sounds truthful instead of inflated
- whether the agent-facing philosophy is understandable to a technically literate outsider

## What you should not overclaim from one review pass

Please do not treat one review pass as proof of:

- deep runtime correctness across all surfaces
- cross-platform behavior
- correctness of every benchmark interpretation
- full architectural coherence of all internal support layers

If something looks unclear, say that it is unclear.
That is more useful than promoting uncertainty into a verdict.

## Questions worth answering in a review

If you want a concrete checklist, answer these:

1. After reading the main docs, can you explain what the repo is trying to do in plain language?
2. Can you tell which claims are strong today and which are intentionally limited?
3. Can you follow the documented review setup without guessing?
4. Does the repo feel more truthful than impressive, or more impressive than truthful?
5. Are there places where the documentation sounds more certain than the evidence boundary justifies?
6. Are there places where the project is clearer to maintainers than to new technical readers?
7. If you were asked whether the repo is worth deeper technical review, would your answer be yes or no, and why?
8. After reading the flagship benchmark, can you tell what the first bounded PoC proves and what it still does not prove?
9. After reading the README and the concept docs, can you explain what `governance` means here in concrete execution terms rather than only as architecture language?

If nine questions feels like too much, start with these four:

1. Is the repo's main idea understandable?
2. Is the current evidence boundary understandable?
3. Is the reviewer path easy enough to follow?
4. Where does the documentation create unnecessary friction?

## The most valuable kinds of feedback

The best peer-review feedback here is usually one of these:

- a place where the docs overstate what the repo currently proves
- a place where the docs are accurate but too hard for a new reader to follow
- a place where the workflow is real but underexplained
- a place where repo structure makes a false inference too easy

## A good review outcome

A good review outcome is not “I verified the whole vision.”

A good review outcome is more like:

- “I understand the core idea.”
- “I understand the current status boundary.”
- “I can run the documented review workflow.”
- “Here are the places where the project is especially clear, unclear, disciplined, or overstated.”

That is enough to make a peer review genuinely useful.