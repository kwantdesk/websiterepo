# Position drawing disappearance — 2026-10-28

Request: a placed short-position P&L calculator disappeared without an intentional deletion.

Confirmed loss paths in the mounted charting-tool subsystem:

- Same-owner charts can mount from cache while initial cloud hydration is pending. That late snapshot protected themes/GEX workspace edits but not chart drawings placed during the request.
- Ongoing account preference merging treated the entire pane/drawing document as one scalar. Independent edits on different panes or drawings from a second device could overwrite one another.
- Initial mount set a hydration ref synchronously, then its save effect could persist the initial empty React document before the restored drawing state committed.
- Window drag listeners retained callbacks that mapped the drawing array from an older render. A later drag update could discard drawings placed after that render.

Changes: three-way merge the drawing preference by pane and drawing ID, preserve new same-owner drawings during initial account hydration, gate the first storage save on committed hydration state, and make live-layer commit/update/delete callbacks use the current drawing ref (updated immediately on commit). Explicit deletions remain deletions, invalid remote documents do not clear valid local drawings, and account ownership remains isolated. No owner chart/trade/preferences were edited for verification. No fabricated reconstruction of the missing drawing, and no claim that its original anchors have been recovered.

Validation: seven new executable regressions cover concurrent same-pane and cross-pane edits, explicit deletion, malformed remote data, actual startup effect ordering, actual retained layer callbacks, and deferred real hydrateUserPreferences with another-owner isolation. Existing account trading/sync and theme hydration checks included. Older theme test doubles were missing the already-shipped abortSignal query method; added that method to the doubles, with no production timeout changes.35 tests pass. Full build/lint/release results pending below. Gateway restart remains deferred per owner instruction.

Verification complete:35tests pass; full1536MiB-capped BelowNormal production build and TypeScript pass. Default ESLint of the huge Chart/Workspace functions exhausted its4GiB heap in optional React Compiler analysis. Library lint passes with default rules; components pass ordinary React/Next rules plus rules-of-hooks/exhaustive-deps (0errors,152existing warnings) with optional Compiler rules disabled for this invocation only. Repository lint configuration was not modified. Release pending.
