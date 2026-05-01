# Interop API: `send_message_with_lifecycle`

Version: 2026-04-12

## Purpose

`send_message_with_lifecycle` is the preferred high-level route for creating a new Local chat when agent or model selection must not be left to whatever visible host state happens to be active.

If you only need the short version, read `Use it when`, `Do not use it when`, and `Known limitations`.

It is an agent-facing tool.
It is not a blanket promise that ordinary Local exact-session transport is solved.

## Use it when

- you are creating a new Local chat and requested agent or model stability matters
- read-after-write verification matters more than a minimal UI path
- raw `create_live_agent_chat` behavior has proven too unstable for the task

## Do not use it when

- you need raw create-path measurement rather than lifecycle stabilization
- you want to claim exact-session Local send support on hosts that still lack it
- you are trying to override the first-request model selected by a custom agent file's own frontmatter

In those cases, use the more direct surface that matches the question.

## Recommended route order

1. `send_message_with_lifecycle`
2. `create_live_agent_chat`
3. `reveal_live_agent_chat`
4. `send_message_to_live_agent_chat`
5. `send_message_to_focused_live_chat` or `send_message_to_focused_editor_chat`

The idea is to choose the strongest route that honestly matches the claim being tested.

## Input contract

- `prompt` required
- `agentName` optional
- `mode` optional
- `modelId` optional
- `modelVendor` optional
- `blockOnResponse` optional
- `requireSelectionEvidence` optional

Important note:

- the current implementation does not accept `sessionId`
- despite the name, the tool is effectively create-first and then stabilizes before the real prompt is sent

## Actual behavior

1. Create a new Local chat with a seed prompt.
2. If `agentName` resolves to a workspace agent file, patch persisted `inputState.mode` when possible.
3. If needed and possible, patch persisted `inputState.selectedModel` using recoverable model-state evidence.
4. Send the real prompt through the same Local follow-up route used by the rest of the tooling.
5. Return a standard chat-mutation result with lifecycle notes.

## Known limitations

- ordinary Local exact-session send is still host-limited
- custom agent participant selection is still not strongly verifiable on the Local surface
- a custom agent file's `model` frontmatter can still override an explicitly requested create-model for the first request
- a persisted model patch cannot retroactively change a request that already happened

## Verification expectations

Do not treat successful dispatch as enough.

When model, mode, or target selection matters, verify with both:

- the returned tool result
- persisted session state or equivalent artifact-backed evidence

If lifecycle fallback fails, that usually means a host-surface limitation or targeting problem.
It is not automatically evidence that the earlier lifecycle steps were wrong.

In plain language: a successful send is not enough; verify what actually landed.
