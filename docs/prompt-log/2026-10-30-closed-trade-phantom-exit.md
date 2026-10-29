# Closed paper trades: prevent stale protective exits and restored markers

Owner: manually exit a trade, remove all fills, then price reaches the former SL/TP and an exit triangle reappears.

## Reproduced cause

The normal single-ledger quote processor already ignores closed positions. The sync path did not reliably preserve that terminal fact. An older peer could produce an SL/TP against its still-open copy. Protective and manual exits share an economic fill ID for the same cumulative quantity. Merge admitted a canonical exit but returned a different raw visible fill with that same ID, restoring a triangle at the stale SL/TP. If the local ledger matched the sync baseline, the preference merger skipped reconciliation entirely and could restore an old open position. Storage/hydration also replaced the live ledger without reconciliation. Marker removal had no durable identity tombstones.

Initial actual-engine reproducer: 7 of 8 cases failed before changes; direct single-ledger closed-position behavior and valid remaining-quantity protection were controls, not reasons to hide genuine executions.

## Corrections

- Per-account `clearedFillIds` persists exact removed marker identities. Normalization infers legacy removals from journal fills absent from visible fills; membership uses a Set and IDs are sorted to avoid sync churn. Clear operations preserve durable journal evidence and never cancel unrelated orders/open-position protection.
- Recorded journal fills take precedence over duplicate visible records. Committed execution facts remain immutable; concurrent unacknowledged copies choose the first actual execution deterministically. Visible fill records use the accepted canonical execution rather than a conflicting peer object with the same ID.
- Closed positions, already-exited quantity and terminal entry orders cannot regress under a stale peer. Journal entry/exit evidence protects older ledgers even if their closed position row was removed. Conflict-aware merge policies run even when local equals the baseline. Legitimate stop/target changes, new trades, balance adjustments and explicit account resets remain supported.
- P&L reconciliation accounts for the peer's change relative to all baseline journal P&L. A missing/repriced old exit is not misclassified as a cash adjustment. Closed positions remain zero-quantity; partial closes retain only genuinely open quantity.
- Both actual workspace storage and preference-hydration callbacks reconcile incoming state with `paperLedgerRef.current`, not a sampled React render. Cloud preference merging also reconciles ledger execution conflicts when no new local preference edit is present. Unchanged quote-only state keeps live local watermarks.

No hypothetical price fills, blanket marker suppression, deletion of journals, replay of historic ticks as new executions, provider changes or gateway restart. No owner account data was read or rewritten during development; tests use isolated synthetic ledgers.

## Validation

**94 executable tests pass** across the new regression, actual storage/hydration callbacks and cleanup, both long/short and both SL/TP levels, peer direction, cleared-marker persistence/legacy inference, terminal orders, partial quantities, legitimate new trades/reset/balance changes, stop edits, execution tape, actual fill rendering, journal durability and sync isolation. Existing protection-trigger checks 8/8 and journal checks 14/14 also pass. New reproducer verifies balances and canonical journal exit price/role, not merely absence of a triangle.

Scoped ESLint for the changed ledger/merge/test code passes. Full 1,536 MiB production build and final incremental TypeScript pass. The large workspace's two callback replacements/import are typechecked; its full React-compiler lint is not claimed. Logs: `tmp/paper-closed-revival-before.log`, `tmp/paper-closed-revival-final-suite.log`, `tmp/paper-closed-revival-triggers.log`, `tmp/paper-closed-revival-journal.log`, `tmp/paper-closed-revival-lint.log`, `tmp/paper-closed-revival-build.log`, `tmp/paper-closed-revival-final-types.log`.

Frontend release through one scoped main push to `websiterepo-yfmi`; verify deployment and public diagnostic commit. This prevents the reproduced fault; do not invent corrections to already-corrupted historical fills when their original execution evidence is unavailable.
