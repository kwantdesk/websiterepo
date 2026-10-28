# Active trade protection persistence — 2026-10-28

## Request
Owner reports an active trade's stop loss disappeared while the position remained open.

## Reproduced fault
`mergeTradingAccount` selected a whole open-position object whenever both local and remote account execution state had changed. A target edit or partial target fill carried an unchanged null/old stop, overriding a concurrent new/moved stop. The reverse direction discarded a target edit. This is a verified loss of protection state, not merely a chart colour or hidden marker. Six of the first seven actual merge regressions failed before the fix, including null replacing a new stop.

## Change
Merge stop intent against the acknowledged base independently of position/quote/fill fields. Merge targets by identity, with independent price/quantity edits and monotonic filled quantities. Preserve explicit removals, closed-position authority, reset/deletion semantics, accepted fill deduplication and exact protective execution. Same-field concurrent conflicts retain the existing local-edit policy; no timestamp-based intent guessing.

## Validation
81 focused tests pass: 11 new regressions plus device sync, sync controller, placement/navigation restoration, priority execution, tape, order receipts, accounts and durable journal recording. Tests exercise real order placement, partial fills, actual preference merging and exact stop fills in both merge directions. Scoped merge-module lint passes. Full 1536MiB-capped production build and TypeScript pass (exit 0).

## Limits
No owner position, account, stop or target was edited for testing. No missing historical stop price is guessed/restored. No claim that this reproduction is the proven cause of the owner's individual incident or that a broker-side stop was cancelled. Chart off-screen rendering is unchanged. No VPS gateway restart, provider connection, added polling or Vercel streaming route.

## Standing open work
Owner trading-tab visual acceptance, deferred backend performance activation, Footprint first-open transient, full vendor parity/archive coverage, off-box backup and browser-owned unattended demo protection remain separate open items.
