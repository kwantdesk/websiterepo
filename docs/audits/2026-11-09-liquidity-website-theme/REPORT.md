# Liquidity website-theme mode

The automatic theme palette already existed in the canvas implementation, but normalizeHeatPalette rejected auto and the default was a fixed cyan-magenta palette. The colour picker exposed only manual presets.

Auto is now a valid persisted palette and the default for new/reset settings. A Use website theme toggle sits first in the settings panel. Selecting it previews, persists and redraws immediately through the same settings path as manual gradients. Existing explicitly saved gradients remain available and unchanged; the new button returns them to automatic mode. Incoming website-theme messages already synchronize the preview, DOM and renderer, whose auto palette cache keys include actual theme colours.

11 focused tests passed: automatic defaults/restore, live theme-colour changes, light background, stable manual overrides, actual button handler, existing contrast and volume colours, and time-axis bubble sizing. Scoped ESLint passed. Static frontend release; no data-feed restart or account/preference clearing.
