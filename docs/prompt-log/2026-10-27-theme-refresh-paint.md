# Theme refresh paint stability — 2026-10-27

Request: stop flashes of another colour scheme on refresh.

Changes: initial root script now normalizes stored fields with the same canonical defaults as runtime and recovers JSON/storage errors before painting. Root CSS fallback tokens match defaultTheme instead of an old pink/cyan palette. Theme bootstrap is first in the head. Retired sidebar migration now only marks itself and cannot overwrite an existing theme. GEX Data/Kwanty bootstrap seeds saved or same-origin parent colours before host registration, then accepts the registered host palette as before. Asset URL revision 20261027-theme-paint. Liquidity Map bootstrap defaults and browser canvas use canonical colours and recover unavailable storage. No preferences, accounts or market-data behavior changed.

Validation: nine refresh/font regression tests, nine brand contrast checks; scoped lint zero errors/two existing img warnings. Production build pending. Existing gex-vue-quiet-startup source-regex failure concerns unchanged Chart.tsx loader geometry, outside this task; no change to that component.

Production build passed, including TypeScript. Chart.tsx is identical to HEAD, confirming the unrelated source-regex failure is baseline.
