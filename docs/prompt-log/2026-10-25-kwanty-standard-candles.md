# Kwanty standard candle geometry — 2026-10-25

Request: Kwanty candles and wicks must look like normal Charts candles.

Diagnosis: Classic still routed candle bodies through rounded profile bars.
State used unaligned fractional rectangles, and profile wicks inherited a thin
grid/level stroke. Order Flow had another sizing implementation with a minimum
3px body and 24px cap, and inferred width from neighbouring timestamps, so missing
observations changed candle width. Profile bodies were separately capped at18px.

Fix: all three views use candlestick-paint.js. It follows the installed normal
Charts Lightweight Charts width/reducing-coefficient/device-pixel parity policy,
square bodies, centered pixel-aligned wicks and one-device-pixel dojis. Wicks are
separate upper/lower filled rectangles independent of line width/dashes/caps.
Widths use selected interval and visible time scale, not neighbour gaps or the
retained history length. Profile circles/rounded exposure bars remain unchanged.
No OHLC, historical cutoffs, timestamps, feeds or provider data were changed.

Verification:419 Kwanty/shared replay tests passed. New tests execute the installed
normal chart renderer directly and compare135 combinations (5DPI ratios x9spacing
values x3candle shapes), plus dojis/no invented wicks/inherited canvas line state/
zoom/gap/invalid geometry. Existing render tests exercise Classic/State/Order Flow,
theme colours, source OHLC, transforms and unchanged profile circles/bars.

Local production build/typecheck passed. Scoped lint has zero errors and one
pre-existing OptionsFlowToolPanel ref-cleanup warning.
Signed-in visual/pointer acceptance is not claimed. Broader vendor parity, actual
archive coverage and off-box backups remain separate IMPORTANT-NOTES launch gates.
No new service, stream or VPS restart. Cache revisions cover standalone and
embedded Kwanty charts. Canonical notes contain the post-release verification.
