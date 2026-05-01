# Runtime Model

Agent Architect is not just a documentation idea.
It lives inside a real runtime package.

Today, that package is centered on a VS Code extension and a bounded tooling core.

If you only need the short version, read `The runtime shape`, `Surface discipline`, and `Current review hardening host`.

## The runtime shape

At a high level, the repo provides:

- a VS Code extension runtime
- extension-host language-model tools
- MCP support for headless artifact-oriented flows
- an internal CLI harness for scripts and tests

The important detail is that these surfaces are not treated as interchangeable just because they touch related code.

That also means the runtime model must be read separately from historical runtime-artifact families that may currently be parked in the checkout.

## Surface discipline

One of the repo’s strongest habits is that it tries not to blur surfaces.

Examples:

- Local chat is not the same thing as Copilot CLI
- MCP is not a substitute for UI-bound Local chat behavior
- the internal CLI harness is not treated as the normal agent-facing route when extension-host tools already cover a capability

That discipline matters because systems become misleading very quickly when similar-looking routes are described as equivalent without evidence.

## Current review hardening host

Windows is the current primary truth surface for review hardening in this repo.

That means:

- Windows evidence should drive the current review boundary for this phase
- Linux remains the broader reference host for the strongest historical evidence
- Windows and macOS support are not yet equally verified runtime facts

The repo already contains explicit OS branching for some discovery logic, but cross-platform verification is still a separate step.

## Local lanes

For Local chat work, the repo uses a lane model instead of pretending every probe is equally strong.

- `native-local` is strongest for user-like capability
- `deterministic-state-hack` is strongest for repeatable host-state debugging
- `transport-workaround` is useful when the system needs an observability aid, but it is weaker as proof of ordinary user capability

This helps prevent a common failure mode: mistaking a useful workaround for a general product guarantee.

## Practical reading

If you are trying to understand the runtime truth of the project, combine:

- [package.json](../../package.json)
- [src](../../src)
- [docs/reference/current-status.md](../reference/current-status.md)
- [ROADMAP.md](../../ROADMAP.md)
- [CO-DESIGNER.md](../../CO-DESIGNER.md)

The runtime model is therefore both technical and epistemic.
It is about what code exists, but also about which claims are allowed to ride on which evidence.

In plain language: the code matters, but so does being honest about what each surface actually proved.