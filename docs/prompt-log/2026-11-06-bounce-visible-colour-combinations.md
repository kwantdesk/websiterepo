# Bounce Levels visible colour combinations

Owner reports no colour combinations in Bounce settings. The mirror settings omit generic colour fields, and the canonical palette editor was hidden behind General > Open GEX Map view, nodes & colours. The latest liquidity-only release did not remove the palettes; this was an existing discoverability failure.

Added a direct Colours section to mirror Bounce settings. It exposes every canonical shared preset, persists immediately through saveGexMapPalette, reflects the selected preset, and includes Use theme colours. GEX Map and Bounce continue using the same saved palette/event; the advanced individual-colour editor remains available. Opening this section never saves or resets anything. No exposure calculations, levels, mapping, archives, feed or workspace changes.

Validation: three component tests execute every actual palette button against real palette persistence, check selected states, verify theme toggling preserves custom colours and reflects advanced-editor events, and assert a direct settings section. New component ESLint passes. Combined Bounce suite: 12 pass, one existing source-pattern failure concerning preserveBounceOverride. Exact unmodified HEAD sources reproduce that same failure (9 pass/1 fail); no unrelated configuration edits included. Full isolated production build and live deployment receipt are retained in tmp/bounce-colours-build.log and tmp/bounce-colours-production-release.json.

No owner browser access, restart or account/order mutations. Static source/components tested; owner's current UI not inspected.
