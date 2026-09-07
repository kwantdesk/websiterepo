# Liquidity-map bubble anchors

## Owner prompt

> The bubbles on LIQ MAP need to be fixed to where they appear; currently they
> are moving around.

## Diagnosis

Two independent render behaviours could move a previously displayed bubble:

1. Smart clustering used a weighted average of every nearby execution's frame
   and price. A later execution therefore changed an existing cluster's centre.
2. The 100 ms performance cache retained absolute array indexes. When the
   fixed-capacity history shifted, those indexes briefly referred to different
   columns before the cluster rebuild completed.

Neither problem came from Rithmic trade prices or timestamps.

## Fix

- Every raw execution group now retains its real frame, timestamp and price as
  an immutable anchor.
- Merged smart clusters keep the earliest constituent execution anchor. New
  nearby trades update size and bid/ask composition without moving that anchor.
- The renderer resolves the anchor frame in the current rolling history on
  every paint. A rolled-off frame is omitted rather than drawn at a stale index.
- All liquidity-map ES-module URLs were advanced together to
  `20260907-bubble-anchors`, preventing a mixed old/new browser module graph.

## Verification and outcome

- Bubble-anchor regressions: 2/2 passed.
- Liquidity-map performance and rollover suite: 10/10 passed.
- Static module cache-busting: 5/5 passed.
- Inside-market regression: 6/6 passed.

Outcome: a bubble remains attached to the execution price/time at which it
first appeared. Normal chart pan, zoom and auto-centre still transform the
whole market coordinate plane; the bubble moves with its true coordinate, not
independently of it.
