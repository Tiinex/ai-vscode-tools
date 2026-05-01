# Failure Model

Agent Architect assumes that AI systems fail in subtle ways long before they fail in obvious ones.

That is why the project pays so much attention to failure models.

If you only need the short version, read `Common failure shapes` and `One more failure shape`.

## Common failure shapes

Examples the repo explicitly tries to guard against include:

- wrong target, plausible explanation
- right target, weak verification
- successful-looking output, missing evidence
- surface confusion between similar tool paths
- hidden context quietly deciding the result
- one-off success being upgraded into a broad trust claim

## Why failure-first thinking matters

Many AI workflows are optimized for momentum.
That often means they skip the moment where someone should ask, “What exactly would make this result untrustworthy?”

Agent Architect tries to ask that question earlier.

## Failure is part of the method

The point is not to glorify blocking.
The point is that a clean blocker is healthier than fake progress.

If you want the shortest version of the attitude, it is this:

> If it's not verified, it didn't happen.

If the target is still ambiguous, block.
If the evidence chain is incomplete, downgrade confidence.
If a host surface is weaker than it first looked, say so.

That attitude is one reason the repo can be both ambitious and credible at the same time.

## One more failure shape

Another important failure mode in this repo is false re-grounding:

- the text sounds fluent
- the tone feels familiar
- but the underlying inference has drifted away from the real goal, evidence boundary, or current artifact state

That is why the repo keeps returning to the distinction between artifact state, tool evidence, and current-session inference.

In plain language: familiar tone is not the same thing as recovered understanding.