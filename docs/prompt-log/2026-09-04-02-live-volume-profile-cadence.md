# Live volume profile cadence

## Prompt

> I've noticed this Deep Chart's volume profile, when price goes up to the top
> of the volume profile, it's updating, like, instantly. The volume profile is,
> like, building instantly. You can see it moving. Now ours doesn't do that,
> and it needs to do. Our volume profile right now, like, I guess updates every
> so and so, but it needs to update instantly with the candles.

## Diagnosis

The Rithmic execution stream was live and lossless, but the active volume
profile added a second one-second commit timer after the worker and pane had
already safely batched the same executions for the live candle. The candle
therefore painted first while the histogram visibly waited behind that timer.

## Fix

- The active pane now folds and commits each deduplicated Rithmic execution
  batch into its developing daily/weekly profiles in the same execution flush
  that updates the candle.
- The existing worker-side 40 ms coalescing and pane-side 40-120 ms batching
  remain in place, so every print is counted without forcing a React render per
  exchange message.
- Hidden panes retain a three-second coalesced commit. This prevents inactive
  panes in multi-chart layouts from competing with the chart being traded.
- Historical and completed profiles remain immutable through their existing
  time/session eligibility rules.

## Outcome

The visible developing profile no longer trails its live candle by up to one
second. Its newest price row, volume, delta, POC and value-area values advance
from the same execution batch as the forming candle, while the feed and UI
retain bounded work during busy market bursts.
