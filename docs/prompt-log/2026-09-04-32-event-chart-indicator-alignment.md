# Prompt 32 — Event-chart indicator alignment

## Requested

> I'm on a 500 volume, and a lot of the volume profiles and stuff didn't work
> properly, and don't work properly when I come on this. So we got to make
> sure, like, volume profiles and all of that, they work on this, whether
> that's daily, weekly, whatever. Any indicator that's on my chart, even like
> CVD and everything, should be correct when I load onto a different time
> frame or volume chart or whatever it is.

## Diagnosed

- The recorder and event-history endpoint were returning complete execution
  flow: the live NQ 500V sample had 3,773 candles, 3,773 flow candles and
  9,408 compact executions from 1,748,836 source records.
- The failure was in browser rendering. Event candles receive unique synthetic
  chart times because many volume/range/trade bars can close within the same
  wall-clock second. Indicator alignment instead keyed those candles by whole
  seconds, so every bar but the last in a busy second was overwritten and most
  CVD, Volume and technical-study points were discarded.
- The alignment memo could also run before the main price series had installed
  its source-time map, then remain empty until a later live candle caused a
  render. That produced delayed or apparently intermittent indicators.

## Fixed

- Event indicators now map exact source milliseconds to the same unique chart
  slot as their price candle. A whole-second fallback is allowed only when the
  second contains exactly one candle; ambiguous seconds never select an
  arbitrary bar.
- The map recomputes as soon as the price series is ready, so indicators render
  on first paint rather than waiting for the next event-bar close.
- CVD bars/divergence and delta highlights retain exact event timestamps instead
  of collapsing simultaneous event candles to one second.
- The solution is generic across Volume, Range, Trade, Delta, Renko, Volume Bar
  and Point & Figure charts and therefore applies to Daily, Weekly, Composite
  and Fixed Volume Profiles, CVD, Footprint and ordinary pane/overlay studies.
- The event-history production probe now reports flow-candle coverage directly.

## Verification

- A dedicated regression creates 120 separate 500V candles inside one second
  and proves Volume, delta bars, every CVD display, moving average, ATR and VWAP
  retain every point and align to unique price-bar slots.
- The regression also prevents removal of the first-paint lifecycle dependency
  or restoration of the faulty second-keyed map.
- CVD divergence/session sampling, Daily/Weekly/Composite Volume Profile,
  Volume Profile session/structure/data parity, Initial Balance, Footprint flow
  coverage and Footprint chart-type suites pass.
- TypeScript and the 80-route production build pass. Scoped ESLint could not
  complete because its type-aware project load exhausted an 8 GB Node heap.

## Outcome

High-frequency event bars and their indicators now share one exact, collision-
free time axis. The fix does not invent order flow: an indicator requiring bid/
ask executions still shows only verified recorder/history coverage and keeps
real gaps explicit.
