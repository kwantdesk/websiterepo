# Kwanty / GEX Bot detailed re-audit — 24 October 2026

## Verdict and scope

**Full one-to-one acceptance remains OPEN.** This is a fresh controls/source/
archived-data audit with targeted repairs, not a certificate for every vendor
snapshot, pixel, ticker or live update. The owner's “GEX box” reference is the
already open signed-in GEX Bot website (tab11), not the retired internal GEX BOX
page. KwantDesk fonts, theme colours and cockpit chrome intentionally remain.

Work proceeds Classic → State → Order Flow; each row below names the evidence
boundary instead of treating an existing green test as browser equality proof.
No provider login/socket negotiation, gateway restart, subscription, paid
resource, cadence increase, trading action or owner-data deletion was performed.

## Fresh evidence

- User reference inspected through browser UI: Classic controls/settings,
  same-session close, colour/style subdialogs; State Gamma controls/settings;
  all eight Order Flow metric choices, three profile slots, all profile source
  choices, alignment/width/origin/opacity/bar width/vertical offsets/layout.
- Reference Classic SPX/aggregate/21October/15:59:59NY showed spot/zero7757.22,
  volume majors7750/7760/net-347.5035, OI majors7900/7650/net50.9459 and five
  max-change strikes7760. The isolated patched actual app showed identical
  headlines and timestamp against the real VPS archive. It is not live proof.
- Production browser history GET initially failed **504
  MIDDLEWARE_INVOCATION_TIMEOUT**, request
  `syd1::rgxxr-1792772727642-6bd5db3fd998`. This is an authentication-routing
  failure, not proof of absent provider history. A bounded direct VPS read of
  the same selection succeeded200/3,471ms with15,739 summaries/79pages.
- Re-ran the existing explicit archive comparator at
  `2026-10-23T16:32:57.192Z` (24October Brisbane). Original SPX ZIP SHA256
  `ea63ccc0b8610903cfe76979561cc4459ecda48c7b85104ba69421393d41fe1b`.
  All15,739 Order Flow rows and251,824 latest/next metric values equal originals.
  Classic gex_full and State gamma_zero/charm_zero each match15,739 summaries;
  first/middle/last pages total539 exact full profiles per selection. The other
  profile pages and selections are NOT certified by this sample.
- The source itself has7,659 absent second slots. These remain absent.
- Existing observed reference SPX Net Convexity15:57/1m is-26181.28. The40
  genuine archived observations average-26181.28225; patched Line mode now
  emits one point rounding exactly to that number, last actual spot7760.55.
- REA retained shipped-source evidence (historical capture, not freshly
  identical runtime digest): parent
  `ev_98ecf2e576f58fa855637080848df37e9a344c4e08ec85c117ee066428ab88f2`,
  main.f5205cc4.js module16235, helper offset357120, conversion offset359987,
  zero/call/put callsites362000 onward. Partial static graph, no vendor code
  executed. It establishes trailing300-observation MA, conversion-before-mean,
  warm-up divisor and two-decimal output, plus raw scatter. Fresh UI confirms
  Scatter / Line (300 MA). No literal loopback CDP endpoint was available for
  REA runtime capture; browser UI evidence is CUA, not fabricated REA Evidence.

## Sequential tool and control ledger

“Implemented/tested” below is not synonymous with matched private-browser data.

### Classic

| Tool/control | Evidence and disposition |
| --- | --- |
| Ticker, search, A–Z, recents/favourites | Shared selector inspected; account-scoped directory/shortcut tests pass. Recents/favourites are intentional KwantDesk additions. Full instrument catalogue entitlement is not certified. |
| Spot / futures / contract selector | Explicit cash/futures identities retained. Historical ES/NQ underlying-price bridge currently refuses dated futures reads: OPEN, not equivalent to native contract replay. |
| 90d aggregate | Fresh SPX21October closing headlines match; all summaries and539 sampled full profiles match original archive. All other observations/pages remain outside this numerical certificate. |
| Latest / next | Separate gex_zero/gex_one scope and tuple model/settings are tested. Fresh every-strike browser equality for these categories remains OPEN. |
| Signed volume / OI profiles | Native tuple fields, signs, independent widths, visibility, priors and raw units exercised in actual renderer tests. No inferred classified split substituted. |
| Zero, volume and OI major levels | Same-session closing values match; price conversion remains separate from exposure units. Full moving-level session pixel comparison remains OPEN. |
| 1/5/10/15/30-minute priors / max changes | Fresh close headline matches for all five. Independent prior size/visibility tests pass; full private per-strike/time matrix OPEN. |
| Zero/positive/negative history | **REPAIRED:** previously raw lines only. All three now support raw Scatter and exact finite-input Line(300MA), defaulting unset styles to line. Conversion precedes averaging/rounding; replay prefixes cannot borrow future observations. |
| History style/opacity/size/colour | Fresh source subdialogs and own fields inspected. Independent renderer/settings tests pass. Null prices deliberately remain gaps, not reference Number(null)=0; this safety difference is explicit. |
| Price candles / line / interval | Genuine OHLC bridge retained; no positioning spots promoted to exact OHLC. Chart type and interval remain separate from metric bucketing. All-ticker vendor OHLC equivalence OPEN. |
| Alignment / multiplier / offset / timezone | Existing geometry/invertible-hit tests pass; no exposure rescaling or source-date timezone relabelling. Full interactive browser matrix OPEN. |
| History load / seek / speed / play | **REPAIRED:** requested envelope and every raw row date/category checked before merge can hide a wrong session. Missing/incorrect profile pages stop playback, not false success. |
| Settings save/reset, screenshot, templates | Existing local persistence/export contracts retained; new Draw Style is saved through existing style schema. Cross-device save and every reference layout interaction OPEN. |
| Alerts / tutorial / pop-out playbar | Reference exposes these; matching implementations/behaviour are not established here. **OPEN**, not silently counted as equivalent. |

### State

Each offered selection is separately listed; the two checked native selections
do not establish parity for every Greek or expiry.

| Selection | Numerical evidence / gate |
| --- | --- |
| GEX aggregate | Native renderer/selection contract tested; complete private call/put classified volume equivalence OPEN. |
| GEX latest | Same boundary; no invented classified splits. OPEN browser equality. |
| GEX next | Independent category tested; OPEN browser equality. |
| Delta latest | Native mini_contracts mapping and prior controls tested; OPEN exact full-session browser comparison. |
| Delta next | Separate expiry mapping tested; OPEN exact full-session browser comparison. |
| Gamma latest | All15,739 summaries and539 sampled full profiles equal original archive; prior closing browser evidence spot7757.22/long7744.130/short7750.550. Full private series/pixels OPEN. |
| Gamma next | Separate native expiry model tested; OPEN browser equality. |
| Vanna latest | Signed native values/priors tested; OPEN browser equality. |
| Vanna next | Independent expiry tested; OPEN browser equality. |
| Charm latest | All15,739 summaries and539 sampled full profiles equal original archive; full private browser curve OPEN. |
| Charm next | Native model tested; OPEN browser equality. |

State controls audited: long/short gamma majors, positive/negative Greek bars,
5/15/30-minute priors, call/put skew, expected move, candles/line, transforms,
alignment and timezone. Public API absent classified fields are not manufactured.
Expected Move remains an independently implemented formula, not a fresh exact
vendor acceptance result. Existing square candle/right price-axis/crosshair/
Ctrl-wheel/pan tests pass. State drawing rail, multi-panels and peer links are
KwantDesk additions, not proof the reference has identical layout/features.

**REPAIRED:** each target panel's actual selected observation now owns its
price cutoff in replay; inactive charts cannot borrow the active panel's later
price clock. State and Classic share raw-session validation. Existing drawing
tools are not reimplemented; exact VAP on generic cash/options instruments and
historical futures-price integration remain source limitations.

### Order Flow

| Tool | Native fields, expiry and rendering evidence |
| --- | --- |
| Net Convexity | zcvr/ocvr; all archived raw values equal; the observed1m reference mean now matches exactly. |
| Net GEX | zgr/ogr; all archived raw values equal; latest/next/both/combine model tests pass. Full private curve comparison OPEN. |
| Net Vanna | zvanna/ovanna; all archived raw values equal; no invented combine counterpart. Full private curve comparison OPEN. |
| Net Charm | zcharm/ocharm; same boundary, separate expiry. Full private curve comparison OPEN. |
| Aggregate DEX | agg_dex/one_agg_dex; real supplied call/put child series only, no invented split. Full browser child-series match OPEN. |
| DEX Orderflow | dexoflow/one_dexoflow; raw lineage passes; bucket sums/threshold masks tested. Full native minute sum comparison OPEN. |
| GEX Orderflow | gexoflow/one_gexoflow; same boundary. |
| Convexity Orderflow | cvroflow/one_cvroflow; same boundary. |

- **REPAIRED:** every metric's selected interval applies in both Line and
  Candles. Exposure uses mean, flow uses sum, spot/major carry only actual
  observations. Empty buckets aren't fabricated. Unspecified-interval pure
  model access remains raw for source-lineage auditing.
- Latest/next/both, combine/spot, signed series, individual widths/visibility,
  threshold families, period windows and themed candles are tested through
  real models/renderers. Private visual equivalence for every combination is
  still OPEN. Existing snapshot-spot interpolation is not exact exchange OHLC.
- Active-only ticker/timeframe/type controls and linked-group/crosshair
  semantics remain panel-owned; source pools coalesce identical tickers.
- **REPAIRED:** nonempty minute-sampled session fallback is no longer permanent.
  Existing coordinator can admit a later exact EOD report after bounded partial
  cache expiry; errors retain valid rows. No new timer/poll rate. Exact validated
  EOD stays cached. Wrong-session/category restoration is rejected before merge.

### Profile overlay tools (all three independent slots)

| Source choices | Evidence |
| --- | --- |
| GEX aggregate / latest / next | Correct native State volume / Classic OI boundary retained. |
| Delta latest / next | Native State mini_contracts, independent slots/settings. |
| Gamma latest / next | Same plus genuine long/short levels and priors. |
| Vanna latest / next | Native fields, no synthetic historical surface. |
| Charm latest / next | Native fields, no synthetic historical surface. |

**REPAIRED:** historical, paused or pinned overlays use exact-session manifests
and lazy profile pages, not today's last snapshot or the1,200-row observation
cache. Shared six-selector session pool, two concurrent reads, twelve profile
pages; no full-profile-per-pointer fan-out. Marker search is logarithmic and
snaps only to actual observations. Playback waits for enabled profile pages;
failed or incomplete declared pages stop honestly. Hidden slots do no work.

Fresh reference controls match width25/origin50/opacity100/bar-width85 defaults,
left/center/right alignment and anchor-to-price. Added its seven vertical-offset
actions -10/-5/-1/reset/+1/+5/+10 alongside existing slider, same persisted
offset. Layout sync/reset/save-default/load-default remain. Load session is an
explicit on-demand archive action; reference Load today was disabled in the
observed state. It is not labelled a full historical-coverage guarantee.

## Delivery, performance and remaining acceptance gates

1. **Cadence not1:1:** positioning still30s client/15s route REST, not every
   reference push/ms. Native websocket negotiation changes the shared API slot;
   not enabled blindly during this audit or replaced with a billing-heavy poller.
2. **Production auth failure:** known read-only Kwanty operations now avoid the
   duplicate middleware remote refresh after valid site access. The route still
   independently requires getRouteActor; POST/unknown paths/ungranted access
   do not bypass it. This removes the observed duplicate gate, not an exemption
   from account auth or proof the auth service can never time out.
3. **History breadth:** only retained/available native reports; provider newest
   EOD is not arbitrary90-day history. Minute fallback is observations-only,
   absent source seconds remain absent. All-ticker/month/off-box restore gates
   in IMPORTANT-NOTES remain open, as do gateway overload/recorder-drop soaks.
4. **Visual completeness:** full all-ticker/expiry/frame private comparison,
   alerts, pop-out and long multi-panel browser soak are not certified. Source
   truth is more important than painting plausible missing overlays.
5. Classic MA now caches normalized/averaged history by weak source identity,
   six bounded transforms/styles; app retains raw trail arrays across hover
   paints. Actual900-row/20-paint test proves no repeated source reads. This
   is a focused allocation check, not a whole-browser FPS guarantee.

## Verification / release

- Whole Kwanty/reference suite:297/297 pass after updating exact cache-revision
  gates and executing the new shared trail helper in the renderer harness.
- Adjacent middleware/site-access/cookie/desktop tests pass; account guard is
  still before route data access. Scoped ESLint0errors/one unchanged existing
  OptionsFlowToolPanel cleanup-ref warning.
- Actual isolated app loads real SPX21October Classic history and underlying
  OHLC from the VPS; matching headlines and visible MA trails/profile/candles.
  Screenshot: tmp/kwanty-classic-reaudit-20261024.png. No owner state writes or
  live subscriptions. Local fixture lacks the React drawing host, so it cannot
  certify production State drawing tools.
- Production build passed: Next compilation, TypeScript and all84static pages.
- Isolated State and Order Flow browser checks also loaded actual21October
  history. Gamma latest overlay reports native state/gamma_zero at3:59:59PM
  and paints on Net Convexity; screenshots in tmp/kwanty-state-reaudit-20261024.png
  and tmp/kwanty-orderflow-reaudit-20261024.png. This is bounded archive QA,
  not proof of live cadence or every ticker/category/pixel.
- Release SHA and signed-in production browser receipt follow after deployment;
  do not infer deployment from these local results.

The older untracked snapshot audit/script and unrelated dirty native/social/
gateway/docs work are preserved; they are not swept into this commit.
