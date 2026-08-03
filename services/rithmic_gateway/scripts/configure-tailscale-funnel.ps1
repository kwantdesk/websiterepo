param(
  [int]$LocalPort = 8793
)

$ErrorActionPreference = "Stop"
$status = tailscale status --json | ConvertFrom-Json
if ($status.BackendState -ne "Running" -or -not $status.Self.Online) {
  throw "Tailscale is not signed in. Use the Windows tray icon to log in first."
}
tailscale funnel --bg --https=443 --yes "http://127.0.0.1:$LocalPort" | Out-Null
$funnel = tailscale funnel status --json | ConvertFrom-Json
$url = @($funnel.Web.PSObject.Properties.Name) | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($url)) {
  throw "Tailscale Funnel did not return a public HTTPS URL."
}
Write-Output "Tailscale Funnel is persistent and active."
Write-Output $url
