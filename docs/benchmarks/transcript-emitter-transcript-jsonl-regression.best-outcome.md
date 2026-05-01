# Evidence Transcript

Support-only benchmark output. Read this file as one preserved run result, not as the general contract by itself.
Use [transcript-emitter-transcript-jsonl-regression.md](transcript-emitter-transcript-jsonl-regression.md) for the requested window, rules, and scope.

## Scope
- **Requested window:** bounded persisted transcript window anchored on the exact user message `Kan du läsa transcript-lagret först?` and including the directly paired assistant message plus directly evidenced tool descendants from the same transcript window
- **Anchor:** exact user message `Kan du läsa transcript-lagret först?`
- **Descendants:** directly evidenced tool invocation and tool result descendants included
- **Artifacts used:** docs/benchmarks/assets/transcript-emitter-transcript-jsonl-sample.jsonl
- **Ordering:** transcript file order

---

## User Message
- **ID:** M001
- **Flow:** Main thread
- **Parent:** none
- **Source:** docs/benchmarks/assets/transcript-emitter-transcript-jsonl-sample.jsonl :: user.message :: id=msg-user-001
- **Timestamp:** 2026-04-08T11:00:05.000Z
- **Verbatim:** yes

```text
Kan du läsa transcript-lagret först?
```

---

## Assistant Message
- **ID:** M002
- **Flow:** Main thread
- **Parent:** M001
- **Source:** docs/benchmarks/assets/transcript-emitter-transcript-jsonl-sample.jsonl :: assistant.message :: id=msg-assistant-001
- **Timestamp:** 2026-04-08T11:00:07.000Z
- **Verbatim:** yes

```text
Ja. Jag börjar i transcript-lagret och håller exporten deterministisk.
```

---

## Tool Invocation
- **ID:** M003
- **Flow:** Descendant
- **Parent:** M002
- **Source:** docs/benchmarks/assets/transcript-emitter-transcript-jsonl-sample.jsonl :: tool.execution_start :: id=tool-start-001 :: toolCallId=toolcall-001
- **Tool:** read_file
- **Timestamp:** 2026-04-08T11:00:08.000Z
- **Verbatim:** yes

```json
{"filePath":"src/extension/chat/vscode-node/sessionTranscriptService.ts"}
```

---

## Tool Result
- **ID:** M004
- **Flow:** Descendant
- **Parent:** M003
- **Source:** docs/benchmarks/assets/transcript-emitter-transcript-jsonl-sample.jsonl :: tool.execution_complete :: id=tool-complete-001 :: toolCallId=toolcall-001
- **Tool:** read_file
- **Timestamp:** 2026-04-08T11:00:09.000Z
- **Verbatim:** yes

```text
export class SessionTranscriptService {}
```

## Omissions / Limits
- `session.start`, `assistant.turn_start`, and `assistant.turn_end` fall inside the named transcript file but are omitted from the transcript body because they are control-plane entries rather than direct evidence units for the requested window.
- The bundled `reasoningText` inside `assistant.message :: id=msg-assistant-001` is not emitted as its own block because it is not stored as a separate atomic transcript entry.
- The bundled `assistant.message.toolRequests` metadata is not duplicated as an extra tool invocation block because the same tool call is recoverable from separate `tool.execution_start` and `tool.execution_complete` entries.

## Provenance Summary
- Each block is copied verbatim from the named transcript JSONL fixture.
- Transcript file order is used as the direct stored order for the selected window.
- `Parent` follows explicit transcript `parentId` only when the referenced parent entry is inside the selected transcript window.
- Transcript entry identifiers remain in `Source` while emitted block IDs use the canonical local `MNNN` sequence.