# Footprint opening row grouping

Owner reports first opening Footprint shows coarse/consolidated numbers, then changes to the proper view. Reproduced two stale memo dependencies in actual Chart expressions: the initial fallback 160-candle source window and automatic ticks-per-row both survived the `chartVisualReady` transition after the viewport/price scale settled. A provisional fit-all scale produced 100-tick rows; the final scale required 3 ticks, but without another dependency update the old result remained. Quiet feeds made the mismatch linger.

Recompute the source window when the chart initializes/settles and grouping when its opening scale settles. Apply live footprint input references and primitive presentation in layout effects before browser paint. Keep provisional footprint rows out of the primitive until the existing chart viewport-ready signal; do not add a new timeout or loader. Existing exact-history opening gate and established live/history row retention remain. Manual ticks-per-row values are preserved.

Validation: 43 targeted tests pass. New tests run actual Chart memo expressions with cached dependencies, changing scale/window without candles/trades: automatic grouping updates 100 -> 3; source window changes from fallback 160 to settled 48; manual 7 remains 7. Actual presentation clears provisional rows and installs final rows in layout phase. Against former HEAD, both memo tests and the presentation regression fail. Existing footprint history handoff, exact rows, live geometry, numeric execution ordering, settings and prepared-price tests pass.

Scoped ordinary ESLint: 0 errors, 133 existing Chart warnings, with the previously documented optional React Compiler rules disabled per invocation to stay within memory limits. Production build/TypeScript and deployment result recorded below once complete. No gateway restart or owner accounts/settings/trades modified. No owner browser visual observation was performed; this is reproduced source/effect verification.

Production build and TypeScript completed successfully (1536MiB heap, BelowNormal priority).
