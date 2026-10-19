# GEX VUE theme-coloured, quiet startup

## Request

Remove the black/loading-animation interruption when opening GEX VUE. Keep
the current theme visible, like the rest of the application.

## Diagnosis and change

The charting route passes through several KwantLoader covers: preference
hydration, staged docked/floating panels, panel selection, candle history,
dynamic chart-module loading and the chart's first visual-fit gate. The loader
adds a gradient, halo, rotating emblem and visible loading text to each phase.

Added an explicit quiet presentation to the existing loader. It retains its
accessible busy/status state and dimensions but renders no visible text,
emblem, gradient or animation. GEX VUE passes that presentation through an
explicit quietLoading prop, separate from crosshair/linking semantics. Chart
module fallback is also quiet. Workspace surfaces use live theme CSS colours;
explicit chart backgrounds remain respected. Normal non-GEX data/history
loaders retain their presentation. Error/readiness/identity guards, requests,
indicator math, persistence and feed timing are unchanged.

## Verification

- Four new regressions render the actual loader, cover all GEX VUE startup
  call sites, preserve custom backgrounds and verify synchronous saved light,
  deep-purple and teal theme bootstrap before animation frames run.
-14 new/adjacent startup, history-critical-path and live-theme tests pass.
- Broader selection has two pre-existing source-guard failures, verified on
  HEAD before this change: chart-loading-states expects the removed
  if(cachedIsHydrated) spelling; workspace-theme-precedence expects the old
  preset/mergeWorkspaceChartSettingsWithActiveTheme expression. Neither is
  altered to manufacture a passing result.
- Full production build passes84pages, including TypeScript.
- Loader component and new test ESLint pass. Whole-file lint of the two
  existing megabyte-scale chart/workspace components exhausted Node's4GB
  lint heap. No machine-wide heap increase or rule bypass was applied; full
  build/type checking and the scoped regressions passed. Not a full-lint pass.
- Production/browser acceptance recorded after deployment.

## Standing important notes

This is presentation only. Stable supported gateway/Vultr transport, rolling
month futures/options history and recording/backfill, Asia opening tape,
weekly/footprint/CVD live soak, GEX DATA forecast/source aggregates/live cadence
and hundred-user shared acquisition/cost acceptance remain OPEN.
