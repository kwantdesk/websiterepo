/**
 * Authoritative TradingView left-toolbar reconstruction inventory.
 *
 * This is deliberately data-only. Chart.tsx owns the visual shell and icon
 * components, while this catalog owns product identity, ordering, anchor
 * requirements and engine routing. Keeping those concerns separate prevents
 * the toolbar and drawing runtime from drifting apart again.
 */
export type ReconstructedToolEngine =
  | "cursor"
  | "segment"
  | "channel"
  | "pitchfork"
  | "level-projection"
  | "pattern"
  | "widget"
  | "shape"
  | "annotation"
  | "content";

export type ReconstructedToolDefinition = {
  specId: `TV-LTB-${string}`;
  appTool: string;
  dataName: string;
  group: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  engine: ReconstructedToolEngine;
  anchors: number;
};

const group = (
  number: ReconstructedToolDefinition["group"],
  engine: ReconstructedToolEngine,
  tools: Array<[string, string, number]>,
): ReconstructedToolDefinition[] => tools.map(([appTool, dataName, anchors], index) => ({
  specId: `TV-LTB-${number}${String(index + 1).padStart(2, "0")}`,
  appTool,
  dataName,
  group: number,
  engine,
  anchors,
}));

export const TRADINGVIEW_TOOLBAR_CATALOG: readonly ReconstructedToolDefinition[] = [
  ...group(1, "cursor", [
    ["cursor", "Cross", 0], ["dot", "LineToolDot", 1], ["arrowCursor", "Arrow", 0],
    ["demonstration", "Demonstration", 0], ["magic", "Magic", 0], ["eraser", "Eraser", 0],
  ]),
  ...group(2, "segment", [
    ["trendLine", "LineToolTrendLine", 2], ["ray", "LineToolRay", 2], ["infoLine", "LineToolInfoLine", 2],
    ["extendedLine", "LineToolExtended", 2], ["trendAngle", "LineToolTrendAngle", 2],
    ["horizontalLine", "LineToolHorzLine", 1], ["horizontalRay", "LineToolHorzRay", 1],
    ["verticalLine", "LineToolVertLine", 1], ["crossLine", "LineToolCrossLine", 1],
    ["parallelChannel", "LineToolParallelChannel", 3], ["regressionTrend", "LineToolRegressionTrend", 2],
    ["flatTopBottom", "LineToolFlatTop", 3], ["disjointChannel", "LineToolDisjointChannel", 4],
    ["pitchfork", "LineToolPitchfork", 3], ["schiffPitchfork", "LineToolSchiffPitchfork", 3],
    ["modifiedSchiffPitchfork", "LineToolSchiffPitchfork2", 3], ["insidePitchfork", "LineToolInsidePitchfork", 3],
  ]),
  ...group(3, "level-projection", [
    ["fibRetracement", "LineToolFibRetracement", 2], ["trendBasedFibExtension", "LineToolFibExtension", 3],
    ["fibChannel", "LineToolFibChannel", 3], ["fibTimeZone", "LineToolFibTimeZone", 2],
    ["fibSpeedResistanceFan", "LineToolFibSpeedResistanceFan", 2], ["trendBasedFibTime", "LineToolTrendBasedFibTime", 3],
    ["fibCircles", "LineToolFibCircles", 2], ["fibSpiral", "LineToolFibSpiral", 2],
    ["fibSpeedResistanceArcs", "LineToolFibSpeedResistanceArcs", 2], ["fibWedge", "LineToolFibWedge", 3],
    ["pitchfan", "LineToolPitchfan", 3], ["gannBox", "LineToolGannBox", 2],
    ["gannSquareFixed", "LineToolGannSquareFixed", 2], ["gannSquare", "LineToolGannSquare", 2],
    ["gannFan", "LineToolGannFan", 2],
  ]),
  ...group(4, "pattern", [
    ["xabcdPattern", "LineTool5PointsPattern", 5], ["cypherPattern", "LineToolCypherPattern", 5],
    ["headAndShoulders", "LineToolHeadAndShoulders", 7], ["abcdPattern", "LineToolABCD", 4],
    ["trianglePattern", "LineToolTrianglePattern", 4], ["threeDrivesPattern", "LineToolThreeDrives", 7],
    ["elliottImpulseWave", "LineToolElliottImpulse", 6], ["elliottCorrectionWave", "LineToolElliottCorrection", 4],
    ["elliottTriangleWave", "LineToolElliottTriangle", 6], ["elliottDoubleComboWave", "LineToolElliottDoubleCombo", 4],
    ["elliottTripleComboWave", "LineToolElliottTripleCombo", 6], ["cyclicLines", "LineToolCyclicLines", 2],
    ["timeCycles", "LineToolTimeCycles", 2], ["sineLine", "LineToolSineLine", 2],
  ]),
  ...group(5, "widget", [
    ["longPosition", "LineToolLongPosition", 3], ["shortPosition", "LineToolShortPosition", 3],
    ["positionForecast", "LineToolForecast", 2], ["barPattern", "LineToolBarsPattern", 3],
    ["ghostFeed", "LineToolGhostFeed", 2], ["sector", "LineToolProjection", 3],
    ["anchoredVwap", "LineToolAnchoredVWAP", 1], ["fixedRangeVolumeProfile", "LineToolFixedRangeVolumeProfile", 2],
    ["anchoredVolumeProfile", "LineToolAnchoredVolumeProfile", 1], ["priceRange", "LineToolPriceRange", 2],
    ["dateRange", "LineToolDateRange", 2], ["datePriceRange", "LineToolDateAndPriceRange", 2],
  ]),
  ...group(6, "shape", [
    ["brush", "LineToolBrush", 2], ["highlighter", "LineToolHighlighter", 2],
    ["arrowMarker", "LineToolArrowMarker", 2], ["arrow", "LineToolArrow", 2],
    ["arrowMarkUp", "LineToolArrowMarkUp", 1], ["arrowMarkDown", "LineToolArrowMarkDown", 1],
    ["rectangle", "LineToolRectangle", 2], ["rotatedRectangle", "LineToolRotatedRectangle", 3],
    ["path", "LineToolPath", 2], ["circle", "LineToolCircle", 2], ["ellipse", "LineToolEllipse", 2],
    ["polyline", "LineToolPolyline", 3], ["triangle", "LineToolTriangle", 3], ["arc", "LineToolArc", 3],
    ["curve", "LineToolCurve", 3], ["doubleCurve", "LineToolDoubleCurve", 4],
  ]),
  ...group(7, "annotation", [
    ["text", "LineToolText", 1], ["note", "LineToolNote", 1], ["priceNote", "LineToolPriceNote", 1],
    ["pin", "LineToolPin", 1], ["table", "LineToolTable", 1], ["callout", "LineToolCallout", 2],
    ["comment", "LineToolComment", 1], ["priceLabel", "LineToolPriceLabel", 1],
    ["signpost", "LineToolSignpost", 1], ["flagMark", "LineToolFlagMark", 1],
    ["image", "LineToolImage", 1], ["post", "LineToolPost", 1], ["idea", "LineToolIdea", 1],
  ]),
] as const;

export const TRADINGVIEW_TOOLBAR_TOOL_COUNT = 93;
export const TRADINGVIEW_TOOLBAR_TOOL_IDS = new Set(TRADINGVIEW_TOOLBAR_CATALOG.map((tool) => tool.appTool));
export const TRADINGVIEW_TOOLBAR_BY_APP_TOOL = new Map(TRADINGVIEW_TOOLBAR_CATALOG.map((tool) => [tool.appTool, tool]));

if (TRADINGVIEW_TOOLBAR_CATALOG.length !== TRADINGVIEW_TOOLBAR_TOOL_COUNT) {
  throw new Error(`TradingView toolbar catalog drifted: expected ${TRADINGVIEW_TOOLBAR_TOOL_COUNT}, received ${TRADINGVIEW_TOOLBAR_CATALOG.length}`);
}
if (TRADINGVIEW_TOOLBAR_TOOL_IDS.size !== TRADINGVIEW_TOOLBAR_CATALOG.length) {
  throw new Error("TradingView toolbar catalog contains duplicate application tool IDs");
}
