param(
    [Parameter(Mandatory = $true)]
    [string]$ExtensionRoot,
    [Parameter(Mandatory = $true)]
    [string]$WorkspaceStorageDir,
    [Parameter(Mandatory = $true)]
    [string]$ReportFile,
    [string[]]$KeepSessionId = @(),
    [int]$PollIntervalMs = 1000
)

$ErrorActionPreference = 'Stop'

$offlineScript = Join-Path $ExtensionRoot 'tools\prune-local-chat-state-offline.ps1'

if (-not (Test-Path $offlineScript)) {
    throw "Offline cleanup script not found: '$offlineScript'"
}

$reportDir = Split-Path -Parent $ReportFile
if ($reportDir) {
    New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
}

while ($true) {
    $codeProcesses = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like 'Code*' }
    if (-not $codeProcesses) {
        break
    }

    Start-Sleep -Milliseconds $PollIntervalMs
}

$arguments = @(
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    $offlineScript,
    '-WorkspaceStorageDir',
    $WorkspaceStorageDir,
    '-AllowCodeProcess'
)

foreach ($sessionId in $KeepSessionId) {
    $arguments += '-KeepSessionId'
    $arguments += $sessionId
}

$raw = & powershell.exe @arguments
$raw | Set-Content -LiteralPath $ReportFile -Encoding UTF8