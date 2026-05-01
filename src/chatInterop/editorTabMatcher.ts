import {
  isLikelyEditorChatTab,
  matchesChatFocusTargetTitle,
  summarizeTabInput,
  type ChatFocusTabLike,
  type ChatFocusTabSummary
} from "./focusTargets";
import { toLocalChatSessionResourceString } from "./sessionResource";

export interface LocalChatTabMatchRequest {
  sessionId: string;
  sessionTitle: string;
}

export function isMatchingLocalChatEditorTab(
  tab: Pick<ChatFocusTabLike, "label" | "input">,
  request: LocalChatTabMatchRequest
): boolean {
  const input = summarizeTabInput(tab.input);
  const resourceValues = [input.uri, ...input.stringHints].filter((value): value is string => Boolean(value));
  const targetResource = normalize(toLocalChatSessionResourceString(request.sessionId));
  const hasAnyLocalSessionResource = resourceValues.some((value) => normalize(value).includes("vscode-chat-session://local/"));
  if (resourceValues.some((value) => normalize(value).includes(targetResource))) {
    return true;
  }

  if (hasAnyLocalSessionResource) {
    return false;
  }

  if (isDefinitelyNonChatEditorInput(input)) {
    return false;
  }

  if (!isLikelyEditorChatTab(tab, [request.sessionTitle])) {
    return false;
  }

  return matchesChatFocusTargetTitle(toChatFocusTabSummary(tab, input), request.sessionTitle);
}

function toChatFocusTabSummary(
  tab: Pick<ChatFocusTabLike, "label">,
  input: ReturnType<typeof summarizeTabInput>
): ChatFocusTabSummary {
  return {
    label: tab.label,
    isActive: false,
    isDirty: false,
    isPinned: false,
    isPreview: false,
    isLikelyChatEditor: true,
    input
  };
}

function normalize(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function isDefinitelyNonChatEditorInput(input: ReturnType<typeof summarizeTabInput>): boolean {
  const normalizedKind = normalize(input.kind);
  const normalizedConstructor = normalize(input.constructorName);
  const normalizedUri = normalize(input.uri);

  if (normalizedUri.startsWith("file:") || normalizedUri.startsWith("untitled:") || normalizedUri.startsWith("git:")) {
    return true;
  }

  return [normalizedKind, normalizedConstructor].some((value) =>
    value === "tabinputtext"
      || value === "tabinputtextdiff"
      || value === "tabinputnotebook"
      || value === "tabinputnotebookdiff"
  );
}