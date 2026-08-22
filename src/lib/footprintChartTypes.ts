import type { FootprintSettings } from "@/lib/footprintSettings";

/**
 * The footprint as a trader picks it: choose the chart, then the variant.
 *
 * The engine has long carried the content, visualisation, colour-calculation
 * and input-type switches that make these views, but they were four
 * independent dropdowns — so reaching "Delta coloured trades histogram" meant
 * knowing which four values combined to produce it, and most combinations
 * produce nothing anyone wants. The pairs that ARE views are named here, and
 * each one resolves to the exact engine settings behind it.
 *
 * Nothing here invents a rendering mode: every variant is a combination the
 * primitive already draws.
 */
export type FootprintChartTypeId = "volume" | "trades" | "bid-ask" | "delta" | "heatmap";

/** The settings a variant owns. Everything else the trader has set is kept. */
export type FootprintVariantSettings = Partial<Pick<
  FootprintSettings,
  | "contentMode"
  | "visualizationMode"
  | "colorCalculation"
  | "colorMode"
  | "inputType"
  | "showCellText"
  | "showPerBarVolumeProfile"
  | "showPerBarDeltaProfile"
>>;

export type FootprintVariant = {
  id: string;
  label: string;
  /** What the trader reads off it — shown under the variant list. */
  description: string;
  settings: FootprintVariantSettings;
};

export type FootprintChartType = {
  id: FootprintChartTypeId;
  label: string;
  description: string;
  variants: FootprintVariant[];
};

export const FOOTPRINT_CHART_TYPES: readonly FootprintChartType[] = [
  {
    id: "volume",
    label: "Volume",
    description: "Traded volume at each price level within the candle.",
    variants: [
      {
        id: "volume",
        label: "Volume footprint",
        description: "Volume distribution across price levels.",
        settings: { contentMode: "volume", visualizationMode: "solid", colorCalculation: "volume", inputType: "volume", showCellText: true },
      },
      {
        id: "volume-delta-coloured",
        label: "Delta coloured volume",
        description: "Volume, coloured by the buying and selling imbalance at each level.",
        settings: { contentMode: "volume", visualizationMode: "solid", colorCalculation: "dominant-delta", inputType: "volume", showCellText: true },
      },
      {
        id: "volume-histogram",
        label: "Volume histogram",
        description: "Levels of concentrated volume, as bars.",
        settings: { contentMode: "volume-histogram", visualizationMode: "histogram", colorCalculation: "volume", inputType: "volume", showCellText: false },
      },
      {
        id: "volume-digital-histogram",
        label: "Volume digital histogram",
        description: "The same bars with the figures printed on them.",
        settings: { contentMode: "volume-histogram", visualizationMode: "histogram", colorCalculation: "volume", inputType: "volume", showCellText: true },
      },
      {
        id: "volume-delta-histogram",
        label: "Delta coloured volume histogram",
        description: "Volume bars coloured by buying or selling pressure.",
        settings: { contentMode: "volume-histogram", visualizationMode: "histogram", colorCalculation: "dominant-delta", inputType: "volume", showCellText: false },
      },
      {
        id: "volume-trades",
        label: "Volume × trades",
        description: "Traded size beside the number of trades that made it.",
        settings: { contentMode: "volume-trades", visualizationMode: "solid", colorCalculation: "volume", inputType: "volume", showCellText: true },
      },
    ],
  },
  {
    id: "trades",
    label: "Trades",
    description: "How many trades executed at each price level within the candle.",
    variants: [
      {
        id: "trades",
        label: "Trades",
        description: "Trading intensity at a given price level.",
        settings: { contentMode: "trades", visualizationMode: "solid", colorCalculation: "volume", inputType: "num-trades", showCellText: true },
      },
      {
        id: "trades-delta-coloured",
        label: "Delta coloured trades",
        description: "Trade counts coloured by buyer or seller dominance.",
        settings: { contentMode: "trades", visualizationMode: "solid", colorCalculation: "dominant-delta", inputType: "num-trades", showCellText: true },
      },
      {
        id: "trades-histogram",
        label: "Trades histogram",
        description: "Levels of concentrated trading activity, as bars.",
        settings: { contentMode: "trades-histogram", visualizationMode: "histogram", colorCalculation: "volume", inputType: "num-trades", showCellText: false },
      },
      {
        id: "trades-digital-histogram",
        label: "Trades digital histogram",
        description: "The same bars with the counts printed on them.",
        settings: { contentMode: "trades-histogram", visualizationMode: "histogram", colorCalculation: "volume", inputType: "num-trades", showCellText: true },
      },
      {
        id: "trades-delta-histogram",
        label: "Delta coloured trades histogram",
        description: "Trade-count bars coloured by buyer or seller dominance.",
        settings: { contentMode: "trades-histogram", visualizationMode: "histogram", colorCalculation: "dominant-delta", inputType: "num-trades", showCellText: false },
      },
    ],
  },
  {
    id: "bid-ask",
    label: "Bid × Ask",
    description: "Buy and sell volume side by side at each price level.",
    variants: [
      {
        id: "bid-ask",
        label: "Bid × Ask",
        description: "How buying and selling volume is distributed across levels.",
        settings: { contentMode: "bid-ask", visualizationMode: "solid", colorCalculation: "imbalance", inputType: "volume", showCellText: true },
      },
      {
        id: "bid-ask-ladder",
        label: "Bid × Ask ladder",
        description: "Only the side with a delta dominance at each level.",
        settings: { contentMode: "ladder", visualizationMode: "solid", colorCalculation: "dominant", inputType: "volume", showCellText: true },
      },
      {
        id: "bid-ask-delta-coloured",
        label: "Bid × Ask delta coloured",
        description: "Buyer or seller dominance at a glance.",
        settings: { contentMode: "bid-ask", visualizationMode: "solid", colorCalculation: "dominant-delta", inputType: "volume", showCellText: true },
      },
      {
        id: "bid-ask-histogram",
        label: "Bid × Ask histogram",
        description: "Levels of increased volume on each side, as bars.",
        settings: { contentMode: "bid-ask-histogram", visualizationMode: "histogram", colorCalculation: "imbalance", inputType: "volume", showCellText: false },
      },
      {
        id: "bid-ask-digital-histogram",
        label: "Bid × Ask digital histogram",
        description: "The same bars with both sides' figures printed.",
        settings: { contentMode: "bid-ask-histogram", visualizationMode: "histogram", colorCalculation: "imbalance", inputType: "volume", showCellText: true },
      },
      {
        id: "bid-ask-volume-profile",
        label: "Bid × Ask volume profile",
        description: "The bar's own profile, with buying and selling separated.",
        settings: { contentMode: "bid-ask", visualizationMode: "solid", colorCalculation: "imbalance", inputType: "volume", showCellText: true, showPerBarVolumeProfile: true },
      },
      {
        id: "bid-ask-delta-profile",
        label: "Bid × Ask delta profile",
        description: "The bar's own delta distribution across levels.",
        settings: { contentMode: "bid-ask", visualizationMode: "solid", colorCalculation: "imbalance", inputType: "volume", showCellText: true, showPerBarDeltaProfile: true },
      },
    ],
  },
  {
    id: "delta",
    label: "Delta",
    description: "The difference between buying and selling volume at each price level.",
    variants: [
      {
        id: "delta",
        label: "Delta",
        description: "Which side dominated at a given price level.",
        settings: { contentMode: "delta", visualizationMode: "solid", colorCalculation: "delta", inputType: "volume", showCellText: true },
      },
      {
        id: "delta-volume",
        label: "Delta × volume",
        description: "Delta in the context of the total traded at that level.",
        settings: { contentMode: "volume-delta", visualizationMode: "solid", colorCalculation: "delta", inputType: "volume", showCellText: true },
      },
      {
        id: "delta-histogram",
        label: "Delta histogram",
        description: "The distribution of delta across levels, as bars.",
        settings: { contentMode: "delta-histogram", visualizationMode: "histogram", colorCalculation: "delta", inputType: "volume", showCellText: false },
      },
      {
        id: "delta-profile",
        label: "Delta profile",
        description: "The bar's own delta profile beside it.",
        settings: { contentMode: "delta", visualizationMode: "solid", colorCalculation: "delta", inputType: "volume", showCellText: true, showPerBarDeltaProfile: true },
      },
    ],
  },
  {
    id: "heatmap",
    label: "Heatmap",
    description: "Footprint data as colour intensity, read as structure rather than figures.",
    variants: [
      {
        id: "heatmap-volume",
        label: "By volume",
        description: "Where volume concentrated.",
        settings: { contentMode: "volume", visualizationMode: "heatmap", colorCalculation: "volume", colorMode: "fading", inputType: "volume", showCellText: false },
      },
      {
        id: "heatmap-trades",
        label: "By trades",
        description: "Trading-activity intensity by number of trades.",
        settings: { contentMode: "trades", visualizationMode: "heatmap", colorCalculation: "volume", colorMode: "fading", inputType: "num-trades", showCellText: false },
      },
      {
        id: "heatmap-delta",
        label: "By delta",
        description: "Buyer or seller dominance as a colour gradient.",
        settings: { contentMode: "delta", visualizationMode: "heatmap", colorCalculation: "dominant-delta", colorMode: "fading", inputType: "volume", showCellText: false },
      },
    ],
  },
] as const;

export const DEFAULT_FOOTPRINT_CHART_TYPE: FootprintChartTypeId = "bid-ask";
export const DEFAULT_FOOTPRINT_VARIANT = "bid-ask";

export function footprintChartType(id: unknown): FootprintChartType {
  return FOOTPRINT_CHART_TYPES.find((type) => type.id === id)
    ?? FOOTPRINT_CHART_TYPES.find((type) => type.id === DEFAULT_FOOTPRINT_CHART_TYPE)!;
}

/** The variant, falling back to the type's first when the id is unknown. */
export function footprintVariant(typeId: unknown, variantId: unknown): FootprintVariant {
  const type = footprintChartType(typeId);
  return type.variants.find((variant) => variant.id === variantId) ?? type.variants[0];
}

/**
 * The engine settings a chart type and variant imply.
 *
 * Only the keys the variant owns are returned, so everything else the trader
 * has tuned — grouping, colours, widths, the side profile's row size — is
 * carried across when they switch view.
 */
export function footprintVariantSettings(
  typeId: unknown,
  variantId: unknown,
): FootprintVariantSettings {
  const variant = footprintVariant(typeId, variantId);
  // The two profile switches are owned by the variants that turn them ON, so a
  // view without them must clear them rather than inherit them from the last.
  return {
    showPerBarVolumeProfile: false,
    showPerBarDeltaProfile: false,
    ...variant.settings,
  };
}

/**
 * Which settings belong to which chart.
 *
 * Every footprint control used to be shown for every chart, so a Trades chart
 * offered bid/ask imbalance thresholds that could not affect it and a Heatmap
 * offered a cell-text width that it never draws. A setting listed here is
 * offered only for the charts named; anything not listed applies to all of
 * them.
 */
const SETTING_CHART_TYPES: Record<string, readonly FootprintChartTypeId[]> = {
  // Imbalance compares the two sides, so it needs both sides to exist.
  imbalanceMode: ["bid-ask"],
  minimumRatio: ["bid-ask"],
  maximumRatio: ["bid-ask"],
  minimumOpacity: ["volume", "trades", "bid-ask", "delta", "heatmap"],
  // The heatmap is read as colour, never as figures.
  minimumWidthToShowText: ["volume", "trades", "bid-ask", "delta"],
  minimumRowHeightToShowText: ["volume", "trades", "bid-ask", "delta"],
  numberFormat: ["volume", "trades", "bid-ask", "delta"],
  // Colour mode is what the heatmap IS; it must not be switchable there.
  colorMode: ["volume", "trades", "bid-ask", "delta"],
};

export function footprintSettingApplies(key: string, chartTypeId: unknown): boolean {
  const allowed = SETTING_CHART_TYPES[key];
  if (!allowed) return true;
  return allowed.includes(footprintChartType(chartTypeId).id);
}

/** The tab a footprint setting belongs under. */
const SETTING_SECTIONS: Record<string, string> = {
  scaleMode: "Scale",
  fixedMaximum: "Scale",
  visibleRegionPercentile: "Scale",
  gradientExponent: "Scale",
  groupingMode: "Grouping",
  groupMode: "Grouping",
  manualTicks: "Grouping",
  autoGroupFactor: "Grouping",
  imbalanceMode: "Imbalance",
  minimumRatio: "Imbalance",
  maximumRatio: "Imbalance",
  numberFormat: "Cells",
  minimumWidthToShowText: "Cells",
  minimumRowHeightToShowText: "Cells",
  barWidth: "Cells",
  candleSpacing: "Cells",
  fontSize: "Cells",
  fontWeight: "Cells",
  borderWidth: "Cells",
  outsideBarStyle: "Cells",
  markerAlignment: "Cells",
  colorMode: "Colours",
  backgroundOpacity: "Colours",
  minimumOpacity: "Colours",
  maximumOpacity: "Colours",
  fpsLimit: "Performance",
  maximumRenderedBlocks: "Performance",
};

export function footprintSettingSection(key: string): string {
  if (key.startsWith("perBarProfile") || key.startsWith("showPerBar") || key.startsWith("perBar")) {
    return "Profile";
  }
  return SETTING_SECTIONS[key] ?? "Cells";
}
