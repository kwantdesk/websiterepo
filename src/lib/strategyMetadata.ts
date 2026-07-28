import type { StrategyDraft, StrategyDraftDossier } from "@/lib/automation";

export type StrategyMetadataInput = {
  name?: string;
  code?: string;
  strategyDossier?: StrategyDraftDossier;
};

export type StrategyRouteMetadata = {
  instrument: string;
  timeframe: string;
  accountId: string;
};

const LAUNCH_INSTRUMENTS = [
  "XAUUSD",
  "NAS100",
  "US30",
  "US500",
  "GER40",
  "UK100",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "BTCUSD",
  "MNQ SEP26",
] as const;

export const strategyLaunchInstruments = [...LAUNCH_INSTRUMENTS];

function cleanValue(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || /^(unspecified|unknown|not captured|n\/a)$/i.test(trimmed)) return "";
  return trimmed;
}

export function normalizeStrategyInstrument(value?: string | null) {
  const raw = cleanValue(value);
  if (!raw) return "";

  const normalized = raw.toUpperCase().replace(/\s+/g, " ");
  if (/\b(XAUUSD|XAU\/USD|GOLD)\b/.test(normalized)) return "XAUUSD";
  if (/\b(NAS100|US100|USTEC|NASDAQ)\b/.test(normalized)) return "NAS100";
  if (/\b(US30|DJ30|DOW)\b/.test(normalized)) return "US30";
  if (/\b(US500|SPX500|SP500|S&P 500)\b/.test(normalized)) return "US500";
  if (/\b(GER40|DE40|DAX)\b/.test(normalized)) return "GER40";
  if (/\b(UK100|FTSE)\b/.test(normalized)) return "UK100";
  if (/\b(EURUSD|EUR\/USD)\b/.test(normalized)) return "EURUSD";
  if (/\b(GBPUSD|GBP\/USD)\b/.test(normalized)) return "GBPUSD";
  if (/\b(USDJPY|USD\/JPY)\b/.test(normalized)) return "USDJPY";
  if (/\b(BTCUSD|BTC\/USD|BITCOIN)\b/.test(normalized)) return "BTCUSD";
  if (/\b(MNQ|MICRO NASDAQ)\b/.test(normalized)) return "MNQ SEP26";

  const exact = LAUNCH_INSTRUMENTS.find((instrument) => instrument === normalized);
  return exact ?? "";
}

export function inferStrategyMetadata(input: StrategyMetadataInput | StrategyDraft | string): StrategyRouteMetadata {
  const strategy: StrategyMetadataInput =
    typeof input === "string"
      ? { code: input }
      : input;

  const source = `${strategy.name ?? ""}\n${strategy.code ?? ""}`;
  const dossierInstrument = normalizeStrategyInstrument(strategy.strategyDossier?.blueprint?.instrument);
  const commentInstrument = normalizeStrategyInstrument(strategy.code?.match(/\/\/\s*Instrument:\s*([^|\n]+)/i)?.[1]);
  const sourceInstrument = normalizeStrategyInstrument(source);
  const instrument = dossierInstrument || commentInstrument || sourceInstrument || "XAUUSD";

  const dossierTimeframe = cleanValue(strategy.strategyDossier?.blueprint?.timeframe);
  const commentTimeframe = cleanValue(strategy.code?.match(/\/\/\s*Instrument:[^\n|]*\|\s*Timeframe:\s*([^|\n]+)/i)?.[1]);
  const directTimeframe = cleanValue(strategy.code?.match(/\/\/\s*Timeframe:\s*([^|\n]+)/i)?.[1]);
  const sourceTimeframe = cleanValue(source.match(/\b(1m|3m|5m|15m|30m|1h|4h|1d)\b/i)?.[1]);
  const timeframe = dossierTimeframe || commentTimeframe || directTimeframe || sourceTimeframe || "5m";

  return {
    instrument,
    timeframe,
    accountId: accountIdForStrategyInstrument(instrument),
  };
}

export function accountIdForStrategyInstrument(instrument: string) {
  if (/MNQ|MES|NQ|ES|SEP/i.test(instrument)) return "tradovate-sim";
  if (strategyLaunchInstruments.includes(instrument as (typeof LAUNCH_INSTRUMENTS)[number])) return "oanda-demo";
  return "paper-router";
}

export function buildChartBacktestHref(options: {
  strategyId?: string;
  version?: string | number;
  instrument: string;
  timeframe: string;
  autoRun?: boolean;
  analyze?: boolean;
}) {
  const params = new URLSearchParams({
    instrument: options.instrument,
    timeframe: options.timeframe,
  });
  if (options.strategyId) params.set("strategyId", options.strategyId);
  if (typeof options.version !== "undefined") params.set("version", String(options.version));
  if (options.autoRun) params.set("backtest", "1");
  if (options.analyze) params.set("analyze", "1");
  return `/?${params.toString()}`;
}

export function buildInferredStrategyDossier(
  code: string,
  threadId?: string | null,
  existing?: StrategyDraftDossier,
): StrategyDraftDossier {
  const meta = inferStrategyMetadata({ code, strategyDossier: existing });
  const name = code.match(/\/\/\s*Strategy:\s*(.+)/)?.[1]?.trim() || existing?.blueprint?.strategyName || "Untitled Strategy";
  const description = code.match(/\/\/\s*Description:\s*(.+)/)?.[1]?.trim();
  const edge = code.match(/\/\/\s*Edge:\s*(.+)/)?.[1]?.trim();
  const direction = /action:\s*"LONG"[\s\S]*action:\s*"SHORT"|action:\s*"SHORT"[\s\S]*action:\s*"LONG"/.test(code)
    ? "both"
    : /action:\s*"LONG"/.test(code)
      ? "long"
      : /action:\s*"SHORT"/.test(code)
        ? "short"
        : "unspecified";

  return {
    source: existing?.source ?? "ai_builder",
    sourceThreadId: existing?.sourceThreadId ?? threadId ?? null,
    savedFromMessageAt: existing?.savedFromMessageAt ?? new Date().toISOString(),
    builderIntent: existing?.builderIntent ?? "build",
    intakeSummary: existing?.intakeSummary ?? description ?? edge ?? "Inferred from generated strategy code.",
    missingInfo: existing?.missingInfo ?? [],
    blueprint: {
      strategyName: existing?.blueprint?.strategyName ?? name,
      objective: existing?.blueprint?.objective ?? edge ?? description ?? `Backtest ${name}.`,
      instrument: existing?.blueprint?.instrument ?? meta.instrument,
      timeframe: existing?.blueprint?.timeframe ?? meta.timeframe,
      direction: existing?.blueprint?.direction ?? direction,
      maxTradesPerDay: existing?.blueprint?.maxTradesPerDay ?? (/one trade|tradeTaken|traded/i.test(code) ? "1" : "unspecified"),
      sessionFilter: existing?.blueprint?.sessionFilter ?? (/NEW_YORK|getSession/i.test(code) ? "New York session" : "Not captured"),
      entryModel: existing?.blueprint?.entryModel ?? (edge || "Generated strategy entry rules inferred from code."),
      entryTriggers: existing?.blueprint?.entryTriggers ?? [],
      confirmationFilters: existing?.blueprint?.confirmationFilters ?? [],
      stopModel: existing?.blueprint?.stopModel ?? (/atr/i.test(code) ? "Structure or signal invalidation with ATR buffer" : "Not captured"),
      targetModel: existing?.blueprint?.targetModel ?? (/2\s*\*|2R|target/i.test(code) ? "Fixed R target, commonly 2R when specified" : "Not captured"),
      riskModel: existing?.blueprint?.riskModel ?? "Conservative first-backtest risk assumption",
      noGoConditions: existing?.blueprint?.noGoConditions ?? [],
      propConstraints: existing?.blueprint?.propConstraints ?? [],
      qualityNotes: existing?.blueprint?.qualityNotes ?? ["Saved with inferred metadata; run a backtest before automation."],
      validationPlan: existing?.blueprint?.validationPlan ?? ["Run the saved version in Backtests and attach evidence before improving or automating."],
      improvementGoal: existing?.blueprint?.improvementGoal ?? "First evidence pass",
      outputLanguage: existing?.blueprint?.outputLanguage ?? "Kwantify JavaScript",
    },
    verification: existing?.verification,
    research: existing?.research,
    critic: existing?.critic,
    lastImprovementGoal: existing?.lastImprovementGoal,
  };
}
