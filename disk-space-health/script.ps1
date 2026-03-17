# Disk Space Health Reporter
# Checks all local drives and generates HTML/CSV report

param(
    [Parameter(Mandatory=$false)]
    [int]$WarningThreshold = 80,
    [Parameter(Mandatory=$false)]
    [int]$CriticalThreshold = 90,
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = ".\disk-report.html",
    [Parameter(Mandatory=$false)]
    [string]$CsvPath,
    [Parameter(Mandatory=$false)]
    [string]$SmtpServer,
    [Parameter(Mandatory=$false)]
    [string]$EmailTo
)

$ErrorActionPreference = "Continue"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Get-DiskInfo {
    $drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null }
    $results = @()

    foreach ($drive in $drives) {
        $total = $drive.Used + $drive.Free
        $usedPercent = if ($total -gt 0) { ($drive.Used / $total) * 100 } else { 0 }
        $freeGB = [math]::Round($drive.Free / 1GB, 2)
        $totalGB = [math]::Round($total / 1GB, 2)

        $status = "OK"
        $statusColor = "#3fb950"
        if ($usedPercent -ge $CriticalThreshold) {
            $status = "CRITICAL"
            $statusColor = "#f85149"
        } elseif ($usedPercent -ge $WarningThreshold) {
            $status = "WARNING"
            $statusColor = "#d29922"
        }

        $results += [PSCustomObject]@{
            Drive = $drive.Name
            TotalGB = $totalGB
            FreeGB = $freeGB
            UsedPercent = [math]::Round($usedPercent, 1)
            Status = $status
            StatusColor = $statusColor
        }
    }
    return $results
}

$disks = Get-DiskInfo

$html = @"
<!DOCTYPE html>
<html>
<head>
    <title>Disk Space Report - $timestamp</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #0d1117; color: #e6edf3; padding: 2rem; }
        h1 { color: #58a6ff; }
        table { border-collapse: collapse; width: 100%; max-width: 800px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #30363d; }
        th { background: #161b22; color: #8b949e; }
        .status { padding: 4px 12px; border-radius: 4px; font-weight: bold; }
        .critical { background: #f8514933; color: #f85149; }
        .warning { background: #d2992233; color: #d29922; }
        .ok { background: #3fb95033; color: #3fb950; }
        .timestamp { color: #8b949e; font-size: 0.9rem; }
    </style>
</head>
<body>
    <h1>Disk Space Health Report</h1>
    <p class="timestamp">Generated: $timestamp</p>
    <table>
        <tr>
            <th>Drive</th>
            <th>Total</th>
            <th>Free</th>
            <th>Used</th>
            <th>Status</th>
        </tr>
"@

foreach ($disk in $disks) {
    $statusClass = switch ($disk.Status) {
        "CRITICAL" { "critical" }
        "WARNING" { "warning" }
        default { "ok" }
    }
    $html += @"
        <tr>
            <td>$($disk.Drive):\</td>
            <td>$($disk.TotalGB) GB</td>
            <td>$($disk.FreeGB) GB</td>
            <td>$($disk.UsedPercent)%</td>
            <td><span class="status $statusClass">$($disk.Status)</span></td>
        </tr>
"@
}

$html += @"
    </table>
</body>
</html>
"@

$html | Out-File -FilePath $OutputPath -Encoding UTF8

if ($CsvPath) {
    $disks | Export-Csv -Path $CsvPath -NoTypeInformation
}

Write-Host "Disk Space Report" -ForegroundColor Cyan
Write-Host "=================" -ForegroundColor Cyan
Write-Host "Timestamp: $timestamp" -ForegroundColor Gray
Write-Host ""

$disks | Format-Table Drive, TotalGB, FreeGB, UsedPercent, Status -AutoSize

Write-Host "`nReport saved to: $OutputPath" -ForegroundColor Green

if ($CsvPath) {
    Write-Host "CSV saved to: $CsvPath" -ForegroundColor Green
}

# Email if configured
if ($SmtpServer -and $EmailTo) {
    try {
        $subject = "Disk Space Alert - $(hostname)"
        $body = $html
        Send-MailMessage -SmtpServer $SmtpServer -To $EmailTo -Subject $subject -BodyAsHtml $body -From "disk-reporter@localhost"
        Write-Host "`nEmail sent to: $EmailTo" -ForegroundColor Green
    } catch {
        Write-Host "`nFailed to send email: $_" -ForegroundColor Red
    }
}
