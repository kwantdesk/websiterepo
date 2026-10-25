# Indicator library spacing, corners and search focus — 2026-10-25

Owner requested less cramped left spacing, rounded edges and no coloured
outline when clicking to type in the library search field.

Root causes: cockpit-wide utility compression reduced header padding and
corner radii. The square search wrapper explicitly changed to a primary
border on focus, while unlayered cockpit input styling overrode its utility
reset, adding a second border, recessed background, shadow and focus outline.
Fixed search/sidebar/category widths also squeezed names on narrow layouts.

Library-only semantic classes now own the layout: 16px dialog, 10px search,
8px controls, 12px rows, header20px/24px, results18px/20px and row14px/12px
padding. Names/descriptions can wrap; category metadata remains visible on a
second row below800px. Below640px the search takes a full header row and the
category list becomes a horizontal scroller. Sidebar/list retain independent
scrolling. The input has no nested border/background/shadow or focus outline;
the surrounding neutral search border stays unchanged. Site-wide keyboard
focus for buttons is untouched. Dialog/search/close/star labels are explicit.

No search/category/add/remove/favourite handlers, indicator computation,
market feed, account/trading data or provider request cadence changed.

Verification:

- Four new appearance regressions failed before repair, pass after repair.
-14 focused appearance/toggle/toolbar tests pass; favourites helper checks pass.
- Old toggle test expected an obsolete ternary. Confirmed that assertion fails
  on unchanged HEAD; updated only its label assertion to the existing
  compatibility-aware Added/Pending/Add/Unavailable contract.
- Isolated loopback fixture renders the actual extracted library JSX and real
  catalogue/compatibility data using React static markup, current globals.css
  and compiled utility styles. No market/account API or real account state.
- Desktop computed styles confirm16px/10px radii, exact scoped padding,
  transparent input,0px border, outline none, box-shadow none. Clicking and
  typing leaves the neutral outer search border unchanged. No horizontal
  overflow in the dialog/results. This verifies style/focus, not React search
  filtering or real-account add/remove acceptance in the static fixture.
- Independent review caught semantic role matching a generic fixed-dark dialog
  rule. A later equally-specific token override preserves theme background and
  border; a fifth regression covers cascade order. Light fixture computes
  white panel/rgb(213,219,227) border, not the fixed-dark skin. Dark follows panel.
- Final browser iframe widths320,480,640,641,768,980 all report no dialog/results
  horizontal overflow,16px/10px corners and no input outline/border. Mobile
  search order4/bodycolumn, wider search order0/bodyrow, exactly as intended.
- Final production build passes compilation, TypeScript and84 static pages.
  Scoped ChartIndicatorsControl ESLint exits0 without findings (Babel emits
  its existing large-file code-generator note).
- Evidence: C:/Users/Karen/.codex/visualizations/2026/09/02/01a06418-e374-7a73-bf53-3d3583cb166e/indicator-library/rounded-library.png
  Same folder:light.png,layout-metrics.json,build-final.log,lint.log.
- Production release receipt follows the single scoped main push.
