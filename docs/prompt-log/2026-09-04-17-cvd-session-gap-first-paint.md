# CVD session-gap first-paint artifact

## User request

Fix the CVD bug where a bar appears to connect two periods that should have a market/session gap when the chart first loads, then disappears after zooming.

## Diagnosis

- The CVD calculation already marks the first verified candle of each Chicago futures session with `breakBefore` and resets its cumulative values.
- On a zoomed-out first paint, lower-pane data is reduced into screen-pixel buckets for performance.
- The sampler keyed buckets only by pixel coordinate. If the final candle of the old session and first candle of the new session occupied the same pixel, it combined the old open/high/low with the new close into one invented cross-session CVD candle.
- Zooming separated those candles into different buckets, explaining why the false bar disappeared after interaction.

## Fix

- Made explicit series breaks hard aggregation boundaries by including a segment ordinal in every screen bucket key.
- Preserved the break marker through every later point merged into the first bucket of a new segment.
- Applied the rule consistently to CVD candlesticks, lines and histograms in bottom/top panes and side-docked panes.
- Extracted the sampler into a pure module so the actual production logic can be tested directly rather than through source-text assertions.

## Verification

- `npm run test:cvd-session-sampling` — 3/3 passed, including two sessions sharing one pixel at the initial zoom level.
- CVD divergence — passed.
- CVD divergence segments — 6/6 passed.
- CVD flow healing — 7/7 passed.
- Chart frame-work scheduling — 6/6 passed.
- CVD live execution-flow and price-scale checks — passed.
- Scoped ESLint — passed.
- `npm run build` — production compilation, TypeScript validation and all 80 static pages passed.

## Outcome

CVD can no longer manufacture a bar or line across an explicit session boundary at any zoom level. Initial load and post-zoom rendering now use the same session-safe sampling rule.
