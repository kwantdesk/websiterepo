# KWANT Profile Values overhaul — 2026-09-07

## Owner prompt

> sort out value area levels in the indicators, we did alot of adjusting in
> our standard volume profile value areas so we need to update this so you can
> put in all of your settings etc nad hvae accurate levels with choices all of
> them

## Root cause

The level-only `KWANT Profile Values` study already called the shared corrected
value-area calculator, but its own presence was missing from the condition that
activates exact Footprint/VAP rows. It could therefore wait or render nothing
unless a different order-flow indicator happened to activate that source.

Its saved settings also lagged behind the standard profile: one width controlled
every level, developing value area was only a boolean, and label position and
line pattern were hard-coded. The frame builder removed missing VAP bars before
forming periods, which could make separated exact regions look continuous.

## Fixed

- Profile Values now activates its own exact Rithmic volume-at-price source.
- POC, VAH and VAL remain calculated by the same shared routine used by the
  standard Volume Profile, with the configured grouping and value-area percent.
- A positive-volume candle without an exact price ladder invalidates its
  profile range; a real zero-volume bridge remains allowed.
- Added independent POC, VAH/VAL, peak, valley and VWAP widths.
- Added developing VA Off/Dashed/Solid, five level line patterns and label
  placement beside the source or at the line end.
- Preserved existing saved studies by migrating their shared width and old
  developing-VA switch into settings schema v2.
- Made Aggregate Trades combine same-time/price/aggressor fragments before its
  size filter, while Volume keeps per-print filtering.

## Outcome

The standalone indicator can now calculate without another study being open,
uses the corrected standard-profile value-area answer, exposes the full level
presentation choices, and refuses to display authoritative-looking levels over
missing positive-volume data.

Focused coverage verifies calculation parity, settings migration, source
activation, missing-data refusal, zero-volume bridges, aggregate-trade behavior,
developing trails and the 20,000-bar performance case. Shared numeric sliders,
templates/theme checks, scoped lint and TypeScript are part of the release gate.
