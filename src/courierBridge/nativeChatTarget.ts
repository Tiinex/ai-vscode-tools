export async function dispatchToNativeChat(chatInterop: any, handoffPrompt: string, cfg: any) {
  if (!cfg) cfg = {};
  const runtimeTarget = cfg.get ? cfg.get("courier.runtimeTarget", "native-chat") : cfg.courier?.runtimeTarget || "native-chat";
  if (runtimeTarget !== "native-chat") {
    return { dispatched: false, reason: `unsupported runtimeTarget: ${runtimeTarget}` };
  }
  if (!chatInterop || typeof chatInterop.createChat !== 'function') {
    return { dispatched: false, reason: 'chatInterop unavailable' };
  }
  try {
    // fire-and-forget createChat
    void chatInterop.createChat({
      prompt: handoffPrompt,
      agentName: cfg.get ? cfg.get('courier.defaultAgentName', 'Kodax (GPT-5 mini)') : cfg.courier?.defaultAgentName,
      modelSelector: (cfg.get && cfg.get('courier.defaultModelId')) ? { id: cfg.get('courier.defaultModelId'), vendor: cfg.get('courier.defaultModelVendor', undefined) } : undefined,
      blockOnResponse: false,
      waitForPersisted: false,
      requireSelectionEvidence: false
    });
    return { dispatched: true };
  } catch (err) {
    return { dispatched: false, reason: String(err) };
  }
}
