# Twenty deep-dark colour themes — 2026-10-19

Owner wants20 additional genuinely different clean dark themes: vivid colours,
deep purple with luminous purple accents; not pastel or tacky. Preserve existing
themes, sizing, formatting, application/saving and custom colour behaviour.

Added after the four foundation palettes in the existing Settings theme grid:
Velvet Voltage, Amethyst Noir, Royal Circuit, Black Iris, Obsidian Orchid,
Ion Cobalt, Sapphire Pulse, Abyssal Laser, Petrol Chrome, Emerald Afterhours,
Malachite Gold, Acid Obsidian, Black Gold, Ember Noir, Blood Moon, Garnet Circuit,
Fuchsia Carbon, Infrared Plum, Venom Aubergine and Plasma Lagoon.

Uses the existing complete theme-token factory: app/chart surfaces, grid,
crosshair, directional bodies/borders, accents, muted text and danger/actions.
No default selection change, UI layout change, animations, shadow filters,
provider traffic or changes to chart/feed logic. Existing Settings map exposes
them automatically and retains the existing apply/save path.

Checks:
-20 unique additions,64 total; no duplicate/near-identical background+accent
  triples against any palette. All20 have dark shells, saturated highlights,
  main text contrast>=7 and muted/primary/secondary/danger>=4.5 on every surface.
-25 focused theme checks pass, including all64 action/scrollbar/Liquidity Map
  palettes and live-theme synchronization. Wider theme suite29/30: the existing
  workspace-precedence source assertion expects an old preset-call pattern in
  unchanged KwantifyWorkspace.tsx. Do not call that baseline regression fixed.
- Liquidity Map test's stale query revision created separate theme module state;
  align it to palettes.js's current import. No runtime Liquidity Map code changed.
- Production build passed84 pages; scoped ESLint passed.
- Local token-preview board visually inspected all20 in the background browser;
  temporary tab/server closed. Not a signed-in Settings save/roundtrip test.

Release: pending single scoped main push and exact production SHA verification.
Ongoing historical-data/streaming/footprint acceptance and existing profile tests
remain on IMPORTANT-NOTES, not closed by this cosmetic addition.
