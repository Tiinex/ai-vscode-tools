---
name: local-chat-delete-workflows
description: 'Guidance for disposable local delete probes, exact local chat delete targeting, and exact offline local chat cleanup in VS Code Local chat workflows. Use when creating a disposable probe, deleting a disposable Local chat by exact session id, or queueing exact offline cleanup after VS Code exit.'
user-invocable: false
---

# Local Chat Delete Workflows

## When to Use
- Use this skill when a Local chat cleanup task involves a disposable probe chat, exact local chat deletion, or exact offline cleanup.
- Use it when a chat should be deleted safely without touching the current working chat or any long-lived development thread.
- Use it when a ghost chat or stale UI row needs to be traced back to exact persisted artifacts instead of handled with broad guesses.

## Safety Rules
- Treat the current working chat, Co-Designer chats, and any long-lived development chat as non-disposable unless they were explicitly created as a disposable test target.
- For destructive delete, require the full exact session id. Do not use prefix ids for deletion.
- If target classification is unclear, create a fresh disposable probe instead of reusing an existing chat.
- Prefer direct delete for disposable probes that can be safely targeted now. Use offline cleanup only when the direct path is blocked by a real host boundary.
- If delete reports title-only tab matches, stop and keep targeting exact session resources. Do not widen the target set.

## Preferred Order
1. Create a disposable probe through `create_disposable_local_delete_probe` when a safe disposable target does not already exist.
2. Confirm the exact target session id through `list_live_agent_chats` before destructive cleanup.
3. Delete the exact disposable target through `delete_live_agent_chat_artifacts` when the live path is safely available.
4. Use `schedule_offline_live_agent_chat_cleanup` only when the exact target is correct but a real host/runtime boundary prevents safe direct deletion.
5. Use `close_visible_live_chat_tabs` for non-destructive tab cleanup when the goal is only to clear visible editor state.

## Disposable Probe Procedure
1. Create a new disposable probe with `create_disposable_local_delete_probe`.
2. Record the returned exact session id.
3. Use that returned exact session id as the only destructive target for the cleanup step.
4. Delete the probe promptly after the validation step is complete.

## Exact Live Delete Procedure
1. Run `list_live_agent_chats` and identify the exact disposable target session id.
2. Confirm that the target is not the active working chat and not a non-disposable development thread.
3. Run `delete_live_agent_chat_artifacts` with the full exact session id.
4. If delete fails because exact resource-matched tabs remained visible, treat that as a real blocker rather than proof that a broader delete is safe.
5. If delete reports lingering artifact paths, stop and inspect the exact artifact paths rather than assuming the delete succeeded.

## Exact Offline Cleanup Procedure
1. Use `schedule_offline_live_agent_chat_cleanup` only with the full exact session id.
2. Treat the queued cleanup as exact-targeted artifact pruning, not as a broad keep-list sweep.
3. After VS Code exits and restarts, confirm that the target session no longer appears in persisted storage or live chat listings.
4. If a stale UI row remains, inspect exact workspaceStorage artifacts before assuming a generic refresh problem.

## Ghost Chat Triage
- A stale UI row can come from a leftover `chatEditingSessions/<sessionId>/` artifact or a lingering workspace state entry rather than a still-live chat.
- If `list_live_agent_chats` no longer shows the target, inspect exact persisted artifacts before doing anything destructive to unrelated chats.
- When the exact prune path removes the leftover artifact and the row disappears immediately, treat the issue as persisted state residue rather than a broad UI-cache problem.

## Tool Notes
- `create_disposable_local_delete_probe` is the preferred creation surface for disposable Local delete probes.
- `delete_live_agent_chat_artifacts` is destructive and requires an exact session id.
- `close_visible_live_chat_tabs` may accept an exact or prefix id, but that flexibility does not carry over to destructive delete.
- `reveal_live_agent_chat` is for reopening or inspecting a known target, not for guessing which chat is safe to delete.