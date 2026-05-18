import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const tiinexRoot = path.resolve(repoRoot, "..");

const workspaceFolders = [
  ".github",
  "anti-gravity",
  "youtube",
  "reddit",
  "discord",
  "docs",
  "site",
  "educational",
  "ai-vscode-tools",
  "ai"
];

const textExtensions = new Set([
  ".md",
  ".txt",
  ".json",
  ".jsonc",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".ps1",
  ".sh",
  ".yml",
  ".yaml",
  ".html",
  ".css"
]);

const ignoredDirectoryNames = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "out",
  ".next"
]);

const ruleSet = [
  {
    name: "old-hyphen-tool-references",
    pattern: /tiinex\.ai-vscode-tools\/(agent-sessions|agent-session-index|agent-session-window|agent-session-export|agent-session-transcript|agent-session-snapshot|agent-context-breakdown|agent-session-profile|agent-session-survey|live-agent-chats|inspect-live-agent-chat-quiescence|create-live-agent-chat|close-visible-live-chat-tabs|delete-live-agent-chat-artifacts|send-message-live-agent-chat|reveal-live-agent-chat|traceable-subagent)/gi
  },
  {
    name: "old-hash-prompt-references",
    pattern: /#(agent-sessions|agent-session-index|agent-session-window|agent-session-export|agent-session-transcript|agent-session-snapshot|agent-context-breakdown|agent-session-profile|agent-session-survey|live-agent-chats|inspect-live-agent-chat-quiescence|create-live-agent-chat|close-visible-live-chat-tabs|delete-live-agent-chat-artifacts|send-message-live-agent-chat|reveal-live-agent-chat|traceable-subagent)\b/gi
  },
  {
    name: "legacy-compact-tool-namespace",
    pattern: /tiinexaivscodetools\/(estimateContextBreakdown|exportEvidenceTranscript|exportSessionMarkdown|getSessionIndex|getSessionProfile|getSessionSnapshot|getSessionWindow|listSessions|surveySessions)/gi
  }
];

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function* walkFiles(currentPath) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name)) {
        continue;
      }
      yield* walkFiles(entryPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    yield entryPath;
  }
}

function normalizeDisplayPath(filePath) {
  return path.relative(tiinexRoot, filePath).split(path.sep).join("/");
}

function collectLineMatches(text, regex) {
  const matches = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    regex.lastIndex = 0;
    if (!regex.test(line)) {
      continue;
    }
    matches.push({
      lineNumber: index + 1,
      line: line.trim()
    });
  }
  return matches;
}

async function main() {
  const findings = [];
  const scannedRoots = [];

  for (const folderName of workspaceFolders) {
    const folderPath = path.join(tiinexRoot, folderName);
    if (!(await fileExists(folderPath))) {
      continue;
    }
    scannedRoots.push(folderName);
    for await (const filePath of walkFiles(folderPath)) {
      const text = await fs.readFile(filePath, "utf8");
      for (const rule of ruleSet) {
        const lineMatches = collectLineMatches(text, rule.pattern);
        for (const lineMatch of lineMatches) {
          findings.push({
            rule: rule.name,
            filePath,
            lineNumber: lineMatch.lineNumber,
            line: lineMatch.line
          });
        }
      }
    }
  }

  console.log(`Scanned workspace folders: ${scannedRoots.join(", ")}`);

  if (findings.length === 0) {
    console.log("Workspace prompt-surface audit passed: no stale ai-vscode-tools prompt references found.");
    return;
  }

  console.error("Workspace prompt-surface audit failed. Stale references found:");
  for (const finding of findings) {
    console.error(`${finding.rule} ${normalizeDisplayPath(finding.filePath)}:${finding.lineNumber}`);
    console.error(`  ${finding.line}`);
  }
  process.exitCode = 1;
}

await main();
