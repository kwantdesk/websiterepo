# Existing failing suites — baseline triage

All failures below reproduce on untouched commit 7c84abd6ccb91cc4ce34ee5a46311da85036815d. Baseline reproduction establishes that this release did not introduce them; it does not prove the affected functionality is correct. Existing assertion debt and the performance concern remain open. Tests were not weakened to obtain a green total.

123 dedicated suites: 101 pass, 22 fail. Six support suites: three pass, three fail. The 24 targeted regression tests, nine slider checks, interval-builder matrix and isolated production build pass.

| Suite | Baseline | Current | Finding |
|---|---|---|---|
| speed-of-tape-instant | Fail | Fail | Source-string assertion expects an earlier implementation shape. |
| vwap-family | Fail | Fail | One assertion requires the removed Anchored VWAP indicator card; numerical calculations pass 9 of 10 checks. |
| delta-ladder | Fail | Fail | Source-string assertion expects an earlier implementation shape. |
| indicator-history-depth | Fail | Fail | The 20,000-bar fixture exceeded its 8 ms budget (approximately 9.7 ms). This remains a performance concern; reproduction on baseline is not a performance pass. |
| fixed-range-volume-profile-levels | Fail | Fail | Label assertion expects hardcoded toFixed(2); current implementation uses instrument-aware formatting. |
| volume-profile-split | Fail | Fail | Expects three named sessions; four sessions now reflect the owner-requested Globex/Asia distinction. |
| volume-profile-grouping | Fail | Fail | Source-pattern assertion references earlier markup or implementation. See baseline result; update the assertion separately after preserving its intended behaviour contract. |
| volume-profile-gradients | Fail | Fail | Requires an obsolete preset label. |
| volume-profile-labels | Fail | Fail | Expects off-screen labels clamped against the edge; later owner instructions requested that labels not cling to chart edges. |
| initial-balance-timeframe | Fail | Fail | Source-pattern assertion references earlier markup or implementation. See baseline result; update the assertion separately after preserving its intended behaviour contract. |
| profile-indicator-parity | Fail | Fail | Source-pattern assertion references earlier markup or implementation. See baseline result; update the assertion separately after preserving its intended behaviour contract. |
| tpo-default-visuals | Fail | Fail | Source-pattern assertion references earlier markup or implementation. See baseline result; update the assertion separately after preserving its intended behaviour contract. |
| volume-profile-session-filter | Fail | Fail | Source-string assertion expects an earlier implementation shape. |
| indicator-settings-save | Fail | Fail | Source-string assertion expects the old fixed-header markup. |
| indicator-opacity | Fail | Fail | Assumes every mark is fully opaque, including deliberately subdued backgrounds and shifted POC marks. |
| indicator-colour-controls | Fail | Fail | Source-pattern assertion references earlier markup or implementation. See baseline result; update the assertion separately after preserving its intended behaviour contract. |
| cvd-candle-direction | Fail | Fail | Includes an obsolete assertion for two Volume colours, superseded by the requested single plot-colour control. |
| indicator-both-sides | Fail | Fail | Includes an obsolete assertion for two Volume colours. |
| value-area-rows | Fail | Fail | Source-pattern assertion references earlier markup or implementation. See baseline result; update the assertion separately after preserving its intended behaviour contract. |
| volume-profile-count | Fail | Fail | Source-pattern assertion references earlier markup or implementation. See baseline result; update the assertion separately after preserving its intended behaviour contract. |
| indicator-side-colours | Fail | Fail | Requires the removed Solar Flare preset. |
| value-area-percent | Fail | Fail | Source-pattern assertion references earlier markup or implementation. See baseline result; update the assertion separately after preserving its intended behaviour contract. |
| indicator-templates | Fail | Fail | Fifteen store/import/export checks pass; final assertion looks for the preference whitelist in userPreferences instead of its current shared accountPreferenceKeys module. |
| indicator-visibility | Fail | Fail | Requires the removed Chromey Mono theme; all-current-theme visibility check passes. |
| no-native-controls | Fail | Fail | Requires an earlier GexMapDropdown declaration; native-select/native-colour checks pass. |

Numerical/renderer/data limits are documented separately in REPORT.md. These failures are not silently marked as verified indicators.
