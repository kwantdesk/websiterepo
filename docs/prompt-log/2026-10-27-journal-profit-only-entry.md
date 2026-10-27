# Journal profit-only entry — 2026-10-27

Request: manually add trades to linked demo journals using profit/loss alone; retain file imports including HTML.

- Add trade is available for every selected owned manual/import/demo journal, excluding the automatic ZYON journal and consolidated view.
- Net P&L is the only required trade field. Reporting date defaults to today and can be changed. Optional execution/review/evidence details collapse below the result; editing retains the detailed view.
- Missing instrument/direction/size are explicitly unspecified/unknown/zero-as-unrecorded. Missing prices, duration, risk and excursions are not invented. Existing excursion evidence survives editing.
- Results enter the existing journal statistics, calendar and equity curve. No paper balance, order, position or fill is created or altered by a manual journal result.
- Authenticated create-trade checks the exact owned account id/name, accepts existing journal sources, requires finite P&L and preserves account metadata. File imports remain in the existing importer; the button now reads Import trades.
- HTML table fixture imported an ES trade into 20 october. Tests use synthetic records only; no owner trade was saved.

Verification: 43 tests across manual outcomes, HTML import, actual create-route branch with owned-account/invalid-input checks, demo reconciliation, durable recording, persistence, statistics, trade details and resets pass. Scoped ESLint and full production build pass. One preliminary build failed because a generated earlier ES baseline TypeScript fixture was included by the repository's broad tsconfig; generated fixture files were retained with .baseline suffix, then the full build passed. No runtime configuration change was required.

Existing launch dependencies remain open: provider/parity and replay archive completeness, off-box backups, and full live-market acceptance of unrelated chart indicators. This change does not certify or modify those areas.
