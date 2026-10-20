# Paper accounts survive opening Trade / navigating

Request: clicking Trade should show existing paper accounts instead of losing
them.

Root cause: both account-owning surfaces used a mutable hydrated ref. The load
effect set the ref true immediately, but React had not committed its queued
account-list update. The later save effect saw true plus its captured starting
empty list and wrote that empty list. The old regression only checked for the
presence of a ref guard, so it certified the same race it described.

Repair:
- Hydration readiness is now committed React state alongside the loaded list,
  never a same-pass mutable ref. Both Charts and Accounts are protected.
- Storage reads report failure separately from a valid empty store. Corrupt,
  non-array, partially invalid or blocked reads cannot authorize an empty save.
- Broker-preference parsing is independent of paper-account loading.
- Account-change events use their announced in-memory list rather than reading
  stale storage after a quota-refused save. The existing failed-save warning
  path remains; no claim of durability when the browser refuses writes.
- Accounts page also receives cross-tab account storage changes. Existing
  preference hydration/sign-in listeners and explicit deletion semantics stay.
- With saved accounts present, Trade opens directly on the paper-account picker.

Tests replay the actual extracted React effect callbacks with deferred setters
and repeated mount effects, plus the actual account-change callbacks with old
empty disk contents. Persistence 7/7, visibility 5/5, storage-full 5/5 and journal
14/14 pass. Scoped Accounts/store lint passes.
TypeScript and full production build pass (84 static pages).

No account, order, fill, balance or broker connection was created, reset or
deleted during diagnosis. Previously overwritten records are not automatically
reconstructed or resurrected from ledgers (explicitly deleted accounts must
stay deleted). Recovery, if necessary, requires a surviving account snapshot.

Existing market transport/startup-delay, month history/capture, Asia tape,
indicator soak, options parity and multi-user cost/capacity gates remain open.
