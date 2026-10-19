# Keep only the owner's seventeen themes — 2026-10-19

The owner explicitly listed themes to keep and requested removal of all others.
This supersedes the earlier20-theme and profile-gradient-theme additions.

Canonical names, in the requested order:
1. Midnight Cockpit
2. Kwant Desk
3. Mr. Quant
4. Retro Terminal
5. Inverted Mono
6. Mono Protocol
7. Paper & Ink
8. Bubblegum Blueprint
9. Sakura Slate
10. Vermilion Sky
11. Cherry Soda
12. Orchid Voltage
13. Matcha Plum
14. Electric Lemon
15. Tidepool Glass
16. Cobalt Clay
17. Playdough Parade

Normalized obvious spelling/spacing variants to existing names; no recolouring.
Removed58 unlisted definitions/generators from themePresets and removed now-unused
gradient-card metadata/rendering. Original Volume Profile gradient catalogue and
indicator controls remain untouched. No forced theme/default reset or deleting
saved/custom colour snapshots. Previous catalogue recoverable at b613bc5d in Git.

Verification:
-27 focused theme tests pass. Exact17-name/order whitelist, complete tokens,
  current default, controls, live sync and independent12-scheme profile catalogue.
-14 script checks pass: hollow-candle support/brand contrast/first-paint parity.
  Legacy removed presets are test fixtures, not catalogue requirements.
- Compared all17 resolved colour objects against previous HEAD: identical.
- Scoped lint and full84-page production build pass. Release verification pending.
- Signed-in Settings/cloud roundtrip remains unverified. Existing workspace
  source-pattern failure and history/streaming/footprint/weekly launch gaps remain
  open and are not repaired or hidden by this catalogue edit.

Release: pending one scoped normal main push and exact public SHA verification.
