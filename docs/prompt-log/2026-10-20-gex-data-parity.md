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
