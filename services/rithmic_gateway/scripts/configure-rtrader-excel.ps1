param(
  [string]$EnvPath = (Join-Path $PSScriptRoot "..\operator.env")
)

$ErrorActionPreference = "Stop"
$serviceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$templatePath = Join-Path $serviceRoot "operator.env.template"
$targetPath = [IO.Path]::GetFullPath($EnvPath)

if (-not (Test-Path -LiteralPath $targetPath)) {
  Copy-Item -LiteralPath $templatePath -Destination $targetPath
}

function Set-EnvEntry([string]$Path, [string]$Name, [string]$Value) {
  $lines = @(Get-Content -LiteralPath $Path)
  $prefix = "$Name="
  $replaced = $false
  for ($index = 0; $index -lt $lines.Count; $index += 1) {
    if ($lines[$index].StartsWith($prefix, [StringComparison]::Ordinal)) {
      $lines[$index] = "$prefix$Value"
      $replaced = $true
      break
    }
  }
  if (-not $replaced) { $lines += "$prefix$Value" }
  Set-Content -LiteralPath $Path -Value $lines -Encoding utf8
}

Set-EnvEntry -Path $targetPath -Name "RITHMIC_SOURCE_MODE" -Value "rtrader-excel"
Set-EnvEntry -Path $targetPath -Name "RITHMIC_SYSTEM_NAME" -Value "RTrader Pro"
Set-EnvEntry -Path $targetPath -Name "RITHMIC_EXCEL_STALE_MS" -Value "3000"

& (Join-Path $PSScriptRoot "configure-local.ps1") -EnvPath $targetPath
Write-Output "Configured read-only RTrader Pro Excel bridge mode."
