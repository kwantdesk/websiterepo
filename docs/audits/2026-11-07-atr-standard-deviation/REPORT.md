# ATR and Standard Deviation loading and live delivery

## Finding and change

Both price-only studies used the delayed shared indicator candle sampler. Its live path waits 1–2 seconds and commits through a React transition, which can be deferred behind a busy chart. Neither study had the independent live pane path already used by Volume/CVD. Calculations themselves were already linear-time and require no additional market-data request.

Their initial/history calculation now reads the already loaded chart candles directly, retaining the existing 20,000-bar bound and replay cutoff. Both pass through the shared event-bar alignment mapper. Their lower panes also consume the existing chart's candle/execution events: initial hydration uses the next animation frame; subsequent live work coalesces at 100 ms, outside the parent chart's transition. This is a scheduling interval, not a measured provider-to-screen latency guarantee. Idle panes do not poll. Bursts are collected before recalculation, and short execution snapshots preserve the previously loaded history. All calculations still use the shared engine, including length, plot colours and style settings. Scope changes reset the live model; replay disables the live listener and uses the causal replay calculation.

The shared pane's integer formatter rounded small price-unit values to zero. Both price studies now use five significant digits on their horizontal/vertical axes. Flat price-study domains use relative padding rather than a minimum one-whole-point pad; other studies retain their existing formatting and padding.

No new subscriptions, provider calls, API polling, timers while idle, gateway restarts, account/order changes or owner-browser actions.

## Validation

- 82 tests pass: 68 instrument matrix cases, long-period warmup, fractional axis/domain rendering helpers, and 12 live-pane/model/hook checks (including existing Volume/CVD regressions).
- The current catalogue contains 53 futures and 15 stock/index symbols, with 50 interval presets. Of 3,400 combinations, 2,860 supported combinations pass both indicators at lengths 2, 14, 20 and 30 against independent ATR Wilder/population-deviation calculations, historical/live-model equality and replay prefix equality. The other 540 combinations remain disallowed by their source's existing capability rules.
- Settings changes, same-candle updates, execution-only event bars, source-to-chart time mapping, contract/scope reset, unmount/replay listener cleanup, and retention of earlier history are covered by the actual hook harness.
- A 20,000-bar / length-500 local calculation benchmark (10 measured iterations after warmup): ATR median 2.90 ms / maximum measured 4.81 ms; deviation median 2.58 ms / maximum measured 3.68 ms. These are local calculation timings, not live network or rendering measurements.
- Scoped lint on the hook, pane renderer and model passes. No standalone giant Chart lint was run.
- Final isolated production build (`next build --webpack`) passes, including TypeScript and route generation.

These are deterministic instrument/interval calculation and integration checks. They do not certify live provider availability for each symbol, manufacture missing recordings, or supply an unavailable feed such as VXN. Both indicators need real OHLC candles and enough bars for their selected length (default ATR 14; deviation 20). No artificial values are drawn during genuine warmup.
