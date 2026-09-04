# Pending indicator library overhaul

## User prompt

Audit DeepCharts indicators from top to bottom and implement every Quant Desk
indicator that is currently Pending/In Development. For each one, inspect its
help, add it to a chart, document every setting, inspect available licensed DLL
evidence, reproduce the correct logic/data/appearance/settings, test it, and
only then change its catalogue action from Pending to Add. Do not touch any
indicator that is already available. Keep a human checklist and pursue the
task until the full pending library is complete, without shortcuts.

## Baseline found

- 128 total catalogue indicators.
- 21 were genuinely `browser-pending` at task start.
- Absolute Levels is already available and is intentionally excluded.
- The authoritative ordered checklist and research record is
  `docs/deepcharts-pending-indicator-overhaul.md`.
- DeepCharts is installed and running, but its DLL is protected against IL
  disassembly and the current computer-control provider does not expose native
  app windows. Observable evidence will be recorded honestly; unavailable
  implementation internals will not be guessed.

## Work and outcome

- In progress. Item 1, **Unfinished Auction**, is implemented as a release
  candidate using exact Rithmic volume-at-price extremes. Its DeepCharts-visible
  settings contract, themed renderer, persistence normalization, explicit
  missing-data state and extension lifecycle are wired. Focused calculation
  tests and the full TypeScript check pass. Native DeepCharts default-value
  inspection and deployed visual QA remain open, so it is not recorded as
  finally complete. Production QA then passed on the exact commit and the
  temporary test instance was removed, completing item 1. Item 2, **Bar POC**,
  then passed the same exact-commit deployment and production QA gate. Item 3,
  **Dynamic POC**, passed local regression, exact-commit deployment and
  production add/render/settings/removal QA. Item 4, **Ratio Highlight**, now
  implements the documented extreme Ask/Bid ratios, DeepCharts defaults and
  vertical main-pane markers from exact Rithmic volume-at-price; local tests
  pass and deployment QA is next.
