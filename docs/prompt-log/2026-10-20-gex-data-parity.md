# GEX DATA one-to-one audit

Request: compare every tool to the owner's open licensed reference, matching
data, precision, trades, movement and interactions; fix and recheck sequentially.

Read-only browser/source/API investigation and partial Net Drift pass are in
../GEX-DATA-PARITY-CHECKLIST.md. No claim of complete library or live parity.

Implemented Net Drift compatible-timeline canvas/navigator updates, historical
page/global date override polling pause, underlying legend/plot colour alignment.
No provider credentials, raw licensed datasets, fabricated values, numerical
offsets, new infrastructure or faster Vercel polling introduced.

Verification:106 focused/integration/reference tests pass (6 new regression
tests). Full production build passes,84 pages generated. Production release
verification is recorded below when known. The live parity audit is incomplete.

Isolated browser QA uses tests/fixtures/gex-data-live-chart.html, served on
loopback only with synthetic rows and no provider calls. Both revision/append
checks PASS: canvas and navigator DOM identities retained, maximum grows, and
a keyboard-cropped viewport end9 remains9 through an appended interval. This
is interaction regression evidence, not evidence of live-feed numerical parity.

Release receipt: bbc99a10357cc2ae955a0b0ae0476f136dc9ce9d pushed once to main;
websiterepo-yfmi deployment dpl_A1Rqvx9mKzjALJPir2AqYsSxh9H4 READY. Uncached
production diagnostics returns that exact commit. No manual deployment.

Later visible cadence sample14:39:13.575–20.886UTC: reference legend changed
approximately every2s, ours did not change in that7.3s window. Faster live
delivery remains unresolved, as do exact bucket/comprising-trade reconciliation
and21 other tool acceptance gates. Restored reference current session and
multi-panel view, cleared our temporary page-date override; kept All moneyness
for like-for-like live comparison. Synthetic tab/server closed after QA.

Follow-up discovered during production acceptance, not assumed fixed: at
14:40:39–14:41:09UTC a live refresh preserved cropped end171 but lost focus.
Root cause: parent storage writes echo into tool frames and the preferences
handler rebuilt even with unchanged filters/display settings. Added signature
guard preserving real configuration/theme/filter updates.107 tests now pass;
synthetic browser QA with actual localStorage feedback and750ms settlement
confirms canvas/navigator nodes retained. This corrective release is needed
before claiming end-to-end continuity; faster live data remains unresolved.

Corrective release: dad8de0aaa6d671f270e2ec2d83cab5d2628640a; deployment
dpl_BwMLhXKoVZUpk7wrdN14hGnUGyG7 READY; uncached production diagnostics
returns that exact SHA and browser loads app.js?v=6. Local full build again
passes84 pages. Second scoped release was necessary after the first live
acceptance exposed the storage-echo rebuild path; no manual deploy or bypass.

PRODUCTION CONTINUITY PASS:14:47:51.973–14:48:33.687UTC, navigator end170
retained keyboard focus and end170 across a live data refresh. Calls changed
14.67M→14.69M, puts11.79M→12.57M, spot768.10→767.84; no visible error.
Restored full-session view after this check. This proves the scoped continuity
fix, not fast updates, exact raw bucket/trade equality or whole-library parity.

## Full-catalogue sequential continuation

Owner explicitly required every currentGEXDATAtool in order, not per-tool
approval stops. Compared all22catalogue rows against the signed-in reference,
using isolated loopbackQA and actual licensed responses through the existing
gateway. Detailed evidence/remaining gates live inGEX-DATA-PARITY-CHECKLIST.md.

Fixed: full-market selectors; DarkPooldatecontract/displayordering; pagination
statistics retention; canonical ORmultiselect filters and missing settings;
money/count/ratio/DTE/IV/exchange precision; fractional strike ticks; option
volume grid; underlying/navigator domains; MarketSharegroup ordering and pie
label collisions; exposure split legends, expiration years and net overview;
datedETF terminal latest control; IntervalMap default5m; MaxPainTimepointlabels;
NetDrift underlying/volume domains; real unconsolidated print drilldown and
millisecond timestamps. No numeric offsets or manufactured source data.

New request-budget wiring shares one bounded/coalesced account scheduler among
gatewayRESTconsumers, respecting RetryAfter and upstreamquota. Source/tested
only; no existing gateway restart, credentials, tunnel, DNS or paid service
changes. This does NOT provide privatewebsite-stream entitlement or remove
the30sclientfloor/15sBFFcache; fastliveparity remains OPEN, not concealed.

154focusedtests,26budgettests, scopedESLint and84pageproductionbuild pass.
Prior fullgatewayrun445/446 had a separately reproduced untouchedsession-
profile-archive coldworker timeout; not represented as allgatewaytests passing.

Still OPEN: forecast adapter unsupported by connectedlicensedAPI; confirmed
private/public aggregatedConsolidatedFlow andSPXGainers populationdifferences;
all-toolfastlivecadence/soak and deeper rawbucket/mode/interactionacceptance.
Standing notes unchanged: stableVultrtransport, monthhistory/recordingbackfill,
missingAsiatape, footprint/weeklyprofile/CVDsoak and hundred-usercost/scaling.
