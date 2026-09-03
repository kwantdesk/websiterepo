# Remove VWAP price-scale tabs

Date: 2026-09-04

## Prompt

> remove the price tabs on vwap and vwap envelopes all of that

## Diagnosis

The generic overlay-series renderer shows a last-value tab unless an indicator
plot explicitly opts out. VWAP, all six VWAP Envelope bands, Rolling VWAP and
all six Rolling VWAP bands inherited that default, crowding the chart's right
price scale with anonymous coloured values.

## Fix and outcome

- Disabled last-value price-scale tabs on the session VWAP line.
- Disabled them on every upper and lower VWAP Envelope line.
- Applied the same rule to Rolling VWAP and all of its envelopes.
- The plots remain visible and continue participating in the price scale;
  only their right-axis tabs are removed.
- Anchored VWAP, profile VWAP and Footprint VWAP are custom canvas/SVG plots
  and do not create Lightweight Charts price-scale tabs.

## Verification

- Added a regression that calculates VWAP, VWAP Envelopes and Rolling VWAP and
  requires every generated plot to opt out of last-value tabs.

