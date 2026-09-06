# DeepCharts Shift Candle audit — 2026-09-07

## Evidence

- Public contract: https://www.deepcharts.com/helpcenter/article/shift-candle
- Published Trinity controls: maximum bars after reversal, minimum tick
  breakout, minimum delta percentage/value differences, maximum tick POC
  distance and highest/lowest reversal lookback.
- Published presentation controls: marker tick offset and price, optional
  imbalance percentage/volume-difference gate, fresh buy/sell zones, marker
  colours/shape/width/auto-center, alert and popup text.
- Read-only metadata probes (`--types Trinity` and `--types Shift`) loaded
  2,777 types / 30,928 methods but found no readable matching symbols. The
  installed DLL is protected; that does not reveal the proprietary trigger.

## Quant Desk implementation

- Uses a documented, no-lookahead Trinity interpretation: a local structural
  extreme must confirm within the requested bar window by the configured tick
  breakout, delta divergence, footprint POC proximity and optional exact row
  imbalance.
- Delta, POC and imbalance are calculated from execution-derived one-tick
  footprint bars. Missing price-level flow returns `waiting-for-executions`;
  candle colour/total volume is never substituted.
- Confirmed square/circle/diamond markers are drawn by a chart primitive.
  Fresh zones extend until the first later trade-through. Both markers and
  zones follow the active theme unless the user chooses custom colours.
- Event charts remap marker and zone times to their synthetic bar timeline,
  keeping 500-volume/range charts aligned. Settings and templates persist via
  the shared indicator framework.
- Alert events and browser popups emit only for a newly confirmed live bar;
  initial history, replay and closed markets are silent.

## Verification and limits

- Focused tests cover no-lookahead confirmation, exact-flow fail-closed
  behavior, bounds, persistence, controls and catalogue/runtime gates.
- Public behavior/settings are covered. Exact protected Trinity formula and
  DeepCharts pixel parity are not claimed; market-open visual/alert soak is
  still required.
