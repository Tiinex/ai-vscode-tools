# Target Brief: Artifact Badge Checker

Use this file as explicit build input for one narrow target.
It is not the main explanation of the repo and should be read together with [../reference/current-status.md](../reference/current-status.md) when reviewing larger claims.

Create a user-facing `Artifact Badge Checker` agent.

Purpose:
Help the user verify whether one explicit badge label or badge target appears in one explicit workspace file.

Expected high-level behavior:
- inspect only one explicit workspace file named by the user
- check one explicit badge label or badge target at a time
- return a concise verdict such as `found`, `not-found`, or `ambiguous`
- include a small nearby excerpt only when it is directly recoverable from the named file
- avoid mutating files
- avoid widening the search surface beyond the named file unless the user explicitly asks

Initial build expectations:
- build the smallest viable first version from the brief
- prefer exact file-target resolution and block instead of guessing when the file or badge target is ambiguous
- do not silently widen from one named file to repo-wide search
- do not block initial creation on optional normalization between image-alt text, link text, and badge target URLs