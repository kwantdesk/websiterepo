# GEX Data deployment

Owner explicitly requested release of the previously local GEX Data changes.

Scope: pending GEX Data assets and new supporting modules, additional-tool catalogue/request validation, the authenticated Heat Map saved-cell route, scoped tests and isolated QA support. Includes volatility skew/drift, term structure, open-interest tool integrations, news stream, trade/table interactions, contract selectors, chart controls, tool selection persistence and rendering fixes already prepared in the worktree. This release is deployment verification, not a new claim of complete 1:1 source parity or every licensed endpoint's availability.

Validation: 822 GEX Data/reference tests pass; 8 options-panel integration tests pass; 14 bounded archive/sidecar tests pass. 57 browser JavaScript modules pass syntax checks and 142 relative imports resolve. Full production build passes, including TypeScript and page generation. Isolated Chrome loads the actual module graph and Add Tool picker with zero page errors or missing assets; external networking is blocked and no provider requests are made. A brittle startup test was corrected to recognise the body's phone-layout data attribute; the theme bootstrap remains blocking and precedes palette painting.

## Saved-cell history deployment

The main live gateway lacked the new Heat Map archive reader endpoint. Deployed a separate private heat-cell-history service using the existing local gateway image, existing recordings mounted read-only and only the existing private gateway bearer. No provider credentials or new external service were added. Hard limits: 384 MiB memory/swap, 0.25 CPU, 48 PIDs, bounded worker scan/deadline, one concurrent scan, 12 requests/minute; no vendor polling or recording writes. Added the exact Caddy path /v1/market-data/heat-map-history and validated/gracefully reloaded its routing. Original compose and Caddy configuration were backed up under /opt/kwantdesk/deploy-evidence/gex-data-20261104T090905Z.

HTTPS verification: unauthenticated POST 401, authenticated invalid POST 400, valid archive query 200 with observations-only coverage. The checked QQQ selection returned zero recorded observations and explicit partial coverage: neither historical completeness nor unattended all-mode capture is claimed.

Live market gateway start time remained 2026-11-02T14:14:44.799143966Z and health remained healthy after the new service and routing were activated. Gateway, provider subscriptions, terminal and owner tabs were not restarted/refreshed. Main gateway server.mjs and unrelated Kwanty/native/ALGO/social changes remain outside this release.

Production frontend SHA and public asset hashes are verified after main-only deployment; local deployment receipt is saved in tmp.
