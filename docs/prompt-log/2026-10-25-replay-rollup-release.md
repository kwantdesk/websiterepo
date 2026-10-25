# Replay and Levelz production rollup — 2026-10-25

Owner explicitly approved deployment: "deploy it all bro". This supersedes the pending-release blockers recorded in the five preceding replay/Levelz receipts; those entries describe the state before this approval.

## Approved scope

- Replay indicator causality and strategy-input guards, scoped frame/rewind safety.
- Quiet CVD execution-sync and routine replay history-loading copy.
- Selected-period historical candle/study windows, completed-bar exact Footprint viewport history and completed-minute profile checkpoints.
- Explicit1x real-time default, slower speeds, elapsed-time playback and hidden-tab pause; plain CME replay requests its execution tape without requiring CVD.
- Levelz page/route/navigation retirement, preserving stored preferences and reusable code.

## Pre-release verification

-320 combined focused regressions pass, including all127 catalogue causality cases, selected-range fixture, scheduler, exact/compact Footprint and profile coverage tests. Existing GEX Vue replay script also passes.
- Final local production build/TypeScript passes; generated app-path manifest contains zero Levelz routes. Scoped lint passes with only the two existing AppSidebar image warnings. Full Chart monolith lint is not claimed after previously recorded heap exhaustion.
- Known stale source-string assertions in broader pre-existing tests remain documented in individual receipts; not counted as passes. No signed-in all-settings/vendor/motion acceptance certificate is claimed.
- Twenty current-only studies still lack verified replay adapters; source archive gaps and sampled-tape limits remain. This release does not fabricate missing data or certify every historical tool/session.

## Delivery

One scoped main push to the existing websiterepo-yfmi/kwant-desk Git integration only. No preview/direct Vercel deployment, gateway restart, new service, provider subscription, trading change, ALGO change or unrelated native/socials changes. Final commit/deployment/public identity and route verification will be recorded locally after deployment; no extra documentation-only push.
