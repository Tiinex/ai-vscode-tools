$roots = @("$env:APPDATA\Code\User\globalStorage", "$env:APPDATA\Code - Insiders\User\globalStorage") | Where-Object { Test-Path $_ }
foreach ($root in $roots) {
  Write-Host "ROOT $root"
  Get-ChildItem $root -Recurse -Filter 'courier-last-invoke.json' -ErrorAction SilentlyContinue | Select-Object FullName, LastWriteTime, Length | ForEach-Object { Write-Host "FOUND_COURIER_LAST_INVOKE: $($_.FullName) | $($_.LastWriteTime) | $($_.Length)" }
  Get-ChildItem $root -Recurse -Filter 'chat-interop-create-debug.jsonl' -ErrorAction SilentlyContinue | Select-Object FullName, LastWriteTime, Length | ForEach-Object { Write-Host "FOUND_CHAT_DEBUG: $($_.FullName) | $($_.LastWriteTime) | $($_.Length)" }
}

Write-Host "\nQuerying loopback /tiinex-courier/debug/last-invoke..."
try {
  $resp = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:37175/tiinex-courier/debug/last-invoke' -Body '{}' -ContentType 'application/json' -TimeoutSec 5
  Write-Host "LOOPBACK_RESP:"
  $resp | ConvertTo-Json -Depth 5 | Write-Host
} catch {
  Write-Host "last-invoke endpoint unavailable: $($_.Exception.Message)"
}

# Print contents of found files
foreach ($root in $roots) {
  Get-ChildItem $root -Recurse -Filter 'courier-last-invoke.json' -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "\n--- CONTENT courier-last-invoke: $($_.FullName) ---"
    try { Get-Content $_.FullName -Raw | Write-Host } catch { Write-Host "(failed to read)" }
  }
  Get-ChildItem $root -Recurse -Filter 'chat-interop-create-debug.jsonl' -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "\n--- LAST 80 LINES chat-interop-create-debug: $($_.FullName) ---"
    try { Get-Content $_.FullName -Tail 80 | ForEach-Object { Write-Host $_ } } catch { Write-Host "(failed to read)" }
  }
}

# Find recent extension logs
$logRoots = @("$env:APPDATA\Code\logs", "$env:APPDATA\Code - Insiders\logs") | Where-Object { Test-Path $_ }
foreach ($root in $logRoots) {
  Write-Host "LOGROOT $root"
  Get-ChildItem $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'exthost|extension|renderer|sharedprocess|main' -or $_.Extension -eq '.log' } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 20 FullName, LastWriteTime, Length | ForEach-Object { Write-Host "LOG: $($_.FullName) | $($_.LastWriteTime) | $($_.Length)" }
}

$recentLog = $logRoots | ForEach-Object { Get-ChildItem $_ -Recurse -File -ErrorAction SilentlyContinue } | Where-Object { $_.Name -match 'exthost|extension|renderer|sharedprocess|main' -or $_.Extension -eq '.log' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
if ($recentLog) {
  Write-Host "\nTAILING $recentLog"
  try { Get-Content $recentLog -Tail 200 | ForEach-Object { Write-Host $_ } } catch { Write-Host '(failed to read log)' }
} else {
  Write-Host 'No recent extension logs found.'
}
