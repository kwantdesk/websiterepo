# Real-time replay speed — 2026-10-25

Owner wants 1x to mean real-time elapsed playback rather than candle stepping/jumps.

## Changes

- Shared Charts/GEX Vue replay defaults to 1x, labelled `1× · Real time`. The old default was 10x although its menu did not contain 10. The menu now includes 0.25x, 0.5x, 1x, 2x, 5x, 10x and the existing faster choices, with enough trigger width for the label.
- Shared frame-aligned ticker publishes at a bounded 100 ms UI cadence using actual monotonic elapsed time. It neither advances one candle per callback nor interpolates fake prices. Old Charts cadence was 200 ms; Backtesting already used 100 ms but discarded elapsed time beyond 500 ms. That truncation is removed.
- Both callers pause when the browser document is hidden, with listener/frame cleanup. Returning to a throttled background tab cannot catch up by jumping minutes. Section pause, manual stepping, scrubbing and end limits remain independent controls. Speed changes reinitialize the ticker at the current replay position.
- A plain CME replay requests executions through its existing history request even without an order-flow indicator. Previously the forming-candle tape was empty unless CVD/another study happened to require it. No extra per-clock HTTP requests, subscriptions, polling timers or gateway changes.
- Backtesting also offers slower speeds and explicitly labels its 1x choice as real time.

## Verification / limitations

- 194 focused/adjacent tests pass, plus the existing GEX Vue replay script. New deterministic scheduler tests cover irregular callbacks, exactly60 seconds at1x, slower/faster rates, delayed frames, disposal/hidden pause and clock/end limits. Candle fixture confirms only timestamp-eligible recorded prices are revealed, never interpolation or final future OHLC.
- Scoped scheduler/state/Backtesting ESLint and final local production build/TypeScript pass (84 pages). Full monolithic Chart/workspace lint and signed-in motion/performance soak are not claimed.
- This fixes playback-clock/control behavior. Exact tick-for-tick visual reproduction still depends on complete timestamped recordings. The existing history tape can be sampled/sparse; minute-only or missing source observations cannot honestly become millisecond price movement. No source-completeness, all-indicator or vendor-parity certificate is implied.
- Prior historical archive/adapter gaps remain open. Twenty current-only indicators remain unavailable in replay. No production commit/push: deployment remains pending explicit owner approval after the earlier safety-review rejection.
