# Save as New Theme

## Request and result

Add Save as New Theme below Settings / Theme & Colors / Chart Colors. A named
theme snapshots the current website palette and independent candle body,
border, wick, chart background, grid colour and grid visibility settings.
My Themes appears after all built-in presets, in save order. Selecting one
uses the existing appearance commit path, preserving timezone, precision and
other non-colour chart preferences. Duplicate custom names cannot overwrite.

## Persistence and safety

The versioned custom library uses protected browser storage and the existing
account preference sync; no new endpoint, market request or polling loop.
Read failure/corrupt libraries cannot be overwritten by a save. Storage refusal
does not report success. Same-account edits made during cloud hydration are
preserved; another account's local library is not imported. Mount only reads.

## Verification

- Six focused custom-theme tests pass: append/reload/exact colours, applying
  without unrelated preference changes, naming validation, corruption/quota
  protection, tracked storage/UI placement and hydration/account isolation.
- Existing preference hydration regression script passes.
- Existing theme account-sync suite: six tests pass.
- Scoped ESLint passes; full production build and TypeScript pass (84 pages).
- No authenticated interactive browser save was performed against owner data.

## Remaining platform gates (not fixed by theme work)

Supported permanent VPS/transport; intermittent chart startup/delivery latency;
month-long futures/options history and continuous recording/backfill;
missing Asia execution tape; full profile/footprint/CVD soak; GEX DATA/KWANTY
numeric, cadence and interaction parity; exact volume adapters beyond ES/NQ;
100+ user acquisition/capacity/cost validation. Existing Vercel spending cap
remains owner-managed. No gateway restart, provider purchase or feed change.
