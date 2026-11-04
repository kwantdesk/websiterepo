# Bounce Levels live-edge projection ramp — 4 November 2026

The reported screenshot shows simultaneous diagonal jumps in positive and negative ribbons at the live edge. A reproducible source defect was found: historical projected frames pair source and target minute opens, but the live frame fell back to the latest target close and source spot when that pair was unavailable. That changes the projection convention at the final point and can move all strikes together. The owner's exact captured frame was not available, so this is a reproduced matching failure, not a claim to have recovered its original provider payload.

Cross-instrument live mapping now requires matching minute opens. It first checks the compact live source candles (which may lead the session archive), then the archive. While the display/source pair is missing, retain the last verified frame with its original timestamp and exposures; no invented current projection and no stale-to-live timestamp relabel. Once the paired minute arrives the live frame resumes. Same-underlying direct strike prices, exposure values, palettes, ribbon geometry and provider delivery are unchanged.

## Verification

- Four new regression cases fail against preceding commit 6d15b9f7c6c697ab783126dd47eebb6443286096 and pass with this fix. Cover QQQ/NQ ratio and SPX/ES basis, absent display minutes, compact-source/archive lag, preserved past geometry and recovery when paired minutes arrive.
- 29 projection, prominence and replay-clock tests pass. Existing Bounce Levels engine script passes. Scoped ESLint passes.
- Isolated headless Chrome uses the actual Lightweight Charts and BounceLevelsPrimitive with synthetic local fixtures and all external network blocked. Baseline reproduces the diagonal ramp: maximum mapping error252.5 target-price points, equivalent-strike pixel difference114.516px. Fixed mapping and pixel error both0. No browser errors. See clearly synthetic before/after fixture screenshots and JSON.
- Full production build passed. Release uses one scoped main-only push; exact production commit verification follows deployment. No live gateway restart, provider reset, owner-tab refresh or trade mutation.

Reproduce browser: scripts/audits/bounce-live-edge-browser.cjs; set BOUNCE_EDGE_BASELINE=1 for the pinned preceding source. Browser fixture dependencies follow existing audit runtime environment variables.
