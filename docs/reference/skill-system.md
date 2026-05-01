# Skill System

Skills in this repo are repo-local support artifacts that package reusable knowledge for recurring kinds of work.

If you only need the short version, read `What a skill is`, `Where skills live`, and `Skills vs other artifact types`.

They are part of the repo's support knowledge layer.
They are meant to be applied when a task actually needs that knowledge, not to silently replace runtime identity.

## What skills do

Skills help the agent by carrying things such as:

- workflow rules
- domain-specific caution
- formatting or validation contracts
- refined patterns for recurring tasks
- small bundled assets such as templates or examples when a task genuinely needs them

In practical terms, a skill is one way to stop repeating the same narrow guidance in chat over and over.

## What skills are not

Skills are not the same thing as a runtime agent artifact.
They do not replace `.agent.md` contracts.
They do not replace explicit repo state, read-after-write verification, or bounded validation.
They should not silently become hidden authority over the active runtime unless the repo explicitly says so.

## Why that distinction matters

One of the easiest ways to make an AI system hard to reason about is to blur support behavior and runtime behavior together.

This repo tries to keep those layers separate:

- runtime artifacts define the active role
- skills provide reusable support knowledge for specific kinds of work
- support docs explain process, scope, and current hardening state

That separation keeps it possible to ask:

- what the runtime contract was
- what support knowledge was applied
- what still had to be verified

## Where skills live

Historically, repo-local skills in this project lived in a dedicated skill family.
In the current checkout, that family is parked under [../parked/github-autoload-history/skills](../parked/github-autoload-history/skills).

A skill folder may also contain small supporting assets such as:

- templates
- examples
- narrowly scoped reference material

Keep those assets inside the skill's own folder so they stay attached to the same support surface.

## How skills are used

A skill should be narrow enough that it applies only when the task really matches it.

In practice, that means:

- the `description` should say clearly when the skill applies
- the body should state the purpose and the bounded rules
- the skill should solve a recurring task, not act as a second general instruction layer

If a rule should apply across most work in the repo, it probably belongs in project instructions or support docs instead of a narrowly triggered skill.

## Skills vs other artifact types

- Runtime-agent artifacts define active runtime roles when a live runtime family exists.
- Companion artifacts support development or proof for a specific runtime artifact.
- Skills package reusable support knowledge that can help with recurring tasks across the repo.
- Support docs under `docs/`, `README.md`, `ROADMAP.md`, and `CO-DESIGNER.md` explain the model, scope, and current hardening state.

In plain language: skills help the workflow, but they are not the source of runtime authority.

Current checkout note:

- historical runtime-agent and skill families are parked under [../parked/github-autoload-history](../parked/github-autoload-history)
- treat them as historical design and support material until they are explicitly restored as live runtime input surfaces

For the broader taxonomy, see [artifact-types.md](artifact-types.md).

## When to create a skill

Create a skill when all of these are true:

- the task pattern recurs
- the guidance is specific enough to be useful only sometimes, not always
- the guidance is worth versioning as a support artifact
- a small bundled asset or stable rule set would make the task safer or clearer

Typical cases include:

- a recurring validation protocol
- a format contract
- a domain-specific review lens
- a narrow authoring workflow that keeps getting repeated in chat

## When not to create a skill

Do not create a skill just because a topic is important.

A different artifact is usually better when:

- the rule should apply across most repo work
- you need a runnable role with its own contract and tool set
- you need support files for one specific runtime artifact
- the need is one-off and not worth maintaining as a reusable support surface

## Current repo examples

Representative examples in this repo include:

- the parked `interaction-discipline` skill for epistemic response discipline
- the parked `target-resolution` skill for exact target and scope resolution
- the parked `regression-protocol` skill for repeated validation discipline
- the parked `evidence-transcript-format` skill for transcript output structure

For a browsable list of the current repo-local set, see [skills-index.md](skills-index.md).

## If you want to author one

For contributor-facing creation guidance, see [../guides/creating-skills.md](../guides/creating-skills.md).