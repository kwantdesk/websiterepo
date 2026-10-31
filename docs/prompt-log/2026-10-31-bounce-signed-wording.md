# Bounce side wording: explicit signed exposure

The owner requests positive/negative dollar signs in enabled Bounce Levels wording, for example `+$5B` / `−$5B`. This is a text/presentation request after explicitly cancelling the preceding unlink/source task. Do not reintroduce that cancelled change.

`Chart` now includes exposure whenever the local Show side labels switch is on, in every Map view. Bounce wording uses signed currency independently of Map's percentage/raw-value preferences. The existing legacy value-only choice still works when side labels are off. Stock side labels remain off.

The primitive's label formatter reuses the signed currency formatter already used by the Map range legend, preserving compact B/M/K units and nonzero small-value precision. Positive and negative values explicitly receive `+` and `−`; exact zero displays `$0`. Optional direct percentage callers also get an explicit positive sign. General GEX Map number formatting is unchanged. Exposures, palettes, node selection/mapping, history, provider requests and settings linking are unchanged.

Verification: six isolated actual-hook/canvas scenarios use the three label bindings extracted from production Chart AST, rather than a separate hand-written binding. Nine actual formatter samples cover ±5B, millions, thousands, small fractions, zero and signed percentages. Actual canvas text includes both `+$5.00B` and `−$5.00B`; Star view shows positive cash immediately; Full view retains both cash signs even with Map percent mode and raw values off. Checkbox off suppresses wording/values; on survives reload. No page errors; controlled fixture auth/preferences/data, not a live vendor comparison. Evidence: ignored `tmp/bounce-signed-browser.log`. Existing 36 mirror, 48 palette and 22 range regressions and scoped primitive lint pass. The complete production build validates the large Chart component.

Release only through the existing main-only Git integration; verify deployment success and exact live SHA. Preserve unrelated changes and do not restart the gateway or mutate user preferences/trades/recordings.
