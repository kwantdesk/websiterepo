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

if (-not ("KwantDesk.ExcelNativeObject" -as [type])) {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

namespace KwantDesk {
  public static class ExcelNativeObject {
    private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr FindWindowEx(
      IntPtr parent,
      IntPtr childAfter,
      string className,
      string windowName
    );

    [DllImport("user32.dll")]
    private static extern bool EnumChildWindows(
      IntPtr parent,
      EnumWindowsProc callback,
      IntPtr lParam
    );

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hwnd, StringBuilder className, int maxCount);

    public static IntPtr FindDescendantByClass(IntPtr parent, string expectedClass) {
      IntPtr match = IntPtr.Zero;
      EnumChildWindows(parent, delegate(IntPtr hwnd, IntPtr lParam) {
        var className = new StringBuilder(256);
        GetClassName(hwnd, className, className.Capacity);
        if (String.Equals(className.ToString(), expectedClass, StringComparison.OrdinalIgnoreCase)) {
          match = hwnd;
          return false;
        }
        return true;
      }, IntPtr.Zero);
      return match;
    }

    [DllImport("oleacc.dll")]
    public static extern int AccessibleObjectFromWindow(
      IntPtr hwnd,
      uint objectId,
      ref Guid interfaceId,
      [MarshalAs(UnmanagedType.IUnknown)] out object nativeObject
    );
  }
}
"@
}

function Get-EnvEntry([string]$Path, [string]$Name) {
  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_ -match ("^" + [regex]::Escape($Name) + "=") } |
    Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -split "=", 2)[1]
}

function Get-ExcelApplications {
  $applications = [Collections.Generic.List[object]]::new()
  $applicationHandles = [Collections.Generic.HashSet[int]]::new()

  # Excel registers only one automation instance under Excel.Application.
  # RTrader starts each streaming workbook in its own Excel process, so use
  # the native object model for every visible Excel window as well.
  foreach ($process in @(Get-Process -Name "EXCEL" -ErrorAction SilentlyContinue)) {
    try {
      $xlMain = [IntPtr]$process.MainWindowHandle
      if ($xlMain -eq [IntPtr]::Zero) { continue }
      $excel7 = [KwantDesk.ExcelNativeObject]::FindDescendantByClass($xlMain, "EXCEL7")
      if ($excel7 -eq [IntPtr]::Zero) { continue }
      $dispatchId = [Guid]"00020400-0000-0000-C000-000000000046"
      $nativeObject = $null
      $result = [KwantDesk.ExcelNativeObject]::AccessibleObjectFromWindow(
        $excel7,
        [uint32]4294967280,
        [ref]$dispatchId,
        [ref]$nativeObject
      )
      if ($result -ne 0 -or -not $nativeObject) { continue }
      $application = $nativeObject.Application
      $handle = [int]$application.Hwnd
      if ($applicationHandles.Add($handle)) { $applications.Add($application) }
    } catch {
      continue
    }
  }

  try {
    $activeApplication = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
    $activeHandle = [int]$activeApplication.Hwnd
    if ($applicationHandles.Add($activeHandle)) { $applications.Add($activeApplication) }
  } catch {
    # The native-window scan above remains authoritative.
  }
  return @($applications)
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

function Find-TradeStreamingSheet($Excel) {
  # RTrader Pro's Market Data Trade History stream deliberately exposes its
  # raw link sheet without text headers. The fixed layout is:
  # A timestamp, B trade price, C trade size, D cumulative volume, E B/S.
  # Prefer RTrader's presentation sheet. It mirrors the exact source tape but
  # is considerably less prone to Excel RPC rejections than TradeTape-Full.
  foreach ($workbook in $Excel.Workbooks) {
    foreach ($worksheet in $workbook.Worksheets) {
      if ($worksheet.Name -match "(?i)^TradeTape$") {
        return [PSCustomObject]@{
          Workbook = $workbook.Name
          Worksheet = $worksheet.Name
          Sheet = $worksheet
          TimestampColumn = 1
          PriceColumn = 2
          SizeColumn = 3
          SideColumn = 5
          FillIdColumn = 0
        }
      }
    }
  }

  # Fall back to the raw source worksheet when the presentation sheet is not
  # present. Both sheets use the same fixed A/B/C/E trade layout.
  foreach ($workbook in $Excel.Workbooks) {
    foreach ($worksheet in $workbook.Worksheets) {
      if ($worksheet.Name -match "(?i)^TradeTape-Full$") {
        return [PSCustomObject]@{
          Workbook = $workbook.Name
          Worksheet = $worksheet.Name
          Sheet = $worksheet
          TimestampColumn = 1
          PriceColumn = 2
          SizeColumn = 3
          SideColumn = 5
          FillIdColumn = 0
        }
      }
    }
  }

  foreach ($workbook in $Excel.Workbooks) {
    foreach ($worksheet in $workbook.Worksheets) {
      try {
        $columnCount = [Math]::Min(64, [Math]::Max(1, [int]$worksheet.UsedRange.Columns.Count))
        $headers = $worksheet.Range($worksheet.Cells.Item(1, 1), $worksheet.Cells.Item(1, $columnCount)).Value2
        $indexes = @{}
        for ($column = 1; $column -le $columnCount; $column += 1) {
          $header = ([string]$headers[1, $column]).Trim().ToLowerInvariant()
          if (-not $header) { continue }
          if (-not $indexes.Timestamp -and $header -match "date.*time") { $indexes.Timestamp = $column }
          if (-not $indexes.Price -and $header -match "trade\s*price") { $indexes.Price = $column }
          if (-not $indexes.Size -and $header -match "trade\s*size") { $indexes.Size = $column }
          if (-not $indexes.Side -and $header -match "(bought\s*/\s*sold|buy\s*/\s*sell)") { $indexes.Side = $column }
          if (-not $indexes.FillId -and $header -match "fill\s*id") { $indexes.FillId = $column }
        }
        if ($indexes.Timestamp -and $indexes.Price -and $indexes.Size -and $indexes.Side) {
          return [PSCustomObject]@{
            Workbook = $workbook.Name
            Worksheet = $worksheet.Name
            Sheet = $worksheet
            TimestampColumn = [int]$indexes.Timestamp
            PriceColumn = [int]$indexes.Price
            SizeColumn = [int]$indexes.Size
            SideColumn = [int]$indexes.Side
            FillIdColumn = if ($indexes.FillId) { [int]$indexes.FillId } else { 0 }
          }
        }
      } catch {
        continue
      }
    }
  }
  return $null
}

function Find-StreamingSheetAcrossApplications(
  $Applications,
  [string]$RequestedWorkbook,
  [string]$RequestedSheet
) {
  foreach ($application in @($Applications)) {
    $sheet = Get-StreamingSheet -Excel $application `
      -RequestedWorkbook $RequestedWorkbook `
      -RequestedSheet $RequestedSheet
    if ($sheet) {
      return [PSCustomObject]@{ Application = $application; Sheet = $sheet }
    }
  }
  return $null
}

function Find-TradeStreamingSheetAcrossApplications($Applications) {
  foreach ($application in @($Applications)) {
    $binding = Find-TradeStreamingSheet -Excel $application
    if ($binding) { return $binding }
  }
  return $null
}

function Convert-RTraderTimestampMs($Value) {
  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
    return 0L
  }
  $parsed = [DateTime]::MinValue
  if ($Value -is [double] -or $Value -is [decimal]) {
    try { $parsed = [DateTime]::FromOADate([double]$Value) } catch { return 0L }
  } elseif (-not [DateTime]::TryParse(
    [string]$Value,
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.DateTimeStyles]::AllowWhiteSpaces,
    [ref]$parsed
  )) {
    return 0L
  }
  $localOffset = (Get-TimeZone).GetUtcOffset($parsed)
  return [DateTimeOffset]::new($parsed, $localOffset).ToUnixTimeMilliseconds()
}

$token = Get-EnvEntry -Path $resolvedEnv -Name "KWANTIFY_MARKET_DATA_GATEWAY_TOKEN"
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "KWANTIFY_MARKET_DATA_GATEWAY_TOKEN is missing. Run configure-local.ps1 first."
}

$headers = @{ Authorization = "Bearer $token" }
$endpoint = "$($GatewayUrl.TrimEnd('/'))/v1/bridge/rtrader/snapshot"
$tradeEndpoint = "$($GatewayUrl.TrimEnd('/'))/v1/bridge/rtrader/trades"
$sequence = 0L
$lastConnectionNotice = ""
$tradeSheetBinding = $null
$lastTradeSheetScanAt = [DateTimeOffset]::MinValue
$seenTradeIds = [Collections.Generic.HashSet[string]]::new()
$seenTradeOrder = [Collections.Generic.Queue[string]]::new()
$tradeForwardLive = $false

Write-Output "RTrader Pro workbook bridge started for $Exchange`:$ContractSymbol."
Write-Output "Source: $WorkbookName / $SheetName. Poll interval: ${PollIntervalMs}ms."
Write-Output "This bridge is read-only and never opens an order-entry sheet."

while ($true) {
  try {
    $excelApplications = @(Get-ExcelApplications)
    if ($excelApplications.Count -eq 0) {
      if ($lastConnectionNotice -ne "excel") {
        Write-Warning "Waiting for Microsoft Excel and the RTrader Pro streaming workbook."
        $lastConnectionNotice = "excel"
      }
      Start-Sleep -Milliseconds 1000
      continue
    }
    $depthBinding = Find-StreamingSheetAcrossApplications -Applications $excelApplications `
      -RequestedWorkbook $WorkbookName `
      -RequestedSheet $SheetName
    if (-not $depthBinding) {
      if ($lastConnectionNotice -ne "sheet") {
        Write-Warning "Waiting for workbook '$WorkbookName' and sheet '$SheetName'."
        $lastConnectionNotice = "sheet"
      }
      Start-Sleep -Milliseconds 1000
      continue
    }
    $sheet = $depthBinding.Sheet

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

    if (-not $tradeSheetBinding -and ([DateTimeOffset]::UtcNow - $lastTradeSheetScanAt).TotalSeconds -ge 5) {
      $lastTradeSheetScanAt = [DateTimeOffset]::UtcNow
      $tradeSheetBinding = Find-TradeStreamingSheetAcrossApplications -Applications $excelApplications
      if ($tradeSheetBinding) {
        Write-Output "Explicit RTrader trade tape found: $($tradeSheetBinding.Workbook) / $($tradeSheetBinding.Worksheet)."
      }
    }
    if ($tradeSheetBinding) {
      try {
        $tradeSheet = $tradeSheetBinding.Sheet
        $tradeLastRow = [Math]::Max(2, [int]$tradeSheet.UsedRange.Rows.Count)
        $tradeColumnCount = [Math]::Max(
          $tradeSheetBinding.TimestampColumn,
          [Math]::Max(
            $tradeSheetBinding.PriceColumn,
            [Math]::Max($tradeSheetBinding.SizeColumn, $tradeSheetBinding.SideColumn)
          )
        )
        $tradeValues = $null
        for ($readAttempt = 1; $readAttempt -le 3; $readAttempt += 1) {
          try {
            $tradeValues = $tradeSheet.Range(
              $tradeSheet.Cells.Item(1, 1),
              $tradeSheet.Cells.Item($tradeLastRow, $tradeColumnCount)
            ).Value2
            if ($tradeValues -is [System.Array]) { break }
          } catch {
            if ($readAttempt -ge 3) { throw }
          }
          Start-Sleep -Milliseconds 25
        }
        if ($tradeValues -isnot [System.Array]) {
          Start-Sleep -Milliseconds 25
          continue
        }
        $occurrences = @{}
        $newTrades = [Collections.Generic.List[object]]::new()
        for ($tradeRow = $tradeLastRow; $tradeRow -ge 2; $tradeRow -= 1) {
          $tradePrice = Convert-ToNumber $tradeValues[$tradeRow, $tradeSheetBinding.PriceColumn]
          $tradeSize = Convert-ToNumber $tradeValues[$tradeRow, $tradeSheetBinding.SizeColumn]
          $rawSide = ([string]$tradeValues[$tradeRow, $tradeSheetBinding.SideColumn]).Trim().ToUpperInvariant()
          if ($tradePrice -le 0 -or $tradeSize -le 0 -or $rawSide -notin @("B", "BUY", "S", "SELL")) { continue }
          $rawTimestamp = [string]$tradeValues[$tradeRow, $tradeSheetBinding.TimestampColumn]
          $timestampMs = Convert-RTraderTimestampMs $tradeValues[$tradeRow, $tradeSheetBinding.TimestampColumn]
          if ($timestampMs -le 0) { continue }
          $baseId = "$rawTimestamp|$tradePrice|$tradeSize|$rawSide"
          $occurrence = 1 + [int]($occurrences[$baseId])
          $occurrences[$baseId] = $occurrence
          $sourceTradeId = "$baseId|$occurrence"
          if (-not $seenTradeIds.Add($sourceTradeId)) { continue }
          $seenTradeOrder.Enqueue($sourceTradeId)
          $newTrades.Add(@{
            sourceTradeId = $sourceTradeId
            timestampMs = $timestampMs
            price = $tradePrice
            size = $tradeSize
            aggressor = if ($rawSide -in @("B", "BUY")) { "BUY" } else { "SELL" }
          })
        }
        while ($seenTradeOrder.Count -gt 250000) {
          [void]$seenTradeIds.Remove($seenTradeOrder.Dequeue())
        }
        if ($newTrades.Count -gt 0) {
          $tradePayload = @{
            source = "RTrader Pro Market Data Trade History Excel live stream"
            exchange = $Exchange.ToUpperInvariant()
            contractSymbol = $ContractSymbol.ToUpperInvariant()
            trades = @($newTrades | Sort-Object timestampMs)
          } | ConvertTo-Json -Depth 5 -Compress
          $tradeResult = Invoke-RestMethod `
            -Method Post `
            -Uri $tradeEndpoint `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $tradePayload
          if (-not $tradeForwardLive -and [int]$tradeResult.acceptedTrades -gt 0) {
            Write-Output "Exact RTrader B/S executions are reaching the local gateway."
            $tradeForwardLive = $true
          }
        }
      } catch {
        Write-Warning "Trade tape bridge retry: $($_.Exception.Message)"
        if ($_.Exception.Message -notmatch "RPC_E_CALL_REJECTED|Cannot index into a null array") {
          $tradeSheetBinding = $null
        }
      }
    }
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
