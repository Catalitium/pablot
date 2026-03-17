# Fattest Folders Explorer
# Recursively scans a path and displays largest folders

param(
    [Parameter(Mandatory=$false)]
    [string]$Path = ".",
    [Parameter(Mandatory=$false)]
    [int]$Top = 20,
    [Parameter(Mandatory=$false)]
    [string]$OutputFile,
    [Parameter(Mandatory=$false)]
    [switch]$IncludeHidden
)

$ErrorActionPreference = "SilentlyContinue"

function Get-FolderSize {
    param([string]$FolderPath)

    try {
        $size = (Get-ChildItem -Path $FolderPath -Recurse -Force:$IncludeHidden -ErrorAction SilentlyContinue |
            Measure-Object -Property Length -Sum).Sum
        $lastModified = (Get-ChildItem -Path $FolderPath -Recurse -Force:$IncludeHidden -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
        return @{ Size = $size; LastModified = $lastModified }
    } catch {
        return @{ Size = 0; LastModified = $null }
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
$processed = 0

Get-ChildItem -Path $Path -Directory -Force:$IncludeHidden | ForEach-Object {
    $folder = $_
    $processed++

    if ($processed % 50 -eq 0) {
        Write-Host "Processed $processed folders..." -ForegroundColor Gray
    }

    $info = Get-FolderSize -FolderPath $folder.FullName

    $folders += [PSCustomObject]@{
        Path = $folder.FullName
        Size = $info.Size
        FormattedSize = Format-Size -Bytes $info.Size
        LastModified = $info.LastModified
    }
}

$sorted = $folders | Sort-Object Size -Descending | Select-Object -First $Top

Write-Host "`n=== Top $Top Largest Folders ===" -ForegroundColor Green
Write-Host ""

$sorted | Format-Table Path, FormattedSize, LastModified -AutoSize

if ($OutputFile) {
    $sorted | Export-Csv -Path $OutputFile -NoTypeInformation
    Write-Host "`nExported to: $OutputFile" -ForegroundColor Cyan
}

$totalSize = ($sorted | Measure-Object -Property Size -Sum).Sum
Write-Host "`nTotal size of top $Top folders: $(Format-Size -Bytes $totalSize)" -ForegroundColor Yellow
