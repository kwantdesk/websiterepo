# DeepCharts Annotations Overlay audit — 2026-09-07

## Evidence

- Official contract: https://www.deepcharts.com/helpcenter/article/annotations-overlay
- The indicator imports annotations produced by an indicator on another chart.
  Its public inputs are Chart ID and Indicator ID; the source example mirrors
  a 30-minute Bar POC onto a 5-minute chart.

## Quant Desk implementation

- Every open chart publishes its calculated overlay annotations to a bounded
  in-memory workspace registry keyed by the existing chart instance ID and
  source indicator instance/catalogue ID.
- The target subscribes to registry revisions and mirrors the selected source
  without recomputing it or opening another provider connection.
- Imported raw timestamps are aligned on the target chart, including event-
  based volume/range charts. Imported entries receive target-owned keys, so
  deleting the overlay never mutates the source.
- The settings show the current Chart ID, accept source Chart/Indicator IDs,
  support source or target-theme colours, and persist through the shared
  settings/template system.
- Self-reference and unavailable/closed source charts fail closed. Unmounting
  a source removes its registry entry.

## Verification and limits

- Focused tests cover registry publication/read/removal notifications,
  instance/catalogue lookup, persistence, controls and release gates.
- This release mirrors annotations represented by calculated overlay series
  and attached series primitives. Standalone DOM/book panels and manual chart
  drawings are intentionally not treated as indicator annotations.
- Cross-window/browser-process mirroring is not claimed; the public contract
  is implemented for open charts in the same Quant Desk workspace runtime.
