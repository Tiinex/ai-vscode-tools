# Creating Agents

Agent Architect is designed to create or improve agents as artifacts, not as loose prompt personalities.

This guide is for contributors shaping runtime artifacts in the repo.
It is not the main guide for ordinary end users interacting with Agent Architect in chat.

If you want to create repo-local support skills instead of runtime agents, use [creating-skills.md](creating-skills.md).

If you only need the short version of this guide, read `The basic pattern`, `Runtime artifacts`, and `Agents are not skills`.

Current checkout note:

- the historical runtime-agent family is parked under [../parked/github-autoload-history/agents](../parked/github-autoload-history/agents)
- if you are revising runtime-agent design right now, treat that parked family as historical material that must be re-grounded before being treated as live again

## The basic pattern

When creating an agent, the system should:

1. resolve the exact target
2. determine whether CREATE is actually justified
3. derive the smallest valid contract
4. choose the minimum viable tool set
5. compile the artifact in the expected structure
6. verify and validate the result

## Runtime artifacts

Historically, this repo kept runtime agents in a dedicated `.agent.md` family.
That family is currently parked in this checkout while the support surface and public docs are being re-grounded.

The important point is still the same:

- runtime artifacts define an active role contract
- they are expected to use the canonical numbered structure
- that structure is part of how the system stays inspectable

If you need concrete historical examples, inspect [../parked/github-autoload-history/agents](../parked/github-autoload-history/agents).

Practical reading rule:

- use this guide to understand the contract shape
- use the parked examples as historical examples, not as proof that the family is live right now

## Agents are not skills

Runtime agents and repo-local skills solve different problems.

- use a runtime `.agent.md` artifact when you need an active bounded role with its own contract and tool surface
- use a skill when you need reusable support knowledge for a recurring kind of task

For the skill path, see [creating-skills.md](creating-skills.md) and [../reference/skill-system.md](../reference/skill-system.md).

## Companions are not the default

Companion artifacts can be useful, but the repo is explicit about not creating them automatically for every helper role.

The default rule is:

- keep runtime artifacts self-sufficient
- add companions only when a real design, proof, or maintenance boundary justifies them

## Build context matters

Agent creation should not guess through ambiguity.

If the target is not resolved enough to safely write the first valid artifact, the system should block rather than pretending progress happened.

That is slower in the short term and healthier in the long term.

## Where to look next

- [docs/concepts/execution-model.md](../concepts/execution-model.md)
- [docs/reference/artifact-types.md](../reference/artifact-types.md)
- [../parked/github-autoload-history/agents](../parked/github-autoload-history/agents)