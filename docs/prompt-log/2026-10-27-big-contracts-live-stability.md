# Big Contracts live/sample stability — 2026-10-27

Owner: minimum 50 contracts periodically floods with markers that then disappear.

Confirmed defects: immediate admission accepted flow-only summaries and unknown-aggressor records, although sampled calculation rejects them. Two regressions failed before changes (invalid records admitted and identities differed). Immediate IDs had an extra live prefix, and marker coordinates used execution seconds instead of the selected candle bucket. The live path also bypassed the sampled per-bar display limit.

Fix: immediate admission now requires the same classified execution evidence, uses canonical event IDs, anchors through the shared candle anchoring function, and enforces the same max-per-bar rule with identity deduplication. Existing manual 50 threshold, user clustering, automatic/session filter settings and valid execution history are preserved. No fabricated markers, provider polling, VPS restart, or owner trades.

Validation: 16 focused tests passed (including execution of the actual Chart live event handler, testing a 50-lot execution mixed with rejected summary/unclassified records); 6 additional Big Trades history calculations passed. One pre-existing source-regex history test expects an obsolete workspace flow-key implementation in unchanged KwantifyWorkspace.tsx; recorded and excluded from the additional run. bigTrades.ts ESLint passed. Final production build recorded in tmp/big-contracts-stability-build-final.log. Full Chart lint not rerun: previous task established it exhausts 8 GB Node heap; TypeScript/production build is the component check.

Limits: explicitly selected max-per-bar and automatic adaptive thresholds still determine visible markers; enabled clustering can combine executions. This fix prevents inconsistent live-only evidence, IDs, coordinates and per-bar limits; it does not promise an immutable adaptive threshold or invent missing tape.
