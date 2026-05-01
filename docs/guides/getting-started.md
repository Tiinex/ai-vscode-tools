# Getting Started

This guide is for people who want to work on the repository itself without reading every support artifact first.

If you are primarily trying to understand how to talk to Agent Architect as a user, start with [using-agent-architect.md](using-agent-architect.md) instead.

Current scope note: Windows is the current primary truth surface for review hardening, Linux remains the broader reference host for the strongest historical evidence, and macOS is not yet documented here as a verified host path.

If you only want the shortest useful setup path, read `The shortest useful path`, then `Quick smoke path`, then the section for your platform.

## Who this guide is for

This guide is aimed at:

- repo contributors
- people evaluating the extension package technically
- people who want to build, test, and inspect the repo locally

## What you need

- Node.js 20 or newer
- npm
- VS Code 1.99 or newer
- a willingness to treat Windows as the current primary review surface while reading Linux as the broader reference host

Test note:

- `npm run test` builds the repo first and loads modules from `dist/`
- `npm run test` also prepares the current local `node_modules/vscode/index.js` stub used for headless imports, as described in [../../tests/README.md](../../tests/README.md)

## The shortest useful path

From the repo root:

```bash
npm install
npm run build
npm run test
```

That gives you a working starting point before you dive into the larger model.

If `npm run test` fails before you reach repo-level behavior, read [../../tests/README.md](../../tests/README.md) before treating that as a contradiction in the higher-level docs.

## Fast Windows smoke routine

If you want the shortest same-host Windows check that still matches the current review posture, do this:

1. Run `npm.cmd run test` from the repo root.
2. Ensure the main-host extension folder is linked at `%USERPROFILE%\.vscode\extensions\local.agent-architect-tools`.
3. Reload the main VS Code window.
4. Confirm that `Agent Architect Tools:` commands appear in the Command Palette.

If that four-step loop works, you have the current Windows baseline plus the documented main-host route in one pass.

## Quick smoke path

If you only want a first practical check that the repo basically works on your machine, do this:

Platform note:

- Windows is the current primary review surface for the repo
- Linux remains the broader reference host for the strongest historical evidence and adjacent comparison
- macOS is not yet documented here as a verified host path

1. Install dependencies.
2. Build the extension.
3. Run the test suite.
4. Load the extension through the normal VS Code host for your platform.
5. Reload the VS Code window.
6. Confirm that `Agent Architect Tools:` commands appear in the Command Palette.

From the repo root, the minimum command loop is still:

```bash
npm install
npm run build
npm run test
```

Success signal for this guide:

- the build completes
- the test command completes
- after host loading and window reload, VS Code exposes `Agent Architect Tools:` commands in the main host

If build or test fails, or the commands never appear after the documented host-loading path and reload, treat that as a real setup issue rather than as a soft documentation mismatch.

## Quick Troubleshooting Checklist

| Situation | What it usually means | Smallest next step |
| --- | --- | --- |
| `npm run test` ends with `Tests passed.` | the local repo build and test baseline is healthy on this host | continue to the host-loading path for your platform |
| `npm.ps1` is blocked in PowerShell | a host execution-policy issue, not a repo-specific contract failure | rerun the command with `npm.cmd` |
| build passes but `Agent Architect Tools:` commands do not appear after reload | the extension was not loaded from the expected host path, or the window was not reloaded on the real host | verify the linked folder name, verify `dist/` exists, then reload the main VS Code window |
| junction creation fails on Windows | a host-local permissions or management limitation | record the exact error; for local inspection only, fall back to Extension Development Host without treating it as equivalent evidence to the documented main-host path |
| the Linux path works but Windows behavior differs later | Linux still has broader historical evidence, but Windows is the active review-hardening surface | treat the Windows result as the current review truth for this phase, then compare against Linux as reference evidence instead of collapsing them into one claim |

Use this checklist to separate local setup friction from higher-level product or documentation claims.

## Linux: load the repo through the main VS Code host

For this repo, the most effective day-to-day Linux workflow is usually not the debugger path.
It is to load the repo as the real installed extension in your main VS Code window.

The command block below is Linux-specific.
Do not treat it as the universal host-loading path for every platform.

That is the workflow this repo is already being used with now.

From the repo root, build and link it like this:

```bash
npm run build
mkdir -p ~/.vscode/extensions
ln -sfn "$PWD" ~/.vscode/extensions/local.agent-architect-tools
```

That symlink name matters.
It matches the current extension id shape from `publisher=local` and `name=agent-architect-tools`, which gives the installed folder name `local.agent-architect-tools`.

After linking, reload the main VS Code window.
From that point, the extension is loaded by the normal host instead of an Extension Development Host debugger session.

This is the preferred path here when you want:

- the fastest iteration loop
- the real main-host behavior
- the same loading model the repo is currently exercised under

Use the debugger path when you specifically need debugger-only inspection.
For normal repo work on Linux, prefer the symlinked main-host route.

## Windows: load the repo through the main VS Code host

Windows can use the same main-host loading model as Linux, but the most reliable local variant observed so far is a junction under the normal VS Code extensions directory rather than a Unix-style symlink example copied verbatim.

From the repo root, install dependencies, build the extension, and create the linked extension folder like this in PowerShell:

```powershell
npm install
npm run build
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.vscode\extensions" | Out-Null
New-Item -ItemType Junction -Path "$env:USERPROFILE\.vscode\extensions\local.agent-architect-tools" -Target (Get-Location).Path
```

If your host blocks `npm.ps1` through PowerShell execution policy, rerun the first two commands with `npm.cmd` instead.

If junction creation itself fails on a managed or locked-down Windows host, record the exact error and treat that as a host-local setup limitation rather than as proof that the repo's documented path is false. For local inspection only, you can fall back to an Extension Development Host session, but do not treat that fallback as equivalent evidence to the documented main-host path.

That folder name still matters.
It matches the current extension id shape from `publisher=local` and `name=agent-architect-tools`, which gives the installed folder name `local.agent-architect-tools`.

After linking, reload the main VS Code window.
From that point, the extension is loaded by the normal host instead of an Extension Development Host debugger session.

Observed Windows notes so far:

- the main-host load path was successfully observed through a junction at `%USERPROFILE%\.vscode\extensions\local.agent-architect-tools`
- the repo still needs a built `dist/` output before VS Code can actually activate the extension from that linked folder
- on the current Windows host, the expected junction points at this repo, `dist/extension.js` is present, and the extension host log shows activation of `local.agent-architect-tools`
- on some Windows hosts, `npm.ps1` is blocked by PowerShell execution policy; using `npm.cmd` is the smallest host-local workaround and does not change the repo contract
- this is useful operational guidance for the current primary review surface, not a claim of full Windows parity with the broader Linux reference host

## If the commands do not appear after reload

Before treating that as a deeper product issue, check these first:

1. `npm run build` completed successfully and `dist/` exists.
2. The linked folder name is exactly `local.agent-architect-tools`.
3. You reloaded the main VS Code window rather than only rerunning a terminal command.
4. The Command Palette is being checked for `Agent Architect Tools:` commands.

If those checks still fail, treat it as a real setup or activation issue and include that exact failure mode in review feedback.

## What to read first

If you are reviewing rather than setting up the repo to work on it, use [../../README.md](../../README.md) `Fast Peer-Review Path` first. The reading order below is the setup-oriented expansion path.

Read these in order:

1. [README.md](../../README.md)
2. [docs/agent-architect.md](../agent-architect.md)
3. [docs/concepts/artifact-model.md](../concepts/artifact-model.md)
4. [docs/reference/current-status.md](../reference/current-status.md)

If you are reviewing rather than contributing, you can usually swap steps 2 and 4 and read the status page earlier.

## What this repo contains

The repo is centered on a single extension package that exposes:

- VS Code extension-host tooling
- MCP-based headless tooling
- an internal CLI harness for scripts and tests

It also contains:

- support artifacts such as [ROADMAP.md](../../ROADMAP.md) and [CO-DESIGNER.md](../../CO-DESIGNER.md)
- benchmark and target artifacts under [docs/benchmarks](../benchmarks) and [docs/targets](../targets)

Historical note:

- earlier runtime-agent and skill families are currently parked under [../parked/github-autoload-history](../parked/github-autoload-history)
- treat those parked families as historical design and evidence material in this checkout, not as the primary live entrypoint for new readers

## A practical mindset for reading the project

Do not read this repo like a polished product brochure.
Read it like an unusually transparent engineering system that is trying to show both its strengths and its unfinished edges.

That mindset makes the documentation make much more sense.

In plain language: do not read this like a finished product site; read it like an inspectable engineering package.

## About memory and hidden context

If your host lets you reduce memory reuse or automatic hidden context, that is often useful during disciplined testing.
But the deeper point is not “always disable everything.”
The deeper point is to know when hidden state may be shaping the result and to avoid confusing that with artifact-backed evidence.