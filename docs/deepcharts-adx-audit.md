# Average Directional Index (ADX) — 2026-09-06

## Reference and limits

Official reference: https://www.deepcharts.com/helpcenter/article/average-directional-index
lists period (typically 14), main line colour/style/width, +DI and −DI colours.
The local DLL public-method search found `IndicatorDescriptions.get_ADX` but
did not identify an unobfuscated executable calculator or its seed convention.
No protected algorithm, exact vendor defaults or side-by-side parity claimed.

KwantDesk uses explicit Wilder smoothing: seed TR and mutually exclusive +DM /
−DM with the first N changes; DI begins after N changes. Seed ADX with the first
N DX observations, then apply Wilder recursion. The first ADX is at candle
index 2N−1. A flat denominator produces zero; equal positive high/low expansion
produces neither directional move. This seed convention is recorded because
implementations with a different initial seed can differ near the history edge.

## Implementation

- `average-directional-index-adx` now has its own calculator and real three-line
  pane, not a renamed ATR or RSI. O(n), constant rolling calculation state plus
  the plotted output; no extra feed or vendor calls.
- Default period 14; adjustable 1–1000. Main/+DI/−DI colours follow theme unless
  customized. Line width 1–4, solid/dashed/dotted; independently hide +DI/−DI.
- Input is genuine OHLC, so futures, equities and price-only cash indices can
  use it without fabricated trade volume. Event display timestamps retain
  millisecond distinctions. Replay uses only the candle array supplied by its
  host; the calculator reads no current wall time or future bars.
- Invalid bars reset warmup and mark the next output as a discontinuity. A
  valid market-closure time gap preserves the standard previous-close true
  range calculation; no synthetic intervening candles are inserted.
- Pane remains labelled ADX during warmup, with an explicit waiting message
  when no directional values are available; no fake startup values.

## Verification

- Eight tests: full seed windows, hand-calculated mixed-direction fixture,
  flat/tied movement, invalid/gapped data, event timestamps, settings and saved
  normalization, disabled plots, period changes, theme ownership, forming-bar
  updates and output ordering. Existing registry/profile/Absolute Levels tests
  included in the combined regression run.
- Actual browser QA: local synthetic fixture, real ChartIndicatorsControl and
  ChartIndicatorPanes. Three lines/legends render. Changing period 14→5 changes
  geometry, selecting Dashed changes the visible strokes, hiding +DI removes
  its plot and legend. Save immediately clears dirty state; closing does not
  ask again. This is not an authenticated cloud-template or live-market soak.
- Local 5,000-bar calculation benchmark: 30 measured runs after 10 warmups,
  median 0.968 ms, p95 2.008 ms. These are Node calculator timings, not browser
  frame times, full-workspace latency or a concurrency capacity claim.
- Isolated QA: `node scripts/serve-indicator-preview.mjs`, then open
  `http://127.0.0.1:3117/?indicator=adx`. No trading connection is made.

Outcome: executable ADX with documented seeding and reference limitations.
Full indicator-library goal remains unfinished.

Release checks: 34 targeted tests passed (31 calculation/profile tests and
3 catalogue-registration tests); scoped ESLint passed; production build passed
including TypeScript and all 80 static pages. Deployment still requires exact
commit verification after the main push.
