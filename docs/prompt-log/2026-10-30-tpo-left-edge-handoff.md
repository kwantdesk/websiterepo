# Replace the older TPO when the next profile docks left

Owner request: keep TPO's left-edge sticking behavior, but make the previous profile disappear when the next one reaches that edge rather than stacking them.

The renderer already elected one historical wall profile per indicator instance, but it used canvas x=2 rather than the visible plot boundary behind the drawing toolbar. The strict comparison also excluded the exact contact coordinate, allowing the previous pinned profile and the incoming profile at that coordinate to paint together.

Added explicit left plot insets to the TPO primitive, initialized at chart creation and updated independently when the toolbar/chart changes. Wall election, anchoring, clipping and hit testing now use the visible left boundary. Contact is inclusive. The newest drawable profile at that wall wins chronologically, and older profiles skip their complete paint pass, including levels, summaries, single-print shading and hit bounds. A candidate without a projectable end cannot hide the drawable predecessor. Right-docked mode also drops old profiles beyond the left boundary instead of clamping their fragments onto it.

Election still happens during native paint, so handoff follows panning without waiting for a React model rebuild. Models and history remain intact; panning back restores the previous wall owner as the newer profile returns on-screen. Independent daily/weekly indicator instances remain independent.

Verification: seven actual-renderer/hit-test regressions cover toolbar insets 0/36/64, exact/fractional contact, off-screen positions, reverse model order, pan-out/pan-back, independent studies, right-facing old profiles, an unprojectable candidate, mirroring and removal of old extra layers. Full TPO selection totals 43 passing tests; scoped primitive lint passes. Verify full production build, main-only deployment and actual release SHA before reporting live. No price data, TPO calculations, recordings, feed, trades or VPS changes. Owner-browser visual acceptance was not observed.
