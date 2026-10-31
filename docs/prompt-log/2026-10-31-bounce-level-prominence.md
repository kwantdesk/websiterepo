# Bounce Levels: faint small nodes instead of a grid

Owner says weak Bounce Levels look like lines everywhere, while the large bands already have good thickness. Keep the large bands and make the weak nodes genuinely small and faint.

Root causes in the primitive: minimum body/core/halo widths were applied to every node; the centre stroke forced at least20% opacity and used the run's historical maximum strength/brightness; projected continuations forced18% opacity and borrowed that historical maximum too. Mirrored Full/highlighted nodes could have mapOpacity1 even for tiny exposure.

Presentation-only change in `bounceLevelsPrimitive.ts`: a smooth local-strength curve scales weak geometry and alpha, reaching the original dimensions/opacity at strength0.65 and above. Each ribbon's minimum width also scales locally. The core is now a variable-width filled ribbon with per-observation colour/opacity, rather than a single uniform stroke. Continuation width/opacity follow the final observation without a forced visibility floor. Exposure ranking, snapshot values, signed colours, mapping, history and settings are untouched. No new provider requests or polling.

Verification: four new numerical regressions cover weak subpixel geometry/alpha, unchanged strong dimensions, bounded smooth monotonic response and clamping. Actual production primitive rendered before/after in isolated Chrome for mirrored and legacy modes at DPR1/2: small positive/negative nodes, strong bands, strong-to-weak history, continuations and source immutability; zero browser errors. At DPR1 mirrored, strong-band integrated alpha is identical19.349 before/after; weak alpha falls3.004→0.078 and a faded continuation1.325→0.008. Visual comparison inspected at `tmp/bounce-prominence-comparison.png` (controlled fixture, not owner-account data).

Existing Bounce core,36 mirror checks and48 palette checks pass. Settings/replay suite:15/16 pass; the remaining test already expects removed `preserveBounceOverride` text and version5, while the unchanged configuration is version6. Neither configuration nor that stale test is modified by this task. Scoped primitive/new-test lint passes. Full final production build exits0.

Preserve unrelated dirty work, latest Globex/Tokyo fix and all cancelled Bounce changes. No gateway restart, preferences/accounts/trades/recording reset or source-data changes. One scoped main push through existing `websiterepo-yfmi`; verify exact live SHA.
