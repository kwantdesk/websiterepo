# Exact liquidity map rollback — 2026-10-29

Owner reports bid/ask trails, DOM and buy/sell colours no longer match the previous map after the pause/history change. Owner then explicitly instructed: stop skill/browser inspection and just revert.

Restored all frontend map files and iframe host to the exact tree before 11fc3ac8 (2a57b333). Removed history-transport.js and its feature tests; restored previous controls/replay tests. No added pause control or speculative renderer/settings migration. Renderer, palettes and depth engine already equal the target revision and remain byte-identical. Owner preferences/accounts/trades untouched. `git diff --quiet 11fc3ac8^ -- public/heatmap-app src/components/liquidity-map/LiquidityMapWorkspace.tsx` returns 0.

37 focused regression checks pass: replay, bubble stability/anchors/sizing, ES zoom, modal overlays, camera motion, theme contrast and volume colours. Seven legacy control-source assertions and one settings-dialog assertion fail on this exact restored baseline; not claimed fixed. Full production build/TypeScript passes (1536MiB cap, exit 0).

Connected browser exposes only a signed-out public page; stopped inspection on owner's instruction. No claim of signed-in visual acceptance. This is a code rollback, not proof of the individual reported visual cause. Existing stored theme/settings were not reset. The independent VPS archive service and raw recordings remain; no live gateway/provider restart or account data deletion. Backend performance activation, original footprint transient, vendor/archive/backup and browser-owned unattended execution remain separate open work.
