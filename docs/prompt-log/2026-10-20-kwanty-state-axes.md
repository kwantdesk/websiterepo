# KWANTY State normal chart axes — 2026-10-20

## Request

Time along bottom, price on right, normal X/Y navigation and crosshair that
pinpoints the accurate cursor time and price.

## Changes

- Decoupled State price-axis side from left/centre/right profile alignment;
  gesture regions use the new explicit axis side. Classic layout unchanged.
- Decimal/adaptive price ticks, clock-boundary time ticks and axis boundaries
  use the data renderer's exact viewport and transforms. IV has a separate lower
  scale; it no longer occupies the primary time row. Exposure remains at top.
- Crosshair axis badges show actual cursor time/price, not nearest strike or
  candle. Time is account/chart timezone-aware, with date, seconds and UTC
  offset to distinguish DST repeated hours; tight zoom also has milliseconds.
- Existing drag/wheel/Ctrl-wheel/double-click reset remains, no second interaction
  engine or network source. No history means no invented timestamp/price history.
- Versioned module entry chain, standalone iframe and embedded Options Flow tools.

## Verification

- 209 KWANTY/reference tests pass, including nine new State axes cases: fixed
  right side for each profile alignment, exact inverse coordinates after pan/zoom,
  decimal precision, timezone/DST offsets, no fabricated time, IV row separation,
  visibility controls, clock boundaries and millisecond crosshair labels.
- TypeScript --noEmit passes. Scoped ESLint has no errors; one existing
  OptionsFlowToolPanel effect cleanup ref warning remains (line100, unrelated).
- Browser fixture calls actual drawProfile/chart-interaction/theme modules with
  clearly labelled synthetic data and local in-memory controls, never owner data.
  `node scripts/serve-kwanty-state-axes-fixture.cjs` on loopback4924.
- Initial viewport t1792503000000..1792508400000, price96.5..104. Plot drag changed
  time to1792502666372..1792508066372 and price97.06818..104.56818. Wheel over
  right axis kept exact time domain while price narrowed to97.46591..104.21591.
- At cursor687,292 (wide fixture), inverse price100.335227 and timestamp
  1792506188526.037 matched labels100.34 / Oct20 10:23:08 GMT-4. Dark/light
  and 380px-pane checks show badges/grid aligned and bounded, separate IV row.
- Proofs: tmp/kwanty-state-axes/proof/dark-crosshair.png,
  light-crosshair.png and narrow-crosshair.png. They are isolated QA, not live.

## Release / remaining

Pending scoped main release verification. Existing supported gateway/VPS,
full-session options snapshot archive entitlement, month history/recording,
missing Asia executions, full indicator soak and GEX parity/cost gates remain
OPEN. This is an axes/interaction change, not a provider/history repair.
