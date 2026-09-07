# Weekly Volume Profile — automatic five trading days

## Prompt

> weekly volume profile needs to automatically be the claculation of last 5
> days automatically.... then users can change stuff

## Diagnosis

The stock weekly profile was tied to the current CME calendar week. Early in a
week that produced only one or two sessions, so it did not represent the five-day
baseline requested by the product. The futures and projected cash/options paths
also needed to share the same explicit calculation window.

## Fix

- Added a rolling five-CME-session window based on actual restored candle
  trading dates, with a Chicago weekday fallback during initial hydration.
- The current developing session is included. Weekends are excluded and known
  exchange holidays are skipped.
- Made `Last 5 trading days · automatic` the stock Weekly Volume Profile
  setting and applied the calculated bounds to futures and projected
  cash/options requests.
- Added a settings migration: old untouched/current-week profiles adopt the new
  baseline, while explicit previous-week selections remain unchanged.
- Kept Current Week and Previous Week available so users can override the
  automatic calculation and save that choice in their chart/template.

## Verification and outcome

- Weekly-window regressions cover the automatic default, a developing session,
  a weekend, a skipped weekday/holiday, both request paths, migration wiring,
  and the two calendar-week overrides.
- Outcome: adding Weekly Volume Profile now calculates one profile from the
  latest five trading sessions automatically; users can then change its window
  and all other existing profile settings.
