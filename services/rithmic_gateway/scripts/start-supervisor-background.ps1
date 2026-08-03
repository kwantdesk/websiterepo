param(
  [string]$EnvPath = (Join-Path $PSScriptRoot "..\operator.env"),
  [string]$WorkbookName = "Book1",
  [string]$SheetName = "Order Book-Full",
  [string]$Exchange = "CME",
  [string]$ContractSymbol = "NQU6"
)

$ErrorActionPreference = "Stop"
$resolvedEnv = (Resolve-Path -LiteralPath $EnvPath).Path
$supervisorPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "market-data-supervisor.ps1")).Path
$runtimeRoot = Join-Path $env:LOCALAPPDATA "OlisaLabsPlatform\market-data-supervisor"
$pidPath = Join-Path $runtimeRoot "supervisor.pid"
$stdoutPath = Join-Path $runtimeRoot "stdout.log"
$stderrPath = Join-Path $runtimeRoot "stderr.log"
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

if (Test-Path -LiteralPath $pidPath) {
  $existingPid = [int](Get-Content -LiteralPath $pidPath -Raw)
  if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
    Write-Output "Market-data supervisor is already running (PID $existingPid)."
    exit 0
  }
}

$arguments = @(
  "-NoProfile", "-ExecutionPolicy", "Bypass",
  "-File", ('"' + $supervisorPath + '"'),
  "-EnvPath", ('"' + $resolvedEnv + '"'),
  "-WorkbookName", ('"' + $WorkbookName + '"'),
  "-SheetName", ('"' + $SheetName + '"'),
  "-Exchange", $Exchange,
  "-ContractSymbol", $ContractSymbol
)
$process = Start-Process `
  -FilePath "powershell.exe" `
  -ArgumentList $arguments `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -PassThru
Set-Content -LiteralPath $pidPath -Value $process.Id -Encoding ascii
Write-Output "Market-data supervisor started (PID $($process.Id))."
