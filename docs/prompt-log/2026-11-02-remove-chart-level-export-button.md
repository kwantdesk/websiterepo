# Remove chart-level export toolbar button — 2026-11-02

Owner requests removal of the download icon labelled Export chart levels from the top-right Charts toolbar. Removed only that nine-line button in KwantifyWorkspace.tsx. Time-zone, Replay, indicators and the other controls are unchanged; retained dormant export implementation rather than refactoring a large unrelated block. Download icons elsewhere are still used. No feed/account/data/settings/backend operations.

Validation: reviewed the exact bounded diff; full production Next/TypeScript build required before the one scoped main release. No new tests for this reversible button removal and no standalone giant-workspace lint per memory guard. Build evidence: tmp/remove-chart-export-build.log. Verify exact live commit and published toolbar code after deployment.
