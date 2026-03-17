param(
  [string]$FixturePath = "$PSScriptRoot/fixtures/signals.json",
  [string]$OutputDir = "$PSScriptRoot/output",
  [double]$AmpTolerance = 0.0005
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$pythonOut = Join-Path $OutputDir 'python-fft.json'
$cppOut = Join-Path $OutputDir 'cpp-fft.json'
$reportOut = Join-Path $OutputDir 'parity-benchmark-report.json'
$cppExe = Join-Path $OutputDir 'perf_fft.exe'

$pythonAvailable = $null -ne (Get-Command python -ErrorAction SilentlyContinue)
$cppAvailable = $null -ne (Get-Command g++ -ErrorAction SilentlyContinue)

if ($pythonAvailable) { python "$PSScriptRoot/reference_fft.py" $FixturePath $pythonOut | Out-Null }
if ($cppAvailable) {
  & g++ "$PSScriptRoot/perf_fft.cpp" -O2 -std=c++17 -o $cppExe
  & $cppExe $FixturePath $cppOut
}

$pyMap = @{}
$cppMap = @{}
if (Test-Path $pythonOut) { $py = Get-Content -Raw $pythonOut | ConvertFrom-Json; foreach($c in $py.cases){$pyMap[$c.case_id]=$c} }
if (Test-Path $cppOut) { $cp = Get-Content -Raw $cppOut | ConvertFrom-Json; foreach($c in $cp.cases){$cppMap[$c.case_id]=$c} }

$fixture = Get-Content -Raw $FixturePath | ConvertFrom-Json
$cases = @()
foreach($sig in $fixture.signals){
  $id = $sig.id
  $pyCase = $pyMap[$id]
  $cppCase = $cppMap[$id]
  $pyStatus = if($pyCase){[string]$pyCase.status}else{'blocked'}
  $cppStatus = if($cppCase){[string]$cppCase.status}else{'blocked'}
  $maxDiff = 0.0

  if($pyCase -and $cppCase){
    $n = [Math]::Min($pyCase.spectrum.Count, $cppCase.spectrum.Count)
    for($i=0; $i -lt $n; $i++){
      $d = [Math]::Abs([double]$pyCase.spectrum[$i].amplitude - [double]$cppCase.spectrum[$i].amplitude)
      if($d -gt $maxDiff){$maxDiff = $d}
    }
  }

  $parity = if($pyCase -and $cppCase -and $pyStatus -eq 'pass' -and $cppStatus -eq 'pass' -and $maxDiff -le $AmpTolerance){'pass'} else {'blocked'}

  $cases += [pscustomobject]@{
    case_id = $id
    python_status = $pyStatus
    cpp_status = $cppStatus
    max_amp_diff = [math]::Round($maxDiff, 12)
    parity_status = $parity
  }
}

$overall = if(($cases | Where-Object {$_.parity_status -ne 'pass'}).Count -eq 0 -and $cases.Count -gt 0){'pass'}else{'blocked'}
$report = [pscustomobject]@{
  generated_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  fixture_path = $FixturePath
  amplitude_tolerance = $AmpTolerance
  runtime = [pscustomobject]@{ python_available=$pythonAvailable; cpp_available=$cppAvailable }
  overall_status = $overall
  cases = $cases
}
$report | ConvertTo-Json -Depth 7 | Set-Content -Encoding UTF8 $reportOut
Write-Output "parity-report: $reportOut"
