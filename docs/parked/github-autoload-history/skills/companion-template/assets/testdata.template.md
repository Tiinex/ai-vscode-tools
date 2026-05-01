# Test Data Companion: <agent-name>

## Purpose
Short statement of what this file supports.

## Execution Preflight
- clean baseline requirement
- contamination checks
- allowed retained artifacts if any
- re-read the current runtime artifact and the minimum support artifacts that govern the same proof before the run starts
- if a soft reset, compaction, long pause, or support-layer edit occurred after a probe was drafted, rebuild the probe from current artifacts before using it
- if runtime and support artifacts disagree, stop the run or mark it `INCONCLUSIVE`; do not accept it as proof until the support layer is refreshed
- record the re-grounded artifact set and exercised surface before the run starts in the benchmark artifact, harness record, or returned payload for that run; if this provenance is missing, the run must not count as proof
- if companion omission or companion creation matters for the claim, record the companion decision before the run is accepted
- if a helper or sub-role companion is allowed as an exception, record the affected role, exact named gap, and why parent-role artifacts were insufficient

Minimum companion decision fields when relevant:
- `companion_decision`: `not-relevant` | `parent-proof-sufficient` | `exception-approved`
- `companion_target_role`: exact role name when the decision concerns a helper or sub-role
- `companion_exception_gap`: exact named gap when `companion_decision` is `exception-approved`
- `companion_exception_reason`: why parent-role artifacts were insufficient when `companion_decision` is `exception-approved`

Preferred placement:
- in markdown benchmark or harness artifacts, place these fields in a dedicated `Companion Decision Record` block adjacent to run provenance
- in structured returned payloads, place these fields under a top-level `companion_decision_record` object

## Canonical Cases
### Case: <name>
Goal:
<behavior under test>

Input:
<text>

Setup Constraints:
- explicit artifact, session, or surface only
- no hidden answer template or runtime-adjacent prefilled artifact

Lane Constraints:
- declared lane matches the surface actually exercised
- transport aids or workaround setup are recorded explicitly when used

Use This For:
- detailed prompt variants, edge cases, or microcases that would bloat the main test companion

Expected Constraints:
- constraint
- constraint

Cleanup Expectations:
- cleanup
- cleanup

## Fixtures
- fixture
- fixture

## External Dependencies
- none
