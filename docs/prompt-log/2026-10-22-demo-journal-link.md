# Demo Journal linkage

Request: link existing20 october demo account from Accounts into Journal.

Observed live: Accounts has the demo with12 current exits; Journal exposes two
20 october cards with13 retained outcomes, both incorrectly labelled imported.
Historical journal records intentionally survive source fill clearing/reset;
do not overwrite the journal using only today's/current ledger list.

Root cause: local paper journal id paper-20 october versus the API-cleaned
paper-20october create two hydrated identities. Cloud API also read paper
journals back as import source because of the legacy DB source enum.

Fix: canonical cloud-safe ids on creation; normalize/deduplicate exact paper id
aliases without rewriting trade arrays; reconstruct paper source on cloud GET;
explicit Linked demo account label; deduplicate account card names. Journal boot
backfills saved demo accounts and genuine ledger exits while respecting explicit
Journal deletion tombstones. Empty demo account journals participate in existing
cloud sync without requiring an executed trade. No new poller, service or schema.

Verification:14 paper bridge checks plus14 alias/link/deletion/ZYON-reset tests
pass. Real balances, orders, positions and fills were not changed during testing.
Different account names with colliding sanitized ids are never silently merged;
new collisions use the actual demo id to keep the journal accounts distinct.
Scoped ESLint, complete production build and TypeScript pass (84 pages).
