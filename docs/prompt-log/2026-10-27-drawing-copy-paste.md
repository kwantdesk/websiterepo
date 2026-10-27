# Drawing Copy and Paste

The owner requested right-click Copy/Paste and Ctrl+C/Ctrl+V on Windows,
Command+C/Command+V on Mac, for every sidebar drawing type. Copies should be
independent and sit beside their source.

## Implementation

- Shared internal drawing clipboard snapshots, with fresh object IDs and
  progressive horizontal offsets. Original objects/styles remain independent.
- Current SVG sidebar drawings use a portal menu matching site panel colours,
  rounded corners and existing hover surfaces. Click/select then copy/paste,
  or right-click the drawing. Empty plot space offers Paste after copying.
- All current drawing types share the path: arrows, profiles, position
  calculators, lines, shapes, notes, emoji and freehand strokes. Profiles enter
  existing commit/persistence logic and recalculate against the pasted range.
- Older precision, professional registry and SVG position drawings are covered.
  Precision time and logical-index anchors/path points move together; all price
  values and position risk distances remain unchanged. Alert IDs are unique.
- Shortcut handling chooses one focused chart/layer. Editors keep native text
  operations. Repeats, Ctrl/Cmd+Shift combinations, right-drag rulers and normal
  chart panning retain their behaviour. Menus close on outside press/Escape/blur.

## Verification

- 31 targeted tests pass: clipboard snapshots across the registered sidebar
  tools, every precision tool, real legacy/professional paste functions,
  independent nested settings, unique IDs, unchanged prices, successive offsets,
  real hook keyboard dispatch for Ctrl and Command, focused-pane routing,
  text-field protection, right-click hit selection, menu bounds, right-drag
  preservation, overlapping drawing-layer priority and listener cleanup.
- Related timeframe, horizontal extension, position break-even and Kwanty State
  drawing tests are included in those 31 tests.
- Isolated browser fixture using the actual ChartDrawLayer: context-menu paste
  increased the drawing count from 3 to 4 with a second position calculator;
  two subsequent arrow pastes increased the count to 6. This fixture has no
  market/account connection and does not alter owner workspaces.
- Browser automation virtual clipboard intercepts Control+V before application
  key dispatch. Native Windows/Mac shortcut end-to-end behaviour is therefore
  not claimed from that browser run; actual hook key handlers for both modifier
  styles are exercised by the tests above.
- Production build and scoped ESLint pass before the scoped main push.
  One existing main-only Vercel deployment is used; no manual/preview deploy.
