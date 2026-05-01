# Artifact Types

This repo uses several different artifact types.
They are related, but they are not interchangeable.

If you only want the short version, read `Support artifacts`, `Benchmark artifacts`, and `Practical reading rule` first.

## Runtime artifacts

These define active runtime roles or behavior when a live runtime family is present in the checkout.

Examples:

- historical `.agent.md` runtime artifacts now parked under [../parked/github-autoload-history/agents](../parked/github-autoload-history/agents)

## Companion artifacts

These support development, testing, or maintenance of runtime artifacts.
They are not the same as runtime identity and they are not meant to be loaded as production agents.

Examples:

- historical companion artifacts under [../parked/github-autoload-history/agents/companions](../parked/github-autoload-history/agents/companions)

## Skill artifacts

Skills are repo-local support artifacts that package reusable workflow knowledge for recurring tasks.

They are support, not runtime identity.
They can help the agent perform a recurring kind of work, but they do not replace `.agent.md` contracts or explicit validation.

Examples:

- historical skill artifacts under [../parked/github-autoload-history/skills](../parked/github-autoload-history/skills)
- small templates or examples kept inside the same skill folder

For the conceptual model and usage boundaries, see [skill-system.md](skill-system.md).

## Support artifacts

These explain strategy, process, current scope, and hardening direction.

Examples:

- [README.md](../../README.md)
- [ROADMAP.md](../../ROADMAP.md)
- [CO-DESIGNER.md](../../CO-DESIGNER.md)

## Benchmark artifacts

These define or capture bounded validation work.

Examples:

- [docs/targets](../targets)
- [docs/benchmarks](../benchmarks)

## Evidence artifacts

These preserve what happened during a run strongly enough to support later inspection.

They matter because this repo does not want runtime truth to depend on memory alone.

## Practical reading rule

For the current checkout, read the artifact families in this order:

1. support artifacts for current posture and epistemic rules
2. benchmark and evidence artifacts for what was actually exercised
3. parked historical runtime and skill artifacts when you need design lineage or old contract material

That order exists to reduce reviewer confusion about what is current, what is evidence, and what is historical background.