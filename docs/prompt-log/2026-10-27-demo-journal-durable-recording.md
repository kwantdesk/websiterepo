# Demo journal recording — 27 October 2026

Owner: preserve the existing “20 october” $50k demo account and record every
demo account in Journal. Do not delete/reset/recreate the trading account.

Observed read-only in the live owner session:
- Demo account “20 october”: starting50,000, balance43,545, realised-6,455,
  one open position, zero retained exit fills.
- Journal already contains a linked “20 october” account with16 closed rows,
  including26October, net+7,585. The balances are not reconciled; those totals
  cannot be used to fabricate missing entry/exit records. Existing journal and
  demo account preserved. Merely making the name visible is not a recording fix.

Fixed:
- Closing a position now copies actual fills/entry context into a durable
  journal-evidence lane on the account ledger. It survives all chart-fill
  clearing paths, demo-ledger reset, JSON persistence and preference syncing.
  The demo reset still changes only its intended trading figures; journal reset
  and explicit journal deletion guards continue applying independently.
- Journal backfill reads that durable lane plus available legacy fills,
  deduplicating by execution ID and indexing entries once per account.
- The Charts journal writer uploads new paper rows/accounts immediately after
  its local save, rather than waiting until Journal is visited. Successful rows
  are acknowledged in memory; failures retry on the next close, focus or online
  event. No periodic feed/polling added.
- New authenticated append-paper API mode validates the owner against the
  current session and inserts only missing trade IDs. It cannot overwrite
  existing reviews/notes with another browser's older copy.

Validation:
-27 targeted journal/link/details/reset/deletion tests pass.
-14 existing paper-journal script checks pass.
-Expanded execution/legacy integration run:57/62 pass. The same five stale
  source-regex integration failures reproduce against unmodified HEAD (16/21),
  confirming no newly failing integration expectations.
-Scoped ESLint passes; production build checked before release.
-Release853978bb READY and exact public SHA verified, gateway healthy. After
  reloading the owner Journal, “20 october” increased from16to17closed records
  without an agent-placed/closed trade. The new27Oct00:24local NQ stop exit has
  entry29,374.50,exit29,355.25,size2,P&L-770,duration2m. Existing16rows remain.
-Request-log verification caught403responses from the temporary username used
  before preferences finish hydrating. Follow-up skips all non-UUID owners
  client-side; the authenticated UUID key change triggers the deferred sync.
  Owner-bound API validation remains in force.41tests/scoped lint pass again.
-Screenshot: local visualization demo-journal-recording-20261027.png.

Limits: existing cleared/missing fills were not reconstructed from account P&L.
No actual owner trade was opened/closed to test this, and no account, balance,
position or journal was deleted/reset/recreated. Live UI verification checks
the existing linked journal after release, not a claim of recovered lost trades.
