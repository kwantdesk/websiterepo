# Chart indicator control audit

Started 4 November 2026. This is the ongoing work list.

Source references establish a place to inspect. They do not establish that a button changes its intended output. Dynamic controls and shared keys require individual tracing.

## Tally

- Indicators inventoried — 124
- Default setting entries inventoried — 4302
- Initial entries without a literal runtime reference — 103
- Indicators fully live/render verified by this isolated pass — 0
- Confirmed irreparable controls — 0
- All 124 settings dialogs, library lifecycle cases and Save/Close/reopen cases checked; live/render sign-off remains separate. See FINDINGS.md.

## Options Flow

### Big Blocks (Options)

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minContracts | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minPremium | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| binSize | 0.25 | numeric registry | 8 source files | save wiring verified; chart output sign-off separate |
| windowMinutes | 0 | numeric registry | 10 source files | save wiring verified; chart output sign-off separate |
| maxLevels | 60 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| widthPx | 150 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| barHeight | 12 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| opacity | 85 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| useStrikePrice | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| sizeByPremium | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| includeMultiLeg | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCalls | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showPuts | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showValues | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| callColor | "#22c55e" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| putColor | "#ef4444" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |

### Gamma Environment

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| position | "top-right" | dialog source reference | 116 source files | save wiring verified; chart output sign-off separate |
| sourceSymbol | "SPX" | dialog source reference | 28 source files | save wiring verified; chart output sign-off separate |
| showFreshness | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | false | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#EF4444" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| badgeScale | 1 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| gammaEnvironmentSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### Zero Gamma Line

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| sourceTicker | "AUTO" | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| historySessions | 5 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| refreshSeconds | 30 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| opacity | 72 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| lineColor | "#A3FF12" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |
| showCurrentValue | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showRegimeHint | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |

### Options Delta

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| refreshSeconds | 60 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#EF4444" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |

### Zero Gamma Bars

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| refreshSeconds | 60 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#EF4444" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |

### Gamma Heatmap

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| historyHours | 24 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| binSize | 5 | numeric registry | 8 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| intensity | 1 | numeric registry | 15 source files | save wiring verified; chart output sign-off separate |
| refreshSeconds | 30 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| preset | "intraday" | dialog source reference | 38 source files | save wiring verified; chart output sign-off separate |
| metric | "GAMMA" | dialog source reference | 44 source files | save wiring verified; chart output sign-off separate |
| viewMode | "net" | dialog source reference | 11 source files | save wiring verified; chart output sign-off separate |
| sourceMode | "hybrid" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| optionsSource | "AUTO" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showHistorical | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLevels | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| carryForwardFade | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showStatus | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#EF4444" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| gammaHeatmapSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Net Gamma Exposure By Strike

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| refreshSeconds | 5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumDte | 0 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| maximumDte | 7 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| customBinSizePoints | 1 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| minimumAbsoluteExposure | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumDistanceFromSourceSpot | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| laneWidthPercent | 24 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumLaneWidthPx | 220 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumLaneWidthPx | 420 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| floatingXPercent | 50 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| zeroSpinePercent | 50 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| fixedBarHeightPx | 9 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumBarHeightPx | 3 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumBarHeightPx | 24 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| barGapPx | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| horizontalPaddingPx | 8 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| scalePercentile | 98 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| fixedMaximum | 0 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| logarithmicStrength | 9 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumDisplayedRows | 80 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumPercentageOfTotal | 0.1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| barOpacity | 100 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| borderOpacity | 100 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | numeric registry | 20 source files | save wiring verified; chart output sign-off separate |
| gradientStrength | 25 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumMappingConfidence | 70 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| preset | "balanced-net-gex" | dialog source reference | 38 source files | save wiring verified; chart output sign-off separate |
| provider | "quantdata" | dialog source reference | 116 source files | source reference found; behavior pending|
| sourceTicker | "AUTO" | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| representation | "per-one-percent-move" | dialog source reference | 28 source files | source reference found; behavior pending|
| expirationMode | "zero-to-one-dte" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| expirationDates | "" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| includeWeeklies | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| includeMonthlies | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| includeQuarterlies | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| aggregationMode | "auto-bin" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| placement | "floating" | dialog source reference | 39 source files | source reference found; behavior pending|
| spaceMode | "overlay" | needs inspection | 1 source files | source reference found; behavior pending|
| reverseDirections | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| barHeightMode | "automatic" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| scaleMode | "visible-percentile" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| scaleTransform | "square-root" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| sharePositiveNegativeScale | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| contentMode | "net" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| visualMode | "gradient" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showZeroSpine | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showValues | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| showMappedPrice | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showMaxPositive | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showMaxNegative | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showDominantAbsolute | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showCallWall | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showPutWall | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showCurrentPrice | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showHeader | true | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showMappingConfidence | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| tooltipsEnabled | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| fadeWhenBelowMinimum | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| hideWhenBelowMinimum | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#EF4444" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| callColor | "#22C55E" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| putColor | "#EF4444" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| absoluteColor | "#8B5CF6" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| zeroSpineColor | "#71717A" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| warningColor | "#F59E0B" | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| netGammaSettingsVersion | 3 | needs inspection | 0 source files | internal metadata|

### GEX Interval Map

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| refreshSeconds | 5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| rollingBuckets | 5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumDte | 0 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| maximumDte | 7 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| customBinSizePoints | 1 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| minimumAbsoluteExposure | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumDistancePoints | 0 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| maximumPoints | 40000 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumStrikesPerBucket | 80 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| intensity | 1 | numeric registry | 15 source files | save wiring verified; chart output sign-off separate |
| minimumRadius | 3 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| maximumRadius | 18 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| bubbleStrokeWidth | 1.25 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| bubbleFillStrength | 12 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| trackWidth | 1.5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| cellWidth | 10 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| fixedDotRadius | 3 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumOpacity | 10 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| maximumOpacity | 72 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| scalePercentile | 98 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| fixedMaximum | 1000000000 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| logStrength | 9 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| currentBucketScaleMultiplier | 115 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| currentBucketOpacityMultiplier | 115 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| mergeTolerancePoints | 1 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| alertExposureThreshold | 50000000 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| alertDistancePoints | 5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| alertCooldownSeconds | 60 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| preset | "balanced-intraday" | dialog source reference | 38 source files | save wiring verified; chart output sign-off separate |
| provider | "quantdata" | dialog source reference | 116 source files | source reference found; behavior pending|
| sourceTicker | "AUTO" | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| aggregationPeriod | "1m" | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| historyMode | "current-session" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| sessionDate | "" | dialog source reference | 108 source files | source reference found; behavior pending|
| startTime | "" | dialog source reference | 57 source files | source reference found; behavior pending|
| endTime | "" | dialog source reference | 52 source files | source reference found; behavior pending|
| mode | "raw" | dialog source reference | 197 source files | save wiring verified; chart output sign-off separate |
| baseline | "previous-bucket" | dialog source reference | 54 source files | save wiring verified; chart output sign-off separate |
| expirationMode | "zero-to-one-dte" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| expirationDates | "" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| includeWeeklies | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| includeMonthlies | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| includeQuarterlies | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| aggregationMode | "auto-bin" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| contentMode | "net" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| visualMode | "bubbles" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| scaleMode | "visible-percentile" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| scaleTransform | "square-root" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| highlightCurrentBucket | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showCurrentBucketOutline | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| hollowBubbles | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showLevelTracks | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showUnderlyingPriceLine | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showMaxPositive | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showMaxNegative | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showDominantAbsolute | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showCallWall | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showPutWall | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| mergeCoincidentLabels | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| hideZeroValues | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showLevels | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showValues | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| showHeader | true | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showMappingConfidence | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| tooltipsEnabled | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| enableAlerts | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| alertNewLargePoint | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| alertLevelApproach | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| alertLevelTouch | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| browserNotifications | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#EF4444" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| callColor | "#22C55E" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| putColor | "#EF4444" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| negativeExposurePalette | "neutral" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| gexIntervalMapSettingsVersion | 3 | needs inspection | 0 source files | internal metadata|

### Bounce Levels

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumDte | 0 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| maximumDte | 7 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| maximumLevels | 8 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| topExposurePercent | 10 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumPercentOfKing | 15 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumRelevanceScore | 55 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumDistancePoints | 0 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| clusterDistancePoints | 25 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| airPocketRatio | 20 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumNodesPerSlice | 24 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| activeEnterThreshold | 15 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| activeExitThreshold | 8 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| retirementConfirmationSnapshots | 3 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| absoluteExposureScale | 1000000000 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| rollWeakeningThreshold | 40 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| rollBuildingThreshold | 40 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maxRollDistance | 5 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| rollWindowSeconds | 120 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumGatekeepers | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumMajorNodes | 4 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumGatekeeperRelevance | 60 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumGatekeeperPercentOfKing | 20 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumClusterNodes | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumAirPocketWidthPercent | 0.3 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| magnitudeWeight | 45 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| proximityWeight | 15 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| accumulationWeight | 15 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| persistenceWeight | 10 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| freshnessWeight | 10 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| clusterWeight | 5 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| proximityDecayPercent | 3 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| developingMinimumPercentile | 75 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| developingMinimumGrowthPercent | 10 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| weakeningThresholdPercent | -10 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| weakeningRelevanceThreshold | 45 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| retirementRelevanceThreshold | 30 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| retirementExposurePercentile | 65 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| touchTolerancePercent | 0.05 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| touchDecayFactor | 85 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumNodeThickness | 2 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumNodeThickness | 18 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| lineOpacity | 100 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| minimumNodeOpacity | 8 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| exposureIntensity | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| glowStrength | 5 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| alertDistancePoints | 5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| alertMinimumRelevance | 55 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| alertMinimumPercentOfKing | 15 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| alertMinimumExposure | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| alertMinimumRoc | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| alertCooldownSeconds | 60 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| gexMapMirror | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| linkGexMapSettings | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| mapExpiryScope | "FRONT_EXPIRY" | needs inspection | 2 source files | save wiring verified; chart output sign-off separate |
| mapRepresentation | "PER_ONE_DOLLAR_MOVE" | needs inspection | 2 source files | save wiring verified; chart output sign-off separate |
| mapExposureModel | "STRUCTURAL_OI" | needs inspection | 2 source files | save wiring verified; chart output sign-off separate |
| mapViewMode | "star" | needs inspection | 2 source files | source reference found; behavior pending|
| mapStepMinutes | 1 | needs inspection | 2 source files | save wiring verified; chart output sign-off separate |
| preset | "balanced-intraday" | dialog source reference | 38 source files | internal metadata|
| provider | "quantdata" | dialog source reference | 116 source files | source reference found; behavior pending|
| sourceTicker | "AUTO" | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| priceMode | "live" | dialog source reference | 11 source files | source reference found; behavior pending|
| extendRight | false | dialog source reference | 30 source files | save wiring verified; chart output sign-off separate |
| greekMode | "GAMMA" | dialog source reference | 26 source files | save wiring verified; chart output sign-off separate |
| expirationMode | "front-expiration" | dialog source reference | 4 source files | source reference found; behavior pending|
| expirationDates | "" | dialog source reference | 7 source files | source reference found; behavior pending|
| historyBuckets | 1440 | needs inspection | 4 source files | source reference found; behavior pending|
| includeWeeklies | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| includeMonthlies | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| includeQuarterlies | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showHeader | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showLabels | false | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| showValues | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| showAirPockets | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showKing | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showFloor | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showCeiling | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showGatekeepers | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showMajorNodes | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showClusters | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showDevelopingNodes | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showWeakeningNodes | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showRetiredHistory | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showTouchCount | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| microOrbTexture | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| visualStrengthBasis | "percent-of-king" | dialog source reference | 4 source files | source reference found; behavior pending|
| rollDetectionEnabled | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| rollVisualizationEnabled | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| tooltipsEnabled | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| enableAlerts | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| alertLevelApproach | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| alertLevelTouch | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| alertFreshNodesOnly | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertFirstTouchOnly | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertMapReshuffle | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertStructuralChanges | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertNodeTransitions | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| inAppSound | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| chartMarkers | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| browserNotifications | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| syncGexMapColors | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|
| kingColor | "#F59E0B" | dialog source reference | 1 source files | source reference found; behavior pending|
| developingColor | "#22C55E" | dialog source reference | 1 source files | source reference found; behavior pending|
| weakeningColor | "#EF4444" | dialog source reference | 1 source files | source reference found; behavior pending|
| airPocketColor | "#71717A" | dialog source reference | 1 source files | source reference found; behavior pending|
| bounceLevelsSettingsVersion | 6 | needs inspection | 0 source files | internal metadata|

### Dark Pool Map

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| historyDays | 2 | numeric registry | 8 source files | save wiring verified; chart output sign-off separate |
| pollSeconds | 2 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| minimumPrintNotional | 100000 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumPrintNotional | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumPrintShares | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumPrintShares | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumLevelNotional | 5000000 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumLevelShares | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumTradeCount | 1 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| topLevels | 50 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| minimumStrengthScore | 30 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| mappedBinPoints | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| sourceBinCents | 5 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| displayTickMultiple | 4 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| mergeTolerancePoints | 3 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| maximumZoneWidthPoints | 20 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| recencyHalfLifeHours | 24 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| sessionsForFullPersistenceScore | 5 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumHistoricalPrints | 100000 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumVisibleCircles | 2000 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumVisibleZones | 100 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumRadius | 3 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| maximumRadius | 18 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| zoneOpacity | 16 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| manualAlpha | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| manualBeta | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumMappingR2 | 0.95 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| mappingWindowMinutes | 60 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumMappingSamples | 120 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| staleAllowanceSeconds | 30 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| alertPrintNotional | 5000000 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| alertLevelNotional | 25000000 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| alertScore | 80 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| alertDistancePoints | 5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| alertCooldownSeconds | 60 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| preset | "balanced" | dialog source reference | 38 source files | save wiring verified; chart output sign-off separate |
| sourceTicker | "AUTO" | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| mappingMode | "rolling-affine" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| visualMode | "circles-and-zones" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| priceBinMode | "mapped-points" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| mergeNearbyLevels | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showDelayedPrints | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| includeDelayedInLevels | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| includeAskSide | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| includeBidSide | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| includeMid | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| includeUnknown | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showLevelLabels | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showMappingBadge | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showMappingConfidence | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showLevelTable | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| enableAlerts | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| alertNewLargePrint | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertNewLargeLevel | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertScoreThreshold | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertPriceApproach | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertPriceTouch | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| browserNotifications | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| askSideColor | "#22C55E" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| bidSideColor | "#EF4444" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| midColor | "#A1A1AA" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| delayedColor | "#F59E0B" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| darkPoolMapSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Dark Pool (GEX)

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookbackDays | 30 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| topN | 5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumNotional | 1000000 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumNotional | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumShares | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumShares | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumSharePrice | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maximumSharePrice | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| tolerance | 0.15 | numeric registry | 19 source files | save wiring verified; chart output sign-off separate |
| interactionTolerance | 0.03 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| resetDistance | 0.1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumTimeOutsideMs | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| reactionThreshold | 0.1 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| maximumConfirmationBars | 20 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumReactionDurationMs | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| breakDistance | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| breakTimeBeyondMs | 60000 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| volumeThreshold | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| reclaimConfirmationCloses | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumTimeBeyondBeforeReclaimMs | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| reactionHorizonBars | 20 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| reactionHorizonMs | 1800000 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumResearchSamples | 3 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumStatsSamples | 3 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| activationRadiusPercent | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| qualityPrecisionWeight | 20 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| qualityExcursionWeight | 25 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| qualityEfficiencyWeight | 20 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| qualitySpeedWeight | 15 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| qualityFreshnessWeight | 10 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| qualityGexWeight | 10 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| clusterDistance | 0.12 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| minimumClusterPrints | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumClusterNotional | 5000000 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| bandThickness | 2 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| bandOpacity | 100 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| originMarkerSize | 7 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| haloIntensity | 18 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| kingBoost | 30 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| ageFadeHalfLifeDays | 30 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| proximityDistance | 0.15 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| refreshSeconds | 5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| alertPrintNotional | 5000000 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| alertConfluence | 75 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| alertCooldownSeconds | 60 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| lookbackMode | "calendar-days" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| sortMode | "notional" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| viewPreset | "raw-dp-levels" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| precisionMode | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| contextMode | "current" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| confluenceMode | "king-and-major" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| toleranceMode | "percentage" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| displayMode | "raw" | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| clusterEnabled | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| clusterDistanceMode | "percentage" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| proxyMode | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showOriginMarker | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showForwardMemory | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showExactLine | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| labelExtended | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showReactionMarkers | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showHoldMarkers | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showBreakMarkers | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showReclaimMarkers | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showReactionTrail | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showInteractionZone | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| reactionAnalytics | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showReactionResearch | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| interactionToleranceMode | "percentage" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| resetDistanceMode | "percentage" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| reactionThresholdMode | "percentage" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| breakDistanceMode | "ticks" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| breakConfirmation | "1-close" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| interactionSession | "regular-hours" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| useIntrabarHighLow | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| requireCloseAwayFromLevel | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| useVolumeConfirmation | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| enableReclaimDetection | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| firstTouchOnly | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| includeLateReports | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| includeCorrectedPrints | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| excludeCanceled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showTooltip | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showInspector | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showFreshness | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| ageFade | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| proximityEmphasis | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| performanceQuality | "auto" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| enableAlerts | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| alertNewPrint | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertPriceApproach | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertPriceTouch | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertHoldConfirmed | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertBreakConfirmed | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertReclaimConfirmed | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertGexConfluence | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| browserNotifications | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| positiveGexColor | "#22C55E" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| negativeGexColor | "#EF4444" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| darkPoolGexSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### Implied Volatility Rank

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookBackPeriodDays | 252 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| targetMaturityDays | 30 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| refreshSeconds | 15 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| staleAfterSeconds | 90 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumForwardFillMinutes | 5 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| paneHeight | 220 | numeric registry | 11 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| priceLineWidth | 1.5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| decimalPrecision | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lowThreshold | 20 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| middleThreshold | 50 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| highThreshold | 80 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| preset | "balanced-30d" | dialog source reference | 38 source files | save wiring verified; chart output sign-off separate |
| provider | "quantdata" | dialog source reference | 116 source files | source reference found; behavior pending|
| sourceTicker | "AUTO" | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| contractMode | "average-call-put" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| placement | "separate-pane" | dialog source reference | 39 source files | save wiring verified; chart output sign-off separate |
| showIvRank | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showIvPercentile | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showRawIv | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showPriceOverlay | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showRegimeBands | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showHeader | true | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showLegend | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showCurrentBadge | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| breakAtMissingData | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| carryLastValid | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| useLiveIntradayIv | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| rankColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| percentileColor | "#8B5CF6" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| callColor | "#22C55E" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| putColor | "#EF4444" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| priceColor | "#E5E7EB" | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| lowBandColor | "#EF4444" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| middleBandColor | "#71717A" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| highBandColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| ivRankSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

## Order Flow

### Cumulative Volume Delta

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| periodValue | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| filterMinVolume | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| filterMaxVolume | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| zeroLineWidth | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| displayStyle | "candles" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| inputData | "Volumes" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| periodMode | "days" | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| cvdSettingsVersion | 5 | needs inspection | 0 source files | internal metadata|
| showName | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showValue | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| customName | "Cumulative Volume Delta" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showBidAskVolumes | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| filteredEnabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| filteredSeparateAxis | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showZeroLine | true | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| deltaAskColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| deltaBidColor | "#EF4444" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| volumeAskColor | "#34D399" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| volumeBidColor | "#F87171" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| filteredAskColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| filteredBidColor | "#EF4444" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| zeroLineColor | "#52525B" | generated control candidate | 5 source files | save wiring verified; chart output sign-off separate |

### CVD Divergence

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| bullishColor | "#22C55E" | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| bearishColor | "#EF4444" | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| pivotStrength | 2 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| lookbackBars | 300 | numeric registry | 8 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |

### Pulling & Stacking

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| aggregationMs | 250 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| rollingWindowMs | 10000 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| eventMergeGapMs | 75 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| postSnapshotWarmupMs | 3000 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| baselineWarmupMs | 20000 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| historySeconds | 300 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| baselineWindowMs | 60000 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| baselineSampleLimit | 4000 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| minimumBaselineSamples | 30 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| minimumContracts | 25 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| relativeThreshold | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| selectedPercentile | 0.9 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| scoreThreshold | 65 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| markerMinimumScore | 65 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| visibleTicks | 120 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| profileWidthPercent | 13 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| minimumProfileWidthPx | 110 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumProfileWidthPx | 280 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| latestWindowMs | 1000 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lowerPaneHeight | 160 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| markerSize | 7 | numeric registry | 22 source files | save wiring verified; chart output sign-off separate |
| maximumEvents | 1000 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumBuckets | 4000 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| staleAfterMs | 5000 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| markerRetentionMs | 300000 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| minimumOpacity | 0.025 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| maximumOpacity | 0.42 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| minimumCellHeightPx | 2 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumCellHeightPx | 24 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| wallMinimumContracts | 150 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| wallMinimumLevels | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| wallMaximumGapTicks | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| wallBuildWindowMs | 500 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| wallMinimumRelativeMultiplier | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| wallMinimumScore | 65 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| wallPersistenceMs | 250 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| collapseWindowMs | 1500 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| collapseMinimumPulledContracts | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| collapseMinimumRatio | 0.6 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| collapseMaximumExecutedRatio | 0.25 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| vacuumMinimumLevels | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| vacuumMinimumContracts | 200 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| vacuumMaximumGapTicks | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| vacuumWindowMs | 300 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| vacuumMinimumDepthRemovalRatio | 0.5 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| vacuumMinimumScore | 70 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| repostWindowMs | 1000 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| repostPriceToleranceTicks | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| repostSizeTolerance | 0.3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| repostMinimumQuantity | 50 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| repostMinimumScore | 65 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| alertCooldownMs | 5000 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| preset | "balanced" | dialog source reference | 38 source files | save wiring verified; chart output sign-off separate |
| classificationMode | "price-level" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| moveHandling | "separate-move" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| aggregationMode | "fixed-window" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| renderMode | "hybrid" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| lowerPaneMode | "directional-pressure" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| baselineBuckets | 60 | needs inspection | 1 source files | source reference found; behavior pending|
| currentProfileWidth | 156 | needs inspection | 1 source files | source reference found; behavior pending|
| includeOwnOrders | false | generated control candidate | 2 source files | source reference found; behavior pending|
| includeImpliedOrders | false | generated control candidate | 2 source files | source reference found; behavior pending|
| bidEnabled | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| askEnabled | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showHeatCells | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showRibbons | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showEventMarkers | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showCurrentProfile | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLiveDepth | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLowerPane | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| showHeader | true | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showTooltips | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showWallBuild | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showWallCollapse | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLiquidityVacuum | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| pullRepostEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| enableAlerts | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| bidStackColor | "#22C55E" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| askStackColor | "#EF4444" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| bidPullColor | "#F59E0B" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| askPullColor | "#38BDF8" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| moveColor | "#A78BFA" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| pullingStackingSettingsVersion | 2 | needs inspection | 1 source files | internal metadata|

### Delta Bar

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| ladderWidthPx | 150 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| ladderEdgeGapPx | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| ladderLevelSpacingPx | 22 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| ladderOpacity | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| ladderFontSize | 8 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| displayMode | "pane" | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| showLadderValues | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| buyColor | "#22C55E" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sellColor | "#EF4444" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| spineColor | "#6B7280" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |

### Delta % Highlight

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minValue | 50 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maxValue | 0 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| markerSize | 1 | numeric registry | 22 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showAsk | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showBid | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showValue | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| markerShape | "square" | dialog source reference | 2 source files | source reference found; behavior pending|
| markerPosition | "inBar" | dialog source reference | 2 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| deltaHighlightSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Delta Cumulative Candlestick

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| filterMinVolume | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| filterMaxVolume | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| sessionStartHour | 17 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| averageLength | 20 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| averageLineWidth | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| averageDeviation | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| zeroLineWidth | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| inputData | "Volumes" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| resetToSession | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| displayStyle | "candles" | dialog source reference | 7 source files | source reference found; behavior pending|
| candleStyle | "candlestick" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showAverage | false | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| averageType | "simple" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| averageLineStyle | "solid" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showAverageDeviations | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showZeroLine | true | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| showName | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showValue | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| deltaAskColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| deltaBidColor | "#EF4444" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| averageColor | "#60A5FA" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| deviationColor | "#71717A" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| zeroLineColor | "#52525B" | generated control candidate | 5 source files | save wiring verified; chart output sign-off separate |
| cumulativeCandlestickSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Delta Cumulative Histogram

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| filterMinVolume | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| filterMaxVolume | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| sessionStartHour | 17 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| zeroLineWidth | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| inputData | "Volumes" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| resetToSession | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| displayStyle | "bars" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| showName | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showValue | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showZeroLine | true | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| customName | "Cumulative Delta Histogram" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| deltaAskColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| deltaBidColor | "#EF4444" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lineColor | "#60A5FA" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |
| zeroLineColor | "#52525B" | generated control candidate | 5 source files | save wiring verified; chart output sign-off separate |
| cumulativeHistogramSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Imbalance Tracker

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumPercent | 400 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumDelta | 0 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| minimumConsecutive | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| tickGroupingTicks | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| extendedBars | 10 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| zonesExtraTicks | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| calculationMode | "diagonal" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| includeZero | false | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| resetMode | "none" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showTriggered | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| triggerOnlyTouch | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| enableAlertSound | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| alertName | "Imbalance detected" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| enablePopup | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| popupMessage | "Imbalance tracker" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| filterTime | "none" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| sessionStart | "09:30" | dialog source reference | 8 source files | source reference found; behavior pending|
| sessionEnd | "16:00" | dialog source reference | 7 source files | source reference found; behavior pending|
| buyColor | "#22C55E" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sellColor | "#EF4444" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| buyTriggeredColor | "#86EFAC" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sellTriggeredColor | "#FCA5A5" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| imbalanceTrackerSettingsVersion | 3 | needs inspection | 0 source files | internal metadata|

### Imbalance Rejector

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumPercent | 300 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| comparisonDepth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lookbackPeriod | 5 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| tickOffset | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| markerSize | 8 | numeric registry | 22 source files | save wiring verified; chart output sign-off separate |
| markerThickness | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| includeZero | false | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| confirmedOnly | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| markerType | "triangle" | needs inspection | 2 source files | source reference found; behavior pending|
| bullishColor | "#22C55E" | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| bearishColor | "#EF4444" | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| imbalanceRejectorSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Unfinished Auction

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| daysToLoad | 5 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| opacity | 22 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| manualMinimumVolume | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| customStartMinutes | 510 | numeric registry | 10 source files | save wiring verified; chart output sign-off separate |
| customEndMinutes | 900 | numeric registry | 10 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| badHighColor | "#EF4444" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| badLowColor | "#22C55E" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showRectangle | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showBackground | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | save wiring verified; chart output sign-off separate |
| extendLines | true | generated control candidate | 33 source files | save wiring verified; chart output sign-off separate |
| resetMode | "session-open" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| removeOnShadowTouch | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| filterTime | "none" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### Bar POC Indicator

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| daysToLoad | 5 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| filterMin | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| filterMax | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| autoStdDev | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| manualMinimumVolume | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| rthAutoStdDev | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| rthManualMinimumVolume | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| rthStartMinutes | 510 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| rectangleLineWidth | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| backgroundOpacity | 22 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| extensionLineWidth | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maxBarsExtension | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| tickMarginBreakout | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| durationFontSize | 9 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | save wiring verified; chart output sign-off separate |
| rthFilterWindow | "disabled" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| rthFilterMode | "none" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showRectangle | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showBackground | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| extendPoc | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| resetOnNewDay | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| removeOnShadowTouch | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| hideLineOnBreakout | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showDuration | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| durationTextColor | "#A1A1AA" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### Dynamic POC

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| periodValue | 20 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| firstEnvelope | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| secondEnvelope | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| thirdEnvelope | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| envelopeLineWidth | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| periodMode | "bars" | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| envelopeMode | "standard-deviation" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showPoc | true | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| showFirstEnvelope | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showSecondEnvelope | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showThirdEnvelope | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#22D3EE" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| firstEnvelopeColor | "#A3E635" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| secondEnvelopeColor | "#F59E0B" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| thirdEnvelopeColor | "#EF4444" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### Speed of Tape

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| database | "volume" | dialog source reference | 17 source files | save wiring verified; chart output sign-off separate |
| filterMin | 1 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| filterMax | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| numberSeconds | 10 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| standardDeviationPerFilter | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| paneHeight | 190 | numeric registry | 11 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| bullBorderColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| bullFillColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| bearBorderColor | "#EF4444" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| bearFillColor | "#EF4444" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| speedOfTapeSettingsVersion | 1 | dialog source reference | 1 source files | internal metadata|

### Speed of Tape (Instant)

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| filterMin | 1 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| filterMax | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| numberOfSeconds | 10 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| barsToShow | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| scaleMinValue | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| textSize | 10 | numeric registry | 11 source files | save wiring verified; chart output sign-off separate |
| standardDeviationLookback | 60 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| settingsVersion | 2 | needs inspection | 1 source files | internal metadata|
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| displayValue | "total" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| plotReversed | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showStandardDeviations | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| positiveBorderColor | "#22C55E" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| positiveFillColor | "#22C55E" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| negativeBorderColor | "#EF4444" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| negativeFillColor | "#EF4444" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| textEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| textColor | "#F8FAFC" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |

### Volume/Delta Sprint

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| filterMin | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| filterMax | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| length | 10 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |
| deltaColorMode | "fading" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| smoothingEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| smoothingType | "simple" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| smoothingLength | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| showDelta | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showBid | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showAsk | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#EF4444" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 3 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| shortName | "Volume/Delta Sprint" | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |

### Tape Speed & Order-Flow Burst

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| rollingWindowMs | 1000 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| updateStepMs | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| fixedBucketMs | 1000 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maximumInterTradeGapMs | 75 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumEventDurationMs | 2000 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| baselineWindowMs | 120000 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| minimumBaselineSamples | 30 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| selectedPercentile | 0.9 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| relativeSpeedMultiplier | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| relativeDeltaMultiplier | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumContractsPerSecond | 100 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumTradesPerSecond | 5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumAbsoluteDeltaPerSecond | 50 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumQuantity | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumTradeCount | 3 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| minimumDirectionalShare | 0.7 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumDirectionalDelta | 25 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumQualityScore | 60 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumMarkerScore | 70 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| largeTradeThreshold | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| continuationWindowMs | 3000 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| historySeconds | 3600 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| paneHeight | 190 | numeric registry | 11 source files | save wiring verified; chart output sign-off separate |
| markerSize | 7 | numeric registry | 22 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| preset | "balanced-futures" | dialog source reference | 38 source files | save wiring verified; chart output sign-off separate |
| windowMode | "rolling" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| dynamicBaselineEnabled | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| baselineSampleLimit | 5000 | needs inspection | 5 source files | source reference found; behavior pending|
| continuationTicks | 3 | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| rejectionTicks | 3 | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| maximumBuckets | 5000 | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| maximumEvents | 2000 | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| staleAfterMs | 5000 | needs inspection | 5 source files | source reference found; behavior pending|
| showPane | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| paneMode | "contracts-per-second" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showBuySpeed | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showSellSpeed | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showTotalSpeed | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showDeltaSpeed | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showMarkers | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showPriceTimeBands | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| showTooltips | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showActiveLane | false | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| alertsEnabled | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| alertMinimumScore | 80 | needs inspection | 6 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| buyColor | "#22D3A7" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sellColor | "#FF3B78" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| totalColor | "#F8FAFC" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#94A3B8" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| warningColor | "#F59E0B" | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |

### Big Contracts

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| daysToLoad | 1 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| manualFilter | 30 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maximumFilter | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| rthManualFilter | 30 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| rthStandardDeviation | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| cappingMaxVolume | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| clusterWindowMs | 100 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| clusterPriceTicks | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maxMarkersPerBar | 50 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| standardDeviation | 1 | numeric registry | 16 source files | save wiring verified; chart output sign-off separate |
| minimumOpacity | 25 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| maximumOpacity | 90 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| minimumSize | 6 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| maximumSize | 32 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| labelMinSize | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| deepMinimumTradeSize | 30 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| deepBoxTickRange | 4 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| deepTickMargin | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| deepProjectionBars | 22 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| deepOpacity | 20 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| deepLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| showBigContracts | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showDeepContracts | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| filterMode | "manual" | dialog source reference | 14 source files | source reference found; behavior pending|
| automaticIntensity | "medium" | needs inspection | 1 source files | source reference found; behavior pending|
| enableClustering | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| combineByCandle | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| adaptiveTimeframeFilter | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| sessionFilterEnabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| rthFilterMode | "manual" | dialog source reference | 2 source files | source reference found; behavior pending|
| rthAutomaticIntensity | "medium" | needs inspection | 1 source files | source reference found; behavior pending|
| cappingMode | "off" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| markerType | "circle" | needs inspection | 2 source files | source reference found; behavior pending|
| hollowFill | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| informationMode | "volume" | needs inspection | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| enableAlertSound | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| showProjection | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| projectionLineWidth | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| projectionLineStyle | "dashed" | needs inspection | 2 source files | source reference found; behavior pending|
| projectionOpacity | 55 | needs inspection | 2 source files | source reference found; behavior pending|
| deepShowProjection | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| deepExtendTillCloseCross | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| bigTradesSettingsVersion | 6 | needs inspection | 0 source files | internal metadata|

### Ratio Highlight

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minRatio | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maxRatio | 20 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| opacity | 70 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| ratioMode | "bar" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#D5006D" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| askColor | "#007C7A" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### Stop Spotter

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumDeltaPercent | 25 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| minimumVolume | 1500 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumVolumeIncrease | 500 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumBodyTicks | 6 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumPriceTicksIncrease | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumHorizontalDelta | 60 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumImbalancePercent | 200 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| minimumImbalanceCount | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| secondsToClose | 15 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maximumLoss | 500 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| tickValueDivider | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| contractFontSize | 10 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| contractTickOffset | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| calculationMode | "close" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| plotPrice | "price-slope" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| contractCalculationEnabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| contractBackgroundColor | "#111827" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| contractBuyTextColor | "#22C55E" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| contractSellTextColor | "#EF4444" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| alertSoundEnabled | false | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| alertTone | "chime" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| messagePopupEnabled | false | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| messageText | "Stop Run" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| buyColor | "#6EE7B7" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sellColor | "#FCA5A5" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| markerStyle | "square" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| autoColor | "none" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| shortName | "Stop Run" | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showNameLabel | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showValueLabel | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| nameBackground | false | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| valueBackground | false | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| chartColorForMarker | false | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| includeOnAutoCenter | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### Auction Gap Tracker

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumTickVolume | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumOppositeVolume | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| includeMode | "intrabar" | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| minimumConsecutiveLevels | 3 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| plotMode | "zones" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| markerPlacement | "bar-direction" | needs inspection | 3 source files | source reference found; behavior pending|
| extendedBars | 200 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| markerSize | 6 | numeric registry | 22 source files | save wiring verified; chart output sign-off separate |
| resetMode | "none" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| filterTime | "none" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| customStartMinutes | 0 | needs inspection | 10 source files | source reference found; behavior pending|
| customEndMinutes | 0 | needs inspection | 10 source files | source reference found; behavior pending|
| retestMode | "touch" | needs inspection | 6 source files | save wiring verified; chart output sign-off separate |
| showTriggered | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| onlyTriggered | false | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| buyColor | "#22c55e" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sellColor | "#ef4444" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| buyTriggeredColor | "#22c55e" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sellTriggeredColor | "#ef4444" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertSoundEnabled | false | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| messagePopupEnabled | false | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| alertName | "Auction Gap" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| alertMessage | "Auction gap detected" | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |

### Session Imbalance

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| numberOfMinutes | 60 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| numberOfDays | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lineOpacity | 100 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| textSize | 10 | numeric registry | 11 source files | save wiring verified; chart output sign-off separate |
| useCustomStartTime | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| customStartTime | "17:00" | dialog source reference | 3 source files | source reference found; behavior pending|
| plotOnceEnded | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showHigh | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showLow | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showMid | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| level50Enabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| level100Enabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| highColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| lowColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| midColor | "#38BDF8" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| level50Color | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| level100Color | "#A78BFA" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| textAlignment | "right" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| extendMode | "next-session" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| hhllEnableAlertPopup | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| hhllEnableAlertSound | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| level50EnableAlertPopup | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| level50EnableAlertSound | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| level100EnableAlertPopup | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| level100EnableAlertSound | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| sessionImbalanceSettingsVersion | 1 | needs inspection | 1 source files | internal metadata|

### Absorption Detector

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| windowMs | 1000 | numeric registry | 11 source files | save wiring verified; chart output sign-off separate |
| rollingStepMs | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| mergeGapMs | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maximumCandidateDurationMs | 3000 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| confirmationWindowMs | 2000 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumContracts | 100 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumTradeCount | 3 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| minimumDirectionalShare | 0.7 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumPenetrationTicks | 2 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumAggressionPerTick | 50 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumDevelopingScore | 45 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumConfirmedScore | 70 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| baselineWindowSeconds | 60 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| baselineSampleLimit | 4000 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| baselineMinimumSamples | 30 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| baselineMedianMultiplier | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumResponseTicks | 2 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumPersistenceMs | 250 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumReplenishmentRatio | 0.2 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| zoneMergeWindowMs | 750 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| zoneMaximumGapTicks | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| retestMinimumDepartureTicks | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| retestTouchToleranceTicks | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| breakToleranceTicks | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumBreakVolume | 50 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumBreakTimeMs | 250 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| replenishmentWindowMs | 1000 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| replenishmentMinimumContracts | 25 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| replenishmentMinimumRatio | 0.2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| replenishmentMinimumRefreshCount | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| activeProfileWidth | 120 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| lowerPaneHeight | 160 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| markerSize | 7 | numeric registry | 22 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| historySeconds | 3600 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| maximumEvents | 2500 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| version | 1 | dialog source reference | 87 source files | internal metadata|
| preset | "balanced-level3" | dialog source reference | 38 source files | save wiring verified; chart output sign-off separate |
| useTradeStream | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useLevel3Context | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useFootprintAggregation | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| usePullingStackingContext | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| includeOwnOrders | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| includeImpliedOrders | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| preferSourceSide | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useBboFallback | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| includeUnknownTrades | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| maximumBboAgeMs | 250 | needs inspection | 2 source files | source reference found; behavior pending|
| aggregationMode | "rolling" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| finalizationGraceMs | 250 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumContractsPerSecond | 0 | needs inspection | 3 source files | source reference found; behavior pending|
| minimumTradesPerSecond | 0 | needs inspection | 2 source files | source reference found; behavior pending|
| minimumDurationMs | 50 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumLargestTrade | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumExecutedToVisible | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumRepeatCount | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| dynamicBaselineEnabled | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| baselinePercentile | 0.9 | needs inspection | 3 source files | source reference found; behavior pending|
| baselineWarmupMs | 20000 | needs inspection | 3 source files | source reference found; behavior pending|
| confirmationMode | "combined-score" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| maximumResponseTimeMs | 2000 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumDepthRetention | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| confirmationMinimumExecutedToVisible | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| sizeWeight | 0.16 | needs inspection | 1 source files | source reference found; behavior pending|
| relativeSizeWeight | 0.12 | needs inspection | 1 source files | source reference found; behavior pending|
| aggressionPerTickWeight | 0.15 | needs inspection | 1 source files | source reference found; behavior pending|
| lowProgressWeight | 0.18 | needs inspection | 1 source files | source reference found; behavior pending|
| directionalShareWeight | 0.08 | needs inspection | 1 source files | source reference found; behavior pending|
| replenishmentWeight | 0.1 | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| depthRetentionWeight | 0.05 | needs inspection | 1 source files | source reference found; behavior pending|
| executedToVisibleWeight | 0.05 | needs inspection | 1 source files | source reference found; behavior pending|
| persistenceWeight | 0.04 | dialog source reference | 4 source files | source reference found; behavior pending|
| responseWeight | 0.05 | needs inspection | 1 source files | source reference found; behavior pending|
| repeatWeight | 0.02 | needs inspection | 1 source files | source reference found; behavior pending|
| renormalizeDisabledComponents | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| zoneMergeEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| maximumZoneLevels | 8 | needs inspection | 1 source files | source reference found; behavior pending|
| zoneExtensionMode | "until-broken" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| fixedExtensionMs | 60000 | needs inspection | 1 source files | source reference found; behavior pending|
| retainBrokenZones | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| maximumActiveZones | 100 | needs inspection | 1 source files | source reference found; behavior pending|
| retestEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| retestWindowMs | 3600000 | needs inspection | 1 source files | source reference found; behavior pending|
| maximumRetests | 2 | needs inspection | 1 source files | source reference found; behavior pending|
| retestMinimumResponseTicks | 2 | needs inspection | 1 source files | source reference found; behavior pending|
| breakMode | "combined" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| minimumBreakCloses | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| keepBrokenHistory | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| replenishmentEnabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| replenishmentSamePriceRequired | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| requireReplenishmentForConfirmation | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| renderMode | "hybrid" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showHeader | true | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showDeveloping | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showConfirmed | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showRetests | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showBroken | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showExpired | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCells | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showZones | true | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| showEventMarkers | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showActiveProfile | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showLowerPane | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| activeProfileMaximumZones | 12 | needs inspection | 2 source files | source reference found; behavior pending|
| zoneBorderWidth | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| includeInChartAutoscale | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| bidDevelopingColor | "#22C55E" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| bidConfirmedColor | "#22C55E" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| askDevelopingColor | "#EF4444" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| askConfirmedColor | "#EF4444" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| retestColor | "#F59E0B" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| brokenColor | "#A1A1AA" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| replenishmentColor | "#38BDF8" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#71717A" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| showQuantity | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showScore | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showTradeCount | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showAggressionPerTick | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showReplenishment | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showRepeatCount | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showTooltips | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| enableAlerts | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| alertMinimumScore | 75 | needs inspection | 6 source files | source reference found; behavior pending|
| alertCooldownMs | 10000 | needs inspection | 3 source files | source reference found; behavior pending|
| maximumZones | 500 | needs inspection | 2 source files | source reference found; behavior pending|
| staleTradeAfterMs | 5000 | needs inspection | 1 source files | source reference found; behavior pending|
| staleLevel3AfterMs | 5000 | needs inspection | 1 source files | source reference found; behavior pending|
| postSnapshotWarmupMs | 3000 | needs inspection | 3 source files | source reference found; behavior pending|

### Stacked Imbalance Suite

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| customOffsetGroups | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| ratioThreshold | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumAbsoluteDifference | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumDominanceShare | 0.75 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumNumeratorVolume | 50 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumCombinedVolume | 75 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumStackedLevels | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maximumGapGroups | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumStackedTotalNumerator | 150 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumStackedScore | 65 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| rollingBars | 5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumDepartureGroups | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumResponseGroups | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maximumRetestsPerZone | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| markerSize | 6 | numeric registry | 22 source files | save wiring verified; chart output sign-off separate |
| activeLaneWidth | 96 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| alertMinimumScore | 65 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| version | 1 | dialog source reference | 87 source files | internal metadata|
| enabledSides | "both" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| comparisonMode | "diagonal" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| qualificationMode | "ratio" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| ratioFullScore | 6 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumDenominatorVolume | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumNumeratorTradeCount | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumCombinedTradeCount | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumZeroSideVolume | 25 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumZeroSideTradeCount | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| includeZeroSide | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| scopeMode | "bar" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| liveBarMode | "live" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| createZones | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showIndividualCells | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showStackBrackets | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| showActiveLane | true | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| showSessionProfile | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showLowerPane | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| zoneExtensionMode | "until-broken" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| zoneExtensionBars | 40 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumBreakCloses | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| askColor | "#22D3A7" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#FF3B78" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| brokenColor | "#71717A" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| enableAlerts | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| alertOnLiveQualification | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertOnClosedBar | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertOnRetest | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertOnHeld | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertOnRejected | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertOnBroken | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |

### Iceberg / Refresh Detector

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| attributionWindowMs | 250 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumCycleExecution | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumCycleReplenishment | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumCycleReplenishmentRatio | 0.5 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| activeMinimumExecuted | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| activeMinimumReplenished | 50 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumRefreshCycles | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumReplenishmentRatio | 0.5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumExecutionToDisplayRatio | 1.25 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumSuspectedCycles | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumSuspectedExecuted | 200 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumSuspectedScore | 75 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumQuality | 45 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| maximumPenetrationTicks | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumPulledContracts | 50 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumPullRatio | 0.5 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| historySeconds | 3600 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| activeProfileWidth | 140 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| markerSize | 8 | numeric registry | 22 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| alertMinimumScore | 75 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| alertMinimumQuality | 45 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| preset | "balanced" | dialog source reference | 38 source files | save wiring verified; chart output sign-off separate |
| visualizationMode | "hybrid" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| minimumWatchingExecuted | 25 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumWatchingReplenished | 10 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumSamePriceDurationMs | 100 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumSuspectedReplenishmentRatio | 0.65 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumSuspectedTurnover | 2 | needs inspection | 1 source files | source reference found; behavior pending|
| maximumCandidateDurationMs | 300000 | needs inspection | 2 source files | source reference found; behavior pending|
| excessReplenishmentTreatment | "ordinary-stack" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| moveIntoLevelTreatment | "exclude" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| requireExecutionBeforeRefresh | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| allowCancelThenRepostResearchMode | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| includeUnknownTrades | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| dynamicBaselineEnabled | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| baselineWindowMs | 120000 | needs inspection | 4 source files | source reference found; behavior pending|
| baselineSampleLimit | 4000 | needs inspection | 5 source files | source reference found; behavior pending|
| minimumBaselineSamples | 30 | needs inspection | 4 source files | source reference found; behavior pending|
| relativeExecutedMultiplier | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| relativeReplenishedMultiplier | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| executedFullScoreThreshold | 300 | needs inspection | 1 source files | source reference found; behavior pending|
| replenishedFullScoreThreshold | 300 | needs inspection | 1 source files | source reference found; behavior pending|
| replenishmentRatioFullScore | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| turnoverFullScoreRatio | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| refreshCyclesFullScore | 4 | needs inspection | 1 source files | source reference found; behavior pending|
| recoveryFullScoreRatio | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| persistenceFullScoreMs | 2000 | needs inspection | 1 source files | source reference found; behavior pending|
| pullPenaltyWeight | 0.25 | needs inspection | 1 source files | source reference found; behavior pending|
| exhaustionDetectionEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| exhaustionWindowMs | 1000 | needs inspection | 2 source files | source reference found; behavior pending|
| maximumExhaustionReplenishmentRatio | 0.2 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumExhaustionExecuted | 50 | needs inspection | 1 source files | source reference found; behavior pending|
| pulledStateEnabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| breakToleranceTicks | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| minimumBreakVolume | 50 | needs inspection | 2 source files | source reference found; behavior pending|
| minimumBreakTimeMs | 250 | needs inspection | 2 source files | source reference found; behavior pending|
| retestEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| minimumDepartureTicks | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| touchToleranceTicks | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| minimumResponseTicks | 2 | needs inspection | 2 source files | source reference found; behavior pending|
| maximumRetestsPerCandidate | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| zoneMergeEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| zoneMergeWindowMs | 1000 | needs inspection | 2 source files | source reference found; behavior pending|
| maximumZoneGapTicks | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| postSnapshotWarmupMs | 3000 | needs inspection | 3 source files | source reference found; behavior pending|
| baselineWarmupMs | 20000 | needs inspection | 3 source files | source reference found; behavior pending|
| staleAfterMs | 5000 | needs inspection | 5 source files | source reference found; behavior pending|
| maximumCandidates | 1000 | needs inspection | 1 source files | source reference found; behavior pending|
| maximumCycles | 5000 | needs inspection | 1 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showCycleCells | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showMarkers | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showZones | true | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| showActiveProfile | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| showTooltips | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showLowerPane | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#22D3A7" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| askColor | "#FF3B78" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| nativeColor | "#A78BFA" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| exhaustedColor | "#F59E0B" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| pulledColor | "#FB7185" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| brokenColor | "#71717A" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| alertsEnabled | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| alertOnRefresh | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertOnSuspected | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertOnExhausted | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertOnPulled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| alertOnBroken | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |

### Liquidity Sweep / Stop Sweep Detector

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| maximumInterTradeGapMs | 75 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumSweepDurationMs | 1000 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maximumBacktrackTicks | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maximumInterTradeJumpTicks | 4 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumSweepContracts | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumSweepTradeCount | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumSweptLevels | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumSweepRangeTicks | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumContractsPerSecond | 100 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumContiguousCoverageRatio | 0.75 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumDirectionalProgressRatio | 0.6 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumReferenceBreachTicks | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maximumReferenceDistanceTicks | 20 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumContinuationTicks | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumRejectionTicks | 3 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| historySeconds | 3600 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| activeLaneWidth | 142 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| minimumLaneScore | 60 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| markerSize | 8 | numeric registry | 22 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| alertMinimumScore | 75 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| alertMinimumQuality | 60 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| preset | "balanced-futures" | dialog source reference | 38 source files | save wiring verified; chart output sign-off separate |
| maximumOpposingQuantityInsideCandidate | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumDirectionalAggressorShare | 0.85 | needs inspection | 1 source files | source reference found; behavior pending|
| singleLevelBurstEnabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| maximumBurstLevels | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumBurstContracts | 250 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumBurstTradeCount | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumBurstContractsPerSecond | 250 | needs inspection | 1 source files | source reference found; behavior pending|
| includeUnknownTrades | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| maximumBboAgeMs | 250 | needs inspection | 2 source files | source reference found; behavior pending|
| dynamicBaselineEnabled | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| baselineWindowMs | 120000 | needs inspection | 4 source files | source reference found; behavior pending|
| baselineSampleLimit | 5000 | needs inspection | 5 source files | source reference found; behavior pending|
| minimumBaselineSamples | 30 | needs inspection | 4 source files | source reference found; behavior pending|
| relativeQuantityMultiplier | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| relativeVelocityMultiplier | 2 | needs inspection | 1 source files | source reference found; behavior pending|
| selectedPercentile | 0.9 | needs inspection | 3 source files | source reference found; behavior pending|
| stopSweepInferenceEnabled | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| startSideToleranceTicks | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumStopSweepContracts | 100 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumStopSweepLevels | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumStopSweepVelocity | 100 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumStopSweepScore | 60 | needs inspection | 1 source files | source reference found; behavior pending|
| maximumMatchedReferences | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumAcceptanceTimeMs | 500 | needs inspection | 2 source files | source reference found; behavior pending|
| continuationWindowMs | 5000 | needs inspection | 2 source files | source reference found; behavior pending|
| rejectionWindowMs | 5000 | needs inspection | 1 source files | source reference found; behavior pending|
| exhaustionDetectionEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| exhaustionWindowMs | 2000 | needs inspection | 2 source files | source reference found; behavior pending|
| maximumPostSweepExtensionTicks | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| bookContextEnabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| bookContextLookbackMs | 500 | needs inspection | 1 source files | source reference found; behavior pending|
| bookContextLookaheadMs | 100 | needs inspection | 1 source files | source reference found; behavior pending|
| staleAfterMs | 5000 | needs inspection | 5 source files | source reference found; behavior pending|
| maximumConfirmedSweeps | 2500 | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| visualizationMode | "hybrid" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showHeader | true | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showRangeBrackets | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showPriceTimeBands | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showStopSweepZones | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showMarkers | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| showTooltips | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showActiveLane | true | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| maximumActiveLaneRows | 12 | needs inspection | 4 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| buyColor | "#22D3A7" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sellColor | "#FF3B78" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| warningColor | "#F59E0B" | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| rejectionColor | "#FB7185" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| alertsEnabled | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |

### POC & Auction Suite

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| customGroupSizeTicks | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| automaticTargetRows | 80 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| percentageOfMaximum | 0.95 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| topNContiguousGroups | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumPocVolume | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumPocTradeCount | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| rollingBars | 20 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumMigrationTicks | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| touchToleranceTicks | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumAcceptanceVolume | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumRejectionTicks | 4 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| excessLookbackTicks | 4 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumTaperSteps | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maximumTaperRatio | 0.75 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumExcessScore | 35 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| activeLaneWidth | 150 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| maximumActiveLaneRows | 14 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| markerSize | 7 | numeric registry | 22 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1.5 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| historyBars | 1500 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| preset | "balanced-auction" | dialog source reference | 38 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "follow-footprint" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| auctionExtremeSource | "raw-exchange-tick" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| allowGroupedExtremeApproximation | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| metric | "total-volume" | dialog source reference | 44 source files | save wiring verified; chart output sign-off separate |
| tieBreakMode | "follow-shared-profile-engine" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| pocBandMode | "single-price-group" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| customBandTicks | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| showBarPoc | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showSessionPoc | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showPriorSessionPoc | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showRollingPoc | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showAnchoredPoc | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCompositePoc | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| rollingMode | "bars" | needs inspection | 1 source files | source reference found; behavior pending|
| rollingDurationMs | 3600000 | needs inspection | 1 source files | source reference found; behavior pending|
| anchorStartMs | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| anchorEndMs | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| anchorFollowLive | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| compositeStartMs | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| compositeEndMs | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumNewPocDwellMs | 250 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumMetricLead | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumMetricLeadPercent | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| nakedPocEnabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| minimumTouchVolume | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumAcceptanceTimeMs | 2000 | needs inspection | 2 source files | source reference found; behavior pending|
| responseWindowMs | 10000 | needs inspection | 1 source files | source reference found; behavior pending|
| showFinishedHigh | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showFinishedLow | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showUnfinishedHigh | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showUnfinishedLow | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showZeroSide | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| developingAuctionVisuals | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| maximumOppositeExtremeVolume | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumAggressiveExtremeVolume | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumAggressiveExtremeTradeCount | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| maximumUnknownExtremeVolume | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumOppositeUnfinishedVolume | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumAggressiveUnfinishedVolume | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumOppositeUnfinishedTrades | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumAggressiveUnfinishedTrades | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumTotalExtremeVolume | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| excessEnabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| requireFinishedExtremeForExcess | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| maximumExtremeVolumeRelativeToLocalMedian | 0.5 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumInteriorReferenceVolume | 10 | needs inspection | 1 source files | source reference found; behavior pending|
| auctionTouchToleranceTicks | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| auctionResolutionMode | "first-touch" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| minimumTradeThroughTicks | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumResolutionVolume | 25 | needs inspection | 1 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showBarPocMarkers | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showDynamicPocLine | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showExtendedLevels | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showAuctionMarkers | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showActiveLane | true | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| showLowerPane | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| barPocColor | "#22D3EE" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| sessionPocColor | "#A3E635" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| nakedPocColor | "#F59E0B" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| finishedColor | "#A1A1AA" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| unfinishedColor | "#F59E0B" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| excessHighColor | "#FB7185" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| excessLowColor | "#22D3A7" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#71717A" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| showTooltips | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| alertsEnabled | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| alertOnMigration | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertOnNewNakedPoc | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertOnAuctionClose | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| maximumActivePocs | 250 | needs inspection | 1 source files | source reference found; behavior pending|
| maximumAuctionLevels | 500 | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |

### Cumulative Iceberg/Stop

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| filterMin | 1 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| filterMax | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| displayParameter | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| alertStopThreshold | 100 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| alertIcebergThreshold | 100 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| paneHeight | 190 | numeric registry | 11 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| displayMode | "sum" | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| useSeparateAxes | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showIceberg | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showStop | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| icebergAskColor | "#EF4444" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| icebergBidColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| stopBidColor | "#38BDF8" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| stopAskColor | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| alertStopEnabled | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| alertStopShowMessage | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| alertIcebergEnabled | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| alertIcebergShowMessage | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |

### Book Speed

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| bidColor | "#22C55E" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| askColor | "#A855F7" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| averageBidColor | "#4ADE80" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| averageAskColor | "#F87171" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| markerBidColor | "#86EFAC" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| markerAskColor | "#FCA5A5" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| parameterValue | 10 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| averageLength | 10 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| markerValue | 10 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| historyBuckets | 360 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| paneHeight | 190 | numeric registry | 11 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| parameterMode | "seconds" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showAverage | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showMarker | false | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### DOM Pro

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| width | 640 | numeric registry | 256 source files | save wiring verified; chart output sign-off separate |
| rows | 120 | numeric registry | 218 source files | save wiring verified; chart output sign-off separate |
| rowHeight | 24 | numeric registry | 24 source files | save wiring verified; chart output sign-off separate |
| refreshRateMs | 32 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| recentWindowMs | 8000 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| depthScaleCap | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| highlightThreshold | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| fontSize | 9 | numeric registry | 87 source files | save wiring verified; chart output sign-off separate |
| showCumulative | false | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| showOrderCount | false | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| showPullStack | true | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| showRecentTrades | true | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| showDepthHistogram | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showHeaderStats | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showImbalance | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| autoCenter | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| compactNumbers | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#22C55E" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| askColor | "#EF4444" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| lastTradeColor | "#FDE047" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| domPreset | "order-flow" | needs inspection | 2 source files | internal metadata|
| domColumns | "[{\"id\":\"buy\",\"width\":100,\"enabled\":true},{\"id\":\"sell\",\"width\":100,\"enabled\":true},{\"id\":\"bid\",\"width\":100,\"enabled\":true},{\"id\":\"price\",\"width\":100,\"enabled\":true},{\"id\":\"ask\",\"width\":100,\"enabled\":true},{\"id\":\"trades\",\"width\":100,\"enabled\":true},{\"id\":\"orders\",\"width\":82,\"enabled\":false},{\"id\":\"cob\",\"width\":82,\"enabled\":false},{\"id\":\"pullStack\",\"width\":82,\"enabled\":false}]" | needs inspection | 2 source files | save wiring verified; chart output sign-off separate |
| domSettingsVersion | 5 | needs inspection | 1 source files | internal metadata|

### Mini DOM

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| widthPx | 95 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| rightGapPx | 2 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| levelSpacingPx | 10 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| barOpacity | 100 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| backgroundOpacity | 0 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| fontSize | 8 | numeric registry | 87 source files | save wiring verified; chart output sign-off separate |
| showBids | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showAsks | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| alignLeft | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showSizes | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| buyColor | "#14B8B0" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sellColor | "#B4174B" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |

### Footprint

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| barWidth | 92 | numeric registry | 14 source files | save wiring verified; chart output sign-off separate |
| candleSpacing | 6 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | numeric registry | 13 source files | save wiring verified; chart output sign-off separate |
| manualTicks | 1 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| minimumTradeVolume | 0 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| maximumTradeVolume | 0 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| minimumImbalancePercent | 300 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| minimumDominantVolume | 10 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| minimumDelta | 0 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| stackedImbalanceLevels | 3 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| unfinishedAuctionMinimumVolume | 1 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 0.7 | numeric registry | 30 source files | save wiring verified; chart output sign-off separate |
| backgroundOpacity | 72 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| minimumOpacity | 8 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| maximumOpacity | 72 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| gradientExponent | 0.72 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| visibleRegionPercentile | 0.95 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| fixedMaximum | 0 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | numeric registry | 20 source files | save wiring verified; chart output sign-off separate |
| fontSize | 11 | numeric registry | 87 source files | save wiring verified; chart output sign-off separate |
| fontWeight | 500 | numeric registry | 28 source files | save wiring verified; chart output sign-off separate |
| minimumWidthToShowText | 32 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| minimumRowHeightToShowText | 9 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| dynamicTextIncrease | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintMaximum | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumRatio | 1.5 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| maximumRatio | 100 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| clusterMinimumVolume | 100 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumRetainedBars | 5000 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumDetailedVisibleBars | 180 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| footprintSettingsVersion | 8 | needs inspection | 1 source files | internal metadata|
| chartType | "bid-ask" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| chartVariant | "bid-ask" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| contentMode | "bid-ask" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| visualizationMode | "heatmap-histogram" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| scaleMode | "visible-region" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| numberFormat | "automatic" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| inputType | "volume" | needs inspection | 11 source files | save wiring verified; chart output sign-off separate |
| colorMode | "fading" | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| colorCalculation | "imbalance" | needs inspection | 4 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "manual" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| groupMode | "fixed" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showPerBarVolumeProfile | false | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showPerBarDeltaProfile | false | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| perBarProfileScaleMode | "independent" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| perBarProfileTicksPerRow | 1 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| perBarProfileWidthPercent | 92 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| perBarProfileGap | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| perBarProfileExtraSpacing | 18 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| perBarProfileOpacity | 58 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showPerBarProfilePoc | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| perBarProfilePocSize | 5 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| perBarProfileOutline | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| perBarVolumeColor | "#B7FF38" | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarPositiveDeltaColor | "#B7FF38" | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarNegativeDeltaColor | "#F06A70" | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarProfilePocColor | "#E4BF5A" | dialog source reference | 3 source files | source reference found; behavior pending|
| showCellText | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| imbalanceMode | "diagonal" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| includeZero | false | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showStackedImbalances | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| unfinishedAuctionEnabled | false | generated control candidate | 5 source files | save wiring verified; chart output sign-off separate |
| showImbalances | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showWick | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showBodyOutline | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showBodyFill | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showEmptyPriceRows | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showSummary | true | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showCentreDivider | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showVolumePoc | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showDeltaPoc | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showValueArea | true | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| showVah | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showVal | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showSinglePrints | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| singlePrintExtremesOnly | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showRatio | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showVolumeClusters | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showBarDelta | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showZeros | false | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| colorOnlyDominantSide | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| dynamicTextSize | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showMaxBid | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showMaxAsk | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showMaxPositiveDelta | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showMaxNegativeDelta | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showMaxTrades | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showBetweenVolume | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showVwap | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| outsideBarStyle | "bar" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| markerAlignment | "center" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| outerEdgeMode | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| betweenColor | "#A1A1AA" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#3F3F46" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| textColor | "#F5F5F5" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#FDE047" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#647BA8" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| deltaPocColor | "#60A5FA" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| clusterColor | "#F59E0B" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintColor | "#F4F4F5" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| stackedAskColor | "#B7FF38" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| stackedBidColor | "#F06A70" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| unfinishedAuctionColor | "#E4BF5A" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#22D3EE" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| fpsLimit | 60 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| type | "ask-bid" | dialog source reference | 951 source files | source reference found; behavior pending|
| mode | "profile" | dialog source reference | 197 source files | source reference found; behavior pending|
| stableFootprintRows | true | dialog source reference | 0 source files | internal metadata|
| textFormat | "automatic" | needs inspection | 3 source files | source reference found; behavior pending|

### KWANT Delta

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| positiveColor | "#C8FFC8" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#F2D3FF" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| range1AskColor | "#C8FFC8" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range1BidColor | "#F2D3FF" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range2AskColor | "#77F277" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range2BidColor | "#C26DE0" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range3AskColor | "#39C96A" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range3BidColor | "#8B3EC1" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range4AskColor | "#00FF68" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range4BidColor | "#6D18A8" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| maximumPositiveColor | "#00FF68" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| minimumNegativeColor | "#7416B5" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| level1Color | "#FFD600" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| level2Color | "#FFD600" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| markerColor | "#16106F" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| barGrouping | 4 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| range1Minimum | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| range1Maximum | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| range2Minimum | 11 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| range2Maximum | 20 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| range3Minimum | 21 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| range3Maximum | 30 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| range4Minimum | 31 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| range4Maximum | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| level1Value | 1000 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| level1LineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| level2Value | 1500 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| level2LineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| markerMinimumDelta | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| deltaMode | "multi-range" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| range1Enabled | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range2Enabled | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range3Enabled | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range4Enabled | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| level1Enabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| level1LineStyle | "dashed" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| level2Enabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| level2LineStyle | "dashed" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| markerEnabled | false | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|

### KWANT Wall

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumTickBreakout | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumDeltaPercent | 70 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| minimumPerBarVolume | 20 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumClusterVolume | 300 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| tickGrouping | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| highestLowestMinimumBars | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| highestLowestNearnessBars | 50 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| markerWidthBars | 1.6 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| opacity | 92 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| plotPrice | "price-slope" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| alertSoundEnabled | false | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| alertTone | "chime" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| messagePopupEnabled | false | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| messageText | "KWANT Wall" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| buyWallColor | "#22C55E" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| sellWallColor | "#EF4444" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### KWANT V-Tracker

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| accelerationColor | "#22D3EE" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| exhaustionColor | "#F59E0B" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| slowdownColor | "#A78BFA" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#A855F7" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| controlLineWidth | 2 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| extremeLineWidth | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| textSize | 10 | numeric registry | 11 source files | save wiring verified; chart output sign-off separate |
| projectionBars | 20 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| patternOpacity | 32 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| accelerationEnabled | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| accelerationMode | "strong" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| exhaustionEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| exhaustionMode | "medium" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| slowdownEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| slowdownMode | "medium" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| absorptionPressureEnabled | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| absorptionIntensity | "medium" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| levelMode | "medium" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| extendFarRight | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| alertSoundEnabled | false | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| alertTone | "chime" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| messagePopupEnabled | false | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| messageText | "KWANT V-Tracker" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

## Volume & Profiles

### Volume

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#8A8F98" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| minimumTotalVolume | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| backgroundMode | "dominant" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| deltaInputData | "volume" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### Daily Volume Profile

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| groupTicks | 4 | numeric registry | 26 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | numeric registry | 13 source files | save wiring verified; chart output sign-off separate |
| profileWidth | 2 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| minTradeVolume | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| maxTradeVolume | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 68 | dialog source reference | 30 source files | save wiring verified; chart output sign-off separate |
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| pocLineWidth | 1 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| shiftedPocTicks | 4 | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineMode | "show" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showPeaks | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValleys | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| pvSensitivity | 40 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| pvExcludeHighLow | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showBusinessZone | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneOpacity | 3 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showVwapLine | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapHighlight | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showDevelopingVwap | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showVwapBands | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapLineWidth | 1 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand1 | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand2 | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand3 | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSummaryVolume | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showSummaryTrades | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLevelLabels | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| levelLabelSide | "right" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showLevelLabelPrice | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| visualStyle | "automatic" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| widthMode | "period-percent" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| numberOfProfiles | 0 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| previousProfileWidth | 2 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| currentProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| previousProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| profileMode | "volume" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "manual" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| gradientPreset | "off" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionTokyoEnabled | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionLondonEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| snapMode | "left" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showText | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showValueArea | true | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| showPocLine | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValueAreaLines | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| recentLevelsOnly | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showDelta | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showProfileSpine | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showDevelopingPoc | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showPocHighlight | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showProfileOutline | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showSummary | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#22C55E" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| peakColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valleyColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |

### TPO Daily

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lengthValue | 1 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| subperiodMinutes | 30 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| profileCount | 10 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| ticksPerRow | 1 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| autoTargetRows | 90 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | numeric registry | 13 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 70 | numeric registry | 30 source files | save wiring verified; chart output sign-off separate |
| initialBalanceSubperiods | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| initialBalanceStartSubperiod | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| initialBalanceLineWidth | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumSinglePrintTicks | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintMaxTpoCount | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintStepDown | 3 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintQuality | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintVolumeSensitivity | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| blockSize | 8 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| blockGap | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| opacityPercent | 100 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 0.75 | numeric registry | 20 source files | save wiring verified; chart output sign-off separate |
| barMarkerWidth | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| range1Minimum | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| range2Minimum | 25 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| range3Minimum | 50 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| range4Minimum | 75 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineWidth | 1.5 | numeric registry | 10 source files | save wiring verified; chart output sign-off separate |
| developingPocStartOffset | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| shiftedPocTicks | 1 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| pocGroupingOpacity | 20 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaBackgroundOpacity | 10 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineWidth | 1 | numeric registry | 10 source files | save wiring verified; chart output sign-off separate |
| singlePrintLineWidth | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintFillOpacity | 60 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| summaryBackgroundOpacity | 82 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| summaryFontSize | 8 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| currentWidth | 100 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| currentOffset | 0 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| previousWidth | 80 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| previousOffset | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| peakValleyRadius | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| peakMinimumProminence | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumMergeMembers | 30 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumRenderedBlocks | 50000 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| fpsCap | 60 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 2 | needs inspection | 67 source files | internal metadata|
| indicatorVariant | "daily-tpo" | needs inspection | 3 source files | source reference found; behavior pending|
| scheduleKind | "daily" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| periodMode | "multiple-profiles" | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| lengthUnit | "day" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| timezone | "America/Chicago" | dialog source reference | 44 source files | save wiring verified; chart output sign-off separate |
| quickSessions | "" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| dailyStartTime | "17:00:00" | dialog source reference | 5 source files | source reference found; behavior pending|
| dailyEndMode | "next-daily-start" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| dailyEndTime | "16:00:00" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| enabledWeekdays | "0,1,2,3,4" | dialog source reference | 5 source files | source reference found; behavior pending|
| weekStartDay | 0 | dialog source reference | 4 source files | source reference found; behavior pending|
| weekStartTime | "17:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| weekEndMode | "next-week-start" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| weekEndDay | 5 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| weekEndTime | "16:00:00" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| weekLength | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| customStartMs | 0 | dialog source reference | 8 source files | source reference found; behavior pending|
| customEndMs | 0 | dialog source reference | 8 source files | source reference found; behavior pending|
| customEndFollowsLatest | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| tpoType | "blocks" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showText | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| visualStyle | "solid" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| displayType | "blocks" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| splitMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| visitSource | "automatic" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "automatic" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| freezeActiveGrouping | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showPoc | true | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| showDevelopingPoc | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValueArea | true | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| showDevelopingValueArea | false | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showInitialBalance | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSinglePrints | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| includeExtremesInSinglePrints | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showPeaks | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValleys | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| peakValleySensitivity | 40 | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| peakValleyExcludeExtremes | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSummary | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| widthMode | "automatic" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showOnRight | false | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| mirror | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| lockPosition | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showAboveBars | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| minimumTextSize | 7 | dialog source reference | 2 source files | source reference found; behavior pending|
| maximumTextSize | 11 | dialog source reference | 3 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| colourCalculation | "time" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| colourReference | "fixed" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| fixedVolumeColor | "#22D3EE" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| fixedBidColor | "#FB7185" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| fixedAskColor | "#22D3EE" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range1Enabled | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range1VolumeColor | "#64748B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| range1BidColor | "#FB7185" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range1AskColor | "#22D3EE" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range2Enabled | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range2VolumeColor | "#38BDF8" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| range2BidColor | "#F43F5E" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range2AskColor | "#06B6D4" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range3Enabled | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range3VolumeColor | "#8B5CF6" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| range3BidColor | "#E11D48" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range3AskColor | "#0891B2" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range4Enabled | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range4VolumeColor | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| range4BidColor | "#BE123C" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range4AskColor | "#0E7490" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialAColorEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialAColor | "#F59E0B" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialBColorEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialBColor | "#A855F7" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialCColorEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialCColor | "#3B82F6" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialDColorEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialDColor | "#14B8A6" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| colorOpenEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| openColor | "#22C55E" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| colorCloseEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| closeColor | "#F43F5E" | dialog source reference | 4 source files | source reference found; behavior pending|
| barMarkerEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| barMarkerStyle | "candle" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| barMarkerUpColor | "#22D3EE" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| barMarkerDownColor | "#FB7185" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| barMarkerShowOpenClose | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineMode | "final" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| pocHighlight | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocHighlightColor | "#F5B83B" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineColor | "#F5B83B" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocExtensionMode | "none" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showPocPriceLabel | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaHighlight | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaHighlightInside | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaOutsideColor | "#475569" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaShowLines | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| recentLevelsOnly | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaShowBackground | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaExtensionMode | "none" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineColor | "#60A5FA" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| valueAreaShowLabels | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintExtensionMode | "to-next-profile" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintFillZone | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintShowLabel | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintShowTestedState | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| initialBalanceShowHigh | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialBalanceShowLow | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialBalanceShowRangeLabel | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| initialBalanceShowExtensions | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialBalanceExtensionMultiples | "1,1.5,2" | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBalanceLineColor | "#94A3B8" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| summaryLayout | "compact" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| summaryLocation | "top-left" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| summaryShowVolume | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| summaryShowTrades | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| summaryShowBidAsk | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#F5F7FA" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| summaryBackgroundColor | "#090B10" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | save wiring verified; chart output sign-off separate |
| sessionPreset | "eth" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| customSessionStart | "17:00:00" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| customSessionEnd | "16:00:00" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| inheritThemeColours | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| profileColor | "#22D3EE" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#F5B83B" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#60A5FA" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| singlePrintColor | "#FB7185" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| peakColor | "#A3E635" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valleyColor | "#8B5CF6" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| allowDevelopingComposite | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |

### TPO Weekly

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lengthValue | 1 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| subperiodMinutes | 30 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| profileCount | 8 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| ticksPerRow | 1 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| autoTargetRows | 90 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | numeric registry | 13 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 70 | numeric registry | 30 source files | save wiring verified; chart output sign-off separate |
| initialBalanceSubperiods | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| initialBalanceStartSubperiod | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| initialBalanceLineWidth | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| minimumSinglePrintTicks | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintMaxTpoCount | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintStepDown | 3 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintQuality | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintVolumeSensitivity | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| blockSize | 8 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| blockGap | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| opacityPercent | 100 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 0.75 | numeric registry | 20 source files | save wiring verified; chart output sign-off separate |
| barMarkerWidth | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| range1Minimum | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| range2Minimum | 25 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| range3Minimum | 50 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| range4Minimum | 75 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineWidth | 1.5 | numeric registry | 10 source files | save wiring verified; chart output sign-off separate |
| developingPocStartOffset | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| shiftedPocTicks | 1 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| pocGroupingOpacity | 20 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaBackgroundOpacity | 10 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineWidth | 1 | numeric registry | 10 source files | save wiring verified; chart output sign-off separate |
| singlePrintLineWidth | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintFillOpacity | 60 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| summaryBackgroundOpacity | 82 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| summaryFontSize | 8 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| currentWidth | 100 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| currentOffset | 0 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| previousWidth | 80 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| previousOffset | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| peakValleyRadius | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| peakMinimumProminence | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumMergeMembers | 30 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| maximumRenderedBlocks | 50000 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| fpsCap | 60 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 2 | needs inspection | 67 source files | internal metadata|
| indicatorVariant | "weekly-tpo" | needs inspection | 3 source files | source reference found; behavior pending|
| scheduleKind | "weekly" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| periodMode | "multiple-profiles" | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| lengthUnit | "week" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| timezone | "America/Chicago" | dialog source reference | 44 source files | source reference found; behavior pending|
| quickSessions | "" | dialog source reference | 5 source files | source reference found; behavior pending|
| dailyStartTime | "17:00:00" | dialog source reference | 5 source files | source reference found; behavior pending|
| dailyEndMode | "next-daily-start" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| dailyEndTime | "16:00:00" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| enabledWeekdays | "0,1,2,3,4" | dialog source reference | 5 source files | source reference found; behavior pending|
| weekStartDay | 0 | dialog source reference | 4 source files | source reference found; behavior pending|
| weekStartTime | "17:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| weekEndMode | "next-week-start" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| weekEndDay | 5 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| weekEndTime | "16:00:00" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| weekLength | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| customStartMs | 0 | dialog source reference | 8 source files | source reference found; behavior pending|
| customEndMs | 0 | dialog source reference | 8 source files | source reference found; behavior pending|
| customEndFollowsLatest | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| tpoType | "blocks" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showText | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| visualStyle | "solid" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| displayType | "blocks" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| splitMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| visitSource | "automatic" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "automatic" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| freezeActiveGrouping | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showPoc | true | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| showDevelopingPoc | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValueArea | true | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| showDevelopingValueArea | false | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showInitialBalance | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSinglePrints | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| includeExtremesInSinglePrints | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showPeaks | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValleys | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| peakValleySensitivity | 40 | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| peakValleyExcludeExtremes | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSummary | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| widthMode | "automatic" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showOnRight | false | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| mirror | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| lockPosition | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showAboveBars | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| minimumTextSize | 7 | dialog source reference | 2 source files | source reference found; behavior pending|
| maximumTextSize | 11 | dialog source reference | 3 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| colourCalculation | "time" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| colourReference | "fixed" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| fixedVolumeColor | "#22D3EE" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| fixedBidColor | "#FB7185" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| fixedAskColor | "#22D3EE" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range1Enabled | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range1VolumeColor | "#64748B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| range1BidColor | "#FB7185" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range1AskColor | "#22D3EE" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range2Enabled | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range2VolumeColor | "#38BDF8" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| range2BidColor | "#F43F5E" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range2AskColor | "#06B6D4" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range3Enabled | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range3VolumeColor | "#8B5CF6" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| range3BidColor | "#E11D48" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range3AskColor | "#0891B2" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range4Enabled | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range4VolumeColor | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| range4BidColor | "#BE123C" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| range4AskColor | "#0E7490" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialAColorEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialAColor | "#F59E0B" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialBColorEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialBColor | "#A855F7" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialCColorEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialCColor | "#3B82F6" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialDColorEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialDColor | "#14B8A6" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| colorOpenEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| openColor | "#22C55E" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| colorCloseEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| closeColor | "#F43F5E" | dialog source reference | 4 source files | source reference found; behavior pending|
| barMarkerEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| barMarkerStyle | "candle" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| barMarkerUpColor | "#22D3EE" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| barMarkerDownColor | "#FB7185" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| barMarkerShowOpenClose | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineMode | "final" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| pocHighlight | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocHighlightColor | "#F5B83B" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineColor | "#F5B83B" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocExtensionMode | "none" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showPocPriceLabel | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaHighlight | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaHighlightInside | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaOutsideColor | "#475569" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaShowLines | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| recentLevelsOnly | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaShowBackground | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valueAreaExtensionMode | "none" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineColor | "#60A5FA" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| valueAreaShowLabels | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintExtensionMode | "to-next-profile" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintFillZone | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintShowLabel | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintShowTestedState | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| initialBalanceShowHigh | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialBalanceShowLow | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialBalanceShowRangeLabel | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| initialBalanceShowExtensions | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| initialBalanceExtensionMultiples | "1,1.5,2" | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBalanceLineColor | "#94A3B8" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| summaryLayout | "compact" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| summaryLocation | "top-left" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| summaryShowVolume | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| summaryShowTrades | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| summaryShowBidAsk | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#F5F7FA" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| summaryBackgroundColor | "#090B10" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | save wiring verified; chart output sign-off separate |
| sessionPreset | "eth" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| customSessionStart | "17:00:00" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| customSessionEnd | "16:00:00" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| inheritThemeColours | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| profileColor | "#22D3EE" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#F5B83B" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#60A5FA" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| singlePrintColor | "#FB7185" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| peakColor | "#A3E635" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valleyColor | "#8B5CF6" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| allowDevelopingComposite | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |

### Weekly Volume Profile

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| groupTicks | 4 | numeric registry | 26 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | numeric registry | 13 source files | save wiring verified; chart output sign-off separate |
| profileWidth | 2 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| minTradeVolume | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| maxTradeVolume | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| weekSelection | "rolling-five" | dialog source reference | 1 source files | source reference found; behavior pending|
| weeklyWindowSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|
| valueAreaPercent | 68 | dialog source reference | 30 source files | save wiring verified; chart output sign-off separate |
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| pocLineWidth | 1 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| shiftedPocTicks | 4 | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineMode | "show" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showPeaks | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValleys | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| pvSensitivity | 40 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| pvExcludeHighLow | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showBusinessZone | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneOpacity | 3 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showVwapLine | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapHighlight | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showDevelopingVwap | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showVwapBands | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapLineWidth | 1 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand1 | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand2 | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand3 | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSummaryVolume | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showSummaryTrades | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLevelLabels | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| levelLabelSide | "right" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showLevelLabelPrice | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| visualStyle | "automatic" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| widthMode | "period-percent" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| numberOfProfiles | 0 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| previousProfileWidth | 2 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| currentProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| previousProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| profileMode | "volume" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "manual" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| gradientPreset | "off" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionTokyoEnabled | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionLondonEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| snapMode | "left" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showText | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showValueArea | true | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| showPocLine | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValueAreaLines | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| recentLevelsOnly | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showDelta | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showProfileSpine | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showDevelopingPoc | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showPocHighlight | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showProfileOutline | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showSummary | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#22C55E" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| peakColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valleyColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |

### Monthly Volume Profile

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| profileWidth | 2 | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | dialog source reference | 165 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 68 | dialog source reference | 30 source files | save wiring verified; chart output sign-off separate |
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| minTradeVolume | 0 | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| maxTradeVolume | 0 | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | dialog source reference | 13 source files | source reference found; behavior pending|
| groupTicks | 4 | dialog source reference | 26 source files | save wiring verified; chart output sign-off separate |
| pocLineWidth | 1 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| shiftedPocTicks | 4 | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineMode | "show" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showPeaks | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValleys | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| pvSensitivity | 40 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| pvExcludeHighLow | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showBusinessZone | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneOpacity | 3 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showVwapLine | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapHighlight | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showDevelopingVwap | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showVwapBands | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapLineWidth | 1 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand1 | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand2 | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand3 | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSummaryVolume | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showSummaryTrades | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLevelLabels | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| levelLabelSide | "right" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showLevelLabelPrice | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| visualStyle | "automatic" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| widthMode | "period-percent" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| numberOfProfiles | 3 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| previousProfileWidth | 2 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| currentProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| previousProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| profileMode | "volume" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "manual" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| gradientPreset | "off" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionTokyoEnabled | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionLondonEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| snapMode | "left" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showText | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showValueArea | true | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| showPocLine | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValueAreaLines | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| recentLevelsOnly | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showDelta | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showProfileSpine | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showDevelopingPoc | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showPocHighlight | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showProfileOutline | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showSummary | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#22C55E" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| peakColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valleyColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |

### Session Volume Profile

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| profileWidth | 2 | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | dialog source reference | 165 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 68 | dialog source reference | 30 source files | save wiring verified; chart output sign-off separate |
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| minTradeVolume | 0 | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| maxTradeVolume | 0 | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | dialog source reference | 13 source files | source reference found; behavior pending|
| groupTicks | 4 | dialog source reference | 26 source files | save wiring verified; chart output sign-off separate |
| pocLineWidth | 1 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| shiftedPocTicks | 4 | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineMode | "show" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showPeaks | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValleys | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| pvSensitivity | 40 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| pvExcludeHighLow | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showBusinessZone | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneOpacity | 3 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showVwapLine | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapHighlight | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showDevelopingVwap | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showVwapBands | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapLineWidth | 1 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand1 | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand2 | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand3 | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSummaryVolume | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showSummaryTrades | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filterMode | "filter" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLevelLabels | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| levelLabelSide | "right" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showLevelLabelPrice | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| visualStyle | "automatic" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| widthMode | "period-percent" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| numberOfProfiles | 5 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| previousProfileWidth | 2 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| currentProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| previousProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| profileMode | "volume" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "manual" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| gradientPreset | "off" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionTokyoEnabled | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionLondonEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| snapMode | "left" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showText | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showValueArea | true | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| showPocLine | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValueAreaLines | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| recentLevelsOnly | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showDelta | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showProfileSpine | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showDevelopingPoc | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showPocHighlight | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showProfileOutline | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showSummary | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#22C55E" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| peakColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valleyColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |

### Composite Volume Profile

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| compositeLengthValue | 500 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| groupTicks | 4 | numeric registry | 26 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | numeric registry | 13 source files | save wiring verified; chart output sign-off separate |
| profileWidth | 2 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| minTradeVolume | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| maxTradeVolume | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 68 | dialog source reference | 30 source files | save wiring verified; chart output sign-off separate |
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| pocLineWidth | 1 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| shiftedPocTicks | 4 | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineMode | "show" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showPeaks | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValleys | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| pvSensitivity | 40 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| pvExcludeHighLow | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showBusinessZone | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneOpacity | 3 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showVwapLine | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapHighlight | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showDevelopingVwap | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showVwapBands | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapLineWidth | 1 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand1 | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand2 | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand3 | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSummaryVolume | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showSummaryTrades | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLevelLabels | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| levelLabelSide | "right" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showLevelLabelPrice | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| visualStyle | "automatic" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| widthMode | "period-percent" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| numberOfProfiles | 0 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| previousProfileWidth | 2 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| currentProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| previousProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| profileMode | "volume" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "manual" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| gradientPreset | "off" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionTokyoEnabled | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionLondonEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| snapMode | "right" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showText | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showValueArea | true | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| showPocLine | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValueAreaLines | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| recentLevelsOnly | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showDelta | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showProfileSpine | false | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showDevelopingPoc | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showPocHighlight | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showProfileOutline | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showSummary | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#22C55E" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| peakColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valleyColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| compositeRangeMode | "loaded-range" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| compositeCustomStartMs | "" | dialog source reference | 1 source files | source reference found; behavior pending|
| compositeCustomEndMs | "" | dialog source reference | 1 source files | source reference found; behavior pending|
| compositeCustomEndFollowsLatest | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |

### Visible Range Volume Profile

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| profileWidth | 2 | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | dialog source reference | 165 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 68 | dialog source reference | 30 source files | save wiring verified; chart output sign-off separate |
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| minTradeVolume | 0 | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| maxTradeVolume | 0 | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | dialog source reference | 13 source files | source reference found; behavior pending|
| groupTicks | 4 | dialog source reference | 26 source files | save wiring verified; chart output sign-off separate |
| pocLineWidth | 1 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| shiftedPocTicks | 4 | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineMode | "show" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showPeaks | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValleys | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| pvSensitivity | 40 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| pvExcludeHighLow | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showBusinessZone | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneOpacity | 3 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showVwapLine | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapHighlight | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showDevelopingVwap | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showVwapBands | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapLineWidth | 1 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand1 | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand2 | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand3 | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSummaryVolume | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showSummaryTrades | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLevelLabels | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| levelLabelSide | "right" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showLevelLabelPrice | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| visualStyle | "automatic" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| widthMode | "window-percent" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| numberOfProfiles | 1 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| previousProfileWidth | 2 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| currentProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| previousProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| profileMode | "volume" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "manual" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| gradientPreset | "off" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionTokyoEnabled | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionLondonEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| snapMode | "right" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showText | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showValueArea | true | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| showPocLine | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValueAreaLines | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| recentLevelsOnly | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showDelta | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showProfileSpine | false | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showDevelopingPoc | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showPocHighlight | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showProfileOutline | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showSummary | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#22C55E" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| peakColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valleyColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |

### Custom Draw-On Volume Profile

- [x] Add arms the fixed-range profile drawing tool; drawing lifecycle is separate
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| groupTicks | 4 | numeric registry | 26 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | numeric registry | 13 source files | save wiring verified; chart output sign-off separate |
| profileWidth | 2 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| minTradeVolume | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| maxTradeVolume | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 68 | dialog source reference | 30 source files | save wiring verified; chart output sign-off separate |
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| pocLineWidth | 1 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| shiftedPocTicks | 4 | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineMode | "show" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showPeaks | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValleys | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| pvSensitivity | 40 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| pvExcludeHighLow | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showBusinessZone | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneOpacity | 3 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showVwapLine | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapHighlight | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showDevelopingVwap | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showVwapBands | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapLineWidth | 1 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand1 | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand2 | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand3 | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSummaryVolume | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showSummaryTrades | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLevelLabels | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| levelLabelSide | "right" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showLevelLabelPrice | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| visualStyle | "automatic" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| widthMode | "period-percent" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| numberOfProfiles | 0 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| previousProfileWidth | 2 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| currentProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| previousProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| profileMode | "volume" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "manual" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| gradientPreset | "off" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionTokyoEnabled | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionLondonEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| snapMode | "off" | dialog source reference | 7 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showText | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showValueArea | true | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| showPocLine | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValueAreaLines | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| recentLevelsOnly | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showDelta | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showProfileSpine | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showDevelopingPoc | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showPocHighlight | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showProfileOutline | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showSummary | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#22C55E" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| peakColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valleyColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |

### Ask/Bid Volume Profile

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| groupTicks | 4 | numeric registry | 26 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | numeric registry | 13 source files | save wiring verified; chart output sign-off separate |
| profileWidth | 2 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| minTradeVolume | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| maxTradeVolume | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 68 | dialog source reference | 30 source files | save wiring verified; chart output sign-off separate |
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| pocLineWidth | 1 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| shiftedPocTicks | 4 | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineMode | "show" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showPeaks | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValleys | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| pvSensitivity | 40 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| pvExcludeHighLow | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showBusinessZone | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneOpacity | 3 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showVwapLine | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapHighlight | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showDevelopingVwap | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showVwapBands | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapLineWidth | 1 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand1 | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand2 | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand3 | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSummaryVolume | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showSummaryTrades | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLevelLabels | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| levelLabelSide | "right" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showLevelLabelPrice | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| visualStyle | "automatic" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| widthMode | "period-percent" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| numberOfProfiles | 0 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| previousProfileWidth | 2 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| currentProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| previousProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| profileMode | "bid-ask" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "manual" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| gradientPreset | "off" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionTokyoEnabled | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionLondonEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| snapMode | "left" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showText | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showValueArea | true | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| showPocLine | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValueAreaLines | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| recentLevelsOnly | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showDelta | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showProfileSpine | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showDevelopingPoc | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showPocHighlight | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showProfileOutline | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showSummary | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#22C55E" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| peakColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valleyColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |

### Delta Profile

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| groupTicks | 4 | numeric registry | 26 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | numeric registry | 13 source files | save wiring verified; chart output sign-off separate |
| profileWidth | 2 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| minTradeVolume | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| maxTradeVolume | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 68 | dialog source reference | 30 source files | save wiring verified; chart output sign-off separate |
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| pocLineWidth | 1 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| shiftedPocTicks | 4 | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineMode | "show" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showPeaks | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValleys | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| pvSensitivity | 40 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| pvExcludeHighLow | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyLineWidth | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| peakExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showBusinessZone | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneOpacity | 3 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showVwapLine | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapHighlight | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showDevelopingVwap | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showVwapBands | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapLineWidth | 1 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| vwapLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand1 | 1 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand2 | 2 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand3 | 0 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSummaryVolume | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showSummaryTrades | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLevelLabels | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| levelLabelSide | "right" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showLevelLabelPrice | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| visualStyle | "automatic" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| widthMode | "period-percent" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | dialog source reference | 20 source files | save wiring verified; chart output sign-off separate |
| numberOfProfiles | 0 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| previousProfileWidth | 2 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| currentProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| previousProfileOffset | 0 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| profileMode | "delta" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "manual" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| gradientPreset | "off" | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionTokyoEnabled | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionLondonEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| snapMode | "left" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showText | false | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showValueArea | true | dialog source reference | 12 source files | save wiring verified; chart output sign-off separate |
| showPocLine | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValueAreaLines | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| recentLevelsOnly | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showDelta | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showProfileSpine | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showDevelopingPoc | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showPocHighlight | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showProfileOutline | true | generated control candidate | 4 source files | save wiring verified; chart output sign-off separate |
| showSummary | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#22C55E" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| peakColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valleyColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |

### KWANT Profile Swing

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| volumeColor | "#64748B" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#F59E0B" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#38BDF8" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| absoluteReversal | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| reversalTicks | 20 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| leftBars | 3 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| rightBars | 3 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| stopAbsoluteReversal | 5 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| stopReversalTicks | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| stopLeftBars | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| stopRightBars | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| swingMinTicks | 12 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| swingMaxTicks | 240 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| vwapBreakTicks | 8 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| filterMin | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| filterMax | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | numeric registry | 13 source files | save wiring verified; chart output sign-off separate |
| groupTicks | 4 | numeric registry | 26 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 68 | numeric registry | 30 source files | save wiring verified; chart output sign-off separate |
| maxProfiles | 12 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| profileWidth | 34 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| profileMode | "volume" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| lengthType | "swing" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| includeReversalBar | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| displayMode | "profile-and-lines" | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| swingType | "reversal-ticks" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| stopSwingEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| stopSwingType | "reversal-ticks" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "automatic" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| showPocLine | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValueAreaLines | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| showVwapLine | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| showLevelLabels | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### KWANT Profile Values

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| pocColor | "#F59E0B" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| peakColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| valleyColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#38BDF8" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| vwapBandColor | "#64748B" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#E2E8F0" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| lengthValue | 1 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| filterMin | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| filterMax | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| autoGroupFactor | 1 | numeric registry | 13 source files | save wiring verified; chart output sign-off separate |
| groupTicks | 4 | numeric registry | 26 source files | save wiring verified; chart output sign-off separate |
| numberOfProfiles | 6 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| valueAreaPercent | 68 | numeric registry | 30 source files | save wiring verified; chart output sign-off separate |
| sessionStartMinutes | 510 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| sessionEndMinutes | 915 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| developingPocStartMinutes | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| shiftedPocTicks | 1 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| shiftedPocOpacity | 68 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| peakValleySensitivity | 40 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| peakMinimumVolumePercent | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| valleyMaximumVolumePercent | 100 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand1 | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand2 | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| vwapBand3 | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| pocLineWidth | 1 | numeric registry | 10 source files | save wiring verified; chart output sign-off separate |
| valueAreaLineWidth | 2 | numeric registry | 10 source files | save wiring verified; chart output sign-off separate |
| peakLineWidth | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| valleyLineWidth | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| vwapLineWidth | 1 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 2 | needs inspection | 67 source files | internal metadata|
| periodMode | "multiples" | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| lengthType | "days" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| customStartMs | 0 | dialog source reference | 8 source files | source reference found; behavior pending|
| customEndMs | 0 | dialog source reference | 8 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| groupingMode | "automatic" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| filterMode | "none" | dialog source reference | 14 source files | save wiring verified; chart output sign-off separate |
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| showPocLine | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| pocLineMode | "show" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showValueAreaLines | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| developingValueArea | "no" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showPeaks | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showValleys | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| excludeHighLow | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| peakExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| valleyExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showVwap | true | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| showDevelopingVwap | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showVwapBands | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| vwapExtensionMode | "none" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showSummary | false | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showSummaryTrades | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showLevelLabels | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showLevelLabelPrice | true | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| levelLabelSide | "right" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| levelLineStyle | "dash" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### TPO Levels

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| rowSize | 1 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| minimumTrades | 500 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| tailMinimumRows | 3 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| singlePrintMinimumRows | 4 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| ledgeMinimumBrackets | 3 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| ledgeToleranceRows | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| failedAuctionMinimumRows | 5 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| failedAuctionMaximumTpo | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| edgeSmoothingRows | 5 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| edgeDropPercent | 50 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| edgeMaximumWidthRows | 3 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| acceptedBasePercent | 60 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| seamTroughPercent | 50 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| volumeLvnPercent | 50 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| acceptanceBrackets | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| partialFillPercent | 50 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| expireAfterSessions | 10 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| expireStrength | 20 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| fillOpacity | 15 | numeric registry | 27 source files | save wiring verified; chart output sign-off separate |
| borderOpacity | 100 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| supportColor | "#22C55E" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| resistanceColor | "#EF4444" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#94A3B8" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| tpoLevelsSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### VWAP

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| mainColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper1Color | "#4ADE80" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| lower1Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper2Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lower2Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper3Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lower3Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper4Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lower4Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper5Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lower5Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| periodValue | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| sessionStartHour | 17 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| bandLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| band1 | 1 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| band2 | 2 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| band3 | 3 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| band4 | 4 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| band5 | 5 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| source | "hlc3" | dialog source reference | 301 source files | save wiring verified; chart output sign-off separate |
| periodMode | "days" | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| envelopeMode | "standard-deviation" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| bandLineStyle | "dotted" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| band1Enabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| band2Enabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| band3Enabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| band4Enabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| band5Enabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCurrentValue | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| vwapSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### VWAP Envelopes

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| mainColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper1Color | "#4ADE80" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| lower1Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper2Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lower2Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper3Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lower3Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper4Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lower4Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper5Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lower5Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| periodValue | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| bandLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| band1 | 1 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| band2 | 2 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| band3 | 3 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| band4 | 4 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| band5 | 5 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| source | "hlc3" | dialog source reference | 301 source files | save wiring verified; chart output sign-off separate |
| periodMode | "days" | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| envelopeMode | "standard-deviation" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| bandLineStyle | "dotted" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| band1Enabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| band2Enabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| band3Enabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| band4Enabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| band5Enabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCurrentValue | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| vwapSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### Rolling VWAP

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| upper1Color | "#4ADE80" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| lower1Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper2Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lower2Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper3Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lower3Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper4Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lower4Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| upper5Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lower5Color | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| periodValue | 60 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| bandLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| band1 | 1 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| band2 | 2 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| band3 | 3 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| band4 | 4 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| band5 | 5 | numeric registry | 0 source files | save wiring verified; chart output sign-off separate |
| source | "hlc3" | dialog source reference | 301 source files | save wiring verified; chart output sign-off separate |
| periodMode | "bars" | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| envelopeMode | "standard-deviation" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| bandLineStyle | "dotted" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| band1Enabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| band2Enabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| band3Enabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| band4Enabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| band5Enabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCurrentValue | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| vwapSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### Market Statistics

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| textColor | "#60A5FA" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |
| averageColor | "#22C55E" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| deviationColor | "#EF4444" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| backgroundColor | "#09090B" | dialog source reference | 85 source files | save wiring verified; chart output sign-off separate |
| fontSize | 10 | numeric registry | 87 source files | save wiring verified; chart output sign-off separate |
| standardDeviationPercent | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| filterMin | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| filterMax | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| initialRange | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| endRange | 500 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| stepRange | 50 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| initialFilterMinutes | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| endFilterMinutes | 1439 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| panelOpacity | 72 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| statMode | "trades" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| dataType | "volume" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| barInput | "volume" | dialog source reference | 1 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| showEmptyRanges | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### On Candle Stats

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| filterMin | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| filterMax | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| fontSize | 10 | numeric registry | 87 source files | save wiring verified; chart output sign-off separate |
| smallerFontSize | 6 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maxRatio | 100 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| tickOffset | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| inputData | "Volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| autoTextFormat | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| absoluteSign | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| opacityBasedOnRatio | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| colorTextBasedOnDelta | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| pricePlot | "price-slope" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showMaxDeltaVolume | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showMinDeltaVolume | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showTotalVolume | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showDeltaVolume | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showTotalTrades | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showDeltaTrades | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showRangeTicks | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCotHigh | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCotLow | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCotBar | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showDeltaPercent | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showBarRatio | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showBidVolume | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showAskVolume | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showSessionCvd | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showVolumePerSecond | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showDuration | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showHighRatio | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showLowRatio | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showTotalEffort | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showDeltaEffort | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#EF4444" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#94A3B8" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| textColor | "#E5E7EB" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |
| backgroundColor | "#27272A" | dialog source reference | 85 source files | save wiring verified; chart output sign-off separate |
| onCandleStatsSettingsVersion | 1 | dialog source reference | 0 source files | internal metadata|

## Market Structure

### Important Levels

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| days | 2 | numeric registry | 78 source files | save wiring verified; chart output sign-off separate |
| weeks | 1 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| months | 1 | numeric registry | 18 source files | save wiring verified; chart output sign-off separate |
| skipLast | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| plotType | "label-and-line" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| textAlign | "right" | dialog source reference | 62 source files | save wiring verified; chart output sign-off separate |
| fontSize | 10 | numeric registry | 87 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| filterTime | "eth" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| customStartTime | "08:30" | dialog source reference | 3 source files | source reference found; behavior pending|
| customEndTime | "15:15" | dialog source reference | 2 source files | source reference found; behavior pending|
| dailyAverage | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| dailyLow | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| dailyHigh | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| dailyOpen | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| dailyClose | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| dailyPoc | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| dailyValueArea | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| dailyVwap | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| weeklyAverage | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| weeklyLow | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| weeklyHigh | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| weeklyOpen | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| weeklyClose | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| weeklyPoc | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| weeklyValueArea | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| weeklyVwap | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| monthlyAverage | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| monthlyLow | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| monthlyHigh | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| monthlyOpen | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| monthlyClose | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| monthlyPoc | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| monthlyValueArea | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| monthlyVwap | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| lowColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| highColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| openColor | "#A3A3A3" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| closeColor | "#FFFFFF" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| midColor | "#F59E0B" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| pocColor | "#F59E0B" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| valueAreaColor | "#38BDF8" | dialog source reference | 18 source files | save wiring verified; chart output sign-off separate |
| vwapColor | "#A78BFA" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| importantLevelsSettingsVersion | 1 | dialog source reference | 1 source files | internal metadata|

### Absolute Levels

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| firstValue | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| secondValue | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| firstLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| secondLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| firstLineStyle | "solid" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| secondLineStyle | "solid" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| firstLineColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| secondLineColor | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |

### Pivot Points

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| fontSize | 12 | numeric registry | 87 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "dashed" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| labelAlign | "left" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| periodsToShow | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| customReferenceEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| referenceTimeframe | "hour" | dialog source reference | 1 source files | source reference found; behavior pending|
| referenceValue | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| customSessionEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| customSessionStart | "00:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| customSessionEnd | "00:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| pivotPointColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| r1Color | "#EF4444" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| r2Color | "#EF4444" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| s1Color | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| s2Color | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |

### Price Movement Levels

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| daysToLoad | 3 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| levelBasedOn | "open" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| stepMode | "percentual" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| stepValue | 0.5 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| fontSize | 11 | numeric registry | 87 source files | save wiring verified; chart output sign-off separate |
| minimumLevels | 5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| supportLineStyle | "dashed" | dialog source reference | 1 source files | source reference found; behavior pending|
| supportLineWidth | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| resistanceLineStyle | "dashed" | dialog source reference | 1 source files | source reference found; behavior pending|
| resistanceLineWidth | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| zeroLineStyle | "dotted" | dialog source reference | 4 source files | source reference found; behavior pending|
| zeroLineWidth | 2 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| customTimeEnabled | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| customStartTime | "00:00:00" | dialog source reference | 3 source files | source reference found; behavior pending|
| customEndTime | "00:00:00" | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| textColor | "#FFFFFF" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |
| supportLineColor | "#22C55E" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| resistanceLineColor | "#4ADE80" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| zeroLineColor | "#22C55E" | generated control candidate | 5 source files | save wiring verified; chart output sign-off separate |

### FVG Identifier

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minNumTicks | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maxNumTicks | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| backgroundOpacity | 40 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| resetStartDay | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| removeOnShadowTriggered | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| maxBarsExtension | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| breakoutPercent | 35 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| upColor | "#22C55E" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| downColor | "#EF4444" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |

### Gap Detector

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| gapMode | "day-begin" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| calculationMode | "tick" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| percentValue | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| tickValue | 20 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| triggerWholeBar | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| backgroundOpacity | 40 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| upColor | "#22C55E" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| downColor | "#EF4444" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |

### Divergence Detector

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| pivotStrength | 3 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| synchronizationBars | 3 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumSwingBars | 3 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumLookbackBars | 1200 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumMoveTicks | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumSignals | 24 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| opacity | 100 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| labelFontSize | 10 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| comparisonMode | "automatic-es-nq" | dialog source reference | 4 source files | source reference found; behavior pending|
| includeNonConfirmation | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showBullish | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showBearish | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| showPivotDots | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| dashedLines | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| bullishColor | "#22C55E" | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| bearishColor | "#EF4444" | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| divergenceDetectorSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Confluence Identifier

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| supportColor1 | "#22C55E" | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| supportColor2 | "#16A34A" | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| supportColor3 | "#15803D" | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| supportColor4 | "#14532D" | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| resistanceColor1 | "#EF4444" | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| resistanceColor2 | "#DC2626" | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| resistanceColor3 | "#B91C1C" | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| resistanceColor4 | "#7F1D1D" | needs inspection | 3 source files | save wiring verified; chart output sign-off separate |
| trendUpColor | "#22C55E" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| trendDownColor | "#EF4444" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| swingUpColor | "#4ADE80" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| swingDownColor | "#FB7185" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| startLineColor | "#94A3B8" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| filterMin | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| filterMax | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| tickSensitivity | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumConfluences | 5 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| trendReversalPercent | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| trendSwingCount | 9 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| swingReversalPercent | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| firstGroupTicks | 4 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| firstProfileCount | 6 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| secondGroupTicks | 4 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| secondProfileCount | 4 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| thirdGroupTicks | 4 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| thirdProfileCount | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| peakMinimumVolumePercent | 60 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| valleyMaximumVolumePercent | 25 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| deltaImbalancePercent | 70 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| supportRange2 | 6 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| supportRange3 | 8 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| supportRange4 | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| resistanceRange2 | 6 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| resistanceRange3 | 8 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| resistanceRange4 | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| zoneOpacity | 18 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| inputData | "volume" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| startMode | "zig-zag" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| startDateMs | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| enableZigZagSwing | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| includeSwingBeforeMidTrend | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| enableRetracements | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| enableRetracement382 | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| enableRetracement50 | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| enableRetracement618 | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| enableRetracement75 | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| excludePreviousRetracements | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showDevelopingLines | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showSourceLines | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| firstEnabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| firstPeriod | "daily" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| firstGroupingMode | "automatic" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| firstIncludeByNumber | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| firstUsePoc | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| firstUseValueArea | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| firstUsePeaks | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| firstUseValleys | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| firstUseDeltaImbalances | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| secondEnabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| secondPeriod | "weekly" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| secondGroupingMode | "automatic" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| secondIncludeByNumber | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| secondUsePoc | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| secondUseValueArea | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| secondUsePeaks | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| secondUseValleys | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| secondUseDeltaImbalances | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| thirdEnabled | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| thirdPeriod | "composite" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| thirdGroupingMode | "automatic" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| thirdIncludeByNumber | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| thirdUsePoc | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| thirdUseValueArea | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| thirdUsePeaks | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| thirdUseValleys | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| thirdUseDeltaImbalances | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### Swing Point

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| leftBars | 2 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| rightBars | 2 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| filterSwing | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| displayMode | "line" | dialog source reference | 9 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "dashed" | dialog source reference | 50 source files | source reference found; behavior pending|
| textTickOffset | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| textSize | 11 | numeric registry | 11 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| highColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| lowColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| highTextColor | "#FFFFFF" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| lowTextColor | "#FFFFFF" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |

### Average Daily Range Target

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lengthType | "daily" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| length | 1 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |
| fontSize | 12 | numeric registry | 87 source files | save wiring verified; chart output sign-off separate |
| textAlign | "right" | dialog source reference | 62 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| backgroundColor | "#000000" | dialog source reference | 85 source files | save wiring verified; chart output sign-off separate |
| textColor | "#FFFFFF" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |

### Sessions

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookbackDays | 30 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| fillOpacity | 10 | numeric registry | 27 source files | save wiring verified; chart output sign-off separate |
| lineOpacity | 100 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | numeric registry | 20 source files | save wiring verified; chart output sign-off separate |
| showTokyo | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLondon | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showNewYork | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showSydney | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| tokyoLabel | "Asia" | needs inspection | 1 source files | source reference found; behavior pending|
| londonLabel | "London" | needs inspection | 1 source files | source reference found; behavior pending|
| newYorkLabel | "New York" | needs inspection | 2 source files | source reference found; behavior pending|
| sydneyLabel | "Sydney" | needs inspection | 1 source files | source reference found; behavior pending|
| tokyoTimezone | "America/New_York" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| londonTimezone | "America/New_York" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| newYorkTimezone | "America/New_York" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| tokyoStart | "16:00" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| tokyoEnd | "03:00" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| londonStart | "03:00" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| londonEnd | "09:30" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| newYorkStart | "09:30" | needs inspection | 2 source files | save wiring verified; chart output sign-off separate |
| newYorkEnd | "16:00" | needs inspection | 2 source files | save wiring verified; chart output sign-off separate |
| sydneyStart | "08:00" | needs inspection | 1 source files | source reference found; behavior pending|
| sydneyEnd | "17:00" | needs inspection | 1 source files | source reference found; behavior pending|
| tokyoColor | "#FF9900" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| londonColor | "#4CAF50" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| newYorkColor | "#2196F3" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| sydneyColor | "#A461BB" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| showBackground | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| showBorders | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showOpenClose | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showMidline | false | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| showPercentChange | false | generated control candidate | 5 source files | save wiring verified; chart output sign-off separate |
| showPointChange | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| hideWeekends | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "dashed" | dialog source reference | 50 source files | source reference found; behavior pending|
| labelSize | "small" | needs inspection | 1 source files | source reference found; behavior pending|
| allowSessionOverlap | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| sessionsSettingsVersion | 2 | dialog source reference | 0 source files | internal metadata|

### Session Highs & Lows

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookbackDays | 30 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| lineOpacity | 100 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| showGlobex | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showTokyo | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLondon | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showNewYork | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| globexLabel | "Globex" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| tokyoLabel | "Asia" | needs inspection | 1 source files | source reference found; behavior pending|
| londonLabel | "London" | needs inspection | 1 source files | source reference found; behavior pending|
| newYorkLabel | "New York" | needs inspection | 2 source files | source reference found; behavior pending|
| globexTimezone | "America/Chicago" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| tokyoTimezone | "America/Chicago" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| londonTimezone | "America/Chicago" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| newYorkTimezone | "America/Chicago" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| globexStart | "17:00" | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| globexEnd | "16:00" | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| tokyoStart | "17:00" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| tokyoEnd | "02:00" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| londonStart | "02:00" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| londonEnd | "08:30" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| newYorkStart | "08:30" | needs inspection | 2 source files | save wiring verified; chart output sign-off separate |
| newYorkEnd | "15:00" | needs inspection | 2 source files | save wiring verified; chart output sign-off separate |
| showHighs | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showLows | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| hideWeekends | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "dashed" | dialog source reference | 50 source files | source reference found; behavior pending|
| labelSize | "small" | needs inspection | 1 source files | source reference found; behavior pending|
| sessionHighLowSettingsVersion | 3 | dialog source reference | 0 source files | internal metadata|

### IB Levels

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookbackDays | 7 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| lineOpacity | 100 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| durationMinutes | 60 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| ibDuration15 | false | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| ibDuration30 | false | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| ibDuration45 | false | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| ibDuration60 | false | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| showGlobex | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showTokyo | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showLondon | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showNewYork | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| globexLabel | "Globex" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| tokyoLabel | "Asia" | needs inspection | 1 source files | source reference found; behavior pending|
| londonLabel | "London" | needs inspection | 1 source files | source reference found; behavior pending|
| newYorkLabel | "New York" | needs inspection | 2 source files | source reference found; behavior pending|
| globexStart | "18:00" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| globexEnd | "17:00" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| tokyoStart | "09:00" | needs inspection | 1 source files | source reference found; behavior pending|
| tokyoEnd | "18:00" | needs inspection | 1 source files | source reference found; behavior pending|
| londonStart | "08:00" | needs inspection | 1 source files | source reference found; behavior pending|
| londonEnd | "17:00" | needs inspection | 1 source files | source reference found; behavior pending|
| newYorkStart | "09:30" | needs inspection | 2 source files | source reference found; behavior pending|
| newYorkEnd | "16:00" | needs inspection | 2 source files | source reference found; behavior pending|
| globexColor | "#A461BB" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| tokyoColor | "#FF9900" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| londonColor | "#4CAF50" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| newYorkColor | "#2196F3" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| followSessionsStudy | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showHighs | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showLows | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| hideWeekends | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| useSessionColors | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| highColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| lowColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| developingLineStyle | "solid" | needs inspection | 1 source files | source reference found; behavior pending|
| fixedLineStyle | "dashed" | needs inspection | 1 source files | source reference found; behavior pending|
| labelSize | "small" | needs inspection | 1 source files | source reference found; behavior pending|
| showFib | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| fibDirection | "long" | dialog source reference | 1 source files | source reference found; behavior pending|
| initialBalanceSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### Kwant Levels

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| maxLevels | 14 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| conversion | "AUTO" | dialog source reference | 13 source files | save wiring verified; chart output sign-off separate |
| dataSource | "GEX_CALL_MINUS_PUT" | needs inspection | 9 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| showEnvironment | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "dashed" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#EF4444" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| magnetColor | "#8B5CF6" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| centreColor | "#06B6D4" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| gammaSettingsVersion | 3 | needs inspection | 0 source files | internal metadata|

### Classic GEX Profile

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| refreshIntervalMs | 1000 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| manualMultiplier | 1 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| premiumOffset | 0 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| profileWidth | 24 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| minBarWidth | 5 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| contrast | 70 | numeric registry | 10 source files | save wiring verified; chart output sign-off separate |
| mappingSource | "QQQ" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| profileMode | "CLASSIC_GEX" | dialog source reference | 7 source files | source reference found; behavior pending|
| expiry | "ZERO_DTE" | dialog source reference | 56 source files | save wiring verified; chart output sign-off separate |
| profileSource | "VOLUME" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| panelPosition | "RIGHT" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| mappingMode | "AUTO" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| logarithmicScaling | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showLookbackDots | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showMajorPositiveVolume | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showMajorNegativeVolume | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showMajorPositiveOpenInterest | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showMajorNegativeOpenInterest | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showZeroGamma | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#EF4444" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| zeroGammaColor | "#F4F4F5" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| classicGexSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Session Marker

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookbackDays | 5 | numeric registry | 6 source files | save wiring verified; chart output sign-off separate |
| lineOpacity | 100 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| textSize | 11 | numeric registry | 11 source files | save wiring verified; chart output sign-off separate |
| asianImbalanceMinutes | 60 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| europeImbalanceMinutes | 60 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| usaImbalanceMinutes | 60 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| timeReference | "exchange" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| extendLine | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| textColor | "#E5E7EB" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |
| showSessionRange | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showImbalanceRange | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showOpenClose | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showMidPrice | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| asianEnabled | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| asianStartTime | "16:00" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| asianEndTime | "03:00" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| asianVwapEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| europeEnabled | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| europeStartTime | "03:00" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| europeEndTime | "09:30" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| europeVwapEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| usaEnabled | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| usaStartTime | "09:30" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| usaEndTime | "16:00" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| usaVwapEnabled | false | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| markerEnabled | false | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| allowSessionOverlap | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| sessionMarkerSettingsVersion | 2 | dialog source reference | 1 source files | internal metadata|
| asianHighColor | "#22C55E" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| asianLowColor | "#EF4444" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| asianImbalanceHighColor | "#4ADE80" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| asianImbalanceLowColor | "#F87171" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| asianOpenColor | "#38BDF8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| asianCloseColor | "#94A3B8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| asianSessionRangeColor | "#38BDF8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| asianImbalanceRangeColor | "#94A3B8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| asianMidColor | "#38BDF8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| asianVwapColor | "#38BDF8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| europeHighColor | "#22C55E" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| europeLowColor | "#EF4444" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| europeImbalanceHighColor | "#4ADE80" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| europeImbalanceLowColor | "#F87171" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| europeOpenColor | "#38BDF8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| europeCloseColor | "#94A3B8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| europeSessionRangeColor | "#38BDF8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| europeImbalanceRangeColor | "#94A3B8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| europeMidColor | "#38BDF8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| europeVwapColor | "#38BDF8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| usaHighColor | "#22C55E" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| usaLowColor | "#EF4444" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| usaImbalanceHighColor | "#4ADE80" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| usaImbalanceLowColor | "#F87171" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| usaOpenColor | "#38BDF8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| usaCloseColor | "#94A3B8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| usaSessionRangeColor | "#38BDF8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| usaImbalanceRangeColor | "#94A3B8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| usaMidColor | "#38BDF8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| usaVwapColor | "#38BDF8" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| markerPositiveColor | "#22C55E" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| markerNegativeColor | "#EF4444" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |

### Shift Candle

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| maxBarsAfterReversal | 3 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumTickBreakout | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| minimumDeltaPercentDifference | 20 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| minimumDeltaValueDifference | 100 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maximumTickPocDistance | 4 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| highestLowestLookback | 5 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| markerTickOffset | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| plotPrice | "high-low" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| imbalanceEnabled | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| minimumImbalancePercent | 300 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| minimumImbalanceVolumeDifference | 20 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| freshZonesEnabled | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| zoneOpacity | 18 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| markerShape | "square" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| markerLineWidth | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| autoCenter | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| alertEnabled | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| alertName | "Signal Trigger" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| popupEnabled | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| popupMessage | "Signal Trigger" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| buyMarkerColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| sellMarkerColor | "#EF4444" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| freshBuyZoneColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| freshSellZoneColor | "#EF4444" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| shiftCandleSettingsVersion | 1 | dialog source reference | 1 source files | internal metadata|

## Trend

### Moving Average

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| length | 20 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |

### Ichimoku Indicator

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| conversionLinePeriod | 9 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| baseLinePeriod | 26 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| laggingSpanPeriod | 52 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| tenkanLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| kijunLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| chikouLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| senkouLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| tenkanLineStyle | "solid" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| kijunLineStyle | "solid" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| chikouLineStyle | "solid" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| senkouLineStyle | "solid" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| tenkanShortName | "Tenkan Sen" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| kijunShortName | "Kijun Sen" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| chikouShortName | "Chikou Span" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| senkouShortName | "Senkou Span" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| tenkanNameLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| tenkanValueLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| kijunNameLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| kijunValueLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| chikouNameLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| chikouValueLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| senkouNameLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| senkouValueLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| tenkanIncludeOnAutoCenter | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| kijunIncludeOnAutoCenter | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| chikouIncludeOnAutoCenter | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| senkouIncludeOnAutoCenter | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCloud | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| cloudOpacity | 14 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| useSecondaryAxis | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| tenkanColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| kijunColor | "#EF4444" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| chikouColor | "#4ADE80" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| senkouColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| senkouSecondaryColor | "#EF4444" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| bullishCloudColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| bearishCloudColor | "#EF4444" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| ichimokuSettingsVersion | 1 | needs inspection | 1 source files | internal metadata|

### Parabolic SAR

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| accelerationStep | 0.02 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| accelerationMaximum | 0.2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| displayStyle | "points" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| secondaryColorEnabled | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| useSecondaryAxis | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| secondaryColor | "#4ADE80" | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |

### Linear Regression

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| length | 21 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |
| inputData | "close" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| displayStyle | "line" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| secondaryColorEnabled | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| useSecondaryAxis | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| secondaryColor | "#4ADE80" | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |

### Regression Channel

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| mode | "bars" | dialog source reference | 197 source files | save wiring verified; chart output sign-off separate |
| bars | 100 | numeric registry | 146 source files | save wiring verified; chart output sign-off separate |
| standardDeviationValue | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| zigZagMode | "tick-reversal" | dialog source reference | 2 source files | source reference found; behavior pending|
| zigZagAbsoluteReversal | 0.5 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| zigZagReversalValue | 22 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| midLineWidth | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| upperLineWidth | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lowerLineWidth | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| midLineStyle | "dashed" | dialog source reference | 1 source files | source reference found; behavior pending|
| upperLineStyle | "dashed" | dialog source reference | 1 source files | source reference found; behavior pending|
| lowerLineStyle | "dashed" | dialog source reference | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| midColor | "#22C55E" | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| midUpColor | "#22C55E" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| midDownColor | "#EF4444" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| upperColor | "#22C55E" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| upperUpColor | "#22C55E" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| upperDownColor | "#EF4444" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| lowerColor | "#22C55E" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| lowerUpColor | "#22C55E" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| lowerDownColor | "#EF4444" | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |

### Super Trend

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| length | 10 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |
| multiplier | 3 | numeric registry | 37 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| displayStyle | "line" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| colorMode | "direction" | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| shortName | "ST" | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| chartArea | "overlay" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| useSecondaryAxis | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| includeOnAutoCenter | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| valueLabel | false | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| nameLabel | false | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| nameBackground | false | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| valueBackground | false | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| chartColorForMarker | false | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| alertSoundEnabled | false | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| messagePopupEnabled | false | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| alertName | "Super Trend" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| secondaryColor | "#EF4444" | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |

### Super Trend Difference

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| length | 10 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |
| multiplier | 3 | numeric registry | 37 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 4 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| displayStyle | "histogram" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| colorMode | "sign" | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| shortName | "STD" | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| includeOnAutoCenter | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| valueLabel | false | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| nameLabel | false | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| nameBackground | false | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| valueBackground | false | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| chartColorForMarker | false | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| secondaryColor | "#EF4444" | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |

### Keltner Channel

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| middleColor | "#22C55E" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| upperColor | "#4ADE80" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| lowerColor | "#4ADE80" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| length | 20 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |
| atrLength | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| multiplier | 2 | numeric registry | 37 source files | save wiring verified; chart output sign-off separate |

### Bollinger Bands

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| middleColor | "#22C55E" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| upperColor | "#4ADE80" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| lowerColor | "#4ADE80" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| length | 20 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |
| multiplier | 2 | numeric registry | 37 source files | save wiring verified; chart output sign-off separate |

### Donchian Channel

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| upperColor | "#22C55E" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| middleColor | "#22C55E" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| lowerColor | "#EF4444" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| length | 20 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |

### Tillson T3

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| length | 14 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |
| volumeFactor | 0.618 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| inputData | "close" | dialog source reference | 15 source files | save wiring verified; chart output sign-off separate |
| colorMode | "slope" | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| displayStyle | "line" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| shortName | "T3" | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| useSecondaryAxis | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| secondaryColor | "#4ADE80" | generated control candidate | 6 source files | save wiring verified; chart output sign-off separate |

### Zig Zag

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| zigZagMode | "highest-lowest" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| absoluteReversalPercent | 0.5 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| tickReversalOrLookback | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 2 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| shortName | "Zig Zag" | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| upColor | "#22C55E" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| downColor | "#EF4444" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| retracementBackgroundColor | "#5f6425" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| retracementFontSize | 11 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| retracementTextColor | "#FFFFFF" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| retracementLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| retracementLineColor | "#4ADE80" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showRetracement38 | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showRetracement50 | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showRetracement62 | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showRetracement75 | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| extendRight | false | dialog source reference | 30 source files | save wiring verified; chart output sign-off separate |

## Momentum

### Relative Strength Index (RSI)

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| length | 14 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |

### Rate of Change (ROC)

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| length | 12 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |

### MACD Indicator

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| macdColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| signalColor | "#4ADE80" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| histogramColor | "#8A8F98" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| fastLength | 12 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| slowLength | 26 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| signalLength | 9 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |

### Momentum Indicator

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| length | 10 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |

### Commodity Channel Index (CCI)

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| length | 20 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |

### Know Sure Thing (KST)

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| roc1 | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| roc2 | 15 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| roc3 | 20 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| roc4 | 30 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| average1 | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| average2 | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| average3 | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| average4 | 15 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| signalPeriod | 9 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| averageType | "simple" | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| usePercent | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| middleLevel | 0 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| middleLineWidth | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| showMiddle | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showKst | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showSignal | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| kstColorMode | "slope" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| signalColorMode | "none" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| kstDisplayStyle | "line" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| signalDisplayStyle | "line" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| kstLineStyle | "solid" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| signalLineStyle | "dashed" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| kstLineWidth | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| signalLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| kstShortName | "KST" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| signalShortName | "Sig" | needs inspection | 1 source files | save wiring verified; chart output sign-off separate |
| kstNameLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| signalNameLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| kstValueLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| signalValueLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| kstNameBackground | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| signalNameBackground | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| kstValueBackground | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| signalValueBackground | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| kstChartMarker | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| signalChartMarker | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| kstAutoCenter | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| signalAutoCenter | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| kstColor | "#22C55E" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| kstSecondaryColor | "#EF4444" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| signalColor | "#4ADE80" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| signalSecondaryColor | "#22C55E" | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| middleColor | "#8A8F98" | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |

### Inverse Cyber Cycle

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| smoothingAlpha | 0.01 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| cycleALength | 21 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| cycleBLength | 84 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| middleLevel | 0 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| lowLevel | -0.6 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| highLevel | 0.6 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| levelWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| cycleALineWidth | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| cycleBLineWidth | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| cycleALineStyle | "solid" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| cycleBLineStyle | "solid" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| cycleAAutoColor | "none" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| cycleBAutoColor | "none" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| cycleAShortName | "CycA" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| cycleBShortName | "CycB" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| cycleANameLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| cycleAValueLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| cycleAIncludeOnAutoCenter | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| cycleBNameLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| cycleBValueLabel | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| cycleBIncludeOnAutoCenter | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useSecondaryAxis | false | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| cycleAColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| cycleASecondaryColor | "#CA8A04" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| cycleBColor | "#4ADE80" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| cycleBSecondaryColor | "#BE185D" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| middleLevelColor | "#8A8F98" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| lowLevelColor | "#EF4444" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| highLevelColor | "#22C55E" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| inverseCyberCycleSettingsVersion | 1 | needs inspection | 1 source files | internal metadata|

### Aroon Up/Down

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| upColor | "#22C55E" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| downColor | "#EF4444" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| length | 25 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |

### Aroon Oscillator

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| length | 25 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |

### Awesome Oscillator

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| fastLength | 5 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| slowLength | 34 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |

### Stochastic Oscillator

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| kColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| dColor | "#4ADE80" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| length | 14 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |
| smooth | 3 | numeric registry | 19 source files | save wiring verified; chart output sign-off separate |

### Williams %R

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| length | 14 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |

### Chaikin Accumulation/Distribution

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |

### Average Directional Index (ADX)

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| period | 14 | numeric registry | 39 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| lineStyle | "solid" | dialog source reference | 50 source files | save wiring verified; chart output sign-off separate |
| showPlusDi | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showMinusDi | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| adxColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| plusDiColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| minusDiColor | "#EF4444" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |

## Volatility

### VIX Environment

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| position | "top-left" | dialog source reference | 116 source files | save wiring verified; chart output sign-off separate |
| sourceSymbol | "VIX" | dialog source reference | 28 source files | save wiring verified; chart output sign-off separate |
| showChange | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showRange | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showRank | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showPercentile | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| showFreshness | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | false | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| calmColor | "#22C55E" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| normalColor | "#38BDF8" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| elevatedColor | "#F59E0B" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| highColor | "#F97316" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| extremeColor | "#EF4444" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| normalThreshold | 15 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| elevatedThreshold | 20 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| highThreshold | 25 | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| extremeThreshold | 30 | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| badgeScale | 1 | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| vixEnvironmentSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Standard Deviation

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| length | 20 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |

### Average True Range (ATR)

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | save wiring verified; chart output sign-off separate |
| length | 14 | numeric registry | 669 source files | save wiring verified; chart output sign-off separate |

### Expected Move

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lineOpacity | 100 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| fillOpacity | 3 | numeric registry | 27 source files | save wiring verified; chart output sign-off separate |
| mode | "SESSION" | dialog source reference | 197 source files | save wiring verified; chart output sign-off separate |
| mappingSource | "QQQ" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| showTwoSigma | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showBandFill | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#D6A84B" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| expectedMoveSettingsVersion | 1 | needs inspection | 1 source files | internal metadata|

## Overlays

### Overlay Chart

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| maxVolumeWidthPercent | 100 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| standardDeviation | 2 | numeric registry | 16 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | numeric registry | 20 source files | save wiring verified; chart output sign-off separate |
| opacity | 68 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| symbol | "AUTO" | dialog source reference | 186 source files | save wiring verified; chart output sign-off separate |
| timeframe | "AUTO" | dialog source reference | 87 source files | save wiring verified; chart output sign-off separate |
| style | "candlestick" | dialog source reference | 284 source files | save wiring verified; chart output sign-off separate |
| useSecondaryAxis | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| widthBasedOnVolume | false | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| colorBasedOnDelta | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| openCloseBorder | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filled | true | dialog source reference | 106 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| upColor | "#22C55E" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| downColor | "#EF4444" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| lineColor | "#60A5FA" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |
| overlaySettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Overlay Symbol

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| maxVolumeWidthPercent | 100 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| standardDeviation | 2 | numeric registry | 16 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | numeric registry | 20 source files | save wiring verified; chart output sign-off separate |
| opacity | 68 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| symbol | "AUTO" | dialog source reference | 186 source files | save wiring verified; chart output sign-off separate |
| timeframe | "AUTO" | dialog source reference | 87 source files | source reference found; behavior pending|
| style | "candlestick" | dialog source reference | 284 source files | save wiring verified; chart output sign-off separate |
| useSecondaryAxis | true | dialog source reference | 9 source files | save wiring verified; chart output sign-off separate |
| widthBasedOnVolume | false | dialog source reference | 4 source files | save wiring verified; chart output sign-off separate |
| colorBasedOnDelta | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| openCloseBorder | true | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| filled | true | dialog source reference | 106 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| upColor | "#22C55E" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| downColor | "#EF4444" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| lineColor | "#60A5FA" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |
| overlaySettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Overlay Timeframe Candlestick

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| candleWidthPercent | 94 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | numeric registry | 20 source files | save wiring verified; chart output sign-off separate |
| opacity | 34 | numeric registry | 165 source files | save wiring verified; chart output sign-off separate |
| timeframe | "15m" | dialog source reference | 87 source files | save wiring verified; chart output sign-off separate |
| filled | true | dialog source reference | 106 source files | save wiring verified; chart output sign-off separate |
| drawCloseBoundary | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| upColor | "#22C55E" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| downColor | "#EF4444" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| closeBoundaryColor | "#60A5FA" | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| overlaySettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Overlay Timeframe Highlight

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| parameterType | "minutes" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| parameter1 | 15 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| colorBasedOnDelta | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| colorMode | "fixed" | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| standardDeviation | 2 | numeric registry | 16 source files | save wiring verified; chart output sign-off separate |
| enabled | true | dialog source reference | 135 source files | save wiring verified; chart output sign-off separate |
| borderWidth | 1 | numeric registry | 20 source files | save wiring verified; chart output sign-off separate |
| bodyOpacity | 18 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| shadowOpacity | 70 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| showBackground | true | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| targetEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| targetLineWidth | 1 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| targetLineStyle | "dashed" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| extendLineLeft | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showTargetText | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| textSize | 10 | numeric registry | 11 source files | save wiring verified; chart output sign-off separate |
| summaryEnabled | false | dialog source reference | 3 source files | save wiring verified; chart output sign-off separate |
| volumeSummary | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| tradeSummary | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| summaryTextSize | 9 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| summaryToView | 3 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| upColor | "#22C55E" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| downColor | "#EF4444" | dialog source reference | 34 source files | save wiring verified; chart output sign-off separate |
| highColor | "#22C55E" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| lowColor | "#EF4444" | dialog source reference | 7 source files | save wiring verified; chart output sign-off separate |
| textColor | "#FFFFFF" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |
| summaryTextColor | "#FFFFFF" | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#EF4444" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |

### Text on Chart

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| fontSize | 30 | numeric registry | 87 source files | save wiring verified; chart output sign-off separate |
| textColor | "#FFFFFF" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |
| backgroundColor | "#333333" | dialog source reference | 85 source files | save wiring verified; chart output sign-off separate |
| text | "" | dialog source reference | 323 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |

### Source Code Indicator

- [x] Internal saved-script adapter is intentionally hidden from the public Add library
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |

## KWANT Systems

### KWANT Stats

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| filterMin | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| filterMax | 0 | numeric registry | 12 source files | save wiring verified; chart output sign-off separate |
| coloringDeviation | 2 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| sessionStartHour | 17 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| inputData | "Volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| autoFormat | true | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| invertRows | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showHeader | true | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showTotalVolume | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showBidVolume | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showAskVolume | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showDeltaVolume | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showMaxDeltaVolume | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showMinDeltaVolume | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showTotalTrades | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showDeltaTrades | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showRangeTicks | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showDeltaPercent | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showSessionCvd | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showVolumePerSecond | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCotHigh | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCotLow | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showCotBar | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showDuration | false | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| showBarRatio | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showHighRatio | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showLowRatio | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showTotalEffort | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showDeltaEffort | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#EF4444" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#94A3B8" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| textColor | "#E5E7EB" | dialog source reference | 58 source files | save wiring verified; chart output sign-off separate |
| headerColor | "#27272A" | generated control candidate | 5 source files | save wiring verified; chart output sign-off separate |
| statsPaletteId | "" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| statsSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### Hedge Levels

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| fillOpacity | 5 | numeric registry | 27 source files | save wiring verified; chart output sign-off separate |
| lineOpacity | 100 | numeric registry | 5 source files | save wiring verified; chart output sign-off separate |
| showBelowFlip | true | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| showLabels | true | dialog source reference | 61 source files | save wiring verified; chart output sign-off separate |
| hedgeLevelsSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### KWANT-M IVB

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookbackSessions | 20 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| zoneWidthTicks | 4 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| lineWidth | 1 | numeric registry | 142 source files | save wiring verified; chart output sign-off separate |
| zoneOpacity | 14 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| openingRangeMinutes | 30 | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showRange | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showProtection | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showAverage | true | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| showStandardDeviation | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| showZones | true | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| showSummary | true | dialog source reference | 10 source files | save wiring verified; chart output sign-off separate |
| extendToLiveEdge | true | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| positiveColor | "#22C55E" | dialog source reference | 19 source files | save wiring verified; chart output sign-off separate |
| negativeColor | "#EF4444" | dialog source reference | 21 source files | save wiring verified; chart output sign-off separate |
| neutralColor | "#94A3B8" | dialog source reference | 33 source files | save wiring verified; chart output sign-off separate |
| deepMIVBSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### KWANT Pattern Builder

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minImbalancePercent | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maxImbalancePercent | 0 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| markerSize | 7 | numeric registry | 22 source files | save wiring verified; chart output sign-off separate |
| backgroundOpacity | 8 | numeric registry | 9 source files | save wiring verified; chart output sign-off separate |
| daysToShow | 10 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| condition1Enabled | true | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| condition1ASource | "close" | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1AOffset | 0 | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1AValue | 0 | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1BSource | "unused" | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1BOffset | 0 | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1BValue | 0 | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1LeftMath | "+" | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1Comparator | ">" | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1CSource | "open" | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1COffset | 0 | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1CValue | 0 | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1DSource | "unused" | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1DOffset | 0 | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1DValue | 0 | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition1RightMath | "+" | needs inspection | 0 source files | save wiring verified; chart output sign-off separate |
| condition2Enabled | false | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| condition3Enabled | false | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| condition4Enabled | false | generated control candidate | 0 source files | save wiring verified; chart output sign-off separate |
| combineMode | "and" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| advancedExpression | "C1 AND C2" | dialog source reference | 1 source files | source reference found; behavior pending|
| calculateOnClose | true | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| plotMode | "marker" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| markerPosition | "high" | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| alertsEnabled | false | dialog source reference | 6 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| markerColor | "#22C55E" | dialog source reference | 5 source files | save wiring verified; chart output sign-off separate |
| patternBackgroundColor | "#22C55E" | dialog source reference | 1 source files | save wiring verified; chart output sign-off separate |
| deepPatternBuilderSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Big Blocks

- [x] Add, disable, enable and remove (isolated actual component test)
- [x] Available controls across default tabs and discovered expandable panels exercised; conditional live combinations remain separate
- [x] Save, close, JSON restore and reopen
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumBars | 20 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| minimumDeltaPercent | 20 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| maximumDeltaPercent | 100 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| maximumDeltaEffort | 0 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| averageLength | 21 | numeric registry | 4 source files | save wiring verified; chart output sign-off separate |
| entryZoneRangePercent | 28 | numeric registry | 2 source files | save wiring verified; chart output sign-off separate |
| zoneBars | 22 | numeric registry | 3 source files | save wiring verified; chart output sign-off separate |
| zoneOpacity | 20 | numeric registry | 7 source files | save wiring verified; chart output sign-off separate |
| zoneLineWidth | 1 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| maLineWidth | 2 | numeric registry | 1 source files | save wiring verified; chart output sign-off separate |
| useThemeColors | true | dialog source reference | 74 source files | save wiring verified; chart output sign-off separate |
| showZones | true | dialog source reference | 8 source files | save wiring verified; chart output sign-off separate |
| showMovingAverage | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| askColor | "#22C55E" | dialog source reference | 25 source files | save wiring verified; chart output sign-off separate |
| bidColor | "#7C3AED" | dialog source reference | 24 source files | save wiring verified; chart output sign-off separate |
| maAboveColor | "#22C55E" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| maBelowColor | "#7C3AED" | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| maAutoColor | "price" | generated control candidate | 1 source files | source reference found; behavior pending|
| maLineStyle | "solid" | needs inspection | 1 source files | source reference found; behavior pending|
| shortName | "Big Blocks" | dialog source reference | 10 source files | source reference found; behavior pending|
| showNameLabel | false | generated control candidate | 2 source files | save wiring verified; chart output sign-off separate |
| showValueLabel | true | generated control candidate | 3 source files | save wiring verified; chart output sign-off separate |
| nameBackground | false | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| valueBackground | true | generated control candidate | 8 source files | save wiring verified; chart output sign-off separate |
| enableAlertSound | false | dialog source reference | 2 source files | save wiring verified; chart output sign-off separate |
| enableMessage | false | generated control candidate | 1 source files | save wiring verified; chart output sign-off separate |
| alertMessage | "Big Blocks directional bias changed" | needs inspection | 3 source files | source reference found; behavior pending|
| effortSettingsVersion | 5 | needs inspection | 0 source files | internal metadata|
