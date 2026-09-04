# Prompt 36 — Chart interaction smoothness

## Requested

> Let's try and get the chart smoother. I'm not sure how. Right now it's pretty smooth with all these indicators. Right now I've got footprint, imbalance tracker, VWAP, both volume profiles, CVD, IB levels, zero gamma line, which we still need to fix. I think you might have fixed it already, big blocks, session highs and lows, and it's pretty good. But actually, it's pretty good. It just, there could be a bit better, you know, interaction on the UI, so that it's, like, more smooth on the graphs, and that we don't have any, like, delay or anything when I'm moving around the charts and the graphs and on the footprint and I'm dragging and stuff.

## Diagnosed

- Footprint kept half a screen of prefetched bars but still waited 120–180 ms
  after viewport activity before asking to use them. A quick zoom could outrun
  its retained window, while an ordinary pan performed work it did not need.
- Professional drawing changes exported and JSON-compared the complete drawing
  collection and reconciled the large Chart component on every drag sample,
  even though the drawing primitive already moved directly with the pointer.
- Magnet hit testing claimed to inspect nearby candles but actually projected
  every candle in the loaded history on every pointer sample. That cost grew
  linearly as more institutional history was loaded.

## Fixed

- Footprint now pans natively inside its prefetched coverage. It rebuilds only
  when the viewport approaches a retained edge, coalesced by the shared chart
  frame queue, with no trailing human-visible timer.
- Drawing geometry still paints imperatively on every animation frame, while
  React persistence/history updates are coalesced during the gesture and
  flushed immediately on mouse release.
- Professional drawing magnet candidates are now bounded to the logical bars
  inside the pointer's pixel radius and use the current candle ref. The cost no
  longer grows with the full history, and newly arrived bars remain snappable.
- Calculation cadence and data inputs were not reduced. Footprint, profiles,
  CVD, Imbalance Tracker, VWAP, Zero Gamma and the candle feed retain their
  existing accuracy paths.

## Verification

- New chart interaction budget regressions: 4/4 passed.
- Shared chart-frame scheduler: 6/6 passed.
- Drawing anchoring: 7/7; handle grabbing: 10/10; magnet integration and
  behavioural suites: passed.
- Footprint viewport/window/detail/flow suites: 20/20 relevant assertions.
- Imbalance Tracker authoritative fixture: passed.
- VWAP family: 9/9; Volume Profile zoom/live fold: passed.
- CVD settings parity: 9/9; Zero Gamma and session highs/lows: passed.
- Live chart memory guard: passed 476,304 incremental updates with bounded
  replacement behaviour.
- Busy Volume Profile fixture: about 2.15 ms per update for seven profiles and
  16,000 price levels.
- TypeScript and the production Next.js build: passed.
- The older `test:overlay-in-frame` source-shape check remains stale against an
  already-changed DrawLayer transform implementation; this task did not touch
  that file, while its current anchoring suite passed 7/7.

## Outcome

Loaded charts now spend less main-thread time rebuilding Footprint data and
serialising drawings while the trader pans, zooms or drags. Visual movement
stays on the native/imperative paint path, final drawing state is saved on
release, and the market-data and indicator calculation contracts are unchanged.
