# Vercel cost containment — 2026-10-20

## Request and authority

Owner wants unnecessary spend reduced, authorises an automatic spend-triggered
pause, then confirms they have set the spending cap themselves. No numeric cap
or pause-setting readback was obtained; no billing mutation performed by agent.
No purchases, new infrastructure, plan changes or manual project pause.

## Evidence

Authenticated CLI usage for Oct 17–Nov 17: live project roughly 75.09 GB origin
transfer ($4.89), 19.98 active CPU hours ($2.59), 732 build CPU minutes ($2.56),
213.01 GBh memory ($2.28). Gross usage is not the incremental invoice: the team
also has credits and a fixed subscription. Do not extrapolate a monthly bill
from a short development burst or claim those values are all overages.

A bounded newest-3,000 request sample covered 22:54:54–23:21:53 UTC Oct 19,
not the full hour: dark-pool-map 447, friends 276, bounce-levels 217, oanda 173,
market-indices 130. Counts alone do not attribute bytes, CPU or dollars.

## Implemented

- Shared workspace fetch forced `no-store`, bypassing heavy-route private ETags.
  Browser requests now use `no-cache`: every existing refresh contacts the server,
  and an unchanged surface can return a bodyless 304. Browser transparently
  supplies its validated body to JSON consumers. No slower polling, new shared
  cache, changed source, guessed prices or fabricated data. Forced refresh uses
  `reload`; server fetch remains uncached. Deadline/retry budget is preserved.
- Desktop-only source previously counted as shipped in the website build gate.
  Exclude `native/` from that gate and Vercel deployment input; mixed website
  changes still build. Existing main-only deployment and duplicate-project
  disconnection remain untouched.
- Updated stale cost-test assertion from heatmap asOf to its actual revision,
  which includes replay bounds; added native-only/mixed build tests and request
  cache-mode regression coverage.

## Verification and remaining work

Verification: 5 request/deadline/initial-load tests, 12 deploy-cost checks and
7 workspace byte-budget checks passed; scoped ESLint and diff whitespace checks
passed. Final local production build passed, including TypeScript and 84 generated
pages. Production release receipt appended after completion. No measured post-change
dollar savings claimed. The proxy's long-lived execution/price streams and
fallback requests still incur Vercel runtime/transfer; fully addressing that
requires supported direct gateway transport, not a hidden live-data downgrade.
The private laptop collector/recordings were left running and unchanged.
Stable VPS, full month futures/options history, archive gaps, Asia missing tape,
CVD/footprint/profile soak, GEX parity/cadence and 100+ user capacity remain open.
