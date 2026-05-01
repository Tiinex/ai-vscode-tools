# Execution Model

Agent Architect is built around an explicit execution loop.

The loop is simple enough to explain to a newcomer, but strict enough to matter in real work.

If you only want the short version, read `The loop` and `Determinism, but with honesty`.

## The loop

1. classify
2. resolve target
3. apply gate
4. mutate
5. verify
6. validate
7. assign release state

![Diagram showing the deterministic execution loop from classify through release state](../images/execution-loop.png)

## Why this loop exists

AI systems often jump too quickly from request to answer.
That is where a lot of false confidence comes from.

The execution model slows that jump down and forces key questions into the open.

### Classify

What kind of situation is this?
Is the task a create, a patch, a repair, or something that should block?

### Resolve target

What exact artifact or surface is being affected?
If the target is fuzzy, the work is not ready.

### Apply gate

Not every situation should proceed the same way.
Some should create.
Some should patch.
Some should stop.

### Mutate

When the gate allows mutation, the model should make the smallest valid change that solves the real problem.

### Verify

This is where read-after-write matters.
Do not assume the mutation happened.
Check.

### Validate

A file can be changed and still be wrong.
Validation checks structure, process, and behavior.

### Release state

The final output should not collapse into a vague sense that things are “probably fine.”
It should end in a bounded status.

## Determinism, but with honesty

The repo uses deterministic language because it is trying to reduce hidden state and untracked improvisation.
But the honest reading is this:

- determinism is the direction
- explicit gating is the mechanism
- preserved evidence is what allows claims to harden over time

In this repo, determinism should be read as deterministic re-grounding.
The target is not word-for-word repetition.
The target is that the same artifacts and the same validation path recover the same practical judgment strongly enough to continue honest work.

The loop is not marketing decoration.
It is the project’s attempt to make AI work inspectable end to end.

In plain language: slow the work down enough that you can tell what happened and why.