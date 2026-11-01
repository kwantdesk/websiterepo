# Bounce Levels hover information checkbox

Owner requests a setting to switch off the information popup shown when hovering over a Bounce level.

Expose **Show hover info popups** near the top of Bounce Levels' General settings, using the existing `tooltipsEnabled` setting. The control applies to mirrored and legacy Bounce instances, defaults on unless explicitly saved false, and uses the normal immediate settings update plus Save/discard/persistence workflow. Exclude the same key from the generic settings generator to avoid a duplicate control. Side-label visibility, GEX Map linking, source data, level rendering and other indicators' tooltip settings remain independent.

The existing Chart hover effect already checks this exact key, clears its current tooltip when false, cancels queued pointer work and removes the listeners; no renderer/feed change is necessary.

Validation: four actual full-workspace headless Chrome checks with isolated auth/preferences/history: one clearly labelled checkbox with existing on default; disabling leaves side labels and Map linking unchanged; off survives Save/reload; on can be restored and also survives Save/reload. Zero browser errors/external requests. Scoped ChartIndicatorsControl ESLint with2304MB cap passes. Existing Bounce settings/replay suites:15/16 pass; the pre-existing `saved custom GEX Bounce colours survive workspace theme relinking` source guard still expects the removed `preserveBounceOverride` variable in unchanged chartIndicatorConfig.ts, already absent from HEAD and previously documented. Do not modify unrelated palette code or claim that guard passed. Full Next production build passes.

One scoped main-only release to existing websiterepo-yfmi, followed by exact live SHA and deployed UI label verification. No backend operation, new polling/provider call path, data/account mutation or ALGO/native edit.
