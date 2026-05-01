# Evidence Transcript

Support-only benchmark output. Read this file as one preserved run result, not as the general contract by itself.
Use [transcript-emitter-transcript-jsonl-descendant-gap-regression.md](transcript-emitter-transcript-jsonl-descendant-gap-regression.md) for the requested window, rules, and scope.

## Scope
- **Requested window:** bounded persisted transcript window anchored on the exact user message `Fortsätt, men ta bara med det som är säkert evidensierat.` and ending before the later user message `Det räcker för den här kontrollen.`
- **Anchor:** exact user message `Fortsätt, men ta bara med det som är säkert evidensierat.`
- **Descendants:** directly evidenced descendant blocks from the same window included
- **Artifacts used:** docs/benchmarks/assets/transcript-emitter-transcript-jsonl-descendant-gap-sample.jsonl
- **Ordering:** transcript file order

---

## User Message
- **ID:** M001
- **Flow:** Main thread
- **Parent:** none
- **Source:** docs/benchmarks/assets/transcript-emitter-transcript-jsonl-descendant-gap-sample.jsonl :: user.message :: id=msg-user-011
- **Timestamp:** 2026-04-08T12:01:00.000Z
- **Verbatim:** yes

```text
Fortsätt, men ta bara med det som är säkert evidensierat.
```

---

## Assistant Message
- **ID:** M002
- **Flow:** Main thread
- **Parent:** M001
- **Source:** docs/benchmarks/assets/transcript-emitter-transcript-jsonl-descendant-gap-sample.jsonl :: assistant.message :: id=msg-assistant-011
- **Timestamp:** 2026-04-08T12:01:02.000Z
- **Verbatim:** yes

```text
Ja. Jag fortsätter bara med det som går att binda direkt till transcriptets egna fält.
```

---

## Tool Invocation
- **ID:** M003
- **Flow:** Descendant
- **Parent:** M002
- **Source:** docs/benchmarks/assets/transcript-emitter-transcript-jsonl-descendant-gap-sample.jsonl :: tool.execution_start :: id=tool-start-011 :: toolCallId=toolcall-011
- **Tool:** read_file
- **Timestamp:** 2026-04-08T12:01:03.000Z
- **Verbatim:** yes

```json
{"filePath":"docs/targets/transcript-evidence-export-brief.md"}
```

## Omissions / Limits
- `session.start`, `assistant.turn_start`, and `assistant.turn_end` fall inside the named transcript file but are omitted from the transcript body because they are control-plane entries rather than direct evidence units for the requested window.
- The bundled `reasoningText` inside `assistant.message :: id=msg-assistant-011` is not emitted as its own block because it is not stored as a separate atomic transcript entry.
- The bundled `assistant.message.toolRequests` metadata is not duplicated as an extra tool invocation block because the same tool call is recoverable from the separate `tool.execution_start` entry.
- No recoverable `tool.execution_complete` entry for `toolCallId=toolcall-011` is present inside the bounded window, so the descendant result is recorded as missing rather than fabricated.
- The earlier exchange before the anchor and the later user message `Det räcker för den här kontrollen.` are omitted due to the requested scope.

## Provenance Summary
- Each block is copied verbatim from the named transcript JSONL fixture.
- Transcript file order is used as the direct stored order for the selected window.
- `Parent` follows explicit transcript `parentId` only when the referenced parent entry is inside the selected transcript window.
- Transcript entry identifiers remain in `Source` while emitted block IDs use the canonical local `MNNN` sequence.