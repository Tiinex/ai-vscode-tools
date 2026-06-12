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
    // If the command is targeted at a specific chatKey, only return it
    // when the poll provides the matching chatKey. This prevents leaking
    // chat-specific commands to non-targeted polls.
    if (cmd.chatKey && cmd.chatKey !== chatKey) continue;
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

export function ackCommand(commandId: string, ok = true, result?: Record<string, unknown>): boolean {
  const cmd = queue.get(commandId);
  if (!cmd) return false;
  const now = new Date().toISOString();
  cmd.lastAck = { ok, result, at: now };
  if (ok) {
    cmd.acked = true;
    cmd.ackedAt = now;
    // remove from active queue after successful ack
    queue.delete(commandId);
  } else {
    // persist failed ack metadata but keep command in queue for retry
    queue.set(commandId, cmd);
  }
  return true;
}

export function clearQueue(): void {
  queue.clear();
}
