# Chart indicator control audit

Started 4 November 2026. This is the ongoing work list.

Source references establish a place to inspect. They do not establish that a button changes its intended output. Dynamic controls and shared keys require individual tracing.

## Tally

- Indicators inventoried — 124
- Default setting entries inventoried — 4302
- Entries without a literal runtime reference — 103
- Indicators fully behaviorally verified — 0
- Confirmed irreparable controls — 0
- Runtime and browser checks — pending

## Options Flow

### Big Blocks (Options)

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minContracts | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| minPremium | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| binSize | 0.25 | numeric registry | 8 source files | source reference found; behavior pending|
| windowMinutes | 0 | numeric registry | 10 source files | source reference found; behavior pending|
| maxLevels | 60 | numeric registry | 3 source files | source reference found; behavior pending|
| widthPx | 150 | numeric registry | 5 source files | source reference found; behavior pending|
| barHeight | 12 | numeric registry | 5 source files | source reference found; behavior pending|
| opacity | 85 | numeric registry | 165 source files | source reference found; behavior pending|
| useStrikePrice | false | generated control candidate | 1 source files | source reference found; behavior pending|
| sizeByPremium | false | generated control candidate | 2 source files | source reference found; behavior pending|
| includeMultiLeg | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showCalls | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showPuts | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showValues | true | dialog source reference | 9 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| callColor | "#22c55e" | dialog source reference | 6 source files | source reference found; behavior pending|
| putColor | "#ef4444" | dialog source reference | 6 source files | source reference found; behavior pending|

### Gamma Environment

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| position | "top-right" | dialog source reference | 116 source files | source reference found; behavior pending|
| sourceSymbol | "SPX" | dialog source reference | 28 source files | source reference found; behavior pending|
| showFreshness | true | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | false | dialog source reference | 74 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|
| badgeScale | 1 | dialog source reference | 1 source files | source reference found; behavior pending|
| gammaEnvironmentSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### Zero Gamma Line

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| sourceTicker | "AUTO" | dialog source reference | 20 source files | source reference found; behavior pending|
| historySessions | 5 | numeric registry | 4 source files | source reference found; behavior pending|
| refreshSeconds | 30 | numeric registry | 2 source files | source reference found; behavior pending|
| opacity | 72 | numeric registry | 165 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| lineColor | "#A3FF12" | dialog source reference | 58 source files | source reference found; behavior pending|
| showCurrentValue | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showRegimeHint | true | generated control candidate | 1 source files | source reference found; behavior pending|

### Options Delta

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| refreshSeconds | 60 | numeric registry | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|

### Zero Gamma Bars

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| refreshSeconds | 60 | numeric registry | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|

### Gamma Heatmap

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| historyHours | 24 | numeric registry | 3 source files | source reference found; behavior pending|
| binSize | 5 | numeric registry | 8 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| intensity | 1 | numeric registry | 15 source files | source reference found; behavior pending|
| refreshSeconds | 30 | numeric registry | 2 source files | source reference found; behavior pending|
| preset | "intraday" | dialog source reference | 38 source files | internal metadata|
| metric | "GAMMA" | dialog source reference | 44 source files | source reference found; behavior pending|
| viewMode | "net" | dialog source reference | 11 source files | source reference found; behavior pending|
| sourceMode | "hybrid" | dialog source reference | 3 source files | source reference found; behavior pending|
| optionsSource | "AUTO" | dialog source reference | 1 source files | source reference found; behavior pending|
| showHistorical | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showLevels | true | dialog source reference | 3 source files | source reference found; behavior pending|
| carryForwardFade | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showStatus | true | generated control candidate | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | source reference found; behavior pending|
| gammaHeatmapSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Net Gamma Exposure By Strike

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| refreshSeconds | 5 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumDte | 0 | numeric registry | 6 source files | source reference found; behavior pending|
| maximumDte | 7 | numeric registry | 6 source files | source reference found; behavior pending|
| customBinSizePoints | 1 | numeric registry | 5 source files | source reference found; behavior pending|
| minimumAbsoluteExposure | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumDistanceFromSourceSpot | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| laneWidthPercent | 24 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumLaneWidthPx | 220 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumLaneWidthPx | 420 | numeric registry | 2 source files | source reference found; behavior pending|
| floatingXPercent | 50 | numeric registry | 2 source files | source reference found; behavior pending|
| zeroSpinePercent | 50 | numeric registry | 2 source files | source reference found; behavior pending|
| fixedBarHeightPx | 9 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumBarHeightPx | 3 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumBarHeightPx | 24 | numeric registry | 2 source files | source reference found; behavior pending|
| barGapPx | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| horizontalPaddingPx | 8 | numeric registry | 2 source files | source reference found; behavior pending|
| scalePercentile | 98 | numeric registry | 3 source files | source reference found; behavior pending|
| fixedMaximum | 0 | numeric registry | 6 source files | source reference found; behavior pending|
| logarithmicStrength | 9 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumDisplayedRows | 80 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumPercentageOfTotal | 0.1 | numeric registry | 2 source files | source reference found; behavior pending|
| barOpacity | 100 | numeric registry | 3 source files | source reference found; behavior pending|
| borderOpacity | 100 | numeric registry | 3 source files | source reference found; behavior pending|
| borderWidth | 1 | numeric registry | 20 source files | source reference found; behavior pending|
| gradientStrength | 25 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumMappingConfidence | 70 | numeric registry | 2 source files | source reference found; behavior pending|
| preset | "balanced-net-gex" | dialog source reference | 38 source files | internal metadata|
| provider | "quantdata" | dialog source reference | 116 source files | source reference found; behavior pending|
| sourceTicker | "AUTO" | dialog source reference | 20 source files | source reference found; behavior pending|
| representation | "per-one-percent-move" | dialog source reference | 28 source files | source reference found; behavior pending|
| expirationMode | "zero-to-one-dte" | dialog source reference | 4 source files | source reference found; behavior pending|
| expirationDates | "" | dialog source reference | 7 source files | source reference found; behavior pending|
| includeWeeklies | true | dialog source reference | 6 source files | source reference found; behavior pending|
| includeMonthlies | true | dialog source reference | 6 source files | source reference found; behavior pending|
| includeQuarterlies | true | dialog source reference | 6 source files | source reference found; behavior pending|
| aggregationMode | "auto-bin" | dialog source reference | 7 source files | source reference found; behavior pending|
| placement | "floating" | dialog source reference | 39 source files | source reference found; behavior pending|
| spaceMode | "overlay" | needs inspection | 1 source files | source reference found; behavior pending|
| reverseDirections | false | generated control candidate | 2 source files | source reference found; behavior pending|
| barHeightMode | "automatic" | dialog source reference | 2 source files | source reference found; behavior pending|
| scaleMode | "visible-percentile" | dialog source reference | 8 source files | source reference found; behavior pending|
| scaleTransform | "square-root" | dialog source reference | 3 source files | source reference found; behavior pending|
| sharePositiveNegativeScale | true | generated control candidate | 2 source files | source reference found; behavior pending|
| contentMode | "net" | dialog source reference | 5 source files | source reference found; behavior pending|
| visualMode | "gradient" | dialog source reference | 5 source files | source reference found; behavior pending|
| showZeroSpine | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showValues | false | dialog source reference | 9 source files | source reference found; behavior pending|
| showMappedPrice | false | generated control candidate | 2 source files | source reference found; behavior pending|
| showMaxPositive | true | dialog source reference | 3 source files | source reference found; behavior pending|
| showMaxNegative | true | dialog source reference | 3 source files | source reference found; behavior pending|
| showDominantAbsolute | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showCallWall | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showPutWall | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showCurrentPrice | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | source reference found; behavior pending|
| showMappingConfidence | true | generated control candidate | 2 source files | source reference found; behavior pending|
| tooltipsEnabled | true | dialog source reference | 2 source files | source reference found; behavior pending|
| fadeWhenBelowMinimum | true | generated control candidate | 2 source files | source reference found; behavior pending|
| hideWhenBelowMinimum | false | generated control candidate | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|
| callColor | "#22C55E" | dialog source reference | 6 source files | source reference found; behavior pending|
| putColor | "#EF4444" | dialog source reference | 6 source files | source reference found; behavior pending|
| absoluteColor | "#8B5CF6" | generated control candidate | 2 source files | source reference found; behavior pending|
| zeroSpineColor | "#71717A" | generated control candidate | 2 source files | source reference found; behavior pending|
| warningColor | "#F59E0B" | generated control candidate | 6 source files | source reference found; behavior pending|
| netGammaSettingsVersion | 3 | needs inspection | 0 source files | internal metadata|

### GEX Interval Map

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| refreshSeconds | 5 | numeric registry | 2 source files | source reference found; behavior pending|
| rollingBuckets | 5 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumDte | 0 | numeric registry | 6 source files | source reference found; behavior pending|
| maximumDte | 7 | numeric registry | 6 source files | source reference found; behavior pending|
| customBinSizePoints | 1 | numeric registry | 5 source files | source reference found; behavior pending|
| minimumAbsoluteExposure | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumDistancePoints | 0 | numeric registry | 4 source files | source reference found; behavior pending|
| maximumPoints | 40000 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumStrikesPerBucket | 80 | numeric registry | 2 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| intensity | 1 | numeric registry | 15 source files | source reference found; behavior pending|
| minimumRadius | 3 | numeric registry | 4 source files | source reference found; behavior pending|
| maximumRadius | 18 | numeric registry | 4 source files | source reference found; behavior pending|
| bubbleStrokeWidth | 1.25 | numeric registry | 2 source files | source reference found; behavior pending|
| bubbleFillStrength | 12 | numeric registry | 2 source files | source reference found; behavior pending|
| trackWidth | 1.5 | numeric registry | 2 source files | source reference found; behavior pending|
| cellWidth | 10 | numeric registry | 6 source files | source reference found; behavior pending|
| fixedDotRadius | 3 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumOpacity | 10 | numeric registry | 9 source files | source reference found; behavior pending|
| maximumOpacity | 72 | numeric registry | 9 source files | source reference found; behavior pending|
| scalePercentile | 98 | numeric registry | 3 source files | source reference found; behavior pending|
| fixedMaximum | 1000000000 | numeric registry | 6 source files | source reference found; behavior pending|
| logStrength | 9 | numeric registry | 3 source files | source reference found; behavior pending|
| currentBucketScaleMultiplier | 115 | numeric registry | 2 source files | source reference found; behavior pending|
| currentBucketOpacityMultiplier | 115 | numeric registry | 2 source files | source reference found; behavior pending|
| mergeTolerancePoints | 1 | numeric registry | 4 source files | source reference found; behavior pending|
| alertExposureThreshold | 50000000 | numeric registry | 1 source files | source reference found; behavior pending|
| alertDistancePoints | 5 | numeric registry | 2 source files | source reference found; behavior pending|
| alertCooldownSeconds | 60 | numeric registry | 2 source files | source reference found; behavior pending|
| preset | "balanced-intraday" | dialog source reference | 38 source files | internal metadata|
| provider | "quantdata" | dialog source reference | 116 source files | source reference found; behavior pending|
| sourceTicker | "AUTO" | dialog source reference | 20 source files | source reference found; behavior pending|
| aggregationPeriod | "1m" | dialog source reference | 10 source files | source reference found; behavior pending|
| historyMode | "current-session" | dialog source reference | 1 source files | source reference found; behavior pending|
| sessionDate | "" | dialog source reference | 108 source files | source reference found; behavior pending|
| startTime | "" | dialog source reference | 57 source files | source reference found; behavior pending|
| endTime | "" | dialog source reference | 52 source files | source reference found; behavior pending|
| mode | "raw" | dialog source reference | 197 source files | source reference found; behavior pending|
| baseline | "previous-bucket" | dialog source reference | 54 source files | source reference found; behavior pending|
| expirationMode | "zero-to-one-dte" | dialog source reference | 4 source files | source reference found; behavior pending|
| expirationDates | "" | dialog source reference | 7 source files | source reference found; behavior pending|
| includeWeeklies | true | dialog source reference | 6 source files | source reference found; behavior pending|
| includeMonthlies | true | dialog source reference | 6 source files | source reference found; behavior pending|
| includeQuarterlies | true | dialog source reference | 6 source files | source reference found; behavior pending|
| aggregationMode | "auto-bin" | dialog source reference | 7 source files | source reference found; behavior pending|
| contentMode | "net" | dialog source reference | 5 source files | source reference found; behavior pending|
| visualMode | "bubbles" | dialog source reference | 5 source files | source reference found; behavior pending|
| scaleMode | "visible-percentile" | dialog source reference | 8 source files | source reference found; behavior pending|
| scaleTransform | "square-root" | dialog source reference | 3 source files | source reference found; behavior pending|
| highlightCurrentBucket | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showCurrentBucketOutline | true | dialog source reference | 2 source files | source reference found; behavior pending|
| hollowBubbles | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showLevelTracks | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showUnderlyingPriceLine | false | generated control candidate | 2 source files | source reference found; behavior pending|
| showMaxPositive | true | dialog source reference | 3 source files | source reference found; behavior pending|
| showMaxNegative | true | dialog source reference | 3 source files | source reference found; behavior pending|
| showDominantAbsolute | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showCallWall | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showPutWall | false | dialog source reference | 3 source files | source reference found; behavior pending|
| mergeCoincidentLabels | true | generated control candidate | 2 source files | source reference found; behavior pending|
| hideZeroValues | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showLevels | true | dialog source reference | 3 source files | source reference found; behavior pending|
| showValues | false | dialog source reference | 9 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | source reference found; behavior pending|
| showMappingConfidence | true | generated control candidate | 2 source files | source reference found; behavior pending|
| tooltipsEnabled | true | dialog source reference | 2 source files | source reference found; behavior pending|
| enableAlerts | false | dialog source reference | 6 source files | source reference found; behavior pending|
| alertNewLargePoint | true | dialog source reference | 1 source files | source reference found; behavior pending|
| alertLevelApproach | false | dialog source reference | 1 source files | source reference found; behavior pending|
| alertLevelTouch | false | dialog source reference | 1 source files | source reference found; behavior pending|
| browserNotifications | false | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|
| callColor | "#22C55E" | dialog source reference | 6 source files | source reference found; behavior pending|
| putColor | "#EF4444" | dialog source reference | 6 source files | source reference found; behavior pending|
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | source reference found; behavior pending|
| negativeExposurePalette | "neutral" | dialog source reference | 1 source files | source reference found; behavior pending|
| gexIntervalMapSettingsVersion | 3 | needs inspection | 0 source files | internal metadata|

### Bounce Levels

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumDte | 0 | numeric registry | 6 source files | source reference found; behavior pending|
| maximumDte | 7 | numeric registry | 6 source files | source reference found; behavior pending|
| maximumLevels | 8 | numeric registry | 3 source files | source reference found; behavior pending|
| topExposurePercent | 10 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumPercentOfKing | 15 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumRelevanceScore | 55 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumDistancePoints | 0 | numeric registry | 4 source files | source reference found; behavior pending|
| clusterDistancePoints | 25 | numeric registry | 3 source files | source reference found; behavior pending|
| airPocketRatio | 20 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumNodesPerSlice | 24 | numeric registry | 3 source files | source reference found; behavior pending|
| activeEnterThreshold | 15 | numeric registry | 3 source files | source reference found; behavior pending|
| activeExitThreshold | 8 | numeric registry | 3 source files | source reference found; behavior pending|
| retirementConfirmationSnapshots | 3 | numeric registry | 3 source files | source reference found; behavior pending|
| absoluteExposureScale | 1000000000 | numeric registry | 3 source files | source reference found; behavior pending|
| rollWeakeningThreshold | 40 | numeric registry | 3 source files | source reference found; behavior pending|
| rollBuildingThreshold | 40 | numeric registry | 3 source files | source reference found; behavior pending|
| maxRollDistance | 5 | numeric registry | 3 source files | source reference found; behavior pending|
| rollWindowSeconds | 120 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumGatekeepers | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumMajorNodes | 4 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumGatekeeperRelevance | 60 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumGatekeeperPercentOfKing | 20 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumClusterNodes | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumAirPocketWidthPercent | 0.3 | numeric registry | 3 source files | source reference found; behavior pending|
| magnitudeWeight | 45 | numeric registry | 3 source files | source reference found; behavior pending|
| proximityWeight | 15 | numeric registry | 6 source files | source reference found; behavior pending|
| accumulationWeight | 15 | numeric registry | 3 source files | source reference found; behavior pending|
| persistenceWeight | 10 | numeric registry | 4 source files | source reference found; behavior pending|
| freshnessWeight | 10 | numeric registry | 3 source files | source reference found; behavior pending|
| clusterWeight | 5 | numeric registry | 3 source files | source reference found; behavior pending|
| proximityDecayPercent | 3 | numeric registry | 3 source files | source reference found; behavior pending|
| developingMinimumPercentile | 75 | numeric registry | 3 source files | source reference found; behavior pending|
| developingMinimumGrowthPercent | 10 | numeric registry | 3 source files | source reference found; behavior pending|
| weakeningThresholdPercent | -10 | numeric registry | 3 source files | source reference found; behavior pending|
| weakeningRelevanceThreshold | 45 | numeric registry | 3 source files | source reference found; behavior pending|
| retirementRelevanceThreshold | 30 | numeric registry | 3 source files | source reference found; behavior pending|
| retirementExposurePercentile | 65 | numeric registry | 3 source files | source reference found; behavior pending|
| touchTolerancePercent | 0.05 | numeric registry | 3 source files | source reference found; behavior pending|
| touchDecayFactor | 85 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumNodeThickness | 2 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumNodeThickness | 18 | numeric registry | 2 source files | source reference found; behavior pending|
| lineOpacity | 100 | numeric registry | 5 source files | source reference found; behavior pending|
| minimumNodeOpacity | 8 | numeric registry | 1 source files | source reference found; behavior pending|
| exposureIntensity | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| glowStrength | 5 | numeric registry | 3 source files | source reference found; behavior pending|
| alertDistancePoints | 5 | numeric registry | 2 source files | source reference found; behavior pending|
| alertMinimumRelevance | 55 | numeric registry | 1 source files | source reference found; behavior pending|
| alertMinimumPercentOfKing | 15 | numeric registry | 1 source files | source reference found; behavior pending|
| alertMinimumExposure | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| alertMinimumRoc | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| alertCooldownSeconds | 60 | numeric registry | 2 source files | source reference found; behavior pending|
| gexMapMirror | true | dialog source reference | 2 source files | source reference found; behavior pending|
| linkGexMapSettings | true | generated control candidate | 3 source files | source reference found; behavior pending|
| mapExpiryScope | "FRONT_EXPIRY" | needs inspection | 2 source files | source reference found; behavior pending|
| mapRepresentation | "PER_ONE_DOLLAR_MOVE" | needs inspection | 2 source files | source reference found; behavior pending|
| mapExposureModel | "STRUCTURAL_OI" | needs inspection | 2 source files | source reference found; behavior pending|
| mapViewMode | "star" | needs inspection | 2 source files | source reference found; behavior pending|
| mapStepMinutes | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| preset | "balanced-intraday" | dialog source reference | 38 source files | internal metadata|
| provider | "quantdata" | dialog source reference | 116 source files | source reference found; behavior pending|
| sourceTicker | "AUTO" | dialog source reference | 20 source files | source reference found; behavior pending|
| priceMode | "live" | dialog source reference | 11 source files | source reference found; behavior pending|
| extendRight | false | dialog source reference | 30 source files | source reference found; behavior pending|
| greekMode | "GAMMA" | dialog source reference | 26 source files | source reference found; behavior pending|
| expirationMode | "front-expiration" | dialog source reference | 4 source files | source reference found; behavior pending|
| expirationDates | "" | dialog source reference | 7 source files | source reference found; behavior pending|
| historyBuckets | 1440 | needs inspection | 4 source files | source reference found; behavior pending|
| includeWeeklies | true | dialog source reference | 6 source files | source reference found; behavior pending|
| includeMonthlies | true | dialog source reference | 6 source files | source reference found; behavior pending|
| includeQuarterlies | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showHeader | false | dialog source reference | 10 source files | source reference found; behavior pending|
| showLabels | false | dialog source reference | 61 source files | source reference found; behavior pending|
| showValues | false | dialog source reference | 9 source files | source reference found; behavior pending|
| showAirPockets | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showKing | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showFloor | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showCeiling | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showGatekeepers | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showMajorNodes | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showClusters | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showDevelopingNodes | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showWeakeningNodes | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showRetiredHistory | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showTouchCount | true | dialog source reference | 2 source files | source reference found; behavior pending|
| microOrbTexture | true | generated control candidate | 3 source files | source reference found; behavior pending|
| visualStrengthBasis | "percent-of-king" | dialog source reference | 4 source files | source reference found; behavior pending|
| rollDetectionEnabled | true | generated control candidate | 3 source files | source reference found; behavior pending|
| rollVisualizationEnabled | false | generated control candidate | 3 source files | source reference found; behavior pending|
| tooltipsEnabled | true | dialog source reference | 2 source files | source reference found; behavior pending|
| enableAlerts | false | dialog source reference | 6 source files | source reference found; behavior pending|
| alertLevelApproach | true | dialog source reference | 1 source files | source reference found; behavior pending|
| alertLevelTouch | true | dialog source reference | 1 source files | source reference found; behavior pending|
| alertFreshNodesOnly | false | generated control candidate | 1 source files | source reference found; behavior pending|
| alertFirstTouchOnly | false | generated control candidate | 1 source files | source reference found; behavior pending|
| alertMapReshuffle | true | generated control candidate | 1 source files | source reference found; behavior pending|
| alertStructuralChanges | true | generated control candidate | 1 source files | source reference found; behavior pending|
| alertNodeTransitions | true | generated control candidate | 1 source files | source reference found; behavior pending|
| inAppSound | false | dialog source reference | 2 source files | source reference found; behavior pending|
| chartMarkers | true | generated control candidate | 1 source files | source reference found; behavior pending|
| browserNotifications | false | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| syncGexMapColors | true | dialog source reference | 2 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|
| kingColor | "#F59E0B" | dialog source reference | 1 source files | source reference found; behavior pending|
| developingColor | "#22C55E" | dialog source reference | 1 source files | source reference found; behavior pending|
| weakeningColor | "#EF4444" | dialog source reference | 1 source files | source reference found; behavior pending|
| airPocketColor | "#71717A" | dialog source reference | 1 source files | source reference found; behavior pending|
| bounceLevelsSettingsVersion | 6 | needs inspection | 0 source files | internal metadata|

### Dark Pool Map

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| historyDays | 2 | numeric registry | 8 source files | source reference found; behavior pending|
| pollSeconds | 2 | numeric registry | 4 source files | source reference found; behavior pending|
| minimumPrintNotional | 100000 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumPrintNotional | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumPrintShares | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumPrintShares | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumLevelNotional | 5000000 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumLevelShares | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumTradeCount | 1 | numeric registry | 5 source files | source reference found; behavior pending|
| topLevels | 50 | numeric registry | 4 source files | source reference found; behavior pending|
| minimumStrengthScore | 30 | numeric registry | 3 source files | source reference found; behavior pending|
| mappedBinPoints | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| sourceBinCents | 5 | numeric registry | 3 source files | source reference found; behavior pending|
| displayTickMultiple | 4 | numeric registry | 3 source files | source reference found; behavior pending|
| mergeTolerancePoints | 3 | numeric registry | 4 source files | source reference found; behavior pending|
| maximumZoneWidthPoints | 20 | numeric registry | 3 source files | source reference found; behavior pending|
| recencyHalfLifeHours | 24 | numeric registry | 3 source files | source reference found; behavior pending|
| sessionsForFullPersistenceScore | 5 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumHistoricalPrints | 100000 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumVisibleCircles | 2000 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumVisibleZones | 100 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumRadius | 3 | numeric registry | 4 source files | source reference found; behavior pending|
| maximumRadius | 18 | numeric registry | 4 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| zoneOpacity | 16 | numeric registry | 7 source files | source reference found; behavior pending|
| manualAlpha | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| manualBeta | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumMappingR2 | 0.95 | numeric registry | 3 source files | source reference found; behavior pending|
| mappingWindowMinutes | 60 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumMappingSamples | 120 | numeric registry | 3 source files | source reference found; behavior pending|
| staleAllowanceSeconds | 30 | numeric registry | 3 source files | source reference found; behavior pending|
| alertPrintNotional | 5000000 | numeric registry | 2 source files | source reference found; behavior pending|
| alertLevelNotional | 25000000 | numeric registry | 2 source files | source reference found; behavior pending|
| alertScore | 80 | numeric registry | 2 source files | source reference found; behavior pending|
| alertDistancePoints | 5 | numeric registry | 2 source files | source reference found; behavior pending|
| alertCooldownSeconds | 60 | numeric registry | 2 source files | source reference found; behavior pending|
| preset | "balanced" | dialog source reference | 38 source files | internal metadata|
| sourceTicker | "AUTO" | dialog source reference | 20 source files | source reference found; behavior pending|
| mappingMode | "rolling-affine" | dialog source reference | 6 source files | source reference found; behavior pending|
| visualMode | "circles-and-zones" | dialog source reference | 5 source files | source reference found; behavior pending|
| priceBinMode | "mapped-points" | dialog source reference | 3 source files | source reference found; behavior pending|
| mergeNearbyLevels | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showDelayedPrints | true | generated control candidate | 3 source files | source reference found; behavior pending|
| includeDelayedInLevels | true | generated control candidate | 3 source files | source reference found; behavior pending|
| includeAskSide | true | generated control candidate | 3 source files | source reference found; behavior pending|
| includeBidSide | true | generated control candidate | 3 source files | source reference found; behavior pending|
| includeMid | true | generated control candidate | 3 source files | source reference found; behavior pending|
| includeUnknown | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showLevelLabels | true | dialog source reference | 7 source files | source reference found; behavior pending|
| showMappingBadge | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showMappingConfidence | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showLevelTable | false | dialog source reference | 2 source files | source reference found; behavior pending|
| enableAlerts | false | dialog source reference | 6 source files | source reference found; behavior pending|
| alertNewLargePrint | true | generated control candidate | 2 source files | source reference found; behavior pending|
| alertNewLargeLevel | true | generated control candidate | 2 source files | source reference found; behavior pending|
| alertScoreThreshold | true | generated control candidate | 2 source files | source reference found; behavior pending|
| alertPriceApproach | false | generated control candidate | 2 source files | source reference found; behavior pending|
| alertPriceTouch | false | generated control candidate | 2 source files | source reference found; behavior pending|
| browserNotifications | false | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | source reference found; behavior pending|
| askSideColor | "#22C55E" | generated control candidate | 3 source files | source reference found; behavior pending|
| bidSideColor | "#EF4444" | generated control candidate | 3 source files | source reference found; behavior pending|
| midColor | "#A1A1AA" | dialog source reference | 6 source files | source reference found; behavior pending|
| delayedColor | "#F59E0B" | generated control candidate | 3 source files | source reference found; behavior pending|
| darkPoolMapSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Dark Pool (GEX)

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookbackDays | 30 | numeric registry | 6 source files | source reference found; behavior pending|
| topN | 5 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumNotional | 1000000 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumNotional | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumShares | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumShares | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumSharePrice | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| maximumSharePrice | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| tolerance | 0.15 | numeric registry | 19 source files | source reference found; behavior pending|
| interactionTolerance | 0.03 | numeric registry | 2 source files | source reference found; behavior pending|
| resetDistance | 0.1 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumTimeOutsideMs | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| reactionThreshold | 0.1 | numeric registry | 4 source files | source reference found; behavior pending|
| maximumConfirmationBars | 20 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumReactionDurationMs | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| breakDistance | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| breakTimeBeyondMs | 60000 | numeric registry | 2 source files | source reference found; behavior pending|
| volumeThreshold | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| reclaimConfirmationCloses | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumTimeBeyondBeforeReclaimMs | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| reactionHorizonBars | 20 | numeric registry | 2 source files | source reference found; behavior pending|
| reactionHorizonMs | 1800000 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumResearchSamples | 3 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumStatsSamples | 3 | numeric registry | 2 source files | source reference found; behavior pending|
| activationRadiusPercent | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| qualityPrecisionWeight | 20 | numeric registry | 2 source files | source reference found; behavior pending|
| qualityExcursionWeight | 25 | numeric registry | 2 source files | source reference found; behavior pending|
| qualityEfficiencyWeight | 20 | numeric registry | 2 source files | source reference found; behavior pending|
| qualitySpeedWeight | 15 | numeric registry | 2 source files | source reference found; behavior pending|
| qualityFreshnessWeight | 10 | numeric registry | 2 source files | source reference found; behavior pending|
| qualityGexWeight | 10 | numeric registry | 2 source files | source reference found; behavior pending|
| clusterDistance | 0.12 | numeric registry | 4 source files | source reference found; behavior pending|
| minimumClusterPrints | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumClusterNotional | 5000000 | numeric registry | 1 source files | source reference found; behavior pending|
| bandThickness | 2 | numeric registry | 2 source files | source reference found; behavior pending|
| bandOpacity | 100 | numeric registry | 2 source files | source reference found; behavior pending|
| originMarkerSize | 7 | numeric registry | 2 source files | source reference found; behavior pending|
| haloIntensity | 18 | numeric registry | 2 source files | source reference found; behavior pending|
| kingBoost | 30 | numeric registry | 2 source files | source reference found; behavior pending|
| ageFadeHalfLifeDays | 30 | numeric registry | 1 source files | source reference found; behavior pending|
| proximityDistance | 0.15 | numeric registry | 2 source files | source reference found; behavior pending|
| refreshSeconds | 5 | numeric registry | 2 source files | source reference found; behavior pending|
| alertPrintNotional | 5000000 | numeric registry | 2 source files | source reference found; behavior pending|
| alertConfluence | 75 | numeric registry | 1 source files | source reference found; behavior pending|
| alertCooldownSeconds | 60 | numeric registry | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| lookbackMode | "calendar-days" | dialog source reference | 1 source files | source reference found; behavior pending|
| sortMode | "notional" | dialog source reference | 2 source files | source reference found; behavior pending|
| viewPreset | "raw-dp-levels" | dialog source reference | 1 source files | internal metadata|
| precisionMode | true | dialog source reference | 1 source files | source reference found; behavior pending|
| contextMode | "current" | dialog source reference | 2 source files | source reference found; behavior pending|
| confluenceMode | "king-and-major" | dialog source reference | 1 source files | source reference found; behavior pending|
| toleranceMode | "percentage" | dialog source reference | 1 source files | source reference found; behavior pending|
| displayMode | "raw" | dialog source reference | 9 source files | source reference found; behavior pending|
| clusterEnabled | false | dialog source reference | 2 source files | source reference found; behavior pending|
| clusterDistanceMode | "percentage" | dialog source reference | 1 source files | source reference found; behavior pending|
| proxyMode | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showOriginMarker | false | generated control candidate | 2 source files | source reference found; behavior pending|
| showForwardMemory | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showExactLine | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| labelExtended | false | generated control candidate | 2 source files | source reference found; behavior pending|
| showReactionMarkers | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showHoldMarkers | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showBreakMarkers | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showReclaimMarkers | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showReactionTrail | false | generated control candidate | 2 source files | source reference found; behavior pending|
| showInteractionZone | false | generated control candidate | 1 source files | source reference found; behavior pending|
| reactionAnalytics | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showReactionResearch | false | dialog source reference | 2 source files | source reference found; behavior pending|
| interactionToleranceMode | "percentage" | dialog source reference | 2 source files | source reference found; behavior pending|
| resetDistanceMode | "percentage" | dialog source reference | 2 source files | source reference found; behavior pending|
| reactionThresholdMode | "percentage" | dialog source reference | 2 source files | source reference found; behavior pending|
| breakDistanceMode | "ticks" | dialog source reference | 2 source files | source reference found; behavior pending|
| breakConfirmation | "1-close" | dialog source reference | 2 source files | source reference found; behavior pending|
| interactionSession | "regular-hours" | dialog source reference | 2 source files | source reference found; behavior pending|
| useIntrabarHighLow | true | generated control candidate | 2 source files | source reference found; behavior pending|
| requireCloseAwayFromLevel | false | generated control candidate | 2 source files | source reference found; behavior pending|
| useVolumeConfirmation | false | generated control candidate | 2 source files | source reference found; behavior pending|
| enableReclaimDetection | true | generated control candidate | 2 source files | source reference found; behavior pending|
| firstTouchOnly | false | dialog source reference | 2 source files | source reference found; behavior pending|
| includeLateReports | true | dialog source reference | 1 source files | source reference found; behavior pending|
| includeCorrectedPrints | true | dialog source reference | 1 source files | source reference found; behavior pending|
| excludeCanceled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showTooltip | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showInspector | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showFreshness | true | dialog source reference | 2 source files | source reference found; behavior pending|
| ageFade | false | generated control candidate | 3 source files | source reference found; behavior pending|
| proximityEmphasis | true | generated control candidate | 2 source files | source reference found; behavior pending|
| performanceQuality | "auto" | dialog source reference | 1 source files | source reference found; behavior pending|
| enableAlerts | false | dialog source reference | 6 source files | source reference found; behavior pending|
| alertNewPrint | true | generated control candidate | 1 source files | source reference found; behavior pending|
| alertPriceApproach | false | generated control candidate | 2 source files | source reference found; behavior pending|
| alertPriceTouch | false | generated control candidate | 2 source files | source reference found; behavior pending|
| alertHoldConfirmed | true | generated control candidate | 1 source files | source reference found; behavior pending|
| alertBreakConfirmed | true | generated control candidate | 1 source files | source reference found; behavior pending|
| alertReclaimConfirmed | true | generated control candidate | 1 source files | source reference found; behavior pending|
| alertGexConfluence | true | generated control candidate | 1 source files | source reference found; behavior pending|
| browserNotifications | false | dialog source reference | 2 source files | source reference found; behavior pending|
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | source reference found; behavior pending|
| positiveGexColor | "#22C55E" | generated control candidate | 2 source files | source reference found; behavior pending|
| negativeGexColor | "#EF4444" | generated control candidate | 2 source files | source reference found; behavior pending|
| darkPoolGexSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### Implied Volatility Rank

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookBackPeriodDays | 252 | numeric registry | 6 source files | source reference found; behavior pending|
| targetMaturityDays | 30 | numeric registry | 6 source files | source reference found; behavior pending|
| refreshSeconds | 15 | numeric registry | 2 source files | source reference found; behavior pending|
| staleAfterSeconds | 90 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumForwardFillMinutes | 5 | numeric registry | 5 source files | source reference found; behavior pending|
| paneHeight | 220 | numeric registry | 11 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| priceLineWidth | 1.5 | numeric registry | 2 source files | source reference found; behavior pending|
| decimalPrecision | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| lowThreshold | 20 | numeric registry | 1 source files | source reference found; behavior pending|
| middleThreshold | 50 | numeric registry | 1 source files | source reference found; behavior pending|
| highThreshold | 80 | numeric registry | 4 source files | source reference found; behavior pending|
| preset | "balanced-30d" | dialog source reference | 38 source files | internal metadata|
| provider | "quantdata" | dialog source reference | 116 source files | source reference found; behavior pending|
| sourceTicker | "AUTO" | dialog source reference | 20 source files | source reference found; behavior pending|
| contractMode | "average-call-put" | dialog source reference | 6 source files | source reference found; behavior pending|
| placement | "separate-pane" | dialog source reference | 39 source files | source reference found; behavior pending|
| showIvRank | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showIvPercentile | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showRawIv | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showPriceOverlay | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showRegimeBands | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | source reference found; behavior pending|
| showLegend | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showCurrentBadge | true | dialog source reference | 1 source files | source reference found; behavior pending|
| breakAtMissingData | true | dialog source reference | 1 source files | source reference found; behavior pending|
| carryLastValid | true | dialog source reference | 3 source files | source reference found; behavior pending|
| useLiveIntradayIv | true | dialog source reference | 5 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| rankColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| percentileColor | "#8B5CF6" | generated control candidate | 1 source files | source reference found; behavior pending|
| callColor | "#22C55E" | dialog source reference | 6 source files | source reference found; behavior pending|
| putColor | "#EF4444" | dialog source reference | 6 source files | source reference found; behavior pending|
| priceColor | "#E5E7EB" | generated control candidate | 4 source files | source reference found; behavior pending|
| lowBandColor | "#EF4444" | generated control candidate | 1 source files | source reference found; behavior pending|
| middleBandColor | "#71717A" | generated control candidate | 1 source files | source reference found; behavior pending|
| highBandColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| ivRankSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

## Order Flow

### Cumulative Volume Delta

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| periodValue | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| filterMinVolume | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| filterMaxVolume | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| zeroLineWidth | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| displayStyle | "candles" | dialog source reference | 7 source files | source reference found; behavior pending|
| inputData | "Volumes" | dialog source reference | 15 source files | source reference found; behavior pending|
| periodMode | "days" | dialog source reference | 9 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| cvdSettingsVersion | 5 | needs inspection | 0 source files | internal metadata|
| showName | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showValue | true | generated control candidate | 3 source files | source reference found; behavior pending|
| customName | "Cumulative Volume Delta" | dialog source reference | 1 source files | source reference found; behavior pending|
| showBidAskVolumes | false | generated control candidate | 1 source files | source reference found; behavior pending|
| filteredEnabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| filteredSeparateAxis | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showZeroLine | true | generated control candidate | 6 source files | source reference found; behavior pending|
| deltaAskColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| deltaBidColor | "#EF4444" | generated control candidate | 1 source files | source reference found; behavior pending|
| volumeAskColor | "#34D399" | generated control candidate | 1 source files | source reference found; behavior pending|
| volumeBidColor | "#F87171" | generated control candidate | 1 source files | source reference found; behavior pending|
| filteredAskColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| filteredBidColor | "#EF4444" | generated control candidate | 1 source files | source reference found; behavior pending|
| zeroLineColor | "#52525B" | generated control candidate | 5 source files | source reference found; behavior pending|

### CVD Divergence

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| bullishColor | "#22C55E" | generated control candidate | 8 source files | source reference found; behavior pending|
| bearishColor | "#EF4444" | generated control candidate | 8 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| pivotStrength | 2 | numeric registry | 5 source files | source reference found; behavior pending|
| lookbackBars | 300 | numeric registry | 8 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|

### Pulling & Stacking

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| aggregationMs | 250 | numeric registry | 3 source files | source reference found; behavior pending|
| rollingWindowMs | 10000 | numeric registry | 2 source files | source reference found; behavior pending|
| eventMergeGapMs | 75 | numeric registry | 1 source files | source reference found; behavior pending|
| postSnapshotWarmupMs | 3000 | numeric registry | 3 source files | source reference found; behavior pending|
| baselineWarmupMs | 20000 | numeric registry | 3 source files | source reference found; behavior pending|
| historySeconds | 300 | numeric registry | 5 source files | source reference found; behavior pending|
| baselineWindowMs | 60000 | numeric registry | 4 source files | source reference found; behavior pending|
| baselineSampleLimit | 4000 | numeric registry | 5 source files | source reference found; behavior pending|
| minimumBaselineSamples | 30 | numeric registry | 4 source files | source reference found; behavior pending|
| minimumContracts | 25 | numeric registry | 2 source files | source reference found; behavior pending|
| relativeThreshold | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| selectedPercentile | 0.9 | numeric registry | 3 source files | source reference found; behavior pending|
| scoreThreshold | 65 | numeric registry | 5 source files | source reference found; behavior pending|
| markerMinimumScore | 65 | numeric registry | 2 source files | source reference found; behavior pending|
| visibleTicks | 120 | numeric registry | 2 source files | source reference found; behavior pending|
| profileWidthPercent | 13 | numeric registry | 7 source files | source reference found; behavior pending|
| minimumProfileWidthPx | 110 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumProfileWidthPx | 280 | numeric registry | 2 source files | source reference found; behavior pending|
| latestWindowMs | 1000 | numeric registry | 1 source files | source reference found; behavior pending|
| lowerPaneHeight | 160 | numeric registry | 4 source files | source reference found; behavior pending|
| markerSize | 7 | numeric registry | 22 source files | source reference found; behavior pending|
| maximumEvents | 1000 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumBuckets | 4000 | numeric registry | 3 source files | source reference found; behavior pending|
| staleAfterMs | 5000 | numeric registry | 5 source files | source reference found; behavior pending|
| markerRetentionMs | 300000 | numeric registry | 4 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| minimumOpacity | 0.025 | numeric registry | 9 source files | source reference found; behavior pending|
| maximumOpacity | 0.42 | numeric registry | 9 source files | source reference found; behavior pending|
| minimumCellHeightPx | 2 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumCellHeightPx | 24 | numeric registry | 2 source files | source reference found; behavior pending|
| wallMinimumContracts | 150 | numeric registry | 1 source files | source reference found; behavior pending|
| wallMinimumLevels | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| wallMaximumGapTicks | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| wallBuildWindowMs | 500 | numeric registry | 1 source files | source reference found; behavior pending|
| wallMinimumRelativeMultiplier | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| wallMinimumScore | 65 | numeric registry | 1 source files | source reference found; behavior pending|
| wallPersistenceMs | 250 | numeric registry | 1 source files | source reference found; behavior pending|
| collapseWindowMs | 1500 | numeric registry | 1 source files | source reference found; behavior pending|
| collapseMinimumPulledContracts | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| collapseMinimumRatio | 0.6 | numeric registry | 1 source files | source reference found; behavior pending|
| collapseMaximumExecutedRatio | 0.25 | numeric registry | 1 source files | source reference found; behavior pending|
| vacuumMinimumLevels | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| vacuumMinimumContracts | 200 | numeric registry | 1 source files | source reference found; behavior pending|
| vacuumMaximumGapTicks | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| vacuumWindowMs | 300 | numeric registry | 1 source files | source reference found; behavior pending|
| vacuumMinimumDepthRemovalRatio | 0.5 | numeric registry | 1 source files | source reference found; behavior pending|
| vacuumMinimumScore | 70 | numeric registry | 1 source files | source reference found; behavior pending|
| repostWindowMs | 1000 | numeric registry | 1 source files | source reference found; behavior pending|
| repostPriceToleranceTicks | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| repostSizeTolerance | 0.3 | numeric registry | 1 source files | source reference found; behavior pending|
| repostMinimumQuantity | 50 | numeric registry | 1 source files | source reference found; behavior pending|
| repostMinimumScore | 65 | numeric registry | 1 source files | source reference found; behavior pending|
| alertCooldownMs | 5000 | numeric registry | 3 source files | source reference found; behavior pending|
| preset | "balanced" | dialog source reference | 38 source files | internal metadata|
| classificationMode | "price-level" | dialog source reference | 2 source files | source reference found; behavior pending|
| moveHandling | "separate-move" | dialog source reference | 1 source files | source reference found; behavior pending|
| aggregationMode | "fixed-window" | dialog source reference | 7 source files | source reference found; behavior pending|
| renderMode | "hybrid" | dialog source reference | 5 source files | source reference found; behavior pending|
| lowerPaneMode | "directional-pressure" | dialog source reference | 2 source files | source reference found; behavior pending|
| baselineBuckets | 60 | needs inspection | 1 source files | source reference found; behavior pending|
| currentProfileWidth | 156 | needs inspection | 1 source files | source reference found; behavior pending|
| includeOwnOrders | false | generated control candidate | 2 source files | source reference found; behavior pending|
| includeImpliedOrders | false | generated control candidate | 2 source files | source reference found; behavior pending|
| bidEnabled | true | dialog source reference | 1 source files | source reference found; behavior pending|
| askEnabled | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showHeatCells | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showRibbons | false | dialog source reference | 2 source files | source reference found; behavior pending|
| showEventMarkers | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showCurrentProfile | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showLiveDepth | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showLowerPane | false | dialog source reference | 9 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | source reference found; behavior pending|
| showTooltips | true | dialog source reference | 7 source files | source reference found; behavior pending|
| showWallBuild | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showWallCollapse | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showLiquidityVacuum | true | dialog source reference | 2 source files | source reference found; behavior pending|
| pullRepostEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| enableAlerts | false | dialog source reference | 6 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| bidStackColor | "#22C55E" | generated control candidate | 3 source files | source reference found; behavior pending|
| askStackColor | "#EF4444" | generated control candidate | 3 source files | source reference found; behavior pending|
| bidPullColor | "#F59E0B" | generated control candidate | 2 source files | source reference found; behavior pending|
| askPullColor | "#38BDF8" | generated control candidate | 3 source files | source reference found; behavior pending|
| moveColor | "#A78BFA" | generated control candidate | 1 source files | source reference found; behavior pending|
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | source reference found; behavior pending|
| pullingStackingSettingsVersion | 2 | needs inspection | 1 source files | internal metadata|

### Delta Bar

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| ladderWidthPx | 150 | numeric registry | 1 source files | source reference found; behavior pending|
| ladderEdgeGapPx | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| ladderLevelSpacingPx | 22 | numeric registry | 1 source files | source reference found; behavior pending|
| ladderOpacity | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| ladderFontSize | 8 | numeric registry | 1 source files | source reference found; behavior pending|
| displayMode | "pane" | dialog source reference | 9 source files | source reference found; behavior pending|
| showLadderValues | true | dialog source reference | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| buyColor | "#22C55E" | dialog source reference | 12 source files | source reference found; behavior pending|
| sellColor | "#EF4444" | dialog source reference | 12 source files | source reference found; behavior pending|
| spineColor | "#6B7280" | generated control candidate | 2 source files | source reference found; behavior pending|

### Delta % Highlight

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minValue | 50 | numeric registry | 3 source files | source reference found; behavior pending|
| maxValue | 0 | numeric registry | 5 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| markerSize | 1 | numeric registry | 22 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showAsk | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showBid | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showValue | true | generated control candidate | 3 source files | source reference found; behavior pending|
| markerShape | "square" | dialog source reference | 2 source files | source reference found; behavior pending|
| markerPosition | "inBar" | dialog source reference | 2 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| deltaHighlightSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Delta Cumulative Candlestick

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| filterMinVolume | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| filterMaxVolume | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| sessionStartHour | 17 | numeric registry | 3 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| averageLength | 20 | numeric registry | 4 source files | source reference found; behavior pending|
| averageLineWidth | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| averageDeviation | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| zeroLineWidth | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| inputData | "Volumes" | dialog source reference | 15 source files | source reference found; behavior pending|
| resetToSession | true | generated control candidate | 1 source files | source reference found; behavior pending|
| displayStyle | "candles" | dialog source reference | 7 source files | source reference found; behavior pending|
| candleStyle | "candlestick" | dialog source reference | 4 source files | source reference found; behavior pending|
| showAverage | false | dialog source reference | 5 source files | source reference found; behavior pending|
| averageType | "simple" | dialog source reference | 4 source files | source reference found; behavior pending|
| averageLineStyle | "solid" | dialog source reference | 1 source files | source reference found; behavior pending|
| showAverageDeviations | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showZeroLine | true | generated control candidate | 6 source files | source reference found; behavior pending|
| showName | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showValue | true | generated control candidate | 3 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| deltaAskColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| deltaBidColor | "#EF4444" | generated control candidate | 1 source files | source reference found; behavior pending|
| averageColor | "#60A5FA" | generated control candidate | 3 source files | source reference found; behavior pending|
| deviationColor | "#71717A" | generated control candidate | 3 source files | source reference found; behavior pending|
| zeroLineColor | "#52525B" | generated control candidate | 5 source files | source reference found; behavior pending|
| cumulativeCandlestickSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Delta Cumulative Histogram

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| filterMinVolume | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| filterMaxVolume | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| sessionStartHour | 17 | numeric registry | 3 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| zeroLineWidth | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| inputData | "Volumes" | dialog source reference | 15 source files | source reference found; behavior pending|
| resetToSession | true | generated control candidate | 1 source files | source reference found; behavior pending|
| displayStyle | "bars" | dialog source reference | 7 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| showName | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showValue | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showZeroLine | true | generated control candidate | 6 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| customName | "Cumulative Delta Histogram" | dialog source reference | 1 source files | source reference found; behavior pending|
| deltaAskColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| deltaBidColor | "#EF4444" | generated control candidate | 1 source files | source reference found; behavior pending|
| lineColor | "#60A5FA" | dialog source reference | 58 source files | source reference found; behavior pending|
| zeroLineColor | "#52525B" | generated control candidate | 5 source files | source reference found; behavior pending|
| cumulativeHistogramSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Imbalance Tracker

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumPercent | 400 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumDelta | 0 | numeric registry | 4 source files | source reference found; behavior pending|
| minimumConsecutive | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| tickGroupingTicks | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| extendedBars | 10 | numeric registry | 7 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| zonesExtraTicks | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| calculationMode | "diagonal" | dialog source reference | 3 source files | source reference found; behavior pending|
| includeZero | false | dialog source reference | 5 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| resetMode | "none" | dialog source reference | 7 source files | source reference found; behavior pending|
| showTriggered | true | dialog source reference | 7 source files | source reference found; behavior pending|
| triggerOnlyTouch | false | dialog source reference | 1 source files | source reference found; behavior pending|
| enableAlertSound | false | dialog source reference | 2 source files | source reference found; behavior pending|
| alertName | "Imbalance detected" | dialog source reference | 8 source files | source reference found; behavior pending|
| enablePopup | false | dialog source reference | 2 source files | source reference found; behavior pending|
| popupMessage | "Imbalance tracker" | dialog source reference | 2 source files | source reference found; behavior pending|
| filterTime | "none" | dialog source reference | 13 source files | source reference found; behavior pending|
| sessionStart | "09:30" | dialog source reference | 8 source files | source reference found; behavior pending|
| sessionEnd | "16:00" | dialog source reference | 7 source files | source reference found; behavior pending|
| buyColor | "#22C55E" | dialog source reference | 12 source files | source reference found; behavior pending|
| sellColor | "#EF4444" | dialog source reference | 12 source files | source reference found; behavior pending|
| buyTriggeredColor | "#86EFAC" | generated control candidate | 2 source files | source reference found; behavior pending|
| sellTriggeredColor | "#FCA5A5" | generated control candidate | 2 source files | source reference found; behavior pending|
| imbalanceTrackerSettingsVersion | 3 | needs inspection | 0 source files | internal metadata|

### Imbalance Rejector

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumPercent | 300 | numeric registry | 3 source files | source reference found; behavior pending|
| comparisonDepth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| lookbackPeriod | 5 | numeric registry | 1 source files | source reference found; behavior pending|
| tickOffset | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| markerSize | 8 | numeric registry | 22 source files | source reference found; behavior pending|
| markerThickness | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| includeZero | false | dialog source reference | 5 source files | source reference found; behavior pending|
| confirmedOnly | true | generated control candidate | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| markerType | "triangle" | needs inspection | 2 source files | source reference found; behavior pending|
| bullishColor | "#22C55E" | generated control candidate | 8 source files | source reference found; behavior pending|
| bearishColor | "#EF4444" | generated control candidate | 8 source files | source reference found; behavior pending|
| imbalanceRejectorSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Unfinished Auction

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| daysToLoad | 5 | numeric registry | 7 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| opacity | 22 | numeric registry | 165 source files | source reference found; behavior pending|
| manualMinimumVolume | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| customStartMinutes | 510 | numeric registry | 10 source files | source reference found; behavior pending|
| customEndMinutes | 900 | numeric registry | 10 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| badHighColor | "#EF4444" | dialog source reference | 3 source files | source reference found; behavior pending|
| badLowColor | "#22C55E" | dialog source reference | 3 source files | source reference found; behavior pending|
| showRectangle | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showBackground | true | dialog source reference | 7 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| extendLines | true | generated control candidate | 33 source files | source reference found; behavior pending|
| resetMode | "session-open" | dialog source reference | 7 source files | source reference found; behavior pending|
| removeOnShadowTouch | true | generated control candidate | 2 source files | source reference found; behavior pending|
| filterTime | "none" | dialog source reference | 13 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### Bar POC Indicator

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| daysToLoad | 5 | numeric registry | 7 source files | source reference found; behavior pending|
| filterMin | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| filterMax | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| autoStdDev | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| manualMinimumVolume | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| rthAutoStdDev | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| rthManualMinimumVolume | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| rthStartMinutes | 510 | numeric registry | 4 source files | source reference found; behavior pending|
| rectangleLineWidth | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| backgroundOpacity | 22 | numeric registry | 9 source files | source reference found; behavior pending|
| extensionLineWidth | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| maxBarsExtension | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| tickMarginBreakout | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| durationFontSize | 9 | numeric registry | 2 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| rthFilterWindow | "disabled" | dialog source reference | 1 source files | source reference found; behavior pending|
| rthFilterMode | "none" | dialog source reference | 2 source files | source reference found; behavior pending|
| showRectangle | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showBackground | true | dialog source reference | 7 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| extendPoc | true | generated control candidate | 2 source files | source reference found; behavior pending|
| resetOnNewDay | false | generated control candidate | 1 source files | source reference found; behavior pending|
| removeOnShadowTouch | true | generated control candidate | 2 source files | source reference found; behavior pending|
| hideLineOnBreakout | false | generated control candidate | 2 source files | source reference found; behavior pending|
| showDuration | false | generated control candidate | 3 source files | source reference found; behavior pending|
| durationTextColor | "#A1A1AA" | dialog source reference | 3 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### Dynamic POC

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| periodValue | 20 | numeric registry | 3 source files | source reference found; behavior pending|
| firstEnvelope | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| secondEnvelope | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| thirdEnvelope | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| envelopeLineWidth | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| periodMode | "bars" | dialog source reference | 9 source files | source reference found; behavior pending|
| envelopeMode | "standard-deviation" | dialog source reference | 2 source files | source reference found; behavior pending|
| showPoc | true | dialog source reference | 13 source files | source reference found; behavior pending|
| showFirstEnvelope | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showSecondEnvelope | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showThirdEnvelope | true | generated control candidate | 2 source files | source reference found; behavior pending|
| pocColor | "#22D3EE" | dialog source reference | 21 source files | source reference found; behavior pending|
| firstEnvelopeColor | "#A3E635" | dialog source reference | 3 source files | source reference found; behavior pending|
| secondEnvelopeColor | "#F59E0B" | dialog source reference | 3 source files | source reference found; behavior pending|
| thirdEnvelopeColor | "#EF4444" | dialog source reference | 3 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### Speed of Tape

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| database | "volume" | dialog source reference | 17 source files | source reference found; behavior pending|
| filterMin | 1 | numeric registry | 12 source files | source reference found; behavior pending|
| filterMax | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| numberSeconds | 10 | numeric registry | 2 source files | source reference found; behavior pending|
| standardDeviationPerFilter | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| paneHeight | 190 | numeric registry | 11 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| bullBorderColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| bullFillColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| bearBorderColor | "#EF4444" | generated control candidate | 1 source files | source reference found; behavior pending|
| bearFillColor | "#EF4444" | generated control candidate | 1 source files | source reference found; behavior pending|
| speedOfTapeSettingsVersion | 1 | dialog source reference | 1 source files | internal metadata|

### Speed of Tape (Instant)

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| filterMin | 1 | numeric registry | 12 source files | source reference found; behavior pending|
| filterMax | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| numberOfSeconds | 10 | numeric registry | 2 source files | source reference found; behavior pending|
| barsToShow | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| scaleMinValue | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| textSize | 10 | numeric registry | 11 source files | source reference found; behavior pending|
| standardDeviationLookback | 60 | numeric registry | 1 source files | source reference found; behavior pending|
| settingsVersion | 2 | needs inspection | 1 source files | internal metadata|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| displayValue | "total" | dialog source reference | 3 source files | source reference found; behavior pending|
| plotReversed | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showStandardDeviations | true | generated control candidate | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| positiveBorderColor | "#22C55E" | generated control candidate | 3 source files | source reference found; behavior pending|
| positiveFillColor | "#22C55E" | generated control candidate | 3 source files | source reference found; behavior pending|
| negativeBorderColor | "#EF4444" | generated control candidate | 3 source files | source reference found; behavior pending|
| negativeFillColor | "#EF4444" | generated control candidate | 3 source files | source reference found; behavior pending|
| textEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| textColor | "#F8FAFC" | dialog source reference | 58 source files | source reference found; behavior pending|

### Volume/Delta Sprint

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| filterMin | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| filterMax | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| length | 10 | numeric registry | 669 source files | source reference found; behavior pending|
| deltaColorMode | "fading" | dialog source reference | 1 source files | source reference found; behavior pending|
| smoothingEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| smoothingType | "simple" | dialog source reference | 1 source files | source reference found; behavior pending|
| smoothingLength | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| showDelta | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showBid | false | dialog source reference | 2 source files | source reference found; behavior pending|
| showAsk | false | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| lineWidth | 3 | numeric registry | 142 source files | source reference found; behavior pending|
| shortName | "Volume/Delta Sprint" | dialog source reference | 10 source files | source reference found; behavior pending|

### Tape Speed & Order-Flow Burst

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| rollingWindowMs | 1000 | numeric registry | 2 source files | source reference found; behavior pending|
| updateStepMs | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| fixedBucketMs | 1000 | numeric registry | 1 source files | source reference found; behavior pending|
| maximumInterTradeGapMs | 75 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumEventDurationMs | 2000 | numeric registry | 1 source files | source reference found; behavior pending|
| baselineWindowMs | 120000 | numeric registry | 4 source files | source reference found; behavior pending|
| minimumBaselineSamples | 30 | numeric registry | 4 source files | source reference found; behavior pending|
| selectedPercentile | 0.9 | numeric registry | 3 source files | source reference found; behavior pending|
| relativeSpeedMultiplier | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| relativeDeltaMultiplier | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumContractsPerSecond | 100 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumTradesPerSecond | 5 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumAbsoluteDeltaPerSecond | 50 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumQuantity | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumTradeCount | 3 | numeric registry | 5 source files | source reference found; behavior pending|
| minimumDirectionalShare | 0.7 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumDirectionalDelta | 25 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumQualityScore | 60 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumMarkerScore | 70 | numeric registry | 2 source files | source reference found; behavior pending|
| largeTradeThreshold | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| continuationWindowMs | 3000 | numeric registry | 2 source files | source reference found; behavior pending|
| historySeconds | 3600 | numeric registry | 5 source files | source reference found; behavior pending|
| paneHeight | 190 | numeric registry | 11 source files | source reference found; behavior pending|
| markerSize | 7 | numeric registry | 22 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| preset | "balanced-futures" | dialog source reference | 38 source files | internal metadata|
| windowMode | "rolling" | dialog source reference | 1 source files | source reference found; behavior pending|
| dynamicBaselineEnabled | true | dialog source reference | 4 source files | source reference found; behavior pending|
| baselineSampleLimit | 5000 | needs inspection | 5 source files | source reference found; behavior pending|
| continuationTicks | 3 | needs inspection | 3 source files | source reference found; behavior pending|
| rejectionTicks | 3 | needs inspection | 3 source files | source reference found; behavior pending|
| maximumBuckets | 5000 | needs inspection | 3 source files | source reference found; behavior pending|
| maximumEvents | 2000 | needs inspection | 3 source files | source reference found; behavior pending|
| staleAfterMs | 5000 | needs inspection | 5 source files | source reference found; behavior pending|
| showPane | true | generated control candidate | 2 source files | source reference found; behavior pending|
| paneMode | "contracts-per-second" | dialog source reference | 2 source files | source reference found; behavior pending|
| showBuySpeed | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showSellSpeed | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showTotalSpeed | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showDeltaSpeed | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showMarkers | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showPriceTimeBands | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| showTooltips | true | dialog source reference | 7 source files | source reference found; behavior pending|
| showActiveLane | false | generated control candidate | 7 source files | source reference found; behavior pending|
| alertsEnabled | false | dialog source reference | 6 source files | source reference found; behavior pending|
| alertMinimumScore | 80 | needs inspection | 6 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| buyColor | "#22D3A7" | dialog source reference | 12 source files | source reference found; behavior pending|
| sellColor | "#FF3B78" | dialog source reference | 12 source files | source reference found; behavior pending|
| totalColor | "#F8FAFC" | generated control candidate | 2 source files | source reference found; behavior pending|
| neutralColor | "#94A3B8" | dialog source reference | 33 source files | source reference found; behavior pending|
| warningColor | "#F59E0B" | generated control candidate | 6 source files | source reference found; behavior pending|

### Big Contracts

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| daysToLoad | 1 | numeric registry | 7 source files | source reference found; behavior pending|
| manualFilter | 30 | numeric registry | 1 source files | source reference found; behavior pending|
| maximumFilter | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| rthManualFilter | 30 | numeric registry | 1 source files | source reference found; behavior pending|
| rthStandardDeviation | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| cappingMaxVolume | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| clusterWindowMs | 100 | numeric registry | 2 source files | source reference found; behavior pending|
| clusterPriceTicks | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| maxMarkersPerBar | 50 | numeric registry | 1 source files | source reference found; behavior pending|
| standardDeviation | 1 | numeric registry | 16 source files | source reference found; behavior pending|
| minimumOpacity | 25 | numeric registry | 9 source files | source reference found; behavior pending|
| maximumOpacity | 90 | numeric registry | 9 source files | source reference found; behavior pending|
| minimumSize | 6 | numeric registry | 5 source files | source reference found; behavior pending|
| maximumSize | 32 | numeric registry | 2 source files | source reference found; behavior pending|
| labelMinSize | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| deepMinimumTradeSize | 30 | numeric registry | 1 source files | source reference found; behavior pending|
| deepBoxTickRange | 4 | numeric registry | 1 source files | source reference found; behavior pending|
| deepTickMargin | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| deepProjectionBars | 22 | numeric registry | 1 source files | source reference found; behavior pending|
| deepOpacity | 20 | numeric registry | 1 source files | source reference found; behavior pending|
| deepLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| showBigContracts | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showDeepContracts | false | generated control candidate | 1 source files | source reference found; behavior pending|
| filterMode | "manual" | dialog source reference | 14 source files | source reference found; behavior pending|
| automaticIntensity | "medium" | needs inspection | 1 source files | source reference found; behavior pending|
| enableClustering | true | generated control candidate | 1 source files | source reference found; behavior pending|
| combineByCandle | false | generated control candidate | 1 source files | source reference found; behavior pending|
| adaptiveTimeframeFilter | false | generated control candidate | 1 source files | source reference found; behavior pending|
| sessionFilterEnabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| rthFilterMode | "manual" | dialog source reference | 2 source files | source reference found; behavior pending|
| rthAutomaticIntensity | "medium" | needs inspection | 1 source files | source reference found; behavior pending|
| cappingMode | "off" | dialog source reference | 1 source files | source reference found; behavior pending|
| markerType | "circle" | needs inspection | 2 source files | source reference found; behavior pending|
| hollowFill | false | generated control candidate | 2 source files | source reference found; behavior pending|
| informationMode | "volume" | needs inspection | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| enableAlertSound | false | dialog source reference | 2 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| showProjection | false | generated control candidate | 2 source files | source reference found; behavior pending|
| projectionLineWidth | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| projectionLineStyle | "dashed" | needs inspection | 2 source files | source reference found; behavior pending|
| projectionOpacity | 55 | needs inspection | 2 source files | source reference found; behavior pending|
| deepShowProjection | true | generated control candidate | 1 source files | source reference found; behavior pending|
| deepExtendTillCloseCross | true | generated control candidate | 1 source files | source reference found; behavior pending|
| bigTradesSettingsVersion | 6 | needs inspection | 0 source files | internal metadata|

### Ratio Highlight

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minRatio | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| maxRatio | 20 | numeric registry | 3 source files | source reference found; behavior pending|
| opacity | 70 | numeric registry | 165 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| ratioMode | "bar" | dialog source reference | 1 source files | source reference found; behavior pending|
| bidColor | "#D5006D" | dialog source reference | 24 source files | source reference found; behavior pending|
| askColor | "#007C7A" | dialog source reference | 25 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### Stop Spotter

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumDeltaPercent | 25 | numeric registry | 4 source files | source reference found; behavior pending|
| minimumVolume | 1500 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumVolumeIncrease | 500 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumBodyTicks | 6 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumPriceTicksIncrease | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumHorizontalDelta | 60 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumImbalancePercent | 200 | numeric registry | 5 source files | source reference found; behavior pending|
| minimumImbalanceCount | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| secondsToClose | 15 | numeric registry | 1 source files | source reference found; behavior pending|
| maximumLoss | 500 | numeric registry | 1 source files | source reference found; behavior pending|
| tickValueDivider | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| contractFontSize | 10 | numeric registry | 2 source files | source reference found; behavior pending|
| contractTickOffset | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| calculationMode | "close" | dialog source reference | 3 source files | source reference found; behavior pending|
| plotPrice | "price-slope" | dialog source reference | 3 source files | source reference found; behavior pending|
| contractCalculationEnabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| contractBackgroundColor | "#111827" | dialog source reference | 3 source files | source reference found; behavior pending|
| contractBuyTextColor | "#22C55E" | dialog source reference | 3 source files | source reference found; behavior pending|
| contractSellTextColor | "#EF4444" | dialog source reference | 3 source files | source reference found; behavior pending|
| alertSoundEnabled | false | dialog source reference | 8 source files | source reference found; behavior pending|
| alertTone | "chime" | dialog source reference | 5 source files | source reference found; behavior pending|
| messagePopupEnabled | false | dialog source reference | 8 source files | source reference found; behavior pending|
| messageText | "Stop Run" | dialog source reference | 7 source files | source reference found; behavior pending|
| buyColor | "#6EE7B7" | dialog source reference | 12 source files | source reference found; behavior pending|
| sellColor | "#FCA5A5" | dialog source reference | 12 source files | source reference found; behavior pending|
| markerStyle | "square" | dialog source reference | 3 source files | source reference found; behavior pending|
| autoColor | "none" | dialog source reference | 4 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| shortName | "Stop Run" | dialog source reference | 10 source files | source reference found; behavior pending|
| showNameLabel | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showValueLabel | false | generated control candidate | 3 source files | source reference found; behavior pending|
| nameBackground | false | generated control candidate | 8 source files | source reference found; behavior pending|
| valueBackground | false | generated control candidate | 8 source files | source reference found; behavior pending|
| chartColorForMarker | false | generated control candidate | 6 source files | source reference found; behavior pending|
| includeOnAutoCenter | true | generated control candidate | 3 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### Auction Gap Tracker

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumTickVolume | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumOppositeVolume | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| includeMode | "intrabar" | needs inspection | 3 source files | source reference found; behavior pending|
| minimumConsecutiveLevels | 3 | numeric registry | 2 source files | source reference found; behavior pending|
| plotMode | "zones" | dialog source reference | 5 source files | source reference found; behavior pending|
| markerPlacement | "bar-direction" | needs inspection | 3 source files | source reference found; behavior pending|
| extendedBars | 200 | numeric registry | 7 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| markerSize | 6 | numeric registry | 22 source files | source reference found; behavior pending|
| resetMode | "none" | dialog source reference | 7 source files | source reference found; behavior pending|
| filterTime | "none" | dialog source reference | 13 source files | source reference found; behavior pending|
| customStartMinutes | 0 | needs inspection | 10 source files | source reference found; behavior pending|
| customEndMinutes | 0 | needs inspection | 10 source files | source reference found; behavior pending|
| retestMode | "touch" | needs inspection | 6 source files | source reference found; behavior pending|
| showTriggered | true | dialog source reference | 7 source files | source reference found; behavior pending|
| onlyTriggered | false | generated control candidate | 6 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| buyColor | "#22c55e" | dialog source reference | 12 source files | source reference found; behavior pending|
| sellColor | "#ef4444" | dialog source reference | 12 source files | source reference found; behavior pending|
| buyTriggeredColor | "#22c55e" | generated control candidate | 2 source files | source reference found; behavior pending|
| sellTriggeredColor | "#ef4444" | generated control candidate | 2 source files | source reference found; behavior pending|
| alertSoundEnabled | false | dialog source reference | 8 source files | source reference found; behavior pending|
| messagePopupEnabled | false | dialog source reference | 8 source files | source reference found; behavior pending|
| alertName | "Auction Gap" | dialog source reference | 8 source files | source reference found; behavior pending|
| alertMessage | "Auction gap detected" | needs inspection | 3 source files | source reference found; behavior pending|

### Session Imbalance

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| numberOfMinutes | 60 | numeric registry | 1 source files | source reference found; behavior pending|
| numberOfDays | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| lineOpacity | 100 | numeric registry | 5 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| textSize | 10 | numeric registry | 11 source files | source reference found; behavior pending|
| useCustomStartTime | false | dialog source reference | 1 source files | source reference found; behavior pending|
| customStartTime | "17:00" | dialog source reference | 3 source files | source reference found; behavior pending|
| plotOnceEnded | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showHigh | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showLow | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showMid | true | generated control candidate | 1 source files | source reference found; behavior pending|
| level50Enabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| level100Enabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| highColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| lowColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| midColor | "#38BDF8" | dialog source reference | 6 source files | source reference found; behavior pending|
| level50Color | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| level100Color | "#A78BFA" | dialog source reference | 2 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| textAlignment | "right" | dialog source reference | 2 source files | source reference found; behavior pending|
| extendMode | "next-session" | dialog source reference | 1 source files | source reference found; behavior pending|
| hhllEnableAlertPopup | false | generated control candidate | 1 source files | source reference found; behavior pending|
| hhllEnableAlertSound | false | generated control candidate | 1 source files | source reference found; behavior pending|
| level50EnableAlertPopup | false | generated control candidate | 1 source files | source reference found; behavior pending|
| level50EnableAlertSound | false | generated control candidate | 1 source files | source reference found; behavior pending|
| level100EnableAlertPopup | false | generated control candidate | 1 source files | source reference found; behavior pending|
| level100EnableAlertSound | false | generated control candidate | 1 source files | source reference found; behavior pending|
| sessionImbalanceSettingsVersion | 1 | needs inspection | 1 source files | internal metadata|

### Absorption Detector

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| windowMs | 1000 | numeric registry | 11 source files | source reference found; behavior pending|
| rollingStepMs | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| mergeGapMs | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| maximumCandidateDurationMs | 3000 | numeric registry | 2 source files | source reference found; behavior pending|
| confirmationWindowMs | 2000 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumContracts | 100 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumTradeCount | 3 | numeric registry | 5 source files | source reference found; behavior pending|
| minimumDirectionalShare | 0.7 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumPenetrationTicks | 2 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumAggressionPerTick | 50 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumDevelopingScore | 45 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumConfirmedScore | 70 | numeric registry | 1 source files | source reference found; behavior pending|
| baselineWindowSeconds | 60 | numeric registry | 1 source files | source reference found; behavior pending|
| baselineSampleLimit | 4000 | numeric registry | 5 source files | source reference found; behavior pending|
| baselineMinimumSamples | 30 | numeric registry | 1 source files | source reference found; behavior pending|
| baselineMedianMultiplier | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumResponseTicks | 2 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumPersistenceMs | 250 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumReplenishmentRatio | 0.2 | numeric registry | 2 source files | source reference found; behavior pending|
| zoneMergeWindowMs | 750 | numeric registry | 2 source files | source reference found; behavior pending|
| zoneMaximumGapTicks | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| retestMinimumDepartureTicks | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| retestTouchToleranceTicks | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| breakToleranceTicks | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumBreakVolume | 50 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumBreakTimeMs | 250 | numeric registry | 2 source files | source reference found; behavior pending|
| replenishmentWindowMs | 1000 | numeric registry | 1 source files | source reference found; behavior pending|
| replenishmentMinimumContracts | 25 | numeric registry | 1 source files | source reference found; behavior pending|
| replenishmentMinimumRatio | 0.2 | numeric registry | 1 source files | source reference found; behavior pending|
| replenishmentMinimumRefreshCount | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| activeProfileWidth | 120 | numeric registry | 4 source files | source reference found; behavior pending|
| lowerPaneHeight | 160 | numeric registry | 4 source files | source reference found; behavior pending|
| markerSize | 7 | numeric registry | 22 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| historySeconds | 3600 | numeric registry | 5 source files | source reference found; behavior pending|
| maximumEvents | 2500 | numeric registry | 3 source files | source reference found; behavior pending|
| version | 1 | dialog source reference | 87 source files | internal metadata|
| preset | "balanced-level3" | dialog source reference | 38 source files | internal metadata|
| useTradeStream | true | generated control candidate | 1 source files | source reference found; behavior pending|
| useLevel3Context | true | generated control candidate | 1 source files | source reference found; behavior pending|
| useFootprintAggregation | true | generated control candidate | 1 source files | source reference found; behavior pending|
| usePullingStackingContext | true | generated control candidate | 1 source files | source reference found; behavior pending|
| includeOwnOrders | false | generated control candidate | 2 source files | source reference found; behavior pending|
| includeImpliedOrders | false | generated control candidate | 2 source files | source reference found; behavior pending|
| preferSourceSide | true | generated control candidate | 1 source files | source reference found; behavior pending|
| useBboFallback | true | generated control candidate | 1 source files | source reference found; behavior pending|
| includeUnknownTrades | false | generated control candidate | 3 source files | source reference found; behavior pending|
| maximumBboAgeMs | 250 | needs inspection | 2 source files | source reference found; behavior pending|
| aggregationMode | "rolling" | dialog source reference | 7 source files | source reference found; behavior pending|
| finalizationGraceMs | 250 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumContractsPerSecond | 0 | needs inspection | 3 source files | source reference found; behavior pending|
| minimumTradesPerSecond | 0 | needs inspection | 2 source files | source reference found; behavior pending|
| minimumDurationMs | 50 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumLargestTrade | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumExecutedToVisible | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumRepeatCount | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| dynamicBaselineEnabled | true | dialog source reference | 4 source files | source reference found; behavior pending|
| baselinePercentile | 0.9 | needs inspection | 3 source files | source reference found; behavior pending|
| baselineWarmupMs | 20000 | needs inspection | 3 source files | source reference found; behavior pending|
| confirmationMode | "combined-score" | dialog source reference | 1 source files | source reference found; behavior pending|
| maximumResponseTimeMs | 2000 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumDepthRetention | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| confirmationMinimumExecutedToVisible | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| sizeWeight | 0.16 | needs inspection | 1 source files | source reference found; behavior pending|
| relativeSizeWeight | 0.12 | needs inspection | 1 source files | source reference found; behavior pending|
| aggressionPerTickWeight | 0.15 | needs inspection | 1 source files | source reference found; behavior pending|
| lowProgressWeight | 0.18 | needs inspection | 1 source files | source reference found; behavior pending|
| directionalShareWeight | 0.08 | needs inspection | 1 source files | source reference found; behavior pending|
| replenishmentWeight | 0.1 | needs inspection | 1 source files | source reference found; behavior pending|
| depthRetentionWeight | 0.05 | needs inspection | 1 source files | source reference found; behavior pending|
| executedToVisibleWeight | 0.05 | needs inspection | 1 source files | source reference found; behavior pending|
| persistenceWeight | 0.04 | dialog source reference | 4 source files | source reference found; behavior pending|
| responseWeight | 0.05 | needs inspection | 1 source files | source reference found; behavior pending|
| repeatWeight | 0.02 | needs inspection | 1 source files | source reference found; behavior pending|
| renormalizeDisabledComponents | true | generated control candidate | 1 source files | source reference found; behavior pending|
| zoneMergeEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| maximumZoneLevels | 8 | needs inspection | 1 source files | source reference found; behavior pending|
| zoneExtensionMode | "until-broken" | dialog source reference | 2 source files | source reference found; behavior pending|
| fixedExtensionMs | 60000 | needs inspection | 1 source files | source reference found; behavior pending|
| retainBrokenZones | true | generated control candidate | 1 source files | source reference found; behavior pending|
| maximumActiveZones | 100 | needs inspection | 1 source files | source reference found; behavior pending|
| retestEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| retestWindowMs | 3600000 | needs inspection | 1 source files | source reference found; behavior pending|
| maximumRetests | 2 | needs inspection | 1 source files | source reference found; behavior pending|
| retestMinimumResponseTicks | 2 | needs inspection | 1 source files | source reference found; behavior pending|
| breakMode | "combined" | dialog source reference | 1 source files | source reference found; behavior pending|
| minimumBreakCloses | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| keepBrokenHistory | true | generated control candidate | 1 source files | source reference found; behavior pending|
| replenishmentEnabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| replenishmentSamePriceRequired | true | generated control candidate | 1 source files | source reference found; behavior pending|
| requireReplenishmentForConfirmation | false | generated control candidate | 1 source files | source reference found; behavior pending|
| renderMode | "hybrid" | dialog source reference | 5 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | source reference found; behavior pending|
| showDeveloping | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showConfirmed | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showRetests | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showBroken | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showExpired | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showCells | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showZones | true | dialog source reference | 8 source files | source reference found; behavior pending|
| showEventMarkers | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showActiveProfile | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showLowerPane | false | dialog source reference | 9 source files | source reference found; behavior pending|
| activeProfileMaximumZones | 12 | needs inspection | 2 source files | source reference found; behavior pending|
| zoneBorderWidth | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| includeInChartAutoscale | false | generated control candidate | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| bidDevelopingColor | "#22C55E" | generated control candidate | 3 source files | source reference found; behavior pending|
| bidConfirmedColor | "#22C55E" | generated control candidate | 3 source files | source reference found; behavior pending|
| askDevelopingColor | "#EF4444" | generated control candidate | 3 source files | source reference found; behavior pending|
| askConfirmedColor | "#EF4444" | generated control candidate | 3 source files | source reference found; behavior pending|
| retestColor | "#F59E0B" | generated control candidate | 3 source files | source reference found; behavior pending|
| brokenColor | "#A1A1AA" | generated control candidate | 7 source files | source reference found; behavior pending|
| replenishmentColor | "#38BDF8" | generated control candidate | 2 source files | source reference found; behavior pending|
| neutralColor | "#71717A" | dialog source reference | 33 source files | source reference found; behavior pending|
| showQuantity | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showScore | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showTradeCount | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showAggressionPerTick | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showReplenishment | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showRepeatCount | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showTooltips | true | dialog source reference | 7 source files | source reference found; behavior pending|
| enableAlerts | false | dialog source reference | 6 source files | source reference found; behavior pending|
| alertMinimumScore | 75 | needs inspection | 6 source files | source reference found; behavior pending|
| alertCooldownMs | 10000 | needs inspection | 3 source files | source reference found; behavior pending|
| maximumZones | 500 | needs inspection | 2 source files | source reference found; behavior pending|
| staleTradeAfterMs | 5000 | needs inspection | 1 source files | source reference found; behavior pending|
| staleLevel3AfterMs | 5000 | needs inspection | 1 source files | source reference found; behavior pending|
| postSnapshotWarmupMs | 3000 | needs inspection | 3 source files | source reference found; behavior pending|

### Stacked Imbalance Suite

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| customOffsetGroups | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| ratioThreshold | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumAbsoluteDifference | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumDominanceShare | 0.75 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumNumeratorVolume | 50 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumCombinedVolume | 75 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumStackedLevels | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| maximumGapGroups | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumStackedTotalNumerator | 150 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumStackedScore | 65 | numeric registry | 1 source files | source reference found; behavior pending|
| rollingBars | 5 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumDepartureGroups | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumResponseGroups | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| maximumRetestsPerZone | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| markerSize | 6 | numeric registry | 22 source files | source reference found; behavior pending|
| activeLaneWidth | 96 | numeric registry | 6 source files | source reference found; behavior pending|
| alertMinimumScore | 65 | numeric registry | 6 source files | source reference found; behavior pending|
| version | 1 | dialog source reference | 87 source files | internal metadata|
| enabledSides | "both" | dialog source reference | 1 source files | source reference found; behavior pending|
| comparisonMode | "diagonal" | dialog source reference | 4 source files | source reference found; behavior pending|
| qualificationMode | "ratio" | dialog source reference | 1 source files | source reference found; behavior pending|
| ratioFullScore | 6 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumDenominatorVolume | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumNumeratorTradeCount | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumCombinedTradeCount | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumZeroSideVolume | 25 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumZeroSideTradeCount | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| includeZeroSide | true | generated control candidate | 1 source files | source reference found; behavior pending|
| scopeMode | "bar" | dialog source reference | 2 source files | source reference found; behavior pending|
| liveBarMode | "live" | dialog source reference | 1 source files | source reference found; behavior pending|
| createZones | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showIndividualCells | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showStackBrackets | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| showActiveLane | true | generated control candidate | 7 source files | source reference found; behavior pending|
| showSessionProfile | false | generated control candidate | 2 source files | source reference found; behavior pending|
| showLowerPane | false | dialog source reference | 9 source files | source reference found; behavior pending|
| zoneExtensionMode | "until-broken" | dialog source reference | 2 source files | source reference found; behavior pending|
| zoneExtensionBars | 40 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumBreakCloses | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| askColor | "#22D3A7" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#FF3B78" | dialog source reference | 24 source files | source reference found; behavior pending|
| brokenColor | "#71717A" | generated control candidate | 7 source files | source reference found; behavior pending|
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| enableAlerts | false | dialog source reference | 6 source files | source reference found; behavior pending|
| alertOnLiveQualification | false | generated control candidate | 1 source files | source reference found; behavior pending|
| alertOnClosedBar | true | generated control candidate | 1 source files | source reference found; behavior pending|
| alertOnRetest | true | generated control candidate | 2 source files | source reference found; behavior pending|
| alertOnHeld | true | generated control candidate | 2 source files | source reference found; behavior pending|
| alertOnRejected | true | generated control candidate | 2 source files | source reference found; behavior pending|
| alertOnBroken | true | generated control candidate | 3 source files | source reference found; behavior pending|

### Iceberg / Refresh Detector

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| attributionWindowMs | 250 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumCycleExecution | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumCycleReplenishment | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumCycleReplenishmentRatio | 0.5 | numeric registry | 1 source files | source reference found; behavior pending|
| activeMinimumExecuted | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| activeMinimumReplenished | 50 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumRefreshCycles | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumReplenishmentRatio | 0.5 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumExecutionToDisplayRatio | 1.25 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumSuspectedCycles | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumSuspectedExecuted | 200 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumSuspectedScore | 75 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumQuality | 45 | numeric registry | 4 source files | source reference found; behavior pending|
| maximumPenetrationTicks | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumPulledContracts | 50 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumPullRatio | 0.5 | numeric registry | 1 source files | source reference found; behavior pending|
| historySeconds | 3600 | numeric registry | 5 source files | source reference found; behavior pending|
| activeProfileWidth | 140 | numeric registry | 4 source files | source reference found; behavior pending|
| markerSize | 8 | numeric registry | 22 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| alertMinimumScore | 75 | numeric registry | 6 source files | source reference found; behavior pending|
| alertMinimumQuality | 45 | numeric registry | 3 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| preset | "balanced" | dialog source reference | 38 source files | internal metadata|
| visualizationMode | "hybrid" | dialog source reference | 7 source files | source reference found; behavior pending|
| minimumWatchingExecuted | 25 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumWatchingReplenished | 10 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumSamePriceDurationMs | 100 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumSuspectedReplenishmentRatio | 0.65 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumSuspectedTurnover | 2 | needs inspection | 1 source files | source reference found; behavior pending|
| maximumCandidateDurationMs | 300000 | needs inspection | 2 source files | source reference found; behavior pending|
| excessReplenishmentTreatment | "ordinary-stack" | dialog source reference | 1 source files | source reference found; behavior pending|
| moveIntoLevelTreatment | "exclude" | dialog source reference | 1 source files | source reference found; behavior pending|
| requireExecutionBeforeRefresh | true | generated control candidate | 1 source files | source reference found; behavior pending|
| allowCancelThenRepostResearchMode | false | generated control candidate | 1 source files | source reference found; behavior pending|
| includeUnknownTrades | false | generated control candidate | 3 source files | source reference found; behavior pending|
| dynamicBaselineEnabled | true | dialog source reference | 4 source files | source reference found; behavior pending|
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
| exhaustionDetectionEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| exhaustionWindowMs | 1000 | needs inspection | 2 source files | source reference found; behavior pending|
| maximumExhaustionReplenishmentRatio | 0.2 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumExhaustionExecuted | 50 | needs inspection | 1 source files | source reference found; behavior pending|
| pulledStateEnabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| breakToleranceTicks | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| minimumBreakVolume | 50 | needs inspection | 2 source files | source reference found; behavior pending|
| minimumBreakTimeMs | 250 | needs inspection | 2 source files | source reference found; behavior pending|
| retestEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| minimumDepartureTicks | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| touchToleranceTicks | 1 | needs inspection | 2 source files | source reference found; behavior pending|
| minimumResponseTicks | 2 | needs inspection | 2 source files | source reference found; behavior pending|
| maximumRetestsPerCandidate | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| zoneMergeEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| zoneMergeWindowMs | 1000 | needs inspection | 2 source files | source reference found; behavior pending|
| maximumZoneGapTicks | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| postSnapshotWarmupMs | 3000 | needs inspection | 3 source files | source reference found; behavior pending|
| baselineWarmupMs | 20000 | needs inspection | 3 source files | source reference found; behavior pending|
| staleAfterMs | 5000 | needs inspection | 5 source files | source reference found; behavior pending|
| maximumCandidates | 1000 | needs inspection | 1 source files | source reference found; behavior pending|
| maximumCycles | 5000 | needs inspection | 1 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | source reference found; behavior pending|
| showCycleCells | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showMarkers | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showZones | true | dialog source reference | 8 source files | source reference found; behavior pending|
| showActiveProfile | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| showTooltips | true | dialog source reference | 7 source files | source reference found; behavior pending|
| showLowerPane | false | dialog source reference | 9 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| bidColor | "#22D3A7" | dialog source reference | 24 source files | source reference found; behavior pending|
| askColor | "#FF3B78" | dialog source reference | 25 source files | source reference found; behavior pending|
| nativeColor | "#A78BFA" | generated control candidate | 2 source files | source reference found; behavior pending|
| exhaustedColor | "#F59E0B" | generated control candidate | 2 source files | source reference found; behavior pending|
| pulledColor | "#FB7185" | generated control candidate | 2 source files | source reference found; behavior pending|
| brokenColor | "#71717A" | generated control candidate | 7 source files | source reference found; behavior pending|
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | source reference found; behavior pending|
| alertsEnabled | false | dialog source reference | 6 source files | source reference found; behavior pending|
| alertOnRefresh | false | generated control candidate | 2 source files | source reference found; behavior pending|
| alertOnSuspected | true | generated control candidate | 2 source files | source reference found; behavior pending|
| alertOnExhausted | true | generated control candidate | 2 source files | source reference found; behavior pending|
| alertOnPulled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| alertOnBroken | true | generated control candidate | 3 source files | source reference found; behavior pending|

### Liquidity Sweep / Stop Sweep Detector

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| maximumInterTradeGapMs | 75 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumSweepDurationMs | 1000 | numeric registry | 1 source files | source reference found; behavior pending|
| maximumBacktrackTicks | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| maximumInterTradeJumpTicks | 4 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumSweepContracts | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumSweepTradeCount | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumSweptLevels | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumSweepRangeTicks | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumContractsPerSecond | 100 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumContiguousCoverageRatio | 0.75 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumDirectionalProgressRatio | 0.6 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumReferenceBreachTicks | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| maximumReferenceDistanceTicks | 20 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumContinuationTicks | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumRejectionTicks | 3 | numeric registry | 2 source files | source reference found; behavior pending|
| historySeconds | 3600 | numeric registry | 5 source files | source reference found; behavior pending|
| activeLaneWidth | 142 | numeric registry | 6 source files | source reference found; behavior pending|
| minimumLaneScore | 60 | numeric registry | 2 source files | source reference found; behavior pending|
| markerSize | 8 | numeric registry | 22 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| alertMinimumScore | 75 | numeric registry | 6 source files | source reference found; behavior pending|
| alertMinimumQuality | 60 | numeric registry | 3 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| preset | "balanced-futures" | dialog source reference | 38 source files | internal metadata|
| maximumOpposingQuantityInsideCandidate | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumDirectionalAggressorShare | 0.85 | needs inspection | 1 source files | source reference found; behavior pending|
| singleLevelBurstEnabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| maximumBurstLevels | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumBurstContracts | 250 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumBurstTradeCount | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumBurstContractsPerSecond | 250 | needs inspection | 1 source files | source reference found; behavior pending|
| includeUnknownTrades | false | generated control candidate | 3 source files | source reference found; behavior pending|
| maximumBboAgeMs | 250 | needs inspection | 2 source files | source reference found; behavior pending|
| dynamicBaselineEnabled | true | dialog source reference | 4 source files | source reference found; behavior pending|
| baselineWindowMs | 120000 | needs inspection | 4 source files | source reference found; behavior pending|
| baselineSampleLimit | 5000 | needs inspection | 5 source files | source reference found; behavior pending|
| minimumBaselineSamples | 30 | needs inspection | 4 source files | source reference found; behavior pending|
| relativeQuantityMultiplier | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| relativeVelocityMultiplier | 2 | needs inspection | 1 source files | source reference found; behavior pending|
| selectedPercentile | 0.9 | needs inspection | 3 source files | source reference found; behavior pending|
| stopSweepInferenceEnabled | true | dialog source reference | 1 source files | source reference found; behavior pending|
| startSideToleranceTicks | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumStopSweepContracts | 100 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumStopSweepLevels | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumStopSweepVelocity | 100 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumStopSweepScore | 60 | needs inspection | 1 source files | source reference found; behavior pending|
| maximumMatchedReferences | 3 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumAcceptanceTimeMs | 500 | needs inspection | 2 source files | source reference found; behavior pending|
| continuationWindowMs | 5000 | needs inspection | 2 source files | source reference found; behavior pending|
| rejectionWindowMs | 5000 | needs inspection | 1 source files | source reference found; behavior pending|
| exhaustionDetectionEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| exhaustionWindowMs | 2000 | needs inspection | 2 source files | source reference found; behavior pending|
| maximumPostSweepExtensionTicks | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| bookContextEnabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| bookContextLookbackMs | 500 | needs inspection | 1 source files | source reference found; behavior pending|
| bookContextLookaheadMs | 100 | needs inspection | 1 source files | source reference found; behavior pending|
| staleAfterMs | 5000 | needs inspection | 5 source files | source reference found; behavior pending|
| maximumConfirmedSweeps | 2500 | needs inspection | 1 source files | source reference found; behavior pending|
| visualizationMode | "hybrid" | dialog source reference | 7 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | source reference found; behavior pending|
| showRangeBrackets | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showPriceTimeBands | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showStopSweepZones | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showMarkers | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| showTooltips | true | dialog source reference | 7 source files | source reference found; behavior pending|
| showActiveLane | true | generated control candidate | 7 source files | source reference found; behavior pending|
| maximumActiveLaneRows | 12 | needs inspection | 4 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| buyColor | "#22D3A7" | dialog source reference | 12 source files | source reference found; behavior pending|
| sellColor | "#FF3B78" | dialog source reference | 12 source files | source reference found; behavior pending|
| warningColor | "#F59E0B" | generated control candidate | 6 source files | source reference found; behavior pending|
| rejectionColor | "#FB7185" | generated control candidate | 3 source files | source reference found; behavior pending|
| neutralColor | "#A1A1AA" | dialog source reference | 33 source files | source reference found; behavior pending|
| alertsEnabled | false | dialog source reference | 6 source files | source reference found; behavior pending|

### POC & Auction Suite

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| customGroupSizeTicks | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| automaticTargetRows | 80 | numeric registry | 1 source files | source reference found; behavior pending|
| percentageOfMaximum | 0.95 | numeric registry | 1 source files | source reference found; behavior pending|
| topNContiguousGroups | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumPocVolume | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumPocTradeCount | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| rollingBars | 20 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumMigrationTicks | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| touchToleranceTicks | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumAcceptanceVolume | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumRejectionTicks | 4 | numeric registry | 2 source files | source reference found; behavior pending|
| excessLookbackTicks | 4 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumTaperSteps | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| maximumTaperRatio | 0.75 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumExcessScore | 35 | numeric registry | 1 source files | source reference found; behavior pending|
| activeLaneWidth | 150 | numeric registry | 6 source files | source reference found; behavior pending|
| maximumActiveLaneRows | 14 | numeric registry | 4 source files | source reference found; behavior pending|
| markerSize | 7 | numeric registry | 22 source files | source reference found; behavior pending|
| lineWidth | 1.5 | numeric registry | 142 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| historyBars | 1500 | numeric registry | 1 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| preset | "balanced-auction" | dialog source reference | 38 source files | internal metadata|
| groupingMode | "follow-footprint" | dialog source reference | 13 source files | source reference found; behavior pending|
| auctionExtremeSource | "raw-exchange-tick" | dialog source reference | 1 source files | source reference found; behavior pending|
| allowGroupedExtremeApproximation | false | generated control candidate | 1 source files | source reference found; behavior pending|
| metric | "total-volume" | dialog source reference | 44 source files | source reference found; behavior pending|
| tieBreakMode | "follow-shared-profile-engine" | dialog source reference | 1 source files | source reference found; behavior pending|
| pocBandMode | "single-price-group" | dialog source reference | 1 source files | source reference found; behavior pending|
| customBandTicks | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| showBarPoc | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showSessionPoc | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showPriorSessionPoc | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showRollingPoc | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showAnchoredPoc | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showCompositePoc | false | generated control candidate | 1 source files | source reference found; behavior pending|
| rollingMode | "bars" | needs inspection | 1 source files | source reference found; behavior pending|
| rollingDurationMs | 3600000 | needs inspection | 1 source files | source reference found; behavior pending|
| anchorStartMs | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| anchorEndMs | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| anchorFollowLive | true | generated control candidate | 1 source files | source reference found; behavior pending|
| compositeStartMs | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| compositeEndMs | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumNewPocDwellMs | 250 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumMetricLead | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumMetricLeadPercent | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| nakedPocEnabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| minimumTouchVolume | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumAcceptanceTimeMs | 2000 | needs inspection | 2 source files | source reference found; behavior pending|
| responseWindowMs | 10000 | needs inspection | 1 source files | source reference found; behavior pending|
| showFinishedHigh | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showFinishedLow | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showUnfinishedHigh | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showUnfinishedLow | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showZeroSide | true | generated control candidate | 1 source files | source reference found; behavior pending|
| developingAuctionVisuals | true | generated control candidate | 1 source files | source reference found; behavior pending|
| maximumOppositeExtremeVolume | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumAggressiveExtremeVolume | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumAggressiveExtremeTradeCount | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| maximumUnknownExtremeVolume | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumOppositeUnfinishedVolume | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumAggressiveUnfinishedVolume | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumOppositeUnfinishedTrades | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumAggressiveUnfinishedTrades | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumTotalExtremeVolume | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| excessEnabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| requireFinishedExtremeForExcess | true | generated control candidate | 1 source files | source reference found; behavior pending|
| maximumExtremeVolumeRelativeToLocalMedian | 0.5 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumInteriorReferenceVolume | 10 | needs inspection | 1 source files | source reference found; behavior pending|
| auctionTouchToleranceTicks | 0 | needs inspection | 1 source files | source reference found; behavior pending|
| auctionResolutionMode | "first-touch" | dialog source reference | 1 source files | source reference found; behavior pending|
| minimumTradeThroughTicks | 1 | needs inspection | 1 source files | source reference found; behavior pending|
| minimumResolutionVolume | 25 | needs inspection | 1 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | source reference found; behavior pending|
| showBarPocMarkers | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showDynamicPocLine | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showExtendedLevels | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showAuctionMarkers | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showActiveLane | true | generated control candidate | 7 source files | source reference found; behavior pending|
| showLowerPane | false | dialog source reference | 9 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| barPocColor | "#22D3EE" | generated control candidate | 3 source files | source reference found; behavior pending|
| sessionPocColor | "#A3E635" | generated control candidate | 3 source files | source reference found; behavior pending|
| nakedPocColor | "#F59E0B" | generated control candidate | 3 source files | source reference found; behavior pending|
| finishedColor | "#A1A1AA" | generated control candidate | 2 source files | source reference found; behavior pending|
| unfinishedColor | "#F59E0B" | generated control candidate | 2 source files | source reference found; behavior pending|
| excessHighColor | "#FB7185" | generated control candidate | 3 source files | source reference found; behavior pending|
| excessLowColor | "#22D3A7" | generated control candidate | 3 source files | source reference found; behavior pending|
| neutralColor | "#71717A" | dialog source reference | 33 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| showTooltips | true | dialog source reference | 7 source files | source reference found; behavior pending|
| alertsEnabled | false | dialog source reference | 6 source files | source reference found; behavior pending|
| alertOnMigration | true | generated control candidate | 1 source files | source reference found; behavior pending|
| alertOnNewNakedPoc | true | generated control candidate | 1 source files | source reference found; behavior pending|
| alertOnAuctionClose | true | generated control candidate | 1 source files | source reference found; behavior pending|
| maximumActivePocs | 250 | needs inspection | 1 source files | source reference found; behavior pending|
| maximumAuctionLevels | 500 | needs inspection | 1 source files | source reference found; behavior pending|

### Cumulative Iceberg/Stop

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| filterMin | 1 | numeric registry | 12 source files | source reference found; behavior pending|
| filterMax | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| displayParameter | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| alertStopThreshold | 100 | numeric registry | 2 source files | source reference found; behavior pending|
| alertIcebergThreshold | 100 | numeric registry | 2 source files | source reference found; behavior pending|
| paneHeight | 190 | numeric registry | 11 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| displayMode | "sum" | dialog source reference | 9 source files | source reference found; behavior pending|
| useSeparateAxes | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showIceberg | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showStop | true | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| icebergAskColor | "#EF4444" | dialog source reference | 2 source files | source reference found; behavior pending|
| icebergBidColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| stopBidColor | "#38BDF8" | dialog source reference | 2 source files | source reference found; behavior pending|
| stopAskColor | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| alertStopEnabled | false | dialog source reference | 2 source files | source reference found; behavior pending|
| alertStopShowMessage | true | dialog source reference | 2 source files | source reference found; behavior pending|
| alertIcebergEnabled | false | dialog source reference | 2 source files | source reference found; behavior pending|
| alertIcebergShowMessage | true | dialog source reference | 2 source files | source reference found; behavior pending|

### Book Speed

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| bidColor | "#22C55E" | dialog source reference | 24 source files | source reference found; behavior pending|
| askColor | "#A855F7" | dialog source reference | 25 source files | source reference found; behavior pending|
| averageBidColor | "#4ADE80" | dialog source reference | 3 source files | source reference found; behavior pending|
| averageAskColor | "#F87171" | dialog source reference | 3 source files | source reference found; behavior pending|
| markerBidColor | "#86EFAC" | dialog source reference | 3 source files | source reference found; behavior pending|
| markerAskColor | "#FCA5A5" | dialog source reference | 3 source files | source reference found; behavior pending|
| parameterValue | 10 | numeric registry | 2 source files | source reference found; behavior pending|
| averageLength | 10 | numeric registry | 4 source files | source reference found; behavior pending|
| markerValue | 10 | numeric registry | 2 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| historyBuckets | 360 | numeric registry | 4 source files | source reference found; behavior pending|
| paneHeight | 190 | numeric registry | 11 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| parameterMode | "seconds" | dialog source reference | 2 source files | source reference found; behavior pending|
| showAverage | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showMarker | false | dialog source reference | 4 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### DOM Pro

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| width | 640 | numeric registry | 256 source files | source reference found; behavior pending|
| rows | 120 | numeric registry | 218 source files | source reference found; behavior pending|
| rowHeight | 24 | numeric registry | 24 source files | source reference found; behavior pending|
| refreshRateMs | 32 | numeric registry | 2 source files | source reference found; behavior pending|
| recentWindowMs | 8000 | numeric registry | 2 source files | source reference found; behavior pending|
| depthScaleCap | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| highlightThreshold | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| fontSize | 9 | numeric registry | 87 source files | source reference found; behavior pending|
| showCumulative | false | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| showOrderCount | false | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| showPullStack | true | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| showRecentTrades | true | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| showDepthHistogram | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showHeaderStats | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showImbalance | true | generated control candidate | 2 source files | source reference found; behavior pending|
| autoCenter | true | dialog source reference | 3 source files | source reference found; behavior pending|
| compactNumbers | true | generated control candidate | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| bidColor | "#22C55E" | dialog source reference | 24 source files | source reference found; behavior pending|
| askColor | "#EF4444" | dialog source reference | 25 source files | source reference found; behavior pending|
| lastTradeColor | "#FDE047" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| domPreset | "order-flow" | needs inspection | 2 source files | internal metadata|
| domColumns | "[{\"id\":\"buy\",\"width\":100,\"enabled\":true},{\"id\":\"sell\",\"width\":100,\"enabled\":true},{\"id\":\"bid\",\"width\":100,\"enabled\":true},{\"id\":\"price\",\"width\":100,\"enabled\":true},{\"id\":\"ask\",\"width\":100,\"enabled\":true},{\"id\":\"trades\",\"width\":100,\"enabled\":true},{\"id\":\"orders\",\"width\":82,\"enabled\":false},{\"id\":\"cob\",\"width\":82,\"enabled\":false},{\"id\":\"pullStack\",\"width\":82,\"enabled\":false}]" | needs inspection | 2 source files | source reference found; behavior pending|
| domSettingsVersion | 5 | needs inspection | 1 source files | internal metadata|

### Mini DOM

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| widthPx | 95 | numeric registry | 5 source files | source reference found; behavior pending|
| rightGapPx | 2 | numeric registry | 2 source files | source reference found; behavior pending|
| levelSpacingPx | 10 | numeric registry | 3 source files | source reference found; behavior pending|
| barOpacity | 100 | numeric registry | 3 source files | source reference found; behavior pending|
| backgroundOpacity | 0 | numeric registry | 9 source files | source reference found; behavior pending|
| fontSize | 8 | numeric registry | 87 source files | source reference found; behavior pending|
| showBids | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showAsks | true | dialog source reference | 2 source files | source reference found; behavior pending|
| alignLeft | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showSizes | true | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| buyColor | "#14B8B0" | dialog source reference | 12 source files | source reference found; behavior pending|
| sellColor | "#B4174B" | dialog source reference | 12 source files | source reference found; behavior pending|

### Footprint

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| barWidth | 92 | numeric registry | 14 source files | source reference found; behavior pending|
| candleSpacing | 6 | numeric registry | 4 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | numeric registry | 13 source files | source reference found; behavior pending|
| manualTicks | 1 | numeric registry | 4 source files | source reference found; behavior pending|
| minimumTradeVolume | 0 | numeric registry | 7 source files | source reference found; behavior pending|
| maximumTradeVolume | 0 | numeric registry | 7 source files | source reference found; behavior pending|
| minimumImbalancePercent | 300 | numeric registry | 5 source files | source reference found; behavior pending|
| minimumDominantVolume | 10 | numeric registry | 5 source files | source reference found; behavior pending|
| minimumDelta | 0 | numeric registry | 4 source files | source reference found; behavior pending|
| stackedImbalanceLevels | 3 | numeric registry | 5 source files | source reference found; behavior pending|
| unfinishedAuctionMinimumVolume | 1 | numeric registry | 5 source files | source reference found; behavior pending|
| valueAreaPercent | 0.7 | numeric registry | 30 source files | source reference found; behavior pending|
| backgroundOpacity | 72 | numeric registry | 9 source files | source reference found; behavior pending|
| minimumOpacity | 8 | numeric registry | 9 source files | source reference found; behavior pending|
| maximumOpacity | 72 | numeric registry | 9 source files | source reference found; behavior pending|
| gradientExponent | 0.72 | numeric registry | 4 source files | source reference found; behavior pending|
| visibleRegionPercentile | 0.95 | numeric registry | 4 source files | source reference found; behavior pending|
| fixedMaximum | 0 | numeric registry | 6 source files | source reference found; behavior pending|
| borderWidth | 1 | numeric registry | 20 source files | source reference found; behavior pending|
| fontSize | 11 | numeric registry | 87 source files | source reference found; behavior pending|
| fontWeight | 500 | numeric registry | 28 source files | source reference found; behavior pending|
| minimumWidthToShowText | 32 | numeric registry | 4 source files | source reference found; behavior pending|
| minimumRowHeightToShowText | 9 | numeric registry | 4 source files | source reference found; behavior pending|
| dynamicTextIncrease | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| singlePrintMaximum | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumRatio | 1.5 | numeric registry | 7 source files | source reference found; behavior pending|
| maximumRatio | 100 | numeric registry | 7 source files | source reference found; behavior pending|
| clusterMinimumVolume | 100 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumRetainedBars | 5000 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumDetailedVisibleBars | 180 | numeric registry | 3 source files | source reference found; behavior pending|
| footprintSettingsVersion | 8 | needs inspection | 1 source files | internal metadata|
| chartType | "bid-ask" | dialog source reference | 4 source files | source reference found; behavior pending|
| chartVariant | "bid-ask" | dialog source reference | 1 source files | source reference found; behavior pending|
| contentMode | "bid-ask" | dialog source reference | 5 source files | source reference found; behavior pending|
| visualizationMode | "heatmap-histogram" | dialog source reference | 7 source files | source reference found; behavior pending|
| scaleMode | "visible-region" | dialog source reference | 8 source files | source reference found; behavior pending|
| numberFormat | "automatic" | dialog source reference | 5 source files | source reference found; behavior pending|
| inputType | "volume" | needs inspection | 11 source files | source reference found; behavior pending|
| colorMode | "fading" | dialog source reference | 10 source files | source reference found; behavior pending|
| colorCalculation | "imbalance" | needs inspection | 4 source files | source reference found; behavior pending|
| groupingMode | "manual" | dialog source reference | 13 source files | source reference found; behavior pending|
| groupMode | "fixed" | dialog source reference | 3 source files | source reference found; behavior pending|
| showPerBarVolumeProfile | false | dialog source reference | 4 source files | source reference found; behavior pending|
| showPerBarDeltaProfile | false | dialog source reference | 4 source files | source reference found; behavior pending|
| perBarProfileScaleMode | "independent" | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarProfileTicksPerRow | 1 | dialog source reference | 2 source files | source reference found; behavior pending|
| perBarProfileWidthPercent | 92 | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarProfileGap | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarProfileExtraSpacing | 18 | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarProfileOpacity | 58 | dialog source reference | 3 source files | source reference found; behavior pending|
| showPerBarProfilePoc | true | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarProfilePocSize | 5 | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarProfileOutline | false | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarVolumeColor | "#B7FF38" | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarPositiveDeltaColor | "#B7FF38" | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarNegativeDeltaColor | "#F06A70" | dialog source reference | 3 source files | source reference found; behavior pending|
| perBarProfilePocColor | "#E4BF5A" | dialog source reference | 3 source files | source reference found; behavior pending|
| showCellText | true | generated control candidate | 4 source files | source reference found; behavior pending|
| imbalanceMode | "diagonal" | dialog source reference | 4 source files | source reference found; behavior pending|
| includeZero | false | dialog source reference | 5 source files | source reference found; behavior pending|
| showStackedImbalances | true | generated control candidate | 3 source files | source reference found; behavior pending|
| unfinishedAuctionEnabled | false | generated control candidate | 5 source files | source reference found; behavior pending|
| showImbalances | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showWick | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showBodyOutline | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showBodyFill | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showEmptyPriceRows | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showSummary | true | dialog source reference | 10 source files | source reference found; behavior pending|
| showCentreDivider | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showVolumePoc | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showDeltaPoc | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showValueArea | true | dialog source reference | 12 source files | source reference found; behavior pending|
| showVah | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showVal | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showSinglePrints | false | dialog source reference | 6 source files | source reference found; behavior pending|
| singlePrintExtremesOnly | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showRatio | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showVolumeClusters | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showBarDelta | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showZeros | false | generated control candidate | 4 source files | source reference found; behavior pending|
| colorOnlyDominantSide | false | generated control candidate | 3 source files | source reference found; behavior pending|
| dynamicTextSize | true | generated control candidate | 3 source files | source reference found; behavior pending|
| showMaxBid | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showMaxAsk | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showMaxPositiveDelta | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showMaxNegativeDelta | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showMaxTrades | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showBetweenVolume | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showVwap | false | dialog source reference | 6 source files | source reference found; behavior pending|
| outsideBarStyle | "bar" | dialog source reference | 4 source files | source reference found; behavior pending|
| markerAlignment | "center" | dialog source reference | 4 source files | source reference found; behavior pending|
| outerEdgeMode | true | generated control candidate | 3 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| betweenColor | "#A1A1AA" | dialog source reference | 3 source files | source reference found; behavior pending|
| neutralColor | "#3F3F46" | dialog source reference | 33 source files | source reference found; behavior pending|
| textColor | "#F5F5F5" | dialog source reference | 58 source files | source reference found; behavior pending|
| pocColor | "#FDE047" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#647BA8" | dialog source reference | 18 source files | source reference found; behavior pending|
| deltaPocColor | "#60A5FA" | dialog source reference | 3 source files | source reference found; behavior pending|
| clusterColor | "#F59E0B" | dialog source reference | 3 source files | source reference found; behavior pending|
| singlePrintColor | "#F4F4F5" | dialog source reference | 6 source files | source reference found; behavior pending|
| stackedAskColor | "#B7FF38" | dialog source reference | 3 source files | source reference found; behavior pending|
| stackedBidColor | "#F06A70" | dialog source reference | 3 source files | source reference found; behavior pending|
| unfinishedAuctionColor | "#E4BF5A" | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapColor | "#22D3EE" | dialog source reference | 8 source files | source reference found; behavior pending|
| fpsLimit | 60 | dialog source reference | 4 source files | source reference found; behavior pending|
| type | "ask-bid" | dialog source reference | 951 source files | source reference found; behavior pending|
| mode | "profile" | dialog source reference | 197 source files | source reference found; behavior pending|
| stableFootprintRows | true | dialog source reference | 0 source files | internal metadata|
| textFormat | "automatic" | needs inspection | 3 source files | source reference found; behavior pending|

### KWANT Delta

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| positiveColor | "#C8FFC8" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#F2D3FF" | dialog source reference | 21 source files | source reference found; behavior pending|
| range1AskColor | "#C8FFC8" | dialog source reference | 3 source files | source reference found; behavior pending|
| range1BidColor | "#F2D3FF" | dialog source reference | 3 source files | source reference found; behavior pending|
| range2AskColor | "#77F277" | dialog source reference | 3 source files | source reference found; behavior pending|
| range2BidColor | "#C26DE0" | dialog source reference | 3 source files | source reference found; behavior pending|
| range3AskColor | "#39C96A" | dialog source reference | 3 source files | source reference found; behavior pending|
| range3BidColor | "#8B3EC1" | dialog source reference | 3 source files | source reference found; behavior pending|
| range4AskColor | "#00FF68" | dialog source reference | 3 source files | source reference found; behavior pending|
| range4BidColor | "#6D18A8" | dialog source reference | 3 source files | source reference found; behavior pending|
| maximumPositiveColor | "#00FF68" | dialog source reference | 2 source files | source reference found; behavior pending|
| minimumNegativeColor | "#7416B5" | dialog source reference | 2 source files | source reference found; behavior pending|
| level1Color | "#FFD600" | dialog source reference | 1 source files | source reference found; behavior pending|
| level2Color | "#FFD600" | dialog source reference | 1 source files | source reference found; behavior pending|
| markerColor | "#16106F" | dialog source reference | 5 source files | source reference found; behavior pending|
| barGrouping | 4 | numeric registry | 1 source files | source reference found; behavior pending|
| range1Minimum | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| range1Maximum | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| range2Minimum | 11 | numeric registry | 3 source files | source reference found; behavior pending|
| range2Maximum | 20 | numeric registry | 1 source files | source reference found; behavior pending|
| range3Minimum | 21 | numeric registry | 3 source files | source reference found; behavior pending|
| range3Maximum | 30 | numeric registry | 1 source files | source reference found; behavior pending|
| range4Minimum | 31 | numeric registry | 3 source files | source reference found; behavior pending|
| range4Maximum | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| level1Value | 1000 | numeric registry | 1 source files | source reference found; behavior pending|
| level1LineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| level2Value | 1500 | numeric registry | 1 source files | source reference found; behavior pending|
| level2LineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| markerMinimumDelta | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| deltaMode | "multi-range" | dialog source reference | 7 source files | source reference found; behavior pending|
| range1Enabled | true | dialog source reference | 3 source files | source reference found; behavior pending|
| range2Enabled | true | dialog source reference | 3 source files | source reference found; behavior pending|
| range3Enabled | true | dialog source reference | 3 source files | source reference found; behavior pending|
| range4Enabled | true | dialog source reference | 3 source files | source reference found; behavior pending|
| level1Enabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| level1LineStyle | "dashed" | needs inspection | 1 source files | source reference found; behavior pending|
| level2Enabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| level2LineStyle | "dashed" | needs inspection | 1 source files | source reference found; behavior pending|
| markerEnabled | false | dialog source reference | 4 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|

### KWANT Wall

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumTickBreakout | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumDeltaPercent | 70 | numeric registry | 4 source files | source reference found; behavior pending|
| minimumPerBarVolume | 20 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumClusterVolume | 300 | numeric registry | 1 source files | source reference found; behavior pending|
| tickGrouping | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| highestLowestMinimumBars | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| highestLowestNearnessBars | 50 | numeric registry | 1 source files | source reference found; behavior pending|
| markerWidthBars | 1.6 | numeric registry | 2 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| opacity | 92 | numeric registry | 165 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| plotPrice | "price-slope" | dialog source reference | 3 source files | source reference found; behavior pending|
| alertSoundEnabled | false | dialog source reference | 8 source files | source reference found; behavior pending|
| alertTone | "chime" | dialog source reference | 5 source files | source reference found; behavior pending|
| messagePopupEnabled | false | dialog source reference | 8 source files | source reference found; behavior pending|
| messageText | "KWANT Wall" | dialog source reference | 7 source files | source reference found; behavior pending|
| buyWallColor | "#22C55E" | dialog source reference | 3 source files | source reference found; behavior pending|
| sellWallColor | "#EF4444" | dialog source reference | 3 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### KWANT V-Tracker

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| accelerationColor | "#22D3EE" | dialog source reference | 4 source files | source reference found; behavior pending|
| exhaustionColor | "#F59E0B" | dialog source reference | 4 source files | source reference found; behavior pending|
| slowdownColor | "#A78BFA" | dialog source reference | 4 source files | source reference found; behavior pending|
| bidColor | "#A855F7" | dialog source reference | 24 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| controlLineWidth | 2 | numeric registry | 2 source files | source reference found; behavior pending|
| extremeLineWidth | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| textSize | 10 | numeric registry | 11 source files | source reference found; behavior pending|
| projectionBars | 20 | numeric registry | 2 source files | source reference found; behavior pending|
| patternOpacity | 32 | numeric registry | 2 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| accelerationEnabled | true | dialog source reference | 1 source files | source reference found; behavior pending|
| accelerationMode | "strong" | dialog source reference | 1 source files | source reference found; behavior pending|
| exhaustionEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| exhaustionMode | "medium" | dialog source reference | 1 source files | source reference found; behavior pending|
| slowdownEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| slowdownMode | "medium" | dialog source reference | 1 source files | source reference found; behavior pending|
| absorptionPressureEnabled | true | dialog source reference | 1 source files | source reference found; behavior pending|
| absorptionIntensity | "medium" | dialog source reference | 1 source files | source reference found; behavior pending|
| levelMode | "medium" | dialog source reference | 1 source files | source reference found; behavior pending|
| extendFarRight | false | dialog source reference | 1 source files | source reference found; behavior pending|
| alertSoundEnabled | false | dialog source reference | 8 source files | source reference found; behavior pending|
| alertTone | "chime" | dialog source reference | 5 source files | source reference found; behavior pending|
| messagePopupEnabled | false | dialog source reference | 8 source files | source reference found; behavior pending|
| messageText | "KWANT V-Tracker" | dialog source reference | 7 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

## Volume & Profiles

### Volume

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#8A8F98" | generated control candidate | 7 source files | source reference found; behavior pending|
| minimumTotalVolume | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| backgroundMode | "dominant" | dialog source reference | 1 source files | source reference found; behavior pending|
| deltaInputData | "volume" | dialog source reference | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### Daily Volume Profile

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| groupTicks | 4 | numeric registry | 26 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | numeric registry | 13 source files | source reference found; behavior pending|
| profileWidth | 2 | numeric registry | 7 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| minTradeVolume | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| maxTradeVolume | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| valueAreaPercent | 68 | dialog source reference | 30 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| pocLineWidth | 1 | dialog source reference | 10 source files | source reference found; behavior pending|
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | source reference found; behavior pending|
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| shiftedPocTicks | 4 | dialog source reference | 6 source files | source reference found; behavior pending|
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineMode | "show" | dialog source reference | 5 source files | source reference found; behavior pending|
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | source reference found; behavior pending|
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | source reference found; behavior pending|
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| showPeaks | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValleys | false | dialog source reference | 6 source files | source reference found; behavior pending|
| pvSensitivity | 40 | dialog source reference | 2 source files | source reference found; behavior pending|
| pvExcludeHighLow | true | dialog source reference | 2 source files | source reference found; behavior pending|
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| peakLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| showBusinessZone | false | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneOpacity | 3 | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showVwapLine | true | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapHighlight | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showDevelopingVwap | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showVwapBands | false | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapLineWidth | 1 | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand1 | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand2 | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand3 | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| showSummaryVolume | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showSummaryTrades | false | dialog source reference | 3 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| showLevelLabels | true | dialog source reference | 7 source files | source reference found; behavior pending|
| levelLabelSide | "right" | dialog source reference | 4 source files | source reference found; behavior pending|
| showLevelLabelPrice | true | dialog source reference | 4 source files | source reference found; behavior pending|
| visualStyle | "automatic" | dialog source reference | 6 source files | source reference found; behavior pending|
| widthMode | "period-percent" | dialog source reference | 4 source files | source reference found; behavior pending|
| borderWidth | 1 | dialog source reference | 20 source files | source reference found; behavior pending|
| numberOfProfiles | 0 | dialog source reference | 4 source files | source reference found; behavior pending|
| previousProfileWidth | 2 | dialog source reference | 1 source files | source reference found; behavior pending|
| currentProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| previousProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | source reference found; behavior pending|
| profileMode | "volume" | dialog source reference | 7 source files | source reference found; behavior pending|
| groupingMode | "manual" | dialog source reference | 13 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | internal metadata|
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionTokyoEnabled | false | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionLondonEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| snapMode | "left" | dialog source reference | 7 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showText | false | dialog source reference | 7 source files | source reference found; behavior pending|
| showValueArea | true | dialog source reference | 12 source files | source reference found; behavior pending|
| showPocLine | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showValueAreaLines | true | dialog source reference | 9 source files | source reference found; behavior pending|
| recentLevelsOnly | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showDelta | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showProfileSpine | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showDevelopingPoc | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showPocHighlight | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showProfileOutline | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showSummary | false | dialog source reference | 10 source files | source reference found; behavior pending|
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| pocColor | "#22C55E" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | source reference found; behavior pending|
| peakColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| valleyColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | source reference found; behavior pending|
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | source reference found; behavior pending|
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | source reference found; behavior pending|

### TPO Daily

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lengthValue | 1 | numeric registry | 7 source files | source reference found; behavior pending|
| subperiodMinutes | 30 | numeric registry | 4 source files | source reference found; behavior pending|
| profileCount | 10 | numeric registry | 5 source files | source reference found; behavior pending|
| ticksPerRow | 1 | numeric registry | 4 source files | source reference found; behavior pending|
| autoTargetRows | 90 | numeric registry | 3 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | numeric registry | 13 source files | source reference found; behavior pending|
| valueAreaPercent | 70 | numeric registry | 30 source files | source reference found; behavior pending|
| initialBalanceSubperiods | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| initialBalanceStartSubperiod | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| initialBalanceLineWidth | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumSinglePrintTicks | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| singlePrintMaxTpoCount | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| singlePrintStepDown | 3 | numeric registry | 3 source files | source reference found; behavior pending|
| singlePrintQuality | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| singlePrintVolumeSensitivity | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| blockSize | 8 | numeric registry | 3 source files | source reference found; behavior pending|
| blockGap | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| opacityPercent | 100 | numeric registry | 5 source files | source reference found; behavior pending|
| borderWidth | 0.75 | numeric registry | 20 source files | source reference found; behavior pending|
| barMarkerWidth | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| range1Minimum | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| range2Minimum | 25 | numeric registry | 3 source files | source reference found; behavior pending|
| range3Minimum | 50 | numeric registry | 3 source files | source reference found; behavior pending|
| range4Minimum | 75 | numeric registry | 3 source files | source reference found; behavior pending|
| pocLineWidth | 1.5 | numeric registry | 10 source files | source reference found; behavior pending|
| developingPocStartOffset | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| shiftedPocTicks | 1 | numeric registry | 6 source files | source reference found; behavior pending|
| pocGroupingOpacity | 20 | numeric registry | 3 source files | source reference found; behavior pending|
| valueAreaBackgroundOpacity | 10 | numeric registry | 3 source files | source reference found; behavior pending|
| valueAreaLineWidth | 1 | numeric registry | 10 source files | source reference found; behavior pending|
| singlePrintLineWidth | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| singlePrintFillOpacity | 60 | numeric registry | 3 source files | source reference found; behavior pending|
| summaryBackgroundOpacity | 82 | numeric registry | 3 source files | source reference found; behavior pending|
| summaryFontSize | 8 | numeric registry | 3 source files | source reference found; behavior pending|
| currentWidth | 100 | numeric registry | 4 source files | source reference found; behavior pending|
| currentOffset | 0 | numeric registry | 4 source files | source reference found; behavior pending|
| previousWidth | 80 | numeric registry | 3 source files | source reference found; behavior pending|
| previousOffset | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| peakValleyRadius | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| peakMinimumProminence | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumMergeMembers | 30 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumRenderedBlocks | 50000 | numeric registry | 4 source files | source reference found; behavior pending|
| fpsCap | 60 | numeric registry | 2 source files | source reference found; behavior pending|
| schemaVersion | 2 | needs inspection | 67 source files | internal metadata|
| indicatorVariant | "daily-tpo" | needs inspection | 3 source files | source reference found; behavior pending|
| scheduleKind | "daily" | dialog source reference | 5 source files | source reference found; behavior pending|
| periodMode | "multiple-profiles" | dialog source reference | 9 source files | source reference found; behavior pending|
| lengthUnit | "day" | dialog source reference | 3 source files | source reference found; behavior pending|
| timezone | "America/Chicago" | dialog source reference | 44 source files | source reference found; behavior pending|
| quickSessions | "" | dialog source reference | 5 source files | source reference found; behavior pending|
| dailyStartTime | "17:00:00" | dialog source reference | 5 source files | source reference found; behavior pending|
| dailyEndMode | "next-daily-start" | dialog source reference | 5 source files | source reference found; behavior pending|
| dailyEndTime | "16:00:00" | dialog source reference | 5 source files | source reference found; behavior pending|
| enabledWeekdays | "0,1,2,3,4" | dialog source reference | 5 source files | source reference found; behavior pending|
| weekStartDay | 0 | dialog source reference | 4 source files | source reference found; behavior pending|
| weekStartTime | "17:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| weekEndMode | "next-week-start" | dialog source reference | 4 source files | source reference found; behavior pending|
| weekEndDay | 5 | dialog source reference | 4 source files | source reference found; behavior pending|
| weekEndTime | "16:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| weekLength | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| customStartMs | 0 | dialog source reference | 8 source files | source reference found; behavior pending|
| customEndMs | 0 | dialog source reference | 8 source files | source reference found; behavior pending|
| customEndFollowsLatest | false | dialog source reference | 7 source files | source reference found; behavior pending|
| tpoType | "blocks" | dialog source reference | 3 source files | source reference found; behavior pending|
| showText | false | dialog source reference | 7 source files | source reference found; behavior pending|
| visualStyle | "solid" | dialog source reference | 6 source files | source reference found; behavior pending|
| displayType | "blocks" | dialog source reference | 3 source files | source reference found; behavior pending|
| splitMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| visitSource | "automatic" | dialog source reference | 5 source files | source reference found; behavior pending|
| groupingMode | "automatic" | dialog source reference | 13 source files | source reference found; behavior pending|
| freezeActiveGrouping | true | dialog source reference | 3 source files | source reference found; behavior pending|
| showPoc | true | dialog source reference | 13 source files | source reference found; behavior pending|
| showDevelopingPoc | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValueArea | true | dialog source reference | 12 source files | source reference found; behavior pending|
| showDevelopingValueArea | false | dialog source reference | 4 source files | source reference found; behavior pending|
| showInitialBalance | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showSinglePrints | false | dialog source reference | 6 source files | source reference found; behavior pending|
| includeExtremesInSinglePrints | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showPeaks | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValleys | false | dialog source reference | 6 source files | source reference found; behavior pending|
| peakValleySensitivity | 40 | dialog source reference | 5 source files | source reference found; behavior pending|
| peakValleyExcludeExtremes | true | dialog source reference | 3 source files | source reference found; behavior pending|
| showSummary | false | dialog source reference | 10 source files | source reference found; behavior pending|
| widthMode | "automatic" | dialog source reference | 4 source files | source reference found; behavior pending|
| showOnRight | false | dialog source reference | 4 source files | source reference found; behavior pending|
| mirror | false | dialog source reference | 10 source files | source reference found; behavior pending|
| lockPosition | false | dialog source reference | 2 source files | source reference found; behavior pending|
| showAboveBars | true | dialog source reference | 3 source files | source reference found; behavior pending|
| minimumTextSize | 7 | dialog source reference | 2 source files | source reference found; behavior pending|
| maximumTextSize | 11 | dialog source reference | 3 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | internal metadata|
| colourCalculation | "time" | dialog source reference | 3 source files | source reference found; behavior pending|
| colourReference | "fixed" | dialog source reference | 3 source files | source reference found; behavior pending|
| fixedVolumeColor | "#22D3EE" | dialog source reference | 3 source files | source reference found; behavior pending|
| fixedBidColor | "#FB7185" | dialog source reference | 3 source files | source reference found; behavior pending|
| fixedAskColor | "#22D3EE" | dialog source reference | 3 source files | source reference found; behavior pending|
| range1Enabled | true | dialog source reference | 3 source files | source reference found; behavior pending|
| range1VolumeColor | "#64748B" | dialog source reference | 2 source files | source reference found; behavior pending|
| range1BidColor | "#FB7185" | dialog source reference | 3 source files | source reference found; behavior pending|
| range1AskColor | "#22D3EE" | dialog source reference | 3 source files | source reference found; behavior pending|
| range2Enabled | true | dialog source reference | 3 source files | source reference found; behavior pending|
| range2VolumeColor | "#38BDF8" | dialog source reference | 2 source files | source reference found; behavior pending|
| range2BidColor | "#F43F5E" | dialog source reference | 3 source files | source reference found; behavior pending|
| range2AskColor | "#06B6D4" | dialog source reference | 3 source files | source reference found; behavior pending|
| range3Enabled | true | dialog source reference | 3 source files | source reference found; behavior pending|
| range3VolumeColor | "#8B5CF6" | dialog source reference | 2 source files | source reference found; behavior pending|
| range3BidColor | "#E11D48" | dialog source reference | 3 source files | source reference found; behavior pending|
| range3AskColor | "#0891B2" | dialog source reference | 3 source files | source reference found; behavior pending|
| range4Enabled | true | dialog source reference | 3 source files | source reference found; behavior pending|
| range4VolumeColor | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| range4BidColor | "#BE123C" | dialog source reference | 3 source files | source reference found; behavior pending|
| range4AskColor | "#0E7490" | dialog source reference | 3 source files | source reference found; behavior pending|
| initialAColorEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| initialAColor | "#F59E0B" | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBColorEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBColor | "#A855F7" | dialog source reference | 3 source files | source reference found; behavior pending|
| initialCColorEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| initialCColor | "#3B82F6" | dialog source reference | 3 source files | source reference found; behavior pending|
| initialDColorEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| initialDColor | "#14B8A6" | dialog source reference | 3 source files | source reference found; behavior pending|
| colorOpenEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| openColor | "#22C55E" | dialog source reference | 4 source files | source reference found; behavior pending|
| colorCloseEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| closeColor | "#F43F5E" | dialog source reference | 4 source files | source reference found; behavior pending|
| barMarkerEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| barMarkerStyle | "candle" | dialog source reference | 3 source files | source reference found; behavior pending|
| barMarkerUpColor | "#22D3EE" | dialog source reference | 3 source files | source reference found; behavior pending|
| barMarkerDownColor | "#FB7185" | dialog source reference | 3 source files | source reference found; behavior pending|
| barMarkerShowOpenClose | true | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineMode | "final" | dialog source reference | 5 source files | source reference found; behavior pending|
| pocHighlight | true | dialog source reference | 3 source files | source reference found; behavior pending|
| pocHighlightColor | "#F5B83B" | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineColor | "#F5B83B" | dialog source reference | 3 source files | source reference found; behavior pending|
| pocExtensionMode | "none" | dialog source reference | 7 source files | source reference found; behavior pending|
| showPocPriceLabel | true | dialog source reference | 3 source files | source reference found; behavior pending|
| valueAreaHighlight | true | dialog source reference | 3 source files | source reference found; behavior pending|
| valueAreaHighlightInside | true | dialog source reference | 3 source files | source reference found; behavior pending|
| valueAreaOutsideColor | "#475569" | dialog source reference | 3 source files | source reference found; behavior pending|
| valueAreaShowLines | true | dialog source reference | 4 source files | source reference found; behavior pending|
| recentLevelsOnly | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valueAreaShowBackground | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valueAreaExtensionMode | "none" | dialog source reference | 7 source files | source reference found; behavior pending|
| valueAreaLineColor | "#60A5FA" | dialog source reference | 5 source files | source reference found; behavior pending|
| valueAreaShowLabels | true | dialog source reference | 3 source files | source reference found; behavior pending|
| singlePrintExtensionMode | "to-next-profile" | dialog source reference | 3 source files | source reference found; behavior pending|
| singlePrintFillZone | true | dialog source reference | 3 source files | source reference found; behavior pending|
| singlePrintShowLabel | true | dialog source reference | 3 source files | source reference found; behavior pending|
| singlePrintShowTestedState | true | dialog source reference | 2 source files | source reference found; behavior pending|
| initialBalanceShowHigh | true | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBalanceShowLow | true | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBalanceShowRangeLabel | false | dialog source reference | 2 source files | source reference found; behavior pending|
| initialBalanceShowExtensions | false | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBalanceExtensionMultiples | "1,1.5,2" | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBalanceLineColor | "#94A3B8" | dialog source reference | 3 source files | source reference found; behavior pending|
| summaryLayout | "compact" | dialog source reference | 3 source files | source reference found; behavior pending|
| summaryLocation | "top-left" | dialog source reference | 3 source files | source reference found; behavior pending|
| summaryShowVolume | true | dialog source reference | 3 source files | source reference found; behavior pending|
| summaryShowTrades | true | dialog source reference | 3 source files | source reference found; behavior pending|
| summaryShowBidAsk | true | dialog source reference | 3 source files | source reference found; behavior pending|
| summaryTextColor | "#F5F7FA" | dialog source reference | 8 source files | source reference found; behavior pending|
| summaryBackgroundColor | "#090B10" | dialog source reference | 3 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| sessionPreset | "eth" | dialog source reference | 3 source files | internal metadata|
| customSessionStart | "17:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| customSessionEnd | "16:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | source reference found; behavior pending|
| inheritThemeColours | true | dialog source reference | 3 source files | source reference found; behavior pending|
| profileColor | "#22D3EE" | dialog source reference | 3 source files | source reference found; behavior pending|
| pocColor | "#F5B83B" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#60A5FA" | dialog source reference | 18 source files | source reference found; behavior pending|
| singlePrintColor | "#FB7185" | dialog source reference | 6 source files | source reference found; behavior pending|
| peakColor | "#A3E635" | dialog source reference | 7 source files | source reference found; behavior pending|
| valleyColor | "#8B5CF6" | dialog source reference | 7 source files | source reference found; behavior pending|
| allowDevelopingComposite | true | dialog source reference | 2 source files | source reference found; behavior pending|

### TPO Weekly

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lengthValue | 1 | numeric registry | 7 source files | source reference found; behavior pending|
| subperiodMinutes | 30 | numeric registry | 4 source files | source reference found; behavior pending|
| profileCount | 8 | numeric registry | 5 source files | source reference found; behavior pending|
| ticksPerRow | 1 | numeric registry | 4 source files | source reference found; behavior pending|
| autoTargetRows | 90 | numeric registry | 3 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | numeric registry | 13 source files | source reference found; behavior pending|
| valueAreaPercent | 70 | numeric registry | 30 source files | source reference found; behavior pending|
| initialBalanceSubperiods | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| initialBalanceStartSubperiod | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| initialBalanceLineWidth | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| minimumSinglePrintTicks | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| singlePrintMaxTpoCount | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| singlePrintStepDown | 3 | numeric registry | 3 source files | source reference found; behavior pending|
| singlePrintQuality | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| singlePrintVolumeSensitivity | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| blockSize | 8 | numeric registry | 3 source files | source reference found; behavior pending|
| blockGap | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| opacityPercent | 100 | numeric registry | 5 source files | source reference found; behavior pending|
| borderWidth | 0.75 | numeric registry | 20 source files | source reference found; behavior pending|
| barMarkerWidth | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| range1Minimum | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| range2Minimum | 25 | numeric registry | 3 source files | source reference found; behavior pending|
| range3Minimum | 50 | numeric registry | 3 source files | source reference found; behavior pending|
| range4Minimum | 75 | numeric registry | 3 source files | source reference found; behavior pending|
| pocLineWidth | 1.5 | numeric registry | 10 source files | source reference found; behavior pending|
| developingPocStartOffset | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| shiftedPocTicks | 1 | numeric registry | 6 source files | source reference found; behavior pending|
| pocGroupingOpacity | 20 | numeric registry | 3 source files | source reference found; behavior pending|
| valueAreaBackgroundOpacity | 10 | numeric registry | 3 source files | source reference found; behavior pending|
| valueAreaLineWidth | 1 | numeric registry | 10 source files | source reference found; behavior pending|
| singlePrintLineWidth | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| singlePrintFillOpacity | 60 | numeric registry | 3 source files | source reference found; behavior pending|
| summaryBackgroundOpacity | 82 | numeric registry | 3 source files | source reference found; behavior pending|
| summaryFontSize | 8 | numeric registry | 3 source files | source reference found; behavior pending|
| currentWidth | 100 | numeric registry | 4 source files | source reference found; behavior pending|
| currentOffset | 0 | numeric registry | 4 source files | source reference found; behavior pending|
| previousWidth | 80 | numeric registry | 3 source files | source reference found; behavior pending|
| previousOffset | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| peakValleyRadius | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| peakMinimumProminence | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumMergeMembers | 30 | numeric registry | 3 source files | source reference found; behavior pending|
| maximumRenderedBlocks | 50000 | numeric registry | 4 source files | source reference found; behavior pending|
| fpsCap | 60 | numeric registry | 2 source files | source reference found; behavior pending|
| schemaVersion | 2 | needs inspection | 67 source files | internal metadata|
| indicatorVariant | "weekly-tpo" | needs inspection | 3 source files | source reference found; behavior pending|
| scheduleKind | "weekly" | dialog source reference | 5 source files | source reference found; behavior pending|
| periodMode | "multiple-profiles" | dialog source reference | 9 source files | source reference found; behavior pending|
| lengthUnit | "week" | dialog source reference | 3 source files | source reference found; behavior pending|
| timezone | "America/Chicago" | dialog source reference | 44 source files | source reference found; behavior pending|
| quickSessions | "" | dialog source reference | 5 source files | source reference found; behavior pending|
| dailyStartTime | "17:00:00" | dialog source reference | 5 source files | source reference found; behavior pending|
| dailyEndMode | "next-daily-start" | dialog source reference | 5 source files | source reference found; behavior pending|
| dailyEndTime | "16:00:00" | dialog source reference | 5 source files | source reference found; behavior pending|
| enabledWeekdays | "0,1,2,3,4" | dialog source reference | 5 source files | source reference found; behavior pending|
| weekStartDay | 0 | dialog source reference | 4 source files | source reference found; behavior pending|
| weekStartTime | "17:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| weekEndMode | "next-week-start" | dialog source reference | 4 source files | source reference found; behavior pending|
| weekEndDay | 5 | dialog source reference | 4 source files | source reference found; behavior pending|
| weekEndTime | "16:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| weekLength | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| customStartMs | 0 | dialog source reference | 8 source files | source reference found; behavior pending|
| customEndMs | 0 | dialog source reference | 8 source files | source reference found; behavior pending|
| customEndFollowsLatest | false | dialog source reference | 7 source files | source reference found; behavior pending|
| tpoType | "blocks" | dialog source reference | 3 source files | source reference found; behavior pending|
| showText | false | dialog source reference | 7 source files | source reference found; behavior pending|
| visualStyle | "solid" | dialog source reference | 6 source files | source reference found; behavior pending|
| displayType | "blocks" | dialog source reference | 3 source files | source reference found; behavior pending|
| splitMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| visitSource | "automatic" | dialog source reference | 5 source files | source reference found; behavior pending|
| groupingMode | "automatic" | dialog source reference | 13 source files | source reference found; behavior pending|
| freezeActiveGrouping | true | dialog source reference | 3 source files | source reference found; behavior pending|
| showPoc | true | dialog source reference | 13 source files | source reference found; behavior pending|
| showDevelopingPoc | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValueArea | true | dialog source reference | 12 source files | source reference found; behavior pending|
| showDevelopingValueArea | false | dialog source reference | 4 source files | source reference found; behavior pending|
| showInitialBalance | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showSinglePrints | false | dialog source reference | 6 source files | source reference found; behavior pending|
| includeExtremesInSinglePrints | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showPeaks | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValleys | false | dialog source reference | 6 source files | source reference found; behavior pending|
| peakValleySensitivity | 40 | dialog source reference | 5 source files | source reference found; behavior pending|
| peakValleyExcludeExtremes | true | dialog source reference | 3 source files | source reference found; behavior pending|
| showSummary | false | dialog source reference | 10 source files | source reference found; behavior pending|
| widthMode | "automatic" | dialog source reference | 4 source files | source reference found; behavior pending|
| showOnRight | false | dialog source reference | 4 source files | source reference found; behavior pending|
| mirror | false | dialog source reference | 10 source files | source reference found; behavior pending|
| lockPosition | false | dialog source reference | 2 source files | source reference found; behavior pending|
| showAboveBars | true | dialog source reference | 3 source files | source reference found; behavior pending|
| minimumTextSize | 7 | dialog source reference | 2 source files | source reference found; behavior pending|
| maximumTextSize | 11 | dialog source reference | 3 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | internal metadata|
| colourCalculation | "time" | dialog source reference | 3 source files | source reference found; behavior pending|
| colourReference | "fixed" | dialog source reference | 3 source files | source reference found; behavior pending|
| fixedVolumeColor | "#22D3EE" | dialog source reference | 3 source files | source reference found; behavior pending|
| fixedBidColor | "#FB7185" | dialog source reference | 3 source files | source reference found; behavior pending|
| fixedAskColor | "#22D3EE" | dialog source reference | 3 source files | source reference found; behavior pending|
| range1Enabled | true | dialog source reference | 3 source files | source reference found; behavior pending|
| range1VolumeColor | "#64748B" | dialog source reference | 2 source files | source reference found; behavior pending|
| range1BidColor | "#FB7185" | dialog source reference | 3 source files | source reference found; behavior pending|
| range1AskColor | "#22D3EE" | dialog source reference | 3 source files | source reference found; behavior pending|
| range2Enabled | true | dialog source reference | 3 source files | source reference found; behavior pending|
| range2VolumeColor | "#38BDF8" | dialog source reference | 2 source files | source reference found; behavior pending|
| range2BidColor | "#F43F5E" | dialog source reference | 3 source files | source reference found; behavior pending|
| range2AskColor | "#06B6D4" | dialog source reference | 3 source files | source reference found; behavior pending|
| range3Enabled | true | dialog source reference | 3 source files | source reference found; behavior pending|
| range3VolumeColor | "#8B5CF6" | dialog source reference | 2 source files | source reference found; behavior pending|
| range3BidColor | "#E11D48" | dialog source reference | 3 source files | source reference found; behavior pending|
| range3AskColor | "#0891B2" | dialog source reference | 3 source files | source reference found; behavior pending|
| range4Enabled | true | dialog source reference | 3 source files | source reference found; behavior pending|
| range4VolumeColor | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| range4BidColor | "#BE123C" | dialog source reference | 3 source files | source reference found; behavior pending|
| range4AskColor | "#0E7490" | dialog source reference | 3 source files | source reference found; behavior pending|
| initialAColorEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| initialAColor | "#F59E0B" | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBColorEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBColor | "#A855F7" | dialog source reference | 3 source files | source reference found; behavior pending|
| initialCColorEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| initialCColor | "#3B82F6" | dialog source reference | 3 source files | source reference found; behavior pending|
| initialDColorEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| initialDColor | "#14B8A6" | dialog source reference | 3 source files | source reference found; behavior pending|
| colorOpenEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| openColor | "#22C55E" | dialog source reference | 4 source files | source reference found; behavior pending|
| colorCloseEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| closeColor | "#F43F5E" | dialog source reference | 4 source files | source reference found; behavior pending|
| barMarkerEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| barMarkerStyle | "candle" | dialog source reference | 3 source files | source reference found; behavior pending|
| barMarkerUpColor | "#22D3EE" | dialog source reference | 3 source files | source reference found; behavior pending|
| barMarkerDownColor | "#FB7185" | dialog source reference | 3 source files | source reference found; behavior pending|
| barMarkerShowOpenClose | true | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineMode | "final" | dialog source reference | 5 source files | source reference found; behavior pending|
| pocHighlight | true | dialog source reference | 3 source files | source reference found; behavior pending|
| pocHighlightColor | "#F5B83B" | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineColor | "#F5B83B" | dialog source reference | 3 source files | source reference found; behavior pending|
| pocExtensionMode | "none" | dialog source reference | 7 source files | source reference found; behavior pending|
| showPocPriceLabel | true | dialog source reference | 3 source files | source reference found; behavior pending|
| valueAreaHighlight | true | dialog source reference | 3 source files | source reference found; behavior pending|
| valueAreaHighlightInside | true | dialog source reference | 3 source files | source reference found; behavior pending|
| valueAreaOutsideColor | "#475569" | dialog source reference | 3 source files | source reference found; behavior pending|
| valueAreaShowLines | true | dialog source reference | 4 source files | source reference found; behavior pending|
| recentLevelsOnly | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valueAreaShowBackground | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valueAreaExtensionMode | "none" | dialog source reference | 7 source files | source reference found; behavior pending|
| valueAreaLineColor | "#60A5FA" | dialog source reference | 5 source files | source reference found; behavior pending|
| valueAreaShowLabels | true | dialog source reference | 3 source files | source reference found; behavior pending|
| singlePrintExtensionMode | "to-next-profile" | dialog source reference | 3 source files | source reference found; behavior pending|
| singlePrintFillZone | true | dialog source reference | 3 source files | source reference found; behavior pending|
| singlePrintShowLabel | true | dialog source reference | 3 source files | source reference found; behavior pending|
| singlePrintShowTestedState | true | dialog source reference | 2 source files | source reference found; behavior pending|
| initialBalanceShowHigh | true | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBalanceShowLow | true | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBalanceShowRangeLabel | false | dialog source reference | 2 source files | source reference found; behavior pending|
| initialBalanceShowExtensions | false | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBalanceExtensionMultiples | "1,1.5,2" | dialog source reference | 3 source files | source reference found; behavior pending|
| initialBalanceLineColor | "#94A3B8" | dialog source reference | 3 source files | source reference found; behavior pending|
| summaryLayout | "compact" | dialog source reference | 3 source files | source reference found; behavior pending|
| summaryLocation | "top-left" | dialog source reference | 3 source files | source reference found; behavior pending|
| summaryShowVolume | true | dialog source reference | 3 source files | source reference found; behavior pending|
| summaryShowTrades | true | dialog source reference | 3 source files | source reference found; behavior pending|
| summaryShowBidAsk | true | dialog source reference | 3 source files | source reference found; behavior pending|
| summaryTextColor | "#F5F7FA" | dialog source reference | 8 source files | source reference found; behavior pending|
| summaryBackgroundColor | "#090B10" | dialog source reference | 3 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| sessionPreset | "eth" | dialog source reference | 3 source files | internal metadata|
| customSessionStart | "17:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| customSessionEnd | "16:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | source reference found; behavior pending|
| inheritThemeColours | true | dialog source reference | 3 source files | source reference found; behavior pending|
| profileColor | "#22D3EE" | dialog source reference | 3 source files | source reference found; behavior pending|
| pocColor | "#F5B83B" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#60A5FA" | dialog source reference | 18 source files | source reference found; behavior pending|
| singlePrintColor | "#FB7185" | dialog source reference | 6 source files | source reference found; behavior pending|
| peakColor | "#A3E635" | dialog source reference | 7 source files | source reference found; behavior pending|
| valleyColor | "#8B5CF6" | dialog source reference | 7 source files | source reference found; behavior pending|
| allowDevelopingComposite | true | dialog source reference | 2 source files | source reference found; behavior pending|

### Weekly Volume Profile

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| groupTicks | 4 | numeric registry | 26 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | numeric registry | 13 source files | source reference found; behavior pending|
| profileWidth | 2 | numeric registry | 7 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| minTradeVolume | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| maxTradeVolume | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| weekSelection | "rolling-five" | dialog source reference | 1 source files | source reference found; behavior pending|
| weeklyWindowSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|
| valueAreaPercent | 68 | dialog source reference | 30 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| pocLineWidth | 1 | dialog source reference | 10 source files | source reference found; behavior pending|
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | source reference found; behavior pending|
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| shiftedPocTicks | 4 | dialog source reference | 6 source files | source reference found; behavior pending|
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineMode | "show" | dialog source reference | 5 source files | source reference found; behavior pending|
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | source reference found; behavior pending|
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | source reference found; behavior pending|
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| showPeaks | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValleys | false | dialog source reference | 6 source files | source reference found; behavior pending|
| pvSensitivity | 40 | dialog source reference | 2 source files | source reference found; behavior pending|
| pvExcludeHighLow | true | dialog source reference | 2 source files | source reference found; behavior pending|
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| peakLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| showBusinessZone | false | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneOpacity | 3 | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showVwapLine | true | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapHighlight | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showDevelopingVwap | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showVwapBands | false | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapLineWidth | 1 | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand1 | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand2 | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand3 | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| showSummaryVolume | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showSummaryTrades | false | dialog source reference | 3 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| showLevelLabels | true | dialog source reference | 7 source files | source reference found; behavior pending|
| levelLabelSide | "right" | dialog source reference | 4 source files | source reference found; behavior pending|
| showLevelLabelPrice | true | dialog source reference | 4 source files | source reference found; behavior pending|
| visualStyle | "automatic" | dialog source reference | 6 source files | source reference found; behavior pending|
| widthMode | "period-percent" | dialog source reference | 4 source files | source reference found; behavior pending|
| borderWidth | 1 | dialog source reference | 20 source files | source reference found; behavior pending|
| numberOfProfiles | 0 | dialog source reference | 4 source files | source reference found; behavior pending|
| previousProfileWidth | 2 | dialog source reference | 1 source files | source reference found; behavior pending|
| currentProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| previousProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | source reference found; behavior pending|
| profileMode | "volume" | dialog source reference | 7 source files | source reference found; behavior pending|
| groupingMode | "manual" | dialog source reference | 13 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | internal metadata|
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionTokyoEnabled | false | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionLondonEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| snapMode | "left" | dialog source reference | 7 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showText | false | dialog source reference | 7 source files | source reference found; behavior pending|
| showValueArea | true | dialog source reference | 12 source files | source reference found; behavior pending|
| showPocLine | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showValueAreaLines | true | dialog source reference | 9 source files | source reference found; behavior pending|
| recentLevelsOnly | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showDelta | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showProfileSpine | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showDevelopingPoc | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showPocHighlight | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showProfileOutline | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showSummary | false | dialog source reference | 10 source files | source reference found; behavior pending|
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| pocColor | "#22C55E" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | source reference found; behavior pending|
| peakColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| valleyColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | source reference found; behavior pending|
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | source reference found; behavior pending|
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | source reference found; behavior pending|

### Monthly Volume Profile

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| profileWidth | 2 | dialog source reference | 7 source files | source reference found; behavior pending|
| opacity | 100 | dialog source reference | 165 source files | source reference found; behavior pending|
| valueAreaPercent | 68 | dialog source reference | 30 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| minTradeVolume | 0 | dialog source reference | 12 source files | source reference found; behavior pending|
| maxTradeVolume | 0 | dialog source reference | 12 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | dialog source reference | 13 source files | source reference found; behavior pending|
| groupTicks | 4 | dialog source reference | 26 source files | source reference found; behavior pending|
| pocLineWidth | 1 | dialog source reference | 10 source files | source reference found; behavior pending|
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | source reference found; behavior pending|
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| shiftedPocTicks | 4 | dialog source reference | 6 source files | source reference found; behavior pending|
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineMode | "show" | dialog source reference | 5 source files | source reference found; behavior pending|
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | source reference found; behavior pending|
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | source reference found; behavior pending|
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| showPeaks | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValleys | false | dialog source reference | 6 source files | source reference found; behavior pending|
| pvSensitivity | 40 | dialog source reference | 2 source files | source reference found; behavior pending|
| pvExcludeHighLow | true | dialog source reference | 2 source files | source reference found; behavior pending|
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| peakLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| showBusinessZone | false | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneOpacity | 3 | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showVwapLine | true | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapHighlight | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showDevelopingVwap | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showVwapBands | false | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapLineWidth | 1 | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand1 | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand2 | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand3 | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| showSummaryVolume | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showSummaryTrades | false | dialog source reference | 3 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| showLevelLabels | true | dialog source reference | 7 source files | source reference found; behavior pending|
| levelLabelSide | "right" | dialog source reference | 4 source files | source reference found; behavior pending|
| showLevelLabelPrice | true | dialog source reference | 4 source files | source reference found; behavior pending|
| visualStyle | "automatic" | dialog source reference | 6 source files | source reference found; behavior pending|
| widthMode | "period-percent" | dialog source reference | 4 source files | source reference found; behavior pending|
| borderWidth | 1 | dialog source reference | 20 source files | source reference found; behavior pending|
| numberOfProfiles | 3 | dialog source reference | 4 source files | source reference found; behavior pending|
| previousProfileWidth | 2 | dialog source reference | 1 source files | source reference found; behavior pending|
| currentProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| previousProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | source reference found; behavior pending|
| profileMode | "volume" | dialog source reference | 7 source files | source reference found; behavior pending|
| groupingMode | "manual" | dialog source reference | 13 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | internal metadata|
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionTokyoEnabled | false | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionLondonEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| snapMode | "left" | dialog source reference | 7 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showText | false | dialog source reference | 7 source files | source reference found; behavior pending|
| showValueArea | true | dialog source reference | 12 source files | source reference found; behavior pending|
| showPocLine | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showValueAreaLines | true | dialog source reference | 9 source files | source reference found; behavior pending|
| recentLevelsOnly | true | dialog source reference | 3 source files | source reference found; behavior pending|
| showDelta | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showProfileSpine | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showDevelopingPoc | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showPocHighlight | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showProfileOutline | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showSummary | false | dialog source reference | 10 source files | source reference found; behavior pending|
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| pocColor | "#22C55E" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | source reference found; behavior pending|
| peakColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| valleyColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | source reference found; behavior pending|
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | source reference found; behavior pending|
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | source reference found; behavior pending|

### Session Volume Profile

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| profileWidth | 2 | dialog source reference | 7 source files | source reference found; behavior pending|
| opacity | 100 | dialog source reference | 165 source files | source reference found; behavior pending|
| valueAreaPercent | 68 | dialog source reference | 30 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| minTradeVolume | 0 | dialog source reference | 12 source files | source reference found; behavior pending|
| maxTradeVolume | 0 | dialog source reference | 12 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | dialog source reference | 13 source files | source reference found; behavior pending|
| groupTicks | 4 | dialog source reference | 26 source files | source reference found; behavior pending|
| pocLineWidth | 1 | dialog source reference | 10 source files | source reference found; behavior pending|
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | source reference found; behavior pending|
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| shiftedPocTicks | 4 | dialog source reference | 6 source files | source reference found; behavior pending|
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineMode | "show" | dialog source reference | 5 source files | source reference found; behavior pending|
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | source reference found; behavior pending|
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | source reference found; behavior pending|
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| showPeaks | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValleys | false | dialog source reference | 6 source files | source reference found; behavior pending|
| pvSensitivity | 40 | dialog source reference | 2 source files | source reference found; behavior pending|
| pvExcludeHighLow | true | dialog source reference | 2 source files | source reference found; behavior pending|
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| peakLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| showBusinessZone | false | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneOpacity | 3 | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showVwapLine | true | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapHighlight | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showDevelopingVwap | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showVwapBands | false | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapLineWidth | 1 | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand1 | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand2 | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand3 | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| showSummaryVolume | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showSummaryTrades | false | dialog source reference | 3 source files | source reference found; behavior pending|
| filterMode | "filter" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| showLevelLabels | true | dialog source reference | 7 source files | source reference found; behavior pending|
| levelLabelSide | "right" | dialog source reference | 4 source files | source reference found; behavior pending|
| showLevelLabelPrice | true | dialog source reference | 4 source files | source reference found; behavior pending|
| visualStyle | "automatic" | dialog source reference | 6 source files | source reference found; behavior pending|
| widthMode | "period-percent" | dialog source reference | 4 source files | source reference found; behavior pending|
| borderWidth | 1 | dialog source reference | 20 source files | source reference found; behavior pending|
| numberOfProfiles | 5 | dialog source reference | 4 source files | source reference found; behavior pending|
| previousProfileWidth | 2 | dialog source reference | 1 source files | source reference found; behavior pending|
| currentProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| previousProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | source reference found; behavior pending|
| profileMode | "volume" | dialog source reference | 7 source files | source reference found; behavior pending|
| groupingMode | "manual" | dialog source reference | 13 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | internal metadata|
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionTokyoEnabled | false | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionLondonEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| snapMode | "left" | dialog source reference | 7 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showText | false | dialog source reference | 7 source files | source reference found; behavior pending|
| showValueArea | true | dialog source reference | 12 source files | source reference found; behavior pending|
| showPocLine | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showValueAreaLines | true | dialog source reference | 9 source files | source reference found; behavior pending|
| recentLevelsOnly | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showDelta | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showProfileSpine | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showDevelopingPoc | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showPocHighlight | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showProfileOutline | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showSummary | false | dialog source reference | 10 source files | source reference found; behavior pending|
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| pocColor | "#22C55E" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | source reference found; behavior pending|
| peakColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| valleyColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | source reference found; behavior pending|
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | source reference found; behavior pending|
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | source reference found; behavior pending|

### Composite Volume Profile

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| compositeLengthValue | 500 | numeric registry | 1 source files | source reference found; behavior pending|
| groupTicks | 4 | numeric registry | 26 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | numeric registry | 13 source files | source reference found; behavior pending|
| profileWidth | 2 | numeric registry | 7 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| minTradeVolume | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| maxTradeVolume | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| valueAreaPercent | 68 | dialog source reference | 30 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| pocLineWidth | 1 | dialog source reference | 10 source files | source reference found; behavior pending|
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | source reference found; behavior pending|
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| shiftedPocTicks | 4 | dialog source reference | 6 source files | source reference found; behavior pending|
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineMode | "show" | dialog source reference | 5 source files | source reference found; behavior pending|
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | source reference found; behavior pending|
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | source reference found; behavior pending|
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| showPeaks | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValleys | false | dialog source reference | 6 source files | source reference found; behavior pending|
| pvSensitivity | 40 | dialog source reference | 2 source files | source reference found; behavior pending|
| pvExcludeHighLow | true | dialog source reference | 2 source files | source reference found; behavior pending|
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| peakLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| showBusinessZone | false | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneOpacity | 3 | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showVwapLine | true | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapHighlight | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showDevelopingVwap | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showVwapBands | false | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapLineWidth | 1 | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand1 | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand2 | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand3 | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| showSummaryVolume | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showSummaryTrades | false | dialog source reference | 3 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| showLevelLabels | true | dialog source reference | 7 source files | source reference found; behavior pending|
| levelLabelSide | "right" | dialog source reference | 4 source files | source reference found; behavior pending|
| showLevelLabelPrice | true | dialog source reference | 4 source files | source reference found; behavior pending|
| visualStyle | "automatic" | dialog source reference | 6 source files | source reference found; behavior pending|
| widthMode | "period-percent" | dialog source reference | 4 source files | source reference found; behavior pending|
| borderWidth | 1 | dialog source reference | 20 source files | source reference found; behavior pending|
| numberOfProfiles | 0 | dialog source reference | 4 source files | source reference found; behavior pending|
| previousProfileWidth | 2 | dialog source reference | 1 source files | source reference found; behavior pending|
| currentProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| previousProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | source reference found; behavior pending|
| profileMode | "volume" | dialog source reference | 7 source files | source reference found; behavior pending|
| groupingMode | "manual" | dialog source reference | 13 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | internal metadata|
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionTokyoEnabled | false | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionLondonEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| snapMode | "right" | dialog source reference | 7 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showText | false | dialog source reference | 7 source files | source reference found; behavior pending|
| showValueArea | true | dialog source reference | 12 source files | source reference found; behavior pending|
| showPocLine | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showValueAreaLines | true | dialog source reference | 9 source files | source reference found; behavior pending|
| recentLevelsOnly | true | dialog source reference | 3 source files | source reference found; behavior pending|
| showDelta | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showProfileSpine | false | generated control candidate | 4 source files | source reference found; behavior pending|
| showDevelopingPoc | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showPocHighlight | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showProfileOutline | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showSummary | false | dialog source reference | 10 source files | source reference found; behavior pending|
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| pocColor | "#22C55E" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | source reference found; behavior pending|
| peakColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| valleyColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | source reference found; behavior pending|
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | source reference found; behavior pending|
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | source reference found; behavior pending|
| compositeRangeMode | "loaded-range" | dialog source reference | 1 source files | source reference found; behavior pending|
| compositeCustomStartMs | "" | dialog source reference | 1 source files | source reference found; behavior pending|
| compositeCustomEndMs | "" | dialog source reference | 1 source files | source reference found; behavior pending|
| compositeCustomEndFollowsLatest | true | dialog source reference | 1 source files | source reference found; behavior pending|

### Visible Range Volume Profile

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| profileWidth | 2 | dialog source reference | 7 source files | source reference found; behavior pending|
| opacity | 100 | dialog source reference | 165 source files | source reference found; behavior pending|
| valueAreaPercent | 68 | dialog source reference | 30 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| minTradeVolume | 0 | dialog source reference | 12 source files | source reference found; behavior pending|
| maxTradeVolume | 0 | dialog source reference | 12 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | dialog source reference | 13 source files | source reference found; behavior pending|
| groupTicks | 4 | dialog source reference | 26 source files | source reference found; behavior pending|
| pocLineWidth | 1 | dialog source reference | 10 source files | source reference found; behavior pending|
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | source reference found; behavior pending|
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| shiftedPocTicks | 4 | dialog source reference | 6 source files | source reference found; behavior pending|
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineMode | "show" | dialog source reference | 5 source files | source reference found; behavior pending|
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | source reference found; behavior pending|
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | source reference found; behavior pending|
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| showPeaks | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValleys | false | dialog source reference | 6 source files | source reference found; behavior pending|
| pvSensitivity | 40 | dialog source reference | 2 source files | source reference found; behavior pending|
| pvExcludeHighLow | true | dialog source reference | 2 source files | source reference found; behavior pending|
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| peakLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| showBusinessZone | false | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneOpacity | 3 | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showVwapLine | true | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapHighlight | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showDevelopingVwap | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showVwapBands | false | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapLineWidth | 1 | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand1 | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand2 | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand3 | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| showSummaryVolume | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showSummaryTrades | false | dialog source reference | 3 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| showLevelLabels | true | dialog source reference | 7 source files | source reference found; behavior pending|
| levelLabelSide | "right" | dialog source reference | 4 source files | source reference found; behavior pending|
| showLevelLabelPrice | true | dialog source reference | 4 source files | source reference found; behavior pending|
| visualStyle | "automatic" | dialog source reference | 6 source files | source reference found; behavior pending|
| widthMode | "window-percent" | dialog source reference | 4 source files | source reference found; behavior pending|
| borderWidth | 1 | dialog source reference | 20 source files | source reference found; behavior pending|
| numberOfProfiles | 1 | dialog source reference | 4 source files | source reference found; behavior pending|
| previousProfileWidth | 2 | dialog source reference | 1 source files | source reference found; behavior pending|
| currentProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| previousProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | source reference found; behavior pending|
| profileMode | "volume" | dialog source reference | 7 source files | source reference found; behavior pending|
| groupingMode | "manual" | dialog source reference | 13 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | internal metadata|
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionTokyoEnabled | false | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionLondonEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| snapMode | "right" | dialog source reference | 7 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showText | false | dialog source reference | 7 source files | source reference found; behavior pending|
| showValueArea | true | dialog source reference | 12 source files | source reference found; behavior pending|
| showPocLine | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showValueAreaLines | true | dialog source reference | 9 source files | source reference found; behavior pending|
| recentLevelsOnly | true | dialog source reference | 3 source files | source reference found; behavior pending|
| showDelta | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showProfileSpine | false | generated control candidate | 4 source files | source reference found; behavior pending|
| showDevelopingPoc | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showPocHighlight | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showProfileOutline | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showSummary | false | dialog source reference | 10 source files | source reference found; behavior pending|
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| pocColor | "#22C55E" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | source reference found; behavior pending|
| peakColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| valleyColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | source reference found; behavior pending|
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | source reference found; behavior pending|
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | source reference found; behavior pending|

### Custom Draw-On Volume Profile

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| groupTicks | 4 | numeric registry | 26 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | numeric registry | 13 source files | source reference found; behavior pending|
| profileWidth | 2 | numeric registry | 7 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| minTradeVolume | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| maxTradeVolume | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| valueAreaPercent | 68 | dialog source reference | 30 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| pocLineWidth | 1 | dialog source reference | 10 source files | source reference found; behavior pending|
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | source reference found; behavior pending|
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| shiftedPocTicks | 4 | dialog source reference | 6 source files | source reference found; behavior pending|
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineMode | "show" | dialog source reference | 5 source files | source reference found; behavior pending|
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | source reference found; behavior pending|
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | source reference found; behavior pending|
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| showPeaks | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValleys | false | dialog source reference | 6 source files | source reference found; behavior pending|
| pvSensitivity | 40 | dialog source reference | 2 source files | source reference found; behavior pending|
| pvExcludeHighLow | true | dialog source reference | 2 source files | source reference found; behavior pending|
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| peakLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| showBusinessZone | false | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneOpacity | 3 | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showVwapLine | true | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapHighlight | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showDevelopingVwap | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showVwapBands | false | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapLineWidth | 1 | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand1 | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand2 | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand3 | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| showSummaryVolume | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showSummaryTrades | false | dialog source reference | 3 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| showLevelLabels | true | dialog source reference | 7 source files | source reference found; behavior pending|
| levelLabelSide | "right" | dialog source reference | 4 source files | source reference found; behavior pending|
| showLevelLabelPrice | true | dialog source reference | 4 source files | source reference found; behavior pending|
| visualStyle | "automatic" | dialog source reference | 6 source files | source reference found; behavior pending|
| widthMode | "period-percent" | dialog source reference | 4 source files | source reference found; behavior pending|
| borderWidth | 1 | dialog source reference | 20 source files | source reference found; behavior pending|
| numberOfProfiles | 0 | dialog source reference | 4 source files | source reference found; behavior pending|
| previousProfileWidth | 2 | dialog source reference | 1 source files | source reference found; behavior pending|
| currentProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| previousProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | source reference found; behavior pending|
| profileMode | "volume" | dialog source reference | 7 source files | source reference found; behavior pending|
| groupingMode | "manual" | dialog source reference | 13 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | internal metadata|
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionTokyoEnabled | false | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionLondonEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| snapMode | "off" | dialog source reference | 7 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showText | false | dialog source reference | 7 source files | source reference found; behavior pending|
| showValueArea | true | dialog source reference | 12 source files | source reference found; behavior pending|
| showPocLine | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showValueAreaLines | true | dialog source reference | 9 source files | source reference found; behavior pending|
| recentLevelsOnly | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showDelta | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showProfileSpine | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showDevelopingPoc | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showPocHighlight | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showProfileOutline | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showSummary | false | dialog source reference | 10 source files | source reference found; behavior pending|
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| pocColor | "#22C55E" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | source reference found; behavior pending|
| peakColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| valleyColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | source reference found; behavior pending|
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | source reference found; behavior pending|
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | source reference found; behavior pending|

### Ask/Bid Volume Profile

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| groupTicks | 4 | numeric registry | 26 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | numeric registry | 13 source files | source reference found; behavior pending|
| profileWidth | 2 | numeric registry | 7 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| minTradeVolume | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| maxTradeVolume | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| valueAreaPercent | 68 | dialog source reference | 30 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| pocLineWidth | 1 | dialog source reference | 10 source files | source reference found; behavior pending|
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | source reference found; behavior pending|
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| shiftedPocTicks | 4 | dialog source reference | 6 source files | source reference found; behavior pending|
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineMode | "show" | dialog source reference | 5 source files | source reference found; behavior pending|
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | source reference found; behavior pending|
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | source reference found; behavior pending|
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| showPeaks | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValleys | false | dialog source reference | 6 source files | source reference found; behavior pending|
| pvSensitivity | 40 | dialog source reference | 2 source files | source reference found; behavior pending|
| pvExcludeHighLow | true | dialog source reference | 2 source files | source reference found; behavior pending|
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| peakLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| showBusinessZone | false | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneOpacity | 3 | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showVwapLine | true | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapHighlight | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showDevelopingVwap | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showVwapBands | false | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapLineWidth | 1 | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand1 | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand2 | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand3 | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| showSummaryVolume | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showSummaryTrades | false | dialog source reference | 3 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| showLevelLabels | true | dialog source reference | 7 source files | source reference found; behavior pending|
| levelLabelSide | "right" | dialog source reference | 4 source files | source reference found; behavior pending|
| showLevelLabelPrice | true | dialog source reference | 4 source files | source reference found; behavior pending|
| visualStyle | "automatic" | dialog source reference | 6 source files | source reference found; behavior pending|
| widthMode | "period-percent" | dialog source reference | 4 source files | source reference found; behavior pending|
| borderWidth | 1 | dialog source reference | 20 source files | source reference found; behavior pending|
| numberOfProfiles | 0 | dialog source reference | 4 source files | source reference found; behavior pending|
| previousProfileWidth | 2 | dialog source reference | 1 source files | source reference found; behavior pending|
| currentProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| previousProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | source reference found; behavior pending|
| profileMode | "bid-ask" | dialog source reference | 7 source files | source reference found; behavior pending|
| groupingMode | "manual" | dialog source reference | 13 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | internal metadata|
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionTokyoEnabled | false | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionLondonEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| snapMode | "left" | dialog source reference | 7 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showText | false | dialog source reference | 7 source files | source reference found; behavior pending|
| showValueArea | true | dialog source reference | 12 source files | source reference found; behavior pending|
| showPocLine | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showValueAreaLines | true | dialog source reference | 9 source files | source reference found; behavior pending|
| recentLevelsOnly | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showDelta | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showProfileSpine | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showDevelopingPoc | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showPocHighlight | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showProfileOutline | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showSummary | false | dialog source reference | 10 source files | source reference found; behavior pending|
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| pocColor | "#22C55E" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | source reference found; behavior pending|
| peakColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| valleyColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | source reference found; behavior pending|
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | source reference found; behavior pending|
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | source reference found; behavior pending|

### Delta Profile

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| groupTicks | 4 | numeric registry | 26 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | numeric registry | 13 source files | source reference found; behavior pending|
| profileWidth | 2 | numeric registry | 7 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| minTradeVolume | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| maxTradeVolume | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| valueAreaPercent | 68 | dialog source reference | 30 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| pocLineWidth | 1 | dialog source reference | 10 source files | source reference found; behavior pending|
| pocHighlightOpacity | 100 | dialog source reference | 2 source files | source reference found; behavior pending|
| developingPocStartMinutes | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| shiftedPocTicks | 4 | dialog source reference | 6 source files | source reference found; behavior pending|
| shiftedPocOpacity | 35 | dialog source reference | 3 source files | source reference found; behavior pending|
| pocLineMode | "show" | dialog source reference | 5 source files | source reference found; behavior pending|
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| valueAreaLineWidth | 2 | dialog source reference | 10 source files | source reference found; behavior pending|
| valueAreaDeveloping | "no" | dialog source reference | 1 source files | source reference found; behavior pending|
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| showPeaks | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValleys | false | dialog source reference | 6 source files | source reference found; behavior pending|
| pvSensitivity | 40 | dialog source reference | 2 source files | source reference found; behavior pending|
| pvExcludeHighLow | true | dialog source reference | 2 source files | source reference found; behavior pending|
| peakMinVolumePercent | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyMaxVolumePercent | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyOnlyOutsideValueArea | false | dialog source reference | 3 source files | source reference found; behavior pending|
| peakLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyLineWidth | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| peakExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| showBusinessZone | false | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneOpacity | 3 | dialog source reference | 2 source files | source reference found; behavior pending|
| businessZoneLineWidth | 0 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showVwapLine | true | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapHighlight | false | dialog source reference | 1 source files | source reference found; behavior pending|
| showDevelopingVwap | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showVwapBands | false | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapLineWidth | 1 | dialog source reference | 4 source files | source reference found; behavior pending|
| vwapLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapHighlightOpacity | 18 | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand1 | 1 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand2 | 2 | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapBand3 | 0 | dialog source reference | 3 source files | source reference found; behavior pending|
| showSummaryVolume | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showSummaryTrades | false | dialog source reference | 3 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| filterTime | "rth" | dialog source reference | 13 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| showLevelLabels | true | dialog source reference | 7 source files | source reference found; behavior pending|
| levelLabelSide | "right" | dialog source reference | 4 source files | source reference found; behavior pending|
| showLevelLabelPrice | true | dialog source reference | 4 source files | source reference found; behavior pending|
| visualStyle | "automatic" | dialog source reference | 6 source files | source reference found; behavior pending|
| widthMode | "period-percent" | dialog source reference | 4 source files | source reference found; behavior pending|
| borderWidth | 1 | dialog source reference | 20 source files | source reference found; behavior pending|
| numberOfProfiles | 0 | dialog source reference | 4 source files | source reference found; behavior pending|
| previousProfileWidth | 2 | dialog source reference | 1 source files | source reference found; behavior pending|
| currentProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| previousProfileOffset | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| sessionStartMinutes | 510 | dialog source reference | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | dialog source reference | 5 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | source reference found; behavior pending|
| profileMode | "delta" | dialog source reference | 7 source files | source reference found; behavior pending|
| groupingMode | "manual" | dialog source reference | 13 source files | source reference found; behavior pending|
| gradientPreset | "off" | dialog source reference | 12 source files | internal metadata|
| sessionSelectionArmed | false | dialog source reference | 0 source files | no runtime reference; inspect dynamic wiring|
| sessionAsiaEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionTokyoEnabled | false | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionLondonEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| sessionNewYorkEnabled | true | generated control candidate | 2 source files | source reference found; behavior pending|
| snapMode | "left" | dialog source reference | 7 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showText | false | dialog source reference | 7 source files | source reference found; behavior pending|
| showValueArea | true | dialog source reference | 12 source files | source reference found; behavior pending|
| showPocLine | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showValueAreaLines | true | dialog source reference | 9 source files | source reference found; behavior pending|
| recentLevelsOnly | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showDelta | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showProfileSpine | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showDevelopingPoc | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showPocHighlight | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showProfileOutline | true | generated control candidate | 4 source files | source reference found; behavior pending|
| showSummary | false | dialog source reference | 10 source files | source reference found; behavior pending|
| profileSettingsVersion | 15 | needs inspection | 1 source files | internal metadata|
| volumeColor | "#22C55E" | dialog source reference | 4 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| pocColor | "#22C55E" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | source reference found; behavior pending|
| peakColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| valleyColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| businessZoneColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapColor | "#F59E0B" | dialog source reference | 8 source files | source reference found; behavior pending|
| vwapHighlightColor | "#F59E0B" | dialog source reference | 2 source files | source reference found; behavior pending|
| vwapBandColor | "#71717A" | dialog source reference | 5 source files | source reference found; behavior pending|
| summaryTextColor | "#22C55E" | dialog source reference | 8 source files | source reference found; behavior pending|

### KWANT Profile Swing

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| volumeColor | "#64748B" | dialog source reference | 4 source files | source reference found; behavior pending|
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| pocColor | "#F59E0B" | dialog source reference | 21 source files | source reference found; behavior pending|
| vwapColor | "#38BDF8" | dialog source reference | 8 source files | source reference found; behavior pending|
| absoluteReversal | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| reversalTicks | 20 | numeric registry | 2 source files | source reference found; behavior pending|
| leftBars | 3 | numeric registry | 2 source files | source reference found; behavior pending|
| rightBars | 3 | numeric registry | 2 source files | source reference found; behavior pending|
| stopAbsoluteReversal | 5 | numeric registry | 1 source files | source reference found; behavior pending|
| stopReversalTicks | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| stopLeftBars | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| stopRightBars | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| swingMinTicks | 12 | numeric registry | 1 source files | source reference found; behavior pending|
| swingMaxTicks | 240 | numeric registry | 1 source files | source reference found; behavior pending|
| vwapBreakTicks | 8 | numeric registry | 1 source files | source reference found; behavior pending|
| filterMin | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| filterMax | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | numeric registry | 13 source files | source reference found; behavior pending|
| groupTicks | 4 | numeric registry | 26 source files | source reference found; behavior pending|
| valueAreaPercent | 68 | numeric registry | 30 source files | source reference found; behavior pending|
| maxProfiles | 12 | numeric registry | 1 source files | source reference found; behavior pending|
| profileWidth | 34 | numeric registry | 7 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| profileMode | "volume" | dialog source reference | 7 source files | source reference found; behavior pending|
| lengthType | "swing" | dialog source reference | 4 source files | source reference found; behavior pending|
| includeReversalBar | true | dialog source reference | 1 source files | source reference found; behavior pending|
| displayMode | "profile-and-lines" | dialog source reference | 9 source files | source reference found; behavior pending|
| swingType | "reversal-ticks" | dialog source reference | 1 source files | source reference found; behavior pending|
| stopSwingEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| stopSwingType | "reversal-ticks" | dialog source reference | 1 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| groupingMode | "automatic" | dialog source reference | 13 source files | source reference found; behavior pending|
| showPocLine | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showValueAreaLines | true | dialog source reference | 9 source files | source reference found; behavior pending|
| showVwapLine | true | dialog source reference | 4 source files | source reference found; behavior pending|
| showLevelLabels | true | dialog source reference | 7 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### KWANT Profile Values

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| pocColor | "#F59E0B" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#22C55E" | dialog source reference | 18 source files | source reference found; behavior pending|
| peakColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| valleyColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| vwapColor | "#38BDF8" | dialog source reference | 8 source files | source reference found; behavior pending|
| vwapBandColor | "#64748B" | dialog source reference | 5 source files | source reference found; behavior pending|
| summaryTextColor | "#E2E8F0" | dialog source reference | 8 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|
| lengthValue | 1 | numeric registry | 7 source files | source reference found; behavior pending|
| filterMin | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| filterMax | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| autoGroupFactor | 1 | numeric registry | 13 source files | source reference found; behavior pending|
| groupTicks | 4 | numeric registry | 26 source files | source reference found; behavior pending|
| numberOfProfiles | 6 | numeric registry | 4 source files | source reference found; behavior pending|
| valueAreaPercent | 68 | numeric registry | 30 source files | source reference found; behavior pending|
| sessionStartMinutes | 510 | numeric registry | 5 source files | source reference found; behavior pending|
| sessionEndMinutes | 915 | numeric registry | 5 source files | source reference found; behavior pending|
| developingPocStartMinutes | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| shiftedPocTicks | 1 | numeric registry | 6 source files | source reference found; behavior pending|
| shiftedPocOpacity | 68 | numeric registry | 3 source files | source reference found; behavior pending|
| peakValleySensitivity | 40 | numeric registry | 5 source files | source reference found; behavior pending|
| peakMinimumVolumePercent | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| valleyMaximumVolumePercent | 100 | numeric registry | 3 source files | source reference found; behavior pending|
| vwapBand1 | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| vwapBand2 | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| vwapBand3 | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| pocLineWidth | 1 | numeric registry | 10 source files | source reference found; behavior pending|
| valueAreaLineWidth | 2 | numeric registry | 10 source files | source reference found; behavior pending|
| peakLineWidth | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| valleyLineWidth | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| vwapLineWidth | 1 | numeric registry | 4 source files | source reference found; behavior pending|
| schemaVersion | 2 | needs inspection | 67 source files | internal metadata|
| periodMode | "multiples" | dialog source reference | 9 source files | source reference found; behavior pending|
| lengthType | "days" | dialog source reference | 4 source files | source reference found; behavior pending|
| customStartMs | 0 | dialog source reference | 8 source files | source reference found; behavior pending|
| customEndMs | 0 | dialog source reference | 8 source files | source reference found; behavior pending|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| groupingMode | "automatic" | dialog source reference | 13 source files | source reference found; behavior pending|
| filterMode | "none" | dialog source reference | 14 source files | source reference found; behavior pending|
| useEndSessionAsStartDay | false | dialog source reference | 9 source files | source reference found; behavior pending|
| showPocLine | true | dialog source reference | 6 source files | source reference found; behavior pending|
| pocLineMode | "show" | dialog source reference | 5 source files | source reference found; behavior pending|
| pocExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| showValueAreaLines | true | dialog source reference | 9 source files | source reference found; behavior pending|
| developingValueArea | "no" | dialog source reference | 5 source files | source reference found; behavior pending|
| valueAreaExtensionMode | "to-window-end" | dialog source reference | 7 source files | source reference found; behavior pending|
| showPeaks | false | dialog source reference | 6 source files | source reference found; behavior pending|
| showValleys | false | dialog source reference | 6 source files | source reference found; behavior pending|
| excludeHighLow | true | dialog source reference | 4 source files | source reference found; behavior pending|
| peakExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| valleyExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| showVwap | true | dialog source reference | 6 source files | source reference found; behavior pending|
| showDevelopingVwap | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showVwapBands | false | dialog source reference | 3 source files | source reference found; behavior pending|
| vwapExtensionMode | "none" | dialog source reference | 3 source files | source reference found; behavior pending|
| showSummary | false | dialog source reference | 10 source files | source reference found; behavior pending|
| showSummaryTrades | false | dialog source reference | 3 source files | source reference found; behavior pending|
| showLevelLabels | true | dialog source reference | 7 source files | source reference found; behavior pending|
| showLevelLabelPrice | true | dialog source reference | 4 source files | source reference found; behavior pending|
| levelLabelSide | "right" | dialog source reference | 4 source files | source reference found; behavior pending|
| levelLineStyle | "dash" | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### TPO Levels

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| rowSize | 1 | numeric registry | 4 source files | source reference found; behavior pending|
| minimumTrades | 500 | numeric registry | 4 source files | source reference found; behavior pending|
| tailMinimumRows | 3 | numeric registry | 3 source files | source reference found; behavior pending|
| singlePrintMinimumRows | 4 | numeric registry | 3 source files | source reference found; behavior pending|
| ledgeMinimumBrackets | 3 | numeric registry | 3 source files | source reference found; behavior pending|
| ledgeToleranceRows | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| failedAuctionMinimumRows | 5 | numeric registry | 3 source files | source reference found; behavior pending|
| failedAuctionMaximumTpo | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| edgeSmoothingRows | 5 | numeric registry | 3 source files | source reference found; behavior pending|
| edgeDropPercent | 50 | numeric registry | 2 source files | source reference found; behavior pending|
| edgeMaximumWidthRows | 3 | numeric registry | 3 source files | source reference found; behavior pending|
| acceptedBasePercent | 60 | numeric registry | 2 source files | source reference found; behavior pending|
| seamTroughPercent | 50 | numeric registry | 2 source files | source reference found; behavior pending|
| volumeLvnPercent | 50 | numeric registry | 2 source files | source reference found; behavior pending|
| acceptanceBrackets | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| partialFillPercent | 50 | numeric registry | 2 source files | source reference found; behavior pending|
| expireAfterSessions | 10 | numeric registry | 3 source files | source reference found; behavior pending|
| expireStrength | 20 | numeric registry | 3 source files | source reference found; behavior pending|
| fillOpacity | 15 | numeric registry | 27 source files | source reference found; behavior pending|
| borderOpacity | 100 | numeric registry | 3 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| supportColor | "#22C55E" | generated control candidate | 2 source files | source reference found; behavior pending|
| resistanceColor | "#EF4444" | generated control candidate | 2 source files | source reference found; behavior pending|
| neutralColor | "#94A3B8" | dialog source reference | 33 source files | source reference found; behavior pending|
| tpoLevelsSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### VWAP

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| mainColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper1Color | "#4ADE80" | generated control candidate | 2 source files | source reference found; behavior pending|
| lower1Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper2Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| lower2Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper3Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| lower3Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper4Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| lower4Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper5Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| lower5Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| periodValue | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| sessionStartHour | 17 | numeric registry | 3 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| bandLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| band1 | 1 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| band2 | 2 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| band3 | 3 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| band4 | 4 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| band5 | 5 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| source | "hlc3" | dialog source reference | 301 source files | source reference found; behavior pending|
| periodMode | "days" | dialog source reference | 9 source files | source reference found; behavior pending|
| envelopeMode | "standard-deviation" | dialog source reference | 2 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| bandLineStyle | "dotted" | dialog source reference | 1 source files | source reference found; behavior pending|
| band1Enabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| band2Enabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| band3Enabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| band4Enabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| band5Enabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showCurrentValue | false | generated control candidate | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| vwapSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### VWAP Envelopes

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| mainColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper1Color | "#4ADE80" | generated control candidate | 2 source files | source reference found; behavior pending|
| lower1Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper2Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| lower2Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper3Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| lower3Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper4Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| lower4Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper5Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| lower5Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| periodValue | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| bandLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| band1 | 1 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| band2 | 2 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| band3 | 3 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| band4 | 4 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| band5 | 5 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| source | "hlc3" | dialog source reference | 301 source files | source reference found; behavior pending|
| periodMode | "days" | dialog source reference | 9 source files | source reference found; behavior pending|
| envelopeMode | "standard-deviation" | dialog source reference | 2 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| bandLineStyle | "dotted" | dialog source reference | 1 source files | source reference found; behavior pending|
| band1Enabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| band2Enabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| band3Enabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| band4Enabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| band5Enabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showCurrentValue | false | generated control candidate | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| vwapSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### Rolling VWAP

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| upper1Color | "#4ADE80" | generated control candidate | 2 source files | source reference found; behavior pending|
| lower1Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper2Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| lower2Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper3Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| lower3Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper4Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| lower4Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| upper5Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| lower5Color | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| periodValue | 60 | numeric registry | 3 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| bandLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| band1 | 1 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| band2 | 2 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| band3 | 3 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| band4 | 4 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| band5 | 5 | numeric registry | 0 source files | no runtime reference; inspect dynamic wiring|
| source | "hlc3" | dialog source reference | 301 source files | source reference found; behavior pending|
| periodMode | "bars" | dialog source reference | 9 source files | source reference found; behavior pending|
| envelopeMode | "standard-deviation" | dialog source reference | 2 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| bandLineStyle | "dotted" | dialog source reference | 1 source files | source reference found; behavior pending|
| band1Enabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| band2Enabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| band3Enabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| band4Enabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| band5Enabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showCurrentValue | false | generated control candidate | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| vwapSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### Market Statistics

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| textColor | "#60A5FA" | dialog source reference | 58 source files | source reference found; behavior pending|
| averageColor | "#22C55E" | generated control candidate | 3 source files | source reference found; behavior pending|
| deviationColor | "#EF4444" | generated control candidate | 3 source files | source reference found; behavior pending|
| backgroundColor | "#09090B" | dialog source reference | 85 source files | source reference found; behavior pending|
| fontSize | 10 | numeric registry | 87 source files | source reference found; behavior pending|
| standardDeviationPercent | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| filterMin | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| filterMax | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| initialRange | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| endRange | 500 | numeric registry | 1 source files | source reference found; behavior pending|
| stepRange | 50 | numeric registry | 1 source files | source reference found; behavior pending|
| initialFilterMinutes | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| endFilterMinutes | 1439 | numeric registry | 1 source files | source reference found; behavior pending|
| panelOpacity | 72 | numeric registry | 1 source files | source reference found; behavior pending|
| statMode | "trades" | dialog source reference | 1 source files | source reference found; behavior pending|
| dataType | "volume" | dialog source reference | 1 source files | source reference found; behavior pending|
| barInput | "volume" | dialog source reference | 1 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | source reference found; behavior pending|
| showEmptyRanges | true | dialog source reference | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### On Candle Stats

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| filterMin | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| filterMax | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| fontSize | 10 | numeric registry | 87 source files | source reference found; behavior pending|
| smallerFontSize | 6 | numeric registry | 2 source files | source reference found; behavior pending|
| maxRatio | 100 | numeric registry | 3 source files | source reference found; behavior pending|
| tickOffset | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| inputData | "Volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| autoTextFormat | true | generated control candidate | 2 source files | source reference found; behavior pending|
| absoluteSign | false | generated control candidate | 2 source files | source reference found; behavior pending|
| opacityBasedOnRatio | true | generated control candidate | 2 source files | source reference found; behavior pending|
| colorTextBasedOnDelta | true | generated control candidate | 2 source files | source reference found; behavior pending|
| pricePlot | "price-slope" | dialog source reference | 2 source files | source reference found; behavior pending|
| showMaxDeltaVolume | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showMinDeltaVolume | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showTotalVolume | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showDeltaVolume | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showTotalTrades | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showDeltaTrades | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showRangeTicks | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showCotHigh | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showCotLow | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showCotBar | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showDeltaPercent | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showBarRatio | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showBidVolume | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showAskVolume | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showSessionCvd | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showVolumePerSecond | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showDuration | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showHighRatio | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showLowRatio | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showTotalEffort | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showDeltaEffort | false | generated control candidate | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|
| neutralColor | "#94A3B8" | dialog source reference | 33 source files | source reference found; behavior pending|
| textColor | "#E5E7EB" | dialog source reference | 58 source files | source reference found; behavior pending|
| backgroundColor | "#27272A" | dialog source reference | 85 source files | source reference found; behavior pending|
| onCandleStatsSettingsVersion | 1 | dialog source reference | 0 source files | internal metadata|

## Market Structure

### Important Levels

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| days | 2 | numeric registry | 78 source files | source reference found; behavior pending|
| weeks | 1 | numeric registry | 9 source files | source reference found; behavior pending|
| months | 1 | numeric registry | 18 source files | source reference found; behavior pending|
| skipLast | false | dialog source reference | 1 source files | source reference found; behavior pending|
| plotType | "label-and-line" | dialog source reference | 1 source files | source reference found; behavior pending|
| textAlign | "right" | dialog source reference | 62 source files | source reference found; behavior pending|
| fontSize | 10 | numeric registry | 87 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| filterTime | "eth" | dialog source reference | 13 source files | source reference found; behavior pending|
| customStartTime | "08:30" | dialog source reference | 3 source files | source reference found; behavior pending|
| customEndTime | "15:15" | dialog source reference | 2 source files | source reference found; behavior pending|
| dailyAverage | true | generated control candidate | 1 source files | source reference found; behavior pending|
| dailyLow | true | generated control candidate | 1 source files | source reference found; behavior pending|
| dailyHigh | true | generated control candidate | 1 source files | source reference found; behavior pending|
| dailyOpen | true | generated control candidate | 1 source files | source reference found; behavior pending|
| dailyClose | true | generated control candidate | 1 source files | source reference found; behavior pending|
| dailyPoc | true | generated control candidate | 1 source files | source reference found; behavior pending|
| dailyValueArea | true | generated control candidate | 1 source files | source reference found; behavior pending|
| dailyVwap | true | generated control candidate | 1 source files | source reference found; behavior pending|
| weeklyAverage | true | generated control candidate | 1 source files | source reference found; behavior pending|
| weeklyLow | true | generated control candidate | 1 source files | source reference found; behavior pending|
| weeklyHigh | true | generated control candidate | 1 source files | source reference found; behavior pending|
| weeklyOpen | true | generated control candidate | 1 source files | source reference found; behavior pending|
| weeklyClose | true | generated control candidate | 1 source files | source reference found; behavior pending|
| weeklyPoc | true | generated control candidate | 1 source files | source reference found; behavior pending|
| weeklyValueArea | true | generated control candidate | 1 source files | source reference found; behavior pending|
| weeklyVwap | true | generated control candidate | 1 source files | source reference found; behavior pending|
| monthlyAverage | false | generated control candidate | 1 source files | source reference found; behavior pending|
| monthlyLow | true | generated control candidate | 1 source files | source reference found; behavior pending|
| monthlyHigh | true | generated control candidate | 1 source files | source reference found; behavior pending|
| monthlyOpen | true | generated control candidate | 1 source files | source reference found; behavior pending|
| monthlyClose | true | generated control candidate | 1 source files | source reference found; behavior pending|
| monthlyPoc | true | generated control candidate | 1 source files | source reference found; behavior pending|
| monthlyValueArea | true | generated control candidate | 1 source files | source reference found; behavior pending|
| monthlyVwap | true | generated control candidate | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| lowColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| highColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| openColor | "#A3A3A3" | dialog source reference | 4 source files | source reference found; behavior pending|
| closeColor | "#FFFFFF" | dialog source reference | 4 source files | source reference found; behavior pending|
| midColor | "#F59E0B" | dialog source reference | 6 source files | source reference found; behavior pending|
| pocColor | "#F59E0B" | dialog source reference | 21 source files | source reference found; behavior pending|
| valueAreaColor | "#38BDF8" | dialog source reference | 18 source files | source reference found; behavior pending|
| vwapColor | "#A78BFA" | dialog source reference | 8 source files | source reference found; behavior pending|
| importantLevelsSettingsVersion | 1 | dialog source reference | 1 source files | internal metadata|

### Absolute Levels

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| firstValue | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| secondValue | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| firstLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| secondLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| firstLineStyle | "solid" | needs inspection | 1 source files | source reference found; behavior pending|
| secondLineStyle | "solid" | needs inspection | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| firstLineColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| secondLineColor | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|

### Pivot Points

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| fontSize | 12 | numeric registry | 87 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| lineStyle | "dashed" | dialog source reference | 50 source files | source reference found; behavior pending|
| labelAlign | "left" | dialog source reference | 3 source files | source reference found; behavior pending|
| periodsToShow | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| customReferenceEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| referenceTimeframe | "hour" | dialog source reference | 1 source files | source reference found; behavior pending|
| referenceValue | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| customSessionEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| customSessionStart | "00:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| customSessionEnd | "00:00:00" | dialog source reference | 4 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| pivotPointColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| r1Color | "#EF4444" | generated control candidate | 1 source files | source reference found; behavior pending|
| r2Color | "#EF4444" | generated control candidate | 1 source files | source reference found; behavior pending|
| s1Color | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| s2Color | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|

### Price Movement Levels

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| daysToLoad | 3 | numeric registry | 7 source files | source reference found; behavior pending|
| levelBasedOn | "open" | dialog source reference | 1 source files | source reference found; behavior pending|
| stepMode | "percentual" | dialog source reference | 1 source files | source reference found; behavior pending|
| stepValue | 0.5 | numeric registry | 1 source files | source reference found; behavior pending|
| fontSize | 11 | numeric registry | 87 source files | source reference found; behavior pending|
| minimumLevels | 5 | numeric registry | 2 source files | source reference found; behavior pending|
| supportLineStyle | "dashed" | dialog source reference | 1 source files | source reference found; behavior pending|
| supportLineWidth | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| resistanceLineStyle | "dashed" | dialog source reference | 1 source files | source reference found; behavior pending|
| resistanceLineWidth | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| zeroLineStyle | "dotted" | dialog source reference | 4 source files | source reference found; behavior pending|
| zeroLineWidth | 2 | numeric registry | 3 source files | source reference found; behavior pending|
| customTimeEnabled | false | generated control candidate | 1 source files | source reference found; behavior pending|
| customStartTime | "00:00:00" | dialog source reference | 3 source files | source reference found; behavior pending|
| customEndTime | "00:00:00" | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| textColor | "#FFFFFF" | dialog source reference | 58 source files | source reference found; behavior pending|
| supportLineColor | "#22C55E" | generated control candidate | 2 source files | source reference found; behavior pending|
| resistanceLineColor | "#4ADE80" | generated control candidate | 2 source files | source reference found; behavior pending|
| zeroLineColor | "#22C55E" | generated control candidate | 5 source files | source reference found; behavior pending|

### FVG Identifier

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minNumTicks | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| maxNumTicks | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| backgroundOpacity | 40 | numeric registry | 9 source files | source reference found; behavior pending|
| resetStartDay | true | dialog source reference | 1 source files | source reference found; behavior pending|
| removeOnShadowTriggered | false | dialog source reference | 1 source files | source reference found; behavior pending|
| maxBarsExtension | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| breakoutPercent | 35 | numeric registry | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| upColor | "#22C55E" | dialog source reference | 34 source files | source reference found; behavior pending|
| downColor | "#EF4444" | dialog source reference | 34 source files | source reference found; behavior pending|

### Gap Detector

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| gapMode | "day-begin" | dialog source reference | 1 source files | source reference found; behavior pending|
| calculationMode | "tick" | dialog source reference | 3 source files | source reference found; behavior pending|
| percentValue | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| tickValue | 20 | numeric registry | 4 source files | source reference found; behavior pending|
| triggerWholeBar | true | generated control candidate | 1 source files | source reference found; behavior pending|
| backgroundOpacity | 40 | numeric registry | 9 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| upColor | "#22C55E" | dialog source reference | 34 source files | source reference found; behavior pending|
| downColor | "#EF4444" | dialog source reference | 34 source files | source reference found; behavior pending|

### Divergence Detector

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| pivotStrength | 3 | numeric registry | 5 source files | source reference found; behavior pending|
| synchronizationBars | 3 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumSwingBars | 3 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumLookbackBars | 1200 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumMoveTicks | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumSignals | 24 | numeric registry | 2 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| opacity | 100 | numeric registry | 165 source files | source reference found; behavior pending|
| labelFontSize | 10 | numeric registry | 2 source files | source reference found; behavior pending|
| comparisonMode | "automatic-es-nq" | dialog source reference | 4 source files | source reference found; behavior pending|
| includeNonConfirmation | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showBullish | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showBearish | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| showPivotDots | true | generated control candidate | 2 source files | source reference found; behavior pending|
| dashedLines | false | generated control candidate | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| bullishColor | "#22C55E" | generated control candidate | 8 source files | source reference found; behavior pending|
| bearishColor | "#EF4444" | generated control candidate | 8 source files | source reference found; behavior pending|
| divergenceDetectorSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Confluence Identifier

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| supportColor1 | "#22C55E" | needs inspection | 3 source files | source reference found; behavior pending|
| supportColor2 | "#16A34A" | needs inspection | 3 source files | source reference found; behavior pending|
| supportColor3 | "#15803D" | needs inspection | 3 source files | source reference found; behavior pending|
| supportColor4 | "#14532D" | needs inspection | 3 source files | source reference found; behavior pending|
| resistanceColor1 | "#EF4444" | needs inspection | 3 source files | source reference found; behavior pending|
| resistanceColor2 | "#DC2626" | needs inspection | 3 source files | source reference found; behavior pending|
| resistanceColor3 | "#B91C1C" | needs inspection | 3 source files | source reference found; behavior pending|
| resistanceColor4 | "#7F1D1D" | needs inspection | 3 source files | source reference found; behavior pending|
| trendUpColor | "#22C55E" | generated control candidate | 3 source files | source reference found; behavior pending|
| trendDownColor | "#EF4444" | generated control candidate | 3 source files | source reference found; behavior pending|
| swingUpColor | "#4ADE80" | generated control candidate | 3 source files | source reference found; behavior pending|
| swingDownColor | "#FB7185" | generated control candidate | 3 source files | source reference found; behavior pending|
| startLineColor | "#94A3B8" | generated control candidate | 3 source files | source reference found; behavior pending|
| filterMin | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| filterMax | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| tickSensitivity | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumConfluences | 5 | numeric registry | 1 source files | source reference found; behavior pending|
| trendReversalPercent | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| trendSwingCount | 9 | numeric registry | 1 source files | source reference found; behavior pending|
| swingReversalPercent | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| firstGroupTicks | 4 | numeric registry | 1 source files | source reference found; behavior pending|
| firstProfileCount | 6 | numeric registry | 1 source files | source reference found; behavior pending|
| secondGroupTicks | 4 | numeric registry | 1 source files | source reference found; behavior pending|
| secondProfileCount | 4 | numeric registry | 1 source files | source reference found; behavior pending|
| thirdGroupTicks | 4 | numeric registry | 1 source files | source reference found; behavior pending|
| thirdProfileCount | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| peakMinimumVolumePercent | 60 | numeric registry | 3 source files | source reference found; behavior pending|
| valleyMaximumVolumePercent | 25 | numeric registry | 3 source files | source reference found; behavior pending|
| deltaImbalancePercent | 70 | numeric registry | 1 source files | source reference found; behavior pending|
| supportRange2 | 6 | numeric registry | 1 source files | source reference found; behavior pending|
| supportRange3 | 8 | numeric registry | 1 source files | source reference found; behavior pending|
| supportRange4 | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| resistanceRange2 | 6 | numeric registry | 1 source files | source reference found; behavior pending|
| resistanceRange3 | 8 | numeric registry | 1 source files | source reference found; behavior pending|
| resistanceRange4 | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| zoneOpacity | 18 | numeric registry | 7 source files | source reference found; behavior pending|
| schemaVersion | 1 | needs inspection | 67 source files | internal metadata|
| inputData | "volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| startMode | "zig-zag" | dialog source reference | 2 source files | source reference found; behavior pending|
| startDateMs | 0 | dialog source reference | 1 source files | source reference found; behavior pending|
| enableZigZagSwing | true | dialog source reference | 1 source files | source reference found; behavior pending|
| includeSwingBeforeMidTrend | true | dialog source reference | 1 source files | source reference found; behavior pending|
| enableRetracements | true | dialog source reference | 1 source files | source reference found; behavior pending|
| enableRetracement382 | true | dialog source reference | 1 source files | source reference found; behavior pending|
| enableRetracement50 | true | dialog source reference | 1 source files | source reference found; behavior pending|
| enableRetracement618 | true | dialog source reference | 1 source files | source reference found; behavior pending|
| enableRetracement75 | true | dialog source reference | 1 source files | source reference found; behavior pending|
| excludePreviousRetracements | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showDevelopingLines | false | dialog source reference | 2 source files | source reference found; behavior pending|
| showSourceLines | false | dialog source reference | 2 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| firstEnabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| firstPeriod | "daily" | needs inspection | 1 source files | source reference found; behavior pending|
| firstGroupingMode | "automatic" | needs inspection | 1 source files | source reference found; behavior pending|
| firstIncludeByNumber | true | generated control candidate | 1 source files | source reference found; behavior pending|
| firstUsePoc | true | generated control candidate | 1 source files | source reference found; behavior pending|
| firstUseValueArea | true | generated control candidate | 1 source files | source reference found; behavior pending|
| firstUsePeaks | true | generated control candidate | 1 source files | source reference found; behavior pending|
| firstUseValleys | true | generated control candidate | 1 source files | source reference found; behavior pending|
| firstUseDeltaImbalances | false | generated control candidate | 1 source files | source reference found; behavior pending|
| secondEnabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| secondPeriod | "weekly" | needs inspection | 1 source files | source reference found; behavior pending|
| secondGroupingMode | "automatic" | needs inspection | 1 source files | source reference found; behavior pending|
| secondIncludeByNumber | true | generated control candidate | 1 source files | source reference found; behavior pending|
| secondUsePoc | true | generated control candidate | 1 source files | source reference found; behavior pending|
| secondUseValueArea | true | generated control candidate | 1 source files | source reference found; behavior pending|
| secondUsePeaks | true | generated control candidate | 1 source files | source reference found; behavior pending|
| secondUseValleys | true | generated control candidate | 1 source files | source reference found; behavior pending|
| secondUseDeltaImbalances | false | generated control candidate | 1 source files | source reference found; behavior pending|
| thirdEnabled | true | generated control candidate | 1 source files | source reference found; behavior pending|
| thirdPeriod | "composite" | needs inspection | 1 source files | source reference found; behavior pending|
| thirdGroupingMode | "automatic" | needs inspection | 1 source files | source reference found; behavior pending|
| thirdIncludeByNumber | true | generated control candidate | 1 source files | source reference found; behavior pending|
| thirdUsePoc | true | generated control candidate | 1 source files | source reference found; behavior pending|
| thirdUseValueArea | true | generated control candidate | 1 source files | source reference found; behavior pending|
| thirdUsePeaks | true | generated control candidate | 1 source files | source reference found; behavior pending|
| thirdUseValleys | true | generated control candidate | 1 source files | source reference found; behavior pending|
| thirdUseDeltaImbalances | false | generated control candidate | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### Swing Point

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| leftBars | 2 | numeric registry | 2 source files | source reference found; behavior pending|
| rightBars | 2 | numeric registry | 2 source files | source reference found; behavior pending|
| filterSwing | false | dialog source reference | 1 source files | source reference found; behavior pending|
| displayMode | "line" | dialog source reference | 9 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| lineStyle | "dashed" | dialog source reference | 50 source files | source reference found; behavior pending|
| textTickOffset | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| textSize | 11 | numeric registry | 11 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| highColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| lowColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| highTextColor | "#FFFFFF" | generated control candidate | 1 source files | source reference found; behavior pending|
| lowTextColor | "#FFFFFF" | generated control candidate | 1 source files | source reference found; behavior pending|

### Average Daily Range Target

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lengthType | "daily" | dialog source reference | 4 source files | source reference found; behavior pending|
| length | 1 | numeric registry | 669 source files | source reference found; behavior pending|
| fontSize | 12 | numeric registry | 87 source files | source reference found; behavior pending|
| textAlign | "right" | dialog source reference | 62 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| backgroundColor | "#000000" | dialog source reference | 85 source files | source reference found; behavior pending|
| textColor | "#FFFFFF" | dialog source reference | 58 source files | source reference found; behavior pending|

### Sessions

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookbackDays | 30 | numeric registry | 6 source files | source reference found; behavior pending|
| fillOpacity | 10 | numeric registry | 27 source files | source reference found; behavior pending|
| lineOpacity | 100 | numeric registry | 5 source files | source reference found; behavior pending|
| borderWidth | 1 | numeric registry | 20 source files | source reference found; behavior pending|
| showTokyo | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showLondon | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showNewYork | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showSydney | false | generated control candidate | 3 source files | source reference found; behavior pending|
| tokyoLabel | "Asia" | needs inspection | 1 source files | source reference found; behavior pending|
| londonLabel | "London" | needs inspection | 1 source files | source reference found; behavior pending|
| newYorkLabel | "New York" | needs inspection | 2 source files | source reference found; behavior pending|
| sydneyLabel | "Sydney" | needs inspection | 1 source files | source reference found; behavior pending|
| tokyoTimezone | "America/New_York" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| londonTimezone | "America/New_York" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| newYorkTimezone | "America/New_York" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| tokyoStart | "16:00" | needs inspection | 1 source files | source reference found; behavior pending|
| tokyoEnd | "03:00" | needs inspection | 1 source files | source reference found; behavior pending|
| londonStart | "03:00" | needs inspection | 1 source files | source reference found; behavior pending|
| londonEnd | "09:30" | needs inspection | 1 source files | source reference found; behavior pending|
| newYorkStart | "09:30" | needs inspection | 2 source files | source reference found; behavior pending|
| newYorkEnd | "16:00" | needs inspection | 2 source files | source reference found; behavior pending|
| sydneyStart | "08:00" | needs inspection | 1 source files | source reference found; behavior pending|
| sydneyEnd | "17:00" | needs inspection | 1 source files | source reference found; behavior pending|
| tokyoColor | "#FF9900" | generated control candidate | 2 source files | source reference found; behavior pending|
| londonColor | "#4CAF50" | generated control candidate | 2 source files | source reference found; behavior pending|
| newYorkColor | "#2196F3" | generated control candidate | 1 source files | source reference found; behavior pending|
| sydneyColor | "#A461BB" | generated control candidate | 1 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| showBackground | true | dialog source reference | 7 source files | source reference found; behavior pending|
| showBorders | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showOpenClose | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showMidline | false | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| showPercentChange | false | generated control candidate | 5 source files | source reference found; behavior pending|
| showPointChange | false | generated control candidate | 1 source files | source reference found; behavior pending|
| hideWeekends | true | generated control candidate | 3 source files | source reference found; behavior pending|
| lineStyle | "dashed" | dialog source reference | 50 source files | source reference found; behavior pending|
| labelSize | "small" | needs inspection | 1 source files | source reference found; behavior pending|
| allowSessionOverlap | false | dialog source reference | 2 source files | source reference found; behavior pending|
| sessionsSettingsVersion | 2 | dialog source reference | 0 source files | internal metadata|

### Session Highs & Lows

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookbackDays | 30 | numeric registry | 6 source files | source reference found; behavior pending|
| lineOpacity | 100 | numeric registry | 5 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| showGlobex | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showTokyo | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showLondon | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showNewYork | true | dialog source reference | 2 source files | source reference found; behavior pending|
| globexLabel | "Globex" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| tokyoLabel | "Asia" | needs inspection | 1 source files | source reference found; behavior pending|
| londonLabel | "London" | needs inspection | 1 source files | source reference found; behavior pending|
| newYorkLabel | "New York" | needs inspection | 2 source files | source reference found; behavior pending|
| globexTimezone | "America/Chicago" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| tokyoTimezone | "America/Chicago" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| londonTimezone | "America/Chicago" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| newYorkTimezone | "America/Chicago" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| globexStart | "17:00" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| globexEnd | "16:00" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| tokyoStart | "17:00" | needs inspection | 1 source files | source reference found; behavior pending|
| tokyoEnd | "02:00" | needs inspection | 1 source files | source reference found; behavior pending|
| londonStart | "02:00" | needs inspection | 1 source files | source reference found; behavior pending|
| londonEnd | "08:30" | needs inspection | 1 source files | source reference found; behavior pending|
| newYorkStart | "08:30" | needs inspection | 2 source files | source reference found; behavior pending|
| newYorkEnd | "15:00" | needs inspection | 2 source files | source reference found; behavior pending|
| showHighs | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showLows | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| hideWeekends | true | generated control candidate | 3 source files | source reference found; behavior pending|
| lineStyle | "dashed" | dialog source reference | 50 source files | source reference found; behavior pending|
| labelSize | "small" | needs inspection | 1 source files | source reference found; behavior pending|
| sessionHighLowSettingsVersion | 3 | dialog source reference | 0 source files | internal metadata|

### IB Levels

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookbackDays | 7 | numeric registry | 6 source files | source reference found; behavior pending|
| lineOpacity | 100 | numeric registry | 5 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| durationMinutes | 60 | dialog source reference | 3 source files | source reference found; behavior pending|
| ibDuration15 | false | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| ibDuration30 | false | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| ibDuration45 | false | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| ibDuration60 | false | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| showGlobex | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showTokyo | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showLondon | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showNewYork | true | dialog source reference | 2 source files | source reference found; behavior pending|
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
| globexColor | "#A461BB" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| tokyoColor | "#FF9900" | generated control candidate | 2 source files | source reference found; behavior pending|
| londonColor | "#4CAF50" | generated control candidate | 2 source files | source reference found; behavior pending|
| newYorkColor | "#2196F3" | generated control candidate | 1 source files | source reference found; behavior pending|
| followSessionsStudy | false | generated control candidate | 2 source files | source reference found; behavior pending|
| showHighs | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showLows | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| hideWeekends | true | generated control candidate | 3 source files | source reference found; behavior pending|
| useSessionColors | false | generated control candidate | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| highColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| lowColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| developingLineStyle | "solid" | needs inspection | 1 source files | source reference found; behavior pending|
| fixedLineStyle | "dashed" | needs inspection | 1 source files | source reference found; behavior pending|
| labelSize | "small" | needs inspection | 1 source files | source reference found; behavior pending|
| showFib | false | dialog source reference | 1 source files | source reference found; behavior pending|
| fibDirection | "long" | dialog source reference | 1 source files | source reference found; behavior pending|
| initialBalanceSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### Kwant Levels

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| maxLevels | 14 | numeric registry | 3 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| conversion | "AUTO" | dialog source reference | 13 source files | internal metadata|
| dataSource | "GEX_CALL_MINUS_PUT" | needs inspection | 9 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| showEnvironment | true | generated control candidate | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| lineStyle | "dashed" | dialog source reference | 50 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|
| magnetColor | "#8B5CF6" | generated control candidate | 1 source files | source reference found; behavior pending|
| centreColor | "#06B6D4" | generated control candidate | 1 source files | source reference found; behavior pending|
| gammaSettingsVersion | 3 | needs inspection | 0 source files | internal metadata|

### Classic GEX Profile

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| refreshIntervalMs | 1000 | numeric registry | 1 source files | source reference found; behavior pending|
| manualMultiplier | 1 | numeric registry | 3 source files | source reference found; behavior pending|
| premiumOffset | 0 | numeric registry | 3 source files | source reference found; behavior pending|
| profileWidth | 24 | numeric registry | 7 source files | source reference found; behavior pending|
| minBarWidth | 5 | numeric registry | 2 source files | source reference found; behavior pending|
| contrast | 70 | numeric registry | 10 source files | source reference found; behavior pending|
| mappingSource | "QQQ" | dialog source reference | 3 source files | source reference found; behavior pending|
| profileMode | "CLASSIC_GEX" | dialog source reference | 7 source files | source reference found; behavior pending|
| expiry | "ZERO_DTE" | dialog source reference | 56 source files | source reference found; behavior pending|
| profileSource | "VOLUME" | dialog source reference | 4 source files | source reference found; behavior pending|
| panelPosition | "RIGHT" | dialog source reference | 1 source files | source reference found; behavior pending|
| mappingMode | "AUTO" | dialog source reference | 6 source files | source reference found; behavior pending|
| logarithmicScaling | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showLookbackDots | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showMajorPositiveVolume | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showMajorNegativeVolume | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showMajorPositiveOpenInterest | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showMajorNegativeOpenInterest | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showZeroGamma | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|
| zeroGammaColor | "#F4F4F5" | generated control candidate | 1 source files | source reference found; behavior pending|
| classicGexSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Session Marker

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookbackDays | 5 | numeric registry | 6 source files | source reference found; behavior pending|
| lineOpacity | 100 | numeric registry | 5 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| textSize | 11 | numeric registry | 11 source files | source reference found; behavior pending|
| asianImbalanceMinutes | 60 | numeric registry | 1 source files | source reference found; behavior pending|
| europeImbalanceMinutes | 60 | numeric registry | 1 source files | source reference found; behavior pending|
| usaImbalanceMinutes | 60 | numeric registry | 1 source files | source reference found; behavior pending|
| timeReference | "exchange" | dialog source reference | 1 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| extendLine | false | generated control candidate | 2 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| textColor | "#E5E7EB" | dialog source reference | 58 source files | source reference found; behavior pending|
| showSessionRange | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showImbalanceRange | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showOpenClose | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showMidPrice | true | generated control candidate | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| asianEnabled | true | dialog source reference | 1 source files | source reference found; behavior pending|
| asianStartTime | "16:00" | needs inspection | 1 source files | source reference found; behavior pending|
| asianEndTime | "03:00" | needs inspection | 1 source files | source reference found; behavior pending|
| asianVwapEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| europeEnabled | true | dialog source reference | 1 source files | source reference found; behavior pending|
| europeStartTime | "03:00" | needs inspection | 1 source files | source reference found; behavior pending|
| europeEndTime | "09:30" | needs inspection | 1 source files | source reference found; behavior pending|
| europeVwapEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| usaEnabled | true | dialog source reference | 1 source files | source reference found; behavior pending|
| usaStartTime | "09:30" | needs inspection | 1 source files | source reference found; behavior pending|
| usaEndTime | "16:00" | needs inspection | 1 source files | source reference found; behavior pending|
| usaVwapEnabled | false | dialog source reference | 1 source files | source reference found; behavior pending|
| markerEnabled | false | dialog source reference | 4 source files | source reference found; behavior pending|
| allowSessionOverlap | false | dialog source reference | 2 source files | source reference found; behavior pending|
| sessionMarkerSettingsVersion | 2 | dialog source reference | 1 source files | internal metadata|
| asianHighColor | "#22C55E" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| asianLowColor | "#EF4444" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| asianImbalanceHighColor | "#4ADE80" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| asianImbalanceLowColor | "#F87171" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| asianOpenColor | "#38BDF8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| asianCloseColor | "#94A3B8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| asianSessionRangeColor | "#38BDF8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| asianImbalanceRangeColor | "#94A3B8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| asianMidColor | "#38BDF8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| asianVwapColor | "#38BDF8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| europeHighColor | "#22C55E" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| europeLowColor | "#EF4444" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| europeImbalanceHighColor | "#4ADE80" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| europeImbalanceLowColor | "#F87171" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| europeOpenColor | "#38BDF8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| europeCloseColor | "#94A3B8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| europeSessionRangeColor | "#38BDF8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| europeImbalanceRangeColor | "#94A3B8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| europeMidColor | "#38BDF8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| europeVwapColor | "#38BDF8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| usaHighColor | "#22C55E" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| usaLowColor | "#EF4444" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| usaImbalanceHighColor | "#4ADE80" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| usaImbalanceLowColor | "#F87171" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| usaOpenColor | "#38BDF8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| usaCloseColor | "#94A3B8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| usaSessionRangeColor | "#38BDF8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| usaImbalanceRangeColor | "#94A3B8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| usaMidColor | "#38BDF8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| usaVwapColor | "#38BDF8" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| markerPositiveColor | "#22C55E" | dialog source reference | 1 source files | source reference found; behavior pending|
| markerNegativeColor | "#EF4444" | dialog source reference | 1 source files | source reference found; behavior pending|

### Shift Candle

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| maxBarsAfterReversal | 3 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumTickBreakout | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| minimumDeltaPercentDifference | 20 | numeric registry | 1 source files | source reference found; behavior pending|
| minimumDeltaValueDifference | 100 | numeric registry | 1 source files | source reference found; behavior pending|
| maximumTickPocDistance | 4 | numeric registry | 1 source files | source reference found; behavior pending|
| highestLowestLookback | 5 | numeric registry | 1 source files | source reference found; behavior pending|
| markerTickOffset | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| plotPrice | "high-low" | dialog source reference | 3 source files | source reference found; behavior pending|
| imbalanceEnabled | true | dialog source reference | 1 source files | source reference found; behavior pending|
| minimumImbalancePercent | 300 | numeric registry | 5 source files | source reference found; behavior pending|
| minimumImbalanceVolumeDifference | 20 | numeric registry | 1 source files | source reference found; behavior pending|
| freshZonesEnabled | true | dialog source reference | 1 source files | source reference found; behavior pending|
| zoneOpacity | 18 | numeric registry | 7 source files | source reference found; behavior pending|
| markerShape | "square" | dialog source reference | 2 source files | source reference found; behavior pending|
| markerLineWidth | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| autoCenter | true | dialog source reference | 3 source files | source reference found; behavior pending|
| alertEnabled | false | dialog source reference | 2 source files | source reference found; behavior pending|
| alertName | "Signal Trigger" | dialog source reference | 8 source files | source reference found; behavior pending|
| popupEnabled | false | dialog source reference | 2 source files | source reference found; behavior pending|
| popupMessage | "Signal Trigger" | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| buyMarkerColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| sellMarkerColor | "#EF4444" | generated control candidate | 1 source files | source reference found; behavior pending|
| freshBuyZoneColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| freshSellZoneColor | "#EF4444" | generated control candidate | 1 source files | source reference found; behavior pending|
| shiftCandleSettingsVersion | 1 | dialog source reference | 1 source files | internal metadata|

## Trend

### Moving Average

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| length | 20 | numeric registry | 669 source files | source reference found; behavior pending|

### Ichimoku Indicator

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| conversionLinePeriod | 9 | numeric registry | 1 source files | internal metadata|
| baseLinePeriod | 26 | numeric registry | 1 source files | source reference found; behavior pending|
| laggingSpanPeriod | 52 | numeric registry | 1 source files | source reference found; behavior pending|
| tenkanLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| kijunLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| chikouLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| senkouLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| tenkanLineStyle | "solid" | dialog source reference | 1 source files | source reference found; behavior pending|
| kijunLineStyle | "solid" | dialog source reference | 1 source files | source reference found; behavior pending|
| chikouLineStyle | "solid" | dialog source reference | 1 source files | source reference found; behavior pending|
| senkouLineStyle | "solid" | dialog source reference | 1 source files | source reference found; behavior pending|
| tenkanShortName | "Tenkan Sen" | dialog source reference | 1 source files | source reference found; behavior pending|
| kijunShortName | "Kijun Sen" | dialog source reference | 1 source files | source reference found; behavior pending|
| chikouShortName | "Chikou Span" | dialog source reference | 1 source files | source reference found; behavior pending|
| senkouShortName | "Senkou Span" | dialog source reference | 1 source files | source reference found; behavior pending|
| tenkanNameLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| tenkanValueLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| kijunNameLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| kijunValueLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| chikouNameLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| chikouValueLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| senkouNameLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| senkouValueLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| tenkanIncludeOnAutoCenter | true | generated control candidate | 1 source files | source reference found; behavior pending|
| kijunIncludeOnAutoCenter | true | generated control candidate | 1 source files | source reference found; behavior pending|
| chikouIncludeOnAutoCenter | true | generated control candidate | 1 source files | source reference found; behavior pending|
| senkouIncludeOnAutoCenter | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showCloud | true | generated control candidate | 1 source files | source reference found; behavior pending|
| cloudOpacity | 14 | numeric registry | 1 source files | source reference found; behavior pending|
| useSecondaryAxis | false | dialog source reference | 9 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| tenkanColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| kijunColor | "#EF4444" | dialog source reference | 2 source files | source reference found; behavior pending|
| chikouColor | "#4ADE80" | dialog source reference | 2 source files | source reference found; behavior pending|
| senkouColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| senkouSecondaryColor | "#EF4444" | dialog source reference | 2 source files | source reference found; behavior pending|
| bullishCloudColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| bearishCloudColor | "#EF4444" | dialog source reference | 2 source files | source reference found; behavior pending|
| ichimokuSettingsVersion | 1 | needs inspection | 1 source files | internal metadata|

### Parabolic SAR

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| accelerationStep | 0.02 | numeric registry | 1 source files | source reference found; behavior pending|
| accelerationMaximum | 0.2 | numeric registry | 1 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| displayStyle | "points" | dialog source reference | 7 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| secondaryColorEnabled | false | generated control candidate | 2 source files | source reference found; behavior pending|
| useSecondaryAxis | false | dialog source reference | 9 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| secondaryColor | "#4ADE80" | generated control candidate | 6 source files | source reference found; behavior pending|

### Linear Regression

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| length | 21 | numeric registry | 669 source files | source reference found; behavior pending|
| inputData | "close" | dialog source reference | 15 source files | source reference found; behavior pending|
| displayStyle | "line" | dialog source reference | 7 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| secondaryColorEnabled | false | generated control candidate | 2 source files | source reference found; behavior pending|
| useSecondaryAxis | false | dialog source reference | 9 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| secondaryColor | "#4ADE80" | generated control candidate | 6 source files | source reference found; behavior pending|

### Regression Channel

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| mode | "bars" | dialog source reference | 197 source files | source reference found; behavior pending|
| bars | 100 | numeric registry | 146 source files | source reference found; behavior pending|
| standardDeviationValue | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| zigZagMode | "tick-reversal" | dialog source reference | 2 source files | source reference found; behavior pending|
| zigZagAbsoluteReversal | 0.5 | numeric registry | 1 source files | source reference found; behavior pending|
| zigZagReversalValue | 22 | numeric registry | 1 source files | source reference found; behavior pending|
| midLineWidth | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| upperLineWidth | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| lowerLineWidth | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| midLineStyle | "dashed" | dialog source reference | 1 source files | source reference found; behavior pending|
| upperLineStyle | "dashed" | dialog source reference | 1 source files | source reference found; behavior pending|
| lowerLineStyle | "dashed" | dialog source reference | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| midColor | "#22C55E" | dialog source reference | 6 source files | source reference found; behavior pending|
| midUpColor | "#22C55E" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| midDownColor | "#EF4444" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| upperColor | "#22C55E" | generated control candidate | 2 source files | source reference found; behavior pending|
| upperUpColor | "#22C55E" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| upperDownColor | "#EF4444" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| lowerColor | "#22C55E" | generated control candidate | 2 source files | source reference found; behavior pending|
| lowerUpColor | "#22C55E" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| lowerDownColor | "#EF4444" | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|

### Super Trend

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| length | 10 | numeric registry | 669 source files | source reference found; behavior pending|
| multiplier | 3 | numeric registry | 37 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| displayStyle | "line" | dialog source reference | 7 source files | source reference found; behavior pending|
| colorMode | "direction" | dialog source reference | 10 source files | source reference found; behavior pending|
| shortName | "ST" | dialog source reference | 10 source files | source reference found; behavior pending|
| chartArea | "overlay" | dialog source reference | 4 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| useSecondaryAxis | false | dialog source reference | 9 source files | source reference found; behavior pending|
| includeOnAutoCenter | true | generated control candidate | 3 source files | source reference found; behavior pending|
| valueLabel | false | generated control candidate | 6 source files | source reference found; behavior pending|
| nameLabel | false | generated control candidate | 6 source files | source reference found; behavior pending|
| nameBackground | false | generated control candidate | 8 source files | source reference found; behavior pending|
| valueBackground | false | generated control candidate | 8 source files | source reference found; behavior pending|
| chartColorForMarker | false | generated control candidate | 6 source files | source reference found; behavior pending|
| alertSoundEnabled | false | dialog source reference | 8 source files | source reference found; behavior pending|
| messagePopupEnabled | false | dialog source reference | 8 source files | source reference found; behavior pending|
| alertName | "Super Trend" | dialog source reference | 8 source files | source reference found; behavior pending|
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| secondaryColor | "#EF4444" | generated control candidate | 6 source files | source reference found; behavior pending|

### Super Trend Difference

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| length | 10 | numeric registry | 669 source files | source reference found; behavior pending|
| multiplier | 3 | numeric registry | 37 source files | source reference found; behavior pending|
| lineWidth | 4 | numeric registry | 142 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| displayStyle | "histogram" | dialog source reference | 7 source files | source reference found; behavior pending|
| colorMode | "sign" | dialog source reference | 10 source files | source reference found; behavior pending|
| shortName | "STD" | dialog source reference | 10 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| includeOnAutoCenter | true | generated control candidate | 3 source files | source reference found; behavior pending|
| valueLabel | false | generated control candidate | 6 source files | source reference found; behavior pending|
| nameLabel | false | generated control candidate | 6 source files | source reference found; behavior pending|
| nameBackground | false | generated control candidate | 8 source files | source reference found; behavior pending|
| valueBackground | false | generated control candidate | 8 source files | source reference found; behavior pending|
| chartColorForMarker | false | generated control candidate | 6 source files | source reference found; behavior pending|
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| secondaryColor | "#EF4444" | generated control candidate | 6 source files | source reference found; behavior pending|

### Keltner Channel

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| middleColor | "#22C55E" | generated control candidate | 3 source files | source reference found; behavior pending|
| upperColor | "#4ADE80" | generated control candidate | 2 source files | source reference found; behavior pending|
| lowerColor | "#4ADE80" | generated control candidate | 2 source files | source reference found; behavior pending|
| length | 20 | numeric registry | 669 source files | source reference found; behavior pending|
| atrLength | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| multiplier | 2 | numeric registry | 37 source files | source reference found; behavior pending|

### Bollinger Bands

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| middleColor | "#22C55E" | generated control candidate | 3 source files | source reference found; behavior pending|
| upperColor | "#4ADE80" | generated control candidate | 2 source files | source reference found; behavior pending|
| lowerColor | "#4ADE80" | generated control candidate | 2 source files | source reference found; behavior pending|
| length | 20 | numeric registry | 669 source files | source reference found; behavior pending|
| multiplier | 2 | numeric registry | 37 source files | source reference found; behavior pending|

### Donchian Channel

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| upperColor | "#22C55E" | generated control candidate | 2 source files | source reference found; behavior pending|
| middleColor | "#22C55E" | generated control candidate | 3 source files | source reference found; behavior pending|
| lowerColor | "#EF4444" | generated control candidate | 2 source files | source reference found; behavior pending|
| length | 20 | numeric registry | 669 source files | source reference found; behavior pending|

### Tillson T3

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| length | 14 | numeric registry | 669 source files | source reference found; behavior pending|
| volumeFactor | 0.618 | numeric registry | 1 source files | source reference found; behavior pending|
| inputData | "close" | dialog source reference | 15 source files | source reference found; behavior pending|
| colorMode | "slope" | dialog source reference | 10 source files | source reference found; behavior pending|
| displayStyle | "line" | dialog source reference | 7 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| shortName | "T3" | dialog source reference | 10 source files | source reference found; behavior pending|
| useSecondaryAxis | false | dialog source reference | 9 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| secondaryColor | "#4ADE80" | generated control candidate | 6 source files | source reference found; behavior pending|

### Zig Zag

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| zigZagMode | "highest-lowest" | dialog source reference | 2 source files | source reference found; behavior pending|
| absoluteReversalPercent | 0.5 | numeric registry | 1 source files | source reference found; behavior pending|
| tickReversalOrLookback | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| lineWidth | 2 | numeric registry | 142 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| shortName | "Zig Zag" | dialog source reference | 10 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| upColor | "#22C55E" | dialog source reference | 34 source files | source reference found; behavior pending|
| downColor | "#EF4444" | dialog source reference | 34 source files | source reference found; behavior pending|
| retracementBackgroundColor | "#5f6425" | dialog source reference | 1 source files | source reference found; behavior pending|
| retracementFontSize | 11 | numeric registry | 1 source files | source reference found; behavior pending|
| retracementTextColor | "#FFFFFF" | dialog source reference | 1 source files | source reference found; behavior pending|
| retracementLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| retracementLineColor | "#4ADE80" | dialog source reference | 2 source files | source reference found; behavior pending|
| showRetracement38 | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showRetracement50 | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showRetracement62 | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showRetracement75 | false | generated control candidate | 1 source files | source reference found; behavior pending|
| extendRight | false | dialog source reference | 30 source files | source reference found; behavior pending|

## Momentum

### Relative Strength Index (RSI)

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| length | 14 | numeric registry | 669 source files | source reference found; behavior pending|

### Rate of Change (ROC)

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| length | 12 | numeric registry | 669 source files | source reference found; behavior pending|

### MACD Indicator

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| macdColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| signalColor | "#4ADE80" | generated control candidate | 2 source files | source reference found; behavior pending|
| histogramColor | "#8A8F98" | generated control candidate | 1 source files | source reference found; behavior pending|
| fastLength | 12 | numeric registry | 3 source files | source reference found; behavior pending|
| slowLength | 26 | numeric registry | 3 source files | source reference found; behavior pending|
| signalLength | 9 | numeric registry | 1 source files | source reference found; behavior pending|

### Momentum Indicator

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| length | 10 | numeric registry | 669 source files | source reference found; behavior pending|

### Commodity Channel Index (CCI)

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| length | 20 | numeric registry | 669 source files | source reference found; behavior pending|

### Know Sure Thing (KST)

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| roc1 | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| roc2 | 15 | numeric registry | 1 source files | source reference found; behavior pending|
| roc3 | 20 | numeric registry | 1 source files | source reference found; behavior pending|
| roc4 | 30 | numeric registry | 1 source files | source reference found; behavior pending|
| average1 | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| average2 | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| average3 | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| average4 | 15 | numeric registry | 1 source files | source reference found; behavior pending|
| signalPeriod | 9 | numeric registry | 2 source files | source reference found; behavior pending|
| averageType | "simple" | dialog source reference | 4 source files | source reference found; behavior pending|
| usePercent | false | dialog source reference | 2 source files | source reference found; behavior pending|
| middleLevel | 0 | numeric registry | 4 source files | source reference found; behavior pending|
| middleLineWidth | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| showMiddle | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showKst | true | generated control candidate | 2 source files | source reference found; behavior pending|
| showSignal | true | generated control candidate | 2 source files | source reference found; behavior pending|
| kstColorMode | "slope" | needs inspection | 1 source files | source reference found; behavior pending|
| signalColorMode | "none" | needs inspection | 1 source files | source reference found; behavior pending|
| kstDisplayStyle | "line" | needs inspection | 1 source files | source reference found; behavior pending|
| signalDisplayStyle | "line" | needs inspection | 1 source files | source reference found; behavior pending|
| kstLineStyle | "solid" | needs inspection | 1 source files | source reference found; behavior pending|
| signalLineStyle | "dashed" | needs inspection | 1 source files | source reference found; behavior pending|
| kstLineWidth | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| signalLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| kstShortName | "KST" | needs inspection | 1 source files | source reference found; behavior pending|
| signalShortName | "Sig" | needs inspection | 1 source files | source reference found; behavior pending|
| kstNameLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| signalNameLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| kstValueLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| signalValueLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| kstNameBackground | false | generated control candidate | 1 source files | source reference found; behavior pending|
| signalNameBackground | false | generated control candidate | 1 source files | source reference found; behavior pending|
| kstValueBackground | false | generated control candidate | 1 source files | source reference found; behavior pending|
| signalValueBackground | false | generated control candidate | 1 source files | source reference found; behavior pending|
| kstChartMarker | false | generated control candidate | 1 source files | source reference found; behavior pending|
| signalChartMarker | false | generated control candidate | 1 source files | source reference found; behavior pending|
| kstAutoCenter | true | generated control candidate | 1 source files | source reference found; behavior pending|
| signalAutoCenter | true | generated control candidate | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| kstColor | "#22C55E" | generated control candidate | 2 source files | source reference found; behavior pending|
| kstSecondaryColor | "#EF4444" | generated control candidate | 2 source files | source reference found; behavior pending|
| signalColor | "#4ADE80" | generated control candidate | 2 source files | source reference found; behavior pending|
| signalSecondaryColor | "#22C55E" | generated control candidate | 2 source files | source reference found; behavior pending|
| middleColor | "#8A8F98" | generated control candidate | 3 source files | source reference found; behavior pending|

### Inverse Cyber Cycle

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| smoothingAlpha | 0.01 | numeric registry | 1 source files | source reference found; behavior pending|
| cycleALength | 21 | numeric registry | 1 source files | source reference found; behavior pending|
| cycleBLength | 84 | numeric registry | 1 source files | source reference found; behavior pending|
| middleLevel | 0 | numeric registry | 4 source files | source reference found; behavior pending|
| lowLevel | -0.6 | numeric registry | 1 source files | source reference found; behavior pending|
| highLevel | 0.6 | numeric registry | 1 source files | source reference found; behavior pending|
| levelWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| cycleALineWidth | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| cycleBLineWidth | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| cycleALineStyle | "solid" | dialog source reference | 1 source files | source reference found; behavior pending|
| cycleBLineStyle | "solid" | dialog source reference | 1 source files | source reference found; behavior pending|
| cycleAAutoColor | "none" | dialog source reference | 1 source files | source reference found; behavior pending|
| cycleBAutoColor | "none" | dialog source reference | 1 source files | source reference found; behavior pending|
| cycleAShortName | "CycA" | dialog source reference | 1 source files | source reference found; behavior pending|
| cycleBShortName | "CycB" | dialog source reference | 2 source files | source reference found; behavior pending|
| cycleANameLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| cycleAValueLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| cycleAIncludeOnAutoCenter | true | generated control candidate | 1 source files | source reference found; behavior pending|
| cycleBNameLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| cycleBValueLabel | false | generated control candidate | 1 source files | source reference found; behavior pending|
| cycleBIncludeOnAutoCenter | true | generated control candidate | 1 source files | source reference found; behavior pending|
| useSecondaryAxis | false | dialog source reference | 9 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| cycleAColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| cycleASecondaryColor | "#CA8A04" | dialog source reference | 1 source files | source reference found; behavior pending|
| cycleBColor | "#4ADE80" | dialog source reference | 2 source files | source reference found; behavior pending|
| cycleBSecondaryColor | "#BE185D" | dialog source reference | 1 source files | source reference found; behavior pending|
| middleLevelColor | "#8A8F98" | dialog source reference | 2 source files | source reference found; behavior pending|
| lowLevelColor | "#EF4444" | dialog source reference | 2 source files | source reference found; behavior pending|
| highLevelColor | "#22C55E" | dialog source reference | 2 source files | source reference found; behavior pending|
| inverseCyberCycleSettingsVersion | 1 | needs inspection | 1 source files | internal metadata|

### Aroon Up/Down

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| upColor | "#22C55E" | dialog source reference | 34 source files | source reference found; behavior pending|
| downColor | "#EF4444" | dialog source reference | 34 source files | source reference found; behavior pending|
| length | 25 | numeric registry | 669 source files | source reference found; behavior pending|

### Aroon Oscillator

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| length | 25 | numeric registry | 669 source files | source reference found; behavior pending|

### Awesome Oscillator

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| fastLength | 5 | numeric registry | 3 source files | source reference found; behavior pending|
| slowLength | 34 | numeric registry | 3 source files | source reference found; behavior pending|

### Stochastic Oscillator

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| kColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| dColor | "#4ADE80" | generated control candidate | 1 source files | source reference found; behavior pending|
| length | 14 | numeric registry | 669 source files | source reference found; behavior pending|
| smooth | 3 | numeric registry | 19 source files | source reference found; behavior pending|

### Williams %R

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| length | 14 | numeric registry | 669 source files | source reference found; behavior pending|

### Chaikin Accumulation/Distribution

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|

### Average Directional Index (ADX)

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| period | 14 | numeric registry | 39 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| lineStyle | "solid" | dialog source reference | 50 source files | source reference found; behavior pending|
| showPlusDi | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showMinusDi | true | generated control candidate | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| adxColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| plusDiColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| minusDiColor | "#EF4444" | generated control candidate | 1 source files | source reference found; behavior pending|

## Volatility

### VIX Environment

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| position | "top-left" | dialog source reference | 116 source files | source reference found; behavior pending|
| sourceSymbol | "VIX" | dialog source reference | 28 source files | source reference found; behavior pending|
| showChange | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showRange | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showRank | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showPercentile | true | dialog source reference | 1 source files | source reference found; behavior pending|
| showFreshness | true | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | false | dialog source reference | 74 source files | source reference found; behavior pending|
| calmColor | "#22C55E" | dialog source reference | 1 source files | source reference found; behavior pending|
| normalColor | "#38BDF8" | dialog source reference | 1 source files | source reference found; behavior pending|
| elevatedColor | "#F59E0B" | dialog source reference | 1 source files | source reference found; behavior pending|
| highColor | "#F97316" | dialog source reference | 7 source files | source reference found; behavior pending|
| extremeColor | "#EF4444" | dialog source reference | 1 source files | source reference found; behavior pending|
| normalThreshold | 15 | dialog source reference | 3 source files | source reference found; behavior pending|
| elevatedThreshold | 20 | dialog source reference | 3 source files | source reference found; behavior pending|
| highThreshold | 25 | dialog source reference | 4 source files | source reference found; behavior pending|
| extremeThreshold | 30 | dialog source reference | 3 source files | source reference found; behavior pending|
| badgeScale | 1 | dialog source reference | 1 source files | source reference found; behavior pending|
| vixEnvironmentSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Standard Deviation

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| length | 20 | numeric registry | 669 source files | source reference found; behavior pending|

### Average True Range (ATR)

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| plotColor | "#22C55E" | generated control candidate | 7 source files | source reference found; behavior pending|
| length | 14 | numeric registry | 669 source files | source reference found; behavior pending|

### Expected Move

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lineOpacity | 100 | numeric registry | 5 source files | source reference found; behavior pending|
| fillOpacity | 3 | numeric registry | 27 source files | source reference found; behavior pending|
| mode | "SESSION" | dialog source reference | 197 source files | source reference found; behavior pending|
| mappingSource | "QQQ" | dialog source reference | 3 source files | source reference found; behavior pending|
| showTwoSigma | false | generated control candidate | 2 source files | source reference found; behavior pending|
| showBandFill | false | generated control candidate | 2 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| neutralColor | "#D6A84B" | dialog source reference | 33 source files | source reference found; behavior pending|
| expectedMoveSettingsVersion | 1 | needs inspection | 1 source files | internal metadata|

## Overlays

### Overlay Chart

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| maxVolumeWidthPercent | 100 | numeric registry | 3 source files | source reference found; behavior pending|
| standardDeviation | 2 | numeric registry | 16 source files | source reference found; behavior pending|
| borderWidth | 1 | numeric registry | 20 source files | source reference found; behavior pending|
| opacity | 68 | numeric registry | 165 source files | source reference found; behavior pending|
| symbol | "AUTO" | dialog source reference | 186 source files | source reference found; behavior pending|
| timeframe | "AUTO" | dialog source reference | 87 source files | source reference found; behavior pending|
| style | "candlestick" | dialog source reference | 284 source files | source reference found; behavior pending|
| useSecondaryAxis | true | dialog source reference | 9 source files | source reference found; behavior pending|
| widthBasedOnVolume | false | dialog source reference | 4 source files | source reference found; behavior pending|
| colorBasedOnDelta | false | dialog source reference | 6 source files | source reference found; behavior pending|
| openCloseBorder | true | dialog source reference | 3 source files | source reference found; behavior pending|
| filled | true | dialog source reference | 106 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| upColor | "#22C55E" | dialog source reference | 34 source files | source reference found; behavior pending|
| downColor | "#EF4444" | dialog source reference | 34 source files | source reference found; behavior pending|
| lineColor | "#60A5FA" | dialog source reference | 58 source files | source reference found; behavior pending|
| overlaySettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Overlay Symbol

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| maxVolumeWidthPercent | 100 | numeric registry | 3 source files | source reference found; behavior pending|
| standardDeviation | 2 | numeric registry | 16 source files | source reference found; behavior pending|
| borderWidth | 1 | numeric registry | 20 source files | source reference found; behavior pending|
| opacity | 68 | numeric registry | 165 source files | source reference found; behavior pending|
| symbol | "AUTO" | dialog source reference | 186 source files | source reference found; behavior pending|
| timeframe | "AUTO" | dialog source reference | 87 source files | source reference found; behavior pending|
| style | "candlestick" | dialog source reference | 284 source files | source reference found; behavior pending|
| useSecondaryAxis | true | dialog source reference | 9 source files | source reference found; behavior pending|
| widthBasedOnVolume | false | dialog source reference | 4 source files | source reference found; behavior pending|
| colorBasedOnDelta | false | dialog source reference | 6 source files | source reference found; behavior pending|
| openCloseBorder | true | dialog source reference | 3 source files | source reference found; behavior pending|
| filled | true | dialog source reference | 106 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| upColor | "#22C55E" | dialog source reference | 34 source files | source reference found; behavior pending|
| downColor | "#EF4444" | dialog source reference | 34 source files | source reference found; behavior pending|
| lineColor | "#60A5FA" | dialog source reference | 58 source files | source reference found; behavior pending|
| overlaySettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Overlay Timeframe Candlestick

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| candleWidthPercent | 94 | numeric registry | 2 source files | source reference found; behavior pending|
| borderWidth | 1 | numeric registry | 20 source files | source reference found; behavior pending|
| opacity | 34 | numeric registry | 165 source files | source reference found; behavior pending|
| timeframe | "15m" | dialog source reference | 87 source files | source reference found; behavior pending|
| filled | true | dialog source reference | 106 source files | source reference found; behavior pending|
| drawCloseBoundary | false | dialog source reference | 3 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| upColor | "#22C55E" | dialog source reference | 34 source files | source reference found; behavior pending|
| downColor | "#EF4444" | dialog source reference | 34 source files | source reference found; behavior pending|
| closeBoundaryColor | "#60A5FA" | dialog source reference | 3 source files | source reference found; behavior pending|
| overlaySettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Overlay Timeframe Highlight

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| parameterType | "minutes" | dialog source reference | 2 source files | source reference found; behavior pending|
| parameter1 | 15 | numeric registry | 2 source files | source reference found; behavior pending|
| colorBasedOnDelta | false | dialog source reference | 6 source files | source reference found; behavior pending|
| colorMode | "fixed" | dialog source reference | 10 source files | source reference found; behavior pending|
| standardDeviation | 2 | numeric registry | 16 source files | source reference found; behavior pending|
| enabled | true | dialog source reference | 135 source files | source reference found; behavior pending|
| borderWidth | 1 | numeric registry | 20 source files | source reference found; behavior pending|
| bodyOpacity | 18 | numeric registry | 3 source files | source reference found; behavior pending|
| shadowOpacity | 70 | numeric registry | 2 source files | source reference found; behavior pending|
| showBackground | true | dialog source reference | 7 source files | source reference found; behavior pending|
| targetEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| targetLineWidth | 1 | numeric registry | 2 source files | source reference found; behavior pending|
| targetLineStyle | "dashed" | dialog source reference | 2 source files | source reference found; behavior pending|
| extendLineLeft | false | dialog source reference | 2 source files | source reference found; behavior pending|
| showTargetText | true | dialog source reference | 2 source files | source reference found; behavior pending|
| textSize | 10 | numeric registry | 11 source files | source reference found; behavior pending|
| summaryEnabled | false | dialog source reference | 3 source files | source reference found; behavior pending|
| volumeSummary | true | dialog source reference | 2 source files | source reference found; behavior pending|
| tradeSummary | true | dialog source reference | 2 source files | source reference found; behavior pending|
| summaryTextSize | 9 | numeric registry | 2 source files | source reference found; behavior pending|
| summaryToView | 3 | numeric registry | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| upColor | "#22C55E" | dialog source reference | 34 source files | source reference found; behavior pending|
| downColor | "#EF4444" | dialog source reference | 34 source files | source reference found; behavior pending|
| highColor | "#22C55E" | dialog source reference | 7 source files | source reference found; behavior pending|
| lowColor | "#EF4444" | dialog source reference | 7 source files | source reference found; behavior pending|
| textColor | "#FFFFFF" | dialog source reference | 58 source files | source reference found; behavior pending|
| summaryTextColor | "#FFFFFF" | dialog source reference | 8 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#EF4444" | dialog source reference | 24 source files | source reference found; behavior pending|

### Text on Chart

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| fontSize | 30 | numeric registry | 87 source files | source reference found; behavior pending|
| textColor | "#FFFFFF" | dialog source reference | 58 source files | source reference found; behavior pending|
| backgroundColor | "#333333" | dialog source reference | 85 source files | source reference found; behavior pending|
| text | "" | dialog source reference | 323 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|

### Source Code Indicator

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |

## KWANT Systems

### KWANT Stats

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| filterMin | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| filterMax | 0 | numeric registry | 12 source files | source reference found; behavior pending|
| coloringDeviation | 2 | numeric registry | 2 source files | source reference found; behavior pending|
| sessionStartHour | 17 | numeric registry | 3 source files | source reference found; behavior pending|
| inputData | "Volume" | dialog source reference | 15 source files | source reference found; behavior pending|
| autoFormat | true | generated control candidate | 2 source files | source reference found; behavior pending|
| invertRows | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showHeader | true | dialog source reference | 10 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showTotalVolume | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showBidVolume | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showAskVolume | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showDeltaVolume | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showMaxDeltaVolume | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showMinDeltaVolume | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showTotalTrades | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showDeltaTrades | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showRangeTicks | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showDeltaPercent | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showSessionCvd | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showVolumePerSecond | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showCotHigh | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showCotLow | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showCotBar | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showDuration | false | generated control candidate | 3 source files | source reference found; behavior pending|
| showBarRatio | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showHighRatio | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showLowRatio | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showTotalEffort | false | generated control candidate | 1 source files | source reference found; behavior pending|
| showDeltaEffort | false | generated control candidate | 1 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|
| neutralColor | "#94A3B8" | dialog source reference | 33 source files | source reference found; behavior pending|
| textColor | "#E5E7EB" | dialog source reference | 58 source files | source reference found; behavior pending|
| headerColor | "#27272A" | generated control candidate | 5 source files | source reference found; behavior pending|
| statsPaletteId | "" | dialog source reference | 1 source files | source reference found; behavior pending|
| statsSettingsVersion | 2 | needs inspection | 0 source files | internal metadata|

### Hedge Levels

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| fillOpacity | 5 | numeric registry | 27 source files | source reference found; behavior pending|
| lineOpacity | 100 | numeric registry | 5 source files | source reference found; behavior pending|
| showBelowFlip | true | generated control candidate | 1 source files | source reference found; behavior pending|
| showLabels | true | dialog source reference | 61 source files | source reference found; behavior pending|
| hedgeLevelsSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### KWANT-M IVB

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| lookbackSessions | 20 | numeric registry | 1 source files | source reference found; behavior pending|
| zoneWidthTicks | 4 | numeric registry | 2 source files | source reference found; behavior pending|
| lineWidth | 1 | numeric registry | 142 source files | source reference found; behavior pending|
| zoneOpacity | 14 | numeric registry | 7 source files | source reference found; behavior pending|
| openingRangeMinutes | 30 | dialog source reference | 2 source files | source reference found; behavior pending|
| showRange | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showProtection | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showAverage | true | dialog source reference | 5 source files | source reference found; behavior pending|
| showStandardDeviation | true | dialog source reference | 2 source files | source reference found; behavior pending|
| showZones | true | dialog source reference | 8 source files | source reference found; behavior pending|
| showSummary | true | dialog source reference | 10 source files | source reference found; behavior pending|
| extendToLiveEdge | true | dialog source reference | 2 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| positiveColor | "#22C55E" | dialog source reference | 19 source files | source reference found; behavior pending|
| negativeColor | "#EF4444" | dialog source reference | 21 source files | source reference found; behavior pending|
| neutralColor | "#94A3B8" | dialog source reference | 33 source files | source reference found; behavior pending|
| deepMIVBSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### KWANT Pattern Builder

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minImbalancePercent | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| maxImbalancePercent | 0 | numeric registry | 1 source files | source reference found; behavior pending|
| markerSize | 7 | numeric registry | 22 source files | source reference found; behavior pending|
| backgroundOpacity | 8 | numeric registry | 9 source files | source reference found; behavior pending|
| daysToShow | 10 | numeric registry | 1 source files | source reference found; behavior pending|
| condition1Enabled | true | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1ASource | "close" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1AOffset | 0 | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1AValue | 0 | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1BSource | "unused" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1BOffset | 0 | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1BValue | 0 | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1LeftMath | "+" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1Comparator | ">" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1CSource | "open" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1COffset | 0 | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1CValue | 0 | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1DSource | "unused" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1DOffset | 0 | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1DValue | 0 | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition1RightMath | "+" | needs inspection | 0 source files | no runtime reference; inspect dynamic wiring|
| condition2Enabled | false | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| condition3Enabled | false | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| condition4Enabled | false | generated control candidate | 0 source files | no runtime reference; inspect dynamic wiring|
| combineMode | "and" | dialog source reference | 1 source files | source reference found; behavior pending|
| advancedExpression | "C1 AND C2" | dialog source reference | 1 source files | source reference found; behavior pending|
| calculateOnClose | true | dialog source reference | 1 source files | source reference found; behavior pending|
| plotMode | "marker" | dialog source reference | 5 source files | source reference found; behavior pending|
| markerPosition | "high" | dialog source reference | 2 source files | source reference found; behavior pending|
| alertsEnabled | false | dialog source reference | 6 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| markerColor | "#22C55E" | dialog source reference | 5 source files | source reference found; behavior pending|
| patternBackgroundColor | "#22C55E" | dialog source reference | 1 source files | source reference found; behavior pending|
| deepPatternBuilderSettingsVersion | 1 | needs inspection | 0 source files | internal metadata|

### Big Blocks

- [ ] Add, disable, enable and remove
- [ ] Every settings tab and action
- [ ] Save, close, reopen and persistence
- [ ] Every setting changes its intended calculation or rendering
- [ ] Live update and replay where supported

| Setting | Default | Control evidence | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| minimumBars | 20 | numeric registry | 4 source files | source reference found; behavior pending|
| minimumDeltaPercent | 20 | numeric registry | 4 source files | source reference found; behavior pending|
| maximumDeltaPercent | 100 | numeric registry | 2 source files | source reference found; behavior pending|
| maximumDeltaEffort | 0 | numeric registry | 2 source files | source reference found; behavior pending|
| averageLength | 21 | numeric registry | 4 source files | source reference found; behavior pending|
| entryZoneRangePercent | 28 | numeric registry | 2 source files | source reference found; behavior pending|
| zoneBars | 22 | numeric registry | 3 source files | source reference found; behavior pending|
| zoneOpacity | 20 | numeric registry | 7 source files | source reference found; behavior pending|
| zoneLineWidth | 1 | numeric registry | 1 source files | source reference found; behavior pending|
| maLineWidth | 2 | numeric registry | 1 source files | source reference found; behavior pending|
| useThemeColors | true | dialog source reference | 74 source files | source reference found; behavior pending|
| showZones | true | dialog source reference | 8 source files | source reference found; behavior pending|
| showMovingAverage | false | generated control candidate | 1 source files | source reference found; behavior pending|
| askColor | "#22C55E" | dialog source reference | 25 source files | source reference found; behavior pending|
| bidColor | "#7C3AED" | dialog source reference | 24 source files | source reference found; behavior pending|
| maAboveColor | "#22C55E" | generated control candidate | 1 source files | source reference found; behavior pending|
| maBelowColor | "#7C3AED" | generated control candidate | 1 source files | source reference found; behavior pending|
| maAutoColor | "price" | generated control candidate | 1 source files | source reference found; behavior pending|
| maLineStyle | "solid" | needs inspection | 1 source files | source reference found; behavior pending|
| shortName | "Big Blocks" | dialog source reference | 10 source files | source reference found; behavior pending|
| showNameLabel | false | generated control candidate | 2 source files | source reference found; behavior pending|
| showValueLabel | true | generated control candidate | 3 source files | source reference found; behavior pending|
| nameBackground | false | generated control candidate | 8 source files | source reference found; behavior pending|
| valueBackground | true | generated control candidate | 8 source files | source reference found; behavior pending|
| enableAlertSound | false | dialog source reference | 2 source files | source reference found; behavior pending|
| enableMessage | false | generated control candidate | 1 source files | source reference found; behavior pending|
| alertMessage | "Big Blocks directional bias changed" | needs inspection | 3 source files | source reference found; behavior pending|
| effortSettingsVersion | 5 | needs inspection | 0 source files | internal metadata|
