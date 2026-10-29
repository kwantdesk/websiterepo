# Liquidity map: explicit source clears, delivery cursor and price scale

Owner reports that the exact display rollback still leaves misplaced/delayed bubbles, jumpy price and unusable zoom. This task keeps the restored presentation and fixes measured source and scale faults. It does not add standalone Replay, redesign the DOM, change palettes or alter owner trades/settings.

## Evidence and corrections

- Before activation NQ was crossed/non-full-depth in 10/10 samples; ES was valid. A later sample found the micro books invalid too. Gateway was connected/authenticated, recording and not event-loop overloaded.
- Captured Rithmic OrderBook template 156 explicitly clears a side/price with timestamped zero quantity AND zero orders. The L3 collector discarded those messages, retaining snapshot order IDs after their levels were explicitly empty. Subsequent genuine orders crossed the stale book. These clears are now applied only to older orders at that exact side/price, with per-level indexes and source clocks. Positive/ambiguous/unclocked aggregate values never replace L3 quantities or identify orders. Quotes/trades are not used to guess removals.
- Snapshot staging preserves newer interleaved orders and rejects older rows covered by an explicit clear. Its first recorded receipt is an image clock upper bound, not an exchange timestamp. Replay reconstruction receives the recorded receipt, not build wall clock. Late real executions retain their real times but cannot move the live last price backwards; frame clocks and each quote side are monotonic.
- The server advanced the browser's execution cursor and emptied pending order events even for invalid depth frames the browser discards. It now retains that cursor/events until usable depth returns, with a bounded 2,500-execution catch-up versus the normal 256 cap. This prevents that identified loss path; it is not a guarantee of arbitrary-outage tape completeness.
- The restored controller allowed 24 rows while the renderer silently required 45. Both now use one instrument/tick-aware range (minimum 8 rows); price-rail wheel input respects magnitude/mode, has reciprocal zoom and ignores horizontal-only input. Price zoom preserves time density.
- Restored catalog ingestion normalized micros into parents, letting a later MES row overwrite ES. Only genuine matching parent contracts now configure the parent map. NQ was not overwritten in the measured current catalog ordering; do not attribute its crossed book to that catalog fault.

## Verification

- Same bounded captured-wire reconstruction: old module 272 clean / 1,969 crossed samples; corrected final module 2,231 clean / 10 crossed samples, over 25,001,984 uncompressed bytes / 20 committed baselines. This establishes the correction and also shows residual transient crossings; never claim perfect source parity or invent missing orders.
- 541 gateway tests pass, including actual publisher cursor behavior and source-clear ordering/reset/late-data cases.
- 35 focused frontend feed/zoom/motion/performance/bubble-anchor tests pass. Scoped ESLint and the complete 1,536 MiB production build/TypeScript pass.
- First post-reconnect live check: NQ/ES/MNQ/MES each valid 3/3; subsequent each valid 40/40, real prices changing. Maximum observed ages respectively 384/438/470/540 ms. Recording on; event-loop maximum 14 ms, not overloaded; one startup recovery request.
- Actual live NQ SSE: 67/67 frames valid across 14,535 ms, 65 executions delivered and 16 distinct last prices. Separate current quote snapshot HTTP 200. This validates delivery, not an exhaustive visual or vendor parity audit.
- Sustained follow-up: NQ, ES, MNQ and MES each valid 120/120 (480/480 total), with 56/12/60/13 distinct actual last prices. Largest observed source age 847 ms; maximum event-loop lag 21 ms, no overload, recording on. Recovery count remained one startup request. Snapshot tape lengths are capped, so a constant retained count does not mean executions stopped.
- A diagnostic quotes request after the first 40-sample check hung until the diagnostic SSH timeout; the completed measurements were captured in its stdout. The sustained follow-up omits that unrelated endpoint and is recorded separately. Do not misreport the entire initial probe as a successful process.

## VPS activation and recovery

Reviewed exact preimages and preserved current runtime overrides. Backups, candidates and SHA-256 manifest: `/opt/kwantdesk/staging/depth-clear-20261029/`. Book-store preimage `077897cdaf91b79e1c52651b5c25f031d146e4aa2fa751a1feb5d1c9bd1ab47c`; replacement `16707deecd73370bea8bb6c4204720ce6fe02a2f8d4a12e8829c16465c6ba1e9`.

Changed existing book and replay override files. Added one persistent server bind mount to Compose; that server candidate replaces ONLY the exact reviewed `captureHeatmapFrame` function in the actual deployed server, preserving its other runtime code. Gateway image remains `kwantdesk-gateway:3c712357`. Recreated only `gateway`, using `--no-deps --no-build`; no VPS/Caddy/history/relay/browser-stream restart and no recording/account/settings removal. Compose preimage and all old modules are backed up and hash guarded. Raw archives remain intact; existing derived history packs are not retroactively regenerated by this task.

Frontend assets and iframe have cache revision `20261029-depth-clear-scale`. Release only through the existing main-only `websiterepo-yfmi` Git integration. No new paid services or Vercel market-data polling/streams.

Local evidence: `tmp/depth-lifecycle-reference.log`, `tmp/depth-lifecycle-candidate-final.log`, `tmp/depth-clear-live-first.log`, `tmp/depth-clear-stream.log`, `tmp/depth-clear-live-soak-final.log`, `tmp/depth-clear-runtime-plan.log`, `tmp/depth-clear-runtime-activation.log`, `tmp/depth-explicit-clear-gateway-suite.log`, `tmp/liq-depth-clear-frontend-tests.log`, `tmp/depth-clear-lint.log`, `tmp/liq-depth-clear-scale-build.log`. Temp probe scripts are not production code or committed artifacts.
