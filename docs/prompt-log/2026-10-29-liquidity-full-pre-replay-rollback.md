# Full historical liquidity-map rollback

Owner explicitly rejected further repairs, approximations and mixed-version restoration. Requested the previous map, including reversal of the added replay mode, before starting again.

## Historical target

`2bd8ac0140011f29d078f5c941dcc6c8bfaf1c57`, 25 October 2026 at 16:20 Brisbane time, immediately before `7701c152` introduced the standalone shared Replay interface. This tree contains the last map implementation from 24 October. The earlier `6396118f` rollback removed only 28 October's pause/history feature. `41bd7f33` subsequently mixed 25 October presentation with later controller/scaling/modal code and a settings migration. Those are not this rollback's target.

Restored the entire tracked `public/heatmap-app/` and both `src/components/liquidity-map/` components directly with `git restore --source=<target>`. All **26 static assets and both components match the target**, with normalized checkout line endings. The complete file/hash ledger is `2026-10-29-liquidity-pre-replay-manifest.json` beside this receipt. No hand-edited renderer, scaling patch, palette substitute, cache-version rewrite or new settings migration is layered onto that tree.

Restored the standalone map branch inside `KwantifyWorkspace.tsx` exactly from the same target and removed its subsequently added Replay toolbar/dialog/transport, readiness gate, depth stepping and replay-clock participation. Preserve unrelated Charts, GEX and Kwanty changes in that shared file. The target already contained older archived-map message support for embedded chart use; it remains exactly as it existed then. This is not a claim that every historical replay-related function anywhere in the repository has been deleted.

Later map modules `display-rollback.js`, `modal-overlay-bridge.js`, `price-scale.js` and the already-retired `history-transport.js` are absent. This deliberately restores the older ES scaling, map modal behavior, palettes and trading-overlay implementation, including reversal of the most recent Trade-button loading fix. Shared platform trading helpers/label constants remain current for other charts, rather than rolling back their account/protection fixes.

## Validation

- `git diff --quiet <target> -- public/heatmap-app src/components/liquidity-map` returns **0**.
- All historical map tests are restored to the same target, including removal of later feature-specific tests. Exact test-tree comparison also returns **0**.
- The standalone branch matches the target; later `liquidityReplayReady` and `latestLiquidityReplaySession` integration is absent. The manifest records its SHA256.
- **102 existing checks pass**: 31 feed/motion/performance/bubble-anchor checks, plus 71 of 80 historical control/trading/theme/navigation checks.
- **Nine historical checks fail**, and are not rewritten or claimed green: eight toolbar/DOM/inspector/loading/cache-version/typography source expectations, and one old shared-label height expectation (24 versus the platform's current 18). This is an exact source rollback with known historical/shared-dependency limitations, not a claim of visual acceptance or universal repair.
- Scoped ESLint of both restored React components passes. The production build and TypeScript pass with the 1536 MiB heap cap. Check every restored public JavaScript file's syntax before release.

## State and deployment

No owner browser automation, order/account changes, explicit settings reset, provider subscription refresh or gateway restart. Stored recordings, derived archive data and the shared gateway remain intact. The separate previously recorded crossed-depth integrity fault has **not** been fixed or reverified by restoring UI source.

Deploy once through the established main-only `websiterepo-yfmi` integration. After deployment, require the public diagnostics commit to match, then hash all 26 assets served at the restored entry/import URLs against the historical manifest. A push alone is not production verification. The owner must fully reload to replace the already-running JavaScript.
