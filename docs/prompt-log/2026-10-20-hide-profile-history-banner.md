# Remove volume-profile history notification — 2026-10-20

Owner requested removal of the daily volume-profile history-unavailable banner
shown over the chart. Replace only the shared profile-error presentation with a
hidden diagnostic element. No alert/status announcement or visible overlay.

Daily and weekly failure state, completeness gates, calculations, rendering and
recovery requests are unchanged. Missing historical data remains unresolved;
this presentation request does not justify fabricating a profile.

Validation: all 14 notification, session-availability and candle-boundary
continuity tests passed. Production build compiled, typechecked and generated
all 84 pages. Scoped ESLint on the very large Chart.tsx exhausted its 8 GB heap;
lint is not claimed as passing. No additional memory-heavy retry.

Production receipt will be recorded after the single scoped main push.
