# GEX BOX — Performance Report

## Rendering

- Charts use the existing canvas-based ECharts runtime; no DOM node is created per strike or sample.
- One chart instance is used per surface; ORDER FLOW stacks series in a single coordinated canvas.
- Spot history is bounded to 480 samples.
- Order-flow runtime history is bounded to 6,000 samples and session persistence to 900 samples.
- Settings and URL changes update local state without creating another provider connection.

## Data access

- The browser calls the canonical `/api/gex-box/snapshot`, `/history`, and `/research` routes only.
- Those routes reuse the single server-side `gexBot.server.ts` connection, cache and in-flight request dedupe.
- RTH polling is three seconds; closed-session polling is sixty seconds.
- Research does not poll.
- Request sequence guards prevent stale responses from overwriting a newer ticker/surface selection.

## Memory controls

- Session/local storage arrays are bounded.
- Old simulated history is rejected during migration.
- Effect cleanup cancels timers when the surface, category or ticker changes.
- Production history never generates substitute frames when the archive is missing.

## Verification

Production compilation and TypeScript validation pass. Live browser profiling remains an operational follow-up requiring an authenticated session and provider entitlement.
