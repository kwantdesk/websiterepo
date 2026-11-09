# Open trades across laptop and phone

Two confirmed code-level failure paths were repaired:

1. Account updates used transient broadcast hints and a 30-second full-snapshot fallback. A missed hint could leave a visible phone stale without any focus transition. A five-second visible-page recovery check now reads only the account row's updated_at, retrieving and merging the actual snapshot only after its revision changes. Normal broadcast delivery remains coalesced at 300ms. No per-tick account polling was added; hidden pages do not poll. Queries remain authenticated and user-filtered, with the existing private legacy-store fallback. No database schema or publication change is required.
2. A quota-refused ledger/account write announced a change, but the synchronizer and later consumers reread stale localStorage instead of the valid active state. The existing account-scoped failed-write fallback now also retains trading accounts and ledgers. Capture/upload and receiving consumers read the same value. Successful local writes supersede the fallback, changed peer storage invalidates it, and another owner cannot read it. This is memory until cloud acknowledgement; a disconnected browser closed before upload cannot promise durable recovery.

Verification:

- 55 focused tests passed, including missed notifications, initial phone hydration, unchanged revision reads, owner filters, quota-refused open position/upload/protection/close, account isolation, concurrent execution merges, stale stops and immutable exits.
- Scoped ESLint passed for all five production files.
- Full isolated Next webpack production build passed.
- Separate isolated headless Chromium contexts mounted the real workspace, trading engine, sync hook, hydration and chart rendering. With ALL broadcast notifications dropped, the phone rendered three entry/SL/TP axis labels after 5,226ms; a fresh third phone context restored the already-open trade; a phone SL edit rendered on desktop; desktop exit removed phone position levels. Normal-notification run also passed (see browser-normal.json for measured time). This checks rendered levels, not just localStorage.
- Only the database/realtime transport was mocked. These measurements are local fixture results, not a measured production network latency guarantee. The owner's actual open trade was not inspected or modified, and live provider processes were not restarted. Existing RLS and execution conflict protection remain in place.

No new service, paid upgrade, schema migration, or Vercel market-data traffic. Deployment receipt is kept locally after exact production commit verification.
