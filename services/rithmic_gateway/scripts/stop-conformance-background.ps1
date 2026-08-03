$ErrorActionPreference = "Stop"
$runtimeRoot = Join-Path $env:LOCALAPPDATA "OlisaLabsPlatform\rithmic-conformance"
$pidPath = Join-Path $runtimeRoot "order-plant.pid"

if (-not (Test-Path -LiteralPath $pidPath)) {
  Write-Output "Rithmic Order Plant conformance connection is not running."
  exit 0
}

$processId = [int](Get-Content -LiteralPath $pidPath -Raw)
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $processId
  Write-Output "Rithmic Order Plant conformance connection stopped (PID $processId)."
} else {
  Write-Output "Rithmic Order Plant conformance process $processId was not active."
}

Remove-Item -LiteralPath $pidPath -Force
