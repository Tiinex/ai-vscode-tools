# Debugging Agents

Debugging in this repo is not just about finding a bug.
It is about finding where certainty broke.

If you only need the short version, read `What to ask first`, `Surface discipline matters`, and `Practical debugging rule`.

This guide is for contributors and maintainers debugging the repo, its runtime artifacts, or its verification surfaces.

## What to ask first

When something looks wrong, start with these questions:

- was the target correct?
- did the mutation really happen?
- are we looking at the right surface?
- what evidence is actually preserved?
- did the claim outrun the proof?
- did the current conversation merely feel aligned, or can the reasoning be re-grounded from artifacts?

## Surface discipline matters

One of the easiest ways to confuse yourself in this repo is to blur different surfaces together.

Examples:

- Local chat is not the same as Copilot CLI
- MCP is not the same as a UI-bound extension-host flow
- an internal script harness is not automatically the same thing as the main product route

Debugging gets much easier once you keep those boundaries explicit.

## Use the evidence lane that fits the question

For Local-related work, the repo distinguishes between:

- `native-local`
- `deterministic-state-hack`
- `transport-workaround`

This is not overcomplication.
It prevents you from mistaking a useful workaround for a normal-user capability.

## Use the right evidence tool first

For session-evidence work, start with the repo's dedicated inspection tools rather than ad hoc helpers.

That means:

- use session, transcript, snapshot, profile, or context-breakdown tools first when the question is about persisted evidence
- treat VS Code's built-in chat references UI as manual auxiliary observability, not as the primary evidence route
- do not delegate session-evidence triage to `agent-architect`; it is the wrong role for bounded session inspection

## Good debugging artifacts

The most useful debugging artifacts are the ones that let another person follow the reasoning later.

That includes:

- session evidence
- transcript evidence
- benchmark artifacts
- preserved process outputs

The best debugging artifact is usually the one that still makes sense after reset.

## Where the repo helps

The extension package already exposes several inspection and export tools for sessions, transcript evidence, context estimates, and Copilot CLI observability.

For current boundaries and caveats, pair debugging work with:

- [docs/reference/current-status.md](../reference/current-status.md)
- [docs/live-test-playbook.md](../live-test-playbook.md)
- [CO-DESIGNER.md](../../CO-DESIGNER.md)

## Practical debugging rule

If you cannot tell whether the failure lives in artifact state, tool evidence, or current-session inference, keep debugging until you can separate those three layers.
Most false confidence in this repo comes from letting them blur together.