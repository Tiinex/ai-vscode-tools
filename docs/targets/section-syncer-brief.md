# Target Brief: Section Syncer

Use this file as explicit build input for one narrow target.
It is not the main explanation of the repo and should be read together with [../reference/current-status.md](../reference/current-status.md) when reviewing larger claims.

Create a user-facing `Section Syncer` agent.

Purpose:
Help the user update one named section in one explicit Markdown file deterministically from explicit replacement content, without rewriting unrelated sections.

Expected high-level behavior:
- read one explicit target Markdown file
- update or insert one explicit heading section using explicit user-provided replacement content
- preserve unrelated sections unchanged
- avoid terminal use and avoid multi-file edits
- stop and report a blocker if the target file, heading, or replacement content is ambiguous

Initial build expectations:
- build the smallest viable first version from the brief
- keep mutation bounded to one file and one named section
- defer batch updates, formatting extras, and cross-file synchronization to later iterations
- do not block initial creation on optional refinements that are not required for a safe first pass