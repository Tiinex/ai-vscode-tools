# Validation Model

Validation is where Agent Architect tries to distinguish “something happened” from “the system is justified in trusting what happened.”

If you only need the short version, read `The three layers`, `Release states`, and `Deterministic re-grounding and validation`.

## Validation is not optional

A changed file is not enough.
A plausible explanation is not enough.
A confident answer is definitely not enough.

Validation exists because AI systems can look successful long before they are trustworthy.

## The three layers

The repo repeatedly converges on three validation questions.

### Structure

Is the artifact well formed?
Does it match the contract it is supposed to follow?

### Process

Did the work follow the required execution path?
Was the target resolved first?
Was the mutation verified afterward?

### Behavior

Did the thing actually do what it is supposed to do?
And do we have evidence strong enough to say that honestly?

Those layers are easiest to reason about when you keep three different sources of truth separate:

- artifact state
- tool evidence
- current-session inference

## Repetition matters

One lucky pass is not the same as a reliable result.

That is why the repo treats repeated or varied validation as meaningful.
The goal is not ceremony for its own sake.
The goal is to avoid upgrading one-off success into a broad trust claim too early.

## Release states

Validation feeds into release states.

- `READY`
- `DEGRADED`
- `BLOCKED`

Those states are meant to make uncertainty visible, not to hide it behind a cheerful summary.

## Why this is important

Without a validation model, teams tend to drift toward two bad habits:

- trusting output that only sounds correct
- reporting progress that is larger than the preserved evidence really supports

Agent Architect tries to resist both.

That is why this repo often sounds strict.
It is not trying to be cold.
It is trying to stay honest.

## Deterministic re-grounding and validation

The validation model exists partly because deterministic re-grounding is the larger goal.
If a result only makes sense while the same conversation is still warm, the validation story is incomplete.
The stronger outcome is that a later reader can recover sufficiently equivalent judgment from the artifacts and evidence alone.

In plain language: if the result only makes sense while the same chat is still fresh, the validation story is not strong enough yet.