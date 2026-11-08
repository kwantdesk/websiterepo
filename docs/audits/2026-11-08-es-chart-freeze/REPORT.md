# ES pane addition: main-thread calculation repair

Owner reported a website freeze after adding ES alongside NQ with many studies. No owner browser, orders, workspaces, provider subscriptions or gateway were changed or restarted.

## Findings and change

A separate headless browser mounted the actual Chart component with 5,000 candles and 250,000 exact execution fixtures per instrument. Profiling found synchronous TPO historical builds, repeated timezone/session formatting and unnecessary tape-key construction/sorting during an empty Big Contracts archive merge.

- Live TPO builds now run in one shared module worker. Numeric buffers are transferred rather than cloning hundreds of thousands of objects. Each study retains only its newest queued input. Removed studies discard callbacks; changed symbol/settings scopes reject stale results. A failed worker releases the queue, and idle workers expire.
- Existing completed profiles stay visible while their developing profile calculates. Source calculations, replay clipping and composite-profile semantics remain intact. Replay and composite merges retain their existing synchronous implementation; this release does not claim those paths are fully asynchronous.
- Daily/single-week/generic TPO period resolution reuses the previous valid boundary instead of recalculating it per execution. Overlapping multiweek boundaries retain the original lookup.
- Session studies use the shared exchange-clock minute cache. Empty Big Contracts archive merges retain execution multiplicity and sorting semantics without rebuilding string keys.

## Verification

- 23 focused tests pass, including new worker queue/coalescing, stale-result, unmount, failure and transport tests.
- 7 existing session tests pass.
- 30 exact before/after TPO comparisons pass across five zones, DST, midnight, weekends, partial-second session boundaries and overlapping weeks; packed-worker round trips produce the same profiles.
- Session results match exactly across 14,400 candles and four configurations spanning DST.
- Scoped helper lint and complete isolated production webpack build pass, including TypeScript.
- Actual two-chart headless development fixture: no page errors, 18 canvases. Initial baseline ES-mount stall approximately 891 ms. Optimized measurements varied from 325 ms to 554 ms; final fixture includes a corrected IB indicator identifier. These are development stress observations, not a controlled production latency SLA or proof of the owner's full live incident. The final test still has a noticeable one-time mounting pause, so zero blocking is not claimed.
- Existing TPO catalogue source-pattern test expects the removed TPO Levels indicator and fails independently of this repair; no removed indicator was restored to satisfy it.

No extra paid calls or per-panel polling were introduced. This is a frontend calculation repair, not a provider throughput or VPS change. Production activation must be verified separately using the deployed commit and worker asset.
