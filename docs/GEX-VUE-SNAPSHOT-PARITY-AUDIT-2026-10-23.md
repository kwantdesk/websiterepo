# GEX Vue snapshot audit — 23 October 2026

## Verdict and scope

**Partial certification, not a blanket one-to-one claim.** Every recorded interval
snapshot in the ten selections below matches the licensed Quant Data REST source
after the same expiry, representation and regular-session filters. This proves
the checked source-to-adapter/reconstruction path; it does not prove every private
Quant Data website response, every Greek/date, live delivery, or custom model.

The actual `/gamvue` workspace has SPXW, NDX, QQQ and SPY charts with Bounce Levels
and Dark Pool GEX. Its Quad + Map preset also embeds the GEX Map. The legacy GEX
View component and `/gex-data` are not substitutes for this inventory.

## Recorded source comparisons

Capture times: 2026-10-22 21:52:40 UTC (16 October session), and 21:54:32 UTC
(22 October session). These were completed New York sessions, not a live soak.
Default rows use GAMMA, FRONT_EXPIRY and PER_ONE_DOLLAR_MOVE. The additional SPY
row uses GAMMA, ALL_EXPIRIES and PER_ONE_PERCENT_MOVE. SPXW deliberately requests
the provider's SPX underlying, retaining SPXW application identity.

| NY session | Instrument / selection | Frames | Call/put/net values | Closing spot | Net exposure |
| --- | --- | ---: | ---: | ---: | ---: |
| 2026-10-16 | SPXW default | 391 | 86,826 | 7,660.94 | -2,158,848,292 |
| 2026-10-16 | NDX default | 390 | 62,028 | 29,186.82 | -319,820 |
| 2026-10-16 | QQQ default | 406 | 56,361 | 709.54 | -1,500,556,159 |
| 2026-10-16 | SPY default | 405 | 47,139 | 762.74 | -2,739,457,182 |
| 2026-10-16 | SPY all expiries / 1% | 405 | 137,181 | 762.74 | -28,929,721,538 |
| 2026-10-22 | SPXW default | 390 | 83,028 | 7,662.74 | 518,485,201 |
| 2026-10-22 | NDX default | 390 | 62,574 | 28,960.36 | 8,861,850 |
| 2026-10-22 | QQQ default | 405 | 50,013 | 704.71 | 693,540,143 |
| 2026-10-22 | SPY default | 405 | 39,153 | 764.02 | -612,724,537 |
| 2026-10-22 | SPY all expiries / 1% | 405 | 115,950 | 764.02 | -15,853,751,823 |
| **Total** | **All passed** | **3,992** | **740,253** | | |

The independent check compares every frame timestamp and every sorted strike's
call/put/net update, reconstructs the cumulative surface at every recorded minute,
and compares compact/full opening/current/1/2/5/10-minute surfaces. Different frame
counts are real source coverage, not filled-in observations. Missing CALL/PUT
fields are counted separately and treated as zero by the existing adapter; this
audit does not independently certify the vendor's missing-field semantics.

The signed-in reference website's SPY all-expiry net-GEX headline matched both
sessions: **-28.93 B / $762.74** and **-15.85 B / $764.02**. This rounded headline
check is not row-by-row browser-response certification. Browser response bodies
were not captured: the available in-app browser did not expose a REA CDP target.
Screenshot evidence is local at
`C:/Users/Karen/AppData/Local/KwantDesk/vps-migration-20261021/quantdata-spy-20261022-snapshot-proof.png`.

## Defects found and repaired

1. **Live compaction dropped the opening surface.** Session-growth calculations
   used the oldest rolling comparison instead. Preserve the actual first recorded
   surface alongside comparison frames, deduplicate timestamps, and invalidate
   the old compact browser cache (`compact-v2`). No cadence increase.
2. **ETag missed same-time, same-total corrections.** Strike redistribution or
   corrected history could falsely return 304. Hash the delivered content, ignoring
   only changing quota counters; unchanged content still benefits from 304.
3. **Replay borrowed future exposure and spot.** The UI advanced an early replay
   clock to the first recorded exposure, and missing early candles fell back to
   latest spot. Respect the requested clock; absent historical data stays absent.
4. **Dark Pool replay mapping could borrow later calibration.** Regression windows
   lacked an upper time bound, date-keyed frozen receipts could come from a later
   replay time, and absent historical prints could borrow session-close price.
   Bound samples/receipts to the clock and remove that closing-price fallback.
5. **Bounce replay could paint a retained future head or accept an old response
   after a backward seek.** Gate displayed heads/trails by clock and scope, and
   invalidate in-flight responses across seek generations. Forward playback still
   admits causal responses rather than starving on slow I/O.
6. **Omitted Bounce numeric settings became zero.** `Number(null)` silently
   disabled defaults in minimal queries. Missing/blank fields now use defaults;
   explicitly selected zero remains zero.

## Acceptance inventory — do not silently tick open rows

| Surface / behavior | Result |
| --- | --- |
| Raw structural GAMMA frames, default four instruments, two dates | PASS within table scope |
| Additional SPY all-expiry / 1% selection | PASS within table scope |
| Every recorded minute reconstruction in those selections | PASS |
| Compact vs full opening/current/comparison surfaces | PASS |
| Same-time corrected snapshot cache invalidation | Regression PASS |
| Replay exposure/spot/Bounce/Dark Pool causal clock guards | Regression PASS |
| Quant Data browser SPY closing headline, two dates | PASS, rounded headline only |
| Every browser strike/tooltip at every timestamp | OPEN — no raw browser capture |
| DELTA/VANNA/CHARM, every expiry/instrument/date | OPEN — not covered by bounded run |
| Live delivery timing and intraminute provider updates | OPEN — after-close run; map refresh remains 15 seconds |
| Bounce ranking, retirement, binning and mapped levels vs vendor | OPEN — custom transformation, not raw vendor equivalence |
| DEALER_INVENTORY vs STRUCTURAL_OI | DIFFERENT MODELS — never certify as interchangeable |
| Dark Pool cross-instrument historical mapping before adapter observation | OPEN — cannot invent missing historical calibration |
| Sessions exceeding the existing 480-frame retention limit | OPEN — not certified |

## Reproduction and verification

`scripts/audit-gex-vue-snapshot-lineage.mjs` requires explicit `--run`, makes five
bounded licensed comparisons, prints source/app SHA-256 digests and coverage, and
does not print secrets. Run through the existing alias/env loader against a
loopback Next server on port 4320, with `--session=2026-10-16` or `2026-10-22`.
It is not a scheduled job and must not be turned into continuous vendor polling.

Focused regression command:

```text
node --import ./scripts/alias-hook.mjs --test tests/gex-map-live-compaction.test.mjs tests/gex-map-spxw-provider.test.mjs tests/gex-vue-quad-map-preset.test.mjs tests/dark-pool-mapping-causality.test.mjs tests/bounce-replay-clock-safety.test.mjs
```

Result: **24/24 pass**. Existing replay/wiring scripts and the eight replay-window
tests also passed. Older source-regex hydration/frozen-surface suites contain
stale expectations and are not being represented as passing.

Final local production build passed, including TypeScript and all 84 static pages.

Operational observation: the two all-expiry full-history payloads exceed Next's
2 MB persistent-cache item limit (about 3.02/2.58 MB). The response still succeeded;
this run does not certify that large-payload persistent caching works. No new
provider login, VPS service, request cadence, or subscription was introduced.
