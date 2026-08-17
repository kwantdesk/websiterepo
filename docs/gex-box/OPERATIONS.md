# GEX BOX — Operations

## Routes

- Canonical: `/gex-box`
- Deep links: `/gex-box/classic`, `/gex-box/state`, `/gex-box/orderflow`, `/gex-box/research`
- Legacy alias: `/gexbot`
- Example: `/gex-box/classic?ticker=SPX&mode=90d&metric=both`

## API

- `GET /api/gex-box/catalog`
- `GET /api/gex-box/snapshot?ticker=SPX&view=classic&category=gex_full`
- `GET /api/gex-box/history?ticker=SPX`
- `GET /api/gex-box/research?command=...`

All provider credentials remain server-side. Responses are private/no-store and vary by cookie.

## Expected states

- `LIVE_RTH`: current New York regular-session provider frame.
- `FROZEN_NEW_YORK_CLOSE`: last verified close outside RTH.
- `DELAYED`: stale or delayed provider frame.
- `UNAVAILABLE`: entitlement, transport or archive input missing; no generated fallback.

## Support checks

1. Confirm the user is authenticated.
2. Confirm the server environment contains the provider credential and entitlement.
3. Inspect `/api/gex-box/snapshot` response status and source diagnostics.
4. Confirm provider timestamp, receipt time and freshness before using the chart.
5. For ORDER FLOW replay, confirm the desk-owned archive is populated.
6. Never expose the provider key to client code or browser logs.

## Release validation

Run:

```text
npm run test:gex-box
npx tsc --noEmit --pretty false
npm run build
```

After deployment, open each deep link in an authenticated session and verify the live/frozen status against the provider timestamp.
