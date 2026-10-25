# Quiet replay progress — 2026-10-25

Owner request: remove execution-sync wording (including CVD) everywhere and repetitive replay history-loading copy.

- Shared CVD retention still preserves the proven series but no longer supplies a syncing-executions header. Removed the sibling waiting-for-executions header from CVD-family panes too. Both apply to every caller, including live charts and backtesting.
- Shared workspace pane presentation suppresses routine history-loading, candle-count completion and reconnect progress during replay only. Live copy and genuine empty-history, limits and failure messages remain unchanged. Loading requests, causal gates, retry cadence and rendering are untouched.
- 150 focused replay/CVD tests pass. Scoped pane/helper lint and full TypeScript no-emit check pass. A broader chart-loading-states test retains a pre-existing source-string assertion failure; the same expression does not match HEAD either. No unrelated test expectations changed.
- Production release remains blocked by the prior reviewer decision pending explicit owner deployment approval. No commit, push, gateway change or paid service request performed.
- Existing archive completeness, provider parity and production acceptance limitations remain open; this is copy-only work, not a data-recovery fix.
