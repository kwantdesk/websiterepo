# Footprint coarse-row transition

The owner's screenshots show a temporarily coarse, consolidated footprint followed by the intended detailed rows. No preset, colour, font or saved grouping preference was changed.

## Cause and repair

Automatic grouping read priceToCoordinate during React render. That projection can precede native autoscale/fit. Its memo invalidated on candle/coverage changes, but not on all actual price-scale changes; the viewport coverage optimisation intentionally suppresses React work while the visible bars remain prefetched. Thus an obsolete coarse grouping could remain until a later tape or coverage update.

Grouping now observes the real Footprint primitive paint, after Lightweight Charts establishes its projection. It schedules a row rebuild only when the resolved integer group changes. It does not publish per-frame viewport state or add feed requests. Before the first valid painted projection it uses the existing manual fallback, rather than interpreting a stale projection. Manual grouping and the original automatic factor/font/open-close formulas remain intact. Separate non-Footprint consumers retain their prior calculation. Retained row keys now include both main/profile granularities so stale grouped rows cannot be reused across a grouping change.

## Evidence

- Baseline from abc0b056bfa5240a520bf5a58d2207b3bb3bf51f, actual Chart and Lightweight Charts: native price-axis-only changes did not invalidate grouping. See baseline.log and baseline-stuck.png.
- Repaired actual Chart fixture: cold mount, native price-only broad/fine range changes without tape or React props, manual four-tick grouping across zoom, return to automatic, and chart resizing. Exact volume remains 82 in every grouping; fine mode restores 41 price rows. Zero browser errors. See browser.json and footprint.png.
- 48 focused Footprint checks pass (46 existing plus two grouping checks).
- Scoped grouping/primitive lint and full isolated Next webpack build, TypeScript and static generation pass.

## Limits and safety

These tests reproduce the stale projection bug in an isolated renderer; they do not prove that every possible production history-loading or provider fault is eliminated. Genuine automatic grouping can still consolidate rows when intentionally zoomed far out. Manual settings remain authoritative. No live gateway/provider restart, owner tab refresh, account, order or workspace mutation.
