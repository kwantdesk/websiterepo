# Session window hand-offs

## Prompt

Session indicators were overlapping when they should not: London and New
York must hand off rather than share candles. Their settings also needed
clear independent controls so users can enable sessions and adjust clocks.

## Fix

- Replaced the overlapping stock clocks with one continuous New York
  exchange-time sequence: Asia 16:00–03:00, London 03:00–09:30 and New York
  09:30–16:00.
- Added boundary ownership in the shared session engine. Unless overlap is
  explicitly enabled, the next session start clips the prior window and its
  OHLC/high-low timestamps are recalculated from only the retained candles.
- Added independent enable and time controls to Sessions, Session Marker and
  Session Highs & Lows. Session Marker also exposes its per-session VWAP
  switches in each session card.
- Changed Session Highs & Lows London close from 10:00 to 08:30 Chicago time,
  matching its New York start. Globex remains an independently switchable
  full-session envelope.
- Added versioned migrations that upgrade former stock defaults while
  preserving deliberate saved custom clocks.

## Outcome

London/Europe and New York/USA no longer paint the same candle under stock
settings. Customisation remains available, intentional overlap is opt-in, and
focused tests cover exact hand-off ownership, OHLC clipping, migration and
settings persistence.
