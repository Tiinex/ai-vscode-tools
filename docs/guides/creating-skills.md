# Creating Skills

Agent Architect uses skills as repo-local support knowledge for recurring kinds of work.

If you only need the short version, read `Where skills live`, `What a skill should contain`, and `Review checklist`.

This guide is for contributors authoring or updating those support artifacts.
It is not the guide for runtime `.agent.md` artifacts.

For the conceptual model first, read [../reference/skill-system.md](../reference/skill-system.md).
For runtime agent creation instead, read [creating-agents.md](creating-agents.md).
To inspect the current repo-local set before adding a new one, read [../reference/skills-index.md](../reference/skills-index.md).

Current checkout note:

- the historical skill family is parked under [../parked/github-autoload-history/skills](../parked/github-autoload-history/skills)
- use that parked family as the concrete example set in this checkout until a live skill surface is restored explicitly

## Start with the classification

Before creating a skill, decide whether the need is really a skill.

Use a skill when:

- the task pattern recurs
- the guidance should apply only when relevant, not on most repo work
- reusable rules, examples, or templates would reduce repeated setup text

Do not use a skill when:

- the rule should apply across most work in the repo
- you need a runnable role with its own contract and tool surface
- you are supporting only one specific runtime artifact and a companion would be more honest
- the need is one-off and not worth maintaining as a reusable support surface

## Where skills live

Historically, repo-local skills in this project lived in a dedicated skill family.
In the current checkout, that family is parked under [../parked/github-autoload-history/skills](../parked/github-autoload-history/skills).

Keep any related supporting assets in the same skill folder.
That can include things such as:

- templates
- examples
- narrowly scoped reference material

Do not blur skill artifacts with runtime-agent artifacts.
That would make the control surface harder to reason about.

In plain language: skills help with recurring work, but they are not the same thing as the active runtime role.

## A good repo-local skill usually includes

This repo does not currently require one rigid section schema for every skill, but the working pattern is consistent.

A good skill usually includes:

- YAML frontmatter with a stable `name`
- a precise `description` that makes the task trigger clear
- a short purpose statement
- explicit rules or bounded guidance
- optional local assets only when the task genuinely needs them

## Current working metadata baseline

This repo's current practical baseline is:

- YAML frontmatter
- a stable `name`
- a precise `description`

Keep the `name` aligned with the folder identity.
Write the `description` so a contributor can tell when the skill should apply.

This is a working repo-local baseline, not a claim that the repo already enforces a stricter schema automatically.

A common repo-local pattern looks like this:

```markdown
---
name: naming-discipline
description: "Use when reviewing or editing repository naming so ambiguous labels are tightened before merge."
---

# Purpose
Keep naming changes bounded and reviewable.

# Use This Skill When
- terminology drift is likely to confuse readers
- naming cleanup is the real task, not a proxy for broader rewrites

# Rules
- prefer the existing repo vocabulary when it is already clear
- tighten labels before adding new synonyms
- do not broaden scope from naming cleanup into architecture changes
```

## The description matters

In practice, the `description` is the first signal for when a skill should apply.

That means it should be:

- specific about the task shape
- narrow enough to avoid broad accidental triggering
- written in the same practical vocabulary a contributor would likely use

Descriptions like "Use for docs" are too broad.
Descriptions like "Use when refining SequenceDiagram.org diagrams, arrows, notes, spacing, and repo-specific diagram conventions" are much healthier.

## Keep skill authority bounded

A skill is support knowledge, not runtime identity.

That means a skill should not:

- pretend to be the runtime contract
- hide decisions that should live in `.agent.md` or explicit docs
- claim that a behavior is proven just because the skill exists
- silently replace read-after-write verification or bounded validation

If the knowledge needs to be active as part of a runnable role, it probably belongs in a runtime artifact instead.

## Use local assets only when they help

Bundled assets are useful when they keep a recurring task more reproducible.

Good reasons include:

- a stable template
- an example output format
- a narrow reference that would otherwise be repeated in the body

Avoid adding loose support files that the skill does not actually rely on.

## Review checklist

Before treating a new skill as settled, check that:

- it lives in a dedicated skill folder, and in this checkout that means the parked skill family unless a live skill surface has been restored explicitly
- the `description` is precise enough to describe when it should apply
- the body explains the purpose and bounded rules clearly
- the scope is narrow enough that it will not behave like a second general instruction layer
- any bundled assets are small, local, and obviously attached to the same skill
- the skill does not claim runtime authority or proof it cannot actually provide
- contributor docs point to the skill if reviewers would otherwise not discover it

## Where to look next

- [../reference/skill-system.md](../reference/skill-system.md)
- [../reference/skills-index.md](../reference/skills-index.md)
- [../reference/artifact-types.md](../reference/artifact-types.md)
- [creating-agents.md](creating-agents.md)
- [../parked/github-autoload-history/skills](../parked/github-autoload-history/skills)