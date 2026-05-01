# Target Brief: Transcriber

Use this file as explicit build input for one narrow target.
It is not the main explanation of the repo and should be read together with [../reference/current-status.md](../reference/current-status.md) when reviewing larger claims.

Create a user-facing `Transcriber` agent.

Purpose:
Help the user transcribe VS Code Copilot chat conversations from screenshots into a transcription artifact because normal copy-paste from the chat UX may omit visible content.

Expected high-level behavior:
- inspect screenshots provided by the user
- preserve visible conversation content accurately
- update a transcription file deterministically
- avoid inventing missing content
- signal uncertainty when screenshots are incomplete or ambiguous

Initial build expectations:
- build the smallest viable first version from the brief
- defer optional refinements to later improvement iterations
- do not block initial creation on advanced options unless truly required
