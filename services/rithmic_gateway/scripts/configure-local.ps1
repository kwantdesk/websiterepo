param(
  [string]$EnvPath = (Join-Path $PSScriptRoot "..\operator.env")
)

$ErrorActionPreference = "Stop"
$serviceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $serviceRoot "..\..")).Path
$resolvedEnv = (Resolve-Path -LiteralPath $EnvPath).Path
$webEnvPath = Join-Path $repositoryRoot ".env.local"

function Get-EnvEntry([string]$Path, [string]$Name) {
  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_ -match ("^" + [regex]::Escape($Name) + "=") } |
    Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -split "=", 2)[1]
}

function Set-EnvEntry([string]$Path, [string]$Name, [string]$Value) {
  $lines = @(
    if (Test-Path -LiteralPath $Path) {
      Get-Content -LiteralPath $Path
    }
  )
  $prefix = "$Name="
  $replaced = $false
  for ($index = 0; $index -lt $lines.Count; $index += 1) {
    if ($lines[$index].StartsWith($prefix, [System.StringComparison]::Ordinal)) {
      $lines[$index] = "$prefix$Value"
      $replaced = $true
      break
    }
  }
  if (-not $replaced) {
    $lines += "$prefix$Value"
  }
  Set-Content -LiteralPath $Path -Value $lines -Encoding utf8
}

$password = Get-EnvEntry -Path $resolvedEnv -Name "RITHMIC_PASSWORD"
if ([string]::IsNullOrWhiteSpace($password)) {
  throw "RITHMIC_PASSWORD is missing from $resolvedEnv"
}

$token = Get-EnvEntry -Path $resolvedEnv -Name "KWANTIFY_MARKET_DATA_GATEWAY_TOKEN"
if ([string]::IsNullOrWhiteSpace($token)) {
  $randomBytes = [byte[]]::new(48)
  $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $randomGenerator.GetBytes($randomBytes)
  } finally {
    $randomGenerator.Dispose()
  }
  $token = [Convert]::ToBase64String($randomBytes).
    TrimEnd("=").
    Replace("+", "-").
    Replace("/", "_")
  Set-EnvEntry -Path $resolvedEnv -Name "KWANTIFY_MARKET_DATA_GATEWAY_TOKEN" -Value $token
}

Set-EnvEntry -Path $webEnvPath -Name "KWANTIFY_MARKET_DATA_PROVIDER" -Value "Rithmic"
Set-EnvEntry -Path $webEnvPath -Name "KWANTIFY_MARKET_DATA_GATEWAY_URL" -Value "http://127.0.0.1:8793"
Set-EnvEntry -Path $webEnvPath -Name "KWANTIFY_MARKET_DATA_GATEWAY_TOKEN" -Value $token

Write-Output "Configured the local Olisa Labs Platform Rithmic gateway and Kwantify server proxy."
Write-Output "No credential or gateway-token values were printed."
