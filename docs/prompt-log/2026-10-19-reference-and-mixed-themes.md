# Six reference palettes + ten mixed-colour themes — 2026-10-19

Owner asked to reproduce six attached palettes as accurately as possible and
add ten different mixed-colour themes, not more monochrome blue/pink variants.
This explicitly adds to the earlier kept17; none of those were removed/recoloured.

## Exact screenshot samples (left to right)

- Deep Sea: #FFFFFF #00171F #003459 #007EA7 #00A8E8
- Blue Lagoon: #00A6FB #0582CA #006494 #003554 #051923
- Sunflower Fields: #D6D6D6 #FFEE32 #FFD100 #202020 #333533
- Midnight Sky: #27187E #758BFD #AEB8FE #F1F2F6 #FF8600
- Crimson Fade (unnamed red strip): #F50538 #B6042A #79021C #3D010E #000000
- Sunset Sorbet (unnamed warm strip): #FB6095 #FB878E #FBAF87 #FBD680 #FBFD79

Samples read from central flat-colour pixels of the six supplied PNG files
using System.Drawing; no source images were modified/generated. Reference
strips retain these exact five colours/order. All samples are also actual
theme token values, not preview-only cosmetics. Additional muted/ink/border
shades support readable controls. Sunset Sorbet uses dark berry text/actions
over its light warm shell; no invented minimum-colour market signals.

## Ten additional palettes

Copper Current; Voltage Orchard; Glacier Ember; Saffron Ink; Racing Fern;
Tangerine Circuit; Amethyst Petrol; Rose Alloy; Ultraviolet Mint; Terracotta Ice.
Each combines two distinct accent hues; all20 accent colours and all ten dark
backgrounds are unique. No random-at-runtime generation or animated effects.
Mixed preview cards show both accents. Existing17 token maps are unchanged,
verified against267eab14 and retained as an immutable fingerprint regression.
The old KEPT_THEME_NAMES constant remains the original17 baseline, not a new cap.

## Verification

-25 focused tests pass: reference-theme-presets, feminine-theme-presets,
  deep-dark-theme-presets, theme-action-contrast, theme-scrollbars,
  theme-chart-live-sync, liquidity-map-theme-contrast and profile-gradient themes.
- Exact samples/order and actual-token participation;33 unique names;20 unique
  mixed accents with≥35° pair hue separation; new foreground≥4.5:1 on all four
  shell surfaces and candles≥3:1 on charts; unchanged original17 fingerprint.
- Hollow-candle5 checks and brand-mark9 checks pass.
- Scoped ESLint and the complete84-page production build (including TypeScript)
  pass. The focused25-test suite was rerun after final preview metadata changes.
- All16 local HTML/SVG token previews inspected together in a hidden browser;
  original reference strips and contrasting candle/UI colours visibly present.
  Preview was illustrative UI only, not market data or a signed-in Settings
  acceptance test. Temporary preview tab/server closed.

No account/database/provider/VPS changes, no polling/stream additions, no
font/size/layout redesign. Current/custom theme selection is not reset.
Existing historical coverage, public streaming, weekly completeness, footprint
and options-panel live/cloud-save/soak acceptance gaps remain OPEN.

Only scoped theme source/Settings/tests/notes will be included in one normal
main push. Unrelated native, ALGO, Socials/gateway and older release notes stay
preserved. Production identity verification will be appended after deployment.
