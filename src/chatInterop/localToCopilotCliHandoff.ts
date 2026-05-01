import { describeCopilotCliSessionStateRoot } from "../tooling/copilot-cli";
import type { ExactSessionInteropSupport } from "./capabilities";
import type { SessionDescriptor } from "../coreAdapter";

export interface CopilotCliHandoffTarget {
  canonicalResource: string;
  sessionDir?: string;
  eventsPath?: string;
}

export interface LocalToCopilotCliHandoffOptions {
  session: SessionDescriptor;
  support: ExactSessionInteropSupport;
  latestCli?: CopilotCliHandoffTarget;
  snapshotMarkdown: string;
  profileMarkdown: string;
  indexMarkdown: string;
}

export function renderLocalToCopilotCliHandoffMarkdown(options: LocalToCopilotCliHandoffOptions): string {
  const { session, support, latestCli, snapshotMarkdown, profileMarkdown, indexMarkdown } = options;
  const workerPrompt = buildLocalToCopilotCliWorkerPrompt(session, latestCli);

  return [
    "# Local To Copilot CLI Handoff",
    "",
    "## Transport Package",
    "- Target name: Copilot CLI worker lane",
    "- Target surface: copilotcli session reopen/send",
    `- Target scope: ${latestCli?.sessionDir ?? `${describeCopilotCliSessionStateRoot()} (no current session selected)`}`,
    `- Target location: ${latestCli?.eventsPath ?? "-"}`,
    `- Canonical session or resource: ${latestCli?.canonicalResource ?? "-"}`,
    "- Source incident surface: ordinary Local chat persistence",
    `- Source session ID: ${session.sessionId}`,
    `- Source session file: ${session.jsonlPath}`,
    "",
    "## Surface Boundaries",
    "- Treat the Local incident and the Copilot CLI worker lane as separate surfaces.",
    "- Do not claim session continuity or identity continuity between them.",
    support.sendUnsupportedReason
      ? `- Current Local exact-target limitation: ${support.sendUnsupportedReason}`
      : "- Current Local exact-target limitation: none reported by the host build.",
    "- Use this package as evidence transport and mode selector, not as proof that the worker is the original Local target.",
    "",
    "## Issue Summary",
    `- Source title: ${session.title ?? "-"}`,
    `- Source file timestamp: ${new Date(session.mtime).toLocaleString()}`,
    "- Summary heuristic: start from the profile findings and latest persisted user message below; refine after the worker inspects the relevant workspace files.",
    "",
    "## Observed Evidence With Provenance",
    shiftMarkdownHeadings(profileMarkdown.trimEnd(), 2),
    "",
    shiftMarkdownHeadings(snapshotMarkdown.trimEnd(), 2),
    "",
    shiftMarkdownHeadings(indexMarkdown.trimEnd(), 2),
    "",
    "## Required Tool Entrypoint",
    "- VS Code command: workbench.action.chat.openSessionWithPrompt.copilotcli",
    `- Suggested resource: ${latestCli?.canonicalResource ?? "resolve latest Copilot CLI session before send"}`,
    "- Required arguments: resource, prompt, attachedContext=[]",
    "- Environment assumptions: the worker runs in a Copilot CLI chat with workspace tooling available if the host permits it.",
    "",
    "## Required Validation After Mutation",
    "- Re-check the implicated workspace files directly after any write.",
    "- Re-run the smallest relevant tool or command path that exercises the changed behavior.",
    "- If the goal is a Local incident fix, record that final validation on the original Local surface is still a separate step unless exact Local targeting becomes available.",
    "",
    "## Exact Handoff Prompt",
    "```text",
    workerPrompt,
    "```"
  ].filter((line): line is string => Boolean(line)).join("\n");
}

export function buildLocalToCopilotCliWorkerPrompt(
  session: SessionDescriptor,
  latestCli?: CopilotCliHandoffTarget
): string {
  return [
    "You are working in a Copilot CLI session as a separate worker lane for a VS Code Local chat incident.",
    "Treat the incident package below as evidence from another surface, not as proof that you are continuing the same session.",
    "Do not claim Local-to-CLI session continuity.",
    "Use workspace tooling if it is available in this Copilot CLI chat mode.",
    "First restate what evidence you are relying on.",
    "Then identify the most likely root-cause hypothesis.",
    "Then name the smallest file, tool, or runtime checks that would confirm or falsify that hypothesis.",
    "If a mutation seems necessary, do not apply it yet unless the operator explicitly asks; propose the smallest change and its validation plan.",
    `Source Local session ID: ${session.sessionId}`,
    `Source Local session file: ${session.jsonlPath}`,
    latestCli ? `Worker canonical resource: ${latestCli.canonicalResource}` : "Worker canonical resource: resolve latest Copilot CLI session before send",
    "Incident package follows after this instruction block."
  ].join("\n");
}

export function buildLocalToCopilotCliExecutionPrompt(options: LocalToCopilotCliHandoffOptions): string {
  const workerPrompt = buildLocalToCopilotCliWorkerPrompt(options.session, options.latestCli);
  const packageMarkdown = renderLocalToCopilotCliHandoffMarkdown(options);
  const packageWithoutPromptSection = packageMarkdown.split("\n## Exact Handoff Prompt\n")[0].trimEnd();
  return [workerPrompt, "", packageWithoutPromptSection].join("\n");
}

function shiftMarkdownHeadings(markdown: string, levels: number): string {
  return markdown.replace(/^(#{1,6})\s/gm, (_match, hashes: string) => `${"#".repeat(Math.min(6, hashes.length + levels))} `);
}