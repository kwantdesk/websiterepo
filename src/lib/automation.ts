export type RuntimeMode = "replay" | "demo" | "paper" | "forward_test" | "live";

export type StrategyDraftDossier = {
  source?: "ai_builder" | "editor" | "imported";
  sourceThreadId?: string | null;
  savedFromMessageAt?: string;
  builderIntent?: string;
  intakeSummary?: string;
  missingInfo?: string[];
  blueprint?: {
    strategyName?: string;
    objective?: string;
    instrument?: string;
    timeframe?: string;
    direction?: string;
    maxTradesPerDay?: string;
    sessionFilter?: string;
    entryModel?: string;
    entryTriggers?: string[];
    confirmationFilters?: string[];
    stopModel?: string;
    targetModel?: string;
    riskModel?: string;
    noGoConditions?: string[];
    propConstraints?: string[];
    qualityNotes?: string[];
    validationPlan?: string[];
    improvementGoal?: string;
    outputLanguage?: string;
  };
  verification?: {
    passed?: boolean;
    warnings?: string[];
    issues?: string[];
  };
  research?: {
    needed?: boolean;
    summary?: string;
    facts?: string[];
    assumptions?: string[];
    openQuestions?: string[];
    strategyImplications?: string[];
    sources?: string[];
  };
  critic?: {
    passed?: boolean;
    score?: number;
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    failureModes?: string[];
    nextExperiment?: string;
    automationReadiness?: "not_ready" | "backtest_first" | "paper_only" | "ready_for_paper";
  };
  lastImprovementGoal?: string;
};

export type StrategyVersionBacktestEvidence = {
  runId?: string;
  capturedAt: string;
  strategyVersionLabel?: string;
  instrument: string;
  timeframe: string;
  rangeLabel?: string;
  initialCapital?: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalPnL: number;
  totalPnLPercent?: number;
  maxDrawdown: number;
  maxDrawdownPercent?: number;
  averageRMultiple?: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  recoveryFactor?: number;
  annualizedReturn?: number;
};

export type StrategyVersionLearningNote = {
  id: string;
  runId?: string;
  capturedAt: string;
  verdict: "promising" | "needs_work" | "reject";
  score: number;
  summary: string;
  strengths: string[];
  worries: string[];
  hypotheses: string[];
  recommendedChanges: string[];
  avoidChanging: string[];
  nextExperiment: string;
};

export type StrategyVersionRecord = {
  code: string;
  timestamp: Date | string;
  version: number;
  backtestEvidence?: StrategyVersionBacktestEvidence;
  backtestHistory?: StrategyVersionBacktestEvidence[];
  learningJournal?: StrategyVersionLearningNote[];
};

export type StrategyDraft = {
  id: string;
  name: string;
  code: string;
  language: string;
  createdAt?: string;
  updatedAt?: string;
  currentVersion?: number;
  totalPnl?: number;
  versions?: StrategyVersionRecord[];
  strategyDossier?: StrategyDraftDossier;
};

export type AutomationStrategyRuntime = {
  id: string;
  name: string;
  language: string;
  currentVersionLabel: string;
  updatedLabel: string;
  totalPnlLabel: string;
  code: string;
};

export type AutomationBotDraft = {
  strategyId: string;
  accountId: string;
  instrument: string;
  timeframe: string;
  mode: RuntimeMode;
  status: "ready" | "armed" | "paused";
};

export type AutomationBotRuntime = {
  id: string;
  strategyId: string;
  strategyName: string;
  accountId: string;
  instrument: string;
  timeframe: string;
  mode: RuntimeMode;
  status: "ready" | "armed" | "running" | "paused" | "stopped";
  createdAt: string;
  updatedAt: string;
};

export type AutomationRiskConfig = {
  dailyLossLimit: number;
  maxOpenPositions: number;
  maxOpenOrders: number;
  duplicateSignalBlock: boolean;
  staleDataBlock: boolean;
  disconnectFailsafe: boolean;
  newsLockout: boolean;
};

export type AutomationJournalEvent = {
  id: string;
  time: string;
  bot: string;
  action: string;
  reason: string;
  level: "info" | "success" | "warn" | "error";
};

export type AutomationExecutionPosition = {
  id?: string;
  symbol: string;
  side: string;
  size: string;
  entry: string;
  stop: string;
  target: string;
  pnl: string;
  tone: string;
};

export type AutomationWorkingOrder = {
  id?: string;
  venue: string;
  symbol: string;
  type: string;
  status: string;
  detail: string;
};

export type AutomationExecutionState = {
  positions: AutomationExecutionPosition[];
  workingOrders: AutomationWorkingOrder[];
};

export type AutomationBacktestSnapshot = {
  runId?: string;
  strategyId: string;
  strategyName: string;
  strategyVersionLabel?: string;
  instrument: string;
  timeframe: string;
  ranAt: string;
  rangeLabel?: string;
  initialCapital?: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalPnL: number;
  totalPnLPercent?: number;
  maxDrawdown: number;
  maxDrawdownPercent?: number;
  averageRMultiple?: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  grossProfit?: number;
  grossLoss?: number;
  avgWinningTrade?: number;
  avgLosingTrade?: number;
  largestWinningTrade?: number;
  largestLosingTrade?: number;
  avgBarsInTrades?: number;
  avgBarsInWinningTrades?: number;
  avgBarsInLosingTrades?: number;
  maxRunUp?: number;
  recoveryFactor?: number;
  annualizedReturn?: number;
  maxMarginUsed?: number;
  marginEfficiency?: number;
  avgEquityRunUp?: number;
  maxEquityRunUp?: number;
  avgDrawdownDuration?: number;
  maxDrawdownDuration?: number;
  longTrades?: {
    totalPnL: number;
    totalPnLPercent: number;
    grossProfit: number;
    grossLoss: number;
    profitFactor: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgTrade: number;
    avgWinningTrade: number;
    avgLosingTrade: number;
    largestWinningTrade: number;
    largestLosingTrade: number;
    avgBarsInTrades: number;
    avgBarsInWinningTrades: number;
    avgBarsInLosingTrades: number;
  };
  shortTrades?: {
    totalPnL: number;
    totalPnLPercent: number;
    grossProfit: number;
    grossLoss: number;
    profitFactor: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgTrade: number;
    avgWinningTrade: number;
    avgLosingTrade: number;
    largestWinningTrade: number;
    largestLosingTrade: number;
    avgBarsInTrades: number;
    avgBarsInWinningTrades: number;
    avgBarsInLosingTrades: number;
  };
  equityCurve?: { timestamp: number; equity: number }[]; 
  trades: {
    entryTime: number;
    exitTime: number;
    direction: "LONG" | "SHORT";
    entryPrice: number;
    exitPrice: number;
    stopLoss: number;
    takeProfit: number;
    pnlPoints: number;
    pnlPercent: number;
    rMultiple: number;
    result: "WIN" | "LOSS" | "BREAKEVEN";
    runUp: number;
    drawdown: number;
    durationBars: number;
  }[];
};

export type ConnectionStatusTone = "live" | "ready" | "planned" | "error";

export type AutomationConnectionProvider = {
  id: string;
  name: string;
  kind: "broker" | "data" | "ai" | "router" | "infra";
  status: string;
  tone: ConnectionStatusTone;
  detail: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AutomationConnectionAccount = {
  id: string;
  providerId: string;
  label: string;
  mode: RuntimeMode | "service";
  status: string;
  detail: string;
};

const AUTOMATION_BOTS_KEY = "automation-bots";
const AUTOMATION_RISK_KEY = "automation-risk";
const AUTOMATION_JOURNAL_KEY = "automation-journal";
const AUTOMATION_EXECUTION_STATE_KEY = "automation-execution-state";
const AUTOMATION_BACKTEST_KEY = "automation-backtest";
const AUTOMATION_BACKTEST_HISTORY_KEY = "automation-backtest-history";
const SAVED_STRATEGIES_KEY = "saved-strategies";

export const runtimeModeLabels: Record<RuntimeMode, string> = {
  replay: "Replay",
  demo: "Demo",
  paper: "Paper",
  forward_test: "Forward Test",
  live: "Live",
};

export const defaultRiskConfig: AutomationRiskConfig = {
  dailyLossLimit: 500,
  maxOpenPositions: 2,
  maxOpenOrders: 6,
  duplicateSignalBlock: true,
  staleDataBlock: true,
  disconnectFailsafe: true,
  newsLockout: false,
};

export const defaultExecutionState: AutomationExecutionState = {
  positions: [],
  workingOrders: [],
};

function hasWindow() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!hasWindow()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!hasWindow()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadSavedStrategiesRaw() {
  if (!hasWindow()) return null;

  const sessionValue = window.sessionStorage.getItem(SAVED_STRATEGIES_KEY);
  const localValue = window.localStorage.getItem(SAVED_STRATEGIES_KEY);

  if (sessionValue && sessionValue !== localValue) {
    window.localStorage.setItem(SAVED_STRATEGIES_KEY, sessionValue);
    return sessionValue;
  }

  if (localValue && localValue !== sessionValue) {
    window.sessionStorage.setItem(SAVED_STRATEGIES_KEY, localValue);
    return localValue;
  }

  return sessionValue ?? localValue;
}

export function saveSavedStrategiesRaw(raw: string) {
  if (!hasWindow()) return;
  window.sessionStorage.setItem(SAVED_STRATEGIES_KEY, raw);
  window.localStorage.setItem(SAVED_STRATEGIES_KEY, raw);
}

export function clearSavedStrategiesRaw() {
  if (!hasWindow()) return;
  window.sessionStorage.removeItem(SAVED_STRATEGIES_KEY);
  window.localStorage.removeItem(SAVED_STRATEGIES_KEY);
}

export function createBotId() {
  return `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createJournalId() {
  return `journal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatAutomationDate(value?: string) {
  if (!value) return "today";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "today";
  }
}

export function normalizeSavedStrategies(raw: string | null): AutomationStrategyRuntime[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StrategyDraft[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item.name === "string" && typeof item.code === "string")
      .map((item, index) => ({
        id: item.id ?? `saved-strategy-${index}`,
        name: item.name,
        language: item.language ?? "JavaScript",
        currentVersionLabel: item.currentVersion ? `v${item.currentVersion}` : "v1",
        updatedLabel: formatAutomationDate(item.updatedAt ?? item.createdAt),
        totalPnlLabel:
          typeof item.totalPnl === "number"
            ? `${item.totalPnl >= 0 ? "+" : "-"}$${Math.abs(item.totalPnl).toFixed(2)}`
            : "--",
        code: item.code,
      }));
  } catch {
    return [];
  }
}

function strategyVersionFromLabel(label?: string) {
  if (!label) return null;
  const match = label.match(/v\s*(\d+)/i);
  if (!match) return null;
  const version = Number(match[1]);
  return Number.isFinite(version) ? version : null;
}

export function summarizeBacktestEvidence(snapshot: AutomationBacktestSnapshot): StrategyVersionBacktestEvidence {
  return {
    runId: snapshot.runId,
    capturedAt: snapshot.ranAt,
    strategyVersionLabel: snapshot.strategyVersionLabel,
    instrument: snapshot.instrument,
    timeframe: snapshot.timeframe,
    rangeLabel: snapshot.rangeLabel,
    initialCapital: snapshot.initialCapital,
    totalTrades: snapshot.totalTrades,
    winRate: snapshot.winRate,
    profitFactor: snapshot.profitFactor,
    totalPnL: snapshot.totalPnL,
    totalPnLPercent: snapshot.totalPnLPercent,
    maxDrawdown: snapshot.maxDrawdown,
    maxDrawdownPercent: snapshot.maxDrawdownPercent,
    averageRMultiple: snapshot.averageRMultiple,
    sharpeRatio: snapshot.sharpeRatio,
    sortinoRatio: snapshot.sortinoRatio,
    recoveryFactor: snapshot.recoveryFactor,
    annualizedReturn: snapshot.annualizedReturn,
  };
}

export function buildStrategyVersionLearningNote(
  snapshot: AutomationBacktestSnapshot,
  previous?: StrategyVersionBacktestEvidence,
): StrategyVersionLearningNote {
  const worries: string[] = [];
  const strengths: string[] = [];
  const hypotheses: string[] = [];
  const recommendedChanges: string[] = [];
  const avoidChanging: string[] = [];

  if (snapshot.totalTrades >= 30) strengths.push("Trade count is large enough for a first-pass read.");
  else worries.push("Trade count is thin; avoid trusting headline metrics until the sample is larger.");

  if (snapshot.profitFactor >= 1.3) strengths.push("Profit factor is above the first practical threshold.");
  else worries.push("Profit factor is weak; the edge may be too small after costs.");

  if (snapshot.winRate >= 45) strengths.push("Win rate is not obviously broken for an algo strategy.");
  else worries.push("Win rate is low; check whether winners are large enough to compensate.");

  if ((snapshot.maxDrawdownPercent ?? 0) > 15) worries.push("Drawdown percentage is high for retail/paper deployment.");
  if (snapshot.totalPnL <= 0) worries.push("Net P&L is negative on this run.");

  if (snapshot.longTrades && snapshot.shortTrades) {
    const longPf = snapshot.longTrades.profitFactor;
    const shortPf = snapshot.shortTrades.profitFactor;
    if (Math.abs(longPf - shortPf) >= 0.4) {
      const stronger = longPf > shortPf ? "long" : "short";
      hypotheses.push(`The ${stronger} side appears materially stronger; test directional separation before rewriting everything.`);
      recommendedChanges.push(`Try a version that tightens or disables the weaker ${stronger === "long" ? "short" : "long"} side.`);
    }
  }

  if (typeof snapshot.avgBarsInLosingTrades === "number" && typeof snapshot.avgBarsInWinningTrades === "number") {
    if (snapshot.avgBarsInLosingTrades > snapshot.avgBarsInWinningTrades * 1.4) {
      hypotheses.push("Losing trades appear to stay open much longer than winners.");
      recommendedChanges.push("Test a time stop or faster invalidation rule for stale losers.");
    }
  }

  if (typeof snapshot.avgWinningTrade === "number" && typeof snapshot.avgLosingTrade === "number") {
    if (Math.abs(snapshot.avgLosingTrade) > Math.abs(snapshot.avgWinningTrade) * 1.2) {
      hypotheses.push("Average loss is too large relative to average winner.");
      recommendedChanges.push("Tighten stop logic or require stronger entry confirmation.");
    }
  }

  if (previous) {
    const pfDelta = snapshot.profitFactor - previous.profitFactor;
    const ddDelta = snapshot.maxDrawdown - previous.maxDrawdown;
    const pnlDelta = snapshot.totalPnL - previous.totalPnL;
    hypotheses.push(
      `Version delta versus previous evidence: PF ${pfDelta >= 0 ? "+" : ""}${pfDelta.toFixed(2)}, P&L ${pnlDelta >= 0 ? "+" : ""}${pnlDelta.toFixed(2)}, drawdown ${ddDelta <= 0 ? "improved" : "worsened"} by ${Math.abs(ddDelta).toFixed(2)}.`,
    );
  }

  if (!recommendedChanges.length) {
    recommendedChanges.push("Make only one targeted change next, then rerun the same instrument/timeframe/range for a clean comparison.");
  }

  avoidChanging.push("Do not change entry, exit, risk, and session filters all in one pass.");
  avoidChanging.push("Do not optimize against one lucky run without checking trade count, drawdown, and side split.");

  const score = Math.max(
    0,
    Math.min(
      100,
      45 +
        Math.min(snapshot.profitFactor, 2) * 18 +
        (snapshot.totalPnL > 0 ? 10 : -15) +
        (snapshot.totalTrades >= 30 ? 8 : -8) -
        Math.max(0, (snapshot.maxDrawdownPercent ?? 0) - 10),
    ),
  );
  const verdict = score >= 70 ? "promising" : score >= 45 ? "needs_work" : "reject";

  return {
    id: `learning-${snapshot.runId ?? Date.now()}`,
    runId: snapshot.runId,
    capturedAt: snapshot.ranAt,
    verdict,
    score: Math.round(score),
    summary: `${snapshot.strategyName}${snapshot.strategyVersionLabel ? ` ${snapshot.strategyVersionLabel}` : ""}: ${snapshot.totalTrades} trades, ${snapshot.winRate.toFixed(1)}% WR, PF ${snapshot.profitFactor.toFixed(2)}, net ${snapshot.totalPnL.toFixed(2)}, max DD ${snapshot.maxDrawdown.toFixed(2)}.`,
    strengths,
    worries,
    hypotheses,
    recommendedChanges,
    avoidChanging,
    nextExperiment: recommendedChanges[0],
  };
}

export function attachBacktestSnapshotToSavedStrategyVersion(snapshot: AutomationBacktestSnapshot) {
  const raw = loadSavedStrategiesRaw();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StrategyDraft[];
    if (!Array.isArray(parsed)) return null;

    const snapshotVersion = strategyVersionFromLabel(snapshot.strategyVersionLabel);
    const evidence = summarizeBacktestEvidence(snapshot);
    let changed = false;

    const next = parsed.map((strategy) => {
      if (strategy.id !== snapshot.strategyId) return strategy;

      const fallbackTimestamp = strategy.updatedAt ?? strategy.createdAt ?? snapshot.ranAt;
      const fallbackVersion = strategy.currentVersion ?? snapshotVersion ?? 1;
      const versions =
        strategy.versions && strategy.versions.length > 0
          ? strategy.versions
          : [{ code: strategy.code, timestamp: fallbackTimestamp, version: fallbackVersion }];

      const targetVersion = snapshotVersion ?? strategy.currentVersion ?? versions[versions.length - 1]?.version ?? 1;
      const nextVersions = versions.map((version) => {
        if (version.version !== targetVersion) return version;

        const existingHistory = version.backtestHistory ?? [];
        const existingJournal = version.learningJournal ?? [];
        const nextHistory = [
          evidence,
          ...existingHistory.filter((item) => item.runId !== evidence.runId),
        ].slice(0, 12);
        const learningNote = buildStrategyVersionLearningNote(snapshot, existingHistory[0]);
        const nextJournal = [
          learningNote,
          ...existingJournal.filter((item) => item.runId !== learningNote.runId),
        ].slice(0, 20);

        changed = true;
        return {
          ...version,
          backtestEvidence: evidence,
          backtestHistory: nextHistory,
          learningJournal: nextJournal,
        };
      });

      if (!changed) return strategy;

      return {
        ...strategy,
        totalPnl: strategy.currentVersion === targetVersion ? snapshot.totalPnL : strategy.totalPnl,
        versions: nextVersions,
      };
    });

    if (!changed) return null;

    saveSavedStrategiesRaw(JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function loadAutomationBots() {
  return readJson<AutomationBotRuntime[]>(AUTOMATION_BOTS_KEY, []);
}

export function saveAutomationBots(bots: AutomationBotRuntime[]) {
  writeJson(AUTOMATION_BOTS_KEY, bots);
}

export function upsertAutomationBot(bot: AutomationBotRuntime) {
  const existing = loadAutomationBots();
  const next = [bot, ...existing.filter((item) => item.id !== bot.id)].slice(0, 25);
  saveAutomationBots(next);
  return next;
}

export function loadRiskConfig() {
  return readJson<AutomationRiskConfig>(AUTOMATION_RISK_KEY, defaultRiskConfig);
}

export function saveRiskConfig(config: AutomationRiskConfig) {
  writeJson(AUTOMATION_RISK_KEY, config);
}

export function loadJournalEvents() {
  return readJson<AutomationJournalEvent[]>(AUTOMATION_JOURNAL_KEY, []);
}

export function saveJournalEvents(events: AutomationJournalEvent[]) {
  writeJson(AUTOMATION_JOURNAL_KEY, events);
}

export function appendJournalEvent(event: AutomationJournalEvent) {
  const existing = loadJournalEvents();
  const next = [event, ...existing].slice(0, 200);
  saveJournalEvents(next);
  return next;
}

export function loadExecutionState() {
  return readJson<AutomationExecutionState>(AUTOMATION_EXECUTION_STATE_KEY, defaultExecutionState);
}

export function saveExecutionState(state: AutomationExecutionState) {
  writeJson(AUTOMATION_EXECUTION_STATE_KEY, state);
}

export function mergeExecutionState(partial: Partial<AutomationExecutionState>) {
  const current = loadExecutionState();
  const next: AutomationExecutionState = {
    positions: partial.positions ?? current.positions,
    workingOrders: partial.workingOrders ?? current.workingOrders,
  };
  saveExecutionState(next);
  return next;
}

export function loadAutomationBacktest() {
  return readJson<AutomationBacktestSnapshot | null>(AUTOMATION_BACKTEST_KEY, null);
}

export function saveAutomationBacktest(snapshot: AutomationBacktestSnapshot) {
  writeJson(AUTOMATION_BACKTEST_KEY, snapshot);
  return snapshot;
}

export function loadAutomationBacktestHistory() {
  return readJson<AutomationBacktestSnapshot[]>(AUTOMATION_BACKTEST_HISTORY_KEY, []);
}

export function saveAutomationBacktestHistory(history: AutomationBacktestSnapshot[]) {
  writeJson(AUTOMATION_BACKTEST_HISTORY_KEY, history);
  return history;
}

export function appendAutomationBacktestRun(snapshot: AutomationBacktestSnapshot) {
  const current = loadAutomationBacktestHistory();
  const next = [snapshot, ...current.filter((item) => item.runId !== snapshot.runId)].slice(0, 50);
  saveAutomationBacktestHistory(next);
  return next;
}

export function toneClasses(tone: ConnectionStatusTone) {
  switch (tone) {
    case "live":
      return "text-primary";
    case "ready":
      return "text-foreground";
    case "error":
      return "text-danger";
    default:
      return "text-muted";
  }
}
