---
name: target-resolution
description: "Use when Agent Architect must resolve the exact target, writable scope, and execution surface before CREATE, PATCH, REPAIR, or tool-backed diagnostic work, including artifact paths, session resources, and transport boundaries."
---

# Purpose
Resolve the target enough to choose:
- CREATE
- PATCH
- REPAIR
- BLOCKED
- TRANSPORT_REQUIRED

# Resolution Requirements
Resolve all of the following before choosing a non-BLOCKED classification:
- target name
- target surface, such as runtime artifact, support artifact, session resource, or tool-backed workflow surface
- target artifact path
- canonical session or resource identifier when the request is about an existing chat or tool-managed surface
- whether the target artifact already exists
- whether the current environment can invoke the exact required tool or session surface
- whether the current environment can write to that exact path

# Classification Rules
- If the target name or target artifact path is still ambiguous after trusted inputs -> BLOCKED
- If the request depends on an exact session, command, or tool surface and that surface is still ambiguous or unsupported after trusted inputs -> BLOCKED
- If the target artifact resolves outside the current writable scope -> TRANSPORT_REQUIRED
- If the target artifact does not exist and all CREATE preconditions are satisfied -> CREATE
- If the target artifact exists and the requested work is ordinary bounded improvement that preserves identity -> PATCH
- If the target artifact exists and the requested work is corrective restoration to contract-valid operability -> REPAIR

# CREATE Preconditions
Classify CREATE only when all of the following are true:
- the target resolves to a single artifact path
- that path is in the correct writable scope
- the artifact does not already exist at that path
- minimum build context is sufficient

If all CREATE preconditions are true:
- classify CREATE
- creation_blocked: NO

If any CREATE precondition is false or unknown:
- do not classify CREATE
- return the exact blocker or unknown

# PATCH Definition
PATCH applies only when all of the following are true:
- the target artifact already exists
- the artifact is in the current writable scope
- the requested change is a bounded in-place update
- the artifact's identity and intended role remain the same
- the work is not primarily restoring a broken artifact to contract-valid state

# REPAIR Definition
REPAIR applies only when all of the following are true:
- the target artifact already exists
- the artifact is in the current writable scope
- the artifact is structurally invalid, contract-incomplete, malformed, or otherwise broken
- the primary goal is to restore contract-valid operability

# Minimum Build Context
Minimum build context is sufficient only when trusted or directly verified inputs provide all of the following:
- a single target identity
- a single target surface
- a single writable target artifact path
- the exact command, session resource, or transport route when the task depends on tooling rather than direct file mutation alone
- enough role intent to write the first valid runtime artifact without inventing its purpose or scope
- enough repo-local authority to determine allowed artifact shape for that artifact family

If any of those are missing or ambiguous, minimum build context is insufficient.

# Correct Writable Scope
Correct writable scope holds only when all of the following are true:
- the resolved target path is inside the current writable workspace scope
- direct mutation at that path is permitted in the current environment
- the exact required tool or session surface is invocable from the current environment when the task depends on it
- no transport boundary prevents direct mutation here

If any of those are false or unknown, direct mutation is not locally allowed.

# creation_blocked Semantics
- CREATE with all preconditions satisfied -> creation_blocked: NO
- CREATE blocked by a known missing precondition -> creation_blocked: YES
- non-CREATE classifications -> creation_blocked: NO and explain why CREATE is not active
- do not use creation_blocked to hide unresolved target or scope ambiguity; unresolved target or scope means BLOCKED

# Output Shape
- target name
- target surface
- target scope
- target location if known
- canonical session or resource if known
- classification
- creation_blocked: YES/NO
- missing_blocker if any
- reason
