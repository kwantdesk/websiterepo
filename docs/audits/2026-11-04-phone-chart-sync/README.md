# Phone and desktop chart-state sync — 4 November 2026

The existing isolated two-context account test passed before this work: layouts, SVG drawings, favourites and demo trades already traversed the common account snapshot. That does not prove the owner's live devices were connected or diagnose their transport/account state. This change fixes independently demonstrated missing paths rather than claiming the whole prior implementation was absent.

## Fixed paths

- Professional drawing persistence wrote localStorage without the account-change notification. It now uses the protected, coalesced account-write path.
- A mounted/newly mounted chart could replace its account-restored professional drawing document with the older separate migration endpoint. Scoped account documents, including intentional empties, now win; endpoint loading is fallback for documents not restored locally.
- Settings enabled its sync loop before initial ownership/hydration settled and did not reconcile later remote theme/chart settings into its controls/ref state. It now gates startup and updates controls and colour-picker state on received revisions, avoiding edits based on stale colours.
- Actual magnet-strength, quick-emoji, emoji selection, last-used drawing-tool and legacy drawing-favourite keys were absent from the tracked-key list. Added them and mounted listeners so account receipts reach visible tool controls, not only localStorage. Indicator favourites refresh on receipts too. Active drawing gestures/tool selection are not broadcast to another device.

## Verification

53 targeted account, deadline, notification, theme, race and clear-barrier checks pass (50 existing plus3 new). New tests execute the real Chart persistence effect/migration loader. Selected component/key ESLint passes; full production build passes.

Expanded browser test runs actual Workspace/Chart/Settings components in separate Chromium contexts at1440x980 and390x844, with independent browser stores and a common local authenticated-store/realtime fixture. All external requests are blocked; no real user data is edited. Twelve checks cover initial shared layout/full-width phone plot, real toolbar-drawn line received and visibly rendered, actual chart canvas pixels changing colour, reverse preferences/colours, live demo position/stop/exit, and no save starvation under repeated events. Final synthetic timings: real toolbar line1158ms, additional drawing745ms, reverse preference662ms, trade1275ms. These are local fixture timings, not production latency guarantees. No browser errors.

Negative control pins only Settings to preceding commit8f456d7ce3d88ef029add1a242ee70672dbae6d8: earlier flows still work, but the already-open phone's Body Up control never changes to the received colour and the test times out. Current Settings passes. DEVICE_SETTINGS_BASELINE=1 reproduces that negative control using scripts/audits/device-sync-browser.cjs.

Release is one scoped main-only push followed by exact live commit verification. No feed/VPS restart, owner-tab refresh, saved-account reset, drawing deletion, realtime polling increase or new continuous Vercel traffic.
