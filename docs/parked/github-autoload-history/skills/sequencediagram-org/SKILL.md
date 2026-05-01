---
name: sequencediagram-org
description: Use when creating, updating, fixing, or reviewing SequenceDiagram.org diagrams or `.seqdiag` files, including sequence diagram syntax, arrows, fragments, notes, participants, spacing, and this repo's diagram conventions.
---

# Purpose
Create and maintain `.seqdiag` files that are valid for SequenceDiagram.org and consistent with this repo's diagram style.

# Use This Skill When
- creating a new diagram in `docs/diagrams/`
- revising an existing `.seqdiag` file
- translating process logic into SequenceDiagram.org syntax
- fixing invalid Mermaid-style or PlantUML-style syntax in `.seqdiag` files
- deciding how to express notes, fragments, arrows, or participants in this project's diagram set

# Core Syntax

## Title
- use `title ...` at the top when the diagram needs a visible heading
- line breaks inside text use `\n`

## Participants
- common participant declarations in this repo:
  - `actor User`
  - `control "Agent\nArchitect" as AA`
  - `entity Artifact`
  - `boundary "target-resolution\nSKILL" as TargetSkill`
- valid participant types from SequenceDiagram.org include:
  - `participant`
  - `rparticipant`
  - `actor`
  - `boundary`
  - `control`
  - `database`
  - `entity`
- use aliases with `as` when a long or multiline display name needs a short internal name

## Messages
- synchronous request: `A->B:message`
- response or return: `A<--B:message`
- async request: `A->>B:message`
- async return: `A<<--B:message`
- self message: `A->A:self message`
- line breaks inside message text use `\n`
- for this repo, prefer explicit response arrows such as `-->` or `<--` rather than leaving return flow implicit

## Notes and Boxes
- note over one participant: `note over A:text`
- note over several participants: `note over A,B:text`
- side notes: `note left of A:text` or `note right of A:text`
- boxes exist as `box`, `abox`, and `rbox`
- use notes for constraints or authority reminders, not for duplicating obvious arrow text

## Fragments
- supported fragment forms include:
  - `alt ... else ... end`
  - `opt ... end`
  - `loop ... end`
  - `par ... else ... end`
  - `group ... end`
- use `alt` for branching process outcomes
- use `opt` for optional paths
- use `loop` only when repetition is important to the process meaning

## Spacing and Numbering
- `participantspacing equal` is the repo default unless uneven spacing is necessary
- use `autonumber` only when step references help reading or discussion
- use `entryspacing` or `space` only when layout clarity genuinely needs it

# Project Conventions

## Diagram Scope
- prefer several small focused diagrams over one crowded master diagram
- each diagram should answer one process question clearly
- keep diagrams support-only; do not let them drift into runtime authority

## Visual Vocabulary
- use `actor User` for the human requester unless a different actor is genuinely needed
- use `control` for agents, validators, governors, and process operators
- use `entity` for artifacts or persistent state surfaces
- use `boundary` for skills or environment boundaries when the distinction matters

## Process Style
- show request and return flow explicitly
- preserve the repo's habit of using `note over` for core constraints such as authority, trust boundaries, or evidence rules
- when process order matters, make the order visually obvious rather than relying on descriptive text alone
- when a branch stops work, show the user-facing stop outcome explicitly

## Editing Existing Diagrams
- preserve existing participant names and aliases unless the process model has actually changed
- update the smallest number of lines needed to keep the diagram synchronized with the current contract
- if a process change affects more than one diagram, keep the vocabulary and arrow style aligned across the set

# Common Mistakes To Avoid
- do not use Mermaid keywords or Mermaid arrow syntax in `.seqdiag` files
- do not use PlantUML-only syntax in `.seqdiag` files
- do not omit `end` for fragments
- do not rely on current renderer tolerance for malformed multiline statements
- do not hide important branching logic in a note when it should be an `alt` or `opt`
- do not use diagrams as the only place where a contract exists; diagrams must reflect artifacts, not replace them

# Preferred Review Checklist
- the file uses valid SequenceDiagram.org syntax
- the title matches the actual process shown
- participants and aliases are readable and consistent with nearby diagrams
- return arrows and stop conditions are visible where process reasoning depends on them
- fragment structure matches the intended branching or repetition
- the diagram stays narrow enough to be readable without zooming into every line
- the diagram matches the current support contract and does not claim runtime authority

# Minimal Example
```text
title Example process

participantspacing equal
autonumber 1

actor User
control "Agent\nArchitect" as AA
control Intake

User->AA: request
AA->Intake: classify request
Intake-->AA: bounded result

alt blocker
  AA-->User: stop and report blocker
else continue
  note over AA: Artifact state remains authoritative.
  AA-->User: proceed with verified next step
end
```