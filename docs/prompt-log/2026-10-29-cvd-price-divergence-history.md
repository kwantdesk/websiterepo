# CVD divergence history and native price-chart anchoring

Owner: the CVD detector pane keeps historical divergences, but the price chart only shows the latest and its markings wobble while panning/zooming. Preserve the working CVD pane.

## Cause

`Chart.tsx` separately called legacy `detectCvdDivergence` with session closing CVD points, an 80-bar fallback and a recent-live window. That API returns one signal and invalidates it when CVD catches up. The pane already calls `detectCvdDivergences` on session CVD bars and retains multiple confirmed swing segments within its configured 20–2,000-bar lookback. Price also painted inside the React SVG drawing group, which is projected separately from the candle canvas during gestures.

## Change

- The pane calculation now exposes its exact detected segments as optional calculated-series metadata. Its candle data, divergence series, detector, settings and numerical calculations are unchanged. Price uses those same segments, verified order-flow inputs, selected lookback and replay-causal input window; there is no second detector/recent-only filter or independent history scan.
- A dedicated `CvdDivergencePricePrimitive` attaches to the candle series. It projects every signal's original candle times and wick prices using the live native time/price scales during each chart paint. It has no cached screen coordinates or SVG gesture transform. Overlapping/touching segments are retained, offscreen segments are only culled for painting, and dots/labels stay fixed in screen size.
- Price uses the pane's resolved bullish/bearish plot colours (including schemes and custom colours) and width, with the chart theme background for labels. Multiple enabled instances are supported via each series' group key.
- Disabled/removed studies clear the primitive. Chart recreation reattaches/repopulates it; teardown detaches and releases it. The legacy single-signal SVG branch is removed. The indicator description now describes retained historical signals.

## Validation

`scripts/test-cvd-price-history.mjs` exercises the actual calculation engine and actual primitive renderer. It verifies multiple historic signals, exact shared detector output, persistence after later CVD recovery, replay prefix equality/no future signals, disabling, native pan and price/time zoom, fixed-size dots/labels, offscreen-and-back retention and detach. It also checks Chart's wiring/removal of the legacy overlay.

Existing historical detector checks: 6/6. Legacy single-detector compatibility checks pass with the repository alias loader. CVD settings parity: 10/10. CVD live flow/price scale/pane viewport checks: 11/11. Scoped ESLint for the new primitive, engine, catalog and regression script passes. Full production build and TypeScript pass with 1,536 MiB heap. The large Chart component was typechecked by the build; its full React-compiler lint was not rerun after a previously documented 4 GiB exhaustion on that file.

This is a frontend-only release. No gateway restart, feed/subscription changes, recording edits, order/account changes, extra polling or paid services. Owner's active browser was not controlled; native renderer behavior was tested with changing chart projection APIs, not claimed as a completed owner-tab visual audit.

Logs: `tmp/cvd-price-history-build.log`, `tmp/cvd-price-history-lint.log`, `tmp/cvd-price-pane-regressions.log`. Release through one scoped main push to `websiterepo-yfmi`, then verify the production commit.
