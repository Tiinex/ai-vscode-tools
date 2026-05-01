# Transcript Emitter Grouped Record Micro Regression

Support-only benchmark brief. Read this file as the exact regression request for one narrow grouped-record check, not as a general transcript guide.
Use the paired best-outcome file only together with this brief.

Read only these stored artifact surfaces:
- /home/olle/.config/Code/User/workspaceStorage/d487631e52da2c1996fc16097a974dc8/GitHub.copilot-chat/chat-session-resources/86388876-6ce5-4e77-8178-607f0810a0b7/call_TbHdvI8WzBFz6KqWxGCVEA4I__vscode-1775577203441/content.txt
- /home/olle/.config/Code/User/workspaceStorage/d487631e52da2c1996fc16097a974dc8/GitHub.copilot-chat/chat-session-resources/86388876-6ce5-4e77-8178-607f0810a0b7/call_8bsqp4XpJI6nbSaIolO28NWX__vscode-1775577203444/content.txt

Produce only the canonical Markdown evidence transcript payload.

Requested window:
- target the bounded main-thread slice recoverable from grouped records with local provenance around `tail_line` 101 through 114
- anchor on the exact user message `Då kan du fortsätta försöka ta reda på det`
- include later recoverable main-thread user messages and assistant replies through the user message `Då når du slutmålet så nära du kan innan jag granskar`
- preserve direct stored order by local `tail_line`
- emit one block per recoverable user or assistant payload string from the grouped records
- if one grouped record repeats the same recoverable string twice without finer provenance, emit it once for that record
- ignore embedded transcript bodies, context wrappers, and terminal commentary when the same local request-slot family exposes direct chat payload strings
- keep missing final replies explicit in `## Omissions / Limits` when only response markers are present
- do not widen beyond the named artifacts
- do not ask questions or add narrative outside the transcript payload

If only a partial main-thread slice is recoverable, emit the partial canonical transcript with explicit omissions.