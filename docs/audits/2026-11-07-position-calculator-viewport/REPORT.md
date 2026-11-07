# Position calculator viewport stretch

The active long/short tools render in ChartDrawLayer. Their persisted time/price anchors were not changed by this repair.

## Confirmed fault and repair

The smooth viewport compensation derived an affine SVG transform from two outer timeline points. When the timeline projection changed non-uniformly (for example around compressed gaps or other series), that transform could stretch a bounded calculator even though its own projected anchors had not moved proportionately. The existing timeline revision guard did not cover this case.

The render basis now captures each long/short calculator anchor. Before applying compensation, the layer checks the proposed transform against the current projection of those anchors. A mismatch or unavailable anchor rejects the transform and requests one exact redraw. Ordinary pan/zoom, including genuine large zooms, still uses immediate compensation. No arbitrary width cap, saved-coordinate rewrite, data request, or gateway change was introduced.

## Evidence and validation

- Controlled execution of the actual viewport callback reproduced the stretch: an outer endpoint moved 100x while the calculator's local interval remained unchanged. The previous callback applied the incorrect transform; the repair rejects it.
- 13/13 viewport/timeframe tests pass, including long/short anchor preservation through 1m -> 3m -> 1m, irregular timelines, missing projections, ordinary zoom/pan, and genuine 100x zoom.
- Position resize suite: 9/9 checks pass.
- Scoped ESLint: passes.
- Full isolated production build (`next build --webpack`) from the deployed baseline plus this repair: passes.
- The older position behaviour script fails its pre-existing assertion that labels default off. That source file is unchanged; the owner previously requested labels default on. Its unrelated expectation was not changed for this repair.
- The existing timeframe test harness was supplied its missing alignFixedMarkers stub; assertions remain intact.

This is a reproduced fault in the actual drawing callback, not a claim that the owner's precise live sequence was observed. No owner trading tabs, accounts, orders, or workspaces were operated.
