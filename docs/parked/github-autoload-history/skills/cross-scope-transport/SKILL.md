---
name: cross-scope-transport
description: "Use when Agent Architect has resolved the target but direct mutation cannot occur because the target lives in a different writable scope or requires a different tool/session surface, so an exact transport or handoff package must be prepared."
---

# Purpose
Create a transport package instead of pretending cross-scope or cross-surface work is complete.

# Transport Package
- target name
- target surface
- target scope
- target location if known
- canonical session or resource identifier if known
- issue summary
- observed evidence with provenance
- required tool, command, or session entrypoint if the downstream worker must act through tooling
- required arguments, flags, environment, or auth assumptions if they are known and necessary for replay
- proposed change
- required files to inspect
- required validation after mutation

# Rules
- if an exact handoff payload or canonical resource exists, prefer that over a lossy freeform summary
- separate what was verified locally from what still requires downstream mutation or validation in the other scope or surface
- do not report completion until downstream mutation and validation are evidenced from the target surface
