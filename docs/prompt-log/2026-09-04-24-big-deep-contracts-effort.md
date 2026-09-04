# Big Contracts, Deep Contracts and Deep Effort

## User request

Compare Deep Charts Big Trades/Deep Trades with KWANTDESK Big Contracts,
consolidate both behaviors into one simple indicator, verify filter, minimum
order size, wick/box placement, clustering, centering, sizing and interaction,
then audit Deep Effort against Big Blocks. Both studies must update instantly
from live market data rather than waiting for an indicator refresh.

## What changed

- Added `Show Big Contracts` and `Show Deep Contracts` to the existing Big
  Contracts indicator. Existing workspaces migrate with markers on and Deep
  contracts opt-in, so charts do not unexpectedly change.
- Added Deep-contract minimum trade, box tick height, cluster tick margin,
  projection length, opacity and border settings.
- Added execution-tape Deep-contract calculation, stable retention across tape
  compaction, close-cross projections and direct live admission.
- Expanded Big Blocks with minimum/maximum delta percentage, maximum Delta
  Effort, minimum bars, average length, entry-zone range and extension controls.
- Moved forming-bar Big Blocks updates onto the direct Rithmic candle event and
  canvas primitive path.
- Updated the Rithmic setup note to state the active historical sources are
  Rithmic History Plant and the recorded archive, not Databento.

## Outcome

Big/Deep contract prints no longer wait for the indicator sampler. Big Blocks
also responds to the forming executed-volume candle rather than a delayed
React snapshot. Exact calculation and production evidence are recorded in the
companion audit and below after deployment.

## Verification

- Deep Contracts/Deep Effort focused regression passed.
- Big Contracts filter and live-edge regressions passed.
- Big Blocks width regression passed.
- Shared numeric-slider regression passed.
- TypeScript passed.
- Optimized Next.js production build passed, including all 80 routes.
- Scoped lint passed for all changed calculation/config/test files. ESLint on
  the pre-existing 14k-line `Chart.tsx` exhausted 8 GB in isolation; the same
  file passed TypeScript and the production compiler.

## Deployment

Pending feature commit, single production build and live-route verification.
