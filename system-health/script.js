(function () {
  const elements = {
    powershellTab: document.getElementById("powershellTab"),
    bashTab: document.getElementById("bashTab"),
    pythonTab: document.getElementById("pythonTab"),
    inDepthButton: document.getElementById("inDepthButton"),
    copyButton: document.getElementById("copyButton"),
    copyStatus: document.getElementById("copyStatus"),
    terminalTitle: document.getElementById("terminalTitle"),
    scriptBlock: document.querySelector("#scriptBlock code")
  };

  const scripts = {
    bash: `#!/usr/bin/env bash
# Read-only Linux/macOS system health check.
# Runs locally. Does not modify settings, stop processes, or delete files.
set -euo pipefail

echo "System Health"
echo "Host: $(hostname)"
echo "Kernel: $(uname -srmo)"
echo "Shell: \${SHELL:-unknown}"
echo "Timestamp: $(date -Iseconds)"

if command -v uptime >/dev/null 2>&1; then
  echo
  uptime
fi

echo
echo "Memory:"
if command -v free >/dev/null 2>&1; then
  free -h
elif command -v vm_stat >/dev/null 2>&1; then
  vm_stat
else
  echo "Memory details unavailable."
fi

echo
echo "Disk:"
df -h /

echo
echo "Top processes:"
ps -eo pid,comm,%cpu,%mem --sort=-%cpu 2>/dev/null | head -n 11 || ps aux | head -n 11`,
    powershell: `# Read-only Windows system health check.
# Runs locally. Does not modify settings, stop processes, or delete files.
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$drive = Get-PSDrive -Name C -PSProvider FileSystem
$cpuLoad = (Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 2 -MaxSamples 1).CounterSamples.CookedValue
$memoryUsed = [math]::Round((($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) * 100, 2)
$diskUsed = [math]::Round(($drive.Used / ($drive.Used + $drive.Free)) * 100, 2)

Write-Host "System Health" -ForegroundColor Cyan
[pscustomobject]@{
  ComputerName = $env:COMPUTERNAME
  OS = $os.Caption
  CPU = $cpu.Name
  CPUUsagePercent = [math]::Round($cpuLoad, 2)
  MemoryUsedPercent = $memoryUsed
  DiskCUsedPercent = $diskUsed
  PowerShell = $PSVersionTable.PSVersion.ToString()
  Timestamp = (Get-Date).ToString("o")
} | Format-List

Write-Host "Top CPU processes" -ForegroundColor Cyan
Get-Process | Where-Object CPU | Sort-Object CPU -Descending | Select-Object -First 10 Name, Id, CPU, @{Name="WorkingSetMB";Expression={[math]::Round($_.WorkingSet64 / 1MB, 1)}} | Format-Table -AutoSize`,
    powershellDeep: `#Requires -Version 5.1
<#
.SYNOPSIS
    PC Health Dashboard - CPU, RAM, Disk, GPU, Services, Startup, Errors

.DESCRIPTION
    Run in an elevated PowerShell for best results.
    Use -Verbose to see detailed scan steps.
#>

[CmdletBinding()]
param()

function Write-Section {
    param(
        [string]$Title
    )
    $hr = "=" * 70
    Write-Host ""
    Write-Host $hr -ForegroundColor Cyan
    Write-Host ("  {0}" -f $Title) -ForegroundColor Cyan
    Write-Host $hr -ForegroundColor Cyan
}

function Write-SubTitle {
    param(
        [string]$Title
    )
    Write-Host ""
    Write-Host ("[ {0} ]" -f $Title) -ForegroundColor Yellow
}

function Get-SystemSnapshot {
    Write-Verbose "Gathering system snapshot"
    $os  = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $uptime = (Get-Date) - $os.LastBootUpTime

    [PSCustomObject]@{
        OS          = $os.Caption
        OSVersion   = $os.Version
        CPU         = $cpu.Name
        Cores       = $cpu.NumberOfCores
        LogicalCPUs = $cpu.NumberOfLogicalProcessors
        RAM_GB      = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
        RAMFree_GB  = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
        Uptime      = "{0}d {1}h {2}m" -f $uptime.Days, $uptime.Hours, $uptime.Minutes
    }
}

function Get-LoadSnapshot {
    Write-Verbose "Collecting live load counters"
    $cpu  = (Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples.CookedValue
    $ramFreeMB = (Get-Counter '\\Memory\\Available MBytes').CounterSamples.CookedValue
    $diskQ = (Get-Counter '\\PhysicalDisk(_Total)\\Avg. Disk Queue Length').CounterSamples.CookedValue

    [PSCustomObject]@{
        CPU_UsagePct   = [math]::Round($cpu, 1)
        RAM_FreeMB     = [math]::Round($ramFreeMB, 0)
        Disk_Queue     = [math]::Round($diskQ, 2)
    }
}

function Get-GpuInfo {
    Write-Verbose "Trying to detect GPU load"
    $gpuInfo = [PSCustomObject]@{
        GPU_Name      = "Unknown"
        GPU_UtilPct   = $null
        GPU_TempC     = $null
        Source        = "None"
    }

    try {
        $gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1
        if ($gpu) {
            $gpuInfo.GPU_Name = $gpu.Name
            $gpuInfo.Source   = "WMI"
        }
    } catch {
        Write-Verbose "GPU WMI query failed"
    }

    $nvidia = Get-Command "nvidia-smi.exe" -ErrorAction SilentlyContinue
    if ($nvidia) {
        Write-Verbose "Found nvidia-smi, querying GPU stats"
        try {
            $raw = & $nvidia.Path --query-gpu=utilization.gpu,temperature.gpu --format=csv,noheader,nounits 2>$null
            if ($raw) {
                $parts = $raw -split ","
                $gpuInfo.GPU_UtilPct = [int]$parts[0].Trim()
                $gpuInfo.GPU_TempC   = [int]$parts[1].Trim()
                $gpuInfo.Source      = "nvidia-smi"
            }
        } catch {
            Write-Verbose "nvidia-smi query failed"
        }
    }

    return $gpuInfo
}

function Get-TopProcesses {
    Write-Verbose "Scanning top CPU and RAM processes"
    $procs = Get-Process | Where-Object { $_.CPU -ne $null }

    $topCpu = $procs |
        Sort-Object CPU -Descending |
        Select-Object -First 10 Name, Id,
            @{Name="CPU_TotalSec";Expression={[math]::Round($_.CPU,1)}},
            @{Name="WorkingSetMB";Expression={[math]::Round($_.WorkingSet64/1MB,1)}}

    $topRam = $procs |
        Sort-Object WorkingSet64 -Descending |
        Select-Object -First 10 Name, Id,
            @{Name="WorkingSetMB";Expression={[math]::Round($_.WorkingSet64/1MB,1)}},
            @{Name="CPU_TotalSec";Expression={[math]::Round($_.CPU,1)}}

    [PSCustomObject]@{
        TopCPU = $topCpu
        TopRAM = $topRam
    }
}

function Get-RunningServices {
    Write-Verbose "Collecting running services"
    $services = Get-WmiObject Win32_Service | Where-Object { $_.State -eq "Running" }

    $procTable = @{}
    Get-Process | ForEach-Object { $procTable[$_.Id] = $_ }

    $svcInfo = foreach ($svc in $services) {
        $p = $procTable[$svc.ProcessId]
        [PSCustomObject]@{
            Name        = $svc.Name
            DisplayName = $svc.DisplayName
            StartMode   = $svc.StartMode
            ProcessId   = $svc.ProcessId
            WorkingSetMB= if ($p) { [math]::Round($p.WorkingSet64/1MB,1) } else { $null }
        }
    }

    $svcInfo | Sort-Object WorkingSetMB -Descending | Select-Object -First 15
}

function Get-StartupPrograms {
    Write-Verbose "Enumerating startup programs"
    try {
        $startup = Get-CimInstance Win32_StartupCommand |
            Select-Object Name, Command, Location
    } catch {
        $startup = @()
    }

    $startup
}

function Get-RecentSystemErrors {
    Write-Verbose "Reading recent system errors and warnings"
    $events = Get-WinEvent -LogName System -MaxEvents 200 -ErrorAction SilentlyContinue |
        Where-Object { $_.LevelDisplayName -in @("Error","Warning") } |
        Select-Object -First 20 TimeCreated, LevelDisplayName, Id, ProviderName, Message

    $events
}

function Get-NetworkSnapshot {
    Write-Verbose "Checking basic network stats"
    $adapters = Get-NetAdapter -Physical -ErrorAction SilentlyContinue |
        Where-Object { $_.Status -eq "Up" }

    $stats = foreach ($a in $adapters) {
        $s = Get-NetAdapterStatistics -Name $a.Name
        [PSCustomObject]@{
            Name        = $a.Name
            LinkSpeed   = $a.LinkSpeed
            BytesSentMB = [math]::Round($s.OutboundBytes/1MB,1)
            BytesRecvMB = [math]::Round($s.InboundBytes/1MB,1)
        }
    }

    $stats
}

function Detect-Bottlenecks {
    param(
        [Parameter(Mandatory)]$Load,
        [Parameter(Mandatory)]$Sys,
        [Parameter(Mandatory)]$Gpu
    )

    Write-Verbose "Running bottleneck analysis"

    $issues = @()

    if ($Load.CPU_UsagePct -gt 80) {
        $issues += "CPU bottleneck (CPU > 80%)"
    }
    if ($Sys.RAMFree_GB -lt 1) {
        $issues += "RAM pressure (Free RAM < 1 GB)"
    }
    if ($Load.Disk_Queue -gt 2) {
        $issues += "Disk bottleneck (Disk queue > 2)"
    }
    if ($Gpu.GPU_UtilPct -ne $null -and $Gpu.GPU_UtilPct -gt 90) {
        $issues += "GPU bottleneck (GPU > 90%)"
    }
    if ($Gpu.GPU_TempC -ne $null -and $Gpu.GPU_TempC -gt 85) {
        $issues += "Thermal risk (GPU temp > 85 C)"
    }

    if (-not $issues) {
        $issues = @("No obvious bottlenecks detected")
    }

    $issues
}

Clear-Host
Write-Host ""
Write-Host "==================== PC HEALTH DASHBOARD ====================" -ForegroundColor Cyan
Write-Host ("  {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm')) -ForegroundColor Gray
Write-Host "=============================================================" -ForegroundColor Cyan

Write-Section "SYSTEM SNAPSHOT"
$sys = Get-SystemSnapshot
Write-Host ("  OS:        {0} (v{1})" -f $sys.OS, $sys.OSVersion)
Write-Host ("  CPU:       {0}" -f $sys.CPU)
Write-Host ("  Cores:     {0} physical / {1} logical" -f $sys.Cores, $sys.LogicalCPUs)
Write-Host ("  RAM:       {0} GB total / {1} GB free" -f $sys.RAM_GB, $sys.RAMFree_GB)
Write-Host ("  Uptime:    {0}" -f $sys.Uptime)

Write-Section "LIVE LOAD"
$load = Get-LoadSnapshot
$gpu  = Get-GpuInfo

$cpuColor  = if ($load.CPU_UsagePct -gt 80) { "Red" } elseif ($load.CPU_UsagePct -gt 60) { "Yellow" } else { "Green" }
$ramColor  = if ($sys.RAMFree_GB -lt 1) { "Red" } elseif ($sys.RAMFree_GB -lt 2) { "Yellow" } else { "Green" }
$diskColor = if ($load.Disk_Queue -gt 2) { "Red" } elseif ($load.Disk_Queue -gt 1) { "Yellow" } else { "Green" }

Write-Host ("  CPU Usage:   {0} %" -f $load.CPU_UsagePct) -ForegroundColor $cpuColor
Write-Host ("  RAM Free:    {0} MB" -f $load.RAM_FreeMB) -ForegroundColor $ramColor
Write-Host ("  Disk Queue:  {0}" -f $load.Disk_Queue) -ForegroundColor $diskColor

if ($gpu.GPU_Name -ne "Unknown") {
    $gpuUtilColor = if ($gpu.GPU_UtilPct -gt 90) { "Red" } elseif ($gpu.GPU_UtilPct -gt 70) { "Yellow" } else { "Green" }
    $gpuTempColor = if ($gpu.GPU_TempC -gt 85) { "Red" } elseif ($gpu.GPU_TempC -gt 75) { "Yellow" } else { "Green" }

    Write-Host ("  GPU:         {0} (Source: {1})" -f $gpu.GPU_Name, $gpu.Source)
    if ($gpu.GPU_UtilPct -ne $null) {
        Write-Host ("  GPU Usage:   {0} %" -f $gpu.GPU_UtilPct) -ForegroundColor $gpuUtilColor
    }
    if ($gpu.GPU_TempC -ne $null) {
        Write-Host ("  GPU Temp:    {0} C" -f $gpu.GPU_TempC) -ForegroundColor $gpuTempColor
    }
} else {
    Write-Host "  GPU:         Not detected or basic only" -ForegroundColor Gray
}

Write-Section "BOTTLENECK ANALYSIS"
$bottlenecks = Detect-Bottlenecks -Load $load -Sys $sys -Gpu $gpu
foreach ($b in $bottlenecks) {
    if ($b -like "*No obvious*") {
        Write-Host ("  {0}" -f $b) -ForegroundColor Green
    } else {
        Write-Host ("  WARNING: {0}" -f $b) -ForegroundColor Yellow
    }
}

Write-Section "TOP PROCESSES"
$tp = Get-TopProcesses

Write-SubTitle "Top 10 by CPU time"
$tp.TopCPU | Format-Table -AutoSize

Write-SubTitle "Top 10 by RAM usage"
$tp.TopRAM | Format-Table -AutoSize

Write-Section "HEAVY RUNNING SERVICES"
$svc = Get-RunningServices
$svc | Format-Table -AutoSize

Write-Section "STARTUP PROGRAMS"
$startup = Get-StartupPrograms
if ($startup -and $startup.Count -gt 0) {
    $startup | Sort-Object Name | Format-Table -AutoSize
} else {
    Write-Host "  No startup entries found or access denied." -ForegroundColor Gray
}

Write-Section "RECENT SYSTEM ERRORS & WARNINGS"
$events = Get-RecentSystemErrors
if ($events -and $events.Count -gt 0) {
    $events | Select-Object TimeCreated, LevelDisplayName, Id, ProviderName, Message |
        Format-Table -Wrap -AutoSize
} else {
    Write-Host "  No recent errors/warnings found or log not accessible." -ForegroundColor Green
}

Write-Section "NETWORK SNAPSHOT"
$net = Get-NetworkSnapshot
if ($net -and $net.Count -gt 0) {
    $net | Format-Table -AutoSize
} else {
    Write-Host "  No active physical adapters detected." -ForegroundColor Gray
}

Write-Host ""
Write-Host "===================== END OF REPORT =====================" -ForegroundColor Cyan
Write-Host "Tip: Use -Verbose for detailed scan steps" -ForegroundColor Gray
Write-Host ""`,
    python: `#!/usr/bin/env python3
"""Read-only system health report. Runs locally and prints JSON."""

import json
import platform
import shutil
from datetime import datetime, timezone

try:
    import psutil
except ImportError:
    psutil = None

def grade(value, good, okay):
    if value is None:
        return "unknown"
    if value < good:
        return "A"
    if value < okay:
        return "B"
    return "C"

disk = shutil.disk_usage("/")
disk_used_percent = round((disk.used / disk.total) * 100, 2)
cpu_percent = round(psutil.cpu_percent(interval=1), 2) if psutil else None
memory_percent = round(psutil.virtual_memory().percent, 2) if psutil else None

print(json.dumps({
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "system": {
        "hostname": platform.node(),
        "os": platform.platform(),
        "python": platform.python_version(),
    },
    "metrics": {
        "cpu_percent": cpu_percent,
        "memory_percent": memory_percent,
        "disk_percent": disk_used_percent,
    },
    "grades": {
        "cpu": grade(cpu_percent, 30, 60),
        "memory": grade(memory_percent, 50, 75),
        "disk": grade(disk_used_percent, 40, 70),
    },
}, indent=2))`
  };

  const titles = {
    bash: "bash",
    powershell: "powershell.exe",
    powershellDeep: "powershell.exe - In-depth report",
    python: "python system-health.py"
  };

  let activeScript = "bash";

  function setScript(name) {
    activeScript = name;
    elements.bashTab.classList.toggle("active", name === "bash");
    elements.powershellTab.classList.toggle("active", name === "powershell" || name === "powershellDeep");
    elements.pythonTab.classList.toggle("active", name === "python");
    elements.bashTab.setAttribute("aria-selected", String(name === "bash"));
    elements.powershellTab.setAttribute("aria-selected", String(name === "powershell" || name === "powershellDeep"));
    elements.pythonTab.setAttribute("aria-selected", String(name === "python"));
    elements.terminalTitle.textContent = titles[name];
    elements.scriptBlock.textContent = scripts[name];
    elements.copyStatus.textContent = "";
  }

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(scripts[activeScript]);
      elements.copyStatus.textContent = "Copied";
    } catch (_) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(elements.scriptBlock);
      selection.removeAllRanges();
      selection.addRange(range);
      elements.copyStatus.textContent = "Selected";
    }
  }

  elements.powershellTab.addEventListener("click", () => setScript("powershell"));
  elements.bashTab.addEventListener("click", () => setScript("bash"));
  elements.pythonTab.addEventListener("click", () => setScript("python"));
  elements.inDepthButton.addEventListener("click", () => setScript("powershellDeep"));
  elements.copyButton.addEventListener("click", copyScript);

  setScript("bash");
})();
