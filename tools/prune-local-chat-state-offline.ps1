param(
    [string]$WorkspaceStorageDir = 'C:\Users\micro\AppData\Roaming\Code\User\workspaceStorage\fbc41d01bd98bdd9bec2b24d2f1ced08',
    [string[]]$KeepSessionId = @(
        '7f4da2e2-f4dd-4335-a584-60bb61baf998',
        'e315e317-c272-4f5e-a50b-ad305b12b464'
    ),
    [switch]$AllowCodeProcess,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sqlJsRoot = Join-Path $repoRoot 'node_modules\sql.js'

if (-not (Test-Path $sqlJsRoot)) {
    throw "Missing sql.js at '$sqlJsRoot'. Run 'npm.cmd install' in '$repoRoot' first."
}

if (-not (Test-Path $WorkspaceStorageDir)) {
    throw "Workspace storage directory not found: '$WorkspaceStorageDir'"
}

if (-not $KeepSessionId -or $KeepSessionId.Count -eq 0) {
    throw 'At least one KeepSessionId is required.'
}

if (-not $AllowCodeProcess) {
    $codeProcesses = Get-Process | Where-Object { $_.ProcessName -like 'Code*' }
    if ($codeProcesses) {
        $processSummary = ($codeProcesses | Select-Object -ExpandProperty ProcessName -Unique) -join ', '
        throw "VS Code still appears to be running ($processSummary). Close it completely or re-run with -AllowCodeProcess if you intentionally want to bypass this guard."
    }
}

$tempScript = Join-Path $env:TEMP 'aa-prune-local-chat-state-offline.js'
$tempKeepIds = Join-Path $env:TEMP 'aa-prune-local-chat-state-offline.keep.json'
$KeepSessionId | ConvertTo-Json -Compress | Set-Content -LiteralPath $tempKeepIds -Encoding UTF8
$dryRunJson = if ($DryRun) { 'true' } else { 'false' }

@'
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.argv[2];
const workspaceStorageDir = process.argv[3];
const keepIds = new Set(JSON.parse(fs.readFileSync(process.argv[4], "utf8").replace(/^\uFEFF/, "")));
const dryRun = process.argv[5] === "true";

const initSqlJs = require(path.join(repoRoot, "node_modules", "sql.js"));

const dbNames = ["state.vscdb", "state.vscdb.backup"];
const keys = {
  index: "chat.ChatSessionStore.index",
  model: "agentSessions.model.cache",
  state: "agentSessions.state.cache",
  todo: "memento/chat-todo-list"
};

function readValue(db, key) {
  const stmt = db.prepare("select CAST(value as text) as value from ItemTable where key = ?");
  try {
    stmt.bind([key]);
    if (!stmt.step()) {
      return undefined;
    }
    const row = stmt.getAsObject();
    return typeof row.value === "string" ? row.value : undefined;
  } finally {
    stmt.free();
  }
}

function writeValue(db, key, value) {
  const stmt = db.prepare("update ItemTable set value = ? where key = ?");
  try {
    stmt.run([value, key]);
  } finally {
    stmt.free();
  }
}

function decodeSessionId(resource) {
  const prefix = "vscode-chat-session://local/";
  if (typeof resource !== "string" || !resource.startsWith(prefix)) {
    return undefined;
  }
  try {
    return Buffer.from(resource.slice(prefix.length), "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

function filterCacheEntries(entries) {
  if (!Array.isArray(entries)) {
    return { filtered: entries, removed: 0 };
  }

  const filtered = entries.filter((entry) => keepIds.has(decodeSessionId(entry && entry.resource)));
  return {
    filtered,
    removed: entries.length - filtered.length
  };
}

function filterTodoMap(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    return { filtered: map, removed: 0 };
  }

  const entries = Object.entries(map);
  const filtered = Object.fromEntries(entries.filter(([sessionId]) => keepIds.has(sessionId)));
  return {
    filtered,
    removed: entries.length - Object.keys(filtered).length
  };
}

function filterIndexPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { filtered: payload, removed: 0 };
  }

  const entries = payload.entries && typeof payload.entries === "object" && !Array.isArray(payload.entries)
    ? payload.entries
    : {};
  const filteredEntries = Object.fromEntries(Object.entries(entries).filter(([sessionId]) => keepIds.has(sessionId)));
  return {
    filtered: {
      ...payload,
      entries: filteredEntries
    },
    removed: Object.keys(entries).length - Object.keys(filteredEntries).length
  };
}

(async () => {
  const SQL = await initSqlJs({ locateFile: (file) => path.join(repoRoot, "node_modules", "sql.js", "dist", file) });
  const reports = [];

  for (const dbName of dbNames) {
    const dbPath = path.join(workspaceStorageDir, dbName);
    if (!fs.existsSync(dbPath)) {
      reports.push({ dbPath, missing: true });
      continue;
    }

    const bytes = fs.readFileSync(dbPath);
    const db = new SQL.Database(bytes);

    try {
      const indexRaw = readValue(db, keys.index);
      const modelRaw = readValue(db, keys.model);
      const stateRaw = readValue(db, keys.state);
      const todoRaw = readValue(db, keys.todo);

      const indexResult = filterIndexPayload(indexRaw ? JSON.parse(indexRaw) : undefined);
      const modelResult = filterCacheEntries(modelRaw ? JSON.parse(modelRaw) : undefined);
      const stateResult = filterCacheEntries(stateRaw ? JSON.parse(stateRaw) : undefined);
      const todoResult = filterTodoMap(todoRaw ? JSON.parse(todoRaw) : undefined);

      if (!dryRun) {
        if (typeof indexRaw === "string") {
          writeValue(db, keys.index, JSON.stringify(indexResult.filtered));
        }
        if (typeof modelRaw === "string") {
          writeValue(db, keys.model, JSON.stringify(modelResult.filtered));
        }
        if (typeof stateRaw === "string") {
          writeValue(db, keys.state, JSON.stringify(stateResult.filtered));
        }
        if (typeof todoRaw === "string") {
          writeValue(db, keys.todo, JSON.stringify(todoResult.filtered));
        }

        fs.writeFileSync(dbPath, Buffer.from(db.export()));
      }

      reports.push({
        dbPath,
        dryRun,
        removedIndexEntries: indexResult.removed,
        removedModelEntries: modelResult.removed,
        removedStateEntries: stateResult.removed,
        removedTodoEntries: todoResult.removed,
        keptSessionIds: [...keepIds]
      });
    } finally {
      db.close();
    }
  }

  process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
'@ | Set-Content -LiteralPath $tempScript -Encoding UTF8

try {
  node $tempScript $repoRoot $WorkspaceStorageDir $tempKeepIds $dryRunJson
}
finally {
    Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
  Remove-Item $tempKeepIds -Force -ErrorAction SilentlyContinue
}