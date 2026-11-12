# Chaikin Accumulation/Distribution overhaul

Catalogue item 14. DeepChart desktop comparison remains deferred. Each release uses a separate commit and push.

## Findings and repairs

- The live chart previously passed only its lite history window to the cumulative calculation. At the same timestamp, a 2,000-bar fixture returned 10,000 with all bars and 7,500 with the last 1,500. Both live and replay now use the loaded causal candles.
- The engine previously allowed a candle with classified executions through its volume check and then contributed zero when the candle lacked a reported total. The formula now uses reported volume when positive, otherwise the recorded ask and bid sizes. It adds nothing for flat or malformed candle ranges. An instrument without any real volume yields no line, and the library continues to block native ADL on cash indexes.
- The forming line now consumes the chart's existing execution and candle events for pane and overlay placement. It coalesces a burst into one 100 ms update, preserves earlier loaded bars while parent snapshots catch up, rejects another chart's events, and stops subscribing in replay. This adds no provider requests.
- A 500-volume browser fixture showed the pane ending before the latest candle. The pane had already translated its timestamps to chart coordinates before filtering against its source-time visible window. It now filters in source time and maps to the corresponding chart coordinate when drawing. The overlay uses the chart's native event time mapping.
- Added an optional average with simple, exponential, triangular and weighted modes. It is off by default and uses complete-window warmup, including a mean seed for exponential. The main and average plots have independently configurable widths and colours. Inputs and Style share the existing site controls. Average-only settings are disabled when the average is off. Theme colours and the shared palette picker remain supported.

## Verification

- 24 focused tests passed across the formula, invalid geometry, missing volume, all four averages, independent styles, and the actual shared live hook. A 4,500-bar hook regression matches the complete calculation after a mixed execution/candle batch, retains its cumulative seed and detaches in replay. Existing delta, price-study and KST coverage passed in the same run.
- The webpack production build passed. A separate integration run passed 125 of 130 checks. It reproduced the five known broader inventory and replay source-assertion failures recorded during Book Speed.
- A synthetic matrix covers 2,790 volume-compatible instrument/interval pairs and 11,160 calculation and replay cases. It records 540 unsupported source intervals and 70 otherwise supported cash-index combinations without native volume. This establishes compatibility with the supplied bar shapes, rather than venue-wide recording coverage.
- Isolated Chromium used a 2,500-bar NQ recording for the time chart and a derived 500-volume timestamp fixture for event layout. An injected forming update changed the lower pane in about 122 ms on both fixtures and changed the event overlay in 132–141 ms. Both pane variants ignored live updates in replay. The 390 px settings check exercised the average enablement, weighted selection and saved-settings normalization without browser errors. These are local dispatch-to-observed-paint timings.
- Read-only VPS minute samples returned 31 volume-bearing bars each for NQZ6, MNQZ6, ESZ6 and MESZ6. Returned contract identities matched. The full formula agreed with the independent implementation and both series matched their causal replay prefixes.
- The two-line live model benchmark with weighted length 1,000 measured median and p95 of 3.6/5.4 ms at 20,000 bars and 20.8/33.8 ms at 100,000 bars on the local host. The calculation still scans the loaded window at each publish. The browser's heaviest multi-panel and maximum-history cases remain open.

## Reference and remaining checks

DeepChart documents optional averages and independently styled subgraphs. Its public reference also lists slope/sign colour, short names, individual labels and auto-center. Those are comparison notes. The existing KwantDesk placement and palette choices remain available. The native setup, output and timing need a later desktop comparison. [DeepChart indicator settings](https://www.deepcharts.com/helpcenter/article/chaikin-accumulation-distribution) [TradingView ADL formula](https://in.tradingview.com/support/solutions/43000501770-accumulation-distribution-adl/)

Static REA found the installed indicator-description getter `VolAnalysis.Properties.IndicatorDescriptions.get_Chaikin_Accumulation_Distribution` at RVA 79432. The retained declaration establishes the named member. The protected calculation remains unverified. Current provider arrival latency and full per-instrument live/archive coverage remain open.
