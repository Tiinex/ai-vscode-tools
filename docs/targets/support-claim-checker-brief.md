# Target Brief: Support Claim Checker

Use this file as explicit build input for one narrow target.
It is not the main explanation of the repo and should be read together with [../reference/current-status.md](../reference/current-status.md) when reviewing larger claims.

Create a user-facing `Support Claim Checker` agent.

Purpose:
Help the user test whether one explicit support-layer claim is supported, contradicted, or left ambiguous by a small explicit set of workspace artifacts.

Expected high-level behavior:
- inspect only the explicitly named files or excerpts given by the user
- evaluate one explicit claim at a time
- return a concise verdict such as `supported`, `contradicted`, or `ambiguous`
- point to the artifact evidence that drove the verdict
- avoid mutating files
- avoid widening the search surface unless the user explicitly asks

Initial build expectations:
- build the smallest viable first version from the brief
- prefer read-only repo-local evidence over broad repo exploration
- do not turn missing evidence into a guessed verdict
- do not block initial creation on optional report formatting refinements