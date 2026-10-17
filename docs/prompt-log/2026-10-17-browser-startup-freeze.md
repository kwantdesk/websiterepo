# Browser startup freeze — 2026-10-17

## Owner request

The website freezes on entering it, clicks stop responding and the browser
sometimes crashes. This takes priority over restoring the last chart zoom.

## Evidence

- Production renderer telemetry at 06:17–06:26 UTC reports Charts stalls of
  2.5, 20.1 and 14.2 seconds. The latter two profiles attribute 96% and 94%
  of samples to anonymous functions in `15xhdj8laa.cp.js`, from deployment
  `d3c6a816`. The user still had a deployment-pinned older tab.
- That bundle contains gamma conversion, sweep reference discovery and
  Profile Values clocks that constructed Intl.DateTimeFormat inside per-bar
  loops. Three real 6,900-bar cash-close scans constructed 20,700 ICU
  formatters and took 1,583ms in Node; the same scans after repair construct
  zero formatters and take 83ms. These are isolated calculation timings,
  not a full signed-in browser performance claim.
- The old self-profiler omitted source columns, making anonymous functions
  in this large one-line bundle indistinguishable. Bundle attribution alone
  cannot prove which clock was responsible for every stall.
- The connected Chrome profile had no signed-in KwantDesk tab. A temporary
  inspection tab reached the access gate and was closed without clearing or
  modifying user settings. Production telemetry supplied the evidence above.

## Changes

- Reuse module-owned clocks for gamma cash-close/session scans, sweep
  reference clocks, weekly/monthly Profile Values and profile session dates.
  Formatting options, session boundaries, prices and volume math are unchanged.
- Preserve source columns in self-profiler reports for exact attribution if
  another production freeze occurs. Profiling remains opt-in in production.
- No feed restarts, provider changes, polling changes, account resets or
  removal of saved layouts/indicators.

## Verification and outcome

- New five-case actual-runtime clock-allocation suite passes, including six
  gamma panes × 6,900 candles (~272ms), DST, overnight date attribution,
  4,000-bar sweep references, and exact weekly/monthly volume conservation.
- Existing Profile Values, sweep detector, five-engine exchange-clock and
  chart-history critical-path regression suites pass.
- TypeScript and scoped ESLint pass. Isolated production build passes all 80
  pages with one page worker; the local dependency-junction root and one-worker
  settings are verification-only and are not deployed. The profiler-column
  diagnostic addition also passes scoped lint/type validation; production
  validates its final compiled bytes through the main-only build.
- A concrete startup allocation bottleneck is removed. Full closure requires
  the owner's authenticated saved workspace on the new deployment; do not
  describe the entire recurring freeze incident as conclusively solved yet.

## Still open

- Last-used chart viewport/zoom account restore (previous prompt).
- Authenticated multi-pane startup/soak, including any remaining browser/GPU
  resource growth. Existing important-notes items remain open.
- Proper VPS/SSE restoration before live trading and verified billing cap.

## Follow-up — exact post-release hotspot found

- Owner supplied Chrome Task Manager evidence: KwantDesk PID 37228 at
  518,968K and 94.4% CPU, reportedly rising beyond 1,000,000K (~1 GB).
  Memory footprint alone does not establish which allocation is leaking.
- Post-release production stall profiles at 06:37 UTC now include columns:
  `0dxfzvbz_v-m8.js:1:312046` owns 73–78% of samples during 7.6s/2.4s stalls.
  Reading those exact deployed bytes identifies `findCashCloseFuturesCandle`'s
  per-candle `formatToParts` scan. This is precise attribution, superseding
  the previous bundle-only evidence.
- Replaced the complete-history scan with timestamp binary searches for the
  two candidate civil minutes around New York 15:59. Preserved date, DST,
  ten-minute tolerance and first-bar tie semantics. Inputs are the workspace's
  already sanitized/ordered authoritative candle array.
- Workspace now skips the lookup entirely while its same-contract/session
  saved calibration is still valid. No gamma prices or candle data are altered.
- Seven runtime tests pass, including direct parity against the old scan and
  a 120,000-bar access-count gate (<100 indexed reads). 1,000 lookups through
  that history took 16ms locally. TypeScript and scoped helper/test lint pass.
- The CPU hotspot is proven; authenticated post-deploy memory/CPU soak is
  still required before declaring the recurring out-of-memory incident closed.
