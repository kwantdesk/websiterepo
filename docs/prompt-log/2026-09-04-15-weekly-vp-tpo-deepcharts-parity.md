# Weekly VP and TPO DeepCharts parity

## User request

Apply the completed Daily Volume Profile improvements and DeepCharts parity to Weekly Volume Profile, then overhaul Daily and Weekly TPO so their logic and settings follow the same reference. Keep indicator navigation in consistent locations and prevent the settings window from resizing or jumping when tabs change.

## Diagnosis

- Daily and Weekly Volume Profile already entered the same renderer and style mapping, but their public numeric-setting contracts had drifted on profile width and there was no regression test preventing further drift.
- Daily and Weekly TPO already shared the same auction calculation engine, session scheduling, POC/value-area, initial-balance, single-print, summary and merge logic.
- The TPO presentation surface was missing DeepCharts' separate Blocks/Profile type, independent Show Text control, and Automatic/Combined visual styles.
- TPO settings sections returned inside React fragments were not discovered by the shared page navigation, so controls could land on the wrong page.
- The dialog used content-driven height. Changing pages changed its dimensions and moved the navigation under the pointer.
- Developing TPOs reused a stale grid for five seconds. Rebuilding all exact-trade history more frequently would also be unsafe: the benchmark measured about 0.8 seconds for five sessions / 124,200 prints.

## Fix

- Locked Weekly VP's numeric settings to the Daily VP contract and retained only the deliberate weekly period behavior.
- Added TPO Blocks/Profile rendering, independent Show Text, and Automatic/Solid/Hollow/Line/Combined visual styles with saved-setting migration.
- Put TPO controls into the same stable General, Background/Text, Plot, POC, Value Area, Peak/Valley, Single Prints, Summary and Filter/Split navigation model.
- Made every indicator settings dialog a fixed responsive 900 x 760 shell with fixed header/navigation and independently scrolling content.
- Flattened settings fragments so every declared section appears in the shared navigation, and reset the active section when switching indicators.
- Replaced the five-second TPO hold with a 250 ms bounded live cadence. Only the developing profile is rebuilt; completed profiles are retained.
- Added a parity regression test covering Weekly VP, Daily/Weekly TPO, migration, fixed dialog geometry and live-refresh safeguards.

## Verification

- Direct DeepCharts settings audit: fixed dialog/navigation structure and profile/TPO control taxonomy confirmed.
- `npm run test:profile-indicator-parity`
- `npm run test:tpo-settings-wired`
- `npm run test:tpo-default-visuals`
- `npm run test:tpo-single-prints`
- Volume-profile session, data, grouping, level-chain and overhang tests.
- `npm run bench:tpo-build`
- `npx tsc --noEmit --pretty false`
- `npm run build`

## Outcome

Weekly VP is contract-locked to Daily VP; Daily and Weekly TPO now share the upgraded DeepCharts-style controls and renderer; settings navigation no longer jumps; developing TPOs update responsively without recalculating completed history on every tape change.
