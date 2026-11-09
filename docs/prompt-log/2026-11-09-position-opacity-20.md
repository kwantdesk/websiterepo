# Long/short drawing stock opacity — 20%

Owner requested 20% stock fill opacity, superseding 50%. Changed the shared DEFAULT_POSITION_FILL_OPACITY from 0.5 to 0.2. New Long Position and Short Position drawings, previews, and missing-value renderer/normalization fallbacks share that constant. Explicit saved opacity values, including zero and previously saved 50%, remain unchanged. No other drawing defaults, colours, geometry, chart feeds, trades or workspaces were modified.

Seven existing default/persistence regression tests pass with the repository alias loader; scoped ESLint passes. Full isolated production build and existing main-only Git deployment are verified before completion. No backend restart or owner browser interaction.
