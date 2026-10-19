# GEX DATA command-rail toolbar

Request: top buttons should match the website/menu bar, not the prototype.

Matched AppSidebar/globals command-rail geometry: 28px controls, 3px corners,
10px Aleph, 600 weight, .075em tracking, muted theme text, outlined borders,
surface hover and keyboard focus. Removed heavy shadows/brightness effects.
Replaced Unicode glyphs with 14px currentColor stroked SVGs and readable labels.
Fullscreen/help/settings/clear are compact utilities with accessible labels;
Workspaces uses a matching line icon. Filter counts are inline, hidden at zero
and no longer start with a fabricated two. Reserved timezone space and safe
horizontal overflow remain. Existing action hooks and behavior are unchanged.

Verification:

- 158 existing GEX DATA/reference tests pass; two new toolbar regressions pass.
- Scoped lint passes for workspace-ui.js and the new test.
- Local browser: all 11 toolbar buttons measure 28px high / 10px text with no
  shadow. Add Tool opens its picker, Workspaces opens save/import/export, and
  Page Tool Filters opens its actual settings. No workspace mutation performed.
- Full production build passes (84 pages, including TypeScript). Production
  deployment receipt recorded after completion.

Standing unresolved (unchanged): stable VPS transport; month-long futures and
options recording/history/backfill/offline gaps; missing Asia tape; weekly
profile/footprint/CVD soak; GEX DATA forecast/aggregate/cadence parity; shared
acquisition/cost and 100+ user capacity. This is a toolbar-only presentation fix.
