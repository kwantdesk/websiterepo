# GEX BOX — Current System Audit

Audit date: 2026-08-17

## Existing production assets

- `src/lib/gexBot.server.ts` owns the server-only GEXBot credential, live request cache, stale-if-error behavior, provider normalization, archive reading, and explicit simulated-preview opt-in.
- `src/app/api/gexbot-terminal/route.ts` exposes a validated private terminal endpoint for Classic, State, and Order Flow.
- `src/components/gexbot/GexBotWorkspace.tsx` is the existing dockable workspace surface.
- `src/components/gexbot/GexBotCharts.tsx` uses ECharts rather than DOM-per-node rendering.
- `src/lib/gexBotOrderflowArchive.server.ts` reads the desk-owned historical order-flow archive.

## What is already safe to retain

- Provider secrets remain server-side.
- Live responses are deduplicated in-flight and cached for two seconds during RTH.
- Closed-session responses are explicitly identified as frozen New York close frames.
- Missing history is reported as unavailable. Fabricated history is not a default fallback.
- Existing GEX CAL is independent and is not modified by this build.

## Gaps against the GEX BOX specification

1. The UI and contracts are named GEX Bot rather than GEX BOX.
2. Only Classic, State, and Order Flow surfaces exist; Research is absent.
3. Provider tuples leak into UI-oriented types instead of passing through a canonical domain model.
4. Order Flow exposes six provider labels instead of the required eight canonical metrics.
5. Formula parity utilities for DEX, GEX, Charm, negative Vanna, zero gamma, majors, and max-change are absent.
6. Settings are component-local rather than schema-driven and version-migrated.
7. There is no catalog/snapshot/history/research API family for GEX BOX.
8. There is no validated research command grammar or builder round-trip.
9. Diagnostics, capability disclosure, and requirement-level validation evidence are incomplete.
10. The existing route is `/gexbot`; the canonical product route needs to be `/gex-box` while preserving the legacy alias.

## Build decision

Promote the existing server connection and ECharts runtime. Add a canonical domain and formula layer, a stable GEX BOX API facade, the fourth Research surface, exact metric semantics, versioned settings, focused tests, and evidence documentation. Do not create a second provider connection or a parallel render loop.
