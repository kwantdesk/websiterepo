# Quiet footprint history diagnostic

Owner requested removal of the on-chart "Footprint history incomplete ...
Showing verified data only" notification in the screenshot.

Changed its Chart presentation to a hidden diagnostic element, matching the
adjacent volume-profile diagnostic. It no longer overlays the chart or publishes
a live status announcement. Exact footprint validation, missing-bar accounting,
bounded background recovery, returned records and error state remain unchanged.
No missing execution data is fabricated or marked complete.

Three existing footprint history recovery tests pass; whitespace check passes.
Production build checked before one scoped main-only release. No provider calls,
gateway changes or restarts added.
