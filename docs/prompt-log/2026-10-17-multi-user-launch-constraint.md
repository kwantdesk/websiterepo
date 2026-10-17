# Multi-user launch planning constraint

Owner asked to record that KwantDesk is being prepared for a few hundred users
in about one month, and that upcoming Theta Data distribution should inform
engineering now so we do not create unnecessary migration/rework later.

Recorded as a standing constraint in CLAUDE.md and the important-notes ledger:
shared ingestion and reusable calculations/history; bounded authenticated
fan-out; migration-safe provider boundaries; explicit capacity, cost, recovery,
storage and licensing validation before release. Provisional load-test target
is at least 100 concurrent users, not an assertion that every registered user
will be concurrent. Final peak concurrency and provider rights/coverage remain
to be confirmed. No infrastructure, subscriptions or production runtime changed.
