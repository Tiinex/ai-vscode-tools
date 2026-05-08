import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const sqlJsDistDir = path.join(repoRoot, "node_modules", "sql.js", "dist");
const sqlJsOutDir = path.join(distDir, "vendor", "sql.js");
const tscCliPath = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");
const watchMode = process.argv.includes("--watch");

async function ensureSqlJsRuntimeAssets() {
  await fs.mkdir(sqlJsOutDir, { recursive: true });
  await fs.copyFile(path.join(sqlJsDistDir, "sql-wasm.wasm"), path.join(sqlJsOutDir, "sql-wasm.wasm"));
}

async function cleanDist() {
  await fs.rm(distDir, { recursive: true, force: true });
}

function emitTypeScriptDist() {
  execFileSync(process.execPath, [tscCliPath, "-p", path.join(repoRoot, "tsconfig.json")], {
    cwd: repoRoot,
    stdio: "inherit"
  });
}

function createExtensionOptions() {
  return {
    entryPoints: [path.join(repoRoot, "src", "extension.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    outfile: path.join(distDir, "extension.js"),
    external: ["vscode"],
    sourcemap: true,
    logLevel: "info"
  };
}

function createToolOptions() {
  return {
    entryPoints: [
      path.join(repoRoot, "src", "tools", "cli.ts"),
      path.join(repoRoot, "src", "tools", "copilot-cli.ts"),
      path.join(repoRoot, "src", "tools", "mcp-server.ts"),
      path.join(repoRoot, "src", "tools", "offlineLocalChatCleanupCli.ts")
    ],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    outdir: path.join(distDir, "tools"),
    outbase: path.join(repoRoot, "src", "tools"),
    sourcemap: true,
    logLevel: "info"
  };
}

async function buildOnce() {
  await cleanDist();
  emitTypeScriptDist();
  await Promise.all([
    esbuild.build(createExtensionOptions()),
    esbuild.build(createToolOptions())
  ]);
  await ensureSqlJsRuntimeAssets();
}

async function watch() {
  await cleanDist();
  emitTypeScriptDist();
  const extensionContext = await esbuild.context(createExtensionOptions());
  const toolContext = await esbuild.context(createToolOptions());
  await Promise.all([extensionContext.watch(), toolContext.watch()]);
  await Promise.all([extensionContext.rebuild(), toolContext.rebuild()]);
  await ensureSqlJsRuntimeAssets();
  console.log("Watching bundled builds...");
}

if (watchMode) {
  await watch();
} else {
  await buildOnce();
}