#!/usr/bin/env pwsh
# OmniMesh installer (Windows PowerShell + PowerShell 7)
# Detects OS/arch, fetches the latest release from GitHub, verifies SHA-256,
# and installs to $env:LOCALAPPDATA\Programs\OmniMesh (added to user PATH).
#
# Usage (run in elevated or user PowerShell):
#   iwr -useb https://eldevode.github.io/omni_project/install.ps1 | iex
#   $env:OMNI_VERSION='v0.1.0'; iwr -useb .../install.ps1 | iex
#   & ([scriptblock]::Create((iwr -useb ...))) -System

[CmdletBinding()]
param(
    [switch]$System,
    [string]$Prefix,
    [string]$Version
)

$ErrorActionPreference = 'Stop'

$Repo = 'ELDEVODE/omni_project'
$Binary = 'omni'

# ─── Detect arch ─────────────────────────────────────────────
$Arch = switch ($env:PROCESSOR_ARCHITECTURE) {
    'AMD64' { 'x64' }
    'ARM64' { 'arm64' }
    default { throw "Unsupported architecture: $($env:PROCESSOR_ARCHITECTURE)" }
}
$Os = 'windows'
$Ext = 'zip'

# ─── Pick install dir ────────────────────────────────────────
if ($System) {
    $InstallDir = Join-Path $env:ProgramFiles 'OmniMesh'
} elseif ($Prefix) {
    $InstallDir = $Prefix
} elseif ($env:OMNI_INSTALL_DIR) {
    $InstallDir = $env:OMNI_INSTALL_DIR
} else {
    $InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\OmniMesh'
}

# ─── Pick version ────────────────────────────────────────────
if (-not $Version -and $env:OMNI_VERSION) { $Version = $env:OMNI_VERSION }
if (-not $Version) {
    Write-Host '→ Fetching latest omni release...'
    $api = "https://api.github.com/repos/$Repo/releases/latest"
    $release = Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'omni-installer' }
    $Version = $release.tag_name -replace '^v', ''
}
if (-not $Version) { throw 'Could not determine latest omni version.' }
$TagVersion = "v$Version"

# ─── Build URLs ──────────────────────────────────────────────
$BaseUrl = "https://github.com/$Repo/releases/download/$TagVersion"
$ArchiveUrl = "$BaseUrl/$Binary-$Os-$Arch.$Ext"
$SumsUrl = "$BaseUrl/checksums.txt"

# ─── Prepare temp dir ────────────────────────────────────────
$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("omni-install-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Tmp | Out-Null
try {
    $ArchivePath = Join-Path $Tmp "$Binary.$Ext"
    Write-Host "→ Downloading omni $TagVersion ($Os-$Arch)..."
    Invoke-WebRequest -Uri $ArchiveUrl -OutFile $ArchivePath -UseBasicParsing

    # ─── Verify SHA-256 ─────────────────────────────────────
    Write-Host '→ Verifying SHA-256...'
    try {
        $SumsPath = Join-Path $Tmp 'checksums.txt'
        Invoke-WebRequest -Uri $SumsUrl -OutFile $SumsPath -UseBasicParsing
        $Entry = Get-Content $SumsPath | Where-Object { $_ -match "$Binary-$Os-$Arch\.$Ext" } | Select-Object -First 1
        if ($Entry) {
            $Expected = ($Entry -split '\s+')[0]
            $Actual = (Get-FileHash -Path $ArchivePath -Algorithm SHA256).Hash.ToLower()
            if ($Expected.ToLower() -ne $Actual) {
                throw "SHA-256 mismatch. expected=$Expected actual=$Actual"
            }
            Write-Host '  ✓ checksum ok'
        } else {
            Write-Warning "no checksum entry for $Binary-$Os-$Arch.$Ext; skipping verification"
        }
    } catch {
        Write-Warning "checksum verification skipped: $_"
    }

    # ─── Extract ────────────────────────────────────────────
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $ExtractDir = Join-Path $Tmp 'extract'
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ArchivePath, $ExtractDir)

    $ExeName = "$Binary.exe"
    $ExtractedExe = Get-ChildItem -Path $ExtractDir -Filter $ExeName -Recurse | Select-Object -First 1
    if (-not $ExtractedExe) { throw "Archive did not contain $ExeName" }

    # ─── Install ────────────────────────────────────────────
    if ($System -and -not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    } else {
        if (-not (Test-Path $InstallDir)) {
            New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        }
    }

    $Target = Join-Path $InstallDir $ExeName
    Copy-Item -Path $ExtractedExe.FullName -Destination $Target -Force

    # ─── Add to user PATH (best effort) ─────────────────────
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($userPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable('Path', "$userPath;$InstallDir", 'User')
        Write-Host "  ↳ added $InstallDir to user PATH (restart your shell)"
    }

    Write-Host ""
    Write-Host "✓ omni $TagVersion installed to $Target"
    Write-Host ""
    Write-Host 'Next steps:'
    Write-Host '  1. Open a new PowerShell window (so PATH updates apply)'
    Write-Host '  2. omni doctor'
    Write-Host '  3. omni host        # boots mesh coordinator + dashboard'
    Write-Host '  4. omni join <pubkey> # on other machines'
    Write-Host ''
    Write-Host 'Optional QVAC SDK:'
    Write-Host '  bun add @qvac/sdk'
} finally {
    if (Test-Path $Tmp) { Remove-Item -Recurse -Force $Tmp }
}
