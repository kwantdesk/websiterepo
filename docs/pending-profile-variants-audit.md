# Pending profile variants — in progress, not released

## Reference

Official Deep Profile documentation (retrieved 2026-09-06):
https://www.deepcharts.com/helpcenter/article/deep-profile

The reference uses one profile engine with period/length choices: Latest,
Multiple, Composite, Visible and Custom. Monthly length is calendar based;
Visible follows the chart viewport. Session splitting belongs to the shared
profile settings. Public DLL profile-property evidence is already recorded
in `docs/deepcharts-composite-volume-profile-audit.md`; protected defaults and
exact formula/pixel parity are not inferred from property names.

## Why enabling the three rows is insufficient

- Workspace selects one daily, one weekly and one Composite instance.
- Chart chooses settings from the returned `daily`, `weekly` or `custom`
  period. Monthly and Visible both need exact custom requests, so this would
  silently use Composite settings and collide at matching start times.
- Historical request completion can arrive after a viewport/settings change.
  A range-dependent study must discard those late results.
- Monthly must use exchange trading-month boundaries, not loaded candles or
  rolling 30-day subtraction. Replay must cap every query at its own clock.
- Event candles have execution timestamps distinct from display slots. A trade
  can span multiple volume candles, so time-only requests cannot always isolate
  precisely the visible allocations. A sequence/allocation-aware endpoint is
  required for that case; the new planner refuses ambiguous slices.

## Implemented prerequisite, still no catalogue gate change

- `profileVariantJobs.ts`: calendar-month windows (weekends, DST, leap year,
  previous-month and replay bounds), logical visible range mapped to execution
  bounds, owner/settings/contract-specific job identity, concurrency bounded
  to two by default/four maximum, invalidation and independent error handling.
- `volumeProfileOwnership.ts`: optional instance ownership retained through the
  shared gateway `custom` period. Actual Chart.tsx renderer uses this owner for
  settings, IDs and newest-only levels. Existing unowned daily/weekly/Composite
  data retains its prior identity and settings selection. Deleted or disabled
  explicit owners cannot fall through into Composite.
- Eleven tests and scoped ESLint pass. Production build passed (TypeScript,
  80 static pages). This is a request/rendering foundation, not a working new
  profile release. No source HTTP request, provider subscription or spend was
  initiated by these tests. Gates remain Pending.

## Next integration gates

- Wire owned jobs to workspace cache, exact gateway source and shared live tape,
  with stable reconciliation identity and bounded/single-flight requests.
- Add Monthly, Session and Visible controls through the complete existing VP
  schema, preserving individual settings, templates and theme ownership.
- Monthly history should request full covered months even with short chart
  history; show missing coverage truthfully. Do not silently use current
  contract-only history as proof of pre-roll coverage.
- Visible-range subscription: coalesce viewport interactions, map event-bar
  source times and handle ambiguous split execution allocations explicitly.
- Session boundaries and filters must be DST-correct; do not use naive fixed
  24-hour arithmetic across a timezone transition.
- Replay and cash/options data compatibility require their own wiring/checks,
  not claims based solely on the futures live component.
- Verify exact execution totals, POC/VA, custom settings, overlay coexistence,
  live increment/reconciliation, theme/template persistence, browser rendering
  and sustained interaction performance before enabling any row.
