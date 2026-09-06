# Closed-market candle countdown — 2026-09-06

## Owner prompt

“its the weekend and market is shut so why is the ticker timer in the bottom right of the chart still going???/”

## Cause and change

- CandleCountdownBadge used a wall-clock modulo fallback after its last candle expired. That manufactured a recurring countdown with no new candle.
- Workspace activity was refreshed on non-cached message receipt and snapshot responses, without checking observation freshness. The existing marketTimestamp candle-merging function also replaces observations older than 15 minutes with receipt time; it is therefore unsuitable for proving current activity.
- Added isolated source-time parsing that retains the provider's actual seconds/milliseconds/microseconds/nanoseconds/ISO timestamp. Activity expires 15 seconds after that observation, not 15 seconds after each repeated response. Missing, old and excessively future timestamps do not establish activity. Existing live-price/tape processing is not gated or slowed.
- Countdown requires explicit activity and a genuinely unexpired candle. Removed wall-clock deadline recycling. Inactive/unknown activity shows a dash without a badge interval; expiry while active shows a dash until another current candle is available. Tooltip describes closed/paused/awaiting data without falsely declaring an exchange closure from staleness alone. Event-based charts continue to have no time countdown.
- This is not a new market-hours/holiday calendar. It also does not change the existing candle-merging timestamp correction policy; that is separate from this badge/activity fix.

## Verification

- Six tests passed: weekend idle across second/minute/hour/day intervals, inactive daily/weekly bars, deadline/new-bar transitions, timestamp formats and invalid data, duplicate snapshot expiry/live recovery, and all three workspace activity call sites using source timestamps.
- ESLint passed for the new helper and test. Large component full lint is not claimed: the previous task's Chart lint exhausted both 4 GB and 8 GB heaps.
- Full production build/type checking passed (80 static pages). Combined countdown, idle-sampling and live Volume/CVD regression run passed 12/12. Production deployment is verified separately after push; no authenticated on-screen verification is claimed.
- No network polling, provider subscriptions, paid services, stream routing or chart-price update intervals were added or changed.

## Existing open launch notes

History backfill/tick-VAP coverage; VXN/options history licensing; off-site restore-tested backups; market-open reliability; final DeepCharts visual parity.
