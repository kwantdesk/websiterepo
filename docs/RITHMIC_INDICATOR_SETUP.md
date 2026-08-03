# Kwant Desk Rithmic indicator feed

Kwant Desk uses a private, read-only R|Protocol gateway for live executions,
Bid/Ask classification and Level 3 depth. Databento remains the historical
fallback, so closing the Rithmic gateway does not remove stored chart history.

## What is required

Keep these values private. Do not paste the username, password, SDK or gateway
token into a chat, browser form or client-side environment variable.

1. The licensed `RProtocolAPI` SDK ZIP supplied by Rithmic.
2. The exact system/environment shown on the R|Trader login screen, such as
   `Rithmic Test`, plus its websocket endpoint if Rithmic supplied a non-default
   endpoint.
3. The Rithmic username and password.
4. Confirmation that the account is entitled for CME market data and, for true
   Level 3 studies, Depth by Order/MBO.
5. The active futures contracts to subscribe to, for example NQ, MNQ, ES and
   MES front-month contracts.

## Credential location

Copy `services/rithmic_gateway/operator.env.template` to
`services/rithmic_gateway/operator.env` and fill the values there. The real file
and installed SDK are ignored by Git.

The browser never receives these credentials. The gateway token is the only
secret shared between the private gateway and the Kwant Desk server.

## Local validation

```powershell
cd services\rithmic_gateway
npm ci
powershell -ExecutionPolicy Bypass -File .\scripts\install-rithmic-sdk.ps1 `
  -ZipPath "C:\path\to\RProtocolAPI.zip"
Copy-Item operator.env.template operator.env
# Fill operator.env locally, then:
npm run discover
powershell -ExecutionPolicy Bypass -File .\scripts\test-login-local.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\configure-local.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-background.ps1
```

Before the first API login, open R|Trader or R|Trader Pro once using the same
system and accept every agreement presented by Rithmic. R|Trader does not need
to remain open after the independent gateway is authenticated.

## Production connection

Vercel must not own the long-lived Rithmic websocket. Run the gateway on this
computer behind a private HTTPS tunnel for the short trial, or on an always-on
private VM/container for the dev kit. Configure these server-only Vercel values:

```text
KWANTDESK_MARKET_DATA_PROVIDER=Rithmic
KWANTDESK_MARKET_DATA_GATEWAY_URL=https://your-private-gateway-origin
KWANTDESK_MARKET_DATA_GATEWAY_TOKEN=<same token as operator.env>
```

The current integration is market-data only. It does not submit or manage
orders. Account permissions and Rithmic market-data redistribution terms still
apply to every user who can see the derived live feed.
