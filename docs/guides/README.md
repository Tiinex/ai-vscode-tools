# Guides

Audience: contributors, maintainers, peer reviewers, and users who are already past the repo's first-contact layer.

This folder is not the landing page for the project.
It is the practical layer after you already understand the basic idea.

If you are still deciding what Agent Architect is, or whether it is relevant, start with [../../README.md](../../README.md) and then [../agent-architect.md](../agent-architect.md).

If you are reviewing the repo publicly rather than working inside it, use [../../README.md](../../README.md) `Fast Peer-Review Path` first and treat this folder as the practical expansion layer after that.

The guides split into two paths.
That split matters because the repo serves both users of the workflow and people working on the repo itself.

## User path

Start here:

1. [using-agent-architect.md](using-agent-architect.md)

Use that path when you want to understand:

- how to phrase requests clearly
- when Agent Architect should block instead of guessing
- what details improve reliability
- what kind of proof or follow-up to ask for

## Repo path

Start here:

1. [getting-started.md](getting-started.md)
2. [../../PEER-REVIEW.md](../../PEER-REVIEW.md)

Then continue only as needed:

3. [creating-agents.md](creating-agents.md)
4. [creating-skills.md](creating-skills.md)
5. [debugging-agents.md](debugging-agents.md)
6. [running-validation.md](running-validation.md)

Use that path when you are:

- contributing code or docs
- reviewing the repo technically
- working on support artifacts, benchmarks, or validation paths
- re-grounding historical runtime or skill material that is currently parked in this checkout

## Practical reading rule

If your question is "how do I talk to Agent Architect well?", use [using-agent-architect.md](using-agent-architect.md).

If your question is "how do I work on this repo without overclaiming what is live right now?", start with [getting-started.md](getting-started.md).

If you are unsure which path you need, start with [using-agent-architect.md](using-agent-architect.md) if the task is about asking the agent for work, and [getting-started.md](getting-started.md) if the task is about building, testing, or reviewing the repo.

Current checkout note:

- older runtime-agent and skill families are parked under [../parked/github-autoload-history](../parked/github-autoload-history)
- active docs in this folder should be read against the current support surface, not as proof that those parked families are live runtime entrypoints today