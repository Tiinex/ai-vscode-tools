# Target Brief: Transcript Evidence Export

Use this file as explicit build input for one narrow target.
It is not the main explanation of the repo and should be read together with [../reference/current-status.md](../reference/current-status.md) when reviewing larger claims.

Create the smallest viable transcript-to-evidence exporter for Agent Architect.

Purpose:
Give the architect a reproducible, ordered Markdown evidence surface derived from persisted VS Code chat transcripts, without depending on lossy `content.txt`-style reconstructions.

Why this target exists:
- the currently observed grouped-record failures are easiest to explain at or after flattened resource layers
- the strongest verified export seam is the persisted transcript JSONL model, not a provider method body that remains only partially verified
- the architect needs ordered, provenance-aware Markdown evidence more than UI-faithful rendering

Chosen source seam:
- read persisted transcript files under `storageUri/transcripts/<sessionId>.jsonl`
- treat transcript file order as the primary ordering surface
- use transcript linkage fields such as `id`, `timestamp`, and `parentId` when present

Expected high-level behavior:
- read one persisted transcript file deterministically
- emit a canonical Markdown evidence transcript
- preserve atomic event boundaries instead of merging adjacent events into summaries
- preserve direct parent linkage when the stored transcript exposes it
- preserve verbatim payloads in fenced code blocks
- emit explicit omissions when the transcript model does not preserve a requested relation or payload
- treat transcript JSONL as the minimal first-version exporter path; leave grouped-record and `content.txt` recovery as secondary legacy paths rather than the implementation starting point

Canonical output shape:
- `# Evidence Transcript`
- `## Scope`
- one ordered evidence block per transcript entry or per recoverable atomic payload
- `## Omissions / Limits`
- `## Provenance Summary`

Transcript entry mapping:
- `user.message` -> `## User Message`
- `assistant.message` -> `## Assistant Message`
- `tool.execution_start` -> `## Tool Invocation`
- `tool.execution_complete` -> `## Tool Result`
- `assistant.turn_start` / `assistant.turn_end` -> include only when they carry direct evidentiary value for the requested window; otherwise mention their omission in `## Omissions / Limits`
- unknown or unreadable entry types -> `## Access Limit`

Required block metadata:
- `**ID:**` stable local `MNNN` block identifier as required by the evidence transcript format skill
- `**Flow:**` `Main thread` for user or assistant messages; `Descendant` for tool execution blocks; use `Artifact anchor` only if no recoverable user-assistant window exists
- `**Parent:**` the emitted block's local `MNNN` identifier for the direct origin block when transcript `parentId` points to an included block; otherwise `none` for a root block or an explicit omission if linkage is expected but absent
- `**Source:**` `transcripts/<sessionId>.jsonl :: <entry-type>` plus transcript entry `id` or another distinguishing identifier when available
- `**Verbatim:**` `yes`
- `**Tool:**` bare tool name for tool invocation/result blocks when present
- `**Timestamp:**` exact stored timestamp when present

Payload mapping rules:
- user messages: emit stored user content verbatim in a `text` fence
- assistant messages: emit stored assistant content verbatim in a `text` fence
- assistant reasoning text: emit as a separate `## Assistant Message` block only if it is a separately stored atomic payload; otherwise preserve it in the same block and note the collapsed boundary in `## Omissions / Limits`
- tool invocation arguments: emit verbatim in `json` when the stored payload is reliable JSON, otherwise `text`
- tool result content: emit verbatim in `json` or `text` based on the stored payload form
- bundled tool requests inside `assistant.message`: do not duplicate them when separate `tool.execution_start` / `tool.execution_complete` entries already exist; if no separate tool execution entry exists but bundled metadata exposes a concrete tool name and recoverable arguments, one `## Tool Invocation` block may be emitted from that bundled metadata with the provenance made explicit
- attachments or linked artifacts: emit as `## Linked Content Read` only when the transcript itself preserves readable linked payload or retrieval metadata; otherwise record the missing readable body under `## Omissions / Limits`

Ordering rules:
- use transcript file order first
- use exact stored timestamps only when transcript file order is unavailable or ambiguous
- if timestamps from different artifact families are not directly comparable in stored form, preserve them as metadata and record the ordering limit explicitly rather than normalizing heuristically
- do not reconstruct speculative sibling order from nearby storage alone

Linkage rules:
- trust explicit `parentId` when present
- do not invent parent relationships for blocks that are only storage-nearby
- if a tool result has a `toolCallId` but no trustworthy direct parent, preserve the `toolCallId` in metadata or payload and record the parent gap in `## Omissions / Limits`
- do not claim subagent lineage unless the transcript schema exposes it directly

Minimum supported transcript fields:
- entry `type`
- entry `id`
- entry `timestamp`
- entry `parentId`
- user message content
- assistant message content
- assistant tool requests
- assistant reasoning text when present
- tool execution identifiers, arguments, success state, and result content when present

Out of scope for the first version:
- recovering UI-specific response parts from provider-only turn objects
- reconstructing grouped record families from flattened `content.txt` resources
- inferring subagent lineage that is not directly exposed by the transcript model
- cross-session stitching or merged multi-artifact replay

Initial build expectations:
- build the smallest viable exporter from transcript JSONL to canonical Markdown evidence
- prefer explicit omissions over speculative reconstruction
- keep the exporter deterministic for the same transcript input
- defer provider-path enrichment until a concrete provider hook is verified end-to-end

Acceptance criteria:
- given one transcript JSONL file, the exporter emits a stable Markdown transcript in canonical section order
- user and assistant entries remain separate evidence blocks
- tool invocations and tool results remain separate evidence blocks when separately stored
- each emitted block includes provenance sufficient to trace back to the transcript entry
- missing linkage or unreadable payloads are reported in `## Omissions / Limits`

Follow-up verification target:
After the transcript exporter exists, compare one emitted transcript against the provider-side seam only to measure what fidelity is missing, not to block initial delivery.