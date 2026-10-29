# Moved protection persists before live tick interleave — 2026-10-29

Owner reports a position closed at a stop's previous price about two minutes after moving the stop. This task reproduces a specific loss-of-intent path; the owner's exact fill/ledger was not inspected or rewritten.

## Fault
handlePaperProtectionUpdate committed its next ledger only to the synchronous execution ref/React UI. The passive save effect explicitly returns when rendered paperLedger differs from paperLedgerRef.current, protecting against older snapshots. Any quote between render and passive save can supersede the just-edited snapshot; UI already shows the new price, but durable storage and the account-sync snapshot still carry the previous stop. Later restore/hydration can recover the old stop. Entry placement already saved synchronously; protection did not. Four initial actual-handler regressions fail before the change.

## Change
Local commitProtection inside the actual update handler commits then immediately calls existing safe savePaperTradingLedger in the same stack. All three valid branches use it: resting order SL/TP, filled stop/removal and target edit/marketable target handling. This is operator-only persistence, not per-tick serialization or new cloud polling. Durable failure reports error, keeps in-memory intent and warns to keep the tab open. No renderer, fill calculation, exact-tick rounding or drag suspension changes.

## Validation
87 tests pass across new immediate persistence, prior protection field merge, placement/navigation, tape/priority execution, account cloud/device sync, order receipts, accounts and journal evidence. Actual handler executed in VM using real ledger updates: advance quote ref before old passive save could run, reload saved ledger, execute the old stop price two minutes later (position stays open), then the newly selected stop (exact new price fills), for buy and sell. Equivalent moved TP/resting-order/removal/failure tests pass. Full production build and TypeScript pass with 1536MiB heap cap (exit 0). No actual account/order/trade created, edited, restored or corrected.

## Limits / deployment
Not a claim of inspecting the reported historical exit. Browser-owned multi-client execution still has authority limitations: this fix does not add server ownership or adjudicate a stale peer's independently generated close. Existing account merge/closed-fill evidence stays intact; no automatic trade reopening or P&L rewrite. Current web bundle will require a safe page reload after deployment.

The crossed NQ/ES book recovery and earlier backend performance work remain unactivated per owner's explicit wait while trading. This task must not refresh provider subscriptions, restart gateway or stage backend edits. Original Footprint transient, full parity/archive/off-box and unattended browser execution remain separate open work.
