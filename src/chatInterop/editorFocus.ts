import * as vscode from "vscode";
import {
  findEditorGroupFocusCommand,
  findNextEditorInGroupCommand,
  findOpenEditorAtIndexCommand,
  findPreviousEditorInGroupCommand
} from "./editorFocusCommands";
import { findEditorChatTargetCandidate, summarizeChatFocusGroups, type ChatFocusReport } from "./focusTargets";
import type { ChatInteropApi, ChatSessionSummary } from "./types";

export interface EditorChatFocusRequest {
  sessionId?: string;
}

export function captureCurrentChatFocusReport(chats: ChatSessionSummary[]): ChatFocusReport {
  return summarizeChatFocusGroups(
    vscode.window.tabGroups.all.map((group) => ({
      isActive: group.isActive,
      viewColumn: group.viewColumn,
      tabs: group.tabs.map((tab) => ({
        label: tab.label,
        isActive: tab.isActive,
        isDirty: tab.isDirty,
        isPinned: tab.isPinned,
        isPreview: tab.isPreview,
        input: tab.input
      }))
    })),
    chats
  );
}

export async function focusLikelyEditorChat(
  chatInterop: Pick<ChatInteropApi, "listChats">,
  request: EditorChatFocusRequest = {}
): Promise<{ ok: boolean; reason?: string; report?: ChatFocusReport }> {
  const chats = await chatInterop.listChats();
  const targetTitle = resolveTargetTitle(chats, request.sessionId);
  const commands = await vscode.commands.getCommands(true);
  const initialReport = captureCurrentChatFocusReport(chats);
  const candidate = findEditorChatTargetCandidate(initialReport, targetTitle);

  if (!candidate) {
    return {
      ok: false,
      reason: targetTitle
        ? `No visible editor-hosted chat tab matched the requested live chat title ${JSON.stringify(targetTitle)}. Run Inspect Chat Focus Targets to inspect the current tab layout, or open that chat in an editor tab first.`
        : "No visible editor-hosted chat tab was found. Run Inspect Chat Focus Targets to inspect the current tab layout.",
      report: initialReport
    };
  }

  if (candidate.groupIndex !== initialReport.activeGroupIndex) {
    const groupCommand = findEditorGroupFocusCommand(commands, candidate.groupIndex);
    if (!groupCommand) {
      return {
        ok: false,
        reason: `The requested editor chat tab is in editor group ${candidate.groupIndex}, but this build does not expose a supported focus command for that editor group. Run Inspect Chat Focus Targets to inspect the current tab layout.`,
        report: initialReport
      };
    }
    await vscode.commands.executeCommand(groupCommand);
    await wait(120);
  } else {
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    await wait(120);
  }

  let report = captureCurrentChatFocusReport(await chatInterop.listChats());
  let activeGroup = report.groups[report.activeGroupIndex];
  let activeTabIndex = activeGroup?.tabs.findIndex((tab) => tab.isActive) ?? -1;

  if (activeGroup && activeTabIndex !== candidate.tabIndex) {
    const steeringResult = await steerActiveGroupToTab(chatInterop, commands, report, candidate.tabIndex);
    if (!steeringResult.ok) {
      return steeringResult;
    }
    report = steeringResult.report;
    activeGroup = report.groups[report.activeGroupIndex];
  }

  const activeTab = activeGroup?.tabs.find((tab) => tab.isActive);
  if (!activeTab) {
    return {
      ok: false,
      reason: "No active editor tab was found after focusing the active editor group. Run Inspect Chat Focus Targets to inspect the current tab layout.",
      report
    };
  }

  if (!activeTab.isLikelyChatEditor) {
    return {
      ok: false,
      reason: `The active editor tab after focusing the editor group does not look like a chat tab: ${JSON.stringify(activeTab.label)} (${activeTab.input.kind}). Run Inspect Chat Focus Targets to inspect the current tab layout.`,
      report
    };
  }

  if (targetTitle && normalize(activeTab.label) !== normalize(targetTitle)) {
    return {
      ok: false,
      reason: `The focused editor tab after steering does not match the requested live chat title ${JSON.stringify(targetTitle)}. The active tab is ${JSON.stringify(activeTab.label)}. Run Inspect Chat Focus Targets to inspect the current tab layout.`,
      report
    };
  }

  return { ok: true, report };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function resolveTargetTitle(chats: ChatSessionSummary[], sessionId: string | undefined): string | undefined {
  const requestedSessionId = sessionId?.trim();
  if (!requestedSessionId) {
    return undefined;
  }

  const match = chats.find((chat) => chat.id === requestedSessionId || chat.id.startsWith(requestedSessionId) || requestedSessionId.startsWith(chat.id));
  if (!match) {
    throw new Error(`No live chat session matched ${JSON.stringify(requestedSessionId)}.`);
  }
  return match.title;
}

async function steerActiveGroupToTab(
  chatInterop: Pick<ChatInteropApi, "listChats">,
  commands: readonly string[],
  report: ChatFocusReport,
  targetTabIndex: number
): Promise<{ ok: boolean; reason?: string; report: ChatFocusReport }> {
  const relativeResult = await steerActiveGroupToTabRelative(chatInterop, commands, report, targetTabIndex);
  if (relativeResult.ok) {
    return relativeResult;
  }

  const tabCommand = findOpenEditorAtIndexCommand(commands, targetTabIndex);
  if (!tabCommand) {
    return {
      ok: false,
      reason: relativeResult.reason ?? `The requested editor chat tab is at tab index ${targetTabIndex}, but this build does not expose a supported tab-navigation command for that tab. Run Inspect Chat Focus Targets to inspect the current tab layout.`,
      report: relativeResult.report
    };
  }

  await vscode.commands.executeCommand(tabCommand);
  await wait(120);

  return {
    ok: true,
    report: captureCurrentChatFocusReport(await chatInterop.listChats())
  };
}

async function steerActiveGroupToTabRelative(
  chatInterop: Pick<ChatInteropApi, "listChats">,
  commands: readonly string[],
  report: ChatFocusReport,
  targetTabIndex: number
): Promise<{ ok: boolean; reason?: string; report: ChatFocusReport }> {
  let currentReport = report;
  let activeGroup = currentReport.groups[currentReport.activeGroupIndex];
  let activeTabIndex = activeGroup?.tabs.findIndex((tab) => tab.isActive) ?? -1;

  if (!activeGroup || activeTabIndex < 0 || activeTabIndex === targetTabIndex) {
    return { ok: true, report: currentReport };
  }

  const moveForward = targetTabIndex > activeTabIndex;
  const relativeCommand = moveForward
    ? findNextEditorInGroupCommand(commands)
    : findPreviousEditorInGroupCommand(commands);

  if (!relativeCommand) {
    return {
      ok: false,
      reason: `The requested editor chat tab is at tab index ${targetTabIndex}, but this build does not expose a supported ${moveForward ? "next" : "previous"}-editor-in-group command for relative tab steering. Run Inspect Chat Focus Targets to inspect the current tab layout.`,
      report: currentReport
    };
  }

  const steps = Math.abs(targetTabIndex - activeTabIndex);
  for (let completedSteps = 0; completedSteps < steps; completedSteps += 1) {
    await vscode.commands.executeCommand(relativeCommand);
    await wait(120);
    currentReport = captureCurrentChatFocusReport(await chatInterop.listChats());
    activeGroup = currentReport.groups[currentReport.activeGroupIndex];
    activeTabIndex = activeGroup?.tabs.findIndex((tab) => tab.isActive) ?? -1;
    if (activeTabIndex === targetTabIndex) {
      return { ok: true, report: currentReport };
    }
  }

  return {
    ok: false,
    reason: `Relative editor-tab steering did not reach tab index ${targetTabIndex}. Run Inspect Chat Focus Targets to inspect the current tab layout.`,
    report: currentReport
  };
}