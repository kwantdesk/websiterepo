# Home / top navigation response

Owner reports about ten seconds of no apparent response when opening Charts from Home or switching to GEX Vue/top navigation.

## Source findings

- Home LaunchCard used Next Link with prefetch=false and no pointer/focus/touch preparation. Home's AppSidebar has no persistent workspace onNavigateIntent callback, so its optional callback did no preparation either.
- The cold persistent layout imported the entire KwantifyWorkspace trading shell synchronously. Its navigation could not mount independently of that large bundle.
- After auth, a timer warmed Charts, archived ZYON, Gamma and Gexdesk regardless of destination. warmWorkspaceSection also invoked provider-data preloads, including unrelated options/Gexdesk requests. This competed with opening the selected workspace and spent resources on unused pages.
- Home still exposed /gex-cal and /gex-flow launch cards, but neither route exists. Current primary destinations are GEX Data and KWANTY.

## Change

- Add bounded, intent-only route and code preparation. Home cards use pointer entry, keyboard focus and touch; native sidebar links prepare their destination. Code import of the shell and the chosen chart/tool starts in parallel with route prefetch. Repeated intents deduplicate for 30 seconds; failed chunks can retry.
- Warmup imports code only. It does not mount workspace effects, open a market stream or fetch vendor data. Remove unconditional multi-workspace startup warmup and provider-data calls from workspace pointer warmup.
- Dynamic cold shell now exposes primary navigation in the normal theme independently of the trading-engine bundle. No extra loading wording/animation. Existing account ownership, auth, saved-workspace hydration and trade execution gates remain inside the actual shell.
- Persistent workspace navigation retains its immediate optimistic selection/history push without an RSC request. Modifier links retain normal browser behavior.
- Correct Home cards to GEX Data and KWANTY, preserving their existing previews/layout.

## Verification

17 focused tests pass: nine actual warmup/rail/card/layout/route tests, two Home launcher tests, three account-owned startup tests and three prior CVD/QuantStats viewport tests. The source VM harness executes the actual handlers and cold-layout fallback, not only source patterns. The former handlers/layout/routes fail against 8d20b6d1 (KWANT_NAVIGATION_BASELINE=1). Code preparation is checked to avoid vendor/data imports and does not await module resolution before preparing the route.

Scoped ESLint passes for the sidebar, Home, layout and new warmup module (two existing img warnings, zero errors). Full production build and TypeScript pass with a 1536MiB heap and BelowNormal priority. KwantifyWorkspace changes are limited to deleting the unused import, provider warmup call and startup warmup effect; no clean full-file lint claim for that large component.

## Limits / open work

This removes identified source cold-entry waterfalls/competing warmups and gives the cold navigation an independent mount path. It is not a measurement of the owner's physical signed-in ten-second delay or proof of sustained busy-session FPS. Data/auth/network wait can still affect chart readiness; no ownership/auth bypass or invented candles. Frozen CVD/QuantStats data reported separately remains unresolved: a bounded read-only VPS probe received fresh classified NQ executions, but browser inspection was stopped because the computer-use tool could not establish the active URL. Prior viewport tracking fix remains in place. No gateway restart; deferred backend performance activation, original Footprint opening transient, provider parity/archive completeness/off-box backup and browser-owned unattended demo execution remain open.

Deployment verification will be appended locally after the single main-only Git release.
