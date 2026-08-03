$ErrorActionPreference = "Stop"
$runtimeRoot = Join-Path $env:LOCALAPPDATA "OlisaLabsPlatform\rtrader-excel-bridge"
$pidPath = Join-Path $runtimeRoot "bridge.pid"

if (-not (Test-Path -LiteralPath $pidPath)) {
  Write-Output "RTrader Pro Excel bridge is not running."
  exit 0
}
$bridgePid = [int](Get-Content -LiteralPath $pidPath -Raw)
$process = Get-Process -Id $bridgePid -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $bridgePid
  $process.WaitForExit(5000)
}
Remove-Item -LiteralPath $pidPath -Force
Write-Output "RTrader Pro Excel bridge stopped."
