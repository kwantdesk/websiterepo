# Ships the collector to the VM over SSH.
#
# The licensed Rithmic SDK (vendor/proto) and operator.env are deliberately
# NOT in git, so they travel this way and only this way. Nothing here is ever
# committed or pushed to a registry.
#
#   powershell -ExecutionPolicy Bypass -File .\deploy\ship-to-vm.ps1 `
#     -VmHost 203.0.113.10 -VmUser root

param(
    [Parameter(Mandatory = $true)][string]$VmHost,
    [string]$VmUser = "root",
    [string]$RemoteDir = "/opt/kwantify/rithmic_gateway"
)

$ErrorActionPreference = "Stop"
$serviceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$target = "{0}@{1}" -f $VmUser, $VmHost

foreach ($required in @("vendor\proto\request_login.proto", "operator.env")) {
    if (-not (Test-Path -LiteralPath (Join-Path $serviceRoot $required))) {
        throw "Missing $required. Install the SDK and fill operator.env before shipping."
    }
}

Write-Output "==> creating $RemoteDir on $target"
ssh $target "mkdir -p $RemoteDir"

# scp -r is used rather than rsync so this works from a stock Windows box.
# node_modules and recordings are excluded: the image installs its own
# dependencies, and recordings belong to the VM's own volume.
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("kwantify-ship-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $staging | Out-Null
try {
    foreach ($item in @("src", "scripts", "test", "vendor", "deploy", "package.json", "package-lock.json", "Dockerfile", ".dockerignore", "operator.env")) {
        $source = Join-Path $serviceRoot $item
        if (Test-Path -LiteralPath $source) {
            Copy-Item -LiteralPath $source -Destination (Join-Path $staging $item) -Recurse -Force
        }
    }

    Write-Output "==> copying service (SDK + credentials travel here, never via git)"
    scp -r "$staging/*" "${target}:$RemoteDir/"

    Write-Output "==> bootstrapping"
    ssh $target "chmod +x $RemoteDir/deploy/bootstrap-vm.sh && $RemoteDir/deploy/bootstrap-vm.sh"
}
finally {
    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Output ""
Write-Output "Shipped. Verify the session is genuinely live:"
Write-Output "  ssh $target 'curl -s localhost:8793/health' "
Write-Output ""
Write-Output "REMINDER: stop the local gateway now and leave it stopped."
Write-Output "Two processes on one Rithmic credential force-logout each other."
Write-Output "  powershell -ExecutionPolicy Bypass -File .\scripts\stop-background.ps1"
