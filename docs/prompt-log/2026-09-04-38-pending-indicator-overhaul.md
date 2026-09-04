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
  production build pass. Exact-deployment production QA then confirmed live
  NQ 500-volume rendering, mode switching, the complete settings surface,
  immediate saved state, no false close prompt and clean temporary removal,
  completing item 8. Item 9, **KWANT Wall**, uses
  the official ES-focused settings contract and defaults. It requires exact
  Rithmic volume-at-price absorption at a recent extreme plus a confirmed
  rejection, and exposes explicit unsupported/data-wait states, theme/custom
  markers, alerts, sliders and templates. Commit `763da125` reached Ready on
  the sole Vercel project; cache-busted production QA confirmed Add, the NQ
  unsupported guard, the complete settings surface, immediate save/no false
  prompt and clean removal, completing item 9. Item 10, **KWANT V-Tracker**, is
  now a release candidate. Official help and DLL metadata establish the three
  pattern modes and the Absorption/Pressure control/extreme level contract.
  The protected coefficients were not copied: the implementation uses exact
  classified Rithmic execution speed, delta, close location and price-level
  dominance, refuses OHLC-only data, renders theme-safe price-pane patterns
  and levels, and exposes all documented modes, projection, far-right,
  widths, labels, colours, alerts, sliders and synced templates. Focused
  behavior/bounds/20,000-bar tests and the production build pass. Commit
  `85cc2949` reached Ready and cache-busted production QA confirmed nine live
  NQ 500-volume signals, the full editor, immediate save/no stale close prompt,
  and clean removal, completing item 10. Item 11, **Custom Draw-On Volume
  Profile**, is now a release candidate. DeepCharts metadata confirms it is a
  chart drawing action, so its library Add button arms the selected chart's
  fixed-range profile instead of creating a dead zero-anchor study. Committed
  anchors request exact custom-period Rithmic price rows with grouping, value
  area and execution filters; requests are drag-debounced and signature-guarded
  against stale responses. The histogram, POC, VAH and VAL, themed controls,
  drawing persistence and templates are wired. Focused conversion/arming,
  fixed-profile level, template, theme, slider and TypeScript checks pass.
  Commit `efad055c` reached Ready and production QA confirmed exact NQ profile
  placement, POC/VAH/VAL, settings changes and clean removal, completing item
  11. Item 12, **KWANT Profile Swing**, is complete: all five
  profile modes, Swing/VWAP length, four main/stop detector families,
  reversal-bar inclusion and profile/lines display are wired over exact
  Rithmic volume-at-price. Execution filters operate before aggregation;
  missing exact flow is refused. It has an isolated native renderer,
  theme/custom colours, sliders and synced templates. Focused formula,
  filter, data-refusal and 20,000-bar tests plus TypeScript, lint and the
  production build pass. Production QA exposed and then verified the fix for
  a non-finite forming event-bar end time (`f9ca54e4`). The exact default
  precision fix (`3c76312c`) reached Ready as deployment
  `4t5xj1ZgP6yXE9VFiGeP1EMJnrN8`; cache-busted NQ 500-volume QA confirmed the
  live profile and levels, exact 10/5 reversal defaults, immediate saved state
  and clean removal.
  Item 13, **KWANT Profile Values**, now has the complete observable DeepCharts
  period/input/grouping/POC/value-area/peak-valley/VWAP/summary/session contract
  over exact Rithmic volume-at-price. It renders through an isolated level-only
  native primitive, refuses unavailable historical order-book data, follows
  themes, persists settings/templates and passes focused correctness and
  20,000-bar performance tests. Commit `80fef169` reached Ready in Production
  as deployment `CxgpRkQyMvbT2jhraxHykjgd3DzG`; production QA confirmed Add,
  immediate save and restoration after reload. The current session exposed no
  historical volume-at-price even on the Footprint panel, so the honest
  waiting state was verified rather than accepting fabricated OHLC-derived
  output. Filtered developing POC/VA/VWAP now uses the same accepted individual
  executions as the completed filtered profile. Item 13 is complete.
