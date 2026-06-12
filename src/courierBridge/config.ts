import * as vscode from "vscode";

export function courierConfig() {
  const config = vscode.workspace.getConfiguration("tiinex.aiVscodeTools");
  return {
    enabled: config.get<boolean>("courier.enabled", false),
    port: config.get<number>("courier.port", 37175),
    incomingDirectory: config.get<string>("courier.incomingDirectory", ""),
    // When unset or empty, fallback to configured defaultAgentName for postback prefixes
    defaultAgentName: config.get<string>("courier.defaultAgentName", "Kodax (GPT-5 mini)"),
    postbackPrefix: (() => {
      const explicit = config.get<string>("courier.postbackPrefix", "");
      return (explicit && explicit.trim()) ? explicit.trim() : config.get<string>("courier.defaultAgentName", "Kodax (GPT-5 mini)");
    })()
  };
}
