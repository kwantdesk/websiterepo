$ErrorActionPreference = "Stop"

$electronVersion = "38.6.0"
$repoRoot = Split-Path -Parent $PSScriptRoot
$installRoot = Join-Path $env:LOCALAPPDATA "Programs\KwantDesk"
$cacheRoot = Join-Path $env:LOCALAPPDATA "KwantDesk\DesktopInstallerCache"
$archivePath = Join-Path $cacheRoot "electron-v$electronVersion-win32-x64.zip"
$rceditPath = Join-Path $cacheRoot "rcedit-x64.exe"
$stageRoot = Join-Path $env:TEMP "kwantdesk-desktop-$electronVersion"
$stageApp = Join-Path $stageRoot "resources\app"
$iconPath = Join-Path $repoRoot "public\icons\kwantdesk-app.ico"

New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null

if (-not (Test-Path $archivePath)) {
  Invoke-WebRequest `
    -Uri "https://github.com/electron/electron/releases/download/v$electronVersion/electron-v$electronVersion-win32-x64.zip" `
    -OutFile $archivePath
}

if (-not (Test-Path $rceditPath)) {
  Invoke-WebRequest `
    -Uri "https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe" `
    -OutFile $rceditPath
}

$resolvedTemp = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
$resolvedStage = [IO.Path]::GetFullPath($stageRoot)
if (-not $resolvedStage.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to replace a staging directory outside the Windows temp folder."
}
if (Test-Path $stageRoot) {
  Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
Expand-Archive -LiteralPath $archivePath -DestinationPath $stageRoot -Force

New-Item -ItemType Directory -Force -Path (Join-Path $stageApp "public\icons") | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "main.cjs") -Destination (Join-Path $stageApp "main.cjs") -Force
Copy-Item -LiteralPath $iconPath -Destination (Join-Path $stageApp "public\icons\kwantdesk-app.ico") -Force
@{
  name = "kwantdesk-desktop"
  productName = "KwantDesk"
  version = "1.0.0"
  main = "main.cjs"
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stageApp "package.json") -Encoding UTF8

$stageExe = Join-Path $stageRoot "electron.exe"
$brandedExe = Join-Path $stageRoot "KwantDesk.exe"
Move-Item -LiteralPath $stageExe -Destination $brandedExe -Force
& $rceditPath $brandedExe `
  --set-icon $iconPath `
  --set-version-string ProductName "KwantDesk" `
  --set-version-string FileDescription "KwantDesk Desktop" `
  --set-version-string CompanyName "KwantDesk" `
  --set-version-string InternalName "KwantDesk" `
  --set-file-version "1.0.0" `
  --set-product-version "1.0.0"

Get-Process KwantDesk -ErrorAction SilentlyContinue | Stop-Process -Force
New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
Copy-Item -Path (Join-Path $stageRoot "*") -Destination $installRoot -Recurse -Force

$installedExe = Join-Path $installRoot "KwantDesk.exe"
$shell = New-Object -ComObject WScript.Shell
$shortcutTargets = @(
  (Join-Path ([Environment]::GetFolderPath("Desktop")) "KwantDesk.lnk"),
  (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\KwantDesk.lnk")
)
foreach ($shortcutPath in $shortcutTargets) {
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $installedExe
  $shortcut.WorkingDirectory = $installRoot
  $shortcut.IconLocation = "$installedExe,0"
  $shortcut.Description = "Open the latest live version of KwantDesk"
  $shortcut.Save()
}

Start-Process -FilePath $installedExe
Write-Output "Installed KwantDesk at $installedExe"
Write-Output "Desktop shortcut: $($shortcutTargets[0])"
