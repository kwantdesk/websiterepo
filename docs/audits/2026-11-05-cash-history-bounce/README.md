# Cash chart start boundary and cached Bounce Levels — 5 November 2026

## Confirmed candle fault

Read-only inspection of the running VPS recorder's RecordedCashHistory.load returned valid OHLC for SPY, QQQ, SPX and NDX. Twelve requests (four symbols x1m/5m/15m) starting partway through a bucket each included one legitimate opening bar before the requested millisecond. The web adapter incorrectly treated timestamp<requestedFrom as invalid candle geometry and rejected the entire response. Example: requestedFrom1793369541663, legitimate SPY1m bar1793369520000 O759.03 H759.09 L758.69 C758.75. No invalid price geometry was found in those responses.

The adapter now validates the lower bound against the same shared chartTimeBucketStartMs used by the VPS recorder. Prices are returned unchanged. Bars before that containing bucket, bars beyond the request end, nonfinite/nonpositive prices and impossible OHLC remain rejected. Original request coverage timestamps remain intact. No history downloads, repairs, injected candles or recorder changes.

## Confirmed cached Bounce race

The Chart data-application effect ran before the BounceLevelsPrimitive was attached. An already available/memoized snapshot did not change after attachment, so no second application occurred. Added chartReadyRevision to that effect, so existing data is applied on construction/reconstruction without waiting for another provider revision.

Actual Chart + Lightweight Charts + BounceLevelsPrimitive in isolated headless Chrome, synthetic cached mirror hook, external requests blocked: SPX/SPXW/QQQ/NDX preceding commitc2c0ef069eb9f59eb8243bfcc6d70ceb4c914e2e all had hasData=false/hits0. Current source: all four have data and50rendered hit records; no browser errors. Before/after fixture screenshots and JSON attached. This proves the readiness race and correction, not a live vendor-parity certification or a claim that every possible upstream failure is resolved.

## Validation and release

36 targeted history/projection/prominence/replay checks pass, including28symbol/timeframe boundary combinations (four symbols x1m/5m/15m/1h/1D/1W/1M), unchanged OHLC and rejection of invalid geometry/out-of-range bars. Scoped adapter ESLint passes. Full production build passed. One scoped main-only release is followed by exact live SHA verification. No gateway/feed/terminal restart, subscription reset or owner-tab refresh.

Browser reproduction: scripts/audits/bounce-readiness-browser.cjs, BOUNCE_READY_BASELINE=1 for pinned preceding Chart; uses existing audit Playwright/Chrome environment variables. The hook is explicitly synthetic and never imported by the application.
