# Liquidity Map dialog layering and focus outlines

Request: Add Instrument appeared beneath the parent Trade button and watermark, and its search box had a white focus outline.

Root cause: the iframe dialog top layer cannot cover parent document overlays. Only settings notified the parent to hide trading/branding; instrument picker and shortcuts did not. A shared observer now reports whether any native map dialog is open, using the existing trusted frame/origin message bridge. Parent overlays and trading interaction stay hidden/inactive until all map dialogs close, including Escape/backdrop closure and overlapping dialogs.

Removed focus outlines/rings across the main website and embedded map as explicitly requested; search wrapper no longer adds a focus halo. Existing control borders and hover styles remain. Updated iframe/main/site-CSS asset revisions to 20261027-modal-overlays.

Validation: modal observer regression passed, main JS syntax check passed, workspace ESLint passed. Wider liquidity-map regression suite: 41 pass, nine failures; baseline test run against HEAD versions of all changed sources reproduces exactly the same nine failures (40 pass before adding new test). These existing source assertions were not rewritten as part of this fix. Production build and live browser verification performed before reporting completion. No owner trades or instrument changes needed for verification.
