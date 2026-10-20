# Clean normal-chart drawing toolbar

Request: match normal charts' cramped drawing controls to Positioning State's
clean rail, using the supplied two screenshots as the reference.

Cause: cockpit's unlayered `font: inherit` overrides the toolbar's Tailwind
8px typography. The normal text actions also used 20px height versus State's
28px buttons, and the magnet strength trigger was a tiny overlaid arrow.

The shared normal ChartDrawToolbar now uses consistent 28px buttons, scoped
8px/1-line typography, centred uppercase action labels, theme borders and a
solid theme background. STD/STR has its own full-size magnet-strength trigger;
its existing menu/choices are preserved. Tool-group expanders stay small and
inside their button footprint. Active/disabled states remain explicit.

This covers every normal Chart renderer using the shared toolbar (including
workspace chart variants); State's reference toolbar is unchanged. Drawing
geometry, storage, shortcuts, calculators, feeds and recorder are unchanged.

Verification:
- Real component SSR regression: labels, weak/strong and disabled states pass.
- Browser fixture uses production-built CSS and Aleph, no market-data calls or
  account/workspace changes. All 40 buttons in two theme panels measured 28x28,
  8px, zero horizontal text overflow. Proof: tmp/draw-toolbar-proof/dark-light.png.
- TypeScript, scoped toolbar ESLint and full production build pass (84 pages).
- Legacy single-source toolbar suite passes its eight tool checks then fails
  on the existing unrelated `KWANT Delta` title-capitalisation assertion.

Existing transport/startup-delay, month archive/capture, missing Asia tape,
indicator soak, options parity and shared multi-user capacity/cost gates remain
open. No gateway restart or runtime data/polling changes.
