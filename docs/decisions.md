# Decisions

Date: 2026-04-11

This page captures short design decisions that matter to the current interoperability and verification posture.
It is not a full changelog.

This page is for orientation, not for deep study.
If you are new to the repo, read [reference/current-status.md](reference/current-status.md) first.

## 1. Read-after-write verification is required

Status: final

Successful dispatch should only be reported as `ok` when one of these is true:

- a persisted session mutation was observed through read-after-write verification
- the caller explicitly chose a non-blocking path

Why this matters:

- it prevents false success when the host narrated a send without persisting it
- it prevents one surface from being mistaken for proof of another

## 2. Default timeout is 60 seconds

Status: final

Observed host latency sometimes reached 20 to 40 seconds.
A 60 second default provides room without pretending the host is fast or deterministic.

Configuration:

- `agentArchitectTools.postCreateTimeoutMs`

## 3. `waitForPersisted` remains an explicit control

Status: final

Each call may use `waitForPersisted=false` for non-blocking behavior.
The default is controlled by:

- `agentArchitectTools.waitForPersistedDefault`

This is important because the repo distinguishes between a convenient send and a claim backed by persisted evidence.

## 4. Lifecycle wrapper is the preferred high-level route

Status: adopted direction, still bounded by host limits

`sendMessageWithLifecycle` exists to reduce race-prone manual sequences such as separate close, reveal, focus, and send steps.

This does not erase host limitations.
It is a control-layer improvement, not proof that exact-session Local transport is fully solved.

## 5. Headless test stub is temporary

Status: temporary

A local `vscode` stub was introduced so tests can run outside a real VS Code host.
That is acceptable as a pragmatic harness, but it should not be mistaken for primary runtime evidence.

## 6. Documentation is part of the control surface

Status: final

The docs in [interop-api.md](interop-api.md), [live-test-playbook.md](live-test-playbook.md), and this file exist to preserve decisions as inspectable artifacts rather than leaving them in conversational memory.

## Rollback rule

If read-after-write blocking becomes operationally harmful in a specific environment, `waitForPersistedDefault` may be downgraded temporarily for that environment.
That is a bounded fallback, not a reason to weaken the general evidence standard.
