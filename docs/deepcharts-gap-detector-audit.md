# DeepCharts Gap Detector audit

## Reference evidence

- Official DeepCharts article, inspected 2026-09-07:
  https://www.deepcharts.com/helpcenter/article/gap-detector
- The article defines Tick and Percentual thresholds, whole-bar retirement,
  opacity, and separate bullish/bearish colours.
- The actual General and Color Settings screenshots were inspected directly.
  Their visible stock state is Day begin, Tick, percentage value 1.00, tick
  value 20, Trigger whole bar on and background opacity 40.
- Read-only installed-DLL contract scan found
  `Deepchart.Roles.TransformableRequestRole`, exposing `GapMode` with exact
  enum members `DayBegin=0` and `Always=1`, `CalculationMode` with `Tick=0`
  and `Percentual=1`, plus `PercValue`, `TickValue`, `TriggerWholeBar`,
  `BackgroundOpacity`, `UpColor` and `DownColor`.
- Installed DLL version and hash are recorded in the Pivot Points audit. No
  protected implementation body was executed, copied or redistributed.

## KwantDesk implementation

- A bullish gap exists only where the current low is above the prior high; a
  bearish gap exists only where the current high is below the prior low.
- Day begin restricts detection to a change in the Chicago exchange-calendar
  date. Always evaluates every adjacent pair.
- Tick mode divides the price gap by the chart instrument's actual tick size.
  Percentual mode uses the gap as a percentage of the prior close. Zero is a
  valid threshold; invalid values normalize to the observed stock defaults.
- Trigger whole bar keeps a bullish zone until a later low reaches its lower
  edge and a bearish zone until a later high reaches its upper edge. With the
  switch off, first entry into the zone retires it.
- Zone fill lookup uses prebuilt min/max segment trees. It is `O(n log n)` in
  the number of chart bars rather than rescanning every future bar per gap.
- The renderer is attached to chart time and price coordinates, so zones pan,
  zoom and scale with candles. It paints behind price, disables line/value
  tabs, follows theme colours by default and supports saved custom colours.

## Verification and limits

- Seven focused tests cover instrument tick size, full-fill and touch
  retirement, bearish gaps, exchange-day detection, percentage thresholds,
  setting normalization, theme/custom persistence, actual canvas geometry and
  release/settings gates.
- TypeScript and scoped lint pass. A 100,000-candle / 5,555-gap synthetic run
  completed in about 20 ms on this workstation.
- Synthetic browser QA shows bullish and bearish zones at 40% opacity, anchored
  to their actual candles. General and Color Settings remain fixed tabs with
  the shared template/palette controls.
- The public description does not define the percentage denominator or the
  precise exchange-day boundary. KwantDesk states its choices above and does
  not claim protected formula or pixel parity without an open-market capture.
