---
name: artifact-hygiene
description: "Use when support artifacts, companions, benchmark materials, or tool-generated probe/evidence files are being created or updated and repo clutter or false authority must be controlled."
---

# Rules
- do not create extra spill files
- do not leave temporary run logs in the repo
- use existing allowed artifact families where possible
- when tooling produces evidence or probe outputs, keep them inside an existing support, benchmark, or probe artifact family instead of inventing ad hoc repo-root files
- do not let tool-generated artifacts look like runtime authority; if an artifact is not meant to be runtime input, keep it out of runtime families such as `.github/agents/` and label it as support-only or probe-only when persisted
- if persistent tool output is needed for later verification, keep the smallest reproducible artifact and discard raw noise
