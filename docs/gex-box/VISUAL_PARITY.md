# GEX BOX — Visual Parity

Reference dossier: `C:\Users\Karen\Documents\KWANT\gexbot-reconstruction\GEXBOT_REBUILD_GUIDE.html`

Reference captures reviewed:

- `gexbot-classic-90d-agg.png`
- `gexbot-classic-latest.png`
- `gexbot-state-90d.png`
- `gexbot-orderflow-panel0.png`
- `gexbot-oflow-netgex.png`

## Implemented visual structure

- CLASSIC uses a professional exposure-by-strike profile with spot, zero gamma, major positive/negative levels, prior trails, tooltips and lookback playback.
- STATE retains the same dense chart language while switching among GEX, Gamma, Delta, Vanna and Charm.
- ORDER FLOW uses one synchronized ECharts surface with up to three stacked panels and the exact eight canonical metrics.
- RESEARCH is a chart-request workstation, not a generic card dashboard; it validates a deterministic command before requesting data.
- All surfaces inherit KwantDesk theme tokens, typography, borders and panel chrome rather than copying vendor branding.
- Empty, delayed, frozen and unavailable states are explicit and do not display fabricated charts.

## Responsive behavior

Primary controls scroll horizontally when narrow, chart canvases resize through ECharts, the diagnostics/settings rail is optional, and URL state preserves surface/ticker/metric context for deep links.

## Remaining live visual confirmation

The local authenticated runtime could not be entered without a user session, and the provider feed was unavailable in development. Final production visual confirmation therefore requires an authenticated browser during a valid provider session; this is not misreported as completed evidence.
