# Shared GEX Data delivery repair — work in progress

This is implementation evidence, not a live parity pass. The catalogue tally remains 2 failed live comparisons, 5 missing/unsupported, 29 pending until new matched observations establish otherwise.

The measured panel path refreshed roughly every31–33seconds. New delivery uses authenticated exact-selection five-minute leases, browser-to-VPS SSE, and a demand-only pool sharing the existing vendor cache, in-flight ownership, account-wide scheduler and raw response archive. Changed payloads only generate a new revision. Retrieval timestamps are explicitly not exchange timestamps. No private dashboard session token is copied or used.

The pool permits at most one new acquisition start per second across all selections and two in flight. Identical selectors share acquisition. Different tickers/filters stay isolated. Existing global provider limits, low-headroom pacing and Retry-After remain authoritative. Small active selections target two-second acquisitions; this is not a promise of two-second cadence across the catalogue. Cache joins are free of additional upstream acquisition. Closed/hidden consumers release demand. Historical/pinned requests acquire once.

Paginated Consolidated/Unconsolidated Order Flow, Equity Prints, Exchange Notifications, Open Interest Change and News retain finite REST requests pending page-retention audit. Large selection bodies also retain finite REST. These are explicit limitations, not completed cadence repairs.

Validation:39 focused runtime tests passed, covering real HTTP SSE lifetime/disconnect, browser ticker switching and cancellation, canonical coalescing, stale response rejection, bounded capacity, retry holds, lease authentication, wrong-origin/tampered/expired tickets, named-event forwarding and renewal. Broader existing budget/vendor suite:32/33 passed; the unchanged source-pattern check expects the removed CashIndexArchiver constructor and fails against the baseline too. Full isolated Next webpack production build passed, including TypeScript and87 pages. Scoped ESLint passed.

Production activation and live timed retest are still being performed. Do not describe this file as completed parity.

VPS activated with backed-up, scoped runtime patches and two additional read-only module mounts. Initial production probe exposed an overly strict admission threshold (two queued requests); corrected to preserve24/32 queue headroom while the pool itself contributes at most two pending requests. Corrected45-second real production-edge probe: 21 changed frames, median 2025ms, maximum 4296ms, first frame 462ms, no feed-error events; wrong origin401. Closing the probe releases demand. This is transport evidence, not numerical/visual source parity. Browser activation is pending the scoped Git deployment.
