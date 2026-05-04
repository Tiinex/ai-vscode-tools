import * as vscode from "vscode";
import { ChatInteropService } from "./service";
import { sendMessageToSessionWithFallback } from "./sessionSendWorkflow";
import { ChatInteropApi, ChatInteropOptions } from "./types";

const COMMAND_ALIASES = {
  listChats: ["aiRecoveryTooling.chatInterop.listChats"],
  createChat: ["aiRecoveryTooling.chatInterop.createChat"],
  sendMessage: ["aiRecoveryTooling.chatInterop.sendMessage"],
  sendMessageWithFallback: ["aiRecoveryTooling.chatInterop.sendMessageWithFallback"],
  sendFocusedMessage: ["aiRecoveryTooling.chatInterop.sendFocusedMessage"],
  closeVisibleTabs: ["aiRecoveryTooling.chatInterop.closeVisibleTabs"],
  deleteChat: ["aiRecoveryTooling.chatInterop.deleteChat"],
  revealChat: ["aiRecoveryTooling.chatInterop.revealChat"]
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
    context.subscriptions.push(vscode.commands.registerCommand(command, async (sessionId: string, prompt: string) => sendMessageToSessionWithFallback(service, {
      sessionId,
      prompt
    }).then((workflow) => workflow.result)));
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