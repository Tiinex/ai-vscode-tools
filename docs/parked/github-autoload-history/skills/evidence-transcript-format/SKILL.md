---
name: evidence-transcript-format
description: "Use when producing, reviewing, or refining verbatim Markdown evidence transcripts from stored session or context artifacts, including main-thread windows, descendant tool/subagent flows, provenance fields, omissions/limits, and transcript payload examples."
---

# Purpose
Define the canonical Markdown format for evidence transcripts that are readable by humans, reproducible from stored session or context artifacts in the conversation flow, and explicit about scope, provenance, and omissions.

This skill is intentionally narrow.
It is not a generic evidence schema for arbitrary evidence surfaces.

# Use This Skill When
- producing a transcript payload from stored session or context artifacts
- reviewing whether a transcript format is evidence-friendly rather than summary-like
- refining transcript structure for main-thread windows and descendant flows
- deciding how to label user messages, assistant messages, tool calls, subagent calls, linked reads, or access limits
- deciding what belongs in scope, provenance, and omissions sections

# Core Output Shape

The default transcript shape is:
1. `# Evidence Transcript`
2. `## Scope`
3. one block per evidence unit using a semantic heading
4. `## Omissions / Limits`
5. `## Provenance Summary`

Do not wrap the whole transcript in one outer code block.
The transcript itself is the payload.
Use `---` between evidence blocks for readability.

# Block Titles

Use semantic block headings instead of generic labels such as `Moment`.

Preferred headings:
- `## User Message`
- `## Assistant Message`
- `## Editing Session State`
- `## Tool Invocation`
- `## Tool Result`
- `## Subagent Invocation`
- `## Subagent Result`
- `## Linked Content Read`
- `## Access Limit`

If a new heading is needed, it should describe the evidence unit directly.
Avoid vague headings such as `Item`, `Entry`, or `Moment`.

# Block Metadata

Each evidence block should contain a short metadata list before the verbatim payload.

Default metadata fields:
- `**ID:**` stable local block identifier such as `M001`
- `**Flow:**` `Main thread`, `Artifact anchor`, or `Descendant`
- `**Parent:**` nearest direct origin block, or `none` for the first root block
- `**Source:**` stored artifact location that carried the payload
- `**Verbatim:**` `yes` when the payload block is copied rather than paraphrased

Optional field relevance rules:
- include `**Agent:**` for subagent blocks
- include `**Tool:**` for every `Tool Invocation` and `Tool Result` block
- include `**Timestamp:**` only when the timestamp comes directly from the stored artifact and is not reconstructed

Omit optional fields when they do not apply to the current block.

Use bold field names for scanability.
Keep metadata compact.
`ID` values must be unique within the transcript.
Use the canonical block-ID pattern `MNNN`, where `NNN` is a zero-padded sequence number within that transcript.
If the transcript exceeds `M999`, continue as `M1000`, `M1001`, and so on.
`Parent` should reference the exact `ID` value of the direct origin block, or `none`.
`**Tool:**` should contain the bare tool name only.
If the stored artifact uses a richer call identifier, keep that exact identifier in `Source` or in the verbatim payload block, not in the `Tool` field.
Arguments, payloads, or call identifiers belong in `Source` or in the verbatim payload block, not in the `Tool` field.
If `**Timestamp:**` is included, preserve the stored timestamp representation exactly and do not normalize timezone, precision, or formatting.

# Flow Semantics

Use `Main thread` for the selected user and assistant conversation window itself.
Use `Artifact anchor` only when the request targets a stored evidence chain and no safe user-assistant main-thread window is recoverable from the named artifacts.
Use `Descendant` for tool calls, tool results, subagent calls, subagent results, linked reads, and other evidence blocks that exist because a main-thread, artifact-anchor, or descendant block triggered them.

`Artifact anchor` is a narrow fallback, not a general third transcript mode.
Use it only when the transcript would otherwise have to fail solely because the named artifacts preserve the evidence chain but not a recoverable chat message window.
Do not use `Artifact anchor` when a normal main-thread window is recoverable.

Do not classify a block as `Descendant` merely because it is nearby in storage.
It should be causally tied to the selected window.
If causality is only suggestive rather than direct, do not include the block as a descendant unless the transcript explicitly marks the uncertainty in `## Omissions / Limits`.
If no direct or explicitly evidenced linkage exists, do not force a `Parent`; omit the block from the selected transcript and record the gap in `## Omissions / Limits`.
A multi-hop descendant chain is still acceptable when each hop is directly evidenced by the transcript's own `Parent` chain.

Direct causality is established by at least one of:
- explicit parent/request/call linkage in the stored artifact
- direct invocation/result pairing in the same stored flow
- direct linked-read reference from an already included block

Mere proximity in storage is never enough.
Cross-artifact-family causality is allowed only when the direct linkage is evidenced by the included block's own source, linkage fields, or invocation/result pairing.

# Parent Semantics

`Parent` means the nearest direct origin block in the transcript chain.
It does not mean abstract ownership or long-range ancestry.
It must identify the atomic block that directly triggered this block's existence.
Do not use transitive ancestors, broad decision context, or logical influence as `Parent`.

Examples:
- an assistant reply may have the preceding user message as parent
- an editing-session state entry may be the root `Artifact anchor` block when it is the first recoverable evidence unit for the requested chain
- a tool invocation should have the assistant block that triggered it as parent
- a tool result should have the tool invocation as parent
- a subagent result should have the subagent invocation as parent
- a linked content read should have the block that explicitly led to that read as parent

Sibling descendants may share the same `Parent`.
When that happens, keep them as separate blocks and preserve their stored order where the artifact surface exposes one.
The primary artifact is the artifact family that supplied the selected main-thread window itself.
If ordering must be reconstructed across artifact families, use this fallback order:
1. direct stored order in the primary artifact named in `## Scope`
2. direct timestamp order when timestamps are exposed
3. lexical order of `Source` as the final tie-break

The first available rule in that sequence wins.
If any fallback beyond direct stored order is used, note that reconstruction limit in `## Omissions / Limits`.

For nested descendants, continue applying the same direct-origin rule.
Example: a tool block emitted inside a subagent run should normally parent to the `Subagent Invocation` block that launched that run, not to a later `Subagent Result`, unless the later result explicitly triggered a new read.
If a nested tool block is directly triggered by another descendant block inside the same subagent run, parent it to that nearer descendant block instead of the outer invocation.

# Evidence Unit Boundaries

An evidence unit is one atomic stored event or one atomic retrieved payload.

Default split rules:
- split main-thread user and assistant messages into separate blocks
- split a tool invocation and its result into separate blocks
- split a subagent invocation and its result into separate blocks
- split a linked content read into its own block when the linked artifact is read separately
- treat a tool error as a `Tool Result` block carrying the error payload
- keep repeated linked reads as separate blocks unless the stored artifact only exposes them as one atomic batch

Batch decision rule:
- treat repeated linked reads as one atomic batch only when the stored artifact exposes them as one indivisible I/O boundary rather than as separately identifiable reads
- if the artifact exposes separate call, result, hash, or link records, keep them as separate blocks

Do not merge multiple atomic events into one block just because they belong to the same higher-level action.
If a stored artifact collapses multiple events and no finer split is recoverable, note that limit in `## Omissions / Limits`.

# Payload Rules

Every verbatim payload must be inside a fenced code block.

Choose the fence language by payload type when possible:
- `text` for plain stored text or when no more specific fence is reliable
- `json` for structured tool payloads in JSON form
- `yaml` for structured payloads that are naturally key/value text rather than JSON
- `markdown` only when the stored payload itself is Markdown and preserving that helps readability

For chat-message payloads taken from session artifacts, default to `text` unless the stored payload is itself a standalone Markdown artifact body whose structure would be lost by downgrading the fence.

Use `text` instead of `yaml` when the payload is only a partial fragment, mixed-format snippet, or otherwise not reliable as standalone YAML.
For non-text or binary payloads, do not inline the binary body; emit an `Access Limit` or `Linked Content Read` block with source/provenance metadata and describe the non-text limit in `## Omissions / Limits`.
Use `Linked Content Read` when the linked artifact itself produced a readable stored payload or readable retrieval metadata that is being shown as evidence.
Use `Access Limit` when the attempted read is itself the atomic evidence unit and no readable body can be emitted, or when the body is non-text and cannot be safely inlined.

Do not paraphrase inside the payload blocks.
Do not mix interpretation into the payload blocks.
The canonical transcript format is verbatim-first.
Treat `Verbatim` as a yes-only assertion within this skill's current scope.
Do not emit `Verbatim: no` blocks inside the canonical transcript payload.
If future roles need non-verbatim evidence handling for other evidence surfaces, extend the format then rather than encoding that complexity now.

# Scope Rules

The `Scope` section must state:
- requested window
- anchor rule if one exists
- whether descendant flows are included
- which artifact families were actually used

If the request is for a bounded window such as "last 4 main-thread messages", do not silently widen the transcript beyond that window.
If descendant flows are included, include only those that belong to the selected main-thread window.
Treat the anchor rule as a documented selection rule for the transcript window, not as narrative commentary.
The anchor rule may remain plain human-readable text in `## Scope`; it does not need a separate machine-readable grammar inside the transcript payload.
If no safe user-assistant main-thread window is recoverable from the named artifacts, but the named artifacts do preserve the requested evidence chain, the transcript may fall back to an `Artifact anchor` block.
When that fallback is used, say so explicitly in both `## Scope` and `## Omissions / Limits`.

# Source Rules

`Source` should be specific enough that a human can trace the payload back to the stored artifact.

Good examples:
- `chatSessions/86388876-...jsonl :: messageId=user-017`
- `chatEditingSessions/d0cc4dc2-.../state.json :: initialFileContents[README.md]`
- `chatEditingSessions/d0cc4dc2-.../contents/e064498`

Do not rely on copied UI-generated Markdown links unless the exporter can guarantee they are correct.
Prefer plain text source strings over broken or unstable links.
Prefer artifact-family-relative source strings over absolute machine-local storage prefixes.
When the stored artifact lives under a machine-specific root such as a user profile or workspace storage directory, strip that absolute prefix and start `Source` at the stable artifact-family segment such as `chatSessions/...` or `chatEditingSessions/...`.
If source strings are truncated for readability, truncate them consistently within the transcript and preserve the distinguishing suffix such as `messageId`, `toolCall`, `subagentResult`, or content hash.
Default truncation pattern for session-like identifiers inside a longer source string: keep the artifact-family prefix, keep the first 8 visible characters of the varying identifier, then `...`, and preserve the final filename suffix or the distinguishing token after `::`.
If the varying identifier is shorter than 8 visible characters, keep it in full and do not add `...`.
Count visible characters exactly as they appear in the identifier substring; letters, digits, dashes, underscores, and dots all count if present.
The varying identifier is the storage-specific token segment that changes between otherwise similar source strings, such as a session id, hash, or generated record id.

# Omissions And Limits

Always include a final `## Omissions / Limits` section.

List:
- earlier or later material omitted due to requested scope
- sibling branches omitted as irrelevant
- unreadable linked records
- ordering uncertainty when reconstruction spans multiple artifact families
 - causality uncertainty when a nearby block could not be included safely

Only list the limit categories that actually apply to the current transcript.

If something is unreadable, say that explicitly.
Do not reconstruct missing text.
If a tool invocation produced an explicit failure payload, prefer `Tool Result`.
Use `Access Limit` for transcript-construction limits such as unreadable linked records, non-text payloads, or omitted blocks whose direct causality could not be established safely.
Use an `Access Limit` block when the limit itself is an atomic evidence unit tied to an included `Parent` block.
Use `## Omissions / Limits` alone when no safe atomic block can be emitted without inventing causality.

Access Limit decision rule:
- emit an `Access Limit` block when there is an included parent block that directly led to the failed or unreadable step
- use `## Omissions / Limits` alone when the missing or unreadable material cannot be attached to an included parent without inventing a causal chain
- prefer `Linked Content Read` instead when the linked step yielded readable retrievable evidence and the limit only applies to some later or separate body expansion

If the exporter can recover at least one safe atomic evidence unit or one safe atomic access-limit unit from the named artifacts, prefer emitting a canonical transcript payload with `## Omissions / Limits` over switching to a non-transcript report.

# Provenance Summary

Use a short closing summary to explain how to interpret the transcript.

It should clarify:
- that each block is an atomic evidence unit
- that `Parent` identifies the direct origin block
- that `Source` identifies the storage surface carrying the payload
- that `Verbatim: yes` means copied rather than paraphrased content, and is currently a yes-only assertion in this scoped format

# Common Mistakes To Avoid
- do not format the transcript as a prose narrative
- do not use generic headings such as `Moment` when a semantic heading is available
- do not place the whole transcript inside one outer code block
- do not paraphrase raw payloads
- do not hide omissions implicitly
- do not rely on broken UI-generated Markdown links
- do not let provenance dominate the visual hierarchy over the payload itself
- do not invent causal links just to make the tree look complete

# Preferred Review Checklist
- headings are semantic and easy to scan
- metadata field names are bold and consistent
- each payload block is verbatim and fenced
- `Parent` relationships are locally sensible and non-transitive
- main-thread and descendant flow are clearly separated
- scope is explicit and narrower than the full session unless the request truly asked for the full session
- omissions, unreadable records, and causality limits are listed explicitly
- source strings are traceable and not dependent on unreliable copied links
- sibling descendant ordering is either direct from storage or explicitly marked as reconstructed

# Bundled Examples
- `example-evidence-transcript.md` — canonical normal case
- `example-access-limit-transcript.md` — unreadable or non-text limit handling
- `example-nested-descendant-transcript.md` — multi-hop descendant chain and sibling ordering
- `example-hybrid-payload-transcript.md` — partial structured payloads that still use `text`