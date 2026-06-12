import crypto from "node:crypto";
import { PostbackCommand } from "./types";

const queue = new Map<string, PostbackCommand>();

export function queueDepth(): number {
  return queue.size;
}

export function createCommandId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function queuePostback(input: { prefix: string; message: string; links?: string[]; expiresInSeconds?: number; chatKey?: string | null }): PostbackCommand {
  const { prefix, message, links, expiresInSeconds = 300, chatKey = null } = input;
  const commandId = createCommandId();
  const expiresAt = new Date(Date.now() + Math.max(1, expiresInSeconds) * 1000).toISOString();
  const cmd: PostbackCommand = {
    type: "postback",
    commandId,
    prefix: prefix ?? "Sigma",
    message,
    links: links ?? [],
    expiresAt,
    chatKey,
    acked: false,
    ackedAt: null
  };
  queue.set(commandId, cmd);
  return cmd;
}

export function pollCommand(chatKey?: string | null): PostbackCommand | null {
  const now = new Date();
  for (const cmd of queue.values()) {
    if (cmd.acked) continue;
    if (cmd.chatKey && chatKey && cmd.chatKey !== chatKey) continue;
    const expires = new Date(cmd.expiresAt);
    if (expires.getTime() <= now.getTime()) {
      // expired: remove
      queue.delete(cmd.commandId);
      continue;
    }
    return cmd;
  }
  return null;
}

export function ackCommand(commandId: string): boolean {
  const cmd = queue.get(commandId);
  if (!cmd) return false;
  cmd.acked = true;
  cmd.ackedAt = new Date().toISOString();
  queue.set(commandId, cmd);
  // remove from active queue after ack
  queue.delete(commandId);
  return true;
}

export function clearQueue(): void {
  queue.clear();
}
