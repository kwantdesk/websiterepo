# Closed candles changing open / close after printing

Owner reports candles form/close correctly, then later change their body.

Four regression cases failed before repair: seeded initial bar open99 changed
to94 after rollover/history refresh; old closed close105 became91 on a wrongly
receipt-stamped packet; out-of-order archive prints chose open102 instead of99;
microsecond-ordered print history lost first/last ordering across restore.

Repairs:

- ObservedCandleHistory retains the initial seeded open after a genuine rollover.
  An unseeded partial first bar still accepts its first genuine archive open;
  unobserved older history remains correctable. Wrong post-rollover receipt
  clocks cannot rewrite a closed close or poison its source watermark. Real
  later exchange prints inside the old bucket remain accepted.
- FuturesBarArchive chooses open/close by source microsecond order, not receipt
  order. True extrema and traded volume still accumulate. Two optional source
  clocks persist after the existing six JSON tuple fields; old six-field rows
  remain readable. Legacy restore uses explicit conservative ordering bounds,
  not fabricated trades: saved open/close cannot be rewound by pre-restore
  prints, while fresh prints still advance the forming bar.

Verification:69 focused tests pass (renderer integrity, continuity, futures
archive and tape), plus19 clock intervals in live-candle-authority. Scoped lint
and production build/typecheck pass. No owner chart, trade or protection edited.
Prior incorrect archive bodies are not automatically reconstructed by this fix;
that requires a separate bounded source replay/reconciliation, not guessed OHLC.

## Activation gate

Read-only SSH confirms the running gateway source is the old exact HEAD file:
SHA2565ee5eed775cc40deb4075744e7c03477dcbd1cd0b51e1900882d12f91d2d5074.
Running container kwantdesk-production-gateway-1 has its recordings bind plus
quantdata-request-budget, vendor-data-edge and book-store runtime mounts. Keep
all of them, the image, provider credentials and compose settings unchanged.

The browser change can ship through normal main-only Vercel release. The archive
module is NOT active merely because its source is committed. It requires an
additional read-only runtime module mount and a brief gateway-only recreation,
with graceful flush, exact source-hash checks, rollback copy and post-start
feed/recording verification. Owner restart approval is required while trading;
none has been assumed for this task. No source archive was erased/rebuilt,
no feed was restarted and no extra provider login was opened during preparation.
