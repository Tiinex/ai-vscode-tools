import * as vscode from "vscode";
import { ChatInteropService } from "./service";
import { sendMessageToSession } from "./sessionSendWorkflow";
import { ChatInteropApi, ChatInteropOptions } from "./types";

const COMMAND_ALIASES = {
  listChats: ["tiinex.aiVscodeTools.chatInterop.listChats"],
  createChat: ["tiinex.aiVscodeTools.chatInterop.createChat"],
  sendMessage: ["tiinex.aiVscodeTools.chatInterop.sendMessage"],
  sendMessageWithFallback: ["tiinex.aiVscodeTools.chatInterop.sendMessageWithFallback"],
  sendFocusedMessage: ["tiinex.aiVscodeTools.chatInterop.sendFocusedMessage"],
  closeVisibleTabs: ["tiinex.aiVscodeTools.chatInterop.closeVisibleTabs"],
  deleteChat: ["tiinex.aiVscodeTools.chatInterop.deleteChat"],
  revealChat: ["tiinex.aiVscodeTools.chatInterop.revealChat"]
} as const;

export function registerChatInterop(context: vscode.ExtensionContext, options: ChatInteropOptions = {}): ChatInteropApi {
  const service = new ChatInteropService(context, options);

  for (const command of COMMAND_ALIASES.listChats) {
    context.subscriptions.push(vscode.commands.registerCommand(command, async () => service.listChats()));
  }
  for (const command of COMMAND_ALIASES.createChat) {
    context.subscriptions.push(vscode.commands.registerCommand(command, async (request) => service.createChat(request)));
  }
  for (const command of COMMAND_ALIASES.sendMessage) {
    context.subscriptions.push(vscode.commands.registerCommand(command, async (request) => service.sendMessage(request)));
  }
  for (const command of COMMAND_ALIASES.sendMessageWithFallback) {
    context.subscriptions.push(vscode.commands.registerCommand(command, async (sessionId: string, prompt: string) => sendMessageToSession(service, {
      sessionId,
      prompt
    })));
  }
  for (const command of COMMAND_ALIASES.sendFocusedMessage) {
    context.subscriptions.push(vscode.commands.registerCommand(command, async (request) => service.sendFocusedMessage(request)));
  }
  for (const command of COMMAND_ALIASES.closeVisibleTabs) {
    context.subscriptions.push(vscode.commands.registerCommand(command, async (sessionId: string) => service.closeVisibleTabs(sessionId)));
  }
  for (const command of COMMAND_ALIASES.deleteChat) {
    context.subscriptions.push(vscode.commands.registerCommand(command, async (sessionId: string) => service.deleteChat(sessionId)));
  }
  for (const command of COMMAND_ALIASES.revealChat) {
    context.subscriptions.push(vscode.commands.registerCommand(command, async (sessionId: string) => service.revealChat(sessionId)));
  }

  return service;
}