# DeepCharts pending-indicator overhaul

Started: 2026-09-04

## Scope and release rule

- Audit and implement only Quant Desk catalogue rows that were `browser-pending`
  at the start of this task. Existing available indicators are out of scope and
  must not be changed as a shortcut.
- Follow the catalogue from top to bottom.
- A row may move from **Pending** to **Add** only after its data contract,
  calculation, default settings, adjustable settings, themed rendering,
  persistence, loading/empty/error states, performance and regression tests
  are complete.
- DeepCharts help/settings and installed application metadata are reference
  evidence. Protected implementation details that cannot be lawfully or
  reliably inspected are not guessed; the observable contract is implemented
  against Quant Desk's licensed Rithmic/QuantData inputs and documented here.

## Evidence constraints

- DeepCharts desktop is installed and running from
  `C:\Program Files\Volumetrica Trading\Deepchart`.
- The installed `Deepchart.dll` is protected by .NET Reactor and rejects IL
  disassembly. Its public metadata/resource strings remain usable for names,
  categories, ranges and defaults, but are not sufficient by themselves to
  prove a formula.
- The current Codex computer-control provider exposes browser tabs only, not
  native Windows surfaces. UI observations must therefore be recorded only
  when native app control becomes available or when the owner supplies a
  capture. No setting or behaviour will be marked verified from assumption.

## Ordered checklist

Legend: `[ ]` not complete, `[~]` in progress, `[x]` complete and addable.

| # | Quant Desk indicator | Stable id | DeepCharts help/settings | Data + formula | Renderer + theme | Settings + persistence | Tests + visual QA | Catalogue |
|---:|---|---|---|---|---|---|---|---|
| 1 | Unfinished Auction | `unfinished-auction` | [x] | [x] | [x] | [x] | [~] | Release candidate |
| 2 | Bar POC Indicator | `bar-poc-indicator` | [ ] | [~] | [ ] | [ ] | [ ] | Pending |
| 3 | Dynamic POC | `dynamic-poc` | [ ] | [~] | [ ] | [ ] | [ ] | Pending |
| 4 | Ratio Highlight | `ratio-highlight` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 5 | Stop Spotter | `stop-spotter` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 6 | Cumulative Iceberg/Stop | `cumulative-iceberg-stop` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 7 | Book Speed | `book-speed` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 8 | KWANT Delta | `deep-delta` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 9 | KWANT Wall | `deep-wall` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 10 | KWANT V-Tracker | `deep-v-tracker` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 11 | Custom Draw-On Volume Profile | `custom-draw-on-volume-profile` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 12 | KWANT Profile Swing | `deep-profile-swing` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 13 | KWANT Profile Values | `deep-profile-values` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 14 | Market Statistics | `market-statistics` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 15 | Confluence Identifier | `confluence-identifier` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 16 | Kwant Levels | `gamma-levels` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 17 | Overlay Chart | `overlay-chart` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 18 | Overlay Symbol | `overlay-symbol` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 19 | Overlay Timeframe Candlestick | `overlay-timeframe-candlestick` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 20 | KWANT-M IVB | `deep-m-ivb` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |
| 21 | KWANT Pattern Builder | `deep-pattern-builder` | [ ] | [ ] | [ ] | [ ] | [ ] | Pending |

## Audit notes

### 1: Unfinished Auction

- The official DeepCharts contract is the extreme-price auction rule: a normal
  high is `0 Bid / x Ask`, a normal low is `x Bid / 0 Ask`, and the opposite-side
  non-zero print marks the unfinished extreme. This is distinct from the
  similarly named **Unfinished Tracker**, which looks for intrabar zero prints.
- Installed DLL metadata confirms the exposed controls and ranges: days to
  load, line width (1–8), bad-high/bad-low colours, rectangle/background,
  opacity (0–100), None/Manual filter with manual minimum volume, extensions,
  None/Session/ETH+RTH resets, shadow-touch removal, and None/ETH/RTH/Custom
  time filtering.
- Quant Desk now requires exact volume-at-price rows from classified Rithmic
  executions. It never derives an unfinished auction from OHLC direction. The
  renderer has theme-linked bad-high/bad-low colours, background/rectangle
  modes, lifecycle extensions and an explicit waiting state when exact rows
  are unavailable.
- Automated coverage passes for normal-vs-unfinished extremes, manual volume
  filtering, wick-vs-close triggering, settings bounds, missing-data refusal,
  and the 08:30 Chicago RTH reset. TypeScript and whitespace validation pass.
- Visual QA and confirmation of the DeepCharts factory defaults remain before
  this release candidate is considered finally addable.

### 2–3: POC family

- Quant Desk already has a tested `PocAuctionSuiteEngine` driven by exact
  execution-classified Footprint rows. It calculates raw-tick unfinished
  auction states, per-bar POC and developing/session POC without manufacturing
  bid/ask volume from OHLC candles.
- These three pending entries must be independent, focused views over that
  shared calculation contract. They must not alter or alias the existing
  available **POC & Auction Suite** instance in a user's workspace.
- The DeepCharts **Unfinished Settings** group with `Minimum Tick Vol`,
  `Max Unfinished Threshold`, `Min. Num. of Consecutive Zero`, and `Marker
  Price` belongs to **Unfinished Tracker**, not **Unfinished Auction**, and will
  not be mixed into item 1.
