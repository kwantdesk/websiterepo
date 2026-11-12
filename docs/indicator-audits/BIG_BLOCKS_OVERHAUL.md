# Big Blocks overhaul

Eighth in the chart indicator checklist. The chart's futures effort zones use classified executed volume, price displacement, close location and rolling participation. The optional average uses Kaufman's adaptive calculation. The zone study and the separate Big Contracts execution markers have different inputs and purposes.

## Findings and changes

- Turning off Show Zones fed an empty list into the closed-zone latch. A chart could record genuine historical blocks as no-signal bars while hidden and then fail to restore them. A hidden renderer now leaves closed decisions untouched.
- A same-bar update without classified volume could erase the last valid forming preview. An unknown observation now preserves that preview, while a valid rejection still withdraws it and the next bar still settles it.
- The average-length control reached the zone/alert calculation but never reached the visible moving average. The plotted average and the alerts now use the same length-aware function, without running the zone scan for either path.
- The dialog now exposes the implemented average colour and line styles, moves sound and message controls to Alerts, and edits the saved message. It disables appearance inputs when their layer is off. Three label toggles with no renderer were removed from the dialog. The existing value-label switch remains and affects the actual chart value marker.
- The minimum and maximum absolute delta percentages now move together if they would cross, so displayed bounds match the applied filter. The active gradient now controls the moving average as well as the zones.

## Reference and validation

DeepChart documents a proprietary NQ 40-range model with preconfigured thresholds, separate zone and average styling, and directional alerts. KwantDesk applies its own documented effort calculation across instruments with classified inputs. Static REA on the installed DLL found partial metadata and no exposed matching model implementation. The DeepChart desktop settings and matched market replay remain deferred. [Deep-M Effort reference](https://helpdesk.deepcharts.com/portal/en/kb/articles/deep-m-effort-nq)

- 28 focused tests passed for live preview and closing decisions, geometry finality, event-chart reprojection, hidden-layer restoration, causal replay, alert controls, and the average renderer. The test fixtures for the two adjacent Chart effects were scoped to their actual callbacks.
- In isolated Chromium, the real chart primitive preserved its historical zone across visibility changes, rendered a changed average length, restored its dashed style, saved a custom alert message, and hid future blocks after a replay seek. A controlled qualified candle event reached the primitive in 34 ms with the parent candle snapshot fixed. Browser exceptions were zero.
- Provider-to-screen latency and archive completeness across all instruments and intervals remain unverified.
- The read-only VPS archive returned 26,549 executions in seven untruncated windows for NQZ6. After decoding the endpoint's signed numeric aggressor field, the chart enrichment classified all 28 one-minute bars. The sample produced zero zones at the tested settings. Replay preserved the exact average prefix and yielded no future-origin zones.
