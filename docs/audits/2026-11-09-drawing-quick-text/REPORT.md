# Drawing quick text — 9 November 2026

Clicking a selected drawing now exposes a small, themed Add text field above it. Enter or clicking away saves one text change through the existing drawing update/history/persistence callback. Escape cancels the draft. It never takes keyboard focus automatically. Locked drawings have no editor. Double-click settings and drag handles remain available.

The editor is an HTML sibling of the SVG, so its type size does not stretch with chart zoom. Its position follows the selected drawing through the existing viewport subscription and remains inside the price pane, clear of the price scale and bottom studies. Pointer/wheel/typing events stay inside the editor. An outside pointer capture blurs/saves before chart deselection can unmount it.

Existing line labels retain their line-angle geometry. Shapes and other geometric drawings now use the same saved text field for a small anchor caption; their full settings expose Text too. Existing text annotations and entry/exit arrows retain their own text rendering without duplicate captions. Emoji glyphs retain their separate emoji editing behavior.

Validation: actual ChartDrawLayer in isolated headless Chrome, eight geometric tool families: single-click selection, edit/Enter, Escape cancellation, click-away persistence; viewport movement; locked drawing guard; zero browser errors. Existing 20 line-text geometry/normalization checks pass. Focused editor/helper ESLint passes. Isolated final Next.js webpack production build, TypeScript and static page generation pass. No market-data calls, gateway restarts, owner tab refreshes, account or order changes.

Evidence: browser-checks.log. Production receipt is saved locally after deployment verification.
