# Complete pending-library audit — 2026-09-06

Owner request: finish every pending indicator using DeepCharts reference/DLL
evidence, with real calculations, settings, data, rendering and no fake releases.

## Correction to the previous completion claim

The September 4 overhaul completed its frozen 21-item list, not the whole
catalogue. The actual September 6 library had 128 entries and 38 failed the
intersection of LIVE_CHART_INDICATOR_IDS and RENDERED_CHART_INDICATOR_IDS.
Absolute Levels was incorrectly described as already available in the old
inventory; it has neither release registration nor calculator in this checkout.

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

## Remaining 36 — not released by blanket enablement

Each row needs evidence, settings/data implementation, calculation tests,
renderer/theme/persistence verification and explicit visual/latency limits.
Do not tick a row just because its Add gate changes.

| Indicator ID | Status |
|---|---|
| `speed-of-tape` | [ ] Audit / implement / verify |
| `volume-delta-sprint` | [ ] Audit / implement / verify |
| `auction-gap-tracker` | [ ] Audit / implement / verify |
| `session-imbalance` | [ ] Audit / implement / verify |
| `volume-swing` | [ ] Audit / implement / verify |
| `monthly-volume-profile` | [ ] Audit / implement / verify |
| `session-volume-profile` | [ ] Audit / implement / verify |
| `visible-range-volume-profile` | [ ] Audit / implement / verify |
| `market-profile-tpo` | [ ] Audit / implement / verify |
| `anchored-vwap` | [ ] Audit / implement / verify |
| `on-candle-stats` | [ ] Audit / implement / verify |
| `important-levels` | [ ] Audit / implement / verify |
| `absolute-levels` | [ ] Audit / implement / verify |
| `pivot-points` | [ ] Audit / implement / verify |
| `price-movement-levels` | [ ] Audit / implement / verify |
| `fvg-identifier` | [ ] Audit / implement / verify |
| `gap-detector` | [ ] Audit / implement / verify |
| `swing-point` | [ ] Audit / implement / verify |
| `average-daily-range-target` | [ ] Audit / implement / verify |
| `session-marker` | [ ] Audit / implement / verify |
| `shift-candle` | [ ] Audit / implement / verify |
| `ichimoku-indicator` | [ ] Audit / implement / verify |
| `parabolic-sar` | [ ] Audit / implement / verify |
| `linear-regression` | [ ] Audit / implement / verify |
| `regression-channel` | [ ] Audit / implement / verify |
| `super-trend` | [ ] Audit / implement / verify |
| `super-trend-difference` | [ ] Audit / implement / verify |
| `tillson-t3` | [ ] Audit / implement / verify |
| `zig-zag` | [ ] Audit / implement / verify |
| `know-sure-thing-kst` | [ ] Audit / implement / verify |
| `inverse-cyber-cycle` | [ ] Audit / implement / verify |
| `average-directional-index-adx` | [ ] Audit / implement / verify |
| `candlestick-bar` | [ ] Audit / implement / verify |
| `overlay-timeframe-highlight` | [ ] Audit / implement / verify |
| `annotations-overlay` | [ ] Audit / implement / verify |
| `text-on-chart` | [ ] Audit / implement / verify |

## Reference evidence and constraints

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
- Full formula/pixel parity remains unclaimed until suitable reference evidence
  and side-by-side verification exist. No provider spending is authorised by
  this task and no vendor DLL/source is to be redistributed.
