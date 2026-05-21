# Traceable Agent Compatibility Notes

This file is the maintained candidate note for future compatibility work related to traceable agent discovery.

Use it to record bounded evidence, candidate source hierarchies, and non-goals before the repo broadens the current traceable agent catalog beyond its present workspace-supported scope.

Status boundary:

- This file is a candidate-compatibility note, not the current runtime claim.
- `README.md` remains the primary current-status surface.
- The bounded traceable agent catalog is exposed from the provenance-side `list_traceable_agents` surface, not from this repo's public tool namespace.

Current bounded claim:

- The current traceable catalog enumerates workspace `.github/agents/*.agent.md` artifacts that the repo's own traceable runtime can resolve truthfully today.
- The current tooling does not claim the same agent list as the native Copilot Chat dropdown.
- The current tooling does not depend on proposed customization-provider APIs.

External compatibility reading, current best read:

- Recent code reading suggests the active custom-agent discovery implementation now primarily lives in `microsoft/vscode`, not in the older `microsoft/vscode-copilot-chat` repo.
- The strongest discovered owners were:
  - `src/vs/workbench/contrib/chat/common/promptSyntax/service/promptsServiceImpl.ts`
  - `src/vs/workbench/contrib/chat/common/promptSyntax/utils/promptFilesLocator.ts`
  - `src/vs/workbench/contrib/chat/common/promptSyntax/config/promptFileLocations.ts`
  - `src/vs/workbench/contrib/chat/browser/aiCustomization/promptsServiceCustomizationItemProvider.ts`
  - `src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostLocalCustomizations.ts`
  - `src/vs/platform/agentHost/node/copilot/sessionCustomizationDiscovery.ts`
- Candidate native source folders appeared broader than this repo's current bounded scope, including:
  - workspace `.github/agents`
  - workspace `.claude/agents`
  - user `~/.copilot/agents`
  - user `~/.claude/agents`
- A stable public API that returns "the same agent list as the native dropdown" was not identified in that reading.
- A proposed API surface exists around chat session customization providers, but proposed API is not treated as a stable dependency for this repo.

Compatibility policy for this repo:

- Do not silently broaden the current traceable catalog and then imply stronger native parity than the repo can prove.
- Treat future source broadening as explicit compatibility work, not as a quiet correction to the current bounded claim.
- Prefer source hierarchies and display-label derivation that stay recoverable if VS Code later exposes a stable public listing API.
- One truth should have one primary home: if broader compatibility becomes a maintained runtime claim, update `README.md`, tool descriptions, tests, and this file together.

Candidate next broadening order, if future evidence remains good enough:

1. Keep workspace `.github/agents/*.agent.md` as the stable base.
2. Evaluate optional compatibility scanning for workspace `.claude/agents/*.agent.md`.
3. Evaluate optional compatibility scanning for user `~/.copilot/agents/*.agent.md`.
4. Evaluate optional compatibility scanning for user `~/.claude/agents/*.agent.md`.
5. Treat agent-host- or harness-specific surfaces as separate compatibility work rather than assuming normal dropdown parity.

Promotion bar before any runtime broadening:

- The new source must be supported by concrete code reading or a stable public API, not only by docs or informal expectation.
- The repo must be able to explain the truth boundary in one sentence inside `README.md` and tool descriptions.
- The repo must preserve recoverability when a role is unresolved, ambiguous, or discoverable on one source but not another.
- Focused tests should cover the added source hierarchy or clearly state why only host validation can cover it.
- If the host surface still lacks a stable public list API, the repo must keep saying that its compatibility layer is bounded and may lag native internal behavior.

Open questions:

- Exact fallback order for display-name derivation between frontmatter, clean filename, and provider-contributed metadata is not yet fully proven from source.
- Plain `.md` custom-agent compatibility was mentioned in some external reading, but `.agent.md` remained the strongest code-level evidence. Do not broaden file matching on that point without better proof.
- The current repo has not yet decided whether user-scope enumeration belongs in the traceable runtime at all, even if native Copilot supports it internally.