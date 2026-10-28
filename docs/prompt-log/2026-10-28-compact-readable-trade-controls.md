# Compact, readable on-chart trade controls — 2026-10-28

Request: reduce on-chart order/entry/SL/TP controls to75% of their current size and make SL/TP captions the same readable colour, especially mono themes where TP was white on white.

Change: normal Chart label scale1.5→1.125 (height24→18px, text12→9px, proportional handles/padding/icons/min/max width). Matched Liquidity Map's shared geometry. No transform-only scaling: actual DOM geometry and drag targets shrink together, without moving the price lines.

Cause of contrast fault: add-SL/add-TP buttons used down/up colours corrected for the CHART background while the pill was filled with the inverse colour. A white up colour could therefore land on a white pill. Both captions now use readableTextOn(pillFill), shared with entry/protection/preview text. Directional borders/lines remain theme-linked. Liquidity Map uses the same contrasting fill/text policy. No order execution, protection prices, drag handlers or account state changed.

Verification:7 focused existing chart-label contrast checks pass, including actual source wiring for both captions and21:1 text contrast against label fill across light/dark backgrounds.5 Liquidity Map protection/geometry checks pass, including parity against actual Chart dimension expressions across widths/handle counts. Existing broad contrast script has an unrelated stale side-panel legibleOn source assertion after its7 chart checks; added --chart-labels-only to run the requested scope independently. Broad old order-label geometry script reaches four passes then fails an existing viewport source assertion; no viewport code changed. Its scale expectation updated and drawing-layer class regex allows existing extra class tokens. Build/lint/release pending below.

Full1536MiB-capped BelowNormal build and TypeScript passed. Focused component/library ESLint0errors/133existing warnings with optional React Compiler analysis rules disabled for this invocation (normal hooks/exhaustive-deps/Next rules retained; repository config unchanged).7chart-label checks and5map protection/geometry tests passed. Production release pending.
