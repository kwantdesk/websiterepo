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
