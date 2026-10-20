# LIQ MAP shared order ticket and trade controls — 2026-10-20

## Request

Open the normal side ticket while on LIQ MAP, place trades and move TP/SL there,
then have the same trade/protection appear on normal charts.

## Implemented

- Both standalone and grid map mounts use the existing paper account ledger,
  working orders, confirmation modal, protection updates and cancel/close handlers.
- Map ticket instrument follows the map rather than an unrelated normal chart.
  Account/symbol/context changes discard any pending chart-price confirmation.
- Map plot reports its exact price geometry, not guessed/clamped screen prices.
  Filled entry is fixed; working entries, stops and multiple remaining targets
  are movable. Missing SL/TP can be added. Preview commits once on pointer release.
- Pointer capture and all cleanup paths release the shared protection suspension.
- Fresh validated real book/print packets use the shared synchronous execution
  arbiter. Visual holds/history/replay cannot trigger paper fills. Map execution
  cannot fall back to static/watchlist prices. Same-timestamp quote/print distinction
  is retained. No extra market subscription, provider login, server API or poller.
- Theme surfaces and semantic colours are reused. Asset version bumped once.

## Verification

- 59 focused tests pass: new map trading tests, paper accounts, map navigation,
  feed/performance, bubble anchors, CVD, rollover and colour/contrast checks.
- TypeScript `--noEmit` passes; optimized `npm run build` passes.
- Actual React overlay tested in isolated local browser with synthetic **in-memory
  paper data**. Opening ticket resizes the map; dragging stop 29990→29995.25 and
  target 30010→30006.25 updates the same ledger shown by the normal-chart mirror.
  Re-entering map preserves these values; replay disables all level edits.
- Full 117-test selection includes 12 pre-existing failed source-contract assertions.
  Baseline was independently rerun using HEAD versions of touched source files;
  the same 12 fail. They concern older toolbar/settings/style/font expectations
  (7) and older paper-chart/P&L expectations (5), not the new runtime behavior.
  The map navigation assertion was updated for the new cache-busted iframe URL.
- Existing broker execution gates preserved. This does **not** implement or verify
  live broker routing; no real owner paper trades or broker orders were submitted.

## Release

Pending scoped main push and production READY verification. Local QA helper:
`node scripts/serve-liquidity-trading-fixture.cjs` (127.0.0.1:4921, no live data).
