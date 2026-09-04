# Prompt 34 — Weekly Volume Profile load time

## Requested

> Weekly volume profile just took like 20 seconds to load in. We need to sort
> this out.

## Diagnosed

- The developing weekly request included the timestamp of the pane's newest
  candle. That timestamp was part of the browser cache identity, so every new
  bar and every timeframe change bypassed the exact saved weekly profile.
- A cold gateway restore awaited each trading day's compressed profile archive
  in sequence.
- Each weekly request then walked every price row in every minute of all five
  sessions even though a completed session's whole-profile histogram never
  changes.

## Fixed

- The current week now has a stable request/cache identity. The gateway owns
  the moving current-time boundary, while the last exact profile can paint
  immediately and reconcile in the background.
- Independent daily archives restore concurrently on a cold gateway.
- Each folded session now materialises a compact whole-session histogram once.
  Unfiltered weekly profiles merge those compact price rows instead of
  rescanning the complete minute-level archive. Partial windows and trade-size
  filters retain the exact minute path.
- Switching chart timeframe no longer refetches the same weekly execution
  window.

## Verification

- Weekly-window/cache-identity regression: passed.
- Rithmic gateway suite: 329/329 passed, including the new materialised-session
  aggregate regression.
- TypeScript and the optimized 80-route production build: passed.

## Outcome

An already-seen weekly profile can paint from its exact durable snapshot rather
than waiting on the network. Cold gateway work is bounded to concurrent archive
restore plus a small price-level merge, while the live market-data event loop
remains protected from raw-tape reads.
