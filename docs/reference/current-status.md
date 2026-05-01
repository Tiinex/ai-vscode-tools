# Current Status

This page is the short, human-readable status boundary for the repo.

If you want the ambition of the project, read [README.md](../../README.md).
If you want the active hardening details, read [ROADMAP.md](../../ROADMAP.md) and [CO-DESIGNER.md](../../CO-DESIGNER.md).

If you are reviewing quickly, this page is the right place to start.

## Short release caveat

If you need one short public-facing caveat for the repo today, use this:

- the project is ready for external technical review as an evidence-first repo package, not for a broad release-readiness claim; it is not yet claiming cross-surface equivalence or cross-platform parity

That is the intended reading posture for the rest of this page.

## Windows review boundary today

If you want the shortest possible Windows-first reading:

- proven on the current Windows host: the local repo baseline passes, the documented main-host extension route is evidenced on the same host, and the ordinary Local surface still shows `exact reveal: supported` plus `exact send: unsupported`
- still not proven on the current Windows host: broad exact-session Local send support, verified Local custom-agent participation, cross-surface equivalence, or cross-platform parity
- current public-review readiness therefore means that this boundary is inspectable and honestly stated, not that the broader vision is already complete

## What is true today

- Linux remains the repo's broader reference host for the strongest historical evidence, but Windows is the current primary truth surface for review hardening.
- The repo builds as a real VS Code extension package.
- The current Windows host now passes the local repo build and test baseline again after the routing-policy test was re-grounded from a removed `.github/agents` runtime file onto the active support surface.
- The project exposes extension-host tools, MCP tooling, and an internal CLI harness.
- Several runtime roles have bounded verification behind them.
- One first bounded PoC now exists on the constrained subagent surface: `agent-architect` can create a clean explicit target into a canonical runtime artifact and block honestly on an ambiguous plural-brief prompt.
- That bounded PoC is now backed by repeated clean post-fix runs in the flagship benchmark history, including a later recovery sweep on the two briefs that had regressed immediately before the latest contract tightening, but clean-room contamination still cannot be ruled out strongly enough to treat the current benchmark pack as a contamination-free proof.
- The support layer is intentionally strong and explicit because reset, drift, and host ambiguity are treated as real risks.
- Windows now has current same-host evidence for the documented main-host extension route: the expected `%USERPROFILE%\\.vscode\\extensions\\local.agent-architect-tools` junction points at this repo, the built `dist/extension.js` output is present, and the VS Code extension-host log records activation of `local.agent-architect-tools`; that evidence is still narrower than full cross-platform parity.
- This checkout parks its older repo-owned runtime-agent families as historical lineage rather than current repo authority.
- Active code and tests still intentionally support `.github/agents` runtime-artifact resolution and validation when such artifacts are present in a workspace.
- On the current Windows host, Local custom-agent probes preserved workspace runtime-agent mode state but did not yield strong participant-selection evidence or preserved assistant-response evidence strong enough to treat custom-agent participation as verified on that surface.
- Current support posture does not depend on recovering the host's hidden auto-compact prompt; it depends on making possible compaction detectable enough in practice and keeping re-grounding anchored in visible artifacts.

## What is not yet being claimed here

- equal verification status across Linux, Windows, and macOS
- full end-to-end proof that every high-level process claim is equally automated on every surface
- a blanket claim that all host chat behaviors are solved on the ordinary Local surface
- a claim that the current Windows host passes the full mechanical baseline without remaining platform-specific fixes
- a claim that the parked historical repo agent pack is itself the current live runtime authority for this checkout

## Practical reading rule

Treat this repo as:

- ambitious
- unusually rigorous
- already operational in meaningful ways
- still honest about where evidence is narrower than the larger vision

That combination is part of what makes the project interesting.

In plainer language:

- there is real work here
- there is real evidence here
- there are still important limits on what is being claimed

## How to read old and new material together

For the current checkout, use this reading rule:

- current active docs explain the project as it should be read now
- preserved benchmarks, session artifacts, and best-outcome records show what was actually exercised
- older runtime or skill material should be treated as history unless it is explicitly restored as live

What should not happen implicitly:

- historical material should not remain unmarked in a way that looks like a live contract
- active docs should not depend on a reviewer already sharing the older inferential frame
- deletion should not be used as a substitute for epistemic clarity when provenance still matters

In short: preserve, demote, and route.
That is the safest posture until a repo owner explicitly decides that historical material should be removed entirely.

The practical goal is simple: reviewers should not have to guess which material is current.

Current code-surface note:

- passing `npm run test` again means the documented local baseline is healthy
- active code and tests still exercise `.github/agents` runtime-artifact behavior as a supported model when those files exist in a workspace
- this checkout does not currently treat its own older repo-owned agent pack as live repo authority; those copies remain parked as historical lineage
- the next honest hardening step is to reconcile support wording and any repo-owned examples with that now-explicit distinction

Current Local evidence note:

- strict selection-evidence probes on the current Local create and stabilized lifecycle routes did not verify custom-agent participant selection on this host build
- best-effort Local probes still preserved mode-state evidence for a workspace runtime-agent file under `.github/agents/*.agent.md`
- those same probes did not preserve assistant-response evidence strongly enough to upgrade Local custom-agent participation into a verified claim on this host
- a fresh same-host runtime support-matrix check still reports `Local exact reveal: supported` and `Local exact send: unsupported`, so the active Local boundary remains reveal-without-ordinary-exact-send on this build
- fresh-chat re-entry now also has a first-class benchmark shape: the strict lane remains partially blocked on Local follow-up, but weaker first-prompt probes did show that the visible artifact pack can re-ground a fresh chat to the right working frame

## Verification Snapshot

| Area | Linux | Windows | macOS |
| --- | --- | --- | --- |
| Build and local test baseline | strongest documented host path | current host passes local repo baseline | not yet verified |
| Main-host extension load path | reference path | evidenced on this host through the documented junction route plus extension-host activation logs | not yet verified |
| Extension-host plus MCP tooling | strongest repo-local evidence | exercised with narrower evidence than Linux | not yet verified |
| Ordinary Local chat behavior | bounded by current VS Code/Copilot surfaces | exact reveal supported, exact send unsupported, and broader Local evidence still narrower and changing | not yet verified |

Use that table as a scope guide, not as proof that every adjacent high-level claim has equal automation on every host.

## First Concrete PoC

If you want one concrete reviewer-facing PoC rather than the broader evidence set, use:

- [../benchmarks/agent-architect-flagship-reliability-workflow.md](../benchmarks/agent-architect-flagship-reliability-workflow.md)

Start with these sections in that file:

- `First Reviewer-Facing PoC`
- `Inspect Or Reproduce This PoC On The Current Surface`

What that PoC currently supports:

- one explicit-target CREATE on the constrained subagent surface
- read-after-write and canonical artifact verification
- visible blocker behavior on an ambiguous boundary prompt
- repeated clean post-fix support for that same bounded claim inside the preserved benchmark history

What it does not support:

- release-state readiness
- full nested helper-orchestration proof
- Local, MCP, CLI, or Copilot CLI equivalence

## Quick Evidence Check

Use [../../README.md](../../README.md) `Fast Peer-Review Path` as the canonical reviewer entrypoint. This section is the expanded evidence route once that first pass is complete.

If you want one short reviewer path instead of browsing the whole repo, inspect these four things in order:

1. [../../README.md](../../README.md) for the project claim boundary and practical reading posture
2. [../benchmarks/agent-architect-flagship-reliability-workflow.md](../benchmarks/agent-architect-flagship-reliability-workflow.md) for the first bounded PoC and its same-surface inspect-or-reproduce recipe
3. [../benchmarks/local-chat-session-state-regression.md](../benchmarks/local-chat-session-state-regression.md) for preserved same-surface Local evidence and current limits
4. [../benchmarks/fresh-chat-re-entry-probe.md](../benchmarks/fresh-chat-re-entry-probe.md) for the current compact-tolerant fresh-chat re-grounding benchmark and its strict-vs-weaker lane boundary
5. [../../tests/README.md](../../tests/README.md) if you want to understand the current local test baseline before running it yourself

If you want the absolute shortest path, stop after steps 1 and 2 and give clarity feedback first.

If you want one live repo check after that, run `npm run test` from the repo root.

## Quick Runnable Check

If you want one short live check on the current checkout, run this from the repo root:

Host caveat:

- treat Windows as the current primary review surface for this runnable check
- treat Linux as the broader reference host for adjacent historical evidence
- do not treat this quick check as a verified macOS path today

```bash
npm install
npm run test
```

Expected result:

- the script finishes with `Tests passed.`

What that proves:

- the local repo build and test baseline is healthy on the current host

What that does not prove:

- equal host parity across Linux, Windows, and macOS
- that every Local chat behavior is stable on the ordinary product surface
- that GPT-5 mini is currently reliable on harmless Local create-path first turns

For host-specific extension loading after that baseline check, use [../guides/getting-started.md](../guides/getting-started.md).

## Where to inspect current evidence

If you want to inspect the current evidence surface rather than only the prose summary, start here:

- [../../CO-DESIGNER.md](../../CO-DESIGNER.md) for the current restart anchor and re-grounding discipline
- [../../ROADMAP.md](../../ROADMAP.md) for the active hardening and verification priorities
- [../benchmarks](../benchmarks) for preserved benchmark briefs and best-outcome artifacts
- [../../tests/README.md](../../tests/README.md) for current local test-harness assumptions
- [../../PEER-REVIEW.md](../../PEER-REVIEW.md) for the intended reviewer path and scope limits

Read those as bounded evidence surfaces, not as proof that every adjacent high-level claim is already automated on every platform.

Current checkout note:

- several older docs and benchmark records still mention historical `.github/agents` or `.github/skills` paths
- those references remain useful as historical evidence, but they are not the primary active reading surface in this checkout right now
- peer reviewers should treat those historical references as lineage and provenance, not as instructions about the current primary runtime entrypoint