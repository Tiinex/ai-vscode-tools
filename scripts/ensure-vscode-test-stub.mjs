import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const vscodeDir = path.join(packageRoot, "node_modules", "vscode");
const vscodeStubPath = path.join(vscodeDir, "index.js");
const vscodeStubSource = `module.exports = {
  commands: {
    getCommands: async () => [],
    executeCommand: async () => undefined
  },
  window: {
    tabGroups: {
      all: []
    }
  }
};
`;

async function ensureVscodeStub() {
  try {
    const existing = await fs.readFile(vscodeStubPath, "utf8");
    if (existing === vscodeStubSource) {
      return;
    }
    if (existing.trim() && existing.trim() !== "module.exports = {};" && !existing.includes("getCommands")) {
      return;
    }
  } catch {
  }

  await fs.mkdir(vscodeDir, { recursive: true });
  await fs.writeFile(vscodeStubPath, vscodeStubSource, "utf8");
}

await ensureVscodeStub();