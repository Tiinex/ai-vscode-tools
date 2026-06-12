import * as vscode from "vscode";

export function courierConfig() {
  const config = vscode.workspace.getConfiguration("tiinex.aiVscodeTools");
  return {
    enabled: config.get<boolean>("courier.enabled", false),
    port: config.get<number>("courier.port", 37175),
    incomingDirectory: config.get<string>("courier.incomingDirectory", ""),
    postbackPrefix: config.get<string>("courier.postbackPrefix", "Sigma")
  };
}
