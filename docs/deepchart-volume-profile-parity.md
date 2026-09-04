# DeepChart volume profile — parity audit

Read on 2026-08-31 and re-audited interactively on 2026-09-03 from the owner's
own DeepCharts install: the study **`DP: Vol,Multiple 1 D`**, every tab and
dropdown in its settings dialog, plus the vendor's Volume Profile manual.

Internally the feature is **VbP**, never "volume profile" — searching the binary
for the visible name finds nothing.

## The settings surface

Nine tabs, plus a header carrying **Chart area** (Horizontal / Vertical + pane
slot) and **Use sec. axis**.

| Tab | DeepChart | Ours |
| --- | --- | --- |
| **GENERAL** | Vbp type, Vbp period, Length type, Length value, custom Start/End Date-Time | architecture differs — type is the Profile mode control; Daily, Weekly and Fixed Range are separate KwantDesk studies/tools; Composite and Latest remain absent |
| **DATA SETTINGS** | Input data, Filter min, Filter max, Auto grouping, Auto group factor, Manual ticks | execution Volume/Trades complete; MBO order-profile modes intentionally hidden until implemented |
| **PLOT · Background/Text** | Background (nested dialog), Show text, Text (nested dialog) | partial — no nested text dialog |
| **PLOT · Width/Offset** | Width type, Current Width, Current Offset, Previous Width, Previous Offset | complete — Automatic, Percentual period, Window width and Fixed bars use distinct units; a completed-profile bug that ignored Previous Width was fixed |
| **PLOT · Visual Appearance** | Number of profile, Vbp opacity, Border width, Show above bars, Visual style, Align to the right, Mirroring, Always visible | profile count, opacity, border, style and right alignment work; remaining modes absent |
| **POINT OF CONTROL** | Enable, Highlight, Highlight Colour, Show Line, Extend Line, Line Colour, Line Width, Dev. POC Start Time, Shifted POC Tick Grouping, Opacity POC Grouping, + shift alerts | line modes and None/Till interaction/Till end window are live; alerts remain absent |
| **VALUE AREA** | Enable, % Value Area, Highlight, Outside Colour, Show Line, **Developing**, Extend Line, Line Colour, Line Width | calculation, developing trace and all extension modes work; separate fill-highlight toggle remains absent |
| **PEAK AND VALLEY** | Peak/Valley enable, Sensitivity, Exclude High/Low, + Peak, Valley, Business Zone sections | calculation plus independent peak/valley extensions complete |
| **VWAP** | Enable, Highlight, Show Line, Developing VWAP, Extend, Colour, Width, Line style, + configurable Envelopes | master/child switches, highlight, line styling, extension, live developing trail and three σ bands work; arbitrary envelope definitions and an untaped historical developing trail remain absent |
| **FILTER/SPLIT TIME** | Filter Mode, Filter Time, custom Ini/End session (**exchange time zone**), "use end session as start day" | complete |

`Filter Mode` options are **None / Filter / Splitted / Triple** — our four names
match exactly.

## Session split parity

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

KwantDesk now carries the same **three** (`src/lib/volumeProfileSessions.ts`),
Chicago time:

```
Asia       17:00 -> 02:00
London     02:00 -> 10:00
New York   08:30 -> 15:00
```

The former KwantDesk-only 17:00–19:00 Globex split was removed from the volume
profile. It shortened the selected Asia window and guaranteed different
POC/VAH/VAL values before any grouping or value-area calculation ran.

The defaults were subsequently read from the installed Sessions Marker dialog:
Asian 15:00–03:00, Europe 03:00–11:00 and USA 09:30–16:00 New York time. The
table above is their Chicago conversion.

## Fixed as a result of this audit

- **VAH drifted while VAL and POC matched.** The live execution top-up
  recomputed the value area at the hardcoded 70% convention instead of the
  configured percentage, then stamped `valueAreaPercent: 70` on the way out. The
  POC does not move with the percentage and the walk breaks ties upward, so the
  extra volume a wider percentage needs came off the top. `9ff45bac`.
- **Width type was cosmetic.** Four choices now have four contracts: period
  percentage follows the profile period, window percentage follows the pane,
  fixed bars follows candle spacing, and automatic retains the adaptive curve.
- **Previous Width was ignored.** Completed profiles were converted using the
  current width before their own value was selected. The ordering is corrected.
- **Extension dropdowns were missing.** POC, VAH/VAL, peak, valley and VWAP now
  expose and render None, Till interaction and Till end window. Interaction is
  the first later candle whose true high/low touches the level. A later profile
  body is still a hard clipping boundary, so a line never paints through it.
- **Migration retuned charts.** The old v13 migration forcibly replaced saved
  value-area percentage, manual ticks and grouping mode. v14 preserves all
  trader choices and only fills genuinely new fields.

## Deliberate non-parity

- Rithmic MBO powers the live book, DOM and liquidity tooling, but KwantDesk's
  historical profile payload stores executions rather than historical order
  lifecycle events. `Order (MBO)` and `Number Orders (MBO)` stay hidden until
  that archive and calculator exist; presenting those options now would be a
  fake control.
- DeepCharts Composite/Latest periods, Show above bars, full nested text and
  background editors, profile shift alerts, untaped developing historical
  VWAP and arbitrary envelope definitions are not yet implemented. They are
  gaps, not claimed parity.

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
