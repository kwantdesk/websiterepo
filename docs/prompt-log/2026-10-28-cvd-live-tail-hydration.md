# CVD live tail and hydration

Owner reported CVD frozen/not updating. Read-only VPS NQ heatmap probe returned classified buy/sell executions with provider timestamps near the request; this establishes source availability, not browser delivery or that the owner's pane was observed working. Gateway was not restarted, and the previously deferred gateway performance activation remains deferred.

Found two executable frontend faults after the recent boundary-only React candle commits: tape/history hydration wrote the old candle prop array over newer directly sampled flow, and the 750ms live study sampler retained only one candle, dropping the final closing-bar flow when the next candle arrived first. This could repeatedly rewind the study while price advanced.

Keep a bounded four-bucket cumulative study tail. Reconcile it into both immediate hydration and delayed samples, including matching closing buckets; never fabricate missing historical buckets. Preserve replay's causal history and clear the tail on live subscription scope changes. Also include delta high/low in the unchanged-sample comparison so a changed excursion with unchanged final totals can paint. Price chart history and execution classification are unchanged.

Validation: 38 targeted CVD/continuity/actual Chart effect tests pass. The new actual hydration test fails against HEAD's former Chart effect (old deltas 5,1 instead of live 25,-4); the actual rollover sampler test also fails against the former effect. Replay isolation, exact matching bucket merges, source immutability, changing delta excursions and prepared-frame price behavior pass. Full production build/TypeScript and scoped ESLint results recorded below when complete. Optional React Compiler lint analysis disabled per invocation due the previously established resource limit; ordinary hooks/lint remain enabled.

No owner account/settings/trades modified. No transport latency guarantee or claim that every possible CVD fault is eliminated. This fixes reproduced sampling races; live owner-pane end-to-end observation was not performed.

Release checks: production build and TypeScript completed successfully (1536MiB heap, BelowNormal priority). Scoped ESLint: 0 errors, 133 pre-existing Chart warnings. Five additional execution rollover/recovery tests pass, for 43 targeted tests total.
