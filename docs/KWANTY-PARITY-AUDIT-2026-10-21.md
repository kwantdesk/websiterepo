# KWANTY / Gexbot sequential acceptance audit

Owner requirement: work left to right, starting with Classic, then State and
Orderflow. Inspect each control and result, repair demonstrated faults, verify
the repair, then advance. Do not mark the job complete until the required
checks pass; do not substitute plausible visuals for missing native values.

Reference selected by the owner: open authenticated gexbot.com browser tab 11
(the spoken name was GexSpot). KWANTY: tab 10. Preserve account workspaces,
themes, live feed and request budgets. No new infrastructure or paid services.

## Acceptance checklist

Status: OPEN unless explicitly evidenced below.

| Order | Area | Checks | Status |
| --- | --- | --- | --- |
| 1 | Build identity | Current deployed shell/module, saved preferences survive | Old tab observed index v4; reload in progress |
| 2 | Classic selection | Ticker/search/favourites, spot/futures, aggregate/latest/next | OPEN |
| 3 | Classic values | Same ticker/category/source timestamp; levels, net GEX, max changes | OPEN |
| 4 | Classic visuals | Signed profiles, strikes, zero/major lines, labels, price candles/line | OPEN |
| 5 | Classic settings | Every toggle/style/width/opacity/scale/colour updates intended element | OPEN |
| 6 | Classic movement | Pan, zoom, Ctrl-wheel, reset, crosshair and exact scales | OPEN |
| 7 | Classic updates/replay | Source freshness, retained viewport, historical date/no lookahead | OPEN |
| 8 | State | Same seven checks, Greek and expiry mappings, independent/linked panes | OPEN |
| 9 | Orderflow sources | Genuine metrics, history coverage, latest/next, exact timestamps | OPEN |
| 10 | Orderflow visuals | Aggregate DEX, convexity/DEX, gamma, vanna/charm, combine/spot | OPEN |
| 11 | Orderflow controls | Every metric/expiry/style/window button, active vs linked panes | OPEN |
| 12 | Final verification | Production build, source checks, signed-in visuals, unresolved gates | OPEN |

## Evidence and findings

- Initial owner tab was still running `/kwanty-app/index.html?v=4#orderflow`,
  despite the outer `?botView=state` URL. It had the old floating controls and
  three-panel disabled Add Chart. Current repository index loads app v16.
  This is a stale-runtime finding, not proof the current overlay path works.
- Reference Classic initially SPX, 90d aggregate, spot, 1m, current live session.

## Completion boundary

No full parity claim yet. Source entitlement, sparse requested observations,
unrecorded history, private website-only fields and supported update cadence
must be reported separately from repaired rendering/control defects.

## First repair batch and evidence

- Runtime reloaded to current index v8/app v16 without clearing the owner's
  settings. Old tab index v4 was confirmed, not inferred from a screenshot.
- Classic SPX/90d/spot: both visible zero7704.17, major+7750, major-7680;
  OI majors8000/7650. Adjacent-second net values differ, so this is a level
  comparison, NOT exact simultaneous totals or cadence acceptance.
- Classic settings inventoried in the reference and KWANTY, including prior
  sizes, signed Volume/OI, price transform/alignment/timezone, spot/candles and
  historical major styles. Negative bar sizes and five prior-marker sizes
  were exposed but not connected; repaired with real Canvas tests. Greek
  negative sizes now inherit the actual positive/default size in the editor,
  preventing untouched Save from shrinking them.
- Native SPX Orderflow response at15:01:29Z contains zcvr5227.97, zgr5217.09,
  zvanna-38.74, zcharm-6.32, agg_dex1535.30 and all three flow fields. Latest
  and next fields are present. No reconstructed values or numerical offsets.
- Both standalone KWANTY and embedded Options Flow request hosts rejected
  `/api/kwanty/session`; neither whitelist was updated when restoration was
  added. Repaired both; regression executes the actual standalone guard and
  embedded request pool, retaining origin/operation restrictions and dedupe.
- Genuine single-point major overlays painted only moveTo/stroke (invisible).
  Now paint an isolated observed dot, never a made-up backward level line.
- Historical403/404 may restore exact ticker/date saved observations;401/429
  never masked. Explicit recorded-session/observations-only provenance retained.
- All8 Orderflow metrics exercised through the real renderer for latest, next,
  both and combine cases in deterministic tests. Browser before repair showed
  candles plus isolated latest observations; no saved-session curves.
- Reference State Gamma settings inventory matches exposed public Greek
  controls. Reference live screenshot major long7778.700/short7734.290;
  earlier native snapshot7778.880/7734.480. Different observation times, NOT
  an exact numerical comparison. Reference sidebar date itself remained10/19
  while the live time/expiry controls advanced; do not copy that date defect.
- No gateway restart or provider polling/cadence changes. No paid resources.

## Remaining acceptance failures / unknowns — do not tick off

1. Classic current-session zero/major trails before page load are absent:
   current records are browser observations, not a restored whole session.
   Owned gateway Classic history SPX/gex_full/2026-10-20 returned403
   UPSTREAM_ENTITLEMENT_REQUIRED. `/snapshot?...view=majors` returns a single
   genuine latest snapshot, not a history series; cannot substitute it.
2. State call/put classified volume variants and Classic historical marker
   drawStyle modes from the shipped reference are not fully implemented.
   Do not fabricate public-API-absent classified splits. Reference State bar
   proportions also differ from current saved/default KWANTY sizes.
3. Positioning is still30s client/15s route REST. Gateway status confirms
   websocketAllowed=true but streaming=false: native WS has not been
   negotiated because it modifies the shared API slot. No private website
   socket/token was reused or new connection opened during this audit.
4. Orderflow archive contains accepted observations, not every reference
   update. Restoring it cannot prove full-session coverage or exact curve parity.
5. UI pan/Ctrl-wheel, full all-settings live mutation, full-session/long-soak,
   replay and cross-device acceptance are not all complete. Existing focused
   engine/control tests are not replacements for these runtime checks.

Validation: 242 focused KWANTY/reference tests pass after version assertions
were advanced with the asset chain. Scoped lint has zero errors and the one
unchanged OptionsFlowToolPanel cleanup warning. Release/browser receipt follows.
