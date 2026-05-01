# Transcript Emitter Transcript JSONL Regression

Support-only benchmark brief. Read this file as the exact regression request for one evidence-export check, not as a general introduction to transcript handling in the repo.
Use the paired best-outcome file only together with this brief.

Read only these stored artifact surfaces:
- /home/olle/Documents/Agents/agent-architect/docs/benchmarks/assets/transcript-emitter-transcript-jsonl-sample.jsonl

Produce only the canonical Markdown evidence transcript payload.

Requested window:
- target the bounded persisted transcript window anchored on the exact user message `Kan du läsa transcript-lagret först?`
- include the directly paired assistant message and the directly evidenced tool invocation and tool result descendants from the same transcript window
- preserve transcript file order as the direct stored order
- include `Timestamp` exactly as stored when present
- set `Parent` only from explicit `parentId` when the referenced parent block is inside the selected window
- keep transcript entry identifiers in `Source`, but keep local transcript block IDs in canonical `MNNN` form
- use plain artifact-relative source strings, not Markdown links, in metadata
- omit `session.start`, `assistant.turn_start`, and `assistant.turn_end` from the transcript body because they are control-plane entries here; record those omissions explicitly
- do not duplicate the bundled `assistant.message.toolRequests` metadata as a second tool invocation block when the same tool call is recoverable from separate `tool.execution_start` and `tool.execution_complete` entries
- do not emit the bundled `reasoningText` as a separate block because it is not a separately stored atomic entry; record that collapsed boundary explicitly
- for `tool.execution_start`, emit the direct arguments payload rather than the wider wrapper object when those arguments are recoverable
- for `tool.execution_complete`, emit the direct `result.content` payload rather than the wider wrapper object when that narrower result body is recoverable
- do not ask questions or add narrative outside the transcript payload

If only a partial transcript window is recoverable, emit the partial canonical transcript with explicit omissions.