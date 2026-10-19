# Shared indicator loading — 2026-10-19

Request: loading fixes must cover every chart indicator, including footprint.

Implemented:
- Fixed shared client/server gateway timeouts that ended after headers, leaving
  JSON body downloads unbounded. Caller cancellation remains attached.
- Workspace JSON requests now share one total deadline across a bounded retry
  and body parsing instead of restarting the full deadline for the retry.
- Coalesced identical exact-footprint history requests across panes/remounts.
  Validated nonempty results only: 60-second, four-window / 50,000-record cache.
  Exact OHLCV, contract, interval and trade filters remain part of the key.
  Each owner can cancel independently; the last departing owner aborts upstream.
  Captured requested candles are used for async decoding, not a later generation.
- No synthetic data, provider credential changes, gateway restarts or paid
  infrastructure. No claim that every indicator has passed signed-in acceptance.

Verification:
- 27 tests passed using `node --import ./scripts/alias-hook.mjs --test` over
  market-data-request-deadline, shared-footprint-history, compact-footprint-history,
  exact-footprint-history, footprint-data-integrity, weekly-profile-unavailable,
  kwant-levels-initial-fetch, chart-first-load-concurrency and
  chart-cvd-hydration-gate test files.
- Scoped ESLint: no errors. Next production build: passed, 84 pages.
- Tests exercise stalled bodies, retry budget, caller cancellation, request
  sharing, independent pane cancellation and abandoned-result isolation.
- Additional gateway-environment and profile-boundary continuity tests: 15
  passed. The older daily-volume-profile source-shape suite has six failures
  (one pass): failing assertions target existing renderer/workspace source
  patterns in files unchanged from HEAD. They remain unresolved, not green.

Still unresolved:
- Quick-tunnel SSE limitation; missing exact historical sessions/provider errors.
- Five-session aggregate completeness can disagree with individual sessions.
- All-indicator, all-symbol/timeframe signed-in startup and long-running UI soak
  are not verified. Code/build tests do not prove near-instant user load times.

Release: pending normal main push and production verification.
