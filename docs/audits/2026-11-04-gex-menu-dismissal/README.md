# GEX Data click-away dismissal — 4 November 2026

## Fault and repair

Add Tool and other shared native dialogs did not listen for backdrop gestures. Menus listened only in their own document, so a click inside a chart iframe never reached their outside-click handler.

The shared dialog builder now dismisses a completed pointer gesture on the backdrop. Gestures starting inside the dialog remain inside interactions even when released outside. The shared menu coordinator observes same-origin chart documents, including newly inserted/reloaded frames, and dismisses on outside clicks. Listener registration is once per document/frame per coordinator. Nested pickers preserve their parent filter panel; a sibling picker replaces only the nested picker. Escape and existing close buttons remain available. Removed the superseded workspace-only listeners so they cannot conflict with nested pickers.

This applies to the shared GEX Data popup/dialog paths, including Add Tool, Page Filters, Global Filters, Display, Settings, layout/help and saved workspaces. It does not change filters, recordings, provider delivery or trading services.

## Validation

- 834 GEX Data/reference tests passed, including four new menu lifecycle/backdrop tests.
- Isolated headless Chrome: Add Tool backdrop dismissal, inside click, drag-out safety, Escape; Page Filters, Global Filters, Display, Settings and Workspaces closed on actual nested chart-frame clicks. Inside clicks and wheel events preserved panels.
- Existing saved-workspace browser regression passed: save, import, export, delete and drag/drop; no page errors or missing assets.
- Browser tests used local fixtures with external network blocked and zero provider requests. The owner's tabs and live feed were not touched.
- Full production build passed before release. Deployment is through the existing main-only Git integration; exact deployed revision and changed public asset hashes are verified separately after push.

Reproduce locally with `scripts/audits/gex-menu-dismiss-browser.cjs`; use the environment's Playwright module and installed Chrome executable.
