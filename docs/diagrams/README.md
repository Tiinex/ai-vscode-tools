# Process Diagrams

This folder contains the current visual process reference set for Agent Architect.

Use these diagrams as readability aids and cross-check surfaces.
They are support artifacts, not runtime authority.
If a diagram conflicts with runtime artifacts, runtime artifacts win.
If a diagram and a text support artifact describe the same surface differently, reconcile that difference explicitly rather than assuming both are current.

Current diagram set:
- `01-process-overview.seqdiag` — high-level end-to-end process shape
- `02-create-path.seqdiag` — CREATE path from request to first runtime artifact
- `03-validation-and-release.seqdiag` — validation chain and release mapping
- `04-constrained-verification-model.seqdiag` — what counts as evidence in the current test environment
- `05-existing-artifact-path.seqdiag` — PATCH / REPAIR path including companion and release flow
- `06-helper-agent-routing.seqdiag` — helper-agent routing by trust class and risk boundary
- `07-compact-tolerant-reentry.seqdiag` — current support-model view of the re-grounding gate before risky main-thread work

Reading guidance:
- start with `01-process-overview.seqdiag`
- then read either `02-create-path.seqdiag` or `05-existing-artifact-path.seqdiag`
- use `03-validation-and-release.seqdiag` and `04-constrained-verification-model.seqdiag` as cross-checks when evaluating claims of success
- use `06-helper-agent-routing.seqdiag` when deciding between `Explore`, `undo-safe-default`, stronger custom agents, or a justified default-agent exception
- use `07-compact-tolerant-reentry.seqdiag` when reasoning about main-thread continuity risk, soft resets, or re-grounding before risky work
- when reset behavior, helper routing, or verification status has changed recently, cross-check the matching text in `README.md`, `ROADMAP.md`, and `CO-DESIGNER.md` before treating a diagram as current working state
- after meaningful diagram or support-text changes on the same surface, prefer a read-only fresh-reader check so diagram wording is not only self-consistent but also interpreted as intended

Scope note:
- the diagram set now covers core process flow, helper-agent routing, and compact-tolerant re-entry
- the diagrams remain support surfaces only and do not override runtime artifacts
- diagrams are useful summaries, but they may lag more specific support text until both are brought back into alignment
- diagram `07-compact-tolerant-reentry.seqdiag` reflects the current working support model for recovery, while the surrounding hardening work is still in progress