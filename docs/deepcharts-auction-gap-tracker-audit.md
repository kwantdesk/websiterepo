# Auction Gap Tracker — implementation in progress

Reference: https://www.deepcharts.com/helpcenter/article/auction-gap-tracker
Accessed 2026-09-06. This is a consecutive low-participation price-level study,
not an OHLC opening gap or an extreme-only Unfinished Auction alias.

Official images visually inspected:
- https://framerusercontent.com/images/q0XbD8D68PlsFZKqL5oRObslnI.png
  Minimum tick volume 0, opposite threshold 0, Intrabar, 3 consecutive levels.
- https://framerusercontent.com/images/RuWFODzugWSJFZTZvUhY3JkVsrA.png
  Zones, marker at Bar direction, extension 200 bars, width 1, session reset off;
  triggered zones on, trigger-only-touch off; separate fresh/triggered colours.
These are screenshot values, not recovered constructor defaults.

## Installed DLL contract

`python scripts/dotnet-contracts.py ConfigurableWatcher`
matches `VolAnalysis.Monitoring.ConfigurableWatcher` by settings shape; exact
protected catalogue binding/formula is not established. Same 16.0.9 assembly
hash documented in the ordinary tape audit.

- MinTickVol, MaxUnfVol, MinNumConsUnf, ExtendedBars, LineWidth: int32.
- IncludeMode: Intrabar=0, All=1, ExtremeOnly=2, HighOnly=3, LowOnly=4, WickOnly=5.
- PlotMode: Zones=0, Marker=1, MarkerAndZones=2.
- PlotMarkerPrice: BarDirection=0, Low=1, High=2.
- ResetMode: None=0, SessionOpen=1, EthAndRthOpen=2.
- Four fresh/triggered buy/sell colours; EnableTriggeredZone, TriggerOnlyTouch.
- Sound, alert reference, popup, message text.
- FilterTime: None=0, Eth=1, Rth=2, Custom=3; IniSession/EndSession: TimeSpan.
DLL exposes more controls than the prose article; do not limit implementation
to the two include modes described in that article.

## Calculator foundation — NOT registered

`src/lib/auctionGapTracker.ts` detects consecutive qualifying one-tick rows.
All six location modes supported. Same-side exact consecutive ticks required;
opposite-side threshold and total classified tick volume are inclusive.
Wicks exclude the open/close body boundaries. Empty/tied sides have no inferred
direction; any unknown volume breaks the run. These are explicit implementation
conventions awaiting native numerical comparison, not protected-formula claims.

Requires unfiltered volume-at-price, groupTicks=1. Grouped/trade-count/size-
filtered input returns requires-raw-volume. Missing rows break runs rather than
become invented zeros. Rejects corrupt volume, duplicate/out-of-range ticks.
Live candidates are provisional and recalculated; later opposite prints can
remove them. IDs use bar identity (not timestamp alone) for event bars.
No existing indicator changed. Nine calculation tests and scoped ESLint pass;
full repository TypeScript check passed before the final location-mode extension.
The single-file tsc attempt lacked repository aliases, so was superseded by
the successful project-config check; it is not a production build claim.

## Required before release

- Independent raw one-tick consumer even when Footprint is grouped/filtered;
  correct event-bar allocation, source completeness and replay clipping.
- Retest lifecycle, extension by actual chart bars, session/time filtering,
  trigger-only/trigger visibility, fresh/triggered styling and markers.
- Complete settings, numeric sliders, themes, templates, clean save state.
- Source-timed alert lifecycle, duplicate suppression and closed-market silence.
- Incremental revision/correction handling, bounded buffers, browser/render and
  sustained interaction checks, regression/build and exact production SHA.
- Clarify touch semantics, marker BarDirection placement, time-filter overlap
  and native boundary conventions. Never change Pending just to satisfy count.
