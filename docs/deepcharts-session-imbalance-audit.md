# Session Imbalance audit — 2026-09-07

## Evidence

- Public reference: https://www.deepcharts.com/helpcenter/article/session-imbalance
- Licensed local assembly: `C:\Program Files\Volumetrica Trading\Deepchart\Deepchart.dll`
- Read-only public metadata contract: obfuscated type
  `Deepchart.Collections.ViewerProcessorEnumerator`.

The public guide defines an opening range (60 minutes by default), optional
custom start, number of plotted days, IB high/low/midpoint, 50% and 100%
extensions, line/text controls and alerts. Public DLL metadata independently
exposes `NumMinutes`, `StartTimeMode`, `StartTime`, `NumberOfDays`, colours,
width/style, `TextAlign`, `PlotOnceEnded`, extension switches and the three
alert groups. It also exposes optional volume-derived levels, but the public
guide does not define their calculation.

## KwantDesk implementation

- Own `session-imbalance` calculator and renderer registration; this is not an
  alias for `ib-levels`.
- CME sessions key from the 17:00 Chicago exchange reopen. A custom start is an
  offset inside that trading session, including starts after calendar midnight.
- Developing high/low read only candles observed so far. Completed values are
  fixed; midpoint is `(high + low) / 2`; extensions are exact `range * 0.5`
  and `range * 1.0` above/below.
- `0` days means all loaded sessions. A positive value keeps the newest N.
- Lines can stop at formation or chain to the next session. Theme colours are
  live unless the user explicitly selects custom colours.
- Popup and sound controls trigger only on a live close crossing a plotted
  level. Historical chart hydration cannot emit alerts.
- Settings use the shared account-synced template/export/import path.

## Verification and limits

- Focused calculation/persistence/catalogue tests cover bounds, exact extension
  math, custom start, no-lookahead formation and release registration.
- TypeScript, scoped ESLint, template and theme regressions pass.
- DeepCharts' protected calculation body and native pixel geometry were not
  copied and exact vendor seeding/visual parity is not claimed.
- The DLL-only optional volume lines remain excluded: implementing them without
  a documented formula would fabricate parity. Live market-open soak and native
  side-by-side pixel comparison remain outstanding.

