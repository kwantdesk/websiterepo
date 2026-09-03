# 2026-09-04 — 02 — Rithmic cadence and live-chart refresh regression

## Prompt (verbatim)

> what with teh rithmic feed lagging and not ticking like it used to do, its fucking slow as shiut and takes ages to u[pdatyed, what did youd o? chart also keep randomyl refre4shing???

## Diagnosis

The volume-profile cost containment did not alter Rithmic quote cadence. A
direct 12-second production-path sample delivered 92 genuine NQ/ES packets at
an average 117 ms inter-packet gap. Two client faults sat after that healthy
stream:

1. The continuity watchdog put the full loading cover back over an already
   settled chart whenever it detected a late or missing closed bucket. The
   recovery request continued in the background, but the visible cover made
   the live chart look as if it randomly refreshed and hid fresh ticks.
2. The global stream effect was enabled for GEX Map, but a nested dispatch
   guard omitted `gexmap`, so futures packets could update the watchlist while
   failing to reach chart panes mounted inside that workspace.

## Fix and outcome

- Initial instrument/timeframe hydration remains atomic and covered until
  verified. Once a chart is settled, continuity repair is now silent and
  in-place: live Rithmic packets continue painting while the missing history
  seam heals.
- Added GEX Map to the inner shared Rithmic packet dispatch guard.
- Kept genuine execution-only candle movement intact; BBO-only packets are not
  allowed to fabricate candle wicks.
- Added focused regressions preventing runtime recovery from reintroducing the
  loading refresh and preventing GEX Map from dropping Rithmic chart packets.

## Verification

- Direct stream sample: 92 NQ/ES packets / 12 seconds, 117 ms mean gap.
- Chart hydration cover: 6/6.
- Live market routing regression passed.
- Rithmic candle integrity: 53 instruments x 50 intervals = 2,650 combinations.
- Scoped ESLint: zero errors (20 existing warnings in the large workspace).
