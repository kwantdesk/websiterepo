# GEX BOX — Implementation Map

## Existing files promoted

- `src/lib/gexBot.server.ts`: provider transport, cache, archive access.
- `src/components/gexbot/GexBotCharts.tsx`: shared ECharts rendering runtime.
- `src/components/gexbot/GexBotWorkspace.tsx`: dockable workspace and four local surfaces.

## New canonical modules

- `src/lib/gex-box/domain.ts`: normalized source, instrument, exposure, level, ladder, and order-flow contracts.
- `src/lib/gex-box/metrics.ts`: audited formulas and history-derived levels.
- `src/lib/gex-box/settings.ts`: versioned settings schema, migration, and defaults.
- `src/lib/gex-box/research.ts`: validated command grammar and builder serialization.
- `src/lib/gex-box/normalize.ts`: provider-frame to canonical snapshot adapter.

## API facade

- `/api/gex-box/catalog`
- `/api/gex-box/snapshot`
- `/api/gex-box/history`
- `/api/gex-box/research`

The legacy `/api/gexbot-terminal` and `/gexbot` route remain compatible aliases.

## UI route and surfaces

- Canonical route: `/gex-box`.
- Top navigation placement: immediately after `GEX CAL`.
- Local surfaces: `CLASSIC`, `STATE`, `ORDER FLOW`, `RESEARCH`.

## Test boundary

Focused Node tests validate formulas, normalization, settings migration/effects, command parsing, and navigation registration. The production TypeScript build validates integration.
