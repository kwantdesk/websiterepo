# Fixed range volume profile — VAH and VAL

## Prompt

The drawn/fixed volume profile looked good but only showed its point-of-control line. Add value-area-high and value-area-low lines, and make sure the double-click settings expose the profile controls expected from the Deep Charts reference while preserving KwantDesk's additional adjustments.

## Fix

- Traced the live left-rail drawing path to `ChartDrawLayer`; its calculator already returned `vahHigh` and `valLow`, but the renderer discarded them.
- Drew VAH and VAL from the same profile spine to the same selected range edge as POC, using the already-calculated value-area boundaries.
- Added VAH and VAL labels, governed by the existing label switch.
- Added saved controls for showing VAH/VAL, POC colour and width, and VAH/VAL colour and width.
- Kept missing `showValueAreaLines` values enabled so drawings saved before this change gain the two lines automatically.

## Outcome

A newly drawn or previously saved fixed/anchored volume profile now shows POC, VAH and VAL by default. Double-clicking it allows each level family to be shown and styled without changing the histogram calculation or removing KwantDesk's existing row, value-area and width controls.
