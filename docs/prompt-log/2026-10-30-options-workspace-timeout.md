# Options workspace timeout — 30 October 2026 (Brisbane)

Owner reports spinning followed by Live options data unavailable / signal timed out.

## Evidence and diagnosis

- The exact UI belongs to GammaWorkspace (the renamed Options page), using /api/options-flow.
- Read-only VPS checks found authenticated/connected gateway, about1.9GiB of5GiB and no current event-loop overload. QQQ exposure, drift and cash bars returned200 in175/590/352ms inside the gateway. This does not certify sustained market-open health.
- The actual server module over public certificate-verified VPS transport returned CORE in3.5s and FULL in6.6s without panel errors in the initial sample. The owner browser was not controlled.
- Browser workspace requests default to20s. FULL first waits on snapshot requests, then interval maps with25s deadlines, then price resolution. The outer deadline can therefore abort a supported successful read.
- quantDataPost and getOptionsFlowPayload expired their promise entries after a TTL measured from request START. Another caller after4/5s could rebuild the same unfinished dashboard and reissue unfinished surface requests. This creates avoidable provider/queue pressure.
- The zero-TTL promise.finally cleanup discarded its derived rejected promise, producing an unhandled rejection on actual failures.

## Repair

Pending jobs remain single-flight through settlement, successful TTLs start on arrival and failures delete only the same job. Zero-TTL successes/failures release without an orphan finally rejection. Options CORE/FULL client deadlines are bounded30/60s respectively; the shared chart deadline is unchanged. CORE still paints first. No added polling, vendor connection, entitlement, source substitution, historical fabrication, auth relaxation or paid service.

## Verification

- Eight of11 new extracted actual-function regressions fail against61417325; all11 pass after the change. Coverage includes both caches, delayed completion, TTL expiry, ticker/detail/price-mode isolation, failure recovery, preserved last-good timestamps and actual client load callback budgets.
-32 combined Options/opening/deadline/vendor retry/request contract checks pass; scoped source/test ESLint passes. Full TypeScript and production build are required before release.
- After repair, an actual live FULL request joined4.5s later returned the identical payload object at11,772ms, with346QQQ gamma strikes,116candles and no panel errors. Existing central VPS API transport and credential isolation were used. This is backend source verification, not an owner-browser first-paint measurement.
- No gateway/provider restart, trade/account/journal/preferences mutation or recordings changes. Production version must be verified after the single main push.

## Remaining scope

No proof of universal outage-free delivery, all-vendor pixel/numeric parity, every instrument's month of exact options history, off-box recovery or unattended execution is implied. Preserve those standing launch gates and the existing unrelated worktree.
