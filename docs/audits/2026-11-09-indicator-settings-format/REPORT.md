# Unified chart indicator settings format

Reference: Weekly Volume Profile. Every chart indicator uses one shared layout: Visible, Colours, one settings tab rail, active settings. The same theme tokens, card corners, tab sizing and field sizing apply throughout.

## Implementation

- Replaced per-dialog outer-tab routing with IndicatorSettingsLayout. Common visibility and colour controls stay outside the active settings page. Existing control callbacks and saved keys are retained.
- Merged Volume Profile's inner tab strip and its extra outer sections into one rail. Extra sections remain reachable; clicking a profile tab reactivates the profile settings without leaving another tab selected.
- TPO and Weekly TPO follow the same header/menu order. Their restored session controls remain available.
- Footprint's scheme picker is above the menu; detailed colour controls stay in Colours and its existing template-save controls are under General.
- Linked Bounce Levels uses its actual GEX Map palette in the common colours position; source, follow/link, nodes and other existing settings stay below the menu. The standalone GEX Map settings dialog keeps its original default presentation.
- Volume keeps its actual plot-colour and theme controls above the menu. Its engine intentionally ignores gradients, so no nonfunctional gradient picker was added. A legacy gradient setting no longer disables its real plot-colour control.
- Visibility switch thumb uses contrasting theme tokens, including monochrome themes.

No indicator definitions, calculation engines, numerical defaults, session boundaries or saved account/workspace data were removed or rewritten.

## Verification

- Isolated real Chrome catalogue walk: all 108 catalogue indicators; verifies exact header order, one menu, each menu tab reachable, exactly one selected tab, visibility toggles affect actual component state, and common controls remain rendered across tabs. Full per-indicator ledger in catalogue-observations.json.
- Representative desktop (900px dialog) and phone (358px dialog) checks pass for Weekly Volume Profile, TPO, Volume, Footprint and Bounce Levels; light and dark monochrome screenshots reviewed.
- 12 focused tests pass: actual rendered shared layout, scheme and individual-colour persistence, TPO quick sessions and exact daily boundaries.
- Broader settings-window source test: 14/15 pass. Its existing failing assertion expects saveFootprintSettings(settingsInstance.instanceId, validated); the existing implementation uses liveInstance.instanceId. The saving call was not changed by this task.
- Scoped ESLint: zero errors; one existing GEX Map colour-slider aria-valuenow warning.
- Final isolated production webpack build passed, including TypeScript and page generation (tmp/indicator-layout-build-release.log). Exact live commit verification is retained locally in production-release.json after deployment.

The catalogue walk verifies settings presentation, navigation and visibility. It is not a new audit of every indicator's market-data calculation or every control's financial meaning.
