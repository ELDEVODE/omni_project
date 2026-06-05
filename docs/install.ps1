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

# ─── Progress helpers ────────────────────────────────────────
# We use PowerShell's built-in Write-Progress for the download (it draws a
# bar across the top of the terminal) and a custom rotating-glyph spinner
# for the short, indeterminate steps (verify, extract, install).
$script:SpinnerFrames = @('⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏')
$script:SpinnerJob = $null

function Test-Tty {
    try {
        return [Console]::IsOutputRedirected -eq $false -and -not $env:NO_COLOR
    } catch {
        return $false
    }
}

function Start-Spinner {
    param([string]$Text)
    if (-not (Test-Tty)) {
        Write-Host "  • $Text" -ForegroundColor Cyan
        return
    }
    Write-Host "`e[?25l" -NoNewline
    $script:SpinnerJob = Start-Job -ScriptBlock {
        param($Text, $Frames)
        $i = 0
        while ($true) {
            $glyph = $Frames[$i % $Frames.Length]
            Write-Host "`e[2K`r  $glyph $Text" -NoNewline -ForegroundColor Cyan
            Start-Sleep -Milliseconds 80
            $i++
        }
    } -ArgumentList $Text, $script:SpinnerFrames
}

function Stop-Spinner {
    param([string]$Status = 'done')
    if ($script:SpinnerJob) {
        Stop-Job $script:SpinnerJob -ErrorAction SilentlyContinue
        Remove-Job $script:SpinnerJob -Force -ErrorAction SilentlyContinue
        $script:SpinnerJob = $null
    }
    Write-Host "`e[?25h" -NoNewline
    if ($Status -eq 'done') {
        Write-Host "`e[2K`r  ✓ done" -ForegroundColor Green
    } elseif ($Status -eq 'warn') {
        Write-Host "`e[2K`r  ! warn" -ForegroundColor Yellow
    } else {
        Write-Host "`e[2K`r  ✗ failed" -ForegroundColor Red
    }
}

# Restore the cursor if we crash mid-spinner.
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    if ($script:SpinnerJob) {
        Stop-Job $script:SpinnerJob -ErrorAction SilentlyContinue
        Remove-Job $script:SpinnerJob -Force -ErrorAction SilentlyContinue
    }
    Write-Host "`e[?25h" -NoNewline
} | Out-Null

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
    Start-Spinner 'fetching latest omni release'
    try {
        $api = "https://api.github.com/repos/$Repo/releases/latest"
        $release = Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'omni-installer' }
        $Version = $release.tag_name -replace '^v', ''
        Stop-Spinner 'done'
    } catch {
        Stop-Spinner 'fail'
        throw
    }
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
    Write-Host "  → installing omni $TagVersion ($Os-$Arch)" -ForegroundColor White

    # ─── Download with Write-Progress bar ───────────────────
    Start-Spinner 'downloading omni'
    try {
        # Use Invoke-WebRequest with PassThru so we can read the total
        # size, then drive Write-Progress manually. We poll the file
        # length every 200 ms (cheap, only runs during download).
        $request = [System.Net.HttpWebRequest]::Create($ArchiveUrl)
        $request.UserAgent = 'omni-installer'
        $response = $request.GetResponse()
        $total = [int64]$response.ContentLength
        $stream = $response.GetResponseStream()
        $fs = [System.IO.File]::Create($ArchivePath)
        $buffer = New-Object byte[] 65536
        $read = $stream.Read($buffer, 0, $buffer.Length)
        $done = [int64]0
        $lastTick = 0
        while ($read -gt 0) {
            $fs.Write($buffer, 0, $read)
            $done += $read
            $read = $stream.Read($buffer, 0, $buffer.Length)
            if ($total -gt 0) {
                $now = [DateTime]::UtcNow.Ticks
                if ($now - $lastTick -gt 2000000) { # every 200 ms
                    $pct = [int](($done * 100) / $total)
                    Write-Progress -Activity 'Downloading omni' -Status "$pct%  $([math]::Round($done/1MB,1)) MB / $([math]::Round($total/1MB,1)) MB" -PercentComplete $pct
                    $lastTick = $now
                }
            }
        }
        $fs.Close()
        $stream.Close()
        $response.Close()
        Write-Progress -Activity 'Downloading omni' -Completed
        Stop-Spinner 'done'
    } catch {
        Stop-Spinner 'fail'
        Write-Progress -Activity 'Downloading omni' -Completed
        throw
    }

    # ─── Verify SHA-256 ─────────────────────────────────────
    Start-Spinner 'verifying SHA-256'
    try {
        $SumsPath = Join-Path $Tmp 'checksums.txt'
        Invoke-WebRequest -Uri $SumsUrl -OutFile $SumsPath -UseBasicParsing -ErrorAction Stop
        $Entry = Get-Content $SumsPath | Where-Object { $_ -match "$Binary-$Os-$Arch\.$Ext" } | Select-Object -First 1
        if ($Entry) {
            $Expected = ($Entry -split '\s+')[0]
            $Actual = (Get-FileHash -Path $ArchivePath -Algorithm SHA256).Hash.ToLower()
            if ($Expected.ToLower() -ne $Actual) {
                Stop-Spinner 'fail'
                throw "SHA-256 mismatch. expected=$Expected actual=$Actual"
            }
            Stop-Spinner 'done'
        } else {
            Stop-Spinner 'warn'
            Write-Warning "no checksum entry for $Binary-$Os-$Arch.$Ext; skipping verification"
        }
    } catch {
        Stop-Spinner 'warn'
        Write-Warning "checksum verification skipped: $_"
    }

    # ─── Extract ────────────────────────────────────────────
    Start-Spinner 'extracting'
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $ExtractDir = Join-Path $Tmp 'extract'
        [System.IO.Compression.ZipFile]::ExtractToDirectory($ArchivePath, $ExtractDir)
        Stop-Spinner 'done'
    } catch {
        Stop-Spinner 'fail'
        throw
    }

    $ExeName = "$Binary.exe"
    $ExtractedExe = Get-ChildItem -Path $ExtractDir -Filter $ExeName -Recurse | Select-Object -First 1
    if (-not $ExtractedExe) { throw "Archive did not contain $ExeName" }

    # ─── Install ────────────────────────────────────────────
    Start-Spinner 'installing'
    try {
        if (-not (Test-Path $InstallDir)) {
            New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        }
        $Target = Join-Path $InstallDir $ExeName
        Copy-Item -Path $ExtractedExe.FullName -Destination $Target -Force
        Stop-Spinner 'done'
    } catch {
        Stop-Spinner 'fail'
        throw
    }

    # ─── Add to user PATH (best effort) ─────────────────────
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($userPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable('Path', "$userPath;$InstallDir", 'User')
        Write-Host "  ↳ added $InstallDir to user PATH (restart your shell)" -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "✓ omni $TagVersion installed to $Target" -ForegroundColor Green
    Write-Host ""
    Write-Host 'Next steps:' -ForegroundColor Cyan
    Write-Host '  1. Open a new PowerShell window (so PATH updates apply)'
    Write-Host '  2. omni doctor'
    Write-Host '  3. omni host        # boots mesh coordinator + dashboard'
    Write-Host '  4. omni join <pubkey> # on other machines'
    Write-Host ''
    Write-Host 'Optional QVAC SDK:' -ForegroundColor Cyan
    Write-Host '  npm install -g @qvac/sdk'
} finally {
    Write-Progress -Activity 'Downloading omni' -Completed
    if (Test-Path $Tmp) { Remove-Item -Recurse -Force $Tmp }
}
