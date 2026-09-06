# Complete pending-library audit — 2026-09-06

Owner request: finish every pending indicator using DeepCharts reference/DLL
evidence, with real calculations, settings, data, rendering and no fake releases.

## Correction to the previous completion claim

The September 4 overhaul completed its frozen 21-item list, not the whole
catalogue. The actual September 6 library had 128 entries and 38 failed the
intersection of LIVE_CHART_INDICATOR_IDS and RENDERED_CHART_INDICATOR_IDS.
Absolute Levels was incorrectly described as already available in the old
inventory; it had neither release registration nor calculator at audit time.

Run the complete inventory (not a manually selected subset):
`node --import ./scripts/alias-hook.mjs scripts/audit-indicator-library.mjs`

“Registered” proves the gates, not mathematical, visual or live-data parity.
The regression also checks that every released engine and renderer has a
reachable catalogue row and that catalogue IDs are unique.

## Release batch 1 — two wrong IDs

- [x] Big Contracts: display-derived `big-trades-deep-trades` did not match
  existing `big-trades` engine/renderer/settings. Restored canonical catalogue
  ID, migrated saved aliases and favourites; no detector formula changed.
- [x] Liquidity Sweep / Stop Sweep Detector: display-derived
  `liquidity-sweep-stop-sweep-detector` did not match existing
  `liquidity-stop-sweep-detector`. Same scoped registration repair.
- Local registration/migration tests: 3 passed. Existing Deep Contracts/Effort
  tests passed. New audit/test/catalogue ESLint passed.
- Liquidity Stop Sweep detector regression passed. Production build passed
  (TypeScript and all 80 static pages). Release uses the single main-only
  production integration; deployed commit verification follows the push.
- No authenticated chart visual test or live-market soak claimed.

## Batch 2 — Absolute Levels

- [x] Implemented its two manual prices and independent colour/style/width,
  using official documentation and the eight public DLL settings properties.
- Calculator, actual renderer options, settings, theme ownership and saved
  normalization covered by tests; production build passed. Isolated browser
  QA verified full-width lines, price editing, immediate clean Save and close.
- Details/default and parity limits: `docs/deepcharts-absolute-levels-audit.md`.

## Batch 3 — ADX, profile-family data-path groundwork

- [x] ADX calculator, documented full-window Wilder seeds, three-line pane,
  complete documented period/colour/style/width controls, visibility and
  theme/persistence handling. Browser-tested actual pane/settings; see
  `docs/deepcharts-adx-audit.md` for vendor-parity and benchmark limitations.
- Profile-family loading/validation/live-fold groundwork continues; no profile
  entry was enabled. Multi-session filtering needs genuine disjoint windows.

## Batch 4 — Parabolic SAR

- [x] Implemented stop/reversal calculation, acceleration controls, points/line
  rendering, theme/custom/directional colours and per-instance secondary scale.
  Seven tests and actual settings/rendering browser QA passed. Exact vendor
  seed/visual parity remains unproven; `docs/deepcharts-parabolic-sar-audit.md`.

## Batch 5 — Linear Regression

- [x] Rolling least-squares endpoint with all five input fields, stable bounded
  sums, full-window warmup, source/volume guards and all documented control
  categories. Seven tests and actual browser settings/rendering checks pass.
  Deep-history routing supports the selectable 10,000-bar length. Reference
  and visual/latency limits: `docs/deepcharts-linear-regression-audit.md`.

## Batch 6 — Tillson T3

- [x] Six-stage T3 with documented defaults, explicit full-window seeds,
  all five inputs, slope colouring, styles and persistent short name. Seven
  tests, combined 37-test suite and real browser checks passed. Deep-history
  route supports maximum-length warmup. Reference and parity limits:
  `docs/deepcharts-tillson-t3-audit.md`.

## Batch 7 — Know Sure Thing (KST)

- [x] Four smoothed ROC horizons and signal, exact DLL smoothing enum, observed
  settings, per-plot styles/colours/labels, full-pane middle reference, and deep
  history for maximum warmup. Actual browser verified calculations/settings,
  point mode, labels, Save/close/reload. 52 combined tests pass. Exact vendor
  geometry/seeds and live soak are not claimed; `docs/deepcharts-kst-audit.md`.

## Batch 8 — Super Trend and Super Trend Difference (local release candidate)

- [x] Shared Wilder ATR/band recurrence with explicit seed conventions, real
  OHLC validation, independent batch/live equivalence and source-time guards.
- [x] Overlay/dockable price pane and signed Difference histogram/line, bounded
  settings, theme/custom colours, labels/backgrounds, scale retention, warmup
  status, actual live popup/tone path and template export/import integration.
- [x] 37 focused tests, 18 template checks, full shared-worktree production
  build and browser save/reload/export/live/docking/auto-centre checks passed.
- Isolated release-tree build and exact deployed SHA verification still due;
  registration is local, not proof that this batch is live. No native pixel or
  protected constructor/formula parity, speaker audibility, authenticated
  cross-device template roundtrip or market-open soak is claimed. Full evidence
  and implementation conventions: `docs/deepcharts-super-trend-audit.md`.

Production follow-up: Batch 8 deployed successfully through `websiterepo-yfmi`.
Live diagnostics returned exact SHA `18a17c4d5ba23233ae678c4a75e324f596f0927b`.
Isolated final tree passed 90 combined tests, 18 template checks and the normal
production build. This supersedes the local-only deployment status above/below.

## Remaining 10 — not released by blanket enablement

Each row needs evidence, settings/data implementation, calculation tests,
renderer/theme/persistence verification and explicit visual/latency limits.
Do not tick a row just because its Add gate changes.

| Indicator ID | Status |
|---|---|
| `speed-of-tape` | [ ] Audit / implement / verify |
| `volume-delta-sprint` | [x] Rolling classified Volume/Trades Delta plus optional Bid/Ask subgraphs, filters, four smoothing modes, fading/fixed colours, theme/persistence and focused tests; protected filter allocation/pixel/live-soak limits documented |
| `auction-gap-tracker` | [x] Exact one-tick detector, six location modes, time/event allocation, correction-safe worker lifecycle, zones/markers, source continuity, settings/theme/templates and closed/replay-safe alerts; 112 focused tests pass, live-market/native parity limits documented |
| `session-imbalance` | [x] Dedicated CME-session range engine, IBH/IBL/mid and exact ±50/100% extensions, documented settings, theme/persistence/alerts and focused tests; protected pixel/formula and live-soak limits documented |
| `volume-swing` | [ ] Audit / implement / verify |
| `monthly-volume-profile` | [ ] Owned range/job foundation tested; workspace/live/settings integration outstanding |
| `session-volume-profile` | [ ] Shared-engine routing audited; session/workspace integration outstanding |
| `visible-range-volume-profile` | [ ] Owned range/job foundation tested; viewport/sequence-aware data integration outstanding |
| `market-profile-tpo` | [x] Removed duplicate catalogue row; legacy ID/favourites/workspaces canonicalize to the already-complete `tpo-chart` (TPO Daily) engine and settings instead of presenting a false second Pending study |
| `anchored-vwap` | [x] Library entry now arms the existing live draw-on Anchored VWAP with four sources, three deviation bands, fill, theme styling and persistent drawing settings |
| `on-candle-stats` | [x] Dedicated on-price text-box primitive using ordered execution statistics for volume/delta/trades, max/min delta, extension, COT and ratios; full public data/text/color/price controls, theme/persistence and tests; missing execution sequencing stays blank |
| `important-levels` | [x] Daily/weekly/monthly OHLC, midpoint, VWAP and exact-footprint POC/70% value area; counts, Skip Last, ETH/RTH/custom exchange-time filters, plot/label/theme/persistence and focused tests; viewport-relative vendor label pixels remain limited |
| `absolute-levels` | [x] Batch 2; reference/default limits recorded above |
| `pivot-points` | [x] Public formula + exact DLL/UI contract implemented; synthetic browser QA passed; native pixel/open-session parity remains limited |
| `price-movement-levels` | [x] Exchange-session Open/prior-Close anchors, percentage/tick steps, dynamic support/resistance/zero levels, full public settings surface and persistence; protected rounding/pixel limits documented |
| `fvg-identifier` | [x] Standard future-safe three-candle zones, full public/DLL settings contract, bounded mitigation lookup and browser Save/reload QA; protected formula/pixel parity limits documented |
| `gap-detector` | [x] Public behavior + exact DLL settings contract implemented; synthetic renderer/settings QA passed; market-open parity remains limited |
| `swing-point` | [x] Confirmed high/low segments, full public settings contract, gap safety and browser QA; protected tie/filter parity documented |
| `average-daily-range-target` | [x] Completed-period Daily/Weekly/Monthly range targets, CME rollover, deep-history routing, labels/theme/persistence and focused tests; multiplier mapping is screenshot-supported inference and protected parity/live soak are not claimed |
| `session-marker` | [x] DST-aware Asian/Europe/USA windows, imbalance, OHLC/mid/VWAP, range fills, settings/theme/persistence and focused tests; protected pixel/formula and live-market soak limits documented |
| `shift-candle` | [x] Published Trinity settings contract implemented as a documented no-lookahead structure/delta/POC/exact-imbalance model; fresh zones, marker shapes, theme/persistence, event-chart alignment and live-only alerts covered; protected trigger/pixel parity remains unclaimed |
| `ichimoku-indicator` | [x] Standard five-line/cloud calculation; public `9/26/52` defaults and DLL bounds; browser/release gates recorded in dedicated audit |
| `parabolic-sar` | [x] Implemented; documented seed and parity limits |
| `linear-regression` | [x] Implemented; documented endpoint and parity limits |
| `regression-channel` | [x] Active three-line Bars/Zig-Zag channel; public defaults and explicit formula/parity limits documented |
| `super-trend` | [x] Implemented; Batch 8 production SHA verified, documented parity limits |
| `super-trend-difference` | [x] Implemented; Batch 8 production SHA verified, documented parity limits |
| `tillson-t3` | [x] Implemented; explicit seed and reference limits |
| `zig-zag` | [x] Three modes, live developing leg and retracement renderer implemented; documented protected-parity limits |
| `inverse-cyber-cycle` | [x] Two-window inverse-Fisher oscillator, levels, complete public settings contract and persistence implemented; protected seed/pixel parity remains limited |
| `average-directional-index-adx` | [x] Batch 3; seed and vendor-parity limitations documented |
| `candlestick-bar` | [x] Independent Minutes, DeepCharts-style target/reversal Vol Bars and tick Range candles; exact execution allocation, filled/outline styling, width/border/opacity, close boundaries, theme/persistence and focused tests. Event modes fail closed without exact tape; protected pixel parity/live soak remain explicit |
| `overlay-timeframe-highlight` | [x] Dedicated HTF aggregation/primitive, fixed or delta-fading highlight, body/shadow/range styling, high/low targets, bounded summaries, theme/persistence and focused tests; protected edge/pixel/live-soak limits documented |
| `annotations-overlay` | [x] Live workspace registry mirrors a selected open chart's calculated annotations by Chart ID and Indicator ID; target time alignment, source/theme colour, persistence and cleanup tested; cross-process/manual-drawing mirroring remains out of scope |
| `text-on-chart` | [x] Fixed multiline viewport overlay, full public/DLL settings contract, autoscale safety and browser Save QA |

## Reference evidence and constraints

- Profile-family findings and explicit integration gates:
  `docs/pending-profile-variants-audit.md`. All three profile entries stay Pending.

- Read-only installed DLL probe: `python scripts/dotnet-metadata.py --types Speed`
  successfully read 2,777 types / 30,928 methods but found no unobfuscated Speed
  type name. Do not mistake no name match for no indicator.
- Installed path: `C:\Program Files\Volumetrica Trading\Deepchart\Deepchart.dll`.
  Existing audit documents .NET Reactor protection. Metadata can establish
  public settings/types; it cannot prove a protected formula body.
- Absolute Levels official contract: two user-entered prices, independent line
  colour/style/thickness. This is the next simple implementation reference:
  https://www.deepcharts.com/helpcenter/article/absolute-levels-indicator
- Speed of Tape reference (distinct from Instant; must inspect before reusing):
  https://help.volumetricatrading.com/en/support/solutions/articles/204000011988-speed-of-tape
- Existing Big/Deep Contracts evidence remains in
  `docs/deepcharts-big-deep-contracts-effort-audit.md`.
- Pivot Points formula, settings, renderer and explicit parity limits:
  `docs/deepcharts-pivot-points-audit.md`.
- Gap Detector behavior, settings, renderer and explicit parity limits:
  `docs/deepcharts-gap-detector-audit.md`.
- Swing Point settings, calculation conventions and explicit parity limits:
  `docs/deepcharts-swing-point-audit.md`.
- Text on Chart settings, placement and explicit visual limits:
  `docs/deepcharts-text-on-chart-audit.md`.
- FVG Identifier settings, calculation conventions and explicit protected
  parity limits: `docs/deepcharts-fvg-identifier-audit.md`.
- Session Marker public/DLL settings, candle calculations and explicit visual/
  live-market limits: `docs/deepcharts-session-marker-audit.md`.
- Session Imbalance public/DLL contract, exact extension calculation and
  explicit parity limits: `docs/deepcharts-session-imbalance-audit.md`.
- Average Daily Range Target public/DLL settings, no-lookahead calculation and
  explicit formula/pixel limits:
  `docs/deepcharts-average-daily-range-target-audit.md`.
- Volume/Delta Sprint public/DLL settings, rolling execution contract and
  explicit allocation/pixel limits:
  `docs/deepcharts-volume-delta-sprint-audit.md`.
- Overlay Timeframe Highlight public contract, aggregation/primitive and
  explicit edge/pixel limits:
  `docs/deepcharts-overlay-timeframe-highlight-audit.md`.
- Candlestick Bar public contract, target/reversal Vol Bars semantics and
  exact-execution limits: `docs/deepcharts-candlestick-bar-audit.md`.
- On Candle Stats public contract, ordered-execution calculations and
  renderer limits: `docs/deepcharts-on-candle-stats-audit.md`.
- Shift Candle public contract, exact-footprint implementation and protected
  trigger limits: `docs/deepcharts-shift-candle-audit.md`.
- Annotations Overlay public Chart ID / Indicator ID contract and runtime
  boundaries: `docs/deepcharts-annotations-overlay-audit.md`.
- Important Levels period, plot and session contract plus exact-flow limits:
  `docs/deepcharts-important-levels-audit.md`.
- Full formula/pixel parity remains unclaimed until suitable reference evidence
  and side-by-side verification exist. No provider spending is authorised by
  this task and no vendor DLL/source is to be redistributed.
