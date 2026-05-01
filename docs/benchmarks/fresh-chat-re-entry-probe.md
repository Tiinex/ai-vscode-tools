# Fresh-Chat Re-Entry Probe

Support-only benchmark artifact. This file is not runtime authority.

Read this file as a preserved benchmark brief for fresh-chat re-entry on the Local surface, not as the main explanation of the repo.
If you are new to the repo, start with [../reference/current-status.md](../reference/current-status.md) first.

## Goal

Measure whether a fresh Local chat can recover the right working inference after reset, compaction, or a clean new conversation by reading the current support artifacts rather than relying on hidden host continuity.

## Scope

- ordinary Local workspaceStorage-backed Copilot Chat only
- artifact-backed re-grounding through visible repo files
- no claim that hidden auto-compact prompts are recoverable or inspectable on demand
- no claim that same-session follow-up is available unless the current Local surface actually supports it

## Current Reading Contract

- treat [../../CO-DESIGNER.md](../../CO-DESIGNER.md) as the restart anchor
- treat [../reference/current-status.md](../reference/current-status.md) as the short current-claim boundary
- judge outcome by inferential equivalence and epistemic clarity, not by style or confidence tone
- keep lane strength explicit: strict two-phase re-entry is stronger evidence than bundled first-prompt fallback

## Current Ceiling / Known Invariants

- On the current Windows host, strict fresh-chat re-entry is partially measurable but same-session follow-up remains operationally constrained by Local self-targeting and exact-send limits.
- A fresh Local chat can still read the relevant support artifacts and answer short orientation questions correctly enough to treat the artifacts as carrying meaningful inference.
- Successful file-read evidence is stronger than conversational fluency alone.
- Failure to recover the host's hidden auto-compact prompt is not a contract failure for this benchmark.
- An opt-in latest-session decoy workaround now exists on `send_message_to_live_agent_chat` for runs where the heuristic self-targeting guard is the only blocker, but any run using that flag remains transport-workaround evidence rather than strict two-phase proof.

## Inputs

- [../../CO-DESIGNER.md](../../CO-DESIGNER.md)
- [../reference/current-status.md](../reference/current-status.md)
- Local extension-host chat routes such as `create_live_agent_chat`, `send_message_with_lifecycle`, or the currently supported equivalent create path
- repo session-inspection tools for persisted session and transcript evidence

## Benchmark Lanes

### Strict Two-Phase Lane

Use this when the host allows a clean same-chat follow-up after the load-only turn.

1. Create a fresh Local chat.
2. First prompt must be load-only: instruct the chat to read [../../CO-DESIGNER.md](../../CO-DESIGNER.md) and [../reference/current-status.md](../reference/current-status.md) and do nothing else.
3. Verify from the same evidence family that those artifacts were actually read.
4. Only then send one short orientation or epistemic-boundary question in the same chat.
5. Judge the answer against the inferential-equivalence rubric in [../../CO-DESIGNER.md](../../CO-DESIGNER.md).

Important boundary:

- if step 4 requires `send_message_to_live_agent_chat` with `allowTransportWorkaround: true`, the run no longer counts as strict two-phase evidence and must be relabeled as `transport-workaround`

### Weaker First-Prompt Fallback Lane

Use this only when the strict lane is blocked by Local self-targeting, focus ambiguity, or lack of exact-session send.

1. Open a separate fresh Local chat for each question.
2. Bundle artifact-reading plus one short question into the first prompt.
3. Verify that the artifacts were read.
4. Record the run explicitly as weaker first-prompt evidence rather than strict re-entry proof.

## Recommended Question Set

- `What are we actually trying to achieve in this repo right now?`
- `What is the difference between artifact-backed state, current tool evidence, and current-session inference in this project?`
- `What is the narrowest sensible next step if the goal is to improve fresh-chat re-entry without copying the whole conversation?`

## Evidence Rules

- Do not treat a plausible answer as sufficient without evidence that the chat actually read the support artifacts.
- Do not treat same-session follow-up blocking on Local as proof that re-grounding failed.
- Do not upgrade a bundled first-prompt result into strict two-phase evidence.
- Do not upgrade an opt-in decoy-assisted same-session send into strict two-phase evidence.
- Do not center interpretation on the host's hidden auto-compact prompt.
- Prefer persisted session or transcript evidence over UI impressions when both are available.

## Current Questions

- Are [../../CO-DESIGNER.md](../../CO-DESIGNER.md) and [../reference/current-status.md](../reference/current-status.md) sufficient as the minimal fresh-chat re-grounding pack?
- Does the strict two-phase lane become available on a future host build without changing the artifact strategy?
- Which short orientation question is the most discriminating without encouraging style-only success?

## Reporting Rule

Every run note should say:

- which lane ran
- which exact Local route was used
- what artifact-backed read evidence was recovered
- whether the answer met the inferential-equivalence bar
- what remained blocked by Local transport or focus limits