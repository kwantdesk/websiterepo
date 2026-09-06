# Session Imbalance release

## Prompt

Continue the pending-indicator overhaul one real indicator at a time, using
DeepCharts documentation and the licensed DLL contract; do not remove Pending
unless calculation, settings, rendering, theme and persistence are wired.

## Fixed

- Added a standalone Session Imbalance engine for CME exchange sessions.
- Added developing/fixed IB high, low and midpoint plus exact ±50% and ±100%
  extensions, custom start, history count, formation/next-session extent,
  plot-on-close, theme/custom colour, line/text and live alert settings.
- Registered the calculator-backed chart renderer and account-synced settings/
  template path. It is now genuinely addable instead of catalogue-only.

## Outcome

Focused tests, TypeScript, scoped ESLint, shared template/theme regressions and
the full catalogue audit pass. Pending falls from 16 to 15. Protected formula/
pixel parity and a live-market soak are explicitly not claimed.

