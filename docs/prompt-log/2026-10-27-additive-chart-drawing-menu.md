# Restore additive chart drawing context actions

Owner reported the drawing clipboard menu replaced the full chart right-click menu. Root cause: the shared drawing hook stopped immediate propagation during capture and opened its standalone two-action portal whenever a drawing was hit or clipboard had content.

Normal Chart now explicitly owns the full context menu. Drawing layers attach hit-specific clipboard callbacks to the original MouseEvent and allow its existing handler to run. Chart adds these callbacks to the original menu; all existing reset, alert, indicator, fills, trade and settings entries remain untouched. Other chart surfaces without the normal menu retain the standalone drawing menu. Ctrl/Cmd shortcuts, cross-layer hit priority and right-drag ruler remain intact.

Validation: actual hook event harness proves the original menu listener receives the same event, no standalone portal opens, and contributed Copy/Paste callbacks work. Existing clipboard, drawing system and quick-measure regressions, scoped ESLint and production build checked before release. No owner drawings pasted, deleted, or orders placed for verification.

Results: 30 targeted tests passed; production build including TypeScript passed; clipboard-hook ESLint passed. Full Chart.tsx ESLint exhausted Node heap (including an 8 GB retry), so no full-file lint pass is claimed.
