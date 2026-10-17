# GEX VUE four-chart + map workspace template

Owner supplied a screenshot and requested an equivalent workspace template.
Added GEX QUAD + MAP to the existing gamma-only built-in preset inclusion path;
it does not automatically apply or overwrite the current workspace/custom preset.

Geometry: left65% split into equal columns/rows, SPXW top-left, NDX top-right,
QQQ bottom-left, SPY bottom-right. All four chart panes use Market Index, 5m/5D,
standard bounce-levels/dark-pool-gex and linked viewport IDs. Right35% is a
full-height GEX Map with SPXW, NDX, SPY, QQQ gamma columns, Present horizon,
Structural model, Front/0DTE expiry, 1-minute steps and current standard units.
Theme-derived chart/indicator colours are retained rather than forcing a new
global theme. Applying the template uses normal workspace save/export behaviour.

Embedded map serialization now carries its optional horizon, so another map's
remembered Future setting cannot override this template's Present view. Existing
workspaces without that field retain the prior fallback. Exposure model is also
preserved by the existing normalizer instead of being dropped.

Tests check actual preset factory output: geometry/pane ownership and order,
instruments, timeframe/broker, overlays, map state, linked panes, no mutable
shared map arrays, non-overwrite/dedup inclusion, and serialization wiring.
Four focused checks including previous toolbar spacing pass. Scoped GEX lint
has zero errors and the pre-existing slider aria-valuenow warning. Isolated
production build is checked before push. No authenticated UI/screenshot parity
claim, no new feed implementation or data-availability claim. Existing history,
recording/provider and broader indicator follow-ups remain in IMPORTANT-NOTES.
