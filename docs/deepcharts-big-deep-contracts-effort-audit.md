# Big Contracts, Deep Contracts and Deep Effort audit

## 2026-10-19 — Big Blocks lifecycle correction

Owner clarified: preview immediately on the forming candle; withdraw if it
stops qualifying; freeze a qualifying final candle's block without later
sampled passes adding signals several bars late. This is the acceptance
contract requested by the owner, not newly established vendor runtime evidence.

An older anti-flash patch latched every forming signal until a newer sampled
bar arrived, including failed previews. Replaced that latch with per-chart
live decision authority; flush the final pending observation before accepting
a next-bar event, freeze confirmed origin/side/bounds and negative decisions,
and retain legitimate history/backfill for unobserved gaps. Projection right
edges can still expire/cross-terminate. Normal intrabar work stays frame-bound.

Fresh REA static inspection of installed `Deepchart.dll`16.0.9.0 (.NET10),
SHA256 `d8366c8312ab71f1706dea8a2a0046eb620eac4497fb2acf595946f381f3d9b6`,
returned partial managed metadata: duplicate Module/Assembly rows and unknown
MVID. Parent Evidence `ev_35948328417da1c1fbec3727d8e4b2cda1d3cbcfaa5eedb1fa61498baa8cd4c4`,
summary `ev_ee03f390f440e5d8fb5ef236d4659169a581e7d0faf7d19141dd055501539f3a`.
This did not execute/decompile the private formula or observe its bar-close
behaviour. Official https://www.deepcharts.com/pricing/deepchart describes
DeepM Effort NQ as proprietary, not a public calculation specification. Search
did not supply an authoritative live-confirmation formula. No licensing or
protection bypass was attempted. Do not claim exact vendor math/pixel parity.

Record/tests/production identity:
`docs/prompt-log/2026-10-19-big-blocks-live-lifecycle.md`.

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
