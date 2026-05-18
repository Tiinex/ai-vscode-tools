// Prompt-facing tool references and host runtime tool names do not share one
// stable spelling surface. Normalize both to one comparison key before
// selection so repo-facing aliases like tiinex.ai-vscode-tools/listAgentSessions
// still land on runtime tools such as list_agent_sessions.
export function normalizeToolReferenceKey(value: string): string {
  return value
    .replace(/^.*\//u, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .trim()
    .toLowerCase();
}
