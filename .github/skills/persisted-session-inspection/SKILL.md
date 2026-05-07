---
name: persisted-session-inspection
description: 'Guidance for bounded persisted session inspection in VS Code Local chat workflows. Use when listing stored sessions, opening a compact session index, inspecting a bounded session window, exporting evidence transcript blocks, or estimating context breakdown without falling back to raw session files first.'
user-invocable: false
---

# Persisted Session Inspection

## When to Use
- Use this skill when the task is to inspect stored local chat sessions without jumping straight to raw `chatSessions/*.jsonl` reads.
- Use it when you need the latest stored session, a compact bounded index, a window around anchor text, or evidence blocks from persisted transcript artifacts.
- Use it when the goal is diagnosis, evidence review, or context estimation rather than destructive cleanup.

## Default Posture
- Prefer bounded inspection lanes first.
- Treat raw session-file reads as last resort only when the bounded tools cannot answer the question.
- Keep the first pass compact and targeted. Expand only when the previous bounded result is insufficient.

## Preferred Order
1. Start with `list_agent_sessions` or `survey_agent_sessions` when you need to identify the right stored session.
2. Use `get_agent_session_index` or `export_agent_session_markdown` for a compact bounded overview of one session.
3. Use `get_agent_session_window` when you need rows around anchor text or around the latest compaction boundary.
4. Use `export_agent_evidence_transcript` when you need a findings-safe evidence transcript view instead of a raw file dump.
5. Use `estimate_agent_context_breakdown` when the question is about persisted context pressure rather than transcript content.
6. Read raw session files only after these bounded lanes prove insufficient.

## Compact Inspection Procedure
1. Run `list_agent_sessions` or `survey_agent_sessions` to identify the most relevant stored session.
2. Pick the exact session id or use the latest bounded selector when the latest session is clearly the target.
3. Run `get_agent_session_index` or `export_agent_session_markdown` first to understand the session shape before pulling more detail.
4. If the question is localized, use `get_agent_session_window` with anchor text or the latest compaction boundary.
5. If the question needs transcript evidence, use `export_agent_evidence_transcript` with bounded block output.

## Evidence Procedure
1. Use `export_agent_evidence_transcript` when the user needs concrete persisted evidence rather than a summary.
2. Keep the export bounded with anchor text, compaction filtering, or a max block cap when possible.
3. If the evidence export is still too broad, step back to `get_agent_session_window` or `get_agent_session_index` rather than reading raw files immediately.

## Context Pressure Procedure
1. Use `estimate_agent_context_breakdown` when the question is about context utilization, compaction pressure, or where persisted weight is accumulating.
2. Keep the first read in summary mode unless the user explicitly needs the full breakdown.
3. Restrict to the latest request families or after the latest compaction boundary when the question is about recent pressure.

## Escalation Rules
- Escalate from `list_agent_sessions` or `survey_agent_sessions` to `get_agent_session_index` or `export_agent_session_markdown` before escalating to raw file reads.
- Escalate from index to bounded window or evidence export only when the previous bounded step did not answer the question.
- Do not read raw `chatSessions/*.jsonl` files simply because they exist. Use them only when the bounded inspection surfaces cannot provide the needed signal.

## Tool Notes
- `list_agent_sessions` or `survey_agent_sessions` is for identifying the target session set.
- `get_agent_session_index` or `export_agent_session_markdown` is the default first look for one session.
- `get_agent_session_window` is for bounded anchor-centered inspection.
- `export_agent_evidence_transcript` is for canonical evidence blocks with explicit omissions.
- `estimate_agent_context_breakdown` is for persisted context pressure, not transcript reconstruction.