# Chart loading latency — 2026-10-17

## Request

All futures and options charts take too long to load. Fix the shared cause and
retain the changes for the return to the VPS.

## Evidence and changes

- Stored NQ history was read locally in 40–50 ms. The temporary relay had over
  100 simultaneous requests; the same public history request exceeded eight
  seconds under the uncompressed options-panel startup load.
- Added negotiated asynchronous gzip to buffered gateway JSON and cached
  provider responses. A shared response buffer shares its compression promise.
  Streaming responses are untouched. Real OHLC/execution bytes decode unchanged;
  no rate, wick, geometry or data-authority approximation was introduced.
- Explicit completed New York session provider responses retain their cache
  for five minutes. Current-session and undated requests retain their existing
  live cadence; provider refusals keep their existing bounded retry policy.
- The futures candle loader no longer waits for a duplicate optional execution
  archive request (up to 120 seconds) or IndexedDB persistence. The existing
  independent pane effect still hydrates exact order flow; scoped cached tape
  is retained. Closed CME sessions skip the unnecessary live-seam round trip.
- Time-history caching accepts valid OHLC when classified flow is absent.
  Missing fields remain absent, never fabricated zero delta. Empty histories
  remain errors; event-bar authority and event flow validation are unchanged.
- Options-underlying history uses one normalized gateway archive request for
  the entire window rather than a relay request per date. Symbol, range and
  OHLC are validated; explicit truncation is rejected rather than hidden.

## Verification

- Gateway suite: 380/380 in the preserved worktree.
- Four runtime tests execute the actual TypeScript loader/cache functions:
  optional stalled flow/storage does not hold candles; closed-session seams
  skip network; options history is one request and rejects wrong symbols,
  invalid geometry and truncation; missing flow preserves genuine OHLC.
- Gzip HTTP/concurrency/content-negotiation and completed-session cache tests
  pass, together with the eight provider coalescing/quota regressions.
- Profile cost containment 8/8, index cache 8/8 and futures source routing 6/6
  pass. TypeScript and scoped ESLint passed before the final small validation
  additions; production build verification is required on the final SHA.
- The legacy chart-history-state source-pattern test also fails unchanged HEAD;
  its expected loader statement predates the current implementation. It is not
  a newly introduced failure or a passing gate.
- Temporary backend deployed only the three scoped response files, preserving
  credentials, recordings and unrelated dirty authorizer/social code.
- Public five-day payload measurements after deployment: NQ 140,495 compressed
  bytes / 932 ms; ES 118,557 bytes / 398 ms; SPX 49,791 bytes / 1,092 ms; NDX
  40,664 bytes / 384 ms; QQQ 33,289 bytes / 676 ms; SPY 31,919 bytes / 437 ms.
  These are backend HTTP timings, not signed-in browser first-paint claims.

## Operations and limits

Production verification: commit `e950531c925f09fc5071508ab6a00c3dea8e333e`
is deployed and serves the live website. Vercel's final build passed. Production
diagnostics return gateway HTTP 200, connected/authenticated true, and the
completed SPX archive. All 49 restored futures roots still return history.
The final 14 targeted runtime/HTTP tests and scoped ESLint pass; the isolated
80-page Turbopack build passed with a local filesystem-root override solely
to permit its dependency junction. Unrelated dirty files were not deployed.
This follow-up changes only documentation and uses the ignored-build gate.

Ship these gateway changes to the restored VPS together with the new archives;
switch off the temporary Rithmic owner before starting the VPS session. The
temporary relay remains a weekend-history arrangement with unverified SSE.
QM, UB, 10Y and SR3 remain provider-reference blocked; historical event/tick/L3
coverage is still separate from the restored minute candles. No Vercel spend
limit or payment was changed. Only one scoped main push is needed for this fix.
