# GEX DATA filter row — 2026-10-20

Request: remove the randomly grey filter background and center controls in row.

Cause: inherited reference `.tool-controls` background and `align-items:end`;
embedded rows had padding plus content-box height and unequal action heights.

Fix: add tool-controls to exact host-theme flat surfaces. Center embedded control
wrappers/actions vertically, use border-box 42px rows and 24px action buttons.
Preserve left/right layout, small-screen horizontal scrolling, all controls and
data logic. Version stylesheet v7. No new requests or polling.

Verification: 11 focused background, startup/navigation and toolbar tests pass.
Production visual verification and release receipt follow deployment.
