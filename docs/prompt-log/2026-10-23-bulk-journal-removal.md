# Bulk journal removal

Request: an easy way to select many journals and remove them together.

Added Manage journals in the Journal header: searchable active/archived journal
list, checkboxes, Select all shown, Clear selection and selected count. Removal
requires reviewing the selected names and typing DELETE N JOURNALS. Confirmation
explicitly discloses permanent record and linked Socials post deletion. ZYON
and Overall built-in journals cannot be bulk-deleted; trading accounts, balances,
fills and open positions are not removed.

Uses the existing authenticated owned-account endpoint, sequentially. Confirmed
successes are purged using existing persistent local tombstones; failures remain
selected with errors. No snapshot rollback can restore already-deleted journals
or discard live changes to unselected journals. Account changes stop new requests.

Verification: six bulk-selection/deletion tests plus fifteen adjacent regression
tests pass. Scoped ESLint passed. Tests use fake deletion callbacks only; no user
journals or Socials posts were deleted, and no paid service or poller was added.
