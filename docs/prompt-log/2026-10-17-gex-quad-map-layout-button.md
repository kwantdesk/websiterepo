# GEX VUE quad plus full-height right map

Owner reported that the requested screenshot layout was not available as expected.
The named preset had the correct tree, but the arrangement toolbar still only
offered four side-by-side charts plus a map. Also, first-run runtime returned
early with only GEX STANDARD, before built-ins were included.

Added the explicit gexmap-quad layout button/glyph, four charts left in a 2x2
grid (SPXW/NDX above QQQ/SPY), full-height four-column GEX Map right, 65/35 split.
Both persisted layout restore paths accept the new key. Existing saved presets
are preserved; no active workspace is replaced automatically. Fresh runtime now
includes the named GEX QUAD + MAP preset as well as GEX STANDARD.

Validation: four focused preset/layout tests including runtime tree geometry,
toolbar wiring and first-run inclusion; isolated production build. Authenticated
owner-tab visual verification remains unperformed. No feed/backend changes.
