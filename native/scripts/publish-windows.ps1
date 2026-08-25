[CmdletBinding()]
param(
    [ValidateSet('win-x64')]
    [string]$Runtime = 'win-x64'
)

$ErrorActionPreference = 'Stop'

$nativeRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$artifactsRoot = [System.IO.Path]::GetFullPath((Join-Path $nativeRoot 'artifacts'))
$version = (Get-Content -LiteralPath (Join-Path $nativeRoot 'VERSION') -Raw).Trim()
$packageName = "KwantDesk-Workstation-$version-$Runtime"
$publishDirectory = [System.IO.Path]::GetFullPath((Join-Path $artifactsRoot $packageName))
$archivePath = [System.IO.Path]::GetFullPath((Join-Path $artifactsRoot "$packageName.zip"))
$manifestPath = [System.IO.Path]::GetFullPath((Join-Path $artifactsRoot "$packageName.developer-manifest.json"))
$projectPath = Join-Path $nativeRoot 'src\KwantDesk.Workstation\KwantDesk.Workstation.csproj'
$localDotnet = Join-Path $env:LOCALAPPDATA 'KwantDesk\dotnet-sdk\dotnet.exe'

$dotnet = if (Test-Path -LiteralPath $localDotnet) {
    $localDotnet
} else {
    (Get-Command dotnet -ErrorAction Stop).Source
}

New-Item -ItemType Directory -Path $artifactsRoot -Force | Out-Null

if (-not $publishDirectory.StartsWith($artifactsRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to replace a publish directory outside native/artifacts: $publishDirectory"
}

if (Test-Path -LiteralPath $publishDirectory) {
    Remove-Item -LiteralPath $publishDirectory -Recurse -Force
}

if (Test-Path -LiteralPath $archivePath) {
    if (-not $archivePath.StartsWith($artifactsRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to replace an archive outside native/artifacts: $archivePath"
    }
    Remove-Item -LiteralPath $archivePath -Force
}

if (Test-Path -LiteralPath $manifestPath) {
    Remove-Item -LiteralPath $manifestPath -Force
}

& $dotnet publish $projectPath `
    --configuration Release `
    --runtime $Runtime `
    --self-contained true `
    --output $publishDirectory `
    -p:PublishSingleFile=false `
    -p:PublishReadyToRun=true `
    -p:DebugType=None `
    -p:DebugSymbols=false

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE"
}

$executable = Join-Path $publishDirectory 'KwantDesk.Workstation.exe'
if (-not (Test-Path -LiteralPath $executable)) {
    throw "Published executable was not created: $executable"
}

Compress-Archive -LiteralPath $publishDirectory -DestinationPath $archivePath -CompressionLevel Optimal

$archive = Get-Item -LiteralPath $archivePath
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = [ordered]@{
    schemaVersion = 1
    channel = 'alpha'
    version = $version
    runtime = $Runtime
    file = $archive.Name
    bytes = $archive.Length
    sha256 = $archiveHash
    generatedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
    signed = $false
    productionEligible = $false
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM

Write-Host "Published: $publishDirectory"
Write-Host "Packaged:  $archivePath ($([math]::Round($archive.Length / 1MB, 1)) MB)"
Write-Host "Manifest:  $manifestPath"
