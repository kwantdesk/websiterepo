# Gex View interval fetch recovery — 10 November 2026

## Observations
- Read-only VPS archive requests for SPX, SPY, NDX and QQQ at 5m returned HTTP 200 in 650–714ms, with 237–312 recorded bars over the requested window.
- Signed-in isolated Gex View, four linked panels: 1m, 2m, 3m, 5m, 10m and 15m all loaded without a visible fetch error in this inspection. Original 1m selection restored. No owner tab refreshed and no orders modified.
- An anonymous/old-credential CLI probe returned 401 and is not evidence of chart failure. Signed-in website API SPY 5m returned recorded bars successfully.
- The owner's original intermittent network failure was not reproduced. Its initiating transport/authentication cause is not established.

## Confirmed recovery defects and repair
- Index history used separate 20s and 30s attempts. Both internal deadlines called AbortController.abort(), producing AbortError. Pane hydration interpreted that as user cancellation and returned without settling the loader.
- A normal network failure after both attempts was terminal; only Databento panes had background reconciliation. Index panes could remain on Failed to fetch after connectivity recovered.
- Index reads now use the existing shared end-to-end 25s JSON/request budget with bounded transport retry and conditional browser revalidation. Request coalescing remains per symbol, interval and archive window.
- Live and replay index hydration now schedule at most three quiet recovery reads after transient failures (2s, 4s, 8s). Switching interval/unmounting cancels pending recovery. Authentication/permission failures, missing recordings and invalid data do not loop. No new continuous polling.
- Only actual owner request cancellation is silently ignored. Internal deadline failures settle the loader and qualify for bounded recovery.

## Validation
- 14 focused tests pass, including body deadlines, bounded transport retries, authentication exclusions, bounded recovery/backoff and cancellation.
- Scoped ESLint: zero errors; existing workspace hook warnings remain.
- Expanded old underlying-history test includes a pre-existing source expectation for a KwantData-before-Massive branch; that source file was not modified and the owner policy now requires owned VPS recordings. Not counted as passing.
- Production build/deployment and post-release check recorded below after completion.

## Limits
This repairs recovery, not an established initial outage cause. No missing historical bars were invented, no provider history was downloaded, and no gateway/provider/terminal was restarted. Market is closed: these checks verify interval loading and recovery behavior, not live-market cadence.
