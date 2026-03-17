<#
.SYNOPSIS
    Cache Clean Commander - Preview and purge cache/temp folders safely

.DESCRIPTION
    Discovers and cleans Windows temp folders, browser caches, and custom paths.
    Supports analyze mode, cleaning with -WhatIf, pattern filtering, and CSV logging.

.PARAMETER Mode
    Operation mode: Analyze or Clean

.PARAMETER WhatIf
    Simulate clean actions without actually deleting files

.PARAMETER IncludePattern
    File patterns to include (e.g., "*.tmp", "*.log")

.PARAMETER ExcludePattern
    File patterns to exclude (e.g., "*.lock", "important*")

.PARAMETER AdditionalPaths
    Additional paths to analyze/clean beyond auto-discovered locations

.PARAMETER OpenLogs
    Open the log directory in Explorer and exit

.EXAMPLE
    .\Cache-Clean-Commander.ps1 -Mode Analyze
    Analyze all discovered cache locations

.EXAMPLE
    .\Cache-Clean-Commander.ps1 -Mode Clean -WhatIf
    Simulate cleaning (no actual deletion)

.EXAMPLE
    .\Cache-Clean-Commander.ps1 -Mode Clean -ExcludePattern "*.db"
    Clean all files except database files

.NOTES
    Author: Migrated from Python to PowerShell
    Logs saved to: ~\Documents\CacheCleanCommander\logs\
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Analyze', 'Clean')]
    [string]$Mode = 'Analyze',

    [Parameter()]
    [string[]]$IncludePattern,

    [Parameter()]
    [string[]]$ExcludePattern,

    [Parameter()]
    [string[]]$AdditionalPaths,

    [Parameter()]
    [switch]$OpenLogs
)

#region Helper Functions

function Get-CacheTargets {
    <#
    .SYNOPSIS
        Discovers common cache and temp folders on Windows
    #>
    [CmdletBinding()]
    param(
        [string[]]$ExtraPaths
    )

    $targets = @()

    # Windows Temp folders
    if ($env:TEMP -and (Test-Path $env:TEMP)) {
        $targets += $env:TEMP
    }

    $localTemp = Join-Path $env:LOCALAPPDATA "Temp"
    if (Test-Path $localTemp) {
        $targets += $localTemp
    }

    # Browser caches
    $chromePath = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\Default\Cache"
    if (Test-Path $chromePath) {
        $targets += $chromePath
    }

    $edgePath = Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data\Default\Cache"
    if (Test-Path $edgePath) {
        $targets += $edgePath
    }

    # Firefox cache
    $firefoxPath = Join-Path $env:LOCALAPPDATA "Mozilla\Firefox\Profiles"
    if (Test-Path $firefoxPath) {
        Get-ChildItem -Path $firefoxPath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $cacheDir = Join-Path $_.FullName "cache2"
            if (Test-Path $cacheDir) {
                $targets += $cacheDir
            }
        }
    }

    # Add user-provided paths
    foreach ($path in $ExtraPaths) {
        if (Test-Path $path) {
            $targets += $path
        }
    }

    # Deduplicate
    return $targets | Select-Object -Unique
}

function Test-FilePattern {
    <#
    .SYNOPSIS
        Tests if a file path matches include/exclude patterns
    #>
    param(
        [string]$Path,
        [string[]]$Include,
        [string[]]$Exclude
    )

    # Check include patterns
    if ($Include) {
        $matched = $false
        foreach ($pattern in $Include) {
            if ($Path -like $pattern) {
                $matched = $true
                break
            }
        }
        if (-not $matched) { return $false }
    }

    # Check exclude patterns
    if ($Exclude) {
        foreach ($pattern in $Exclude) {
            if ($Path -like $pattern) {
                return $false
            }
        }
    }

    return $true
}

function Get-DirectoryStats {
    <#
    .SYNOPSIS
        Calculate total size and file count for a directory
    #>
    [CmdletBinding()]
    param(
        [string]$Path,
        [string[]]$Include,
        [string[]]$Exclude
    )

    $totalSize = 0
    $totalFiles = 0

    try {
        Get-ChildItem -Path $Path -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            if (Test-FilePattern -Path $_.FullName -Include $Include -Exclude $Exclude) {
                $totalSize += $_.Length
                $totalFiles++
            }
        }
    }
    catch {
        Write-Warning "Error accessing ${Path}: $_"
    }

    [PSCustomObject]@{
        Path  = $Path
        Files = $totalFiles
        Bytes = $totalSize
        Size  = Format-ByteSize $totalSize
    }
}

function Format-ByteSize {
    <#
    .SYNOPSIS
        Format bytes into human-readable size
    #>
    param([long]$Bytes)

    if ($Bytes -ge 1GB) {
        return "{0:N2} GB" -f ($Bytes / 1GB)
    }
    elseif ($Bytes -ge 1MB) {
        return "{0:N2} MB" -f ($Bytes / 1MB)
    }
    elseif ($Bytes -ge 1KB) {
        return "{0:N2} KB" -f ($Bytes / 1KB)
    }
    else {
        return "$Bytes B"
    }
}

function Initialize-LogDirectory {
    <#
    .SYNOPSIS
        Ensure log directory exists
    #>
    $logDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) "CacheCleanCommander\logs"
    if (-not (Test-Path $logDir)) {
        New-Item -Path $logDir -ItemType Directory -Force | Out-Null
    }
    return $logDir
}

function Write-CleanLog {
    <#
    .SYNOPSIS
        Write cleaning results to CSV log
    #>
    param(
        [object[]]$Entries
    )

    $logDir = Initialize-LogDirectory
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $logPath = Join-Path $logDir "clean-$timestamp.csv"

    $Entries | Export-Csv -Path $logPath -NoTypeInformation -Encoding UTF8

    return $logPath
}

function Invoke-PathClean {
    <#
    .SYNOPSIS
        Clean a directory path (or simulate with -WhatIf)
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [string]$Path,
        [string[]]$Include,
        [string[]]$Exclude
    )

    $deletedFiles = 0
    $freedBytes = 0
    $action = if ($WhatIfPreference) { "WhatIf" } else { "Clean" }
    $message = ""

    try {
        # Delete files
        Get-ChildItem -Path $Path -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            if (Test-FilePattern -Path $_.FullName -Include $Include -Exclude $Exclude) {
                $size = $_.Length

                if ($PSCmdlet.ShouldProcess($_.FullName, "Delete file")) {
                    try {
                        Remove-Item -Path $_.FullName -Force -ErrorAction Stop
                        $freedBytes += $size
                        $deletedFiles++
                    }
                    catch {
                        $message = $_.Exception.Message
                        Write-Warning "Failed to delete $($_.FullName): $message"
                    }
                }
                else {
                    # WhatIf mode - just count
                    $freedBytes += $size
                    $deletedFiles++
                }
            }
        }

        # Remove empty directories (only if not WhatIf)
        if (-not $WhatIfPreference) {
            Get-ChildItem -Path $Path -Directory -Recurse -ErrorAction SilentlyContinue |
                Sort-Object -Property FullName -Descending |
                ForEach-Object {
                    if ((Get-ChildItem -Path $_.FullName -Force | Measure-Object).Count -eq 0) {
                        try {
                            Remove-Item -Path $_.FullName -Force -ErrorAction SilentlyContinue
                        }
                        catch {
                            # Ignore errors for directory removal
                        }
                    }
                }
        }
    }
    catch {
        $action = "Error"
        $message = $_.Exception.Message
    }

    [PSCustomObject]@{
        Path         = $Path
        Action       = $action
        DeletedFiles = $deletedFiles
        FreedBytes   = $freedBytes
        FreedSize    = Format-ByteSize $freedBytes
        Message      = $message
    }
}

#endregion

#region Main Execution

# Handle -OpenLogs switch
if ($OpenLogs) {
    $logDir = Initialize-LogDirectory
    Start-Process explorer.exe -ArgumentList $logDir
    exit 0
}

Write-Host "`n===== Cache Clean Commander =====" -ForegroundColor Cyan
Write-Host "Mode: $Mode" -ForegroundColor Yellow

# Discover targets
Write-Host "`nDiscovering cache locations..." -ForegroundColor Gray
$targets = Get-CacheTargets -ExtraPaths $AdditionalPaths

if ($targets.Count -eq 0) {
    Write-Host "No cache targets found!" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($targets.Count) target(s):`n" -ForegroundColor Green
$targets | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

# Execute based on mode
switch ($Mode) {
    'Analyze' {
        Write-Host "`nAnalyzing targets..." -ForegroundColor Yellow

        $results = $targets | ForEach-Object {
            Write-Host "  Scanning: $_" -ForegroundColor Gray
            Get-DirectoryStats -Path $_ -Include $IncludePattern -Exclude $ExcludePattern
        }

        Write-Host "`n===== Analysis Results =====" -ForegroundColor Cyan
        $results | Format-Table -AutoSize

        $totalFiles = ($results | Measure-Object -Property Files -Sum).Sum
        $totalBytes = ($results | Measure-Object -Property Bytes -Sum).Sum

        Write-Host "Total: $totalFiles files, $(Format-ByteSize $totalBytes)" -ForegroundColor Green
    }

    'Clean' {
        $confirmMsg = if ($WhatIfPreference) {
            "Simulate cleaning (WhatIf mode)"
        }
        else {
            "PERMANENTLY DELETE cache files from $($targets.Count) locations"
        }

        Write-Host "`nThis will $confirmMsg" -ForegroundColor Yellow

        if (-not $WhatIfPreference) {
            $confirm = Read-Host "Continue? (yes/no)"
            if ($confirm -ne 'yes') {
                Write-Host "Cancelled." -ForegroundColor Red
                exit 0
            }
        }

        Write-Host "`nCleaning targets..." -ForegroundColor Yellow

        $results = $targets | ForEach-Object {
            Write-Host "  Processing: $_" -ForegroundColor Gray
            Invoke-PathClean -Path $_ -Include $IncludePattern -Exclude $ExcludePattern
        }

        # Save log
        $logPath = Write-CleanLog -Entries $results

        Write-Host "`n===== Clean Results =====" -ForegroundColor Cyan
        $results | Format-Table -AutoSize

        $totalFiles = ($results | Measure-Object -Property DeletedFiles -Sum).Sum
        $totalBytes = ($results | Measure-Object -Property FreedBytes -Sum).Sum

        Write-Host "Total: $totalFiles files deleted, $(Format-ByteSize $totalBytes) freed" -ForegroundColor Green
        Write-Host "`nLog saved to: $logPath" -ForegroundColor Cyan
    }
}

Write-Host "`n===== Complete =====" -ForegroundColor Cyan

#endregion
