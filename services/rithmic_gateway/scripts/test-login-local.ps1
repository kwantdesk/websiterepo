param(
  [string]$EnvPath = (Join-Path $PSScriptRoot "..\operator.env")
)

$ErrorActionPreference = "Stop"
$resolvedEnv = (Resolve-Path -LiteralPath $EnvPath).Path
$serviceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

foreach ($rawLine in Get-Content -LiteralPath $resolvedEnv) {
  $line = $rawLine.Trim()
  if (-not $line -or $line.StartsWith("#")) {
    continue
  }
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

Push-Location $serviceRoot
try {
  if ($env:NODE_OPTIONS -notmatch "(^|\s)--use-system-ca(\s|$)") {
    $env:NODE_OPTIONS = ("$env:NODE_OPTIONS --use-system-ca").Trim()
  }
  & node "scripts/test-login.mjs"
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
