param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath
)

$ErrorActionPreference = "Stop"
$resolvedZip = (Resolve-Path -LiteralPath $ZipPath).Path
$serviceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$vendorRoot = Join-Path $serviceRoot "vendor"
$protoTarget = Join-Path $vendorRoot "proto"
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("kwantify-rithmic-sdk-" + [guid]::NewGuid())

try {
  New-Item -ItemType Directory -Force -Path $temporaryRoot | Out-Null
  Expand-Archive -LiteralPath $resolvedZip -DestinationPath $temporaryRoot
  $loginProto = Get-ChildItem -LiteralPath $temporaryRoot -Recurse -File -Filter "request_login.proto" |
    Where-Object { $_.Directory.Name -eq "proto" } |
    Select-Object -First 1
  if (-not $loginProto) {
    throw "The archive does not contain the expected R|Protocol proto directory."
  }
  $sourceProto = $loginProto.Directory.FullName
  $required = @(
    "message_type.proto",
    "request_login.proto",
    "response_login.proto",
    "request_market_data_update.proto",
    "last_trade.proto",
    "best_bid_offer.proto",
    "order_book.proto",
    "depth_by_order.proto"
  )
  foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceProto $file))) {
      throw "The archive is missing required protocol file: $file"
    }
  }
  New-Item -ItemType Directory -Force -Path $vendorRoot | Out-Null
  if (Test-Path -LiteralPath $protoTarget) {
    $resolvedTarget = (Resolve-Path -LiteralPath $protoTarget).Path
    if (-not $resolvedTarget.StartsWith($vendorRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to replace a proto directory outside the gateway vendor folder."
    }
    Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
  }
  Copy-Item -LiteralPath $sourceProto -Destination $protoTarget -Recurse
  Write-Output "Installed the licensed Rithmic proto files into $protoTarget"
} finally {
  if (Test-Path -LiteralPath $temporaryRoot) {
    $resolvedTemporary = (Resolve-Path -LiteralPath $temporaryRoot).Path
    $tempBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if ($resolvedTemporary.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolvedTemporary -Recurse -Force
    }
  }
}
