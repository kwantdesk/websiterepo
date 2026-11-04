# Indicator settings audit — 4 November 2026

Read [FINDINGS.md](FINDINGS.md) for the findings, per-indicator evidence and remaining limits. Read [TEST-FAILURE-TRIAGE.md](TEST-FAILURE-TRIAGE.md) for every initial failed command. This is a completed catalogue/settings pass, not a blanket certification of live market rendering or provider parity.

## Evidence

- validation-summary.json — counts and validation limits.
- dialog-interactions-consolidated.json — every tested control action, saved fields, shared-state changes and disabled actions.
- dropdown-option-interactions.json — every offered dropdown choice checked by the supplemental pass.
- library-lifecycle.json — Add/off/on/remove or documented special behavior for every registered entry.
- dialog-reopen-persistence.json — Save/Close/JSON restore/reopen for every registered entry.
- input-persistence.json — boolean/numeric save probes, including enforced constraints.
- palette-persistence.json — all selected gradients and declared colour overrides survive normalized storage.
- calculation-mutations.json — output mutations under the candle fixture; unchanged output is inconclusive.
- authoritative-fixtures.json — data/calculation fixture commands and their output.
- findings.json — fixed findings and open work.
- controls.json / CHECKLIST.md — full setting inventory and live chart sign-off checklist.
- test-results.json / test-failures.json / test-failure-triage.json — the initial 237-command sweep and failure classification.

## Repeat the isolated UI tests

Run from the repository root. JSDOM is installed in a temporary audit directory, not as an application runtime dependency. These tests use isolated local storage and no logged-in trading workspace.

```powershell
npm install --prefix tmp/indicator-audit-runtime --no-audit --no-fund --ignore-scripts jsdom@26.1.0
node scripts/audits/build-indicator-dialog-audit.cjs
node scripts/audits/audit-indicator-dialog-interactions.cjs
node scripts/audits/audit-indicator-dropdown-options.cjs
node scripts/audits/build-indicator-lifecycle-audit.cjs
node scripts/audits/audit-indicator-library-lifecycle.cjs
node scripts/audits/build-indicator-persistence-audit.cjs
node scripts/audits/audit-indicator-dialog-persistence.cjs
node scripts/audits/consolidate-indicator-dialogs.cjs
node scripts/audits/write-indicator-audit-report.cjs
```

Run the inventory generators in scripts/audit-*-controls.mjs to refresh source inventory and common calculation probes. Exact market output requires recorded executions, depth and options snapshots on the corresponding dedicated paths.
