# Position-tool semantic colour defaults — 29 October 2026

Owner requests profit green/loss red regardless of website theme, while retaining custom colour controls.

Shared defaults #089981 and #F23645 replace theme bullish/bearish fallbacks for Long Position and Short Position. Both drawing render paths and their settings use the same colours. Saved explicit overrides remain respected; drawings without overrides pick up green/red automatically. The custom-colour reset clears overrides and is labelled “Reset to green / red”. Templates still save explicit choices. No geometry, drawing persistence, order or account behaviour changed.

Validation: existing position-tool-colours7/7 and position-calculator-primitive6/6 checks pass; full production build including TypeScript passes at1536MiB; ESLint passes for ChartDrawLayer, ChartDrawSettings and chartDrawTools. Full Chart.tsx ESLint attempt exhausted4GiB and did not finish; its actual compiled/typechecked paths and existing source regression checks pass. No extra UI or feed polling, provider requests or VPS changes.

Release via existing main-only Vercel integration. Separate preceding liquidity-depth fault remains unresolved; see crossed-liquidity-book receipt.
