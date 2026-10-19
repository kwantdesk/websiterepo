export type OptionsFlowSource = "gex-data" | "kwanty" | "gex-box";
export type OptionsFlowPanelKind = `options-flow:${OptionsFlowSource}:${string}`;
export type OptionsFlowState = Record<string, string>;

const dataTools = [
  ["dark-flow", "Dark Flow"], ["dark-pool-levels", "Dark Pool Levels"],
  ["equity-prints", "Equity Prints"], ["exchange-notifications", "Exchange Notifications"],
  ["market-map", "Market Map"], ["stock-price-over-time", "Stock Price / Time"],
  ["order-flow-consolidated", "Consolidated Order Flow"], ["option-price-over-time", "Contract Price / Time"],
  ["contract-trade-side-statistics", "Contract Side Statistics"], ["contract-statistics", "Contract Statistics"],
  ["gainers-losers", "Gainers / Losers"], ["market-share", "Market Share"], ["market-share-table", "Market Share Table"],
  ["exposure-by-expiration", "Exposure by Expiration"], ["exposure-by-strike", "Exposure by Strike"],
  ["exposure-forecast", "Exposure Forecast"], ["heat-map", "Heat Map"], ["iv-rank", "Implied Volatility Rank"],
  ["interval-map", "Interval Map"], ["max-pain", "Max Pain"], ["max-pain-over-time", "Max Pain / Time"], ["net-drift", "Net Drift"],
];
const boxTools = [
  ["consolidated-flow", "Consolidated Order Flow"], ["contract-side-statistics", "Contract Side Statistics"],
  ["contract-statistics", "Contract Statistics"], ["exposure-expiration", "Exposure by Expiration"],
  ["exposure-strike", "Exposure by Strike"], ["gainers-losers", "Gainers / Losers"], ["gex-flow", "GEX Flow"],
  ["heat-map", "Heat Map"], ["iv-rank", "IV Rank"], ["interval-map", "Interval Map"], ["max-pain", "Max Pain"],
  ["net-drift", "Net Drift"], ["net-flow", "Net Flow"], ["oi-strike", "OI by Strike"],
  ["term-structure", "Term Structure"], ["unconsolidated-flow", "Unconsolidated Order Flow"],
  ["volatility-drift", "Volatility Drift"], ["dark-pool-levels", "Dark Pool Levels"], ["equity-prints", "Equity Prints"],
  ["market-map", "Market Map"], ["stock-price-time", "Stock Price / Time"], ["gex-cal", "GEX CAL"],
  ["classic-gex", "Classic GEX"], ["state-profile", "State Profile"], ["orderflow-profile", "Orderflow Profile"],
];
export const OPTIONS_FLOW_TOOLS = ([
  ["gex-data", dataTools],
  ["kwanty", [["classic", "Positioning Classic"], ["state", "Positioning State"], ["orderflow", "Positioning Orderflow"], ["calendar", "Options Expiration Calendar"]]],
  ["gex-box", boxTools],
] as const).flatMap(([source, tools]) => tools.map(([toolId, label]) => ({
  id: `options-flow:${source}:${toolId}` as OptionsFlowPanelKind,
  source, toolId, label,
  description: source === "kwanty" ? "KWANTY · live positioning and adjustable settings"
    : source === "gex-data" ? "GEX DATA · original tool, controls and filters" : "GEX BOX · original tool and settings",
})));
export function optionsFlowTool(value: unknown) {
  return OPTIONS_FLOW_TOOLS.find(tool => tool.id === value);
}
export function optionsFlowInitialSymbol(instrument: string, allowed: readonly string[]) {
  const symbol = instrument.toUpperCase();
  const families: Array<[RegExp, string]> = [
    [/^(?:ES|MES)(?:[FGHJKMNQUVXZ]\d+|\.[vnc]\.\d+)?$/i, "SPX"],
    [/^(?:NQ|MNQ)(?:[FGHJKMNQUVXZ]\d+|\.[vnc]\.\d+)?$/i, "NDX"],
    [/^(?:YM|MYM)(?:[FGHJKMNQUVXZ]\d+|\.[vnc]\.\d+)?$/i, "DIA"],
    [/^(?:RTY|M2K)(?:[FGHJKMNQUVXZ]\d+|\.[vnc]\.\d+)?$/i, "IWM"],
  ];
  const candidate = symbol === "SPXW" ? "SPX" : families.find(([pattern]) => pattern.test(symbol))?.[1] ?? symbol;
  // A tool has its own visibly labelled instrument selector. Unsupported
  // futures start at the source tool's stock SPY, never an empty selection.
  return allowed.includes(candidate) ? candidate : "SPY";
}
export function normalizeOptionsFlowState(value: unknown): OptionsFlowState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value);
  if (entries.length > 500 || entries.some(([key, item]) => key.length > 240 || typeof item !== "string")) return {};
  return JSON.stringify(value).length <= 1_500_000 ? Object.fromEntries(entries) : {};
}
