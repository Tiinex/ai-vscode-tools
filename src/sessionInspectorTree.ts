import * as vscode from "vscode";
import type { ExactSessionInteropSupport } from "./chatInterop/capabilities";
import type { CopilotCliSessionDescriptor } from "./chatInterop/copilotCliDebug";
import type { SessionDescriptor, SessionToolingAdapter } from "./coreAdapter";
import { describeCopilotCliSessionStateRoot, renderMissingCopilotCliSessionsMessage } from "./tooling/copilot-cli";

type InspectorNode = SessionGroupNode | SessionNode | CopilotCliSessionNode | ActionNode | UnsupportedInfoNode | EmptyInfoNode;

interface SessionActionDefinition {
  label: string;
  command: string;
  tooltip: string;
  icon: vscode.ThemeIcon;
  requires?: "exact-reveal" | "exact-send";
}

const SESSION_ACTIONS: SessionActionDefinition[] = [
  {
    label: "Prepare Local To Copilot CLI Handoff",
    command: "agentArchitectTools.prepareLocalToCopilotCliHandoff",
    tooltip: "Render a provenance-safe Local-to-Copilot-CLI handoff package for this incident session.",
    icon: new vscode.ThemeIcon("arrow-swap")
  },
  {
    label: "Send Local To Copilot CLI",
    command: "agentArchitectTools.sendLocalToCopilotCliHandoff",
    tooltip: "Build the Local-to-Copilot-CLI handoff payload and send it to a selected Copilot CLI lane.",
    icon: new vscode.ThemeIcon("send")
  },
  {
    label: "Reveal Live Chat",
    command: "agentArchitectTools.revealLiveChat",
    tooltip: "Exact-session Local reveal command. This closes a matching already-open editor chat tab first when needed, then re-opens the selected live VS Code chat session so current persisted state reloads.",
    icon: new vscode.ThemeIcon("comment-discussion"),
    requires: "exact-reveal"
  },
  {
    label: "Send Message To Live Chat (Exact Session)",
    command: "agentArchitectTools.sendMessageToLiveChat",
    tooltip: "Session-targeted Local follow-up command. It uses exact-session send when the host exposes it; otherwise it falls back to exact reveal of the selected session followed by verified editor-focused submit.",
    icon: new vscode.ThemeIcon("send"),
  },
  {
    label: "Focus Visible Editor Chat",
    command: "agentArchitectTools.focusVisibleEditorLiveChat",
    tooltip: "Best-effort Local fallback. This tries to focus a visible editor-hosted chat tab matching the selected session without sending a prompt.",
    icon: new vscode.ThemeIcon("target")
  },
  {
    label: "Send Message To Visible Editor Chat",
    command: "agentArchitectTools.sendMessageToFocusedEditorChat",
    tooltip: "Best-effort Local fallback. This tries to focus a visible editor-hosted chat tab matching the selected session before submit.",
    icon: new vscode.ThemeIcon("send")
  },
  {
    label: "Open Evidence Transcript",
    command: "agentArchitectTools.openTranscriptEvidence",
    tooltip: "Render the canonical transcript-based evidence markdown for this session.",
    icon: new vscode.ThemeIcon("book")
  },
  {
    label: "Open Snapshot",
    command: "agentArchitectTools.openSnapshot",
    tooltip: "Render a bounded session snapshot markdown document.",
    icon: new vscode.ThemeIcon("preview")
  },
  {
    label: "Open Context Estimate",
    command: "agentArchitectTools.openContextEstimate",
    tooltip: "Render the current bounded context estimate markdown document.",
    icon: new vscode.ThemeIcon("graph")
  },
  {
    label: "Open Profile",
    command: "agentArchitectTools.openProfile",
    tooltip: "Render findings-first session diagnostics.",
    icon: new vscode.ThemeIcon("pulse")
  },
  {
    label: "Open Tail Index",
    command: "agentArchitectTools.openIndex",
    tooltip: "Render a bounded trailing index of recent persisted rows.",
    icon: new vscode.ThemeIcon("list-tree")
  },
  {
    label: "Open Session File",
    command: "agentArchitectTools.openSessionFile",
    tooltip: "Open the underlying chat session JSONL file, or a bounded raw preview when the file is too large for direct extension-host opening.",
    icon: new vscode.ThemeIcon("go-to-file")
  }
];

export class SessionInspectorTreeDataProvider implements vscode.TreeDataProvider<InspectorNode>, vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<InspectorNode | undefined | void>();
  private supportPromise: Promise<ExactSessionInteropSupport> | undefined;
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(
    private readonly adapter: SessionToolingAdapter,
    private readonly getStorageRoots: () => string[] | undefined,
    private readonly getExactSessionInteropSupport: () => Promise<ExactSessionInteropSupport>,
    private readonly listCopilotCliSessions: () => Promise<CopilotCliSessionDescriptor[]>
  ) {}

  dispose(): void {
    this.changeEmitter.dispose();
  }

  refresh(): void {
    this.changeEmitter.fire();
  }

  async getChildren(element?: InspectorNode): Promise<InspectorNode[]> {
    if (!element) {
      return [
        new SessionGroupNode("local", "Local Sessions", "workspaceStorage and emptyWindow persistence"),
        new SessionGroupNode("copilot-cli", "Copilot CLI Sessions", describeCopilotCliSessionStateRoot())
      ];
    }
    if (element instanceof SessionGroupNode) {
      if (element.kind === "local") {
        const sessions = await this.adapter.discoverSessions(this.getStorageRoots() ?? []);
        if (sessions.length === 0) {
          return [new EmptyInfoNode("No Local Sessions", "No stored Local chat sessions were found under the selected storage roots.")];
        }
        return sessions.slice(0, 12).map((session, index) => new SessionNode(session, index === 0));
      }
      const sessions = await this.listCopilotCliSessions();
      if (sessions.length === 0) {
        return [new EmptyInfoNode("No Copilot CLI Sessions", renderMissingCopilotCliSessionsMessage())];
      }
      return sessions.slice(0, 12).map((session, index) => new CopilotCliSessionNode(session, index === 0));
    }
    if (element instanceof SessionNode) {
      const support = await this.getCachedSupport();
      const actions = SESSION_ACTIONS
        .filter((action) => isActionSupported(action, support))
        .map((action) => new ActionNode(element.session, action));
      const reasons = [support.revealUnsupportedReason, support.sendUnsupportedReason].filter(uniqueTruthyStrings);
      if (reasons.length > 0) {
        return [new UnsupportedInfoNode(reasons), ...actions];
      }
      return actions;
    }
    if (element instanceof CopilotCliSessionNode) {
      return [
        new ActionNode(element.session, {
          label: "Inspect Copilot CLI Session",
          command: "agentArchitectTools.inspectCopilotCliSession",
          tooltip: "Open a bounded markdown summary for this Copilot CLI session-state entry.",
          icon: new vscode.ThemeIcon("preview")
        }),
        new ActionNode(element.session, {
          label: "Open Copilot CLI Events File",
          command: "agentArchitectTools.openCopilotCliEventsFile",
          tooltip: "Open the underlying events.jsonl file for this Copilot CLI session.",
          icon: new vscode.ThemeIcon("go-to-file")
        }),
        new ActionNode(element.session, {
          label: "Open Copilot CLI Workspace YAML",
          command: "agentArchitectTools.openCopilotCliWorkspaceYaml",
          tooltip: "Open workspace.yaml for this Copilot CLI session when present.",
          icon: new vscode.ThemeIcon("file-code")
        })
      ];
    }
    return [];
  }

  getTreeItem(element: InspectorNode): vscode.TreeItem {
    return element.toTreeItem();
  }

  private getCachedSupport(): Promise<ExactSessionInteropSupport> {
    this.supportPromise ??= this.getExactSessionInteropSupport();
    return this.supportPromise;
  }
}

class SessionGroupNode {
  constructor(
    readonly kind: "local" | "copilot-cli",
    private readonly label: string,
    private readonly description: string
  ) {}

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.label, vscode.TreeItemCollapsibleState.Expanded);
    item.contextValue = "sessionGroup";
    item.description = this.description;
    item.iconPath = new vscode.ThemeIcon(this.kind === "local" ? "comment-discussion" : "terminal-bash");
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

class CopilotCliSessionNode {
  constructor(readonly session: CopilotCliSessionDescriptor, private readonly isLatest: boolean) {}

  toTreeItem(): vscode.TreeItem {
    const label = this.session.summary?.trim() || this.session.cwd?.trim() || this.session.sessionId;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
    item.contextValue = "copilotCliSession";
    item.description = this.isLatest ? `latest | ${this.session.sessionId}` : this.session.sessionId;
    item.tooltip = [
      this.session.summary ? `Summary: ${this.session.summary}` : undefined,
      this.session.cwd ? `CWD: ${this.session.cwd}` : undefined,
      `Session ID: ${this.session.sessionId}`,
      this.session.eventsPath,
      `Modified: ${new Date(this.session.mtime).toLocaleString()}`,
      `Size: ${this.session.size} bytes`,
      `Resource: ${this.session.canonicalResource}`
    ].filter((line): line is string => Boolean(line)).join("\n");
    item.iconPath = new vscode.ThemeIcon("terminal-bash");
    return item;
  }
}

class ActionNode {
  constructor(readonly target: SessionDescriptor | CopilotCliSessionDescriptor, private readonly action: SessionActionDefinition) {}

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

class UnsupportedInfoNode {
  constructor(private readonly reasons: string[]) {}

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem("Live Chat Targeting Unsupported", vscode.TreeItemCollapsibleState.None);
    item.contextValue = "sessionInfo";
    item.tooltip = this.reasons.join("\n\n");
    item.description = "current build limitation";
    item.iconPath = new vscode.ThemeIcon("warning");
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

function isActionSupported(action: SessionActionDefinition, support: ExactSessionInteropSupport): boolean {
  if (action.requires === "exact-reveal") {
    return support.canRevealExactSession;
  }
  if (action.requires === "exact-send") {
    return support.canSendExactSessionMessage;
  }
  return true;
}

function uniqueTruthyStrings(value: string | undefined, index: number, values: Array<string | undefined>): value is string {
  return Boolean(value) && values.indexOf(value) === index;
}