import type { ChatSessionSummary } from "./types";

export interface ChatFocusTabLike {
  label: string;
  isActive: boolean;
  isDirty?: boolean;
  isPinned?: boolean;
  isPreview?: boolean;
  input?: unknown;
}

export interface ChatFocusGroupLike {
  isActive: boolean;
  viewColumn?: string | number;
  tabs: readonly ChatFocusTabLike[];
}

export interface ChatFocusInputSummary {
  kind: string;
  constructorName?: string;
  uri?: string;
  viewType?: string;
  stringHints: string[];
  objectKeys: string[];
}

export interface ChatFocusTabSummary {
  label: string;
  isActive: boolean;
  isDirty: boolean;
  isPinned: boolean;
  isPreview: boolean;
  isLikelyChatEditor: boolean;
  input: ChatFocusInputSummary;
}

export interface ChatFocusGroupSummary {
  isActive: boolean;
  viewColumn?: string | number;
  tabs: ChatFocusTabSummary[];
}

export interface ChatFocusReport {
  activeGroupIndex: number;
  liveChatTitles: string[];
  groups: ChatFocusGroupSummary[];
}

export interface EditorChatTargetCandidate {
  groupIndex: number;
  tabIndex: number;
  tab: ChatFocusTabSummary;
}

export type ChatFocusDebugDetailLevel = "summary" | "full";

export function summarizeChatFocusGroups(
  groups: readonly ChatFocusGroupLike[],
  liveChats: readonly ChatSessionSummary[]
): ChatFocusReport {
  const liveChatTitles = liveChats.map((chat) => chat.title);

  return {
    activeGroupIndex: Math.max(0, groups.findIndex((group) => group.isActive)),
    liveChatTitles,
    groups: groups.map((group) => ({
      isActive: group.isActive,
      viewColumn: group.viewColumn,
      tabs: group.tabs.map((tab) => ({
        label: tab.label,
        isActive: tab.isActive,
        isDirty: tab.isDirty === true,
        isPinned: tab.isPinned === true,
        isPreview: tab.isPreview === true,
        isLikelyChatEditor: isLikelyEditorChatTab(tab, liveChatTitles),
        input: summarizeTabInput(tab.input)
      }))
    }))
  };
}

export function isLikelyEditorChatTab(tab: Pick<ChatFocusTabLike, "label" | "input">, liveChatTitles: readonly string[]): boolean {
  const normalizedLabel = normalize(tab.label);
  if (liveChatTitles.some((title) => normalize(title) === normalizedLabel)) {
    return true;
  }

  const input = summarizeTabInput(tab.input);
  return [input.kind, input.constructorName, input.uri, input.viewType, ...input.stringHints].some((value) => normalize(value).includes("chat"));
}

export function findEditorChatTargetCandidate(report: ChatFocusReport, targetTitle?: string): EditorChatTargetCandidate | undefined {
  const normalizedTargetTitle = normalize(targetTitle);
  const candidates: EditorChatTargetCandidate[] = [];

  for (const [groupIndex, group] of report.groups.entries()) {
    for (const [tabIndex, tab] of group.tabs.entries()) {
      if (!tab.isLikelyChatEditor) {
        continue;
      }
      candidates.push({ groupIndex, tabIndex, tab });
    }
  }

  if (candidates.length === 0) {
    return undefined;
  }

  if (normalizedTargetTitle) {
    const titleMatches = candidates.filter((candidate) => matchesChatFocusTargetTitle(candidate.tab, normalizedTargetTitle));
    if (titleMatches.length === 0) {
      return undefined;
    }
    return preferActiveCandidate(titleMatches, report.activeGroupIndex);
  }

  return preferActiveCandidate(candidates, report.activeGroupIndex);
}

export function summarizeTabInput(input: unknown): ChatFocusInputSummary {
  const record = asRecord(input);
  const constructorName = typeof record?.constructor?.name === "string" ? record.constructor.name : undefined;
  const viewType = typeof record?.viewType === "string" ? record.viewType : undefined;
  const uri = stringifyUri(record?.uri);
  const stringHints = collectStringHints(input);

  return {
    kind: viewType ? `custom:${viewType}` : constructorName ?? typeof input,
    constructorName,
    uri,
    viewType,
    stringHints,
    objectKeys: listObjectKeys(input)
  };
}

export function renderChatFocusReportMarkdown(report: ChatFocusReport): string {
  const lines = [
    "# Chat Focus Targets",
    "",
    `- Active tab group index: ${report.activeGroupIndex}`,
    `- Live chat titles known from storage: ${report.liveChatTitles.length}`,
    ...report.liveChatTitles.map((title) => `  - ${title}`),
    "",
    "## Tab Groups"
  ];

  for (const [groupIndex, group] of report.groups.entries()) {
    lines.push(`- Group ${groupIndex} | active=${yesNo(group.isActive)} | viewColumn=${group.viewColumn ?? "-"}`);
    if (group.tabs.length === 0) {
      lines.push("  - <no tabs>");
      continue;
    }

    for (const [tabIndex, tab] of group.tabs.entries()) {
      lines.push(
        `  - Tab ${tabIndex} | active=${yesNo(tab.isActive)} | likelyChatEditor=${yesNo(tab.isLikelyChatEditor)} | label=${JSON.stringify(tab.label)} | kind=${tab.input.kind} | viewType=${tab.input.viewType ?? "-"} | uri=${tab.input.uri ?? "-"}`
      );
      if (tab.input.stringHints.length > 0) {
        lines.push(`    hints=${tab.input.stringHints.map((value) => JSON.stringify(value)).join(", ")}`);
      }
    }
  }

  lines.push(
    "",
    "## Interpretation",
    "- This report is derived from VS Code tab-group state plus live-chat titles discovered from persisted Local session storage.",
    "- A tab marked likelyChatEditor matched either a known Local chat title or chat-like input metadata such as viewType, uri, or constructor name.",
    "- The editor-focused send path can only be trusted when the active editor-group tab is marked likelyChatEditor after focusing the editor group."
  );

  return `${lines.join("\n")}\n`;
}

export function renderChatFocusDebugMarkdown(
  report: ChatFocusReport,
  options: { detailLevel?: ChatFocusDebugDetailLevel } = {}
): string {
  const detailLevel = options.detailLevel ?? "full";
  if (detailLevel === "summary") {
    const activeGroup = report.groups[report.activeGroupIndex];
    const activeTab = activeGroup?.tabs.find((tab) => tab.isActive);
    const likelyTabs = report.groups.flatMap((group, groupIndex) =>
      group.tabs.flatMap((tab, tabIndex) => tab.isLikelyChatEditor ? [{ groupIndex, tabIndex, tab }] : [])
    );

    const lines = [
      "# Chat Focus Debug",
      "",
      `- Active tab group index: ${report.activeGroupIndex}`,
      `- Active tab label: ${activeTab ? JSON.stringify(activeTab.label) : "-"}`,
      `- Likely chat-editor tabs: ${likelyTabs.length}`,
      "",
      "## Likely Chat Tabs"
    ];

    if (likelyTabs.length === 0) {
      lines.push("- No visible tab currently looks like an editor-hosted chat.");
    } else {
      for (const candidate of likelyTabs) {
        lines.push(
          `- Group ${candidate.groupIndex} Tab ${candidate.tabIndex} | active=${yesNo(candidate.tab.isActive)} | label=${JSON.stringify(candidate.tab.label)} | kind=${candidate.tab.input.kind} | viewType=${candidate.tab.input.viewType ?? "-"} | uri=${candidate.tab.input.uri ?? "-"}`
        );
      }
    }

    lines.push(
      "",
      "## Interpretation",
      "- This compact debug view is intended for agent-facing triage when you only need the likely chat-editor candidates.",
      "- Request detailLevel=full when you need raw objectKeys and stringHints for every tab in every group.",
      "- If the likely-chat list is empty, the blocker is usually missing chat-like metadata on the visible tab inputs rather than missing persisted session titles alone."
    );

    return `${lines.join("\n")}\n`;
  }

  const lines = [
    "# Chat Focus Debug",
    "",
    `- Active tab group index: ${report.activeGroupIndex}`,
    "",
    "## Tab Groups"
  ];

  for (const [groupIndex, group] of report.groups.entries()) {
    lines.push(`- Group ${groupIndex} | active=${yesNo(group.isActive)} | viewColumn=${group.viewColumn ?? "-"}`);
    if (group.tabs.length === 0) {
      lines.push("  - <no tabs>");
      continue;
    }

    for (const [tabIndex, tab] of group.tabs.entries()) {
      lines.push(`  - Tab ${tabIndex} | active=${yesNo(tab.isActive)} | label=${JSON.stringify(tab.label)}`);
      lines.push(`    kind=${tab.input.kind}`);
      lines.push(`    constructor=${tab.input.constructorName ?? "-"}`);
      lines.push(`    viewType=${tab.input.viewType ?? "-"}`);
      lines.push(`    uri=${tab.input.uri ?? "-"}`);
      lines.push(`    likelyChatEditor=${yesNo(tab.isLikelyChatEditor)}`);
      lines.push(`    objectKeys=${tab.input.objectKeys.length > 0 ? tab.input.objectKeys.join(", ") : "-"}`);
      lines.push(`    stringHints=${tab.input.stringHints.length > 0 ? tab.input.stringHints.map((value) => JSON.stringify(value)).join(", ") : "-"}`);
    }
  }

  lines.push(
    "",
    "## Interpretation",
    "- Use this debug report when a visible editor chat is present in the UI but cannot be matched to a persisted Local session title.",
    "- objectKeys and stringHints come from shallow reflective inspection of the VS Code tab input object that extension-host APIs expose on this build.",
    "- If the target title is absent from both the tab label and stringHints, the blocker is likely missing tab metadata rather than the focus command itself."
  );

  return `${lines.join("\n")}\n`;
}

function asRecord(value: unknown): Record<string, any> | undefined {
  return value && typeof value === "object" ? value as Record<string, any> : undefined;
}

function normalize(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function stringifyUri(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof (value as { toString?: () => string }).toString === "function") {
    const rendered = (value as { toString: () => string }).toString();
    return rendered && rendered !== "[object Object]" ? rendered : undefined;
  }
  return undefined;
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

export function matchesChatFocusTargetTitle(tab: ChatFocusTabSummary, targetTitle: string): boolean {
  const normalizedTargetTitle = normalize(targetTitle);
  const normalizedLabel = normalize(tab.label);
  if (normalizedLabel === normalizedTargetTitle) {
    return true;
  }

  const labelAliases = buildTitleAliases(tab.label);
  if (labelAliases.has(normalizedTargetTitle)) {
    return true;
  }

  const targetAliases = buildTitleAliases(normalizedTargetTitle);
  if ([...labelAliases].some((alias) => targetAliases.has(alias))) {
    return true;
  }

  return tab.input.stringHints.some((value) => {
    const normalizedHint = normalize(value);
    if (normalizedHint.includes(normalizedTargetTitle)) {
      return true;
    }
    const hintAliases = buildTitleAliases(normalizedHint);
    return [...hintAliases].some((alias) => targetAliases.has(alias));
  });
}

function buildTitleAliases(value: string): Set<string> {
  const aliases = new Set<string>();
  const normalizedValue = normalize(value);
  if (!normalizedValue) {
    return aliases;
  }

  aliases.add(normalizedValue);

  const withoutKnownPrefix = normalizedValue
    .replace(/^(local|copilot cli|cloud)\s+/, "")
    .trim();
  if (withoutKnownPrefix) {
    aliases.add(withoutKnownPrefix);
  }

  const withoutGenericChatWords = withoutKnownPrefix
    .replace(/\b(chat|session|request)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutGenericChatWords) {
    aliases.add(withoutGenericChatWords);
  }

  return aliases;
}

function collectStringHints(input: unknown, maxHints = 12): string[] {
  const hints: string[] = [];
  const seen = new Set<unknown>();

  function visit(value: unknown, prefix: string, depth: number): void {
    if (hints.length >= maxHints || value == null) {
      return;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }
      hints.push(prefix ? `${prefix}=${trimmed}` : trimmed);
      return;
    }
    if (typeof value !== "object" || depth <= 0 || seen.has(value)) {
      return;
    }

    seen.add(value);
    const record = asRecord(value);
    if (!record) {
      return;
    }

    for (const [key, child] of Object.entries(record)) {
      if (key === "constructor") {
        continue;
      }
      visit(child, prefix ? `${prefix}.${key}` : key, depth - 1);
      if (hints.length >= maxHints) {
        return;
      }
    }
  }

  visit(input, "", 2);
  return dedupePreserveOrder(hints);
}

function dedupePreserveOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    deduped.push(value);
  }
  return deduped;
}

function listObjectKeys(input: unknown): string[] {
  const record = asRecord(input);
  return record ? Object.keys(record).filter((key) => key !== "constructor").sort() : [];
}

function preferActiveCandidate(candidates: readonly EditorChatTargetCandidate[], activeGroupIndex: number): EditorChatTargetCandidate {
  return candidates.find((candidate) => candidate.groupIndex === activeGroupIndex && candidate.tab.isActive)
    ?? candidates.find((candidate) => candidate.tab.isActive)
    ?? candidates.find((candidate) => candidate.groupIndex === activeGroupIndex)
    ?? candidates[0];
}