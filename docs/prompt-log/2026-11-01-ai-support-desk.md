# Bottom-right AI help and real support follow-up

Owner requests a legitimate AI help desk where customers can report problems and the owner/support team can receive and reply to them.

## Implemented

- Mount a theme-aware Help launcher in the root layout; lazy-load its panel only when opened. Full `/support` centre shares the same implementation. No startup support/auth/provider request and no closed-panel polling.
- Real Anthropic product Q&A using curated actual feature/navigation knowledge, bounded messages and a fixed priced model. Do not claim account/trading access or pretend an AI answer submitted a ticket.
- Signed-in customer problem reports, optional validated screenshot, explicit AI-context inclusion, browser/page context without query strings/fragments, durable references and conversation history. Submission retries are idempotent.
- Private owner/staff inbox, statuses, unread state, search and stable pagination, persistent human replies, customer follow-up and verified-email staff invitations/revocation. One-time owner activation pins a verified account; do not guess the owner's identity. Raw activation token is stored outside the repository and passed only in a URL fragment, removed immediately by the page. The production inbox remains pending owner activation until the private link is used.
- Next authenticates account identity, rejects cross-origin writes and signs bounded requests to the isolated VPS support service. Service verifies exact request signatures and ticket ownership/staff roles. Operator diagnostics use a derived server credential, never browser identity, and return no tickets.
- Independent Node22/SQLite service with WAL/FULL durability, read-only code, no public container port, 192 MB/0.25 CPU bounds, bounded logs and a private daily consistent backup retaining 14 copies. These are local VPS copies, not offsite backups.
- Persist the support route in the tracked Caddy template as well as the live host configuration, preserving all existing host relay handlers.
- Support AI reserves conservative costs in a persistent ledger before calling the provider: default USD2/month UTC cap, 6 requests/minute and12/day/account, max500 output tokens. Existing server AI key is request-scoped, never stored in SQLite or service config. Reports/human replies work after the AI cap. No new paid infrastructure or email provider is configured. Reports arrive in Support inbox; replies are in My reports, not email.

## Validation before release

- 16 new backend/proxy tests pass: idempotency and reopen durability, customer privacy, verified one-time ownership/staff membership, replies/status/unread, screenshots, persistent rate limits, model/key contract, budget reservation/failure accounting, signed HTTP, stable tied-timestamp pagination/search, CSRF and malformed/oversized responses.
- Together with existing middleware deadlines, desktop machine protocol, Kwanty auth, cookie hygiene and Google callback recovery: **34/34 pass**.
- Actual launcher/panel and actual isolated support service in headless Chrome: **10 browser checks**, zero browser errors. Covers zero idle requests, one fixture AI call, report/screenshot/context, no polling after close, owner activation, persisted staff reply received by customer, staff invitation/resolution/revocation, mobile/light-theme fit/contrast and signed-out path. No fixture reports/accounts were written into production. AI fixture output is a test double; a separate real provider probe is a production release gate.
- Scoped ESLint passes with no warnings; full Next production build passes, including `/support` and `/api/support/[...path]`.
- Installed the isolated `kwantdesk-support` project, validated/gracefully reloaded only Caddy to add `/support/*`, and enabled/smoke-tested the daily SQLite backup. Signed VPS health reports healthy database, pending owner setup and USD2 cap; unsigned request401, existing feed health200, gateway container start time unchanged. Host service files' hashes match the tested source.

## Release gate

One scoped main-only Git integration release to existing `websiterepo-yfmi`. Verify exact live SHA, private website-to-VPS diagnostics, actual bounded Anthropic response and anonymous denial after deployment. Give the owner the private one-time inbox activation link at completion. Do not claim email alerts or that owner activation is already complete. Preserve all trading/account/history data, archived Zyon behavior, independent Algo workspaces and unrelated dirty/native files; no `ALGO/` edits and no market-data gateway restart.
