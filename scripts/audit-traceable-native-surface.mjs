import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const aiVscodeToolsRoot = path.resolve(__dirname, "..");
const tiinexRoot = path.resolve(aiVscodeToolsRoot, "..");

const requiredWorkspaceFolders = ["ai-vscode-tools", "ai-provenance"];
const workspaceManifestPaths = [
  path.join(tiinexRoot, "all.code-workspace"),
  path.join(tiinexRoot, "ai-and-ai-vscode-tools.code-workspace")
];
const aiProvenanceManifestPath = path.join(tiinexRoot, "ai-provenance", "ides", "vscode", "package.json");
const requiredTraceableTools = [
  "list_traceable_agents",
  "list_traceable_models",
  "run_traceable_subagent",
  "view_traceable_subagent"
];

function normalizeDisplayPath(targetPath) {
  return path.relative(tiinexRoot, targetPath).split(path.sep).join("/");
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const normalized = raw.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(normalized);
}

function assertCondition(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function validateWorkspaceManifest(filePath, workspaceJson, failures) {
  const folders = Array.isArray(workspaceJson.folders) ? workspaceJson.folders : [];
  const folderPaths = new Set(
    folders
      .map((entry) => typeof entry?.path === "string" ? entry.path.trim() : "")
      .filter(Boolean)
  );
  for (const requiredFolder of requiredWorkspaceFolders) {
    assertCondition(
      folderPaths.has(requiredFolder),
      `${normalizeDisplayPath(filePath)} is missing required workspace folder '${requiredFolder}'.`,
      failures
    );
  }
}

function validateTraceableManifest(manifestJson, failures) {
  const languageModelTools = Array.isArray(manifestJson.contributes?.languageModelTools)
    ? manifestJson.contributes.languageModelTools
    : [];
  for (const toolName of requiredTraceableTools) {
    const tool = languageModelTools.find((entry) => entry?.name === toolName);
    assertCondition(Boolean(tool), `ai-provenance manifest is missing TRACEABLE LM tool '${toolName}'.`, failures);
    if (!tool) {
      continue;
    }
    assertCondition(tool.canBeReferencedInPrompt === true, `${toolName} must remain referenceable in prompt.`, failures);
    assertCondition(typeof tool.displayName === "string" && tool.displayName.trim().length > 0, `${toolName} is missing displayName metadata.`, failures);
    assertCondition(typeof tool.userDescription === "string" && tool.userDescription.trim().length > 0, `${toolName} is missing userDescription metadata.`, failures);
    assertCondition(typeof tool.modelDescription === "string" && tool.modelDescription.trim().length > 0, `${toolName} is missing modelDescription metadata.`, failures);
    assertCondition(typeof tool.toolReferenceName === "string" && tool.toolReferenceName.trim().length > 0, `${toolName} is missing toolReferenceName metadata.`, failures);
  }
}

async function main() {
  const failures = [];

  for (const manifestPath of workspaceManifestPaths) {
    const workspaceJson = await readJsonFile(manifestPath);
    validateWorkspaceManifest(manifestPath, workspaceJson, failures);
  }

  const aiProvenanceManifest = await readJsonFile(aiProvenanceManifestPath);
  validateTraceableManifest(aiProvenanceManifest, failures);

  console.log(`Workspace manifests checked: ${workspaceManifestPaths.map((entry) => normalizeDisplayPath(entry)).join(", ")}`);
  console.log(`TRACEABLE manifest checked: ${normalizeDisplayPath(aiProvenanceManifestPath)}`);

  if (failures.length === 0) {
    console.log("Traceable native surface audit passed: workspace manifests include ai-provenance and required TRACEABLE LM tool metadata is present.");
    return;
  }

  console.error("Traceable native surface audit failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
}

await main();