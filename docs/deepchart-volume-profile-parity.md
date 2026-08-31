# DeepChart volume profile — parity audit

Read on 2026-08-31 from the owner's own DeepChart install: the study **`DP:
DeltaVol,Multiple 1 D`**, every tab of its settings dialog, plus the assembly
itself via `scripts/dotnet-metadata.py`.

Internally the feature is **VbP**, never "volume profile" — searching the binary
for the visible name finds nothing.

## The settings surface

Nine tabs, plus a header carrying **Chart area** (Horizontal / Vertical + pane
slot) and **Use sec. axis**.

| Tab | DeepChart | Ours |
| --- | --- | --- |
| **GENERAL** | Vbp type, Vbp period, Length type, Length value, custom Start/End Date-Time | **missing** |
| **DATA SETTINGS** | Input data, Filter min, Filter max, Auto grouping, Auto group factor, Manual ticks | complete |
| **PLOT · Background/Text** | Background (nested dialog), Show text, Text (nested dialog) | partial — no nested text dialog |
| **PLOT · Width/Offset** | Width type, Current Width, Current Offset, Previous Width, Previous Offset | **only a width %** |
| **PLOT · Visual Appearance** | Number of profile, Vbp opacity, Border width, Show above bars, Visual style, Align to the right, Mirroring, Always visible | **opacity + border only** |
| **POINT OF CONTROL** | Enable, Highlight, Highlight Colour, Show Line, Extend Line, Line Colour, Line Width, Dev. POC Start Time, Shifted POC Tick Grouping, Opacity POC Grouping, + shift alerts | no Dev. POC start time, no shifted-POC grouping, no alerts |
| **VALUE AREA** | Enable, % Value Area, Highlight, Outside Colour, Show Line, **Developing**, Extend Line, Line Colour, Line Width | no **Developing** |
| **PEAK AND VALLEY** | Peak/Valley enable, Sensitivity, Exclude High/Low, + Peak, Valley, Business Zone sections | complete |
| **VWAP** | Enable, Highlight, Show Line, Developing VWAP, Extend, Colour, Width, Line style, + configurable Envelopes | we ship three fixed σ bands |
| **FILTER/SPLIT TIME** | Filter Mode, Filter Time, custom Ini/End session (**exchange time zone**), "use end session as start day" | complete |

`Filter Mode` options are **None / Filter / Splitted / Triple** — our four names
match exactly.

## The session split does not match, structurally

This is the cause of a profile being consistently out by a fixed amount rather
than drifting.

DeepChart carries **three** sessions, which is what "Triple" means. Read off
`Deepchart.Roles.RoleSolverContainer`, whose settings-bound property names
survive obfuscation:

```
AsianEnabled   AsianStartTime   AsianEndTime
EuropeEnabled  EuropeStartTime  EuropeEndTime
UsaEnabled     UsaStartTime     UsaEndTime
```

Ours carries **four** (`src/lib/volumeProfileSessions.ts`), Chicago time:

```
Globex     17:00 -> 19:00
Asia       19:00 -> 02:00
London     02:00 -> 08:30
New York   08:30 -> 15:15
```

So our Globex is a window DeepChart does not have, and our Asia therefore starts
two hours after whatever DeepChart's Asian session starts at. Two different
windows over the same tape produce two different POC/VAH/VAL — a constant
offset, not a rounding difference.

**Still unknown:** DeepChart's three default times. They are not compile-time
constants (the constructor carries none), the workspace files are encrypted
(`.xmle`, a hex key then ciphertext), and the enum that would name them is
obfuscated to `StreamBuildControllerUpdate`. The remaining routes are the
`Sessions Marker (multiple)` study's own dialog, or the `DefaultValue`
attributes on those properties via the CustomAttribute table.

## Fixed as a result of this audit

- **VAH drifted while VAL and POC matched.** The live execution top-up
  recomputed the value area at the hardcoded 70% convention instead of the
  configured percentage, then stamped `valueAreaPercent: 70` on the way out. The
  POC does not move with the percentage and the walk breaks ties upward, so the
  extra volume a wider percentage needs came off the top. `9ff45bac`.

## The tool

`scripts/dotnet-metadata.py` reads PE → CLI header → metadata root → the `#~`
table stream, and decodes a method body's IL far enough to read its numeric
constants. It is a reader: it never writes, patches or redistributes anything
from the assembly. It answers "what number does this actually use" so our own
implementation can be correct.

```
python scripts/dotnet-metadata.py --types session
python scripts/dotnet-metadata.py --methods RoleSolverContainer
python scripts/dotnet-metadata.py --il "RoleSolverContainer..ctor"
```
