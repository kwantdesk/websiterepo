param(
  [string]$EnvPath = (Join-Path $PSScriptRoot "..\operator.env")
)

$ErrorActionPreference = "Stop"
$resolvedEnv = (Resolve-Path -LiteralPath $EnvPath).Path
$startScript = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "start-supervisor-background.ps1")).Path
$startupFolder = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupFolder "Kwant Desk Market Data.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`" -EnvPath `"$resolvedEnv`""
$shortcut.WorkingDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$shortcut.WindowStyle = 7
$shortcut.Description = "Keeps the Kwant Desk RTrader market-data bridge running after Windows login."
$shortcut.Save()
Write-Output "Installed Kwant Desk market-data autostart for this Windows user."
