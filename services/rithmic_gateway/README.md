# Kwantify Rithmic gateway

This is the private, persistent R|Protocol market-data process for Kwantify.
It owns the authenticated WSS session to Rithmic, sends heartbeats, restores
subscriptions after bounded reconnects, and normalizes trades, BBO, aggregated
order book and depth-by-order messages for the web backend.

The browser must never receive the Rithmic username, password, SDK files, or
gateway token. Vercel talks to this service through a private bearer-protected
origin. The Rithmic Test credentials and personal-use market data must not be
redistributed to other users.

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

## Deployment

Run this service on an always-on container or VM. Vercel serverless functions
must not own the Rithmic WSS connection. Mount the licensed `vendor/proto`
directory at build time, inject secrets through the host's secret manager, set
the restart policy to `always`, and restrict ingress to the Kwantify backend.
