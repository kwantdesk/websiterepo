# Big Contracts, Deep Contracts and Deep Effort audit

## Reference boundary

This audit used the installed licensed Deep Charts assembly and Volumetrica's
official Big Trades and Order Flow Values documentation. The installed
assembly exposes three distinct settings contracts:

- Big Trades: days/input/filter controls, marker shape and sizing, ask/bid
  colours, text, zones and alerts.
- Deep Trades: `BoxTickRange`, `MinFilterTrade`, `TickMargin`, ask/bid colours,
  display mode and projection/close-cross controls.
- Deep Effort: delta-percentage and delta-effort limits, minimum bars, average
  controls and entry-zone extension/range controls.

The protected assembly does not expose its private formula bodies. KWANTDESK
therefore matches the observable input and rendering contract, uses the
published Delta Effort definition, and keeps its own calculation transparent.
It does not claim source-code identity with a proprietary hidden algorithm.

Official references:

- <https://help.volumetricatrading.com/en/support/solutions/articles/204000012002-big-trades>
- <https://help.volumetricatrading.com/en/support/solutions/articles/204000012226-order-flow-values>

## KWANTDESK mapping

`Big Contracts` is the single user-facing indicator for execution studies:

- **Show Big Contracts** paints sized markers for filtered aggressive Rithmic
  executions.
- **Show Deep Contracts** paints price boxes centred on the volume-weighted
  executed price. Minimum size, tick height, cluster margin, opacity, border
  and projection length are real controls.
- A close-cross can terminate a projection. Full passes settle clustering;
  the live edge admits exact new executions immediately.
- Both modes use executed trades only. A candle's total volume is never
  represented as one order.

`Big Blocks` remains the separate effort-versus-result study:

- executed ask/bid dominance provides direction;
- Delta Effort is absolute delta divided by bar width in ticks;
- minimum/maximum delta percentage, maximum delta effort, minimum bars,
  average length, zone-range percentage and maximum zone extension are wired;
- the forming Rithmic candle is recalculated and painted directly into the
  canvas primitive, outside React's periodic indicator snapshot.

## Live behavior

- Big and Deep contracts consume `LIVE_CHART_EXECUTION_EVENT`.
- Big Contracts live admission retains the previously measured distribution.
- Deep Contracts live admission is O(new executions) and keyed by the tape
  watermark; the later full pass performs authoritative clustering.
- Big Blocks consumes `LIVE_CHART_CANDLE_EVENT`, whose forming bar contains the
  current executed ask/bid split. It recomputes a bounded 240-bar window and
  paints imperatively.
- Replays reject all live events.

## Remaining visual evidence

Deterministic calculation, settings, migration, build and live-path checks are
complete. A fresh interactive side-by-side screenshot sweep is still required
when safe native-window control is available. Until that is captured, call
this contract parity, not pixel-identical parity.
