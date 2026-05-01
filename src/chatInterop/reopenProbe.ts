import * as vscode from "vscode";
import { captureCurrentChatFocusReport } from "./editorFocus";
import { type ChatFocusReport, findEditorChatTargetCandidate } from "./focusTargets";
import type { ChatInteropApi, ChatSessionSummary } from "./types";

const SAME_WINDOW_REOPEN_COMMANDS = [
  "workbench.action.chat.openSessionInEditorGroup",
  "workbench.action.chat.openSessionInNewEditorGroup",
  "github.copilot.chat.showAsChatSession"
] as const;

const CROSS_WINDOW_REOPEN_COMMANDS = [
  "workbench.action.chat.openSessionInNewWindow"
] as const;

type AttemptStatus = "opened-target" | "opened-other-chat" | "no-visible-effect" | "error" | "unverified-cross-window";

interface ReopenProbeAttempt {
  command: string;
  argumentShape: string;
  status: AttemptStatus;
  activeTabLabel?: string;
  reason?: string;
}

export interface LocalReopenProbeResult {
  ok: boolean;
  target: ChatSessionSummary;
  report: ChatFocusReport;
  attempts: ReopenProbeAttempt[];
}

export async function probeLocalReopenCandidates(
  chatInterop: Pick<ChatInteropApi, "listChats">,
  sessionId: string
): Promise<LocalReopenProbeResult> {
  const chats = await chatInterop.listChats();
  const target = resolveTargetSession(chats, sessionId);
  const commands = new Set(await vscode.commands.getCommands(true));
  const attempts: ReopenProbeAttempt[] = [];

  await closeAllEditorTabs();
  await wait(120);

  for (const command of SAME_WINDOW_REOPEN_COMMANDS) {
    if (!commands.has(command)) {
      attempts.push({
        command,
        argumentShape: "<unavailable>",
        status: "error",
        reason: "Command is not registered in the current host session."
      });
      continue;
    }

    for (const variant of buildArgumentVariants(target)) {
      const attempt = await runProbeAttempt(chatInterop, target, command, variant.label, variant.args, false);
      attempts.push(attempt.attempt);
      if (attempt.openedTarget) {
        return {
          ok: true,
          target,
          report: attempt.report,
          attempts
        };
      }
      await closeAllEditorTabs();
      await wait(120);
    }
  }

  for (const command of CROSS_WINDOW_REOPEN_COMMANDS) {
    if (!commands.has(command)) {
      attempts.push({
        command,
        argumentShape: "<unavailable>",
        status: "error",
        reason: "Command is not registered in the current host session."
      });
      continue;
    }

    for (const variant of buildArgumentVariants(target)) {
      const attempt = await runProbeAttempt(chatInterop, target, command, variant.label, variant.args, true);
      attempts.push(attempt.attempt);
    }
  }

  return {
    ok: false,
    target,
    report: captureCurrentChatFocusReport(await chatInterop.listChats()),
    attempts
  };
}

export function renderLocalReopenProbeMarkdown(result: LocalReopenProbeResult): string {
  const lines = [
    "# Local Reopen Probe",
    "",
    `- Target session: ${result.target.id}`,
    `- Target title: ${JSON.stringify(result.target.title)}`,
    `- Successful same-window reopen observed: ${result.ok ? "yes" : "no"}`,
    "",
    "## Attempts"
  ];

  if (result.attempts.length === 0) {
    lines.push("- No candidate reopen commands were attempted.");
  } else {
    for (const attempt of result.attempts) {
      lines.push(`- ${attempt.command} | args=${attempt.argumentShape} | status=${attempt.status}${attempt.activeTabLabel ? ` | activeTab=${JSON.stringify(attempt.activeTabLabel)}` : ""}`);
      if (attempt.reason) {
        lines.push(`  reason=${attempt.reason}`);
      }
    }
  }

  lines.push(
    "",
    "## Final Tab State",
    ...renderReportSummary(result.report),
    "",
    "## Interpretation",
    result.ok
      ? "- At least one runtime reopen candidate opened the requested Local session into the current window."
      : "- No same-window runtime reopen candidate opened the requested Local session into the current window during this probe.",
    "- Cross-window candidates remain weaker evidence because the current-window tab state cannot prove what opened elsewhere.",
    "- Interactive pickers are intentionally excluded from this probe because they require a human choice and do not satisfy an autonomous reopen route by themselves."
  );

  return `${lines.join("\n")}\n`;
}

function resolveTargetSession(chats: ChatSessionSummary[], sessionId: string): ChatSessionSummary {
  const match = chats.find((chat) => chat.id === sessionId || chat.id.startsWith(sessionId) || sessionId.startsWith(chat.id));
  if (!match) {
    throw new Error(`No live chat session matched ${JSON.stringify(sessionId)}.`);
  }
  return match;
}

function buildArgumentVariants(target: ChatSessionSummary): Array<{ label: string; args: unknown[] }> {
  const sessionFileUri = vscode.Uri.file(target.sessionFile);
  const localSessionResourceUri = vscode.Uri.parse(`vscode-chat-session://local/${encodeSessionId(target.id)}`);

  return [
    { label: "none", args: [] },
    { label: "sessionId-string", args: [target.id] },
    { label: "session-summary", args: [target] },
    { label: "object-sessionId", args: [{ sessionId: target.id }] },
    { label: "object-id-title", args: [{ id: target.id, title: target.title }] },
    { label: "object-sessionId-title", args: [{ sessionId: target.id, title: target.title }] },
    { label: "local-session-resource-uri", args: [localSessionResourceUri] },
    { label: "object-resource-local-session-uri", args: [{ resource: localSessionResourceUri }] },
    { label: "object-sessionResource-local-session-uri", args: [{ sessionResource: localSessionResourceUri }] },
    { label: "session-file-uri", args: [sessionFileUri] },
    { label: "object-resource-session-file-uri", args: [{ resource: sessionFileUri }] }
  ];
}

function encodeSessionId(sessionId: string): string {
  return Buffer.from(sessionId, "utf8").toString("base64");
}

async function runProbeAttempt(
  chatInterop: Pick<ChatInteropApi, "listChats">,
  target: ChatSessionSummary,
  command: string,
  argumentShape: string,
  args: unknown[],
  crossWindowOnly: boolean
): Promise<{ openedTarget: boolean; report: ChatFocusReport; attempt: ReopenProbeAttempt }> {
  try {
    await vscode.commands.executeCommand(command, ...args);
    await wait(180);
    const report = captureCurrentChatFocusReport(await chatInterop.listChats());
    const activeTabLabel = getActiveTabLabel(report);
    const targetCandidate = findEditorChatTargetCandidate(report, target.title);
    const anyChatCandidate = findEditorChatTargetCandidate(report);

    if (targetCandidate) {
      return {
        openedTarget: true,
        report,
        attempt: {
          command,
          argumentShape,
          status: "opened-target",
          activeTabLabel
        }
      };
    }

    if (crossWindowOnly) {
      return {
        openedTarget: false,
        report,
        attempt: {
          command,
          argumentShape,
          status: "unverified-cross-window",
          activeTabLabel,
          reason: "Command returned without exposing the target in the current window; if it opened another window, this probe cannot verify that target from current-window tab state."
        }
      };
    }

    if (anyChatCandidate) {
      return {
        openedTarget: false,
        report,
        attempt: {
          command,
          argumentShape,
          status: "opened-other-chat",
          activeTabLabel,
          reason: `A chat tab became visible, but it did not match the requested title ${JSON.stringify(target.title)}.`
        }
      };
    }

    return {
      openedTarget: false,
      report,
      attempt: {
        command,
        argumentShape,
        status: "no-visible-effect",
        activeTabLabel
      }
    };
  } catch (error) {
    return {
      openedTarget: false,
      report: captureCurrentChatFocusReport(await chatInterop.listChats()),
      attempt: {
        command,
        argumentShape,
        status: "error",
        reason: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

async function closeAllEditorTabs(): Promise<void> {
  const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);
  if (tabs.length === 0) {
    return;
  }
  await vscode.window.tabGroups.close(tabs, true);
}

function getActiveTabLabel(report: ChatFocusReport): string | undefined {
  return report.groups[report.activeGroupIndex]?.tabs.find((tab) => tab.isActive)?.label;
}

function renderReportSummary(report: ChatFocusReport): string[] {
  const lines = [`- Active group index: ${report.activeGroupIndex}`];

  for (const [groupIndex, group] of report.groups.entries()) {
    lines.push(`- Group ${groupIndex} | active=${group.isActive ? "yes" : "no"} | tabs=${group.tabs.length}`);
    for (const [tabIndex, tab] of group.tabs.entries()) {
      lines.push(`  - Tab ${tabIndex} | active=${tab.isActive ? "yes" : "no"} | likelyChat=${tab.isLikelyChatEditor ? "yes" : "no"} | label=${JSON.stringify(tab.label)}`);
    }
  }

  return lines;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}