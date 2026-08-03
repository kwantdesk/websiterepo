# Kwant Desk Rithmic indicator feed

Kwant Desk uses a private, read-only gateway for live executions and full-depth
liquidity. Databento remains the historical fallback, so closing the Rithmic
gateway does not remove stored chart history.

During the RTrader Pro trial, the supported source is RTrader Pro's native
Excel live-stream workbook. It supplies the full displayed price ladder,
aggregate bid/ask size, order count and traded volume. It does not expose raw
exchange order IDs, so the backend calls it `MBO_AGGREGATED`. When the Dev Kit
arrives, `RITHMIC_SOURCE_MODE=protocol` enables the independent R|Protocol path.

## What is required

Keep these values private. Do not paste the username, password, SDK or gateway
token into a chat, browser form or client-side environment variable.

1. RTrader Pro open and logged into the entitled CME trial.
2. An Order Book for each active contract.
3. **Create Live Streaming Spreadsheet** from each Order Book export menu.
4. Excel kept open with the generated `Order Book-Full` sheet.

The licensed R|Protocol SDK, API username/password and Dev Kit are not required
for this temporary workbook source.

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
powershell -ExecutionPolicy Bypass -File .\scripts\configure-rtrader-excel.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-background.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-excel-bridge-background.ps1 `
  -WorkbookName Book1 -SheetName "Order Book-Full" `
  -Exchange CME -ContractSymbol NQU6
```

RTrader Pro and Excel must remain open for this source. The bridge is strictly
read-only and never reads or writes the Place Orders or Manage Orders sheets.

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
