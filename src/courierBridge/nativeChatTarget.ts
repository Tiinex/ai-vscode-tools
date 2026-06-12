import * as vscode from 'vscode';

export async function tryAttachFileToNativeChat(filePath: string): Promise<{
  ok: boolean;
  commandId?: string;
  argShape?: "uri-array" | "uri" | "object" | "unknown";
  attempts: Array<{ commandId: string; argShape: string; ok: boolean; error?: string }>;
}> {
  const attempts: Array<{ commandId: string; argShape: string; ok: boolean; error?: string }> = [];
  try {
    const available = new Set(await vscode.commands.getCommands(true));
    const candidates = [
      'workbench.action.chat.addFiles',
      'workbench.action.chat.addFile',
      'workbench.action.chat.attachFile',
      'workbench.action.chat.addFileToChat'
    ];

    const uri = vscode.Uri.file(filePath);

    for (const id of candidates) {
      if (!available.has(id)) continue;
      // Try array form
      try {
        await vscode.commands.executeCommand(id, [uri]);
        attempts.push({ commandId: id, argShape: 'uri-array', ok: true });
        return { ok: true, commandId: id, argShape: 'uri-array', attempts };
      } catch (err) {
        attempts.push({ commandId: id, argShape: 'uri-array', ok: false, error: String(err) });
      }

      // Try single uri
      try {
        await vscode.commands.executeCommand(id, uri);
        attempts.push({ commandId: id, argShape: 'uri', ok: true });
        return { ok: true, commandId: id, argShape: 'uri', attempts };
      } catch (err) {
        attempts.push({ commandId: id, argShape: 'uri', ok: false, error: String(err) });
      }

      // Try object shape
      try {
        await vscode.commands.executeCommand(id, { files: [uri] });
        attempts.push({ commandId: id, argShape: 'object', ok: true });
        return { ok: true, commandId: id, argShape: 'object', attempts };
      } catch (err) {
        attempts.push({ commandId: id, argShape: 'object', ok: false, error: String(err) });
      }
    }

    // Also scan for other commands that look promising and try a single pass
    const regex = /^(workbench\.action\.chat\..*(file|attach)|github\.copilot\.chat\..*(file|attach))/i;
    for (const id of Array.from(available)) {
      if (!regex.test(id)) continue;
      try {
        await vscode.commands.executeCommand(id, [uri]);
        attempts.push({ commandId: id, argShape: 'uri-array', ok: true });
        return { ok: true, commandId: id, argShape: 'uri-array', attempts };
      } catch (err) {
        attempts.push({ commandId: id, argShape: 'uri-array', ok: false, error: String(err) });
      }
    }

    return { ok: false, attempts };
  } catch (err) {
    attempts.push({ commandId: 'discovery', argShape: 'unknown', ok: false, error: String(err) });
    return { ok: false, attempts };
  }
}

export async function dispatchToNativeChat(chatInterop: any, handoffPrompt: string, cfg: any, attachFilePath?: string) {
  if (!cfg) cfg = {};
  const runtimeTarget = cfg.get ? cfg.get("courier.runtimeTarget", "native-chat") : cfg.courier?.runtimeTarget || "native-chat";
  if (runtimeTarget !== "native-chat") {
    return { dispatched: false, reason: `unsupported runtimeTarget: ${runtimeTarget}` };
  }
  if (!chatInterop || typeof chatInterop.createChat !== 'function') {
    return { dispatched: false, reason: 'chatInterop unavailable' };
  }
  try {
    const result = await chatInterop.createChat({
      prompt: handoffPrompt,
      agentName: cfg.get ? cfg.get('courier.defaultAgentName', 'Kodax (GPT-5 mini)') : cfg.courier?.defaultAgentName,
      agentFileStem: cfg.get ? cfg.get('courier.defaultAgentFileStem', '') : cfg.courier?.defaultAgentFileStem || '',
      modelSelector: (cfg.get && cfg.get('courier.defaultModelId')) ? { id: cfg.get('courier.defaultModelId'), vendor: cfg.get('courier.defaultModelVendor', undefined) } : undefined,
      blockOnResponse: false,
      waitForPersisted: false,
      requireSelectionEvidence: false
    });

    let attachResult: any = undefined;
    if (attachFilePath) {
      attachResult = await tryAttachFileToNativeChat(attachFilePath);
    }

    return { dispatched: result?.ok !== false, result, attachmentAttempt: attachResult };
  } catch (err) {
    return { dispatched: false, reason: String(err) };
  }
}
