# Algo uses normal Charts and recorded-data testing

Owner rejected the separate interface-preview chart and generated candles.
Algo must use the actual normal Charts workspace, all drawing tools/indicators
(including volume profiles), with its strategy-testing controls attached.

## Implementation

- Replaced the independent AlgoChart renderer with the actual
  KwantifyWorkspace/WorkspaceChartPane/Chart path. It uses the normal market
  feed, full instrument/timeframe/chart-type menus, layouts/panels, watchlist,
  settings, replay, drawing tools and indicator library. It shares the existing
  Charts workspace preference/drawing scope; there is no second chart engine.
- Embedded height follows the available chart area above the draggable tester.
  Algo's broad button/input styling is scoped away from the normal chart.
  Normal navigation remains intact, including clicking the active Algo item.
- Removed generated candles/trades/initial statistics from the active page.
  Initial state has no test results. Stored preview configurations never
  regenerate fabricated runs. Legacy illustrative math remains only as an
  unused regression fixture factory in the shared contracts module.
- Real finite recorded-history read on Run, using the existing authenticated
  /api/cme-history route. No new provider login, polling loop or VPS service.
  Calculation is in a cancellable Web Worker with a timeout. Changing inputs,
  instrument or leaving the page cancels pending work.
- Built-in ORB: first close outside the opening lookback range. VWAP: after
  warmup, close crossing session VWAP. Trend: first close outside the preceding
  lookback range. All enter at the following minute open and take at most one
  trade per strategy per session; the rules are described in the settings.
- NQ/ES/GC and MNQ/MES/MGC tick and dollar values match the normal paper engine.
  Maximum test range is 30 calendar days. Only completed weekday sessions with
  complete recorded minute bars are accepted. Missing, malformed or conflicting
  candles fail explicitly; there is no synthetic fallback or silent partial run.
- Stops/targets use recorded OHLC with stop-first ordering when both touch.
  Adverse opening gaps fill at the opening price. Commission/slippage are cash
  costs. These are bar-resolution simulations, not execution-tick reconstructions.
  Holiday/shortened/missing sessions may require a shorter explicit session.
- Fill overlays use the normal chart Trade representation, isolated from paper
  ledgers/accounts/journals. Selecting a trade uses normal historical replay
  and an optional one-time viewport focus. Other panes retain their real sources.
- Stats, equity, trade list/CSV and Monte Carlo consume the calculated results.
  Pine/NinjaScript imports remain saved source drafts, as originally requested;
  this change does not implement those language compilers or live algo execution.

## Validation and limits

- 11 recorded-engine tests: actual close/next-open signals, long/short,
  commission/equity, dual bracket ambiguity, adverse gaps, future-bar independence,
  missing/malformed/duplicate rows, empty signals, completed/range limits,
  VWAP/trend and all six independent contract specs.
- 16 existing metric/risk/contract/legacy fixture regressions pass.
- Eight isolated headless Chrome scenarios using the actual full workspace:
  native canvas, normal indicator library, add/remove Daily Volume Profile,
  select Trend Line, real worker/HTTP backtest roundtrip on controlled test
  candles, trade-to-history focus, unchanged normal control sizing, tray/native
  chart resize. No browser runtime errors. Auth/preferences are isolated stubs;
  source feeds are controlled fixture responses, not owner's account data.
  Volume-profile numerical painting with real tape was not re-certified here.
- Separately read NQ 2026-10-30 09:30–10:00 New York from the existing VPS history
  endpoint using its internal auth. 31 inclusive endpoint bars returned; the
  engine used the 30 selected minute bars, produced one ORB trade (-$135 net),
  and left source rows unchanged. Private licensed evidence stays in tmp/.
  This verifies that window, not every recorded session.
- Scoped new/small module lint and full production build/type checking required
  before the single main-only release. Giant Chart/workspace React-compiler lint
  is intentionally avoided per existing OOM notes.
- Final scoped lint and full production build/type checking passed. The actual
  emitted Turbopack worker bootstrap/runtime/module chunks were also served to
  isolated Chrome: the compiled production worker processed that real NQ sample
  and returned the same 30 bars, one trade and -$135 net. A raw .ts media asset
  initially looked suspicious but is unused; the constructor uses the separately
  compiled worker factory, and its real execution passed.
- No live gateway restart, data rewrite, provider subscription or trading-account
  mutations. Verify Vercel completion and actual live commit before reporting.
