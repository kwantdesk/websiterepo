# KWANTY underlying price and interaction parity — 2026-10-20

Request: audit open GEXBot and KWANTY Classic, State and Orderflow; restore real
underlying candles/line and interactive chart behavior, including QQQ and NDX.

## Root cause and implementation

KWANTY used sparse positioning snapshot spots as its candle input and hid it
when only one snapshot existed. It did not subscribe to the actual underlying
price stream. The new bounded price model/controller and account-scoped host
bridge use existing authenticated OHLC history and shared index/futures streams.
Every mode uses that independent series, including chart-grid embedded tools.
Quote-only observations never create fictitious new candles. Initial partial
futures trade seeds are quote-only until a fully observed new minute begins.
History repairs deduplicate across panels, once per quote minute; cached latest
history cannot cross a minute boundary. Replay excludes future source bars.

Candles/Line selection persists per package; real price tooltips show OHLC.
Plot/time-axis gestures pan and zoom time; profile price/exposure axes retain
their own transforms. Orderflow right price axis is independent of left metrics.
Reset restores automatic bounds. Render caches avoid reaggregating on hover.

## Reference evidence and bounded conclusions

- Read REA skill and runtime/connection/JavaScript references. No usable CDP
  endpoint was exposed; visible runtime inspection used the already-open IAB.
- Downloaded only observed public shipped main.f5205cc4.js and its mapped
  783.de20bf0d.chunk.js into ignored/local tmp evidence. Static REA summary IDs:
  ev_8e90f71046b93844e8b2b774700a7c77775255547ac880615a212f118f76614b
  and ev_de5db7e65a1b22a5132a668243a4f4589c541cf697ebe181a2fed2d164e667c8.
  Graphs were partial/node-limited; no-match symbol traces are not absence proof.
- Reference visibly offers candles/line, intervals, transforms, spot visibility,
  time/price interaction. Its session was closed; no live cadence equivalence proof.
- Authenticated underlying endpoints returned 391 genuine NDX one-minute OHLC
  bars for the prior session and five genuine QQQ bars for a focused five-minute
  probe. Raw licensed recordings remain local, not committed.
- Existing owner tab still held old v2 shell; final release needs refresh/readback.

## Checklist

| Area | Result |
| --- | --- |
| Classic actual OHLC, Line/Candles, drag/zoom/reset | Recorded-session browser verified |
| State actual OHLC with one positioning snapshot | Recorded-session browser verified |
| Orderflow both panels actual OHLC and Line | Recorded-session browser verified |
| Orderflow independent right price-axis zoom | Browser verified, other panel/metric axis unchanged |
| Genuine OHLC hit testing and time/price transforms | Focused regression tests |
| Shared source lifecycle, stale requests, replay, gaps, wick revisions | Focused regression tests |
| Account scope, duplicate panels, bounded caches | Bridge regression tests |
| Gateway genuine optional OHLC forwarding | Prepared/tested; runtime activation outstanding |
| Open-market continuous printing versus reference | Unverified while reference session closed |
| Full-session positioning metric history/numeric equivalence | Separate source-dependent unresolved item |

Validation: 175 focused tests pass. Gateway suite 449 tests passed during audit.
No extra provider account/service, new continuous Vercel path or gateway restart.
Local QA fixture explicitly labels its synthetic positioning and recorded prices;
it requires a locally supplied /recorded-history response, not committed data.
