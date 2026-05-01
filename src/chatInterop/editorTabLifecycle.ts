import * as vscode from "vscode";
import { isMatchingLocalChatEditorTab, type LocalChatTabMatchRequest } from "./editorTabMatcher";

export interface CloseVisibleEditorChatTabsResult {
  closedCount: number;
  closedLabels: string[];
}

export async function closeVisibleEditorChatTabsForSession(
  request: LocalChatTabMatchRequest
): Promise<CloseVisibleEditorChatTabsResult> {
  const matchingTabs = vscode.window.tabGroups.all.flatMap((group) =>
    group.tabs.filter((tab) =>
      isMatchingLocalChatEditorTab(
        {
          label: tab.label,
          input: tab.input
        },
        request
      )
    )
  );

  if (matchingTabs.length === 0) {
    return {
      closedCount: 0,
      closedLabels: []
    };
  }

  await vscode.window.tabGroups.close(matchingTabs, true);
  return {
    closedCount: matchingTabs.length,
    closedLabels: [...new Set(matchingTabs.map((tab) => tab.label))]
  };
}