# Phone chart unexpectedly switches to ES

Owner reports that, with the same account open on desktop and phone, navigating on the phone randomly replaces the chart with ES.

The account revision listener restored the entire workspace on a peer active-pane update and selected the peer's active pane. Mobile shows only the active chart, so clicking the desktop ES pane could replace the phone's currently visible instrument. Even an unrelated synced palette/workspace update reapplied the saved peer focus.

Remote focus-only revisions now leave the mounted screen alone. Real shared workspace revisions continue to apply panes, drawings, settings and layout but retain that screen's current pane if it remains in the layout or floating windows. If the selected pane is actually removed, normal fallback to the incoming workspace still works. Initial account hydration and new mounts continue to restore saved focus. This applies to Charts, Options/GEX View and Algo scopes without mixing their storage keys.

Validation: 27 focused tests pass, including execution of the actual revision handler for all three scopes, deletion/hidden-pane fallback, initial hydration, account merge/read failures and drawing notifications. Full isolated webpack production build passes TypeScript and 86 static pages. Two isolated Chromium contexts exercise actual Workspace, account sync and storage application, with a controlled private database/realtime fixture and synthetic market candles. The old source fails the ES-focus assertion (phone switches from pane-2 to pane-1); the repaired source retains pane-2 and still receives the peer palette update. This is phone touch emulation rather than physical-device observation. No live provider, account or owner browser mutations.

Browser regression: `scripts/audits/phone-chart-focus-browser.cjs` reuses the existing device-sync fixtures. Local before/after logs: `tmp/phone-focus-before-browser.log`, `tmp/phone-focus-browser.log`. Release uses the existing main-only Git integration and exact public commit verification; no data gateway restart.
