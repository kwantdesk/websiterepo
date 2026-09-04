# Volume indicator vs DeepCharts audit — 2026-09-05

## Prompt

“Can you check our volume against DeepCharts? It seems off.”

## What was found

- Quant Desk displayed the candle's total volume, but coloured each histogram bar from candle direction (`close >= open`).
- DeepCharts defines its Dominant display from executed Bid/Ask delta, so Quant Desk could show the opposite meaning even where the height matched.
- A stale live React sample was prevented from shrinking total volume, but could still shrink Bid, Ask and trade-count accumulators for the forming bar. That could make its order-flow colour flicker or change incorrectly.
- Quant Desk had no working Volume controls for the DeepCharts-style background mode, delta source, or minimum displayed total.

## Fix

- Kept Rithmic reported total volume authoritative for histogram height; a valid Bid + Ask total repairs only an absent total.
- Made Dominant colour use executed Bid/Ask delta (volume or trade count), with neutral colour when side history is unavailable. Candle direction is no longer presented as order flow.
- Added Fixed, Volume slope and Price slope modes plus a minimum-total-volume control.
- Made all cumulative forming-bar volume fields monotonic across delayed samples.
- Added a deterministic regression covering heights, dominant colours, neutral missing-flow handling, side-total repair and live accumulator races.

## Outcome

The default Volume pane now follows the documented DeepCharts meaning: height is total executed volume and Dominant colour represents the aggressive side. Legitimate opening spikes are preserved rather than normalised away.

## Deliberate boundary

DeepCharts also documents proprietary Aggregate input, live-only MBO Order input, seconds-based calculation, delta ranges, absorption markers and alerts. Those are not labelled as complete here: Aggregate cannot be copied from the protected DLL, and Order must not be fabricated when historical aggressor IDs are absent.
