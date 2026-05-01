# Design Principles

Agent Architect is guided by a small number of ideas that show up again and again across the repo.

This page is meant to be short.
If it starts feeling abstract, read only the section titles and return later.

## Artifact authority

Conversation is useful.
Artifacts are authoritative.

The project tries to keep important state in forms that can survive reset, re-reading, and disagreement.

That is the philosophical version of the repo's control shift:
move important control away from hidden context and toward visible artifacts and evidence.

## Explicit over implicit

The system prefers:

- explicit targets
- explicit scope
- explicit gates
- explicit evidence

This is the opposite of letting a model improvise across hidden assumptions.

## Verification over confidence

A confident answer is not the same thing as a trustworthy result.

The project repeatedly chooses verification and status clarity over pleasing but unsupported certainty.

That is also why the project prefers deterministic re-grounding over smooth but weak continuity.

## Minimal mutation

When change is justified, the system should make the smallest valid change that actually solves the problem.

That keeps reasoning easier to follow and failure easier to localize.

## Failure-first honesty

The repo is unusually interested in failure modes.
That is a strength, not a mood.

Reliable systems are built by making it easy to notice what broke, why it broke, and what kind of evidence would be needed to trust a fix.

## Human-readable without becoming soft

The project also values explainability for humans.

That does not mean sanding away the hard edges.
It means making the reasoning legible without turning it into vague inspiration.

## Product legibility

If the repo starts sounding more elegant than useful, that is a product problem.
The point is not only to have a coherent model.
The point is to make the control shift legible enough that other people can actually understand, inspect, and test it.

In plain language: if people cannot understand the system well enough to review it, the design is not finished.