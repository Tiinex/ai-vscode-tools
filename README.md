# Tiinex — AI — VS Code — Tools

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

- Canonical GitHub repo: https://github.com/Tiinex/ai-vscode-tools
- Companion AI repo these tools primarily support: https://github.com/Tiinex/ai

Tiinex — AI — VS Code — Tools is a VS Code extension for persisted Local chat inspection, exact-target cleanup, and recovery-oriented Copilot debugging. It is built for people who need to understand what actually happened in Local chat state, recover from drift or compaction, and perform bounded operational actions without guessing.

For everyday users, that means fast inspection and safer cleanup. For VS Code Copilot developers and developers targeting other IDEs, it also means there is a concrete, portable model here for how to separate persisted evidence, live-session operations, and offline cleanup.

In practice, these tools are primarily used to support the companion `ai` repo at https://github.com/Tiinex/ai. You can still use them independently for Local chat inspection and recovery work, but if you want the broader project context, start there as well.

## Current Status

As of May 2026, the persisted inspection and cleanup lanes are in active use and the focused repo checks pass, but the live Local chat tooling is not yet fully end-to-end validated on the current runtime surface. Treat the live tooling as in progress rather than fully release-proven until that final runtime validation is complete.

An experimental `run_traceable_subagent` LM tool is now included for a bounded trace-first child lane. It is intentionally v1: it keeps `userInput` separate from `parentTask`, blocks self-reentry, and values explicit runtime trace over native `runSubagent` UX parity.

For `run_traceable_subagent`, prefer non-leading parent input. Treat `userInput` as source material or the original user wording to inspect, not as the desired answer shape, and do not let raw user wording outweigh the child lane's bounded investigative contract carried by `parentTask`.

As of the latest Windows host validation, `run_traceable_subagent` is now considered reliable for bounded read-only analysis work. The traceable lane has repo-test coverage plus repeated live validation for role/model grounding, fail-closed tool selection, task-file anchoring, synthesis-slot reservation, a tool-less final recovery turn, recovery-output format discipline, and anchored multi-file read-budget coverage.

What is not yet claimed for `run_traceable_subagent` is broader proof around same-lane follow-up behavior, wide non-leading multi-repo epistemic questions, or native `runSubagent` UX parity inside Copilot Chat. Treat those as open reliability-expansion work, not as already-proven guarantees.

## Why Install It

- It makes stored Local chat state inspectable instead of opaque.
- It prefers bounded evidence surfaces such as snapshot, transcript, index, profile, and context estimate over raw JSONL spelunking.
- It exposes exact-target cleanup workflows for Local chats instead of broad keep-list pruning.
- It keeps the user-facing surface branded and unambiguous in VS Code with a Tiinex-prefixed command palette group and a Tiinex settings namespace.

## What It Exposes In VS Code

Public VS Code surface:

- Display name: `Tiinex — AI — VS Code — Tools`
- Command Palette prefix: `Tiinex:`
- Command ID namespace: `tiinex.aiVscodeTools.*`
- Settings namespace: `tiinex.aiVscodeTools.*`
- Explorer view ID: `tiinex.aiVscodeTools.sessions`
- Explorer view name: `Tiinex Sessions`
- Dev MCP alias in this repo: `tiinexAiVscodeTools`

Naming policy:

- Human-facing VS Code surfaces use the Tiinex brand explicitly.
- Machine-facing LM tool identifiers remain stable descriptive snake_case names such as `list_live_agent_chats` and `export_agent_session_markdown` so automation and cross-IDE ports do not have to chase cosmetic renames.
- If you port these tools to another IDE, keep the user-facing shell branded and the machine-facing tool identifiers predictable.

Contributed commands:

Some commands are intentionally hidden from the Command Palette and are instead surfaced through the Tiinex Sessions view or automation-facing tool surfaces.

- `Tiinex: Refresh Sessions`
- `Tiinex: Open Latest Snapshot`
- `Tiinex: Open Latest Evidence Transcript`
- `Tiinex: Open Latest Context Estimate`
- `Tiinex: Open Latest Profile`
- `Tiinex: Survey Recent Sessions`
- `Tiinex: Open Session Snapshot`
- `Tiinex: Open Session Index`
- `Tiinex: Open Session Evidence Transcript`
- `Tiinex: Open Session Context Estimate`
- `Tiinex: Open Session Profile`
- `Tiinex: Open Raw Session File (Last Resort)`

Scoped VS Code session-view actions for manual operator use include:

- `Tiinex: List Local Chats`
- `Tiinex: Reveal Local Chat`
- `Tiinex: Close Visible Local Chat Tabs`
- `Tiinex: Delete Local Chat Artifacts`
- `Tiinex: Create Local Chat`
- `Tiinex: Send Message To Local Chat`

The canonical public live-chat workflow surface is the language-model tool family such as `create_live_agent_chat`, `send_message_to_live_agent_chat`, and `reveal_live_agent_chat`.

The mirrored `tiinex.aiVscodeTools.*LiveChat*` commands are kept as Tiinex Sessions view UI affordances over the same internal service, not as peer public workflows beside the LM tools.

For agent-facing same-session live-chat workflows, prefer the language-model tools rather than these mirrored extension commands.

For bounded cross-extension host testing, use the `invoke_youtube_host_command` LM tool instead of terminal fallback when the installed YouTube extension's SecretStorage or workspace-scoped settings matter.

Core settings:

- `tiinex.aiVscodeTools.showSessionsView`
- `tiinex.aiVscodeTools.sessionDiscoveryScope`
- `tiinex.aiVscodeTools.postCreateTimeoutMs` default `900000` (15 minutes)
- `tiinex.aiVscodeTools.waitForPersistedDefault`

## Release Flow

This repo is now configured for Marketplace publication under the `tiinex` publisher.

Before packaging or publishing:

- sign in to the VS Code Marketplace with the publisher account that owns `tiinex`
- make sure `npm test` passes locally
- keep releases on semantic versioning: patch for fixes, minor for backward-compatible features, major for breaking changes

Release commands:

- `npm run release:check` runs the local release gate: tests plus VSIX packaging
- `npm run release:patch` bumps a patch release, updates `package.json`, creates a git commit, and creates the matching git tag
- `npm run release:minor` does the same for a minor release
- `npm run release:major` does the same for a major release
- `npm run package:vsix` builds and packages a local VSIX using the current manifest
- `npm run publish:vsce` publishes the current version to the Visual Studio Marketplace

VS Code task shortcuts:

- `release check ai vscode tools extension`
- `release patch ai vscode tools extension`
- `release minor ai vscode tools extension`
- `release major ai vscode tools extension`

The expected extension identifier for publication is `tiinex.ai-vscode-tools`.

Recommended release order:

- run the release-check task or `npm run release:check`
- run exactly one semantic-version task or command for the intended release size
- push the resulting commit and git tag
- publish the new version to Marketplace

## Product Shape

This repo is not an agent-authoring framework and it does not claim a broad automation platform. Its job is narrower and more useful than that:

- inspect persisted Local chat artifacts
- render bounded recovery views from those artifacts
- bridge into exact live-chat operations when the host can support them safely
- queue exact offline cleanup when destructive work should happen only after VS Code exits

The shipped surface is intentionally Local-first. Persisted-session inspection is the strongest supported lane. Live Local chat actions are bounded operational tools, not a claim of perfect live-chat control.

The experimental traceable-subagent lane is separate from the canonical Local-chat workflow. It exists for narrow grounded child investigations with explicit request contract, budget contract, and runtime tool ledger, not as a broad autonomous framework. In prompt references, use `#runTraceableSubagent`.

## Portability For VS Code Copilot Developers And Other IDE Teams

If you want to support similar tools in another IDE, the important thing is not the VS Code shell integration by itself. The important thing is the split of responsibilities.

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

This repo does not yet publish a standalone SDK package for ports. The closest real contract today is the exported adapter and request/result shape already present in code. The sketch below is therefore intentionally close to the current code shape rather than a purely conceptual pseudo-interface. If you want equivalent tools in another IDE, implement an equivalent split even if the exact type names or host APIs differ.

```ts
type RenderDetailLevel = "summary" | "full";
type AnchorOccurrence = "first" | "last";

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
	includeNoise?: boolean;
	latest?: boolean;
	sessionId?: string;
	sessionFile?: string;
	detailLevel?: RenderDetailLevel;
	maxChars?: number;
	anchorText?: string;
	anchorOccurrence?: AnchorOccurrence;
	afterLatestCompact?: boolean;
	maxBlocks?: number;
	latestRequestFamilies?: number;
};

interface PersistedEvidenceAdapter {
	discoverSessions(storageRoots?: string[]): Promise<SessionDescriptor[]>;
	renderList(limit?: number, maxChars?: number, storageRoots?: string[]): Promise<string>;
	renderTranscriptEvidence(target: SessionTarget): Promise<string>;
	renderWindow(target: SessionTarget & {
		anchorText?: string;
		anchorOccurrence?: AnchorOccurrence;
		afterLatestCompact?: boolean;
		before?: number;
		after?: number;
		maxMatches?: number;
		includeNoise?: boolean;
		maxChars?: number;
	}): Promise<string>;
	renderExport(target: SessionTarget & { includeNoise?: boolean }): Promise<string>;
	renderSnapshot(target: SessionTarget): Promise<string>;
	renderContextEstimate(target: SessionTarget): Promise<string>;
	renderProfile(target: SessionTarget): Promise<string>;
	renderIndex(target: SessionTarget, tail?: number): Promise<string>;
	renderSurvey(limit?: number, storageRoots?: string[]): Promise<string>;
}

interface ExactCleanupRequest {
	workspaceStorageDir: string;
	targetSessionIds: string[];
	artifactPaths: string[];
}

type ChatModelSelector = {
	id: string;
	vendor?: string;
};

interface CreateChatRequest {
	prompt: string;
	agentName?: string;
	mode?: string;
	modelSelector?: ChatModelSelector;
	partialQuery?: boolean;
	blockOnResponse?: boolean;
	requireSelectionEvidence?: boolean;
	waitForPersisted?: boolean;
}

interface SendChatMessageRequest extends CreateChatRequest {
	sessionId: string;
}

interface ChatSessionSummary {
	id: string;
	title: string;
	lastUpdated: string;
	mode?: string;
	agent?: string;
	requestAgentId?: string;
	requestAgentName?: string;
	model?: string;
	archived: boolean;
	provider: "workspaceStorage" | "emptyWindow";
	sessionFile: string;
}

interface ChatCommandResult {
	ok: boolean;
	reason?: string;
	session?: ChatSessionSummary;
	sessions?: ChatSessionSummary[];
}

interface LiveChatAdapter {
	listChats(): Promise<ChatSessionSummary[]>;
	revealChat(sessionId: string): Promise<ChatCommandResult>;
	closeVisibleTabs(sessionId: string): Promise<ChatCommandResult>;
	deleteChat(sessionId: string): Promise<ChatCommandResult>;
	createChat(request: CreateChatRequest): Promise<ChatCommandResult>;
	sendMessage(request: SendChatMessageRequest): Promise<ChatCommandResult>;
	sendFocusedMessage(request: CreateChatRequest): Promise<ChatCommandResult>;
}
```

How to read that contract:

- Required baseline: persisted evidence discovery plus bounded renderers for list, window, export, snapshot, index, transcript evidence, context estimate, profile, and survey.
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
- Keep command and settings namespaces product-branded so the host surface cannot be mistaken for generic tools.
- Treat host-specific UI automation as an adapter, not as the core product.

## Tools Checklist

Each platform lane below is tracked as a checklist.

- `Use Case` defines the behavior that must be trusted.
- `Unit Test` records automated coverage that exercises or guards that behavior.
- `Manual Test` records host-level validation where runtime behavior still matters.
- `Skill` records whether a role-facing skill or usage file exists for that lane, even when one maintained guidance file covers more than one lane.
- `Skill Test` records whether that guidance has been checked against current behavior.

- Persisted session inspection
	- Windows
		- [x] Use Case: bounded inspection lanes are the intended default, and raw session files remain last resort only.
		- [x] Unit Test: `manifest` passes.
		- [x] Unit Test: `routing-guard` passes.
		- [x] Manual Test: host-level inspection flow is revalidated against the current Windows surface.
		- [x] Skill: role-facing guidance exists for persisted session inspection.
		- [x] Skill Test: persisted session inspection guidance has been validated against current behavior.

- Exact local chat delete targeting
	- Windows
		- [x] Use Case: disposable target chats can be removed without wiping the active working chat.
		- [x] Unit Test: `delete-chat-safety` passes.
		- [x] Unit Test: `editor-tab-matcher` passes.
		- [x] Unit Test: `self-target-guard` passes.
		- [x] Manual Test: host validation confirmed that disposable target chats could be removed without wiping the active working chat.
		- [x] Skill: role-facing guidance exists for exact local chat delete targeting.
		- [x] Skill Test: exact local chat delete targeting guidance has been checked against current behavior.

- Exact offline local chat cleanup
	- Windows
		- [x] Use Case: queued exact-target cleanup survives a real VS Code exit and restart on the primary Windows surface.
		- [x] Unit Test: `offline-local-chat-cleanup` passes.
		- [x] Manual Test: host validation confirmed queued exact-target cleanup across a real VS Code exit and restart on the primary Windows surface.
		- [x] Skill: delete-workflow guidance covers exact offline local chat cleanup queueing for disposable targets.
		- [x] Skill Test: exact offline local chat cleanup guidance has been checked against current behavior.

- Exact live-chat create and send
	- Windows
		- [x] Use Case: create chat opens a new Local chat with the requested prompt on the current Windows host.
		- [x] Use Case: requested agent selection is preserved or explicitly reported as unverified on the current Windows host.
		- [x] Use Case: exact follow-up send either reaches the intended Local chat session or fails explicitly without retarget-prone fallback on the current Windows host.
		- [x] Unit Test: `create-chat-direct-agent-command` passes as an approved reliability gate rather than only existing and being exercised.
		- [x] Unit Test: `session-send-workflow` passes as an approved reliability gate rather than only existing and being exercised.
		- [x] Manual Test: host validation confirmed direct create with first visible `/aa` dispatch, verified requested agent selection, and same-chat follow-up without repeated `/aa`.
		- [x] Skill: role-facing guidance exists for exact live-chat create and send.
		- [x] Skill Test: exact live-chat create and send guidance has been checked against current behavior.

- Focused live-chat fallback transport
	- Windows
		- [x] Transport Coverage: focused-send waits for persisted mutation and settled target state instead of reporting success on optimistic dispatch alone.
		- [x] Transport Coverage: focused-send reports unverified or blocked targeting state instead of implying stronger targeting than the host can prove.
		- [x] Unit Test: `focused-send` passes as fallback-transport coverage rather than as a peer public workflow gate.
		- [x] Manual Test: host validation confirmed focused-send blocked ambiguous targeting when fallback transport coverage was exercised.
		- [x] Skill: create/send workflow guidance marks focused live-chat send as internal fallback transport rather than a second public route.
		- [x] Skill Test: focused live-chat fallback guidance has been checked against current behavior.

- Traceable subagent bounded read-only lane
	- Windows
		- [x] Use Case: bounded read-only child runs keep `userInput` separate from `parentTask`, ground against explicit task files, and fail closed when model or tool grounding is unsafe.
		- [x] Use Case: a child run that would otherwise spend its full tool budget can defer excess tool calls, preserve a synthesis slot, and still produce a final bounded payload.
		- [x] Use Case: the final regular iteration may schedule one tool-less recovery turn, and that recovery turn emits one final JSON object rather than raw tool-request text.
		- [x] Use Case: when multiple anchored task files are provided, the child lane can cover each anchored file and reach grounded completion in a live Windows probe.
		- [x] Unit Test: `traceable-subagent` passes with synthesis-reservation and final-recovery regressions in `tests/test.mjs`.
		- [x] Manual Test: host validation confirmed bounded single-file and harder multi-file read-only probes reached correct final payloads on the current Windows surface.
		- [ ] Manual Test: same-lane follow-up behavior has been explicitly validated on the current Windows surface.
		- [ ] Manual Test: a broad non-leading multi-repo epistemic question has been validated on the current Windows surface.
		- [ ] UX: Copilot Chat rendering has reached near-native `runSubagent` observability without inventing a separate custom surface.

## Traceable Subagent Roadmap

- Preserve the current bounded read-only reliability bar; do not regress fail-closed grounding, synthesis reservation, or final-recovery formatting.
- Validate one real same-lane follow-up path so the traceable lane is not only trusted for first-turn bounded probes.
- Validate one broad non-leading multi-repo epistemic question so repo-local reliability is not mistaken for wider evidence orchestration.
- Improve Copilot Chat rendering toward a more native expander experience by shaping the existing tool result surface rather than inventing a separate UI.
- Keep README status, tests, and live validation aligned so the repo does not drift into claiming more than the host has actually proved.

## Validation Protocol

- Maintained tooling validation protocol lives in `.github/instructions/tooling-validation.instructions.md`.
- Use that file for Phase 1 and Phase 2 structure, live-pass criteria, and tooling definition-of-done expectations.

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
npm run build
npm run test
```

On Windows, link the local checkout into the main VS Code host for development with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ensure-windows-main-host-dev-extension-link.ps1
```

That Windows-only dev bootstrap script also repairs the current local extension registry metadata in `.vscode\extensions\extensions.json`.

Then reload VS Code and search for `Tiinex:` in the Command Palette.

## License

This project is distributed under the Apache License 2.0.

- [LICENSE](LICENSE)
- [NOTICE](NOTICE)

## Support

If you find this work valuable and want to support its continued development: https://ko-fi.com/Tiinusen
