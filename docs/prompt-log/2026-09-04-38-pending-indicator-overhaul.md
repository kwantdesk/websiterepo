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
  vertical main-pane markers from exact Rithmic volume-at-price. Production QA
  also caught and fixed a busy-chart status publication edge case before the
  temporary instance was removed. Item 5, **Stop Spotter**, now implements the
  complete observable settings contract, exact execution-data gate, both-side
  markers, deterministic close timing and contract sizing. Focused tests and
  TypeScript pass. Its first production pass confirmed Add, LIVE state and all
  settings, then exposed a Chromey Mono sell-marker contrast defect; that is
  corrected through the shared visibility-safe indicator palette; production
  QA passed and the temporary study was removed. Item 6, **Cumulative
  Iceberg/Stop**, now implements the full observable DeepCharts settings
  contract as a signed two-line Rithmic order-flow pane. Volume mode uses
  execution plus price-level lifecycle evidence. Because individual maker
  order IDs and native iceberg flags are not exposed by the current gateway,
  Order mode clearly reports that capability requirement instead of inventing
  counts. Focused calculation tests and TypeScript pass; build/deployed visual
  production QA passed on NQ 500-volume, including event anchoring, guarded
  Order mode, saved-state handling and clean temporary removal. Item 7,
  **Book Speed**, now implements the official consumed-level contract with
  execution-confirmed Bid/Ask exhaustion, Seconds and Tick Reversal windows,
  opposing histograms, averages, markers, full themed settings and explicit
  data states. Focused tests, TypeScript, templates and the shared Rithmic
  frame-budget check and production build pass. Exact-deployment production QA
  confirmed live values, both modes, settings persistence and clean removal.
  Item 8, **KWANT Delta**, now implements the current observable DeepCharts
  contract without claiming access to its protected formula body: classified
  execution delta, four magnitude tiers, Classic/Multi Range, consecutive bar
  grouping with a live partial group, delta extremes, mirrored thresholds and
  Struggle markers. Its data refusal, theme/custom colours, sliders and synced
  templates are wired; focused math/performance tests, TypeScript and the full
  production build pass. Deployment and production visual QA are the remaining
  release gate before item 8 is finally complete.
