# Transcript Emitter Regression 2

Support-only benchmark brief. Read this file as the exact regression request for one bounded transcript check, not as a general introduction to the exporter work.
Use the paired best-outcome file only together with this brief.

Read only these stored artifact surfaces:
- /home/olle/.config/Code/User/workspaceStorage/d487631e52da2c1996fc16097a974dc8/GitHub.copilot-chat/chat-session-resources/86388876-6ce5-4e77-8178-607f0810a0b7/call_61IMXv6oHX0MtiHjy7FgD0Iy__vscode-1775577203435/content.txt
- /home/olle/.config/Code/User/workspaceStorage/d487631e52da2c1996fc16097a974dc8/GitHub.copilot-chat/chat-session-resources/86388876-6ce5-4e77-8178-607f0810a0b7/call_TbHdvI8WzBFz6KqWxGCVEA4I__vscode-1775577203441/content.txt
- /home/olle/.config/Code/User/workspaceStorage/d487631e52da2c1996fc16097a974dc8/GitHub.copilot-chat/chat-session-resources/86388876-6ce5-4e77-8178-607f0810a0b7/call_8bsqp4XpJI6nbSaIolO28NWX__vscode-1775577203444/content.txt

Produce only the canonical Markdown evidence transcript payload.

Requested window:
- target the bounded late current-chat main-thread window recoverable from the named structured live-tail extracts
- anchor on the exact user message `Då återstår det bara att göra det komplett`
- include only later recoverable main-thread user messages and assistant replies through the user message `Då når du slutmålet så nära du kan innan jag granskar`
- keep missing replies explicit when the named extracts expose only response markers without recoverable response text
- preserve verbatim payload even when a recoverable assistant reply contains its own earlier diagnostic wording
- preserve direct stored order from the named structured extracts; include `Timestamp` exactly as stored when present, but do not reorder ahead of direct stored order solely because a timestamp exists
- do not invent reply linkage that the artifact does not expose explicitly
- do not widen beyond the named artifacts
- do not ask questions or add narrative outside the transcript payload

If only a partial main-thread window is recoverable, emit the partial canonical transcript with explicit omissions.