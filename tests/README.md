# Test Harness README

This project uses a simple local test harness in `tests/test.mjs`.
It exercises several validations around the CLI tooling and `chatInterop` modules.

This file is about the local mechanical test baseline.
If you are new to the repo or doing first-pass peer review, start with [../docs/reference/current-status.md](../docs/reference/current-status.md) and [../PEER-REVIEW.md](../PEER-REVIEW.md) before reading this file in detail.

## Run the tests

Use `npm run test` as the baseline entrypoint.
Do not treat `node tests/test.mjs` as the normal baseline path unless you are intentionally debugging the local stub behavior.

```bash
npm run test
```

## Important local assumptions

- `npm run test` runs `npm run build` first and then loads files from `dist/`.
- `npm run test` now also ensures a temporary stub at `node_modules/vscode/index.js` so `dist/` modules can be imported without an active VS Code runtime.
- That stub is a local test workaround, not a runtime artifact and not something to commit.

## Create the local `vscode` stub if needed

If you run `node tests/test.mjs` directly and bypass `npm run test`, you may still need to create the minimal stub below yourself.

Linux or macOS shell:

```bash
mkdir -p node_modules/vscode
printf "module.exports = {};\n" > node_modules/vscode/index.js
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path node_modules\vscode | Out-Null
'module.exports = {};' | Out-File -Encoding utf8 node_modules\vscode\index.js
```

## Quick troubleshooting

- If `npm run test` fails before any repo behavior is exercised, first rerun `npm run build` and confirm that `dist/` exists.
- If PowerShell blocks `npm.ps1`, rerun the baseline command with `npm.cmd`; that is a host execution-policy issue, not a repo contract failure.
- If `node tests/test.mjs` fails on a missing `vscode` module after bypassing `npm run test`, create the temporary local stub above and rerun.
- If the direct `node tests/test.mjs` path behaves differently from `npm run test`, treat `npm run test` as the canonical baseline and treat the direct path as local debugging only.

## Newer test families

- `runFocusedSendBehaviorChecks` tests blocking and non-blocking focused-send behavior.
- `runAgentArchitectProcessEvidenceChecks` reads real persisted JSON evidence packages from temporary harness files and verifies that the headless mirror of `agent-architect.process-validator` fails on missing read-after-write, missing explicit release-gate mapping results, embedded runtime support evidence, unsupported companion artifact shapes, and weak local structure PASS claims, while passing both complete PATCH evidence and canonical CREATE evidence for the current supported workspace runtime-agent contract.

Current interpretation note:

- this harness can still exercise the supported workspace runtime-agent mechanism under `.github/agents/*.agent.md` when temporary test workspaces provide those files
- that does not make the parked historical repo-owned agent pack in this checkout the active runtime authority

## CI notes

- Run `npm run build` in a separate step and verify that `dist/` exists before treating later test failures as behavior findings.
- Prefer a real mock strategy or dependency injection in CI instead of relying on a checked-in stub under `node_modules`.
- If you use the local stub workaround in a disposable environment, do not treat that as a repo artifact and do not commit it.
