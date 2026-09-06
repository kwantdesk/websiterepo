# DeepCharts Pivot Points audit

## Reference evidence

- Official DeepCharts article, inspected 2026-09-07:
  https://www.deepcharts.com/helpcenter/article/pivot-points
- The article defines pivots from the previous period's high, low and close and
  documents font size 12, line width 1, line style, left/right label alignment,
  one period shown, custom reference timeframe/value, five colours and an
  exchange-time custom session.
- The four article screenshots were inspected directly. Their visible stock
  state is Dash, Left, one period, custom reference off with Hour / 1 retained,
  and custom session off with 00:00:00 / 00:00:00 retained.
- Read-only installed-DLL contract scan:
  `VolAnalysis.Structures.SetTemplateNode` exposes `FontSize`, `LineWidth`,
  `LineStyle`, `LabelAlign`, `PeriodToShow`, `EnableCustomReference`,
  `TimeFrame`, `NumTf`, `PivotColor`, `R1Color`, `R2Color`, `S1Color`,
  `S2Color`, `CustomTimeEnabled`, `CustomTimeIni` and `CustomTimeEnd`.
  Its exact public enums are Solid/Dash/Dot/DashDot/DashDotDot,
  Left/Right and Minute/Hour/Day/Week.
- Installed DLL: file version 16.0.9, product version 1.0.0, SHA-256
  `D8366C8312AB71F1706DEA8A2A0046EB620EAC4497FB2ACF595946F381F3D9B6`.
  Reproduce the match by scanning all contracts for the simultaneous public
  getters `FontSize`, `LineWidth` and `PeriodToShow` with
  `scripts/dotnet-contracts.py`.

## KwantDesk implementation

- Uses the standard prior-period formula only:
  `P=(H+L+C)/3`, `R1=2P-L`, `R2=P+(H-L)`, `S1=2P-H`,
  `S2=P-(H-L)`.
- A period is calculated only after it is complete and is projected across the
  following period. The current period never feeds its own levels.
- Stock mode uses exchange-calendar days. Custom reference supports exact
  Minute, Hour, Day and Week buckets with a bounded positive value.
- Custom exchange-time sessions filter out bars outside the selected window,
  including overnight windows. Equal start/end means a complete 24-hour
  session rather than an empty one.
- `Periods to show` keeps the newest completed projections and output stays
  bounded to at most two points per selected period per level.
- Five independent colour roles follow the active theme until the trader picks
  a custom colour. Dash/solid/dot, integer line width, font size and left/right
  labels all reach the real renderer. Price-axis value tabs are disabled.
- The calculation uses candle timestamps, so it works on time, range, volume
  and other event charts whenever those charts carry enough historical bars to
  cover the requested reference periods.

## Verification and honest limits

- Seven focused tests cover stock values, custom-hour periods, multiple
  projections and breaks, custom-session exclusion, normalization, all colour
  paths, persistence, real release gates and actual label-anchor rendering.
- Full project TypeScript passes. Shared template, numeric-slider, theme-follow
  and colour-control suites pass. The broad plot-colour audit still reports its
  pre-existing Super Trend/SAR/T3/Regression/KST slot mismatches; Pivot Points
  itself adds no mismatch.
- The complete Next.js production build passes. The legacy shared settings-save
  source assertion still expects Save outside the fixed dialog header; that
  mismatch predates this study and Pivot Points does not alter the header.
- Synthetic browser QA shows all five dashed levels and labels at the left edge,
  plus the real settings window with stable General / Plot settings / Custom
  reference / Custom time session / Style navigation.
- A 100,000 one-minute-candle cold calculation produced five bounded series and
  300 points in about 990 ms on this workstation. Normal chart history is much
  smaller and the shared exchange clock caches repeated work, but this is not a
  claim of native-equivalent latency at that extreme.
- Protected native formula/constructor code was not copied or redistributed.
  The public formula and observable settings contract are implemented. Exact
  DeepCharts pixel geometry and unsupported DashDot variants are not claimed.
  Market-open visual soak remains a release follow-up, not hidden evidence.
