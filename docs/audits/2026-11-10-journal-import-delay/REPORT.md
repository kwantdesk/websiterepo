# Journal trade-copy delay

Owner report: selecting trades from another journal and pressing Import spins for a long time.

## Confirmed code faults

The copy POST had no client deadline, including while parsing a stalled response. Its server actor check used an unbounded authentication client; database calls also had no shared import deadline. Deletion-history reads were completed before source-trade and account reads, adding an avoidable sequential network round trip. The picker itself opens from in-memory journal records; opening it does not issue this copy request.

## Repair

- Run deletion-history, selected-source and account reads concurrently. Keep owner checks, source/destination resets, archived-account validation, tombstones, fingerprint checks and deterministic destination copy IDs.
- Bound authentication for the copy action to five seconds, followed by a shared ten-second database request signal. Expiration aborts the active fetch and returns a terminal SDK response so later requests do not restart the expired budget. Other journal actions retain their existing budgets.
- Bound browser confirmation to twenty seconds, including response-body parsing and transports that ignore cancellation. On failure retain the selection and show a retryable error; never insert optimistic trades or claim success without durable acknowledgement. There is no automatic retry of a potentially completed write. A user retry remains duplicate-safe through the existing deterministic IDs/upsert policy.
- Authentication outages return an unavailable response rather than clearing the session or masquerading as a signed-out account.

## Validation and limits

97 relevant journal/import/auth checks passed. Coverage runs the actual copy route with database fixtures, a gated deletion check that would block the former sequential implementation, both duplicate/reset and owner-isolation cases, unavailable authentication/deletion checks, stalled fetch and body cancellation, shared server cancellation and source-trade preservation. Scoped ESLint and full production webpack build passed.

One unrelated equity-curve source-pattern test fails on both the modified and unchanged release: it expects old primary/danger stroke tokens. It was not rewritten to hide that existing mismatch.

No private owner import was executed, so the exact observed production bottleneck and real-account before/after latency remain unmeasured. This release fixes verified unbounded waits and one unnecessary sequential read; it is not a claim that every database outage can be eliminated. No trades, accounts, journals or services were deleted, reset or restarted. No browser control was used. The Gex datatask remains paused.
