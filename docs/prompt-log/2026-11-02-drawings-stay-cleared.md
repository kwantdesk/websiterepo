# Drawings stay cleared — 2 November 2026

Request: cleared drawings must not reappear after left CLR, context-menu clear or later saved-data restoration.

## Root causes and changes

- The left drawing rail cleared only the toolbar drawing array. It now invokes the same complete operation as the chart context menu, including professional, legacy-position and precision stores.
- Precision hydration merged a delayed pre-clear API response back into the drawing document. Both precision and professional readers now respect a durable clear barrier. Following an explicit clear, the account preference document is authoritative instead of an older duplicate API drawing document.
- Record identity merges could interpret old drawings absent from their baseline as independent additions. A separate account-synced clear ledger identifies the clear epoch per document/pane, so older epochs cannot merge old content back in. Peers acknowledging the same epoch still merge independent new drawings normally. Other panes and Algo remain separate.
- Full-document saves are serialized per owner/document across unmounts; stale delayed effects are guarded. Clear is persisted immediately, including precision drafts, rather than waiting for a timer.
- Clear cancels pending toolbar/text/freehand interaction, remounts only the drawing layer, and scopes the precision event to the intended chart.
- Empty scoped caches are intentional documents, rather than permission to import a legacy archive again. The owning pane also clears its old shared archive and records that deletion; another pane’s claimed archive and Algo’s separate namespace are preserved.

## Validation

42 Node tests pass: clear during initial account hydration, stale-device edits, clear followed by new drawing, repeated clears, scoped documents, actual late precision/professional callbacks, source-wired precision events, save ordering, replay persistence and account sync.

Actual Workspace/Chart rendered in isolated headless Chrome, with local fixture history and no external requests: left CLR empties every engine's persisted document and removes the visible line; reload stays empty; new drawing renders afterward; context-menu Clear invokes the same complete operation. No page errors. Artifacts: tmp/clear-drawings-browser-result.json and tmp/clear-drawings-browser.png. Fixture data was never sent to production.

Focused lint has no warnings or errors. Full production build and exact deployed Git SHA verification are required before completion. No gateway restart, data-feed changes, live trades, user accounts or settings resets.

## Limits

A disconnected device receives the clear when its account sync reconnects. Local storage and account sync remain the persistence sources; network/storage failures cannot make an offline device acknowledge a change immediately. No production user drawings were cleared during verification.
