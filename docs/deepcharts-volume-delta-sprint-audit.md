# Volume/Delta Sprint — reference audit started

Official reference retrieved 2026-09-06:
https://www.deepcharts.com/helpcenter/article/volume-delta-sprint
Describes accumulation with a length parameter, delta-based fading/fixed
colouring, optional moving-average smoothing and a separate histogram pane.
The prose does not fully establish the numerical recurrence or volume versus
delta output selection. Do not implement a generic burst detector as parity.

`python scripts/dotnet-contracts.py VisualCollectorDictionary` identifies the
settings-shape candidate `VolAnalysis.Collections.VisualCollectorDictionary`:
InputData Volume=0/Order=1; FilterMin/FilterMax/Length int32;
DeltaColorMode Fixed=0/Fading=1; SmoothEnable bool; SmoothLength int32;
SmoothAverageType Simple=0/Exponential=1/Triangular=2/Weighted=3.
Public article also mentions Trade input; installed enum has no Trade member.
No exact protected type binding or formula claim. No gate/runtime changes.

Next: inspect reference screenshots and establish calculation/data semantics,
including Order and the signed output. Preserve the distinct working burst tool.
