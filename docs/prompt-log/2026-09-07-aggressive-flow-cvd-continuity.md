# Aggressive-flow CVD continuity

## Prompt

CVD develops gaps and can stop working during aggressive cumulative-volume
bursts. Diagnose the actual failure, fix it across the live path, retain a
running note, push the change and verify production.

## Diagnosis

The CVD calculation was receiving an incomplete execution sequence. Both the
market worker handoff and the short chart-pane timer queue had a 25,000-record
overflow policy that silently deleted the oldest pending executions. A busy
burst combined with a slow renderer therefore removed real ask/bid flow before
it could be folded into candles. CVD correctly treated the missing aggressor
history as a discontinuity, while its continuity guard could retain the older
proven frame and make the plot appear stopped.

## Fix

- The worker now keeps one bounded structured-clone batch in flight, retains
  every later execution in FIFO order, and drains that backlog in bounded
  25,000-record chunks after acknowledgements.
- The chart pane's short execution/profile timer queues are lossless. They no
  longer delete their oldest records during bursts.
- The worker stress regression now pushes 100,000 pending records and proves
  exact, ordered, bounded delivery. CVD calculation coverage also drives 5,000
  consecutive aggressive-flow bars and proves an advancing, gap-free tail with
  the exact cumulative close.

## Outcome

Aggressive flow can no longer manufacture a CVD hole at either browser queue.
Per-message cloning remains bounded, preserving the backpressure that protects
the UI while retaining the execution sequence required for exact cumulative
delta.

## Verification

See the commit and deployment recorded in the final response for this task.
The deterministic queue, CVD calculation, CVD healing, render-continuity,
TypeScript and production-build checks were run before release.
