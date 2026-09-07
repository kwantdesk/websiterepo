# Liquidity-map live frame pacing

## Owner prompt

> Liquidity map seems to stutter. It is not smooth and sometimes hangs for a
> few seconds. Fix this.

## Diagnosis

The live feed was not being throttled or paused. Two synchronous main-thread
jobs were competing with the 20 FPS canvas path:

1. Every ordinary paint called the complete order-flow analyzer. When trades
   changed, it sliced, flattened and recalculated all 1,800 retained frames at
   200 ms intervals even though the Signals inspector was closed. The canvas
   only used its CVD result, despite already owning incremental session CVD.
2. Bubble refresh repeatedly sorted and merged the complete visible execution
   set, for up to 20 passes. At dense open-like traffic one pass occupied the
   main thread for hundreds of milliseconds and generated substantial garbage,
   producing longer periodic garbage-collection pauses.

## Fix

- Ordinary canvas paints now receive only the incremental session CVD. The
  complete order-flow calculation remains available on demand to the Signals
  inspector and is no longer part of every map frame.
- Nearby bubbles are grouped through a screen-space spatial index rather than
  repeated full-array sorts.
- Dense views increase visual aggregation only when more than 2,500 raw groups
  are present. Execution totals, side composition and immutable real anchors
  remain exact; the level-of-detail change affects only how many overlapping
  spheres are painted.
- After the first cluster build, an overlapped tail is recalculated and settled
  clusters are retained by frame identity. This prevents historical executions
  from being rescanned whenever a new book frame arrives.
- The complete static module graph was cache-busted together as
  `20260907-frame-pacing`.

## Verification and outcome

- Synthetic dense-open fixture: 90,000 executions. The initial full build took
  161.7 ms behind initial loading; recurring five-frame update took 13.2 ms.
  The former recurring full build measured approximately 158 ms at the same
  50 executions per frame density.
- Liquidity bubble, performance and rollover tests: 12/12 passed.
- Module cache-busting: 5/5 passed.
- Inside-market regressions: 6/6 passed.

Outcome: live depth and execution ingestion remain truthful and unchanged,
while ordinary map frames no longer wait behind full-session analysis or
full-history bubble reclustering. Representative active-market visual soak is
still required and remains in the important-notes ledger.
