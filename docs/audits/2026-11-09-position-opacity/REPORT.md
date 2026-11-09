# Long/short calculator opacity

The active SVG position renderer hard-coded both fill zones to18% and ignored drawing.style.fillOpacity. Its settings slider also capped values at60%. The legacy canvas path separately capped fill opacity at60% with a14% fallback.

The active renderer now uses the saved drawing opacity for both profit and risk zones, clamped0–100%. New long/short tools and their placement previews default to100%; missing old opacity defaults to100%, while explicit saved values (including0) remain unchanged. The calculator slider supports0–100% with a visible percentage. The legacy canvas model and its settings use the same100% default and full range. Other shape defaults, colours, coordinates, levels and trade execution are unchanged.

17 focused tests pass for defaults, zero/fractional/full opacity persistence, break-even constraints and viewport geometry. Actual isolated Chrome exercised both real ChartDrawLayer and ChartDrawSettings: default1, Home0, End1, mouse drag0.22; both rendered zones matched each value and0.22 survived reload. No page errors. Screenshots longPosition.png and shortPosition.png are local evidence. No owner browser or provider services were accessed. Full production build, scoped lint and release status are recorded separately after completion.
