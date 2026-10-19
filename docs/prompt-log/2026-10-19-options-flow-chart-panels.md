# Options Flow Tools as Charts/GEX VUE grid panels — 2026-10-19

## Owner request

Make all GEX DATA, KWANTY and GEX BOX tools available from the chart panel's
content picker below the existing workspace/tools sections. A selected tool
fills its grid cell and mirrors the original tool's behaviour and adjustable
settings. Disable normal chart Indicators for these non-price-chart panels.
Examples: Implied Volatility Rank, Positioning Classic and Positioning State.

## Implementation

- One namespaced catalogue of51 selectable tools/views:22 GEX DATA, four
  KWANTY (including expiration calendar) and25 GEX BOX. Expandable category
  below Market & Order Flow; grouped by original source, not51 duplicate
  entries in the ordinary overlay-indicator catalogue.
- Reuse actual `/gex-data-app` and `/kwanty-app` controls/renderers/templates
  through frame-scoped hosts; standalone page hosts remain untouched. Reuse
  actual GEX BOX ToolSurface and settings dialog, not screenshot recreations.
- Dedicated pane state is included in runtime/preset normalization. Duplicate
  settings diverge independently; changing a tool cannot mutate the source
  page's workspace. Self-contained GEX Flow and GEX CAL carry their own state
  through the outer pane too. Calendar-wide account preferences stay shared.
- Tool content is not chart content. Replaced ordinary Indicators control with
  a native disabled button so pointer AND keyboard cannot open/install chart
  overlays. Existing chart indicators and calculations are unchanged.
- Match exact futures families to initial options underlyings; SPXW aliases
  SPX. Unsupported families use the source tool's visibly labelled SPY default,
  not an empty selector or a claim that SPY is that future's own options chain.
- Account-isolated request sharing: four concurrent,32 pending,48 cached
  responses /24m text-character cap,35s whole-request deadline, source cache
  headers capped five minutes and15s error response suppression. No timer in
  the pool. Final host release aborts/clears; original tools own polling and
  visibility. GEX BOX retains its existing shared feed path and hidden-page
  gate. No VPS restart, environment/credential change or new paid service.
- Chart clicks inside iframes activate their owning panel; pane identity stays
  stable and tool settings writes do not depend on price ticks or viewport motion.

## Verification

- `node --import ./scripts/alias-hook.mjs --test` over new options-flow-panels,
  GEX DATA integration, KWANTY integration and all GEX DATA reference suites:
  100 passed. Includes exact source catalogue parity, actual workspace pane
  normalizer, independent duplicates, exact family matching, request coalescing,
  account isolation, queue/concurrency limits, disabled UI boundary and an
  executed GEX Flow hydration/save effect proving no default overwrite or
  source-page local-storage write for an embedded pane.
- GEX BOX15 tests, workspace-layout8 checks, GEX Flow deterministic math and
  GEX BOX dashboard architecture checks pass. Indicator registration audit:
  126 registered/no orphan gates; not evidence of live vendor formula parity.
- Scoped lint zero errors;22 existing workspace/dashboard warnings plus one
  current-iframe-ref cleanup warning. Cleanup intentionally targets the current
  iframe generation (it does not exist when the host effect first mounts).
- TypeScript check passed. Final complete84-page production build passes,
  including self-contained Flow/calendar persistence and iframe Activity resume.
- Offline loopback fixture serves the REAL static app code with synthetic
  host status and explicit unavailable market data: no provider calls. Browser
  changed IV Rank lookback365→252, opened original KWANTY settings, toggled
  GEX Volume, saved, selected State, and changed theme live. Independent host
  stores each reported their own saved key. Narrow two-panel controls stayed
  usable. Fixture tab/server closed. This is not real signed-in chart-grid,
  provider calculation, full zoom/data or cross-device save acceptance.
- React Activity hide/resume creates a fresh iframe generation bound to the
  new host; cleanup first marks the previous host inactive and pauses the
  previous frame. This prevents resumed frames retaining a disposed host.

## Remaining acceptance / dependencies

Signed-in end-to-end add/resize/duplicate/save/reload and multi-panel live soak
remain unverified. Unlicensed/unsupported source tools keep the SAME explicit
unavailable state (notably Exposure Forecast); embedding does not invent data
or create entitlements. Existing futures/options history, stable public live
streaming, weekly completeness and footprint/live capacity gates remain open.
November multi-user direction remains: central ingestion, licensed distribution,
shared bounded fan-out, durable recordings/backups and measured capacity/cost.

Unrelated native, ALGO, Socials/gateway, PDF and older release-note changes were
preserved. Only task files will be staged in one normal main push.
