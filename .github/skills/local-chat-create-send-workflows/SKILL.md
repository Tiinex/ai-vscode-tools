---
name: local-chat-create-send-workflows
description: 'Guidance for exact Local chat create/send workflows in VS Code. Use when creating a new Local chat with a custom agent, continuing the same Local chat, or interpreting exact send versus internal focused-fallback transport on hosts that still need fallback.'
user-invocable: false
---

# Local Chat Create/Send Workflows

## When to Use
- Use this skill when a task involves `create_live_agent_chat` or `send_message_to_live_agent_chat`.
- Use it when the goal is to preserve exact target continuity for a Local chat instead of relying on loose UI focus.
- Use it when the task depends on safe same-chat follow-ups, bounded create-time role dispatch, or explicit failure instead of ambiguous retargeting.

## Default Posture
- Prefer exact create and exact session-targeted send surfaces over focused surfaces.
- Treat the first custom-agent message in a new Local chat as a transport bootstrap, not as proof that every later follow-up should repeat agent selection.
- Treat focused-send as an internal fallback transport, not as a competing public LM tool route.
- On the current host, treat matching mode-backed custom-agent evidence as stronger than the generic persisted request-agent field when validating a custom-agent create result.
- Treat Local-chat LM tools as serial single-flight work against shared host state; do not intentionally overlap create, list, inspect, reveal, send, close, or delete operations.

## Core Rules
- For a new Local chat with a custom agent, prefer `create_live_agent_chat` and expect the host to use a direct agent-open route when available, with `/aa` prompt-file dispatch only as bounded fallback.
- Do not rely on `create_live_agent_chat` with `partialQuery: true` as an exact bootstrap on the current host; it can open an editor draft without yielding a persisted session id for exact follow-up.
- When the target role comes from a maintained workspace agent file, use that file's frontmatter `name` value as `agentName`; do not guess from the filename stem, a slug, or a temporary `/aa-live-chat-...` transport name.
- If the authoritative agent name has not been read yet, inspect the maintained agent file or other maintained source first and only then call `create_live_agent_chat`.
- When reading the create result, prefer `selection.agent`, session `mode`, session `agent`, and session `model` over `Persisted Request Agent`; on this host that request-agent field can remain `github.copilot.editsAgent` even when the custom agent landed correctly.
- If a second Local-chat LM tool call is attempted while another one is still active, the intended behavior is immediate fail-fast rejection rather than queueing, background overlap, or an endless wait loop.
- If a live surface still allows overlapping Local-chat LM tool calls after the mutex fix is present in repo code, treat that as stale runtime pickup or unresolved runtime drift, not as permission to rely on parallel operation.
- After the new chat is created correctly, send ordinary follow-ups into the same exact session with `send_message_to_live_agent_chat` and omit `agentName` unless an intentional rebind is required.
- Do not repeat `agentName` on normal same-chat follow-ups just because the first message used create-time role transport.
- Treat `direct-agent-open` or `prompt-file-slash-command` as create-time transport evidence for first-message custom-agent startup, not as a reason to reopen `#agent`-prefix theories for ordinary follow-ups.
- Prefer exact session-targeted send whenever the target session id is known.
- Let `send_message_to_live_agent_chat` own same-chat continuation even when its current host transport internally falls back through reveal plus focused submit.
- If the host cannot verify the requested target or selection state, prefer explicit failure over continuing with ambiguous routing.

## Preferred Order
1. Create a new custom-agent Local chat with `create_live_agent_chat` when a fresh dedicated chat is needed.
2. Verify the created session id and requested agent outcome from the create result.
3. Continue the same thread with `send_message_to_live_agent_chat` against that exact session id.
4. Omit `agentName` on ordinary follow-ups so the same conversation continues without repeated create-time role transport artifacts.
5. Treat any focused-submit behavior on the current host as transport hidden behind `send_message_to_live_agent_chat`, not as a second public route to choose manually.

## Exact Create Procedure
1. Use `create_live_agent_chat` for new-chat startup, especially when a custom agent should own the first message.
2. Resolve the requested `agentName` from the authoritative maintained source before dispatch. When a workspace agent file exists, that means reading its frontmatter `name` rather than inferring the agent from the filename.
3. Treat a direct agent-open command as the preferred create-time route when the host exposes one; otherwise treat `/aa` prompt-file dispatch as bounded fallback.
4. Do not infer the requested agent from the temporary `/aa-live-chat-...` slash-command filename; that filename is transport scaffolding, not the authoritative agent identifier.
5. Confirm the returned session id and requested agent outcome before treating the chat as a valid target.
6. When the returned session `mode` or `selection.agent` clearly matches the requested workspace agent, treat that as the primary routing evidence even if `Persisted Request Agent` still shows the host-generic Copilot value.
7. If selection evidence is reported as unverified or mismatched, treat the probe as failed rather than silently reusing the created chat.

## Same-Chat Follow-Up Procedure
1. Use `send_message_to_live_agent_chat` with the exact session id for same-chat continuation.
2. Omit `agentName` on normal follow-ups when the chat is already in the intended role.
3. Supply `agentName` only when the goal is to deliberately rebind or switch role on an existing conversation.
4. If the send result does not clearly point to the same intended session, stop and inspect exact persisted evidence instead of continuing optimistically.

## Focused Fallback Notes
1. Focused submit still exists as an internal editor-hosted transport used by the exact-session send workflow on builds without a stronger direct exact-send command.
2. Do not treat that transport as a second public LM workflow to choose between when `send_message_to_live_agent_chat` already has the exact session id.
3. If the focused fallback cannot prove a non-ambiguous target, stop rather than implying stronger targeting than the host can prove.
4. If a task depends on same-chat continuity and the exact session id is known, keep the request on `send_message_to_live_agent_chat` instead of reopening focused-send as a separate route.

## Prompt Discipline for Same-Chat Testing
- When testing same-chat continuity, send one bounded step at a time instead of describing a whole multi-step plan in the first prompt.
- Keep the first prompt narrow, explicit, and format-bounded when you want to minimize control-thread contamination.
- Treat tool or todo leakage in the stored session as contamination of the probe, not as neutral role flavor.

## Cleanup Rules
- A disposable create/send probe should be closed after evidence has been read unless the user explicitly wants it left open.
- Use `close_visible_live_chat_tabs` before destructive cleanup when only visible UI state should be cleared.
- Use `delete_live_agent_chat_artifacts` for disposable test chats that should also be removed from disk.

## Tool Notes
- `create_live_agent_chat` is the primary new-chat surface for custom-agent startup on the current Local host.
- `send_message_to_live_agent_chat` is the primary same-chat continuation surface when the exact session id is known.
- Focused send remains an internal fallback transport and command-side mechanic, not a competing LM tool surface for same-chat continuity.
- `close_visible_live_chat_tabs` is for non-destructive tab cleanup.
- `delete_live_agent_chat_artifacts` is for exact destructive cleanup of disposable Local chats.
- When validating this workflow against repo DoD or live-pass discipline, use `../instructions/tooling-validation.instructions.md` as the maintained protocol home.