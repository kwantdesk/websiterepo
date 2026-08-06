export const TPO_STRUCTURE_LABELS = {
  SELL_TAIL: "TPO SELL TAIL",
  BUY_TAIL: "TPO BUY TAIL",
  SINGLE_PRINT: "TPO SINGLE PRINT",
  LEDGE: "TPO LEDGE",
  FAILED_AUCTION: "TPO FAILED AUCTION",
  PROFILE_EDGE: "TPO PROFILE EDGE",
  LOW_TIME_SEAM: "TPO LOW-TIME SEAM",
} as const;

export type TpoStructureType = keyof typeof TPO_STRUCTURE_LABELS;
export type TpoZoneSide = "SUPPORT" | "RESISTANCE" | "NEUTRAL";
export type TpoLifecycleState =
  | "VIRGIN"
  | "TESTED"
  | "HOLDING"
  | "PARTIALLY_FILLED"
  | "BROKEN"
  | "FLIPPED"
  | "ACCEPTED"
  | "EXPIRED";

export type TpoTrade = {
  timestamp: number;
  price: number;
  size: number;
  instrumentId?: number | string | null;
  symbol?: string | null;
};

export type TpoSessionInput = {
  date: string;
  start: number;
  end: number;
  trades: TpoTrade[];
  contract?: string | null;
};

export type TpoAutomaticLevel = {
  id?: string;
  price: number;
  label: string;
  tolerance?: number;
};

export type TpoEngineConfig = {
  rowSize: number;
  minimumTrades: number;
  detectionSessions: number;
  historySessions: number;
  tailMinimumRows: number;
  singlePrintMinimumRows: number;
  ledgeMinimumBrackets: number;
  ledgeToleranceRows: number;
  failedAuctionMinimumRows: number;
  failedAuctionMaximumTpo: number;
  edgeSmoothingRows: number;
  edgeDropRatio: number;
  edgeMaximumWidthRows: number;
  acceptedBaseRatio: number;
  seamTroughRatio: number;
  volumeLvnRatio: number;
  acceptanceBrackets: number;
  partialFillRatio: number;
  expireAfterSessions: number;
  expireStrength: number;
  displayEachSide: number;
};

export const DEFAULT_TPO_ENGINE_CONFIG: TpoEngineConfig = {
  rowSize: 1,
  minimumTrades: 500,
  detectionSessions: 5,
  historySessions: 10,
  tailMinimumRows: 3,
  singlePrintMinimumRows: 4,
  ledgeMinimumBrackets: 3,
  ledgeToleranceRows: 1,
  failedAuctionMinimumRows: 5,
  failedAuctionMaximumTpo: 2,
  edgeSmoothingRows: 5,
  edgeDropRatio: 0.5,
  edgeMaximumWidthRows: 3,
  acceptedBaseRatio: 0.6,
  seamTroughRatio: 0.5,
  volumeLvnRatio: 0.5,
  acceptanceBrackets: 2,
  partialFillRatio: 0.5,
  expireAfterSessions: 10,
  expireStrength: 20,
  displayEachSide: 3,
};

export type TpoProfileRow = {
  row: number;
  price: number;
  brackets: number[];
  tpoCount: number;
  volume: number;
};

export type TpoBracket = {
  index: number;
  letter: string;
  openRow: number;
  highRow: number;
  lowRow: number;
  closeRow: number;
};

export type TpoSessionProfile = {
  date: string;
  start: number;
  end: number;
  contract: string | null;
  tradeCount: number;
  excluded: boolean;
  excludedReason: string | null;
  lowRow: number;
  highRow: number;
  rows: TpoProfileRow[];
  brackets: TpoBracket[];
  meanRowVolume: number;
  maxTpoCount: number;
};

export type TpoZone = {
  id: string;
  type: TpoStructureType;
  label: string;
  side: TpoZoneSide;
  low: number;
  high: number;
  formationSession: string;
  formationStart: string;
  formationEnd: string;
  contract: string | null;
  tpoCount: number;
  volumeConfirmation: boolean;
  lvnValue: number | null;
  confluenceReasons: string[];
  strength: number;
  currentPriority: number;
  touches: number;
  fillPercent: number;
  state: TpoLifecycleState;
  active: boolean;
  displayed: boolean;
  ageSessions: number;
  direction: -1 | 0 | 1;
  edgeSharpness: number;
  departureImpulse: number;
};

export type TpoReplayRecord = {
  zoneId: string;
  structureType: TpoStructureType;
  strengthBand: "0-39" | "40-59" | "60-79" | "80-100";
  firstTouchAt: string | null;
  outcome: "REJECTION" | "ACCEPTED_BREAK" | "PENDING";
};

export type TpoReplaySummary = {
  calibrated: boolean;
  records: TpoReplayRecord[];
  byStructure: Record<string, { rejection: number; acceptedBreak: number; pending: number }>;
  byStrengthBand: Record<string, { rejection: number; acceptedBreak: number; pending: number }>;
};

export type TpoExcludedSession = { date: string; reason: string };

export type TpoLevelsPayload = {
  generatedAt: string;
  nextRefreshAt: string;
  sourceSessions: string[];
  excludedSessions: TpoExcludedSession[];
  dataAge: number;
  stale: boolean;
  zones: TpoZone[];
  replay: TpoReplaySummary;
  currentPrice: number | null;
  source: {
    dataset: "GLBX.MDP3";
    schema: "trades";
    instrument: "NQ front-month outright";
    rowSize: number;
    session: "09:30-16:00 America/New_York";
  };
};

export function staleTpoPayload(payload: TpoLevelsPayload, now: number): TpoLevelsPayload {
  return {
    ...payload,
    stale: true,
    dataAge: Math.max(0, now - Date.parse(payload.generatedAt)),
  };
}

type RawStructure = Omit<TpoZone,
  "id" | "label" | "strength" | "currentPriority" | "touches" | "fillPercent" |
  "state" | "active" | "displayed" | "ageSessions"
> & {
  heightRows: number;
  minimumRows: number;
  repeated: boolean;
};

const NY_TIME_ZONE = "America/New_York";
const nyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: NY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type LocalDate = { year: number; month: number; day: number };

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function nyParts(timestamp: number) {
  const parts = Object.fromEntries(
    nyFormatter.formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function addLocalDays(date: LocalDate, days: number): LocalDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function localDateLabel(date: LocalDate) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function localDayOfWeek(date: LocalDate) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function timeZoneOffsetMinutes(timestamp: number) {
  const parts = nyParts(timestamp);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((representedAsUtc - timestamp) / 60_000);
}

function zonedEpoch(date: LocalDate, hour: number, minute: number) {
  const guess = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const firstPass = guess - timeZoneOffsetMinutes(guess) * 60_000;
  return guess - timeZoneOffsetMinutes(firstPass) * 60_000;
}

export function nqRthWindow(dateLabel: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateLabel);
  if (!match) throw new Error(`Invalid RTH session date: ${dateLabel}`);
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return {
    date: dateLabel,
    start: zonedEpoch(date, 9, 30),
    end: zonedEpoch(date, 16, 0),
  };
}

export function completedNqRthWindows(now: number, count = 10) {
  const parts = nyParts(now);
  const today = { year: parts.year, month: parts.month, day: parts.day };
  const windows: Array<{ date: string; start: number; end: number }> = [];
  for (let offset = 0; offset < 40 && windows.length < count; offset += 1) {
    const date = addLocalDays(today, -offset);
    const weekday = localDayOfWeek(date);
    if (weekday === 0 || weekday === 6) continue;
    const window = nqRthWindow(localDateLabel(date));
    if (window.end <= now) windows.push(window);
  }
  return windows;
}

export function nextNqRthCompletion(now: number) {
  const parts = nyParts(now);
  const today = { year: parts.year, month: parts.month, day: parts.day };
  for (let offset = 0; offset < 10; offset += 1) {
    const date = addLocalDays(today, offset);
    const weekday = localDayOfWeek(date);
    if (weekday === 0 || weekday === 6) continue;
    const close = nqRthWindow(localDateLabel(date)).end;
    if (close > now) return close;
  }
  return now + 24 * 60 * 60_000;
}

export function tpoBracketIndex(timestamp: number, start: number, end: number) {
  if (timestamp < start || timestamp >= end) return -1;
  return Math.min(12, Math.floor((timestamp - start) / (30 * 60_000)));
}

export function buildTpoSessionProfile(
  session: TpoSessionInput,
  requestedConfig: Partial<TpoEngineConfig> = {},
): TpoSessionProfile {
  const config = { ...DEFAULT_TPO_ENGINE_CONFIG, ...requestedConfig };
  const rowMap = new Map<number, { brackets: Set<number>; volume: number }>();
  const bracketTrades = new Map<number, Array<{ row: number; timestamp: number }>>();
  const trades = session.trades
    .filter((trade) => Number.isFinite(trade.price) && Number.isFinite(trade.timestamp) && trade.size >= 0)
    .map((trade) => ({
      ...trade,
      bracket: tpoBracketIndex(trade.timestamp, session.start, session.end),
      row: Math.round(trade.price / config.rowSize),
    }))
    .filter((trade) => trade.bracket >= 0)
    .sort((left, right) => left.timestamp - right.timestamp || left.row - right.row);

  trades.forEach((trade) => {
    const row = rowMap.get(trade.row) ?? { brackets: new Set<number>(), volume: 0 };
    row.brackets.add(trade.bracket);
    row.volume += trade.size;
    rowMap.set(trade.row, row);
    const bracket = bracketTrades.get(trade.bracket) ?? [];
    bracket.push({ row: trade.row, timestamp: trade.timestamp });
    bracketTrades.set(trade.bracket, bracket);
  });

  const observedRows = [...rowMap.keys()].sort((a, b) => a - b);
  const lowRow = observedRows[0] ?? 0;
  const highRow = observedRows.at(-1) ?? 0;
  const rows: TpoProfileRow[] = [];
  if (observedRows.length) {
    for (let row = lowRow; row <= highRow; row += 1) {
      const observed = rowMap.get(row);
      const brackets = observed ? [...observed.brackets].sort((a, b) => a - b) : [];
      rows.push({
        row,
        price: round(row * config.rowSize),
        brackets,
        tpoCount: brackets.length,
        volume: round(observed?.volume ?? 0),
      });
    }
  }

  const brackets = [...bracketTrades.entries()].sort(([a], [b]) => a - b).map(([index, values]) => {
    const ordered = values.sort((left, right) => left.timestamp - right.timestamp);
    return {
      index,
      letter: String.fromCharCode(65 + Math.min(index, 12)),
      openRow: ordered[0].row,
      highRow: Math.max(...ordered.map((value) => value.row)),
      lowRow: Math.min(...ordered.map((value) => value.row)),
      closeRow: ordered.at(-1)?.row ?? ordered[0].row,
    };
  });
  const tradedRows = rows.filter((row) => row.tpoCount > 0);
  const excluded = trades.length < config.minimumTrades;
  return {
    date: session.date,
    start: session.start,
    end: session.end,
    contract: session.contract ?? null,
    tradeCount: trades.length,
    excluded,
    excludedReason: excluded ? `Only ${trades.length} trades; minimum is ${config.minimumTrades}.` : null,
    lowRow,
    highRow,
    rows,
    brackets,
    meanRowVolume: tradedRows.length
      ? round(tradedRows.reduce((sum, row) => sum + row.volume, 0) / tradedRows.length)
      : 0,
    maxTpoCount: Math.max(0, ...rows.map((row) => row.tpoCount)),
  };
}

function contiguousRuns(rows: number[]) {
  const sorted = unique(rows).sort((a, b) => a - b);
  const runs: Array<{ lowRow: number; highRow: number; rows: number[] }> = [];
  sorted.forEach((row) => {
    const previous = runs.at(-1);
    if (!previous || row > previous.highRow + 1) {
      runs.push({ lowRow: row, highRow: row, rows: [row] });
      return;
    }
    previous.highRow = row;
    previous.rows.push(row);
  });
  return runs;
}

function smoothCounts(profile: TpoSessionProfile, width: number) {
  const half = Math.floor(Math.max(1, width) / 2);
  return profile.rows.map((row, index) => {
    const from = Math.max(0, index - half);
    const to = Math.min(profile.rows.length - 1, index + half);
    const values = profile.rows.slice(from, to + 1);
    return {
      row: row.row,
      value: values.reduce((sum, candidate) => sum + candidate.tpoCount, 0) / values.length,
    };
  });
}

function priceBand(lowRow: number, highRow: number, rowSize: number) {
  return {
    low: round((lowRow - 0.5) * rowSize),
    high: round((highRow + 0.5) * rowSize),
  };
}

function averageVolume(profile: TpoSessionProfile, lowRow: number, highRow: number) {
  const rows = profile.rows.filter((row) => row.row >= lowRow && row.row <= highRow);
  return rows.length ? rows.reduce((sum, row) => sum + row.volume, 0) / rows.length : 0;
}

function dominantBracket(profile: TpoSessionProfile, rows: number[]) {
  const counts = new Map<number, number>();
  rows.forEach((rowIndex) => {
    const row = profile.rows.find((candidate) => candidate.row === rowIndex);
    row?.brackets.forEach((bracket) => counts.set(bracket, (counts.get(bracket) ?? 0) + 1));
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? -1;
}

function structureDirection(profile: TpoSessionProfile, rows: number[]): -1 | 0 | 1 {
  const bracketIndex = dominantBracket(profile, rows);
  const bracket = profile.brackets.find((candidate) => candidate.index === bracketIndex);
  if (!bracket) return 0;
  return Math.sign(bracket.closeRow - bracket.openRow) as -1 | 0 | 1;
}

function departureImpulse(profile: TpoSessionProfile, lowRow: number, highRow: number) {
  const bracketIndex = dominantBracket(profile, Array.from({ length: highRow - lowRow + 1 }, (_, i) => lowRow + i));
  const current = profile.brackets.find((candidate) => candidate.index === bracketIndex);
  const next = profile.brackets.find((candidate) => candidate.index === bracketIndex + 1);
  if (!current || !next) return 0;
  const height = Math.max(1, highRow - lowRow + 1);
  return round(Math.abs(next.closeRow - current.closeRow) / height);
}

function rawStructure(
  profile: TpoSessionProfile,
  type: TpoStructureType,
  side: TpoZoneSide,
  lowRow: number,
  highRow: number,
  config: TpoEngineConfig,
  options: {
    minimumRows?: number;
    direction?: -1 | 0 | 1;
    edgeSharpness?: number;
    departureImpulse?: number;
    extraReasons?: string[];
  } = {},
): RawStructure {
  const band = priceBand(lowRow, highRow, config.rowSize);
  const volume = averageVolume(profile, lowRow, highRow);
  const volumeConfirmation = profile.meanRowVolume > 0 && volume <= profile.meanRowVolume * config.volumeLvnRatio;
  const rows = profile.rows.filter((row) => row.row >= lowRow && row.row <= highRow);
  return {
    type,
    side,
    low: band.low,
    high: band.high,
    formationSession: profile.date,
    formationStart: new Date(profile.start).toISOString(),
    formationEnd: new Date(profile.end).toISOString(),
    contract: profile.contract,
    tpoCount: Math.max(0, ...rows.map((row) => row.tpoCount)),
    volumeConfirmation,
    lvnValue: volumeConfirmation ? round(volume) : null,
    confluenceReasons: unique([TPO_STRUCTURE_LABELS[type], ...(options.extraReasons ?? [])]),
    direction: options.direction ?? 0,
    edgeSharpness: round(options.edgeSharpness ?? 0),
    departureImpulse: round(options.departureImpulse ?? departureImpulse(profile, lowRow, highRow)),
    heightRows: highRow - lowRow + 1,
    minimumRows: options.minimumRows ?? 1,
    repeated: false,
  };
}

export function detectTpoStructures(
  profile: TpoSessionProfile,
  priorProfile: TpoSessionProfile | null,
  requestedConfig: Partial<TpoEngineConfig> = {},
) {
  const config = { ...DEFAULT_TPO_ENGINE_CONFIG, ...requestedConfig };
  if (profile.excluded || !profile.rows.length) return [] as RawStructure[];
  const structures: RawStructure[] = [];
  const singles = contiguousRuns(profile.rows.filter((row) => row.tpoCount === 1).map((row) => row.row));
  singles.forEach((run) => {
    const height = run.highRow - run.lowRow + 1;
    if (run.highRow === profile.highRow && height >= config.tailMinimumRows) {
      structures.push(rawStructure(profile, "SELL_TAIL", "RESISTANCE", run.lowRow, run.highRow, config, {
        minimumRows: config.tailMinimumRows,
        direction: -1,
      }));
      return;
    }
    if (run.lowRow === profile.lowRow && height >= config.tailMinimumRows) {
      structures.push(rawStructure(profile, "BUY_TAIL", "SUPPORT", run.lowRow, run.highRow, config, {
        minimumRows: config.tailMinimumRows,
        direction: 1,
      }));
      return;
    }
    const band = priceBand(run.lowRow, run.highRow, config.rowSize);
    const sessionLow = profile.lowRow * config.rowSize;
    const sessionHigh = profile.highRow * config.rowSize;
    const strictlyInterior = band.high < sessionHigh - config.rowSize / 2
      && band.low > sessionLow + config.rowSize / 2;
    if (strictlyInterior && height >= config.singlePrintMinimumRows) {
      const direction = structureDirection(profile, run.rows);
      structures.push(rawStructure(
        profile,
        "SINGLE_PRINT",
        direction > 0 ? "SUPPORT" : direction < 0 ? "RESISTANCE" : "NEUTRAL",
        run.lowRow,
        run.highRow,
        config,
        { minimumRows: config.singlePrintMinimumRows, direction },
      ));
    }
  });

  (["highRow", "lowRow"] as const).forEach((key) => {
    const side: TpoZoneSide = key === "highRow" ? "RESISTANCE" : "SUPPORT";
    const values = profile.brackets.map((bracket) => bracket[key]).sort((a, b) => a - b);
    const used = new Set<number>();
    values.forEach((centre) => {
      if (used.has(centre)) return;
      const matches = values.filter((value) => Math.abs(value - centre) <= config.ledgeToleranceRows);
      if (matches.length < config.ledgeMinimumBrackets) return;
      matches.forEach((value) => used.add(value));
      structures.push(rawStructure(
        profile,
        "LEDGE",
        side,
        Math.min(...matches),
        Math.max(...matches),
        config,
        { extraReasons: [`${matches.length} bracket ${key === "highRow" ? "highs" : "lows"}`] },
      ));
    });
  });

  if (priorProfile && !priorProfile.excluded) {
    const failedAuction = (
      direction: "HIGH" | "LOW",
      priorEdge: number,
      currentEdge: number,
    ) => {
      const extensionRows = direction === "HIGH"
        ? currentEdge - priorEdge
        : priorEdge - currentEdge;
      if (extensionRows < config.failedAuctionMinimumRows) return;
      const outsideRows = profile.rows.filter((row) => direction === "HIGH" ? row.row > priorEdge : row.row < priorEdge);
      if (!outsideRows.length || Math.max(...outsideRows.map((row) => row.tpoCount)) > config.failedAuctionMaximumTpo) return;
      const extensionBracket = profile.brackets.find((bracket) => direction === "HIGH"
        ? bracket.highRow > priorEdge
        : bracket.lowRow < priorEdge);
      if (!extensionBracket) return;
      const returnedQuickly = profile.brackets.some((bracket) =>
        bracket.index >= extensionBracket.index
        && bracket.index <= extensionBracket.index + 1
        && (direction === "HIGH" ? bracket.lowRow <= priorEdge : bracket.highRow >= priorEdge));
      if (!returnedQuickly) return;
      structures.push(rawStructure(
        profile,
        "FAILED_AUCTION",
        direction === "HIGH" ? "RESISTANCE" : "SUPPORT",
        direction === "HIGH" ? priorEdge + 1 : currentEdge,
        direction === "HIGH" ? currentEdge : priorEdge - 1,
        config,
        { extraReasons: ["Thin extension returned in one bracket"] },
      ));
    };
    failedAuction("HIGH", priorProfile.highRow, profile.highRow);
    failedAuction("LOW", priorProfile.lowRow, profile.lowRow);
  }

  const smoothed = smoothCounts(profile, config.edgeSmoothingRows);
  const requiredBase = profile.maxTpoCount * config.acceptedBaseRatio;
  const edgeCandidates: RawStructure[] = [];
  for (let index = 0; index < smoothed.length; index += 1) {
    const base = smoothed[index];
    if (base.value < requiredBase) continue;
    for (let distance = 1; distance <= config.edgeMaximumWidthRows; distance += 1) {
      const upper = smoothed[index + distance];
      if (upper && upper.value <= base.value * config.edgeDropRatio) {
        edgeCandidates.push(rawStructure(profile, "PROFILE_EDGE", "RESISTANCE", base.row + 1, upper.row, config, {
          edgeSharpness: (base.value - upper.value) / Math.max(base.value, 1e-9),
          extraReasons: ["Smoothed TPO acceptance cliff"],
        }));
        break;
      }
    }
    for (let distance = 1; distance <= config.edgeMaximumWidthRows; distance += 1) {
      const lower = smoothed[index - distance];
      if (lower && lower.value <= base.value * config.edgeDropRatio) {
        edgeCandidates.push(rawStructure(profile, "PROFILE_EDGE", "SUPPORT", lower.row, base.row - 1, config, {
          edgeSharpness: (base.value - lower.value) / Math.max(base.value, 1e-9),
          extraReasons: ["Smoothed TPO acceptance cliff"],
        }));
        break;
      }
    }
  }
  const distinctEdges = edgeCandidates
    .sort((left, right) => right.edgeSharpness - left.edgeSharpness || left.low - right.low)
    .filter((candidate, index, all) => !all.slice(0, index).some((kept) =>
      kept.side === candidate.side && candidate.low <= kept.high && candidate.high >= kept.low));
  structures.push(...distinctEdges);

  const seamRows: number[] = [];
  for (let index = 1; index < smoothed.length - 1; index += 1) {
    const trough = smoothed[index];
    if (trough.value > smoothed[index - 1].value || trough.value > smoothed[index + 1].value) continue;
    const leftPeak = Math.max(...smoothed.slice(0, index).map((value) => value.value));
    const rightPeak = Math.max(...smoothed.slice(index + 1).map((value) => value.value));
    if (leftPeak < requiredBase || rightPeak < requiredBase) continue;
    if (trough.value <= leftPeak * config.seamTroughRatio && trough.value <= rightPeak * config.seamTroughRatio) {
      seamRows.push(trough.row);
    }
  }
  contiguousRuns(seamRows).forEach((run) => {
    structures.push(rawStructure(profile, "LOW_TIME_SEAM", "NEUTRAL", run.lowRow, run.highRow, config, {
      edgeSharpness: 1,
      extraReasons: ["Low-time boundary between accepted distributions"],
    }));
  });
  return structures.sort((left, right) => left.low - right.low || left.type.localeCompare(right.type));
}

/**
 * Intrinsic formation score. The six weights are intentionally fixed:
 * virgin 25, height 20, departure 15, edge 15, TPO/volume agreement 10,
 * repeated structure 15. Volume agreement is only a capped data-quality bonus;
 * it is never described as an independent source of confluence.
 */
export function scoreTpoFormation(structure: RawStructure) {
  const virgin = 25;
  const height = 20 * clamp(structure.heightRows / Math.max(1, structure.minimumRows * 2), 0.5, 1);
  const departure = 15 * clamp(structure.departureImpulse / 3);
  const edge = 15 * clamp(structure.edgeSharpness);
  const volumeAgreement = structure.volumeConfirmation ? 10 : 0;
  const repeated = structure.repeated ? 15 : 0;
  return Math.round(clamp(virgin + height + departure + edge + volumeAgreement + repeated, 0, 100));
}

function stableZoneId(zone: Pick<RawStructure, "formationSession" | "type" | "low" | "high">) {
  return `tpo-${zone.formationSession}-${zone.type.toLowerCase().replaceAll("_", "-")}-${zone.low}-${zone.high}`
    .replace(/[^a-z0-9.-]+/gi, "-");
}

export function mergeTpoStructures(
  input: RawStructure[],
  existingLevels: TpoAutomaticLevel[] = [],
) {
  const ordered = input.slice().sort((left, right) =>
    left.low - right.low || left.high - right.high || left.formationSession.localeCompare(right.formationSession));
  const merged: RawStructure[] = [];
  ordered.forEach((structure) => {
    const current = merged.at(-1);
    if (!current || structure.low > current.high) {
      merged.push({ ...structure, confluenceReasons: [...structure.confluenceReasons] });
      return;
    }
    const primary = structure.heightRows > current.heightRows ? structure : current;
    Object.assign(current, {
      type: primary.type,
      side: current.side === structure.side ? current.side : "NEUTRAL",
      low: Math.min(current.low, structure.low),
      high: Math.max(current.high, structure.high),
      formationSession: current.formationSession < structure.formationSession
        ? current.formationSession
        : structure.formationSession,
      formationStart: current.formationStart < structure.formationStart
        ? current.formationStart
        : structure.formationStart,
      formationEnd: current.formationEnd > structure.formationEnd
        ? current.formationEnd
        : structure.formationEnd,
      tpoCount: Math.max(current.tpoCount, structure.tpoCount),
      volumeConfirmation: current.volumeConfirmation || structure.volumeConfirmation,
      lvnValue: current.lvnValue ?? structure.lvnValue,
      confluenceReasons: unique([...current.confluenceReasons, ...structure.confluenceReasons]),
      direction: primary.direction,
      edgeSharpness: Math.max(current.edgeSharpness, structure.edgeSharpness),
      departureImpulse: Math.max(current.departureImpulse, structure.departureImpulse),
      heightRows: Math.max(current.heightRows, structure.heightRows),
      minimumRows: Math.min(current.minimumRows, structure.minimumRows),
      repeated: current.repeated || structure.repeated,
    });
  });

  return merged.map((structure): TpoZone => {
    const overlappingLevels = existingLevels.filter((level) =>
      Number.isFinite(level.price)
      && level.price >= structure.low - (level.tolerance ?? 0)
      && level.price <= structure.high + (level.tolerance ?? 0));
    const reasons = unique([
      ...structure.confluenceReasons,
      ...overlappingLevels.map((level) => `Automatic level: ${level.label}`),
    ]);
    const confluenceBoost = Math.min(15, Math.max(0, reasons.length - structure.confluenceReasons.length) * 5);
    const strength = Math.min(100, scoreTpoFormation(structure) + confluenceBoost);
    return {
      id: stableZoneId(structure),
      type: structure.type,
      label: TPO_STRUCTURE_LABELS[structure.type],
      side: structure.side,
      low: round(structure.low),
      high: round(structure.high),
      formationSession: structure.formationSession,
      formationStart: structure.formationStart,
      formationEnd: structure.formationEnd,
      contract: structure.contract,
      tpoCount: structure.tpoCount,
      volumeConfirmation: structure.volumeConfirmation,
      lvnValue: structure.lvnValue,
      confluenceReasons: reasons,
      strength,
      currentPriority: strength,
      touches: 0,
      fillPercent: 0,
      state: "VIRGIN",
      active: true,
      displayed: false,
      ageSessions: 0,
      direction: structure.direction,
      edgeSharpness: structure.edgeSharpness,
      departureImpulse: structure.departureImpulse,
    };
  });
}

function rowsTradedThrough(zone: TpoZone, sessions: TpoSessionInput[], rowSize: number) {
  const firstRow = Math.ceil(zone.low / rowSize);
  const lastRow = Math.floor(zone.high / rowSize);
  const total = Math.max(1, lastRow - firstRow + 1);
  const traded = new Set<number>();
  sessions.forEach((session) => session.trades.forEach((trade) => {
    if (trade.timestamp <= Date.parse(zone.formationEnd)) return;
    const row = Math.round(trade.price / rowSize);
    if (row >= firstRow && row <= lastRow) traded.add(row);
  }));
  return Math.min(100, Math.round((traded.size / total) * 100));
}

function lifecycleForZone(
  original: TpoZone,
  sessions: TpoSessionInput[],
  profiles: TpoSessionProfile[],
  currentPrice: number | null,
  config: TpoEngineConfig,
) {
  const zone = { ...original };
  const laterSessions = sessions
    .filter((session) => session.date > zone.formationSession)
    .sort((left, right) => left.start - right.start);
  zone.ageSessions = laterSessions.length;
  const touchedSessions = laterSessions.filter((session) => session.trades.some((trade) =>
    trade.timestamp >= session.start && trade.timestamp < session.end
    && trade.price >= zone.low && trade.price <= zone.high));
  zone.touches = touchedSessions.length;
  const fillTracked = zone.confluenceReasons.some((reason) =>
    reason === TPO_STRUCTURE_LABELS.SINGLE_PRINT
    || reason === TPO_STRUCTURE_LABELS.SELL_TAIL
    || reason === TPO_STRUCTURE_LABELS.BUY_TAIL);
  zone.fillPercent = fillTracked ? rowsTradedThrough(zone, laterSessions, config.rowSize) : 0;

  let broken = false;
  let flipped = false;
  for (const session of laterSessions) {
    const profile = profiles.find((candidate) => candidate.date === session.date);
    if (!profile || profile.excluded) continue;
    const beyond = profile.brackets.filter((bracket) => {
      if (zone.side === "RESISTANCE") return bracket.lowRow * config.rowSize > zone.high;
      if (zone.side === "SUPPORT") return bracket.highRow * config.rowSize < zone.low;
      return false;
    });
    if (beyond.length >= config.acceptanceBrackets) broken = true;
    if (broken) {
      const rejectionFromOtherSide = profile.brackets.some((bracket) => {
        if (zone.side === "RESISTANCE") {
          return bracket.lowRow * config.rowSize <= zone.high && bracket.closeRow * config.rowSize > zone.high;
        }
        if (zone.side === "SUPPORT") {
          return bracket.highRow * config.rowSize >= zone.low && bracket.closeRow * config.rowSize < zone.low;
        }
        return false;
      });
      if (rejectionFromOtherSide) flipped = true;
    }
  }

  if (fillTracked && zone.fillPercent >= 100) {
    zone.state = "ACCEPTED";
    zone.active = false;
  } else if (flipped) {
    zone.state = "FLIPPED";
    zone.side = zone.side === "SUPPORT" ? "RESISTANCE" : zone.side === "RESISTANCE" ? "SUPPORT" : "NEUTRAL";
  } else if (broken) {
    zone.state = "BROKEN";
  } else if (fillTracked && zone.fillPercent >= config.partialFillRatio * 100) {
    zone.state = "PARTIALLY_FILLED";
  } else if (touchedSessions.length) {
    const latest = touchedSessions.at(-1);
    const lastPrice = latest?.trades.filter((trade) => trade.timestamp < latest.end).at(-1)?.price ?? null;
    const rejected = lastPrice !== null && (
      zone.side === "RESISTANCE" ? lastPrice < zone.low
        : zone.side === "SUPPORT" ? lastPrice > zone.high
          : Math.abs(lastPrice - (zone.low + zone.high) / 2) > (zone.high - zone.low)
    );
    zone.state = rejected ? "HOLDING" : "TESTED";
  }

  const effectiveStrength = zone.strength * (0.92 ** zone.ageSessions);
  if (zone.ageSessions > config.expireAfterSessions || effectiveStrength < config.expireStrength) {
    zone.state = "EXPIRED";
    zone.active = false;
  }
  const centre = (zone.low + zone.high) / 2;
  const distanceRows = currentPrice === null ? 0 : Math.abs(currentPrice - centre) / config.rowSize;
  const distanceFactor = 1 / (1 + distanceRows / 100);
  zone.currentPriority = round(effectiveStrength * (0.8 ** zone.touches) * distanceFactor, 3);
  return zone;
}

export function updateTpoZoneLifecycle(
  zone: TpoZone,
  sessions: TpoSessionInput[],
  currentPrice: number | null,
  requestedConfig: Partial<TpoEngineConfig> = {},
) {
  const config = { ...DEFAULT_TPO_ENGINE_CONFIG, ...requestedConfig };
  const ordered = sessions.slice().sort((left, right) => left.start - right.start);
  const profiles = ordered.map((session) => buildTpoSessionProfile(session, config));
  return lifecycleForZone(zone, ordered, profiles, currentPrice, config);
}

export function applyTpoDisplayCap(
  zones: TpoZone[],
  currentPrice: number | null,
  eachSide = DEFAULT_TPO_ENGINE_CONFIG.displayEachSide,
) {
  const price = currentPrice ?? zones.reduce((sum, zone) => sum + (zone.low + zone.high) / 2, 0) / Math.max(1, zones.length);
  const active = zones.filter((zone) => zone.active);
  const above = active.filter((zone) => zone.low > price)
    .sort((left, right) => right.currentPriority - left.currentPriority || left.low - right.low)
    .slice();
  const below = active.filter((zone) => zone.high < price)
    .sort((left, right) => right.currentPriority - left.currentPriority || right.high - left.high)
    .slice();
  const crossing = active.filter((zone) => zone.low <= price && zone.high >= price)
    .sort((left, right) => right.currentPriority - left.currentPriority);

  // A zone containing the market still consumes one of the six display slots.
  // Assign it to the side containing most of its band so the contract remains
  // a strict 3-above / 3-below maximum rather than silently drawing a seventh.
  crossing.forEach((zone) => {
    const centre = (zone.low + zone.high) / 2;
    (centre >= price ? above : below).push(zone);
  });
  const displayed = new Set([
    ...above.sort((left, right) => right.currentPriority - left.currentPriority || left.low - right.low).slice(0, eachSide),
    ...below.sort((left, right) => right.currentPriority - left.currentPriority || right.high - left.high).slice(0, eachSide),
  ].map((zone) => zone.id));
  return zones.map((zone) => ({ ...zone, displayed: displayed.has(zone.id) }));
}

function strengthBand(strength: number): TpoReplayRecord["strengthBand"] {
  if (strength >= 80) return "80-100";
  if (strength >= 60) return "60-79";
  if (strength >= 40) return "40-59";
  return "0-39";
}

export function runTpoReplay(zones: TpoZone[], sessions: TpoSessionInput[], config: TpoEngineConfig): TpoReplaySummary {
  const records = zones.map((zone): TpoReplayRecord => {
    const subsequent = sessions.filter((session) => session.date > zone.formationSession).sort((a, b) => a.start - b.start);
    let firstTouchAt: number | null = null;
    let outcome: TpoReplayRecord["outcome"] = "PENDING";
    for (const session of subsequent) {
      const ordered = session.trades.filter((trade) => trade.timestamp >= session.start && trade.timestamp < session.end)
        .sort((a, b) => a.timestamp - b.timestamp);
      const touch = ordered.find((trade) => trade.price >= zone.low && trade.price <= zone.high);
      if (!touch) continue;
      firstTouchAt ??= touch.timestamp;
      const bracketBeyond = new Set<number>();
      ordered.filter((trade) => trade.timestamp >= touch.timestamp).forEach((trade) => {
        const bracket = tpoBracketIndex(trade.timestamp, session.start, session.end);
        if (bracket < 0) return;
        if (zone.side === "RESISTANCE" && trade.price > zone.high) bracketBeyond.add(bracket);
        if (zone.side === "SUPPORT" && trade.price < zone.low) bracketBeyond.add(bracket);
      });
      if (bracketBeyond.size >= config.acceptanceBrackets) {
        outcome = "ACCEPTED_BREAK";
      } else {
        const last = ordered.at(-1)?.price ?? touch.price;
        const rejected = zone.side === "RESISTANCE" ? last < zone.low
          : zone.side === "SUPPORT" ? last > zone.high
            : Math.abs(last - (zone.low + zone.high) / 2) > zone.high - zone.low;
        if (rejected) outcome = "REJECTION";
      }
      if (outcome !== "PENDING") break;
    }
    return {
      zoneId: zone.id,
      structureType: zone.type,
      strengthBand: strengthBand(zone.strength),
      firstTouchAt: firstTouchAt === null ? null : new Date(firstTouchAt).toISOString(),
      outcome,
    };
  });
  const accumulate = (key: string, target: Record<string, { rejection: number; acceptedBreak: number; pending: number }>, outcome: TpoReplayRecord["outcome"]) => {
    const bucket = target[key] ?? { rejection: 0, acceptedBreak: 0, pending: 0 };
    if (outcome === "REJECTION") bucket.rejection += 1;
    else if (outcome === "ACCEPTED_BREAK") bucket.acceptedBreak += 1;
    else bucket.pending += 1;
    target[key] = bucket;
  };
  const byStructure: TpoReplaySummary["byStructure"] = {};
  const byStrengthBand: TpoReplaySummary["byStrengthBand"] = {};
  records.forEach((record) => {
    accumulate(record.structureType, byStructure, record.outcome);
    accumulate(record.strengthBand, byStrengthBand, record.outcome);
  });
  return {
    calibrated: records.some((record) => record.outcome !== "PENDING"),
    records,
    byStructure,
    byStrengthBand,
  };
}

export function computeTpoLevels(
  inputSessions: TpoSessionInput[],
  options: {
    currentPrice?: number | null;
    existingLevels?: TpoAutomaticLevel[];
    config?: Partial<TpoEngineConfig>;
  } = {},
) {
  const config = { ...DEFAULT_TPO_ENGINE_CONFIG, ...(options.config ?? {}) };
  const sessions = inputSessions.slice().sort((left, right) => left.start - right.start).slice(-config.historySessions);
  const profiles = sessions.map((session) => buildTpoSessionProfile(session, config));
  const validProfiles = profiles.filter((profile) => !profile.excluded);
  const detectionProfiles = validProfiles.slice(-config.detectionSessions);
  const raw: RawStructure[] = [];
  detectionProfiles.forEach((profile) => {
    const profileIndex = validProfiles.findIndex((candidate) => candidate.date === profile.date);
    const prior = profileIndex > 0 ? validProfiles[profileIndex - 1] : null;
    const detected = detectTpoStructures(profile, prior, config);
    detected.forEach((structure) => {
      structure.repeated = validProfiles.slice(0, profileIndex).some((older) => {
        const olderPriorIndex = validProfiles.findIndex((candidate) => candidate.date === older.date);
        const olderStructures = detectTpoStructures(
          older,
          olderPriorIndex > 0 ? validProfiles[olderPriorIndex - 1] : null,
          config,
        );
        return olderStructures.some((candidate) =>
          candidate.type === structure.type
          && candidate.low <= structure.high
          && candidate.high >= structure.low);
      });
      if (structure.repeated) structure.confluenceReasons.push("Repeated structure across sessions");
      raw.push(structure);
    });
  });
  const currentPrice = Number.isFinite(options.currentPrice)
    ? Number(options.currentPrice)
    : sessions.at(-1)?.trades.at(-1)?.price ?? null;
  const merged = mergeTpoStructures(raw, options.existingLevels ?? []);
  const lifecycle = merged.map((zone) => lifecycleForZone(zone, sessions, profiles, currentPrice, config));
  const zones = applyTpoDisplayCap(lifecycle, currentPrice, config.displayEachSide);
  return {
    zones,
    profiles,
    replay: runTpoReplay(zones, sessions, config),
    currentPrice,
    sourceSessions: validProfiles.map((profile) => profile.date),
    excludedSessions: profiles.filter((profile) => profile.excluded).map((profile) => ({
      date: profile.date,
      reason: profile.excludedReason ?? "Excluded by data-quality rules.",
    })),
  };
}

export type NqInstrumentDefinition = {
  instrumentId: number | string;
  rawSymbol: string;
  expiration: number;
  activation?: number | null;
  instrumentClass?: string | null;
};

export function isNqOutrightDefinition(definition: NqInstrumentDefinition) {
  const symbol = definition.rawSymbol.trim().toUpperCase();
  const instrumentClass = String(definition.instrumentClass ?? "").toUpperCase();
  return /^NQ[HMUZ]\d{1,2}$/.test(symbol)
    && !symbol.includes("-")
    && !["S", "SPREAD", "CALENDAR_SPREAD"].includes(instrumentClass);
}

export function resolveFrontMonthDefinition(
  definitions: NqInstrumentDefinition[],
  sessionEnd: number,
  rollLeadDays = 8,
) {
  const minimumExpiry = sessionEnd + rollLeadDays * 86_400_000;
  const candidates = definitions.filter((definition) =>
    isNqOutrightDefinition(definition)
    && definition.expiration > sessionEnd
    && (definition.activation == null || definition.activation <= sessionEnd));
  return candidates
    .filter((definition) => definition.expiration >= minimumExpiry)
    .sort((left, right) => left.expiration - right.expiration || left.rawSymbol.localeCompare(right.rawSymbol))[0]
    ?? candidates.sort((left, right) => left.expiration - right.expiration || left.rawSymbol.localeCompare(right.rawSymbol))[0]
    ?? null;
}
