---
name: local-chat-delete-workflows
description: 'Guidance for exact local chat delete targeting in VS Code Local chat workflows. Exact delete now includes queuing exact offline cleanup for the same target.'
user-invocable: false
---

# Local Chat Delete Workflows

## When to Use
- Use this skill when a Local chat cleanup task involves exact local chat deletion.
- Use it when a chat should be deleted safely without touching the current working chat or any long-lived development thread.
- Use it when a ghost chat or stale UI row needs to be traced back to exact persisted artifacts instead of handled with broad guesses.

## Safety Rules
- Treat the current working chat, Co-Designer chats, and any long-lived development chat as non-disposable unless they were explicitly created as a disposable test target.
- For destructive delete, require the full exact session id. Do not use prefix ids for deletion.
- If target classification is unclear, stop and resolve the target through exact persisted inspection or a separate approved test plan instead of improvising a new create-like tool.
- Prefer the exact delete surface for disposable targets that can be safely targeted now. That delete path already closes visible tabs, deletes persisted artifacts, and queues exact offline cleanup for the same target.
- If delete reports title-only tab matches, stop and keep targeting exact session resources. Do not widen the target set.
- Do not run live delete, live chat listing, reveal, or visible-tab cleanup in parallel with each other. Treat Local delete operations as serial single-flight work against shared host state.

## Preferred Order
1. Confirm the exact target session id through `list_live_agent_chats` or bounded persisted inspection before destructive cleanup.
2. Delete the exact disposable target through `delete_live_agent_chat_artifacts` when the live path is safely available.
3. Use `close_visible_live_chat_tabs` for non-destructive tab cleanup when the goal is only to clear visible editor state.
4. If more than one candidate remains, repeat the same flow one session at a time instead of batching delete-adjacent live tool calls.

## Exact Live Delete Procedure
1. Run `list_live_agent_chats` and identify the exact disposable target session id.
2. Confirm that the target is not the active working chat and not a non-disposable development thread.
3. Run `delete_live_agent_chat_artifacts` with the full exact session id.
4. Treat the delete result as a full cleanup lifecycle: exact tab close, direct artifact deletion, and exact offline cleanup queueing for the same target.
5. If delete reports lingering artifact paths, stop and inspect the exact artifact paths rather than assuming the delete succeeded.
4. If delete fails because exact resource-matched tabs remained visible, treat that as a real blocker rather than proof that a broader delete is safe.

## Ghost Chat Triage
- A stale UI row can come from a leftover `chatEditingSessions/<sessionId>/` artifact or a lingering workspace state entry rather than a still-live chat.
- If `list_live_agent_chats` no longer shows the target, inspect exact persisted artifacts before doing anything destructive to unrelated chats.
- When the exact prune path removes the leftover artifact and the row disappears immediately, treat the issue as persisted state residue rather than a broad UI-cache problem.

## Tool Notes
- `delete_live_agent_chat_artifacts` is destructive, requires an exact session id, and now also queues exact offline cleanup for the same target.
- `close_visible_live_chat_tabs` may accept an exact or prefix id, but that flexibility does not carry over to destructive delete.
- `reveal_live_agent_chat` is for reopening or inspecting a known target, not for guessing which chat is safe to delete.