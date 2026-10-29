# Entry/Exit drawing arrows: 40% smaller

Manual Entry Arrow and Exit Arrow drawings now render at 60% of their previous width, height and stroke. The shared display factor applies to existing, legacy, copied and newly placed arrows without rewriting their saved sizes or time/price anchors. Legacy size capture still stores the original unscaled measurement, preventing repeated shrinking on refresh.

Hit geometry and the resize tip use the reduced shape. Resize pointer deltas are converted back to the saved size units, so grabbing the handle does not change its size and a 20px drag still changes the displayed width by 20px. Existing viewport counter-scaling keeps the reduced arrows fixed in screen pixels during zoom/pan. Automatic trade-fill markers and toolbar icons are unchanged.

Validation: existing fixed-size tests updated to exercise 60% display extents across both directions and independent zoom/pan matrices; persistence, legacy capture and actual resize callbacks/cleanup pass. Existing entry/exit tool checks: 13/13. Scoped component/geometry/script lint and production build/TypeScript pass. Frontend-only release; no feed, order, account or recording changes.

Build housekeeping: the earlier agent-created `tmp/liq-cvd-baseline-2pglXa` source archive was accidentally included by the project's broad TypeScript include. This doubled source checking (first 1,536 MiB run exhausted memory; a 2,048 MiB retry identified missing relative files inside that isolated archive). Preserved the whole archive at `C:/Users/Karen/AppData/Local/Temp/kwantdesk-liq-cvd-baseline-2pglXa`, outside the project scan; baseline logs remain in workspace `tmp/`. No owner source or compiler configuration was changed. Clean build log: `tmp/entry-exit-smaller-build-clean.log`.
