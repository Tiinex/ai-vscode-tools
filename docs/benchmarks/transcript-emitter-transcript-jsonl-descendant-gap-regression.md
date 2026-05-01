# Transcript Emitter Transcript JSONL Descendant Gap Regression

Support-only benchmark brief. Read this file as the exact regression request for one descendant-gap check, not as the main explanation of the transcript system.
Use the paired best-outcome file only together with this brief.

Read only these stored artifact surfaces:
- /home/olle/Documents/Agents/agent-architect/docs/benchmarks/assets/transcript-emitter-transcript-jsonl-descendant-gap-sample.jsonl

Produce only the canonical Markdown evidence transcript payload.

Requested window:
- target the bounded persisted transcript window anchored on the exact user message `Fortsätt, men ta bara med det som är säkert evidensierat.`
- include the directly paired assistant message and directly evidenced descendant blocks that belong to that same window
- stop before the later user message `Det räcker för den här kontrollen.`
- preserve transcript file order as the direct stored order
- include `Timestamp` exactly as stored when present
- set `Parent` only from explicit `parentId` when the referenced parent block is inside the selected window
- keep transcript entry identifiers in `Source`, but keep local transcript block IDs in canonical `MNNN` form
- use plain artifact-relative source strings, not Markdown links, in metadata
- omit `session.start`, `assistant.turn_start`, and `assistant.turn_end` from the transcript body because they are control-plane entries here; record those omissions explicitly
- emit the recoverable `tool.execution_start` block as `## Tool Invocation`
- do not fabricate a `## Tool Result` block when no `tool.execution_complete` entry is present in the bounded window; record the missing descendant result explicitly in `## Omissions / Limits`
- do not emit the bundled `reasoningText` as a separate block because it is not a separately stored atomic entry; record that collapsed boundary explicitly
- do not duplicate the bundled `assistant.message.toolRequests` metadata as a second tool invocation block when the same tool call is recoverable from the separate `tool.execution_start` entry
- for `tool.execution_start`, emit the direct arguments payload rather than the wider wrapper object when those arguments are recoverable
- do not ask questions or add narrative outside the transcript payload

If only a partial transcript window is recoverable, emit the partial canonical transcript with explicit omissions.