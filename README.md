# Tiinex AI VS Code Tools

Canonical GitHub repo: https://github.com/Tiinex/ai-vscode-tools

![AI Recovery Tooling logo](assets/logo.png)

AI Recovery Tooling is the current VS Code extension inside this repo. It provides persisted Local chat inspection and bounded recovery work when chat state has drifted, compacted, reset, or become operationally unclear.

This is a tooling repo. It is not an agent-authoring framework and it does not claim a broad Agent Architect product surface.

## What It Does

- Lists stored Local chat sessions from the current workspace or all local workspaceStorage roots.
- Opens snapshots, tail indexes, context estimates, profiles, transcript evidence, and a last-resort raw session file view.
- Reveals, closes, deletes, or schedules offline cleanup for matching Local chat artifacts.
- Creates a Local chat and sends bounded follow-up messages to a selected or focused Local chat.

## Why It Exists

When Local chat continuity becomes unreliable, the missing piece is usually not more chat guesswork. It is a fast way to recover the right session evidence from persisted artifacts and take a small next action from that evidence.

AI Recovery Tooling is built for that narrower job.

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

- `AI Recovery Tooling: Refresh Sessions`
- `AI Recovery Tooling: Open Latest Snapshot`
- `AI Recovery Tooling: Open Latest Evidence Transcript`
- `AI Recovery Tooling: Open Latest Context Estimate`
- `AI Recovery Tooling: Open Latest Profile`
- `AI Recovery Tooling: Open Session Snapshot`
- `AI Recovery Tooling: Open Session Index`
- `AI Recovery Tooling: Open Session Evidence Transcript`
- `AI Recovery Tooling: Open Session Context Estimate`
- `AI Recovery Tooling: Open Session Profile`
- `AI Recovery Tooling: Open Raw Session File (Last Resort)`

Local chat recovery:

- `AI Recovery Tooling: List Local Chats`
- `AI Recovery Tooling: Reveal Local Chat`
- `AI Recovery Tooling: Close Visible Local Chat Tabs`
- `AI Recovery Tooling: Delete Local Chat Artifacts`
- `AI Recovery Tooling: Schedule Offline Local Chat Cleanup`
- `AI Recovery Tooling: Create Local Chat`
- `AI Recovery Tooling: Send Message To Local Chat`
- `AI Recovery Tooling: Send Message To Focused Local Chat`

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

On Windows, load the checkout into the main VS Code host with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/ensure-main-host-link.ps1
```

That script also repairs leftover `local.agent-architect-tools` registry metadata in `.vscode\extensions\extensions.json` from the old extension name.

Then reload VS Code and search for `AI Recovery Tooling:` in the Command Palette.

## License

This project is distributed under the Apache License 2.0.

- [LICENSE](LICENSE)
- [NOTICE](NOTICE)
