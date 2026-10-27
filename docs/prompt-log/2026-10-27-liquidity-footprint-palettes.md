# Footprint colour palettes on Liquidity Map — 2026-10-27

Owner requests the same palette choices available on Footprint.

Added all twelve existing gradient schemes to a Footprint palettes optgroup in Liquidity Map Display settings: Chromey Mono, Pink→Blue, Yellow→Blue, Orange→Green, Red→Yellow, Black→White, Pink→Purple, Cyan→Magenta, Lime→Teal, Violet→Amber, Crimson→Indigo and Red→Lime. Existing heat palettes and Automatic remain available; default/saved choice unchanged. Styled dropdown includes gradient swatches.

Canonical definitions moved from volumeProfileGradients.ts to public/shared/indicator-gradients.js, with adjacent TS declaration. Footprint/profile imports and native heatmap import the same source; no second drifting colour list. Zero heat remains dark, exact from colour at20% LUT intensity and exact to at100%. Normal sensitivity/dimming interpolation still applies. Bid/buy accent uses to; ask/sell uses from, retaining the existing liquidity market-side convention. Existing renderer palette invalidation, preference saving and cross-device bridge are reused. Iframe, main, renderer, palette and CSS asset revisions updated so a cached renderer cannot fall back to Signal Green for the new IDs.

Validation:16 tests pass, including all twelve real raster outputs and exact LUT endpoints/accents, shared definitions, preserved existing palettes and option creation before custom select enhancement. Existing Footprint palette script8/8 passes. Scoped ESLint and build/typecheck checked. Legacy test-volume-profile-gradients.mjs fails its Chromey Mono theme-name assertion because that theme was previously pruned: HEAD has the same id/label/endpoints and this task does not change themes.

Production/browser verification appended after release. No feed/provider/recording/order changes.
