param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^https://")]
  [string]$GatewayUrl,
  [string]$ProjectName = "websiterepo-yfmi",
  [string]$EnvPath = (Join-Path $PSScriptRoot "..\operator.env")
)

$ErrorActionPreference = "Stop"
$resolvedEnv = (Resolve-Path -LiteralPath $EnvPath).Path
$gatewayOrigin = $GatewayUrl.TrimEnd("/")

function Get-EnvEntry([string]$Path, [string]$Name) {
  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_ -match ("^" + [regex]::Escape($Name) + "=") } |
    Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -split "=", 2)[1]
}

function Set-VercelValue(
  [string]$Name,
  [string]$Value,
  [string]$Environment,
  [bool]$Sensitive
) {
  $temporaryPath = Join-Path ([IO.Path]::GetTempPath()) ("kwantdesk-" + [Guid]::NewGuid() + ".value")
  try {
    Set-Content -LiteralPath $temporaryPath -Value $Value -NoNewline -Encoding utf8
    $arguments = @(
      "--yes", "vercel@latest", "env", "add", $Name, $Environment,
      "--force", "--yes"
    )
    if ($Sensitive) { $arguments += "--sensitive" }
    Get-Content -LiteralPath $temporaryPath -Raw | & npx @arguments | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Vercel rejected $Name for $Environment."
    }
  } finally {
    if (Test-Path -LiteralPath $temporaryPath) {
      Remove-Item -LiteralPath $temporaryPath -Force
    }
  }
}

$token = Get-EnvEntry -Path $resolvedEnv -Name "KWANTIFY_MARKET_DATA_GATEWAY_TOKEN"
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "The local gateway token is missing from operator.env."
}
$health = Invoke-RestMethod -Uri "$gatewayOrigin/health" -TimeoutSec 10
if (-not $health.configured) {
  throw "The public gateway URL responded but the gateway is not configured."
}

& npx --yes vercel@latest link --yes --project $ProjectName | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not link Vercel project $ProjectName." }

foreach ($environment in @("production", "preview")) {
  Set-VercelValue -Name "KWANTDESK_MARKET_DATA_PROVIDER" -Value "Rithmic" -Environment $environment -Sensitive $false
  Set-VercelValue -Name "KWANTDESK_MARKET_DATA_GATEWAY_URL" -Value $gatewayOrigin -Environment $environment -Sensitive $false
  Set-VercelValue -Name "KWANTDESK_MARKET_DATA_GATEWAY_TOKEN" -Value $token -Environment $environment -Sensitive $true
  Set-VercelValue -Name "KWANTIFY_MARKET_DATA_PROVIDER" -Value "Rithmic" -Environment $environment -Sensitive $false
  Set-VercelValue -Name "KWANTIFY_MARKET_DATA_GATEWAY_URL" -Value $gatewayOrigin -Environment $environment -Sensitive $false
  Set-VercelValue -Name "KWANTIFY_MARKET_DATA_GATEWAY_TOKEN" -Value $token -Environment $environment -Sensitive $true
}

Write-Output "Configured the Kwant Desk Vercel project for the persistent Rithmic gateway."
Write-Output "No gateway token was printed. Push or redeploy once to apply the new environment values."
