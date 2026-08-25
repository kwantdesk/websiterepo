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

Add these only to `operator.env` on the VPS:

```text
DATABENTO_API_KEY=db-...
QUANTDATA_API_KEY=qd_...
VENDOR_REQUEST_TIMEOUT_MS=30000
QUANTDATA_MIN_SPACING_MS=80
QUANTDATA_EDGE_CACHE_MS=2500
KWANTDESK_LAB_REPOSITORY_ROOT=/opt/kwantify/QUANT-DESK-sync
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
