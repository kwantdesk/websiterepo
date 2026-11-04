# Cross-instrument Bounce projection alignment

## Report and cause

Owner supplied QQQ Bounce levels over NQ with large zigzag ribbons, unlike native QQQ Bounce in GEX View. The canonical futures history hook supplies each containing minute's OPEN; the mirror paired this against gexMapPriceAt's source minute CLOSE. Even perfectly synchronous QQQ/NQ returns therefore oscillated the projected ratio/basis by one minute's return. All strikes inherited this artificial displacement.

## Repair

Cross-instrument geometry now pairs the source and target OPEN at the same recorded minute timestamp, both for historical frames and for live frames when that pair is available. Missing source minutes are not substituted with old closes or future opens. Direct source-on-source prices remain exact source strikes. The source close still serves the existing Map classifications; projection reference prices are separate. No exposure, colour scale, role classification, linked settings, chart OHLC, provider or backend feed was changed.

Projection cache keys now include source openings so a source opening correction cannot retain stale geometry. Compact/history merging preserves opening changes even when the close is unchanged. Existing live spot/last-trade fallback remains available when no paired live minute has arrived; this is still a projection between instruments, not an exchange-quoted NQ options strike.

## Evidence and checks

Isolated actual Lightweight Charts + BounceLevelsPrimitive comparison: same 24-minute synchronous-return QQQ fixture directly versus projected onto NQ. Old revision 5e534483 produced up to 202 NQ points artificial mapping error and 91.61 pixels difference. Current code: zero mapping error and zero matched-node pixel difference (75 rendered hits), with no browser errors. Before/after screenshots were visually checked. Pan/zoom plus a replay cutoff were exercised. These are controlled fixture measurements, not a claim of numerical equality between real QQQ and NQ price scales.

25 focused projection, replay-clock and prominence tests pass. Projection tests cover QQQ/NQ/MNQ, NDX/NQ/MNQ, SPY/ES/MES, SPX/ES/MES, IWM/RTY/M2K, unknown-close causality, missing minutes, cache invalidation, archive opening corrections and direct QQQ strikes. Existing 36 Bounce/GEX Map parity checks pass. Scoped ESLint passes. Full production build passed, including TypeScript and page generation.

Broader legacy settings suite: 9 pass; one existing source-text assertion expects a preserveBounceOverride declaration absent from the unchanged chartIndicatorConfig.ts at HEAD. It is unrelated to this projection repair and was not rewritten to hide the failure.

No gateway/terminal/provider subscription restart or owner-tab refresh. Only the frontend projection repair is released; unrelated dirty work is excluded.
