# Correct the purple-heavy theme collection — 2026-10-19

Owner rejected the first20 themes as too purple; each should have its own colour
identity. Reworked the new collection only, not the original44 palettes.

Current20 names:
Velvet Voltage, Ruby Noir, Cobalt Copper, Arctic Chrome, Tangerine Obsidian,
Pine Signal, Signal Yellow, Abyssal Laser, Petrol Chrome, Emerald Afterhours,
Copper Current, Acid Obsidian, Black Gold, Ember Noir, Blood Moon, Coral Carbon,
Fuchsia Carbon, Hot Pink, Venom Carbon and Plasma Lagoon.

Purple is now exclusive to Velvet Voltage among these20: no purple secondaries
or purple-tinted surfaces in the other19. Dark shells, strong text contrast and
vivid accents retained. Intentional chrome/white neutral roles are allowed.
Names changed where needed; no current/user-saved palette is forcibly rewritten.
Existing stored colours are snapshots, so select a revised preset to apply it.

Verification:
-26 focused theme tests pass. New hue checks cover surfaces, primary/secondary
  and candle directions; collection spans at least10 hue-family buckets, with no
  bucket dominating. Existing pair-distinctness and contrast checks still pass.
- Compared original44 resolved palettes to pre-addition commit da9f84e7: identical.
- Background browser token-preview board showed all20 together; visually checked
  colour diversity, text and candles. Temporary preview tab/server closed.
- Scoped ESLint and full84-page production build passed. Release verification pending.
- Existing workspace-precedence source assertion remains open in untouched code;
  signed-in Settings save/roundtrip and market-data/footprint launch gaps are not
  claimed resolved by this cosmetic task.

Release: pending one normal scoped main push and exact public SHA verification.
