# Backup Mirror Sync Script
# Maintains versioned mirror of important folders

param(
    [Parameter(Mandatory=$false)]
    [string]$Source,
    [Parameter(Mandatory=$false)]
    [string]$Destination,
    [Parameter(Mandatory=$false)]
    [switch]$DryRun,
    [Parameter(Mandatory=$false)]
    [switch]$Mirror,
    [Parameter(Mandatory=$false)]
    [int]$Versions = 3,
    [Parameter(Mandatory=$false)]
    [string]$LogFile,
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Logging
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"

    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARNING" { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    }

    Write-Host $logEntry -ForegroundColor $color

    if ($LogFile) {
        Add-Content -Path $LogFile -Value $logEntry
    }
}

# Validate paths
if (-not $Source -or -not $Destination) {
    Write-Host "Usage: .\sync-backup.ps1 -Source C:\Data -Destination D:\Backup [-Mirror] [-DryRun] [-Versions 5]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Cyan
    Write-Host "  -Source      Source folder to backup"
    Write-Host "  -Destination Destination folder"
    Write-Host "  -Mirror      Delete files in destination not in source"
    Write-Host "  -DryRun      Show what would be copied without doing it"
    Write-Host "  -Versions    Number of dated versions to keep (default: 3)"
    Write-Host "  -LogFile     Path to log file"
    Write-Host "  -Verbose     Show detailed progress"
    exit 1
}

if (-not (Test-Path $Source)) {
    Write-Log "Source path not found: $Source" "ERROR"
    exit 1
}

# Resolve paths
$Source = (Resolve-Path $Source).Path
$Destination = (Resolve-Path $Destination).Path -replace '\\$', ''

if ($DryRun) {
    Write-Log "=== DRY RUN MODE - No changes will be made ===" "WARNING"
}

# Create versioned backup if not mirroring
if (-not $Mirror) {
    $versionDate = Get-Date -Format "yyyy-MM-dd_HHmmss"
    $Destination = "$Destination\$versionDate"
}

# Ensure destination exists
if (-not (Test-Path $Destination)) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Write-Log "Created destination: $Destination" "SUCCESS"
}

# Build robocopy command
$robocopyArgs = @(
    $Source,
    $Destination,
    "/E",           # Copy subdirectories, including empty ones
    "/COPY:DAT",    # Copy Data, Attributes, Timestamps
    "/R:3",         # Retry 3 times
    "/W:5",         # Wait 5 seconds between retries
    "/MT:8",        # Multi-threaded with 8 threads
    "/NP",          # No progress percentage
    "/LOG+:$($LogFile -replace '-', '')"  # Append to log
)

if ($Mirror) {
    $robocopyArgs += "/MIR"
}

if ($DryRun) {
    $robocopyArgs += "/L"
}

if (-not $Verbose) {
    $robocopyArgs += "/NFL", "/NDL", "/NC", "/NS", "/NJH", "/NJS"
}

Write-Log "Starting backup..." "INFO"
Write-Log "Source:      $Source" "INFO"
Write-Log "Destination: $Destination" "INFO"
Write-Log "Mode:       $(if ($Mirror) { 'Mirror' } else { 'Versioned' })" "INFO"

# Run robocopy
$robocopyCmd = "robocopy.exe $($robocopyArgs -join ' ')"

if ($Verbose) {
    Write-Host "Command: $robocopyCmd" -ForegroundColor Gray
}

$startTime = Get-Date
$robocopyResult = & cmd /c $robocopyCmd 2>&1 | Out-String
$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

# Parse robocopy exit code
$exitCode = $LASTEXITCODE

$copied = ($robocopyResult -match "Files\s*:\s*(\d+)\s+Copied") ? [int]$matches[1] : 0
$skipped = ($robocopyResult -match "Files\s*:\s*\d+\s+Copied.*?\s+(\d+)\s+Skipped") ? [int]$matches[1] : 0
$failed = ($robocopyResult -match "Failed\s*:\s*(\d+)") ? [int]$matches[1] : 0

# Clean up old versions
if (-not $Mirror -and $Versions -gt 0) {
    Write-Log "Cleaning up old versions (keeping $Versions)..." "INFO"

    $basePath = Split-Path (Split-Path $Destination -Parent) -Parent
    $backupFolders = Get-ChildItem -Path $basePath -Directory |
        Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{6}$' } |
        Sort-Object LastWriteTime -Descending

    $toDelete = $backupFolders | Select-Object -Skip $Versions

    foreach ($folder in $toDelete) {
        if ($DryRun) {
            Write-Log "[DRY RUN] Would delete: $($folder.Name)" "WARNING"
        } else {
            Remove-Item -Path $folder.FullName -Recurse -Force
            Write-Log "Deleted old version: $($folder.Name)" "SUCCESS"
        }
    }
}

# Summary
Write-Host ""
Write-Log "=== Backup Complete ===" "INFO"
Write-Log "Duration: $([math]::Round($duration, 1)) seconds" "INFO"
Write-Log "Files copied: $copied" "SUCCESS"
Write-Log "Files skipped: $skipped" "INFO"
Write-Log "Files failed: $failed" "$(if ($failed -gt 0) { 'ERROR' } else { 'INFO' })"

# Exit with appropriate code
if ($exitCode -ge 8) {
    Write-Log "Backup completed with errors" "ERROR"
    exit 1
} else {
    Write-Log "Backup completed successfully" "SUCCESS"
    exit 0
}
