# Every indicator setting — audit checklist

Status columns distinguish a saved UI value, an observed engine effect and a source path. A setting is not “fully verified” merely because it saved or appears in source. See REPORT.md for genuine input/live/history limits.

## Big Blocks (Options)

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| minContracts | 100 | Yes | Dedicated renderer / input path | 1 |
| minPremium | 0 | Yes | Dedicated renderer / input path | 2 |
| binSize | 0.25 | Yes | Dedicated renderer / input path | 8 |
| windowMinutes | 0 | Yes | Dedicated renderer / input path | 10 |
| maxLevels | 60 | Yes | Dedicated renderer / input path | 3 |
| widthPx | 150 | Yes | Dedicated renderer / input path | 5 |
| barHeight | 12 | Yes | Dedicated renderer / input path | 5 |
| opacity | 85 | Yes | Dedicated renderer / input path | 167 |
| useStrikePrice | false | Yes | Dedicated renderer / input path | 1 |
| sizeByPremium | false | Yes | Dedicated renderer / input path | 2 |
| includeMultiLeg | false | Yes | Dedicated renderer / input path | 1 |
| showCalls | true | Yes | Dedicated renderer / input path | 1 |
| showPuts | true | Yes | Dedicated renderer / input path | 1 |
| showValues | true | Yes | Dedicated renderer / input path | 9 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| callColor | "#22c55e" | Yes | Dedicated renderer / input path | 6 |
| putColor | "#ef4444" | Yes | Dedicated renderer / input path | 6 |

## Gamma Environment

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| position | "top-right" | Yes | Dedicated renderer / input path | 117 |
| sourceSymbol | "SPX" | Yes | Dedicated renderer / input path | 28 |
| showFreshness | true | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | false | Yes | Dedicated renderer / input path | 75 |
| positiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 19 |
| negativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 21 |
| badgeScale | 1 | Yes | Dedicated renderer / input path | 1 |
| gammaEnvironmentSettingsVersion | 2 | Not individually established | Dedicated renderer / input path | 0 |

## Zero Gamma Line

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| sourceTicker | "AUTO" | Yes | Dedicated renderer / input path | 20 |
| historySessions | 5 | Yes | Dedicated renderer / input path | 4 |
| refreshSeconds | 30 | Yes | Dedicated renderer / input path | 2 |
| opacity | 72 | Yes | Dedicated renderer / input path | 167 |
| lineWidth | 2 | Yes | Dedicated renderer / input path | 142 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| lineColor | "#A3FF12" | Yes | Dedicated renderer / input path | 58 |
| showCurrentValue | true | Yes | Dedicated renderer / input path | 2 |
| showRegimeHint | true | Yes | Dedicated renderer / input path | 1 |

## Options Delta

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| refreshSeconds | 60 | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| positiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 19 |
| negativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 21 |

## Zero Gamma Bars

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| refreshSeconds | 60 | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| positiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 19 |
| negativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 21 |

## Gamma Heatmap

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| historyHours | 24 | Yes | Dedicated renderer / input path | 3 |
| binSize | 5 | Yes | Dedicated renderer / input path | 8 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| intensity | 1 | Yes | Dedicated renderer / input path | 15 |
| refreshSeconds | 30 | Yes | Dedicated renderer / input path | 2 |
| preset | "intraday" | Yes | Dedicated renderer / input path | 44 |
| metric | "GAMMA" | Yes | Dedicated renderer / input path | 44 |
| viewMode | "net" | Yes | Dedicated renderer / input path | 12 |
| sourceMode | "hybrid" | Yes | Dedicated renderer / input path | 3 |
| optionsSource | "AUTO" | Yes | Dedicated renderer / input path | 1 |
| showHistorical | true | Yes | Dedicated renderer / input path | 2 |
| showLevels | true | Yes | Dedicated renderer / input path | 3 |
| carryForwardFade | true | Yes | Dedicated renderer / input path | 2 |
| showStatus | true | Yes | Dedicated renderer / input path | 1 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| positiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 19 |
| negativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 21 |
| neutralColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 33 |
| gammaHeatmapSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Net Gamma Exposure By Strike

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| refreshSeconds | 5 | Yes | Dedicated renderer / input path | 2 |
| minimumDte | 0 | Yes | Dedicated renderer / input path | 6 |
| maximumDte | 7 | Yes | Dedicated renderer / input path | 6 |
| customBinSizePoints | 1 | Yes | Dedicated renderer / input path | 5 |
| minimumAbsoluteExposure | 0 | Yes | Dedicated renderer / input path | 3 |
| maximumDistanceFromSourceSpot | 0 | Yes | Dedicated renderer / input path | 2 |
| laneWidthPercent | 24 | Yes | Dedicated renderer / input path | 2 |
| minimumLaneWidthPx | 220 | Yes | Dedicated renderer / input path | 2 |
| maximumLaneWidthPx | 420 | Yes | Dedicated renderer / input path | 2 |
| floatingXPercent | 50 | Yes | Dedicated renderer / input path | 2 |
| zeroSpinePercent | 50 | Yes | Dedicated renderer / input path | 2 |
| fixedBarHeightPx | 9 | Yes | Dedicated renderer / input path | 2 |
| minimumBarHeightPx | 3 | Yes | Dedicated renderer / input path | 2 |
| maximumBarHeightPx | 24 | Yes | Dedicated renderer / input path | 2 |
| barGapPx | 1 | Yes | Dedicated renderer / input path | 2 |
| horizontalPaddingPx | 8 | Yes | Dedicated renderer / input path | 2 |
| scalePercentile | 98 | Yes | Dedicated renderer / input path | 3 |
| fixedMaximum | 0 | Yes | Dedicated renderer / input path | 6 |
| logarithmicStrength | 9 | Yes | Dedicated renderer / input path | 2 |
| maximumDisplayedRows | 80 | Yes | Dedicated renderer / input path | 2 |
| minimumPercentageOfTotal | 0.1 | Yes | Dedicated renderer / input path | 2 |
| barOpacity | 100 | Yes | Dedicated renderer / input path | 3 |
| borderOpacity | 100 | Yes | Dedicated renderer / input path | 3 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| gradientStrength | 25 | Yes | Dedicated renderer / input path | 2 |
| minimumMappingConfidence | 70 | Yes | Dedicated renderer / input path | 2 |
| preset | "balanced-net-gex" | Yes | Dedicated renderer / input path | 44 |
| provider | "quantdata" | Not individually established | Dedicated renderer / input path | 117 |
| sourceTicker | "AUTO" | Yes | Dedicated renderer / input path | 20 |
| representation | "per-one-percent-move" | Not individually established | Dedicated renderer / input path | 29 |
| expirationMode | "zero-to-one-dte" | Yes | Dedicated renderer / input path | 4 |
| expirationDates | "" | Yes | Dedicated renderer / input path | 7 |
| includeWeeklies | true | Yes | Dedicated renderer / input path | 6 |
| includeMonthlies | true | Yes | Dedicated renderer / input path | 6 |
| includeQuarterlies | true | Yes | Dedicated renderer / input path | 6 |
| aggregationMode | "auto-bin" | Yes | Dedicated renderer / input path | 7 |
| placement | "floating" | Not individually established | Dedicated renderer / input path | 39 |
| spaceMode | "overlay" | Not individually established | Dedicated renderer / input path | 1 |
| reverseDirections | false | Yes | Dedicated renderer / input path | 2 |
| barHeightMode | "automatic" | Yes | Dedicated renderer / input path | 2 |
| scaleMode | "visible-percentile" | Yes | Dedicated renderer / input path | 8 |
| scaleTransform | "square-root" | Yes | Dedicated renderer / input path | 3 |
| sharePositiveNegativeScale | true | Yes | Dedicated renderer / input path | 2 |
| contentMode | "net" | Yes | Dedicated renderer / input path | 5 |
| visualMode | "gradient" | Yes | Dedicated renderer / input path | 5 |
| showZeroSpine | true | Yes | Dedicated renderer / input path | 2 |
| showValues | false | Yes | Dedicated renderer / input path | 9 |
| showMappedPrice | false | Yes | Dedicated renderer / input path | 2 |
| showMaxPositive | true | Yes | Dedicated renderer / input path | 3 |
| showMaxNegative | true | Yes | Dedicated renderer / input path | 3 |
| showDominantAbsolute | false | Yes | Dedicated renderer / input path | 3 |
| showCallWall | false | Yes | Dedicated renderer / input path | 3 |
| showPutWall | false | Yes | Dedicated renderer / input path | 3 |
| showCurrentPrice | true | Yes | Dedicated renderer / input path | 2 |
| showHeader | true | Yes | Dedicated renderer / input path | 10 |
| showMappingConfidence | true | Yes | Dedicated renderer / input path | 2 |
| tooltipsEnabled | true | Yes | Dedicated renderer / input path | 2 |
| fadeWhenBelowMinimum | true | Yes | Dedicated renderer / input path | 2 |
| hideWhenBelowMinimum | false | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| positiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 19 |
| negativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 21 |
| callColor | "#22C55E" | Yes | Dedicated renderer / input path | 6 |
| putColor | "#EF4444" | Yes | Dedicated renderer / input path | 6 |
| absoluteColor | "#8B5CF6" | Yes | Dedicated renderer / input path | 2 |
| zeroSpineColor | "#71717A" | Yes | Dedicated renderer / input path | 2 |
| warningColor | "#F59E0B" | Yes | Dedicated renderer / input path | 6 |
| netGammaSettingsVersion | 3 | Not individually established | Dedicated renderer / input path | 0 |

## GEX Interval Map

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| refreshSeconds | 5 | Yes | Dedicated renderer / input path | 2 |
| rollingBuckets | 5 | Yes | Dedicated renderer / input path | 2 |
| minimumDte | 0 | Yes | Dedicated renderer / input path | 6 |
| maximumDte | 7 | Yes | Dedicated renderer / input path | 6 |
| customBinSizePoints | 1 | Yes | Dedicated renderer / input path | 5 |
| minimumAbsoluteExposure | 0 | Yes | Dedicated renderer / input path | 3 |
| maximumDistancePoints | 0 | Yes | Dedicated renderer / input path | 4 |
| maximumPoints | 40000 | Yes | Dedicated renderer / input path | 3 |
| maximumStrikesPerBucket | 80 | Yes | Dedicated renderer / input path | 2 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| intensity | 1 | Yes | Dedicated renderer / input path | 15 |
| minimumRadius | 3 | Yes | Dedicated renderer / input path | 4 |
| maximumRadius | 18 | Yes | Dedicated renderer / input path | 4 |
| bubbleStrokeWidth | 1.25 | Yes | Dedicated renderer / input path | 2 |
| bubbleFillStrength | 12 | Yes | Dedicated renderer / input path | 2 |
| trackWidth | 1.5 | Yes | Dedicated renderer / input path | 2 |
| cellWidth | 10 | Yes | Dedicated renderer / input path | 6 |
| fixedDotRadius | 3 | Yes | Dedicated renderer / input path | 2 |
| minimumOpacity | 10 | Yes | Dedicated renderer / input path | 9 |
| maximumOpacity | 72 | Yes | Dedicated renderer / input path | 9 |
| scalePercentile | 98 | Yes | Dedicated renderer / input path | 3 |
| fixedMaximum | 1000000000 | Yes | Dedicated renderer / input path | 6 |
| logStrength | 9 | Yes | Dedicated renderer / input path | 3 |
| currentBucketScaleMultiplier | 115 | Yes | Dedicated renderer / input path | 2 |
| currentBucketOpacityMultiplier | 115 | Yes | Dedicated renderer / input path | 2 |
| mergeTolerancePoints | 1 | Yes | Dedicated renderer / input path | 4 |
| alertExposureThreshold | 50000000 | Yes | Dedicated renderer / input path | 1 |
| alertDistancePoints | 5 | Yes | Dedicated renderer / input path | 2 |
| alertCooldownSeconds | 60 | Yes | Dedicated renderer / input path | 2 |
| preset | "balanced-intraday" | Yes | Dedicated renderer / input path | 44 |
| provider | "quantdata" | Not individually established | Dedicated renderer / input path | 117 |
| sourceTicker | "AUTO" | Yes | Dedicated renderer / input path | 20 |
| aggregationPeriod | "1m" | Yes | Dedicated renderer / input path | 10 |
| historyMode | "current-session" | Yes | Dedicated renderer / input path | 1 |
| sessionDate | "" | Not individually established | Dedicated renderer / input path | 111 |
| startTime | "" | Not individually established | Dedicated renderer / input path | 57 |
| endTime | "" | Not individually established | Dedicated renderer / input path | 52 |
| mode | "raw" | Yes | Dedicated renderer / input path | 200 |
| baseline | "previous-bucket" | Yes | Dedicated renderer / input path | 55 |
| expirationMode | "zero-to-one-dte" | Yes | Dedicated renderer / input path | 4 |
| expirationDates | "" | Yes | Dedicated renderer / input path | 7 |
| includeWeeklies | true | Yes | Dedicated renderer / input path | 6 |
| includeMonthlies | true | Yes | Dedicated renderer / input path | 6 |
| includeQuarterlies | true | Yes | Dedicated renderer / input path | 6 |
| aggregationMode | "auto-bin" | Yes | Dedicated renderer / input path | 7 |
| contentMode | "net" | Yes | Dedicated renderer / input path | 5 |
| visualMode | "bubbles" | Yes | Dedicated renderer / input path | 5 |
| scaleMode | "visible-percentile" | Yes | Dedicated renderer / input path | 8 |
| scaleTransform | "square-root" | Yes | Dedicated renderer / input path | 3 |
| highlightCurrentBucket | true | Yes | Dedicated renderer / input path | 2 |
| showCurrentBucketOutline | true | Yes | Dedicated renderer / input path | 2 |
| hollowBubbles | true | Yes | Dedicated renderer / input path | 2 |
| showLevelTracks | true | Yes | Dedicated renderer / input path | 2 |
| showUnderlyingPriceLine | false | Yes | Dedicated renderer / input path | 2 |
| showMaxPositive | true | Yes | Dedicated renderer / input path | 3 |
| showMaxNegative | true | Yes | Dedicated renderer / input path | 3 |
| showDominantAbsolute | false | Yes | Dedicated renderer / input path | 3 |
| showCallWall | false | Yes | Dedicated renderer / input path | 3 |
| showPutWall | false | Yes | Dedicated renderer / input path | 3 |
| mergeCoincidentLabels | true | Yes | Dedicated renderer / input path | 2 |
| hideZeroValues | true | Yes | Dedicated renderer / input path | 2 |
| showLevels | true | Yes | Dedicated renderer / input path | 3 |
| showValues | false | Yes | Dedicated renderer / input path | 9 |
| showHeader | true | Yes | Dedicated renderer / input path | 10 |
| showMappingConfidence | true | Yes | Dedicated renderer / input path | 2 |
| tooltipsEnabled | true | Yes | Dedicated renderer / input path | 2 |
| enableAlerts | false | Yes | Dedicated renderer / input path | 6 |
| alertNewLargePoint | true | Yes | Dedicated renderer / input path | 1 |
| alertLevelApproach | false | Yes | Dedicated renderer / input path | 1 |
| alertLevelTouch | false | Yes | Dedicated renderer / input path | 1 |
| browserNotifications | false | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| positiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 19 |
| negativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 21 |
| callColor | "#22C55E" | Yes | Dedicated renderer / input path | 6 |
| putColor | "#EF4444" | Yes | Dedicated renderer / input path | 6 |
| neutralColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 33 |
| negativeExposurePalette | "neutral" | Yes | Dedicated renderer / input path | 1 |
| gexIntervalMapSettingsVersion | 3 | Not individually established | Dedicated renderer / input path | 0 |

## Bounce Levels

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| minimumDte | 0 | Yes | Dedicated renderer / input path | 6 |
| maximumDte | 7 | Yes | Dedicated renderer / input path | 6 |
| maximumLevels | 8 | Yes | Dedicated renderer / input path | 3 |
| topExposurePercent | 10 | Yes | Dedicated renderer / input path | 2 |
| minimumPercentOfKing | 15 | Yes | Dedicated renderer / input path | 3 |
| minimumRelevanceScore | 55 | Yes | Dedicated renderer / input path | 3 |
| maximumDistancePoints | 0 | Yes | Dedicated renderer / input path | 4 |
| clusterDistancePoints | 25 | Yes | Dedicated renderer / input path | 3 |
| airPocketRatio | 20 | Yes | Dedicated renderer / input path | 3 |
| maximumNodesPerSlice | 24 | Yes | Dedicated renderer / input path | 3 |
| activeEnterThreshold | 15 | Yes | Dedicated renderer / input path | 3 |
| activeExitThreshold | 8 | Yes | Dedicated renderer / input path | 3 |
| retirementConfirmationSnapshots | 3 | Yes | Dedicated renderer / input path | 3 |
| absoluteExposureScale | 1000000000 | Yes | Dedicated renderer / input path | 3 |
| rollWeakeningThreshold | 40 | Yes | Dedicated renderer / input path | 3 |
| rollBuildingThreshold | 40 | Yes | Dedicated renderer / input path | 3 |
| maxRollDistance | 5 | Yes | Dedicated renderer / input path | 3 |
| rollWindowSeconds | 120 | Yes | Dedicated renderer / input path | 2 |
| maximumGatekeepers | 2 | Yes | Dedicated renderer / input path | 3 |
| maximumMajorNodes | 4 | Yes | Dedicated renderer / input path | 3 |
| minimumGatekeeperRelevance | 60 | Yes | Dedicated renderer / input path | 3 |
| minimumGatekeeperPercentOfKing | 20 | Yes | Dedicated renderer / input path | 3 |
| minimumClusterNodes | 2 | Yes | Dedicated renderer / input path | 3 |
| minimumAirPocketWidthPercent | 0.3 | Yes | Dedicated renderer / input path | 3 |
| magnitudeWeight | 45 | Yes | Dedicated renderer / input path | 3 |
| proximityWeight | 15 | Yes | Dedicated renderer / input path | 6 |
| accumulationWeight | 15 | Yes | Dedicated renderer / input path | 3 |
| persistenceWeight | 10 | Yes | Dedicated renderer / input path | 4 |
| freshnessWeight | 10 | Yes | Dedicated renderer / input path | 3 |
| clusterWeight | 5 | Yes | Dedicated renderer / input path | 3 |
| proximityDecayPercent | 3 | Yes | Dedicated renderer / input path | 3 |
| developingMinimumPercentile | 75 | Yes | Dedicated renderer / input path | 3 |
| developingMinimumGrowthPercent | 10 | Yes | Dedicated renderer / input path | 3 |
| weakeningThresholdPercent | -10 | Yes | Dedicated renderer / input path | 3 |
| weakeningRelevanceThreshold | 45 | Yes | Dedicated renderer / input path | 3 |
| retirementRelevanceThreshold | 30 | Yes | Dedicated renderer / input path | 3 |
| retirementExposurePercentile | 65 | Yes | Dedicated renderer / input path | 3 |
| touchTolerancePercent | 0.05 | Yes | Dedicated renderer / input path | 3 |
| touchDecayFactor | 85 | Yes | Dedicated renderer / input path | 3 |
| minimumNodeThickness | 2 | Yes | Dedicated renderer / input path | 2 |
| maximumNodeThickness | 18 | Yes | Dedicated renderer / input path | 2 |
| lineOpacity | 100 | Yes | Dedicated renderer / input path | 5 |
| minimumNodeOpacity | 8 | Yes | Dedicated renderer / input path | 1 |
| exposureIntensity | 1 | Yes | Dedicated renderer / input path | 1 |
| glowStrength | 5 | Yes | Dedicated renderer / input path | 3 |
| alertDistancePoints | 5 | Yes | Dedicated renderer / input path | 2 |
| alertMinimumRelevance | 55 | Yes | Dedicated renderer / input path | 1 |
| alertMinimumPercentOfKing | 15 | Yes | Dedicated renderer / input path | 1 |
| alertMinimumExposure | 0 | Yes | Dedicated renderer / input path | 1 |
| alertMinimumRoc | 0 | Yes | Dedicated renderer / input path | 1 |
| alertCooldownSeconds | 60 | Yes | Dedicated renderer / input path | 2 |
| gexMapMirror | true | Yes | Dedicated renderer / input path | 2 |
| linkGexMapSettings | true | Yes | Dedicated renderer / input path | 3 |
| mapExpiryScope | "FRONT_EXPIRY" | Not individually established | Dedicated renderer / input path | 2 |
| mapRepresentation | "PER_ONE_DOLLAR_MOVE" | Not individually established | Dedicated renderer / input path | 2 |
| mapExposureModel | "STRUCTURAL_OI" | Not individually established | Dedicated renderer / input path | 2 |
| mapViewMode | "star" | Not individually established | Dedicated renderer / input path | 2 |
| mapStepMinutes | 1 | Not individually established | Dedicated renderer / input path | 2 |
| preset | "balanced-intraday" | Yes | Dedicated renderer / input path | 44 |
| provider | "quantdata" | Not individually established | Dedicated renderer / input path | 117 |
| sourceTicker | "AUTO" | Yes | Dedicated renderer / input path | 20 |
| priceMode | "live" | Yes | Dedicated renderer / input path | 11 |
| extendRight | false | Yes | Dedicated renderer / input path | 32 |
| greekMode | "GAMMA" | Yes | Dedicated renderer / input path | 27 |
| expirationMode | "front-expiration" | Yes | Dedicated renderer / input path | 4 |
| expirationDates | "" | Not individually established | Dedicated renderer / input path | 7 |
| historyBuckets | 1440 | Not individually established | Dedicated renderer / input path | 4 |
| includeWeeklies | true | Yes | Dedicated renderer / input path | 6 |
| includeMonthlies | true | Yes | Dedicated renderer / input path | 6 |
| includeQuarterlies | true | Yes | Dedicated renderer / input path | 6 |
| showHeader | false | Yes | Dedicated renderer / input path | 10 |
| showLabels | false | Yes | Dedicated renderer / input path | 61 |
| showValues | false | Yes | Dedicated renderer / input path | 9 |
| showAirPockets | false | Yes | Dedicated renderer / input path | 3 |
| showKing | true | Yes | Dedicated renderer / input path | 1 |
| showFloor | true | Yes | Dedicated renderer / input path | 1 |
| showCeiling | true | Yes | Dedicated renderer / input path | 1 |
| showGatekeepers | true | Yes | Dedicated renderer / input path | 1 |
| showMajorNodes | true | Yes | Dedicated renderer / input path | 1 |
| showClusters | true | Yes | Dedicated renderer / input path | 1 |
| showDevelopingNodes | true | Yes | Dedicated renderer / input path | 1 |
| showWeakeningNodes | true | Yes | Dedicated renderer / input path | 1 |
| showRetiredHistory | true | Yes | Dedicated renderer / input path | 1 |
| showTouchCount | true | Yes | Dedicated renderer / input path | 2 |
| microOrbTexture | true | Yes | Dedicated renderer / input path | 3 |
| visualStrengthBasis | "percent-of-king" | Yes | Dedicated renderer / input path | 4 |
| rollDetectionEnabled | true | Yes | Dedicated renderer / input path | 3 |
| rollVisualizationEnabled | false | Yes | Dedicated renderer / input path | 3 |
| tooltipsEnabled | true | Yes | Dedicated renderer / input path | 2 |
| enableAlerts | false | Yes | Dedicated renderer / input path | 6 |
| alertLevelApproach | true | Yes | Dedicated renderer / input path | 1 |
| alertLevelTouch | true | Yes | Dedicated renderer / input path | 1 |
| alertFreshNodesOnly | false | Yes | Dedicated renderer / input path | 1 |
| alertFirstTouchOnly | false | Yes | Dedicated renderer / input path | 1 |
| alertMapReshuffle | true | Yes | Dedicated renderer / input path | 1 |
| alertStructuralChanges | true | Yes | Dedicated renderer / input path | 1 |
| alertNodeTransitions | true | Yes | Dedicated renderer / input path | 1 |
| inAppSound | false | Yes | Dedicated renderer / input path | 2 |
| chartMarkers | true | Yes | Dedicated renderer / input path | 2 |
| browserNotifications | false | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| syncGexMapColors | true | Yes | Dedicated renderer / input path | 2 |
| positiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 19 |
| negativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 21 |
| kingColor | "#F59E0B" | Yes | Dedicated renderer / input path | 1 |
| developingColor | "#22C55E" | Yes | Dedicated renderer / input path | 1 |
| weakeningColor | "#EF4444" | Yes | Dedicated renderer / input path | 1 |
| airPocketColor | "#71717A" | Yes | Dedicated renderer / input path | 1 |
| bounceLevelsSettingsVersion | 6 | Not individually established | Dedicated renderer / input path | 0 |

## Dark Pool Map

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| historyDays | 2 | Yes | Dedicated renderer / input path | 8 |
| pollSeconds | 2 | Yes | Dedicated renderer / input path | 4 |
| minimumPrintNotional | 100000 | Yes | Dedicated renderer / input path | 3 |
| maximumPrintNotional | 0 | Yes | Dedicated renderer / input path | 3 |
| minimumPrintShares | 0 | Yes | Dedicated renderer / input path | 3 |
| maximumPrintShares | 0 | Yes | Dedicated renderer / input path | 3 |
| minimumLevelNotional | 5000000 | Yes | Dedicated renderer / input path | 3 |
| minimumLevelShares | 0 | Yes | Dedicated renderer / input path | 3 |
| minimumTradeCount | 1 | Yes | Dedicated renderer / input path | 5 |
| topLevels | 50 | Yes | Dedicated renderer / input path | 4 |
| minimumStrengthScore | 30 | Yes | Dedicated renderer / input path | 3 |
| mappedBinPoints | 2 | Yes | Dedicated renderer / input path | 3 |
| sourceBinCents | 5 | Yes | Dedicated renderer / input path | 3 |
| displayTickMultiple | 4 | Yes | Dedicated renderer / input path | 3 |
| mergeTolerancePoints | 3 | Yes | Dedicated renderer / input path | 4 |
| maximumZoneWidthPoints | 20 | Yes | Dedicated renderer / input path | 3 |
| recencyHalfLifeHours | 24 | Yes | Dedicated renderer / input path | 3 |
| sessionsForFullPersistenceScore | 5 | Yes | Dedicated renderer / input path | 3 |
| maximumHistoricalPrints | 100000 | Yes | Dedicated renderer / input path | 2 |
| maximumVisibleCircles | 2000 | Yes | Dedicated renderer / input path | 3 |
| maximumVisibleZones | 100 | Yes | Dedicated renderer / input path | 3 |
| minimumRadius | 3 | Yes | Dedicated renderer / input path | 4 |
| maximumRadius | 18 | Yes | Dedicated renderer / input path | 4 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| zoneOpacity | 16 | Yes | Dedicated renderer / input path | 7 |
| manualAlpha | 0 | Yes | Dedicated renderer / input path | 3 |
| manualBeta | 1 | Yes | Dedicated renderer / input path | 3 |
| minimumMappingR2 | 0.95 | Yes | Dedicated renderer / input path | 3 |
| mappingWindowMinutes | 60 | Yes | Dedicated renderer / input path | 3 |
| minimumMappingSamples | 120 | Yes | Dedicated renderer / input path | 3 |
| staleAllowanceSeconds | 30 | Yes | Dedicated renderer / input path | 3 |
| alertPrintNotional | 5000000 | Yes | Dedicated renderer / input path | 2 |
| alertLevelNotional | 25000000 | Yes | Dedicated renderer / input path | 2 |
| alertScore | 80 | Yes | Dedicated renderer / input path | 2 |
| alertDistancePoints | 5 | Yes | Dedicated renderer / input path | 2 |
| alertCooldownSeconds | 60 | Yes | Dedicated renderer / input path | 2 |
| preset | "balanced" | Yes | Dedicated renderer / input path | 44 |
| sourceTicker | "AUTO" | Yes | Dedicated renderer / input path | 20 |
| mappingMode | "rolling-affine" | Yes | Dedicated renderer / input path | 6 |
| visualMode | "circles-and-zones" | Yes | Dedicated renderer / input path | 5 |
| priceBinMode | "mapped-points" | Yes | Dedicated renderer / input path | 3 |
| mergeNearbyLevels | true | Yes | Dedicated renderer / input path | 3 |
| showDelayedPrints | true | Yes | Dedicated renderer / input path | 3 |
| includeDelayedInLevels | true | Yes | Dedicated renderer / input path | 3 |
| includeAskSide | true | Yes | Dedicated renderer / input path | 3 |
| includeBidSide | true | Yes | Dedicated renderer / input path | 3 |
| includeMid | true | Yes | Dedicated renderer / input path | 3 |
| includeUnknown | true | Yes | Dedicated renderer / input path | 3 |
| showLevelLabels | true | Yes | Dedicated renderer / input path | 7 |
| showMappingBadge | true | Yes | Dedicated renderer / input path | 1 |
| showMappingConfidence | true | Yes | Dedicated renderer / input path | 2 |
| showLevelTable | false | Yes | Dedicated renderer / input path | 2 |
| enableAlerts | false | Yes | Dedicated renderer / input path | 6 |
| alertNewLargePrint | true | Yes | Dedicated renderer / input path | 2 |
| alertNewLargeLevel | true | Yes | Dedicated renderer / input path | 2 |
| alertScoreThreshold | true | Yes | Dedicated renderer / input path | 2 |
| alertPriceApproach | false | Yes | Dedicated renderer / input path | 2 |
| alertPriceTouch | false | Yes | Dedicated renderer / input path | 2 |
| browserNotifications | false | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| neutralColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 33 |
| askSideColor | "#22C55E" | Yes | Dedicated renderer / input path | 3 |
| bidSideColor | "#EF4444" | Yes | Dedicated renderer / input path | 3 |
| midColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 6 |
| delayedColor | "#F59E0B" | Yes | Dedicated renderer / input path | 3 |
| darkPoolMapSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Dark Pool (GEX)

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| lookbackDays | 30 | Yes | Dedicated renderer / input path | 6 |
| topN | 5 | Yes | Dedicated renderer / input path | 2 |
| minimumNotional | 1000000 | Yes | Dedicated renderer / input path | 3 |
| maximumNotional | 0 | Yes | Dedicated renderer / input path | 2 |
| minimumShares | 0 | Yes | Dedicated renderer / input path | 2 |
| maximumShares | 0 | Yes | Dedicated renderer / input path | 2 |
| minimumSharePrice | 0 | Yes | Dedicated renderer / input path | 1 |
| maximumSharePrice | 0 | Yes | Dedicated renderer / input path | 1 |
| tolerance | 0.15 | Yes | Dedicated renderer / input path | 19 |
| interactionTolerance | 0.03 | Yes | Dedicated renderer / input path | 2 |
| resetDistance | 0.1 | Yes | Dedicated renderer / input path | 2 |
| minimumTimeOutsideMs | 0 | Yes | Dedicated renderer / input path | 2 |
| reactionThreshold | 0.1 | Yes | Dedicated renderer / input path | 4 |
| maximumConfirmationBars | 20 | Yes | Dedicated renderer / input path | 2 |
| minimumReactionDurationMs | 0 | Yes | Dedicated renderer / input path | 2 |
| breakDistance | 2 | Yes | Dedicated renderer / input path | 3 |
| breakTimeBeyondMs | 60000 | Yes | Dedicated renderer / input path | 2 |
| volumeThreshold | 0 | Yes | Dedicated renderer / input path | 2 |
| reclaimConfirmationCloses | 1 | Yes | Dedicated renderer / input path | 2 |
| minimumTimeBeyondBeforeReclaimMs | 0 | Yes | Dedicated renderer / input path | 2 |
| reactionHorizonBars | 20 | Yes | Dedicated renderer / input path | 2 |
| reactionHorizonMs | 1800000 | Yes | Dedicated renderer / input path | 2 |
| minimumResearchSamples | 3 | Yes | Dedicated renderer / input path | 2 |
| minimumStatsSamples | 3 | Yes | Dedicated renderer / input path | 2 |
| activationRadiusPercent | 2 | Yes | Dedicated renderer / input path | 1 |
| qualityPrecisionWeight | 20 | Yes | Dedicated renderer / input path | 2 |
| qualityExcursionWeight | 25 | Yes | Dedicated renderer / input path | 2 |
| qualityEfficiencyWeight | 20 | Yes | Dedicated renderer / input path | 2 |
| qualitySpeedWeight | 15 | Yes | Dedicated renderer / input path | 2 |
| qualityFreshnessWeight | 10 | Yes | Dedicated renderer / input path | 2 |
| qualityGexWeight | 10 | Yes | Dedicated renderer / input path | 2 |
| clusterDistance | 0.12 | Yes | Dedicated renderer / input path | 4 |
| minimumClusterPrints | 2 | Yes | Dedicated renderer / input path | 1 |
| minimumClusterNotional | 5000000 | Yes | Dedicated renderer / input path | 1 |
| bandThickness | 2 | Yes | Dedicated renderer / input path | 2 |
| bandOpacity | 100 | Yes | Dedicated renderer / input path | 2 |
| originMarkerSize | 7 | Yes | Dedicated renderer / input path | 2 |
| haloIntensity | 18 | Yes | Dedicated renderer / input path | 2 |
| kingBoost | 30 | Yes | Dedicated renderer / input path | 2 |
| ageFadeHalfLifeDays | 30 | Yes | Dedicated renderer / input path | 1 |
| proximityDistance | 0.15 | Yes | Dedicated renderer / input path | 2 |
| refreshSeconds | 5 | Yes | Dedicated renderer / input path | 2 |
| alertPrintNotional | 5000000 | Yes | Dedicated renderer / input path | 2 |
| alertConfluence | 75 | Yes | Dedicated renderer / input path | 1 |
| alertCooldownSeconds | 60 | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| lookbackMode | "calendar-days" | Yes | Dedicated renderer / input path | 1 |
| sortMode | "notional" | Yes | Dedicated renderer / input path | 2 |
| viewPreset | "raw-dp-levels" | Yes | Dedicated renderer / input path | 1 |
| precisionMode | true | Yes | Dedicated renderer / input path | 1 |
| contextMode | "current" | Yes | Dedicated renderer / input path | 2 |
| confluenceMode | "king-and-major" | Yes | Dedicated renderer / input path | 1 |
| toleranceMode | "percentage" | Yes | Dedicated renderer / input path | 1 |
| displayMode | "raw" | Yes | Dedicated renderer / input path | 9 |
| clusterEnabled | false | Yes | Dedicated renderer / input path | 2 |
| clusterDistanceMode | "percentage" | Yes | Dedicated renderer / input path | 1 |
| proxyMode | true | Yes | Dedicated renderer / input path | 2 |
| showOriginMarker | false | Yes | Dedicated renderer / input path | 2 |
| showForwardMemory | false | Yes | Dedicated renderer / input path | 1 |
| showExactLine | true | Yes | Dedicated renderer / input path | 1 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| labelExtended | false | Yes | Dedicated renderer / input path | 2 |
| showReactionMarkers | true | Yes | Dedicated renderer / input path | 2 |
| showHoldMarkers | true | Yes | Dedicated renderer / input path | 2 |
| showBreakMarkers | true | Yes | Dedicated renderer / input path | 2 |
| showReclaimMarkers | true | Yes | Dedicated renderer / input path | 2 |
| showReactionTrail | false | Yes | Dedicated renderer / input path | 2 |
| showInteractionZone | false | Yes | Dedicated renderer / input path | 1 |
| reactionAnalytics | true | Yes | Dedicated renderer / input path | 1 |
| showReactionResearch | false | Yes | Dedicated renderer / input path | 2 |
| interactionToleranceMode | "percentage" | Yes | Dedicated renderer / input path | 2 |
| resetDistanceMode | "percentage" | Yes | Dedicated renderer / input path | 2 |
| reactionThresholdMode | "percentage" | Yes | Dedicated renderer / input path | 2 |
| breakDistanceMode | "ticks" | Yes | Dedicated renderer / input path | 2 |
| breakConfirmation | "1-close" | Yes | Dedicated renderer / input path | 2 |
| interactionSession | "regular-hours" | Yes | Dedicated renderer / input path | 2 |
| useIntrabarHighLow | true | Yes | Dedicated renderer / input path | 2 |
| requireCloseAwayFromLevel | false | Yes | Dedicated renderer / input path | 2 |
| useVolumeConfirmation | false | Yes | Dedicated renderer / input path | 2 |
| enableReclaimDetection | true | Yes | Dedicated renderer / input path | 2 |
| firstTouchOnly | false | Yes | Dedicated renderer / input path | 2 |
| includeLateReports | true | Yes | Dedicated renderer / input path | 1 |
| includeCorrectedPrints | true | Yes | Dedicated renderer / input path | 1 |
| excludeCanceled | true | Yes | Dedicated renderer / input path | 1 |
| showTooltip | true | Yes | Dedicated renderer / input path | 2 |
| showInspector | false | Yes | Dedicated renderer / input path | 3 |
| showFreshness | true | Yes | Dedicated renderer / input path | 2 |
| ageFade | false | Yes | Dedicated renderer / input path | 3 |
| proximityEmphasis | true | Yes | Dedicated renderer / input path | 2 |
| performanceQuality | "auto" | Yes | Dedicated renderer / input path | 1 |
| enableAlerts | false | Yes | Dedicated renderer / input path | 6 |
| alertNewPrint | true | Yes | Dedicated renderer / input path | 1 |
| alertPriceApproach | false | Yes | Dedicated renderer / input path | 2 |
| alertPriceTouch | false | Yes | Dedicated renderer / input path | 2 |
| alertHoldConfirmed | true | Yes | Dedicated renderer / input path | 1 |
| alertBreakConfirmed | true | Yes | Dedicated renderer / input path | 1 |
| alertReclaimConfirmed | true | Yes | Dedicated renderer / input path | 1 |
| alertGexConfluence | true | Yes | Dedicated renderer / input path | 1 |
| browserNotifications | false | Yes | Dedicated renderer / input path | 2 |
| neutralColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 33 |
| positiveGexColor | "#22C55E" | Yes | Dedicated renderer / input path | 2 |
| negativeGexColor | "#EF4444" | Yes | Dedicated renderer / input path | 2 |
| darkPoolGexSettingsVersion | 2 | Not individually established | Dedicated renderer / input path | 0 |

## Implied Volatility Rank

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| lookBackPeriodDays | 252 | Yes | Dedicated renderer / input path | 6 |
| targetMaturityDays | 30 | Yes | Dedicated renderer / input path | 6 |
| refreshSeconds | 15 | Yes | Dedicated renderer / input path | 2 |
| staleAfterSeconds | 90 | Yes | Dedicated renderer / input path | 2 |
| maximumForwardFillMinutes | 5 | Yes | Dedicated renderer / input path | 5 |
| paneHeight | 220 | Yes | Dedicated renderer / input path | 11 |
| lineWidth | 2 | Yes | Dedicated renderer / input path | 142 |
| priceLineWidth | 1.5 | Yes | Dedicated renderer / input path | 2 |
| decimalPrecision | 2 | Yes | Dedicated renderer / input path | 1 |
| lowThreshold | 20 | Yes | Dedicated renderer / input path | 1 |
| middleThreshold | 50 | Yes | Dedicated renderer / input path | 1 |
| highThreshold | 80 | Yes | Dedicated renderer / input path | 4 |
| preset | "balanced-30d" | Yes | Dedicated renderer / input path | 44 |
| provider | "quantdata" | Not individually established | Dedicated renderer / input path | 117 |
| sourceTicker | "AUTO" | Yes | Dedicated renderer / input path | 20 |
| contractMode | "average-call-put" | Yes | Dedicated renderer / input path | 6 |
| placement | "separate-pane" | Yes | Dedicated renderer / input path | 39 |
| showIvRank | true | Yes | Dedicated renderer / input path | 1 |
| showIvPercentile | false | Yes | Dedicated renderer / input path | 1 |
| showRawIv | false | Yes | Dedicated renderer / input path | 1 |
| showPriceOverlay | true | Yes | Dedicated renderer / input path | 1 |
| showRegimeBands | true | Yes | Dedicated renderer / input path | 1 |
| showHeader | true | Yes | Dedicated renderer / input path | 10 |
| showLegend | true | Yes | Dedicated renderer / input path | 2 |
| showCurrentBadge | true | Yes | Dedicated renderer / input path | 1 |
| breakAtMissingData | true | Yes | Dedicated renderer / input path | 1 |
| carryLastValid | true | Yes | Dedicated renderer / input path | 3 |
| useLiveIntradayIv | true | Yes | Dedicated renderer / input path | 5 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| rankColor | "#22C55E" | Yes | Dedicated renderer / input path | 1 |
| percentileColor | "#8B5CF6" | Yes | Dedicated renderer / input path | 1 |
| callColor | "#22C55E" | Yes | Dedicated renderer / input path | 6 |
| putColor | "#EF4444" | Yes | Dedicated renderer / input path | 6 |
| priceColor | "#E5E7EB" | Yes | Dedicated renderer / input path | 4 |
| lowBandColor | "#EF4444" | Yes | Dedicated renderer / input path | 1 |
| middleBandColor | "#71717A" | Yes | Dedicated renderer / input path | 1 |
| highBandColor | "#22C55E" | Yes | Dedicated renderer / input path | 1 |
| ivRankSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Cumulative Volume Delta

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Not individually established | output-effect-observed | 7 |
| periodValue | 1 | Yes | output-effect-observed | 3 |
| lineWidth | 2 | Yes | output-effect-observed | 142 |
| filterMinVolume | 0 | Yes | output-effect-observed | 1 |
| filterMaxVolume | 0 | Yes | output-effect-observed | 1 |
| zeroLineWidth | 1 | Yes | output-effect-observed | 3 |
| displayStyle | "candles" | Yes | Dedicated renderer / input path | 7 |
| inputData | "Volumes" | Yes | Dedicated renderer / input path | 15 |
| periodMode | "days" | Yes | Dedicated renderer / input path | 9 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| cvdSettingsVersion | 5 | Not individually established | Dedicated renderer / input path | 0 |
| showName | true | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 3 |
| showValue | true | Yes | output-effect-observed | 3 |
| customName | "Cumulative Volume Delta" | Yes | Dedicated renderer / input path | 1 |
| showBidAskVolumes | false | Yes | output-effect-observed | 1 |
| filteredEnabled | false | Yes | output-effect-observed | 1 |
| filteredSeparateAxis | false | Yes | output-effect-observed | 1 |
| showZeroLine | true | Yes | output-effect-observed | 6 |
| deltaAskColor | "#22C55E" | Yes | output-effect-observed | 1 |
| deltaBidColor | "#EF4444" | Yes | output-effect-observed | 1 |
| volumeAskColor | "#34D399" | Not individually established | output-effect-observed | 1 |
| volumeBidColor | "#F87171" | Not individually established | output-effect-observed | 1 |
| filteredAskColor | "#22C55E" | Yes | output-effect-observed | 1 |
| filteredBidColor | "#EF4444" | Yes | output-effect-observed | 1 |
| zeroLineColor | "#52525B" | Yes | output-effect-observed | 5 |

## CVD Divergence

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| bullishColor | "#22C55E" | Yes | output-effect-observed | 8 |
| bearishColor | "#EF4444" | Yes | output-effect-observed | 8 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| pivotStrength | 2 | Yes | output-effect-observed | 5 |
| lookbackBars | 300 | Yes | output-effect-observed | 8 |
| lineWidth | 2 | Yes | output-effect-observed | 142 |

## Pulling & Stacking

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| aggregationMs | 250 | Yes | Dedicated renderer / input path | 3 |
| rollingWindowMs | 10000 | Yes | Dedicated renderer / input path | 2 |
| eventMergeGapMs | 75 | Yes | Dedicated renderer / input path | 1 |
| postSnapshotWarmupMs | 3000 | Yes | Dedicated renderer / input path | 3 |
| baselineWarmupMs | 20000 | Yes | Dedicated renderer / input path | 3 |
| historySeconds | 300 | Yes | Dedicated renderer / input path | 5 |
| baselineWindowMs | 60000 | Yes | Dedicated renderer / input path | 4 |
| baselineSampleLimit | 4000 | Yes | Dedicated renderer / input path | 5 |
| minimumBaselineSamples | 30 | Yes | Dedicated renderer / input path | 4 |
| minimumContracts | 25 | Yes | Dedicated renderer / input path | 2 |
| relativeThreshold | 3 | Yes | Dedicated renderer / input path | 1 |
| selectedPercentile | 0.9 | Yes | Dedicated renderer / input path | 3 |
| scoreThreshold | 65 | Yes | Dedicated renderer / input path | 5 |
| markerMinimumScore | 65 | Yes | Dedicated renderer / input path | 2 |
| visibleTicks | 120 | Yes | Dedicated renderer / input path | 2 |
| profileWidthPercent | 13 | Yes | Dedicated renderer / input path | 7 |
| minimumProfileWidthPx | 110 | Yes | Dedicated renderer / input path | 2 |
| maximumProfileWidthPx | 280 | Yes | Dedicated renderer / input path | 2 |
| latestWindowMs | 1000 | Yes | Dedicated renderer / input path | 1 |
| lowerPaneHeight | 160 | Yes | Dedicated renderer / input path | 4 |
| markerSize | 7 | Yes | Dedicated renderer / input path | 22 |
| maximumEvents | 1000 | Yes | Dedicated renderer / input path | 3 |
| maximumBuckets | 4000 | Yes | Dedicated renderer / input path | 3 |
| staleAfterMs | 5000 | Yes | Dedicated renderer / input path | 5 |
| markerRetentionMs | 300000 | Yes | Dedicated renderer / input path | 4 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| minimumOpacity | 0.025 | Yes | Dedicated renderer / input path | 9 |
| maximumOpacity | 0.42 | Yes | Dedicated renderer / input path | 9 |
| minimumCellHeightPx | 2 | Yes | Dedicated renderer / input path | 2 |
| maximumCellHeightPx | 24 | Yes | Dedicated renderer / input path | 2 |
| wallMinimumContracts | 150 | Yes | Dedicated renderer / input path | 1 |
| wallMinimumLevels | 1 | Yes | Dedicated renderer / input path | 1 |
| wallMaximumGapTicks | 1 | Yes | Dedicated renderer / input path | 1 |
| wallBuildWindowMs | 500 | Yes | Dedicated renderer / input path | 1 |
| wallMinimumRelativeMultiplier | 3 | Yes | Dedicated renderer / input path | 1 |
| wallMinimumScore | 65 | Yes | Dedicated renderer / input path | 1 |
| wallPersistenceMs | 250 | Yes | Dedicated renderer / input path | 1 |
| collapseWindowMs | 1500 | Yes | Dedicated renderer / input path | 1 |
| collapseMinimumPulledContracts | 100 | Yes | Dedicated renderer / input path | 1 |
| collapseMinimumRatio | 0.6 | Yes | Dedicated renderer / input path | 1 |
| collapseMaximumExecutedRatio | 0.25 | Yes | Dedicated renderer / input path | 1 |
| vacuumMinimumLevels | 3 | Yes | Dedicated renderer / input path | 1 |
| vacuumMinimumContracts | 200 | Yes | Dedicated renderer / input path | 1 |
| vacuumMaximumGapTicks | 1 | Yes | Dedicated renderer / input path | 1 |
| vacuumWindowMs | 300 | Yes | Dedicated renderer / input path | 1 |
| vacuumMinimumDepthRemovalRatio | 0.5 | Yes | Dedicated renderer / input path | 1 |
| vacuumMinimumScore | 70 | Yes | Dedicated renderer / input path | 1 |
| repostWindowMs | 1000 | Yes | Dedicated renderer / input path | 1 |
| repostPriceToleranceTicks | 2 | Yes | Dedicated renderer / input path | 1 |
| repostSizeTolerance | 0.3 | Yes | Dedicated renderer / input path | 1 |
| repostMinimumQuantity | 50 | Yes | Dedicated renderer / input path | 1 |
| repostMinimumScore | 65 | Yes | Dedicated renderer / input path | 1 |
| alertCooldownMs | 5000 | Yes | Dedicated renderer / input path | 3 |
| preset | "balanced" | Yes | Dedicated renderer / input path | 44 |
| classificationMode | "price-level" | Yes | Dedicated renderer / input path | 2 |
| moveHandling | "separate-move" | Yes | Dedicated renderer / input path | 1 |
| aggregationMode | "fixed-window" | Yes | Dedicated renderer / input path | 7 |
| renderMode | "hybrid" | Yes | Dedicated renderer / input path | 5 |
| lowerPaneMode | "directional-pressure" | Yes | Dedicated renderer / input path | 2 |
| baselineBuckets | 60 | Not individually established | Dedicated renderer / input path | 1 |
| currentProfileWidth | 156 | Not individually established | Dedicated renderer / input path | 1 |
| includeOwnOrders | false | Not individually established | Dedicated renderer / input path | 2 |
| includeImpliedOrders | false | Not individually established | Dedicated renderer / input path | 2 |
| bidEnabled | true | Yes | Dedicated renderer / input path | 1 |
| askEnabled | true | Yes | Dedicated renderer / input path | 1 |
| showHeatCells | true | Yes | Dedicated renderer / input path | 2 |
| showRibbons | false | Yes | Dedicated renderer / input path | 2 |
| showEventMarkers | true | Yes | Dedicated renderer / input path | 4 |
| showCurrentProfile | true | Yes | Dedicated renderer / input path | 2 |
| showLiveDepth | true | Yes | Dedicated renderer / input path | 2 |
| showLowerPane | false | Yes | Dedicated renderer / input path | 9 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| showHeader | true | Yes | Dedicated renderer / input path | 10 |
| showTooltips | true | Yes | Dedicated renderer / input path | 7 |
| showWallBuild | true | Yes | Dedicated renderer / input path | 2 |
| showWallCollapse | true | Yes | Dedicated renderer / input path | 2 |
| showLiquidityVacuum | true | Yes | Dedicated renderer / input path | 2 |
| pullRepostEnabled | false | Yes | Dedicated renderer / input path | 3 |
| enableAlerts | false | Yes | Dedicated renderer / input path | 6 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| bidStackColor | "#22C55E" | Yes | Dedicated renderer / input path | 3 |
| askStackColor | "#EF4444" | Yes | Dedicated renderer / input path | 3 |
| bidPullColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| askPullColor | "#38BDF8" | Yes | Dedicated renderer / input path | 3 |
| moveColor | "#A78BFA" | Yes | Dedicated renderer / input path | 1 |
| neutralColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 33 |
| pullingStackingSettingsVersion | 2 | Not individually established | Dedicated renderer / input path | 1 |

## Delta Bar

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| ladderWidthPx | 150 | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| ladderEdgeGapPx | 2 | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| ladderLevelSpacingPx | 22 | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| ladderOpacity | 100 | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| ladderFontSize | 8 | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| displayMode | "pane" | Yes | Dedicated renderer / input path | 9 |
| showLadderValues | true | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| buyColor | "#22C55E" | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 12 |
| sellColor | "#EF4444" | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 12 |
| spineColor | "#6B7280" | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 2 |

## Delta % Highlight

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| minValue | 50 | Yes | Dedicated renderer / input path | 3 |
| maxValue | 0 | Yes | Dedicated renderer / input path | 5 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| markerSize | 1 | Yes | Dedicated renderer / input path | 22 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| showAsk | true | Yes | Dedicated renderer / input path | 2 |
| showBid | true | Yes | Dedicated renderer / input path | 2 |
| showValue | true | Yes | Dedicated renderer / input path | 3 |
| markerShape | "square" | Not individually established | Dedicated renderer / input path | 2 |
| markerPosition | "inBar" | Not individually established | Dedicated renderer / input path | 2 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| deltaHighlightSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Delta Cumulative Candlestick

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Not individually established | output-effect-observed | 7 |
| filterMinVolume | 0 | Yes | output-effect-observed | 1 |
| filterMaxVolume | 0 | Yes | output-effect-observed | 1 |
| sessionStartHour | 17 | Yes | output-effect-observed | 3 |
| lineWidth | 2 | Yes | output-effect-observed | 142 |
| averageLength | 20 | Yes | output-effect-observed | 4 |
| averageLineWidth | 2 | Yes | output-effect-observed | 1 |
| averageDeviation | 2 | Yes | output-effect-observed | 1 |
| zeroLineWidth | 1 | Yes | output-effect-observed | 3 |
| inputData | "Volumes" | Yes | Dedicated renderer / input path | 15 |
| resetToSession | true | Yes | output-effect-observed | 1 |
| displayStyle | "candles" | Not individually established | Dedicated renderer / input path | 7 |
| candleStyle | "candlestick" | Yes | Dedicated renderer / input path | 4 |
| showAverage | false | Yes | output-effect-observed | 5 |
| averageType | "simple" | Yes | Dedicated renderer / input path | 4 |
| averageLineStyle | "solid" | Yes | Dedicated renderer / input path | 1 |
| showAverageDeviations | false | Yes | output-effect-observed | 1 |
| showZeroLine | true | Yes | output-effect-observed | 6 |
| showName | true | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 3 |
| showValue | true | Yes | output-effect-observed | 3 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| deltaAskColor | "#22C55E" | Yes | output-effect-observed | 1 |
| deltaBidColor | "#EF4444" | Yes | output-effect-observed | 1 |
| averageColor | "#60A5FA" | Yes | output-effect-observed | 3 |
| deviationColor | "#71717A" | Yes | output-effect-observed | 3 |
| zeroLineColor | "#52525B" | Yes | output-effect-observed | 5 |
| cumulativeCandlestickSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Delta Cumulative Histogram

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Not individually established | output-effect-observed | 7 |
| filterMinVolume | 0 | Yes | output-effect-observed | 1 |
| filterMaxVolume | 0 | Yes | output-effect-observed | 1 |
| sessionStartHour | 17 | Yes | output-effect-observed | 3 |
| lineWidth | 2 | Yes | output-effect-observed | 142 |
| zeroLineWidth | 1 | Yes | output-effect-observed | 3 |
| inputData | "Volumes" | Yes | Dedicated renderer / input path | 15 |
| resetToSession | true | Yes | output-effect-observed | 1 |
| displayStyle | "bars" | Yes | Dedicated renderer / input path | 7 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| showName | true | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 3 |
| showValue | true | Yes | output-effect-observed | 3 |
| showZeroLine | true | Yes | output-effect-observed | 6 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| customName | "Cumulative Delta Histogram" | Yes | Dedicated renderer / input path | 1 |
| deltaAskColor | "#22C55E" | Yes | output-effect-observed | 1 |
| deltaBidColor | "#EF4444" | Yes | output-effect-observed | 1 |
| zeroLineColor | "#52525B" | Yes | output-effect-observed | 5 |
| cumulativeHistogramSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Imbalance Tracker

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| minimumPercent | 400 | Yes | Dedicated renderer / input path | 3 |
| minimumDelta | 0 | Yes | Dedicated renderer / input path | 4 |
| minimumConsecutive | 3 | Yes | Dedicated renderer / input path | 1 |
| tickGroupingTicks | 1 | Yes | Dedicated renderer / input path | 1 |
| extendedBars | 10 | Yes | Dedicated renderer / input path | 7 |
| lineWidth | 1 | Yes | Dedicated renderer / input path | 142 |
| zonesExtraTicks | 0 | Yes | Dedicated renderer / input path | 1 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| calculationMode | "diagonal" | Yes | Dedicated renderer / input path | 3 |
| includeZero | false | Yes | Dedicated renderer / input path | 5 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| resetMode | "none" | Yes | Dedicated renderer / input path | 7 |
| showTriggered | true | Yes | Dedicated renderer / input path | 7 |
| triggerOnlyTouch | false | Yes | Dedicated renderer / input path | 1 |
| enableAlertSound | false | Yes | Dedicated renderer / input path | 2 |
| alertName | "Imbalance detected" | Yes | Dedicated renderer / input path | 8 |
| enablePopup | false | Yes | Dedicated renderer / input path | 2 |
| popupMessage | "Imbalance tracker" | Yes | Dedicated renderer / input path | 2 |
| filterTime | "none" | Yes | Dedicated renderer / input path | 16 |
| sessionStart | "09:30" | Not individually established | Dedicated renderer / input path | 8 |
| sessionEnd | "16:00" | Not individually established | Dedicated renderer / input path | 7 |
| buyColor | "#22C55E" | Yes | Dedicated renderer / input path | 12 |
| sellColor | "#EF4444" | Yes | Dedicated renderer / input path | 12 |
| buyTriggeredColor | "#86EFAC" | Yes | Dedicated renderer / input path | 2 |
| sellTriggeredColor | "#FCA5A5" | Yes | Dedicated renderer / input path | 2 |
| imbalanceTrackerSettingsVersion | 3 | Not individually established | Dedicated renderer / input path | 0 |

## Imbalance Rejector

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| minimumPercent | 300 | Yes | Dedicated renderer / input path | 3 |
| comparisonDepth | 1 | Yes | Dedicated renderer / input path | 1 |
| lookbackPeriod | 5 | Yes | Dedicated renderer / input path | 1 |
| tickOffset | 2 | Yes | Dedicated renderer / input path | 3 |
| markerSize | 8 | Yes | Dedicated renderer / input path | 22 |
| markerThickness | 2 | Yes | Dedicated renderer / input path | 1 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| includeZero | false | Yes | Dedicated renderer / input path | 5 |
| confirmedOnly | true | Yes | Dedicated renderer / input path | 1 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| markerType | "triangle" | Not individually established | Dedicated renderer / input path | 2 |
| bullishColor | "#22C55E" | Yes | Dedicated renderer / input path | 8 |
| bearishColor | "#EF4444" | Yes | Dedicated renderer / input path | 8 |
| imbalanceRejectorSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Unfinished Auction

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| daysToLoad | 5 | Yes | Dedicated renderer / input path | 7 |
| lineWidth | 1 | Yes | Dedicated renderer / input path | 142 |
| opacity | 22 | Yes | Dedicated renderer / input path | 167 |
| manualMinimumVolume | 0 | Yes | Dedicated renderer / input path | 2 |
| customStartMinutes | 510 | Yes | Dedicated renderer / input path | 12 |
| customEndMinutes | 900 | Yes | Dedicated renderer / input path | 12 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| badHighColor | "#EF4444" | Yes | Dedicated renderer / input path | 3 |
| badLowColor | "#22C55E" | Yes | Dedicated renderer / input path | 3 |
| showRectangle | true | Yes | Dedicated renderer / input path | 4 |
| showBackground | true | Yes | Dedicated renderer / input path | 7 |
| filterMode | "none" | Yes | Dedicated renderer / input path | 16 |
| extendLines | true | Yes | Dedicated renderer / input path | 33 |
| resetMode | "session-open" | Yes | Dedicated renderer / input path | 7 |
| removeOnShadowTouch | true | Yes | Dedicated renderer / input path | 2 |
| filterTime | "none" | Yes | Dedicated renderer / input path | 16 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |

## Bar POC Indicator

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| daysToLoad | 5 | Yes | Dedicated renderer / input path | 7 |
| filterMin | 0 | Yes | Dedicated renderer / input path | 12 |
| filterMax | 0 | Yes | Dedicated renderer / input path | 12 |
| autoStdDev | 1 | Yes | Dedicated renderer / input path | 1 |
| manualMinimumVolume | 0 | Yes | Dedicated renderer / input path | 2 |
| rthAutoStdDev | 1 | Yes | Dedicated renderer / input path | 1 |
| rthManualMinimumVolume | 0 | Yes | Dedicated renderer / input path | 1 |
| rthStartMinutes | 510 | Yes | Dedicated renderer / input path | 4 |
| rectangleLineWidth | 1 | Yes | Dedicated renderer / input path | 2 |
| backgroundOpacity | 22 | Yes | Dedicated renderer / input path | 9 |
| extensionLineWidth | 1 | Yes | Dedicated renderer / input path | 2 |
| maxBarsExtension | 0 | Yes | Dedicated renderer / input path | 3 |
| tickMarginBreakout | 0 | Not individually established | Dedicated renderer / input path | 1 |
| durationFontSize | 9 | Yes | Dedicated renderer / input path | 2 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| filterMode | "none" | Yes | Dedicated renderer / input path | 16 |
| rthFilterWindow | "disabled" | Yes | Dedicated renderer / input path | 1 |
| rthFilterMode | "none" | Yes | Dedicated renderer / input path | 2 |
| showRectangle | true | Yes | Dedicated renderer / input path | 4 |
| showBackground | true | Yes | Dedicated renderer / input path | 7 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| extendPoc | true | Yes | Dedicated renderer / input path | 2 |
| resetOnNewDay | false | Yes | Dedicated renderer / input path | 1 |
| removeOnShadowTouch | true | Yes | Dedicated renderer / input path | 2 |
| hideLineOnBreakout | false | Yes | Dedicated renderer / input path | 2 |
| showDuration | false | Yes | Dedicated renderer / input path | 3 |
| durationTextColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 3 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |

## Dynamic POC

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| periodValue | 20 | Yes | Dedicated renderer / input path | 3 |
| firstEnvelope | 1 | Yes | Dedicated renderer / input path | 1 |
| secondEnvelope | 2 | Yes | Dedicated renderer / input path | 1 |
| thirdEnvelope | 3 | Yes | Dedicated renderer / input path | 1 |
| lineWidth | 2 | Yes | Dedicated renderer / input path | 142 |
| envelopeLineWidth | 1 | Yes | Dedicated renderer / input path | 2 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| periodMode | "bars" | Yes | Dedicated renderer / input path | 9 |
| envelopeMode | "standard-deviation" | Yes | Dedicated renderer / input path | 2 |
| showPoc | true | Yes | Dedicated renderer / input path | 13 |
| showFirstEnvelope | true | Yes | Dedicated renderer / input path | 2 |
| showSecondEnvelope | true | Yes | Dedicated renderer / input path | 2 |
| showThirdEnvelope | true | Yes | Dedicated renderer / input path | 2 |
| pocColor | "#22D3EE" | Yes | Dedicated renderer / input path | 21 |
| firstEnvelopeColor | "#A3E635" | Yes | Dedicated renderer / input path | 3 |
| secondEnvelopeColor | "#F59E0B" | Yes | Dedicated renderer / input path | 3 |
| thirdEnvelopeColor | "#EF4444" | Yes | Dedicated renderer / input path | 3 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |

## Speed of Tape

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| database | "volume" | Yes | Dedicated renderer / input path | 17 |
| filterMin | 1 | Yes | Dedicated renderer / input path | 12 |
| filterMax | 0 | Yes | Dedicated renderer / input path | 12 |
| numberSeconds | 10 | Yes | Dedicated renderer / input path | 2 |
| standardDeviationPerFilter | 0 | Yes | Dedicated renderer / input path | 1 |
| paneHeight | 190 | Yes | Dedicated renderer / input path | 11 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| bullBorderColor | "#22C55E" | Yes | Dedicated renderer / input path | 1 |
| bullFillColor | "#22C55E" | Yes | Dedicated renderer / input path | 1 |
| bearBorderColor | "#EF4444" | Yes | Dedicated renderer / input path | 1 |
| bearFillColor | "#EF4444" | Yes | Dedicated renderer / input path | 1 |
| speedOfTapeSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 1 |

## Speed of Tape (Instant)

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| filterMin | 1 | Yes | Dedicated renderer / input path | 12 |
| filterMax | 0 | Yes | Dedicated renderer / input path | 12 |
| numberOfSeconds | 10 | Yes | Dedicated renderer / input path | 2 |
| barsToShow | 3 | Yes | Dedicated renderer / input path | 1 |
| scaleMinValue | 0 | Yes | Dedicated renderer / input path | 2 |
| lineWidth | 1 | Yes | Dedicated renderer / input path | 142 |
| textSize | 10 | Yes | Dedicated renderer / input path | 11 |
| standardDeviationLookback | 60 | Yes | Dedicated renderer / input path | 1 |
| settingsVersion | 2 | Not individually established | Dedicated renderer / input path | 1 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| displayValue | "total" | Yes | Dedicated renderer / input path | 3 |
| plotReversed | false | Yes | Dedicated renderer / input path | 1 |
| showStandardDeviations | true | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| positiveBorderColor | "#22C55E" | Yes | Dedicated renderer / input path | 3 |
| positiveFillColor | "#22C55E" | Yes | Dedicated renderer / input path | 3 |
| negativeBorderColor | "#EF4444" | Yes | Dedicated renderer / input path | 3 |
| negativeFillColor | "#EF4444" | Yes | Dedicated renderer / input path | 3 |
| textEnabled | true | Yes | Dedicated renderer / input path | 2 |
| textColor | "#F8FAFC" | Yes | Dedicated renderer / input path | 58 |

## Volume/Delta Sprint

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| filterMin | 0 | Yes | output-effect-observed | 12 |
| filterMax | 0 | Yes | output-effect-observed | 12 |
| length | 10 | Yes | output-effect-observed | 679 |
| deltaColorMode | "fading" | Yes | Dedicated renderer / input path | 1 |
| smoothingEnabled | false | Yes | output-effect-observed | 1 |
| smoothingType | "simple" | Yes | Dedicated renderer / input path | 1 |
| smoothingLength | 3 | Yes | output-effect-observed | 1 |
| showDelta | true | Yes | output-effect-observed | 5 |
| showBid | false | Yes | output-effect-observed | 2 |
| showAsk | false | Yes | output-effect-observed | 2 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| positiveColor | "#22C55E" | Yes | output-effect-observed | 19 |
| negativeColor | "#EF4444" | Yes | output-effect-observed | 21 |
| bidColor | "#EF4444" | Not individually established | output-effect-observed | 24 |
| askColor | "#22C55E" | Not individually established | output-effect-observed | 25 |
| lineWidth | 3 | Yes | output-effect-observed | 142 |
| shortName | "Volume/Delta Sprint" | Yes | Dedicated renderer / input path | 10 |

## Tape Speed & Order-Flow Burst

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| rollingWindowMs | 1000 | Yes | Dedicated renderer / input path | 2 |
| updateStepMs | 100 | Yes | Dedicated renderer / input path | 1 |
| fixedBucketMs | 1000 | Yes | Dedicated renderer / input path | 1 |
| maximumInterTradeGapMs | 75 | Yes | Dedicated renderer / input path | 3 |
| maximumEventDurationMs | 2000 | Yes | Dedicated renderer / input path | 1 |
| baselineWindowMs | 120000 | Yes | Dedicated renderer / input path | 4 |
| minimumBaselineSamples | 30 | Yes | Dedicated renderer / input path | 4 |
| selectedPercentile | 0.9 | Yes | Dedicated renderer / input path | 3 |
| relativeSpeedMultiplier | 2 | Yes | Dedicated renderer / input path | 1 |
| relativeDeltaMultiplier | 2 | Yes | Dedicated renderer / input path | 1 |
| minimumContractsPerSecond | 100 | Yes | Dedicated renderer / input path | 3 |
| minimumTradesPerSecond | 5 | Yes | Dedicated renderer / input path | 2 |
| minimumAbsoluteDeltaPerSecond | 50 | Yes | Dedicated renderer / input path | 1 |
| minimumQuantity | 100 | Yes | Dedicated renderer / input path | 1 |
| minimumTradeCount | 3 | Yes | Dedicated renderer / input path | 5 |
| minimumDirectionalShare | 0.7 | Yes | Dedicated renderer / input path | 2 |
| minimumDirectionalDelta | 25 | Yes | Dedicated renderer / input path | 1 |
| minimumQualityScore | 60 | Yes | Dedicated renderer / input path | 1 |
| minimumMarkerScore | 70 | Yes | Dedicated renderer / input path | 2 |
| largeTradeThreshold | 100 | Yes | Dedicated renderer / input path | 1 |
| continuationWindowMs | 3000 | Yes | Dedicated renderer / input path | 2 |
| historySeconds | 3600 | Yes | Dedicated renderer / input path | 5 |
| paneHeight | 190 | Yes | Dedicated renderer / input path | 11 |
| markerSize | 7 | Yes | Dedicated renderer / input path | 22 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| preset | "balanced-futures" | Yes | Dedicated renderer / input path | 44 |
| windowMode | "rolling" | Yes | Dedicated renderer / input path | 1 |
| dynamicBaselineEnabled | true | Yes | Dedicated renderer / input path | 4 |
| baselineSampleLimit | 5000 | Not individually established | Dedicated renderer / input path | 5 |
| continuationTicks | 3 | Yes | Dedicated renderer / input path | 3 |
| rejectionTicks | 3 | Yes | Dedicated renderer / input path | 3 |
| maximumBuckets | 5000 | Yes | Dedicated renderer / input path | 3 |
| maximumEvents | 2000 | Yes | Dedicated renderer / input path | 3 |
| staleAfterMs | 5000 | Not individually established | Dedicated renderer / input path | 5 |
| showPane | true | Yes | Dedicated renderer / input path | 2 |
| paneMode | "contracts-per-second" | Yes | Dedicated renderer / input path | 2 |
| showBuySpeed | true | Yes | Dedicated renderer / input path | 1 |
| showSellSpeed | true | Yes | Dedicated renderer / input path | 1 |
| showTotalSpeed | true | Yes | Dedicated renderer / input path | 1 |
| showDeltaSpeed | false | Yes | Dedicated renderer / input path | 1 |
| showMarkers | true | Yes | Dedicated renderer / input path | 6 |
| showPriceTimeBands | true | Yes | Dedicated renderer / input path | 4 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| showTooltips | true | Yes | Dedicated renderer / input path | 7 |
| showActiveLane | false | Yes | Dedicated renderer / input path | 7 |
| alertsEnabled | false | Yes | Dedicated renderer / input path | 6 |
| alertMinimumScore | 80 | Not individually established | Dedicated renderer / input path | 6 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| buyColor | "#22D3A7" | Yes | Dedicated renderer / input path | 12 |
| sellColor | "#FF3B78" | Yes | Dedicated renderer / input path | 12 |
| totalColor | "#F8FAFC" | Yes | Dedicated renderer / input path | 2 |
| neutralColor | "#94A3B8" | Yes | Dedicated renderer / input path | 33 |
| warningColor | "#F59E0B" | Yes | Dedicated renderer / input path | 6 |

## Big Contracts

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| daysToLoad | 1 | Yes | Dedicated renderer / input path | 7 |
| manualFilter | 30 | Yes | Dedicated renderer / input path | 1 |
| maximumFilter | 0 | Yes | Dedicated renderer / input path | 1 |
| rthManualFilter | 30 | Yes | Dedicated renderer / input path | 1 |
| rthStandardDeviation | 1 | Yes | Dedicated renderer / input path | 1 |
| cappingMaxVolume | 0 | Yes | Dedicated renderer / input path | 1 |
| clusterWindowMs | 100 | Yes | Dedicated renderer / input path | 2 |
| clusterPriceTicks | 0 | Yes | Dedicated renderer / input path | 1 |
| maxMarkersPerBar | 50 | Yes | Dedicated renderer / input path | 1 |
| standardDeviation | 1 | Yes | Dedicated renderer / input path | 16 |
| minimumOpacity | 25 | Yes | Dedicated renderer / input path | 9 |
| maximumOpacity | 90 | Yes | Dedicated renderer / input path | 9 |
| minimumSize | 6 | Yes | Dedicated renderer / input path | 5 |
| maximumSize | 32 | Yes | Dedicated renderer / input path | 2 |
| labelMinSize | 1 | Yes | Dedicated renderer / input path | 2 |
| deepMinimumTradeSize | 30 | Yes | Dedicated renderer / input path | 1 |
| deepBoxTickRange | 4 | Yes | Dedicated renderer / input path | 1 |
| deepTickMargin | 1 | Yes | Dedicated renderer / input path | 1 |
| deepProjectionBars | 22 | Yes | Dedicated renderer / input path | 1 |
| deepOpacity | 20 | Yes | Dedicated renderer / input path | 1 |
| deepLineWidth | 1 | Yes | Dedicated renderer / input path | 1 |
| showBigContracts | true | Yes | Dedicated renderer / input path | 1 |
| showDeepContracts | false | Yes | Dedicated renderer / input path | 1 |
| filterMode | "manual" | Not individually established | Dedicated renderer / input path | 16 |
| automaticIntensity | "medium" | Not individually established | Dedicated renderer / input path | 1 |
| enableClustering | true | Yes | Dedicated renderer / input path | 1 |
| combineByCandle | false | Yes | Dedicated renderer / input path | 1 |
| adaptiveTimeframeFilter | false | Yes | Dedicated renderer / input path | 1 |
| sessionFilterEnabled | true | Yes | Dedicated renderer / input path | 1 |
| rthFilterMode | "manual" | Not individually established | Dedicated renderer / input path | 2 |
| rthAutomaticIntensity | "medium" | Not individually established | Dedicated renderer / input path | 1 |
| cappingMode | "off" | Yes | Dedicated renderer / input path | 1 |
| markerType | "circle" | Not individually established | Dedicated renderer / input path | 2 |
| hollowFill | false | Yes | Dedicated renderer / input path | 2 |
| informationMode | "volume" | Not individually established | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| enableAlertSound | false | Yes | Dedicated renderer / input path | 2 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| showProjection | false | Yes | Dedicated renderer / input path | 2 |
| projectionLineWidth | 1 | Not individually established | Dedicated renderer / input path | 2 |
| projectionLineStyle | "dashed" | Not individually established | Dedicated renderer / input path | 2 |
| projectionOpacity | 55 | Not individually established | Dedicated renderer / input path | 2 |
| deepShowProjection | true | Yes | Dedicated renderer / input path | 1 |
| deepExtendTillCloseCross | true | Yes | Dedicated renderer / input path | 1 |
| bigTradesSettingsVersion | 6 | Not individually established | Dedicated renderer / input path | 0 |

## Ratio Highlight

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| minRatio | 10 | Yes | Dedicated renderer / input path | 1 |
| maxRatio | 20 | Yes | Dedicated renderer / input path | 3 |
| opacity | 70 | Yes | Dedicated renderer / input path | 167 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| ratioMode | "bar" | Yes | Dedicated renderer / input path | 1 |
| bidColor | "#D5006D" | Yes | Dedicated renderer / input path | 24 |
| askColor | "#007C7A" | Yes | Dedicated renderer / input path | 25 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |

## Stop Spotter

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| minimumDeltaPercent | 25 | Yes | Dedicated renderer / input path | 4 |
| minimumVolume | 1500 | Yes | Dedicated renderer / input path | 2 |
| minimumVolumeIncrease | 500 | Yes | Dedicated renderer / input path | 1 |
| minimumBodyTicks | 6 | Yes | Dedicated renderer / input path | 1 |
| minimumPriceTicksIncrease | 1 | Yes | Dedicated renderer / input path | 1 |
| minimumHorizontalDelta | 60 | Yes | Dedicated renderer / input path | 1 |
| minimumImbalancePercent | 200 | Yes | Dedicated renderer / input path | 5 |
| minimumImbalanceCount | 2 | Yes | Dedicated renderer / input path | 1 |
| secondsToClose | 15 | Yes | Dedicated renderer / input path | 1 |
| maximumLoss | 500 | Yes | Dedicated renderer / input path | 1 |
| tickValueDivider | 1 | Yes | Dedicated renderer / input path | 1 |
| contractFontSize | 10 | Yes | Dedicated renderer / input path | 2 |
| contractTickOffset | 2 | Yes | Dedicated renderer / input path | 1 |
| lineWidth | 2 | Yes | Dedicated renderer / input path | 142 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| calculationMode | "close" | Yes | Dedicated renderer / input path | 3 |
| plotPrice | "price-slope" | Yes | Dedicated renderer / input path | 3 |
| contractCalculationEnabled | false | Yes | Dedicated renderer / input path | 1 |
| contractBackgroundColor | "#111827" | Yes | Dedicated renderer / input path | 3 |
| contractBuyTextColor | "#22C55E" | Yes | Dedicated renderer / input path | 3 |
| contractSellTextColor | "#EF4444" | Yes | Dedicated renderer / input path | 3 |
| alertSoundEnabled | false | Yes | Dedicated renderer / input path | 8 |
| alertTone | "chime" | Yes | Dedicated renderer / input path | 5 |
| messagePopupEnabled | false | Yes | Dedicated renderer / input path | 8 |
| messageText | "Stop Run" | Yes | Dedicated renderer / input path | 7 |
| buyColor | "#6EE7B7" | Yes | Dedicated renderer / input path | 12 |
| sellColor | "#FCA5A5" | Yes | Dedicated renderer / input path | 12 |
| markerStyle | "square" | Yes | Dedicated renderer / input path | 3 |
| autoColor | "none" | Yes | Dedicated renderer / input path | 4 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| shortName | "Stop Run" | Yes | Dedicated renderer / input path | 10 |
| showNameLabel | true | Yes | Dedicated renderer / input path | 2 |
| showValueLabel | false | Yes | Dedicated renderer / input path | 3 |
| nameBackground | false | Yes | Dedicated renderer / input path | 8 |
| valueBackground | false | Yes | Dedicated renderer / input path | 8 |
| chartColorForMarker | false | Yes | Dedicated renderer / input path | 6 |
| includeOnAutoCenter | true | Yes | Dedicated renderer / input path | 3 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |

## Auction Gap Tracker

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| minimumTickVolume | 0 | Yes | Dedicated renderer / input path | 2 |
| maximumOppositeVolume | 0 | Yes | Dedicated renderer / input path | 2 |
| includeMode | "intrabar" | Yes | Dedicated renderer / input path | 3 |
| minimumConsecutiveLevels | 3 | Yes | Dedicated renderer / input path | 2 |
| plotMode | "zones" | Yes | Dedicated renderer / input path | 5 |
| markerPlacement | "bar-direction" | Not individually established | Dedicated renderer / input path | 3 |
| extendedBars | 200 | Yes | Dedicated renderer / input path | 7 |
| lineWidth | 1 | Yes | Dedicated renderer / input path | 142 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| markerSize | 6 | Yes | Dedicated renderer / input path | 22 |
| resetMode | "none" | Yes | Dedicated renderer / input path | 7 |
| filterTime | "none" | Yes | Dedicated renderer / input path | 16 |
| customStartMinutes | 0 | Not individually established | Dedicated renderer / input path | 12 |
| customEndMinutes | 0 | Not individually established | Dedicated renderer / input path | 12 |
| retestMode | "touch" | Yes | Dedicated renderer / input path | 6 |
| showTriggered | true | Yes | Dedicated renderer / input path | 7 |
| onlyTriggered | false | Yes | Dedicated renderer / input path | 6 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| buyColor | "#22c55e" | Yes | Dedicated renderer / input path | 12 |
| sellColor | "#ef4444" | Yes | Dedicated renderer / input path | 12 |
| buyTriggeredColor | "#22c55e" | Yes | Dedicated renderer / input path | 2 |
| sellTriggeredColor | "#ef4444" | Yes | Dedicated renderer / input path | 2 |
| alertSoundEnabled | false | Yes | Dedicated renderer / input path | 8 |
| messagePopupEnabled | false | Yes | Dedicated renderer / input path | 8 |
| alertName | "Auction Gap" | Yes | Dedicated renderer / input path | 8 |
| alertMessage | "Auction gap detected" | Yes | Dedicated renderer / input path | 3 |

## Session Imbalance

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| numberOfMinutes | 60 | Yes | Dedicated renderer / input path | 1 |
| numberOfDays | 0 | Yes | Dedicated renderer / input path | 1 |
| lineOpacity | 100 | Yes | Dedicated renderer / input path | 5 |
| lineWidth | 1 | Yes | Dedicated renderer / input path | 142 |
| textSize | 10 | Yes | Dedicated renderer / input path | 11 |
| useCustomStartTime | false | Yes | Dedicated renderer / input path | 1 |
| customStartTime | "17:00" | Not individually established | Dedicated renderer / input path | 3 |
| plotOnceEnded | false | Yes | Dedicated renderer / input path | 1 |
| showHigh | true | Yes | Dedicated renderer / input path | 1 |
| showLow | true | Yes | Dedicated renderer / input path | 1 |
| showMid | true | Yes | Dedicated renderer / input path | 1 |
| level50Enabled | true | Yes | Dedicated renderer / input path | 1 |
| level100Enabled | true | Yes | Dedicated renderer / input path | 1 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| highColor | "#22C55E" | Yes | Dedicated renderer / input path | 7 |
| lowColor | "#EF4444" | Yes | Dedicated renderer / input path | 7 |
| midColor | "#38BDF8" | Yes | Dedicated renderer / input path | 6 |
| level50Color | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| level100Color | "#A78BFA" | Yes | Dedicated renderer / input path | 2 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| textAlignment | "right" | Yes | Dedicated renderer / input path | 2 |
| extendMode | "next-session" | Yes | Dedicated renderer / input path | 1 |
| hhllEnableAlertPopup | false | Yes | Dedicated renderer / input path | 1 |
| hhllEnableAlertSound | false | Yes | Dedicated renderer / input path | 1 |
| level50EnableAlertPopup | false | Yes | Dedicated renderer / input path | 1 |
| level50EnableAlertSound | false | Yes | Dedicated renderer / input path | 1 |
| level100EnableAlertPopup | false | Yes | Dedicated renderer / input path | 1 |
| level100EnableAlertSound | false | Yes | Dedicated renderer / input path | 1 |
| sessionImbalanceSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 1 |

## Absorption Detector

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| windowMs | 1000 | Yes | Dedicated renderer / input path | 11 |
| rollingStepMs | 100 | Yes | Dedicated renderer / input path | 1 |
| mergeGapMs | 100 | Yes | Dedicated renderer / input path | 1 |
| maximumCandidateDurationMs | 3000 | Yes | Dedicated renderer / input path | 2 |
| confirmationWindowMs | 2000 | Yes | Dedicated renderer / input path | 1 |
| minimumContracts | 100 | Yes | Dedicated renderer / input path | 2 |
| minimumTradeCount | 3 | Yes | Dedicated renderer / input path | 5 |
| minimumDirectionalShare | 0.7 | Yes | Dedicated renderer / input path | 2 |
| maximumPenetrationTicks | 2 | Yes | Dedicated renderer / input path | 2 |
| minimumAggressionPerTick | 50 | Yes | Dedicated renderer / input path | 1 |
| minimumDevelopingScore | 45 | Yes | Dedicated renderer / input path | 1 |
| minimumConfirmedScore | 70 | Yes | Dedicated renderer / input path | 1 |
| baselineWindowSeconds | 60 | Yes | Dedicated renderer / input path | 1 |
| baselineSampleLimit | 4000 | Yes | Dedicated renderer / input path | 5 |
| baselineMinimumSamples | 30 | Yes | Dedicated renderer / input path | 1 |
| baselineMedianMultiplier | 3 | Yes | Dedicated renderer / input path | 1 |
| minimumResponseTicks | 2 | Yes | Dedicated renderer / input path | 2 |
| minimumPersistenceMs | 250 | Yes | Dedicated renderer / input path | 1 |
| minimumReplenishmentRatio | 0.2 | Yes | Dedicated renderer / input path | 2 |
| zoneMergeWindowMs | 750 | Yes | Dedicated renderer / input path | 2 |
| zoneMaximumGapTicks | 1 | Yes | Dedicated renderer / input path | 1 |
| retestMinimumDepartureTicks | 3 | Yes | Dedicated renderer / input path | 1 |
| retestTouchToleranceTicks | 1 | Yes | Dedicated renderer / input path | 1 |
| breakToleranceTicks | 1 | Yes | Dedicated renderer / input path | 2 |
| minimumBreakVolume | 50 | Yes | Dedicated renderer / input path | 2 |
| minimumBreakTimeMs | 250 | Yes | Dedicated renderer / input path | 2 |
| replenishmentWindowMs | 1000 | Yes | Dedicated renderer / input path | 1 |
| replenishmentMinimumContracts | 25 | Yes | Dedicated renderer / input path | 1 |
| replenishmentMinimumRatio | 0.2 | Yes | Dedicated renderer / input path | 1 |
| replenishmentMinimumRefreshCount | 2 | Yes | Dedicated renderer / input path | 1 |
| activeProfileWidth | 120 | Yes | Dedicated renderer / input path | 4 |
| lowerPaneHeight | 160 | Yes | Dedicated renderer / input path | 4 |
| markerSize | 7 | Yes | Dedicated renderer / input path | 22 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| historySeconds | 3600 | Yes | Dedicated renderer / input path | 5 |
| maximumEvents | 2500 | Yes | Dedicated renderer / input path | 3 |
| version | 1 | Not individually established | Dedicated renderer / input path | 88 |
| preset | "balanced-level3" | Yes | Dedicated renderer / input path | 44 |
| useTradeStream | true | Yes | Dedicated renderer / input path | 1 |
| useLevel3Context | true | Yes | Dedicated renderer / input path | 1 |
| useFootprintAggregation | true | Yes | Dedicated renderer / input path | 1 |
| usePullingStackingContext | true | Yes | Dedicated renderer / input path | 1 |
| includeOwnOrders | false | Yes | Dedicated renderer / input path | 2 |
| includeImpliedOrders | false | Yes | Dedicated renderer / input path | 2 |
| preferSourceSide | true | Yes | Dedicated renderer / input path | 1 |
| useBboFallback | true | Yes | Dedicated renderer / input path | 1 |
| includeUnknownTrades | false | Yes | Dedicated renderer / input path | 3 |
| maximumBboAgeMs | 250 | Not individually established | Dedicated renderer / input path | 2 |
| aggregationMode | "rolling" | Yes | Dedicated renderer / input path | 7 |
| finalizationGraceMs | 250 | Not individually established | Dedicated renderer / input path | 1 |
| minimumContractsPerSecond | 0 | Not individually established | Dedicated renderer / input path | 3 |
| minimumTradesPerSecond | 0 | Not individually established | Dedicated renderer / input path | 2 |
| minimumDurationMs | 50 | Not individually established | Dedicated renderer / input path | 1 |
| minimumLargestTrade | 0 | Not individually established | Dedicated renderer / input path | 1 |
| minimumExecutedToVisible | 0 | Not individually established | Dedicated renderer / input path | 1 |
| minimumRepeatCount | 0 | Not individually established | Dedicated renderer / input path | 1 |
| dynamicBaselineEnabled | true | Yes | Dedicated renderer / input path | 4 |
| baselinePercentile | 0.9 | Not individually established | Dedicated renderer / input path | 3 |
| baselineWarmupMs | 20000 | Not individually established | Dedicated renderer / input path | 3 |
| confirmationMode | "combined-score" | Yes | Dedicated renderer / input path | 1 |
| maximumResponseTimeMs | 2000 | Not individually established | Dedicated renderer / input path | 1 |
| minimumDepthRetention | 0 | Not individually established | Dedicated renderer / input path | 1 |
| confirmationMinimumExecutedToVisible | 0 | Not individually established | Dedicated renderer / input path | 1 |
| sizeWeight | 0.16 | Not individually established | Dedicated renderer / input path | 1 |
| relativeSizeWeight | 0.12 | Not individually established | Dedicated renderer / input path | 1 |
| aggressionPerTickWeight | 0.15 | Not individually established | Dedicated renderer / input path | 1 |
| lowProgressWeight | 0.18 | Not individually established | Dedicated renderer / input path | 1 |
| directionalShareWeight | 0.08 | Not individually established | Dedicated renderer / input path | 1 |
| replenishmentWeight | 0.1 | Yes | Dedicated renderer / input path | 1 |
| depthRetentionWeight | 0.05 | Not individually established | Dedicated renderer / input path | 1 |
| executedToVisibleWeight | 0.05 | Not individually established | Dedicated renderer / input path | 1 |
| persistenceWeight | 0.04 | Not individually established | Dedicated renderer / input path | 4 |
| responseWeight | 0.05 | Not individually established | Dedicated renderer / input path | 1 |
| repeatWeight | 0.02 | Not individually established | Dedicated renderer / input path | 1 |
| renormalizeDisabledComponents | true | Yes | Dedicated renderer / input path | 1 |
| zoneMergeEnabled | true | Yes | Dedicated renderer / input path | 2 |
| maximumZoneLevels | 8 | Not individually established | Dedicated renderer / input path | 1 |
| zoneExtensionMode | "until-broken" | Yes | Dedicated renderer / input path | 2 |
| fixedExtensionMs | 60000 | Not individually established | Dedicated renderer / input path | 1 |
| retainBrokenZones | true | Yes | Dedicated renderer / input path | 1 |
| maximumActiveZones | 100 | Not individually established | Dedicated renderer / input path | 1 |
| retestEnabled | true | Yes | Dedicated renderer / input path | 2 |
| retestWindowMs | 3600000 | Not individually established | Dedicated renderer / input path | 1 |
| maximumRetests | 2 | Not individually established | Dedicated renderer / input path | 1 |
| retestMinimumResponseTicks | 2 | Not individually established | Dedicated renderer / input path | 1 |
| breakMode | "combined" | Yes | Dedicated renderer / input path | 1 |
| minimumBreakCloses | 1 | Not individually established | Dedicated renderer / input path | 2 |
| keepBrokenHistory | true | Yes | Dedicated renderer / input path | 1 |
| replenishmentEnabled | true | Yes | Dedicated renderer / input path | 1 |
| replenishmentSamePriceRequired | true | Yes | Dedicated renderer / input path | 1 |
| requireReplenishmentForConfirmation | false | Yes | Dedicated renderer / input path | 1 |
| renderMode | "hybrid" | Yes | Dedicated renderer / input path | 5 |
| showHeader | true | Yes | Dedicated renderer / input path | 10 |
| showDeveloping | true | Yes | Dedicated renderer / input path | 2 |
| showConfirmed | true | Yes | Dedicated renderer / input path | 2 |
| showRetests | true | Yes | Dedicated renderer / input path | 1 |
| showBroken | true | Yes | Dedicated renderer / input path | 2 |
| showExpired | false | Yes | Dedicated renderer / input path | 1 |
| showCells | true | Yes | Dedicated renderer / input path | 2 |
| showZones | true | Yes | Dedicated renderer / input path | 8 |
| showEventMarkers | true | Yes | Dedicated renderer / input path | 4 |
| showActiveProfile | true | Yes | Dedicated renderer / input path | 4 |
| showLowerPane | false | Yes | Dedicated renderer / input path | 9 |
| activeProfileMaximumZones | 12 | Not individually established | Dedicated renderer / input path | 2 |
| zoneBorderWidth | 1 | Not individually established | Dedicated renderer / input path | 2 |
| includeInChartAutoscale | false | Yes | Dedicated renderer / input path | 1 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| bidDevelopingColor | "#22C55E" | Yes | Dedicated renderer / input path | 3 |
| bidConfirmedColor | "#22C55E" | Yes | Dedicated renderer / input path | 3 |
| askDevelopingColor | "#EF4444" | Yes | Dedicated renderer / input path | 3 |
| askConfirmedColor | "#EF4444" | Yes | Dedicated renderer / input path | 3 |
| retestColor | "#F59E0B" | Yes | Dedicated renderer / input path | 3 |
| brokenColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 7 |
| replenishmentColor | "#38BDF8" | Yes | Dedicated renderer / input path | 2 |
| neutralColor | "#71717A" | Yes | Dedicated renderer / input path | 33 |
| showQuantity | true | Yes | Dedicated renderer / input path | 2 |
| showScore | true | Yes | Dedicated renderer / input path | 2 |
| showTradeCount | true | Yes | Dedicated renderer / input path | 2 |
| showAggressionPerTick | true | Yes | Dedicated renderer / input path | 2 |
| showReplenishment | true | Yes | Dedicated renderer / input path | 2 |
| showRepeatCount | true | Yes | Dedicated renderer / input path | 2 |
| showTooltips | true | Yes | Dedicated renderer / input path | 7 |
| enableAlerts | false | Yes | Dedicated renderer / input path | 6 |
| alertMinimumScore | 75 | Not individually established | Dedicated renderer / input path | 6 |
| alertCooldownMs | 10000 | Not individually established | Dedicated renderer / input path | 3 |
| maximumZones | 500 | Not individually established | Dedicated renderer / input path | 2 |
| staleTradeAfterMs | 5000 | Not individually established | Dedicated renderer / input path | 1 |
| staleLevel3AfterMs | 5000 | Not individually established | Dedicated renderer / input path | 1 |
| postSnapshotWarmupMs | 3000 | Not individually established | Dedicated renderer / input path | 3 |

## Stacked Imbalance Suite

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| customOffsetGroups | 1 | Yes | Dedicated renderer / input path | 1 |
| ratioThreshold | 3 | Yes | Dedicated renderer / input path | 1 |
| minimumAbsoluteDifference | 100 | Yes | Dedicated renderer / input path | 1 |
| minimumDominanceShare | 0.75 | Yes | Dedicated renderer / input path | 1 |
| minimumNumeratorVolume | 50 | Yes | Dedicated renderer / input path | 1 |
| minimumCombinedVolume | 75 | Yes | Dedicated renderer / input path | 1 |
| minimumStackedLevels | 3 | Yes | Dedicated renderer / input path | 1 |
| maximumGapGroups | 0 | Yes | Dedicated renderer / input path | 1 |
| minimumStackedTotalNumerator | 150 | Yes | Dedicated renderer / input path | 1 |
| minimumStackedScore | 65 | Yes | Dedicated renderer / input path | 1 |
| rollingBars | 5 | Yes | Dedicated renderer / input path | 2 |
| minimumDepartureGroups | 2 | Yes | Dedicated renderer / input path | 1 |
| minimumResponseGroups | 2 | Yes | Dedicated renderer / input path | 1 |
| maximumRetestsPerZone | 3 | Yes | Dedicated renderer / input path | 1 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| markerSize | 6 | Yes | Dedicated renderer / input path | 22 |
| activeLaneWidth | 96 | Yes | Dedicated renderer / input path | 6 |
| alertMinimumScore | 65 | Yes | Dedicated renderer / input path | 6 |
| version | 1 | Not individually established | Dedicated renderer / input path | 88 |
| enabledSides | "both" | Yes | Dedicated renderer / input path | 1 |
| comparisonMode | "diagonal" | Yes | Dedicated renderer / input path | 4 |
| qualificationMode | "ratio" | Yes | Dedicated renderer / input path | 1 |
| ratioFullScore | 6 | Not individually established | Dedicated renderer / input path | 1 |
| minimumDenominatorVolume | 0 | Not individually established | Dedicated renderer / input path | 1 |
| minimumNumeratorTradeCount | 1 | Not individually established | Dedicated renderer / input path | 1 |
| minimumCombinedTradeCount | 1 | Not individually established | Dedicated renderer / input path | 1 |
| minimumZeroSideVolume | 25 | Not individually established | Dedicated renderer / input path | 1 |
| minimumZeroSideTradeCount | 1 | Not individually established | Dedicated renderer / input path | 1 |
| includeZeroSide | true | Yes | Dedicated renderer / input path | 1 |
| scopeMode | "bar" | Yes | Dedicated renderer / input path | 2 |
| liveBarMode | "live" | Yes | Dedicated renderer / input path | 1 |
| createZones | true | Yes | Dedicated renderer / input path | 2 |
| showIndividualCells | true | Yes | Dedicated renderer / input path | 2 |
| showStackBrackets | true | Yes | Dedicated renderer / input path | 2 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| showActiveLane | true | Yes | Dedicated renderer / input path | 7 |
| showSessionProfile | false | Yes | Dedicated renderer / input path | 2 |
| showLowerPane | false | Yes | Dedicated renderer / input path | 9 |
| zoneExtensionMode | "until-broken" | Yes | Dedicated renderer / input path | 2 |
| zoneExtensionBars | 40 | Not individually established | Dedicated renderer / input path | 1 |
| minimumBreakCloses | 1 | Not individually established | Dedicated renderer / input path | 2 |
| askColor | "#22D3A7" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#FF3B78" | Yes | Dedicated renderer / input path | 24 |
| brokenColor | "#71717A" | Yes | Dedicated renderer / input path | 7 |
| neutralColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 33 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| enableAlerts | false | Yes | Dedicated renderer / input path | 6 |
| alertOnLiveQualification | false | Yes | Dedicated renderer / input path | 1 |
| alertOnClosedBar | true | Yes | Dedicated renderer / input path | 1 |
| alertOnRetest | true | Yes | Dedicated renderer / input path | 2 |
| alertOnHeld | true | Yes | Dedicated renderer / input path | 2 |
| alertOnRejected | true | Yes | Dedicated renderer / input path | 2 |
| alertOnBroken | true | Yes | Dedicated renderer / input path | 3 |

## Iceberg / Refresh Detector

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| attributionWindowMs | 250 | Yes | Dedicated renderer / input path | 1 |
| minimumCycleExecution | 10 | Yes | Dedicated renderer / input path | 1 |
| minimumCycleReplenishment | 10 | Yes | Dedicated renderer / input path | 1 |
| minimumCycleReplenishmentRatio | 0.5 | Yes | Dedicated renderer / input path | 1 |
| activeMinimumExecuted | 100 | Yes | Dedicated renderer / input path | 1 |
| activeMinimumReplenished | 50 | Yes | Dedicated renderer / input path | 1 |
| minimumRefreshCycles | 2 | Yes | Dedicated renderer / input path | 1 |
| minimumReplenishmentRatio | 0.5 | Yes | Dedicated renderer / input path | 2 |
| minimumExecutionToDisplayRatio | 1.25 | Yes | Dedicated renderer / input path | 1 |
| minimumSuspectedCycles | 3 | Yes | Dedicated renderer / input path | 1 |
| minimumSuspectedExecuted | 200 | Yes | Dedicated renderer / input path | 1 |
| minimumSuspectedScore | 75 | Yes | Dedicated renderer / input path | 2 |
| minimumQuality | 45 | Yes | Dedicated renderer / input path | 4 |
| maximumPenetrationTicks | 1 | Yes | Dedicated renderer / input path | 2 |
| minimumPulledContracts | 50 | Yes | Dedicated renderer / input path | 1 |
| minimumPullRatio | 0.5 | Yes | Dedicated renderer / input path | 1 |
| historySeconds | 3600 | Yes | Dedicated renderer / input path | 5 |
| activeProfileWidth | 140 | Yes | Dedicated renderer / input path | 4 |
| markerSize | 8 | Yes | Dedicated renderer / input path | 22 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| alertMinimumScore | 75 | Yes | Dedicated renderer / input path | 6 |
| alertMinimumQuality | 45 | Yes | Dedicated renderer / input path | 3 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| preset | "balanced" | Yes | Dedicated renderer / input path | 44 |
| visualizationMode | "hybrid" | Yes | Dedicated renderer / input path | 7 |
| minimumWatchingExecuted | 25 | Not individually established | Dedicated renderer / input path | 1 |
| minimumWatchingReplenished | 10 | Not individually established | Dedicated renderer / input path | 1 |
| minimumSamePriceDurationMs | 100 | Not individually established | Dedicated renderer / input path | 1 |
| minimumSuspectedReplenishmentRatio | 0.65 | Not individually established | Dedicated renderer / input path | 1 |
| minimumSuspectedTurnover | 2 | Not individually established | Dedicated renderer / input path | 1 |
| maximumCandidateDurationMs | 300000 | Not individually established | Dedicated renderer / input path | 2 |
| excessReplenishmentTreatment | "ordinary-stack" | Yes | Dedicated renderer / input path | 1 |
| moveIntoLevelTreatment | "exclude" | Yes | Dedicated renderer / input path | 1 |
| requireExecutionBeforeRefresh | true | Yes | Dedicated renderer / input path | 1 |
| allowCancelThenRepostResearchMode | false | Yes | Dedicated renderer / input path | 1 |
| includeUnknownTrades | false | Yes | Dedicated renderer / input path | 3 |
| dynamicBaselineEnabled | true | Yes | Dedicated renderer / input path | 4 |
| baselineWindowMs | 120000 | Not individually established | Dedicated renderer / input path | 4 |
| baselineSampleLimit | 4000 | Not individually established | Dedicated renderer / input path | 5 |
| minimumBaselineSamples | 30 | Not individually established | Dedicated renderer / input path | 4 |
| relativeExecutedMultiplier | 3 | Not individually established | Dedicated renderer / input path | 1 |
| relativeReplenishedMultiplier | 3 | Not individually established | Dedicated renderer / input path | 1 |
| executedFullScoreThreshold | 300 | Not individually established | Dedicated renderer / input path | 1 |
| replenishedFullScoreThreshold | 300 | Not individually established | Dedicated renderer / input path | 1 |
| replenishmentRatioFullScore | 1 | Not individually established | Dedicated renderer / input path | 1 |
| turnoverFullScoreRatio | 3 | Not individually established | Dedicated renderer / input path | 1 |
| refreshCyclesFullScore | 4 | Not individually established | Dedicated renderer / input path | 1 |
| recoveryFullScoreRatio | 1 | Not individually established | Dedicated renderer / input path | 1 |
| persistenceFullScoreMs | 2000 | Not individually established | Dedicated renderer / input path | 1 |
| pullPenaltyWeight | 0.25 | Not individually established | Dedicated renderer / input path | 1 |
| exhaustionDetectionEnabled | true | Yes | Dedicated renderer / input path | 2 |
| exhaustionWindowMs | 1000 | Not individually established | Dedicated renderer / input path | 2 |
| maximumExhaustionReplenishmentRatio | 0.2 | Not individually established | Dedicated renderer / input path | 1 |
| minimumExhaustionExecuted | 50 | Not individually established | Dedicated renderer / input path | 1 |
| pulledStateEnabled | true | Yes | Dedicated renderer / input path | 1 |
| breakToleranceTicks | 1 | Not individually established | Dedicated renderer / input path | 2 |
| minimumBreakVolume | 50 | Not individually established | Dedicated renderer / input path | 2 |
| minimumBreakTimeMs | 250 | Not individually established | Dedicated renderer / input path | 2 |
| retestEnabled | true | Yes | Dedicated renderer / input path | 2 |
| minimumDepartureTicks | 3 | Not individually established | Dedicated renderer / input path | 1 |
| touchToleranceTicks | 1 | Not individually established | Dedicated renderer / input path | 2 |
| minimumResponseTicks | 2 | Not individually established | Dedicated renderer / input path | 2 |
| maximumRetestsPerCandidate | 3 | Not individually established | Dedicated renderer / input path | 1 |
| zoneMergeEnabled | true | Yes | Dedicated renderer / input path | 2 |
| zoneMergeWindowMs | 1000 | Not individually established | Dedicated renderer / input path | 2 |
| maximumZoneGapTicks | 1 | Not individually established | Dedicated renderer / input path | 1 |
| postSnapshotWarmupMs | 3000 | Not individually established | Dedicated renderer / input path | 3 |
| baselineWarmupMs | 20000 | Not individually established | Dedicated renderer / input path | 3 |
| staleAfterMs | 5000 | Not individually established | Dedicated renderer / input path | 5 |
| maximumCandidates | 1000 | Not individually established | Dedicated renderer / input path | 1 |
| maximumCycles | 5000 | Not individually established | Dedicated renderer / input path | 1 |
| showHeader | true | Yes | Dedicated renderer / input path | 10 |
| showCycleCells | true | Yes | Dedicated renderer / input path | 2 |
| showMarkers | true | Yes | Dedicated renderer / input path | 6 |
| showZones | true | Yes | Dedicated renderer / input path | 8 |
| showActiveProfile | true | Yes | Dedicated renderer / input path | 4 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| showTooltips | true | Yes | Dedicated renderer / input path | 7 |
| showLowerPane | false | Yes | Dedicated renderer / input path | 9 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| bidColor | "#22D3A7" | Yes | Dedicated renderer / input path | 24 |
| askColor | "#FF3B78" | Yes | Dedicated renderer / input path | 25 |
| nativeColor | "#A78BFA" | Yes | Dedicated renderer / input path | 2 |
| exhaustedColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| pulledColor | "#FB7185" | Yes | Dedicated renderer / input path | 2 |
| brokenColor | "#71717A" | Yes | Dedicated renderer / input path | 7 |
| neutralColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 33 |
| alertsEnabled | false | Yes | Dedicated renderer / input path | 6 |
| alertOnRefresh | false | Yes | Dedicated renderer / input path | 2 |
| alertOnSuspected | true | Yes | Dedicated renderer / input path | 2 |
| alertOnExhausted | true | Yes | Dedicated renderer / input path | 2 |
| alertOnPulled | true | Yes | Dedicated renderer / input path | 2 |
| alertOnBroken | true | Yes | Dedicated renderer / input path | 3 |

## Liquidity Sweep / Stop Sweep Detector

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| maximumInterTradeGapMs | 75 | Yes | Dedicated renderer / input path | 3 |
| maximumSweepDurationMs | 1000 | Yes | Dedicated renderer / input path | 1 |
| maximumBacktrackTicks | 1 | Yes | Dedicated renderer / input path | 1 |
| maximumInterTradeJumpTicks | 4 | Yes | Dedicated renderer / input path | 1 |
| minimumSweepContracts | 100 | Yes | Dedicated renderer / input path | 1 |
| minimumSweepTradeCount | 3 | Yes | Dedicated renderer / input path | 1 |
| minimumSweptLevels | 3 | Yes | Dedicated renderer / input path | 1 |
| minimumSweepRangeTicks | 2 | Yes | Dedicated renderer / input path | 1 |
| minimumContractsPerSecond | 100 | Yes | Dedicated renderer / input path | 3 |
| minimumContiguousCoverageRatio | 0.75 | Yes | Dedicated renderer / input path | 1 |
| minimumDirectionalProgressRatio | 0.6 | Yes | Dedicated renderer / input path | 1 |
| minimumReferenceBreachTicks | 1 | Yes | Dedicated renderer / input path | 1 |
| maximumReferenceDistanceTicks | 20 | Yes | Dedicated renderer / input path | 1 |
| minimumContinuationTicks | 3 | Yes | Dedicated renderer / input path | 1 |
| minimumRejectionTicks | 3 | Yes | Dedicated renderer / input path | 2 |
| historySeconds | 3600 | Yes | Dedicated renderer / input path | 5 |
| activeLaneWidth | 142 | Yes | Dedicated renderer / input path | 6 |
| minimumLaneScore | 60 | Yes | Dedicated renderer / input path | 2 |
| markerSize | 8 | Yes | Dedicated renderer / input path | 22 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| alertMinimumScore | 75 | Yes | Dedicated renderer / input path | 6 |
| alertMinimumQuality | 60 | Yes | Dedicated renderer / input path | 3 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| preset | "balanced-futures" | Yes | Dedicated renderer / input path | 44 |
| maximumOpposingQuantityInsideCandidate | 0 | Not individually established | Dedicated renderer / input path | 1 |
| minimumDirectionalAggressorShare | 0.85 | Not individually established | Dedicated renderer / input path | 1 |
| singleLevelBurstEnabled | false | Yes | Dedicated renderer / input path | 1 |
| maximumBurstLevels | 1 | Not individually established | Dedicated renderer / input path | 1 |
| minimumBurstContracts | 250 | Not individually established | Dedicated renderer / input path | 1 |
| minimumBurstTradeCount | 3 | Not individually established | Dedicated renderer / input path | 1 |
| minimumBurstContractsPerSecond | 250 | Not individually established | Dedicated renderer / input path | 1 |
| includeUnknownTrades | false | Yes | Dedicated renderer / input path | 3 |
| maximumBboAgeMs | 250 | Not individually established | Dedicated renderer / input path | 2 |
| dynamicBaselineEnabled | true | Yes | Dedicated renderer / input path | 4 |
| baselineWindowMs | 120000 | Not individually established | Dedicated renderer / input path | 4 |
| baselineSampleLimit | 5000 | Not individually established | Dedicated renderer / input path | 5 |
| minimumBaselineSamples | 30 | Not individually established | Dedicated renderer / input path | 4 |
| relativeQuantityMultiplier | 3 | Not individually established | Dedicated renderer / input path | 1 |
| relativeVelocityMultiplier | 2 | Not individually established | Dedicated renderer / input path | 1 |
| selectedPercentile | 0.9 | Not individually established | Dedicated renderer / input path | 3 |
| stopSweepInferenceEnabled | true | Yes | Dedicated renderer / input path | 1 |
| startSideToleranceTicks | 0 | Not individually established | Dedicated renderer / input path | 1 |
| minimumStopSweepContracts | 100 | Not individually established | Dedicated renderer / input path | 1 |
| minimumStopSweepLevels | 3 | Not individually established | Dedicated renderer / input path | 1 |
| minimumStopSweepVelocity | 100 | Not individually established | Dedicated renderer / input path | 1 |
| minimumStopSweepScore | 60 | Not individually established | Dedicated renderer / input path | 1 |
| maximumMatchedReferences | 3 | Not individually established | Dedicated renderer / input path | 1 |
| minimumAcceptanceTimeMs | 500 | Not individually established | Dedicated renderer / input path | 2 |
| continuationWindowMs | 5000 | Not individually established | Dedicated renderer / input path | 2 |
| rejectionWindowMs | 5000 | Not individually established | Dedicated renderer / input path | 1 |
| exhaustionDetectionEnabled | true | Yes | Dedicated renderer / input path | 2 |
| exhaustionWindowMs | 2000 | Not individually established | Dedicated renderer / input path | 2 |
| maximumPostSweepExtensionTicks | 1 | Not individually established | Dedicated renderer / input path | 1 |
| bookContextEnabled | true | Yes | Dedicated renderer / input path | 1 |
| bookContextLookbackMs | 500 | Not individually established | Dedicated renderer / input path | 1 |
| bookContextLookaheadMs | 100 | Not individually established | Dedicated renderer / input path | 1 |
| staleAfterMs | 5000 | Not individually established | Dedicated renderer / input path | 5 |
| maximumConfirmedSweeps | 2500 | Yes | Dedicated renderer / input path | 1 |
| visualizationMode | "hybrid" | Yes | Dedicated renderer / input path | 7 |
| showHeader | true | Yes | Dedicated renderer / input path | 10 |
| showRangeBrackets | true | Yes | Dedicated renderer / input path | 2 |
| showPriceTimeBands | true | Yes | Dedicated renderer / input path | 4 |
| showStopSweepZones | true | Yes | Dedicated renderer / input path | 2 |
| showMarkers | true | Yes | Dedicated renderer / input path | 6 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| showTooltips | true | Yes | Dedicated renderer / input path | 7 |
| showActiveLane | true | Yes | Dedicated renderer / input path | 7 |
| maximumActiveLaneRows | 12 | Not individually established | Dedicated renderer / input path | 4 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| buyColor | "#22D3A7" | Yes | Dedicated renderer / input path | 12 |
| sellColor | "#FF3B78" | Yes | Dedicated renderer / input path | 12 |
| warningColor | "#F59E0B" | Yes | Dedicated renderer / input path | 6 |
| rejectionColor | "#FB7185" | Yes | Dedicated renderer / input path | 3 |
| neutralColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 33 |
| alertsEnabled | false | Yes | Dedicated renderer / input path | 6 |

## POC & Auction Suite

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| customGroupSizeTicks | 1 | Yes | Dedicated renderer / input path | 1 |
| automaticTargetRows | 80 | Yes | Dedicated renderer / input path | 1 |
| percentageOfMaximum | 0.95 | Yes | Dedicated renderer / input path | 1 |
| topNContiguousGroups | 3 | Yes | Dedicated renderer / input path | 1 |
| minimumPocVolume | 1 | Yes | Dedicated renderer / input path | 1 |
| minimumPocTradeCount | 1 | Yes | Dedicated renderer / input path | 1 |
| rollingBars | 20 | Yes | Dedicated renderer / input path | 2 |
| minimumMigrationTicks | 1 | Yes | Dedicated renderer / input path | 1 |
| touchToleranceTicks | 0 | Yes | Dedicated renderer / input path | 2 |
| minimumAcceptanceVolume | 100 | Yes | Dedicated renderer / input path | 1 |
| minimumRejectionTicks | 4 | Yes | Dedicated renderer / input path | 2 |
| excessLookbackTicks | 4 | Yes | Dedicated renderer / input path | 1 |
| minimumTaperSteps | 2 | Yes | Dedicated renderer / input path | 1 |
| maximumTaperRatio | 0.75 | Yes | Dedicated renderer / input path | 1 |
| minimumExcessScore | 35 | Yes | Dedicated renderer / input path | 1 |
| activeLaneWidth | 150 | Yes | Dedicated renderer / input path | 6 |
| maximumActiveLaneRows | 14 | Yes | Dedicated renderer / input path | 4 |
| markerSize | 7 | Yes | Dedicated renderer / input path | 22 |
| lineWidth | 1.5 | Yes | Dedicated renderer / input path | 142 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| historyBars | 1500 | Yes | Dedicated renderer / input path | 1 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| preset | "balanced-auction" | Yes | Dedicated renderer / input path | 44 |
| groupingMode | "follow-footprint" | Yes | Dedicated renderer / input path | 13 |
| auctionExtremeSource | "raw-exchange-tick" | Yes | Dedicated renderer / input path | 1 |
| allowGroupedExtremeApproximation | false | Yes | Dedicated renderer / input path | 1 |
| metric | "total-volume" | Yes | Dedicated renderer / input path | 44 |
| tieBreakMode | "follow-shared-profile-engine" | Yes | Dedicated renderer / input path | 1 |
| pocBandMode | "single-price-group" | Yes | Dedicated renderer / input path | 1 |
| customBandTicks | 1 | Not individually established | Dedicated renderer / input path | 1 |
| showBarPoc | true | Yes | Dedicated renderer / input path | 1 |
| showSessionPoc | true | Yes | Dedicated renderer / input path | 1 |
| showPriorSessionPoc | true | Yes | Dedicated renderer / input path | 1 |
| showRollingPoc | false | Yes | Dedicated renderer / input path | 1 |
| showAnchoredPoc | false | Yes | Dedicated renderer / input path | 1 |
| showCompositePoc | false | Yes | Dedicated renderer / input path | 1 |
| rollingMode | "bars" | Not individually established | Dedicated renderer / input path | 1 |
| rollingDurationMs | 3600000 | Not individually established | Dedicated renderer / input path | 1 |
| anchorStartMs | 0 | Not individually established | Dedicated renderer / input path | 1 |
| anchorEndMs | 0 | Not individually established | Dedicated renderer / input path | 1 |
| anchorFollowLive | true | Yes | Dedicated renderer / input path | 1 |
| compositeStartMs | 0 | Not individually established | Dedicated renderer / input path | 1 |
| compositeEndMs | 0 | Not individually established | Dedicated renderer / input path | 1 |
| minimumNewPocDwellMs | 250 | Not individually established | Dedicated renderer / input path | 1 |
| minimumMetricLead | 1 | Not individually established | Dedicated renderer / input path | 1 |
| minimumMetricLeadPercent | 0 | Not individually established | Dedicated renderer / input path | 1 |
| nakedPocEnabled | true | Yes | Dedicated renderer / input path | 1 |
| minimumTouchVolume | 1 | Not individually established | Dedicated renderer / input path | 1 |
| minimumAcceptanceTimeMs | 2000 | Not individually established | Dedicated renderer / input path | 2 |
| responseWindowMs | 10000 | Not individually established | Dedicated renderer / input path | 1 |
| showFinishedHigh | true | Yes | Dedicated renderer / input path | 1 |
| showFinishedLow | true | Yes | Dedicated renderer / input path | 1 |
| showUnfinishedHigh | true | Yes | Dedicated renderer / input path | 1 |
| showUnfinishedLow | true | Yes | Dedicated renderer / input path | 1 |
| showZeroSide | true | Yes | Dedicated renderer / input path | 1 |
| developingAuctionVisuals | true | Yes | Dedicated renderer / input path | 1 |
| maximumOppositeExtremeVolume | 0 | Not individually established | Dedicated renderer / input path | 1 |
| minimumAggressiveExtremeVolume | 1 | Not individually established | Dedicated renderer / input path | 1 |
| minimumAggressiveExtremeTradeCount | 1 | Not individually established | Dedicated renderer / input path | 1 |
| maximumUnknownExtremeVolume | 0 | Not individually established | Dedicated renderer / input path | 1 |
| minimumOppositeUnfinishedVolume | 1 | Not individually established | Dedicated renderer / input path | 1 |
| minimumAggressiveUnfinishedVolume | 1 | Not individually established | Dedicated renderer / input path | 1 |
| minimumOppositeUnfinishedTrades | 1 | Not individually established | Dedicated renderer / input path | 1 |
| minimumAggressiveUnfinishedTrades | 1 | Not individually established | Dedicated renderer / input path | 1 |
| minimumTotalExtremeVolume | 1 | Not individually established | Dedicated renderer / input path | 1 |
| excessEnabled | true | Yes | Dedicated renderer / input path | 1 |
| requireFinishedExtremeForExcess | true | Yes | Dedicated renderer / input path | 1 |
| maximumExtremeVolumeRelativeToLocalMedian | 0.5 | Not individually established | Dedicated renderer / input path | 1 |
| minimumInteriorReferenceVolume | 10 | Not individually established | Dedicated renderer / input path | 1 |
| auctionTouchToleranceTicks | 0 | Not individually established | Dedicated renderer / input path | 1 |
| auctionResolutionMode | "first-touch" | Yes | Dedicated renderer / input path | 1 |
| minimumTradeThroughTicks | 1 | Not individually established | Dedicated renderer / input path | 1 |
| minimumResolutionVolume | 25 | Not individually established | Dedicated renderer / input path | 1 |
| showHeader | true | Yes | Dedicated renderer / input path | 10 |
| showBarPocMarkers | true | Yes | Dedicated renderer / input path | 2 |
| showDynamicPocLine | true | Yes | Dedicated renderer / input path | 2 |
| showExtendedLevels | true | Yes | Dedicated renderer / input path | 2 |
| showAuctionMarkers | true | Yes | Dedicated renderer / input path | 2 |
| showActiveLane | true | Yes | Dedicated renderer / input path | 7 |
| showLowerPane | false | Yes | Dedicated renderer / input path | 9 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| barPocColor | "#22D3EE" | Yes | Dedicated renderer / input path | 3 |
| sessionPocColor | "#A3E635" | Yes | Dedicated renderer / input path | 3 |
| nakedPocColor | "#F59E0B" | Yes | Dedicated renderer / input path | 3 |
| finishedColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 2 |
| unfinishedColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| excessHighColor | "#FB7185" | Yes | Dedicated renderer / input path | 3 |
| excessLowColor | "#22D3A7" | Yes | Dedicated renderer / input path | 3 |
| neutralColor | "#71717A" | Yes | Dedicated renderer / input path | 33 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| showTooltips | true | Yes | Dedicated renderer / input path | 7 |
| alertsEnabled | false | Yes | Dedicated renderer / input path | 6 |
| alertOnMigration | true | Yes | Dedicated renderer / input path | 1 |
| alertOnNewNakedPoc | true | Yes | Dedicated renderer / input path | 1 |
| alertOnAuctionClose | true | Yes | Dedicated renderer / input path | 1 |
| maximumActivePocs | 250 | Not individually established | Dedicated renderer / input path | 1 |
| maximumAuctionLevels | 500 | Yes | Dedicated renderer / input path | 1 |

## Cumulative Iceberg/Stop

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| filterMin | 1 | Yes | Dedicated renderer / input path | 12 |
| filterMax | 0 | Yes | Dedicated renderer / input path | 12 |
| displayParameter | 1 | Yes | Dedicated renderer / input path | 1 |
| lineWidth | 2 | Yes | Dedicated renderer / input path | 142 |
| alertStopThreshold | 100 | Yes | Dedicated renderer / input path | 2 |
| alertIcebergThreshold | 100 | Yes | Dedicated renderer / input path | 2 |
| paneHeight | 190 | Yes | Dedicated renderer / input path | 11 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| displayMode | "sum" | Yes | Dedicated renderer / input path | 9 |
| useSeparateAxes | true | Yes | Dedicated renderer / input path | 2 |
| showIceberg | true | Yes | Dedicated renderer / input path | 2 |
| showStop | true | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| icebergAskColor | "#EF4444" | Yes | Dedicated renderer / input path | 2 |
| icebergBidColor | "#22C55E" | Yes | Dedicated renderer / input path | 2 |
| stopBidColor | "#38BDF8" | Yes | Dedicated renderer / input path | 2 |
| stopAskColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| alertStopEnabled | false | Yes | Dedicated renderer / input path | 2 |
| alertStopShowMessage | true | Yes | Dedicated renderer / input path | 2 |
| alertIcebergEnabled | false | Yes | Dedicated renderer / input path | 2 |
| alertIcebergShowMessage | true | Yes | Dedicated renderer / input path | 2 |

## Book Speed

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| bidColor | "#22C55E" | Yes | Dedicated renderer / input path | 24 |
| askColor | "#A855F7" | Yes | Dedicated renderer / input path | 25 |
| averageBidColor | "#4ADE80" | Yes | Dedicated renderer / input path | 3 |
| averageAskColor | "#F87171" | Yes | Dedicated renderer / input path | 3 |
| markerBidColor | "#86EFAC" | Yes | Dedicated renderer / input path | 3 |
| markerAskColor | "#FCA5A5" | Yes | Dedicated renderer / input path | 3 |
| parameterValue | 10 | Yes | Dedicated renderer / input path | 2 |
| averageLength | 10 | Yes | Dedicated renderer / input path | 4 |
| markerValue | 10 | Yes | Dedicated renderer / input path | 2 |
| lineWidth | 1 | Yes | Dedicated renderer / input path | 142 |
| historyBuckets | 360 | Yes | Dedicated renderer / input path | 4 |
| paneHeight | 190 | Yes | Dedicated renderer / input path | 11 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| parameterMode | "seconds" | Yes | Dedicated renderer / input path | 2 |
| showAverage | true | Yes | Dedicated renderer / input path | 5 |
| showMarker | false | Yes | Dedicated renderer / input path | 4 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |

## DOM Pro

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| width | 640 | Yes | Dedicated renderer / input path | 259 |
| rows | 120 | Yes | Dedicated renderer / input path | 221 |
| rowHeight | 24 | Yes | Dedicated renderer / input path | 24 |
| refreshRateMs | 32 | Yes | Dedicated renderer / input path | 2 |
| recentWindowMs | 8000 | Yes | Dedicated renderer / input path | 2 |
| depthScaleCap | 0 | Yes | Dedicated renderer / input path | 2 |
| highlightThreshold | 0 | Yes | Dedicated renderer / input path | 1 |
| fontSize | 9 | Yes | Dedicated renderer / input path | 88 |
| showCumulative | false | Yes | Dedicated renderer / input path | 2 |
| showOrderCount | false | Yes | Dedicated renderer / input path | 1 |
| showPullStack | true | Not individually established | Dedicated renderer / input path | 1 |
| showRecentTrades | true | Yes | Dedicated renderer / input path | 1 |
| showDepthHistogram | true | Yes | Dedicated renderer / input path | 2 |
| showHeaderStats | true | Yes | Dedicated renderer / input path | 2 |
| showImbalance | true | Yes | Dedicated renderer / input path | 2 |
| autoCenter | true | Yes | Dedicated renderer / input path | 3 |
| compactNumbers | true | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| bidColor | "#22C55E" | Yes | Dedicated renderer / input path | 24 |
| askColor | "#EF4444" | Yes | Dedicated renderer / input path | 25 |
| lastTradeColor | "#FDE047" | Yes | Dedicated renderer / input path | 1 |
| domPreset | "order-flow" | Not individually established | Dedicated renderer / input path | 2 |
| domColumns | "[{\"id\":\"buy\",\"width\":100,\"enabled\":true},{\"id\":\"sell\",\"width\":100,\"enabled\":true},{\"id\":\"bid\",\"width\":100,\"enabled\":true},{\"id\":\"price\",\"width\":100,\"enabled\":true},{\"id\":\"ask\",\"width\":100,\"enabled\":true},{\"id\":\"trades\",\"width\":100,\"enabled\":true},{\"id\":\"orders\",\"width\":82,\"enabled\":false},{\"id\":\"cob\",\"width\":82,\"enabled\":false},{\"id\":\"pullStack\",\"width\":82,\"enabled\":false}]" | Yes | Dedicated renderer / input path | 2 |
| domSettingsVersion | 5 | Not individually established | Dedicated renderer / input path | 1 |

## Mini DOM

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| widthPx | 95 | Yes | Dedicated renderer / input path | 5 |
| rightGapPx | 2 | Yes | Dedicated renderer / input path | 2 |
| levelSpacingPx | 10 | Yes | Dedicated renderer / input path | 3 |
| barOpacity | 100 | Yes | Dedicated renderer / input path | 3 |
| backgroundOpacity | 0 | Yes | Dedicated renderer / input path | 9 |
| fontSize | 8 | Yes | Dedicated renderer / input path | 88 |
| showBids | true | Yes | Dedicated renderer / input path | 2 |
| showAsks | true | Yes | Dedicated renderer / input path | 2 |
| alignLeft | true | Yes | Dedicated renderer / input path | 2 |
| showSizes | true | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| buyColor | "#14B8B0" | Yes | Dedicated renderer / input path | 12 |
| sellColor | "#B4174B" | Yes | Dedicated renderer / input path | 12 |

## Footprint

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| barWidth | 92 | Yes | Dedicated renderer / input path | 14 |
| candleSpacing | 6 | Yes | Dedicated renderer / input path | 4 |
| autoGroupFactor | 1 | Yes | Dedicated renderer / input path | 13 |
| manualTicks | 1 | Yes | Dedicated renderer / input path | 4 |
| minimumTradeVolume | 0 | Yes | Dedicated renderer / input path | 7 |
| maximumTradeVolume | 0 | Yes | Dedicated renderer / input path | 7 |
| minimumImbalancePercent | 300 | Yes | Dedicated renderer / input path | 5 |
| minimumDominantVolume | 10 | Yes | Dedicated renderer / input path | 5 |
| minimumDelta | 0 | Yes | Dedicated renderer / input path | 4 |
| stackedImbalanceLevels | 3 | Yes | Dedicated renderer / input path | 5 |
| unfinishedAuctionMinimumVolume | 1 | Yes | Dedicated renderer / input path | 5 |
| valueAreaPercent | 0.7 | Yes | Dedicated renderer / input path | 30 |
| backgroundOpacity | 72 | Yes | Dedicated renderer / input path | 9 |
| minimumOpacity | 8 | Yes | Dedicated renderer / input path | 9 |
| maximumOpacity | 72 | Yes | Dedicated renderer / input path | 9 |
| gradientExponent | 0.72 | Yes | Dedicated renderer / input path | 4 |
| visibleRegionPercentile | 0.95 | Yes | Dedicated renderer / input path | 4 |
| fixedMaximum | 0 | Yes | Dedicated renderer / input path | 6 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| fontSize | 11 | Yes | Dedicated renderer / input path | 88 |
| fontWeight | 500 | Yes | Dedicated renderer / input path | 29 |
| minimumWidthToShowText | 32 | Yes | Dedicated renderer / input path | 4 |
| minimumRowHeightToShowText | 9 | Yes | Dedicated renderer / input path | 4 |
| dynamicTextIncrease | 1 | Yes | Dedicated renderer / input path | 3 |
| singlePrintMaximum | 1 | Yes | Dedicated renderer / input path | 3 |
| minimumRatio | 1.5 | Yes | Dedicated renderer / input path | 7 |
| maximumRatio | 100 | Yes | Dedicated renderer / input path | 7 |
| clusterMinimumVolume | 100 | Yes | Dedicated renderer / input path | 3 |
| maximumRetainedBars | 5000 | Yes | Dedicated renderer / input path | 3 |
| maximumDetailedVisibleBars | 180 | Yes | Dedicated renderer / input path | 3 |
| footprintSettingsVersion | 8 | Not individually established | Dedicated renderer / input path | 1 |
| chartType | "bid-ask" | Yes | Dedicated renderer / input path | 4 |
| chartVariant | "bid-ask" | Yes | Dedicated renderer / input path | 1 |
| contentMode | "bid-ask" | Yes | Dedicated renderer / input path | 5 |
| visualizationMode | "heatmap-histogram" | Yes | Dedicated renderer / input path | 7 |
| scaleMode | "visible-region" | Yes | Dedicated renderer / input path | 8 |
| numberFormat | "automatic" | Yes | Dedicated renderer / input path | 5 |
| inputType | "volume" | Yes | Dedicated renderer / input path | 11 |
| colorMode | "fading" | Yes | Dedicated renderer / input path | 10 |
| colorCalculation | "imbalance" | Yes | Dedicated renderer / input path | 4 |
| groupingMode | "manual" | Yes | Dedicated renderer / input path | 13 |
| groupMode | "fixed" | Yes | Dedicated renderer / input path | 3 |
| showPerBarVolumeProfile | false | Yes | Dedicated renderer / input path | 4 |
| showPerBarDeltaProfile | false | Yes | Dedicated renderer / input path | 4 |
| perBarProfileScaleMode | "independent" | Yes | Dedicated renderer / input path | 3 |
| perBarProfileTicksPerRow | 1 | Yes | Dedicated renderer / input path | 2 |
| perBarProfileWidthPercent | 92 | Yes | Dedicated renderer / input path | 3 |
| perBarProfileGap | 2 | Yes | Dedicated renderer / input path | 3 |
| perBarProfileExtraSpacing | 18 | Yes | Dedicated renderer / input path | 3 |
| perBarProfileOpacity | 58 | Yes | Dedicated renderer / input path | 3 |
| showPerBarProfilePoc | true | Not individually established | Dedicated renderer / input path | 3 |
| perBarProfilePocSize | 5 | Yes | Dedicated renderer / input path | 3 |
| perBarProfileOutline | false | Not individually established | Dedicated renderer / input path | 3 |
| perBarVolumeColor | "#B7FF38" | Yes | Dedicated renderer / input path | 3 |
| perBarPositiveDeltaColor | "#B7FF38" | Yes | Dedicated renderer / input path | 3 |
| perBarNegativeDeltaColor | "#F06A70" | Yes | Dedicated renderer / input path | 3 |
| perBarProfilePocColor | "#E4BF5A" | Yes | Dedicated renderer / input path | 3 |
| showCellText | true | Yes | Dedicated renderer / input path | 4 |
| imbalanceMode | "diagonal" | Yes | Dedicated renderer / input path | 4 |
| includeZero | false | Yes | Dedicated renderer / input path | 5 |
| showStackedImbalances | true | Yes | Dedicated renderer / input path | 3 |
| unfinishedAuctionEnabled | false | Yes | Dedicated renderer / input path | 5 |
| showImbalances | true | Yes | Dedicated renderer / input path | 3 |
| showWick | true | Yes | Dedicated renderer / input path | 3 |
| showBodyOutline | true | Yes | Dedicated renderer / input path | 3 |
| showBodyFill | false | Yes | Dedicated renderer / input path | 3 |
| showEmptyPriceRows | false | Yes | Dedicated renderer / input path | 3 |
| showSummary | true | Yes | Dedicated renderer / input path | 10 |
| showCentreDivider | true | Yes | Dedicated renderer / input path | 3 |
| showVolumePoc | true | Yes | Dedicated renderer / input path | 3 |
| showDeltaPoc | false | Yes | Dedicated renderer / input path | 3 |
| showValueArea | true | Yes | Dedicated renderer / input path | 12 |
| showVah | false | Yes | Dedicated renderer / input path | 3 |
| showVal | false | Yes | Dedicated renderer / input path | 3 |
| showSinglePrints | false | Yes | Dedicated renderer / input path | 6 |
| singlePrintExtremesOnly | true | Yes | Dedicated renderer / input path | 3 |
| showRatio | false | Yes | Dedicated renderer / input path | 3 |
| showVolumeClusters | false | Yes | Dedicated renderer / input path | 3 |
| showBarDelta | true | Yes | Dedicated renderer / input path | 3 |
| showZeros | false | Yes | Dedicated renderer / input path | 4 |
| colorOnlyDominantSide | false | Yes | Dedicated renderer / input path | 3 |
| dynamicTextSize | true | Yes | Dedicated renderer / input path | 3 |
| showMaxBid | false | Yes | Dedicated renderer / input path | 3 |
| showMaxAsk | false | Yes | Dedicated renderer / input path | 3 |
| showMaxPositiveDelta | false | Yes | Dedicated renderer / input path | 3 |
| showMaxNegativeDelta | false | Yes | Dedicated renderer / input path | 3 |
| showMaxTrades | false | Yes | Dedicated renderer / input path | 3 |
| showBetweenVolume | false | Yes | Dedicated renderer / input path | 3 |
| showVwap | false | Yes | Dedicated renderer / input path | 6 |
| outsideBarStyle | "bar" | Yes | Dedicated renderer / input path | 4 |
| markerAlignment | "center" | Yes | Dedicated renderer / input path | 4 |
| outerEdgeMode | true | Yes | Dedicated renderer / input path | 3 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| betweenColor | "#A1A1AA" | Yes | Dedicated renderer / input path | 3 |
| neutralColor | "#3F3F46" | Yes | Dedicated renderer / input path | 33 |
| textColor | "#F5F5F5" | Yes | Dedicated renderer / input path | 58 |
| pocColor | "#FDE047" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#647BA8" | Yes | Dedicated renderer / input path | 18 |
| deltaPocColor | "#60A5FA" | Yes | Dedicated renderer / input path | 3 |
| clusterColor | "#F59E0B" | Yes | Dedicated renderer / input path | 3 |
| singlePrintColor | "#F4F4F5" | Yes | Dedicated renderer / input path | 6 |
| stackedAskColor | "#B7FF38" | Yes | Dedicated renderer / input path | 3 |
| stackedBidColor | "#F06A70" | Yes | Dedicated renderer / input path | 3 |
| unfinishedAuctionColor | "#E4BF5A" | Yes | Dedicated renderer / input path | 3 |
| vwapColor | "#22D3EE" | Yes | Dedicated renderer / input path | 8 |
| fpsLimit | 60 | Yes | Dedicated renderer / input path | 4 |
| type | "ask-bid" | Not individually established | Dedicated renderer / input path | 968 |
| mode | "profile" | Not individually established | Dedicated renderer / input path | 200 |
| stableFootprintRows | true | Not individually established | Dedicated renderer / input path | 0 |
| textFormat | "automatic" | Not individually established | Dedicated renderer / input path | 3 |

## KWANT Delta

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| positiveColor | "#C8FFC8" | Yes | output-effect-observed | 19 |
| negativeColor | "#F2D3FF" | Yes | output-effect-observed | 21 |
| range1AskColor | "#C8FFC8" | Yes | output-effect-observed | 3 |
| range1BidColor | "#F2D3FF" | Yes | output-effect-observed | 3 |
| range2AskColor | "#77F277" | Yes | output-effect-observed | 3 |
| range2BidColor | "#C26DE0" | Yes | output-effect-observed | 3 |
| range3AskColor | "#39C96A" | Yes | output-effect-observed | 3 |
| range3BidColor | "#8B3EC1" | Yes | output-effect-observed | 3 |
| range4AskColor | "#00FF68" | Yes | output-effect-observed | 3 |
| range4BidColor | "#6D18A8" | Yes | output-effect-observed | 3 |
| maximumPositiveColor | "#00FF68" | Yes | output-effect-observed | 2 |
| minimumNegativeColor | "#7416B5" | Yes | output-effect-observed | 2 |
| level1Color | "#FFD600" | Yes | output-effect-observed | 1 |
| level2Color | "#FFD600" | Yes | output-effect-observed | 1 |
| markerColor | "#16106F" | Yes | output-effect-observed | 5 |
| barGrouping | 4 | Yes | output-effect-observed | 1 |
| range1Minimum | 1 | Yes | output-effect-observed | 3 |
| range1Maximum | 10 | Yes | output-effect-observed | 1 |
| range2Minimum | 11 | Yes | output-effect-observed | 3 |
| range2Maximum | 20 | Yes | output-effect-observed | 1 |
| range3Minimum | 21 | Yes | output-effect-observed | 3 |
| range3Maximum | 30 | Yes | output-effect-observed | 1 |
| range4Minimum | 31 | Yes | output-effect-observed | 3 |
| range4Maximum | 0 | Yes | output-effect-observed | 1 |
| level1Value | 1000 | Yes | output-effect-observed | 1 |
| level1LineWidth | 1 | Yes | output-effect-observed | 1 |
| level2Value | 1500 | Yes | output-effect-observed | 1 |
| level2LineWidth | 1 | Yes | output-effect-observed | 1 |
| markerMinimumDelta | 0 | Yes | output-effect-observed | 1 |
| lineWidth | 1 | Yes | output-effect-observed | 142 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| deltaMode | "multi-range" | Yes | Dedicated renderer / input path | 7 |
| range1Enabled | true | Yes | output-effect-observed | 3 |
| range2Enabled | true | Yes | output-effect-observed | 3 |
| range3Enabled | true | Yes | output-effect-observed | 3 |
| range4Enabled | true | Yes | output-effect-observed | 3 |
| level1Enabled | false | Yes | output-effect-observed | 1 |
| level1LineStyle | "dashed" | Yes | Dedicated renderer / input path | 1 |
| level2Enabled | false | Yes | output-effect-observed | 1 |
| level2LineStyle | "dashed" | Yes | Dedicated renderer / input path | 1 |
| markerEnabled | false | Yes | output-effect-observed | 4 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |

## KWANT Wall

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| minimumTickBreakout | 1 | Yes | Dedicated renderer / input path | 2 |
| minimumDeltaPercent | 70 | Yes | Dedicated renderer / input path | 4 |
| minimumPerBarVolume | 20 | Yes | Dedicated renderer / input path | 1 |
| minimumClusterVolume | 300 | Yes | Dedicated renderer / input path | 1 |
| tickGrouping | 1 | Yes | Dedicated renderer / input path | 1 |
| highestLowestMinimumBars | 2 | Yes | Dedicated renderer / input path | 1 |
| highestLowestNearnessBars | 50 | Yes | Dedicated renderer / input path | 1 |
| markerWidthBars | 1.6 | Yes | Dedicated renderer / input path | 2 |
| lineWidth | 2 | Yes | Dedicated renderer / input path | 142 |
| opacity | 92 | Yes | Dedicated renderer / input path | 167 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| plotPrice | "price-slope" | Yes | Dedicated renderer / input path | 3 |
| alertSoundEnabled | false | Yes | Dedicated renderer / input path | 8 |
| alertTone | "chime" | Yes | Dedicated renderer / input path | 5 |
| messagePopupEnabled | false | Yes | Dedicated renderer / input path | 8 |
| messageText | "KWANT Wall" | Yes | Dedicated renderer / input path | 7 |
| buyWallColor | "#22C55E" | Yes | Dedicated renderer / input path | 3 |
| sellWallColor | "#EF4444" | Yes | Dedicated renderer / input path | 3 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |

## KWANT V-Tracker

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| accelerationColor | "#22D3EE" | Yes | Dedicated renderer / input path | 4 |
| exhaustionColor | "#F59E0B" | Yes | Dedicated renderer / input path | 4 |
| slowdownColor | "#A78BFA" | Yes | Dedicated renderer / input path | 4 |
| bidColor | "#A855F7" | Yes | Dedicated renderer / input path | 24 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| controlLineWidth | 2 | Yes | Dedicated renderer / input path | 2 |
| extremeLineWidth | 1 | Yes | Dedicated renderer / input path | 2 |
| textSize | 10 | Yes | Dedicated renderer / input path | 11 |
| projectionBars | 20 | Yes | Dedicated renderer / input path | 2 |
| patternOpacity | 32 | Yes | Dedicated renderer / input path | 2 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| accelerationEnabled | true | Yes | Dedicated renderer / input path | 1 |
| accelerationMode | "strong" | Yes | Dedicated renderer / input path | 1 |
| exhaustionEnabled | false | Yes | Dedicated renderer / input path | 1 |
| exhaustionMode | "medium" | Yes | Dedicated renderer / input path | 1 |
| slowdownEnabled | false | Yes | Dedicated renderer / input path | 1 |
| slowdownMode | "medium" | Yes | Dedicated renderer / input path | 1 |
| absorptionPressureEnabled | true | Yes | Dedicated renderer / input path | 1 |
| absorptionIntensity | "medium" | Yes | Dedicated renderer / input path | 1 |
| levelMode | "medium" | Yes | Dedicated renderer / input path | 1 |
| extendFarRight | false | Yes | Dedicated renderer / input path | 1 |
| alertSoundEnabled | false | Yes | Dedicated renderer / input path | 8 |
| alertTone | "chime" | Yes | Dedicated renderer / input path | 5 |
| messagePopupEnabled | false | Yes | Dedicated renderer / input path | 8 |
| messageText | "KWANT V-Tracker" | Yes | Dedicated renderer / input path | 7 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |

## Volume

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#8A8F98" | Yes | output-effect-observed | 7 |
| minimumTotalVolume | 0 | Yes | output-effect-observed | 1 |
| useThemeColors | true | Yes | output-effect-observed | 75 |

## Daily Volume Profile

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| groupTicks | 4 | Yes | Dedicated renderer / input path | 26 |
| autoGroupFactor | 1 | Not individually established | Dedicated renderer / input path | 13 |
| profileWidth | 2 | Yes | Dedicated renderer / input path | 7 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| minTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| maxTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| valueAreaPercent | 68 | Yes | Dedicated renderer / input path | 30 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| pocLineWidth | 1 | Yes | Dedicated renderer / input path | 10 |
| pocHighlightOpacity | 100 | Yes | Dedicated renderer / input path | 2 |
| developingPocStartMinutes | 0 | Yes | Dedicated renderer / input path | 2 |
| shiftedPocTicks | 4 | Yes | Dedicated renderer / input path | 6 |
| shiftedPocOpacity | 35 | Yes | Dedicated renderer / input path | 3 |
| pocLineMode | "show" | Yes | Dedicated renderer / input path | 5 |
| pocExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| valueAreaLineWidth | 2 | Yes | Dedicated renderer / input path | 10 |
| valueAreaDeveloping | "no" | Yes | Dedicated renderer / input path | 1 |
| valueAreaExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| showPeaks | false | Yes | Dedicated renderer / input path | 6 |
| showValleys | false | Yes | Dedicated renderer / input path | 6 |
| pvSensitivity | 40 | Yes | Dedicated renderer / input path | 2 |
| pvExcludeHighLow | true | Yes | Dedicated renderer / input path | 2 |
| peakMinVolumePercent | 1 | Yes | Dedicated renderer / input path | 3 |
| valleyMaxVolumePercent | 0 | Yes | Dedicated renderer / input path | 3 |
| peakOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| valleyOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| peakLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| valleyLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| peakExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| valleyExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| showBusinessZone | false | Yes | Dedicated renderer / input path | 2 |
| businessZoneOpacity | 3 | Yes | Dedicated renderer / input path | 2 |
| businessZoneLineWidth | 0 | Yes | Dedicated renderer / input path | 2 |
| vwapEnabled | false | Yes | Dedicated renderer / input path | 1 |
| showVwapLine | true | Yes | Dedicated renderer / input path | 4 |
| vwapHighlight | false | Yes | Dedicated renderer / input path | 1 |
| showDevelopingVwap | false | Yes | Dedicated renderer / input path | 3 |
| showVwapBands | false | Yes | Dedicated renderer / input path | 3 |
| vwapLineWidth | 1 | Yes | Dedicated renderer / input path | 4 |
| vwapLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| vwapHighlightOpacity | 18 | Yes | Dedicated renderer / input path | 2 |
| vwapExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| vwapBand1 | 1 | Yes | Dedicated renderer / input path | 3 |
| vwapBand2 | 2 | Yes | Dedicated renderer / input path | 3 |
| vwapBand3 | 0 | Yes | Dedicated renderer / input path | 3 |
| showSummaryVolume | true | Yes | Dedicated renderer / input path | 2 |
| showSummaryTrades | false | Yes | Dedicated renderer / input path | 3 |
| filterMode | "none" | Not individually established | Dedicated renderer / input path | 16 |
| filterTime | "rth" | Not individually established | Dedicated renderer / input path | 16 |
| levelLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| showLevelLabels | true | Yes | Dedicated renderer / input path | 7 |
| levelLabelSide | "right" | Yes | Dedicated renderer / input path | 4 |
| showLevelLabelPrice | true | Yes | Dedicated renderer / input path | 4 |
| visualStyle | "automatic" | Yes | Dedicated renderer / input path | 6 |
| widthMode | "period-percent" | Yes | Dedicated renderer / input path | 4 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| numberOfProfiles | 0 | Yes | Dedicated renderer / input path | 5 |
| previousProfileWidth | 2 | Yes | Dedicated renderer / input path | 1 |
| currentProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| previousProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| sessionStartMinutes | 510 | Not individually established | Dedicated renderer / input path | 9 |
| sessionEndMinutes | 915 | Not individually established | Dedicated renderer / input path | 9 |
| useEndSessionAsStartDay | false | Yes | Dedicated renderer / input path | 10 |
| profileMode | "volume" | Yes | Dedicated renderer / input path | 7 |
| groupingMode | "manual" | Yes | Dedicated renderer / input path | 13 |
| gradientPreset | "off" | Yes | Dedicated renderer / input path | 13 |
| sessionSelectionArmed | false | Not individually established | Dedicated renderer / input path | 0 |
| sessionAsiaEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionTokyoEnabled | false | Yes | Dedicated renderer / input path | 5 |
| sessionLondonEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionNewYorkEnabled | true | Yes | Dedicated renderer / input path | 5 |
| snapMode | "left" | Yes | Dedicated renderer / input path | 7 |
| useThemeColors | true | Not individually established | Dedicated renderer / input path | 75 |
| showText | false | Yes | Dedicated renderer / input path | 7 |
| showValueArea | true | Yes | Dedicated renderer / input path | 12 |
| showPocLine | true | Yes | Dedicated renderer / input path | 6 |
| showValueAreaLines | true | Yes | Dedicated renderer / input path | 9 |
| recentLevelsOnly | false | Yes | Dedicated renderer / input path | 3 |
| showDelta | true | Yes | Dedicated renderer / input path | 5 |
| showProfileSpine | true | Yes | Dedicated renderer / input path | 4 |
| showDevelopingPoc | false | Yes | Dedicated renderer / input path | 6 |
| showPocHighlight | true | Yes | Dedicated renderer / input path | 4 |
| showProfileOutline | true | Yes | Dedicated renderer / input path | 4 |
| showSummary | false | Yes | Dedicated renderer / input path | 10 |
| profileSettingsVersion | 15 | Not individually established | Dedicated renderer / input path | 1 |
| volumeColor | "#22C55E" | Yes | Dedicated renderer / input path | 4 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| pocColor | "#22C55E" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#22C55E" | Yes | Dedicated renderer / input path | 18 |
| peakColor | "#22C55E" | Yes | Dedicated renderer / input path | 7 |
| valleyColor | "#EF4444" | Yes | Dedicated renderer / input path | 7 |
| businessZoneColor | "#22C55E" | Yes | Dedicated renderer / input path | 2 |
| vwapColor | "#F59E0B" | Yes | Dedicated renderer / input path | 8 |
| vwapHighlightColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| vwapBandColor | "#71717A" | Yes | Dedicated renderer / input path | 5 |
| summaryTextColor | "#22C55E" | Yes | Dedicated renderer / input path | 8 |

## TPO Daily

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| lengthValue | 1 | Yes | Dedicated renderer / input path | 7 |
| subperiodMinutes | 30 | Yes | Dedicated renderer / input path | 4 |
| profileCount | 10 | Yes | Dedicated renderer / input path | 5 |
| ticksPerRow | 1 | Yes | Dedicated renderer / input path | 4 |
| autoTargetRows | 90 | Yes | Dedicated renderer / input path | 3 |
| autoGroupFactor | 1 | Yes | Dedicated renderer / input path | 13 |
| valueAreaPercent | 70 | Yes | Dedicated renderer / input path | 30 |
| initialBalanceSubperiods | 2 | Yes | Dedicated renderer / input path | 3 |
| initialBalanceStartSubperiod | 0 | Yes | Dedicated renderer / input path | 3 |
| initialBalanceLineWidth | 1 | Yes | Dedicated renderer / input path | 3 |
| minimumSinglePrintTicks | 1 | Yes | Dedicated renderer / input path | 3 |
| singlePrintMaxTpoCount | 1 | Yes | Dedicated renderer / input path | 3 |
| singlePrintStepDown | 3 | Yes | Dedicated renderer / input path | 3 |
| singlePrintQuality | 0 | Yes | Dedicated renderer / input path | 3 |
| singlePrintVolumeSensitivity | 0 | Yes | Dedicated renderer / input path | 3 |
| blockSize | 8 | Yes | Dedicated renderer / input path | 3 |
| blockGap | 1 | Yes | Dedicated renderer / input path | 3 |
| opacityPercent | 100 | Yes | Dedicated renderer / input path | 5 |
| borderWidth | 0.75 | Yes | Dedicated renderer / input path | 20 |
| barMarkerWidth | 1 | Yes | Dedicated renderer / input path | 3 |
| range1Minimum | 0 | Yes | Dedicated renderer / input path | 3 |
| range2Minimum | 25 | Yes | Dedicated renderer / input path | 3 |
| range3Minimum | 50 | Yes | Dedicated renderer / input path | 3 |
| range4Minimum | 75 | Yes | Dedicated renderer / input path | 3 |
| pocLineWidth | 1.5 | Yes | Dedicated renderer / input path | 10 |
| developingPocStartOffset | 0 | Yes | Dedicated renderer / input path | 3 |
| shiftedPocTicks | 1 | Yes | Dedicated renderer / input path | 6 |
| pocGroupingOpacity | 20 | Yes | Dedicated renderer / input path | 3 |
| valueAreaBackgroundOpacity | 10 | Yes | Dedicated renderer / input path | 3 |
| valueAreaLineWidth | 1 | Yes | Dedicated renderer / input path | 10 |
| singlePrintLineWidth | 1 | Yes | Dedicated renderer / input path | 3 |
| singlePrintFillOpacity | 60 | Yes | Dedicated renderer / input path | 3 |
| summaryBackgroundOpacity | 82 | Yes | Dedicated renderer / input path | 3 |
| summaryFontSize | 8 | Yes | Dedicated renderer / input path | 3 |
| currentWidth | 100 | Yes | Dedicated renderer / input path | 4 |
| currentOffset | 0 | Yes | Dedicated renderer / input path | 4 |
| previousWidth | 80 | Yes | Dedicated renderer / input path | 3 |
| previousOffset | 0 | Yes | Dedicated renderer / input path | 3 |
| peakValleyRadius | 2 | Yes | Dedicated renderer / input path | 3 |
| peakMinimumProminence | 2 | Yes | Dedicated renderer / input path | 3 |
| maximumMergeMembers | 30 | Yes | Dedicated renderer / input path | 3 |
| maximumRenderedBlocks | 50000 | Yes | Dedicated renderer / input path | 4 |
| fpsCap | 60 | Yes | Dedicated renderer / input path | 2 |
| schemaVersion | 2 | Not individually established | Dedicated renderer / input path | 67 |
| indicatorVariant | "daily-tpo" | Not individually established | Dedicated renderer / input path | 3 |
| scheduleKind | "daily" | Yes | Dedicated renderer / input path | 5 |
| periodMode | "multiple-profiles" | Yes | Dedicated renderer / input path | 9 |
| lengthUnit | "day" | Yes | Dedicated renderer / input path | 3 |
| timezone | "America/Chicago" | Not individually established | Dedicated renderer / input path | 47 |
| quickSessions | "" | Not individually established | Dedicated renderer / input path | 5 |
| dailyStartTime | "17:00:00" | Yes | Dedicated renderer / input path | 5 |
| dailyEndMode | "next-daily-start" | Yes | Dedicated renderer / input path | 5 |
| dailyEndTime | "16:00:00" | Yes | Dedicated renderer / input path | 5 |
| enabledWeekdays | "0,1,2,3,4" | Yes | Dedicated renderer / input path | 5 |
| weekStartDay | 0 | Yes | Dedicated renderer / input path | 4 |
| weekStartTime | "17:00:00" | Not individually established | Dedicated renderer / input path | 4 |
| weekEndMode | "next-week-start" | Yes | Dedicated renderer / input path | 4 |
| weekEndDay | 5 | Yes | Dedicated renderer / input path | 4 |
| weekEndTime | "16:00:00" | Yes | Dedicated renderer / input path | 4 |
| weekLength | 1 | Not individually established | Dedicated renderer / input path | 3 |
| customStartMs | 0 | Not individually established | Dedicated renderer / input path | 8 |
| customEndMs | 0 | Not individually established | Dedicated renderer / input path | 8 |
| customEndFollowsLatest | false | Yes | Dedicated renderer / input path | 7 |
| tpoType | "blocks" | Yes | Dedicated renderer / input path | 3 |
| showText | false | Yes | Dedicated renderer / input path | 7 |
| visualStyle | "solid" | Yes | Dedicated renderer / input path | 6 |
| displayType | "blocks" | Yes | Dedicated renderer / input path | 3 |
| splitMode | "none" | Yes | Dedicated renderer / input path | 3 |
| visitSource | "automatic" | Yes | Dedicated renderer / input path | 5 |
| groupingMode | "automatic" | Yes | Dedicated renderer / input path | 13 |
| freezeActiveGrouping | true | Yes | Dedicated renderer / input path | 3 |
| showPoc | true | Yes | Dedicated renderer / input path | 13 |
| showDevelopingPoc | false | Yes | Dedicated renderer / input path | 6 |
| showValueArea | true | Yes | Dedicated renderer / input path | 12 |
| showDevelopingValueArea | false | Yes | Dedicated renderer / input path | 4 |
| showInitialBalance | false | Yes | Dedicated renderer / input path | 3 |
| showSinglePrints | false | Yes | Dedicated renderer / input path | 6 |
| includeExtremesInSinglePrints | false | Yes | Dedicated renderer / input path | 3 |
| showPeaks | false | Yes | Dedicated renderer / input path | 6 |
| showValleys | false | Yes | Dedicated renderer / input path | 6 |
| peakValleySensitivity | 40 | Yes | Dedicated renderer / input path | 5 |
| peakValleyExcludeExtremes | true | Yes | Dedicated renderer / input path | 3 |
| showSummary | false | Yes | Dedicated renderer / input path | 10 |
| widthMode | "automatic" | Yes | Dedicated renderer / input path | 4 |
| showOnRight | false | Yes | Dedicated renderer / input path | 4 |
| mirror | false | Yes | Dedicated renderer / input path | 10 |
| lockPosition | false | Yes | Dedicated renderer / input path | 2 |
| showAboveBars | true | Yes | Dedicated renderer / input path | 3 |
| minimumTextSize | 7 | Not individually established | Dedicated renderer / input path | 2 |
| maximumTextSize | 11 | Not individually established | Dedicated renderer / input path | 3 |
| gradientPreset | "off" | Yes | Dedicated renderer / input path | 13 |
| colourCalculation | "time" | Yes | Dedicated renderer / input path | 3 |
| colourReference | "fixed" | Yes | Dedicated renderer / input path | 3 |
| fixedVolumeColor | "#22D3EE" | Yes | Dedicated renderer / input path | 3 |
| fixedBidColor | "#FB7185" | Yes | Dedicated renderer / input path | 3 |
| fixedAskColor | "#22D3EE" | Yes | Dedicated renderer / input path | 3 |
| range1Enabled | true | Yes | Dedicated renderer / input path | 3 |
| range1VolumeColor | "#64748B" | Yes | Dedicated renderer / input path | 2 |
| range1BidColor | "#FB7185" | Yes | Dedicated renderer / input path | 3 |
| range1AskColor | "#22D3EE" | Yes | Dedicated renderer / input path | 3 |
| range2Enabled | true | Yes | Dedicated renderer / input path | 3 |
| range2VolumeColor | "#38BDF8" | Yes | Dedicated renderer / input path | 2 |
| range2BidColor | "#F43F5E" | Yes | Dedicated renderer / input path | 3 |
| range2AskColor | "#06B6D4" | Yes | Dedicated renderer / input path | 3 |
| range3Enabled | true | Yes | Dedicated renderer / input path | 3 |
| range3VolumeColor | "#8B5CF6" | Yes | Dedicated renderer / input path | 2 |
| range3BidColor | "#E11D48" | Yes | Dedicated renderer / input path | 3 |
| range3AskColor | "#0891B2" | Yes | Dedicated renderer / input path | 3 |
| range4Enabled | true | Yes | Dedicated renderer / input path | 3 |
| range4VolumeColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| range4BidColor | "#BE123C" | Yes | Dedicated renderer / input path | 3 |
| range4AskColor | "#0E7490" | Yes | Dedicated renderer / input path | 3 |
| initialAColorEnabled | false | Yes | Dedicated renderer / input path | 3 |
| initialAColor | "#F59E0B" | Yes | Dedicated renderer / input path | 3 |
| initialBColorEnabled | false | Yes | Dedicated renderer / input path | 3 |
| initialBColor | "#A855F7" | Yes | Dedicated renderer / input path | 3 |
| initialCColorEnabled | false | Yes | Dedicated renderer / input path | 3 |
| initialCColor | "#3B82F6" | Yes | Dedicated renderer / input path | 3 |
| initialDColorEnabled | false | Yes | Dedicated renderer / input path | 3 |
| initialDColor | "#14B8A6" | Yes | Dedicated renderer / input path | 3 |
| colorOpenEnabled | false | Yes | Dedicated renderer / input path | 3 |
| openColor | "#22C55E" | Yes | Dedicated renderer / input path | 4 |
| colorCloseEnabled | false | Yes | Dedicated renderer / input path | 3 |
| closeColor | "#F43F5E" | Not individually established | Dedicated renderer / input path | 4 |
| barMarkerEnabled | false | Yes | Dedicated renderer / input path | 3 |
| barMarkerStyle | "candle" | Yes | Dedicated renderer / input path | 3 |
| barMarkerUpColor | "#22D3EE" | Yes | Dedicated renderer / input path | 3 |
| barMarkerDownColor | "#FB7185" | Yes | Dedicated renderer / input path | 3 |
| barMarkerShowOpenClose | true | Yes | Dedicated renderer / input path | 3 |
| pocLineMode | "final" | Yes | Dedicated renderer / input path | 5 |
| pocHighlight | true | Yes | Dedicated renderer / input path | 3 |
| pocHighlightColor | "#F5B83B" | Yes | Dedicated renderer / input path | 3 |
| pocLineColor | "#F5B83B" | Yes | Dedicated renderer / input path | 3 |
| pocExtensionMode | "none" | Yes | Dedicated renderer / input path | 7 |
| showPocPriceLabel | true | Yes | Dedicated renderer / input path | 3 |
| valueAreaHighlight | true | Yes | Dedicated renderer / input path | 3 |
| valueAreaHighlightInside | true | Yes | Dedicated renderer / input path | 3 |
| valueAreaOutsideColor | "#475569" | Yes | Dedicated renderer / input path | 3 |
| valueAreaShowLines | true | Yes | Dedicated renderer / input path | 4 |
| recentLevelsOnly | false | Yes | Dedicated renderer / input path | 3 |
| valueAreaShowBackground | false | Yes | Dedicated renderer / input path | 3 |
| valueAreaExtensionMode | "none" | Yes | Dedicated renderer / input path | 7 |
| valueAreaLineColor | "#60A5FA" | Yes | Dedicated renderer / input path | 5 |
| valueAreaShowLabels | true | Yes | Dedicated renderer / input path | 3 |
| singlePrintExtensionMode | "to-next-profile" | Yes | Dedicated renderer / input path | 3 |
| singlePrintFillZone | true | Yes | Dedicated renderer / input path | 3 |
| singlePrintShowLabel | true | Yes | Dedicated renderer / input path | 3 |
| singlePrintShowTestedState | true | Yes | Dedicated renderer / input path | 2 |
| initialBalanceShowHigh | true | Yes | Dedicated renderer / input path | 3 |
| initialBalanceShowLow | true | Yes | Dedicated renderer / input path | 3 |
| initialBalanceShowRangeLabel | false | Yes | Dedicated renderer / input path | 2 |
| initialBalanceShowExtensions | false | Yes | Dedicated renderer / input path | 3 |
| initialBalanceExtensionMultiples | "1,1.5,2" | Not individually established | Dedicated renderer / input path | 3 |
| initialBalanceLineColor | "#94A3B8" | Yes | Dedicated renderer / input path | 3 |
| summaryLayout | "compact" | Yes | Dedicated renderer / input path | 3 |
| summaryLocation | "top-left" | Yes | Dedicated renderer / input path | 3 |
| summaryShowVolume | true | Yes | Dedicated renderer / input path | 3 |
| summaryShowTrades | true | Yes | Dedicated renderer / input path | 3 |
| summaryShowBidAsk | true | Yes | Dedicated renderer / input path | 3 |
| summaryTextColor | "#F5F7FA" | Yes | Dedicated renderer / input path | 8 |
| summaryBackgroundColor | "#090B10" | Yes | Dedicated renderer / input path | 3 |
| filterMode | "none" | Yes | Dedicated renderer / input path | 16 |
| filterTime | "" | Yes | Dedicated renderer / input path | 16 |
| sessionStartMinutes | 510 | Not individually established | Dedicated renderer / input path | 9 |
| sessionEndMinutes | 915 | Not individually established | Dedicated renderer / input path | 9 |
| sessionAsiaEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionTokyoEnabled | false | Yes | Dedicated renderer / input path | 5 |
| sessionLondonEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionNewYorkEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionPreset | "eth" | Not individually established | Dedicated renderer / input path | 3 |
| customSessionStart | "17:00:00" | Not individually established | Dedicated renderer / input path | 4 |
| customSessionEnd | "16:00:00" | Not individually established | Dedicated renderer / input path | 4 |
| useEndSessionAsStartDay | false | Yes | Dedicated renderer / input path | 10 |
| inheritThemeColours | true | Yes | Dedicated renderer / input path | 3 |
| profileColor | "#22D3EE" | Yes | Dedicated renderer / input path | 3 |
| pocColor | "#F5B83B" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#60A5FA" | Yes | Dedicated renderer / input path | 18 |
| singlePrintColor | "#FB7185" | Yes | Dedicated renderer / input path | 6 |
| peakColor | "#A3E635" | Yes | Dedicated renderer / input path | 7 |
| valleyColor | "#8B5CF6" | Yes | Dedicated renderer / input path | 7 |
| allowDevelopingComposite | true | Yes | Dedicated renderer / input path | 2 |

## TPO Weekly

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| lengthValue | 1 | Yes | Dedicated renderer / input path | 7 |
| subperiodMinutes | 30 | Yes | Dedicated renderer / input path | 4 |
| profileCount | 8 | Yes | Dedicated renderer / input path | 5 |
| ticksPerRow | 1 | Yes | Dedicated renderer / input path | 4 |
| autoTargetRows | 90 | Yes | Dedicated renderer / input path | 3 |
| autoGroupFactor | 1 | Yes | Dedicated renderer / input path | 13 |
| valueAreaPercent | 70 | Yes | Dedicated renderer / input path | 30 |
| initialBalanceSubperiods | 2 | Yes | Dedicated renderer / input path | 3 |
| initialBalanceStartSubperiod | 0 | Yes | Dedicated renderer / input path | 3 |
| initialBalanceLineWidth | 1 | Yes | Dedicated renderer / input path | 3 |
| minimumSinglePrintTicks | 1 | Yes | Dedicated renderer / input path | 3 |
| singlePrintMaxTpoCount | 1 | Yes | Dedicated renderer / input path | 3 |
| singlePrintStepDown | 3 | Yes | Dedicated renderer / input path | 3 |
| singlePrintQuality | 0 | Yes | Dedicated renderer / input path | 3 |
| singlePrintVolumeSensitivity | 0 | Yes | Dedicated renderer / input path | 3 |
| blockSize | 8 | Yes | Dedicated renderer / input path | 3 |
| blockGap | 1 | Yes | Dedicated renderer / input path | 3 |
| opacityPercent | 100 | Yes | Dedicated renderer / input path | 5 |
| borderWidth | 0.75 | Yes | Dedicated renderer / input path | 20 |
| barMarkerWidth | 1 | Yes | Dedicated renderer / input path | 3 |
| range1Minimum | 0 | Yes | Dedicated renderer / input path | 3 |
| range2Minimum | 25 | Yes | Dedicated renderer / input path | 3 |
| range3Minimum | 50 | Yes | Dedicated renderer / input path | 3 |
| range4Minimum | 75 | Yes | Dedicated renderer / input path | 3 |
| pocLineWidth | 1.5 | Yes | Dedicated renderer / input path | 10 |
| developingPocStartOffset | 0 | Yes | Dedicated renderer / input path | 3 |
| shiftedPocTicks | 1 | Yes | Dedicated renderer / input path | 6 |
| pocGroupingOpacity | 20 | Yes | Dedicated renderer / input path | 3 |
| valueAreaBackgroundOpacity | 10 | Yes | Dedicated renderer / input path | 3 |
| valueAreaLineWidth | 1 | Yes | Dedicated renderer / input path | 10 |
| singlePrintLineWidth | 1 | Yes | Dedicated renderer / input path | 3 |
| singlePrintFillOpacity | 60 | Yes | Dedicated renderer / input path | 3 |
| summaryBackgroundOpacity | 82 | Yes | Dedicated renderer / input path | 3 |
| summaryFontSize | 8 | Yes | Dedicated renderer / input path | 3 |
| currentWidth | 100 | Yes | Dedicated renderer / input path | 4 |
| currentOffset | 0 | Yes | Dedicated renderer / input path | 4 |
| previousWidth | 80 | Yes | Dedicated renderer / input path | 3 |
| previousOffset | 0 | Yes | Dedicated renderer / input path | 3 |
| peakValleyRadius | 2 | Yes | Dedicated renderer / input path | 3 |
| peakMinimumProminence | 2 | Yes | Dedicated renderer / input path | 3 |
| maximumMergeMembers | 30 | Yes | Dedicated renderer / input path | 3 |
| maximumRenderedBlocks | 50000 | Yes | Dedicated renderer / input path | 4 |
| fpsCap | 60 | Yes | Dedicated renderer / input path | 2 |
| schemaVersion | 2 | Not individually established | Dedicated renderer / input path | 67 |
| indicatorVariant | "weekly-tpo" | Not individually established | Dedicated renderer / input path | 3 |
| scheduleKind | "weekly" | Yes | Dedicated renderer / input path | 5 |
| periodMode | "multiple-profiles" | Yes | Dedicated renderer / input path | 9 |
| lengthUnit | "week" | Yes | Dedicated renderer / input path | 3 |
| timezone | "America/Chicago" | Not individually established | Dedicated renderer / input path | 47 |
| quickSessions | "" | Not individually established | Dedicated renderer / input path | 5 |
| dailyStartTime | "17:00:00" | Not individually established | Dedicated renderer / input path | 5 |
| dailyEndMode | "next-daily-start" | Yes | Dedicated renderer / input path | 5 |
| dailyEndTime | "16:00:00" | Yes | Dedicated renderer / input path | 5 |
| enabledWeekdays | "0,1,2,3,4" | Yes | Dedicated renderer / input path | 5 |
| weekStartDay | 0 | Yes | Dedicated renderer / input path | 4 |
| weekStartTime | "17:00:00" | Yes | Dedicated renderer / input path | 4 |
| weekEndMode | "next-week-start" | Yes | Dedicated renderer / input path | 4 |
| weekEndDay | 5 | Yes | Dedicated renderer / input path | 4 |
| weekEndTime | "16:00:00" | Yes | Dedicated renderer / input path | 4 |
| weekLength | 1 | Not individually established | Dedicated renderer / input path | 3 |
| customStartMs | 0 | Not individually established | Dedicated renderer / input path | 8 |
| customEndMs | 0 | Not individually established | Dedicated renderer / input path | 8 |
| customEndFollowsLatest | false | Yes | Dedicated renderer / input path | 7 |
| tpoType | "blocks" | Yes | Dedicated renderer / input path | 3 |
| showText | false | Yes | Dedicated renderer / input path | 7 |
| visualStyle | "solid" | Yes | Dedicated renderer / input path | 6 |
| displayType | "blocks" | Yes | Dedicated renderer / input path | 3 |
| splitMode | "none" | Yes | Dedicated renderer / input path | 3 |
| visitSource | "automatic" | Yes | Dedicated renderer / input path | 5 |
| groupingMode | "automatic" | Yes | Dedicated renderer / input path | 13 |
| freezeActiveGrouping | true | Yes | Dedicated renderer / input path | 3 |
| showPoc | true | Yes | Dedicated renderer / input path | 13 |
| showDevelopingPoc | false | Yes | Dedicated renderer / input path | 6 |
| showValueArea | true | Yes | Dedicated renderer / input path | 12 |
| showDevelopingValueArea | false | Yes | Dedicated renderer / input path | 4 |
| showInitialBalance | false | Yes | Dedicated renderer / input path | 3 |
| showSinglePrints | false | Yes | Dedicated renderer / input path | 6 |
| includeExtremesInSinglePrints | false | Yes | Dedicated renderer / input path | 3 |
| showPeaks | false | Yes | Dedicated renderer / input path | 6 |
| showValleys | false | Yes | Dedicated renderer / input path | 6 |
| peakValleySensitivity | 40 | Yes | Dedicated renderer / input path | 5 |
| peakValleyExcludeExtremes | true | Yes | Dedicated renderer / input path | 3 |
| showSummary | false | Yes | Dedicated renderer / input path | 10 |
| widthMode | "automatic" | Yes | Dedicated renderer / input path | 4 |
| showOnRight | false | Yes | Dedicated renderer / input path | 4 |
| mirror | false | Yes | Dedicated renderer / input path | 10 |
| lockPosition | false | Yes | Dedicated renderer / input path | 2 |
| showAboveBars | true | Yes | Dedicated renderer / input path | 3 |
| minimumTextSize | 7 | Not individually established | Dedicated renderer / input path | 2 |
| maximumTextSize | 11 | Not individually established | Dedicated renderer / input path | 3 |
| gradientPreset | "off" | Yes | Dedicated renderer / input path | 13 |
| colourCalculation | "time" | Yes | Dedicated renderer / input path | 3 |
| colourReference | "fixed" | Yes | Dedicated renderer / input path | 3 |
| fixedVolumeColor | "#22D3EE" | Yes | Dedicated renderer / input path | 3 |
| fixedBidColor | "#FB7185" | Yes | Dedicated renderer / input path | 3 |
| fixedAskColor | "#22D3EE" | Yes | Dedicated renderer / input path | 3 |
| range1Enabled | true | Yes | Dedicated renderer / input path | 3 |
| range1VolumeColor | "#64748B" | Yes | Dedicated renderer / input path | 2 |
| range1BidColor | "#FB7185" | Yes | Dedicated renderer / input path | 3 |
| range1AskColor | "#22D3EE" | Yes | Dedicated renderer / input path | 3 |
| range2Enabled | true | Yes | Dedicated renderer / input path | 3 |
| range2VolumeColor | "#38BDF8" | Yes | Dedicated renderer / input path | 2 |
| range2BidColor | "#F43F5E" | Yes | Dedicated renderer / input path | 3 |
| range2AskColor | "#06B6D4" | Yes | Dedicated renderer / input path | 3 |
| range3Enabled | true | Yes | Dedicated renderer / input path | 3 |
| range3VolumeColor | "#8B5CF6" | Yes | Dedicated renderer / input path | 2 |
| range3BidColor | "#E11D48" | Yes | Dedicated renderer / input path | 3 |
| range3AskColor | "#0891B2" | Yes | Dedicated renderer / input path | 3 |
| range4Enabled | true | Yes | Dedicated renderer / input path | 3 |
| range4VolumeColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| range4BidColor | "#BE123C" | Yes | Dedicated renderer / input path | 3 |
| range4AskColor | "#0E7490" | Yes | Dedicated renderer / input path | 3 |
| initialAColorEnabled | false | Yes | Dedicated renderer / input path | 3 |
| initialAColor | "#F59E0B" | Yes | Dedicated renderer / input path | 3 |
| initialBColorEnabled | false | Yes | Dedicated renderer / input path | 3 |
| initialBColor | "#A855F7" | Yes | Dedicated renderer / input path | 3 |
| initialCColorEnabled | false | Yes | Dedicated renderer / input path | 3 |
| initialCColor | "#3B82F6" | Yes | Dedicated renderer / input path | 3 |
| initialDColorEnabled | false | Yes | Dedicated renderer / input path | 3 |
| initialDColor | "#14B8A6" | Yes | Dedicated renderer / input path | 3 |
| colorOpenEnabled | false | Yes | Dedicated renderer / input path | 3 |
| openColor | "#22C55E" | Yes | Dedicated renderer / input path | 4 |
| colorCloseEnabled | false | Yes | Dedicated renderer / input path | 3 |
| closeColor | "#F43F5E" | Not individually established | Dedicated renderer / input path | 4 |
| barMarkerEnabled | false | Yes | Dedicated renderer / input path | 3 |
| barMarkerStyle | "candle" | Yes | Dedicated renderer / input path | 3 |
| barMarkerUpColor | "#22D3EE" | Yes | Dedicated renderer / input path | 3 |
| barMarkerDownColor | "#FB7185" | Yes | Dedicated renderer / input path | 3 |
| barMarkerShowOpenClose | true | Yes | Dedicated renderer / input path | 3 |
| pocLineMode | "final" | Yes | Dedicated renderer / input path | 5 |
| pocHighlight | true | Yes | Dedicated renderer / input path | 3 |
| pocHighlightColor | "#F5B83B" | Yes | Dedicated renderer / input path | 3 |
| pocLineColor | "#F5B83B" | Yes | Dedicated renderer / input path | 3 |
| pocExtensionMode | "none" | Yes | Dedicated renderer / input path | 7 |
| showPocPriceLabel | true | Yes | Dedicated renderer / input path | 3 |
| valueAreaHighlight | true | Yes | Dedicated renderer / input path | 3 |
| valueAreaHighlightInside | true | Yes | Dedicated renderer / input path | 3 |
| valueAreaOutsideColor | "#475569" | Yes | Dedicated renderer / input path | 3 |
| valueAreaShowLines | true | Yes | Dedicated renderer / input path | 4 |
| recentLevelsOnly | false | Yes | Dedicated renderer / input path | 3 |
| valueAreaShowBackground | false | Yes | Dedicated renderer / input path | 3 |
| valueAreaExtensionMode | "none" | Yes | Dedicated renderer / input path | 7 |
| valueAreaLineColor | "#60A5FA" | Yes | Dedicated renderer / input path | 5 |
| valueAreaShowLabels | true | Yes | Dedicated renderer / input path | 3 |
| singlePrintExtensionMode | "to-next-profile" | Yes | Dedicated renderer / input path | 3 |
| singlePrintFillZone | true | Yes | Dedicated renderer / input path | 3 |
| singlePrintShowLabel | true | Yes | Dedicated renderer / input path | 3 |
| singlePrintShowTestedState | true | Yes | Dedicated renderer / input path | 2 |
| initialBalanceShowHigh | true | Yes | Dedicated renderer / input path | 3 |
| initialBalanceShowLow | true | Yes | Dedicated renderer / input path | 3 |
| initialBalanceShowRangeLabel | false | Yes | Dedicated renderer / input path | 2 |
| initialBalanceShowExtensions | false | Yes | Dedicated renderer / input path | 3 |
| initialBalanceExtensionMultiples | "1,1.5,2" | Not individually established | Dedicated renderer / input path | 3 |
| initialBalanceLineColor | "#94A3B8" | Yes | Dedicated renderer / input path | 3 |
| summaryLayout | "compact" | Yes | Dedicated renderer / input path | 3 |
| summaryLocation | "top-left" | Yes | Dedicated renderer / input path | 3 |
| summaryShowVolume | true | Yes | Dedicated renderer / input path | 3 |
| summaryShowTrades | true | Yes | Dedicated renderer / input path | 3 |
| summaryShowBidAsk | true | Yes | Dedicated renderer / input path | 3 |
| summaryTextColor | "#F5F7FA" | Yes | Dedicated renderer / input path | 8 |
| summaryBackgroundColor | "#090B10" | Yes | Dedicated renderer / input path | 3 |
| filterMode | "none" | Yes | Dedicated renderer / input path | 16 |
| filterTime | "" | Yes | Dedicated renderer / input path | 16 |
| sessionStartMinutes | 510 | Not individually established | Dedicated renderer / input path | 9 |
| sessionEndMinutes | 915 | Not individually established | Dedicated renderer / input path | 9 |
| sessionAsiaEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionTokyoEnabled | false | Yes | Dedicated renderer / input path | 5 |
| sessionLondonEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionNewYorkEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionPreset | "eth" | Not individually established | Dedicated renderer / input path | 3 |
| customSessionStart | "17:00:00" | Not individually established | Dedicated renderer / input path | 4 |
| customSessionEnd | "16:00:00" | Not individually established | Dedicated renderer / input path | 4 |
| useEndSessionAsStartDay | false | Yes | Dedicated renderer / input path | 10 |
| inheritThemeColours | true | Yes | Dedicated renderer / input path | 3 |
| profileColor | "#22D3EE" | Yes | Dedicated renderer / input path | 3 |
| pocColor | "#F5B83B" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#60A5FA" | Yes | Dedicated renderer / input path | 18 |
| singlePrintColor | "#FB7185" | Yes | Dedicated renderer / input path | 6 |
| peakColor | "#A3E635" | Yes | Dedicated renderer / input path | 7 |
| valleyColor | "#8B5CF6" | Yes | Dedicated renderer / input path | 7 |
| allowDevelopingComposite | true | Yes | Dedicated renderer / input path | 2 |

## Weekly Volume Profile

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| groupTicks | 4 | Yes | Dedicated renderer / input path | 26 |
| autoGroupFactor | 1 | Not individually established | Dedicated renderer / input path | 13 |
| profileWidth | 2 | Yes | Dedicated renderer / input path | 7 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| minTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| maxTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| weekSelection | "rolling-five" | Not individually established | Dedicated renderer / input path | 1 |
| weeklyWindowSettingsVersion | 2 | Not individually established | Dedicated renderer / input path | 0 |
| valueAreaPercent | 68 | Yes | Dedicated renderer / input path | 30 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| pocLineWidth | 1 | Yes | Dedicated renderer / input path | 10 |
| pocHighlightOpacity | 100 | Yes | Dedicated renderer / input path | 2 |
| developingPocStartMinutes | 0 | Yes | Dedicated renderer / input path | 2 |
| shiftedPocTicks | 4 | Yes | Dedicated renderer / input path | 6 |
| shiftedPocOpacity | 35 | Yes | Dedicated renderer / input path | 3 |
| pocLineMode | "show" | Yes | Dedicated renderer / input path | 5 |
| pocExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| valueAreaLineWidth | 2 | Yes | Dedicated renderer / input path | 10 |
| valueAreaDeveloping | "no" | Yes | Dedicated renderer / input path | 1 |
| valueAreaExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| showPeaks | false | Yes | Dedicated renderer / input path | 6 |
| showValleys | false | Yes | Dedicated renderer / input path | 6 |
| pvSensitivity | 40 | Yes | Dedicated renderer / input path | 2 |
| pvExcludeHighLow | true | Yes | Dedicated renderer / input path | 2 |
| peakMinVolumePercent | 1 | Yes | Dedicated renderer / input path | 3 |
| valleyMaxVolumePercent | 0 | Yes | Dedicated renderer / input path | 3 |
| peakOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| valleyOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| peakLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| valleyLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| peakExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| valleyExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| showBusinessZone | false | Yes | Dedicated renderer / input path | 2 |
| businessZoneOpacity | 3 | Yes | Dedicated renderer / input path | 2 |
| businessZoneLineWidth | 0 | Yes | Dedicated renderer / input path | 2 |
| vwapEnabled | false | Yes | Dedicated renderer / input path | 1 |
| showVwapLine | true | Yes | Dedicated renderer / input path | 4 |
| vwapHighlight | false | Yes | Dedicated renderer / input path | 1 |
| showDevelopingVwap | false | Yes | Dedicated renderer / input path | 3 |
| showVwapBands | false | Yes | Dedicated renderer / input path | 3 |
| vwapLineWidth | 1 | Yes | Dedicated renderer / input path | 4 |
| vwapLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| vwapHighlightOpacity | 18 | Yes | Dedicated renderer / input path | 2 |
| vwapExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| vwapBand1 | 1 | Yes | Dedicated renderer / input path | 3 |
| vwapBand2 | 2 | Yes | Dedicated renderer / input path | 3 |
| vwapBand3 | 0 | Yes | Dedicated renderer / input path | 3 |
| showSummaryVolume | true | Yes | Dedicated renderer / input path | 2 |
| showSummaryTrades | false | Yes | Dedicated renderer / input path | 3 |
| filterMode | "none" | Not individually established | Dedicated renderer / input path | 16 |
| filterTime | "rth" | Not individually established | Dedicated renderer / input path | 16 |
| levelLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| showLevelLabels | true | Yes | Dedicated renderer / input path | 7 |
| levelLabelSide | "right" | Yes | Dedicated renderer / input path | 4 |
| showLevelLabelPrice | true | Yes | Dedicated renderer / input path | 4 |
| visualStyle | "automatic" | Yes | Dedicated renderer / input path | 6 |
| widthMode | "period-percent" | Yes | Dedicated renderer / input path | 4 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| numberOfProfiles | 0 | Yes | Dedicated renderer / input path | 5 |
| previousProfileWidth | 2 | Yes | Dedicated renderer / input path | 1 |
| currentProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| previousProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| sessionStartMinutes | 510 | Not individually established | Dedicated renderer / input path | 9 |
| sessionEndMinutes | 915 | Not individually established | Dedicated renderer / input path | 9 |
| useEndSessionAsStartDay | false | Yes | Dedicated renderer / input path | 10 |
| profileMode | "volume" | Yes | Dedicated renderer / input path | 7 |
| groupingMode | "manual" | Yes | Dedicated renderer / input path | 13 |
| gradientPreset | "off" | Yes | Dedicated renderer / input path | 13 |
| sessionSelectionArmed | false | Not individually established | Dedicated renderer / input path | 0 |
| sessionAsiaEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionTokyoEnabled | false | Yes | Dedicated renderer / input path | 5 |
| sessionLondonEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionNewYorkEnabled | true | Yes | Dedicated renderer / input path | 5 |
| snapMode | "left" | Yes | Dedicated renderer / input path | 7 |
| useThemeColors | true | Not individually established | Dedicated renderer / input path | 75 |
| showText | false | Yes | Dedicated renderer / input path | 7 |
| showValueArea | true | Yes | Dedicated renderer / input path | 12 |
| showPocLine | true | Yes | Dedicated renderer / input path | 6 |
| showValueAreaLines | true | Yes | Dedicated renderer / input path | 9 |
| recentLevelsOnly | false | Yes | Dedicated renderer / input path | 3 |
| showDelta | true | Yes | Dedicated renderer / input path | 5 |
| showProfileSpine | true | Yes | Dedicated renderer / input path | 4 |
| showDevelopingPoc | false | Yes | Dedicated renderer / input path | 6 |
| showPocHighlight | true | Yes | Dedicated renderer / input path | 4 |
| showProfileOutline | true | Yes | Dedicated renderer / input path | 4 |
| showSummary | false | Yes | Dedicated renderer / input path | 10 |
| profileSettingsVersion | 15 | Not individually established | Dedicated renderer / input path | 1 |
| volumeColor | "#22C55E" | Yes | Dedicated renderer / input path | 4 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| pocColor | "#22C55E" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#22C55E" | Yes | Dedicated renderer / input path | 18 |
| peakColor | "#22C55E" | Yes | Dedicated renderer / input path | 7 |
| valleyColor | "#EF4444" | Yes | Dedicated renderer / input path | 7 |
| businessZoneColor | "#22C55E" | Yes | Dedicated renderer / input path | 2 |
| vwapColor | "#F59E0B" | Yes | Dedicated renderer / input path | 8 |
| vwapHighlightColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| vwapBandColor | "#71717A" | Yes | Dedicated renderer / input path | 5 |
| summaryTextColor | "#22C55E" | Yes | Dedicated renderer / input path | 8 |

## Monthly Volume Profile

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| profileWidth | 2 | Yes | Dedicated renderer / input path | 7 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| valueAreaPercent | 68 | Yes | Dedicated renderer / input path | 30 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| minTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| maxTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| autoGroupFactor | 1 | Not individually established | Dedicated renderer / input path | 13 |
| groupTicks | 4 | Yes | Dedicated renderer / input path | 26 |
| pocLineWidth | 1 | Yes | Dedicated renderer / input path | 10 |
| pocHighlightOpacity | 100 | Yes | Dedicated renderer / input path | 2 |
| developingPocStartMinutes | 0 | Yes | Dedicated renderer / input path | 2 |
| shiftedPocTicks | 4 | Yes | Dedicated renderer / input path | 6 |
| shiftedPocOpacity | 35 | Yes | Dedicated renderer / input path | 3 |
| pocLineMode | "show" | Yes | Dedicated renderer / input path | 5 |
| pocExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| valueAreaLineWidth | 2 | Yes | Dedicated renderer / input path | 10 |
| valueAreaDeveloping | "no" | Yes | Dedicated renderer / input path | 1 |
| valueAreaExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| showPeaks | false | Yes | Dedicated renderer / input path | 6 |
| showValleys | false | Yes | Dedicated renderer / input path | 6 |
| pvSensitivity | 40 | Yes | Dedicated renderer / input path | 2 |
| pvExcludeHighLow | true | Yes | Dedicated renderer / input path | 2 |
| peakMinVolumePercent | 1 | Yes | Dedicated renderer / input path | 3 |
| valleyMaxVolumePercent | 0 | Yes | Dedicated renderer / input path | 3 |
| peakOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| valleyOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| peakLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| valleyLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| peakExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| valleyExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| showBusinessZone | false | Yes | Dedicated renderer / input path | 2 |
| businessZoneOpacity | 3 | Yes | Dedicated renderer / input path | 2 |
| businessZoneLineWidth | 0 | Yes | Dedicated renderer / input path | 2 |
| vwapEnabled | false | Yes | Dedicated renderer / input path | 1 |
| showVwapLine | true | Yes | Dedicated renderer / input path | 4 |
| vwapHighlight | false | Yes | Dedicated renderer / input path | 1 |
| showDevelopingVwap | false | Yes | Dedicated renderer / input path | 3 |
| showVwapBands | false | Yes | Dedicated renderer / input path | 3 |
| vwapLineWidth | 1 | Yes | Dedicated renderer / input path | 4 |
| vwapLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| vwapHighlightOpacity | 18 | Yes | Dedicated renderer / input path | 2 |
| vwapExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| vwapBand1 | 1 | Yes | Dedicated renderer / input path | 3 |
| vwapBand2 | 2 | Yes | Dedicated renderer / input path | 3 |
| vwapBand3 | 0 | Yes | Dedicated renderer / input path | 3 |
| showSummaryVolume | true | Yes | Dedicated renderer / input path | 2 |
| showSummaryTrades | false | Yes | Dedicated renderer / input path | 3 |
| filterMode | "none" | Not individually established | Dedicated renderer / input path | 16 |
| filterTime | "rth" | Not individually established | Dedicated renderer / input path | 16 |
| levelLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| showLevelLabels | true | Yes | Dedicated renderer / input path | 7 |
| levelLabelSide | "right" | Yes | Dedicated renderer / input path | 4 |
| showLevelLabelPrice | true | Yes | Dedicated renderer / input path | 4 |
| visualStyle | "automatic" | Yes | Dedicated renderer / input path | 6 |
| widthMode | "period-percent" | Yes | Dedicated renderer / input path | 4 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| numberOfProfiles | 3 | Yes | Dedicated renderer / input path | 5 |
| previousProfileWidth | 2 | Yes | Dedicated renderer / input path | 1 |
| currentProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| previousProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| sessionStartMinutes | 510 | Not individually established | Dedicated renderer / input path | 9 |
| sessionEndMinutes | 915 | Not individually established | Dedicated renderer / input path | 9 |
| useEndSessionAsStartDay | false | Yes | Dedicated renderer / input path | 10 |
| profileMode | "volume" | Yes | Dedicated renderer / input path | 7 |
| groupingMode | "manual" | Yes | Dedicated renderer / input path | 13 |
| gradientPreset | "off" | Yes | Dedicated renderer / input path | 13 |
| sessionSelectionArmed | false | Not individually established | Dedicated renderer / input path | 0 |
| sessionAsiaEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionTokyoEnabled | false | Yes | Dedicated renderer / input path | 5 |
| sessionLondonEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionNewYorkEnabled | true | Yes | Dedicated renderer / input path | 5 |
| snapMode | "left" | Yes | Dedicated renderer / input path | 7 |
| useThemeColors | true | Not individually established | Dedicated renderer / input path | 75 |
| showText | false | Yes | Dedicated renderer / input path | 7 |
| showValueArea | true | Yes | Dedicated renderer / input path | 12 |
| showPocLine | true | Yes | Dedicated renderer / input path | 6 |
| showValueAreaLines | true | Yes | Dedicated renderer / input path | 9 |
| recentLevelsOnly | true | Yes | Dedicated renderer / input path | 3 |
| showDelta | true | Yes | Dedicated renderer / input path | 5 |
| showProfileSpine | true | Yes | Dedicated renderer / input path | 4 |
| showDevelopingPoc | false | Yes | Dedicated renderer / input path | 6 |
| showPocHighlight | true | Yes | Dedicated renderer / input path | 4 |
| showProfileOutline | true | Yes | Dedicated renderer / input path | 4 |
| showSummary | false | Yes | Dedicated renderer / input path | 10 |
| profileSettingsVersion | 15 | Not individually established | Dedicated renderer / input path | 1 |
| volumeColor | "#22C55E" | Yes | Dedicated renderer / input path | 4 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| pocColor | "#22C55E" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#22C55E" | Yes | Dedicated renderer / input path | 18 |
| peakColor | "#22C55E" | Yes | Dedicated renderer / input path | 7 |
| valleyColor | "#EF4444" | Yes | Dedicated renderer / input path | 7 |
| businessZoneColor | "#22C55E" | Yes | Dedicated renderer / input path | 2 |
| vwapColor | "#F59E0B" | Yes | Dedicated renderer / input path | 8 |
| vwapHighlightColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| vwapBandColor | "#71717A" | Yes | Dedicated renderer / input path | 5 |
| summaryTextColor | "#22C55E" | Yes | Dedicated renderer / input path | 8 |

## Session Volume Profile

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| profileWidth | 2 | Yes | Dedicated renderer / input path | 7 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| valueAreaPercent | 68 | Yes | Dedicated renderer / input path | 30 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| minTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| maxTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| autoGroupFactor | 1 | Not individually established | Dedicated renderer / input path | 13 |
| groupTicks | 4 | Yes | Dedicated renderer / input path | 26 |
| pocLineWidth | 1 | Yes | Dedicated renderer / input path | 10 |
| pocHighlightOpacity | 100 | Yes | Dedicated renderer / input path | 2 |
| developingPocStartMinutes | 0 | Yes | Dedicated renderer / input path | 2 |
| shiftedPocTicks | 4 | Yes | Dedicated renderer / input path | 6 |
| shiftedPocOpacity | 35 | Yes | Dedicated renderer / input path | 3 |
| pocLineMode | "show" | Yes | Dedicated renderer / input path | 5 |
| pocExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| valueAreaLineWidth | 2 | Yes | Dedicated renderer / input path | 10 |
| valueAreaDeveloping | "no" | Yes | Dedicated renderer / input path | 1 |
| valueAreaExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| showPeaks | false | Yes | Dedicated renderer / input path | 6 |
| showValleys | false | Yes | Dedicated renderer / input path | 6 |
| pvSensitivity | 40 | Yes | Dedicated renderer / input path | 2 |
| pvExcludeHighLow | true | Yes | Dedicated renderer / input path | 2 |
| peakMinVolumePercent | 1 | Yes | Dedicated renderer / input path | 3 |
| valleyMaxVolumePercent | 0 | Yes | Dedicated renderer / input path | 3 |
| peakOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| valleyOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| peakLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| valleyLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| peakExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| valleyExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| showBusinessZone | false | Yes | Dedicated renderer / input path | 2 |
| businessZoneOpacity | 3 | Yes | Dedicated renderer / input path | 2 |
| businessZoneLineWidth | 0 | Yes | Dedicated renderer / input path | 2 |
| vwapEnabled | false | Yes | Dedicated renderer / input path | 1 |
| showVwapLine | true | Yes | Dedicated renderer / input path | 4 |
| vwapHighlight | false | Yes | Dedicated renderer / input path | 1 |
| showDevelopingVwap | false | Yes | Dedicated renderer / input path | 3 |
| showVwapBands | false | Yes | Dedicated renderer / input path | 3 |
| vwapLineWidth | 1 | Yes | Dedicated renderer / input path | 4 |
| vwapLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| vwapHighlightOpacity | 18 | Yes | Dedicated renderer / input path | 2 |
| vwapExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| vwapBand1 | 1 | Yes | Dedicated renderer / input path | 3 |
| vwapBand2 | 2 | Yes | Dedicated renderer / input path | 3 |
| vwapBand3 | 0 | Yes | Dedicated renderer / input path | 3 |
| showSummaryVolume | true | Yes | Dedicated renderer / input path | 2 |
| showSummaryTrades | false | Yes | Dedicated renderer / input path | 3 |
| filterMode | "filter" | Not individually established | Dedicated renderer / input path | 16 |
| filterTime | "rth" | Not individually established | Dedicated renderer / input path | 16 |
| levelLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| showLevelLabels | true | Yes | Dedicated renderer / input path | 7 |
| levelLabelSide | "right" | Yes | Dedicated renderer / input path | 4 |
| showLevelLabelPrice | true | Yes | Dedicated renderer / input path | 4 |
| visualStyle | "automatic" | Yes | Dedicated renderer / input path | 6 |
| widthMode | "period-percent" | Yes | Dedicated renderer / input path | 4 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| numberOfProfiles | 5 | Yes | Dedicated renderer / input path | 5 |
| previousProfileWidth | 2 | Yes | Dedicated renderer / input path | 1 |
| currentProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| previousProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| sessionStartMinutes | 510 | Not individually established | Dedicated renderer / input path | 9 |
| sessionEndMinutes | 915 | Not individually established | Dedicated renderer / input path | 9 |
| useEndSessionAsStartDay | false | Yes | Dedicated renderer / input path | 10 |
| profileMode | "volume" | Yes | Dedicated renderer / input path | 7 |
| groupingMode | "manual" | Yes | Dedicated renderer / input path | 13 |
| gradientPreset | "off" | Yes | Dedicated renderer / input path | 13 |
| sessionSelectionArmed | false | Not individually established | Dedicated renderer / input path | 0 |
| sessionAsiaEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionTokyoEnabled | false | Yes | Dedicated renderer / input path | 5 |
| sessionLondonEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionNewYorkEnabled | true | Yes | Dedicated renderer / input path | 5 |
| snapMode | "left" | Yes | Dedicated renderer / input path | 7 |
| useThemeColors | true | Not individually established | Dedicated renderer / input path | 75 |
| showText | false | Yes | Dedicated renderer / input path | 7 |
| showValueArea | true | Yes | Dedicated renderer / input path | 12 |
| showPocLine | true | Yes | Dedicated renderer / input path | 6 |
| showValueAreaLines | true | Yes | Dedicated renderer / input path | 9 |
| recentLevelsOnly | false | Yes | Dedicated renderer / input path | 3 |
| showDelta | true | Yes | Dedicated renderer / input path | 5 |
| showProfileSpine | true | Yes | Dedicated renderer / input path | 4 |
| showDevelopingPoc | false | Yes | Dedicated renderer / input path | 6 |
| showPocHighlight | true | Yes | Dedicated renderer / input path | 4 |
| showProfileOutline | true | Yes | Dedicated renderer / input path | 4 |
| showSummary | false | Yes | Dedicated renderer / input path | 10 |
| profileSettingsVersion | 15 | Not individually established | Dedicated renderer / input path | 1 |
| volumeColor | "#22C55E" | Yes | Dedicated renderer / input path | 4 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| pocColor | "#22C55E" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#22C55E" | Yes | Dedicated renderer / input path | 18 |
| peakColor | "#22C55E" | Yes | Dedicated renderer / input path | 7 |
| valleyColor | "#EF4444" | Yes | Dedicated renderer / input path | 7 |
| businessZoneColor | "#22C55E" | Yes | Dedicated renderer / input path | 2 |
| vwapColor | "#F59E0B" | Yes | Dedicated renderer / input path | 8 |
| vwapHighlightColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| vwapBandColor | "#71717A" | Yes | Dedicated renderer / input path | 5 |
| summaryTextColor | "#22C55E" | Yes | Dedicated renderer / input path | 8 |

## Composite Volume Profile

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| compositeLengthValue | 500 | Not individually established | Dedicated renderer / input path | 1 |
| groupTicks | 4 | Yes | Dedicated renderer / input path | 26 |
| autoGroupFactor | 1 | Not individually established | Dedicated renderer / input path | 13 |
| profileWidth | 2 | Yes | Dedicated renderer / input path | 7 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| minTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| maxTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| valueAreaPercent | 68 | Yes | Dedicated renderer / input path | 30 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| pocLineWidth | 1 | Yes | Dedicated renderer / input path | 10 |
| pocHighlightOpacity | 100 | Yes | Dedicated renderer / input path | 2 |
| developingPocStartMinutes | 0 | Yes | Dedicated renderer / input path | 2 |
| shiftedPocTicks | 4 | Yes | Dedicated renderer / input path | 6 |
| shiftedPocOpacity | 35 | Yes | Dedicated renderer / input path | 3 |
| pocLineMode | "show" | Yes | Dedicated renderer / input path | 5 |
| pocExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| valueAreaLineWidth | 2 | Yes | Dedicated renderer / input path | 10 |
| valueAreaDeveloping | "no" | Yes | Dedicated renderer / input path | 1 |
| valueAreaExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| showPeaks | false | Yes | Dedicated renderer / input path | 6 |
| showValleys | false | Yes | Dedicated renderer / input path | 6 |
| pvSensitivity | 40 | Yes | Dedicated renderer / input path | 2 |
| pvExcludeHighLow | true | Yes | Dedicated renderer / input path | 2 |
| peakMinVolumePercent | 1 | Yes | Dedicated renderer / input path | 3 |
| valleyMaxVolumePercent | 0 | Yes | Dedicated renderer / input path | 3 |
| peakOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| valleyOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| peakLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| valleyLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| peakExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| valleyExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| showBusinessZone | false | Yes | Dedicated renderer / input path | 2 |
| businessZoneOpacity | 3 | Yes | Dedicated renderer / input path | 2 |
| businessZoneLineWidth | 0 | Yes | Dedicated renderer / input path | 2 |
| vwapEnabled | false | Yes | Dedicated renderer / input path | 1 |
| showVwapLine | true | Yes | Dedicated renderer / input path | 4 |
| vwapHighlight | false | Yes | Dedicated renderer / input path | 1 |
| showDevelopingVwap | false | Yes | Dedicated renderer / input path | 3 |
| showVwapBands | false | Yes | Dedicated renderer / input path | 3 |
| vwapLineWidth | 1 | Yes | Dedicated renderer / input path | 4 |
| vwapLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| vwapHighlightOpacity | 18 | Yes | Dedicated renderer / input path | 2 |
| vwapExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| vwapBand1 | 1 | Yes | Dedicated renderer / input path | 3 |
| vwapBand2 | 2 | Yes | Dedicated renderer / input path | 3 |
| vwapBand3 | 0 | Yes | Dedicated renderer / input path | 3 |
| showSummaryVolume | true | Yes | Dedicated renderer / input path | 2 |
| showSummaryTrades | false | Yes | Dedicated renderer / input path | 3 |
| filterMode | "none" | Not individually established | Dedicated renderer / input path | 16 |
| filterTime | "rth" | Not individually established | Dedicated renderer / input path | 16 |
| levelLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| showLevelLabels | true | Yes | Dedicated renderer / input path | 7 |
| levelLabelSide | "right" | Yes | Dedicated renderer / input path | 4 |
| showLevelLabelPrice | true | Yes | Dedicated renderer / input path | 4 |
| visualStyle | "automatic" | Yes | Dedicated renderer / input path | 6 |
| widthMode | "period-percent" | Yes | Dedicated renderer / input path | 4 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| numberOfProfiles | 0 | Yes | Dedicated renderer / input path | 5 |
| previousProfileWidth | 2 | Yes | Dedicated renderer / input path | 1 |
| currentProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| previousProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| sessionStartMinutes | 510 | Not individually established | Dedicated renderer / input path | 9 |
| sessionEndMinutes | 915 | Not individually established | Dedicated renderer / input path | 9 |
| useEndSessionAsStartDay | false | Yes | Dedicated renderer / input path | 10 |
| profileMode | "volume" | Yes | Dedicated renderer / input path | 7 |
| groupingMode | "manual" | Yes | Dedicated renderer / input path | 13 |
| gradientPreset | "off" | Yes | Dedicated renderer / input path | 13 |
| sessionSelectionArmed | false | Not individually established | Dedicated renderer / input path | 0 |
| sessionAsiaEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionTokyoEnabled | false | Yes | Dedicated renderer / input path | 5 |
| sessionLondonEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionNewYorkEnabled | true | Yes | Dedicated renderer / input path | 5 |
| snapMode | "right" | Yes | Dedicated renderer / input path | 7 |
| useThemeColors | true | Not individually established | Dedicated renderer / input path | 75 |
| showText | false | Yes | Dedicated renderer / input path | 7 |
| showValueArea | true | Yes | Dedicated renderer / input path | 12 |
| showPocLine | true | Yes | Dedicated renderer / input path | 6 |
| showValueAreaLines | true | Yes | Dedicated renderer / input path | 9 |
| recentLevelsOnly | true | Yes | Dedicated renderer / input path | 3 |
| showDelta | true | Yes | Dedicated renderer / input path | 5 |
| showProfileSpine | false | Yes | Dedicated renderer / input path | 4 |
| showDevelopingPoc | false | Yes | Dedicated renderer / input path | 6 |
| showPocHighlight | true | Yes | Dedicated renderer / input path | 4 |
| showProfileOutline | true | Yes | Dedicated renderer / input path | 4 |
| showSummary | false | Yes | Dedicated renderer / input path | 10 |
| profileSettingsVersion | 15 | Not individually established | Dedicated renderer / input path | 1 |
| volumeColor | "#22C55E" | Yes | Dedicated renderer / input path | 4 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| pocColor | "#22C55E" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#22C55E" | Yes | Dedicated renderer / input path | 18 |
| peakColor | "#22C55E" | Yes | Dedicated renderer / input path | 7 |
| valleyColor | "#EF4444" | Yes | Dedicated renderer / input path | 7 |
| businessZoneColor | "#22C55E" | Yes | Dedicated renderer / input path | 2 |
| vwapColor | "#F59E0B" | Yes | Dedicated renderer / input path | 8 |
| vwapHighlightColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| vwapBandColor | "#71717A" | Yes | Dedicated renderer / input path | 5 |
| summaryTextColor | "#22C55E" | Yes | Dedicated renderer / input path | 8 |
| compositeRangeMode | "loaded-range" | Yes | Dedicated renderer / input path | 1 |
| compositeCustomStartMs | "" | Not individually established | Dedicated renderer / input path | 1 |
| compositeCustomEndMs | "" | Not individually established | Dedicated renderer / input path | 1 |
| compositeCustomEndFollowsLatest | true | Yes | Dedicated renderer / input path | 1 |

## Visible Range Volume Profile

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| profileWidth | 2 | Yes | Dedicated renderer / input path | 7 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| valueAreaPercent | 68 | Yes | Dedicated renderer / input path | 30 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| minTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| maxTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| autoGroupFactor | 1 | Not individually established | Dedicated renderer / input path | 13 |
| groupTicks | 4 | Yes | Dedicated renderer / input path | 26 |
| pocLineWidth | 1 | Yes | Dedicated renderer / input path | 10 |
| pocHighlightOpacity | 100 | Yes | Dedicated renderer / input path | 2 |
| developingPocStartMinutes | 0 | Yes | Dedicated renderer / input path | 2 |
| shiftedPocTicks | 4 | Yes | Dedicated renderer / input path | 6 |
| shiftedPocOpacity | 35 | Yes | Dedicated renderer / input path | 3 |
| pocLineMode | "show" | Yes | Dedicated renderer / input path | 5 |
| pocExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| valueAreaLineWidth | 2 | Yes | Dedicated renderer / input path | 10 |
| valueAreaDeveloping | "no" | Yes | Dedicated renderer / input path | 1 |
| valueAreaExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| showPeaks | false | Yes | Dedicated renderer / input path | 6 |
| showValleys | false | Yes | Dedicated renderer / input path | 6 |
| pvSensitivity | 40 | Yes | Dedicated renderer / input path | 2 |
| pvExcludeHighLow | true | Yes | Dedicated renderer / input path | 2 |
| peakMinVolumePercent | 1 | Yes | Dedicated renderer / input path | 3 |
| valleyMaxVolumePercent | 0 | Yes | Dedicated renderer / input path | 3 |
| peakOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| valleyOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| peakLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| valleyLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| peakExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| valleyExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| showBusinessZone | false | Yes | Dedicated renderer / input path | 2 |
| businessZoneOpacity | 3 | Yes | Dedicated renderer / input path | 2 |
| businessZoneLineWidth | 0 | Yes | Dedicated renderer / input path | 2 |
| vwapEnabled | false | Yes | Dedicated renderer / input path | 1 |
| showVwapLine | true | Yes | Dedicated renderer / input path | 4 |
| vwapHighlight | false | Yes | Dedicated renderer / input path | 1 |
| showDevelopingVwap | false | Yes | Dedicated renderer / input path | 3 |
| showVwapBands | false | Yes | Dedicated renderer / input path | 3 |
| vwapLineWidth | 1 | Yes | Dedicated renderer / input path | 4 |
| vwapLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| vwapHighlightOpacity | 18 | Yes | Dedicated renderer / input path | 2 |
| vwapExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| vwapBand1 | 1 | Yes | Dedicated renderer / input path | 3 |
| vwapBand2 | 2 | Yes | Dedicated renderer / input path | 3 |
| vwapBand3 | 0 | Yes | Dedicated renderer / input path | 3 |
| showSummaryVolume | true | Yes | Dedicated renderer / input path | 2 |
| showSummaryTrades | false | Yes | Dedicated renderer / input path | 3 |
| filterMode | "none" | Not individually established | Dedicated renderer / input path | 16 |
| filterTime | "rth" | Not individually established | Dedicated renderer / input path | 16 |
| levelLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| showLevelLabels | true | Yes | Dedicated renderer / input path | 7 |
| levelLabelSide | "right" | Yes | Dedicated renderer / input path | 4 |
| showLevelLabelPrice | true | Yes | Dedicated renderer / input path | 4 |
| visualStyle | "automatic" | Yes | Dedicated renderer / input path | 6 |
| widthMode | "window-percent" | Yes | Dedicated renderer / input path | 4 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| numberOfProfiles | 1 | Yes | Dedicated renderer / input path | 5 |
| previousProfileWidth | 2 | Yes | Dedicated renderer / input path | 1 |
| currentProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| previousProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| sessionStartMinutes | 510 | Not individually established | Dedicated renderer / input path | 9 |
| sessionEndMinutes | 915 | Not individually established | Dedicated renderer / input path | 9 |
| useEndSessionAsStartDay | false | Yes | Dedicated renderer / input path | 10 |
| profileMode | "volume" | Yes | Dedicated renderer / input path | 7 |
| groupingMode | "manual" | Yes | Dedicated renderer / input path | 13 |
| gradientPreset | "off" | Yes | Dedicated renderer / input path | 13 |
| sessionSelectionArmed | false | Not individually established | Dedicated renderer / input path | 0 |
| sessionAsiaEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionTokyoEnabled | false | Yes | Dedicated renderer / input path | 5 |
| sessionLondonEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionNewYorkEnabled | true | Yes | Dedicated renderer / input path | 5 |
| snapMode | "right" | Yes | Dedicated renderer / input path | 7 |
| useThemeColors | true | Not individually established | Dedicated renderer / input path | 75 |
| showText | false | Yes | Dedicated renderer / input path | 7 |
| showValueArea | true | Yes | Dedicated renderer / input path | 12 |
| showPocLine | true | Yes | Dedicated renderer / input path | 6 |
| showValueAreaLines | true | Yes | Dedicated renderer / input path | 9 |
| recentLevelsOnly | true | Yes | Dedicated renderer / input path | 3 |
| showDelta | true | Yes | Dedicated renderer / input path | 5 |
| showProfileSpine | false | Yes | Dedicated renderer / input path | 4 |
| showDevelopingPoc | false | Yes | Dedicated renderer / input path | 6 |
| showPocHighlight | true | Yes | Dedicated renderer / input path | 4 |
| showProfileOutline | true | Yes | Dedicated renderer / input path | 4 |
| showSummary | false | Yes | Dedicated renderer / input path | 10 |
| profileSettingsVersion | 15 | Not individually established | Dedicated renderer / input path | 1 |
| volumeColor | "#22C55E" | Yes | Dedicated renderer / input path | 4 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| pocColor | "#22C55E" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#22C55E" | Yes | Dedicated renderer / input path | 18 |
| peakColor | "#22C55E" | Yes | Dedicated renderer / input path | 7 |
| valleyColor | "#EF4444" | Yes | Dedicated renderer / input path | 7 |
| businessZoneColor | "#22C55E" | Yes | Dedicated renderer / input path | 2 |
| vwapColor | "#F59E0B" | Yes | Dedicated renderer / input path | 8 |
| vwapHighlightColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| vwapBandColor | "#71717A" | Yes | Dedicated renderer / input path | 5 |
| summaryTextColor | "#22C55E" | Yes | Dedicated renderer / input path | 8 |

## Custom Draw-On Volume Profile

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| groupTicks | 4 | Yes | Dedicated renderer / input path | 26 |
| autoGroupFactor | 1 | Not individually established | Dedicated renderer / input path | 13 |
| profileWidth | 2 | Yes | Dedicated renderer / input path | 7 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| minTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| maxTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| valueAreaPercent | 68 | Yes | Dedicated renderer / input path | 30 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| pocLineWidth | 1 | Yes | Dedicated renderer / input path | 10 |
| pocHighlightOpacity | 100 | Yes | Dedicated renderer / input path | 2 |
| developingPocStartMinutes | 0 | Yes | Dedicated renderer / input path | 2 |
| shiftedPocTicks | 4 | Yes | Dedicated renderer / input path | 6 |
| shiftedPocOpacity | 35 | Yes | Dedicated renderer / input path | 3 |
| pocLineMode | "show" | Yes | Dedicated renderer / input path | 5 |
| pocExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| valueAreaLineWidth | 2 | Yes | Dedicated renderer / input path | 10 |
| valueAreaDeveloping | "no" | Yes | Dedicated renderer / input path | 1 |
| valueAreaExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| showPeaks | false | Yes | Dedicated renderer / input path | 6 |
| showValleys | false | Yes | Dedicated renderer / input path | 6 |
| pvSensitivity | 40 | Yes | Dedicated renderer / input path | 2 |
| pvExcludeHighLow | true | Yes | Dedicated renderer / input path | 2 |
| peakMinVolumePercent | 1 | Yes | Dedicated renderer / input path | 3 |
| valleyMaxVolumePercent | 0 | Yes | Dedicated renderer / input path | 3 |
| peakOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| valleyOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| peakLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| valleyLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| peakExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| valleyExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| showBusinessZone | false | Yes | Dedicated renderer / input path | 2 |
| businessZoneOpacity | 3 | Yes | Dedicated renderer / input path | 2 |
| businessZoneLineWidth | 0 | Yes | Dedicated renderer / input path | 2 |
| vwapEnabled | false | Yes | Dedicated renderer / input path | 1 |
| showVwapLine | true | Yes | Dedicated renderer / input path | 4 |
| vwapHighlight | false | Yes | Dedicated renderer / input path | 1 |
| showDevelopingVwap | false | Yes | Dedicated renderer / input path | 3 |
| showVwapBands | false | Yes | Dedicated renderer / input path | 3 |
| vwapLineWidth | 1 | Yes | Dedicated renderer / input path | 4 |
| vwapLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| vwapHighlightOpacity | 18 | Yes | Dedicated renderer / input path | 2 |
| vwapExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| vwapBand1 | 1 | Yes | Dedicated renderer / input path | 3 |
| vwapBand2 | 2 | Yes | Dedicated renderer / input path | 3 |
| vwapBand3 | 0 | Yes | Dedicated renderer / input path | 3 |
| showSummaryVolume | true | Yes | Dedicated renderer / input path | 2 |
| showSummaryTrades | false | Yes | Dedicated renderer / input path | 3 |
| filterMode | "none" | Not individually established | Dedicated renderer / input path | 16 |
| filterTime | "rth" | Not individually established | Dedicated renderer / input path | 16 |
| levelLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| showLevelLabels | true | Yes | Dedicated renderer / input path | 7 |
| levelLabelSide | "right" | Yes | Dedicated renderer / input path | 4 |
| showLevelLabelPrice | true | Yes | Dedicated renderer / input path | 4 |
| visualStyle | "automatic" | Yes | Dedicated renderer / input path | 6 |
| widthMode | "period-percent" | Yes | Dedicated renderer / input path | 4 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| numberOfProfiles | 0 | Yes | Dedicated renderer / input path | 5 |
| previousProfileWidth | 2 | Yes | Dedicated renderer / input path | 1 |
| currentProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| previousProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| sessionStartMinutes | 510 | Not individually established | Dedicated renderer / input path | 9 |
| sessionEndMinutes | 915 | Not individually established | Dedicated renderer / input path | 9 |
| useEndSessionAsStartDay | false | Yes | Dedicated renderer / input path | 10 |
| profileMode | "volume" | Yes | Dedicated renderer / input path | 7 |
| groupingMode | "manual" | Yes | Dedicated renderer / input path | 13 |
| gradientPreset | "off" | Yes | Dedicated renderer / input path | 13 |
| sessionSelectionArmed | false | Not individually established | Dedicated renderer / input path | 0 |
| sessionAsiaEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionTokyoEnabled | false | Yes | Dedicated renderer / input path | 5 |
| sessionLondonEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionNewYorkEnabled | true | Yes | Dedicated renderer / input path | 5 |
| snapMode | "off" | Not individually established | Dedicated renderer / input path | 7 |
| useThemeColors | true | Not individually established | Dedicated renderer / input path | 75 |
| showText | false | Yes | Dedicated renderer / input path | 7 |
| showValueArea | true | Yes | Dedicated renderer / input path | 12 |
| showPocLine | true | Yes | Dedicated renderer / input path | 6 |
| showValueAreaLines | true | Yes | Dedicated renderer / input path | 9 |
| recentLevelsOnly | false | Yes | Dedicated renderer / input path | 3 |
| showDelta | true | Yes | Dedicated renderer / input path | 5 |
| showProfileSpine | true | Yes | Dedicated renderer / input path | 4 |
| showDevelopingPoc | false | Yes | Dedicated renderer / input path | 6 |
| showPocHighlight | true | Yes | Dedicated renderer / input path | 4 |
| showProfileOutline | true | Yes | Dedicated renderer / input path | 4 |
| showSummary | false | Yes | Dedicated renderer / input path | 10 |
| profileSettingsVersion | 15 | Not individually established | Dedicated renderer / input path | 1 |
| volumeColor | "#22C55E" | Yes | Dedicated renderer / input path | 4 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| pocColor | "#22C55E" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#22C55E" | Yes | Dedicated renderer / input path | 18 |
| peakColor | "#22C55E" | Yes | Dedicated renderer / input path | 7 |
| valleyColor | "#EF4444" | Yes | Dedicated renderer / input path | 7 |
| businessZoneColor | "#22C55E" | Yes | Dedicated renderer / input path | 2 |
| vwapColor | "#F59E0B" | Yes | Dedicated renderer / input path | 8 |
| vwapHighlightColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| vwapBandColor | "#71717A" | Yes | Dedicated renderer / input path | 5 |
| summaryTextColor | "#22C55E" | Yes | Dedicated renderer / input path | 8 |

## Ask/Bid Volume Profile

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| groupTicks | 4 | Yes | Dedicated renderer / input path | 26 |
| autoGroupFactor | 1 | Not individually established | Dedicated renderer / input path | 13 |
| profileWidth | 2 | Yes | Dedicated renderer / input path | 7 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| minTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| maxTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| valueAreaPercent | 68 | Yes | Dedicated renderer / input path | 30 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| pocLineWidth | 1 | Yes | Dedicated renderer / input path | 10 |
| pocHighlightOpacity | 100 | Yes | Dedicated renderer / input path | 2 |
| developingPocStartMinutes | 0 | Yes | Dedicated renderer / input path | 2 |
| shiftedPocTicks | 4 | Yes | Dedicated renderer / input path | 6 |
| shiftedPocOpacity | 35 | Yes | Dedicated renderer / input path | 3 |
| pocLineMode | "show" | Yes | Dedicated renderer / input path | 5 |
| pocExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| valueAreaLineWidth | 2 | Yes | Dedicated renderer / input path | 10 |
| valueAreaDeveloping | "no" | Yes | Dedicated renderer / input path | 1 |
| valueAreaExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| showPeaks | false | Yes | Dedicated renderer / input path | 6 |
| showValleys | false | Yes | Dedicated renderer / input path | 6 |
| pvSensitivity | 40 | Yes | Dedicated renderer / input path | 2 |
| pvExcludeHighLow | true | Yes | Dedicated renderer / input path | 2 |
| peakMinVolumePercent | 1 | Yes | Dedicated renderer / input path | 3 |
| valleyMaxVolumePercent | 0 | Yes | Dedicated renderer / input path | 3 |
| peakOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| valleyOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| peakLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| valleyLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| peakExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| valleyExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| showBusinessZone | false | Yes | Dedicated renderer / input path | 2 |
| businessZoneOpacity | 3 | Yes | Dedicated renderer / input path | 2 |
| businessZoneLineWidth | 0 | Yes | Dedicated renderer / input path | 2 |
| vwapEnabled | false | Yes | Dedicated renderer / input path | 1 |
| showVwapLine | true | Yes | Dedicated renderer / input path | 4 |
| vwapHighlight | false | Yes | Dedicated renderer / input path | 1 |
| showDevelopingVwap | false | Yes | Dedicated renderer / input path | 3 |
| showVwapBands | false | Yes | Dedicated renderer / input path | 3 |
| vwapLineWidth | 1 | Yes | Dedicated renderer / input path | 4 |
| vwapLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| vwapHighlightOpacity | 18 | Yes | Dedicated renderer / input path | 2 |
| vwapExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| vwapBand1 | 1 | Yes | Dedicated renderer / input path | 3 |
| vwapBand2 | 2 | Yes | Dedicated renderer / input path | 3 |
| vwapBand3 | 0 | Yes | Dedicated renderer / input path | 3 |
| showSummaryVolume | true | Yes | Dedicated renderer / input path | 2 |
| showSummaryTrades | false | Yes | Dedicated renderer / input path | 3 |
| filterMode | "none" | Not individually established | Dedicated renderer / input path | 16 |
| filterTime | "rth" | Not individually established | Dedicated renderer / input path | 16 |
| levelLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| showLevelLabels | true | Yes | Dedicated renderer / input path | 7 |
| levelLabelSide | "right" | Yes | Dedicated renderer / input path | 4 |
| showLevelLabelPrice | true | Yes | Dedicated renderer / input path | 4 |
| visualStyle | "automatic" | Yes | Dedicated renderer / input path | 6 |
| widthMode | "period-percent" | Yes | Dedicated renderer / input path | 4 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| numberOfProfiles | 0 | Yes | Dedicated renderer / input path | 5 |
| previousProfileWidth | 2 | Yes | Dedicated renderer / input path | 1 |
| currentProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| previousProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| sessionStartMinutes | 510 | Not individually established | Dedicated renderer / input path | 9 |
| sessionEndMinutes | 915 | Not individually established | Dedicated renderer / input path | 9 |
| useEndSessionAsStartDay | false | Yes | Dedicated renderer / input path | 10 |
| profileMode | "bid-ask" | Yes | Dedicated renderer / input path | 7 |
| groupingMode | "manual" | Yes | Dedicated renderer / input path | 13 |
| gradientPreset | "off" | Yes | Dedicated renderer / input path | 13 |
| sessionSelectionArmed | false | Not individually established | Dedicated renderer / input path | 0 |
| sessionAsiaEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionTokyoEnabled | false | Yes | Dedicated renderer / input path | 5 |
| sessionLondonEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionNewYorkEnabled | true | Yes | Dedicated renderer / input path | 5 |
| snapMode | "left" | Yes | Dedicated renderer / input path | 7 |
| useThemeColors | true | Not individually established | Dedicated renderer / input path | 75 |
| showText | false | Yes | Dedicated renderer / input path | 7 |
| showValueArea | true | Yes | Dedicated renderer / input path | 12 |
| showPocLine | true | Yes | Dedicated renderer / input path | 6 |
| showValueAreaLines | true | Yes | Dedicated renderer / input path | 9 |
| recentLevelsOnly | false | Yes | Dedicated renderer / input path | 3 |
| showDelta | true | Yes | Dedicated renderer / input path | 5 |
| showProfileSpine | true | Yes | Dedicated renderer / input path | 4 |
| showDevelopingPoc | false | Yes | Dedicated renderer / input path | 6 |
| showPocHighlight | true | Yes | Dedicated renderer / input path | 4 |
| showProfileOutline | true | Yes | Dedicated renderer / input path | 4 |
| showSummary | false | Yes | Dedicated renderer / input path | 10 |
| profileSettingsVersion | 15 | Not individually established | Dedicated renderer / input path | 1 |
| volumeColor | "#22C55E" | Yes | Dedicated renderer / input path | 4 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| pocColor | "#22C55E" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#22C55E" | Yes | Dedicated renderer / input path | 18 |
| peakColor | "#22C55E" | Yes | Dedicated renderer / input path | 7 |
| valleyColor | "#EF4444" | Yes | Dedicated renderer / input path | 7 |
| businessZoneColor | "#22C55E" | Yes | Dedicated renderer / input path | 2 |
| vwapColor | "#F59E0B" | Yes | Dedicated renderer / input path | 8 |
| vwapHighlightColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| vwapBandColor | "#71717A" | Yes | Dedicated renderer / input path | 5 |
| summaryTextColor | "#22C55E" | Yes | Dedicated renderer / input path | 8 |

## Delta Profile

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| groupTicks | 4 | Yes | Dedicated renderer / input path | 26 |
| autoGroupFactor | 1 | Not individually established | Dedicated renderer / input path | 13 |
| profileWidth | 2 | Yes | Dedicated renderer / input path | 7 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| minTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| maxTradeVolume | 0 | Yes | Dedicated renderer / input path | 12 |
| valueAreaPercent | 68 | Yes | Dedicated renderer / input path | 30 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| pocLineWidth | 1 | Yes | Dedicated renderer / input path | 10 |
| pocHighlightOpacity | 100 | Yes | Dedicated renderer / input path | 2 |
| developingPocStartMinutes | 0 | Yes | Dedicated renderer / input path | 2 |
| shiftedPocTicks | 4 | Yes | Dedicated renderer / input path | 6 |
| shiftedPocOpacity | 35 | Yes | Dedicated renderer / input path | 3 |
| pocLineMode | "show" | Yes | Dedicated renderer / input path | 5 |
| pocExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| valueAreaLineWidth | 2 | Yes | Dedicated renderer / input path | 10 |
| valueAreaDeveloping | "no" | Yes | Dedicated renderer / input path | 1 |
| valueAreaExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| showPeaks | false | Yes | Dedicated renderer / input path | 6 |
| showValleys | false | Yes | Dedicated renderer / input path | 6 |
| pvSensitivity | 40 | Yes | Dedicated renderer / input path | 2 |
| pvExcludeHighLow | true | Yes | Dedicated renderer / input path | 2 |
| peakMinVolumePercent | 1 | Yes | Dedicated renderer / input path | 3 |
| valleyMaxVolumePercent | 0 | Yes | Dedicated renderer / input path | 3 |
| peakOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| valleyOnlyOutsideValueArea | false | Yes | Dedicated renderer / input path | 3 |
| peakLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| valleyLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| peakExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| valleyExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| showBusinessZone | false | Yes | Dedicated renderer / input path | 2 |
| businessZoneOpacity | 3 | Yes | Dedicated renderer / input path | 2 |
| businessZoneLineWidth | 0 | Yes | Dedicated renderer / input path | 2 |
| vwapEnabled | false | Yes | Dedicated renderer / input path | 1 |
| showVwapLine | true | Yes | Dedicated renderer / input path | 4 |
| vwapHighlight | false | Yes | Dedicated renderer / input path | 1 |
| showDevelopingVwap | false | Yes | Dedicated renderer / input path | 3 |
| showVwapBands | false | Yes | Dedicated renderer / input path | 3 |
| vwapLineWidth | 1 | Yes | Dedicated renderer / input path | 4 |
| vwapLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| vwapHighlightOpacity | 18 | Yes | Dedicated renderer / input path | 2 |
| vwapExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| vwapBand1 | 1 | Yes | Dedicated renderer / input path | 3 |
| vwapBand2 | 2 | Yes | Dedicated renderer / input path | 3 |
| vwapBand3 | 0 | Yes | Dedicated renderer / input path | 3 |
| showSummaryVolume | true | Yes | Dedicated renderer / input path | 2 |
| showSummaryTrades | false | Yes | Dedicated renderer / input path | 3 |
| filterMode | "none" | Not individually established | Dedicated renderer / input path | 16 |
| filterTime | "rth" | Not individually established | Dedicated renderer / input path | 16 |
| levelLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| showLevelLabels | true | Yes | Dedicated renderer / input path | 7 |
| levelLabelSide | "right" | Yes | Dedicated renderer / input path | 4 |
| showLevelLabelPrice | true | Yes | Dedicated renderer / input path | 4 |
| visualStyle | "automatic" | Yes | Dedicated renderer / input path | 6 |
| widthMode | "period-percent" | Yes | Dedicated renderer / input path | 4 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| numberOfProfiles | 0 | Yes | Dedicated renderer / input path | 5 |
| previousProfileWidth | 2 | Yes | Dedicated renderer / input path | 1 |
| currentProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| previousProfileOffset | 0 | Yes | Dedicated renderer / input path | 1 |
| sessionStartMinutes | 510 | Not individually established | Dedicated renderer / input path | 9 |
| sessionEndMinutes | 915 | Not individually established | Dedicated renderer / input path | 9 |
| useEndSessionAsStartDay | false | Yes | Dedicated renderer / input path | 10 |
| profileMode | "delta" | Yes | Dedicated renderer / input path | 7 |
| groupingMode | "manual" | Yes | Dedicated renderer / input path | 13 |
| gradientPreset | "off" | Yes | Dedicated renderer / input path | 13 |
| sessionSelectionArmed | false | Not individually established | Dedicated renderer / input path | 0 |
| sessionAsiaEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionTokyoEnabled | false | Yes | Dedicated renderer / input path | 5 |
| sessionLondonEnabled | true | Yes | Dedicated renderer / input path | 5 |
| sessionNewYorkEnabled | true | Yes | Dedicated renderer / input path | 5 |
| snapMode | "left" | Yes | Dedicated renderer / input path | 7 |
| useThemeColors | true | Not individually established | Dedicated renderer / input path | 75 |
| showText | false | Yes | Dedicated renderer / input path | 7 |
| showValueArea | true | Yes | Dedicated renderer / input path | 12 |
| showPocLine | true | Yes | Dedicated renderer / input path | 6 |
| showValueAreaLines | true | Yes | Dedicated renderer / input path | 9 |
| recentLevelsOnly | false | Yes | Dedicated renderer / input path | 3 |
| showDelta | true | Yes | Dedicated renderer / input path | 5 |
| showProfileSpine | true | Yes | Dedicated renderer / input path | 4 |
| showDevelopingPoc | false | Yes | Dedicated renderer / input path | 6 |
| showPocHighlight | true | Yes | Dedicated renderer / input path | 4 |
| showProfileOutline | true | Yes | Dedicated renderer / input path | 4 |
| showSummary | false | Yes | Dedicated renderer / input path | 10 |
| profileSettingsVersion | 15 | Not individually established | Dedicated renderer / input path | 1 |
| volumeColor | "#22C55E" | Yes | Dedicated renderer / input path | 4 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| pocColor | "#22C55E" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#22C55E" | Yes | Dedicated renderer / input path | 18 |
| peakColor | "#22C55E" | Yes | Dedicated renderer / input path | 7 |
| valleyColor | "#EF4444" | Yes | Dedicated renderer / input path | 7 |
| businessZoneColor | "#22C55E" | Yes | Dedicated renderer / input path | 2 |
| vwapColor | "#F59E0B" | Yes | Dedicated renderer / input path | 8 |
| vwapHighlightColor | "#F59E0B" | Yes | Dedicated renderer / input path | 2 |
| vwapBandColor | "#71717A" | Yes | Dedicated renderer / input path | 5 |
| summaryTextColor | "#22C55E" | Yes | Dedicated renderer / input path | 8 |

## KWANT Profile Swing

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| volumeColor | "#64748B" | Yes | Dedicated renderer / input path | 4 |
| valueAreaColor | "#22C55E" | Yes | Dedicated renderer / input path | 18 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| pocColor | "#F59E0B" | Yes | Dedicated renderer / input path | 21 |
| vwapColor | "#38BDF8" | Yes | Dedicated renderer / input path | 8 |
| absoluteReversal | 10 | Yes | Dedicated renderer / input path | 1 |
| reversalTicks | 20 | Yes | Dedicated renderer / input path | 2 |
| leftBars | 3 | Yes | Dedicated renderer / input path | 2 |
| rightBars | 3 | Yes | Dedicated renderer / input path | 2 |
| stopAbsoluteReversal | 5 | Yes | Dedicated renderer / input path | 1 |
| stopReversalTicks | 10 | Yes | Dedicated renderer / input path | 1 |
| stopLeftBars | 2 | Yes | Dedicated renderer / input path | 1 |
| stopRightBars | 2 | Yes | Dedicated renderer / input path | 1 |
| swingMinTicks | 12 | Yes | Dedicated renderer / input path | 1 |
| swingMaxTicks | 240 | Yes | Dedicated renderer / input path | 1 |
| vwapBreakTicks | 8 | Yes | Dedicated renderer / input path | 1 |
| filterMin | 0 | Yes | Dedicated renderer / input path | 12 |
| filterMax | 0 | Yes | Dedicated renderer / input path | 12 |
| autoGroupFactor | 1 | Yes | Dedicated renderer / input path | 13 |
| groupTicks | 4 | Yes | Dedicated renderer / input path | 26 |
| valueAreaPercent | 68 | Yes | Dedicated renderer / input path | 30 |
| maxProfiles | 12 | Yes | Dedicated renderer / input path | 1 |
| profileWidth | 34 | Yes | Dedicated renderer / input path | 7 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| lineWidth | 1 | Yes | Dedicated renderer / input path | 142 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| profileMode | "volume" | Yes | Dedicated renderer / input path | 7 |
| lengthType | "swing" | Yes | Dedicated renderer / input path | 4 |
| includeReversalBar | true | Yes | Dedicated renderer / input path | 1 |
| displayMode | "profile-and-lines" | Yes | Dedicated renderer / input path | 9 |
| swingType | "reversal-ticks" | Yes | Dedicated renderer / input path | 1 |
| stopSwingEnabled | false | Yes | Dedicated renderer / input path | 1 |
| stopSwingType | "reversal-ticks" | Yes | Dedicated renderer / input path | 1 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| groupingMode | "automatic" | Yes | Dedicated renderer / input path | 13 |
| showPocLine | true | Yes | Dedicated renderer / input path | 6 |
| showValueAreaLines | true | Yes | Dedicated renderer / input path | 9 |
| showVwapLine | true | Yes | Dedicated renderer / input path | 4 |
| showLevelLabels | true | Yes | Dedicated renderer / input path | 7 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |

## KWANT Profile Values

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| pocColor | "#F59E0B" | Yes | Dedicated renderer / input path | 21 |
| valueAreaColor | "#22C55E" | Yes | Dedicated renderer / input path | 18 |
| peakColor | "#22C55E" | Yes | Dedicated renderer / input path | 7 |
| valleyColor | "#EF4444" | Yes | Dedicated renderer / input path | 7 |
| vwapColor | "#38BDF8" | Yes | Dedicated renderer / input path | 8 |
| vwapBandColor | "#64748B" | Yes | Dedicated renderer / input path | 5 |
| summaryTextColor | "#E2E8F0" | Yes | Dedicated renderer / input path | 8 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#EF4444" | Yes | Dedicated renderer / input path | 24 |
| lengthValue | 1 | Yes | Dedicated renderer / input path | 7 |
| filterMin | 0 | Yes | Dedicated renderer / input path | 12 |
| filterMax | 0 | Yes | Dedicated renderer / input path | 12 |
| autoGroupFactor | 1 | Yes | Dedicated renderer / input path | 13 |
| groupTicks | 4 | Yes | Dedicated renderer / input path | 26 |
| numberOfProfiles | 6 | Yes | Dedicated renderer / input path | 5 |
| valueAreaPercent | 68 | Yes | Dedicated renderer / input path | 30 |
| sessionStartMinutes | 510 | Yes | Dedicated renderer / input path | 9 |
| sessionEndMinutes | 915 | Yes | Dedicated renderer / input path | 9 |
| developingPocStartMinutes | 0 | Yes | Dedicated renderer / input path | 2 |
| shiftedPocTicks | 1 | Yes | Dedicated renderer / input path | 6 |
| shiftedPocOpacity | 68 | Yes | Dedicated renderer / input path | 3 |
| peakValleySensitivity | 40 | Yes | Dedicated renderer / input path | 5 |
| peakMinimumVolumePercent | 0 | Yes | Dedicated renderer / input path | 3 |
| valleyMaximumVolumePercent | 100 | Yes | Dedicated renderer / input path | 3 |
| vwapBand1 | 1 | Yes | Dedicated renderer / input path | 3 |
| vwapBand2 | 2 | Yes | Dedicated renderer / input path | 3 |
| vwapBand3 | 0 | Yes | Dedicated renderer / input path | 3 |
| pocLineWidth | 1 | Yes | Dedicated renderer / input path | 10 |
| valueAreaLineWidth | 2 | Yes | Dedicated renderer / input path | 10 |
| peakLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| valleyLineWidth | 2 | Yes | Dedicated renderer / input path | 3 |
| vwapLineWidth | 1 | Yes | Dedicated renderer / input path | 4 |
| schemaVersion | 2 | Not individually established | Dedicated renderer / input path | 67 |
| periodMode | "multiples" | Yes | Dedicated renderer / input path | 9 |
| lengthType | "days" | Yes | Dedicated renderer / input path | 4 |
| customStartMs | 0 | Not individually established | Dedicated renderer / input path | 8 |
| customEndMs | 0 | Not individually established | Dedicated renderer / input path | 8 |
| inputData | "volume" | Yes | Dedicated renderer / input path | 15 |
| groupingMode | "automatic" | Yes | Dedicated renderer / input path | 13 |
| filterMode | "none" | Yes | Dedicated renderer / input path | 16 |
| useEndSessionAsStartDay | false | Yes | Dedicated renderer / input path | 10 |
| showPocLine | true | Yes | Dedicated renderer / input path | 6 |
| pocLineMode | "show" | Yes | Dedicated renderer / input path | 5 |
| pocExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| showValueAreaLines | true | Yes | Dedicated renderer / input path | 9 |
| developingValueArea | "no" | Yes | Dedicated renderer / input path | 5 |
| valueAreaExtensionMode | "to-window-end" | Yes | Dedicated renderer / input path | 7 |
| showPeaks | false | Yes | Dedicated renderer / input path | 6 |
| showValleys | false | Yes | Dedicated renderer / input path | 6 |
| excludeHighLow | true | Yes | Dedicated renderer / input path | 4 |
| peakExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| valleyExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| showVwap | true | Yes | Dedicated renderer / input path | 6 |
| showDevelopingVwap | false | Yes | Dedicated renderer / input path | 3 |
| showVwapBands | false | Yes | Dedicated renderer / input path | 3 |
| vwapExtensionMode | "none" | Yes | Dedicated renderer / input path | 3 |
| showSummary | false | Yes | Dedicated renderer / input path | 10 |
| showSummaryTrades | false | Yes | Dedicated renderer / input path | 3 |
| showLevelLabels | true | Yes | Dedicated renderer / input path | 7 |
| showLevelLabelPrice | true | Yes | Dedicated renderer / input path | 4 |
| levelLabelSide | "right" | Yes | Dedicated renderer / input path | 4 |
| levelLineStyle | "dash" | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |

## TPO Levels

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| rowSize | 1 | Yes | Dedicated renderer / input path | 4 |
| minimumTrades | 500 | Yes | Dedicated renderer / input path | 4 |
| tailMinimumRows | 3 | Yes | Dedicated renderer / input path | 3 |
| singlePrintMinimumRows | 4 | Yes | Dedicated renderer / input path | 3 |
| ledgeMinimumBrackets | 3 | Yes | Dedicated renderer / input path | 3 |
| ledgeToleranceRows | 1 | Yes | Dedicated renderer / input path | 3 |
| failedAuctionMinimumRows | 5 | Yes | Dedicated renderer / input path | 3 |
| failedAuctionMaximumTpo | 2 | Yes | Dedicated renderer / input path | 3 |
| edgeSmoothingRows | 5 | Yes | Dedicated renderer / input path | 3 |
| edgeDropPercent | 50 | Yes | Dedicated renderer / input path | 2 |
| edgeMaximumWidthRows | 3 | Yes | Dedicated renderer / input path | 3 |
| acceptedBasePercent | 60 | Yes | Dedicated renderer / input path | 2 |
| seamTroughPercent | 50 | Yes | Dedicated renderer / input path | 2 |
| volumeLvnPercent | 50 | Yes | Dedicated renderer / input path | 2 |
| acceptanceBrackets | 2 | Yes | Dedicated renderer / input path | 3 |
| partialFillPercent | 50 | Yes | Dedicated renderer / input path | 2 |
| expireAfterSessions | 10 | Yes | Dedicated renderer / input path | 3 |
| expireStrength | 20 | Yes | Dedicated renderer / input path | 3 |
| fillOpacity | 15 | Yes | Dedicated renderer / input path | 27 |
| borderOpacity | 100 | Yes | Dedicated renderer / input path | 3 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| supportColor | "#22C55E" | Yes | Dedicated renderer / input path | 2 |
| resistanceColor | "#EF4444" | Yes | Dedicated renderer / input path | 2 |
| neutralColor | "#94A3B8" | Yes | Dedicated renderer / input path | 33 |
| tpoLevelsSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## VWAP

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| mainColor | "#22C55E" | Yes | output-effect-observed | 1 |
| upper1Color | "#4ADE80" | Yes | output-effect-observed | 2 |
| lower1Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| upper2Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| lower2Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| upper3Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| lower3Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| upper4Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| lower4Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| upper5Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| lower5Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| periodValue | 1 | Yes | output-effect-observed | 3 |
| sessionStartHour | 17 | Yes | output-effect-observed | 3 |
| lineWidth | 2 | Yes | output-effect-observed | 142 |
| bandLineWidth | 1 | Yes | output-effect-observed | 1 |
| band1 | 1 | Yes | output-effect-observed | 0 |
| band2 | 2 | Yes | output-effect-observed | 0 |
| band3 | 3 | Yes | output-effect-observed | 0 |
| band4 | 4 | Yes | output-effect-observed | 0 |
| band5 | 5 | Yes | output-effect-observed | 0 |
| source | "hlc3" | Yes | Dedicated renderer / input path | 309 |
| periodMode | "days" | Yes | Dedicated renderer / input path | 9 |
| envelopeMode | "standard-deviation" | Yes | Dedicated renderer / input path | 2 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| bandLineStyle | "dotted" | Yes | Dedicated renderer / input path | 1 |
| band1Enabled | false | Yes | output-effect-observed | 1 |
| band2Enabled | false | Yes | output-effect-observed | 1 |
| band3Enabled | false | Yes | output-effect-observed | 1 |
| band4Enabled | false | Yes | output-effect-observed | 1 |
| band5Enabled | false | Yes | output-effect-observed | 1 |
| showCurrentValue | false | Yes | output-effect-observed | 2 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| vwapSettingsVersion | 2 | Not individually established | Dedicated renderer / input path | 0 |

## VWAP Envelopes

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| mainColor | "#22C55E" | Yes | output-effect-observed | 1 |
| upper1Color | "#4ADE80" | Yes | output-effect-observed | 2 |
| lower1Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| upper2Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| lower2Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| upper3Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| lower3Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| upper4Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| lower4Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| upper5Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| lower5Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| periodValue | 1 | Yes | output-effect-observed | 3 |
| lineWidth | 2 | Yes | output-effect-observed | 142 |
| bandLineWidth | 1 | Yes | output-effect-observed | 1 |
| band1 | 1 | Yes | output-effect-observed | 0 |
| band2 | 2 | Yes | output-effect-observed | 0 |
| band3 | 3 | Yes | output-effect-observed | 0 |
| band4 | 4 | Yes | output-effect-observed | 0 |
| band5 | 5 | Yes | output-effect-observed | 0 |
| source | "hlc3" | Yes | Dedicated renderer / input path | 309 |
| periodMode | "days" | Yes | Dedicated renderer / input path | 9 |
| envelopeMode | "standard-deviation" | Yes | Dedicated renderer / input path | 2 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| bandLineStyle | "dotted" | Yes | Dedicated renderer / input path | 1 |
| band1Enabled | true | Yes | output-effect-observed | 1 |
| band2Enabled | true | Yes | output-effect-observed | 1 |
| band3Enabled | true | Yes | output-effect-observed | 1 |
| band4Enabled | false | Yes | output-effect-observed | 1 |
| band5Enabled | false | Yes | output-effect-observed | 1 |
| showCurrentValue | false | Yes | output-effect-observed | 2 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| vwapSettingsVersion | 2 | Not individually established | Dedicated renderer / input path | 0 |

## Rolling VWAP

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| upper1Color | "#4ADE80" | Yes | output-effect-observed | 2 |
| lower1Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| upper2Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| lower2Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| upper3Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| lower3Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| upper4Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| lower4Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| upper5Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| lower5Color | "#4ADE80" | Yes | output-effect-observed | 1 |
| periodValue | 60 | Yes | output-effect-observed | 3 |
| lineWidth | 2 | Yes | output-effect-observed | 142 |
| bandLineWidth | 1 | Yes | output-effect-observed | 1 |
| band1 | 1 | Yes | output-effect-observed | 0 |
| band2 | 2 | Yes | output-effect-observed | 0 |
| band3 | 3 | Yes | output-effect-observed | 0 |
| band4 | 4 | Yes | output-effect-observed | 0 |
| band5 | 5 | Yes | output-effect-observed | 0 |
| source | "hlc3" | Yes | Dedicated renderer / input path | 309 |
| periodMode | "bars" | Yes | Dedicated renderer / input path | 9 |
| envelopeMode | "standard-deviation" | Yes | Dedicated renderer / input path | 2 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| bandLineStyle | "dotted" | Yes | Dedicated renderer / input path | 1 |
| band1Enabled | true | Yes | output-effect-observed | 1 |
| band2Enabled | true | Yes | output-effect-observed | 1 |
| band3Enabled | true | Yes | output-effect-observed | 1 |
| band4Enabled | false | Yes | output-effect-observed | 1 |
| band5Enabled | false | Yes | output-effect-observed | 1 |
| showCurrentValue | false | Yes | output-effect-observed | 2 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| vwapSettingsVersion | 2 | Not individually established | Dedicated renderer / input path | 0 |

## Market Statistics

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| textColor | "#60A5FA" | Yes | Dedicated renderer / input path | 58 |
| averageColor | "#22C55E" | Yes | Dedicated renderer / input path | 3 |
| deviationColor | "#EF4444" | Yes | Dedicated renderer / input path | 3 |
| backgroundColor | "#09090B" | Yes | Dedicated renderer / input path | 85 |
| fontSize | 10 | Yes | Dedicated renderer / input path | 88 |
| standardDeviationPercent | 2 | Yes | Dedicated renderer / input path | 1 |
| filterMin | 0 | Yes | Dedicated renderer / input path | 12 |
| filterMax | 0 | Yes | Dedicated renderer / input path | 12 |
| initialRange | 0 | Yes | Dedicated renderer / input path | 1 |
| endRange | 500 | Yes | Dedicated renderer / input path | 1 |
| stepRange | 50 | Yes | Dedicated renderer / input path | 1 |
| initialFilterMinutes | 0 | Yes | Dedicated renderer / input path | 1 |
| endFilterMinutes | 1439 | Yes | Dedicated renderer / input path | 1 |
| panelOpacity | 72 | Yes | Dedicated renderer / input path | 1 |
| statMode | "trades" | Yes | Dedicated renderer / input path | 1 |
| dataType | "volume" | Yes | Dedicated renderer / input path | 1 |
| barInput | "volume" | Not individually established | Dedicated renderer / input path | 1 |
| showHeader | true | Yes | Dedicated renderer / input path | 10 |
| showEmptyRanges | true | Yes | Dedicated renderer / input path | 1 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |

## On Candle Stats

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| filterMin | 0 | Yes | Dedicated renderer / input path | 12 |
| filterMax | 0 | Yes | Dedicated renderer / input path | 12 |
| fontSize | 10 | Yes | Dedicated renderer / input path | 88 |
| smallerFontSize | 6 | Yes | Dedicated renderer / input path | 2 |
| maxRatio | 100 | Yes | Dedicated renderer / input path | 3 |
| tickOffset | 2 | Yes | Dedicated renderer / input path | 3 |
| inputData | "Volume" | Yes | Dedicated renderer / input path | 15 |
| autoTextFormat | true | Yes | Dedicated renderer / input path | 2 |
| absoluteSign | false | Yes | Dedicated renderer / input path | 2 |
| opacityBasedOnRatio | true | Yes | Dedicated renderer / input path | 2 |
| colorTextBasedOnDelta | true | Yes | Dedicated renderer / input path | 2 |
| pricePlot | "price-slope" | Yes | Dedicated renderer / input path | 2 |
| showMaxDeltaVolume | false | Yes | Dedicated renderer / input path | 1 |
| showMinDeltaVolume | false | Yes | Dedicated renderer / input path | 1 |
| showTotalVolume | true | Yes | Dedicated renderer / input path | 1 |
| showDeltaVolume | true | Yes | Dedicated renderer / input path | 1 |
| showTotalTrades | false | Yes | Dedicated renderer / input path | 1 |
| showDeltaTrades | false | Yes | Dedicated renderer / input path | 1 |
| showRangeTicks | false | Yes | Dedicated renderer / input path | 1 |
| showCotHigh | false | Yes | Dedicated renderer / input path | 1 |
| showCotLow | false | Yes | Dedicated renderer / input path | 1 |
| showCotBar | false | Yes | Dedicated renderer / input path | 1 |
| showDeltaPercent | false | Yes | Dedicated renderer / input path | 1 |
| showBarRatio | false | Yes | Dedicated renderer / input path | 1 |
| showBidVolume | false | Yes | Dedicated renderer / input path | 1 |
| showAskVolume | false | Yes | Dedicated renderer / input path | 1 |
| showSessionCvd | false | Yes | Dedicated renderer / input path | 1 |
| showVolumePerSecond | false | Yes | Dedicated renderer / input path | 1 |
| showDuration | false | Yes | Dedicated renderer / input path | 3 |
| showHighRatio | false | Yes | Dedicated renderer / input path | 1 |
| showLowRatio | false | Yes | Dedicated renderer / input path | 1 |
| showTotalEffort | false | Yes | Dedicated renderer / input path | 1 |
| showDeltaEffort | false | Yes | Dedicated renderer / input path | 1 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| positiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 19 |
| negativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 21 |
| neutralColor | "#94A3B8" | Yes | Dedicated renderer / input path | 33 |
| textColor | "#E5E7EB" | Yes | Dedicated renderer / input path | 58 |
| backgroundColor | "#27272A" | Yes | Dedicated renderer / input path | 85 |
| onCandleStatsSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Important Levels

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| days | 2 | Yes | output-effect-observed | 79 |
| weeks | 1 | Yes | output-effect-observed | 9 |
| months | 1 | Yes | output-effect-observed | 18 |
| skipLast | false | Yes | output-effect-observed | 1 |
| plotType | "label-and-line" | Yes | Dedicated renderer / input path | 1 |
| textAlign | "right" | Yes | Dedicated renderer / input path | 62 |
| fontSize | 10 | Yes | output-effect-observed | 88 |
| lineWidth | 1 | Yes | output-effect-observed | 142 |
| filterTime | "eth" | Yes | Dedicated renderer / input path | 16 |
| customStartTime | "08:30" | Not individually established | Dedicated renderer / input path | 3 |
| customEndTime | "15:15" | Not individually established | Dedicated renderer / input path | 2 |
| dailyAverage | true | Yes | output-effect-observed | 1 |
| dailyLow | true | Yes | output-effect-observed | 1 |
| dailyHigh | true | Yes | output-effect-observed | 1 |
| dailyOpen | true | Yes | output-effect-observed | 1 |
| dailyClose | true | Yes | output-effect-observed | 1 |
| dailyPoc | true | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| dailyValueArea | true | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| dailyVwap | true | Yes | output-effect-observed | 1 |
| weeklyAverage | true | Yes | output-effect-observed | 1 |
| weeklyLow | true | Yes | output-effect-observed | 1 |
| weeklyHigh | true | Yes | output-effect-observed | 1 |
| weeklyOpen | true | Yes | output-effect-observed | 1 |
| weeklyClose | true | Yes | output-effect-observed | 1 |
| weeklyPoc | true | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| weeklyValueArea | true | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| weeklyVwap | true | Yes | output-effect-observed | 1 |
| monthlyAverage | false | Yes | output-effect-observed | 1 |
| monthlyLow | true | Yes | output-effect-observed | 1 |
| monthlyHigh | true | Yes | output-effect-observed | 1 |
| monthlyOpen | true | Yes | output-effect-observed | 1 |
| monthlyClose | true | Yes | output-effect-observed | 1 |
| monthlyPoc | true | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| monthlyValueArea | true | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| monthlyVwap | true | Yes | output-effect-observed | 1 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| lowColor | "#EF4444" | Yes | output-effect-observed | 7 |
| highColor | "#22C55E" | Yes | output-effect-observed | 7 |
| openColor | "#A3A3A3" | Yes | output-effect-observed | 4 |
| closeColor | "#FFFFFF" | Not individually established | output-effect-observed | 4 |
| midColor | "#F59E0B" | Yes | output-effect-observed | 6 |
| pocColor | "#F59E0B" | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 21 |
| valueAreaColor | "#38BDF8" | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 18 |
| vwapColor | "#A78BFA" | Yes | output-effect-observed | 8 |
| importantLevelsSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 1 |

## Absolute Levels

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| firstValue | 0 | Yes | output-effect-observed | 1 |
| secondValue | 0 | Yes | output-effect-observed | 1 |
| firstLineWidth | 1 | Yes | output-effect-observed | 1 |
| secondLineWidth | 1 | Yes | output-effect-observed | 1 |
| firstLineStyle | "solid" | Yes | Dedicated renderer / input path | 1 |
| secondLineStyle | "solid" | Yes | Dedicated renderer / input path | 1 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| firstLineColor | "#22C55E" | Yes | output-effect-observed | 1 |
| secondLineColor | "#4ADE80" | Yes | output-effect-observed | 1 |

## Pivot Points

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| fontSize | 12 | Yes | output-effect-observed | 88 |
| lineWidth | 1 | Yes | output-effect-observed | 142 |
| lineStyle | "dashed" | Yes | Dedicated renderer / input path | 50 |
| labelAlign | "left" | Yes | Dedicated renderer / input path | 3 |
| periodsToShow | 1 | Yes | output-effect-observed | 1 |
| customReferenceEnabled | false | Yes | output-effect-observed | 1 |
| referenceTimeframe | "hour" | Not individually established | Dedicated renderer / input path | 1 |
| referenceValue | 1 | Yes | output-effect-observed | 1 |
| customSessionEnabled | false | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| customSessionStart | "00:00:00" | Not individually established | Dedicated renderer / input path | 4 |
| customSessionEnd | "00:00:00" | Not individually established | Dedicated renderer / input path | 4 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| pivotPointColor | "#22C55E" | Yes | output-effect-observed | 1 |
| r1Color | "#EF4444" | Yes | output-effect-observed | 1 |
| r2Color | "#EF4444" | Yes | output-effect-observed | 1 |
| s1Color | "#22C55E" | Yes | output-effect-observed | 1 |
| s2Color | "#22C55E" | Yes | output-effect-observed | 1 |

## Price Movement Levels

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| daysToLoad | 3 | Yes | output-effect-observed | 7 |
| levelBasedOn | "open" | Yes | Dedicated renderer / input path | 1 |
| stepMode | "percentual" | Yes | Dedicated renderer / input path | 1 |
| stepValue | 0.5 | Yes | output-effect-observed | 1 |
| fontSize | 11 | Yes | output-effect-observed | 88 |
| minimumLevels | 5 | Yes | output-effect-observed | 2 |
| supportLineStyle | "dashed" | Yes | Dedicated renderer / input path | 1 |
| supportLineWidth | 2 | Yes | output-effect-observed | 1 |
| resistanceLineStyle | "dashed" | Yes | Dedicated renderer / input path | 1 |
| resistanceLineWidth | 2 | Yes | output-effect-observed | 1 |
| zeroLineStyle | "dotted" | Yes | Dedicated renderer / input path | 4 |
| zeroLineWidth | 2 | Yes | output-effect-observed | 3 |
| customTimeEnabled | false | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| customStartTime | "00:00:00" | Yes | Dedicated renderer / input path | 3 |
| customEndTime | "00:00:00" | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| textColor | "#FFFFFF" | Yes | output-effect-observed | 58 |
| supportLineColor | "#22C55E" | Yes | output-effect-observed | 2 |
| resistanceLineColor | "#4ADE80" | Yes | output-effect-observed | 2 |
| zeroLineColor | "#22C55E" | Yes | output-effect-observed | 5 |

## FVG Identifier

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| minNumTicks | 10 | Yes | output-effect-observed | 1 |
| maxNumTicks | 0 | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| lineWidth | 1 | Yes | output-effect-observed | 142 |
| backgroundOpacity | 40 | Yes | output-effect-observed | 9 |
| resetStartDay | true | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| removeOnShadowTriggered | false | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| maxBarsExtension | 0 | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 3 |
| breakoutPercent | 35 | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| upColor | "#22C55E" | Not individually established | output-effect-observed | 34 |
| downColor | "#EF4444" | Not individually established | output-effect-observed | 34 |

## Gap Detector

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| gapMode | "day-begin" | Yes | Dedicated renderer / input path | 1 |
| calculationMode | "tick" | Yes | Dedicated renderer / input path | 3 |
| percentValue | 1 | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| tickValue | 20 | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 4 |
| triggerWholeBar | true | Yes | no-effect-in-these-fixtures-review-renderer-or-data-gate | 1 |
| backgroundOpacity | 40 | Yes | output-effect-observed | 9 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| upColor | "#22C55E" | Not individually established | output-effect-observed | 34 |
| downColor | "#EF4444" | Not individually established | output-effect-observed | 34 |

## Divergence Detector

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| pivotStrength | 3 | Yes | Dedicated renderer / input path | 5 |
| synchronizationBars | 3 | Yes | Dedicated renderer / input path | 2 |
| minimumSwingBars | 3 | Yes | Dedicated renderer / input path | 2 |
| maximumLookbackBars | 1200 | Yes | Dedicated renderer / input path | 2 |
| minimumMoveTicks | 1 | Yes | Dedicated renderer / input path | 2 |
| maximumSignals | 24 | Yes | Dedicated renderer / input path | 2 |
| lineWidth | 2 | Yes | Dedicated renderer / input path | 142 |
| opacity | 100 | Yes | Dedicated renderer / input path | 167 |
| labelFontSize | 10 | Yes | Dedicated renderer / input path | 2 |
| comparisonMode | "automatic-es-nq" | Not individually established | Dedicated renderer / input path | 4 |
| includeNonConfirmation | true | Yes | Dedicated renderer / input path | 2 |
| showBullish | true | Yes | Dedicated renderer / input path | 2 |
| showBearish | true | Yes | Dedicated renderer / input path | 2 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| showPivotDots | true | Yes | Dedicated renderer / input path | 2 |
| dashedLines | false | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| bullishColor | "#22C55E" | Yes | Dedicated renderer / input path | 8 |
| bearishColor | "#EF4444" | Yes | Dedicated renderer / input path | 8 |
| divergenceDetectorSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Confluence Identifier

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| supportColor1 | "#22C55E" | Not individually established | Dedicated renderer / input path | 3 |
| supportColor2 | "#16A34A" | Not individually established | Dedicated renderer / input path | 3 |
| supportColor3 | "#15803D" | Not individually established | Dedicated renderer / input path | 3 |
| supportColor4 | "#14532D" | Not individually established | Dedicated renderer / input path | 3 |
| resistanceColor1 | "#EF4444" | Not individually established | Dedicated renderer / input path | 3 |
| resistanceColor2 | "#DC2626" | Not individually established | Dedicated renderer / input path | 3 |
| resistanceColor3 | "#B91C1C" | Not individually established | Dedicated renderer / input path | 3 |
| resistanceColor4 | "#7F1D1D" | Not individually established | Dedicated renderer / input path | 3 |
| trendUpColor | "#22C55E" | Yes | Dedicated renderer / input path | 3 |
| trendDownColor | "#EF4444" | Yes | Dedicated renderer / input path | 3 |
| swingUpColor | "#4ADE80" | Yes | Dedicated renderer / input path | 3 |
| swingDownColor | "#FB7185" | Yes | Dedicated renderer / input path | 3 |
| startLineColor | "#94A3B8" | Yes | Dedicated renderer / input path | 3 |
| filterMin | 0 | Yes | Dedicated renderer / input path | 12 |
| filterMax | 0 | Yes | Dedicated renderer / input path | 12 |
| tickSensitivity | 3 | Yes | Dedicated renderer / input path | 1 |
| minimumConfluences | 5 | Yes | Dedicated renderer / input path | 1 |
| trendReversalPercent | 3 | Yes | Dedicated renderer / input path | 1 |
| trendSwingCount | 9 | Yes | Dedicated renderer / input path | 1 |
| swingReversalPercent | 1 | Yes | Dedicated renderer / input path | 1 |
| firstGroupTicks | 4 | Yes | Dedicated renderer / input path | 1 |
| firstProfileCount | 6 | Yes | Dedicated renderer / input path | 1 |
| secondGroupTicks | 4 | Yes | Dedicated renderer / input path | 1 |
| secondProfileCount | 4 | Yes | Dedicated renderer / input path | 1 |
| thirdGroupTicks | 4 | Yes | Dedicated renderer / input path | 1 |
| thirdProfileCount | 1 | Yes | Dedicated renderer / input path | 1 |
| peakMinimumVolumePercent | 60 | Yes | Dedicated renderer / input path | 3 |
| valleyMaximumVolumePercent | 25 | Yes | Dedicated renderer / input path | 3 |
| deltaImbalancePercent | 70 | Yes | Dedicated renderer / input path | 1 |
| supportRange2 | 6 | Yes | Dedicated renderer / input path | 1 |
| supportRange3 | 8 | Yes | Dedicated renderer / input path | 1 |
| supportRange4 | 10 | Yes | Dedicated renderer / input path | 1 |
| resistanceRange2 | 6 | Yes | Dedicated renderer / input path | 1 |
| resistanceRange3 | 8 | Yes | Dedicated renderer / input path | 1 |
| resistanceRange4 | 10 | Yes | Dedicated renderer / input path | 1 |
| lineWidth | 1 | Yes | Dedicated renderer / input path | 142 |
| zoneOpacity | 18 | Yes | Dedicated renderer / input path | 7 |
| schemaVersion | 1 | Not individually established | Dedicated renderer / input path | 67 |
| inputData | "volume" | Not individually established | Dedicated renderer / input path | 15 |
| startMode | "zig-zag" | Yes | Dedicated renderer / input path | 2 |
| startDateMs | 0 | Not individually established | Dedicated renderer / input path | 1 |
| enableZigZagSwing | true | Yes | Dedicated renderer / input path | 1 |
| includeSwingBeforeMidTrend | true | Yes | Dedicated renderer / input path | 1 |
| enableRetracements | true | Yes | Dedicated renderer / input path | 1 |
| enableRetracement382 | true | Yes | Dedicated renderer / input path | 1 |
| enableRetracement50 | true | Yes | Dedicated renderer / input path | 1 |
| enableRetracement618 | true | Yes | Dedicated renderer / input path | 1 |
| enableRetracement75 | true | Yes | Dedicated renderer / input path | 1 |
| excludePreviousRetracements | true | Yes | Dedicated renderer / input path | 1 |
| showDevelopingLines | false | Yes | Dedicated renderer / input path | 2 |
| showSourceLines | false | Yes | Dedicated renderer / input path | 2 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| firstEnabled | true | Yes | Dedicated renderer / input path | 1 |
| firstPeriod | "daily" | Yes | Dedicated renderer / input path | 1 |
| firstGroupingMode | "automatic" | Yes | Dedicated renderer / input path | 1 |
| firstIncludeByNumber | true | Yes | Dedicated renderer / input path | 1 |
| firstUsePoc | true | Yes | Dedicated renderer / input path | 1 |
| firstUseValueArea | true | Yes | Dedicated renderer / input path | 1 |
| firstUsePeaks | true | Yes | Dedicated renderer / input path | 1 |
| firstUseValleys | true | Yes | Dedicated renderer / input path | 1 |
| firstUseDeltaImbalances | false | Yes | Dedicated renderer / input path | 1 |
| secondEnabled | true | Yes | Dedicated renderer / input path | 1 |
| secondPeriod | "weekly" | Yes | Dedicated renderer / input path | 1 |
| secondGroupingMode | "automatic" | Yes | Dedicated renderer / input path | 1 |
| secondIncludeByNumber | true | Yes | Dedicated renderer / input path | 1 |
| secondUsePoc | true | Yes | Dedicated renderer / input path | 1 |
| secondUseValueArea | true | Yes | Dedicated renderer / input path | 1 |
| secondUsePeaks | true | Yes | Dedicated renderer / input path | 1 |
| secondUseValleys | true | Yes | Dedicated renderer / input path | 1 |
| secondUseDeltaImbalances | false | Yes | Dedicated renderer / input path | 1 |
| thirdEnabled | true | Yes | Dedicated renderer / input path | 1 |
| thirdPeriod | "composite" | Yes | Dedicated renderer / input path | 1 |
| thirdGroupingMode | "automatic" | Yes | Dedicated renderer / input path | 1 |
| thirdIncludeByNumber | true | Yes | Dedicated renderer / input path | 1 |
| thirdUsePoc | true | Yes | Dedicated renderer / input path | 1 |
| thirdUseValueArea | true | Yes | Dedicated renderer / input path | 1 |
| thirdUsePeaks | true | Yes | Dedicated renderer / input path | 1 |
| thirdUseValleys | true | Yes | Dedicated renderer / input path | 1 |
| thirdUseDeltaImbalances | false | Yes | Dedicated renderer / input path | 1 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |

## Swing Point

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| leftBars | 2 | Yes | output-effect-observed | 2 |
| rightBars | 2 | Yes | output-effect-observed | 2 |
| filterSwing | false | Yes | output-effect-observed | 1 |
| displayMode | "line" | Yes | Dedicated renderer / input path | 9 |
| lineWidth | 2 | Yes | output-effect-observed | 142 |
| lineStyle | "dashed" | Yes | Dedicated renderer / input path | 50 |
| textTickOffset | 1 | Yes | output-effect-observed | 1 |
| textSize | 11 | Yes | output-effect-observed | 11 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| highColor | "#22C55E" | Yes | output-effect-observed | 7 |
| lowColor | "#EF4444" | Yes | output-effect-observed | 7 |
| highTextColor | "#FFFFFF" | Yes | output-effect-observed | 1 |
| lowTextColor | "#FFFFFF" | Yes | output-effect-observed | 1 |

## Average Daily Range Target

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| lengthType | "daily" | Yes | Dedicated renderer / input path | 4 |
| length | 1 | Yes | output-effect-observed | 679 |
| fontSize | 12 | Yes | output-effect-observed | 88 |
| textAlign | "right" | Yes | Dedicated renderer / input path | 62 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| backgroundColor | "#000000" | Yes | output-effect-observed | 85 |
| textColor | "#FFFFFF" | Yes | output-effect-observed | 58 |

## Sessions

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| lookbackDays | 30 | Yes | Dedicated renderer / input path | 6 |
| fillOpacity | 10 | Yes | Dedicated renderer / input path | 27 |
| lineOpacity | 100 | Yes | Dedicated renderer / input path | 5 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| showTokyo | true | Yes | Dedicated renderer / input path | 2 |
| showLondon | true | Yes | Dedicated renderer / input path | 2 |
| showNewYork | true | Yes | Dedicated renderer / input path | 2 |
| showSydney | false | Yes | Dedicated renderer / input path | 3 |
| tokyoLabel | "Asia" | Not individually established | Dedicated renderer / input path | 1 |
| londonLabel | "London" | Not individually established | Dedicated renderer / input path | 1 |
| newYorkLabel | "New York" | Not individually established | Dedicated renderer / input path | 2 |
| sydneyLabel | "Sydney" | Not individually established | Dedicated renderer / input path | 1 |
| tokyoTimezone | "America/New_York" | Not individually established | Dedicated renderer / input path | 0 |
| londonTimezone | "America/New_York" | Not individually established | Dedicated renderer / input path | 0 |
| newYorkTimezone | "America/New_York" | Not individually established | Dedicated renderer / input path | 0 |
| tokyoStart | "16:00" | Yes | Dedicated renderer / input path | 1 |
| tokyoEnd | "03:00" | Yes | Dedicated renderer / input path | 1 |
| londonStart | "03:00" | Yes | Dedicated renderer / input path | 1 |
| londonEnd | "09:30" | Yes | Dedicated renderer / input path | 1 |
| newYorkStart | "09:30" | Yes | Dedicated renderer / input path | 2 |
| newYorkEnd | "16:00" | Yes | Dedicated renderer / input path | 2 |
| sydneyStart | "08:00" | Not individually established | Dedicated renderer / input path | 1 |
| sydneyEnd | "17:00" | Not individually established | Dedicated renderer / input path | 1 |
| tokyoColor | "#FF9900" | Yes | Dedicated renderer / input path | 2 |
| londonColor | "#4CAF50" | Yes | Dedicated renderer / input path | 2 |
| newYorkColor | "#2196F3" | Yes | Dedicated renderer / input path | 1 |
| sydneyColor | "#A461BB" | Yes | Dedicated renderer / input path | 1 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| showBackground | true | Yes | Dedicated renderer / input path | 7 |
| showBorders | true | Yes | Dedicated renderer / input path | 1 |
| showOpenClose | true | Yes | Dedicated renderer / input path | 2 |
| showMidline | false | Yes | Dedicated renderer / input path | 1 |
| showPercentChange | false | Yes | Dedicated renderer / input path | 5 |
| showPointChange | false | Yes | Dedicated renderer / input path | 1 |
| hideWeekends | true | Yes | Dedicated renderer / input path | 3 |
| lineStyle | "dashed" | Not individually established | Dedicated renderer / input path | 50 |
| labelSize | "small" | Not individually established | Dedicated renderer / input path | 1 |
| allowSessionOverlap | false | Yes | Dedicated renderer / input path | 2 |
| sessionsSettingsVersion | 2 | Not individually established | Dedicated renderer / input path | 0 |

## Session Highs & Lows

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| lookbackDays | 30 | Yes | Dedicated renderer / input path | 6 |
| lineOpacity | 100 | Yes | Dedicated renderer / input path | 5 |
| lineWidth | 1 | Yes | Dedicated renderer / input path | 142 |
| showGlobex | true | Yes | Dedicated renderer / input path | 2 |
| showTokyo | true | Yes | Dedicated renderer / input path | 2 |
| showLondon | true | Yes | Dedicated renderer / input path | 2 |
| showNewYork | true | Yes | Dedicated renderer / input path | 2 |
| globexLabel | "Globex" | Not individually established | Dedicated renderer / input path | 0 |
| tokyoLabel | "Asia" | Not individually established | Dedicated renderer / input path | 1 |
| londonLabel | "London" | Not individually established | Dedicated renderer / input path | 1 |
| newYorkLabel | "New York" | Not individually established | Dedicated renderer / input path | 2 |
| globexTimezone | "America/Chicago" | Not individually established | Dedicated renderer / input path | 0 |
| tokyoTimezone | "America/Chicago" | Not individually established | Dedicated renderer / input path | 0 |
| londonTimezone | "America/Chicago" | Not individually established | Dedicated renderer / input path | 0 |
| newYorkTimezone | "America/Chicago" | Not individually established | Dedicated renderer / input path | 0 |
| globexStart | "17:00" | Yes | Dedicated renderer / input path | 0 |
| globexEnd | "16:00" | Yes | Dedicated renderer / input path | 0 |
| tokyoStart | "17:00" | Yes | Dedicated renderer / input path | 1 |
| tokyoEnd | "02:00" | Yes | Dedicated renderer / input path | 1 |
| londonStart | "02:00" | Yes | Dedicated renderer / input path | 1 |
| londonEnd | "08:30" | Yes | Dedicated renderer / input path | 1 |
| newYorkStart | "08:30" | Yes | Dedicated renderer / input path | 2 |
| newYorkEnd | "15:00" | Yes | Dedicated renderer / input path | 2 |
| showHighs | true | Yes | Dedicated renderer / input path | 1 |
| showLows | true | Yes | Dedicated renderer / input path | 1 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| hideWeekends | true | Yes | Dedicated renderer / input path | 3 |
| lineStyle | "dashed" | Not individually established | Dedicated renderer / input path | 50 |
| labelSize | "small" | Not individually established | Dedicated renderer / input path | 1 |
| sessionHighLowSettingsVersion | 3 | Not individually established | Dedicated renderer / input path | 0 |

## IB Levels

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| lookbackDays | 7 | Yes | Dedicated renderer / input path | 6 |
| lineOpacity | 100 | Yes | Dedicated renderer / input path | 5 |
| lineWidth | 1 | Yes | Dedicated renderer / input path | 142 |
| durationMinutes | 60 | Yes | Dedicated renderer / input path | 3 |
| ibDuration15 | false | Yes | Dedicated renderer / input path | 0 |
| ibDuration30 | false | Yes | Dedicated renderer / input path | 0 |
| ibDuration45 | false | Yes | Dedicated renderer / input path | 0 |
| ibDuration60 | false | Yes | Dedicated renderer / input path | 0 |
| showGlobex | true | Yes | Dedicated renderer / input path | 2 |
| showTokyo | true | Yes | Dedicated renderer / input path | 2 |
| showLondon | true | Yes | Dedicated renderer / input path | 2 |
| showNewYork | true | Yes | Dedicated renderer / input path | 2 |
| globexLabel | "Globex" | Not individually established | Dedicated renderer / input path | 0 |
| tokyoLabel | "Asia" | Not individually established | Dedicated renderer / input path | 1 |
| londonLabel | "London" | Not individually established | Dedicated renderer / input path | 1 |
| newYorkLabel | "New York" | Not individually established | Dedicated renderer / input path | 2 |
| globexStart | "18:00" | Not individually established | Dedicated renderer / input path | 0 |
| globexEnd | "17:00" | Not individually established | Dedicated renderer / input path | 0 |
| tokyoStart | "09:00" | Not individually established | Dedicated renderer / input path | 1 |
| tokyoEnd | "18:00" | Not individually established | Dedicated renderer / input path | 1 |
| londonStart | "08:00" | Not individually established | Dedicated renderer / input path | 1 |
| londonEnd | "17:00" | Not individually established | Dedicated renderer / input path | 1 |
| newYorkStart | "09:30" | Not individually established | Dedicated renderer / input path | 2 |
| newYorkEnd | "16:00" | Not individually established | Dedicated renderer / input path | 2 |
| globexColor | "#A461BB" | Yes | Dedicated renderer / input path | 0 |
| tokyoColor | "#FF9900" | Yes | Dedicated renderer / input path | 2 |
| londonColor | "#4CAF50" | Yes | Dedicated renderer / input path | 2 |
| newYorkColor | "#2196F3" | Yes | Dedicated renderer / input path | 1 |
| followSessionsStudy | false | Yes | Dedicated renderer / input path | 2 |
| showHighs | true | Yes | Dedicated renderer / input path | 1 |
| showLows | true | Yes | Dedicated renderer / input path | 1 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| hideWeekends | true | Yes | Dedicated renderer / input path | 3 |
| useSessionColors | false | Yes | Dedicated renderer / input path | 1 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| highColor | "#22C55E" | Yes | Dedicated renderer / input path | 7 |
| lowColor | "#EF4444" | Yes | Dedicated renderer / input path | 7 |
| developingLineStyle | "solid" | Not individually established | Dedicated renderer / input path | 1 |
| fixedLineStyle | "dashed" | Not individually established | Dedicated renderer / input path | 1 |
| labelSize | "small" | Not individually established | Dedicated renderer / input path | 1 |
| showFib | false | Yes | Dedicated renderer / input path | 1 |
| fibDirection | "long" | Not individually established | Dedicated renderer / input path | 1 |
| initialBalanceSettingsVersion | 2 | Not individually established | Dedicated renderer / input path | 0 |

## Kwant Levels

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| maxLevels | 14 | Yes | Dedicated renderer / input path | 3 |
| lineWidth | 1 | Yes | Dedicated renderer / input path | 142 |
| conversion | "AUTO" | Yes | Dedicated renderer / input path | 13 |
| dataSource | "GEX_CALL_MINUS_PUT" | Not individually established | Dedicated renderer / input path | 9 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| showEnvironment | true | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| lineStyle | "dashed" | Yes | Dedicated renderer / input path | 50 |
| positiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 19 |
| negativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 21 |
| magnetColor | "#8B5CF6" | Yes | Dedicated renderer / input path | 1 |
| centreColor | "#06B6D4" | Yes | Dedicated renderer / input path | 1 |
| gammaSettingsVersion | 3 | Not individually established | Dedicated renderer / input path | 0 |

## Classic GEX Profile

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| refreshIntervalMs | 1000 | Yes | Dedicated renderer / input path | 1 |
| manualMultiplier | 1 | Yes | Dedicated renderer / input path | 3 |
| premiumOffset | 0 | Yes | Dedicated renderer / input path | 3 |
| profileWidth | 24 | Yes | Dedicated renderer / input path | 7 |
| minBarWidth | 5 | Yes | Dedicated renderer / input path | 2 |
| contrast | 70 | Yes | Dedicated renderer / input path | 10 |
| mappingSource | "QQQ" | Yes | Dedicated renderer / input path | 3 |
| profileMode | "CLASSIC_GEX" | Not individually established | Dedicated renderer / input path | 7 |
| expiry | "ZERO_DTE" | Yes | Dedicated renderer / input path | 56 |
| profileSource | "VOLUME" | Yes | Dedicated renderer / input path | 4 |
| panelPosition | "RIGHT" | Yes | Dedicated renderer / input path | 1 |
| mappingMode | "AUTO" | Yes | Dedicated renderer / input path | 6 |
| logarithmicScaling | false | Yes | Dedicated renderer / input path | 1 |
| showLookbackDots | true | Yes | Dedicated renderer / input path | 2 |
| showMajorPositiveVolume | true | Yes | Dedicated renderer / input path | 1 |
| showMajorNegativeVolume | true | Yes | Dedicated renderer / input path | 1 |
| showMajorPositiveOpenInterest | true | Yes | Dedicated renderer / input path | 1 |
| showMajorNegativeOpenInterest | true | Yes | Dedicated renderer / input path | 1 |
| showZeroGamma | true | Yes | Dedicated renderer / input path | 2 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| positiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 19 |
| negativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 21 |
| zeroGammaColor | "#F4F4F5" | Yes | Dedicated renderer / input path | 1 |
| classicGexSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Session Marker

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| lookbackDays | 5 | Yes | Dedicated renderer / input path | 6 |
| lineOpacity | 100 | Yes | Dedicated renderer / input path | 5 |
| lineWidth | 2 | Yes | Dedicated renderer / input path | 142 |
| textSize | 11 | Yes | Dedicated renderer / input path | 11 |
| asianImbalanceMinutes | 60 | Yes | Dedicated renderer / input path | 1 |
| europeImbalanceMinutes | 60 | Yes | Dedicated renderer / input path | 1 |
| usaImbalanceMinutes | 60 | Yes | Dedicated renderer / input path | 1 |
| timeReference | "exchange" | Yes | Dedicated renderer / input path | 1 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| extendLine | false | Yes | Dedicated renderer / input path | 2 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| textColor | "#E5E7EB" | Yes | Dedicated renderer / input path | 58 |
| showSessionRange | true | Yes | Dedicated renderer / input path | 2 |
| showImbalanceRange | true | Yes | Dedicated renderer / input path | 2 |
| showOpenClose | true | Yes | Dedicated renderer / input path | 2 |
| showMidPrice | true | Yes | Dedicated renderer / input path | 1 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| asianEnabled | true | Yes | Dedicated renderer / input path | 1 |
| asianStartTime | "16:00" | Yes | Dedicated renderer / input path | 1 |
| asianEndTime | "03:00" | Yes | Dedicated renderer / input path | 1 |
| asianVwapEnabled | false | Yes | Dedicated renderer / input path | 1 |
| europeEnabled | true | Yes | Dedicated renderer / input path | 1 |
| europeStartTime | "03:00" | Yes | Dedicated renderer / input path | 1 |
| europeEndTime | "09:30" | Yes | Dedicated renderer / input path | 1 |
| europeVwapEnabled | false | Yes | Dedicated renderer / input path | 1 |
| usaEnabled | true | Yes | Dedicated renderer / input path | 1 |
| usaStartTime | "09:30" | Yes | Dedicated renderer / input path | 1 |
| usaEndTime | "16:00" | Yes | Dedicated renderer / input path | 1 |
| usaVwapEnabled | false | Yes | Dedicated renderer / input path | 1 |
| markerEnabled | false | Yes | Dedicated renderer / input path | 4 |
| allowSessionOverlap | false | Yes | Dedicated renderer / input path | 2 |
| sessionMarkerSettingsVersion | 2 | Not individually established | Dedicated renderer / input path | 1 |
| asianHighColor | "#22C55E" | Yes | Dedicated renderer / input path | 0 |
| asianLowColor | "#EF4444" | Yes | Dedicated renderer / input path | 0 |
| asianImbalanceHighColor | "#4ADE80" | Yes | Dedicated renderer / input path | 0 |
| asianImbalanceLowColor | "#F87171" | Yes | Dedicated renderer / input path | 0 |
| asianOpenColor | "#38BDF8" | Yes | Dedicated renderer / input path | 0 |
| asianCloseColor | "#94A3B8" | Yes | Dedicated renderer / input path | 0 |
| asianSessionRangeColor | "#38BDF8" | Yes | Dedicated renderer / input path | 0 |
| asianImbalanceRangeColor | "#94A3B8" | Yes | Dedicated renderer / input path | 0 |
| asianMidColor | "#38BDF8" | Yes | Dedicated renderer / input path | 0 |
| asianVwapColor | "#38BDF8" | Yes | Dedicated renderer / input path | 0 |
| europeHighColor | "#22C55E" | Yes | Dedicated renderer / input path | 0 |
| europeLowColor | "#EF4444" | Yes | Dedicated renderer / input path | 0 |
| europeImbalanceHighColor | "#4ADE80" | Yes | Dedicated renderer / input path | 0 |
| europeImbalanceLowColor | "#F87171" | Yes | Dedicated renderer / input path | 0 |
| europeOpenColor | "#38BDF8" | Yes | Dedicated renderer / input path | 0 |
| europeCloseColor | "#94A3B8" | Yes | Dedicated renderer / input path | 0 |
| europeSessionRangeColor | "#38BDF8" | Yes | Dedicated renderer / input path | 0 |
| europeImbalanceRangeColor | "#94A3B8" | Yes | Dedicated renderer / input path | 0 |
| europeMidColor | "#38BDF8" | Yes | Dedicated renderer / input path | 0 |
| europeVwapColor | "#38BDF8" | Yes | Dedicated renderer / input path | 0 |
| usaHighColor | "#22C55E" | Yes | Dedicated renderer / input path | 0 |
| usaLowColor | "#EF4444" | Yes | Dedicated renderer / input path | 0 |
| usaImbalanceHighColor | "#4ADE80" | Yes | Dedicated renderer / input path | 0 |
| usaImbalanceLowColor | "#F87171" | Yes | Dedicated renderer / input path | 0 |
| usaOpenColor | "#38BDF8" | Yes | Dedicated renderer / input path | 0 |
| usaCloseColor | "#94A3B8" | Yes | Dedicated renderer / input path | 0 |
| usaSessionRangeColor | "#38BDF8" | Yes | Dedicated renderer / input path | 0 |
| usaImbalanceRangeColor | "#94A3B8" | Yes | Dedicated renderer / input path | 0 |
| usaMidColor | "#38BDF8" | Yes | Dedicated renderer / input path | 0 |
| usaVwapColor | "#38BDF8" | Yes | Dedicated renderer / input path | 0 |
| markerPositiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 1 |
| markerNegativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 1 |

## Shift Candle

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| maxBarsAfterReversal | 3 | Yes | Dedicated renderer / input path | 1 |
| minimumTickBreakout | 1 | Yes | Dedicated renderer / input path | 2 |
| minimumDeltaPercentDifference | 20 | Yes | Dedicated renderer / input path | 1 |
| minimumDeltaValueDifference | 100 | Yes | Dedicated renderer / input path | 1 |
| maximumTickPocDistance | 4 | Yes | Dedicated renderer / input path | 1 |
| highestLowestLookback | 5 | Yes | Dedicated renderer / input path | 1 |
| markerTickOffset | 2 | Yes | Dedicated renderer / input path | 1 |
| plotPrice | "high-low" | Yes | Dedicated renderer / input path | 3 |
| imbalanceEnabled | true | Yes | Dedicated renderer / input path | 1 |
| minimumImbalancePercent | 300 | Yes | Dedicated renderer / input path | 5 |
| minimumImbalanceVolumeDifference | 20 | Yes | Dedicated renderer / input path | 1 |
| freshZonesEnabled | true | Yes | Dedicated renderer / input path | 1 |
| zoneOpacity | 18 | Yes | Dedicated renderer / input path | 7 |
| markerShape | "square" | Yes | Dedicated renderer / input path | 2 |
| markerLineWidth | 2 | Yes | Dedicated renderer / input path | 1 |
| autoCenter | true | Yes | Dedicated renderer / input path | 3 |
| alertEnabled | false | Yes | Dedicated renderer / input path | 2 |
| alertName | "Signal Trigger" | Yes | Dedicated renderer / input path | 8 |
| popupEnabled | false | Yes | Dedicated renderer / input path | 2 |
| popupMessage | "Signal Trigger" | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| buyMarkerColor | "#22C55E" | Yes | Dedicated renderer / input path | 1 |
| sellMarkerColor | "#EF4444" | Yes | Dedicated renderer / input path | 1 |
| freshBuyZoneColor | "#22C55E" | Yes | Dedicated renderer / input path | 1 |
| freshSellZoneColor | "#EF4444" | Yes | Dedicated renderer / input path | 1 |
| shiftCandleSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 1 |

## Moving Average

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| length | 20 | Yes | output-effect-observed | 679 |

## Ichimoku Indicator

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| conversionLinePeriod | 9 | Yes | Dedicated renderer / input path | 1 |
| baseLinePeriod | 26 | Yes | output-effect-observed | 1 |
| laggingSpanPeriod | 52 | Yes | output-effect-observed | 1 |
| tenkanLineWidth | 1 | Yes | output-effect-observed | 1 |
| kijunLineWidth | 1 | Yes | output-effect-observed | 1 |
| chikouLineWidth | 1 | Yes | output-effect-observed | 1 |
| senkouLineWidth | 1 | Yes | output-effect-observed | 1 |
| tenkanLineStyle | "solid" | Yes | Dedicated renderer / input path | 1 |
| kijunLineStyle | "solid" | Yes | Dedicated renderer / input path | 1 |
| chikouLineStyle | "solid" | Yes | Dedicated renderer / input path | 1 |
| senkouLineStyle | "solid" | Yes | Dedicated renderer / input path | 1 |
| tenkanShortName | "Tenkan Sen" | Yes | Dedicated renderer / input path | 1 |
| kijunShortName | "Kijun Sen" | Yes | Dedicated renderer / input path | 1 |
| chikouShortName | "Chikou Span" | Yes | Dedicated renderer / input path | 1 |
| senkouShortName | "Senkou Span" | Yes | Dedicated renderer / input path | 1 |
| tenkanNameLabel | false | Yes | output-effect-observed | 1 |
| tenkanValueLabel | false | Yes | output-effect-observed | 1 |
| kijunNameLabel | false | Yes | output-effect-observed | 1 |
| kijunValueLabel | false | Yes | output-effect-observed | 1 |
| chikouNameLabel | false | Yes | output-effect-observed | 1 |
| chikouValueLabel | false | Yes | output-effect-observed | 1 |
| senkouNameLabel | false | Yes | output-effect-observed | 1 |
| senkouValueLabel | false | Yes | output-effect-observed | 1 |
| tenkanIncludeOnAutoCenter | true | Yes | output-effect-observed | 1 |
| kijunIncludeOnAutoCenter | true | Yes | output-effect-observed | 1 |
| chikouIncludeOnAutoCenter | true | Yes | output-effect-observed | 1 |
| senkouIncludeOnAutoCenter | true | Yes | output-effect-observed | 1 |
| showCloud | true | Yes | output-effect-observed | 1 |
| cloudOpacity | 14 | Yes | output-effect-observed | 1 |
| useSecondaryAxis | false | Yes | output-effect-observed | 9 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| tenkanColor | "#22C55E" | Yes | output-effect-observed | 2 |
| kijunColor | "#EF4444" | Yes | output-effect-observed | 2 |
| chikouColor | "#4ADE80" | Yes | output-effect-observed | 2 |
| senkouColor | "#22C55E" | Yes | output-effect-observed | 2 |
| senkouSecondaryColor | "#EF4444" | Yes | output-effect-observed | 2 |
| bullishCloudColor | "#22C55E" | Yes | output-effect-observed | 2 |
| bearishCloudColor | "#EF4444" | Yes | output-effect-observed | 2 |
| ichimokuSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 1 |

## Parabolic SAR

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| accelerationStep | 0.02 | Yes | output-effect-observed | 1 |
| accelerationMaximum | 0.2 | Yes | output-effect-observed | 1 |
| lineWidth | 1 | Yes | output-effect-observed | 142 |
| displayStyle | "points" | Yes | Dedicated renderer / input path | 7 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| secondaryColorEnabled | false | Yes | output-effect-observed | 2 |
| useSecondaryAxis | false | Yes | output-effect-observed | 9 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| secondaryColor | "#4ADE80" | Not individually established | output-effect-observed | 6 |

## Linear Regression

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| length | 21 | Yes | output-effect-observed | 679 |
| inputData | "close" | Yes | Dedicated renderer / input path | 15 |
| displayStyle | "line" | Yes | Dedicated renderer / input path | 7 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| lineWidth | 1 | Yes | output-effect-observed | 142 |
| secondaryColorEnabled | false | Yes | output-effect-observed | 2 |
| useSecondaryAxis | false | Yes | output-effect-observed | 9 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| secondaryColor | "#4ADE80" | Not individually established | output-effect-observed | 6 |

## Regression Channel

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| mode | "bars" | Yes | Dedicated renderer / input path | 200 |
| bars | 100 | Yes | output-effect-observed | 148 |
| standardDeviationValue | 1 | Yes | output-effect-observed | 1 |
| zigZagMode | "tick-reversal" | Yes | Dedicated renderer / input path | 2 |
| zigZagAbsoluteReversal | 0.5 | Yes | output-effect-observed | 1 |
| zigZagReversalValue | 22 | Yes | output-effect-observed | 1 |
| midLineWidth | 2 | Yes | output-effect-observed | 1 |
| upperLineWidth | 2 | Yes | output-effect-observed | 1 |
| lowerLineWidth | 2 | Yes | output-effect-observed | 1 |
| midLineStyle | "dashed" | Yes | Dedicated renderer / input path | 1 |
| upperLineStyle | "dashed" | Yes | Dedicated renderer / input path | 1 |
| lowerLineStyle | "dashed" | Yes | Dedicated renderer / input path | 1 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| midColor | "#22C55E" | Yes | output-effect-observed | 6 |
| midUpColor | "#22C55E" | Yes | output-effect-observed | 0 |
| midDownColor | "#EF4444" | Yes | output-effect-observed | 0 |
| upperColor | "#22C55E" | Yes | output-effect-observed | 2 |
| upperUpColor | "#22C55E" | Yes | output-effect-observed | 0 |
| upperDownColor | "#EF4444" | Yes | output-effect-observed | 0 |
| lowerColor | "#22C55E" | Yes | output-effect-observed | 2 |
| lowerUpColor | "#22C55E" | Yes | output-effect-observed | 0 |
| lowerDownColor | "#EF4444" | Yes | output-effect-observed | 0 |

## Super Trend

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| length | 10 | Yes | output-effect-observed | 679 |
| multiplier | 3 | Yes | output-effect-observed | 37 |
| lineWidth | 1 | Yes | output-effect-observed | 142 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| displayStyle | "line" | Yes | Dedicated renderer / input path | 7 |
| colorMode | "direction" | Yes | Dedicated renderer / input path | 10 |
| shortName | "ST" | Yes | Dedicated renderer / input path | 10 |
| chartArea | "overlay" | Yes | Dedicated renderer / input path | 4 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| useSecondaryAxis | false | Yes | output-effect-observed | 9 |
| includeOnAutoCenter | true | Yes | output-effect-observed | 3 |
| valueLabel | false | Yes | output-effect-observed | 6 |
| nameLabel | false | Yes | output-effect-observed | 6 |
| nameBackground | false | Yes | output-effect-observed | 8 |
| valueBackground | false | Yes | output-effect-observed | 8 |
| chartColorForMarker | false | Yes | output-effect-observed | 6 |
| alertSoundEnabled | false | Yes | output-effect-observed | 8 |
| messagePopupEnabled | false | Yes | output-effect-observed | 8 |
| alertName | "Super Trend" | Yes | Dedicated renderer / input path | 8 |
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| secondaryColor | "#EF4444" | Yes | output-effect-observed | 6 |

## Super Trend Difference

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| length | 10 | Yes | output-effect-observed | 679 |
| multiplier | 3 | Yes | output-effect-observed | 37 |
| lineWidth | 4 | Yes | output-effect-observed | 142 |
| lineStyle | "solid" | Not individually established | Dedicated renderer / input path | 50 |
| displayStyle | "histogram" | Yes | Dedicated renderer / input path | 7 |
| colorMode | "sign" | Yes | Dedicated renderer / input path | 10 |
| shortName | "STD" | Yes | Dedicated renderer / input path | 10 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| includeOnAutoCenter | true | Yes | output-effect-observed | 3 |
| valueLabel | false | Yes | output-effect-observed | 6 |
| nameLabel | false | Yes | output-effect-observed | 6 |
| nameBackground | false | Yes | output-effect-observed | 8 |
| valueBackground | false | Yes | output-effect-observed | 8 |
| chartColorForMarker | false | Yes | output-effect-observed | 6 |
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| secondaryColor | "#EF4444" | Yes | output-effect-observed | 6 |

## Keltner Channel

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| middleColor | "#22C55E" | Yes | output-effect-observed | 3 |
| upperColor | "#4ADE80" | Yes | output-effect-observed | 2 |
| lowerColor | "#4ADE80" | Yes | output-effect-observed | 2 |
| length | 20 | Yes | output-effect-observed | 679 |
| atrLength | 10 | Yes | output-effect-observed | 1 |
| multiplier | 2 | Yes | output-effect-observed | 37 |

## Bollinger Bands

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| middleColor | "#22C55E" | Yes | output-effect-observed | 3 |
| upperColor | "#4ADE80" | Yes | output-effect-observed | 2 |
| lowerColor | "#4ADE80" | Yes | output-effect-observed | 2 |
| length | 20 | Yes | output-effect-observed | 679 |
| multiplier | 2 | Yes | output-effect-observed | 37 |

## Donchian Channel

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| upperColor | "#22C55E" | Yes | output-effect-observed | 2 |
| middleColor | "#22C55E" | Yes | output-effect-observed | 3 |
| lowerColor | "#EF4444" | Yes | output-effect-observed | 2 |
| length | 20 | Yes | output-effect-observed | 679 |

## Tillson T3

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| length | 14 | Yes | output-effect-observed | 679 |
| volumeFactor | 0.618 | Yes | output-effect-observed | 1 |
| inputData | "close" | Yes | Dedicated renderer / input path | 15 |
| colorMode | "slope" | Yes | Dedicated renderer / input path | 10 |
| displayStyle | "line" | Yes | Dedicated renderer / input path | 7 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| lineWidth | 1 | Yes | output-effect-observed | 142 |
| shortName | "T3" | Yes | Dedicated renderer / input path | 10 |
| useSecondaryAxis | false | Yes | output-effect-observed | 9 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| secondaryColor | "#4ADE80" | Yes | output-effect-observed | 6 |

## Zig Zag

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| zigZagMode | "highest-lowest" | Yes | Dedicated renderer / input path | 2 |
| absoluteReversalPercent | 0.5 | Yes | output-effect-observed | 1 |
| tickReversalOrLookback | 10 | Yes | output-effect-observed | 1 |
| lineWidth | 2 | Yes | output-effect-observed | 142 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| shortName | "Zig Zag" | Yes | Dedicated renderer / input path | 10 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| upColor | "#22C55E" | Yes | output-effect-observed | 34 |
| downColor | "#EF4444" | Yes | output-effect-observed | 34 |
| retracementBackgroundColor | "#5f6425" | Yes | output-effect-observed | 1 |
| retracementFontSize | 11 | Yes | output-effect-observed | 1 |
| retracementTextColor | "#FFFFFF" | Yes | output-effect-observed | 1 |
| retracementLineWidth | 1 | Yes | output-effect-observed | 1 |
| retracementLineColor | "#4ADE80" | Yes | output-effect-observed | 2 |
| showRetracement38 | true | Yes | output-effect-observed | 1 |
| showRetracement50 | true | Yes | output-effect-observed | 1 |
| showRetracement62 | true | Yes | output-effect-observed | 1 |
| showRetracement75 | false | Yes | output-effect-observed | 1 |
| extendRight | false | Yes | output-effect-observed | 32 |

## Relative Strength Index (RSI)

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| length | 14 | Yes | output-effect-observed | 679 |

## Rate of Change (ROC)

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| length | 12 | Yes | output-effect-observed | 679 |

## MACD Indicator

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| macdColor | "#22C55E" | Yes | output-effect-observed | 1 |
| signalColor | "#4ADE80" | Yes | output-effect-observed | 2 |
| histogramColor | "#8A8F98" | Yes | output-effect-observed | 1 |
| fastLength | 12 | Yes | output-effect-observed | 3 |
| slowLength | 26 | Yes | output-effect-observed | 3 |
| signalLength | 9 | Yes | output-effect-observed | 1 |

## Momentum Indicator

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| length | 10 | Yes | output-effect-observed | 679 |

## Commodity Channel Index (CCI)

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| length | 20 | Yes | output-effect-observed | 679 |

## Know Sure Thing (KST)

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| roc1 | 10 | Yes | output-effect-observed | 1 |
| roc2 | 15 | Yes | output-effect-observed | 1 |
| roc3 | 20 | Yes | output-effect-observed | 1 |
| roc4 | 30 | Yes | output-effect-observed | 1 |
| average1 | 10 | Yes | output-effect-observed | 1 |
| average2 | 10 | Yes | output-effect-observed | 1 |
| average3 | 10 | Yes | output-effect-observed | 1 |
| average4 | 15 | Yes | output-effect-observed | 1 |
| signalPeriod | 9 | Yes | output-effect-observed | 2 |
| averageType | "simple" | Yes | Dedicated renderer / input path | 4 |
| usePercent | false | Yes | output-effect-observed | 2 |
| middleLevel | 0 | Yes | output-effect-observed | 4 |
| middleLineWidth | 1 | Yes | output-effect-observed | 2 |
| showMiddle | true | Yes | output-effect-observed | 2 |
| showKst | true | Yes | output-effect-observed | 2 |
| showSignal | true | Yes | output-effect-observed | 2 |
| kstColorMode | "slope" | Yes | Dedicated renderer / input path | 1 |
| signalColorMode | "none" | Yes | Dedicated renderer / input path | 1 |
| kstDisplayStyle | "line" | Yes | Dedicated renderer / input path | 1 |
| signalDisplayStyle | "line" | Yes | Dedicated renderer / input path | 1 |
| kstLineStyle | "solid" | Yes | Dedicated renderer / input path | 1 |
| signalLineStyle | "dashed" | Yes | Dedicated renderer / input path | 1 |
| kstLineWidth | 2 | Yes | output-effect-observed | 1 |
| signalLineWidth | 1 | Yes | output-effect-observed | 1 |
| kstShortName | "KST" | Yes | Dedicated renderer / input path | 1 |
| signalShortName | "Sig" | Yes | Dedicated renderer / input path | 1 |
| kstNameLabel | false | Yes | output-effect-observed | 1 |
| signalNameLabel | false | Yes | output-effect-observed | 1 |
| kstValueLabel | false | Yes | output-effect-observed | 1 |
| signalValueLabel | false | Yes | output-effect-observed | 1 |
| kstNameBackground | false | Yes | output-effect-observed | 1 |
| signalNameBackground | false | Yes | output-effect-observed | 1 |
| kstValueBackground | false | Yes | output-effect-observed | 1 |
| signalValueBackground | false | Yes | output-effect-observed | 1 |
| kstChartMarker | false | Yes | output-effect-observed | 1 |
| signalChartMarker | false | Yes | output-effect-observed | 1 |
| kstAutoCenter | true | Yes | output-effect-observed | 1 |
| signalAutoCenter | true | Yes | output-effect-observed | 1 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| kstColor | "#22C55E" | Yes | output-effect-observed | 2 |
| kstSecondaryColor | "#EF4444" | Yes | output-effect-observed | 2 |
| signalColor | "#4ADE80" | Yes | output-effect-observed | 2 |
| signalSecondaryColor | "#22C55E" | Yes | output-effect-observed | 2 |
| middleColor | "#8A8F98" | Yes | output-effect-observed | 3 |

## Inverse Cyber Cycle

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| smoothingAlpha | 0.01 | Yes | output-effect-observed | 1 |
| cycleALength | 21 | Yes | output-effect-observed | 1 |
| cycleBLength | 84 | Yes | output-effect-observed | 1 |
| middleLevel | 0 | Yes | output-effect-observed | 4 |
| lowLevel | -0.6 | Yes | output-effect-observed | 1 |
| highLevel | 0.6 | Yes | output-effect-observed | 1 |
| levelWidth | 1 | Yes | output-effect-observed | 1 |
| cycleALineWidth | 2 | Yes | output-effect-observed | 1 |
| cycleBLineWidth | 2 | Yes | output-effect-observed | 1 |
| cycleALineStyle | "solid" | Yes | Dedicated renderer / input path | 1 |
| cycleBLineStyle | "solid" | Yes | Dedicated renderer / input path | 1 |
| cycleAAutoColor | "none" | Yes | Dedicated renderer / input path | 1 |
| cycleBAutoColor | "none" | Yes | Dedicated renderer / input path | 1 |
| cycleAShortName | "CycA" | Yes | Dedicated renderer / input path | 1 |
| cycleBShortName | "CycB" | Yes | Dedicated renderer / input path | 2 |
| cycleANameLabel | false | Yes | output-effect-observed | 1 |
| cycleAValueLabel | false | Yes | output-effect-observed | 1 |
| cycleAIncludeOnAutoCenter | true | Yes | output-effect-observed | 1 |
| cycleBNameLabel | false | Yes | output-effect-observed | 1 |
| cycleBValueLabel | false | Yes | output-effect-observed | 1 |
| cycleBIncludeOnAutoCenter | true | Yes | output-effect-observed | 1 |
| useSecondaryAxis | false | Yes | output-effect-observed | 9 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| cycleAColor | "#22C55E" | Yes | output-effect-observed | 2 |
| cycleASecondaryColor | "#CA8A04" | Yes | output-effect-observed | 1 |
| cycleBColor | "#4ADE80" | Yes | output-effect-observed | 2 |
| cycleBSecondaryColor | "#BE185D" | Yes | output-effect-observed | 1 |
| middleLevelColor | "#8A8F98" | Yes | output-effect-observed | 2 |
| lowLevelColor | "#EF4444" | Yes | output-effect-observed | 2 |
| highLevelColor | "#22C55E" | Yes | output-effect-observed | 2 |
| inverseCyberCycleSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 1 |

## Aroon Up/Down

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| upColor | "#22C55E" | Yes | output-effect-observed | 34 |
| downColor | "#EF4444" | Yes | output-effect-observed | 34 |
| length | 25 | Yes | output-effect-observed | 679 |

## Aroon Oscillator

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| length | 25 | Yes | output-effect-observed | 679 |

## Awesome Oscillator

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| fastLength | 5 | Yes | output-effect-observed | 3 |
| slowLength | 34 | Yes | output-effect-observed | 3 |

## Stochastic Oscillator

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| kColor | "#22C55E" | Yes | output-effect-observed | 1 |
| dColor | "#4ADE80" | Yes | output-effect-observed | 1 |
| length | 14 | Yes | output-effect-observed | 679 |
| smooth | 3 | Yes | output-effect-observed | 18 |

## Williams %R

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| length | 14 | Yes | output-effect-observed | 679 |

## Chaikin Accumulation/Distribution

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |

## Average Directional Index (ADX)

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| period | 14 | Yes | output-effect-observed | 39 |
| lineWidth | 1 | Yes | output-effect-observed | 142 |
| lineStyle | "solid" | Yes | Dedicated renderer / input path | 50 |
| showPlusDi | true | Yes | output-effect-observed | 1 |
| showMinusDi | true | Yes | output-effect-observed | 1 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| adxColor | "#22C55E" | Yes | output-effect-observed | 1 |
| plusDiColor | "#22C55E" | Yes | output-effect-observed | 1 |
| minusDiColor | "#EF4444" | Yes | output-effect-observed | 1 |

## VIX Environment

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| position | "top-left" | Yes | Dedicated renderer / input path | 117 |
| sourceSymbol | "VIX" | Yes | Dedicated renderer / input path | 28 |
| showChange | true | Yes | Dedicated renderer / input path | 1 |
| showRange | true | Yes | Dedicated renderer / input path | 5 |
| showRank | true | Yes | Dedicated renderer / input path | 1 |
| showPercentile | true | Yes | Dedicated renderer / input path | 1 |
| showFreshness | true | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | false | Yes | Dedicated renderer / input path | 75 |
| calmColor | "#22C55E" | Yes | Dedicated renderer / input path | 1 |
| normalColor | "#38BDF8" | Yes | Dedicated renderer / input path | 1 |
| elevatedColor | "#F59E0B" | Yes | Dedicated renderer / input path | 1 |
| highColor | "#F97316" | Yes | Dedicated renderer / input path | 7 |
| extremeColor | "#EF4444" | Yes | Dedicated renderer / input path | 1 |
| normalThreshold | 15 | Yes | Dedicated renderer / input path | 3 |
| elevatedThreshold | 20 | Yes | Dedicated renderer / input path | 3 |
| highThreshold | 25 | Yes | Dedicated renderer / input path | 4 |
| extremeThreshold | 30 | Yes | Dedicated renderer / input path | 3 |
| badgeScale | 1 | Yes | Dedicated renderer / input path | 1 |
| vixEnvironmentSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Standard Deviation

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| length | 20 | Yes | output-effect-observed | 679 |

## Average True Range (ATR)

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| plotColor | "#22C55E" | Yes | output-effect-observed | 7 |
| length | 14 | Yes | output-effect-observed | 679 |

## Expected Move

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| lineOpacity | 100 | Yes | Dedicated renderer / input path | 5 |
| fillOpacity | 3 | Yes | Dedicated renderer / input path | 27 |
| mode | "SESSION" | Yes | Dedicated renderer / input path | 200 |
| mappingSource | "QQQ" | Yes | Dedicated renderer / input path | 3 |
| showTwoSigma | false | Yes | Dedicated renderer / input path | 2 |
| showBandFill | false | Yes | Dedicated renderer / input path | 2 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| neutralColor | "#D6A84B" | Yes | Dedicated renderer / input path | 33 |
| expectedMoveSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 1 |

## Overlay Chart

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| maxVolumeWidthPercent | 100 | Yes | Dedicated renderer / input path | 3 |
| standardDeviation | 2 | Yes | Dedicated renderer / input path | 16 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| opacity | 68 | Yes | Dedicated renderer / input path | 167 |
| symbol | "AUTO" | Yes | Dedicated renderer / input path | 189 |
| timeframe | "AUTO" | Yes | Dedicated renderer / input path | 88 |
| style | "candlestick" | Yes | Dedicated renderer / input path | 287 |
| useSecondaryAxis | true | Yes | Dedicated renderer / input path | 9 |
| widthBasedOnVolume | false | Yes | Dedicated renderer / input path | 4 |
| colorBasedOnDelta | false | Yes | Dedicated renderer / input path | 6 |
| openCloseBorder | true | Yes | Dedicated renderer / input path | 3 |
| filled | true | Yes | Dedicated renderer / input path | 106 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| upColor | "#22C55E" | Yes | Dedicated renderer / input path | 34 |
| downColor | "#EF4444" | Yes | Dedicated renderer / input path | 34 |
| lineColor | "#60A5FA" | Yes | Dedicated renderer / input path | 58 |
| overlaySettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Overlay Symbol

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| maxVolumeWidthPercent | 100 | Yes | Dedicated renderer / input path | 3 |
| standardDeviation | 2 | Yes | Dedicated renderer / input path | 16 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| opacity | 68 | Yes | Dedicated renderer / input path | 167 |
| symbol | "AUTO" | Yes | Dedicated renderer / input path | 189 |
| timeframe | "AUTO" | Not individually established | Dedicated renderer / input path | 88 |
| style | "candlestick" | Yes | Dedicated renderer / input path | 287 |
| useSecondaryAxis | true | Yes | Dedicated renderer / input path | 9 |
| widthBasedOnVolume | false | Yes | Dedicated renderer / input path | 4 |
| colorBasedOnDelta | false | Yes | Dedicated renderer / input path | 6 |
| openCloseBorder | true | Yes | Dedicated renderer / input path | 3 |
| filled | true | Yes | Dedicated renderer / input path | 106 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| upColor | "#22C55E" | Yes | Dedicated renderer / input path | 34 |
| downColor | "#EF4444" | Yes | Dedicated renderer / input path | 34 |
| lineColor | "#60A5FA" | Yes | Dedicated renderer / input path | 58 |
| overlaySettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Overlay Timeframe Candlestick

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| candleWidthPercent | 94 | Yes | Dedicated renderer / input path | 2 |
| borderWidth | 1 | Yes | Dedicated renderer / input path | 20 |
| opacity | 34 | Yes | Dedicated renderer / input path | 167 |
| timeframe | "15m" | Yes | Dedicated renderer / input path | 88 |
| filled | true | Yes | Dedicated renderer / input path | 106 |
| drawCloseBoundary | false | Yes | Dedicated renderer / input path | 3 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| upColor | "#22C55E" | Yes | Dedicated renderer / input path | 34 |
| downColor | "#EF4444" | Yes | Dedicated renderer / input path | 34 |
| closeBoundaryColor | "#60A5FA" | Not individually established | Dedicated renderer / input path | 3 |
| overlaySettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Overlay Timeframe Highlight

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| parameterType | "minutes" | Yes | Dedicated renderer / input path | 2 |
| parameter1 | 15 | Yes | output-effect-observed | 2 |
| colorBasedOnDelta | false | Yes | output-effect-observed | 6 |
| colorMode | "fixed" | Yes | Dedicated renderer / input path | 10 |
| standardDeviation | 2 | Yes | output-effect-observed | 16 |
| enabled | true | Yes | output-effect-observed | 139 |
| borderWidth | 1 | Yes | output-effect-observed | 20 |
| bodyOpacity | 18 | Yes | output-effect-observed | 3 |
| shadowOpacity | 70 | Yes | output-effect-observed | 2 |
| showBackground | true | Yes | output-effect-observed | 7 |
| targetEnabled | false | Yes | output-effect-observed | 3 |
| targetLineWidth | 1 | Yes | output-effect-observed | 2 |
| targetLineStyle | "dashed" | Yes | Dedicated renderer / input path | 2 |
| extendLineLeft | false | Yes | output-effect-observed | 2 |
| showTargetText | true | Yes | output-effect-observed | 2 |
| textSize | 10 | Yes | output-effect-observed | 11 |
| summaryEnabled | false | Yes | output-effect-observed | 3 |
| volumeSummary | true | Yes | output-effect-observed | 2 |
| tradeSummary | true | Yes | output-effect-observed | 2 |
| summaryTextSize | 9 | Yes | output-effect-observed | 2 |
| summaryToView | 3 | Yes | output-effect-observed | 2 |
| useThemeColors | true | Yes | output-effect-observed | 75 |
| upColor | "#22C55E" | Yes | output-effect-observed | 34 |
| downColor | "#EF4444" | Yes | output-effect-observed | 34 |
| highColor | "#22C55E" | Yes | output-effect-observed | 7 |
| lowColor | "#EF4444" | Yes | output-effect-observed | 7 |
| textColor | "#FFFFFF" | Yes | output-effect-observed | 58 |
| summaryTextColor | "#FFFFFF" | Yes | output-effect-observed | 8 |
| askColor | "#22C55E" | Yes | output-effect-observed | 25 |
| bidColor | "#EF4444" | Yes | output-effect-observed | 24 |

## Text on Chart

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| fontSize | 30 | Yes | output-effect-observed | 88 |
| textColor | "#FFFFFF" | Yes | output-effect-observed | 58 |
| backgroundColor | "#333333" | Yes | output-effect-observed | 85 |
| text | "" | Yes | Dedicated renderer / input path | 327 |
| useThemeColors | true | Yes | output-effect-observed | 75 |

## Source Code Indicator

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|

## KWANT Stats

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| filterMin | 0 | Yes | Dedicated renderer / input path | 12 |
| filterMax | 0 | Yes | Dedicated renderer / input path | 12 |
| coloringDeviation | 2 | Yes | Dedicated renderer / input path | 2 |
| sessionStartHour | 17 | Yes | Dedicated renderer / input path | 3 |
| inputData | "Volume" | Not individually established | Dedicated renderer / input path | 15 |
| autoFormat | true | Yes | Dedicated renderer / input path | 2 |
| invertRows | false | Yes | Dedicated renderer / input path | 1 |
| showHeader | true | Yes | Dedicated renderer / input path | 10 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| showTotalVolume | true | Yes | Dedicated renderer / input path | 1 |
| showBidVolume | false | Yes | Dedicated renderer / input path | 1 |
| showAskVolume | false | Yes | Dedicated renderer / input path | 1 |
| showDeltaVolume | true | Yes | Dedicated renderer / input path | 1 |
| showMaxDeltaVolume | false | Yes | Dedicated renderer / input path | 1 |
| showMinDeltaVolume | false | Yes | Dedicated renderer / input path | 1 |
| showTotalTrades | false | Yes | Dedicated renderer / input path | 1 |
| showDeltaTrades | false | Yes | Dedicated renderer / input path | 1 |
| showRangeTicks | false | Yes | Dedicated renderer / input path | 1 |
| showDeltaPercent | true | Yes | Dedicated renderer / input path | 1 |
| showSessionCvd | false | Yes | Dedicated renderer / input path | 1 |
| showVolumePerSecond | false | Yes | Dedicated renderer / input path | 1 |
| showCotHigh | false | Yes | Dedicated renderer / input path | 1 |
| showCotLow | false | Yes | Dedicated renderer / input path | 1 |
| showCotBar | false | Yes | Dedicated renderer / input path | 1 |
| showDuration | false | Yes | Dedicated renderer / input path | 3 |
| showBarRatio | false | Yes | Dedicated renderer / input path | 1 |
| showHighRatio | false | Yes | Dedicated renderer / input path | 1 |
| showLowRatio | false | Yes | Dedicated renderer / input path | 1 |
| showTotalEffort | false | Yes | Dedicated renderer / input path | 1 |
| showDeltaEffort | false | Yes | Dedicated renderer / input path | 1 |
| positiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 19 |
| negativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 21 |
| neutralColor | "#94A3B8" | Yes | Dedicated renderer / input path | 33 |
| textColor | "#E5E7EB" | Yes | Dedicated renderer / input path | 58 |
| headerColor | "#27272A" | Yes | Dedicated renderer / input path | 5 |
| statsPaletteId | "" | Yes | Dedicated renderer / input path | 1 |
| statsSettingsVersion | 2 | Not individually established | Dedicated renderer / input path | 0 |

## Hedge Levels

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| fillOpacity | 5 | Yes | Dedicated renderer / input path | 27 |
| lineOpacity | 100 | Yes | Dedicated renderer / input path | 5 |
| showBelowFlip | true | Yes | Dedicated renderer / input path | 1 |
| showLabels | true | Yes | Dedicated renderer / input path | 61 |
| hedgeLevelsSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## KWANT-M IVB

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| lookbackSessions | 20 | Yes | Dedicated renderer / input path | 1 |
| zoneWidthTicks | 4 | Yes | Dedicated renderer / input path | 2 |
| lineWidth | 1 | Yes | Dedicated renderer / input path | 142 |
| zoneOpacity | 14 | Yes | Dedicated renderer / input path | 7 |
| openingRangeMinutes | 30 | Yes | Dedicated renderer / input path | 2 |
| showRange | true | Yes | Dedicated renderer / input path | 5 |
| showProtection | true | Yes | Dedicated renderer / input path | 2 |
| showAverage | true | Yes | Dedicated renderer / input path | 5 |
| showStandardDeviation | true | Yes | Dedicated renderer / input path | 2 |
| showZones | true | Yes | Dedicated renderer / input path | 8 |
| showSummary | true | Yes | Dedicated renderer / input path | 10 |
| extendToLiveEdge | true | Yes | Dedicated renderer / input path | 2 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| positiveColor | "#22C55E" | Yes | Dedicated renderer / input path | 19 |
| negativeColor | "#EF4444" | Yes | Dedicated renderer / input path | 21 |
| neutralColor | "#94A3B8" | Yes | Dedicated renderer / input path | 33 |
| deepMIVBSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## KWANT Pattern Builder

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| minImbalancePercent | 0 | Yes | Dedicated renderer / input path | 1 |
| maxImbalancePercent | 0 | Yes | Dedicated renderer / input path | 1 |
| markerSize | 7 | Yes | Dedicated renderer / input path | 22 |
| backgroundOpacity | 8 | Yes | Dedicated renderer / input path | 9 |
| daysToShow | 10 | Yes | Dedicated renderer / input path | 1 |
| condition1Enabled | true | Yes | Dedicated renderer / input path | 0 |
| condition1ASource | "close" | Yes | Dedicated renderer / input path | 0 |
| condition1AOffset | 0 | Yes | Dedicated renderer / input path | 0 |
| condition1AValue | 0 | Yes | Dedicated renderer / input path | 0 |
| condition1BSource | "unused" | Yes | Dedicated renderer / input path | 0 |
| condition1BOffset | 0 | Yes | Dedicated renderer / input path | 0 |
| condition1BValue | 0 | Yes | Dedicated renderer / input path | 0 |
| condition1LeftMath | "+" | Yes | Dedicated renderer / input path | 0 |
| condition1Comparator | ">" | Yes | Dedicated renderer / input path | 0 |
| condition1CSource | "open" | Yes | Dedicated renderer / input path | 0 |
| condition1COffset | 0 | Yes | Dedicated renderer / input path | 0 |
| condition1CValue | 0 | Yes | Dedicated renderer / input path | 0 |
| condition1DSource | "unused" | Yes | Dedicated renderer / input path | 0 |
| condition1DOffset | 0 | Yes | Dedicated renderer / input path | 0 |
| condition1DValue | 0 | Yes | Dedicated renderer / input path | 0 |
| condition1RightMath | "+" | Yes | Dedicated renderer / input path | 0 |
| condition2Enabled | false | Yes | Dedicated renderer / input path | 0 |
| condition3Enabled | false | Yes | Dedicated renderer / input path | 0 |
| condition4Enabled | false | Yes | Dedicated renderer / input path | 0 |
| combineMode | "and" | Yes | Dedicated renderer / input path | 1 |
| advancedExpression | "C1 AND C2" | Not individually established | Dedicated renderer / input path | 1 |
| calculateOnClose | true | Yes | Dedicated renderer / input path | 1 |
| plotMode | "marker" | Yes | Dedicated renderer / input path | 5 |
| markerPosition | "high" | Yes | Dedicated renderer / input path | 2 |
| alertsEnabled | false | Yes | Dedicated renderer / input path | 6 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| markerColor | "#22C55E" | Yes | Dedicated renderer / input path | 5 |
| patternBackgroundColor | "#22C55E" | Yes | Dedicated renderer / input path | 1 |
| deepPatternBuilderSettingsVersion | 1 | Not individually established | Dedicated renderer / input path | 0 |

## Big Blocks

| Setting | Default | UI save observed | Engine effect | Source references |
|---|---|---|---|---:|
| minimumBars | 20 | Yes | Dedicated renderer / input path | 4 |
| minimumDeltaPercent | 20 | Yes | Dedicated renderer / input path | 4 |
| maximumDeltaPercent | 100 | Yes | Dedicated renderer / input path | 2 |
| maximumDeltaEffort | 0 | Yes | Dedicated renderer / input path | 2 |
| averageLength | 21 | Yes | Dedicated renderer / input path | 4 |
| entryZoneRangePercent | 28 | Yes | Dedicated renderer / input path | 2 |
| zoneBars | 22 | Yes | Dedicated renderer / input path | 3 |
| zoneOpacity | 20 | Yes | Dedicated renderer / input path | 7 |
| zoneLineWidth | 1 | Yes | Dedicated renderer / input path | 1 |
| maLineWidth | 2 | Yes | Dedicated renderer / input path | 1 |
| useThemeColors | true | Yes | Dedicated renderer / input path | 75 |
| showZones | true | Yes | Dedicated renderer / input path | 8 |
| showMovingAverage | false | Yes | Dedicated renderer / input path | 1 |
| askColor | "#22C55E" | Yes | Dedicated renderer / input path | 25 |
| bidColor | "#7C3AED" | Yes | Dedicated renderer / input path | 24 |
| maAboveColor | "#22C55E" | Yes | Dedicated renderer / input path | 1 |
| maBelowColor | "#7C3AED" | Yes | Dedicated renderer / input path | 1 |
| maAutoColor | "price" | Not individually established | Dedicated renderer / input path | 1 |
| maLineStyle | "solid" | Not individually established | Dedicated renderer / input path | 1 |
| shortName | "Big Blocks" | Not individually established | Dedicated renderer / input path | 10 |
| showNameLabel | false | Yes | Dedicated renderer / input path | 2 |
| showValueLabel | true | Yes | Dedicated renderer / input path | 3 |
| nameBackground | false | Yes | Dedicated renderer / input path | 8 |
| valueBackground | true | Yes | Dedicated renderer / input path | 8 |
| enableAlertSound | false | Yes | Dedicated renderer / input path | 2 |
| enableMessage | false | Yes | Dedicated renderer / input path | 2 |
| alertMessage | "Big Blocks directional bias changed" | Not individually established | Dedicated renderer / input path | 3 |
| effortSettingsVersion | 5 | Not individually established | Dedicated renderer / input path | 0 |
