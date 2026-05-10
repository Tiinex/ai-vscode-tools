import * as vscode from "vscode";
import { ChatInteropService } from "./service";
import { ChatInteropApi, ChatInteropOptions } from "./types";

export function registerChatInterop(context: vscode.ExtensionContext, options: ChatInteropOptions = {}): ChatInteropApi {
  const service = new ChatInteropService(context, options);

  return service;
}