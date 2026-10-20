# GEX DATA flat theme surfaces — 2026-10-20

Owner requested removing decorative frosted/gradient backgrounds from empty
Add Tool slots and populated chart panels. Found separate gradients in original
styles.css and workspace.css on dock-body, embedded tool-stage, chart shell and
statistics surfaces. Palette remapping alone cannot remove those gradients.

Final site.css host override uses opaque --site-background shorthand on those
specific surfaces, clearing background images, backdrop blur and decoration
shadows. It updates live with the existing theme bridge. Same index applies to
child tools and popouts. Version the stylesheet URL to5. No data/render code,
saved layout, account preference or network cadence changes. Real series area
fills, heatmap cells and data-encoded conic rings remain intact.

Validation: all 11 flat-background, theme-bootstrap, toolbar and standard-loader
tests passed. Full production build/typecheck passed, 84 pages. No TS/JS source
changed, only the integration stylesheet/link and regression/documentation.
Release receipt pending.
