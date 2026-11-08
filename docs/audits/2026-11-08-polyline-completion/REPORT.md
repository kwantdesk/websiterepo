# Polyline completion and tool-switch lifecycle

Root cause: ChartDrawLayer committed clicked vertices on tool changes only for the hard-coded Arrow Path ID. Polyline uses the same variable-length `poly` point mode but had no corresponding commit. Its preview also required a live hover cursor, so moving to the toolbar hid it.

The shared layer now uses the drawing specification: when switching tools, every `poly` drawing with at least two clicked vertices is committed with its original tool ID, style and exact anchors. Hover coordinates are excluded. Clicked previews no longer depend on the pointer remaining in the plot. Double-click duplicate-vertex suppression applies to all poly tools. An incomplete old fixed-point tool is cleared when switching, preventing stale anchors from being used by the next tool. Single stray anchors remain discarded rather than creating empty drawings. Completed fixed-point and freehand drawings retain their existing finish/persistence path.

The current catalogue has two variable-length tools (Arrow Path/Polyline), two freehand tools (Pencil/Highlighter); fixed-point tools auto-finish after their required anchor count. The change uses the shared specifications rather than adding another per-tool exception.

## Verification

- `node scripts/audits/polyline-completion-browser.cjs`: seven isolated headless Chrome scenarios pass with the real ChartDrawLayer: both poly tools retain exact vertices outside the plot and after Cursor, double-click finishes once with three anchors, stray single anchors are discarded; completed trend line/rectangle/pencil/highlighter remain; an incomplete trend line does not corrupt a new rectangle. Zero browser errors.
- `PATH_BASELINE=1` against the pre-fix committed layer reproduces Polyline disappearing on pointer departure (no rendered polyline), while Arrow Path passes.
- `node --import ./scripts/alias-hook.mjs --test tests/chart-drawing-system.test.mjs tests/drawing-edit-history.test.mjs tests/chart-drawing-clipboard.test.mjs`: 31 pass. Direct Node invocation initially could not resolve extensionless TS dependencies; the repository resolver fixes the harness invocation.
- Full isolated production webpack build including TypeScript/page generation passed. Scoped whitespace checks pass.

No provider/gateway/terminal restart; no account/trade/workspace clearing. Existing saved drawings are untouched.
