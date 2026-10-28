# Live-price responsiveness and tick increments — 2026-10-28

Request: P&L moves ahead of chart price; user wants the responsive movement seen on order-flow platforms and asks whether NQ can use increments below0.25.

Verified CME Chapter359,35902.C: outright NQ minimum0.25index points/$5 per contract (intermonth spreads are a different contract use). Official Bookmap Main Chart documentation separates BBO and last-trade displays. An arithmetic BBO midpoint can be between outright ticks; it is not an execution price. KwantDesk P&L marks longs to bid and shorts to ask, while futures OHLC uses actual executions, so they can change at different times legitimately.

Investigation correction: initial commentary suspected several queued clock snapshots; closer source inspection confirmed same-bar observations already coalesce. The confirmed avoidable delay was double frame scheduling: workspace execution accumulator schedules requestAnimationFrame, then Chart schedules another requestAnimationFrame before series.update. The underlying chart library still manages its own canvas painting; this is not a guaranteed total milliseconds reduction or a zero-latency claim.

Change: add optional paintInCurrentFrame to the internal candle event, set only by the visible execution accumulator. Normal clock charts consume that prepared frame directly, cancelling any older queued frame and finalizing pending closing/current bars together. Guard scheduleNext during the bounded drain so no orphan follow-up callbacks remain. Network/unprepared events keep their ordinary frame scheduler; event charts retain distinct queued bars and replay still rejects live events. Tick size, OHLC values, source extrema, execution/protection logic, quote P&L and provider feeds unchanged. No interpolation or extra fabricated sub-tick candle prices.

Verification:38 tests pass including actual Chart effect canvas updates, cancellation/latest close with retained wick, same-frame rollover, event/replay isolation, existing candle authority/repaint/source fixtures. Existing rollover source test now supplies visible-document context for the new event flag. No owner settings/orders/accounts changed and no gateway restart. Build/lint/release below.

Sources: https://www.cmegroup.com/rulebook/CME/IV/350/359/359.pdf ; https://bookmap.com/knowledgebase/docs/KB-SettingUpAndOperating-HeatmapMainChart

Full1536MiB-capped BelowNormal production build/TypeScript passed.38regressions pass. Scoped lint0errors/152existing warnings with optional React Compiler analysis disabled for this invocation only (ordinary React/Next/hooks/exhaustive-deps retained; config unchanged). Release pending.
