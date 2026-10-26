# Verified historical candle repair

Owner requested completion of the historical gaps/body/wick investigation.

Actual production evidence showed mixed complete History Plant root files and
partial exact-contract capture. History backfill had stopped with a saved login
permission error. The current separate History Plant login succeeds. Exact
provider minute replay for last week's five completed sessions was downloaded,
validated and compared before publication. Missing minutes are not interpolated.

Recovered scope: session-start dates2026-10-18 through2026-10-22, ten recorded
contracts: CME NQZ6, ESZ6, MNQZ6, MESZ6, RTYZ6, 6EZ6; CBOT YMZ6, ZNZ6;
COMEX GCZ6; NYMEX CLZ6.50 session files/68,503 actual minute bars,10,262,864
provider bytes. Compared with previous exact-contract files:3,272 missing minute
rows recovered,165 existing OHLC rows corrected,20 extra old minutes excluded.
Some gaps had already been partly masked by the root fallback; these counts
describe exact-contract files, not unique visible chart defects.

Backend:
- Completed minute-replay receipts are now authoritative like completed exact
  execution replays, preventing stale live/root/other-contract bars overwriting
  or filling them. Partial, active and legacy minute imports remain distinct.
- Reconciliation job uses bounded recent completed sessions/current recorded
  contracts, validates provider rows, publishes only after successful replay,
  keeps atomic replacements/backups, skips empty responses and repaired sessions,
  caps32MiB per run and stops the queue on authentication refusal.
- Hourly systemd timer enabled. A second real service run succeeded with0bytes
  and no writes/requests needed for the repaired sessions.
- Gateway only recreated using existing image/compose; other services retained.
  Active archive SHA256:
  4e316ccae568c7a598b0a3356a2565c2e45015a3065b3e192100183134b8967c.
  Rollbacks: /opt/kwantdesk/compose.before-history-repair-20261026.yml and
  /opt/kwantdesk/runtime-overrides/futures-bar-archive.before-history-repair-20261026.mjs.
- Original data/receipt backups:
  /srv/kwantdesk-recordings/history-repairs/2026-10-26T06-22-50-863Z/.

Frontend:
- Closed OHLC repair now inserts downloaded missing minutes within the loaded
  range; it previously mapped existing bars only, so could never repair a gap.
- A pane-scoped completed-history event updates the Chart observation buffer
  before React repaint. Corrected closed opens/closes and high/low can replace
  partial or stray live geometry; stale responses/ticks cannot undo that repair.
  Forming candles remain stream-owned and newer verified corrections can apply.
- Browser time-history schema v4 and durable time-flow v8 invalidate old copies.
  Saved drawings/settings/accounts are not reset.

Verification:
- Candidate archive:68,503/68,503 rows exactly equal provider replay,0differences.
- Running gateway HTTP:70checks,75,863 returned rows,0timestamp/OHLCV differences
  (all50sessions1m; NQ/ES additionally3m/5m compared to independent aggregation).
-509gateway tests pass;21frontend regression tests pass;8OHLC-heal scenarios
  and live visual-path checks pass. Production build and scoped lint pass.
- Systemd units verified; gateway healthy/authenticated after reconnect.

Limits: this verifies the stated five sessions/contracts, not every historical
month, unrecorded event-bar executions, options snapshots or every intraday
disconnect. No invented candles/wicks, provider secret logs, trade changes or
claim of signed-in visual acceptance. One scoped main-only frontend release.
