# Recurring account-service failure: load and capacity correction

## Observed cause boundary

The preceding incident proved Supabase Auth/JWKS timeout, an Unhealthy project, disk IO-budget warning and a metadata-query connection timeout. It did not identify the exact blocking process. The market-data VPS remained connected/authenticated and public site assets responded.

This follow-up read the signed-in Supabase Query Performance report without resetting its statistics:

| Query family | Calls | Cumulative execution time | Share of report time | Mean | Max |
| --- | ---: | --- | ---: | ---: | ---: |
| Full user_preferences CAS update | 2345 | 23m48s | 35.4% | 609ms | 6542ms |
| Full user_preferences read | 4653 | 16m34s | 24.7% | 214ms | 7835ms |
| realtime.list_changes | 46649 | 17m1s | 25.3% | 22ms | 12883ms |

The preferences pair consumes60.1% of this report's query time. These are cumulative pg_stat_statements results with an unknown reset interval, not a measured request rate or proof of60.1% CPU/disk use. The database resource panel flagged memory commitment1.14GB as problematic on Nano (up to0.5GB). IO charts were unavailable. A small44.3MB database does not establish that resource pressure is harmless; JSON reads/writes, concurrent connections and realtime decoding also consume resources. The exact causal chain for each prior outage is still unproven.

## Applied capacity change

The infrastructure UI listed Nano and Micro at the identical0.01344USD/hour. Selecting Micro and reviewing changes explicitly showed BEFORE9.68USD/month, AFTER9.68USD/month, +0.00USD/month, taxes excluded. Applied that included upgrade: Micro1GB versus Nano up to0.5GB. The page subsequently showed Micro active and selected. No other plan, disk size, spend cap, IOPS or storage setting was changed. Its automatic account-project restart completed; no market-data VPS, terminal or provider subscription was restarted. No accounts, trades, journals or workspace rows were edited.

Post-upgrade public Auth health returned200 in193ms and JWKS200 in194ms. This confirms current service recovery, not sustained future capacity or a permanent outage guarantee.

## Code fixes

1. exchangeAccountPreferences formerly rewrote the full JSON row for every explicit save, even after a peer had already satisfied the edit. After the conflict-safe merge, it now skips existing-row writes when both execution/settings and open-position valuation fingerprints are already equal. This avoids unnecessary TOAST/WAL work and revision changes. Missing-row legacy migration still writes; genuine stop/order/workspace changes and newer valuation handoffs still write.
2. Repeated unchanged focus/reconnect/broadcast hints formerly downloaded the full preferences document. An established clean synchronizer now checks the small updated_at revision first and fetches/merges the document only when it changed. Local edits and valuation handoffs bypass that shortcut and retain compare-and-swap merging.

No auth bypass, fabricated session, disabled RLS or dropped saved history is involved. Whole-document preference storage and independent tabs' revision checks remain architecture limitations; these scoped corrections do not claim to remove all sync traffic.

## Validation

156 targeted paper/account/preference/sync/recovery tests pass. New cases include50 no-op saves producingzero database writes, a peer satisfying a pending edit without an extra write, protection and newer valuation updates still persisting, and50 unchanged focus/peer hints producingzero full-document exchanges. The controller's mock revision was corrected to include valuation changes, like the real updated_at revision. Overnight phone handoff and execution-protection regressions remain covered.

Scoped ESLint and the full production webpack build (including TypeScript and87 generated pages) passed. Two known older paper integration/source-pattern suites were excluded as documented in the overnight-position audit; no claim is made that those pre-existing harness failures were repaired here.

Source release uses only the existing main/yfmi integration. No paid services, extra billable capacity or new subscriptions were introduced. Query evidence is saved in query-performance.txt; public health and production SHA receipts are adjacent. Gex datatask remains paused.
