# DeepCharts Inverse Cyber Cycle audit — 2026-09-07

## Outcome

`inverse-cyber-cycle` is implemented as a real dockable chart study. It is no
longer released through a pending/placeholder path.

The study calculates one Ehlers Cyber Cycle from candle midpoints, normalizes
that cycle independently over the A and B windows, then applies the inverse
Fisher transform. This gives the documented fast/slow oscillator around zero
and the visually observed bounded response. It runs in O(n) time with bounded
rolling deques and does not add a feed, timer or network request.

## Evidence used

- Official DeepCharts help: https://www.deepcharts.com/helpcenter/article/inverse-cyber-cycle
- Public DeepCharts screenshots on that page established the installed stock
  presentation: Smoothing Alpha 0.010, Cycle A 21, Cycle B 84, Middle 0.00,
  Low -0.60, High 0.60; line width 2 for both cycles and level width 1.
- Licensed local assembly public metadata only:
  `C:\Program Files\Volumetrica Trading\Deepchart\Deepchart.dll`, public type
  `Deepchart.Collections.EnumeratorAnnotation`. Its properties confirm Alpha,
  Length_A, Length_B, three levels, three level colours and LevelWidth. Public
  numeric attributes confirm alpha minimum/increment 0.001 with three decimal
  places, lengths minimum 5, and levels -1..1 in 0.1 steps.
- The standard Ehlers Cyber Cycle / inverse-Fisher construction was checked
  against the published Traders' Tips reference:
  https://traders.com/documentation/feedbk_docs/2004/05/TradersTips/TradersTips.html

The metadata helper reads CLR property/custom-attribute tables without loading
or executing the assembly and deliberately does not inspect method bodies:
`scripts/dotnet-property-metadata.py`.

## Implemented contract

- Native pane can be docked through the existing top/bottom/left/right layout.
- Cycle A and B have independent length, color pair, line style, line width,
  auto-color mode, short name, name/value labels and auto-center participation.
- Optional Cycle B secondary scale is wired through the pane scale system.
- Middle, Low and High are real full-pane reference lines with independent
  theme/custom colors and shared width.
- All numeric settings use the existing slider plus exact editable field.
- Settings normalize on restore; indicator templates/export/import and account
  persistence use the existing catalogue-wide path.
- Untouched colors follow the current chart theme. Choosing a custom color
  switches the study out of theme ownership through the shared control path.
- A maximum configured length receives the existing 20,000-candle deep-history
  path instead of silently warming from the 1,500-candle lightweight window.

## Honest parity boundary

The vendor assembly is protected and its formula body was not inspected. The
implementation is an evidence-backed public-formula reconstruction, not a
claim of proprietary bit-for-bit or pixel-for-pixel identity. Exact vendor
seeding/tie behavior and a side-by-side authenticated live-market soak remain
unproved. No vendor binary or protected code is redistributed.

## Verification

- `tests/inverse-cyber-cycle.test.mjs`: defaults/bounds, warmup, bounded output,
  constant input, pane/level output, custom persistence, release gates and a
  20,000-bar performance guard.
- `npx tsc --noEmit` passes.
- Numeric-slider, indicator-template, global-theme and pane-layout regressions
  pass.
- The complete 80-page `npm run build` passes after horizontal and vertical
  secondary-axis integration.
- Isolated browser QA verified the calculated pane, three full-width levels,
  editable slider controls and Save -> close -> reopen persistence.
- Exact production deployment verification remains the final release gate.
