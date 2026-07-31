import { calculateJournalStats, type JournalEvidence, type JournalTrade } from "@/lib/journal";

export type JournalAnalysisConfidence = "LOW" | "MODERATE" | "HIGH";

export type JournalAnalysisMetricSet = {
  trades: number;
  netPnl: number;
  winRate: number | null;
  profitFactor: number | null;
  profitFactorState: "FINITE" | "NO LOSSES" | "UNAVAILABLE";
  expectancy: number | null;
  averageR: number | null;
  maxDrawdown: number;
};

export type JournalAnalysisSegment = JournalAnalysisMetricSet & {
  label: string;
  sampleConfidence: JournalAnalysisConfidence;
};

export type JournalAnalysisEvidencePack = {
  version: 1;
  fingerprint: string;
  generatedAt: string;
  account: string;
  window: {
    firstTradeAt: string | null;
    lastTradeAt: string | null;
    calendarDays: number;
    tradedDays: number;
  };
  performance: JournalAnalysisMetricSet & {
    grossProfit: number;
    grossLoss: number;
    averageWin: number | null;
    averageLoss: number | null;
    payoffRatio: number | null;
    bestTrade: number | null;
    worstTrade: number | null;
    pnlStandardDeviation: number | null;
    maximumConsecutiveWins: number;
    maximumConsecutiveLosses: number;
  };
  dataQuality: {
    entryExitCompletePercent: number;
    riskCompletePercent: number;
    reviewedPercent: number;
    evidenceLinkedPercent: number;
    setupClassifiedPercent: number;
    reviewIntegrityScore: number;
  };
  risk: {
    riskSample: number;
    averageInitialRisk: number | null;
    medianInitialRisk: number | null;
    initialRiskCoefficientOfVariation: number | null;
    worstLossVsAverageLoss: number | null;
    largestLossShareOfGrossLoss: number | null;
  };
  recentVersusPrior: {
    comparisonSize: number;
    recent: JournalAnalysisMetricSet | null;
    prior: JournalAnalysisMetricSet | null;
    expectancyChange: number | null;
    winRateChange: number | null;
    averageRChange: number | null;
  };
  segments: {
    setup: JournalAnalysisSegment[];
    symbol: JournalAnalysisSegment[];
    side: JournalAnalysisSegment[];
    weekday: JournalAnalysisSegment[];
    entryHour: JournalAnalysisSegment[];
    holdingPeriod: JournalAnalysisSegment[];
  };
  reviewedTradeContext: Array<{
    date: string;
    symbol: string;
    side: string;
    setup: string;
    tags: string[];
    netPnl: number;
    rMultiple: number | null;
    rating: number | null;
    note: string;
    improvement: string;
  }>;
};

export type JournalAnalysisFinding = {
  title: string;
  evidence: string;
  interpretation: string;
  confidence: JournalAnalysisConfidence;
};

export type JournalAnalysisLeak = JournalAnalysisFinding & {
  correction: string;
};

export type JournalAnalysisPriority = {
  rank: number;
  action: string;
  measurement: string;
  target: string;
  rationale: string;
};

export type JournalQuantAnalysis = {
  version: 1;
  account: string;
  fingerprint: string;
  generatedAt: string;
  model: string;
  confidence: JournalAnalysisConfidence;
  headline: string;
  executiveRead: string;
  traderProfile: string;
  strengths: JournalAnalysisFinding[];
  edges: JournalAnalysisFinding[];
  leaks: JournalAnalysisLeak[];
  priorities: JournalAnalysisPriority[];
  mentorNote: string;
  caveats: string[];
};

function rounded(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function nullableRounded(value: number | null, digits = 2) {
  return value === null || !Number.isFinite(value) ? null : rounded(value, digits);
}

function sampleConfidence(size: number): JournalAnalysisConfidence {
  if (size >= 30) return "HIGH";
  if (size >= 12) return "MODERATE";
  return "LOW";
}

function metricSet(trades: JournalTrade[]): JournalAnalysisMetricSet {
  const stats = calculateJournalStats(trades);
  const profitFactorState = stats.grossLoss > 0
    ? "FINITE"
    : stats.grossProfit > 0
      ? "NO LOSSES"
      : "UNAVAILABLE";
  return {
    trades: stats.tradeCount,
    netPnl: rounded(stats.netPnl),
    winRate: nullableRounded(stats.winRate, 4),
    profitFactor: nullableRounded(stats.profitFactor, 3),
    profitFactorState,
    expectancy: nullableRounded(stats.expectancy),
    averageR: nullableRounded(stats.averageR, 3),
    maxDrawdown: rounded(stats.maxDrawdown),
  };
}

function median(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function maximumStreak(trades: JournalTrade[], direction: "WIN" | "LOSS") {
  let current = 0;
  let maximum = 0;
  for (const trade of trades) {
    const matches = direction === "WIN" ? trade.netPnl > 0 : trade.netPnl < 0;
    current = matches ? current + 1 : 0;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function groupSegments(trades: JournalTrade[], labelFor: (trade: JournalTrade) => string) {
  const groups = new Map<string, JournalTrade[]>();
  for (const trade of trades) {
    const label = labelFor(trade).trim() || "Unclassified";
    groups.set(label, [...(groups.get(label) ?? []), trade]);
  }
  return [...groups.entries()]
    .map(([label, rows]): JournalAnalysisSegment => ({
      label: label.slice(0, 80),
      ...metricSet(rows),
      sampleConfidence: sampleConfidence(rows.length),
    }))
    .sort((left, right) => right.trades - left.trades || right.netPnl - left.netPnl)
    .slice(0, 12);
}

function holdingPeriodLabel(durationMs: number | null) {
  if (durationMs === null || !Number.isFinite(durationMs)) return "Unknown duration";
  if (durationMs < 5 * 60_000) return "Under 5 minutes";
  if (durationMs < 15 * 60_000) return "5–15 minutes";
  if (durationMs < 60 * 60_000) return "15–60 minutes";
  if (durationMs < 4 * 60 * 60_000) return "1–4 hours";
  return "Over 4 hours";
}

function cleanContext(value: string, maximum: number) {
  return value
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function evidenceFingerprint(
  account: string,
  ordered: JournalTrade[],
  evidence: JournalEvidence[],
) {
  const source = JSON.stringify({
    account,
    trades: ordered.map((trade) => [
      trade.id,
      trade.openedAt,
      trade.closedAt,
      trade.netPnl,
      trade.initialRisk,
      trade.rMultiple,
      trade.setup,
      trade.tags,
      trade.rating,
      trade.reviewedAt,
      trade.notes,
    ]),
    evidence: evidence.map((item) => [item.id, item.tradeId, item.importedAt]),
  });
  let hash = 2_166_136_261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `ja1-${(hash >>> 0).toString(36)}-${ordered.length}`;
}

export function buildJournalAnalysisEvidence(
  account: string,
  trades: JournalTrade[],
  evidence: JournalEvidence[] = [],
): JournalAnalysisEvidencePack {
  const ordered = [...trades].sort((left, right) => (
    Date.parse(left.closedAt ?? left.openedAt) - Date.parse(right.closedAt ?? right.openedAt)
  ));
  const stats = calculateJournalStats(ordered, evidence);
  const dates = ordered
    .map((trade) => Date.parse(trade.closedAt ?? trade.openedAt))
    .filter(Number.isFinite);
  const firstTimestamp = dates[0] ?? null;
  const lastTimestamp = dates.at(-1) ?? null;
  const tradedDays = new Set(ordered.map((trade) => (
    new Date(trade.closedAt ?? trade.openedAt).toISOString().slice(0, 10)
  ))).size;
  const calendarDays = firstTimestamp !== null && lastTimestamp !== null
    ? Math.max(1, Math.floor((lastTimestamp - firstTimestamp) / 86_400_000) + 1)
    : 0;
  const pnlValues = ordered.map((trade) => trade.netPnl);
  const initialRisks = ordered
    .map((trade) => trade.initialRisk)
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  const averageInitialRisk = initialRisks.length
    ? initialRisks.reduce((sum, value) => sum + value, 0) / initialRisks.length
    : null;
  const riskStd = standardDeviation(initialRisks);
  const worstLoss = Math.abs(Math.min(0, ...pnlValues));
  const largestLossShare = stats.grossLoss > 0 ? worstLoss / stats.grossLoss : null;
  const comparisonSize = Math.min(30, Math.floor(ordered.length / 2));
  const recent = comparisonSize >= 5 ? ordered.slice(-comparisonSize) : [];
  const prior = comparisonSize >= 5 ? ordered.slice(-comparisonSize * 2, -comparisonSize) : [];
  const recentMetrics = recent.length ? metricSet(recent) : null;
  const priorMetrics = prior.length ? metricSet(prior) : null;
  const entryExitComplete = ordered.filter((trade) => (
    trade.entryPrice !== null && trade.exitPrice !== null && trade.side !== "UNKNOWN"
  )).length;
  const riskComplete = ordered.filter((trade) => trade.initialRisk !== null || trade.rMultiple !== null).length;
  const linkedTradeIds = new Set(evidence.flatMap((item) => item.tradeId ? [item.tradeId] : []));
  const evidenceLinked = ordered.filter((trade) => linkedTradeIds.has(trade.id)).length;
  const setupClassified = ordered.filter((trade) => Boolean(trade.setup.trim() || trade.tags.length)).length;
  const entryExitPercent = ordered.length ? entryExitComplete / ordered.length : 0;
  const reviewedPercent = ordered.length ? stats.reviewedCount / ordered.length : 0;
  const evidencePercent = ordered.length ? evidenceLinked / ordered.length : 0;
  const riskPercent = ordered.length ? riskComplete / ordered.length : 0;

  return {
    version: 1,
    fingerprint: evidenceFingerprint(account, ordered, evidence),
    generatedAt: new Date().toISOString(),
    account: cleanContext(account, 100) || "Overall Journal",
    window: {
      firstTradeAt: firstTimestamp === null ? null : new Date(firstTimestamp).toISOString(),
      lastTradeAt: lastTimestamp === null ? null : new Date(lastTimestamp).toISOString(),
      calendarDays,
      tradedDays,
    },
    performance: {
      ...metricSet(ordered),
      grossProfit: rounded(stats.grossProfit),
      grossLoss: rounded(stats.grossLoss),
      averageWin: nullableRounded(stats.averageWin),
      averageLoss: nullableRounded(stats.averageLoss),
      payoffRatio: stats.averageWin !== null && stats.averageLoss !== null && stats.averageLoss > 0
        ? rounded(stats.averageWin / stats.averageLoss, 3)
        : null,
      bestTrade: nullableRounded(stats.bestTrade),
      worstTrade: nullableRounded(stats.worstTrade),
      pnlStandardDeviation: nullableRounded(standardDeviation(pnlValues)),
      maximumConsecutiveWins: maximumStreak(ordered, "WIN"),
      maximumConsecutiveLosses: maximumStreak(ordered, "LOSS"),
    },
    dataQuality: {
      entryExitCompletePercent: rounded(entryExitPercent * 100, 1),
      riskCompletePercent: rounded(riskPercent * 100, 1),
      reviewedPercent: rounded(reviewedPercent * 100, 1),
      evidenceLinkedPercent: rounded(evidencePercent * 100, 1),
      setupClassifiedPercent: rounded((ordered.length ? setupClassified / ordered.length : 0) * 100, 1),
      reviewIntegrityScore: Math.round((entryExitPercent * 0.35 + riskPercent * 0.2 + reviewedPercent * 0.3 + evidencePercent * 0.15) * 100),
    },
    risk: {
      riskSample: initialRisks.length,
      averageInitialRisk: nullableRounded(averageInitialRisk),
      medianInitialRisk: nullableRounded(median(initialRisks)),
      initialRiskCoefficientOfVariation: averageInitialRisk && riskStd !== null
        ? rounded(riskStd / averageInitialRisk, 3)
        : null,
      worstLossVsAverageLoss: stats.averageLoss && stats.averageLoss > 0
        ? rounded(worstLoss / stats.averageLoss, 3)
        : null,
      largestLossShareOfGrossLoss: nullableRounded(largestLossShare, 4),
    },
    recentVersusPrior: {
      comparisonSize,
      recent: recentMetrics,
      prior: priorMetrics,
      expectancyChange: recentMetrics?.expectancy != null && priorMetrics?.expectancy != null
        ? rounded(recentMetrics.expectancy - priorMetrics.expectancy)
        : null,
      winRateChange: recentMetrics?.winRate != null && priorMetrics?.winRate != null
        ? rounded(recentMetrics.winRate - priorMetrics.winRate, 4)
        : null,
      averageRChange: recentMetrics?.averageR != null && priorMetrics?.averageR != null
        ? rounded(recentMetrics.averageR - priorMetrics.averageR, 3)
        : null,
    },
    segments: {
      setup: groupSegments(ordered, (trade) => trade.setup || trade.tags[0] || "Unclassified"),
      symbol: groupSegments(ordered, (trade) => trade.symbol || "Unknown symbol"),
      side: groupSegments(ordered, (trade) => trade.side),
      weekday: groupSegments(ordered, (trade) => new Date(trade.openedAt).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })),
      entryHour: groupSegments(ordered, (trade) => `${String(new Date(trade.openedAt).getUTCHours()).padStart(2, "0")}:00 UTC`),
      holdingPeriod: groupSegments(ordered, (trade) => holdingPeriodLabel(trade.durationMs)),
    },
    reviewedTradeContext: [...ordered]
      .reverse()
      .filter((trade) => trade.reviewedAt || trade.notes.trim())
      .slice(0, 16)
      .map((trade) => ({
        date: trade.closedAt ?? trade.openedAt,
        symbol: trade.symbol,
        side: trade.side,
        setup: cleanContext(trade.setup, 100),
        tags: trade.tags.map((tag) => cleanContext(tag, 40)).filter(Boolean).slice(0, 8),
        netPnl: rounded(trade.netPnl),
        rMultiple: nullableRounded(trade.rMultiple, 3),
        rating: nullableRounded(trade.rating, 1),
        note: cleanContext(trade.notes, 360),
        improvement: cleanContext(trade.improvements ?? "", 360),
      })),
  };
}
