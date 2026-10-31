import { OPTIONS_FLOW_INSTRUMENTS } from "./optionsFlow";
import { normalizeGammaHeatmapInstrument } from "./gammaHeatmap";
import type { LinkedGexMapSettings } from "./gexMapLinkedSettings";

/** One source resolver for the chart and its settings editor. */
export function resolveBounceGexMapSource(instrument: string, settings: LinkedGexMapSettings, sourceTicker: unknown) {
  const display = /^(M2K|RTY)/.exec(instrument.toUpperCase())?.[1] ?? normalizeGammaHeatmapInstrument(instrument);
  const configured = String(sourceTicker ?? "AUTO").toUpperCase();
  const direct = OPTIONS_FLOW_INSTRUMENTS.some((p) => p.symbol === display) ? display : null;
  const family = /^(NQ|MNQ)$/.test(display) ? ["NDX", "QQQ"] : /^(ES|MES)$/.test(display) ? ["SPX", "SPXW", "SPY"] : /^(RTY|M2K)$/.test(display) ? ["IWM"] : [];
  const source = configured === "AUTO" ? direct ?? settings.panels.find((p) => family.includes(p.symbol))?.symbol ?? family[0] ?? "" : configured;
  return { display, source };
}
