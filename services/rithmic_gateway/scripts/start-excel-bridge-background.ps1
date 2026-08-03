param(
  [string]$EnvPath = (Join-Path $PSScriptRoot "..\operator.env"),
  [string]$WorkbookName = "Book1",
  [string]$SheetName = "Order Book-Full",
  [string]$Exchange = "CME",
  [string]$ContractSymbol = "NQU6",
  [int]$PollIntervalMs = 250
)

$ErrorActionPreference = "Stop"
$resolvedEnv = (Resolve-Path -LiteralPath $EnvPath).Path
$runtimeRoot = Join-Path $env:LOCALAPPDATA "OlisaLabsPlatform\rtrader-excel-bridge"
$pidPath = Join-Path $runtimeRoot "bridge.pid"
$stdoutPath = Join-Path $runtimeRoot "stdout.log"
$stderrPath = Join-Path $runtimeRoot "stderr.log"
$bridgePath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "rtrader-excel-bridge.ps1")).Path

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
if (Test-Path -LiteralPath $pidPath) {
  $existingPid = [int](Get-Content -LiteralPath $pidPath -Raw)
  $existing = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Output "RTrader Pro Excel bridge is already running (PID $existingPid)."
    exit 0
  }
}

$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", ('"' + $bridgePath + '"'),
  "-EnvPath", ('"' + $resolvedEnv + '"'),
  "-WorkbookName", ('"' + $WorkbookName + '"'),
  "-SheetName", ('"' + $SheetName + '"'),
  "-Exchange", $Exchange,
  "-ContractSymbol", $ContractSymbol,
  "-PollIntervalMs", [string]$PollIntervalMs
)
$process = Start-Process `
  -FilePath "powershell.exe" `
  -ArgumentList $arguments `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -PassThru

Set-Content -LiteralPath $pidPath -Value $process.Id -Encoding ascii
Start-Sleep -Milliseconds 1200
$process.Refresh()
if ($process.HasExited) {
  throw "RTrader Pro Excel bridge exited during startup. Inspect $stderrPath"
}
Write-Output "RTrader Pro Excel bridge started (PID $($process.Id))."
Write-Output "Logs: $runtimeRoot"
