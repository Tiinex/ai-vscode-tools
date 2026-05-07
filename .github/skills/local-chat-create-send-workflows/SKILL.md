---
name: local-chat-create-send-workflows
description: 'Guidance for exact Local chat create/send workflows in VS Code. Use when creating a new Local chat with a custom agent, continuing the same Local chat, or deciding between exact send and focused-send surfaces.'
user-invocable: false
---

# Local Chat Create/Send Workflows

## When to Use
- Use this skill when a task involves `create_live_agent_chat`, `send_message_to_live_agent_chat`, or `send_message_to_focused_live_chat`.
- Use it when the goal is to preserve exact target continuity for a Local chat instead of relying on loose UI focus.
- Use it when the task depends on safe same-chat follow-ups, bounded use of `/aa` prompt-file dispatch, or explicit failure instead of ambiguous retargeting.

## Default Posture
- Prefer exact create and exact session-targeted send surfaces over focused surfaces.
- Treat the first custom-agent message in a new Local chat as a transport bootstrap, not as proof that every later follow-up should repeat agent selection.
- Treat focused-send as a narrower fallback surface that is useful but weaker than exact session-targeted send.

## Core Rules
- For a new Local chat with a custom agent, prefer `create_live_agent_chat` and expect the first visible user request to land through `/aa` prompt-file dispatch.
- After the new chat is created correctly, send ordinary follow-ups into the same exact session with `send_message_to_live_agent_chat` and omit `agentName` unless an intentional rebind is required.
- Do not repeat `agentName` on normal same-chat follow-ups just because the first message used `/aa` transport.
- Treat `prompt-file-slash-command` as expected transport evidence for first-message custom-agent create, not as a reason to reopen `#agent`-prefix theories for ordinary follow-ups.
- Prefer exact session-targeted send over `send_message_to_focused_live_chat` whenever the target session id is known.
- Use `send_message_to_focused_live_chat` only when the correct Local chat is already visible and focused and there is no stronger exact-session route available.
- If the host cannot verify the requested target or selection state, prefer explicit failure over continuing with ambiguous routing.

## Preferred Order
1. Create a new custom-agent Local chat with `create_live_agent_chat` when a fresh dedicated chat is needed.
2. Verify the created session id and requested agent outcome from the create result.
3. Continue the same thread with `send_message_to_live_agent_chat` against that exact session id.
4. Omit `agentName` on ordinary follow-ups so the same conversation continues without repeated `/aa` transport artifacts.
5. Use focused-send only when exact send is unavailable and the visible target is already known-good.

## Exact Create Procedure
1. Use `create_live_agent_chat` for new-chat startup, especially when a custom agent should own the first message.
2. Treat a first visible `/aa` dispatch as the current expected transport for custom-agent create on this Local surface.
3. Confirm the returned session id and requested agent outcome before treating the chat as a valid target.
4. If selection evidence is reported as unverified or mismatched, treat the probe as failed rather than silently reusing the created chat.

## Same-Chat Follow-Up Procedure
1. Use `send_message_to_live_agent_chat` with the exact session id for same-chat continuation.
2. Omit `agentName` on normal follow-ups when the chat is already in the intended role.
3. Supply `agentName` only when the goal is to deliberately rebind or switch role on an existing conversation.
4. If the send result does not clearly point to the same intended session, stop and inspect exact persisted evidence instead of continuing optimistically.

## Focused-Send Procedure
1. Use `send_message_to_focused_live_chat` only when the correct Local chat is already visible and focused.
2. Treat focused-send as operationally useful but weaker than exact session-targeted send.
3. If focused-send cannot prove a non-ambiguous target, stop rather than implying stronger targeting than the host can prove.
4. If a task depends on same-chat continuity and the exact session id is known, step back to `send_message_to_live_agent_chat` instead of normalizing focused-send.

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
- `send_message_to_focused_live_chat` is a fallback surface, not the default proof-bearing route for same-chat continuity.
- `close_visible_live_chat_tabs` is for non-destructive tab cleanup.
- `delete_live_agent_chat_artifacts` is for exact destructive cleanup of disposable Local chats.