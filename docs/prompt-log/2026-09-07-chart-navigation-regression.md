# Chart navigation regression — 2026-09-07

## Prompt

The user reported that charts became severely laggy while navigating and
moving around them during trading. The live feed itself was not lagging, and
the interaction had been smooth a few days earlier. They asked for the reason
and for the regression to be fixed.

## Diagnosis

- Since the earlier smooth-chart baseline, the chart implementation received a
  large indicator expansion: 66 chart-touching commits and roughly 2,700 added
  lines in `Chart.tsx`.
- The viewport callback still incremented React state every 64 ms throughout a
  pan or zoom. That cadence now reconciled the entire enlarged chart component
  about 15 times per second while the native canvas was also handling input.
- Execution-derived Profile Values and non-visible volume-profile variants were
  unnecessarily connected to that viewport state, adding avoidable work during
  navigation.

## Fix

- Preserve native Lightweight Charts movement at the browser frame rate.
- Keep drawings and paper-order labels imperatively reprojected in the existing
  animation-frame path.
- Replace repeated mid-gesture React commits with one low-priority update 80 ms
  after the latest viewport event.
- Restrict viewport-driven profile recalculation to Visible Range Volume
  Profile and the visible-period Profile Values mode. Session and monthly
  calculations no longer rebuild merely because the trader pans or zooms.

## Outcome

The expensive React/chart-calculation path no longer competes with continuous
pointer and wheel input. Final React overlay coordinates still settle promptly
after the gesture, and market-data subscriptions, tick cadence and candle logic
are unchanged. Focused interaction tests, scoped ESLint and the full TypeScript
check pass. This conclusion is based on code-path diagnosis and regression
checks; no browser FPS measurement was available in the current session.
