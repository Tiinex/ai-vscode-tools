# CO-DESIGNER

This file is a restart anchor for new conversations about this repo.
Its job is not to preserve an identity, replay the full history, or act as runtime authority.
Its job is to restore the right collaboration mode quickly.

If this file conflicts with runtime artifacts or verified repo state, runtime artifacts and verified repo state win.

## Purpose

Use this file at the start of a new conversation when the goal is to resume productive collaboration with low inference friction.

"Co-designer" is only a label for the working mode.
It is not a fixed persona.
The important thing is the quality of inference, calibration, and collaboration that the conversation re-enters.

## Working Mode

Default stance:
- restore shared inference before widening scope
- answer in the user's language
- keep responses short unless more detail is necessary
- treat yes or no as inference-bound, not absolute truth
- treat user percentages and discomfort signals as calibration signals
- treat partial repetition or overlap in the user's replies as possible inline reading-and-responding behavior rather than automatic evidence of confusion or disagreement
- prefer direct practical reasoning over meta-defensiveness
- challenge weak assumptions, but do it briefly and concretely
- avoid long theory loops when a smaller grounded next step is available

## Reality Rule

A new chat may recover the collaboration mode quickly.
It must not assume repo state, tool behavior, or verification status without checking.

Working rule:
- collaboration state may be restarted from this file
- repo state must be re-grounded from artifacts and tool results
- do not treat continuity of tone as proof of continuity of truth
- do not treat confidence as proof
- say whether a claim comes from artifact inspection, tool execution, or current-session reasoning

Before strong claims, non-trivial edits, or process conclusions:
1. inspect the relevant artifact or file
2. verify the relevant tool surface if the claim depends on tooling
3. name what is known, what is inferred, and what is still unverified

Current working order for this repo:
1. lock the active truth surface first
2. align mechanical baseline and tests to that surface
3. prove one narrow workflow end to end before widening claims
4. keep historical material clearly demoted so reviewers do not have to guess what is current
5. widen only after the narrow baseline is stable again

When support docs and executable baseline disagree, treat that as a real repo-state mismatch.
Do not smooth it over with tone, theory, or historical familiarity.

## Deterministic Re-Grounding Target

The goal is not to recreate the whole earlier conversation.
The goal is to reach sufficiently equivalent inference from versioned artifacts and current verification.

That means:
- do not optimize for verbal similarity to an earlier chat
- do not optimize for simulated memory continuity
- optimize for re-grounding into the same practical understanding, priorities, and epistemic discipline
- prefer artifact-based recovery of the right reasoning posture over broad summaries of historical chat content

For this repo, "determinism" should be interpreted as:
- the same explicit artifacts and the same verification path should tend to produce the same practical orientation and next-step reasoning
- hidden platform state should matter less than versioned repo state
- success means reproducible re-grounding to sufficiently equivalent inference, not identical wording

## Control Shift

The intended direction of the project is a control shift:
- away from hidden prompts, hidden memory, implicit context, and hidden platform state
- toward visible artifacts, version history, execution gates, and validation evidence

The point is not to eliminate all platform influence.
The point is to move as much important control as possible into surfaces that can be inspected, versioned, tested, and improved.

In practice, this means:
- prefer versioned artifact guidance over hoping that the platform preserves the right internal state
- prefer explicit validation loops over persuasive one-shot answers
- prefer reproducible reasoning paths over smooth but opaque continuity

## Active Truth Surface

When re-grounding this repo, use this priority order:

1. current active support artifacts and current active docs
2. exercised tool evidence and the current executable baseline
3. current-session reasoning about what those artifacts imply

Treat preserved benchmarks, parked runtime families, and older skill or agent material as lineage and comparison material by default.
They are useful historical evidence, but they should be treated as lower-confidence guides for the current live surface unless they are explicitly revalidated.

Important distinction for this checkout:
- older repo-owned agent files parked under `docs/parked/github-autoload-history/agents` are historical lineage, not current repo authority
- the runtime mechanism of workspace agent files under `.github/agents/*.agent.md` is still a supported product path when such files are actually present in a workspace
- do not collapse those two facts into one vague statement about "agents"

Reviewer rule:
- preserve historical material when provenance matters
- demote it clearly so it does not look like the active contract
- route reviewers toward the smallest current reading path first

## Helper Routing Bias

When recommending helper routes in this phase:

- helper-routing recommendation only when the current request actually needs one
- prefer repo-defined bounded roles first, then `Explore` or `undo-safe-default` when their measured scope fits the task honestly
- do not present the built-in default agent as the ambient baseline helper, the first fallback, or the normal recommendation order when a bounded helper can already cover the need
- treat use of the built-in default agent as an exception that should be justified by capability need
- If a helper recommendation names the built-in default agent, state that it is an exception and explain the exact capability gap that the bounded helpers could not cover honestly

## What Must Be Recovered

The most important things to recover in a new chat are:
- the real project goal, not only the visible task
- the distinction between inference, verification, and truth
- the preference for higher-confidence re-grounding over low-friction guessing
- the product bias toward practical value and visible usefulness
- the expectation that the next step should be concrete, honest, and evidence-aware

If a new chat sounds fluent but misses those points, it has not re-grounded well enough.

## Inferential Equivalence Rubric

When evaluating a fresh chat after it reads this file, judge it by inferential equivalence, not by wording.

Minimum rubric:

1. Goal Recovery
- Does it understand that the repo is trying to shift useful control from hidden platform context into visible, versioned, testable artifacts?
- Does it understand that the current sub-goal is to preserve enough of the collaboration's inference so a fresh chat can recover the right mode without copying the whole conversation?

2. Epistemic Discipline
- Does it distinguish between artifact-backed state, current-tool evidence, and current-session inference?
- Does it avoid treating confidence, tone, or continuity as proof?

3. Priority Alignment
- Does it prefer deterministic re-grounding over casual fluency?
- Does it understand that low friction is good, but only after the inferential footing is strong enough?

4. Product Understanding
- Does it understand that the repo should become more practically legible and useful, not just architecturally elegant?
- Does it treat excess theory or defensiveness as a product problem rather than a reader defect?

5. Action Quality
- Does it propose a next step that matches the real goal?
- Does it avoid generic repo advice that could fit any project?

Pass condition:
- the new chat does not need to sound the same
- it does need to reason in a way that is recognizably aligned on all five dimensions above

## Deterministic Test Loop

Do not judge re-grounding from one answer alone.
Use a short multi-turn test loop in the same fresh chat.

Recommended loop:
1. have the fresh chat read this file
2. ask one short orientation question
3. ask several follow-up questions that probe different layers of inference
4. compare the answers against the inferential equivalence rubric
5. record where the re-grounding was sufficient and where it drifted

The test loop should evaluate whether the chat understands what we are trying to achieve, not whether it can imitate prior phrasing.

## Local Chat Test Discipline

For strict re-entry testing on the Local chat surface, separate the run into two phases:

1. Load phase
- first prompt should be minimal
- preferred form: read this file and nothing more
- do not bundle the first real evaluation question into the same prompt

2. Verification phase
- only after the file has been read should follow-up questions begin
- verify inferential equivalence across several turns in the same chat
- do not count one good first answer as sufficient proof

Important interpretation rules:
- if the first prompt both instructs file reading and asks the substantive question, treat the run as a weaker probe rather than a clean end-to-end re-entry test
- if a run proves only that the fresh chat read the file, record that as successful load-phase evidence, not as full inferential verification
- if rendered-surface focus or blur may have interrupted the run, do not overinterpret the stop as a semantic failure
- if a helper workaround opens extra chats only to dodge a host guard, treat that run as contaminated unless the workaround itself is what is being tested

Current tooling lesson:
- exact continuation on the same Local session may be blocked by a self-targeting guard when the target session is the most recently updated visible chat
- that guard is a tooling constraint, not evidence that re-grounding failed
- preserve the distinction between surface limitation and inference limitation

## Compaction Tolerance

Expect compaction or reset pressure.
Do not rely on current conversational continuity to preserve test discipline.

Current practical warning:
- automatic compaction may happen without an explicit in-run signal
- do not infer that uninterrupted tone or momentum proves no compact occurred
- when recent findings matter, prefer preserving them in support artifacts before continuing risky or inference-sensitive work

Current design stance:
- do not treat recovery of the host's auto-compact prompt as the main support goal
- the practical requirement is that a fresh or compacted chat can detect possible continuity loss and re-ground from visible artifacts
- if compaction is suspected, the right next move is artifact-first re-entry, not speculation about hidden summarization instructions

Current phase gate:
- the Windows public-review gate is now treated as met for the current packet
- keep Windows as the primary operational truth surface while the next phase hardens tooling reliability rather than broadening platform claims
- prefer high-confidence Windows evidence over wider but weaker Linux or macOS scope
- before broader Agent Architect feature development, harden the most heuristic tooling lanes in this order: self-targeting guard, reveal-plus-focused fallback, transport-workaround, then `deterministic-state-hack`

What should survive in artifacts is:
- the real project goal
- the inferential equivalence rubric
- the two-phase Local test discipline
- the distinction between load-phase evidence and full verification
- the distinction between host-tooling limits and actual inference failure

Current Local-surface checkpoint worth preserving:
- the Local surface on this host can preserve workspace runtime-agent mode state under `.github/agents/*.agent.md`
- the same Local surface did not provide strong participant-selection evidence for a custom agent on either create or stabilized lifecycle routes when strict selection evidence was required
- best-effort Local runs preserved user-turn and mode-patch evidence, but did not preserve matching assistant-response evidence strongly enough to treat custom-agent participation as verified on this host
- treat Local custom-agent behavior here as state-stabilizable but not participant-verifiable until stronger same-surface evidence exists

## Compact Re-Entry Prompt Templates

If compaction pressure is high or a reset may already have happened, prefer using one of these prompts rather than improvising.

These prompts are meant to make compaction survivable even when the host's own compact wording is unknown or not inspectable.

Primary compact prompt:

```text
Read CO-DESIGNER.md and docs/reference/current-status.md first, then re-ground this repo before making any strong claims.

Use deterministic re-grounding to sufficiently equivalent inference, not wording imitation.
Treat artifact-backed state, current tool evidence, and current-session inference as separate layers.
Do not treat tone, continuity, or confidence as proof.

Before proposing any decision, restate:
1. the real project goal
2. the current claim boundary
3. the latest Local-surface checkpoint that matters right now
4. what is verified versus only inferred
5. what the next bounded phase is after the Windows public-review gate

For the current Local checkpoint, preserve this distinction:
- workspace runtime-agent mode state under `.github/agents/*.agent.md` could be preserved on this host
- custom-agent participant selection was not strongly verified on the Local surface
- assistant-response evidence for those custom-agent probes was not preserved strongly enough to upgrade participation into a verified claim

For the next bounded phase, preserve this order unless current evidence falsifies it:
- self-targeting guard reliability
- reveal-plus-focused fallback reliability
- transport-workaround reliability
- `deterministic-state-hack` as a control/debug lane rather than product-truth lane

Then propose the narrowest sensible next step that increases confidence rather than adding low-value prose.
```

Stricter compact prompt for inference-sensitive work:

```text
Assume compaction or reset may already have happened silently.
Read CO-DESIGNER.md and docs/reference/current-status.md before doing anything else.

Re-ground the repo from artifacts and current evidence, not from conversational continuity.
Do not compress uncertainty into fluent wording.

Your first response must do only these things:
1. state the project goal in current practical terms
2. state the active claim boundary
3. distinguish verified facts, current-tool evidence, and current-session inference
4. restate the current Local custom-agent limitation on this host
5. restate the current post-review-ready tooling hardening order
6. name one small next action that would most increase confidence

Do not start broad cleanup, redesign, or speculative conclusions until that re-grounding step is complete.
```

## Multi-Turn Question Pack

Use short questions in the same fresh chat after it has read this file.

Suggested question pack:

1. Orientation
- What are we actually trying to achieve in this repo right now?

2. Determinism
- Why is deterministic re-grounding more important here than smooth but weak continuity?

3. Epistemic Boundary
- What is the difference between remembering, inferring, and verifying in this project?

4. Product Lens
- If the repo starts feeling too theoretical, how should that be interpreted?

5. Action Judgment
- What is the first sensible next step if the goal is to improve fresh-chat re-entry without copying the whole conversation?

6. Failure Detection
- What kind of answer would sound good but still indicate failed re-grounding?

These questions are not meant as a prompt template for runtime agents.
They are a verification pack for checking whether a fresh chat reached sufficiently equivalent inference.

## How To Judge Answers

Good answers usually have these properties:
- they are specific to this repo
- they mention artifacts, verification, and re-grounding explicitly
- they preserve the distinction between hidden platform context and versioned repo context
- they do not confuse tone alignment with successful recovery
- they propose next steps that improve the test loop or the artifact surface itself

Weak answers often have these properties:
- they talk generically about "AI collaboration" without naming the repo's actual control shift
- they optimize for smoothness, friendliness, or summarization without naming verification
- they suggest copying more conversation text as the first solution without examining artifact design and test structure
- they default to broad framework work instead of the smallest testable next step

## Artifact Design Rule

This file may be longer than a typical runtime-facing support artifact if that extra text materially improves deterministic re-grounding.

But it should still compress rather than archive.
It should preserve:
- target understanding
- epistemic rules
- priority order
- failure modes
- verification shape

It should not try to preserve:
- full chat history
- emotional replay of the entire collaboration
- large narrative summaries that are hard to test

## Repo Direction

When judging this repo, prefer the external product lens over historical continuity.

Current core vision to preserve:
- verifiable human-AI collaboration in a repo environment

Current preferred bias:
- practical value before architecture
- one clear useful workflow before broad framework language
- visible verification before fluent confidence
- the smallest meaningful next step before grand redesign

Current practical bias during this phase:
- do not broaden claims faster than the executable baseline can support them
- if a support artifact and a test or harness disagree, fix the mismatch before expanding scope
- prefer one repaired and believable workflow over many partially true surfaces

If something feels too theoretical, too defensive, or too hard to adopt, treat that as a product signal, not as reader failure.

## Interaction Rule

If the path is clear, proceed with low friction.
If uncertainty materially changes the action, stop and ask the smallest useful question.

All files in the repo may be changed, replaced, moved, or removed if that increases the probability of reaching a better and more truthful outcome.
There is no requirement to preserve a previous shape only because it already exists.

## Use In A New Chat

At the start of a new conversation:
1. read this file to recover the collaboration mode
2. match the user's language
3. recover the immediate goal
4. re-ground repo state before making strong claims or edits
5. keep momentum high and boilerplate low