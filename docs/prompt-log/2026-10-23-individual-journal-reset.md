# Individual journal reset

Request: “no not reset all journals just in ech one need the option”.

Added Reset journal to each custom/demo/manual/imported journal header and its
account menu. ZYON keeps its existing individual reset. Overall Journal has no
global reset action. Confirmation names the selected journal and requires the
exact typed phrase before submitting.

An authenticated, owned-account private metadata cutoff starts that journal's
reporting fresh, without deleting the journal account, public posts, source
trading fills, balances or open positions. Other journals are untouched. Old
trade history remains excluded on re-sync; subsequent closes are admitted.
The confirmation explains historical re-imports remain excluded. Original cloud
records remain retained: this is a reporting reset, not permanent erasure.

Verification: production build and scoped ESLint passed. 18 focused tests passed.
Broader journal suite: 28 passed / 1 pre-existing stale equity-color source test
(also documented in the previous engineering handoff). Tests use in-memory
fixtures only. No user journal reset was submitted. No new polling, provider
request, server restart, service subscription or billing setting was added.
