> **SUPERSEDED SOURCE POLICY:** Provider replay comparisons below are not evidence of owned recording coverage. The owner requires VPS-recorded live data only; see [recorded-history policy](2026-11-02-recorded-history-policy.md). Provider imports have been separated and excluded.

# Charts instrument data audit — 2 November 2026

The fixed catalogue contains **53 futures products and 15 stock/index symbols**. The five completed CME sessions checked start on 25–29 October 2026 (25 October 22:00 UTC through 30 October 21:00 UTC). Cash history was checked for 26–30 October. SPXW correctly uses the physical SPX price tape. Dynamic individual CME option contracts are not part of this 68-symbol audit.

## Verified result

- Compared **283,110 one-minute futures candles**, including OHLC and volume, with a fresh licensed Rithmic History Plant replay: **0 missing, 0 extra, 0 differing** after repair. Before repair: 2826 differing candles and 3 extra candles.
- **265 actual VPS delivery requests** checked all 53 futures at 1m, 3m, 5m, 1h and 1D. All returned data without invalid OHLC, duplicate timestamps or unordered candles. This does not certify sub-minute/execution coverage before recording began.
- Provider comparison: 2026-11-02T01:08:15.546Z. Final delivery check: 2026-11-02T01:14:27.803Z.
- All 53 products are persistently subscribed. Fresh executions were observed for 50; the remaining products had no new prints during this observation, and are not labelled live-tested. At 2026-11-02T01:15:28.786Z, the collector was connected/authenticated, recordings reported no drops/errors, and the event loop was not overloaded.
- META and AMD each have all 390 regular-session minutes on each of the five checked cash dates, with no invalid OHLC. The US cash market was closed during the audit, so live regular-session cash updates were not observed.

## Faults corrected

1. The daily catalogue history job had stopped on a History Plant login rejection. A current licensed probe and full replay succeeded. The restored service now requests a bounded nine-calendar-day window.
2. Hourly history repair rejected the expanded catalogue at its old 40-instrument ceiling. The cap now permits the bounded root/rollover catalogue. The actual production maintenance service was run successfully after the fix.
3. Exact-contract fallback history shared a file with partial live capture. Provider history now belongs to canonical product-root files, with source-contract and completion metadata; live exact-contract recordings remain separate.
4. Empty-but-successful root replay failed to try a valid exact contract (QG). Both explicit reference failure and empty-root replay now retry the provider-resolved contract on the existing History Plant connection.
5. SOFR selected a valid but idle serial contract. A bounded sample of completed-session provider volume now ranks provider-listed, unexpired fallback contracts; SR3 resolved to SR3Z6. Expiry validation remains mandatory; no contract names are guessed.
6. Last-trade subscription snapshots were counted as new executions. A captured LEZ6 initial snapshot proved this path. Snapshots now seed quotes without becoming new candles, trade tape, CVD volume or bubbles. Raw provider messages remain recorded.
7. Complete provider sessions could be filled with stray partial-capture bars. Continuous chart requests now use the canonical completed provider session, including confirmed empty minutes/sessions. Explicit named-contract requests retain their exact-contract archive. Live unfinished sessions retain real captured prints.
8. Older saved OHLC/volume mismatches were repaired only for fully requested closed sessions, with original files backed up. This was an explicit repair, not a nightly instruction to rewrite published candles.
9. VIX already had owned VPS history but the website routed it toward an unconfigured provider. It now uses the shared QuantData history/quote route and shared stream; fallback EOD snapshots cannot duplicate a live VIX snapshot. VXN remains unsupported by the currently configured feed.
10. The chart's generic two-decimal fallback was unsuitable for currency and fractional-bond futures. All 53 chart ticks and gateway tick metadata are covered by the price-format regression, including 6M, 6J, UB and ZT.
11. Browser time-bar caches moved from time-v5 to time-v6 so older partial captures cannot hide the repaired history for twelve days. Drawings, workspaces and account records are not part of that market-data cache.

## Every futures instrument

Minute counts reflect actual provider bars. Quiet instruments need not have an execution every minute. Missing minutes were not padded with invented candles. All rows below passed all five checked timeframes and matched the provider minute replay.

| Root | Venue | History request | Matched 1m bars | Fresh executions observed |
| --- | --- | --- | ---: | --- |
| ES | CME | ES | 6,900 | Yes |
| NQ | CME | NQ | 6,900 | Yes |
| YM | CBOT | YM | 6,825 | Yes |
| RTY | CME | RTY | 6,803 | Yes |
| MES | CME | MES | 6,900 | Yes |
| MNQ | CME | MNQ | 6,900 | Yes |
| M2K | CME | M2K | 6,626 | Yes |
| MYM | CBOT | MYM | 6,873 | Yes |
| CL | NYMEX | CL | 6,879 | Yes |
| MCL | NYMEX | MCL | 6,898 | Yes |
| QM | NYMEX | QMZ6 | 4,741 | Yes |
| NG | NYMEX | NG | 6,379 | Yes |
| QG | NYMEX | QGZ6 | 2,157 | Yes |
| RB | NYMEX | RB | 5,489 | Yes |
| HO | NYMEX | HO | 5,321 | Yes |
| GC | COMEX | GC | 6,898 | Yes |
| MGC | COMEX | MGC | 6,901 | Yes |
| SI | COMEX | SI | 6,719 | Yes |
| SIL | COMEX | SIL | 6,862 | Yes |
| HG | COMEX | HG | 6,469 | Yes |
| PL | NYMEX | PL | 6,077 | Yes |
| PA | NYMEX | PA | 4,461 | Yes |
| ZN | CBOT | ZN | 6,557 | Yes |
| ZB | CBOT | ZB | 6,224 | Yes |
| ZF | CBOT | ZF | 6,372 | Yes |
| ZT | CBOT | ZT | 6,072 | Yes |
| TN | CBOT | TN | 6,108 | Yes |
| UB | CBOT | UBZ6 | 6,085 | Yes |
| 10Y | CBOT | 10YX6 | 576 | Yes |
| SR3 | CME | SR3Z6 | 3,574 | Yes |
| 6E | CME | 6E | 6,792 | Yes |
| 6J | CME | 6J | 6,723 | Yes |
| 6B | CME | 6B | 6,228 | Yes |
| 6A | CME | 6A | 6,589 | Yes |
| 6C | CME | 6C | 6,066 | Yes |
| 6S | CME | 6S | 6,022 | Yes |
| 6N | CME | 6N | 6,089 | Yes |
| 6M | CME | 6M | 5,219 | Yes |
| M6E | CME | M6E | 5,620 | Yes |
| M6B | CME | M6B | 2,015 | Yes |
| M6A | CME | M6A | 2,959 | Yes |
| BTC | CME | BTC | 4,587 | Yes |
| MBT | CME | MBT | 5,947 | Yes |
| ETH | CME | ETH | 4,729 | Yes |
| MET | CME | MET | 2,354 | Yes |
| ZC | CBOT | ZC | 4,193 | Yes |
| ZS | CBOT | ZS | 4,619 | Yes |
| ZW | CBOT | ZW | 4,275 | Yes |
| ZM | CBOT | ZM | 4,569 | Yes |
| ZL | CBOT | ZL | 4,855 | Yes |
| LE | CME | LE | 1,374 | No prints during observation |
| HE | CME | HE | 1,369 | No prints during observation |
| GF | CME | GF | 1,371 | No prints during observation |

## Every stock/index instrument

| Symbol | History response | Regular-session check |
| --- | --- | --- |
| VIX | 2,376 bars | 10 provider-omitted RTH minutes |
| VXN | Unavailable — no configured intraday feed | Not available |
| SPX | 4,881 bars | 390 minutes/day, all five dates |
| SPXW | 4,881 bars | 390 minutes/day, all five dates |
| SPY | 2,602 bars | 390 minutes/day, all five dates |
| NDX | 2,025 bars | 390 minutes/day, all five dates |
| QQQ | 2,602 bars | 390 minutes/day, all five dates |
| IWM | 2,556 bars | 390 minutes/day, all five dates |
| AAPL | 2,417 bars | 390 minutes/day, all five dates |
| NVDA | 2,506 bars | 390 minutes/day, all five dates |
| TSLA | 2,528 bars | 390 minutes/day, all five dates |
| MSFT | 2,184 bars | 390 minutes/day, all five dates |
| AMZN | 2,279 bars | 390 minutes/day, all five dates |
| META | 2,382 bars | 390 minutes/day, all five dates |
| AMD | 2,192 bars | 390 minutes/day, all five dates |

VIX's 10 missing regular-session minutes on 26–29 October are also absent from fresh provider responses (2, 2, 3, 3 by day); the owned archive has exactly the same omissions. They were not filled from another source. VXN's QuantData probe returned no data, and no alternate intraday provider credential is configured.

## Recording and history limits

- Continuous futures recording uses trades and BBO for unopened catalogue products. The ten core depth subscriptions stay full-depth; opening a depth consumer upgrades a product once. Catalogue maintenance asks for archive-only resolution and does not open unnecessary depth books.
- Minute-bar backfill cannot recreate unrecorded individual executions, order-book events or aggressor sides. Older footprint, CVD, tick/event-bar and heatmap coverage must be assessed against the actual execution/depth archive, not inferred from these repaired minute candles.
- Stock/index intraday history and quotes use the existing QuantData connection. They are not claimed to be a Rithmic equity execution tape; zero/absent trade volume must not be presented as verified execution volume.
- Genuine market closures and no-trade/provider omissions remain gaps. No synthetic wicks, bodies, prints or cross-instrument substitutions were introduced.
- A currently healthy single VPS is not a guarantee against future provider/network outages. The existing supervised collector, recording diagnostics and maintenance jobs remain in place.

## Validation and operations

- 105 focused backend tests passed. Three price-format tests cover 53 roots across root, continuous and exact-contract names (159 chart formats), plus gateway tick parity and stock/FX fallbacks. The cache migration regression passed. **109 targeted tests passed** in total.
- Existing options-underlying route coverage check passed: 14 symbols × 14 intervals (196 routed combinations; not 196 new upstream downloads). Scoped ESLint and the full Next.js production build passed.
- An older static test, test-index-history-cache.mjs, fails with “the restore path is gated on Databento again”. The same assertion fails on unchanged HEAD; it is not counted as passing. The current cache migration has a separate functional regression.
- All eight deployed backend source hashes match the release sources, normalised for Windows/Linux line endings. Full hashes and per-instrument responses are in the adjacent JSON audit.
- VPS audit/backup directory: /opt/kwantdesk/audits/instrument-data-20261102. Explicit repair backups also live under /srv/kwantdesk-recordings/history-repairs/. Existing raw recordings and exact-contract archives were retained.
- Production uses /opt/kwantdesk/compose.yml with RITHMIC_ARCHIVE_CATALOG_TRADES_ENABLED=true. Preserve the current runtime mounts when deploying: the image alone does not include all prior operational overrides. The daily catalogue unit uses --days=9; explicit repair flags must not be enabled casually in routine maintenance.
