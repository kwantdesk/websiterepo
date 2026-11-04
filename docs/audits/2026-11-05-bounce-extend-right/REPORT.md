# Bounce Levels: Extend right

The Bounce settings panel now exposes the existing persisted `extendRight` flag, off by default. The shared Chart renderer passes it to BounceLevelsPrimitive, so the feature applies wherever the normal Bounce study is available.

Only a ribbon ending in the latest available exposure slice extends to the plot's right edge. The continuation holds that slice's mapped price, height, colour and opacity. Historical runs that disappeared before the final slice do not extend. Disabling the switch restores the original rendering. Replay continues to use its already clipped snapshot; this is a visual continuation, not future data or a new recorded observation. No new provider calls or recordings are generated.

All halo/body/core layers continue horizontally without the normal momentum taper. Hit regions cover the continued ribbons. The bitmap transform shortcut is disabled while extension is enabled so horizontal panning cannot translate the viewport-anchored endpoint away from the right edge; normal cached redraws remain in use.

Verification: 37 targeted tests pass, including final-slice/retired-run gating, exact constant closing geometry and colour, panning beyond the close, no recorded-data mutation, settings wiring, existing zoom, replay clock safety, projection alignment, prominence and alert markers. Focused renderer/settings ESLint passes. The full isolated webpack production build passes, including TypeScript and all86 static pages. Deployment verification is recorded alongside this report.

No gateway restart, subscription change, account/order/workspace mutation or backend deployment is required. Preserve unrelated dirty work.
