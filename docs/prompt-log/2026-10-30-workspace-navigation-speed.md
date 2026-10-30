# Faster internal page navigation

Owner request: internal navigation, including News, spends too long showing a spinner. A trading platform must switch pages quickly.

## Confirmed browser-work bottlenecks

1. Every shared `TimeZoneSelect` built the complete world timezone option list on mount, while its dropdown was closed. Normalization and offset calculation repeatedly constructed native Intl formatters. This affected multiple workspace pages, not just News.
2. Calendar filtering constructed and validated an Intl formatter per event, over several passes through a 98-day dataset.
3. Economic Calendar returned a full-pane loader before its remote request completed. Cached calendar data was restored only in an effect, so it also missed the initial render.
4. Destination code was prepared on pointer/focus intent, which often gives only a few milliseconds before a click. Calendar entry also synchronously imported unrelated Macro/Financial Info components.

## Changes

- Closed timezone controls no longer build invisible options. Bounded validation and formatter caches reuse expensive Intl objects. Offsets are still calculated for each exact supplied date; no DST/offset values are cached across dates.
- Calendar day keys use a bounded formatter cache. Date/timezone behavior is preserved.
- Economic Calendar immediately renders its header, date/timezone/currency/impact controls and calendar structure. Only the event rows show a lightweight placeholder during the first fetch. Unavailable totals display a dash rather than misleading zero/no-event claims. Saved payloads initialize the first render.
- Calendar fetches honor the route's existing private HTTP cache; explicit Refresh uses `reload`. The button cannot start a duplicate first-load request. No refresh frequency was increased.
- Macro and Financial Info load only when selected.
- Authenticated workspace startup prepares destination code serially during idle time. It does not mount pages, prefetch RSC routes, call data APIs or start feeds. It pauses in hidden tabs, respects data-saver/2G connections and cancels pending work when the shell unmounts. Existing pointer navigation remains urgent and independent of imports.

## Evidence and checks

Measured actual shared-control server-render functions against pre-change commit `6d22ea26`, with fresh formatter caches:

| Isolated scenario | Before | After | Intl constructions before → after |
| --- | ---: | ---: | ---: |
| Three closed timezone controls | 426.41 ms | 2.45 ms | 5,064 → 2 |
| 2,000 calendar date keys | 272.81 ms | 8.63 ms | 4,000 → 1 |

These are isolated CPU measurements, **not end-to-end page navigation timings**.

- 20 navigation, calendar-sharing and new performance/behavior regression tests pass. They execute the actual timezone control and News component, compare timezone menus/legacy names/invalid inputs and DST boundary offsets, verify cached first render, HTTP-cache policy, serialized idle imports, cancellation and hidden/data-saver behavior.
- Additional liquidity-navigation suite retains one pre-existing obsolete iframe asset-version pin failure. The exact expected tag is absent in both unmodified HEAD and the working tree; no liquidity-map source was changed.
- Scoped lint passes for both helpers, timezone utilities/control and News. The large workspace receives full production compilation/typechecking rather than compiler ESLint, which previously exhausted memory. Full production build passes.
- Verify the main-only deployment and actual production SHA before reporting live.

No VPS/gateway restart, provider request fan-out, subscription changes, account/trade changes or recording changes. Signed-in owner-browser transition timing is not measured because that runtime is unavailable to the tools; do not claim instant loading for every data provider.
