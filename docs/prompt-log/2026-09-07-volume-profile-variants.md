# Prompt / outcome — remaining volume-profile variants

## Prompt

Finish the indicators still shown as Pending, using the DeepCharts reference
and licensed DLL evidence, with working logic, settings, data, rendering,
themes, persistence and performance rather than merely changing the button.

## Fixed

- Added Monthly Volume Profile with exchange-calendar monthly ranges.
- Added Session Volume Profile with DST-aware RTH, ETH, custom and three-desk
  session ranges.
- Added Visible Range Volume Profile driven by the actual logical viewport and
  exact event-candle source bounds.
- Reused the validated exact volume-at-price engine and complete shared profile
  editor. Added per-instance ownership, cache-first bounded requests, stale-job
  cancellation and live exact-execution top-up.

## Outcome

The automated catalogue audit reports 126 total, 126 registered and 0 pending.
Focused profile/catalogue tests, shared template tests, theme tests, TypeScript
and lint pass. Incomplete prior-contract history and unsupported disjoint
Monthly/Visible filters fail closed instead of drawing false profiles.
