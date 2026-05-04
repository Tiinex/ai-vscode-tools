import * as vscode from "vscode";
import type { SessionDescriptor, SessionToolingAdapter } from "./coreAdapter";
import { isEnabledSessionCommand } from "./firstSlice";

type InspectorNode = SessionGroupNode | SessionNode | ActionNode | EmptyInfoNode;

interface SessionActionDefinition {
  label: string;
  command: string;
  tooltip: string;
  icon: vscode.ThemeIcon;
}

const SESSION_ACTIONS: SessionActionDefinition[] = [
  {
    label: "Open Evidence Transcript",
    command: "aiRecoveryTooling.openTranscriptEvidence",
    tooltip: "Render the canonical transcript-based evidence markdown for this session.",
    icon: new vscode.ThemeIcon("book")
  },
  {
    label: "Open Snapshot",
    command: "aiRecoveryTooling.openSnapshot",
    tooltip: "Render a bounded session snapshot markdown document.",
    icon: new vscode.ThemeIcon("preview")
  },
  {
    label: "Open Context Estimate",
    command: "aiRecoveryTooling.openContextEstimate",
    tooltip: "Render the current bounded context estimate markdown document.",
    icon: new vscode.ThemeIcon("graph")
  },
  {
    label: "Open Profile",
    command: "aiRecoveryTooling.openProfile",
    tooltip: "Render findings-first session diagnostics.",
    icon: new vscode.ThemeIcon("pulse")
  },
  {
    label: "Open Tail Index",
    command: "aiRecoveryTooling.openIndex",
    tooltip: "Render a bounded trailing index of recent persisted rows.",
    icon: new vscode.ThemeIcon("list-tree")
  },
  {
    label: "Open Raw Session File (Last Resort)",
    command: "aiRecoveryTooling.openSessionFile",
    tooltip: "Open the underlying chat session JSONL file, or a bounded raw preview when the file is too large for direct extension-host opening. Prefer transcript, snapshot, index, profile, or context views first.",
    icon: new vscode.ThemeIcon("go-to-file")
  },
  {
    label: "Reveal Local Chat",
    command: "aiRecoveryTooling.revealLiveChat",
    tooltip: "Reveal the matching Local chat session when the host exposes an exact-session Local reveal command.",
    icon: new vscode.ThemeIcon("comment-discussion")
  },
  {
    label: "Close Visible Chat Tabs",
    command: "aiRecoveryTooling.closeVisibleLiveChatTabs",
    tooltip: "Close visible editor-hosted chat tabs that match this Local session.",
    icon: new vscode.ThemeIcon("close-all")
  },
  {
    label: "Delete Local Chat Artifacts",
    command: "aiRecoveryTooling.deleteLiveChatArtifacts",
    tooltip: "Close visible editor-hosted chat tabs for this Local session and delete its persisted session, transcript, and resource artifacts from disk.",
    icon: new vscode.ThemeIcon("trash")
  },
  {
    label: "Send Message To Local Chat",
    command: "aiRecoveryTooling.sendMessageToLiveChat",
    tooltip: "Send a follow-up message to this Local chat session, using exact send when available or reveal plus focused-send fallback when needed.",
    icon: new vscode.ThemeIcon("send")
  }
];

export class SessionInspectorTreeDataProvider implements vscode.TreeDataProvider<InspectorNode>, vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<InspectorNode | undefined | void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(
    private readonly adapter: SessionToolingAdapter,
    private readonly getStorageRoots: () => string[] | undefined
  ) {}

  dispose(): void {
    this.changeEmitter.dispose();
  }

  refresh(): void {
    this.changeEmitter.fire();
  }

  async getChildren(element?: InspectorNode): Promise<InspectorNode[]> {
    if (!element) {
      return [new SessionGroupNode("local", "Local Sessions", "workspaceStorage and emptyWindow persistence")];
    }
    if (element instanceof SessionGroupNode) {
      const sessions = await this.adapter.discoverSessions(this.getStorageRoots() ?? []);
      if (sessions.length === 0) {
        return [new EmptyInfoNode("No Local Sessions", "No stored Local chat sessions were found under the selected storage roots.")];
      }
      return sessions.slice(0, 12).map((session, index) => new SessionNode(session, index === 0));
    }
    if (element instanceof SessionNode) {
      return SESSION_ACTIONS
        .filter((action) => isEnabledSessionCommand(action.command))
        .map((action) => new ActionNode(element.session, action));
    }
    return [];
  }

  getTreeItem(element: InspectorNode): vscode.TreeItem {
    return element.toTreeItem();
  }

}

class SessionGroupNode {
  constructor(
    readonly kind: "local",
    private readonly label: string,
    private readonly description: string
  ) {}

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.label, vscode.TreeItemCollapsibleState.Expanded);
    item.contextValue = "sessionGroup";
    item.description = this.description;
    item.iconPath = new vscode.ThemeIcon("comment-discussion");
    return item;
  }
}

class SessionNode {
  constructor(readonly session: SessionDescriptor, private readonly isLatest: boolean) {}

  toTreeItem(): vscode.TreeItem {
    const label = this.session.title?.trim() || this.session.sessionId;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
    item.contextValue = "session";
    item.description = this.isLatest ? `latest | ${this.session.sessionId}` : this.session.sessionId;
    item.tooltip = [
      this.session.title ? `Title: ${this.session.title}` : undefined,
      `Session ID: ${this.session.sessionId}`,
      this.session.jsonlPath,
      `Modified: ${new Date(this.session.mtime).toLocaleString()}`,
      `Size: ${this.session.size} bytes`
    ].filter((line): line is string => Boolean(line)).join("\n");
    item.iconPath = new vscode.ThemeIcon("comment-discussion");
    return item;
  }
}

class ActionNode {
  constructor(readonly target: SessionDescriptor, private readonly action: SessionActionDefinition) {}

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.action.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = "sessionAction";
    item.tooltip = this.action.tooltip;
    item.iconPath = this.action.icon;
    item.command = {
      command: this.action.command,
      title: this.action.label,
      arguments: [this.target]
    };
    return item;
  }
}

class EmptyInfoNode {
  constructor(private readonly label: string, private readonly detail: string) {}

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = "sessionInfo";
    item.tooltip = this.detail;
    item.description = "none found";
    item.iconPath = new vscode.ThemeIcon("info");
    return item;
  }
}