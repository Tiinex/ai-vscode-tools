# Traceable Subagent Host Validation

This file is the maintained evidence scaffold for independent host-level validation artifacts related to `run_traceable_subagent`.

Use it when a repo-visible artifact is needed to support or replay a host-validation claim that should not live only as a README checklist item or a transition-file summary.

Status boundary:

- This file is an evidence home, not the current-status surface.
- `README.md` remains the primary current-status surface.
- Transition files may summarize what passed and what remains open, but they should not become the only durable home for replayable host-validation evidence.

Current state:

- A bounded same-file follow-up pair has been live-validated on the current Windows host.
- A bounded broad non-leading multi-repo probe has been live-validated on the current Windows host and passed its own epistemic bar.
- Repo-visible proof artifacts for those validations are now being populated here entry by entry rather than being left only as maintained status wording.

When to add an entry:

- Add an entry when a host-level validation result should be independently inspectable from the repo without relying only on README or transition summaries.
- Prefer one compact entry per validation slice rather than one long rolling narrative.
- If a validation result is still provisional, say so explicitly instead of promoting it to a stronger status label.

Preferred entry shape:

## Entry Template

- Date:
- Host surface:
- Validation slice:
- Probe or task:
- Files or runtime surfaces inspected:
- Expected pass bar:
- Observed result:
- Limits or caveats:
- Supporting artifact paths or logs:

Open gap:

- This scaffold exists so future manual Windows-host validation claims can point to a replayable evidence home rather than relying only on maintained status wording.

## Entry 2026-05-19 Broad Multi-Repo Probe

- Date: 2026-05-19
- Host surface: Windows VS Code local chat host
- Validation slice: broad non-leading multi-repo epistemic probe for `run_traceable_subagent`
- Probe or task: compare transition-plan, current-status, implementation, test, and package surfaces; separate verified implementation, still-open work, and not-yet-claimable assertions
- Files or runtime surfaces inspected:
	- `c:\Users\micro\Documents\Repos\Tiinex\ai\.github\transitions\TRACEABLE_SUBAGENT_RUNTIME_PLAN.md`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\README.md`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\src\traceableSubagent.ts`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\tests\test.mjs`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\package.json`
- Expected pass bar: child keeps verified, open, and unsupported-claim buckets separate; cites the compared surfaces by role; does not overclaim broad proof from maintained status wording alone
- Observed result: pass on the epistemic bar. The child returned `completionClaim: partial`, kept the three buckets separate, cited transition/status/implementation/test surfaces by role, and explicitly refused to treat README or transition wording as independent proof of every manual Windows-host validation step.
- Limits or caveats: this entry records the broad-probe result itself, not full independent proof of every earlier manual host-validation claim; the child result remained conservative about proof that depends only on maintained repo wording.
- Supporting artifact paths or logs:
	- `c:\Users\micro\AppData\Roaming\Code\User\workspaceStorage\d3793a5981dcc1e53c6a5b0ccdb89c35\GitHub.copilot-chat\chat-session-resources\3b540cad-8542-4094-94a4-316162aab935\call_neZen22FKlfmlLKubQzyVtLE__vscode-1779148900654\content.txt`
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`

## Entry 2026-05-19 Same-File Follow-Up Pair

- Date: 2026-05-19
- Host surface: Windows VS Code local chat host
- Validation slice: bounded same-file follow-up behavior for `run_traceable_subagent`
- Probe or task: run a two-step same-file pair where the first pass establishes concrete findings from `src/traceableSubagent.ts`, then ask a narrower follow-up that should reuse prior findings instead of restarting broad rereads or degrading into raw recovery-turn text
- Files or runtime surfaces inspected:
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\src\traceableSubagent.ts`
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`
	- current session transcript for local chat session `3b540cad-8542-4094-94a4-316162aab935`
- Expected pass bar: the second pass should reuse the carried prior-turn finding, answer the narrower question directly, avoid restarting broad rereads of the same large file, and avoid raw “read more” style recovery output
- Observed result: pass on the bounded follow-up bar. The first pass completed with one `copilot_readFile` call and returned the reservation condition, deferral note, and recovery-turn scheduling condition. The narrower second pass answered directly that the final recovery turn is intentionally blocked when any runnable tool result occurred in the last regular iteration, citing `runnableToolCallsThisIteration === 0` as the enforcing clause rather than restarting a broad reread.
- Limits or caveats: this entry records one successful same-file bounded follow-up pair on the current Windows host. It does not yet prove broader follow-up robustness across larger cross-file or cross-repo follow-up shapes.
- Supporting artifact paths or logs:
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`
	- `c:\Users\micro\AppData\Roaming\Code\User\workspaceStorage\d3793a5981dcc1e53c6a5b0ccdb89c35\chatSessions\3b540cad-8542-4094-94a4-316162aab935.jsonl`

## Entry 2026-05-19 Invocation Header Observability Probe

- Date: 2026-05-19
- Host surface: Windows VS Code local chat host
- Validation slice: collapsed invocation-header observability for `run_traceable_subagent`
- Probe or task: rerun the bounded five-file read-only traceable-subagent probe after shortening the invocation label and then again after changing the label to an action-shaped `Reading 5 files`; compare whether the collapsed running row feels more observable during execution without inventing a separate UI surface
- Files or runtime surfaces inspected:
	- current VS Code local chat rendering for the `run_traceable_subagent` tool row
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\src\languageModelTools.ts`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\tests\test.mjs`
	- supporting chat-session resource artifacts for the rerun outputs
- Expected pass bar: the collapsed running row should feel meaningfully more observable than the earlier wide label and should expose some user-perceivable sense of progress or completion while the tool is running
- Observed result: partial improvement only. Shortening the label reduced width, and the later `Reading 5 files` phrasing read more clearly as an action, but the header remained static for the full run. Human observation on the current host reported no real feeling of progress or completion from the collapsed row even when the child lane completed correctly.
- Limits or caveats: this entry records a host-observed UX limitation, not a correctness failure in the child lane itself. Current evidence suggests the remaining missing progress feel is tied to the static third-party LM-tool invocation header rather than to result correctness or fallback discipline.
- API surface note: a follow-up check against the public VS Code API found that `LanguageModelTool.prepareInvocation` returns `PreparedToolInvocation`, whose documented public fields are `invocationMessage` and optional `confirmationMessages`. No public LM-tool API surface was found for streaming later updates into that collapsed invocation header during the same tool run.
- Supporting artifact paths or logs:
	- `c:\Users\micro\AppData\Roaming\Code\User\workspaceStorage\d3793a5981dcc1e53c6a5b0ccdb89c35\GitHub.copilot-chat\chat-session-resources\3b540cad-8542-4094-94a4-316162aab935\call_m8FQ5TT9mlquTkaff8foLpQe__vscode-1779189463777\content.txt`
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`
	- `https://code.visualstudio.com/api/references/vscode-api`

## Entry 2026-05-19 Post-Fix Live Rerun

- Date: 2026-05-19
- Host surface: Windows VS Code local chat host
- Validation slice: same bounded five-file live rerun after the no-final-child-steps quick-summary fix
- Probe or task: rerun the known-good five-file read-only traceable-subagent comparison on the minimal child tool lane after the `At a Glance` adjustment, so the real chat surface can be checked for both live stability and truthful post-run summary shape
- Files or runtime surfaces inspected:
	- current VS Code local chat rendering for the completed `run_traceable_subagent` result
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\src\traceableSubagent.ts`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai\.github\transitions\TRACEABLE_SUBAGENT_RUNTIME_PLAN.md`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\README.md`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\tests\test.mjs`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\package.json`
- Expected pass bar: the minimal `allowedToolNames=["copilot_readFile"]` child lane should complete the five-file probe again without exhausting budget, and the completed result should expose a compact `At a Glance` block that truthfully summarizes the finished trace
- Observed result: pass on this rerun slice. The child lane returned `trace-supported`, `stopReason: completed`, `completionClaim: complete`, with `Completed Steps: 5/5`, `Successful Tool Calls: 5/5`, `Outstanding Gaps: 3`, and `Opaque Delegations: 0`. The earlier budget-exhausted run did not reproduce on this rerun after reload.
- Limits or caveats: this entry records one successful post-fix live rerun on the same Windows host and minimal child lane. It does not yet explain why the earlier rerun temporarily exhausted budget before producing a final payload.
- Supporting artifact paths or logs:
	- `c:\Users\micro\AppData\Roaming\Code\User\workspaceStorage\d3793a5981dcc1e53c6a5b0ccdb89c35\GitHub.copilot-chat\chat-session-resources\3b540cad-8542-4094-94a4-316162aab935\call_ArLRpg2wLfeI7khtl2RN8fpP__vscode-1779193275889\content.txt`
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`

## Entry 2026-05-19 Budget-Accounting And Final-Iteration Recovery Rerun

- Date: 2026-05-19
- Host surface: Windows VS Code local chat host
- Validation slice: bounded five-file live rerun after fixing deferred-budget accounting and last-regular-iteration synthesis reservation
- Probe or task: rerun the known-good five-file read-only traceable-subagent comparison on the minimal child tool lane after separating deferred `notRun` ledger entries from consumed tool budget and after reserving the last regular iteration for a tool-less synthesis turn when needed
- Files or runtime surfaces inspected:
	- current VS Code local chat rendering for the completed `run_traceable_subagent` result
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\src\traceableSubagent.ts`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\tests\test.mjs`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai\.github\transitions\TRACEABLE_SUBAGENT_RUNTIME_PLAN.md`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\README.md`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\package.json`
- Expected pass bar: the minimal `allowedToolNames=["copilot_readFile"]` child lane should stop exhausting budget on the same broad five-file probe and should return one explicit final payload instead of ending after a last read-only turn with no synthesis opportunity left
- Observed result: pass on this rerun slice. The child lane returned `trace-supported`, `stopReason: completed`, `completionClaim: complete`, with `Completed Steps: 6/6`, `Successful Tool Calls: 5/5`, `Outstanding Gaps: 4`, and `Opaque Delegations: 0`. The result now lands with a final bounded payload instead of repeating the earlier `budget_exhausted` no-payload outcome.
- Limits or caveats: this entry records one successful live rerun after the implementation fix on the same Windows host and minimal child lane. It does not claim that all future broad probes are immune to every host- or model-side variation.
- Supporting artifact paths or logs:
	- `c:\Users\micro\AppData\Roaming\Code\User\workspaceStorage\d3793a5981dcc1e53c6a5b0ccdb89c35\GitHub.copilot-chat\chat-session-resources\3b540cad-8542-4094-94a4-316162aab935\call_S3HfpNFnyacDBKmZu10VS8yA__vscode-1779193275911\content.txt`
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`

## Entry 2026-05-19 Observed-Scope Reload Rerun

- Date: 2026-05-19
- Host surface: Windows VS Code local chat host
- Validation slice: completed-result observability after reload, with observed read scope promoted into the renderer
- Probe or task: rerun the known-good five-file read-only traceable-subagent comparison after a VS Code reload so the newly added observed-scope result surface can be checked in the real chat UI rather than only in focused renderer tests
- Files or runtime surfaces inspected:
	- current VS Code local chat rendering for the completed `run_traceable_subagent` result
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\src\traceableSubagent.ts`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\tests\test.mjs`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai\.github\transitions\TRACEABLE_SUBAGENT_RUNTIME_PLAN.md`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\README.md`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\package.json`
- Expected pass bar: the completed result should expose concrete observed read scope near the top of the output so the receiver can see what the child actually inspected, without relying only on abstract counts or the static invocation header
- Observed result: pass on this rerun slice. The child lane returned `trace-supported`, `stopReason: completed`, `completionClaim: complete`, and the live completed result now surfaced both `Observed Read Targets: 5 unique` in `At a Glance` and an `Observed Scope` section listing the five inspected anchor files.
- Limits or caveats: this improves completed-result observability, not the still-static collapsed invocation header during tool execution. It also does not by itself prove that every recovery-turn failure mode is gone under all future host/model variations.
- Supporting artifact paths or logs:
	- `c:\Users\micro\AppData\Roaming\Code\User\workspaceStorage\d3793a5981dcc1e53c6a5b0ccdb89c35\GitHub.copilot-chat\chat-session-resources\3b540cad-8542-4094-94a4-316162aab935\call_h5eB5itNVJfj8Lb4Z7OKdJ15__vscode-1779194591658\content.txt`
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`

## Entry 2026-05-19 Quick-Read Reload Rerun

- Date: 2026-05-19
- Host surface: Windows VS Code local chat host
- Validation slice: completed-result observability after reload, with `Quick Read` live in the renderer and the recovery-turn disambiguation fix present in the inspected implementation
- Probe or task: rerun the known-good five-file read-only traceable-subagent comparison after a VS Code reload to check whether the new semantic `Quick Read` block appears in the real completed result and whether the lane still completes cleanly when `tests/test.mjs` is among the read anchors
- Files or runtime surfaces inspected:
	- current VS Code local chat rendering for the completed `run_traceable_subagent` result
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\src\traceableSubagent.ts`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\tests\test.mjs`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai\.github\transitions\TRACEABLE_SUBAGENT_RUNTIME_PLAN.md`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\README.md`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\package.json`
- Expected pass bar: the live completed result should expose a short semantic receiver-oriented summary near the top (`Read`, `Concluded`, `Missing`) rather than relying only on counts, and the lane should still land a final payload on the same bounded five-file probe
- Observed result: pass on this rerun slice. The child lane returned `trace-supported`, `stopReason: completed`, `completionClaim: complete`, with `Quick Read` visible in the live result and `Observed Scope` listing the five inspected anchors. The lane also completed cleanly while reading `tests/test.mjs`, rather than falling back into the earlier "continue reading" failure shape.
- Limits or caveats: this entry shows that the completed-result surface is more legible after reload and that this specific rerun completed. It does not prove that the collapsed running header is any less static, and it does not prove that every possible recovery-turn failure mode is exhausted.
- Supporting artifact paths or logs:
	- `c:\Users\micro\AppData\Roaming\Code\User\workspaceStorage\d3793a5981dcc1e53c6a5b0ccdb89c35\GitHub.copilot-chat\chat-session-resources\3b540cad-8542-4094-94a4-316162aab935\call_fej6EHSQCs5ug1hmybHULWPF__vscode-1779195008013\content.txt`
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`

## Entry 2026-05-19 Reloaded Live-Row Equivalence Check

- Date: 2026-05-19
- Host surface: Windows VS Code local chat host
- Validation slice: collapsed live-row observability after reload, using the same bounded five-file `run_traceable_subagent` probe
- Probe or task: rerun the same broad five-file read-only probe after reload and compare whether the collapsed row now feels meaningfully more informative during execution, rather than merely showing the same generic volume label
- Files or runtime surfaces inspected:
	- current VS Code local chat rendering for the running `run_traceable_subagent` tool row
	- `c:\Users\micro\AppData\Roaming\Code\User\workspaceStorage\d3793a5981dcc1e53c6a5b0ccdb89c35\GitHub.copilot-chat\chat-session-resources\3b540cad-8542-4094-94a4-316162aab935\call_RXqEe0DCOEpZhPPcdwpJIZwU__vscode-1779208068521\content.txt`
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`
- Expected pass bar: the collapsed row should feel clearly more observable than the earlier static `Reading 5 files` experience and should justify claiming a meaningful UX lift during execution
- Observed result: no pass on the UX bar. The reloaded host surface showed phase changes such as `Loading` and `Evaluating`, but the human receiver still judged `Reading 5 files` as effectively equivalent to the earlier experience. That means the code-side changes did not yet produce a meaningful user-perceived improvement in the collapsed running row.
- Limits or caveats: this is a host-observed UX result, not a correctness failure in the traceable-subagent runtime itself. The completed result surface is stronger now, but the collapsed third-party live row still does not justify a native-parity claim.
- Supporting artifact paths or logs:
	- `c:\Users\micro\AppData\Roaming\Code\User\workspaceStorage\d3793a5981dcc1e53c6a5b0ccdb89c35\GitHub.copilot-chat\chat-session-resources\3b540cad-8542-4094-94a4-316162aab935\call_RXqEe0DCOEpZhPPcdwpJIZwU__vscode-1779208068521\content.txt`
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`

## Entry 2026-05-19 Neutral Lane-Label Rerun

- Date: 2026-05-19
- Host surface: Windows VS Code local chat host
- Validation slice: collapsed live-row observability after reload, using a noun-phrase lane label rather than an action verb
- Probe or task: rerun the same broad five-file read-only probe after rebuilding and reloading the extension so the collapsed row uses `Trace lane: 5 files`, then compare whether that more neutral static label lands better alongside host phase text such as `Loading`
- Files or runtime surfaces inspected:
	- current VS Code local chat rendering for the running `run_traceable_subagent` tool row
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`
- Expected pass bar: the static lane label should coexist more cleanly with host phase text and produce a clearly better receiver experience than the earlier verb-shaped label, even if the row itself still does not stream dynamic progress
- Observed result: no pass on the UX bar. The host displayed `Trace lane: 5 files`, which confirms that code-side control of the initial collapsed label works, but the label remained static for the full run and still did not create a meaningful sense of progress. The only dynamic behavior remained the host-owned phase row.
- Limits or caveats: this rerun also re-exposed a live `400 invalid_request_body` regression (`No tool call found for function call output with call_id ...`) after all five read calls succeeded, so this entry should not be read as a clean runtime pass. The UX conclusion is still valid because the receiver observed the running row before the late protocol failure.
- Supporting artifact paths or logs:
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`

## Entry 2026-05-19 Four-Anchor Wiring Probe After Retry Credit

- Date: 2026-05-19
- Host surface: Windows VS Code local chat host
- Validation slice: bounded four-anchor code-inspection probe for status-bar wiring after repeated-read deferral and pure-defer retry-credit changes
- Probe or task: inspect the activation, tool-registration, runtime-status, and status-bar-controller files for `run_traceable_subagent` and determine whether the end-to-end status-bar wiring is present from code evidence alone, while staying within the bounded child-lane tool and iteration budget
- Files or runtime surfaces inspected:
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\src\extension.ts`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\src\languageModelTools.ts`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\src\traceableSubagent.ts`
	- `c:\Users\micro\Documents\Repos\Tiinex\ai-vscode-tools\src\traceableSubagentStatusBar.ts`
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`
- Expected pass bar: the child should avoid stalling on repeated rereads of already-covered anchors, should cover all four carried anchors within budget, and should land a completed final JSON payload that can confirm the wiring from code evidence without reopening the broader UX claim
- Observed result: pass on this bounded slice. After reload, the live child lane read all four anchored files, returned `trace-supported`, `stopReason: completed`, and `completionClaim: complete`, and concluded that activation constructs the status-bar controller, tool registration supplies a created `statusReporter` into `runTraceableSubagent`, the runtime calls `statusReporter.update/finish`, and the status-bar controller implements those methods. This replaced the earlier three-file `insufficient_grounding` pattern that had been caused by repeated-read deferral turns still consuming the regular iteration budget.
- Limits or caveats: this entry proves the bounded four-anchor code-inspection slice on the current Windows host. It does not by itself prove native `runSubagent` UX parity, and it does not replace a separate human observation pass for the actual live status-bar UI updates during execution.
- Supporting artifact paths or logs:
	- `c:\Users\micro\AppData\Roaming\Code\User\workspaceStorage\d3793a5981dcc1e53c6a5b0ccdb89c35\GitHub.copilot-chat\chat-session-resources\3b540cad-8542-4094-94a4-316162aab935\call_MtUsXLxx4OeRdz6jUIvXNPzn__vscode-1779218452816\content.txt`
	- `c:\Users\micro\AppData\Roaming\Code\User\globalStorage\tiinex.ai-vscode-tools\traceable-subagent-debug.jsonl`
