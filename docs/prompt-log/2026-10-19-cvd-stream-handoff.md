# CVD straight-line freeze — 2026-10-19

Request: CVD still freezes flat during the open market. Owner explicitly
approved a brief restart of the existing temporary gateway.

## Evidence

- NQ snapshot Ask/Bid volumes change; upstream executions are not simply flat.
- Local12-second SSE probe:6745740 bytes, seed1, trades530. Public:786432
  bytes, ready1, no completed seed. Ready incorrectly enabled execution
  authority before the seed arrived;15s watchdog could keep restarting it.
- Source delta OHLC snapshot sample: open358, high377, low108, close217,
  Ask1741, Bid1882. Its bar delta is-141, not the session-offset close217.
- Owner Chrome tab unavailable through current browser connector. No account
  data/workspace cleared; no signed-in visual verification claimed.

## Changes

- Browser explicitly requests128-print live seed; gateway clamps opt-in limits
  to25K and keeps legacy25K default. Atomic queued print handoff unchanged.
- Only accepted seed establishes connection health; ready/heartbeat cannot.
- First partially covered seed bar retains full historical flow; later covered
  bars may be enriched. No fabricated OHLC delta or completeness downgrade.
- CVD normalizes proven session delta offsets and uses previous verified close
  for its candle open. Existing count/filter/session controls retained.
- Private runtime patched only in server.mjs and trade-sse-continuity.mjs.
  Existing runtime differs from repo in unrelated Financial Info wiring; kept
  those differences. Verified gateway PID31112 parent26836, stopped child only;
  supervisor restarted it. No new infrastructure/provider login purchased.

## Verification and open work

-35 initial focused tests,9 hydration/liquidity continuity tests pass.
-28 script checks pass (direction5, flow heal7, settings10, divergence6).
- Full84-page production build, TypeScript and scoped ESLint passed.
- Post-restart local512-print probe: seed67ms, first trade112ms,301 live
  batches in12s. Public512 probe:131072 bytes but no completed seed in12s.
  Public128 probe: seed10850ms,236 live batches in14s. Public64 probe:
  headers received but no body in14s. Temporary tunnel latency is NOT fixed.
- Permanent VPS, exact rolling month history, missing Asia opening executions,
  weekly/footprint acceptance and owner signed-in CVD live soak remain OPEN.
- Final browser limit128:44 tests pass, scoped lint and full84-page build
  including TypeScript pass. Malformed seed timestamps cannot weaken the
  partial-first-bar guard. Production release verification follows below.
