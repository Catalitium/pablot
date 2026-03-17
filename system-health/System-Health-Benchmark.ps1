<#
.SYNOPSIS
    System Health Benchmark - Monitor and grade system performance

.DESCRIPTION
    Collects CPU, Memory, and Disk usage metrics, assigns letter grades (A/B/C)
    based on thresholds, calculates an overall system health grade, and logs
    results to both console and file.

.PARAMETER OutputPath
    Custom output path for log file (default: current directory)

.PARAMETER Interval
    CPU sampling interval in seconds (default: 2)

.PARAMETER DriveLetter
    Drive letter to monitor (default: C)

.PARAMETER JsonOutput
    Output results as JSON instead of formatted text

.EXAMPLE
    .\System-Health-Benchmark.ps1
    Run health check with default settings

.EXAMPLE
    .\System-Health-Benchmark.ps1 -Interval 5 -DriveLetter D
    Monitor drive D with 5-second CPU sampling

.EXAMPLE
    .\System-Health-Benchmark.ps1 -JsonOutput
    Output results as JSON

.NOTES
    Author: Migrated from Python to PowerShell
    Grading Thresholds:
      - CPU: A (<30%), B (30-60%), C (>60%)
      - Memory: A (<50%), B (50-75%), C (>75%)
      - Disk: A (<40%), B (40-70%), C (>70%)
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$OutputPath = ".",

    [Parameter()]
    [ValidateRange(1, 10)]
    [int]$Interval = 2,

    [Parameter()]
    [ValidatePattern('^[A-Z]$')]
    [string]$DriveLetter = 'C',

    [Parameter()]
    [switch]$JsonOutput
)

#region Helper Functions

function Get-SystemMetrics {
    <#
    .SYNOPSIS
        Collect CPU, Memory, and Disk usage metrics
    #>
    [CmdletBinding()]
    param(
        [int]$CpuInterval = 2,
        [string]$Drive = 'C'
    )

    Write-Verbose "Collecting system metrics (CPU interval: ${CpuInterval}s)..."

    # CPU Usage (average over interval)
    $cpuUsage = (Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval $CpuInterval -MaxSamples 1).CounterSamples.CookedValue
    $cpuUsage = [Math]::Round($cpuUsage, 2)

    # Memory Usage
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $totalMemory = $os.TotalVisibleMemorySize
    $freeMemory = $os.FreePhysicalMemory
    $usedMemory = $totalMemory - $freeMemory
    $memoryUsage = [Math]::Round(($usedMemory / $totalMemory) * 100, 2)

    # Disk Usage
    $disk = Get-PSDrive -Name $Drive -PSProvider FileSystem
    $diskTotal = $disk.Used + $disk.Free
    $diskUsage = [Math]::Round(($disk.Used / $diskTotal) * 100, 2)

    [PSCustomObject]@{
        CPUUsage    = $cpuUsage
        MemoryUsage = $memoryUsage
        DiskUsage   = $diskUsage
        DriveLetter = $Drive
        Timestamp   = Get-Date
    }
}

function Get-MetricGrade {
    <#
    .SYNOPSIS
        Assign letter grade (A/B/C) based on thresholds
    #>
    param(
        [double]$Value,
        [double]$ThresholdA,
        [double]$ThresholdB
    )

    if ($Value -lt $ThresholdA) {
        return 'A'
    }
    elseif ($Value -lt $ThresholdB) {
        return 'B'
    }
    else {
        return 'C'
    }
}

function Get-OverallGrade {
    <#
    .SYNOPSIS
        Calculate overall grade from individual grades
    #>
    param(
        [string]$CPUGrade,
        [string]$MemoryGrade,
        [string]$DiskGrade
    )

    $gradeValues = @{
        'A' = 3
        'B' = 2
        'C' = 1
    }

    $averageScore = ($gradeValues[$CPUGrade] + $gradeValues[$MemoryGrade] + $gradeValues[$DiskGrade]) / 3

    if ($averageScore -ge 2.67) {
        return 'A'
    }
    elseif ($averageScore -ge 1.67) {
        return 'B'
    }
    else {
        return 'C'
    }
}

function Write-HealthReport {
    <#
    .SYNOPSIS
        Generate and display health report
    #>
    param(
        [object]$Metrics,
        [object]$Grades,
        [string]$LogPath
    )

    $report = @"

===== System Health Report =====
Report generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

System Metrics:
  CPU Usage:    $($Metrics.CPUUsage)%
  Memory Usage: $($Metrics.MemoryUsage)%
  Disk Usage:   $($Metrics.DiskUsage)% (Drive $($Metrics.DriveLetter))

Metric Grades:
  CPU Grade:    $($Grades.CPUGrade)
  Memory Grade: $($Grades.MemoryGrade)
  Disk Grade:   $($Grades.DiskGrade)

Overall System Grade: $($Grades.OverallGrade)

===== End of Report =====

"@

    Write-Host $report -ForegroundColor Cyan

    # Write to log file
    $report | Out-File -FilePath $LogPath -Encoding UTF8
    Write-Host "Report saved to: $LogPath" -ForegroundColor Green
}

function Write-JsonReport {
    <#
    .SYNOPSIS
        Output report as JSON
    #>
    param(
        [object]$Metrics,
        [object]$Grades,
        [string]$LogPath
    )

    $output = [PSCustomObject]@{
        Timestamp = Get-Date -Format 'o'
        Metrics   = $Metrics
        Grades    = $Grades
        LogPath   = $LogPath
    }

    $json = $output | ConvertTo-Json -Depth 3
    Write-Output $json

    # Also save to log
    $json | Out-File -FilePath $LogPath -Encoding UTF8
}

#endregion

#region Main Execution

# Create log filename with timestamp
$timestamp = Get-Date -Format 'yyyyddMM_HHmmss'
$logFilename = "${timestamp}_system_health.log"
$logPath = Join-Path $OutputPath $logFilename

Write-Host "`nStarting System Health Benchmark..." -ForegroundColor Yellow

# Collect metrics
$metrics = Get-SystemMetrics -CpuInterval $Interval -Drive $DriveLetter

# Calculate grades
$cpuGrade = Get-MetricGrade -Value $metrics.CPUUsage -ThresholdA 30 -ThresholdB 60
$memoryGrade = Get-MetricGrade -Value $metrics.MemoryUsage -ThresholdA 50 -ThresholdB 75
$diskGrade = Get-MetricGrade -Value $metrics.DiskUsage -ThresholdA 40 -ThresholdB 70

$overallGrade = Get-OverallGrade -CPUGrade $cpuGrade -MemoryGrade $memoryGrade -DiskGrade $diskGrade

$grades = [PSCustomObject]@{
    CPUGrade      = $cpuGrade
    MemoryGrade   = $memoryGrade
    DiskGrade     = $diskGrade
    OverallGrade  = $overallGrade
}

# Generate report
if ($JsonOutput) {
    Write-JsonReport -Metrics $metrics -Grades $grades -LogPath $logPath
}
else {
    Write-HealthReport -Metrics $metrics -Grades $grades -LogPath $logPath
}

# Return results for pipeline use
[PSCustomObject]@{
    Metrics = $metrics
    Grades  = $grades
    LogPath = $logPath
}

#endregion
