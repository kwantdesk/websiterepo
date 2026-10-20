# Multiple KWANTY State panels — 2026-10-20

## Request

Add multiple State charts like Orderflow, with different charts/tickers,
linking, favourites and related workspace controls.

## Implemented

- Header Add Chart; separate ticker, GEX/Greek selection and expiry, candle
  interval, line/candles and full display settings per State chart. Header and
  sidebar follow the selected chart; each panel has viewport/cursor links,
  reset, settings and close. Sidebar selects/reveals a panel or changes its
  profile. Scrollable stack with resize separators; no three-panel State cap.
- Close/restore retains nested settings and placement. Final panel cannot be
  closed. Current/closed State panels and active ID are saved in the existing
  account workspace and template exports; existing single-State scope/settings
  migrate into one panel. Orderflow layout and three-panel policy unchanged.
- Existing account instrument favourites, searchable ticker dropdown, recents
  and filters are reused. Favourites are shown next to timeframes in State too.
  Selecting a favourite that already matches the active ticker still updates
  different linked peers, without reloading unchanged data.
- Viewport-linked interval/type/ticker edits affect only the linked group.
  Profiles and styles remain independent. Time navigation shares across tickers;
  price navigation/cursor prices require identical ticker and price conversion.
  Other instruments project time-only cursor guides, never a foreign price.
- One shared source per ticker/category and price owner per distinct ticker;
  concurrent reads coalesce, snapshot concurrency is two, healthy refresh stays
  30s and error backoff60s. Removed sources abort/release; hidden/disposed State
  work stops through existing lifecycle. No new gateway, endpoint, polling timer
  per panel, provider login, server restart or faster paid-data polling.
- Existing retention and source identity checks remain. Date/category mismatches
  fail rather than populate the wrong chart. No synthetic candles or positioning
  curves; unavailable archive sessions are not fabricated.
- Offscreen charts skip paints; scroll schedules a redraw. Genuine price ticks
  schedule coalesced canvas updates, not sidebar DOM replacement. Focus switching
  never scrolls the panel underneath a pointer-down/control click.
- Fixed startup race uncovered in QA: before profile arrives, price-only chart
  uses real observed close rather than empty0..1 geometry. Automatic linked
  viewport seeding waits for loaded profiles and authoritative price history.
- Static module/CSS/standalone/embedded versions updated together.

## Verification

- 222 KWANTY/reference tests pass (13 new State panel/source/handler cases).
  Covers migration, deep-copy settings, >3 restore, active/linked controls,
  ticker and selector isolation, exact cursor/viewport transforms, no foreign
  price linking, coalescing, request concurrency/backoff, historical dates,
  lifecycle, add/close/restore order and startup empty-range protection.
- TypeScript --noEmit passes. Scoped ESLint: zero errors, one pre-existing
  OptionsFlowToolPanel cleanup ref warning at line100. Whitespace check passed.
- Actual application browser fixture, in-memory account bridge and labelled
  synthetic data only; no owner settings, orders, storage or provider writes.
  Reproduce: `node scripts/serve-kwanty-state-axes-fixture.cjs`, `/panels` on4924.
- Initial QQQ/gamma + NDX/delta made2 snapshot reads and2 price subscriptions.
  Adding duplicate QQQ/gamma caused neither another read nor another feed. Then
  independent third-panel tickerSPY/3m left both existing charts unchanged.
- Linking charts1/3 and selecting5m/Line/QQQ changed only that pair; NDX stayed
  1m and its own style. Chart3 then selected Vanna while chart1 stayed Gamma.
  Saving Grid off on Vanna left Gamma Grid on and retained Line in the dialog.
- Reopening restored3 charts with distinct profiles and links. Closing NDX
  removed its subscription; restore brought backNDX/Delta/1m. Fourth panel added
  successfully without another NDX feed or duplicate selector request.
- Two linked QQQ State profiles showed identical499.93 and Oct20 11:30:57 GMT-4
  cursor labels. Reopening after the startup fix correctly retained500-scale
  data, not the placeholder0..1 range.
- Screenshot: tmp/kwanty-state-panels/proof/linked-state-panels.png (isolated QA).

## Release / remaining

Pending scoped main deployment verification. Existing supported VPS/transport,
full-session options archive entitlement, month history/recording, missing Asia
executions, full indicator soak and GEX parity/capacity/cost gates remain OPEN.
Multiple panels do not grant faster vendor entitlements; distinct selectors
still require their normal shared data requests. No zero-cost claim.
