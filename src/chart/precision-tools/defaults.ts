import { PRECISION_TOOL_IDS, type PrecisionLabelOptions, type PrecisionObject, type PrecisionStyle, type PrecisionToolConfig, type PrecisionToolId, type PrecisionToolbarState } from "./types";

export const DEFAULT_FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;
export const DEFAULT_PROJECTION_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2] as const;

export function defaultPrecisionStyle(primary = "#68a8ff", bullish = "#1ed7b5", bearish = "#ff5576"): PrecisionStyle {
  return {
    stroke: primary,
    strokeWidth: 1.25,
    lineStyle: "solid",
    opacity: 1,
    fill: primary,
    fillOpacity: 0.1,
    fontFamily: "var(--font-mono), JetBrains Mono, monospace",
    fontSize: 11,
    fontWeight: 600,
    textColor: "#e9eef7",
    backgroundColor: "#0b111bcc",
    borderColor: "#33455e",
    positiveColor: bullish,
    negativeColor: bearish,
    neutralColor: "#8b98aa",
    valueAreaColor: primary,
    pocColor: "#f4cc61",
  };
}

export function defaultPrecisionLabels(): PrecisionLabelOptions {
  return { visible: true, text: "", position: "end", showPrice: true, showTime: false, showMetrics: true };
}

export function defaultToolOptions(toolId: PrecisionToolId): PrecisionObject["options"] {
  switch (toolId) {
    case "precision-fibonacci-retracement":
      return { levels: [...DEFAULT_FIB_LEVELS], extendLeft: false, extendRight: true, reverse: false, showPrices: true, showRatios: true };
    case "precision-fibonacci-projection":
      return { levels: [...DEFAULT_PROJECTION_LEVELS], extendRight: true, reverse: false, showPrices: true, showRatios: true };
    case "precision-fibonacci-fan":
      return { levels: [0.382, 0.5, 0.618, 0.786, 1], extendRight: true, showRatios: true };
    case "precision-volume-profile":
      return {
        mode: "volume-and-delta", side: "right", widthPercent: 28, showAboveBars: true,
        alwaysVisible: false, extendProfileArea: false, automaticTickGrouping: true,
        automaticGroupingFactor: 1, manualTicksPerRow: 1, showValues: false,
        numberFormat: "automatic", summaryEnabled: true, showPoc: true,
        pocLineEnabled: true, pocExtendMode: "selection", displayPocValue: true,
        showValueArea: true, valueAreaPercent: 70, valueAreaLines: true,
        valueAreaExtendMode: "selection", peakValleyEnabled: false,
        peakSensitivity: 0.65, peakMinimumVolume: 0, valleyMaximumVolume: 0,
      };
    case "precision-anchored-vwap":
      return {
        source: "hlc3", extendToLive: true, fixedEndTime: 0, priceAxisValues: true,
        bandFills: true,
        band1Enabled: true, band1Multiplier: 1,
        band2Enabled: true, band2Multiplier: 2,
        band3Enabled: true, band3Multiplier: 3,
        band4Enabled: false, band4Multiplier: 4,
        band5Enabled: false, band5Multiplier: 5,
      };
    case "precision-buy-calculator":
    case "precision-sell-calculator":
      return {
        quantityMode: "fixed", quantity: 1, riskBudget: 0, targetAmount: 0,
        commissionPerContract: 0, slippageTicks: 0, backgroundEnabled: true,
        stopEnabled: true, stopMode: "ticks", stopValue: 0,
        targetEnabled: true, targetMode: "ticks", targetValue: 0,
        showEntry: true, showPnl: true, showRiskReward: true,
        showAbsolutePrice: true, showPriceOffset: true,
      };
    case "precision-text":
      return { align: "left", background: true, padding: 6 };
    case "precision-pencil":
      return { simplifyTolerance: 1.5, smooth: true };
    default:
      return { extendLeft: false, extendRight: false, showPrices: true };
  }
}

export function defaultPrecisionToolbarState(): PrecisionToolbarState {
  return {
    collapsed: false,
    hidden: false,
    locked: false,
    snapMode: "weak",
    activeGroup: null,
    activeTool: null,
    mode: "select",
    activeConfigSlot: 1,
    activeConfigSlots: {},
    visibleGroups: ["geometry", "shapes-notes", "fibonacci", "analysis", "trade-calculators"],
  };
}

export function createDefaultConfigs(primary?: string, bullish?: string, bearish?: string): PrecisionToolConfig[] {
  const now = Date.now();
  return PRECISION_TOOL_IDS.flatMap((toolId) => Array.from({ length: 9 }, (_, index) => ({
    schemaVersion: 1 as const,
    toolId,
    slot: index + 1,
    name: `TC${index + 1}`,
    style: defaultPrecisionStyle(primary, bullish, bearish),
    labels: defaultPrecisionLabels(),
    options: defaultToolOptions(toolId),
    updatedAt: now,
  })));
}
