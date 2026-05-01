# Transcript Emitter Regression 1

Support-only benchmark brief. Read this file as the exact regression request for one bounded transcript check, not as a general introduction to the exporter work.
Use the paired best-outcome file only together with this brief.

Read only these stored artifact surfaces:
- /home/olle/.config/Code/User/workspaceStorage/d487631e52da2c1996fc16097a974dc8/GitHub.copilot-chat/chat-session-resources/86388876-6ce5-4e77-8178-607f0810a0b7/call_aKxrUy6iHQYeFwiK5s7JP6x1__vscode-1775577203388/content.txt
- /home/olle/.config/Code/User/workspaceStorage/d487631e52da2c1996fc16097a974dc8/GitHub.copilot-chat/chat-session-resources/86388876-6ce5-4e77-8178-607f0810a0b7/call_YueuI41K296dtHX5WGw2D7v7__vscode-1775577203396/content.txt
- /home/olle/.config/Code/User/workspaceStorage/d487631e52da2c1996fc16097a974dc8/GitHub.copilot-chat/chat-session-resources/86388876-6ce5-4e77-8178-607f0810a0b7/call_61IMXv6oHX0MtiHjy7FgD0Iy__vscode-1775577203435/content.txt
- /home/olle/.config/Code/User/workspaceStorage/d487631e52da2c1996fc16097a974dc8/GitHub.copilot-chat/chat-session-resources/86388876-6ce5-4e77-8178-607f0810a0b7/call_TbHdvI8WzBFz6KqWxGCVEA4I__vscode-1775577203441/content.txt

Produce only the canonical Markdown evidence transcript payload.

Requested window:
- target the bounded current-chat main-thread window recoverable from the named structured live-tail extracts
- anchor on the exact user message `Ja för trodde det var det jag skulle jämföra, för tänkte att mina ögon kunde jämföra mot vscode chatten och då ställt emot outputen, så därav varför jag blev förvånad`
- include only later recoverable main-thread user messages and assistant replies through the assistant reply that follows `Kör tills du är helt nöjd innan jag granskar`
- preserve direct stored order from the named structured extracts; include `Timestamp` exactly as stored when present, but do not reorder ahead of direct stored order solely because a timestamp exists
- include `Timestamp` exactly as stored when present
- do not invent reply linkage that the artifact does not expose explicitly
- do not widen beyond the named artifacts
- do not ask questions or add narrative outside the transcript payload

If only a partial main-thread window is recoverable, emit the partial canonical transcript with explicit omissions.