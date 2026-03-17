# Entry parameters so users can control runtime, parallelism, JSON output, and duration scaling.
param(
    [switch]$Quick,
    [int]$Threads = 0,
    [switch]$Json,
    [int]$DurationSec = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<# 
 Overview:
 - Collect system info and choose safe data sizes
 - Run three micro-benchmarks (HashBench, MemSweep, CalcBench)
 - Score + grade the results, emit TXT/CSV/optional JSON
 This script intentionally favors clarity and determinism so junior engineers can trace every step.
#>

<# 
 .SYNOPSIS
  Forces a short garbage collection cycle to keep memory pressure predictable between tests.
#>
function Invoke-GCSoft {
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
    [GC]::Collect()
}

<# 
 .SYNOPSIS
  Clamp a numeric value between two bounds (lightweight helper used across sizing math).
#>
function Clamp {
    param(
        [double]$Value,
        [double]$Min,
        [double]$Max
    )
    if ($Value -lt $Min) { return $Min }
    if ($Value -gt $Max) { return $Max }
    return $Value
}

<# 
 .SYNOPSIS
  Resolves the effective worker count (auto when <=0, capped at 8 for fairness).
#>
function Get-ThreadCount {
    param([int]$Requested)
    $auto = [Environment]::ProcessorCount
    $count = if ($Requested -le 0) { $auto } else { $Requested }
    if ($count -lt 1) { $count = 1 }
    return [int][Math]::Min(8, $count)
}

<# 
 .SYNOPSIS
  Converts the optional -DurationSec override into a multiplier for workload sizing.
#>
function Get-DurationScale {
    param(
        [switch]$QuickMode,
        [int]$OverrideSeconds
    )
    $default = if ($QuickMode) { 40 } else { 120 }
    if ($OverrideSeconds -le 0) { return 1.0 }
    $scale = $OverrideSeconds / $default
    return [double](Clamp -Value $scale -Min 0.25 -Max 1.5)
}

<# 
 .SYNOPSIS
  Samples CurrentClockSpeed via CIM so we can detect large thermal throttling dips.
#>
function Get-ClockSample {
    try {
        $samples = Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop
        if ($samples) {
            $avg = ($samples | Measure-Object -Property CurrentClockSpeed -Average).Average
            return [double]$avg
        }
    } catch { }
    return $null
}

<# 
 .SYNOPSIS
  Collects OS, PowerShell, CPU, and memory facts once so every benchmark + report has consistent metadata.
#>
function Get-SystemSnapshot {
    param([int]$ThreadCount)
    $cpu = $null
    try { $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop | Select-Object -First 1 Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed, CurrentClockSpeed } catch { }
    if (-not $cpu) {
        $cpu = [pscustomobject]@{
            Name                       = $env:PROCESSOR_IDENTIFIER
            NumberOfCores              = $null
            NumberOfLogicalProcessors  = [Environment]::ProcessorCount
            MaxClockSpeed              = $null
            CurrentClockSpeed          = $null
        }
    }
    $os = [System.Environment]::OSVersion.VersionString
    $edition = if ($PSVersionTable.ContainsKey('PSEdition')) { $PSVersionTable.PSEdition } else { 'Desktop' }
    $mem = $null
    try { $mem = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop } catch { }
    $totalBytes = if ($mem) { [long]$mem.TotalVisibleMemorySize * 1024 } else { 0 }
    $freeBytes = if ($mem) { [long]$mem.FreePhysicalMemory * 1024 } else { 0 }
    return [pscustomobject]@{
        OS             = $os
        PSEdition      = $edition
        PSVersion      = $PSVersionTable.PSVersion.ToString()
        CPU            = $cpu
        TotalMemoryGiB = if ($totalBytes) { [Math]::Round($totalBytes / 1GB, 2) } else { $null }
        FreeMemoryGiB  = if ($freeBytes) { [Math]::Round($freeBytes / 1GB, 2) } else { $null }
        FreeBytes      = $freeBytes
        Threads        = $ThreadCount
    }
}

<# 
 .SYNOPSIS
  Enforces the "≤25% free RAM or 512 MB" guardrail for buffer allocations (never below 128 MB).
#>
function Get-MemoryTarget {
    param(
        [long]$FreeBytes,
        [long]$DesiredBytes
    )
    if ($FreeBytes -le 0) { $FreeBytes = 1024L * 1024L * 1024L } # assume 1 GiB free if unknown
    $guard = [long][Math]::Min($FreeBytes * 0.25, 512MB)
    if ($guard -lt 128MB) { $guard = 128MB }
    if ($guard -le 0) { $guard = 128MB }
    $target = [long][Math]::Min($DesiredBytes, $guard)
    if ($target -lt 128MB) { $target = [long][Math]::Min($guard, 128MB) }
    return $target
}

<# 
 .SYNOPSIS
  Converts a byte array into a lowercase hex digest so results are easy to compare.
#>
function Format-HexDigest {
    param([byte[]]$Bytes)
    return -join ($Bytes | ForEach-Object { $_.ToString('x2') })
}

<# 
 .SYNOPSIS
  Runs the SHA-256 throughput benchmark with deterministic data and optional parallel hashing.
 .DESCRIPTION
  - Fills a byte buffer with pseudo-random data (same seed each run)
  - Warms the crypto provider to reduce JIT noise
  - Hashes the buffer either single-threaded or via ParallelHashUtil segments
  - Returns elapsed time, throughput, bytes processed, and the final digest
#>
function Invoke-HashBench {
    param(
        [long]$SizeBytes,
        [int]$ThreadCount,
        [type]$HashHelperType
    )
    $result = [ordered]@{
        sizeBytes     = $SizeBytes
        elapsedMs     = 0
        throughputMBs = 0
        digest        = ''
        bytesProcessed= 0
        error         = $null
    }
    try {
        $buffer = New-Object byte[] $SizeBytes
        $rand = New-Object System.Random 1337
        $chunk = 4MB
        # Populate the buffer chunk-by-chunk so we do not allocate temporary 256 MB arrays.
        for ($offset = 0; $offset -lt $SizeBytes; $offset += $chunk) {
            $len = [Math]::Min($chunk, $SizeBytes - $offset)
            $temp = New-Object byte[] $len
            $rand.NextBytes($temp)
            [System.Buffer]::BlockCopy($temp, 0, $buffer, $offset, $len)
        }
        $shaWarm = [System.Security.Cryptography.SHA256]::Create()
        # Short warm-up to trigger JIT and fill caches.
        $shaWarm.ComputeHash($buffer, 0, [Math]::Min(4096, $SizeBytes)) | Out-Null
        $shaWarm.Dispose()
        $sw = [Diagnostics.Stopwatch]::StartNew()
        if ($ThreadCount -le 1 -or -not $HashHelperType) {
            if ($ThreadCount -gt 1 -and -not $HashHelperType) {
                Write-Warning "Parallel hashing helper unavailable; running single-thread."
            }
            $sha = [System.Security.Cryptography.SHA256]::Create()
            $digestBytes = $sha.ComputeHash($buffer)
            $sha.Dispose()
        } else {
            $segments = [Math]::Min($ThreadCount, [int][Math]::Max(1, [Math]::Floor($SizeBytes / 4MB)))
            if ($segments -lt 1) { $segments = 1 }
            $digests = $HashHelperType::HashSegments($buffer, $segments, $ThreadCount)
            $combined = New-Object byte[] ($digests.Length * 32)
            for ($i = 0; $i -lt $digests.Length; $i++) {
                $segmentDigest = [byte[]]$digests[$i]
                [System.Buffer]::BlockCopy($segmentDigest, 0, $combined, $i * 32, 32)
            }
            # Combine per-segment digests deterministically so multi-threaded runs stay comparable.
            $shaFinal = [System.Security.Cryptography.SHA256]::Create()
            $digestBytes = $shaFinal.ComputeHash($combined)
            $shaFinal.Dispose()
        }
        $sw.Stop()
        $seconds = [Math]::Max(0.0001, $sw.Elapsed.TotalSeconds)
        $result.elapsedMs = [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)
        $result.bytesProcessed = $SizeBytes
        $result.throughputMBs = [Math]::Round((($SizeBytes / 1000000.0) / $seconds), 2)
        $result.digest = Format-HexDigest -Bytes $digestBytes
    } catch {
        $result.error = $_.Exception.Message
    } finally {
        $buffer = $null
        Invoke-GCSoft
    }
    return [pscustomobject]$result
}

<# 
 .SYNOPSIS
  Exercises a large byte buffer with 64-byte stride writes then reads to approximate memory bandwidth.
#>
function Invoke-MemSweep {
    param([long]$SizeBytes)
    $result = [ordered]@{
        sizeBytes      = $SizeBytes
        writeMs        = 0
        readMs         = 0
        writeMBs       = 0
        readMBs        = 0
        checksum       = 0
        error          = $null
    }
    try {
        $memSweepType = ([System.Management.Automation.PSTypeName]'MemSweepUtil').Type
        if ($memSweepType) {
            $metrics = $memSweepType::Run([int]$SizeBytes)
            $result.writeMs = [Math]::Round($metrics.WriteMs, 2)
            $result.readMs = [Math]::Round($metrics.ReadMs, 2)
            $result.checksum = $metrics.Checksum
        } else {
            $buffer = New-Object byte[] $SizeBytes
            $stride = 64
            $value = 0
            $writeSw = [Diagnostics.Stopwatch]::StartNew()
            # Write loop touches every cache line-sized chunk in order.
            for ($offset = 0; $offset -lt $SizeBytes; $offset += $stride) {
                $block = [Math]::Min($stride, $SizeBytes - $offset)
                for ($i = 0; $i -lt $block; $i++) {
                    $value = ($value + 29) -band 0xFF
                    $buffer[$offset + $i] = [byte]$value
                }
            }
            $writeSw.Stop()
            $result.writeMs = [Math]::Round($writeSw.Elapsed.TotalMilliseconds, 2)
            $readSw = [Diagnostics.Stopwatch]::StartNew()
            [UInt64]$checksum = 0
            # Read loop accumulates every byte to avoid the optimizer throwing away the work.
            for ($i = 0; $i -lt $SizeBytes; $i++) {
                $checksum += $buffer[$i]
            }
            $readSw.Stop()
            $result.readMs = [Math]::Round($readSw.Elapsed.TotalMilliseconds, 2)
            $result.checksum = $checksum
            $buffer = $null
        }
        $result.writeMBs = if ($result.writeMs -gt 0) {
            [Math]::Round((($SizeBytes / 1000000.0) / ($result.writeMs / 1000)), 2)
        } else { 0 }
        $result.readMBs = if ($result.readMs -gt 0) {
            [Math]::Round((($SizeBytes / 1000000.0) / ($result.readMs / 1000)), 2)
        } else { 0 }
    } catch {
        $result.error = $_.Exception.Message
    } finally {
        Invoke-GCSoft
    }
    return [pscustomobject]$result
}

<# 
 .SYNOPSIS
  Compiles the optional C# helpers (prime sieve + parallel hash) once per session.
 .NOTES
  Add-Type often fails on constrained hosts, so we log a warning and fall back gracefully.
#>
function Ensure-PrimeUtil {
    try {
        if (-not ([System.Management.Automation.PSTypeName]'PrimeUtil').Type) {
$nativeCode = @"
using System;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Diagnostics;

public static class PrimeUtil {
    public static int SieveCount(int n, out int lastPrime) {
        lastPrime = 0;
        if (n < 2) { return 0; }
        var sieve = new bool[n + 1];
        int root = (int)Math.Sqrt(n);
        for (int p = 2; p <= root; p++) {
            if (sieve[p]) { continue; }
            for (int m = p * p; m <= n; m += p) {
                sieve[m] = true;
            }
        }
        int count = 0;
        for (int i = 2; i <= n; i++) {
            if (!sieve[i]) {
                count++;
                lastPrime = i;
            }
        }
        return count;
    }
}

public static class ParallelHashUtil {
    public static byte[][] HashSegments(byte[] buffer, int segments, int maxDegree) {
        if (buffer == null) {
            throw new ArgumentNullException("buffer");
        }
        if (segments < 1) { segments = 1; }
        if (buffer.Length == 0) {
            segments = 1;
        }
        var options = new ParallelOptions { MaxDegreeOfParallelism = Math.Max(1, maxDegree) };
        var digests = new byte[segments][];
        int baseLen = buffer.Length / segments;
        int remainder = buffer.Length % segments;
        Parallel.For(0, segments, options, i => {
            int offset = (baseLen * i) + Math.Min(i, remainder);
            int len = (i == segments - 1) ? buffer.Length - offset : baseLen + (i < remainder ? 1 : 0);
            if (len < 0) { len = 0; }
            using (var sha = SHA256.Create()) {
                if (len <= 0) {
                    digests[i] = sha.ComputeHash(new byte[0]);
                } else {
                    digests[i] = sha.ComputeHash(buffer, offset, len);
                }
            }
        });
        return digests;
    }
}

public struct MemSweepMetrics {
    public double WriteMs;
    public double ReadMs;
    public ulong Checksum;
}

public static class MemSweepUtil {
    public static MemSweepMetrics Run(int sizeBytes) {
        if (sizeBytes < 0) { throw new ArgumentOutOfRangeException("sizeBytes"); }
        var buffer = new byte[sizeBytes];
        int stride = 64;
        byte value = 0;
        var metrics = new MemSweepMetrics();
        var sw = Stopwatch.StartNew();
        for (int offset = 0; offset < sizeBytes; offset += stride) {
            int block = Math.Min(stride, sizeBytes - offset);
            for (int i = 0; i < block; i++) {
                unchecked { value += 29; }
                buffer[offset + i] = value;
            }
        }
        sw.Stop();
        metrics.WriteMs = sw.Elapsed.TotalMilliseconds;
        sw.Restart();
        ulong checksum = 0;
        for (int i = 0; i < sizeBytes; i++) {
            checksum += buffer[i];
        }
        sw.Stop();
        metrics.ReadMs = sw.Elapsed.TotalMilliseconds;
        metrics.Checksum = checksum;
        return metrics;
    }
}
"@
Add-Type -Language CSharp -TypeDefinition $nativeCode -PassThru | Out-Null
        }
        return [type]'PrimeUtil'
    } catch {
        Write-Warning ("Add-Type PrimeUtil failed: {0}" -f $_.Exception.Message)
        return $null
    }
}

<# 
 .SYNOPSIS
  Counts primes up to N using the compiled C# sieve when available, otherwise a smaller PS fallback.
#>
function Invoke-CalcBench {
    param(
        [int]$Limit,
        [int]$FallbackLimit,
        [type]$PrimeType
    )
    $result = [ordered]@{
        n            = $Limit
        primesFound  = 0
        lastPrime    = 0
        elapsedMs    = 0
        fastPath     = $false
        error        = $null
    }
    try {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        if ($PrimeType) {
            $last = 0
            $count = $PrimeType::SieveCount($Limit, [ref]$last)
            $sw.Stop()
            $result.n = $Limit
            $result.primesFound = $count
            $result.lastPrime = $last
            $result.elapsedMs = [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)
            $result.fastPath = $true
        } else {
            throw "PrimeUtil unavailable"
        }
    } catch {
        $result.error = $_.Exception.Message
        $limit = $FallbackLimit
        $sw = [Diagnostics.Stopwatch]::StartNew()
        $arr = New-Object bool[] ($limit + 1)
        $root = [math]::Floor([math]::Sqrt($limit))
        for ($p = 2; $p -le $root; $p++) {
            if ($arr[$p]) { continue }
            for ($m = $p * $p; $m -le $limit; $m += $p) {
                $arr[$m] = $true
            }
        }
        $count = 0
        $lastPrime = 0
        for ($i = 2; $i -le $limit; $i++) {
            if (-not $arr[$i]) { $count++; $lastPrime = $i }
        }
        $sw.Stop()
        $result.n = $limit
        $result.primesFound = $count
        $result.lastPrime = $lastPrime
        $result.elapsedMs = [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)
        $result.fastPath = $false
    } finally {
        Invoke-GCSoft
    }
    return [pscustomobject]$result
}

<# 
 .SYNOPSIS
  Converts a throughput metric (higher is better) into a 0-100 score.
#>
function Measure-LinearScore {
    param(
        [double]$Value,
        [double]$Low,
        [double]$High
    )
    if ($Value -le $Low) { return 0 }
    if ($Value -ge $High) { return 100 }
    return [math]::Round((($Value - $Low) / ($High - $Low)) * 100, 2)
}

<# 
 .SYNOPSIS
  Converts a latency metric (lower is better) into a 0-100 score.
#>
function Measure-InverseScore {
    param(
        [double]$Value,
        [double]$LowGood,
        [double]$HighBad
    )
    if ($Value -le $LowGood) { return 100 }
    if ($Value -ge $HighBad) { return 0 }
    return [math]::Round((( $HighBad - $Value) / ($HighBad - $LowGood)) * 100, 2)
}

$threadCount = Get-ThreadCount -Requested $Threads
$scale = Get-DurationScale -QuickMode:($Quick.IsPresent) -OverrideSeconds $DurationSec
$system = Get-SystemSnapshot -ThreadCount $threadCount
$startClock = $null
if ($system.CPU -and $system.CPU.CurrentClockSpeed) {
    try { $startClock = [double]$system.CPU.CurrentClockSpeed } catch { $startClock = $null }
}
if (-not $startClock) {
    $startClock = Get-ClockSample
}

<# 
 Main execution flow:
 1. Decide workload sizes based on quick/default mode, DurationSec, and memory guardrails.
 2. Run HashBench, MemSweep, and CalcBench (each wrapped with warnings on error).
 3. Score the results, generate insights, and write TXT/CSV (+ optional JSON).
#>
$baseHash = if ($Quick) { 96MB } else { 256MB }
$hashSize = Get-MemoryTarget -FreeBytes $system.FreeBytes -DesiredBytes ([long]($baseHash * $scale))
$memSize = $hashSize
$basePrime = if ($Quick) { 800000 } else { 2000000 }
$primeLimit = [int][Math]::Max(10000, [math]::Round($basePrime * $scale))
$fallbackPrime = if ($Quick) { 100000 } else { 200000 }

Write-Host "cpu-benchmark: warming up..."
$primeType = Ensure-PrimeUtil
$hashHelperType = ([System.Management.Automation.PSTypeName]'ParallelHashUtil').Type
# Run the three benchmarks back-to-back with warnings when we have to fall back.
$hashResult = Invoke-HashBench -SizeBytes $hashSize -ThreadCount $threadCount -HashHelperType $hashHelperType
if ($hashResult.error) { Write-Warning "HashBench error: $($hashResult.error)" }
Write-Host ("HashBench: {0} MB processed in {1} ms ({2} MB/s)" -f [Math]::Round($hashResult.sizeBytes / 1MB,2), $hashResult.elapsedMs, $hashResult.throughputMBs)
$memResult = Invoke-MemSweep -SizeBytes $memSize
if ($memResult.error) { Write-Warning "MemSweep error: $($memResult.error)" }
Write-Host ("MemSweep: write {0} MB/s, read {1} MB/s" -f $memResult.writeMBs, $memResult.readMBs)
$calcResult = Invoke-CalcBench -Limit $primeLimit -FallbackLimit $fallbackPrime -PrimeType $primeType
if ($calcResult.error) { Write-Warning "CalcBench fallback engaged: $($calcResult.error)" }
Write-Host ("CalcBench: {0} primes (N={1}) in {2} ms" -f $calcResult.primesFound, $calcResult.n, $calcResult.elapsedMs)
$endClock = Get-ClockSample

# Translate raw metrics into normalized 0-100 subscores so we can explain the grade.
$hashScore = if ($hashResult.throughputMBs -gt 0) { Measure-LinearScore -Value $hashResult.throughputMBs -Low 400 -High 2000 } else { 0 }
$memWriteScore = if ($memResult.writeMBs -gt 0) { Measure-LinearScore -Value $memResult.writeMBs -Low 2000 -High 12000 } else { 0 }
$memReadScore = if ($memResult.readMBs -gt 0) { Measure-LinearScore -Value $memResult.readMBs -Low 3000 -High 20000 } else { 0 }
$calcScore = if ($calcResult.elapsedMs -gt 0) { Measure-InverseScore -Value $calcResult.elapsedMs -LowGood 500 -HighBad 3000 } else { 0 }
$memAvgScore = ($memWriteScore + $memReadScore) / 2
$overallScore = [math]::Round((0.35 * $hashScore) + (0.35 * $memAvgScore) + (0.30 * $calcScore), 2)

$grade = 'D'
if ($overallScore -ge 90 -and $hashScore -ge 70 -and $memWriteScore -ge 70 -and $memReadScore -ge 70 -and $calcScore -ge 70) {
    $grade = 'A'
} elseif ($overallScore -ge 70) {
    $grade = 'B'
} elseif ($overallScore -ge 50) {
    $grade = 'C'
}

# Build friendly insight bullets so humans can interpret the numbers quickly.
$insights = New-Object System.Collections.Generic.List[string]
if ($memAvgScore -lt ($hashScore - 20)) {
    $insights.Add("Memory bandwidth likely bottleneck.")
}
if ($hashScore -gt ($calcScore + 25)) {
    $insights.Add("Strong vector ops; scalar integer calc comparatively weaker.")
}
if ($calcScore -lt 40) {
    $insights.Add("Integer throughput low; check power plan or thermal throttling.")
}
if ($hashResult.error -or $memResult.error -or $calcResult.error) {
    $insights.Add("Some tests skipped or reduced due to environment limits.")
}
$thermalDrop = $null
# Compare clock samples to flag if the CPU throttled significantly mid run.
if ($startClock -and $endClock -and $startClock -gt 0) {
    $thermalDrop = [math]::Round((($startClock - $endClock) / $startClock) * 100, 2)
    if ($thermalDrop -gt 10) {
        $insights.Add("Thermal guard: CPU clock dipped ${thermalDrop}% during run.")
    }
}
if ($insights.Count -eq 0) {
    $insights.Add("Balanced run; no obvious bottleneck.")
}
if ($insights.Count -gt 3) {
    $insights = $insights[0..2]
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$reportsDir = Join-Path -Path $PSScriptRoot -ChildPath 'reports'
if (-not (Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Path $reportsDir | Out-Null
}
$reportBase = "cpu-benchmark-$timestamp"
$reportPath = Join-Path $reportsDir "$reportBase.txt"
$csvPath = Join-Path $reportsDir "$reportBase.csv"

$cpuInfo = $system.CPU
# Persist a friendly TXT report that mirrors the sample provided in the requirements.
$report = @(
    "cpu-benchmark-tester :: $timestamp",
    "OS: $($system.OS)",
    "PowerShell: $($system.PSEdition) $($system.PSVersion)",
    ("CPU: {0} (Cores: {1}, Logical: {2}, Max MHz: {3})" -f $cpuInfo.Name, $cpuInfo.NumberOfCores, $cpuInfo.NumberOfLogicalProcessors, $cpuInfo.MaxClockSpeed),
    ("Memory: Total {0} GiB, Free {1} GiB" -f $system.TotalMemoryGiB, $system.FreeMemoryGiB),
    "Threads used: $($system.Threads)",
    "",
    ("HashBench-SHA256: size {0} MB, elapsed {1} ms, {2} MB/s, digest {3}" -f [Math]::Round($hashResult.sizeBytes / 1MB, 2), $hashResult.elapsedMs, $hashResult.throughputMBs, $hashResult.digest),
    ("MemSweep: size {0} MB, write {1} ms ({2} MB/s), read {3} ms ({4} MB/s), checksum {5}" -f [Math]::Round($memResult.sizeBytes / 1MB, 2), $memResult.writeMs, $memResult.writeMBs, $memResult.readMs, $memResult.readMBs, $memResult.checksum),
    ("CalcBench-Prime: N {0}, primes {1}, last {2}, elapsed {3} ms ({4})" -f $calcResult.n, $calcResult.primesFound, $calcResult.lastPrime, $calcResult.elapsedMs, ($(if ($calcResult.fastPath) { 'C#' } else { 'PS fallback' }))),
    "",
    ("Scores: Hash {0}, MemWrite {1}, MemRead {2}, Calc {3}" -f $hashScore, $memWriteScore, $memReadScore, $calcScore),
    ("Overall score: {0} / 100, Grade: {1}" -f $overallScore, $grade),
    "",
    "Insights:",
    ($insights | ForEach-Object { " - $_" }),
    "",
    "Disclaimer: Not an industry-standard benchmark; results depend on runtime conditions."
)
$report | Set-Content -Path $reportPath -Encoding UTF8

# CSV sidecar makes it easy to compare runs in Excel/Sheets later.
$csvHeaders = "timestamp,grade,overall,hashMBps,memWriteMBps,memReadMBps,calcMs,threads,quick,durationScale,hashSizeMB,memSizeMB,primeN,thermalDrop"
$thermalCsvValue = if ($null -ne $thermalDrop) { $thermalDrop } else { '' }
$csvValues = @(
    $timestamp,
    $grade,
    $overallScore,
    $hashResult.throughputMBs,
    $memResult.writeMBs,
    $memResult.readMBs,
    $calcResult.elapsedMs,
    $system.Threads,
    ($Quick.IsPresent),
    $scale,
    [Math]::Round($hashResult.sizeBytes / 1MB, 2),
    [Math]::Round($memResult.sizeBytes / 1MB, 2),
    $calcResult.n,
    $thermalCsvValue
)
if (-not (Test-Path $csvPath)) {
    ($csvHeaders) | Out-File -FilePath $csvPath -Encoding UTF8
}
($csvValues -join ',') | Add-Content -Path $csvPath -Encoding UTF8

Write-Host ("Overall score: {0} => Grade {1}" -f $overallScore, $grade)
if ($grade -eq 'A') {
    Write-Host "Grade A = top-tier (near GPU-like for these micro-ops)."
}
Write-Host "Report: $reportPath"
Write-Host "CSV: $csvPath"

# Structured object for -Json output so automation can consume the same data.
$jsonObject = [pscustomobject]@{
    system = [pscustomobject]@{
        os = $system.OS
        psEdition = $system.PSEdition
        psVersion = $system.PSVersion
        cpu = $cpuInfo
        memoryGiB = @{
            total = $system.TotalMemoryGiB
            free  = $system.FreeMemoryGiB
        }
        threads = $system.Threads
    }
    hash = $hashResult
    mem = $memResult
    calc = $calcResult
    scores = [pscustomobject]@{
        hash    = $hashScore
        memWrite= $memWriteScore
        memRead = $memReadScore
        calc    = $calcScore
        overall = $overallScore
        grade   = $grade
    }
    insights = $insights
    reportPath = $reportPath
    csvPath = $csvPath
}
if ($Json) {
    $jsonObject | ConvertTo-Json -Depth 6
}
