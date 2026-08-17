# GEX BOX — Validation Ledger

Validation date: 2026-08-17

| Evidence | Result |
| --- | --- |
| `npm run test:gex-box` | PASS — 10/10 |
| `npx tsc --noEmit --pretty false` | PASS |
| Focused ESLint over GEX BOX routes, library, tests and workspace | PASS |
| `npm run build` | PASS — canonical and nested GEX BOX routes emitted |
| Formula parity | PASS for published formula definitions, sign, multiplier and scaling |
| Raw-level selection | PASS — majors and zero gamma use raw signed exposure |
| No-lookahead max change | PASS |
| Research grammar | PASS — round-trip and unknown-token rejection |
| Settings migration | PASS — bounds and exactly three unique order-flow metrics |
| Order-flow catalog | PASS — exact required eight metrics |
| Navigation placement | PASS — GEX BOX directly follows GEX CAL |
| Local route smoke test | PASS — `/gex-box/classic?ticker=SPX` returns HTTP 200 |
| Authenticated visual runtime | Constrained locally by expected authentication redirect |
| Provider live-frame proof | Not claimed in local development because entitlement/provider feed was unavailable |

## Existing unrelated observation

Local development exposed a pre-existing watchlist hydration mismatch (`10Y` server row versus `6E` client row). It is outside the GEX BOX scope and did not fail the production build.

## Evidence rules

- Successful transport does not prove formula parity.
- A rendered chart does not prove source correctness.
- Missing provider inputs remain unavailable.
- Generated preview data never counts as live or historical provider validation.
