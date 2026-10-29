# Volume profiles above drawing tools - 29 October 2026

Owner screenshot shows the Long/Short calculator tint over profile bars. All chart drawings should sit behind volume profiles.

## Implementation

The native chart foreground (including profiles) is a separate canvas below the z24 SVG drawings. Changing native primitive zOrder cannot cross the DOM stacking boundary; elevating its interactive canvas would steal drawing clicks. ChartForegroundLayerPrimitive instead presents its completed bitmap once in a pointer-transparent z25 canvas. Queue one microtask from the native paint, after all native series/labels finish and before browser paint, with no additional rAF or profile recomputation. Hide only the original canvas's CSS opacity after a successful copy; its pixel buffer and event handlers stay intact. Preserve source opacity on the presented canvas. This keeps native studies/real fill markers in their original internal order while placing that foreground over SVG annotations.

Only activate when drawings/placement tool and native profiles are both present. One extra bitmap/canvas per active pane; zero backend/provider requests and no animation loop. Exact backing bitmap dimensions and CSS pane position support DPR, resizing and multiple panes. Disabling, teardown, failed copy or hidden/zero-size pane restores the original foreground; generation guards cancel stale queued work. Existing chart cleanup explicitly detaches the primitive before chart removal.

Manual fixed-range and anchored profile drawings are always rendered after other drawings, including placement previews, without changing saved creation order/anchors/styles. Shared arrow scale and position calculator geometry are unchanged.

## Verification

Unit checks:20 paint notifications coalesce to one presentation; correct CSS/bitmap sizing, DPR ratio, source opacity, non-interactive layer; resize, disable restoration, queued detach and failed-copy fallback.

Actual isolated headless Chromium with the installed Lightweight Charts engine, no owner session/storage or market calls, at DPR1 and DPR2: translucent purple native profile over green SVG calculator yields RGBA128/76/128/255; no drawing yields128/0/128/255, proving opacity is applied once. SVG click under the profile and background native chart click both work. Wheel zoom changes visible range; resizing, off/on and explicit detach remove/recreate exactly one foreground canvas with zero browser errors. Fixtures/screenshots in tmp/profile-layering-dpr1.png and dpr2.png are synthetic rendering tests, not market data.

Position-colours7/7 and fixed-entry/exit-arrow regressions pass. Scoped ESLint and complete1536MiB production build/TypeScript pass. Production via the existing main-only Vercel project; no direct CLI deployment, VPS restart, provider/trade/account changes. The separate live depth-source integrity fault remains unresolved.
