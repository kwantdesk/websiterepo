# Volume-profile candle-boundary continuity

## User prompt

> The composite volume profile. Okay, this is still a glitch. Every time the
> candle closes after one minute, the volume profiles disappear and then come
> back. And this is happening with a lot of the indicators.

## Diagnosis

The rolling Composite Volume Profile range is derived from the candle series.
When a new one-minute candle opened, its requested start/end changed and the
profile lifecycle immediately filtered out the previously painted profile for
not matching the new range exactly. The exact cache/gateway request then ran
asynchronously, leaving a visible empty frame until its response arrived.

The earlier chart-boundary fix protected candle and sampled-indicator work from
synchronous recalculation, but this separate async profile lifecycle still used
a clear-before-replace transition.

## Fix

- Added a scope-aware last-good profile retention rule shared by Daily, Weekly
  and Composite profiles.
- Applied the same replace-without-blanking lifecycle to the separately owned
  Monthly, Session and Visible Range profile variants, whose request keys can
  also change at a candle or viewport boundary.
- Rolling range, grouping, filters and value-area settings now identify the
  incoming replacement without erasing the existing valid frame.
- Exact execution-backed replacements still pass the existing strict request
  checks and replace the matching period atomically.
- Symbol and contract changes, removed studies, expired Daily dates and
  unticked Daily sessions continue to clear stale profiles immediately.

## Outcome

The Composite profile remains continuously visible at a one-minute candle
boundary while its updated execution-backed calculation is loaded. The same
last-good-frame contract now protects all execution-backed profile families
without allowing data from another instrument, contract or session to linger.

Automated coverage validates the bar-boundary retention and all scope-isolation
guards. An authenticated active-market soak remains listed in Important Notes.

## Validation

- 8/8 focused candle-boundary and profile-continuity checks passed.
- TypeScript passed with `npx tsc --noEmit`.
- The full Next.js production build passed (compile, type validation and all 80
  static pages).
- Scoped lint reported no errors. The existing oversized workspace component
  warnings remain; linting the separate 1.1 MB `Chart.tsx` file exhausted even
  an 8 GB Node heap, while the production compiler and TypeScript both passed.
- Two pre-existing source-text contract tests remain stale on current `main`:
  Composite ownership expects wording no longer present in `Chart.tsx`, and the
  live-settings audit flags the existing `weeklyWindowSettingsVersion` marker.
