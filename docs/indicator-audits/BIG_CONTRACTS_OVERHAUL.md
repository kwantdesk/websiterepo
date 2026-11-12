# Big Contracts overhaul

Tenth in the chart indicator checklist. Big Contracts draws qualifying executions as markers. Its Deep Contracts layer draws price zones. Each uses its own minimum size and visibility setting.

## Findings and changes

- Combine By Candle previously painted individual executions in real time and regrouped them later. Live and historical processing now share the same grouping rules, including volume-weighted price, side, and the per-candle cap. Combining applies to time intervals of one minute or longer.
- Retained Deep Contracts zones could outlive filter changes. Changing the threshold, zone dimensions, history window, contract or live/replay context now rebuilds or resets the retained zones.
- Added explicit selectors for regular and overnight threshold mode, intensity, volume cap behavior, marker shape, label and projection style. Projection width and opacity are editable. Controls that depend on a disabled layer explain what needs to be enabled. Editing a cap preserves Reject mode.
- The default 25–90% opacity range gives markers different opacity based on relative size. Equal minimum and maximum opacity gives uniform opacity. Marker size remains configurable separately.

## Verification

- 27 focused tests passed. They cover grouping, cap behavior, replay boundaries, history retention, settings availability and contract scope.
- An isolated browser rendered two controlled qualifying executions as one 125-contract marker at 100.30, observed after 4 ms in the local fixture. Diamond markers and dotted projections reached the renderer. Raising the Deep Contracts minimum removed old boxes. No browser errors were reported. This measures local rendering under controlled input.
- Read-only VPS archive checks used four recorded minutes for NQ, MNQ, ES and MES. They returned 5,030, 22,611, 10,149 and 4,087 executions respectively. At a 20-contract minimum, 4, 7, 13 and 1 prints respectively all anchored on 1m, 500-volume, 40-range and 100-trade bars built from the same recording. MNQ was paged in one-minute requests to avoid truncation.
- DeepChart documents a Big Trades study driven by trade size. Static inspection found a Big Trades accessor but did not expose its calculation. Its desktop behavior remains deferred. [DeepChart Big Trades](https://helpdesk.deepcharts.com/portal/en/kb/articles/deep-trades)
- Full provider-to-screen cadence, all contract and interval combinations, and archive completeness across the entire history range remain unverified.
