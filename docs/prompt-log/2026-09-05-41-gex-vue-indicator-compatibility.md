# Prompt 41 — GEX VUE instrument-aware indicators

## Request

Make the indicator library understand whether the active GEX VUE pane is an options underlying/index or a futures chart; audit every indicator, enable everything with a valid data path, keep incompatible studies visible but disabled, make profiles symbol-correct, and keep five days of options-underlying candle history.

## Fix

- Added one instrument capability resolver used by the indicator library.
- Removed the unrelated global Rithmic health probe from the library open path.
- Added explicit native, adapted and unavailable states with a data reason.
- Passed the active pane broker into the control so decisions are per chart.
- Kept exact order-flow/MBO studies disabled where their required tape does not exist instead of fabricating them from option-chain data.
- Kept SPX/NDX profiles honestly labelled as projected ES/NQ hedge-futures execution profiles because cash indices have no native trades.
- Changed SPY/QQQ/equity profiles to their own OHLCV rather than the old ES/NQ substitution.
- Preserved the standard five-day GEX VUE candle window and added a catalog-wide compatibility regression audit.

## Outcome

The same indicator library now changes availability from the active chart's real data contract. Supported studies calculate from that symbol; impossible studies are visibly unavailable with the reason; and no QuantData options event is misrepresented as an underlying execution or Level 3 event.
