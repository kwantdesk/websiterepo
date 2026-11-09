# Chart responsiveness and compact Liquidity Map controls — 9 November 2026

## Chart delay
An isolated Chrome CPU profile of the actual Chart with 7,200 history bars and live study updates identified repeated native `timeToCoordinate`/time-key lookups over off-screen lower-pane history. Scale calculation and plot sampling each projected the complete data set on every live refresh. This competes with the actual candlestick update on the same browser thread.

The chart now supplies its current native visible time window. Event-bar synthetic chart seconds map back to their original execution timestamps. A binary-search slice limits rendering/scale projection to that padded window with boundary neighbours. Actual source data, calculations, recorded history, order execution, closed OHLC and session breaks are unchanged. Ordinary numerical panes in all four docking positions use this path. Table/statistics surfaces retain their existing wider label filtering.

Matched production-mode headless Chrome runs used the real Chart, 7,200 fixture bars, native chart library, live CVD/volume/study configurations, 16 ms synthetic price events and an isolated paper position. Baseline is HEAD 0f169feb with only import paths relocated for the fixture. Browser errors: zero. Over approximately six measured seconds, native candlestick series updates increased from 228 to 377; inter-update median/P95/maximum improved from 26/43/59 ms to 16/21/29 ms. These are series-update delivery measurements in a controlled workload, not proof of production network latency, canvas scan-out time or zero latency. Initial development-mode profiling showed >100 ms stalls; production-mode comparison is the quantitative acceptance evidence.

Permanent tests compare full-history versus bounded horizontal and vertical rendering for line, histogram and candlestick output, including session breaks, sparse/event timestamps, pan/revisit and missing viewport fallback. A 200,000-point series requires fewer than 750 coordinate reads instead of 200,000 with identical visible geometry. The actual Chart viewport callback is tested with clock and event-bar mappings. Existing live delivery, replay isolation, CVD, coordinate recovery and pane gestures remain passing: 35 focused tests. Scoped ESLint passes.

## Read-only live sample and limits
A bounded 15-second NQ sample from the existing VPS observed the following. No provider subscription was reset or new paid service created:

| Stream | Packets | Actual changes | Gap median/P95/max | Source age median/P95 |
| --- | ---: | ---: | --- | --- |
| Internal executions | 46 | 37 | 11 / 1421 / 4196 ms | 10 / 19 ms |
| Public executions | 44 | 35 | 13 / 1423 / 4195 ms | 11 / 24 ms |
| Public bid/ask quotes | 81 | 73 | 227 / 266 / 531 ms | 39 / 142 ms |

Streams were sampled concurrently, but connection establishment differs; packet counts do not establish loss. Current gateway health reported connected/authenticated, current event-loop lag 1 ms, not overloaded. Its lifetime maximum lag was 12,435 ms with ten guard trips; the age/source of those peaks was not established, so this does not certify peak-session server performance. A four-second gap between actual trade packets was visible in this sample while bid/ask quotes kept moving. Heatmap bid/ask motion is not equivalent to executed candle closes. The fix does not manufacture prints, change candles to midpoints or interpolate invented price movement. Owner-session performance and peak New York workload remain unmeasured.

## Compact liquidity controls
The narrow embedded Controls drawer now groups original buttons into Navigate, Chart layers, and Trading & settings. Every exposed action has a visible name, matching rounded theme-aware button geometry and preserved selected state. Duplicate compact Display shortcuts are avoided. Original DOM buttons are moved, not copied, so existing handlers and state remain attached. All buttons return to their exact original toolbar positions at desktop width. The heatmap data engine, depth, bubbles, palettes and canvas are untouched.

Actual-document isolated Chrome checks passed for all three sections/17 named controls, hidden Trade before availability, nine original handler identities, on/off class persistence, dark/light themes, desktop restoration and reopening. Zero page errors or external data calls. Screenshots attached. No owner's browser or live accounts were used.

## Release
Full isolated production build, scoped main-only Git push to the existing websiterepo-yfmi project, deployment result and exact live diagnostics SHA are required. Final production receipt is saved alongside this report after verification without a second push. No gateway, terminal or provider restart; no trades/accounts/workspaces changed.
