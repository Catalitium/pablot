# Fattest Folders Explorer
# Recursively scans a path and shows largest directories

param(
    [Parameter(Mandatory=$true)]
    [string]$Path,
    [int]$Top = 20,
    [string]$OutputFile,
    [switch]$IncludeHidden
)

$ErrorActionPreference = "Stop"

function Get-FolderSize {
    param([string]$FolderPath)

    try {
        $items = Get-ChildItem -Path $FolderPath -Recurse -Force:$IncludeHidden -ErrorAction SilentlyContinue
        $size = ($items | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
        $lastModified = ($items | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
        return @{
            Size = $size
            LastModified = $lastModified
            Path = $FolderPath
        }
    } catch {
        return $null
    }
}

function Format-Size {
    param([long]$Bytes)
    if ($Bytes -ge 1TB) { return "{0:N2} TB" -f ($Bytes / 1TB) }
    if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }
    return "$Bytes B"
}

Write-Host "Scanning: $Path" -ForegroundColor Cyan
Write-Host "This may take a while..." -ForegroundColor Yellow

$folders = @()
$allFolders = Get-ChildItem -Path $Path -Directory -Force:$IncludeHidden -ErrorAction SilentlyContinue
$total = $allFolders.Count
$current = 0

foreach ($folder in $allFolders) {
    $current++
    if ($current % 50 -eq 0) {
        Write-Progress -Activity "Scanning folders" -Status "$current / $total" -PercentComplete (($current / $total) * 100)
    }

    $info = Get-FolderSize -FolderPath $folder.FullName
    if ($info -and $info.Size -gt 0) {
        $folders += [PSCustomObject]@{
            Path = $info.Path
            Size = $info.Size
            FormattedSize = Format-Size -Bytes $info.Size
            LastModified = $info.LastModified
        }
    }
}

$folders = $folders | Sort-Object Size -Descending | Select-Object -First $Top

Write-Progress -Activity "Scanning folders" -Completed

Write-Host ""
Write-Host "=== Top $Top Largest Folders ===" -ForegroundColor Green
Write-Host ""

$folders | ForEach-Object {
    Write-Host ("{0,-15} {1}" -f $_.FormattedSize, $_.Path) -ForegroundColor White
    Write-Host ("  Last modified: {0}" -f $_.LastModified) -ForegroundColor Gray
}

if ($OutputFile) {
    $folders | Export-Csv -Path $OutputFile -NoTypeInformation
    Write-Host ""
    Write-Host "Exported to: $OutputFile" -ForegroundColor Green
}
