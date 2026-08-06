# KwantDesk Databento overnight gamma gateway

This is the persistent, read-only native NQ gamma service. It performs one bounded daily pull of NQ option definitions, settlements and open interest, persists the resulting prior-settle IV/OI map, and subscribes only to front-month NQ futures trades on Databento Live. Every 60 seconds it reprices that fixed map with Black-76 and serves the Build-2 Gamma Cage objects at native NQ strikes.

The Vercel app never opens the live TCP connection and never receives the Databento key. Configure the app with the private service origin and bearer token:

```text
KWANTDESK_NATIVE_GAMMA_GATEWAY_URL=https://your-private-databento-gateway
KWANTDESK_NATIVE_GAMMA_GATEWAY_TOKEN=<same private token>
```

Run locally or as an always-on container:

```powershell
cd services\databento_gateway
Copy-Item operator.env.template .env.local
npm test
npm start
```

Authenticated endpoint: `GET /v1/native-gamma/nq`. Health: `GET /health`.

## Cost guard

- Live: one `trades` subscription for the current outright NQ futures contract. No option MBO/MBP subscription.
- Daily: four bounded historical requests (NQ option/futures definitions and statistics) around the latest completed settle. The option result is capped to the native 0–7 calendar-day chain before persistence.
- Repricing is local computation; it creates no Databento request.

Mount `/app/data` on durable storage and use an `always` restart policy. If a daily refresh fails, the prior JSON map remains on disk and continues to be served with its true `oiAsOf` date.
