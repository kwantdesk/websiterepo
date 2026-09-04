import type { ChartIndicatorDefinition } from "@/lib/chartIndicatorCatalog";
import { getMarketIndexDefinition } from "@/lib/marketIndices";

export type IndicatorInstrumentKind = "futures" | "cash-index" | "equity-underlying";
export type IndicatorCompatibilityStatus = "native" | "adapted" | "unavailable";

export type IndicatorCompatibility = {
  status: IndicatorCompatibilityStatus;
  kind: IndicatorInstrumentKind;
  label: string;
  reason: string;
  canAdd: boolean;
};

const CANDLE_PROFILE_IDS = new Set([
  "kwant-profile",
  "weekly-volume-profile",
  "composite-volume-profile",
  "custom-draw-on-volume-profile",
]);

const TPO_IDS = new Set([
  "tpo-chart",
  "weekly-tpo",
  "market-profile-tpo",
  "tpo-levels",
]);

const CASH_VOLUME_IDS = new Set([
  "volume",
  "vwap",
  "vwap-envelopes",
  "rolling-vwap",
  "chaikin-accumulation-distribution",
]);

const OPTIONS_ONLY_IDS = new Set([
  "gamma-environment",
  "zero-gamma-line",
  "options-delta",
  "zero-gamma-bars",
  "gamma-heatmap",
  "net-gamma-exposure-by-strike",
  "gex-interval-map",
  "bounce-levels",
  "implied-volatility-rank",
  "expected-move",
  "hedge-levels",
  "gamma-levels",
  "classic-gex-profile",
]);

const EQUITY_ONLY_OPTIONS_IDS = new Set(["dark-pool-map", "dark-pool-gex"]);

export function indicatorInstrumentKind(instrument: string, broker?: string): IndicatorInstrumentKind {
  const definition = getMarketIndexDefinition(instrument);
  if (definition?.providerKind === "INDEX") return "cash-index";
  if (definition?.providerKind === "STOCK" || broker === "Market Index") return "equity-underlying";
  return "futures";
}

/**
 * One authoritative gate for the library and the runtime contract.
 *
 * SPX/NDX are cash indices: they have prices but no executable tape or native
 * traded volume. Calling an ES/NQ tape "SPX volume" would be fabricated data,
 * so the UI labels that intentional hedge-futures projection. SPY/QQQ and the
 * single-stock underlyings use their own OHLCV bars. Exact aggressor/MBO
 * studies remain unavailable until a licensed consolidated executions feed is
 * connected for those instruments.
 */
export function indicatorCompatibility(
  definition: ChartIndicatorDefinition,
  instrument: string,
  broker?: string,
): IndicatorCompatibility {
  const kind = indicatorInstrumentKind(instrument, broker);
  const normalizedInstrument = instrument.trim().toUpperCase().replace(/[^A-Z0-9].*$/, "");
  if (kind === "futures") {
    const hasOptionsFamily = ["ES", "MES", "NQ", "MNQ", "RTY", "M2K"].includes(normalizedInstrument);
    if ((OPTIONS_ONLY_IDS.has(definition.id) || definition.category === "Options Flow") && !hasOptionsFamily) {
      return {
        status: "unavailable",
        kind,
        label: "No options mapping",
        reason: `${instrument} has no configured QuantData options-family mapping for ${definition.name}.`,
        canAdd: false,
      };
    }
    return {
      status: "native",
      kind,
      label: "Rithmic native",
      reason: "Uses this futures contract's candle, execution or MBO stream.",
      canAdd: true,
    };
  }

  if (EQUITY_ONLY_OPTIONS_IDS.has(definition.id)) {
    const native = kind === "equity-underlying";
    return {
      status: native ? "native" : "unavailable",
      kind,
      label: native ? "Native equity tape" : "No index dark pool tape",
      reason: native
        ? `Uses ${instrument}'s own off-exchange equity prints.`
        : `${instrument} is an index, not a traded equity, so it has no dark-pool prints.`,
      canAdd: native,
    };
  }

  if (OPTIONS_ONLY_IDS.has(definition.id) || definition.category === "Options Flow") {
    return {
      status: "native",
      kind,
      label: "QuantData options",
      reason: `Uses the options family and price scale for ${instrument}.`,
      canAdd: true,
    };
  }

  if (TPO_IDS.has(definition.id)) {
    return {
      status: "native",
      kind,
      label: "Native candles",
      reason: `Builds time-at-price from ${instrument}'s own five-day candle history.`,
      canAdd: true,
    };
  }

  if (CANDLE_PROFILE_IDS.has(definition.id)) {
    const projected = kind === "cash-index";
    return {
      status: projected ? "adapted" : "native",
      kind,
      label: projected ? "Hedge-futures profile" : "Native bar volume",
      reason: projected
        ? `${instrument} has no traded volume. The profile uses the related ES/NQ execution distribution, projected and explicitly labelled on the ${instrument} price scale.`
        : `Uses ${instrument}'s own five-day OHLCV history; it is not substituted with ES or NQ.`,
      canAdd: true,
    };
  }

  if (CASH_VOLUME_IDS.has(definition.id) && kind === "cash-index") {
    return {
      status: "unavailable",
      kind,
      label: "No native index volume",
      reason: `${instrument} is not directly traded, so a native volume-weighted calculation would be false. Use TPO or the explicitly labelled hedge-futures profile.`,
      canAdd: false,
    };
  }

  if (definition.requiresOrderFlow) {
    return {
      status: "unavailable",
      kind,
      label: "Executions required",
      reason: `${definition.name} needs per-trade aggressor or Level 3 data for ${instrument}; QuantData options data is not a substitute for an underlying execution book.`,
      canAdd: false,
    };
  }

  return {
    status: "native",
    kind,
    label: "Native candles",
    reason: `Calculates from ${instrument}'s own five-day OHLC history.`,
    canAdd: true,
  };
}
