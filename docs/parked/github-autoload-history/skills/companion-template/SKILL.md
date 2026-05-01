---
name: companion-template
description: Activated only when Agent Architect or companion-governor must create or update allowed companion files using the fixed companion formats.
---

# Purpose
Provide the only allowed companion file structures.

# Placement
- store companions under `.github/agents/companions/`
- keep companions out of `.github/agents/` top-level runtime discovery
- treat companions as support-only artifacts; the runtime `.agent.md` must remain runnable without them

# Assets
- `assets/design.template.md`
- `assets/test.template.md`
- `assets/testdata.template.md`

# Rules
- no frontmatter
- no extra companion types
- no run logs
- no format improvisation
- companions should remain removable when a runtime artifact is forked into another context
- runtime artifacts win on conflict; companions must not be treated as fresher authority than the current `.agent.md`
- test and testdata companions must encode a re-grounding gate when reused across repeated proof or regression runs
- if a companion drifts from the runtime artifact or exercised surface, refresh it or mark the run `INCONCLUSIVE`; do not use it as accepted proof support
- companions are not the default for every runtime role; small bounded helper or sub-roles should usually be covered by the parent role's proof and support artifacts instead
- create companions for a helper or sub-role only when there is a specific unresolved design boundary, proof boundary, or maintenance need that cannot stay honest in the parent-role artifacts

# Exception Threshold For Helper Or Sub-Role Companions
Create a helper or sub-role companion only when all of the following are true:
- the runtime artifact already exists
- the exact gap is named explicitly
- parent-role artifacts can no longer keep that gap honest without becoming misleading, too diffuse, or too costly to maintain

Typical acceptable gaps:
- a distinct proof boundary that the parent-role tests cannot cover cleanly
- a distinct design boundary that keeps being lost or misapplied in parent-role support
- repeated maintenance churn that makes the parent-role support artifacts misleading or unstable
