# Liquidity execution anchors and theme action contrast — 2026-10-30

## Requests and scope

The owner reported floating Liquidity Map bubbles and unreadable white-on-white controls, especially Mono on GEX Data. Preserve the restored map appearance, actual executions, L3 depth, saved settings and trades. The separately deployed routing/authentication deadline fix is commit `c13044b12c83e7e877399ac6ba9a2a5ee782ac5b`.

## Observed causes and changes

1. The current-book HTTP probe and SSE history seed race. The engine previously appended both in arrival order, permitting a newer frame followed by older frames. It now inserts genuine backfill chronologically, preserves equal-time arrival order, bounds retention, and rejects backfill older than a full retained window. A structural revision invalidates incremental bubble caches and index-based indicator analysis.
2. A presentation-only update previously rewrote the last book frame's timestamp. Its source timestamp now remains immutable; the later presentation time is separate.
3. Bubble X coordinates previously used the depth packet's index. Delayed prints now project their immutable execution timestamp between source book frames. Their first execution price remains the Y anchor. Rolled-off owners and executions preceding loaded history are not attached to unrelated columns. Zoom/pan do not change cluster membership or traded volume.
4. The heatmap payload used the first retained L3 row for its bid/ask trails even when valid provider inside quotes were available. Three same-timestamp NQ comparisons demonstrated disagreement: one had actual BBO `28909.25 / 28910.00` versus heatmap `28908.75 / 28910.25`; another had BBO bid `28910.00` versus heatmap bid `28908.00`. Valid snapshot quotes now drive inside trails and microprice quantities; absent/invalid/crossed quotes retain the explicit depth fallback. Actual L3 levels, orders and execution prices are unchanged. The payload records `insideMarketSource`. Existing zero-quantity microprice midpoint behavior remains covered.
5. GEX Data mapped filled actions to theme primary (white in Mono) while leaving text white. Bootstrap and live theme application now synchronously expose readable on-primary/on-danger ink. Filled workspace/dialog/replay actions and switches use those role pairs; transparent picker rows retain page foreground. Picker category labels no longer inherit an unreadable accent.
6. The source-wide React action audit found and corrected 13 fixed-white danger labels across Charts, workspace management, Journal, Socials and archived Zyon, plus Replay's primary Go action. Existing shared `text-on-primary`/`text-on-danger` roles are reused. The empty glowing avatar status dot is intentionally excluded because it has no label.

## Verification

- 39 chart/feed/presentation checks plus 4 quote-specific checks pass, including the actual extracted canvas bubble renderer through zoom, pan and delayed history insertion. The complete gateway suite passes **545 tests**.
- 13 filled-action/theme checks pass, including all 43 preset palettes, synchronous parent-theme precedence and a source-wide TSX action-literal scan.
- Headless Chrome loaded the real GEX CSS and live theme module against a local fixture: **473 computed contrast checks across 43 presets, zero failures**. This is local control verification, not a signed-in visual audit of every route.
- Five relevant initial-theme/embedded-bootstrap checks pass. The broader refresh suite retains one pre-existing Liquidity Map startup assertion failure: its first-inline-script fixture expects a synchronous background that the previous appearance rollback removed. The tested inline source is byte-identical to HEAD; the restored appearance was deliberately not changed to satisfy that unrelated assertion.
- Scoped ESLint, TypeScript and the full 1536-MiB production build pass. The giant existing Chart/workspace components receive class-only edits; they were checked by the semantic action scan, TypeScript and production build rather than rerunning their previously memory-exhausting React compiler lint.
- After activation, all 12 sampled NQ/ES/MNQ/MES books were full-depth and valid. Three same-source-timestamp NQ quote/heatmap comparisons matched exactly.
- A 15-second live NQ SSE check delivered **69/69 valid frames, 322 executions, 14 distinct last prices**, with 14,960 ms of advancing source time. This verifies sampled delivery, not a promise of zero transient source faults or millisecond exchange updates.

## VPS activation and preservation

Only the existing gateway server override's heatmap payload block was replaced, plus its pure quote-selection helper. Its old payload block was verified equal to repository HEAD; all other deployed bytes, including previous runtime fixes, were preserved.

- Target: `/opt/kwantdesk/runtime-overrides/server.depth-clear-20261029.mjs`
- Before SHA-256: `c27904564a52eaa5444187b0d57a29cafb48bed26190502087eab793144a71e7`
- After SHA-256: `f4e775c85a5b9a5550bd9f03b93510283150cb7d52e888182bf7bd4d33f61669`
- Backups, manifest and before/after service identities: `/opt/kwantdesk/staging/bubble-source-time-20261030/`
- Syntax checked in the deployed Node runtime before replacement; guarded source checksum and existing bind mount verified.
- Recreated only `gateway` with Compose `--no-deps --no-build --force-recreate`. All other service container identities remained unchanged; all 14 gateway mounts were retained.
- Post-activation connection/authentication healthy, last error null, recording enabled, event loop not overloaded. No second provider session, credentials exposure, account/settings edits, recording deletion or infrastructure purchase.

Old archives retain the quote/price facts originally recorded; this change does not fabricate better historical BBO or regenerate archives. Broader vendor parity and any missing provider history remain separate work. Frontend asset revisions ensure a reopened map loads the corrected modules; already-open documents need a reload to replace their in-memory code.
