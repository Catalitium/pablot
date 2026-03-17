param(
  [string]$FixturePath = "$PSScriptRoot/fixtures/linear_vectors.json",
  [string]$OutputDir = "$PSScriptRoot/output",
  [double]$Epsilon = 0.000001
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$pythonOut = Join-Path $OutputDir 'python-results.json'
$cppOut = Join-Path $OutputDir 'cpp-results.json'
$reportOut = Join-Path $OutputDir 'parity-report.json'
$cppExe = Join-Path $OutputDir 'perf_solver.exe'

$pythonAvailable = $null -ne (Get-Command python -ErrorAction SilentlyContinue)
$cppAvailable = $null -ne (Get-Command g++ -ErrorAction SilentlyContinue)

if ($pythonAvailable) {
  python "$PSScriptRoot/reference_solver.py" $FixturePath $pythonOut | Out-Null
}

if ($cppAvailable) {
  & g++ "$PSScriptRoot/perf_solver.cpp" -O2 -std=c++17 -o $cppExe
  & $cppExe $FixturePath $cppOut
}

$cases = @()
$pyMap = @{}
$cppMap = @{}

if (Test-Path $pythonOut) {
  $py = Get-Content -Raw $pythonOut | ConvertFrom-Json
  foreach ($r in $py.results) { $pyMap[$r.case_id] = $r }
}

if (Test-Path $cppOut) {
  $cp = Get-Content -Raw $cppOut | ConvertFrom-Json
  foreach ($r in $cp.results) { $cppMap[$r.case_id] = $r }
}

$fixture = Get-Content -Raw $FixturePath | ConvertFrom-Json
foreach ($c in $fixture.cases) {
  $cid = $c.id
  $pyR = $pyMap[$cid]
  $cppR = $cppMap[$cid]

  $pyStatus = if ($pyR) { [string]$pyR.status } else { 'blocked' }
  $cppStatus = if ($cppR) { [string]$cppR.status } else { 'blocked' }

  $maxDiff = 0.0
  if ($pyR -and $cppR -and $pyR.solution -and $cppR.solution -and $pyR.solution.Count -eq $cppR.solution.Count) {
    for ($i=0; $i -lt $pyR.solution.Count; $i++) {
      $d = [math]::Abs([double]$pyR.solution[$i] - [double]$cppR.solution[$i])
      if ($d -gt $maxDiff) { $maxDiff = $d }
    }
  }

  $parity = if ($pyR -and $cppR -and $pyStatus -eq 'pass' -and $cppStatus -eq 'pass' -and $maxDiff -le $Epsilon) { 'pass' } else { 'blocked' }
  if (($pyStatus -eq 'blocked' -and $cppStatus -eq 'blocked') -and ([string]$c.expect -eq 'singular')) {
    $parity = 'pass'
  }

  $cases += [pscustomobject]@{
    case_id = $cid
    python_status = $pyStatus
    cpp_status = $cppStatus
    max_abs_diff = [math]::Round($maxDiff, 12)
    parity_status = $parity
  }
}

$overall = if ($cases.Count -gt 0 -and ($cases | Where-Object { $_.parity_status -ne 'pass' }).Count -eq 0) { 'pass' } else { 'blocked' }

$report = [pscustomobject]@{
  generated_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  fixture_path = $FixturePath
  epsilon = $Epsilon
  runtime = [pscustomobject]@{
    python_available = $pythonAvailable
    cpp_available = $cppAvailable
  }
  overall_status = $overall
  cases = $cases
}

$report | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $reportOut
Write-Output "parity-report: $reportOut"
