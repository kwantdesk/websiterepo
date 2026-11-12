# Bounce Levels overhaul

Catalogue item 13. This pass covers the default GEX Map mirror and the existing custom-mode regressions. Full completion is open.

## Findings and changes

- Each newer exposure frame could restart the futures-price effect while the previous owned-history read was in flight. The cleanup discarded that read and the chart could stay blank while the next request was pending. A regression advances exposure before the route returns and confirms the original result is still accepted. The reader now keeps one in-flight request per mounted scope and checks whether the new exposure minute needs prices. Identical pane requests share the existing cache. Missing live minutes retry at the 12-second history cache cadence. Completed replay keeps the fixed requested date and does not poll after a successful read.
- A linked source with no matching map column could display Gamma in settings while requesting the chart's old standalone metric. Both paths now resolve the same source, column and metric. A linked column's Greek takes precedence, a linked source without a column uses Gamma, and a standalone chart retains its selected Greek.
- A standalone Bounce settings panel exposed three GEX Map table controls with no effect on its chart: the table's signed/percentage switch, raw value visibility, and live row animation. Its role-label toggle also duplicated the chart's independent side labels without changing them. Those controls now appear only when the editor is linked to GEX Map. The chart still uses the separate side-label switch and signed values. Its air-pocket switch remains available.
- Updated stale tests to supply the real route dependencies, exercise persisted custom colours directly, and require a matching recorded price pair. The test for missing pairs now checks both live and replay and uses a paired live positive control.

## Evidence

- 73 targeted tests pass. They cover source and interval selection, exact recorded minute pairing, live handoff, replay cutoff, closing-window calibration, right extension, labels, prominence, palettes, and zoom. Synthetic colour checks cover 44 scheme, theme and map combinations.
- Isolated Chromium rendered the projection and exercised zoom and a backward replay step. The paired fixture reported 69 hit regions, zero mapped-price error, zero matched pixel difference, and no browser errors.
- A separate 390 px headless settings check confirmed table-only controls are available while linked and hidden after unlinking. Air pockets, side labels and right extension remain available. No browser errors were reported.
- The webpack production build passed.
- Prior NQ production evidence in the [9 November audit](../audits/2026-11-09-bounce-nq/REPORT.md) uses recorded QQQ and NQ prices and a captured options surface. It demonstrates the special 16:00–16:15 New York calibration path. The [right extension audit](../audits/2026-11-05-bounce-extend-right/REPORT.md) verifies that only the last available slice extends and preserves its closing geometry. These captures do not establish coverage of each instrument or date.
- DeepChart's public DeepGamma documentation describes exposure visualized by strike and distinguishes model types. This supports keeping source, model, signed exposure and calibration explicit in the KwantDesk comparison. Bounce Levels projects those exposures onto price charts, so cross-product conversion also needs a common observed minute. [DeepGamma heatmap documentation](https://www.deepcharts.com/helpcenter/deepgamma-web/article/option-gex-heatmap-deepgamma-web)

## Open checks

- Verify the full interactive settings matrix, live provider arrival timing and archive coverage per source, date, chart product and supported interval. The isolated browser uses deterministic inputs. Recorded coverage and availability vary and an absent matched price must not be reconstructed.
- Continuous futures mapping uses the owned minute history selected by the chart root. The underlying shared bars adapter strips explicit contract suffixes on its ordinary bars path. Verify the distinct delivery path and historical contract identity before claiming specific-expiry or rollover mapping.
- Verify equivalent DeepChart settings and live/historical behavior during the deferred desktop pass. Published information does not expose the proprietary model implementation or certify exact parity.
