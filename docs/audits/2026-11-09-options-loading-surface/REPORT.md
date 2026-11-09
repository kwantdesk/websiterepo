# Options loading surface — 9 November 2026

The Options loader filled only 70% of the viewport within a naturally sized main element. On a 1400 × 1200 fixture this left 269 pixels uncovered below the loading surface.

Made the Options main element a full-height flex column and allowed its existing shared loader to stretch into the remaining space below the toolbar. Removed the loader wrapper’s 520-pixel minimum, so short panels fit too. Data fetching and trading behavior are unchanged.

## Verification

Isolated headless Chrome rendered the actual GammaWorkspace and shared loader with API requests held pending. Before/after screenshots and measured bounds are included here. At 1400 × 1200, 390 × 844 and 640 × 320 the repaired loader starts immediately below the toolbar and ends exactly at the workspace bottom; its background matches the workspace theme.

- Production webpack build, TypeScript and static generation passed in the isolated release worktree.
- Scoped ESLint passed.
- All 15 Options workspace timeout/cache/provider tests passed.
- A broader shared-loading test run had 17 passes and one unrelated existing KWANTY source-pattern assertion failure. No KWANTY changes were made for this repair.

This verifies loading layout with controlled pending requests, not live provider availability.
