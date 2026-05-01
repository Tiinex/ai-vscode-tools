import { Buffer } from "node:buffer";

export function encodeLocalChatSessionId(sessionId: string): string {
  return Buffer.from(sessionId, "utf8").toString("base64");
}

export function toLocalChatSessionResourceString(sessionId: string): string {
  return `vscode-chat-session://local/${encodeLocalChatSessionId(sessionId)}`;
}