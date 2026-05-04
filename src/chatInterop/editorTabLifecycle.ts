import * as vscode from "vscode";
import { getLocalChatEditorTabMatchKind, type LocalChatTabMatchRequest } from "./editorTabMatcher";

export interface CloseVisibleEditorChatTabsResult {
  closedCount: number;
  closedLabels: string[];
}

export interface VisibleEditorChatTabsInspectionResult {
  resourceMatchCount: number;
  resourceMatchLabels: string[];
  titleOnlyMatchCount: number;
  titleOnlyMatchLabels: string[];
}

interface MatchedTabGroups {
  resourceMatches: vscode.Tab[];
  titleOnlyMatches: vscode.Tab[];
}

export function inspectVisibleEditorChatTabsForSession(
  request: LocalChatTabMatchRequest
): VisibleEditorChatTabsInspectionResult {
  const { resourceMatches, titleOnlyMatches } = collectMatchingTabs(request);
  return {
    resourceMatchCount: resourceMatches.length,
    resourceMatchLabels: [...new Set(resourceMatches.map((tab) => tab.label))],
    titleOnlyMatchCount: titleOnlyMatches.length,
    titleOnlyMatchLabels: [...new Set(titleOnlyMatches.map((tab) => tab.label))]
  };
}

export async function closeVisibleEditorChatTabsForSession(
  request: LocalChatTabMatchRequest
): Promise<CloseVisibleEditorChatTabsResult> {
  const { resourceMatches, titleOnlyMatches } = collectMatchingTabs(request);
  const matchingTabs = request.matchMode === "resource-only"
    ? resourceMatches
    : [...resourceMatches, ...titleOnlyMatches];

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

function collectMatchingTabs(request: LocalChatTabMatchRequest): MatchedTabGroups {
  const resourceMatches: vscode.Tab[] = [];
  const titleOnlyMatches: vscode.Tab[] = [];

  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const matchKind = getLocalChatEditorTabMatchKind(
        {
          label: tab.label,
          input: tab.input
        },
        request
      );

      if (matchKind === "resource") {
        resourceMatches.push(tab);
      } else if (matchKind === "title") {
        titleOnlyMatches.push(tab);
      }
    }
  }

  return {
    resourceMatches,
    titleOnlyMatches
  };
}