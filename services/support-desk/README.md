# KwantDesk support desk

The global Help launcher opens AI product help, a problem-report form and private customer conversations. `/support` provides the full inbox. Staff can search reports, reply and change status; the owner can invite/revoke staff by verified sign-in email. Reports and replies are stored on the VPS, not in browser storage. AI conversation drafts are session-local until a customer explicitly includes them with a report.

## Identity and privacy

Next `/api/support/[...path]` verifies Supabase identity and same-origin writes, bounds requests and signs the exact method, path, identity, expiration and body hash. The VPS accepts only these short-lived signatures. Customers cannot supply their own account/staff identity. Every conversation and attachment read checks ownership or staff membership. Screenshots accept PNG/JPEG/WebP signatures, at most 1 MB each and 250 MB total. Query strings/fragments are removed from recorded page context. Staff search is parameterized with escaped wildcards and stable timestamp/ID pagination.

`SUPPORT_SERVICE_SECRET` is HMAC-SHA256 of the existing server gateway token with the context `kwantdesk-support-service-v1`; the support container receives only that derived credential. It does not receive market-data credentials or a permanently stored AI key. Next injects its existing Anthropic key into a signed, HTTPS, request-scoped AI call; the service never stores or logs it.

The operator-only `/api/support/_diagnostics` requires a Bearer derived credential. GET returns database health, pending owner setup and an AI configuration Boolean. POST performs one fixed, bounded AI smoke question against the real provider, charged to the same budget. It returns no customer data and cannot select a model or arbitrary prompt. Routing middleware delegates this exact path's authentication to the handler. Customer support routes retain the site access gate and verify Supabase in the handler, avoiding a duplicate remote auth lookup.

The first owner must use an unpredictable one-time claim link, generated during installation, while signed in with a verified email. The service stores only its hash and expiration. The browser removes the fragment immediately and preserves it in session storage through sign-in. Successful claim permanently pins the owner account; no public first-signup admin rule exists. Keep the raw link out of source, logs and screenshots. Reissue only by a trusted server operator before initial claim.

## AI cost controls

Real Anthropic Messages API, fixed `claude-haiku-4-5-20251001`, at most 500 output tokens, 10 bounded messages and 16 KB system/history input. The curated `knowledge.md` describes actual product navigation and limitations; no tools, trading actions or access to customer trading records are granted.

Default support AI budget: **USD 2 per UTC calendar month**, persisted in SQLite. Before each provider request, reserve a conservative byte-based input bound plus output allowance, atomically; refund only verified savings from returned usage. Failed/unknown calls keep reservations. Per-user limits: 6 requests/minute, 12/day. Customers can submit reports and staff can reply even when AI is disabled or capped. This controls only this support assistant, not other platform AI usage or existing subscriptions.

Pricing basis verified 2026-11-01: [Anthropic Haiku 4.5](https://platform.claude.com/docs/en/models/haiku-4-5/overview), USD 1/M input tokens and USD 5/M output tokens. Review pricing/model availability before changing the pinned model or reservation formula. Never accept caller-selected models, endpoints or token limits.

## Deployment and durability

Run the isolated `kwantdesk-support` Compose project using `compose.yml`. It reuses the installed Node 22 image (built-in SQLite), binds code read-only and stores WAL/FULL SQLite in `/var/lib/kwantdesk-support`. Internal port 8797 has no host port; only Caddy reaches it on the existing network. Resource bounds: 192 MB, 0.25 CPU, 64 processes, bounded Docker logs. Add `handle /support/* { reverse_proxy support-desk:8797 }` before Caddy's gateway fallback and `log_skip /support/*`; validate then gracefully reload Caddy. Do not restart the market gateway or run the main Compose stack to deploy support.

The tracked `services/rithmic_gateway/deploy/Caddyfile` also carries this support route for future deployments. Preserve the running host's additional browser-stream and positioning relay handlers when updating Caddy; do not replace that host configuration with an older template wholesale.

Required root-private `/etc/kwantdesk/support-desk.env`: `SUPPORT_SERVICE_SECRET`, `SUPPORT_BOOTSTRAP_HASH`, `SUPPORT_BOOTSTRAP_EXPIRES` (valid ISO date), `SUPPORT_AI_MONTHLY_MICRO=2000000`. The bootstrap hash is SHA-256 of the raw claim token. No extra Vercel environment is required: use existing `KWANTDESK_`/`KWANTIFY_MARKET_DATA_GATEWAY_*` and Anthropic configuration.

Install the backup service/timer and precreate root-private `/var/backups/kwantdesk-support`. `backup.py` uses SQLite's consistent backup API, retains 14 copies and protects them with mode 0600. These are **local VPS backups, not offsite backups**. Monitor disk capacity alongside existing recordings. Restoration requires stopping only the support service, restoring a verified backup and its ownership, removing stale WAL/SHM companions, then starting support; never overwrite a running database.

The launcher makes zero support/provider requests while closed. Inbox/thread refresh is every 20 seconds only while open and visible. No automatic AI messages, hidden polling, email promises or new paid infrastructure are introduced. Customers receive replies in **My reports**; the owner/team receives reports in **Support inbox**. The panel shell and report draft render immediately without waiting for the identity request. The eagerly imported panel does not mount or send requests until opened. areas.json is shared with the frontend, covers all active website sections/sub-tabs and is accepted by the service.

## Email follow-up

Reports default to in-app contact only. An optional checkbox authorizes email contact about that specific report, using only the authenticated, verified account email. The service ignores caller-supplied alternate addresses or consent dates, records its own timestamp and migrates existing reports with consent OFF. Only the customer may change permission through tickets/:id/contact; changes are recorded in the thread. Staff sees an Email customer mailto action only with permission, alongside the existing in-app reply form. This opens the staff member’s email application. Automated email notifications/delivery are not configured; no new mail service or paid infrastructure is introduced. Staff must refresh a report before relying on its permission state.

## Verification

`node --test services/support-desk/core.test.mjs` exercises durable/idempotent reports, privacy, verified staff membership, one-time owner claim, replies/status/unread state, screenshot limits, rate limits, AI contract/budget/failure accounting, signed HTTP and stable pagination/search. Browser fixtures must exercise the actual launcher/panel with an isolated service/database, never seed synthetic reports into the production inbox. Production acceptance includes exact deployed Git SHA, signed database diagnostics, one real bounded AI probe, anonymous rejection and unchanged gateway start time.
