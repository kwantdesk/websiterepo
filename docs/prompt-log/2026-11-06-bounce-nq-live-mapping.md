# Bounce Levels missing on normal NQ charts

## Request and diagnosis
Owner reports no Bounce Levels when attaching the indicator to normal NQ. The options-to-futures projection requires causal paired minute opens. useBounceMappingHistory always requested 08:00–17:00 New York for the selected session. During the live session, the cme-history route rejects an end more than one minute in the future, returning 400 before reading the recorder. That leaves all canonical futures mapping points empty and the projection correctly refuses to invent strike positions. Reproduced using the actual hook and actual route code. Direct read-only owned NQ recorder query returned 200, 148 minute candles in 1106ms; no feed restart or provider backfill.

## Scoped repair
Clamp the mapping request end to the earlier of current time and 17:00 New York. Do not issue an inverted request before 08:00. Keep the endpoint validation, causal same-minute open pairing, true per-contract history, replay clipping, colours, levels, exposure quantities, request coalescing and settings unchanged. Applies to NQ, MNQ, ES, MES, RTY and M2K through their shared hook. Completed sessions retain the full endpoint.

## Verification
39 targeted tests pass. New tests execute the actual hook through the actual history route with an isolated recorder adapter: former request is rejected; repaired live request returns points for all six futures roots; completed replay and pre-session cases behave correctly. Actual projection then receives those points and produces QQQ-to-NQ and NDX-to-NQ levels with exact expected prices and unchanged exposure, without using an unrelated current price. Existing alignment, zoom and replay-clock suites pass. Hook ESLint passes. Full isolated build log: tmp/bounce-nq-mapping-build.log. Production receipt: tmp/bounce-nq-mapping-production-release.json.

No owner browser access/refresh, feed or terminal restart, subscription reset, account/order/workspace mutations, or paid infrastructure changes. The live owner tab has not been inspected, so this verifies the demonstrated mapping failure and production activation, not all possible unavailable-source scenarios.
