# Futures instrument loading — 2026-10-27

Owner: Gold/Micro Gold and every listed futures chart must load through the same logic as NQ.

## Findings and repairs

- Reproduced Gold spinner in the authenticated production workspace. Console showed GC daily profile requests carrying NQZ6. Pane reuse retained the previous product contract before effects reset it. Contract state is now scoped during render; mismatched live callbacks and live seam requests are rejected. Parent/micro identities remain separate.
- GCZ6 and MGCZ6 were already live on the VPS, with real archived history. Forty-one other catalogue products initially returned empty one-day histories. Licensed History Plant hydration added missing real OHLCV rows without rewriting any published row. Seven-calendar-day source history now exists for all 53.
- Fixed 10Y venue to CBOT. Rithmic front-month reference failed with code 7 for 10Y/QM/SR3/UB despite valid exact contracts. Fallback queries the same provider connection for actual listed contracts and expiration dates, requires exact root/exchange, excludes expired/spread symbols, and chooses nearest unexpired expiry. This is a reference-expiry fallback, not a claim of liquidity-selected front month. Verified live resolutions: 10YV6, QMZ6, SR3Q6, UBZ6. Provider replay returned actual bars for each. SR3Q6 is sparse (17 bars in seven days); it is not substituted with SR3Z6.
- Initial presentation no longer waits for a trade in every recent minute. Genuine sparse histories paint while tail recovery stays separate. No flat/fake bars or invented executions.
- Added a bounded daily catalogue history timer on the existing VPS at 08:20 UTC, away from existing hourly repair. At most 64 configured roots, 7-day default, 64 MiB run budget, stop on licensed-login errors, one History Plant connection. Existing rows win. No Vercel polling, new server or paid add-on.

## Verification

107 focused tests passed: every catalogue identity and venue, micro isolation, same-connection reference protocol, missing-only merge, fatal-login stop, history live edge/cache/wicks, footprint handoff and execution continuity. TypeScript, scoped ESLint and production build passed. Two legacy chart-loading source assertions already fail on HEAD (old cachedIsHydrated and chartVisualReady spellings); neither reflects the present loader logic. Critical-path test harness supplied the new contract validator; updated live-edge assertion allows genuine sparse bars to settle.

VPS API audit: 53 products × seven intervals = 371 successful non-empty history responses, zero invalid OHLC or duplicate/out-of-order timestamps, maximum 276 ms measured inside the gateway. These are API timings, not end-to-end browser timings. All rows below count real bars returned over the preceding seven calendar days. Closed sessions and quiet markets legitimately contain fewer bars.

| Instrument | Exchange | 1m | 3m | 5m | 15m | 1h | 4h | 1D | Max gateway ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 10Y | CBOT | 807 | 578 | 478 | 282 | 99 | 30 | 6 | 32 |
| 6A | CME | 6563 | 2294 | 1379 | 461 | 116 | 32 | 6 | 231 |
| 6B | CME | 4903 | 1832 | 1110 | 373 | 94 | 27 | 6 | 194 |
| 6C | CME | 5971 | 2258 | 1377 | 461 | 116 | 32 | 6 | 219 |
| 6E | CME | 6775 | 2299 | 1381 | 461 | 116 | 32 | 6 | 254 |
| 6J | CME | 6684 | 2292 | 1379 | 461 | 116 | 32 | 6 | 276 |
| 6M | CME | 5308 | 2128 | 1324 | 457 | 116 | 32 | 6 | 191 |
| 6N | CME | 4857 | 1837 | 1111 | 373 | 94 | 27 | 6 | 204 |
| 6S | CME | 5988 | 2236 | 1365 | 461 | 116 | 32 | 6 | 226 |
| BTC | CME | 5199 | 2195 | 1400 | 498 | 135 | 36 | 8 | 188 |
| CL | NYMEX | 6880 | 2300 | 1381 | 461 | 116 | 32 | 6 | 227 |
| ES | CME | 6900 | 2300 | 1381 | 461 | 116 | 32 | 6 | 233 |
| ETH | CME | 4558 | 1872 | 1178 | 424 | 116 | 31 | 8 | 184 |
| GC | COMEX | 6900 | 2300 | 1381 | 461 | 116 | 32 | 6 | 252 |
| GF | CME | 1332 | 459 | 275 | 95 | 30 | 10 | 5 | 47 |
| HE | CME | 1352 | 460 | 275 | 95 | 30 | 10 | 5 | 53 |
| HG | COMEX | 6509 | 2282 | 1377 | 461 | 116 | 32 | 6 | 243 |
| HO | NYMEX | 4480 | 1905 | 1229 | 452 | 116 | 32 | 6 | 164 |
| LE | CME | 1375 | 460 | 275 | 95 | 30 | 10 | 5 | 58 |
| M2K | CME | 6702 | 2298 | 1380 | 461 | 116 | 32 | 6 | 225 |
| M6A | CME | 2335 | 1404 | 980 | 372 | 94 | 27 | 6 | 94 |
| M6B | CME | 1898 | 1302 | 992 | 432 | 116 | 32 | 6 | 75 |
| M6E | CME | 5365 | 2211 | 1368 | 461 | 116 | 32 | 6 | 212 |
| MBT | CME | 6814 | 2573 | 1591 | 555 | 140 | 36 | 8 | 243 |
| MCL | NYMEX | 6896 | 2299 | 1380 | 461 | 116 | 32 | 6 | 259 |
| MES | CME | 6900 | 2300 | 1381 | 461 | 116 | 32 | 6 | 255 |
| MET | CME | 2873 | 1716 | 1237 | 510 | 139 | 36 | 8 | 135 |
| MGC | COMEX | 6897 | 2300 | 1381 | 462 | 117 | 32 | 6 | 259 |
| MNQ | CME | 6900 | 2300 | 1381 | 461 | 116 | 32 | 6 | 247 |
| MYM | CBOT | 6879 | 2299 | 1380 | 461 | 116 | 32 | 6 | 254 |
| NG | NYMEX | 5084 | 1829 | 1110 | 373 | 94 | 27 | 6 | 177 |
| NQ | CME | 6900 | 2300 | 1381 | 461 | 116 | 32 | 6 | 233 |
| PA | NYMEX | 3689 | 1608 | 1027 | 371 | 94 | 27 | 6 | 134 |
| PL | NYMEX | 6050 | 2255 | 1369 | 461 | 116 | 32 | 6 | 211 |
| QG | NYMEX | 1056 | 698 | 522 | 225 | 60 | 18 | 5 | 45 |
| QM | NYMEX | 4569 | 1928 | 1206 | 414 | 105 | 30 | 6 | 157 |
| RB | NYMEX | 4377 | 1828 | 1182 | 437 | 115 | 32 | 6 | 153 |
| RTY | CME | 6831 | 2300 | 1381 | 461 | 116 | 32 | 6 | 263 |
| SI | COMEX | 6726 | 2295 | 1379 | 461 | 116 | 32 | 6 | 248 |
| SIL | COMEX | 6837 | 2300 | 1381 | 462 | 117 | 32 | 6 | 244 |
| SR3 | CME | 17 | 16 | 15 | 15 | 13 | 12 | 5 | 10 |
| TN | CBOT | 6122 | 2263 | 1378 | 461 | 116 | 32 | 6 | 221 |
| UB | CBOT | 5514 | 2032 | 1234 | 415 | 105 | 30 | 6 | 190 |
| YM | CBOT | 6848 | 2299 | 1381 | 461 | 116 | 32 | 6 | 228 |
| ZB | CBOT | 6272 | 2265 | 1375 | 461 | 116 | 32 | 6 | 223 |
| ZC | CBOT | 4345 | 1700 | 1045 | 356 | 96 | 26 | 6 | 162 |
| ZF | CBOT | 6347 | 2272 | 1376 | 461 | 116 | 32 | 6 | 262 |
| ZL | CBOT | 4783 | 1741 | 1053 | 356 | 96 | 26 | 6 | 175 |
| ZM | CBOT | 4515 | 1708 | 1043 | 356 | 96 | 26 | 6 | 181 |
| ZN | CBOT | 6576 | 2284 | 1379 | 461 | 116 | 32 | 6 | 233 |
| ZS | CBOT | 4472 | 1705 | 1042 | 356 | 96 | 26 | 6 | 171 |
| ZT | CBOT | 5958 | 2246 | 1367 | 460 | 116 | 32 | 6 | 244 |
| ZW | CBOT | 4427 | 1711 | 1048 | 356 | 96 | 26 | 6 | 194 |

## Production operations

Gateway reloaded once; existing services, credentials, recording mounts and hotpath/source-order/heatmap/vendor budget overrides preserved. Added read-only protocol, client, instrument-resolution and catalogue script mounts to /opt/kwantdesk/compose.yml. Previous compose saved as compose.before-futures-catalog-20261027.yml. Catalogue replay used about 40 MiB total plus a 1.8 MiB four-contract recovery. Original archives were not replaced.

Limit: minute OHLCV replay does not recreate historical individual executions or L3 order books for newly collected products; CVD/footprint accuracy requires actual retained executions. Do not infer such data from these candles.

Release and browser verification: pending below.

VPS post-reload: health HTTP 200, connected/authenticated true. Gateway sampled 27.77% CPU, 853.3 MiB of its existing 5 GiB limit. Daily timer active, next run 2026-10-28 08:20 UTC. Runtime client SHA256 1c25e1143357ff6b52705a21de6ced10d41fd0dd208e57d91e4d405a6c6727e8; catalogue script f2421c970110e46ec5d4bc80c47647138b99b188e3ac212d449c92ae9655f859.

Follow-up production browser gate caught a genuine contract-resolution cancellation race after e978166b: the effect cleanup aborted the shared CME transport, then the replacement effect reused that rejected promise and swallowed AbortError, leaving the loader indefinitely. A manual refresh with the now-stable GCZ6 contract rendered Gold with profile/CVD, confirming the source was available. Shared CME transport now follows the existing Market Index pattern: bounded request completes into symbol-scoped cache; cancelled pane effects do not present it. Added an actual extracted fetchWorkspaceCandles regression with two consumers and an aborted first controller; one transport must return real candles to the surviving effect. Full focused suite 107/107 and second build checked before follow-up release.
