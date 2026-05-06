# Tiinex — AI — VS Code — Tools

- Canonical GitHub repo: https://github.com/Tiinex/ai-vscode-tools
- Companion AI repo this tooling primarily supports: https://github.com/Tiinex/ai

![Tiinex — AI — VS Code — Tools — logo](assets/logo.png)

Tiinex — AI — VS Code — Tools is a VS Code extension for persisted Local chat inspection, exact-target cleanup, and recovery-oriented Copilot debugging. It is built for people who need to understand what actually happened in Local chat state, recover from drift or compaction, and perform bounded operational actions without guessing.

For everyday users, that means fast inspection and safer cleanup. For VS Code Copilot developers and developers targeting other IDEs, it also means there is a concrete, portable model here for how to separate persisted evidence, live-session operations, and offline cleanup.

In practice, this tooling is primarily used to support the companion `ai` repo at https://github.com/Tiinex/ai. You can still use it independently for Local chat inspection and recovery work, but if you found it through the Marketplace and want the broader project context, start there as well.

## Why Install It

- It makes stored Local chat state inspectable instead of opaque.
- It prefers bounded evidence surfaces such as snapshot, transcript, index, profile, and context estimate over raw JSONL spelunking.
- It exposes exact-target cleanup workflows for Local chats instead of broad keep-list pruning.
- It keeps the user-facing surface branded and unambiguous in VS Code with a Tiinex-prefixed command palette group and a Tiinex settings namespace.

## What It Exposes In VS Code

Public VS Code surface:

- Display name: `Tiinex AI VS Code Tooling`
- Command Palette prefix: `Tiinex:`
- Command ID namespace: `tiinex.aiVscodeTooling.*`
- Settings namespace: `tiinex.aiVscodeTooling.*`
- Explorer view ID: `tiinex.aiVscodeTooling.sessions`
- Explorer view name: `Tiinex Sessions`
- Dev MCP alias in this repo: `tiinexAiVscodeTooling`

Naming policy:

- Human-facing VS Code surfaces use the Tiinex brand explicitly.
- Machine-facing LM tool identifiers remain stable descriptive snake_case names such as `list_live_agent_chats` and `export_agent_session_markdown` so automation and cross-IDE ports do not have to chase cosmetic renames.
- If you port this tooling to another IDE, keep the user-facing shell branded and the machine-facing tool identifiers predictable.

Core commands:

- `Tiinex: Refresh Sessions`
- `Tiinex: Open Latest Snapshot`
- `Tiinex: Open Latest Evidence Transcript`
- `Tiinex: Open Latest Context Estimate`
- `Tiinex: Open Latest Profile`
- `Tiinex: Open Session Snapshot`
- `Tiinex: Open Session Index`
- `Tiinex: Open Session Evidence Transcript`
- `Tiinex: Open Session Context Estimate`
- `Tiinex: Open Session Profile`
- `Tiinex: Open Raw Session File (Last Resort)`
- `Tiinex: List Local Chats`
- `Tiinex: Reveal Local Chat`
- `Tiinex: Close Visible Local Chat Tabs`
- `Tiinex: Delete Local Chat Artifacts`
- `Tiinex: Schedule Offline Local Chat Cleanup`
- `Tiinex: Create Disposable Local Delete Probe`
- `Tiinex: Create Local Chat`
- `Tiinex: Send Message To Local Chat`
- `Tiinex: Send Message To Focused Local Chat`

Core settings:

- `tiinex.aiVscodeTooling.showSessionsView`
- `tiinex.aiVscodeTooling.sessionDiscoveryScope`
- `tiinex.aiVscodeTooling.postCreateTimeoutMs`
- `tiinex.aiVscodeTooling.waitForPersistedDefault`

## Product Shape

This repo is not an agent-authoring framework and it does not claim a broad automation platform. Its job is narrower and more useful than that:

- inspect persisted Local chat artifacts
- render bounded recovery views from those artifacts
- bridge into exact live-chat operations when the host can support them safely
- queue exact offline cleanup when destructive work should happen only after VS Code exits

The shipped surface is intentionally Local-first. Persisted-session inspection is the strongest supported lane. Live Local chat actions are bounded operational tools, not a claim of perfect live-chat control.

## Portability For VS Code Copilot Developers And Other IDE Teams

If you want to support similar tooling in another IDE, the important thing is not the VS Code shell integration by itself. The important thing is the split of responsibilities.

Portable architecture:

- Persisted evidence layer: discover session artifacts, parse them, and render bounded inspection outputs.
- Live targeting layer: reveal, send, close, or delete only when the host can prove the target well enough.
- Offline cleanup layer: queue exact session targets and exact artifact paths, then consume that queue after the host exits.
- Recovery UX layer: keep raw session files as a last resort and prefer safer, bounded views first.

VS Code-specific parts in this repo:

- Command Palette command contributions
- Explorer view contribution and menu wiring
- VS Code configuration contribution and `setContext` usage
- VS Code chat/editor tab focus and reveal commands

IDE-portable parts in this repo:

- session discovery and session summarization
- transcript, snapshot, index, profile, and context-estimate rendering
- exact-target offline cleanup request modeling
- offline cleanup queue consumption and state pruning
- Local session artifact deletion rules

Minimum porting contract:

This repo does not yet publish a standalone SDK package for ports. The closest real contract today is the reference shape already present in code. If you want equivalent tooling in another IDE, implement an equivalent split even if the exact type names or host APIs differ.

```ts
type SessionDescriptor = {
	sessionId: string;
	title?: string;
	jsonlPath: string;
	workspaceStorageDir: string;
	mtime: number;
	size: number;
};

type SessionTarget = {
	storageRoots?: string[];
	latest?: boolean;
	sessionId?: string;
	sessionFile?: string;
	includeNoise?: boolean;
	detailLevel?: "summary" | "full";
	anchorText?: string;
	anchorOccurrence?: "first" | "last";
	afterLatestCompact?: boolean;
	maxBlocks?: number;
	latestRequestFamilies?: number;
	maxChars?: number;
};

interface PersistedEvidenceAdapter {
	discoverSessions(storageRoots?: string[]): Promise<SessionDescriptor[]>;
	renderSnapshot(target: SessionTarget): Promise<string>;
	renderIndex(target: SessionTarget, tail?: number): Promise<string>;
	renderTranscriptEvidence(target: SessionTarget): Promise<string>;
	renderContextEstimate(target: SessionTarget): Promise<string>;
	renderProfile(target: SessionTarget): Promise<string>;
}

interface ExactCleanupRequest {
	workspaceStorageDir: string;
	targetSessionIds: string[];
	artifactPaths: string[];
}

interface LiveCommandResult {
	ok: boolean;
	reason?: string;
}

interface LiveChatAdapter {
	listChats(): Promise<unknown[]>;
	revealChat(sessionId: string): Promise<LiveCommandResult>;
	closeVisibleTabs(sessionId: string): Promise<LiveCommandResult>;
	deleteChat(sessionId: string): Promise<LiveCommandResult>;
	createChat?(request: unknown): Promise<LiveCommandResult>;
	sendMessage?(request: unknown): Promise<LiveCommandResult>;
	sendFocusedMessage?(request: unknown): Promise<LiveCommandResult>;
}
```

How to read that contract:

- Required baseline: persisted evidence discovery plus bounded renderers for snapshot, index, transcript evidence, context estimate, and profile.
- Required delete safety: destructive cleanup must carry both explicit `targetSessionIds` and explicit `artifactPaths`; titles, fuzzy matching, and broad keep-lists are not enough.
- Host-sensitive layer: live create, send, reveal, and focus flows belong behind a separate adapter and may be weaker than the evidence layer without invalidating the port.
- Required UX shape: raw session files may exist as a last resort, but bounded inspection views should remain the default recovery surface.

Current code anchors for that split:

- `src/coreAdapter.ts` carries the persisted evidence adapter shape.
- `src/chatInterop/types.ts` carries the live-chat interop shape.
- `src/offlineLocalChatCleanup.ts` carries the exact-target offline cleanup request shape.

Practical porting guidance:

- Start from the persisted evidence surfaces, not from live send/reveal automation.
- Preserve explicit target IDs and explicit artifact paths in destructive flows.
- Keep command and settings namespaces product-branded so the host surface cannot be mistaken for generic tooling.
- Treat host-specific UI automation as an adapter, not as the core product.

## Tooling Status

Each platform lane below is tracked as a checklist.

- `Use Case` defines the behavior that must be trusted.
- `Unit Test` records automated coverage that exercises or guards that behavior.
- `Manual Test` records host-level validation where runtime behavior still matters.
- `Skill` records whether a role-facing skill or usage file exists for that lane.
- `Skill Test` records whether that skill guidance has been validated against current tooling behavior.

- Persisted session inspection
	- Windows
		- [x] Use Case: bounded inspection lanes are the intended default, and raw session files remain last resort only.
		- [x] Unit Test: `manifest` passes.
		- [x] Unit Test: `routing-guard` passes.
		- [ ] Manual Test: host-level inspection flow is revalidated against the current Windows surface.
		- [ ] Skill: role-facing guidance exists for persisted session inspection.
		- [ ] Skill Test: persisted session inspection guidance has been validated against current tooling behavior.

- Disposable local delete probes
	- Windows
		- [x] Use Case: disposable probe creation goes through the extension-hosted path instead of a shell fallback.
		- [x] Unit Test: `disposable-delete-probe` passes.
		- [x] Manual Test: host validation confirmed disposable probe creation through the extension-hosted path instead of a shell fallback.
		- [ ] Skill: role-facing guidance exists for disposable local delete probes.
		- [ ] Skill Test: disposable local delete probe guidance has been validated against current tooling behavior.

- Exact local chat delete targeting
	- Windows
		- [x] Use Case: disposable target chats can be removed without wiping the active working chat.
		- [x] Unit Test: `delete-chat-safety` passes.
		- [x] Unit Test: `editor-tab-matcher` passes.
		- [x] Unit Test: `self-target-guard` passes.
		- [x] Manual Test: host validation confirmed that disposable target chats could be removed without wiping the active working chat.
		- [ ] Skill: role-facing guidance exists for exact local chat delete targeting.
		- [ ] Skill Test: exact local chat delete targeting guidance has been validated against current tooling behavior.

- Exact offline local chat cleanup
	- Windows
		- [x] Use Case: queued exact-target cleanup survives a real VS Code exit and restart on the primary Windows surface.
		- [x] Unit Test: `offline-local-chat-cleanup` passes.
		- [x] Manual Test: host validation confirmed queued exact-target cleanup across a real VS Code exit and restart on the primary Windows surface.
		- [ ] Skill: role-facing guidance exists for exact offline local chat cleanup.
		- [ ] Skill Test: exact offline local chat cleanup guidance has been validated against current tooling behavior.

- Exact live-chat create and send
	- Windows
		- [ ] Use Case: create chat opens a new Local chat with the requested prompt on the current Windows host.
		- [ ] Use Case: requested agent selection is preserved or explicitly reported as unverified on the current Windows host.
		- [ ] Use Case: follow-up send reaches the intended Local chat session without retarget drift on the current Windows host.
		- [ ] Unit Test: `create-chat-direct-agent-command` passes as an approved reliability gate rather than only existing and being exercised.
		- [ ] Unit Test: `stabilized-create-workflow` passes as an approved reliability gate rather than only existing and being exercised.
		- [ ] Unit Test: `session-send-workflow` passes as an approved reliability gate rather than only existing and being exercised.
		- [ ] Manual Test: create-and-send flow is revalidated end-to-end on the current Windows host.
		- [ ] Skill: role-facing guidance exists for exact live-chat create and send.
		- [ ] Skill Test: exact live-chat create and send guidance has been validated against current tooling behavior.

- Focused live-chat send
	- Windows
		- [ ] Use Case: focused send reaches the intended visible Local chat without silently targeting the wrong thread.
		- [ ] Use Case: focused send reports unverified or blocked selection state instead of implying stronger targeting than the host can prove.
		- [ ] Unit Test: `focused-send` passes as an approved reliability gate rather than only existing and being exercised.
		- [ ] Manual Test: focused-send behavior is revalidated on the current Windows host.
		- [ ] Skill: role-facing guidance exists for focused live-chat send.
		- [ ] Skill Test: focused live-chat send guidance has been validated against current tooling behavior.

## Known Limits

- Cross-platform parity is not claimed yet.
- Cross-surface parity between VS Code commands, LM tools, MCP, CLI, and older workflow lanes is not claimed.
- The current scheduled offline cleanup chain is still Windows-oriented in practice because it is launched as a detached local runtime after VS Code exits.
- Bounded inspection surfaces should be preferred over opening raw session JSONL directly.

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

Then reload VS Code and search for `Tiinex:` in the Command Palette.

## License

This project is distributed under the Apache License 2.0.

- [LICENSE](LICENSE)
- [NOTICE](NOTICE)
