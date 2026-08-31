# Kwantify Rithmic gateway

This is the private, persistent R|Protocol market-data process for Kwantify.
It owns the authenticated WSS session to Rithmic, sends heartbeats, restores
subscriptions after bounded reconnects, and normalizes trades, BBO, aggregated
order book and depth-by-order messages for the web backend.

The browser must never receive the Rithmic username, password, SDK files, or
gateway token. Vercel talks to this service through a private bearer-protected
origin. The Rithmic Test credentials and personal-use market data must not be
redistributed to other users.

## Temporary RTrader Pro bridge (no Dev Kit required)

Until the Dev Kit is available, the gateway can ingest RTrader Pro's native
Excel live stream. This route does not use Bookmap and does not log in through
R|Protocol. RTrader Pro remains the entitled session and the bridge only reads
its exported full Order Book workbook.

The workbook includes the complete displayed price ladder, aggregate bid/ask
size, bid/ask order count, and cumulative traded volume at price. It does not
expose individual exchange order IDs or queue priorities, so the gateway labels
the source `MBO_AGGREGATED` rather than claiming raw order-by-order Level 3.

One-time setup:

1. Keep RTrader Pro open and logged in.
2. Open an **Order Book** for the contract, such as `NQU6.CME`.
3. Use the Order Book export menu and choose **Create Live Streaming Spreadsheet**.
4. Keep the generated Excel workbook open (`Book1`, sheet `Order Book-Full`).
5. Run:

```powershell
cd services\rithmic_gateway
powershell -ExecutionPolicy Bypass -File .\scripts\configure-rtrader-excel.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-background.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-excel-bridge-background.ps1 `
  -WorkbookName Book1 -SheetName "Order Book-Full" `
  -Exchange CME -ContractSymbol NQU6
```

The local bridge polls the live workbook every 250 ms, posts only to the
bearer-protected local gateway, and never reads or writes the Place Orders or
Manage Orders sheets. Stop it with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-excel-bridge.ps1
```

Create one RTrader live-stream workbook and one bridge process per contract.
The local source still needs a secure reachable transport before a hosted
Vercel deployment can consume it; `127.0.0.1` is intentionally not public.

### Persistent website relay

Tailscale Funnel is the supported temporary relay for the RTrader trial. After
signing into the installed Tailscale Windows client once, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-tailscale-funnel.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\install-market-data-autostart.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-supervisor-background.ps1
```

The Funnel command creates a stable TLS URL and persists across Tailscale or
Windows restarts. The gateway still requires its bearer token for every market
data route. Configure the returned HTTPS origin and the existing gateway token
as server-only Vercel environment variables, then redeploy once.

After Funnel prints its HTTPS URL, the included helper configures Production
and Preview without printing the gateway token:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-vercel-market-data.ps1 `
  -GatewayUrl "https://this-device.your-tailnet.ts.net"
```

## One-time SDK installation

Do not commit the licensed Rithmic archive or proto files. Install them into the
ignored local vendor directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-rithmic-sdk.ps1 `
  -ZipPath "C:\Users\Karen\Downloads\RProtocolAPI.0.89.0.0.zip"
```

The installer verifies the expected protocol files and writes them only to
`vendor/proto`, which is excluded from Git.

## Required Rithmic activation

Before the API login can succeed, sign into **R|Trader / R|Trader Pro** against
**Rithmic Test** once and accept every agreement shown by Rithmic. The gateway
cannot bypass that account-side requirement.

## Local run

```powershell
cd services\rithmic_gateway
npm ci
Copy-Item operator.env.template operator.env
# Fill RITHMIC_USER, RITHMIC_PASSWORD and a long random gateway token locally.
npm run discover
powershell -ExecutionPolicy Bypass -File .\scripts\test-login-local.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\configure-local.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-background.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

Health is available at `GET /health`. Authenticated operations include:

- `GET /v1/rithmic/systems`
- `POST /v1/rithmic/connect`
- `POST /v1/rithmic/subscriptions`
- `DELETE /v1/rithmic/subscriptions`
- `GET /v1/rithmic/events` (SSE)
- normalized Kwantify instruments, snapshot, trade and heatmap endpoints

### Native desktop ticket boundary (local source only)

The gateway source can also verify five-minute Ed25519 desktop tickets without
giving the Windows application the private gateway token. The website source
produces a signed, database-backed snapshot and the gateway source verifies and
atomically synchronizes it. This boundary is not operational until those
components and the default-deny entitlement migration are deployed and verified
together.

The verifier configuration is all-or-nothing:

```text
KWANTDESK_DESKTOP_TICKET_ISSUER=https://www.kwantdesk.com/desktop-ticket
KWANTDESK_DESKTOP_TICKET_AUDIENCE=https://feed.kwantdesk.com
KWANTDESK_DESKTOP_TICKET_PUBLIC_KEYS_JSON={"current-key-id":"-----BEGIN PUBLIC KEY-----..."}
KWANTDESK_DESKTOP_REVOCATIONS_URL=https://www.kwantdesk.com/api/desktop-auth/revocations
KWANTDESK_DESKTOP_REVOCATIONS_SYNC_TOKEN=<separate long random server-to-server token>
KWANTDESK_DESKTOP_REVOCATIONS_FILE=/desktop-auth/revocations.json
KWANTDESK_DESKTOP_REVOCATIONS_POLL_MS=15000
```

The sync endpoint requires the dedicated token, and every response is verified
with the configured rotating Ed25519 public keys before the local file is
replaced. The response and file are bounded, synchronization is single-flight,
and a failed update preserves the last valid snapshot. Missing, malformed,
oversized, expired, stale, or incorrectly signed state fails desktop
authorization closed. Existing desktop SSE streams are rechecked every five
seconds and end at their ticket's exact expiry. Do not enable these variables
until the endpoint, secret rotation, mounted cache directory, and outage/
rollback procedure have been exercised in a non-production environment.

Desktop tickets are eligible only for the explicit normalized read-route map.
Lab publication, Rithmic connect/subscription controls, RTrader bridge writes,
raw Rithmic events, and every vendor proxy route remain private-gateway-token
only.

Normalized options analytics currently exposes twelve explicit desktop routes
under `options.analytics:read`:

- `GET /v1/analytics/bounce-levels` → fixed private `/api/bounce-levels`
- `GET /v1/analytics/classic-gex-profile` → fixed private `/api/chart-gex-profile`
- `GET /v1/analytics/dark-pool-map` → fixed private `/api/dark-pool-map`
- `GET /v1/analytics/implied-volatility-rank` → fixed private `/api/implied-volatility-rank`
- `GET /v1/analytics/gamma-environment` → fixed private `/api/gamma-environment`
- `GET /v1/analytics/vix-environment` → fixed private `/api/vix-environment`
- `GET /v1/analytics/zero-gamma-line` → fixed private `/api/zero-gamma-line`
- `GET /v1/analytics/options-delta` → fixed private `/api/options-delta`
- `GET /v1/analytics/zero-gamma-bars` → fixed private `/api/zero-gamma-bars`
- `GET /v1/analytics/gamma-heatmap` → fixed private `/api/gamma-heatmap`
- `GET /v1/analytics/net-gamma-exposure-by-strike` → fixed private `/api/net-gamma-exposure-by-strike`
- `GET /v1/analytics/gex-interval-map` → fixed private `/api/gex-interval-map`

The gateway validates each route's complete query allow-list. It never forwards
the desktop bearer token or exposes a QuantData credential. Configure both processes with the same
dedicated internal token and keep the analytics origin on the VPS/private
network:

```text
KWANTDESK_ANALYTICS_ORIGIN=http://kwantdesk-analytics:3000
KWANTDESK_ANALYTICS_SERVICE_TOKEN=<separate random token, at least 32 characters>
KWANTDESK_ANALYTICS_TIMEOUT_MS=45000
```

`KWANTDESK_ANALYTICS_ORIGIN` and `KWANTDESK_ANALYTICS_SERVICE_TOKEN` are paired:
setting only one prevents the gateway from starting. The website analytics
process reads the token only from its server environment. Never prefix it with
`NEXT_PUBLIC_`.

Native ZYON dictation terminates directly at the identity-bound VPS gateway:

```text
OPENAI_API_KEY=<VPS secret manager value>
OPENAI_ZYON_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe-2025-12-15
OPENAI_ZYON_TRANSCRIPTION_TIMEOUT_MS=45000
```

The desktop can call only exact `POST /v1/zyon/transcriptions` with an
`assistant.zyon:write` ticket, raw `audio/wav`, and a bounded language header.
The gateway independently revalidates the UUID principal and exact 16 kHz mono
PCM16 WAV, enforces 250 ms–120 s and request/receipt/transcript limits, then
calls the fixed OpenAI transcription endpoint with its VPS-only credential and
allowlisted pinned model. It does not persist or log audio and never exposes the
credential, endpoint or model selection to the workstation or website/Vercel.
`/health` reports only `zyonTranscription.configured` and the non-secret model.

Native NEWS uses a separate identity-bound fixed bridge:

```text
KWANTDESK_NEWS_SERVICE_ORIGIN=https://www.kwantdesk.com
KWANTDESK_NEWS_SERVICE_TOKEN=<separate random token, at least 32 characters>
KWANTDESK_NEWS_SERVICE_TIMEOUT_MS=120000
```

The origin/token are paired. The gateway accepts only the fixed calendar,
macro-intelligence and macro-analyst routes, requires a verified desktop UUID
subject and strips the public desktop bearer before forwarding. Calendar,
official-feed, Databento, model-provider and web-search credentials remain
server-side. Never prefix the NEWS token with `NEXT_PUBLIC_`.

Native SOCIALS uses its own identity-bound fixed service bridge:

```text
KWANTDESK_SOCIALS_SERVICE_ORIGIN=https://www.kwantdesk.com
KWANTDESK_SOCIALS_SERVICE_TOKEN=<separate random token, at least 32 characters>
KWANTDESK_SOCIALS_SERVICE_TIMEOUT_MS=120000
```

Only `GET /v1/socials/state`, `GET /v1/socials/profile`,
`GET /v1/socials/follow`, `GET /v1/socials/following`,
`GET /v1/socials/reaction`, `POST /v1/socials/follow`, and
`POST /v1/socials/reaction` are accepted. Reads require
`socials.account:read`; mutations require the separately granted
`socials.account:write` scope. The gateway forwards the verified desktop UUID,
never its bearer, and canonicalizes the bounded follow and reaction shapes
before forwarding. State/profile responses are capped at 32 MiB,
follow/following at 32 KiB, reaction responses at 64 KiB and request bodies at
16 KiB. The server-side reader reapplies private, reciprocal-friend,
Desk-membership and community visibility; a one-way profile follow does not
grant friends-only access. The writers use service-role-only security-definer
functions, per-account serialization, request hashes and durable 90-day/5,000-
per-account idempotency receipts. Apply both
`202608300002_create_desktop_social_follow_mutations.sql` and
`202608300003_create_desktop_social_reaction_mutations.sql` before granting the
write scope. The normal workstation deliberately does not request that scope
while the native SOCIALS route remains release-gated.

Native JOURNAL uses a separate identity-bound fixed service bridge:

```text
KWANTDESK_JOURNAL_SERVICE_ORIGIN=https://www.kwantdesk.com
KWANTDESK_JOURNAL_SERVICE_TOKEN=<separate random token, at least 32 characters>
KWANTDESK_JOURNAL_SERVICE_TIMEOUT_MS=120000
```

The desktop can call only `GET|POST|DELETE /v1/journal/state` and
`GET|POST /v1/journal/analysis`. State reads require
`journal.account:read`; durable account, trade, import, evidence and analysis
mutations require `journal.account:write`. The bridge strips the desktop
bearer, forwards only the verified UUID subject, rejects arbitrary paths and
queries, and enforces bounded JSON bodies and responses. The analysis request
contains only the deterministic evidence pack—never screenshots, credentials,
or future replay state. Keep the service token server-side and never prefix it
with `NEXT_PUBLIC_`. Apply `202608300005_expand_desktop_journal_scopes.sql`
before granting the native scopes, and verify the read/write scope split plus
analysis load/generation before enabling the JOURNAL card in a release build.

Point the Kwantify server at the persistent gateway (never from client-side
code):

```text
KWANTIFY_MARKET_DATA_PROVIDER=Rithmic
KWANTIFY_MARKET_DATA_GATEWAY_URL=https://your-private-rithmic-gateway
KWANTIFY_MARKET_DATA_GATEWAY_TOKEN=<the same private gateway token>
```

The initial integration is deliberately read-only. Order entry remains outside
this market-data process until Rithmic Test market data has passed soak,
sequence, reconnect and entitlement tests.

## Unified vendor data edge

The same always-on process also owns Databento and KwantData credentials. The
website sends bearer-authenticated requests to the gateway; the gateway adds
the vendor credential, enforces an endpoint allow-list, streams Databento
history, and globally spaces/coalesces KwantData requests. This prevents every
Vercel function instance from independently exhausting the same vendor quota.

The local source also provides `GET /v1/market-data/history` for the native
workstation. It accepts canonical exchange, contract, interval, `fromMs`,
`toMs`, and bounded `limit` fields under the existing `market.trades:read`
desktop scope. The VPS uses its server-only Databento key, returns the
`kwantdesk-history-v1` provider-neutral contract, resamples time bars
deterministically, and returns exact aggressor-side executions for supported
event-bar requests. Requests are single-flight/cache shared and enforce hard
limits on range, provider rows, response bytes, output rows, event lookback,
and concurrency. If Databento rejects a near-real-time end with either typed
`data_end_after_available_end` or `dataset_unavailable_range` metadata, the
gateway retries exactly once at `available_end - 1ms`. The response preserves
the original `requestedToMs`, reports the provider-served `effectiveToMs`, and
marks the result truncated so the desktop uses the correct exclusive merge
seam. Missing entitlement or provider data fails explicitly; this path never
fabricates order flow or substitutes OHLCV for executions. The source and tests
are local only until a deliberate VPS deployment and live endpoint verification
are performed.

Add these only to `operator.env` on the VPS:

```text
DATABENTO_API_KEY=db-...
QUANTDATA_API_KEY=qd_...
VENDOR_REQUEST_TIMEOUT_MS=30000
QUANTDATA_MIN_SPACING_MS=80
QUANTDATA_EDGE_CACHE_MS=2500
KWANTDESK_LAB_REPOSITORY_ROOT=/opt/kwantify/QUANT-DESK-sync
KWANTDESK_ANALYTICS_ORIGIN=http://kwantdesk-analytics:3000
KWANTDESK_ANALYTICS_SERVICE_TOKEN=<separate random internal token>
KWANTDESK_ANALYTICS_TIMEOUT_MS=45000
KWANTDESK_NEWS_SERVICE_ORIGIN=https://www.kwantdesk.com
KWANTDESK_NEWS_SERVICE_TOKEN=<separate random internal token>
KWANTDESK_NEWS_SERVICE_TIMEOUT_MS=120000
KWANTDESK_SOCIALS_SERVICE_ORIGIN=https://www.kwantdesk.com
KWANTDESK_SOCIALS_SERVICE_TOKEN=<separate random internal token>
KWANTDESK_SOCIALS_SERVICE_TIMEOUT_MS=120000
KWANTDESK_JOURNAL_SERVICE_ORIGIN=https://www.kwantdesk.com
KWANTDESK_JOURNAL_SERVICE_TOKEN=<separate random internal token>
KWANTDESK_JOURNAL_SERVICE_TIMEOUT_MS=120000
OPENAI_API_KEY=<VPS secret manager value>
OPENAI_ZYON_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe-2025-12-15
OPENAI_ZYON_TRANSCRIPTION_TIMEOUT_MS=45000
```

`KWANTDESK_LAB_REPOSITORY_ROOT` points at the VPS clone of the private Quant
Desk repository. THE LAB reads only
`AUGUST_V1_QUANT_DESK_FRAMEWORK/runtime/<NQ|ES>/current.json`. The artifact must
declare `version: kwantdesk-august-v1-lab-v1` and `environment: LIVE`; missing,
test, oversized, or malformed artifacts fail closed. The website does not
silently rebuild a plan from direct vendor requests when the artifact is down.

The Vercel project needs only `KWANTDESK_MARKET_DATA_GATEWAY_URL` and
`KWANTDESK_MARKET_DATA_GATEWAY_TOKEN`. Direct vendor keys can remain briefly
during migration as server-side fallback, then should be removed after
`/health` reports both `vendorData` providers configured and real endpoint
probes pass.

## Deployment

Run this service on an always-on container or VM. Vercel serverless functions
must not own the Rithmic WSS connection. Mount the licensed `vendor/proto`
directory at build time, inject secrets through the host's secret manager, set
the restart policy to `always`, and restrict ingress to the Kwantify backend.
