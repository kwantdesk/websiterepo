# Standard workspace loaders

Request: KWANTY and GEX DATA should use the site's standard loading screens,
not Loading Licensed Data text. This explicitly supersedes the earlier
quiet-only GEX DATA startup request, without changing quiet GEX VUE behavior.

React startup uses the existing compact KwantLoader. Same-origin embedded
charts use a shared compact presentation with matching theme, emblem, halo,
orbit, typography and reduced-motion support. Titles are Loading KWANTY,
Loading GEX DATA, or the tool name. Initial trades/profile pending states use
that presentation too. The shared DOM mount is idempotent and titles use
textContent, not interpolated HTML.

GEX DATA displays it only when the selected tool has no payload; refreshes and
pagination preserve existing content. Request identity guards prevent stale
responses hiding a newer loader. Errors clear the initial loader and remain
visible. KWANTY uses it for initial/selector loading, hides it when a payload
exists and replaces it with the actual connection error, including catalog
initialization failure. No new requests, changed polling, fake data or layout
mutation. KWANTY first paint also reads the correct host theme before styles.

Verification:

- 164 GEX DATA/reference and KWANTY integration regressions pass; 83 KWANTY
  reference regressions pass; three new shared-loader regressions pass (250).
- Scoped lint passes for changed runtime/host scripts and tests. The giant
  workspace change is a single dynamic fallback argument, not full-file lint.
- Local real completed-session Net Drift renders, with initial loader mounted
  then hidden correctly after the actual payload arrives.
- Full production build passes (84 pages, including TypeScript). Production
  receipt recorded after completion.

Standing unresolved: stable VPS transport; full-month futures/options history,
recording/backfill and offline gaps; Asia tape; weekly/footprint/CVD live soak;
GEX DATA forecast/aggregate/cadence parity; shared acquisition/cost/100+ user
capacity. Loading presentation is not a repair of these data-quality gates.
