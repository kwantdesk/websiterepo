# Bounce Levels: retain settings on unlink; consistent source/metric selection

The owner wants Follow GEX Map off to keep the existing surface, and reports incorrect-looking values when switching the options source to NDX or another ticker.

## Findings and changes

- Detaching previously copied the global numeric/view settings but retained AUTO and continued reading the shared panel catalogue. Later source/column changes could retarget an independent chart. A latent legacy EOD selection could also become active only after detaching: Chart deliberately ignores EOD while linked.
- The editor displayed Gamma if a linked selected source had no matching Map column, whereas the hook requested the saved local Greek. Source changes did not preserve the active linked Greek, so selecting a different underlying could reveal a different metric.
- Add one shared configuration resolver for editor and hook. A source's matching column wins while linked; otherwise both use the same valid local Greek, defaulting to Gamma only for unsupported values. Effective Dealer/Structural model selection remains unchanged.
- On detach, capture the actual resolved source, selected column, Greek, all calculation/view/interval/Star settings and the configuration-only panel catalogue. Pin AUTO to the active source and preserve the active live/chart-replay mode. Later shared edits cannot change these saved choices. The new `mapPanels` string survives the existing stored-indicator normalizer; no market data or credentials are stored in it.
- Selecting a new source clears a stale column preference and retains the current metric unless following a matching source column. Relink uses current shared settings; explicit source selection remains a local choice. Existing source validation/cache identities and stale-response cancellation remain intact.

No mapping formula or exposure values were changed. Index-to-futures basis, ETF-to-futures ratio and direct same-underlying mapping are numerically checked instead of treating all source tickers like QQQ. Historical futures mapping still uses canonical paired one-minute prices independently of host timeframe, with no synthetic or future price fallback.

## Verification

- Eleven regressions cover exact detach profile/source/Greek preservation, latent EOD protection, future shared changes, real preference normalization, missing-column metric consistency, linked/detached precedence, relink/invalid Greek handling, and explicit numeric mapping for NDX→NQ/MNQ, QQQ→NQ, direct NDX, SPX/SPXW→ES/MES, SPY→ES/MES and IWM→RTY/M2K. Raw strikes/exposures remain unchanged.
- Nine actual-component isolated Chrome scenarios render the real settings, mirror hook and canvas primitive on a 5m NQ host. Entire pre/post-detach snapshots and history match; the fixed-size actual chart PNG is byte/pixel identical. Subsequent shared changes leave it unchanged. NDX shows strikes 19950/20000/20050 mapped to 21950/22000/22050 for source 20000/host 22000, with Vanna matching the editor, including every historical slice. Switching back restores QQQ ratio geometry without stale nodes. Settings and geometry survive reload; relink adopts the current shared NDX/Charm configuration. Zero page errors. All auth/preferences/feeds are controlled local fixtures, not an assertion of a live vendor comparison. Evidence: ignored `tmp/bounce-detach-browser.log` and screenshot.
- Existing 36 mirror/parity, 22 signed-range and seven replay-settings tests pass. Scoped lint passes. Run the complete production build and verify the exact live commit after the single existing main-only Git deployment. Preserve unrelated local work; no gateway restart, provider/trade/account/recording mutations.
