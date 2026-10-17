# Indicator history recovery — 2026-10-17

## Request

Footprint, volume profiles and other indicators are not working. Diagnose and
restore the shared source rather than adding fake volume or neutral delta.

## Evidence and implementation

- Temporary OHLC import existed but its execution tape contained only one
  print; profiles returned no executions. History Plant template 206/207,
  one-tick/one-trade replay supplies real timestamp, price, size and side.
- Hour checkpoints and completed-session OHLC, volume, bid/ask and trade-count
  reconciliation precede atomic tape publication. Identical real prints stay
  separate; unknown aggressor remains unknown. No L3/order-placement claim.
- Provider minute markers are closing boundaries, and some boundary prints
  occur milliseconds into the following minute. Preserve raw print timestamps
  and rebuild OHLC from them; reconcile complete sessions, not an invented
  intraminute path. Original minute files have `.before-history-trades` backups.
- Shared tape readers prefer completed replay over partial live/backfill.
  Flow/profile cache provenance changes invalidate the previous empty folds.
- Reconciled completed sessions cannot be padded/overwritten by stale root
  candles or late live snapshots. Profiles exclude stale live-ring prints
  inside a recovered session's maintenance hour. Explicit contract routing
  no longer falls back to a root-only book when the provider is disconnected.
- Footprint uses a worker-folded exact viewport window, hard-capped at 100,000
  records and ten days; excessive windows reject explicitly, never sample.
  Same-window requests coalesce. Browser requests are debounced, cancellable,
  timed out and scoped to closed candles; real forming prints remain live.
  Matching historical footprints survive the new-minute fetch. Volume and
  candle price bounds are checked before accepting exact records.
- No continuous Vercel stream/poll or new vendor fan-out. One scoped main
  release uses the existing production Git integration. Imports happen only
  on the gateway and stop at a conservative cumulative 36 GiB budget.

## Verified

- Gateway suite: all 387 tests passed. Frontend decoder/actual
  footprint calculation: 2 tests passed. Scoped lint passed.
- Full isolated production build passed; final hook changes passed TypeScript.
- Public gateway latest sessions: NQZ6 and ESZ6 each 1,380 candles and 100%
  minute-flow coverage. Latest daily profiles return complete true, with
  3,826 NQ price levels / 797,048 volume and 535 ES levels / 2,286,982 volume.
- Nine-minute exact Footprint windows reconcile to real candles: 1,438 NQ
  and 2,381 ES executions. Backend daily profiles measured ~0.35–0.9 seconds.

## Remaining / operating limits

- Seven sessions published: NQ start dates Oct12–15; ES Oct13–15. ES Oct12
  failed mid-import with connection resets and provider permission code 13;
  three bounded attempts stopped. Both Oct11 sessions remain. Other futures
  have minute history but not recovered complete execution tape.
- Original VPS L3 archive remains unavailable. Do not synthesize missing
  resting orders, continuous observation receipts or options-contract prints.
- Footprint windows over capacity require zooming in. Event-based footprint
  and other execution consumers still need broader recovery/coverage work.
- Provider connectivity became unavailable during the weekend; historical
  reads work independently. No live-market readiness claim. Authenticated
  saved-workspace rendering/memory soak and next live-session checks are due.
- The temporary laptop gateway/relay must remain online. Transfer code,
  recovered tapes, OHLC and flow/profile folds before moving to the VPS.
