# Convexity Orderflow source-history repair

User: “bro convexity order flow etc looks nothing alike etf”.

Compared Gexbot QQQ Oct21/latest/1m Convexity Orderflow against Kwanty.
Prior isolated-point acceptance did not prove numerical or full-session parity.

Confirmed reference candle mode sums one-second flow velocities, whereas line
mode preserves raw observations. Our line mode incorrectly applied the saved
candle interval. Corrected it without changing candle sums to averages.

Existing native Quant history endpoint403 was not the whole entitlement story:
the official daily EOD ZIP endpoint returned200 with the existing VPS credential.
QQQ report72,076,923 bytes; selected nested gzip1,969,849 bytes; decoded JSON
14,913,093 bytes, 22,017 observations across390 minute buckets. Minute convexity
extrema -211.33/+422.09 agree with the reference visible scale. Exact original
observations preserved; first source time09:31:20ET, last16:00ET, not fabricated
09:30 coverage. Original ZIP stored on included VPS disk.

Added private authenticated request-driven EOD cache/extractor, full-session
restoration, bounded compressed browser transport and session retention rather
than silently discarding the first~20,000 observations. Reuse chart model on
hover/viewport paints to avoid repeated full-history aggregation.

VPS rollout only recreated gexbot-relay. Rithmic gateway original start time
2026-10-21T00:35:56.355932235Z unchanged. No purchases, new accounts or secrets
sent to the browser. Download holds and disk guards prevent runaway fetching.

Remaining: live30second snapshot polling still misses one-second velocity
spikes; full live delivery is not claimed fixed. Daily EOD route only returns
newest eligible report, so older sessions require previously persisted ZIPs.
Classic/State EOD integration and other page-wide parity remain separate gates.
