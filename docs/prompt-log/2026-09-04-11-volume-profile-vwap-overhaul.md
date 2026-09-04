# Volume-profile VWAP overhaul

## Prompt

> Volume profile VWAP section seems different to Deep Charts, it seems it is
> not working properly too. We do not have enable etc. This needs fixing as it
> seems it is not even working at the moment.

## Diagnosis

The renderer already understood a final VWAP line and deviation bands, but
their switches were emitted later by the generic Style generator rather than
inside the dedicated VWAP tab. The tab therefore exposed numeric values while
hiding the controls that made them visible. VWAP was also painted before all
profile bodies were known, so a later profile could cover it instead of acting
as its hard forward boundary.

## Fix

- Added a DeepCharts-style master Enable switch with independent Highlight,
  Show line, Developing VWAP and Envelopes controls.
- Added working highlight opacity/colour, VWAP line style, line colour and
  envelope colour controls to the VWAP tab.
- Removed those settings from the generic Style generator so there is one
  authoritative control for each option.
- Record and draw the cumulative live VWAP trail minute by minute without
  fabricating historical trail points that were never captured.
- Draw the final VWAP and envelopes after profile placement so they terminate
  flush with the next profile, just like POC and value-area levels.
- Migrated every daily, weekly, delta and ask/bid volume-profile variant to the
  shared v15 VWAP settings contract without turning VWAP on unexpectedly.

## Outcome

VWAP can now be enabled and configured entirely from its own tab, every
visible option changes real renderer behaviour, and the line no longer
disappears beneath a profile in front.
