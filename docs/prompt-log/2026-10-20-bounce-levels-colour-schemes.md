# Bounce Levels colour schemes

Request: changing Bounce Levels' colour scheme did not recolour its levels.

Cause: the shared palette seam resolved the scheme's swatches, but retained
`useThemeColors: true`. Bounce's canvas configuration then replaced those
swatches with chart-theme colours. Its optional GEX Map link could also win.

Repair: a valid active scheme supplies render-only colour authority, disabling
renderer-local theme override (and Bounce's map override) without changing the
saved choices. Off returns the original settings object, restoring those links;
unknown scheme IDs remain pass-through. Bounce's render memo also now watches
its border/accent and grid/neutral theme colours, not just up/down.

Verification: focused regression covers all 12 schemes across theme/map toggle
combinations (48 cases), saved-settings immutability, Off/unknown IDs and theme
memo invalidation. Existing Bounce Levels tests and eight catalogue-wide theme
follow checks pass; TypeScript passes. Full palette suite has a pre-existing
catalogue coverage failure for volume-delta-sprint, important-levels,
average-daily-range-target and overlay-timeframe-highlight, before reaching the
canvas checks. Large Chart ESLint invocation exhausted its default 4 GiB heap;
registry-only lint passes. Full production build passes (84 static pages).

No market-data requests, cadence, recorder or gateway settings changed. Existing
transport/startup-delay, month history/capture, Asia tape, full indicator soak,
options parity and shared multi-user capacity/cost gates remain open.
