# CVD periodic disappearance and malformed bars

## Owner prompt

> cvd bugs out, every certain amount of time it glitches away then comes back,
> then there is a glitch where it looks wrong and does not display the correct
> bars. Fix the recurring bug and keep a list of anything not fixed.

## Diagnosis

Two lifecycle races combined into the reported symptom:

1. The recurring flow-heal can correct bid/ask values inside an existing candle
   array without changing its length or first timestamp. Chart sampling treated
   that authoritative correction as a delayed routine sample, allowing an old
   CVD snapshot and corrected flow to appear in adjacent paints.
2. While the native price series installed the corrected time map,
   `timeToCoordinate` could briefly return `null`. The pane discarded every CVD
   point for that paint, recalculated against an empty domain, then returned on
   the next paint. A partial coverage snapshot could likewise replace a fuller
   proven frame and show newly fragmented or truncated bars.

The CVD calculation's existing data-integrity rule remains unchanged: genuinely
missing aggressor history is omitted and starts a new cumulative segment. No
OHLC direction or zero delta is fabricated.

## Fix

- Compare every candle field consumed by indicators so same-shape history/flow
  corrections take the immediate atomic hydration path.
- Cache only proven time coordinates inside the current
  instrument/timeframe/replay scope. A temporary native-map outage reuses them;
  any scope change clears them synchronously.
- Keep the last complete CVD frame if a same-scope reconciliation becomes
  empty, loses more than five percent of its verified bars, moves its tail
  backwards or adds unexplained breaks at the same endpoint. The pane labels
  this exceptional state `SYNCING EXECUTIONS` while awaiting the corrected
  frame.

## Verification

- New CVD render-continuity tests: 3/3 passed.
- Combined lifecycle/hydration tests: 14/14 passed.
- CVD candle direction: 5/5 passed.
- CVD settings parity: 9/9 passed.
- CVD divergence segments: 6/6 passed.
- CVD flow heal: 7/7 passed.
- Scoped ESLint passed for the pane and new support modules. Running ESLint on
  the repository's unusually large `Chart.tsx` exhausted Node at both 4 GiB and
  8 GiB; TypeScript and the complete 80-page production build both passed and
  compile that file.

## Outcome and unfinished work

CVD no longer deliberately publishes a blank/regressed intermediate frame
during its periodic reconciliation. The durable remaining-work list is
`docs/IMPORTANT-NOTES.md`; for this change, the remaining item is a live US
session soak through a full four-minute flow-heal cycle on time and event bars.
