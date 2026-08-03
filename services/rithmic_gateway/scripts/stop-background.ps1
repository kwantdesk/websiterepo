$ErrorActionPreference = "Stop"
$runtimeRoot = Join-Path $env:LOCALAPPDATA "OlisaLabsPlatform\rithmic-gateway"
$pidPath = Join-Path $runtimeRoot "gateway.pid"

if (-not (Test-Path -LiteralPath $pidPath)) {
  Write-Output "Olisa Labs Platform Rithmic gateway is not running."
  exit 0
}

$gatewayPid = [int](Get-Content -LiteralPath $pidPath -Raw)
$process = Get-Process -Id $gatewayPid -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $gatewayPid
  $process.WaitForExit(5000)
}
Remove-Item -LiteralPath $pidPath -Force
Write-Output "Olisa Labs Platform Rithmic gateway stopped."
