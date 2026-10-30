# Algo frontend workspace — 2026-10-31

## Requested outcome

Replace the top Lab navigation entry with Algo. Provide normal chart interactions,
a bottom strategy tester that can be dragged open, algo toggles and inputs, a
date/session window, chart execution markers, Journal-style results, equity,
trade history, quantitative statistics and interactive 3D Monte Carlo. Pine
Script and NinjaScript imports are placeholders; actual backend execution comes
later.

## Delivered UI

- /algo is a standalone static route with the shared AppSidebar. The primary
  navigation and legacy editor sidebar now say Algo. Existing gated /lab
  implementation and Lab APIs are preserved; this task does not migrate or
  operate that live backend.
- The chart uses the same lightweightChartsCompat chart engine as normal
  Charts: candlesticks or line, price/time axes, volume, crosshair, pan, zoom,
  1m/5m/15m/1h display intervals, fit-to-window and fill-marker visibility.
  Preview instruments are NQ, ES and GC with their individual tick sizes.
- Site chart settings supply candle bodies, borders, wicks, grid and background.
  Theme events and chart-settings events are handled separately: theme metadata
  must never be normalized as ChartSettings. Profit/loss text and chart marker
  labels use the existing contrast helper for dark and light surfaces.
- Bottom tester: pointer-captured drag handle, keyboard up/down resize,
  collapse/expand, shared custom date pickers/dropdowns/timezone selector, and
  configurable testing dates/session hours.
- Algorithm library: independent toggles, search, three explicitly labelled
  illustrative templates, settings, and saved script drafts. Running applies
  the current inputs; pending inputs are distinguished from the last report.
- Inputs: capital, contracts, per-side/contract commission, per-side tick
  slippage, and independent per-template lookback/stop/target controls.
- Reports: equity and underwater curves with inspection, net profit/return,
  win/loss counts and rate, profit factor, max drawdown, Sharpe, Sortino, Calmar,
  recovery, expectancy, average R, winner/loser size, payoff, holding time,
  longest loss streak and costs. Undefined ratios display a dash.
- Trade ledger: side, strategy, entry/exit timestamps and prices, brackets,
  quantity, holding time, exit reason, net P&L, R and running balance.
  Direction/outcome filters, sorting, CSV export, and row-to-chart focus work.
  Chart markers distinguish long/short entries and TP/SL/session exits.
  Marker-driven autoscale margins are disabled: native marker padding grows
  with bar spacing and otherwise flattens candles in a short resized pane.
  OHLC autoscaling and reserved chart margins remain active.
- Risk tab: actual Three.js 3D paths, orbit/zoom/pan/reset, empirical terminal
  5th/50th/95th percentiles, loss probability and a 50%-capital-loss threshold.
  120/240-path selection and resampling are functional. Rendering is on demand,
  not a perpetual animation loop. GPU buffers/materials/controls/context are
  released on unmount. A static projection is available without WebGL.
- Right import drawer accepts pasted Pine/NinjaScript or .pine/.cs/.txt.
  .cs selects NinjaScript. Drafts can be saved, reopened, edited and removed.
  Maximum 12 drafts, 100,000 characters each, 200 KB selected file limit.
  No uploaded or pasted code is evaluated, compiled, uploaded or executed.
- Browser-local key kwantdesk:algo-workspace:v1 stores settings, drafts,
  display interval/type and the last preview-run configuration. The report is
  reconstructed deterministically. An all-disabled selection is also retained.
  These drafts are not yet account/cloud synchronized.

## Data and computation boundaries

**This is a frontend preview, not a certified strategy engine or a real
backtest.** The chart and reports say so explicitly. No synthetic data enters
the live feed, archive, paper-trading accounts, Journal or normal Charts.

src/lib/algoWorkspace.ts defines typed config, candle, trade/fill, equity,
metric and run objects. Its only run provenance is kind: preview.
The illustrative candle factory is deterministic, tick-aligned and excludes
weekends; it does not model exchange holidays or assert historical coverage.
The three template names describe future strategy intentions, not implemented
ORB/VWAP/trend signal logic. Each enabled template gets an illustrative weekday
trade; inputs demonstrate the report pipeline. Independent template trades are
aggregated without a margin/netting model.

Preview bracket handling uses minute OHLC, with stop-first handling if both
brackets are touched. Commission and slippage are charged on both sides. The
display interval aggregates minute bars without changing the underlying fills.
This does not establish real tick-level execution order.

Equity is ordered by exit time. Win/loss statistics classify net P&L after
costs; breakeven is neither a win nor a loss. Drawdown is measured against
running closed-equity peaks. Sharpe uses sample standard deviation of daily
closed-equity returns, including flat weekdays. Sortino uses full-sample daily
downside deviation. Both use 252 sessions/year and zero risk-free/target
return. Calmar uses annualized geometric closed-equity return over max drawdown.
No ratio is invented when its denominator is undefined.

Monte Carlo samples net trade dollar P&L independently with replacement and no
compounding. Each path samples up to 300 trades. Seed 42 is reproducible;
Resample increments it. The method is sequence-risk illustration, not a
forecast, regime model, or evidence of strategy profitability.

## Future backend connection

Replace the preview factory with a validated VPS-run adapter that returns the
same chart/fill/equity data plus real provenance, algorithm versions, actual
instrument/contract identity and coverage. Preserve explicit missing/partial
coverage instead of generating replacement trades/candles. Resolve real
intrabar order and source timestamps before presenting tick-accurate fills.
Compiler and parameter-schema adapters for Pine/NinjaScript remain unbuilt.
Never evaluate imported text in the browser or unsandboxed gateway process.

No API routes, live subscriptions, vendor calls, order submission, recurring
polling, VPS changes or new dependencies were added. Three.js was already
installed. Monte Carlo code is lazy-loaded only when its tab is opened.
ALGO/ is untouched.

## Research

Primary TradingView documentation informed the chart + lower report workflow,
trade navigation, equity/performance sections and adjustable strategy inputs:

- [Strategy Report overview](https://www.tradingview.com/support/solutions/43000764138-tradingview-strategy-report-how-to-start/)
- [Pine Script strategies](https://www.tradingview.com/pine-script-docs/concepts/strategies/)

This is an independently implemented frontend using KwantDesk styling.
It does not claim Pine or NinjaScript runtime compatibility.

## Validation

- node --experimental-strip-types scripts/test-algo-workspace.mjs: 16 tests.
  Reconciles arithmetic and daily risk ratios, costs/ticks for all three preview
  instruments, immutable interval aggregation, toggles/inputs, DST, invalid
  windows, deterministic generation, and Monte Carlo outcomes.
- Isolated headless Chrome fixture renders the actual new components, shared
  navigation, pickers/dropdowns, chart engine and Three.js renderer. It stubs
  Next routing and the unrelated navigation news/health effects, permits no
  external requests, and uses no owner desktop/trading session.
- Browser checks cover algo/run controls, chart pan/zoom and fill focus,
  settings, date/session/timezone selection, dropdown scrolling, exports, local
  import persistence without execution, file imports, resize/release, all-off
  restoration, 3D orbit/resampling, mobile controls and three theme families.
  No backend trading/feed requests or browser runtime errors were observed.
- Primary-action contrast: dark 21:1, light 18.88:1, purple 6.44:1.
- Scoped ESLint: zero errors; three existing warnings in shared editor/sidebar.
- Full Next.js production build and main-only production SHA verification are
  the release gates. No direct Vercel CLI deployment is used.
