# Fresh-Chat Re-Entry Probe Best Outcome

Support-only benchmark output. Read this file as one preserved best-known outcome, not as a general guarantee for the Local surface.
Use [fresh-chat-re-entry-probe.md](fresh-chat-re-entry-probe.md) for the scope, method, and evidence rules behind this output.

Support-only evidence summary. This file is not runtime authority.

## Current Best Practical Outcome

- A fresh Local chat can recover meaningful working context from [../../CO-DESIGNER.md](../../CO-DESIGNER.md) and [../reference/current-status.md](../reference/current-status.md) without relying on hidden chat continuity.
- The current strongest repeated evidence on this host is the weaker first-prompt lane, not a clean strict two-phase same-session follow-up lane.
- The re-entry pack is strong enough to recover repo goal, epistemic boundaries, and a sensible narrow next step in a fresh chat.
- The best current interpretation is: artifact-backed re-grounding looks promising, while stronger same-session Local verification remains constrained by the host surface.

## Verified From Tool Execution And Artifact Inspection

- A strict load-only fresh-chat probe was executed on the Local surface.
- Target session: `7943380a-4438-44d6-acdd-2c2040c67479`
- Prompt intent: read [../../CO-DESIGNER.md](../../CO-DESIGNER.md) and [../reference/current-status.md](../reference/current-status.md) before doing anything else.
- Result: the run provided load-phase evidence that those support artifacts were read, but the stronger same-session follow-up lane remained blocked by Local self-targeting constraints.
- Interpretation: strict-lane artifact loading is measurable on this host, but strict re-entry remains incomplete because the same-chat second-turn probe could not be executed cleanly.

- Repeated weaker first-prompt probes were then executed on fresh Local chats with artifact-reading and one short question bundled into the first prompt.
- Repo-goal probe session: `20988a34-7c3b-43c9-a617-1763e0a08cd6`
- Epistemic-boundary probe session: `617efb37-1895-40ab-8346-d16eea8377d5`
- Narrow-next-step probe session: `ee2f4498-4687-4cdd-95f5-a279cc132152`
- Result: persisted evidence showed successful artifact reads, and the returned answers were judged correct enough to support the claim that the visible artifacts are carrying substantial inference.
- Interpretation: although the weaker lane does not prove strict same-session re-entry, it does support the narrower claim that the current artifact pack can re-ground a fresh Local chat to the right working frame.

## Current Ceiling / Known Invariants

- Treat the weaker first-prompt lane as the current strongest repeated evidence on this host.
- Treat strict same-session follow-up blocking as a Local transport limitation unless later same-surface evidence proves otherwise.
- Treat successful artifact reads plus correct short answers as stronger evidence than conversational confidence or tone.
- Do not claim recovery of the hidden auto-compact prompt from this benchmark.

## Working Interpretation

- The repo now has a usable compact-tolerant re-entry story based on visible artifacts rather than continuity magic.
- That story is supportable enough to guide fresh chats productively.
- The missing piece is not the artifact pack itself; it is stronger same-session Local verification on the current host build.

## Reloaded Host Spot-Check

Date: 2026-04-22

- Exercised lane: weaker first-prompt fallback
- Exercised Local route: `create_live_agent_chat` through `chat-open`
- Host context: Windows host after `reload window`, with the main conversation already having survived a compact event

- Probe W1
	- session: `fbbc3bd6-ec68-4526-9981-784810d8d095`
	- anchor: `AA_REENTRY_20260422_W1`
	- question: repo goal
	- artifact-backed read evidence: transcript evidence showed a successful `read_file` of [../../CO-DESIGNER.md](../../CO-DESIGNER.md) and the latest tool activity recorded a read of [../reference/current-status.md](../reference/current-status.md)
	- notable detail: the run first attempted a relative-path read of `CO-DESIGNER.md`, failed, then retried with the absolute workspace path and succeeded
	- outcome: the persisted answer correctly framed the repo as an evidence-first effort to move useful control from hidden platform context into visible, versioned, testable artifacts, while separating artifact-backed claims from inferred ones

- Probe W2
	- session: `fe02e742-7c5d-45e5-97cf-eb59b2b34690`
	- anchor: `AA_REENTRY_20260422_W2`
	- question: epistemic boundary between artifact-backed state, current tool evidence, and current-session inference
	- artifact-backed read evidence: transcript evidence showed successful `read_file` calls for both [../../CO-DESIGNER.md](../../CO-DESIGNER.md) and [../reference/current-status.md](../reference/current-status.md)
	- outcome: the persisted answer kept the three layers distinct and described artifact-backed state as durable repo evidence, tool evidence as current exercised observations, and current-session inference as provisional reasoning over those surfaces

- Interpretation
	- the reloaded host still reproduces the weaker first-prompt fresh-chat re-entry result
	- the artifact pack remains strong enough to recover both repo goal and epistemic discipline in a fresh Local chat after reload and compact pressure
	- this spot-check still does not upgrade the benchmark into strict two-phase same-session proof, because only the weaker lane was exercised here

## Strict-Lane Transport-Workaround Spot-Check

Date: 2026-04-22

- Exercised lane: strict load phase plus transport-workaround follow-up
- Target Local session: `e892ff75-72f8-4ce5-af86-2c99567c828f`
- Load-phase anchor: `AA_STRICT_REENTRY_20260422_T1`
- Follow-up anchor: `AA_STRICT_REENTRY_20260422_T2`
- Load-phase artifact evidence: persisted transcript evidence showed successful reads of [../../CO-DESIGNER.md](../../CO-DESIGNER.md) and [../reference/current-status.md](../reference/current-status.md) before any substantive question was asked
- Negative control: exact-session follow-up without any workaround was blocked by the Local self-targeting guard because the target appeared to be the currently invoking conversation
- Opt-in flag check: the same follow-up with `allowTransportWorkaround: true` returned the same old guard block on the active host, so this run did not yet verify that the newly added tool flag was live in the attached runtime
- Manual transport workaround: a decoy Local session `782801f7-95c3-46e7-8801-b463a49f06cb` was created first, then the same exact-session follow-up against the target succeeded via reveal plus focused-editor fallback
- Target-delivery evidence: persisted session rows and transcript export showed the full `AA_STRICT_REENTRY_20260422_T2` prompt in the target session and no match for that anchor in the decoy session
- Outcome: the target session returned the expected short three-layer distinction, separating artifact-backed state from current tool evidence and current-session inference

- Interpretation
	- this run strengthens the strict lane only up to load-phase proof plus successful same-session delivery through a transport workaround
	- it does not count as clean strict two-phase proof, because the successful second turn depended on an extra decoy session whose only role was to break latest-session ambiguity
	- it does materially reduce uncertainty about root cause: the workaround concept itself works on the current Local surface, while the direct `allowTransportWorkaround` flag likely still needed a host reload before it could be validated as a live tool path

## Reload-Validated Tool-Path Spot-Check

Date: 2026-04-22

- Exercised lane: strict load phase plus direct `allowTransportWorkaround` tool-path follow-up after host reload
- Target Local session: `cf268cc3-4e35-4eda-87ec-f31323cad9fb`
- Load-phase anchor: `AA_STRICT_REENTRY_20260422_T4`
- Follow-up anchor: `AA_STRICT_REENTRY_20260422_T5`
- Tool-returned transport evidence: `send_message_to_live_agent_chat` returned `Transport Workaround Used: latest-session decoy` and reported decoy session `d72560d5-71a5-4c4e-8403-3ab8d4187cf8`
- Load-phase artifact evidence: transcript export for the target session showed the T4 load-only prompt plus successful `read_file` executions for [../../CO-DESIGNER.md](../../CO-DESIGNER.md) and [../reference/current-status.md](../reference/current-status.md)
- Target-delivery evidence: persisted session rows and transcript export showed the full `AA_STRICT_REENTRY_20260422_T5` prompt in the target session
- Decoy isolation evidence: the decoy session produced no match for the T5 anchor
- Outcome: the follow-up succeeded on the intended target through the newly live transport-workaround path, and the target session remained artifact-grounded before the second turn

- Interpretation
	- this is the first direct same-surface evidence on this host that the new `allowTransportWorkaround` flag is live after reload
	- the result still belongs to the transport-workaround lane rather than clean strict two-phase proof, because the mechanism intentionally creates a decoy session to break latest-session ambiguity
	- the remaining limitation is therefore narrower than before: ordinary Local exact-session send is still unsupported, but the explicit opt-in workaround path itself is now verified as operational on the current host