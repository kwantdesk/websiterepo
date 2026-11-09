# NQ Bounce Levels blank after the options session closes

## Reproduction and cause

Read-only probes on9November2026 returned the actual6NovemberQQQ compact GEX Map: last-session exposure at21:15UTC (16:15NewYork),6 exposure frames,198 latest strike rows, and two underlying candles ending21:00UTC (16:00NewYork). The owned NQ minute archive returned540 candles between13:00and22:00UTC. Both inputs existed. The former strict same-minute pairing produced zero mapped frames and a null live snapshot because all compact exposure frames missed those two underlying minute timestamps. This reproduced the blank NQ indicator without accessing the owner's browser.

## Repair

Preserve strict same-minute opens during the trading session. For exposure within the16:00–16:15NewYork closing window only, permit the last simultaneous recorded underlying/futures open from16:00 (or15:59 when the16:00 minute is absent). Both price observations must share the same minute; no current futures close, previous-session quote, missing intraday carry or future minute substitutes. Mapping timestamps and age report the actual calibration minute. Replay still clips the exposure clock. User settings, selected source, colours and extension preferences are preserved.

## Evidence and checks

The exact captured compact payload and owned NQ minute prices now produce5 mapped closing slices,181 levels and a valid snapshot. Calibration usesQQQ655.98 with the simultaneously recordedNQ27074.75, not the unrelated latest futures price. Full-session GEX Map request also returned200 with406 frames and391 underlying candles. An isolated headless Chrome fixture with the actual payloads rendered levels on the real NQ Chart; no page errors. Screenshot: closing-levels.png. No owner tabs, accounts, orders or workspaces were changed.

51 targeted tests pass across projection, futures mapping, replay clock safety, zoom and extension. Added closing-window checks forQQQ/NQ/MNQ,NDX/NQ,SPY/ES,SPX/MES andIWM/RTY, missing pairs, prior/future dates and replay lookahead. Updated an existing history-route test stub to supply the real supportsChartInterval function already required by the route; no history-route production code changed. Scoped ESLint passes. Production build/deployment receipt is saved separately after verification.

No VPS gateway, terminal or provider subscription restart; frontend-only repair and existing main-only Git deployment. Owned recordings remain authoritative.
