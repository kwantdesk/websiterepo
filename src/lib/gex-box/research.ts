export type ResearchChart = "oi" | "gex" | "dex" | "vanna" | "charm";
export type ResearchView = "profile" | "ladder" | "timeseries";

export type GexResearchRequest = {
  chart: ResearchChart;
  symbol: string;
  strikes: number;
  dteMin: number;
  dteMax: number;
  view: ResearchView;
  calls: "all" | "itm" | "otm";
  puts: "all" | "itm" | "otm";
  combine: boolean;
};

const charts = new Set<ResearchChart>(["oi", "gex", "dex", "vanna", "charm"]);
const views = new Set<ResearchView>(["profile", "ladder", "timeseries"]);

export function parseGexResearchCommand(command: string): GexResearchRequest {
  const tokens = command.trim().split(/\s+/).filter(Boolean);
  const chart = tokens.shift()?.replace(/^!/, "").toLowerCase() as ResearchChart;
  const symbol = tokens.shift()?.toUpperCase() ?? "";
  if (!charts.has(chart)) throw new Error("Research command must begin with !oi, !gex, !dex, !vanna, or !charm.");
  if (!/^[A-Z][A-Z0-9._-]{0,11}$/.test(symbol)) throw new Error("Research command requires a valid symbol.");
  const request: GexResearchRequest = { chart, symbol, strikes: 15, dteMin: 0, dteMax: 90, view: "profile", calls: "all", puts: "all", combine: false };
  for (const token of tokens) {
    const [rawKey, rawValue] = token.split("=", 2);
    const key = rawKey.toLowerCase();
    const value = rawValue?.toLowerCase();
    if (key === "combine") { request.combine = true; continue; }
    if (key === "strikes") { request.strikes = Number(value); continue; }
    if (key === "dte") {
      const [minimum, maximum] = (value ?? "").split("..").map(Number);
      request.dteMin = minimum;
      request.dteMax = maximum;
      continue;
    }
    if (key === "view" && value && views.has(value as ResearchView)) { request.view = value as ResearchView; continue; }
    if (key === "calls" && (value === "all" || value === "itm" || value === "otm")) { request.calls = value; continue; }
    if (key === "puts" && (value === "all" || value === "itm" || value === "otm")) { request.puts = value; continue; }
    throw new Error(`Unsupported research token: ${token}`);
  }
  if (!Number.isInteger(request.strikes) || request.strikes < 1 || request.strikes > 100) throw new Error("strikes must be an integer from 1 to 100.");
  if (!Number.isInteger(request.dteMin) || !Number.isInteger(request.dteMax) || request.dteMin < 0 || request.dteMax > 730 || request.dteMin > request.dteMax) throw new Error("dte must be an ordered range between 0 and 730.");
  return request;
}

export function serializeGexResearchCommand(request: GexResearchRequest) {
  const parts = [`!${request.chart}`, request.symbol.toUpperCase(), `strikes=${request.strikes}`, `dte=${request.dteMin}..${request.dteMax}`, `view=${request.view}`, `calls=${request.calls}`, `puts=${request.puts}`];
  if (request.combine) parts.push("combine");
  return parts.join(" ");
}
