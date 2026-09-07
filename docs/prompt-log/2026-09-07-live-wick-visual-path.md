# Live wick visual path

## Prompt

> there was a quick wick a big one and when it visually appeared it jumped and
> didnt show an annomation of the candle forming... just jumped from one to the
> other wick and like hit my sl/tp without even moving through just jumped

## Diagnosis

SL/TP processing already consumed every accepted live quote immediately and
correctly detected a real crossing. The chart took a different path: all quotes
inside one browser frame were compacted to first/low/high/last, but those four
points were returned in that fixed order rather than their real arrival order.
The workspace then folded them into one final candle and emitted only that last
snapshot, while the chart renderer separately collapsed repeated events into a
single pending frame. A fast out-and-back wick therefore reached protection
logic but appeared visually as one teleporting candle update.

## Fix

- Intraframe compaction now retains first, high, low and last observations in
  their original chronological order.
- Time-candle aggregation now emits each retained real candle state, including
  the genuine wick excursion and return, rather than only the final aggregate.
- The chart renderer paints a bounded queue one state per display frame. It
  keeps at most four states to prevent burst backlog and never interpolates or
  invents prices that were not received.
- SL/TP and paper execution remain on the immediate raw quote path; visual
  smoothing cannot delay, suppress or manufacture an execution.
- Event bars and Heikin Ashi retain their separate calculation rules.

## Verification and outcome

- Live wick-path regression: 8/8 passed, including a 100 → 110 → 90 → 100
  out-and-back burst and bounded queue behavior.
- Live candle authority: all 19 clock intervals passed.
- Paper protection crossings: 8/8 passed.
- Paper limit/SL/TP fills: 8/8 passed.
- TypeScript passed.
- Outcome: a fast real wick is now shown as its real retained price path over
  successive display frames while protection still reacts immediately.
