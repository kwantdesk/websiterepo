# Prompt / outcome — On Candle Stats

## Prompt

Continue engineering every Pending DeepCharts-referenced study with correct
logic, settings, data, visuals, theme behavior, persistence and performance.

## Fixed

- Added a dedicated on-candle text renderer without altering the existing
  KWANT Stats pane.
- Wired all public volume/delta/trade/extension/COT/ratio subgraphs and data,
  text, color and price-placement controls.
- Corrected Aggregate Volume filtering to use contract volume; Order uses
  trade count.
- Added ordered-execution, persistence, settings and renderer-gate tests.

## Outcome

On Candle Stats is genuinely addable. The catalogue is now 127 total, 119
registered and 8 pending. Sequence-dependent values remain blank when exact
executions are unavailable.
