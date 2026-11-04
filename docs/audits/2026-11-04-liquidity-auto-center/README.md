# Liquidity map auto-centre under vertical compression — 4 November 2026

The actual application reproduced two independent faults against revision 70be28c68666f12003e8da983188fd03d79ee243:

- The renderer insisted on an 80px plot even when its canvas had only 26px available (220px window with CVD open). At still shorter heights the fixed 118px CVD slot consumed the entire price pane.
- An order overlay pinned renderView.centerTick to orderScaleCenter, while the current-price label continued claiming the middle. In the baseline NQ example, actual price was at Y=66.59 while the label/midpoint was Y=339. Damped auto-centre could also disagree with its centred label between updates.

The renderer now uses the actual available canvas height, bounds axis/header space for short plots, and anchors the auto-centred price exactly rather than easing it away from its own label. Order overlays keep their price anchors and no longer override the enabled camera centre. CVD keeps its existing 118px height on roomy charts and shrinks to at most 35% of the workspace when needed, including the matching right-rail filler. Small-pane marker insets also shrink with the visible plot. Manual centres remain available when auto-centre is disabled.

Validation: isolated actual application/renderer, synthetic local data, external network and WebSockets blocked. 96 cases cover NQ/ES/GC, CVD on/off, order overlays present/absent, window heights 900/500/300/220/180/150 and growing back. Every actual last-price Y equals plotHeight/2, the plot fits its visible canvas, and the module fits the window. Manual positioning is preserved; re-enabling auto-centre after a price jump centres the new price. No page errors. Detailed before/after measurements attached.

The selected regression suite passes 21/23. The same two existing protection/trading source assertions fail against the committed baseline and the changed source; failure names are identical. Price zoom, smooth-motion and theme tests pass. JavaScript syntax and full production build pass. Release is scoped to main.js, renderer.js and site.css plus the local audit harness/evidence; unrelated dirty depth-engine.js is excluded. No live feed, recordings, orders or provider subscriptions are restarted or modified. Exact production SHA and the three public asset hashes are verified after push.

Reproduce: scripts/audits/liquidity-auto-center-browser.cjs. CENTER_BASELINE=1 serves the pinned previous revision for comparison.
