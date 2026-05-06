# Tiinex — AI — VS Code — Tools

Canonical GitHub repo: https://github.com/Tiinex/ai-vscode-tools

![AI VS Code Tooling logo](assets/logo.png)

AI VS Code Tooling is the current VS Code extension inside this repo. It provides persisted Local chat inspection and bounded recovery work when chat state has drifted, compacted, reset, or become operationally unclear.

This is a tooling repo. It is not an agent-authoring framework and it does not claim a broad Agent Architect product surface.

## What It Does

- Lists stored Local chat sessions from the current workspace or all local workspaceStorage roots.
- Opens snapshots, tail indexes, context estimates, profiles, transcript evidence, and a last-resort raw session file view.
- Reveals, closes, deletes, or schedules offline cleanup for matching Local chat artifacts.
- Scheduled offline cleanup now queues exact session targets, deletes the queued Local chat artifacts offline, and merges multiple pending cleanup requests after VS Code fully exits instead of pruning by a broad inverse keep-list.
- Creates a Local chat and sends bounded follow-up messages to a selected or focused Local chat.

## Why It Exists

When Local chat continuity becomes unreliable, the missing piece is usually not more chat guesswork. It is a fast way to recover the right session evidence from persisted artifacts and take a small next action from that evidence.

AI VS Code Tooling is built for that narrower job.

## Known Limits

- The shipped surface is intentionally Local-first.
- Persisted-session inspection is the strongest supported lane.
- Bounded inspection surfaces should be preferred over opening raw session JSONL directly.
- Live Local chat actions exist, but they are bounded operational tools, not a claim of perfect live-chat control.
- Cross-platform parity is not claimed.
- Cross-surface parity between Local, MCP, CLI, and older workflow lanes is not claimed.
- Internal command, setting, and view ids now use the `aiRecoveryTooling` namespace.

## Main Commands

Session inspection:

- `AI VS Code Tooling: Refresh Sessions`
- `AI VS Code Tooling: Open Latest Snapshot`
- `AI VS Code Tooling: Open Latest Evidence Transcript`
- `AI VS Code Tooling: Open Latest Context Estimate`
- `AI VS Code Tooling: Open Latest Profile`
- `AI VS Code Tooling: Open Session Snapshot`
- `AI VS Code Tooling: Open Session Index`
- `AI VS Code Tooling: Open Session Evidence Transcript`
- `AI VS Code Tooling: Open Session Context Estimate`
- `AI VS Code Tooling: Open Session Profile`
- `AI VS Code Tooling: Open Raw Session File (Last Resort)`

Local chat recovery:

- `AI VS Code Tooling: List Local Chats`
- `AI VS Code Tooling: Reveal Local Chat`
- `AI VS Code Tooling: Close Visible Local Chat Tabs`
- `AI VS Code Tooling: Delete Local Chat Artifacts`
- `AI VS Code Tooling: Schedule Offline Local Chat Cleanup`
- `AI VS Code Tooling: Create Local Chat`
- `AI VS Code Tooling: Send Message To Local Chat`
- `AI VS Code Tooling: Send Message To Focused Local Chat`

## Recovery Sessions View

Enable the `Recovery Sessions` Explorer view if you want to browse stored sessions and launch the same inspection or recovery actions from a context menu.

## Build From Source

Requirements:

- VS Code 1.99 or newer
- Node.js 20 or newer

From the repo root:

```bash
npm install
npm run test
```

On Windows, link the local checkout into the main VS Code host for development with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ensure-windows-main-host-dev-extension-link.ps1
```

That Windows-only dev bootstrap script also repairs leftover `local.ai-vscode-recovery-tooling` and `local.agent-architect-tools` registry metadata in `.vscode\extensions\extensions.json` from older extension identities.

Then reload VS Code and search for `AI VS Code Tooling:` in the Command Palette.

## License

This project is distributed under the Apache License 2.0.

- [LICENSE](LICENSE)
- [NOTICE](NOTICE)
