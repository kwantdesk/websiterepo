# Kwanty standard chart workspace

Requested: centered Classic/State/Order Flow navigation, Charts-style left controls/instrument selector, right Classic price axis, native drawing tools/indicators, movable multi-instrument panels, preserved right settings.

Implemented all-mode independent panel state and source ownership, persistent stack/side-by-side/grid layouts, drag reorder (Alt+Left/Right fallback), resizable columns, unrestricted add/close, top-left synchronized instrument selector, centered modes, shared drawing bridge and indicator library. Classic now uses separate Classic package sources, not the State endpoint. Shared master replay waits on all Classic panels and selects each panel at the exact cutoff. Existing right settings remain.

Indicators: 34 supported OHLC/volume studies reuse the normal calculator and native indicator panes/settings. Classified execution/book, specialized native primitive and options-study adapters are not implemented here: these remain explicitly unavailable, not substituted with exposure values. Volume studies require actual reported volume. This is not full indicator parity.

Validation: 425 Kwanty/replay tests passed before the final iframe-pointer assertion; strict browser-module parsing, independent Classic sources, exact replay selection, source rejection, reorder retention and identical normal-indicator calculations covered. Local synthetic browser fixture showed independent SPX/QQQ panels across all three modes, independent 5m State panel, native left drawing rails, right price axes and per-panel MA/RSI. Fixture is explicitly synthetic, not live-data acceptance. Signed-in production browser was unavailable; public release checks do not prove authenticated UI/data parity.

Final validation: 426 Kwanty/replay tests passed, including indicator per-ticker persistence, visibility and pane height. Final production build, TypeScript and scoped ESLint passed; indicator favorites, 18 indicator-template checks and 8 layout-pane checks passed. Native browser actions created a Classic trend line, reordered panels, resized columns and resized the RSI pane from 88px to 147px. The legacy candle-visibility script fails stale source-string assertions (CRLF and an old replaceCandles expression); it was left unchanged and is not counted as passing.

Safety: no provider changes, new polling loops, VPS restarts or Vercel previews. Use one main-only production release after local build/type/lint gates. Preserve unrelated dirty files and canonical notes.
