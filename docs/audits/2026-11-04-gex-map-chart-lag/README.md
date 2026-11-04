# Charts beside embedded GEX Map: render isolation

Owner report: adding GEX Map beside a live price chart makes Charts lag heavily.

## Confirmed cause

The host recreated the embedded map's onStateChange function on every workspace render. GexMapWorkspace uses React.memo, but the changed callback invalidated that boundary. Its ExposurePanel children then rebuilt all strike-row JSX despite unchanged exposure data. Paused replay also received a freshly allocated externalReplay object on unrelated host renders. A no-op configuration acknowledgment returned a newly mapped workspace array, causing more unnecessary parent work.

## Change

WorkspaceGexMapPane is a small memoized boundary around the existing lazy-loaded surface. It receives stable scalar identities and the existing stable component, binds a stable per-pane state callback, and memoizes the external replay object. The host configuration handler returns the original state array when the pane configuration is unchanged. Timezone, actual replay-clock changes, pane settings and market changes still propagate. Internal GEX Map fetches/state updates continue normally; no update interval, market-data logic, geometry, exposure calculation, indicator or visual style was changed. The surface's props type is exported only for the adapter's compile-time contract; the heavy surface remains lazy-loaded.

## Evidence

An isolated Chromium harness runs actual Workspace, price Chart and GEX Map, with three 240-strike columns (720 rows). Auth/data are fixtures, all external network is blocked. Test-only AST instrumentation counts real GexMapWorkspace and ExposurePanel renders. Thirty host updates emulate unrelated parent commits while the map payload remains unchanged.

- Negative control recreates the prior inline-callback behavior: 30 additional map renders and 90 ladder renders.
- Fixed boundary: zero additional map or ladder renders for those same 30 host updates.
- Clicking 2m persists the changed map configuration to the owning workspace pane.
- A subsequent changed fixture response updates the actual strike-row text. The map is not frozen to achieve the render reduction.
- Four focused tests verify stable prop identities, replay timestamp/timezone/settings forwarding, latest callback routing and the actual no-op parent-state handler.
- 17 focused isolation/compaction/replay-timezone tests pass. Scoped adapter lint passes. Full Next.js production build passes.
- Broader legacy GEX suite: 24/31 pass; seven failures reproduce against unchanged HEAD sources (20/27 without the four new passing checks). Six are old source-pattern assertions; frozen-surface test imports an old unavailable export. These are not reported as passing or silently rewritten in this task. Relevant rendering file has only its props type exported, apart from the new adapter usage in Workspace.

This proves and repairs redundant UI work; it does not certify every possible browser/GPU/network delay. Performance counters are an isolated integration result, not a guaranteed latency for every user's hardware. See control.json, fixed.json and side-by-side.png. Reproduction sources are scripts/audits/gex-chart-performance-*.

No feed/VPS/terminal restart, subscription reset, production chart refresh, account/trade modification, new dependency or per-tick cloud traffic. Preserve pending unrelated GEX Data, native and ALGO work. Release only the scoped main change through the existing production integration, then verify the exact live commit.
