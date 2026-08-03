param(
  [string]$EnvPath = (Join-Path $PSScriptRoot "..\operator.env")
)

$ErrorActionPreference = "Stop"
$serviceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$resolvedEnv = (Resolve-Path -LiteralPath $EnvPath).Path
$runtimeRoot = Join-Path $env:LOCALAPPDATA "OlisaLabsPlatform\rithmic-gateway"
$pidPath = Join-Path $runtimeRoot "gateway.pid"
$stdoutPath = Join-Path $runtimeRoot "stdout.log"
$stderrPath = Join-Path $runtimeRoot "stderr.log"

foreach ($rawLine in Get-Content -LiteralPath $resolvedEnv) {
  $line = $rawLine.Trim()
  if (-not $line -or $line.StartsWith("#")) { continue }
  $parts = $line -split "=", 2
  if ($parts.Count -ne 2 -or -not $parts[0].Trim()) {
    throw "Invalid environment entry in $resolvedEnv"
  }
  [Environment]::SetEnvironmentVariable(
    $parts[0].Trim(),
    $parts[1],
    [EnvironmentVariableTarget]::Process
  )
}

if ([string]::IsNullOrWhiteSpace($env:RITHMIC_PASSWORD)) {
  throw "RITHMIC_PASSWORD is not configured."
}
if ([string]::IsNullOrWhiteSpace($env:KWANTIFY_MARKET_DATA_GATEWAY_TOKEN)) {
  throw "Run configure-local.ps1 before starting the gateway."
}
if ($env:NODE_OPTIONS -notmatch "(^|\s)--use-system-ca(\s|$)") {
  $env:NODE_OPTIONS = ("$env:NODE_OPTIONS --use-system-ca").Trim()
}

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
if (Test-Path -LiteralPath $pidPath) {
  $existingPid = [int](Get-Content -LiteralPath $pidPath -Raw)
  $existing = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Output "Olisa Labs Platform Rithmic gateway is already running (PID $existingPid)."
    exit 0
  }
}

$process = Start-Process `
  -FilePath "node" `
  -ArgumentList "src/server.mjs" `
  -WorkingDirectory $serviceRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -PassThru

Set-Content -LiteralPath $pidPath -Value $process.Id -Encoding ascii
Start-Sleep -Milliseconds 1200
$process.Refresh()
if ($process.HasExited) {
  throw "Rithmic gateway exited during startup. Inspect $stderrPath"
}

Write-Output "Olisa Labs Platform Rithmic gateway started (PID $($process.Id))."
Write-Output "Health: http://127.0.0.1:8793/health"
Write-Output "Logs: $runtimeRoot"
