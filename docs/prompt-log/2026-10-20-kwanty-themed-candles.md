# KWANTY themed candles

Owner request: candle colours should match the theme, not be blue arbitrarily.

Root cause: defaults and both canvas renderers mapped a reference blue to the
theme's generic accent, and reference grey to its border colour, rather than
using the site's dedicated bullish/bearish candle roles.

Change the default settings and Classic/State/Orderflow canvas fallbacks to the
up/down roles. Existing theme synchronization updates non-custom saved defaults.
Also refresh the older spot_candle_up/down aliases that otherwise take precedence
in profile rendering. Preserve customisation flags, visibility, metric-colour
mode, layout, price calculations, and all market-data acquisition/cadence.

Verification: 105 KWANTY/live-theme tests pass, including actual canvas body/wick
paint checks across all three modes and two different theme pairs, saved-default
and legacy-alias migration, and explicit custom-colour preservation. All four
changed JavaScript modules pass syntax checks. Release verification pending.
