# Liquidity map loading: hide Trade overlay

Owner reported the standalone Trade button appearing above “Loading liquidity heat map” on refresh.

`LiquidityMapTrading` mounts before the iframe is ready, and its z20 button painted above the z10 loading mask. The parent now shares one `mapLoading` condition between its loader and the trading overlay. While loading, the overlay wrapper is hidden and its interaction flag is inactive. Existing inspector hiding and replay loading rules remain intact. The component stays mounted to preserve bridge messages and quote handling; no account, order, provider or map appearance settings were changed.

Validation: scoped ESLint, whitespace checks and production build/TypeScript pass. This is a small presentation change; no new test scaffolding or gateway restart is needed. Release through the existing main-only integration and verify the public commit.
