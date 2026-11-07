# Arrow Path visibility when leaving the chart

The chart placement surface clears `cursor` on pointer leave. Its preview used
to require both `pending` and `cursor`, so an unfinished clicked Arrow Path
vanished on the way to the Cursor button. Selecting Cursor committed its clicked
anchors and made it reappear. No saved drawing was deleted.

The preview now retains the pending Path's clicked anchors when the pointer is
outside the plot. Only the unplaced hover segment is removed. Re-entering resumes
that segment; choosing Cursor keeps the existing commit behavior. Other tools'
placement behavior, saved coordinates, hit testing and market data are unchanged.

Validation:

- Actual `ChartDrawLayer` in isolated headless Chrome: the previous HEAD fails
  `placed path stays visible outside plot` (zero polylines).
- Repaired component: visible clicked path outside plot, hover-leg re-entry,
  exact three-anchor single commit, no blank animation frames during the move
  and Cursor click (12 sampled frames), double-click completion and one-anchor
  discard pass; zero browser page errors and no external requests.
- 219 existing drawing-system, painted-hit and timeframe-integrity tests pass.
- Scoped component/fixture ESLint and diff whitespace checks pass.

Reproduce using `node scripts/audits/arrow-path-visibility-browser.cjs`.
The runner uses the already installed local Playwright Core and launches a
separate headless Chrome; it never operates the owner's browser. Before committing,
`PATH_BASELINE=1` tests the pre-fix HEAD as a negative control.

Release gate: isolated full production build, scoped main push through the
existing Vercel Git integration, successful deployment and exact public commit
verification. No gateway restart or account/order/workspace mutation required.
