# Indicator hydration performance

## Prompt

> we have an issue where i might load into my chart and voume profiles lag and take 10 seocnds to load in, this should be sleek and load in much quicker, this goes for all indicators, not delayed plkease

## Diagnosis

The chart's other heavy remote indicators already use retained or exact-key
caches. Volume profiles were the outlier. Their startup path opened the
persistent indicator cache, enumerated every stored volume-profile request for
every instrument and contract, decoded all matching responses, and only then
filtered the result to the active chart. The work therefore grew with the
account's total cached history rather than with the six profiles being drawn.

The live profile was also scheduled last. Daily trading dates are stored oldest
to newest and the request loop used that order, allowing historical days to
occupy the browser and gateway request queue ahead of the profile the trader is
currently watching.

## Fix

- Added deterministic exact-key persistent restoration for one requested
  volume profile.
- Each requested daily/session profile now paints its exact last-known Rithmic
  snapshot first and reconciles from the authoritative gateway afterward.
- The current/newest trading date is scheduled before historical dates.
- Weekly profiles use the same cache-first, refresh-behind sequence.
- Removed whole-cache enumeration from the chart volume-profile startup path.
- No approximate OHLCV profile was introduced; only complete execution-backed
  Rithmic/provider profiles pass the existing provenance guard.

## Verification

- Exact-key hydration regression: 6/6 passed. It proves one cache match, zero
  whole-cache key enumerations, newest-date-first scheduling, and cache paint
  before network reconciliation.
- Existing volume-profile settings/migration suite: 10/10 passed.
- Existing profile level chaining/occlusion suite: passed.
- Focused ESLint: passed.
- TypeScript: passed.
- Production build: passed; all 80 static pages generated.

## Outcome

- The chart's volume profiles no longer make startup work proportional to every
  instrument/profile ever cached by the account.
- A previously visited chart can paint each complete exact profile from one
  keyed lookup while the authoritative refresh runs behind it.
- On an uncached chart the current session owns the first request slot rather
  than waiting behind the historical lookback.
- Production deployment and live-browser verification are recorded after the
  implementation reaches `main`.
