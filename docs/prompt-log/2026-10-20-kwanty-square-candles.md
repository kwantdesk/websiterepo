# State square candle bodies — 2026-10-20

Request: State candles should be squared off; leave profile circles unchanged.

Cause: State candle bodies reused roundedBar, designed for horizontal exposure
profiles. State now uses fillRect at the same exact OHLC geometry. Wicks, live
theme colours, zoom-dependent width, minimum one-pixel dojis and visibility
controls remain intact. Classic, prior markers, IV skew circles and rounded
profile bars are not changed.

Validation: 224 KWANTY/reference tests pass; scoped eslint passes. New recording
canvas tests assert square bodies, exact open/close and wick geometry, dojis,
and identical profile-circle/profile-bar calls before and after switching price
display type. Actual renderer inspected in isolated synthetic dark/light browser
fixture; proof under tmp/kwanty-state-square-candles/proof. Not live-data proof.

Versioned app/renderer/host URLs invalidate old cached renderer. No new API,
poller, login, gateway restart or preview deployment. Existing missing archive
history and provider/gateway reliability issues are separate and remain open.
