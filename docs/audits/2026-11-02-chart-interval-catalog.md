# Complete chart interval audit — 2 November 2026

All 68 instruments in the active Charts picker were checked against all 50 built-in presets: 3,400 explicit outcomes. The companion JSON contains the complete matrix, per-instrument source windows and counts, classification coverage, transport checks and runtime hashes.

## Repairs

- Uppercase `R` remains Renko; lowercase `r` remains range. Fractional-tick Renko closes at its exact threshold.
- Live continuation retains loaded history instead of cutting it to 5,000 bars. Saved series retain up to 500,000 bars. Dense event histories initially load 50,000 bars and page older data at the left edge while retaining the viewport. Late responses cannot enter another instrument or replay scope.
- Fingerprinted forming-bar checkpoints preserve continuous event boundaries as the requested window moves. No silent end-of-day reset was introduced.
- Cache keys include exact bounds, interval, limit, paging and contract policy. Settled gateway caching is bounded to 96 MiB; execution folds run in the existing archive worker.
- Recorder and browser share CME daily, Sunday weekly and calendar-month buckets, including DST. Monthly live continuation works. Calendar requests include all available recorded data in the first bucket; partial derived caches cannot become authoritative history.
- Minute, second and event history share recorded contract segments. An intraday roll retains the earlier contract's prefix and excludes its later prints after the switch. Explicit contract requests remain isolated. The final comparison across all 53 products and all 17 recording dates changed only 10Y on October 29, repairing its 104-minute mismatch.
- Exact per-bar event flow is preserved instead of being overwritten by one-second aggregate flow. Genuine partial history and a single forming bar can render without a five-session rejection.

## Owned recording integrity

192 closed minute files were reconstructed from 64,733,840 saved executions. Original versions remain preserved with content hashes in `recorded-history-originals`; raw recordings and compact tapes were retained. Files were built separately and atomically replaced. The active session remained with its live writer.

Untyped legacy files are no longer accepted as proof of owned execution history. This supersedes the earlier assumption that an untagged file was owned merely because it was not labelled History Plant. No provider historical downloads were introduced.

The final checks have zero minute candles without matching compact-tape minutes in every audited futures window. Most checks ran alongside the live writer; 10Y and M6E were rechecked at a settled cutoff. Exact windows are recorded in JSON. Coverage equality does not establish that the provider delivered every exchange execution.

## Verification scope and limits

The real-data audit folded 41,224,400 captured executions, including the first session's required prefix, through every preset. Live continuation parity uses the last 512 captured records in 17-record batches for every event preset; retained-tail geometry checks inspect 64 bars. The separate synthetic matrix checks all fixture bars and conserves input volume/flow. This is an audit against owned recordings, not certification against another vendor's synthetic-bar rules.

Unknown aggressor classifications and out-of-order source timestamps remain counted in the JSON. No classifications, wicks, executions or unrecorded sessions were invented. Older intervals without captured executions cannot be reconstructed accurately from minute OHLC.

All 750 cash/index combinations were classified: 14 minute/calendar presets are supported by the quote source (210 combinations); five second presets and 31 event presets lack the required execution feed (540 combinations). Existing capability controls filter those unsupported choices. VXN has no captured candles. CME option-contract discovery remains unconfigured (503), so there was no active option-contract catalogue to audit.

## Operational evidence

- All 53 production minute-history endpoints returned owned candles. NQ 4r initial and older 50,000-bar pages exactly matched an uninterrupted 100,000-bar build, without overlap.
- The repaired 10Y transport returned its prior-contract prefix. Monthly transport expands the requested start to the calendar boundary.
- All 53 live subscriptions were connected/authenticated, recording enabled, and recorder/tape/bar errors clear. All ten mounted module hashes match the tested source.
- 79 backend tests, 58 catalogue tests, four cache tests, ten source checks, eight first-paint checks, scoped lint and the final production build passed. The unchanged `test-chart-history-state.mjs` has an obsolete `willRetry` source-pattern assertion that also fails on original HEAD.
- No browser click-through of 3,400 combinations is claimed. All combinations have explicit code/data checks in the companion matrix.
- Only the gateway was recreated; other services, credentials and settings were preserved. Owned-history maintenance remains network-isolated and covers eleven calendar days. Provider-history timers remain disabled. No new paid services or feeds were purchased.
- Website release target: `main`, existing Vercel project `websiterepo-yfmi`. Exact public SHA verification follows the push.

Construction references: [NinjaTrader bar types](https://static.ninjatrader.com/support/helpGuides/nt8/bar_types.htm), [bar construction](https://ninjatrader.com/support/helpguides/nt8/how_bars_are_built.htm), [session boundary options](https://static.ninjatrader.com/support/helpGuides/nt8/break_at_eod.htm).

## Every futures instrument

All 50 presets were checked for every row.

| Product | Captured executions folded | Minute/tape gaps | Event paging |
|---|---:|---:|---|
| ES | 8,159,305 | 0 | Yes |
| NQ | 3,998,178 | 0 | Yes |
| YM | 489,712 | 0 | Yes |
| RTY | 860,556 | 0 | No |
| MES | 4,226,936 | 0 | Yes |
| MNQ | 16,562,988 | 0 | Yes |
| M2K | 23,715 | 0 | No |
| MYM | 64,799 | 0 | No |
| CL | 1,046,614 | 0 | No |
| MCL | 63,833 | 0 | No |
| QM | 12,722 | 0 | No |
| NG | 40,469 | 0 | No |
| QG | 639 | 0 | No |
| RB | 16,536 | 0 | No |
| HO | 8,941 | 0 | No |
| GC | 766,618 | 0 | Yes |
| MGC | 124,931 | 0 | No |
| SI | 20,336 | 0 | No |
| SIL | 29,838 | 0 | No |
| HG | 13,032 | 0 | No |
| PL | 7,126 | 0 | No |
| PA | 3,307 | 0 | No |
| ZN | 3,333,004 | 0 | Yes |
| ZB | 52,267 | 0 | No |
| ZF | 123,307 | 0 | No |
| ZT | 76,178 | 0 | No |
| TN | 53,281 | 0 | No |
| UB | 377,882 | 0 | No |
| 10Y | 1,211 | 0 | No |
| SR3 | 387 | 0 | No |
| 6E | 504,301 | 0 | No |
| 6J | 20,979 | 0 | No |
| 6B | 7,861 | 0 | No |
| 6A | 9,707 | 0 | No |
| 6C | 7,485 | 0 | No |
| 6S | 5,294 | 0 | No |
| 6N | 4,176 | 0 | No |
| 6M | 5,923 | 0 | No |
| M6E | 2,163 | 0 | No |
| M6B | 293 | 0 | No |
| M6A | 445 | 0 | No |
| BTC | 2,130 | 0 | No |
| MBT | 6,228 | 0 | No |
| ETH | 2,597 | 0 | No |
| MET | 762 | 0 | No |
| ZC | 18,346 | 0 | No |
| ZS | 18,049 | 0 | No |
| ZW | 11,001 | 0 | No |
| ZM | 13,047 | 0 | No |
| ZL | 11,355 | 0 | No |
| LE | 4,287 | 0 | No |
| HE | 7,566 | 0 | No |
| GF | 1,757 | 0 | No |

## Every preset

- second: `1s`, `5s`, `15s`, `30s`, `45s`
- minute: `1m`, `2m`, `3m`, `5m`, `10m`, `15m`, `30m`, `45m`, `1h`, `2h`, `4h`
- time: `1D`, `1W`, `1M`
- volume-bars: `4/2VB`, `12/4VB`, `21/7VB`, `54/12VB`
- range: `4r`, `8r`, `12r`, `21r`, `40r`, `54r`
- volume: `200v`, `500v`, `1000v`, `2000v`, `5000v`
- trade: `50t`, `100t`, `200t`, `500t`
- renko: `4R`, `8R`, `12R`, `21R`, `54R`
- point-figure: `1/27PF`, `2/54PF`, `5/128PF`
- delta: `50dv`, `100dv`, `200dv`, `500dv`

## Every cash/index instrument

| Symbol | Captured 1m bars | Result |
|---|---:|---|
| VIX | 2265 | 14 recorded time presets checked |
| VXN | 0 | No captured candles |
| SPX | 1992 | 14 recorded time presets checked |
| SPXW | 1992 | 14 recorded time presets checked |
| SPY | 2600 | 14 recorded time presets checked |
| NDX | 1955 | 14 recorded time presets checked |
| QQQ | 2600 | 14 recorded time presets checked |
| IWM | 2537 | 14 recorded time presets checked |
| AAPL | 2395 | 14 recorded time presets checked |
| NVDA | 2487 | 14 recorded time presets checked |
| TSLA | 2509 | 14 recorded time presets checked |
| MSFT | 2174 | 14 recorded time presets checked |
| AMZN | 2259 | 14 recorded time presets checked |
| META | 2367 | 14 recorded time presets checked |
| AMD | 2189 | 14 recorded time presets checked |

## Large-response transport check

Finite history responses now emit bounded 64 KiB byte chunks for large payloads, preserving JSON, private cache headers and 304 responses. Older-history reads use the same existing site-access-protected fast market-read path, avoiding an extra remote sign-in refresh. Two tests round-trip JSON above 4.5 MB, including Unicode across chunk boundaries. This follows [Vercel’s response streaming guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions). No continuous tick stream or replay generation was moved onto Vercel.
