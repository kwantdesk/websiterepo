param(
  [string]$EnvPath = (Join-Path $PSScriptRoot "..\operator.env"),
  [string]$GatewayUrl = "http://127.0.0.1:8793",
  [string]$WorkbookName = "Book1",
  [string]$SheetName = "Order Book-Full",
  [string]$Exchange = "CME",
  [string]$ContractSymbol = "NQU6",
  [ValidateRange(100, 5000)]
  [int]$PollIntervalMs = 250
)

$ErrorActionPreference = "Stop"
$resolvedEnv = (Resolve-Path -LiteralPath $EnvPath).Path

function Get-EnvEntry([string]$Path, [string]$Name) {
  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_ -match ("^" + [regex]::Escape($Name) + "=") } |
    Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -split "=", 2)[1]
}

function Get-ExcelApplication {
  try {
    return [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
  } catch {
    return $null
  }
}

function Get-StreamingSheet($Excel, [string]$RequestedWorkbook, [string]$RequestedSheet) {
  $workbook = $Excel.Workbooks |
    Where-Object { $_.Name -eq $RequestedWorkbook } |
    Select-Object -First 1
  if (-not $workbook) { return $null }
  try {
    return $workbook.Worksheets.Item($RequestedSheet)
  } catch {
    return $null
  }
}

function Convert-ToNumber($Value) {
  if ($null -eq $Value -or "$Value" -eq "") { return 0.0 }
  $numeric = 0.0
  if ([double]::TryParse(
    [string]$Value,
    [Globalization.NumberStyles]::Any,
    [Globalization.CultureInfo]::InvariantCulture,
    [ref]$numeric
  )) {
    return $numeric
  }
  return 0.0
}

$token = Get-EnvEntry -Path $resolvedEnv -Name "KWANTIFY_MARKET_DATA_GATEWAY_TOKEN"
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "KWANTIFY_MARKET_DATA_GATEWAY_TOKEN is missing. Run configure-local.ps1 first."
}

$headers = @{ Authorization = "Bearer $token" }
$endpoint = "$($GatewayUrl.TrimEnd('/'))/v1/bridge/rtrader/snapshot"
$sequence = 0L
$lastConnectionNotice = ""

Write-Output "RTrader Pro workbook bridge started for $Exchange`:$ContractSymbol."
Write-Output "Source: $WorkbookName / $SheetName. Poll interval: ${PollIntervalMs}ms."
Write-Output "This bridge is read-only and never opens an order-entry sheet."

while ($true) {
  try {
    $excel = Get-ExcelApplication
    if (-not $excel) {
      if ($lastConnectionNotice -ne "excel") {
        Write-Warning "Waiting for Microsoft Excel and the RTrader Pro streaming workbook."
        $lastConnectionNotice = "excel"
      }
      Start-Sleep -Milliseconds 1000
      continue
    }
    $sheet = Get-StreamingSheet -Excel $excel `
      -RequestedWorkbook $WorkbookName `
      -RequestedSheet $SheetName
    if (-not $sheet) {
      if ($lastConnectionNotice -ne "sheet") {
        Write-Warning "Waiting for workbook '$WorkbookName' and sheet '$SheetName'."
        $lastConnectionNotice = "sheet"
      }
      Start-Sleep -Milliseconds 1000
      continue
    }

    $lastRow = [Math]::Max(2, [int]$sheet.UsedRange.Rows.Count)
    $values = $sheet.Range("I1:R$lastRow").Value2
    $bids = [Collections.Generic.List[object]]::new()
    $asks = [Collections.Generic.List[object]]::new()
    $tradeVolumes = [Collections.Generic.List[object]]::new()

    for ($row = 2; $row -le $lastRow; $row += 1) {
      $price = Convert-ToNumber $values[$row, 4]
      if ($price -le 0) { continue }
      $bidSize = Convert-ToNumber $values[$row, 2]
      $bidCount = Convert-ToNumber $values[$row, 1]
      $askSize = Convert-ToNumber $values[$row, 7]
      $askCount = Convert-ToNumber $values[$row, 8]
      $tradeVolumeLeft = Convert-ToNumber $values[$row, 9]
      $tradeVolumeRight = Convert-ToNumber $values[$row, 10]
      $tradeVolume = [Math]::Max($tradeVolumeLeft, $tradeVolumeRight)
      if ($bidSize -gt 0) {
        $bids.Add(@{ price = $price; size = $bidSize; orders = $bidCount })
      }
      if ($askSize -gt 0) {
        $asks.Add(@{ price = $price; size = $askSize; orders = $askCount })
      }
      if ($tradeVolume -gt 0) {
        $tradeVolumes.Add(@{ price = $price; volume = $tradeVolume })
      }
    }

    if ($bids.Count -eq 0 -and $asks.Count -eq 0) {
      if ($lastConnectionNotice -ne "empty") {
        Write-Warning "The RTrader Pro full Order Book sheet has no live depth yet."
        $lastConnectionNotice = "empty"
      }
      Start-Sleep -Milliseconds 500
      continue
    }

    $sequence += 1
    $payload = @{
      source = "RTrader Pro Excel live stream"
      exchange = $Exchange.ToUpperInvariant()
      contractSymbol = $ContractSymbol.ToUpperInvariant()
      timestampMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      sequence = $sequence
      bids = $bids
      asks = $asks
      tradeVolumes = $tradeVolumes
    } | ConvertTo-Json -Depth 5 -Compress

    Invoke-RestMethod `
      -Method Post `
      -Uri $endpoint `
      -Headers $headers `
      -ContentType "application/json" `
      -Body $payload | Out-Null
    if ($lastConnectionNotice -ne "live") {
      Write-Output "Live full-depth workbook snapshots are reaching the local gateway."
      $lastConnectionNotice = "live"
    }
  } catch {
    if ($lastConnectionNotice -ne "error:$($_.Exception.Message)") {
      Write-Warning "Bridge retry: $($_.Exception.Message)"
      $lastConnectionNotice = "error:$($_.Exception.Message)"
    }
    Start-Sleep -Milliseconds 1000
    continue
  }
  Start-Sleep -Milliseconds $PollIntervalMs
}
