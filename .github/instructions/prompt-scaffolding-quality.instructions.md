---
description: Quality guard for Local-chat prompt scaffolding, fallback dispatch artifacts, and cleanup discipline in ai-vscode-tools.
applyTo: "src/**"
---

# Prompt Scaffolding Quality Guard

Use this file when changing Local-chat create/send routing, prompt-file slash dispatch, temporary prompt artifacts, or nearby public tool descriptions.

Use `tooling-validation.instructions.md` for canonical workflow and live-pass discipline. Use this file for prompt scaffolding quality so temporary routing support does not decay into a truth-bearing surface.

## Current Failure Model

- The prompt-file slash fallback currently writes a real prompt artifact before dispatch.
- That artifact contains human-readable frontmatter plus the real user prompt body.
- Even when cleanup eventually succeeds, the artifact may already have appeared in prompt registration, request context, persisted references, or receiver grounding.
- On the current host, `create_live_agent_chat` with `partialQuery: true` can open only an editor draft path under `chatEditingSessions` without yielding a persisted `chatSessions` id for exact continuation.
- Cleanup alone is therefore not a sufficient quality bar.
- A temporary artifact that meaningfully steers grounding is a product-quality problem, not only a hygiene problem.

## Quality Standard

- Prefer routes that do not require a temporary prompt artifact when the host exposes a viable direct or exact-session path.
- Treat prompt-file slash dispatch as a bounded fallback, not the preferred semantic carrier for agent intent.
- If fallback is required, keep the temporary artifact as semantically weak as possible.
- The fallback artifact must not become the most attractive nearby explanation of what the request is about.
- Temporary scaffolding should help transport the request, not compete with role-local repo artifacts for grounding.

## Design Rules

- Do not add descriptive prose to temporary prompt artifacts unless it is required by the host surface.
- Do not repeat more user intent in the artifact than the dispatch contract strictly needs.
- Prefer neutral transport wording over explanatory wording such as why the artifact exists.
- Keep names, frontmatter, and generated copy short enough that they do not read like maintained documentation.
- If the route can bind role or mode first and send the real prompt on the exact session path afterward, prefer that over embedding the whole prompt in a temporary file.
- If a fallback artifact must exist, design it as an implementation detail rather than a plausible grounding source.

## Cleanup Discipline

- Delete temporary prompt artifacts automatically on the normal success path, not only on immediate error.
- Treat cleanup failure as observable quality debt even when send behavior succeeds.
- Avoid silent accumulation of temporary prompt files in the user prompts directory.
- When cleanup must remain best-effort, add enough tracing or diagnostics that leftover artifacts can be detected and audited.
- Do not claim the surface is clean merely because a later cleanup hook exists; judge whether the artifact was visible long enough to matter.

## Receiver-Oriented Checks

- When evaluating a prompt scaffolding change, check both file-system cleanup and receiver-side attraction.
- Ask whether the temporary artifact could be mistaken for the nearest relevant project artifact by the receiving model.
- Treat prompt registration, attached prompt references, and persisted content references as part of the effective surface.
- Treat draft-only `chatEditingSessions` traces as part of the effective surface too; if a fallback opens a draft but not a persisted targetable session, it is not an acceptable exact bootstrap.
- If a temporary dispatch artifact appears in history or content references often enough to shape grounding, the route still needs improvement.

## Improvement Preference Order

- First, prefer a host path that avoids prompt-file dispatch entirely.
- Second, prefer a two-step path that binds role or mode without letting a temporary prompt artifact carry the real request.
- Third, if prompt-file dispatch remains necessary, reduce the artifact's semantic weight before adding more fallback logic.
- Fourth, only add new public tooling surfaces when the existing canonical tools cannot express the safer route.

## Anti-Decay Rules

- Do not normalize temporary scaffolding into a durable first-class knowledge surface through docs, wording, or repeated acceptance of leftovers.
- Do not let convenience for dispatch outrank truthfulness of what the receiver sees.
- When prompt scaffolding changes, re-check nearby public tool descriptions, tests, and debug labels for wording that over-legitimizes the fallback artifact.
- If a probe shows the model grounding from the temporary prompt artifact or unrelated ambient instructions before role-local repo artifacts, treat that as a real regression signal.

## Definition Of Better

- The preferred create/send path either avoids temporary prompt artifacts or keeps them too semantically weak to outrank role-local grounding.
- Draft-prefill alternatives are only acceptable when they still produce a persisted, exact-targetable session id for continuation; otherwise they should fail fast instead of masquerading as a usable create path.
- Temporary artifacts are cleaned automatically and do not linger in ordinary use.
- Leftover artifacts are auditable when cleanup fails.
- Public tool wording does not imply that prompt-file dispatch is a peer-quality route when it is only fallback transport.
- Grounding-sensitive probes can be run without the temporary scaffolding becoming the dominant nearby artifact.
