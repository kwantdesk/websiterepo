# Footprint partially populated — 2026-10-19

Owner screenshot shows historical outline bodies and cells only near the live
edge. Do not call this fixed from an HTTP200 or fabricate historical cells.

Evidence:
- Initial local settled-window NQZ6 and ESZ6 probes: 77 bars each, zero full
  OHLCV mismatches with compact exact history. Public relay compact NQ POST200,
  649ms / 84,025 bytes / 78 bars. Bare production proxy correctly returns401;
  the session browser inventory exposes no signed-in Chrome tab.
- Client decoder throws away the entire window on one nonmatching candle;
  the hook has no same-window retry, so a transient failure remains until a
  new viewport/closed-candle signature. These are verified code failure modes,
  not a claim of a fully reproduced authenticated screenshot cause.

Changes:
- Added an available-bar decoder retaining full wire validation while isolating
  per-candle OHLCV coverage mismatches. Only matching bars become render records.
  Strict all-or-nothing decoder remains for callers requiring complete history.
- Hook shows valid neighbours with an explicit missing-bar count. The existing
  summary-generation renderer hydrates those bars in one build, not a slow cursor.
- Completed warm cache excludes partial results. Shared/coalesced history now
  carries coverage metadata, so every pane receives the same coverage outcome.
- Recovery retries at1.5s,4s,10s (maximum four loads per unchanged scope), cancels
  on scope departure, preserves last-good records on request errors, and clears
  error on verified recovery. Existing30s request budget and shared worker bounds
  remain. No gateway restart, credentials, security bypass or paid resource.

Verification:
- All64 footprint test cases pass: compact/raw parity, grouping, count/volume,
  delta extrema, renderer hydration, live continuity, presets, zoom persistence,
  partial-neighbour isolation, corrupt payload rejection, retries/cancellation,
  sharing and partial-cache exclusion.
- Actual local data through new decoder and existing incremental render builder:
  NQ81/81 bars with rows,17,655 total volume; ES81/81,20,453. Both exactly match
  authoritative candle volume. This is model/render-input verification, not a
  signed-in browser pixel/long-soak acceptance test.
- Scoped ESLint and full production build passed (84 pages). Normal main release
  and production verification pending.

Still open: exact screenshot acceptance, unrecorded session opening and older
archives, public quick-tunnel SSE limitation, aggregate weekly completeness and
all-symbol/timeframe/indicator UI soak. Never report the whole platform cleared.
