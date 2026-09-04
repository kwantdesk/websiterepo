# Global theme ownership across Charts and GEX VUE

## Prompt

Changing the overall theme must immediately repaint every chart and GEX VUE pane. Only a colour deliberately customised on an indicator, candle series, or drawing may remain independent. A theme change affects the current runtime, but a named workspace only adopts it after Save/Quick Save; reopening an unsaved workspace restores its last saved appearance.

## Root cause

- Charts and GEX VUE only heard the theme event while mounted. Changing a theme from Settings left their scoped runtime palettes stale.
- GEX VUE's prefixed indicator storage was missing from the stored-indicator relink pass.
- Candle settings had no explicit theme/custom ownership flag and were not part of named workspace snapshots.
- Applying a saved workspace merged its chart palette with the current global palette instead of restoring the saved palette.
- The chart theme listener repainted drawings even when a trader had selected a custom drawing colour.

## Fix and outcome

- Theme selection now relinks the stored runtime chart palettes for both Charts and GEX VUE, so returning from Settings cannot reopen stale colours.
- Theme-linked indicators in both products are relinked; explicit `useThemeColors: false` overrides remain unchanged.
- Candles now expose **Use theme colours**. Palette interaction creates an explicit custom override; candle style, opacity, border, and wick controls do not.
- Named workspaces now save and restore per-pane candle settings and their exact saved chart palette. Quick Save is the boundary that commits a new theme to the preset.
- Theme-linked drawings repaint; explicitly custom drawings remain custom.
- Added `test:global-theme-chart-ownership` to lock the behavior down.
