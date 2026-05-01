# Runtime Spec

This document describes the runtime shape of the repo at a high level.

It is not a promise that every surface is equally mature.
It is a map of what exists.

If you only need the short version, read `Supported surface families`, `Important boundary`, and `Current reading posture`.

## Core runtime package

The repo is centered on one VS Code extension package defined in [package.json](../../package.json).

That package exposes:

- a VS Code extension entrypoint
- extension-host language-model tools
- session inspection and export capabilities
- live chat interop capabilities
- Copilot CLI observability and handoff support
- MCP-compatible headless tooling

The important distinction is that this runtime package is real even when some older runtime artifact families are parked in the current checkout.

## Supported surface families

The runtime currently distinguishes between:

- extension-host tool surface
- MCP surface
- internal CLI harness for scripts and tests
- Local chat product surface
- Copilot CLI as a separate adjacent surface

## Important boundary

These surfaces must not be treated as equivalent without evidence.

That boundary is not just philosophical.
It affects what the repo can honestly claim after a probe or regression run.

## Current review hardening host

Windows is the current primary truth surface for review hardening, while Linux remains the broader reference host for the repo's strongest historical runtime evidence.

The codebase already contains explicit cross-platform logic in places, but repo-level verification is not yet equal across hosts.

## Current reading posture

For this checkout, combine runtime code with current support artifacts and preserved benchmark evidence.
Do not assume that every historical runtime or skill artifact family is currently a live input surface just because it still exists in parked history.