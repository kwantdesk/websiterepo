# Rithmic interval availability

## Prompt

> most of the r time frams say cme unavaliable, fix all of them polease and check other time frames we have there but may not be connected and make sure thy laod inn correctly it nseems some dont work, some have history, some dont, some have live, some are paused.....

## What was found

1. `/api/cme-history` still refused every request when the retired Databento
   credential was absent, even though both its time-bar and event-bar paths now
   read the desk's Rithmic recorder.
2. The browser's exact execution stream hard-coded `exchange=CME`. That is
   wrong for CBOT, NYMEX and COMEX products and explains the split state where
   stored candles existed while live order flow appeared paused.
3. The same CME hard-code existed in five chart liquidity studies and the DOM
   panel.
4. Dense NQ 4-range history was correctly constructed, capped at 120,000 bars,
   and then rejected because that cap could remove one of the five sessions the
   route subsequently required. The route reported its own valid data as
   unavailable.
5. The live VPS was healthy and authenticated during the audit. Its compact
   tape allowlist contained all 53 advertised futures roots, but only ten roots
   had active writes at the time of inspection. A product that was never
   subscribed in the past cannot have exact historical event bars fabricated;
   it begins accumulating real history when its Rithmic subscription is opened.

## Fix

- Removed the obsolete Databento-credential gate from CME chart history.
- Routed live executions, all chart liquidity studies and DOM through the
  canonical futures venue resolver.
- Raised the bounded event-history capacity from 120,000 to 250,000 candles,
  aligned with the browser's bounded persistent history, so dense 4-range data
  retains five complete sessions without manufacturing or thinning bars.
- Added `test:cme-interval-routing`, covering every 53-instrument × 50-interval
  combination, every venue, the retired-provider boundary, all six chart/DOM
  liquidity subscribers and the dense-range capacity contract.

## Verification

- `test:cme-interval-routing`: 6/6 checks, 2,650 combinations.
- `test:rithmic-candle-integrity`: 2,650 combinations.
- `test:rithmic-bar-source`: 6/6.
- `test:event-bar-source`: 10/10.
- `test:event-bar-first-paint`: 7/7.
- `test:chart-history-state`: 4/4.
- Candle gap suites: 12/12.
- Execution stream staleness suite: passed.
- TypeScript: passed.
- Next production build: passed, all 80 static pages generated.
- Live collector through the local production API:
  - ES 1m: 10,928 candles.
  - NQ 40r: 11,822 bars, 2026-08-24 through 2026-09-03.
  - NQ 54r, 500v, 100t, 12R, 100dv, 12/4VB and 2/54PF: all 200.
  - NQ 4r after the capacity repair: 250,000 exact bars, 2026-08-28 through
    2026-09-03, HTTP 200.

## Outcome

Pending production deployment and live alias verification in this task.
