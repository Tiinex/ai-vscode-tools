---
name: frontmatter-rules
description: Activated only when frontmatter-governor must determine valid VS Code custom agent frontmatter fields for a target agent artifact.
---

# Always-Allowed Runtime Fields
- name
- description
- model
- target
- disable-model-invocation
- tools
- user-invocable

# Conditionally Allowed Runtime Fields
- handoffs

# Rules
- do not invent fields
- keep values runtime-meaningful
- companion files do not use frontmatter
- treat the always-allowed runtime fields as the baseline, not as a mandate that every field must always appear
- allow `handoffs` only when the runtime artifact is user-facing and section `10 Handoff rules` defines exact payloads and semantics for each exposed handoff
- reject `handoffs` when the artifact does not expose exact handoff meaning in its body
- reject fields justified only by analogy to other customization families or external schema memory
- if repo-local authority for a non-baseline field is missing, reject the field instead of guessing
