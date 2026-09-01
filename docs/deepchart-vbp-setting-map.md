# DeepChart VbP → KwantDesk, property by property

The audit behind the "make ours match" work. DeepChart's settings class
(`Deepchart.Collections.EnumeratorCalcMatcher`) carries **107 properties**, read
out of the assembly with `scripts/dotnet-metadata.py`. Ours carries **82**.

Two separate questions are asked of every row, because they fail differently:

- **Do we have it?** — a missing feature.
- **Does ours do anything?** — a setting that stores, reloads and moves nothing.
  Four of those were found here, and each had a working control in the dialog.
  `scripts/test-volume-profile-settings-live.mjs` now fails if another appears.

---

## Point of Control

| DeepChart | Ours | State |
| --- | --- | --- |
| `PocEnable` | `showPocLine` | ✅ |
| `PocHighlight` | `showPocHighlight` | ✅ |
| `PocBackColor` | `pocHighlightColor` | ⚠️ read by the TPO primitive, not the volume profile |
| `PocGroupOpacity` | `shiftedPocOpacity` | ✅ **was inert — fixed** |
| `PocLineColor` | `pocColor` | ✅ |
| `PocLineWidth` | `pocLineWidth` | ✅ |
| `PocLineMode` | `pocLineMode` | ✅ |
| `PocExtendMode` | `extendMode` | ✅ |
| `PocDevStartTime` | `developingPocStartMinutes` | ✅ |
| `ShiftPocTick` | `shiftedPocTicks` | ✅ **feature was never built — built** |
| `ShiftPocAlert`, `EnableShiftPocAlert`, `EnableShiftPocPopup` | — | ❌ alerts, not built |

## Value Area

| DeepChart | Ours | State |
| --- | --- | --- |
| `VAEnable` | `showValueArea` | ✅ |
| `VAPerc` | `valueAreaPercent` | ✅ |
| `VAShowLine` | `showValueAreaLines` | ✅ |
| `VALineColor` / `VABackColor` | `valueAreaColor` | ✅ |
| `VALineWidth` | `valueAreaLineWidth` | ✅ |
| `VAExtendMode` | `extendMode` | ✅ |
| `VADeveloping` | `valueAreaDeveloping` | ✅ **was inert — fixed** |
| `VAHighlight` | — | ❌ |
| `VADeveloping2` | — | ❌ purpose unknown; a second developing mode |

## Data Settings

| DeepChart | Ours | State |
| --- | --- | --- |
| `InputData` | `inputData` | ✅ |
| `FilterMin` / `FilterMax` | `minTradeVolume` / `maxTradeVolume` | ✅ |
| `AutoGrouping` | `groupingMode` | ✅ |
| `AutoGroupFactory` | `autoGroupFactor` | ✅ |
| `ManualTicks` | `groupTicks` | ✅ — now a **display** bin, matching theirs |

## Filter / Split Time

| DeepChart | Ours | State |
| --- | --- | --- |
| `FilterMode` | `filterMode` | ✅ |
| `FilterTime` | `filterTime` | ✅ |
| `IniSession` / `EndSession` | `sessionStartMinutes` / `sessionEndMinutes` | ✅ |
| `UseEndSessionAsStartDay` | `useEndSessionAsStartDay` | ✅ |

## General — the largest gap

| DeepChart | Ours | State |
| --- | --- | --- |
| `NumberOfProfile` | `numberOfProfiles` | ✅ **was inert — fixed** |
| `VbpType` | — | ❌ |
| `VbpPeriod` | — | ❌ |
| `LengthType` / `LengthValue` | — | ❌ |
| `IniCustomDt` / `EndCustomDt` | — | ❌ custom date range |
| `CustomOnLastBar` | — | ❌ |
| `MergeProfileStr` | — | ❌ |

Ours builds one profile per CME trading date. An arbitrary period needs the
request layer to accept a span rather than a date, which is why this whole tab
is absent rather than partly present.

## Plot — width, offset and appearance

| DeepChart | Ours | State |
| --- | --- | --- |
| `VbpOpacity` | `opacity` | ✅ |
| `BorderWidth` | `borderWidth` | ✅ |
| `VisualStyle` | `visualStyle` | ✅ |
| `ShowText` | `showText` | ✅ |
| `Text` | — | ❌ nested text settings |
| `Background` | — | ❌ nested background settings |
| `ShowOnTheRight` / `AlignToRight` | `snapMode` | ✅ (`align` was dead weight and is removed) |
| `WidthType` | — | ❌ |
| `WidthCurrLength` | `profileWidth` | ✅ |
| `WidthPrevLength` | `previousProfileWidth` | ✅ **built** |
| `VbpCurrOffset` / `VbpPrevOffset` | `currentProfileOffset` / `previousProfileOffset` | ✅ **built** |
| `ShowAboveBars` | — | ❌ |
| `AlwaysVisible` | — | ❌ |

## Peak / Valley / Business Zone

Complete on both sides: `PeakEnable`, `ValleyEnable`, `PVSensitivity`,
`PVExcludeHL`, the line colours and widths, and the business-zone family all map
one to one. `PeakMinVol`, `ValleyMaxVol`, `PeakOnlyOutsideVA` and
`ValleyOnlyOutsideVA` are honoured by `volumeProfileStructure.ts`.

## VWAP

| DeepChart | Ours | State |
| --- | --- | --- |
| `VwapEnable` / `VwapShowLine` | `showVwapLine` | ✅ |
| `VwapLineColor` / `VwapLineWidth` | `vwapColor` / width | ✅ |
| `VWapEnvEnabled` | `showVwapBands` | ✅ |
| `ShowDevVwap` | — | ❌ developing VWAP |
| `VWapEnvSett`, `VWapEnvelopeStyle` | — | ⚠️ we ship three fixed σ bands, theirs are configurable |
| `VwapHighlight`, `VwapBackColor`, `VwapExtendMode`, `VwapLineStyle` | — | ❌ |

## Summary

| DeepChart | Ours | State |
| --- | --- | --- |
| `SummaryEnable` | `showSummary` | ✅ |
| `SummaryEnableVolume` / `SummaryEnableNumTrade` | `showSummaryVolume` / `showSummaryTrades` | ✅ |
| `SummaryTextColor` / `SummaryAskColor` / `SummaryBidColor` | `summaryTextColor` + profile colours | ⚠️ one colour, not three |

---

## Settings of ours with no control

**None.** `profileWidth`, `peakLineWidth`, `valleyLineWidth` and
`businessZoneLineWidth` all have controls now, and `align` — which was stored,
migrated and read by nothing, a legacy duplicate of `snapMode` — is gone.

`scripts/test-volume-profile-settings-live.mjs` fails if a setting becomes
unreadable OR unreachable, so both halves of a dead control are caught.

## Where the value area is measured

Not a setting, but the reason POC and VAH matched while VAL did not. The value
area must be walked over the **same rows that are drawn**: floored to the bin
the trader asked for, never at the arrival resolution and never at the
zoom-dependent display grouping. `scripts/test-value-area-rows.mjs` holds that.
