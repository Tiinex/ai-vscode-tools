import type { ChatCommandResult, ChatInteropApi, SendChatMessageRequest } from "./types";
export async function sendMessageToSession(
  chatInterop: ChatInteropApi,
  request: SendChatMessageRequest
): Promise<ChatCommandResult> {
  const exactSupport = await chatInterop.getExactSessionInteropSupport();
  if (exactSupport.canSendExactSessionMessage) {
    return chatInterop.sendMessage(request);
  }

  const unsupportedReason = exactSupport.sendUnsupportedReason
    ?? "Exact session-targeted Local send is unsupported on this build.";
  return {
    ok: false,
    reason: `${unsupportedReason} Reveal plus focused-submit fallback has been removed because it depended on inferred active-chat targeting on this build. Fix exact-session support instead of guessing.`
  };
}