param(
    [switch]$ForceRecreate
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$extensionsRoot = Join-Path $env:USERPROFILE '.vscode\extensions'
$linkPath = Join-Path $extensionsRoot 'local.ai-vscode-recovery-tooling'
$legacyLinkPath = Join-Path $extensionsRoot 'local.agent-architect-tools'
$extensionsJsonPath = Join-Path $extensionsRoot 'extensions.json'
$distEntry = Join-Path $repoRoot 'dist\extension.js'

function Get-VsCodeExtensionLocation {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $resolvedPath = (Resolve-Path $Path).Path
    $drive = [System.IO.Path]::GetPathRoot($resolvedPath).TrimEnd('\\').TrimEnd(':').ToLowerInvariant()
    $relativePath = $resolvedPath.Substring(2).Replace('\\', '/')
    $uri = [System.Uri]::new($resolvedPath)

    return [pscustomobject]@{
        '$mid' = 1
        fsPath = $resolvedPath
        external = $uri.AbsoluteUri
        path = "/${drive}:$relativePath"
        scheme = 'file'
    }
}

function Remove-LegacyExtensionLinkIfSafe {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        return $false
    }

    $existing = Get-Item $Path -Force
    if (-not ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        Write-Warning "Legacy extension path '$Path' still exists but is not a reparse point. Leaving it in place."
        return $false
    }

    Remove-Item $Path -Force
    return $true
}

function Get-ExtensionRegistryIdentifierId {
    param(
        [Parameter(Mandatory = $true)]
        $Entry
    )

    $identifier = if ($Entry -is [System.Collections.IDictionary]) {
        $Entry['identifier']
    }
    elseif ($Entry.PSObject.Properties.Match('identifier').Count -gt 0) {
        $Entry.identifier
    }
    else {
        $null
    }

    if ($null -eq $identifier) {
        return $null
    }

    if ($identifier -is [System.Collections.IDictionary]) {
        return $identifier['id']
    }

    if ($identifier.PSObject.Properties.Match('id').Count -gt 0) {
        return $identifier.id
    }

    return $null
}

function Set-ExtensionRegistryIdentifierId {
    param(
        [Parameter(Mandatory = $true)]
        $Entry,
        [Parameter(Mandatory = $true)]
        [string]$Id
    )

    $identifier = if ($Entry -is [System.Collections.IDictionary]) {
        $Entry['identifier']
    }
    elseif ($Entry.PSObject.Properties.Match('identifier').Count -gt 0) {
        $Entry.identifier
    }
    else {
        $null
    }

    if ($null -eq $identifier) {
        $identifier = [pscustomobject]@{}
    }

    if ($identifier -is [System.Collections.IDictionary]) {
        $identifier['id'] = $Id
    }
    else {
        $identifier | Add-Member -NotePropertyName id -NotePropertyValue $Id -Force
    }

    if ($Entry -is [System.Collections.IDictionary]) {
        $Entry['identifier'] = $identifier
    }
    else {
        $Entry | Add-Member -NotePropertyName identifier -NotePropertyValue $identifier -Force
    }
}

function Set-ExtensionRegistryValue {
    param(
        [Parameter(Mandatory = $true)]
        $Entry,
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        $Value
    )

    if ($Entry -is [System.Collections.IDictionary]) {
        $Entry[$Name] = $Value
    }
    else {
        $Entry | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force
    }
}

function Repair-ExtensionRegistryMetadata {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RegistryPath,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    if (-not (Test-Path $RegistryPath)) {
        return $false
    }

    $raw = Get-Content -LiteralPath $RegistryPath -Raw
    if (-not $raw.Trim()) {
        return $false
    }

    $targetId = 'local.ai-vscode-recovery-tooling'
    $legacyId = 'local.agent-architect-tools'
    $updatedRaw = $raw.Replace($legacyId, $targetId)
    if ($updatedRaw -eq $raw) {
        return $false
    }

    $null = $updatedRaw | ConvertFrom-Json
    Set-Content -LiteralPath $RegistryPath -Value $updatedRaw -Encoding UTF8
    return $true
}

New-Item -ItemType Directory -Force -Path $extensionsRoot | Out-Null

$legacyLinkRemoved = Remove-LegacyExtensionLinkIfSafe -Path $legacyLinkPath

if (Test-Path $linkPath) {
    $existing = Get-Item $linkPath -Force
    $currentTargets = @($existing.Target | ForEach-Object { $_.ToString() })
    $isExpectedTarget = $existing.LinkType -eq 'Junction' -and $currentTargets -contains $repoRoot

    if (-not $isExpectedTarget) {
        if (-not $ForceRecreate) {
            throw "Existing path at '$linkPath' does not point to '$repoRoot'. Re-run with -ForceRecreate to replace a mismatched reparse point."
        }

        if (-not ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Refusing to remove '$linkPath' because it is not a reparse point. Remove it manually if you intend to replace it."
        }

        Remove-Item $linkPath -Force
        New-Item -ItemType Junction -Path $linkPath -Target $repoRoot | Out-Null
        $existing = Get-Item $linkPath -Force
        $currentTargets = @($existing.Target | ForEach-Object { $_.ToString() })
    }
}
else {
    New-Item -ItemType Junction -Path $linkPath -Target $repoRoot | Out-Null
    $existing = Get-Item $linkPath -Force
    $currentTargets = @($existing.Target | ForEach-Object { $_.ToString() })
}

$registryUpdated = Repair-ExtensionRegistryMetadata -RegistryPath $extensionsJsonPath -TargetPath $linkPath

$distPresent = Test-Path $distEntry

[pscustomobject]@{
    RepoRoot = $repoRoot
    LinkPath = $existing.FullName
    LinkType = $existing.LinkType
    Targets = ($currentTargets -join '; ')
    LegacyLinkRemoved = $legacyLinkRemoved
    RegistryUpdated = $registryUpdated
    RegistryPath = $extensionsJsonPath
    DistEntryPresent = $distPresent
    ReloadRequired = $true
} | Format-List | Out-String | Write-Output

if (-not $distPresent) {
    Write-Warning "Built extension entrypoint is missing at '$distEntry'. Run 'npm.cmd run build' before relying on main-host activation."
}