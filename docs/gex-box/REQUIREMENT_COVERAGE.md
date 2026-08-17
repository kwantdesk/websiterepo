# GEX BOX — Requirement Coverage

Status values: `verified`, `implemented`, `unavailable-by-design`.

| Area | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| Navigation | GEX BOX immediately after GEX CAL | verified | `test:gex-box` navigation assertion |
| Routing | Deep-linkable canonical route and legacy alias | verified | `/gex-box/[surface]`, `/gex-box`, and `/gexbot` route mapping; production build |
| Architecture | One server-side provider connection and normalized UI model | verified | Canonical `/api/gex-box/*` facade delegates to `gexBot.server.ts`; no client secret |
| Classic | Profile, spot, zero/major trails, lookbacks, inspector | implemented | `ProfessionalProfileChart` and profile controls |
| State | GEX/Gamma/Delta/Vanna/Charm profiles | implemented | `ProfessionalStateChart` and category mapping |
| Order Flow | Three panels and eight canonical metrics | verified | Exact catalog assertion in `test:gex-box`; max three selected |
| Research | Validated grammar, builder, watchlist | verified | Grammar round-trip/rejection tests and guarded research API |
| Formulas | DEX/GEX/Charm/-Vanna/zero/majors/max-change | verified | Formula, sign, raw-value and no-lookahead assertions |
| Settings | Versioned, migrated, bounded persistence | verified | Migration test and v1 local workspace schema |
| History | Honest archive status, no lookahead, no fake fallback | verified | Canonical history API disables preview generation; unavailable overlay |
| Diagnostics | Source/freshness/capability disclosure | implemented | Provider timestamp, receipt time, freshness, session, history and entitlement rail |
| Alerts | Durable server evaluation | unavailable-by-design | No durable server alert store is claimed |
| Performance | Single ECharts runtime, bounded history, request dedupe | verified | Existing server in-flight dedupe, bounded client tapes, production build |
| Accessibility | Keyboard-readable controls and status labels | implemented | Native controls, switch roles, text status and non-colour state labels |

No unresolved capability is silently replaced with generated production data.
