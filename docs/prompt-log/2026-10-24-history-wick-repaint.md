# Printed candle/wick integrity follow-up

Owner reports candles and previously printed historical wicks moving/disappearing
despite the gateway restart. Investigated chart reconciliation rather than
claiming the server optimization fixed rendering.

Two reproduced failures: history can extend a live-observed bar but the buffer
previously remembered only direct ticks; a later stale history response then
shrinks the high/low. The first live packet also lacked the history seed's
existing open/high/low. The bounded source-scoped buffer now retains both.
Unobserved archived bars remain correctable; scope changes clear all seeds.

Separately, destructive chart redraw/recreation used memoized candles that can
predate direct imperative tick painting. Both paths now reconcile at setData,
then apply HA transformation if selected. Actual painted tail timestamps and
counts are retained. No synthetic prices or gap filling were added.

Regression tests reproduce the first two failures before repair, exercise both
real Chart.tsx paint expressions, and verify cached-render rollover, unobserved
history correction, scope isolation, retention bounds and source-time ordering.
No VPS restart or provider-poll change is needed for this frontend repair.

Verification:12 repaint tests and4 render-continuity tests pass, plus19 interval
authority cases,13 live path checks and2,650 Rithmic instrument/interval cases.
Production build and TypeScript pass. The Chart.tsx ESLint process exceeded the
default4GB Node heap; lint is not certified by that unsuccessful run.
