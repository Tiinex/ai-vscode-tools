# Using Agent Architect

This guide is for people who want to get better results from Agent Architect as users.

It is not about contributing to the repository.
It is about how to ask the agent for work in a way that makes the outcome more reliable.

If you want the shortest version of this whole guide, read `The short rule`, `A good request usually includes four things`, and `One practical mindset`.

## What makes Agent Architect different

Agent Architect is not meant to behave like a generic default agent that simply tries to be helpful no matter how incomplete the request is.

One of its strengths is that it enforces process outward toward the user.
That means it will often prefer to block, ask for clarification, or narrow the scope instead of quietly guessing.

That is not the same thing as being rigid for its own sake.
It is part of how the project tries to reduce false success.

In practice, the difference looks like this:

- a generic agent may try to infer what you probably meant
- Agent Architect is more likely to stop when the target, boundary, or proof standard is still too unclear

That difference matters most when the work affects real files, runtime artifacts, or claims about what the system now supports.

In plain language: Agent Architect is more willing to slow down than to guess.

## The short rule

Agent Architect works best when you are explicit about:

- what target you mean
- what you want changed
- what constraints matter
- what proof you want back

The less the agent has to guess, the better the result tends to be.

And if the request is still too unclear, Agent Architect should ideally block instead of pretending the guess was good enough.

## A good request usually includes four things

### 1. The target

Say what the work should affect.

Examples:

- “Update the README opening.”
- “Fix the validation wording in docs/reference/current-status.md.”
- “Review the current guide structure.”

### 2. The outcome

Say what success looks like.

Examples:

- “Make it easier for a new reader to understand.”
- “Keep the meaning but make the tone less sterile.”
- “Reduce duplication without changing behavior.”

### 3. Important constraints

Say what must not be lost.

Examples:

- “Keep it truthful to the repo’s current status.”
- “Do not mutate files yet.”
- “Do not remove the Matrix metaphor, just soften it.”
- “Preserve LICENSE and NOTICE as part of the project identity.”

### 4. The proof you want back

Say how you want the result presented.

Examples:

- “Explain your reasoning first, no edits yet.”
- “Make the changes and let me review the full package.”
- “Run a quick validation after editing.”

## Weak request vs strong request

### Weak

“Fix the docs.”

The problem is not that this is wrong.
The problem is that the agent has to guess too much.

With a normal default agent, that kind of request may still produce something that looks decent.
With Agent Architect, the healthier outcome is often to slow down, ask what target you mean, or block until the scope is clearer.

### Better

“Make the README less sterile, but keep it truthful to the repo’s current status.”

This is better because it gives both direction and constraint.

### Strong

“Rewrite the README opening so it feels more human and memorable. Keep the Matrix metaphor, but avoid sounding antagonistic or overclaiming what the repo proves today. Make the changes directly and validate markdown afterward.”

This is strong because it gives:

- target
- intended effect
- tone boundary
- truth boundary
- permission to act
- expected verification

## Why blocking is sometimes the right result

Agent Architect is built on the idea that a clean blocker is often better than fake progress.

If the request is still missing one of the important pieces, blocking can be the correct outcome:

- the target is not clear enough
- the intended change is still ambiguous
- the constraints are missing
- the proof standard is not clear enough for the kind of claim being made

That is one of the places where Agent Architect differs from a more improvisational agent.
The point is not to be difficult.
The point is to avoid hidden guessing being mistaken for disciplined work.

## Example: generic agent vs Agent Architect

### Vague request

“Fix the docs.”

### What a generic agent may do

- choose a likely file
- rewrite something plausible
- present the result confidently

### What Agent Architect should be more willing to do

- ask which document you mean
- ask whether you want analysis first or direct mutation
- ask what tone, audience, or truth boundary matters
- block if the request is still too ambiguous for safe work

### Why that is a strength

Because once real artifacts are involved, “probably the right file” and “probably the right change” are often not good enough.

## Good patterns for asking

These patterns usually work well.

### Ask for a scoped change

“Update this section, not the whole file.”

### Name the audience

“Write this for a new reader, not for a maintainer.”

### Name the tradeoff

“Prefer clarity over completeness.”

### Name the evidence bar

“Do not claim more than the repo and tooling can support.”

### Name the blocker rule when it matters

“If the target is still ambiguous, block instead of guessing.”

## When to ask for reasoning first

Ask for reasoning before mutation when:

- the direction is still unclear
- multiple document strategies are plausible
- you want consensus on tone or framing first
- the change affects project identity or public messaging

Example:

“Do not edit yet. Read the current README and docs/guides, then explain whether the guide layer feels developer-oriented or user-oriented, and what structure would make more sense.”

## When to ask for direct action

Ask for direct action when:

- the goal is already clear
- the target is known
- you want speed more than deliberation
- you are happy to review the result afterward

Example:

“Clarify the guide folder so it has a real end-user path and a separate contributor path. Make the changes directly and keep the rest of the docs structure intact.”

## Useful example prompts

### Documentation tone

“Make the README opening more memorable and inviting. Keep the Matrix metaphor, but ground it quickly in what the repo actually does. Avoid hype.”

### Documentation structure

“The guides folder feels ambiguous. Split it into a clear user path and a clear contributor path, and add examples for how an end user should phrase requests to the agent.”

### Safe analysis first

“Do not mutate anything yet. Read the candidate documentation and tell me what is worth salvaging, what drifts from repo truth, and what should stay out.”

### Explicit blocker-friendly request

“If I have not given enough detail to do this safely, stop and tell me exactly what is missing instead of filling in the blanks yourself.”

### Focused edit

“Left-align the README images, keep their current width, and do not change any surrounding text.”

## One practical mindset

You do not need to write perfect prompts.
You just need to reduce avoidable guessing.

A simple way to do that is:

1. name the target
2. name the intended effect
3. name the boundary
4. say whether you want reasoning first or direct action

That is usually enough to get a much better result.

And when that still is not enough, Agent Architect blocking is often a sign that the process is working, not that it failed.