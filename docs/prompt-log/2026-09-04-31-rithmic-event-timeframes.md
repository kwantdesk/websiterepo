# Prompt 31 — Rithmic event-timeframe reliability

## Requested

> Time frames like the 40 range don't work. They just load. So we need to fix
> this for, like, all of the features. This goes for all of the volume ones.
> We've had this problem so many times. I've asked you, like, four times now.
> So go through each one, make sure they work, all right? 40 range should go to
> Deep Charts fucking docs if you need to. Okay, 40 range loaded in, but it
> took about 20 seconds. That's not good enough. And when it does load in, are
> our volume profiles and all that going to work on it? You know, we need to
> work this out. 40 range, yeah, that's good, but make sure all of the other
> time frames are working for all of the instruments. Go through each one by
> one.

## Diagnosed

- The web server downloaded and parsed as many as 1.5 million raw Rithmic
  executions for every event-chart request. A chart could then request much of
  the same tape again for order-flow studies. That explains the 10–20 second
  cold loads, high Vercel CPU/origin-transfer usage and load amplification when
  several panes or users selected an event interval together.
- The event algorithms themselves were already deterministic, but their
  production source and first-paint path were not economical. Continuous
  catalogue symbols also needed normalising to their Rithmic product root.
- Range, volume, trade, delta, Renko, volume-bar and point/figure candles all
  require exact executions. Minute OHLC cannot safely fill a missing event
  history window.

## Fixed

- Event candles are now folded next to the recorder on the Vultr gateway. The
  website receives bounded candles plus a compact recent execution-flow tail;
  it no longer downloads millions of raw prints or starts a duplicate
  order-flow history request for the same event chart.
- Identical simultaneous requests share one gateway build, and the website's
  durable event cache shares the completed result across panes and users.
- The gateway builder supports every configured event family: Range, Volume,
  Trade, Delta, Renko, Volume Bars and Point & Figure.
- Continuous symbols such as `NQ.v.0` are reduced to the correct Rithmic root
  before the gateway request.
- The event cache generation was advanced so the deployment cannot reuse a
  stale response produced by the old path.

## Verification

- Exhaustive parity: 53 offered futures × 50 configured intervals = 2,650
  combinations. Gateway bars match the browser builder exactly, remain tick
  aligned, conserve volume and match incremental construction.
- Source/first-paint tests: 10/10 and 8/8.
- Live/archive tests: 20/20, including in-progress files, backfill/live seams,
  multi-day scans and request coalescing.
- Indicator compatibility: profile parity, Volume Profile data/level chaining,
  structure and session regressions pass on event-built candle geometry.
- TypeScript and the 80-page production build pass.
- Direct production recorder measurement for NQ 40R over ten days: 3,471,365
  executions -> 11,322 bars in 9.7 seconds on the first uncached build.
- Authenticated production browser: NQ 40R rendered candles and its Daily
  Volume Profile; a warm chart refresh completed in under one second. NQ 500V
  also rendered after its first event-history build.

## Outcome

Commit `c87fe14b` is deployed Ready on the sole production Vercel project
`websiterepo-yfmi`, and the matching gateway code is live on Vultr. The former
20-second Vercel raw-tape path is removed. A previously unseen symbol/interval
still has one recorder-side cold fold (measured at roughly 9–10 seconds for a
heavy ten-day NQ window), shown behind the chart loading state; repeat and
concurrent requests use the shared cache. Persistent precomputed event-history
indexes remain the next latency step if every first-ever combination must be
sub-second.
