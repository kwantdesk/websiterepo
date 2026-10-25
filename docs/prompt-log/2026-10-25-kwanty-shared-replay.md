# Kwanty shared workspace replay — 2026-10-25

## Request

Move replay out of Kwanty's right controls into the Charts-style Replay button,
centered date/time/timezone picker and bottom transport. Classic, State and Order
Flow must walk forward together from genuine recorded history.

## Implementation

- Reuse WorkspaceReplayDialog, the existing master replay state, real elapsed
  1x clock and the same renderReplayTransport as Charts/LIQ Map. Per-active-panel
  candle stepping, scrubbing, speed, pause, rewind and return-to-live are shared.
- Add the themed header Replay/Exit control. Old right-sidebar playback controls
  are removed from the visible interface; inert hidden legacy IDs only retain
  compatibility with existing app handlers. Embedded Charts tools use Charts'
  master control, not another visible button.
- Host/iframe handshake scopes messages to the exact same-origin frame, matching
  session and timestamp. Readiness gates playback until all visible sources and
  enabled historical overlay pages are ready. Actual errors expose Retry replay;
  retry also clears the enabled Order Flow overlay archive failures.
- Preserve selected date across mode/ticker changes. Generation ownership rejects
  stale date/selection responses and late historical completions after live exit.
- Exact Classic/State pages must be ready before a manifest summary can render.
  All three modes filter by the master cutoff; independent ticker panels remain
  independent. Binary prefix lookup and observation/minute price caching avoid
  repeatedly filtering/rebuilding full sessions every 100ms or pointer paint.
- Futures-converted ES/SPX and NQ/NDX price axes now request exact CME trading-date
  minute history, never today's contract snapshot or a substitute cash price.
- Keep coalesced host requests alive for remaining consumers when an old caller
  is aborted; only that caller rejects. Existing queue/timeout/cache budgets stay.
- No VPS restart, provider account change, new service or per-clock-tick vendor
  polling. Only source/manifest/page changes need bounded existing requests.

## Verification

- 415 tests passed across all Kwanty and shared replay suites, including Charts,
  LIQ Map, timezone, no-lookahead, price, panel ownership and overlay regressions.
- New executable tests cover causal prefixes/rewinds, exact-page buffering across
  all three modes, independent panels, stale date/exit races, completed-minute
  candle limits, historical futures coalescing and no cash/live substitution.
- Local production build/typecheck passed. Scoped ESLint: zero errors, one
  existing OptionsFlowToolPanel ref-cleanup warning.
- Read-only production VPS probes: SPX 2026-10-23 Classic gex_full and State
  gamma_zero returned provider-eod-archive with 16,003 observations and 81 pages
  each; page 0 returned 200 exact observations for each selection.
- Order Flow direct history returned 403 UPSTREAM_ENTITLEMENT_REQUIRED. Existing
  same-date /session fallback returned 16,003 actual provider-eod-archive rows,
  all ordered and SPX-scoped (zero invalid), with convexity/aggregate DEX/charm/
  vanna/order-flow fields present. No fake history was substituted.

## Honest limits / remaining acceptance

- The same 2026-10-22 SPX profile requests returned EOD_SESSION_DATE_MISMATCH.
  Never substitute the latest session or promise full-week archive coverage.
- This verifies SPX source paths, not every possible instrument/category/date.
  Unsupported/missing historical prices and profiles remain unavailable.
- Minute OHLC is not tick history: an unfinished source minute's final candle
  is withheld until its close. No invented intraminute wick path or interpolation.
- Connected browser was signed out; signed-in visual/pointer acceptance is not
  claimed. Vendor parity, off-box backup and other IMPORTANT-NOTES launch gates
  are not closed by this replay integration.
- Production release verification will be recorded after the single main push.
