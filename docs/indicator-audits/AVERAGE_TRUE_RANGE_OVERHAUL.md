# Average True Range overhaul

Sixth in the chart indicator checklist. KwantDesk keeps Wilder smoothing and the dedicated volatility pane. On recorded candle inputs the first range uses high minus low, subsequent ranges include the previous close, and the first ATR appears only after a complete window. No order-flow field or extra data request is required.

## Findings and repairs

- The previous delivery audit had already moved ATR onto the existing direct candle history and event-driven pane path. The current review repeated its calculation, replay and live-model checks.
- ATR had a custom colour but no line style or thickness control. Style now offers solid, dashed and dotted strokes and a one-to-four-pixel width. Existing templates keep their two-pixel solid default. The settings use the shared controls, support theme colours, and persist through reload and template import.
- DeepChart documents Tick or Periods, a model selector, an optional secondary colour and a line/broken-line display. The installed managed description accessor only exposes a four-byte stub, so it does not establish what those modes do. TradingView publishes Wilder-style smoothing as its default and offers alternative smoothing methods. This change keeps the existing ATR calculation and does not infer unsupported DeepChart modes from labels.

[DeepChart ATR settings](https://helpdesk.deepcharts.com/portal/en/kb/articles/atr-average-true-range) · [TradingView ATR calculation and settings](https://www.tradingview.com/support/solutions/43000501823-average-true-range-atr/) · [Earlier delivery audit](../audits/2026-11-07-atr-standard-deviation/REPORT.md)

## Verification

- 85 tests passed across the ATR and Standard Deviation matrix and live pane suites. There are 2,860 supported instrument/interval fixture combinations and 540 unsupported combinations across 68 symbols and 50 interval presets. The ATR assertions compare against an independent Wilder calculation at four lengths, check forming-history and live-model agreement, and compare replay to a cutoff-only calculation. The additional ATR test verifies line appearance stays consistent in replay and live mode.
- Isolated Chromium loaded 2,500 archived NQ one-minute bars through the chart host. Bottom and right dock runs verified a dashed three-pixel stroke, persisted length and appearance, replay seek, visibility, palette lock, custom colour and template export/import. A controlled candle event updated the actual bottom-pane path in 122 ms with the parent candle snapshot fixed. Both runs recorded zero page exceptions.
- Live provider arrival timing and archive completeness for each venue and interval remain unverified. The native DeepChart settings, replay and visual comparison remain deferred.
