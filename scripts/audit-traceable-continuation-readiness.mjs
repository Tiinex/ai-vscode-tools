import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const aiVscodeToolsRoot = path.resolve(__dirname, "..");
const tiinexRoot = path.resolve(aiVscodeToolsRoot, "..");

const aiProvenanceRoot = path.join(tiinexRoot, "ai-provenance");
const aiProvenanceManifestPath = path.join(aiProvenanceRoot, "ides", "vscode", "package.json");
const aiProvenanceReadmePath = path.join(aiProvenanceRoot, "README.md");
const topicsRoot = path.join(aiProvenanceRoot, ".topics");
const requiredTopicDirectories = ["m3-observer", "m3-lineage-chain"];
const requiredSchemaProperties = ["parentTracePath", "parentTask", "exportToFolder"];
const requiredReadmeSnippets = [
  "### Milestone 3: Trace Continuation And Lineage",
  "Current blocker on May 22, 2026 after the stop-proof pass"
];

function normalizeDisplayPath(targetPath) {
  return path.relative(tiinexRoot, targetPath).split(path.sep).join("/");
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const normalized = raw.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(normalized);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function assertCondition(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

async function main() {
  const failures = [];

  assertCondition(await pathExists(aiProvenanceRoot), `${normalizeDisplayPath(aiProvenanceRoot)} is missing.`, failures);
  assertCondition(await pathExists(aiProvenanceManifestPath), `${normalizeDisplayPath(aiProvenanceManifestPath)} is missing.`, failures);
  assertCondition(await pathExists(aiProvenanceReadmePath), `${normalizeDisplayPath(aiProvenanceReadmePath)} is missing.`, failures);
  assertCondition(await pathExists(topicsRoot), `${normalizeDisplayPath(topicsRoot)} is missing.`, failures);

  for (const topicDirectory of requiredTopicDirectories) {
    const targetPath = path.join(topicsRoot, topicDirectory);
    assertCondition(await pathExists(targetPath), `${normalizeDisplayPath(targetPath)} is missing.`, failures);
  }

  if (await pathExists(aiProvenanceManifestPath)) {
    const manifestJson = await readJsonFile(aiProvenanceManifestPath);
    const traceableTool = Array.isArray(manifestJson.contributes?.languageModelTools)
      ? manifestJson.contributes.languageModelTools.find((entry) => entry?.name === "run_traceable_subagent")
      : undefined;
    assertCondition(Boolean(traceableTool), "ai-provenance manifest is missing run_traceable_subagent.", failures);
    const properties = traceableTool?.inputSchema?.properties ?? {};
    for (const propertyName of requiredSchemaProperties) {
      assertCondition(Boolean(properties[propertyName]), `run_traceable_subagent is missing schema property '${propertyName}'.`, failures);
    }
  }

  if (await pathExists(aiProvenanceReadmePath)) {
    const readme = await fs.readFile(aiProvenanceReadmePath, "utf8");
    for (const snippet of requiredReadmeSnippets) {
      assertCondition(readme.includes(snippet), `README is missing continuation readiness marker '${snippet}'.`, failures);
    }
  }

  console.log(`Continuation root checked: ${normalizeDisplayPath(aiProvenanceRoot)}`);
  console.log(`TRACEABLE schema checked: ${normalizeDisplayPath(aiProvenanceManifestPath)}`);
  console.log(`Topics checked: ${requiredTopicDirectories.join(", ")}`);

  if (failures.length === 0) {
    console.log("Traceable continuation readiness audit passed: repo, schema, topic folders, and README continuation markers are present.");
    return;
  }

  console.error("Traceable continuation readiness audit failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
}

await main();