param(
  [string]$EnvPath = (Join-Path $PSScriptRoot "..\operator.env"),
  [string]$WorkbookName = "Book1",
  [string]$SheetName = "Order Book-Full",
  [string]$Exchange = "CME",
  [string]$ContractSymbol = "NQU6",
  [int]$PollIntervalMs = 250
)

$ErrorActionPreference = "Continue"
$resolvedEnv = [IO.Path]::GetFullPath($EnvPath)
$gatewayStart = Join-Path $PSScriptRoot "start-background.ps1"
$bridgeStart = Join-Path $PSScriptRoot "start-excel-bridge-background.ps1"
$runtimeRoot = Join-Path $env:LOCALAPPDATA "OlisaLabsPlatform\market-data-supervisor"
$heartbeatPath = Join-Path $runtimeRoot "heartbeat.json"

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

function Test-ProcessFromPidFile([string]$PidPath) {
  if (-not (Test-Path -LiteralPath $PidPath)) { return $false }
  try {
    $processId = [int](Get-Content -LiteralPath $PidPath -Raw)
    return $null -ne (Get-Process -Id $processId -ErrorAction SilentlyContinue)
  } catch {
    return $false
  }
}

while ($true) {
  $gatewayPidPath = Join-Path $env:LOCALAPPDATA "OlisaLabsPlatform\rithmic-gateway\gateway.pid"
  $bridgePidPath = Join-Path $env:LOCALAPPDATA "OlisaLabsPlatform\rtrader-excel-bridge\bridge.pid"

  if (-not (Test-ProcessFromPidFile -PidPath $gatewayPidPath)) {
    & $gatewayStart -EnvPath $resolvedEnv | Out-Null
    Start-Sleep -Seconds 2
  }
  if (-not (Test-ProcessFromPidFile -PidPath $bridgePidPath)) {
    & $bridgeStart `
      -EnvPath $resolvedEnv `
      -WorkbookName $WorkbookName `
      -SheetName $SheetName `
      -Exchange $Exchange `
      -ContractSymbol $ContractSymbol `
      -PollIntervalMs $PollIntervalMs | Out-Null
  }

  $gatewayHealthy = $false
  try {
    $health = Invoke-RestMethod `
      -Uri "http://127.0.0.1:8793/health" `
      -TimeoutSec 3
    $gatewayHealthy = $null -ne $health
  } catch {
    $gatewayHealthy = $false
  }
  @{
    timestamp = [DateTimeOffset]::UtcNow.ToString("O")
    gatewayHealthy = $gatewayHealthy
    gatewayProcess = Test-ProcessFromPidFile -PidPath $gatewayPidPath
    bridgeProcess = Test-ProcessFromPidFile -PidPath $bridgePidPath
  } | ConvertTo-Json -Compress | Set-Content -LiteralPath $heartbeatPath -Encoding utf8

  Start-Sleep -Seconds 10
}
