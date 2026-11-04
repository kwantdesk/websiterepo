# Indicator-heavy chart duplication

Owner report: duplicating a heavily configured chart can freeze the page until refresh.

## Changes

The duplicate path previously copied pane/indicator settings but started data restoration from scratch. A second chart could re-read IndexedDB, merge/sort execution tapes, sanitize history, retrieve the same completed history response and recreate its indicators while the original remained live.

Docked and floating duplicates now request a one-shot memory seed from their mounted source. Only settled, hydrated, non-replay sources supply it. The receiver verifies the exact chart request identity and resolved contract. Candle objects and the execution array are copied, keeping each pane's working geometry independent. Ticks received during mounting are merged using the existing live-authority functions. The receiver skips redundant initial history restoration and, when inherited flow is ready, initial flow reconstruction. Existing live subscriptions, tail-repair callbacks and periodic integrity checks remain active. Replay, unmatched and unready sources retain the ordinary loader.

The memory transfer is consumed and discarded at hydration; pending transfers are capped at eight. Mounted source providers unregister safely. Charts/GEX Vue/Algo instance identities remain distinct. No saved configuration, indicator enabled state or history depth is reduced.

Completed decoded order-flow/history results can also be reused for ten seconds. This cache is bounded to four entries and 120,000 records/candles, separates contracts/depth/replay scope, and does not cache failures or empty responses. Live updates still come from the live stream.

An initial attempt to stagger study construction did not improve the measured workload and was removed. No gradual enabling/disabling of copied indicators ships in this change. Chart.tsx is unchanged.

## Verification and limits

- 40 focused checks pass, covering the seed store, actual Workspace snapshot provider/candle independence, actual history decoder coalescing/expiry/retry/identity isolation, account sync and replay drawing preservation.
- Scoped utility ESLint passes. Full Next.js production build passes.
- Actual Workspace/Chart in isolated headless Chromium: 23 enabled studies, generated candles and a 25,000-print execution fixture. Duplicate renders both charts without refresh, retains every study/configuration with independent instance IDs, keeps the source canvas connected, and allows the page heartbeat to continue. After advancing the isolated test clock by one minute to expire ordinary cache freshness, the control repeats two base 5m history requests plus one auxiliary 1m request; the fixed path repeats zero base requests and only the auxiliary request. External network is blocked; no real orders/accounts are changed.
- A negative control substitutes no seed and no completed-history cache, allowing comparison using the same UI/data fixture. Browser harness and stubs are in scripts/audits/chart-duplicate-*. In the captured comparison, the page heartbeat advanced 34 times during the fixed observation versus 14 in the negative control; timing is environment dependent. Development-render timing is not a production latency promise.
- The permanent refresh-only lockup was not reproduced in this isolated fixture. The removed duplicate preparation work is verified; this does not claim that every possible study/provider/browser-specific freeze has been reproduced or eliminated.

No VPS/feed/terminal restart, subscription reset, production trading-tab refresh, new dependency or Vercel data-stream traffic. Release through the existing main-only integration and verify the exact live commit.
