#Requires -Version 5.1
<#
.SYNOPSIS
    Read-only system health report for Windows.

.DESCRIPTION
    Collects CPU, memory, disk, GPU, process, service, startup, event, and
    network diagnostics. The script does not modify system settings, stop
    processes, delete files, or require elevation for the basic report.
#>

[CmdletBinding()]
param(
    [Parameter()]
    [ValidatePattern('^[A-Z]$')]
    [string]$DriveLetter = 'C',

    [Parameter()]
    [ValidateRange(1, 10)]
    [int]$Interval = 2,

    [Parameter()]
    [switch]$Json
)

function Get-Grade {
    param(
        [double]$Value,
        [double]$GoodThreshold,
        [double]$OkayThreshold
    )

    if ($Value -lt $GoodThreshold) { return 'A' }
    if ($Value -lt $OkayThreshold) { return 'B' }
    return 'C'
}

function Get-OverallGrade {
    param(
        [string[]]$Grades
    )

    $scores = @{ A = 3; B = 2; C = 1 }
    $average = (($Grades | ForEach-Object { $scores[$_] }) | Measure-Object -Average).Average

    if ($average -ge 2.67) { return 'A' }
    if ($average -ge 1.67) { return 'B' }
    return 'C'
}

function Get-CounterValue {
    param(
        [string]$Path,
        [int]$SampleInterval = 1
    )

    try {
        return (Get-Counter $Path -SampleInterval $SampleInterval -MaxSamples 1 -ErrorAction Stop).CounterSamples.CookedValue
    } catch {
        return $null
    }
}

function Get-GpuInfo {
    $gpuInfo = [ordered]@{
        Name        = 'Unavailable'
        UtilPercent = $null
        TempC       = $null
        Source      = 'None'
    }

    try {
        $gpu = Get-CimInstance Win32_VideoController -ErrorAction Stop | Select-Object -First 1
        if ($gpu) {
            $gpuInfo.Name = $gpu.Name
            $gpuInfo.Source = 'WMI'
        }
    } catch {}

    $nvidia = Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
    if ($nvidia) {
        try {
            $raw = & $nvidia.Path --query-gpu=utilization.gpu,temperature.gpu --format=csv,noheader,nounits 2>$null
            if ($raw) {
                $parts = $raw -split ','
                $gpuInfo.UtilPercent = [int]$parts[0].Trim()
                $gpuInfo.TempC = [int]$parts[1].Trim()
                $gpuInfo.Source = 'nvidia-smi'
            }
        } catch {}
    }

    [PSCustomObject]$gpuInfo
}

function Get-SystemHealth {
    param(
        [string]$Drive,
        [int]$CpuInterval
    )

    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $driveInfo = Get-PSDrive -Name $Drive -PSProvider FileSystem
    $uptime = (Get-Date) - $os.LastBootUpTime

    $cpuUsage = Get-CounterValue -Path '\Processor(_Total)\% Processor Time' -SampleInterval $CpuInterval
    $diskQueue = Get-CounterValue -Path '\PhysicalDisk(_Total)\Avg. Disk Queue Length'
    $memoryUsed = (($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) * 100
    $diskUsed = ($driveInfo.Used / ($driveInfo.Used + $driveInfo.Free)) * 100
    $gpu = Get-GpuInfo

    $cpuGrade = if ($null -eq $cpuUsage) { 'C' } else { Get-Grade -Value $cpuUsage -GoodThreshold 30 -OkayThreshold 60 }
    $memoryGrade = Get-Grade -Value $memoryUsed -GoodThreshold 50 -OkayThreshold 75
    $diskGrade = Get-Grade -Value $diskUsed -GoodThreshold 40 -OkayThreshold 70

    $processes = Get-Process | Where-Object { $null -ne $_.CPU }
    $topCpu = $processes |
        Sort-Object CPU -Descending |
        Select-Object -First 10 Name, Id,
            @{Name = 'CPU_TotalSec'; Expression = { [Math]::Round($_.CPU, 1) }},
            @{Name = 'WorkingSetMB'; Expression = { [Math]::Round($_.WorkingSet64 / 1MB, 1) }}
    $topRam = $processes |
        Sort-Object WorkingSet64 -Descending |
        Select-Object -First 10 Name, Id,
            @{Name = 'WorkingSetMB'; Expression = { [Math]::Round($_.WorkingSet64 / 1MB, 1) }},
            @{Name = 'CPU_TotalSec'; Expression = { [Math]::Round($_.CPU, 1) }}

    $services = try {
        $procTable = @{}
        Get-Process | ForEach-Object { $procTable[$_.Id] = $_ }
        Get-CimInstance Win32_Service |
            Where-Object { $_.State -eq 'Running' } |
            ForEach-Object {
                $proc = $procTable[[int]$_.ProcessId]
                [PSCustomObject]@{
                    Name         = $_.Name
                    DisplayName  = $_.DisplayName
                    StartMode    = $_.StartMode
                    ProcessId    = $_.ProcessId
                    WorkingSetMB = if ($proc) { [Math]::Round($proc.WorkingSet64 / 1MB, 1) } else { $null }
                }
            } |
            Sort-Object WorkingSetMB -Descending |
            Select-Object -First 15
    } catch { @() }

    $startup = try {
        Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location
    } catch { @() }

    $events = try {
        Get-WinEvent -LogName System -MaxEvents 200 -ErrorAction Stop |
            Where-Object { $_.LevelDisplayName -in @('Error', 'Warning') } |
            Select-Object -First 20 TimeCreated, LevelDisplayName, Id, ProviderName, Message
    } catch { @() }

    $network = try {
        Get-NetAdapter -Physical -ErrorAction Stop |
            Where-Object { $_.Status -eq 'Up' } |
            ForEach-Object {
                $stats = Get-NetAdapterStatistics -Name $_.Name
                [PSCustomObject]@{
                    Name        = $_.Name
                    LinkSpeed   = $_.LinkSpeed
                    BytesSentMB = [Math]::Round($stats.OutboundBytes / 1MB, 1)
                    BytesRecvMB = [Math]::Round($stats.InboundBytes / 1MB, 1)
                }
            }
    } catch { @() }

    $issues = @()
    if ($null -ne $cpuUsage -and $cpuUsage -gt 80) { $issues += 'CPU bottleneck: usage is above 80%.' }
    if (($os.FreePhysicalMemory / 1MB) -lt 1) { $issues += 'RAM pressure: free memory is below 1 GB.' }
    if ($null -ne $diskQueue -and $diskQueue -gt 2) { $issues += 'Disk bottleneck: queue length is above 2.' }
    if ($null -ne $gpu.UtilPercent -and $gpu.UtilPercent -gt 90) { $issues += 'GPU bottleneck: usage is above 90%.' }
    if ($null -ne $gpu.TempC -and $gpu.TempC -gt 85) { $issues += 'Thermal risk: GPU temperature is above 85 C.' }
    if (-not $issues) { $issues = @('No obvious bottlenecks detected.') }

    [PSCustomObject]@{
        Timestamp = (Get-Date).ToString('o')
        Summary = [PSCustomObject]@{
            ComputerName = $env:COMPUTERNAME
            OS = $os.Caption
            OSVersion = $os.Version
            CPU = $cpu.Name
            Cores = $cpu.NumberOfCores
            LogicalCPUs = $cpu.NumberOfLogicalProcessors
            TotalRAMGB = [Math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
            FreeRAMGB = [Math]::Round($os.FreePhysicalMemory / 1MB, 1)
            Uptime = '{0}d {1}h {2}m' -f $uptime.Days, $uptime.Hours, $uptime.Minutes
        }
        Metrics = [PSCustomObject]@{
            CPUUsagePercent = if ($null -eq $cpuUsage) { $null } else { [Math]::Round($cpuUsage, 2) }
            MemoryUsagePercent = [Math]::Round($memoryUsed, 2)
            DiskUsagePercent = [Math]::Round($diskUsed, 2)
            DiskQueue = if ($null -eq $diskQueue) { $null } else { [Math]::Round($diskQueue, 2) }
            DriveLetter = $Drive
            GPU = $gpu
        }
        Grades = [PSCustomObject]@{
            CPU = $cpuGrade
            Memory = $memoryGrade
            Disk = $diskGrade
            Overall = Get-OverallGrade -Grades @($cpuGrade, $memoryGrade, $diskGrade)
        }
        Bottlenecks = $issues
        TopCPUProcesses = $topCpu
        TopRAMProcesses = $topRam
        HeavyRunningServices = $services
        StartupPrograms = $startup
        RecentSystemEvents = $events
        NetworkAdapters = $network
    }
}

function Write-Section {
    param([string]$Title)
    Write-Host ''
    Write-Host ('=' * 70) -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ('=' * 70) -ForegroundColor Cyan
}

function Write-SystemHealthReport {
    param([object]$Report)

    Write-Host ''
    Write-Host '==================== SYSTEM HEALTH REPORT ====================' -ForegroundColor Cyan
    Write-Host "  $($Report.Timestamp)" -ForegroundColor Gray
    Write-Host '==============================================================' -ForegroundColor Cyan

    Write-Section 'SYSTEM SNAPSHOT'
    $Report.Summary | Format-List

    Write-Section 'LIVE LOAD AND GRADES'
    $Report.Metrics | Format-List
    $Report.Grades | Format-List

    Write-Section 'BOTTLENECK ANALYSIS'
    $Report.Bottlenecks | ForEach-Object { Write-Host "  $_" }

    Write-Section 'TOP PROCESSES BY CPU'
    $Report.TopCPUProcesses | Format-Table -AutoSize

    Write-Section 'TOP PROCESSES BY RAM'
    $Report.TopRAMProcesses | Format-Table -AutoSize

    Write-Section 'HEAVY RUNNING SERVICES'
    if ($Report.HeavyRunningServices) { $Report.HeavyRunningServices | Format-Table -AutoSize } else { Write-Host '  Unavailable.' }

    Write-Section 'STARTUP PROGRAMS'
    if ($Report.StartupPrograms) { $Report.StartupPrograms | Sort-Object Name | Format-Table -AutoSize } else { Write-Host '  No startup entries found or access denied.' }

    Write-Section 'RECENT SYSTEM ERRORS AND WARNINGS'
    if ($Report.RecentSystemEvents) { $Report.RecentSystemEvents | Format-Table -Wrap -AutoSize } else { Write-Host '  No recent errors/warnings found or log not accessible.' }

    Write-Section 'NETWORK SNAPSHOT'
    if ($Report.NetworkAdapters) { $Report.NetworkAdapters | Format-Table -AutoSize } else { Write-Host '  No active physical adapters detected.' }

    Write-Host ''
    Write-Host '===================== END OF REPORT =====================' -ForegroundColor Cyan
}

$report = Get-SystemHealth -Drive $DriveLetter -CpuInterval $Interval

if ($Json) {
    $report | ConvertTo-Json -Depth 5
} else {
    Write-SystemHealthReport -Report $report
}
