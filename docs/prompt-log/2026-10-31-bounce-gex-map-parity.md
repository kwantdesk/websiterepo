# Bounce Levels as a linked GEX Map projection — 2026-10-31

## Request and finding

Bounce Levels must present the same underlying nodes as GEX Map, with matching defaults and settings, wherever the indicator is attached. The owner reported a positive SPX 7635 node on the map which was absent from Bounce.

Read-only inspection of the VPS's existing October 30 exposure archive confirmed that node. No provider requests, subscriptions, deployments or restarts were used to collect this evidence.

| Archived SPX front-expiry gamma surface | Per $1 move | Per 1% move |
| --- | ---: | ---: |
| Captured at (UTC) | 2026-10-30 22:03:44.696 | 2026-10-30 22:02:21.518 |
| Source spot | 7560.68 | 7560.68 |
| Nonempty strikes | 279 | 279 |
| 7635 call exposure | 3,660,537 | 277,398,476 |
| 7635 put exposure | 0 | 0 |
| 7635 signed net | +3,660,537 | +277,398,476 |
| Absolute-exposure rank | 29 | 29 |
| Star strike | 7560 | 7560 |
| Star signed net | −1,944,459,945 | −147,014,383,197 |
| 7635 magnitude / Star | 0.1882547% | 0.1886880% |

These are two separately captured provider representations, not a home-made unit conversion. They verify the saved post-session surface, not the owner's unspecified intraday observation time.

The old 10% exposure-population filter retained ceil(279 × 0.10) = 28 nodes. Rank 29 was excluded. Separate default minimum-strength/relevance gates and the field/level-count caps could remove additional map nodes. Bounce also used a different expiry window and per-1%-move convention, and its old colour link could prefer interval history over the newer live strike ladder.

## Implementation

- Default Bounce rendering now consumes the same GEX Map endpoint, cache identity, row filter/order, snapshot reconstruction, raw signed values, Star selector and structural-node model. There is no separate top-percentile, relevance or 24/64-node cutoff in the mirrored view.
- Stock defaults: front expiry, per-$1 move, Structural OI, Star view and one-minute comparison. All nonempty map nodes remain in the data. Full illuminates all nodes; Star/Ninja apply the map's own emphasis/dimming. Source strike is unchanged on the same underlying.
- A prominent **Import & Link GEX Map Settings** button leads Bounce settings. Linking is on by default. The source-aware editor shares expirations, units, model, Greek/column, comparison interval, view, node settings and palette with Map. Its node/palette editor is the actual shared Map settings component.
- Linked changes propagate across mounted consumers, browser tabs and restored preferences. Closing another map does not discard the last settings for an earlier source. Map layouts/instruments remain local; their settings do not overwrite another map's instrument set. An instance can unlink its core/node settings and relink later.
- AUTO resolves identically in the chart and editor: direct options symbols, the map's NDX/QQQ column for NQ/MNQ, SPX/SPXW/SPY for ES/MES, and IWM for RTY/M2K. Missing unsupported source selection produces no invented substitute.
- Gamma alone can use Dealer Inventory. Other Greeks remain Structural OI. Both consumers now use the same effective-model cache key and strictly validate symbol, Greek, scope, representation, model and requested session. A map's actual model is shown beside its spot price, including inherited settings.
- Fixed a restore-order race in Map: a simultaneous scope/model/column restoration could reapply a stale column ref and briefly request the old Greek. Layout-phase ref synchronization and readiness gates prevent that request.
- Colours use the map's common signed magnitude scale. Compact currency formatting is shared, including decimal precision; percentage labels retain the map's denominator. Tooltips identify actual units, model, source/mapped strike and recorded exposure time. Mirrored tooltips do not display fabricated touch counts or unavailable 5/15-minute ROC readings.
- Historic bands retain their own node colours. Removed/sign-changing nodes create separate runs; a vanished node's old run is not extended to the current right edge. Text labels avoid collisions without removing bands or data.

## History, projection and resource use

The live map response is deliberately compact: its comparison checkpoints are not a full historical tape. Bounce coalesces one full session bootstrap into the existing bounded workspace cache, then uses compact live refreshes and shares new responses with mounted maps. Historical refresh failure does not erase a valid current ladder. A visibility gap can trigger one session repair; failure retries are delayed. Closed-session refresh respects the source's slower cadence.

Prepared history is cached and unchanged prefixes are reused when minutes or paired prices arrive. Cache lineage uses weak references so old versions do not form a permanent retention chain. A synthetic 279-strike × 390-minute local workload exercised 108,420 nodes: one measured warm refresh was 2.69 ms and an appended minute 7.12 ms. These are local adapter measurements, not a network/rendering SLA.

For NQ/MNQ/ES/MES/RTY/M2K, cross-instrument historical projection uses a coalesced, bounded one-minute CME price read for the selected session. It does not use the containing five-minute/hour candle's open or its future final close. This makes historical placement independent of the host chart timeframe. These are minute-granularity basis/ratio projections, not identical instruments or tick-exact hedge prices. An unavailable historical paired price is not replaced with a future/live quote.

Replay uses the host chart's clock and selected session. It never substitutes latestStrikes for an earlier clock. Comparisons and classifications match Map even after sparse/final exposure observations. A carried-forward known ladder can be reclassified using the clock's already-known price; recorded exposure time remains separately identified. Page navigation, layouts and independent replay clocks are not global measurement settings.

Legacy Bounce calculation/API code is retained for compatibility; the visible Chart indicator defaults to the new map projection. No changes were made to trade execution, accounts, journals, feed subscriptions or gateway runtime.

## Skylit evidence and limits

Saved research exists for Heatseeker and Trinity:

- [Heatseeker runtime/parity observations](../skylit-heatmap-parity.md)
- [Trinity reconstruction audit](../research/skylit-trinity-gex-reconstruction-2026-08-21.md)

Those notes include reference observations and explicitly document that simple OI/volume/aggressor proxies did not reproduce the proprietary signed dealer inventory exactly. Fitted reference coefficients must not be treated as a verified production formula. No verified Atlas capture/dataset was found in the saved documentation search.

This change establishes Bounce-to-our-GEX-Map parity. It does not establish our Map-to-Skylit proprietary-model parity. Model descriptions now identify Dealer as a reconstructed estimate rather than an actual proprietary participant-position feed.

## Validation

- 34 local parity checks, including all 279 strikes from both private archived SPX front surfaces and the actual positive 7635 values. The private full licensed surfaces remain in temporary local evidence and are not committed; that optional evidence check is skipped when absent.
- Synthetic checks cover weak nodes beyond old caps, raw net/call/put fidelity, zeros, ties, live-head precedence, four Greeks, scopes/units, role/view/colour parity, replay cutoffs, disappearance/reappearance, sparse/final observations, aliasing, futures mapping, paired-price arrival, incremental history reuse and independent source settings.
- 15 isolated Chrome scenarios using the actual Map, shared editor, Bounce hook and canvas primitive: 12-panel request coalescing, painted 7635 hit region, two-way settings, per-instance unlink/relink, Greek/model routing, AUTO resolution, separate maps, reload persistence without a wrong-Greek request, cross-tab storage propagation, scroll-stable portaled menus, Purple/Mono/light themes, 390px layout and equal historical projections on 1m/5m NQ charts from one price-history request.
- Existing Bounce engine tests and 48 legacy palette combinations pass.
- Map defaults, Star, velocity, replay window, node detail, expiry/unit and text-contrast regressions pass. Older source-location assertions were updated to follow the shared settings/snapshot modules; opening-surface coverage now executes the shared reconstruction.
- Scoped lint: zero errors; the existing colour-drag-bar ARIA slider warning remains in the extracted shared editor.
- Final production build must pass before the scoped main-only push. Production deployment and actual live commit identity are verified separately before reporting completion.
