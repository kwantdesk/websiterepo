import type { FootprintBar, FootprintRow } from "./footprint.ts";

export const STACKED_IMBALANCE_SETTINGS_VERSION = 1;

export type ImbalanceSide = "ASK" | "BID";
export type ImbalanceComparisonMode = "diagonal" | "horizontal" | "custom-offset" | "both";
export type ImbalanceQualificationMode = "ratio" | "difference" | "dominance" | "ratio-and-difference" | "ratio-or-difference";
export type ImbalanceScopeMode = "bar" | "session" | "rolling-bars" | "custom-anchor";
export type ImbalanceZoneState = "ACTIVE" | "RETESTING" | "HELD" | "REJECTED" | "BROKEN" | "EXPIRED";

export interface StackedImbalanceSettings {
  version: number;
  enabledSides: "both" | "ask" | "bid";
  comparisonMode: ImbalanceComparisonMode;
  customOffsetGroups: number;
  qualificationMode: ImbalanceQualificationMode;
  ratioThreshold: number;
  ratioFullScore: number;
  minimumAbsoluteDifference: number;
  minimumDominanceShare: number;
  minimumNumeratorVolume: number;
  minimumDenominatorVolume: number;
  minimumCombinedVolume: number;
  minimumNumeratorTradeCount: number;
  minimumCombinedTradeCount: number;
  minimumZeroSideVolume: number;
  minimumZeroSideTradeCount: number;
  includeZeroSide: boolean;
  minimumStackedLevels: number;
  maximumGapGroups: number;
  minimumStackedTotalNumerator: number;
  minimumStackedScore: number;
  scopeMode: ImbalanceScopeMode;
  rollingBars: number;
  liveBarMode: "live" | "closed";
  createZones: boolean;
  showIndividualCells: boolean;
  showStackBrackets: boolean;
  showLabels: boolean;
  showActiveLane: boolean;
  showSessionProfile: boolean;
  showLowerPane: boolean;
  zoneExtensionMode: "until-broken" | "fixed-bars" | "session-end";
  zoneExtensionBars: number;
  minimumDepartureGroups: number;
  minimumResponseGroups: number;
  maximumRetestsPerZone: number;
  minimumBreakCloses: number;
  opacity: number;
  markerSize: number;
  activeLaneWidth: number;
  askColor: string;
  bidColor: string;
  brokenColor: string;
  neutralColor: string;
  useThemeColors: boolean;
  enableAlerts: boolean;
  alertOnLiveQualification: boolean;
  alertOnClosedBar: boolean;
  alertOnRetest: boolean;
  alertOnHeld: boolean;
  alertOnRejected: boolean;
  alertOnBroken: boolean;
  alertMinimumScore: number;
}

export const DEFAULT_STACKED_IMBALANCE_SETTINGS: StackedImbalanceSettings = {
  version: STACKED_IMBALANCE_SETTINGS_VERSION,
  enabledSides: "both",
  comparisonMode: "diagonal",
  customOffsetGroups: 1,
  qualificationMode: "ratio",
  ratioThreshold: 3,
  ratioFullScore: 6,
  minimumAbsoluteDifference: 100,
  minimumDominanceShare: 0.75,
  minimumNumeratorVolume: 50,
  minimumDenominatorVolume: 0,
  minimumCombinedVolume: 75,
  minimumNumeratorTradeCount: 1,
  minimumCombinedTradeCount: 1,
  minimumZeroSideVolume: 25,
  minimumZeroSideTradeCount: 1,
  includeZeroSide: true,
  minimumStackedLevels: 3,
  maximumGapGroups: 0,
  minimumStackedTotalNumerator: 150,
  minimumStackedScore: 65,
  scopeMode: "bar",
  rollingBars: 5,
  liveBarMode: "live",
  createZones: true,
  showIndividualCells: true,
  showStackBrackets: true,
  showLabels: true,
  showActiveLane: true,
  showSessionProfile: false,
  showLowerPane: false,
  zoneExtensionMode: "until-broken",
  zoneExtensionBars: 40,
  minimumDepartureGroups: 2,
  minimumResponseGroups: 2,
  maximumRetestsPerZone: 3,
  minimumBreakCloses: 1,
  opacity: 74,
  markerSize: 6,
  activeLaneWidth: 96,
  askColor: "#22D3A7",
  bidColor: "#FF3B78",
  brokenColor: "#71717A",
  neutralColor: "#A1A1AA",
  useThemeColors: true,
  enableAlerts: false,
  alertOnLiveQualification: false,
  alertOnClosedBar: true,
  alertOnRetest: true,
  alertOnHeld: true,
  alertOnRejected: true,
  alertOnBroken: true,
  alertMinimumScore: 65,
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const oneOf = <T extends string>(value: unknown, choices: readonly T[], fallback: T) => choices.includes(String(value) as T) ? String(value) as T : fallback;

export function normalizeStackedImbalanceSettings(input?: Record<string, unknown> | null): StackedImbalanceSettings {
  const base = DEFAULT_STACKED_IMBALANCE_SETTINGS;
  return {
    ...base,
    ...input,
    version: STACKED_IMBALANCE_SETTINGS_VERSION,
    enabledSides: oneOf(input?.enabledSides, ["both", "ask", "bid"], base.enabledSides),
    comparisonMode: oneOf(input?.comparisonMode, ["diagonal", "horizontal", "custom-offset", "both"], base.comparisonMode),
    qualificationMode: oneOf(input?.qualificationMode, ["ratio", "difference", "dominance", "ratio-and-difference", "ratio-or-difference"], base.qualificationMode),
    scopeMode: oneOf(input?.scopeMode, ["bar", "session", "rolling-bars", "custom-anchor"], base.scopeMode),
    liveBarMode: oneOf(input?.liveBarMode, ["live", "closed"], base.liveBarMode),
    zoneExtensionMode: oneOf(input?.zoneExtensionMode, ["until-broken", "fixed-bars", "session-end"], base.zoneExtensionMode),
    customOffsetGroups: clamp(Math.round(finite(input?.customOffsetGroups, base.customOffsetGroups)), 1, 20),
    ratioThreshold: clamp(finite(input?.ratioThreshold, base.ratioThreshold), 1.01, 100),
    ratioFullScore: clamp(finite(input?.ratioFullScore, base.ratioFullScore), 1.1, 200),
    minimumAbsoluteDifference: Math.max(0, finite(input?.minimumAbsoluteDifference, base.minimumAbsoluteDifference)),
    minimumDominanceShare: clamp(finite(input?.minimumDominanceShare, base.minimumDominanceShare), 0.5, 1),
    minimumNumeratorVolume: Math.max(0, finite(input?.minimumNumeratorVolume, base.minimumNumeratorVolume)),
    minimumDenominatorVolume: Math.max(0, finite(input?.minimumDenominatorVolume, base.minimumDenominatorVolume)),
    minimumCombinedVolume: Math.max(0, finite(input?.minimumCombinedVolume, base.minimumCombinedVolume)),
    minimumNumeratorTradeCount: Math.max(0, Math.round(finite(input?.minimumNumeratorTradeCount, base.minimumNumeratorTradeCount))),
    minimumCombinedTradeCount: Math.max(0, Math.round(finite(input?.minimumCombinedTradeCount, base.minimumCombinedTradeCount))),
    minimumZeroSideVolume: Math.max(0, finite(input?.minimumZeroSideVolume, base.minimumZeroSideVolume)),
    minimumZeroSideTradeCount: Math.max(0, Math.round(finite(input?.minimumZeroSideTradeCount, base.minimumZeroSideTradeCount))),
    minimumStackedLevels: clamp(Math.round(finite(input?.minimumStackedLevels, base.minimumStackedLevels)), 2, 20),
    maximumGapGroups: clamp(Math.round(finite(input?.maximumGapGroups, base.maximumGapGroups)), 0, 10),
    minimumStackedTotalNumerator: Math.max(0, finite(input?.minimumStackedTotalNumerator, base.minimumStackedTotalNumerator)),
    minimumStackedScore: clamp(finite(input?.minimumStackedScore, base.minimumStackedScore), 0, 100),
    rollingBars: clamp(Math.round(finite(input?.rollingBars, base.rollingBars)), 2, 100),
    zoneExtensionBars: clamp(Math.round(finite(input?.zoneExtensionBars, base.zoneExtensionBars)), 1, 500),
    minimumDepartureGroups: clamp(Math.round(finite(input?.minimumDepartureGroups, base.minimumDepartureGroups)), 1, 20),
    minimumResponseGroups: clamp(Math.round(finite(input?.minimumResponseGroups, base.minimumResponseGroups)), 1, 20),
    maximumRetestsPerZone: clamp(Math.round(finite(input?.maximumRetestsPerZone, base.maximumRetestsPerZone)), 0, 20),
    minimumBreakCloses: clamp(Math.round(finite(input?.minimumBreakCloses, base.minimumBreakCloses)), 1, 10),
    opacity: clamp(finite(input?.opacity, base.opacity), 0, 100),
    markerSize: clamp(finite(input?.markerSize, base.markerSize), 4, 18),
    activeLaneWidth: clamp(finite(input?.activeLaneWidth, base.activeLaneWidth), 86, 240),
    alertMinimumScore: clamp(finite(input?.alertMinimumScore, base.alertMinimumScore), 0, 100),
  } as StackedImbalanceSettings;
}

export interface ImbalanceCell {
  id: string;
  barId: string;
  timestamp: number;
  side: ImbalanceSide;
  tickIndex: number;
  price: number;
  numerator: number;
  denominator: number;
  numeratorTrades: number;
  denominatorTrades: number;
  ratio: number | null;
  ratioPercent: number | null;
  difference: number;
  dominanceShare: number;
  zeroSide: boolean;
  comparison: "diagonal" | "horizontal" | "custom-offset";
  qualified: boolean;
  score: number;
}

export interface StackedImbalanceGroup {
  id: string;
  scopeId: string;
  timestamp: number;
  endTimestamp: number;
  side: ImbalanceSide;
  lowTick: number;
  highTick: number;
  centreTick: number;
  levelCount: number;
  cells: ImbalanceCell[];
  totalNumerator: number;
  totalDenominator: number;
  weightedRatio: number | null;
  minimumRatio: number | null;
  maximumRatio: number | null;
  score: number;
  confirmed: boolean;
  isClosed: boolean;
  repeatCount: number;
}

export interface ImbalanceZone extends StackedImbalanceGroup {
  state: ImbalanceZoneState;
  createdAt: number;
  extendedUntil: number | null;
  brokenAt: number | null;
  retestCount: number;
  departed: boolean;
}

export interface StackedImbalanceAlert {
  id: string;
  type: "QUALIFIED" | "RETESTING" | "HELD" | "REJECTED" | "BROKEN";
  zone: ImbalanceZone;
}

export interface StackedImbalanceFrame {
  generatedAt: number;
  status: "LIVE" | "STALE" | "WAITING_FOR_EXECUTIONS";
  instrument: string;
  tickSize: number;
  groupTicks: number;
  lastPrice: number | null;
  cells: ImbalanceCell[];
  groups: StackedImbalanceGroup[];
  zones: ImbalanceZone[];
  alerts: StackedImbalanceAlert[];
  limitations: string[];
}

function cellScore(ratio: number | null, difference: number, dominance: number, numerator: number, settings: StackedImbalanceSettings) {
  const ratioScore = ratio === null ? 100 : clamp((ratio - settings.ratioThreshold) / Math.max(0.01, settings.ratioFullScore - settings.ratioThreshold) * 100, 0, 100);
  const differenceScore = clamp(difference / Math.max(1, settings.minimumAbsoluteDifference * 2) * 100, 0, 100);
  const dominanceScore = clamp((dominance - settings.minimumDominanceShare) / Math.max(0.01, 1 - settings.minimumDominanceShare) * 100, 0, 100);
  const volumeScore = clamp(numerator / Math.max(1, settings.minimumNumeratorVolume * 3) * 100, 0, 100);
  return Math.round(ratioScore * 0.35 + differenceScore * 0.2 + dominanceScore * 0.2 + volumeScore * 0.25);
}

function qualifiedByMode(ratioQualified: boolean, differenceQualified: boolean, dominanceQualified: boolean, mode: ImbalanceQualificationMode) {
  if (mode === "difference") return differenceQualified;
  if (mode === "dominance") return dominanceQualified;
  if (mode === "ratio-and-difference") return ratioQualified && differenceQualified;
  if (mode === "ratio-or-difference") return ratioQualified || differenceQualified;
  return ratioQualified;
}

function candidateCell(bar: FootprintBar, row: FootprintRow, rows: Map<number, FootprintRow>, side: ImbalanceSide, comparison: "diagonal" | "horizontal" | "custom-offset", offsetTicks: number, settings: StackedImbalanceSettings): ImbalanceCell {
  const comparisonTick = comparison === "horizontal" ? row.tickIndex : row.tickIndex + (side === "ASK" ? -offsetTicks : offsetTicks);
  const other = rows.get(comparisonTick);
  const numerator = side === "ASK" ? row.askVolume : row.bidVolume;
  const denominator = side === "ASK" ? (comparison === "horizontal" ? row.bidVolume : other?.bidVolume ?? 0) : (comparison === "horizontal" ? row.askVolume : other?.askVolume ?? 0);
  const numeratorTrades = side === "ASK" ? row.askTrades : row.bidTrades;
  const denominatorTrades = side === "ASK" ? (comparison === "horizontal" ? row.bidTrades : other?.bidTrades ?? 0) : (comparison === "horizontal" ? row.askTrades : other?.askTrades ?? 0);
  const combined = numerator + denominator;
  const combinedTrades = numeratorTrades + denominatorTrades;
  const zeroSide = denominator === 0 && numerator > 0;
  const ratio = denominator > 0 ? numerator / denominator : null;
  const ratioPercent = ratio === null ? null : ratio * 100;
  const difference = numerator - denominator;
  const dominanceShare = combined > 0 ? numerator / combined : 0;
  const gates = numerator >= settings.minimumNumeratorVolume
    && denominator >= settings.minimumDenominatorVolume
    && combined >= settings.minimumCombinedVolume
    && numeratorTrades >= settings.minimumNumeratorTradeCount
    && combinedTrades >= settings.minimumCombinedTradeCount;
  const zeroQualified = zeroSide && settings.includeZeroSide && numerator >= settings.minimumZeroSideVolume && numeratorTrades >= settings.minimumZeroSideTradeCount;
  const ratioQualified = zeroQualified || (ratio !== null && ratio >= settings.ratioThreshold);
  const differenceQualified = difference >= settings.minimumAbsoluteDifference;
  const dominanceQualified = dominanceShare >= settings.minimumDominanceShare;
  const qualified = gates && qualifiedByMode(ratioQualified, differenceQualified, dominanceQualified, settings.qualificationMode);
  return {
    id: `${bar.id}:${side}:${row.tickIndex}:${comparison}`,
    barId: bar.id,
    timestamp: bar.timestamp,
    side,
    tickIndex: row.tickIndex,
    price: row.price,
    numerator,
    denominator,
    numeratorTrades,
    denominatorTrades,
    ratio,
    ratioPercent,
    difference,
    dominanceShare,
    zeroSide,
    comparison,
    qualified,
    score: cellScore(ratio, difference, dominanceShare, numerator, settings),
  };
}

export function calculateImbalanceCells(bar: FootprintBar, settingsInput?: Partial<StackedImbalanceSettings>, groupTicks = 1): ImbalanceCell[] {
  const settings = normalizeStackedImbalanceSettings(settingsInput as Record<string, unknown>);
  const rows = new Map(bar.rows.map((row) => [row.tickIndex, row]));
  const comparisons: Array<"diagonal" | "horizontal" | "custom-offset"> = settings.comparisonMode === "both"
    ? ["diagonal", "horizontal"]
    : [settings.comparisonMode];
  const sides: ImbalanceSide[] = settings.enabledSides === "ask" ? ["ASK"] : settings.enabledSides === "bid" ? ["BID"] : ["ASK", "BID"];
  const selected = new Map<string, ImbalanceCell>();
  for (const row of bar.rows) {
    for (const side of sides) {
      for (const comparison of comparisons) {
        const offset = (comparison === "custom-offset" ? settings.customOffsetGroups : 1) * Math.max(1, groupTicks);
        const cell = candidateCell(bar, row, rows, side, comparison, offset, settings);
        const key = `${side}:${row.tickIndex}`;
        const previous = selected.get(key);
        if (!previous || Number(cell.qualified) > Number(previous.qualified) || cell.score > previous.score) selected.set(key, cell);
      }
    }
  }
  return [...selected.values()].sort((a, b) => a.timestamp - b.timestamp || a.tickIndex - b.tickIndex || a.side.localeCompare(b.side));
}

function groupScore(cells: ImbalanceCell[], settings: StackedImbalanceSettings) {
  const numerator = cells.reduce((sum, cell) => sum + cell.numerator, 0);
  const denominator = cells.reduce((sum, cell) => sum + cell.denominator, 0);
  const weightedRatio = denominator > 0 ? numerator / denominator : null;
  const ratioScore = weightedRatio === null ? 100 : clamp((weightedRatio - settings.ratioThreshold) / Math.max(0.01, settings.ratioFullScore - settings.ratioThreshold) * 100, 0, 100);
  const levelScore = clamp(cells.length / Math.max(1, settings.minimumStackedLevels * 2) * 100, 0, 100);
  const volumeScore = clamp(numerator / Math.max(1, settings.minimumStackedTotalNumerator * 2) * 100, 0, 100);
  const concentration = clamp(cells.reduce((sum, cell) => sum + cell.dominanceShare, 0) / Math.max(1, cells.length) * 100, 0, 100);
  return Math.round(ratioScore * 0.2 + volumeScore * 0.3 + levelScore * 0.25 + concentration * 0.25);
}

export function buildStackedImbalanceGroups(cells: ImbalanceCell[], scopeId: string, endTimestamp: number, isClosed: boolean, settingsInput?: Partial<StackedImbalanceSettings>, groupTicks = 1): StackedImbalanceGroup[] {
  const settings = normalizeStackedImbalanceSettings(settingsInput as Record<string, unknown>);
  const groups: StackedImbalanceGroup[] = [];
  for (const side of ["ASK", "BID"] as const) {
    const qualified = cells.filter((cell) => cell.side === side && cell.qualified).sort((a, b) => a.tickIndex - b.tickIndex);
    let current: ImbalanceCell[] = [];
    const flush = () => {
      if (!current.length) return;
      const numerator = current.reduce((sum, cell) => sum + cell.numerator, 0);
      const denominator = current.reduce((sum, cell) => sum + cell.denominator, 0);
      const score = groupScore(current, settings);
      const ratios = current.map((cell) => cell.ratio).filter((ratio): ratio is number => ratio !== null);
      const lowTick = current[0].tickIndex; const highTick = current.at(-1)!.tickIndex;
      const confirmed = current.length >= settings.minimumStackedLevels && numerator >= settings.minimumStackedTotalNumerator && score >= settings.minimumStackedScore;
      groups.push({
        id: `${scopeId}:${side}:${lowTick}:${highTick}`,
        scopeId,
        timestamp: current[0].timestamp,
        endTimestamp,
        side,
        lowTick,
        highTick,
        centreTick: current.reduce((sum, cell) => sum + cell.tickIndex * cell.numerator, 0) / Math.max(1, numerator),
        levelCount: current.length,
        cells: current,
        totalNumerator: numerator,
        totalDenominator: denominator,
        weightedRatio: denominator > 0 ? numerator / denominator : null,
        minimumRatio: ratios.length ? Math.min(...ratios) : null,
        maximumRatio: ratios.length ? Math.max(...ratios) : null,
        score,
        confirmed,
        isClosed,
        repeatCount: 0,
      });
      current = [];
    };
    for (const cell of qualified) {
      const previous = current.at(-1);
      if (previous && cell.tickIndex - previous.tickIndex > Math.max(1, groupTicks) * (settings.maximumGapGroups + 1)) flush();
      current.push(cell);
    }
    flush();
  }
  return groups;
}

function aggregateBars(bars: FootprintBar[], id: string): FootprintBar {
  const latest = bars.at(-1)!;
  const rows = new Map<number, FootprintRow>();
  for (const bar of bars) for (const row of bar.rows) {
    const existing = rows.get(row.tickIndex);
    if (!existing) rows.set(row.tickIndex, { ...row });
    else {
      existing.bidVolume += row.bidVolume; existing.askVolume += row.askVolume; existing.unknownVolume += row.unknownVolume;
      existing.bidTrades += row.bidTrades; existing.askTrades += row.askTrades; existing.unknownTrades += row.unknownTrades;
      existing.classifiedVolume = existing.bidVolume + existing.askVolume; existing.totalVolume = existing.classifiedVolume + existing.unknownVolume;
      existing.volume = existing.totalVolume; existing.delta = existing.askVolume - existing.bidVolume;
      existing.deltaPercent = existing.classifiedVolume > 0 ? existing.delta / existing.classifiedVolume : 0;
    }
  }
  const ordered = [...rows.values()].sort((a, b) => a.tickIndex - b.tickIndex);
  return { ...latest, id, timestamp: bars[0].timestamp, startTime: bars[0].startTime, rows: ordered };
}

function sessionId(timestamp: number) {
  const date = new Date(timestamp - 22 * 60 * 60 * 1_000);
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
}

export class StackedImbalanceEngine {
  private zones = new Map<string, ImbalanceZone>();
  private previousStates = new Map<string, ImbalanceZoneState>();
  reset() { this.zones.clear(); this.previousStates.clear(); }

  update(barsInput: FootprintBar[], instrument: string, tickSize: number, groupTicks: number, settingsInput?: Partial<StackedImbalanceSettings>, now = Date.now()): StackedImbalanceFrame {
    const settings = normalizeStackedImbalanceSettings(settingsInput as Record<string, unknown>);
    const bars = barsInput.filter((bar) => settings.liveBarMode === "live" || bar.isClosed);
    if (!bars.length || !bars.some((bar) => bar.hasPriceLevelFlow)) return { generatedAt: now, status: "WAITING_FOR_EXECUTIONS", instrument, tickSize, groupTicks, lastPrice: barsInput.at(-1)?.close ?? null, cells: [], groups: [], zones: [], alerts: [], limitations: ["Waiting for classified aggressive executions from the shared Footprint stream."] };
    const scopeBars: Array<{ id: string; bar: FootprintBar; source: FootprintBar[] }> = [];
    if (settings.scopeMode === "bar") for (const bar of bars) scopeBars.push({ id: bar.id, bar, source: [bar] });
    else if (settings.scopeMode === "rolling-bars") for (let index = 0; index < bars.length; index += 1) { const source = bars.slice(Math.max(0, index - settings.rollingBars + 1), index + 1); scopeBars.push({ id: `rolling:${source[0].id}:${source.at(-1)!.id}`, bar: aggregateBars(source, `rolling:${source.at(-1)!.id}`), source }); }
    else {
      const buckets = new Map<string, FootprintBar[]>();
      for (const bar of bars) { const id = settings.scopeMode === "session" ? sessionId(bar.timestamp) : `anchor:${sessionId(bar.timestamp)}`; const bucket = buckets.get(id) ?? []; bucket.push(bar); buckets.set(id, bucket); }
      for (const [id, source] of buckets) scopeBars.push({ id, bar: aggregateBars(source, id), source });
    }
    const cells: ImbalanceCell[] = []; const groups: StackedImbalanceGroup[] = [];
    for (const scope of scopeBars) {
      const nextCells = calculateImbalanceCells(scope.bar, settings, groupTicks); cells.push(...nextCells);
      groups.push(...buildStackedImbalanceGroups(nextCells, scope.id, scope.source.at(-1)!.endTime, scope.source.every((bar) => bar.isClosed), settings, groupTicks));
    }
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      group.repeatCount = groups.slice(Math.max(0, index - 30), index).filter((candidate) =>
        candidate.confirmed
        && candidate.side === group.side
        && candidate.scopeId !== group.scopeId
        && candidate.highTick >= group.lowTick
        && candidate.lowTick <= group.highTick).length;
    }
    const confirmed = groups.filter((group) => group.confirmed);
    for (const group of confirmed) {
      const existing = this.zones.get(group.id);
      this.zones.set(group.id, existing ? { ...existing, ...group } : { ...group, state: "ACTIVE", createdAt: group.endTimestamp, extendedUntil: settings.zoneExtensionMode === "fixed-bars" ? group.endTimestamp + settings.zoneExtensionBars * Math.max(1, group.endTimestamp - group.timestamp) : null, brokenAt: null, retestCount: 0, departed: false });
    }
    const last = bars.at(-1)!; const lastTick = Math.round(last.close / tickSize); const alerts: StackedImbalanceAlert[] = [];
    for (const [id, zone] of this.zones) {
      let next = { ...zone }; const margin = settings.minimumDepartureGroups * groupTicks;
      if (settings.zoneExtensionMode === "fixed-bars" && next.extendedUntil && now > next.extendedUntil) next.state = "EXPIRED";
      else if (settings.zoneExtensionMode === "session-end" && sessionId(last.timestamp) !== sessionId(next.createdAt)) next.state = "EXPIRED";
      else if (next.state !== "BROKEN" && next.state !== "EXPIRED") {
        const opposingRejection = confirmed.find((candidate) => candidate.side !== next.side && candidate.timestamp >= next.createdAt && candidate.highTick >= next.lowTick && candidate.lowTick <= next.highTick && candidate.score >= Math.max(70, settings.minimumStackedScore));
        if (opposingRejection) next.state = "REJECTED";
        const broken = next.side === "ASK" ? lastTick > next.highTick : lastTick < next.lowTick;
        if (broken && last.isClosed) { next.state = "BROKEN"; next.brokenAt = last.endTime; }
        else {
          const departed = next.departed || (next.side === "ASK" ? lastTick <= next.lowTick - margin : lastTick >= next.highTick + margin);
          const inside = lastTick >= next.lowTick && lastTick <= next.highTick;
          if (departed && inside && next.retestCount < settings.maximumRetestsPerZone) { if (next.state !== "RETESTING") next.retestCount += 1; next.state = "RETESTING"; }
          else if (next.state === "RETESTING" && !inside) { const response = next.side === "ASK" ? lastTick <= next.lowTick - settings.minimumResponseGroups * groupTicks : lastTick >= next.highTick + settings.minimumResponseGroups * groupTicks; if (response) next.state = "HELD"; }
          else if (next.state === "HELD") next.state = "ACTIVE";
          next.departed = departed;
        }
      }
      const previous = this.previousStates.get(id);
      if (!previous && next.score >= settings.alertMinimumScore && (settings.alertOnLiveQualification || (settings.alertOnClosedBar && next.isClosed))) alerts.push({ id: `${id}:QUALIFIED`, type: "QUALIFIED", zone: next });
      else if (previous && previous !== next.state && ["RETESTING", "HELD", "REJECTED", "BROKEN"].includes(next.state)) alerts.push({ id: `${id}:${next.state}:${next.retestCount}`, type: next.state as StackedImbalanceAlert["type"], zone: next });
      this.previousStates.set(id, next.state); this.zones.set(id, next);
    }
    const latestTimestamp = bars.at(-1)!.endTime;
    return { generatedAt: now, status: now - latestTimestamp > 120_000 ? "STALE" : "LIVE", instrument, tickSize, groupTicks, lastPrice: last.close, cells: cells.slice(-4_000), groups: groups.slice(-1_000), zones: [...this.zones.values()].slice(-500), alerts, limitations: [] };
  }
}

export const STACKED_IMBALANCE_PRESETS: Record<string, Partial<StackedImbalanceSettings>> = {
  "Balanced Diagonal": {},
  "NQ Scalper": { minimumNumeratorVolume: 30, minimumCombinedVolume: 50, ratioThreshold: 2.5, minimumStackedScore: 60, liveBarMode: "live" },
  "Strict Confirmation": { ratioThreshold: 4, minimumAbsoluteDifference: 150, minimumStackedLevels: 4, minimumStackedScore: 75, liveBarMode: "closed" },
  "Session Imbalance": { scopeMode: "session", comparisonMode: "diagonal", minimumStackedLevels: 3 },
};
