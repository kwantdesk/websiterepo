# GEX DATA blank charts and tools — 2026-10-20

Request: all GEX DATA charts and tools open blank.

Confirmed on production: app.js v9 throws `Cannot set properties of null
(setting 'textContent')` inside showTool. The prior connection-banner removal
deleted `.page-name` but left writes in both showTool and showBoard. Tool startup
stopped before rendering controls or requesting data. This was our frontend
regression, not a proven provider or VPS fault.

Repair: remove both obsolete writes and version app.js v10. Keep the banner
removed; retain API handling, real errors, shared request behaviour and refresh
cadence. No gateway restart, new services or additional polling.

Validation: all 184 focused GEX DATA/reference, options-flow-panel and live-theme
tests passed. New test executes actual showTool/showBoard against every one of
the 22 catalogue entries without the retired banner, checking controls render,
load is reached, and the workspace can be restored. Production visual verification
and deployment receipt are recorded after release.
