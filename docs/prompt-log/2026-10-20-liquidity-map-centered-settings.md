# LIQ MAP centred settings popup — 2026-10-20

## Request

The LIQ MAP settings button should open the same sort of centred settings popup
as other pages, with the chart still visible behind it, not a panel on the right.

## Changes

- Converted the existing inspector to a labelled native modal dialog; preserved
  its actual settings controls, persistence and live callbacks without remounting
  the map or copying configuration into another editor.
- Centre the themed 620px popup in the map viewport, constrain height/width for
  small panes, scroll content, retain sticky title and ×. Light 35% backdrop,
  no frost, opaque themed panel; chart continues behind without reflow.
- ×, backdrop and Escape close; native focus containment; restore opener focus.
  A first Escape closes an expanded custom select. Disable chart hotkeys while
  settings is open so Space/letters cannot change the chart behind the popup.
- Depth, Signals and CVD settings use the same dialog pattern. Invalid panel IDs
  no-op; delayed native close events cannot close a newly reopened dialog.
- Parent hides/deactivates trade controls while the child settings dialog is
  open, without unmounting the execution bridge or stopping quote processing.
- Parent watermark/loading/replay overlays are also suppressed while settings is
  open: iframe native top-layer dialogs cannot otherwise outrank parent overlays.
- Version the changed iframe, main module and embed stylesheet once.

## Verification

- 64 focused tests pass, including 5 new dialog tests and prior map/paper cases.
- Scoped ESLint, JavaScript syntax and TypeScript `--noEmit` pass.
- Isolated browser uses actual HTML/CSS/dialog module and a synthetic canvas,
  no provider requests. At 1280×720 the dialog is x=330,y=24,w=620,h=672, exactly
  centred, with the chart visible behind. Canvas remains 1280×530 before/after.
  Verified Escape restores focus to Settings and outside click dismisses.
- Existing unrelated old source-contract assertions remain recorded in the prior
  trading task; not represented as repaired by this positioning change.

## Release

Pending one scoped main push and production verification. No new market feed,
polling, API or provider login. Production receipt will stay local after release
to avoid a documentation-only deployment.
