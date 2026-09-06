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

## Remaining 24 — not released by blanket enablement

Each row needs evidence, settings/data implementation, calculation tests,
renderer/theme/persistence verification and explicit visual/latency limits.
Do not tick a row just because its Add gate changes.

| Indicator ID | Status |
|---|---|
| `speed-of-tape` | [ ] Audit / implement / verify |
| `volume-delta-sprint` | [ ] DLL settings enums audited; numerical/data semantics outstanding |
| `auction-gap-tracker` | [ ] Raw one-tick detector with six location modes tested; lifecycle/settings/render/live integration outstanding |
| `session-imbalance` | [ ] Audit / implement / verify |
| `volume-swing` | [ ] Audit / implement / verify |
| `monthly-volume-profile` | [ ] Owned range/job foundation tested; workspace/live/settings integration outstanding |
| `session-volume-profile` | [ ] Shared-engine routing audited; session/workspace integration outstanding |
| `visible-range-volume-profile` | [ ] Owned range/job foundation tested; viewport/sequence-aware data integration outstanding |
| `market-profile-tpo` | [ ] Audit / implement / verify |
| `anchored-vwap` | [ ] Audit / implement / verify |
| `on-candle-stats` | [ ] Audit / implement / verify |
| `important-levels` | [ ] Audit / implement / verify |
| `absolute-levels` | [x] Batch 2; reference/default limits recorded above |
| `pivot-points` | [x] Public formula + exact DLL/UI contract implemented; synthetic browser QA passed; native pixel/open-session parity remains limited |
| `price-movement-levels` | [ ] Audit / implement / verify |
| `fvg-identifier` | [ ] Audit / implement / verify |
| `gap-detector` | [x] Public behavior + exact DLL settings contract implemented; synthetic renderer/settings QA passed; market-open parity remains limited |
| `swing-point` | [ ] Audit / implement / verify |
| `average-daily-range-target` | [ ] Audit / implement / verify |
| `session-marker` | [ ] Audit / implement / verify |
| `shift-candle` | [ ] Audit / implement / verify |
| `ichimoku-indicator` | [ ] Audit / implement / verify |
| `parabolic-sar` | [x] Implemented; documented seed and parity limits |
| `linear-regression` | [x] Implemented; documented endpoint and parity limits |
| `regression-channel` | [ ] Audit / implement / verify |
| `super-trend` | [x] Implemented; Batch 8 production SHA verified, documented parity limits |
| `super-trend-difference` | [x] Implemented; Batch 8 production SHA verified, documented parity limits |
| `tillson-t3` | [x] Implemented; explicit seed and reference limits |
| `zig-zag` | [x] Three modes, live developing leg and retracement renderer implemented; documented protected-parity limits |
| `inverse-cyber-cycle` | [x] Two-window inverse-Fisher oscillator, levels, complete public settings contract and persistence implemented; protected seed/pixel parity remains limited |
| `average-directional-index-adx` | [x] Batch 3; seed and vendor-parity limitations documented |
| `candlestick-bar` | [ ] Audit / implement / verify |
| `overlay-timeframe-highlight` | [ ] Audit / implement / verify |
| `annotations-overlay` | [ ] Audit / implement / verify |
| `text-on-chart` | [ ] Audit / implement / verify |

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
- Full formula/pixel parity remains unclaimed until suitable reference evidence
  and side-by-side verification exist. No provider spending is authorised by
  this task and no vendor DLL/source is to be redistributed.
