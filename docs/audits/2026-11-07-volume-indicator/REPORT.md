# Chart Volume indicator audit — 7 November 2026

## Scope and result

Audited the shared Volume histogram, every offered chart interval route and the fixed catalogue of 53 futures plus 15 stock/index symbols. Calculation fixtures passed 2,650 futures/interval pairs (53 × 50 presets). Full per-instrument/per-interval status is in matrix.json. This is a deterministic execution/candle calculation test, not a live exchange session certification. The market was closed on Saturday during this audit.

## Findings and corrections

1. Volume live updates used Chart's sampled study path: 250 ms for the selected Volume-only chart, 750 ms alongside order-flow studies, or 1 second otherwise. Volume now consumes the existing canonical candle/execution events in the lower-pane component and schedules its own animation-frame paint. CVD's existing 200 ms path remains separate. No new feed subscriptions, provider requests or polling.
2. Custom plot colour did not recolour neutral bars: the generic point-colour replacement only recognised bullish/bearish colours. Volume now uses a single actual series colour, with theme colour or the selected custom colour. Legacy hidden gradient choices no longer overrule its picker.
3. Removed Background mode and Delta input data from Volume as requested. The old modes did have engine branches, but were unnecessary for this simple volume histogram and could remain visually neutral when side data was absent. Delta studies are unchanged.
4. Removed duplicate palette/style controls. One Plot Color and one Use Theme Colors switch remain together with Minimum total volume. No separate duplicate Style tab.
5. Removed the cheap-study history cap for Volume: it uses the complete loaded candle range, causally clipped in replay. It does not create bars for missing recordings.
6. The minimum-volume filter is inclusive: a bar equal to the threshold is retained; lower bars are hidden. A filter that hides every live bar now stays empty rather than falling back to stale pre-filter data.
7. Slider dragging was tested in the actual ChartIndicatorsControl component with production CSS. Dragging from the zero thumb to the middle continuously changed the value to 3,898 with no browser errors. No current drag fault was reproduced, so the shared slider was not changed speculatively. Volume has a Minimum total volume control; no separate Minimum volume delta control exists in this indicator.

## Data correctness and instrument limits

- Bar height uses reported executed total volume. Bid+ask side sums are used only when the reported total is absent/nonpositive; they are never added to an existing total. Contract tick size does not change contract counts.
- The futures calculation matrix checks every resulting bar against its exact input volume and checks total execution conservation. A separate live-hook test crosses four candle boundaries with the parent history frozen, accepts a 1,000-bar execution snapshot, ignores unrelated chart events, disables live painting in replay and verifies the all-bars-hidden filter.
- Cash indices SPX, SPXW, NDX, VIX and VXN do not have exchange-traded underlying volume. Do not manufacture volume from quote movement. VXN additionally lacks a configured live feed in the existing platform.
- Ten stock/ETF symbols have a live snapshot-path gap: the shared snapshot contract carries minute OHLC/price but no volume, and KwantifyWorkspace merges those quotes with zero executed size. The history normalizer can preserve real volume, but the current owned quote recordings explicitly contain zero volume. Thus neither current owned stock volume history nor tick-level live stock volume is working through this quote path. It requires the source volume to be delivered and reconciled correctly, or a real executed-stock-trade stream for true tick granularity. This audit does not change provider cadence, buy a feed, synthesize volume or restart the live gateway.
- No assertion that all recording windows are complete is made from these fixtures. Missing captured executions cannot be recovered from OHLC alone. Prior provider-history audits are superseded by the owner's recorded-live-only policy.

## Validation

- 2,650 futures interval calculations and 750 explicit non-futures capability outcomes in matrix.json.
- 9 live-pane hook/model tests, including Volume's animation-frame scheduling and all existing CVD/delta checks: pass.
- 9 numeric slider checks: pass.
- Existing Volume total/side-fallback/stale-sample regression: pass, updated to the requested single-colour contract.
- Real component browser check: continuous slider drag, custom hex preview setting useThemeColors=false, save feedback; no browser errors. Screenshot is an isolated component fixture, not the owner's live workspace.
- 30,000-bar engine calculation benchmark: approximately 2.52 ms/pass on this laptop. Not an end-to-end feed latency measurement.
- Lint, production build and deployment receipts are recorded in the accompanying local release receipt when complete.

## Read-only VPS recording evidence

Inspected the actual owned files without restarting services or making provider calls. All 53 futures aggregate files for trading session 2026-11-05 identify their source as VPS recorded live trades. The Volume engine exactly matched all 59,844 saved minute volumes. This proves calculation/plot input parity with those owned aggregates, not completeness against every raw exchange execution.

For cash date 2026-11-06, all 13 recorded physical cash symbols (ten stocks/ETFs plus NDX/SPX/VIX; SPXW aliases SPX and VXN is absent) identify volumeKind as not provided by quote feed. Every recorded bar has zero volume. Therefore current owned stock/ETF history also lacks traded volume, not just the live snapshot. The code can render real supplied stock volume, but this configured quote-only feed does not supply it. This is an unresolved feed/input capability, not a histogram-setting fix. See owned-recording-check.json.

Validation qualification: scoped small-component ESLint passed. Standard ESLint on the enormous Chart.tsx/ChartIndicatorsControl.tsx exhausted the Node heap at 4 GB and again at 8 GB; it is not counted as a lint pass. Full isolated production webpack compilation, TypeScript and page generation passed. No lint configuration was weakened to force a pass.
