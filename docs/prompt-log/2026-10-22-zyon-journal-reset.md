# ZYON Journal reset

Request: add the option to reset the ZYON journal.

Implemented in Journal > ZYON Journal > Reset journal. A centered theme-aware
dialog explains scope, recommends Backup, requires RESET ZYON JOURNAL and allows
Cancel. No reset was submitted while implementing or checking this feature.

ZYON Journal mirrors reviewed Gameplan receipts. Deleting local rows would not
work: the next existing30s refresh would recreate them. Instead an authenticated
private marker records a server-issued reset timestamp in existing account-state
storage. Receipt creation time (not later edits) determines inclusion. Existing
outcomes stop contributing to ZYON and Overall Journal totals; future reviewed
outcomes enter normally. Original Gameplans, conversations, public receipts,
other accounts and paper journals remain untouched.

Cutoff survives cloud reload, IndexedDB normalization and memory hydration.
Request-generation guards ignore stale pre-reset source responses. Same-account
reset result beats an older in-flight hydrate. Stale saved analysis is excluded
after reset when its fingerprint no longer matches the current evidence.

Verification:24 focused journal tests pass, including reset boundary, future
outcomes, edited old receipt, source immutability, user isolation, monotonic
timestamp merge and confirmation/private-marker contract. An unrelated existing
equity-curve source assertion fails on unchanged HEAD because it still expects
primary/danger instead of the existing journal-win/loss palette variables.
Browser checked the actual shared JournalWorkspace locally: selected ZYON,
opened modal, verified disabled confirmation, typed phrase, verified enabled,
then Cancelled. Temporary local route removed before production build.
Scoped ESLint and complete production build/TypeScript pass (84 pages).
