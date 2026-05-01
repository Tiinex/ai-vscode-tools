# Release Gate

Agent Architect uses bounded release states rather than fuzzy “looks good” language.

In plain language: the repo prefers an honest status label over a confident but blurry summary.

## States

### READY

Use when the evidence chain is complete enough to justify trust at the claimed scope.

### DEGRADED

Use when meaningful work or evidence exists, but uncertainty remains too important to hide.

### BLOCKED

Use when a required precondition, evidence step, or trust boundary is missing.

## Why this matters

Release states are there to stop the system from collapsing complex truth into a single optimistic sentence.

They help separate:

- what is truly supported
- what is partially supported
- what should not proceed yet