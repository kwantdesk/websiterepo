# GEX Map: current per-sign colour ranges

The owner reported that the Cyan/Magenta scheme never reached magenta because the legend used the negative peak (for example 1.76B) as the positive endpoint too. They requested each sign's actual peak at its own palette endpoint, an accurate bottom legend, distinct signs throughout the scale, and identical behaviour for Bounce Levels and all schemes.

## Colour contract

- Compute `{min, max}` from finite signed exposures in the current reconstructed surface. Include zero; do not invent an opposite-sign peak. Use the selected ticker/model/expiry/units/snapshot's data, independent of scroll position.
- Negative exposures occupy the negative half relative to `abs(min)`; positives occupy the positive half relative to `max`. Both existing palette endpoints are reached even when the sides differ by orders of magnitude or a Greek's values are below one unit.
- Interpolate inside each five-colour half independently. Nonzero opposite signs never interpolate across the zero seam; a sign-preserving floating-point boundary also protects extremely small ratios. Zero itself is neutral.
- Preserve the chosen endpoint hues. Each stock half fades toward a dim neutral in its own hue, rather than fading through the other sign's hue. Upgrade only exact, unedited former stock ramps on load; hand-edited stops, side arrays and custom Star colours survive. Theme/fallback ramps follow the same shape. The legacy numeric strength argument remains compatible for existing symmetric callers.
- Legend positions use the same two half-ramps and zero seam. Actual negative/positive endpoints replace the former symmetric `±Star` labels. Small-unit endpoints retain precision instead of rounding real exposure to zero. Palette slot descriptions now refer to each side's own peak.

Present ladders, the forward expiry matrix, mirror-history nodes and the normal Chart's legacy colour-sync path consume the shared functions. DOM hex colours and Bounce canvas colours match exactly for the same palette/snapshot. Forward matrix cell text uses actual palette contrast for concrete colours, retaining its existing fallback for theme CSS colours.

Star/King selection, structural roles, displayed `% of Star`, node size, view highlighting/dimming, exposure values, mapping, recordings and provider requests are unchanged. Star view still selects the King; Full view displays the whole surface. Each historical Bounce frame uses its own range, so later peaks cannot recolour earlier snapshots. Layout/opacity animations remain, but background-colour transitions are removed so an updating node cannot temporarily retain an opposite-sign colour and disagree with the canvas.

## Verification

- Twenty-two signed-range regressions cover 1.76B negative versus 44M positive, endpoints and intermediate samples across all twelve schemes, sign-specific weak hues, stock-only migration/custom preservation, theme/fallback fades, near-zero sign separation, small-unit Greeks, missing signs/empty/nonfinite input, snapshot changes, matching CSS/hex sampling and precise legend values.
- Thirty-six Bounce/GEX Map checks pass, including asymmetric endpoints, unchanged King/exposure values, per-frame replay colours, unchanged-prefix/cache reuse, and all 279 available archived SPX nodes.
- Existing twelve-palette seed/custom-save compatibility checks and the complete Star derivation suite pass.
- Seven isolated headless browser scenarios render the actual Map, twelve mirror consumers, actual Bounce primitive and forward matrix. All twelve palettes saturate the two unequal peaks identically across their DOM/canvas-data outputs, and weak nodes match too; the legend shows the asymmetric range, scrolling leaves the range stable, units change both endpoints and reload retains the correct palette/range. No page errors. Network/auth/preferences are isolated controlled fixtures, not a live market-data comparison. Evidence remains in ignored `tmp/gex-signed-range-browser.log` and `tmp/gex-signed-range-desktop.png`.
- Scoped lint exits successfully with one pre-existing drag-bar `aria-valuenow` warning in the settings dialog. The full production build checks the large Chart component.

Release through the existing main-only Git integration and verify both deployment readiness and the live commit. Preserve unrelated work, including the independently edited social events route and earlier local release notes. No gateway restart or provider/account changes.
