export const HEDGE_LEVELS_SIGN_CONVENTION =
  "callExposure >= 0, putExposure <= 0, net = call + put; positive net means dealers are long gamma and negative net means dealers are short gamma.";

export const HEDGE_LEVEL_ZONE_WIDTHS = {
  MAJOR_CALL: 6,
  MAJOR_PUT: 6,
  MAGNET: 12,
  ACCELERATOR: 6,
  FLIP: 0,
} as const;

export type HedgeLevelKind = keyof typeof HEDGE_LEVEL_ZONE_WIDTHS;
export type HedgeRegime = "POSITIVE" | "NEGATIVE" | "UNKNOWN";
export type HedgeExpiryScope = "NEAR_TERM_7D" | "ALL";

export type HedgeExposureStrike = {
  strike: number;
  call: number;
  put: number;
  net?: number;
  expiration?: string;
};

export type HedgeExposureSurface = {
  strikes: HedgeExposureStrike[];
  expiryStrikes?: HedgeExposureStrike[];
};

export type HedgeSourceLevel = {
  id: string;
  kind: HedgeLevelKind;
  sourcePrice: number;
  call: number;
  put: number;
  net: number;
  dominantExpiry: string | null;
  label: string;
};

export type HedgeSurfaceResult = {
  levels: HedgeSourceLevel[];
  strikeInterval: number;
  regime: HedgeRegime;
  allCrossings: number[];
  flip: number | null;
  flipNote: string | null;
  contested: boolean;
  expiryScope: HedgeExpiryScope;
  signConvention: string;
};

export type HedgeChartLevel = HedgeSourceLevel & {
  price: number;
  zoneLow: number;
  zoneHigh: number;
  signLine: string;
};

export type HedgeLevelsPayload = {
  instrument: "NQ" | "MNQ";
  sourceSymbol: "NDX";
  sessionDate: string;
  marketOpen: boolean;
  levels: HedgeChartLevel[];
  strikeInterval: number;
  regime: HedgeRegime;
  allCrossings: number[];
  flip: number | null;
  flipNote: string | null;
  contested: boolean;
  expiryScope: HedgeExpiryScope;
  signConvention: string;
  calibration: {
    mode: "LIVE_CALIBRATED";
    scale: number;
    sourceSpot: number;
    futuresSpot: number;
  };
  generatedAt: string;
  dataAge: number;
  refreshAfterMs: number;
  stale: boolean;
  frozen: boolean;
  frozenAt: string | null;
};

const finite = (value: number) => Number.isFinite(value);

function normalizedRows(rows: HedgeExposureStrike[]) {
  return rows
    .filter((row) => finite(row.strike) && row.strike > 0 && finite(row.call) && finite(row.put))
    .map((row) => ({ ...row, net: finite(row.net ?? Number.NaN) ? row.net! : row.call + row.put }))
    .sort((left, right) => left.strike - right.strike);
}

function calendarDte(sessionDate: string, expiration: string) {
  const start = Date.parse(`${sessionDate}T00:00:00.000Z`);
  const end = Date.parse(`${expiration}T00:00:00.000Z`);
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.round((end - start) / 86_400_000)
    : null;
}

function aggregateSurface(surface: HedgeExposureSurface, sessionDate: string) {
  const dated = normalizedRows(surface.expiryStrikes ?? []).filter((row) => {
    if (!row.expiration) return false;
    const dte = calendarDte(sessionDate, row.expiration);
    return dte !== null && dte >= 0 && dte <= 7;
  });
  if (!surface.expiryStrikes?.length) {
    return { rows: normalizedRows(surface.strikes), expiryRows: [] as ReturnType<typeof normalizedRows>, scope: "ALL" as const };
  }

  const byStrike = new Map<number, { strike: number; call: number; put: number; net: number }>();
  for (const row of dated) {
    const current = byStrike.get(row.strike) ?? { strike: row.strike, call: 0, put: 0, net: 0 };
    current.call += row.call;
    current.put += row.put;
    current.net = current.call + current.put;
    byStrike.set(row.strike, current);
  }
  return {
    rows: [...byStrike.values()].sort((left, right) => left.strike - right.strike),
    expiryRows: dated,
    scope: "NEAR_TERM_7D" as const,
  };
}

function dominantExpiry(rows: ReturnType<typeof normalizedRows>, strike: number) {
  const matching = rows.filter((row) => row.strike === strike && row.expiration);
  if (!matching.length) return null;
  return matching.reduce((best, row) => (
    Math.abs(row.net) > Math.abs(best.net)
      || (Math.abs(row.net) === Math.abs(best.net) && row.expiration! < best.expiration!)
      ? row
      : best
  )).expiration ?? null;
}

export function hedgeLevelLabel(kind: HedgeLevelKind, regime: HedgeRegime) {
  if (kind === "ACCELERATOR") return "accelerator";
  if (kind === "FLIP") return "cage switch";
  if (kind === "MAGNET") return regime === "NEGATIVE" ? "weak glue" : "glue — exits only";
  if (kind === "MAJOR_CALL") return regime === "NEGATIVE" ? "rail" : "cage ceiling";
  return regime === "NEGATIVE" ? "rail" : "cage floor";
}

function cumulativeState(rows: ReturnType<typeof normalizedRows>, spot: number) {
  let cumulative = 0;
  let previous = 0;
  const crossings: number[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    previous = cumulative;
    cumulative += row.net;
    if (cumulative === 0) {
      crossings.push(row.strike);
    } else if (index > 0 && previous !== 0 && Math.sign(previous) !== Math.sign(cumulative)) {
      crossings.push((rows[index - 1].strike + row.strike) / 2);
    }
  }

  let cumulativeAtSpot = 0;
  for (const row of rows) {
    if (row.strike > spot) break;
    cumulativeAtSpot += row.net;
  }
  const uniqueCrossings = [...new Set(crossings)].sort((left, right) => left - right);
  return {
    regime: cumulativeAtSpot > 0 ? "POSITIVE" as const : cumulativeAtSpot < 0 ? "NEGATIVE" as const : "UNKNOWN" as const,
    crossings: uniqueCrossings,
    flip: uniqueCrossings.length
      ? uniqueCrossings.reduce((best, price) => Math.abs(price - spot) < Math.abs(best - spot) ? price : best)
      : null,
  };
}

/**
 * Standalone five-object hedge-level derivation. This deliberately does not
 * import the Kwant Levels/Gameplan engine, so it cannot inherit its ranking or
 * fallback semantics.
 */
export function deriveHedgeLevels(
  surface: HedgeExposureSurface,
  spot: number,
  sessionDate: string,
): HedgeSurfaceResult {
  const aggregated = aggregateSurface(surface, sessionDate);
  const rows = aggregated.rows;
  const cumulative = cumulativeState(rows, spot);
  const lower = spot * 0.97;
  const upper = spot * 1.03;
  const window = rows.filter((row) => row.strike >= lower && row.strike <= upper);
  const strikeInterval = rows.slice(1).reduce((smallest, row, index) => {
    const distance = row.strike - rows[index].strike;
    return distance > 0 ? Math.min(smallest, distance) : smallest;
  }, Number.POSITIVE_INFINITY);

  const majorCall = window.filter((row) => row.call > 0)
    .sort((left, right) => right.call - left.call || left.strike - right.strike)[0] ?? null;
  const majorPut = window.filter((row) => row.put < 0)
    .sort((left, right) => Math.abs(right.put) - Math.abs(left.put) || left.strike - right.strike)[0] ?? null;
  const magnet = window.filter((row) => row.net > 0)
    .sort((left, right) => right.net - left.net || left.strike - right.strike)[0] ?? null;
  const accelerator = window.filter((row) => row.net < 0)
    .sort((left, right) => left.net - right.net || left.strike - right.strike)[0] ?? null;

  const candidates: Array<{ kind: HedgeLevelKind; row: typeof majorCall } | null> = [
    majorCall ? { kind: "MAJOR_CALL", row: majorCall } : null,
    accelerator ? { kind: "ACCELERATOR", row: accelerator } : null,
    magnet ? { kind: "MAGNET", row: magnet } : null,
    cumulative.flip === null ? null : {
      kind: "FLIP",
      row: { strike: cumulative.flip, call: 0, put: 0, net: 0 },
    },
    majorPut ? { kind: "MAJOR_PUT", row: majorPut } : null,
  ];
  const levels = candidates.filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .map(({ kind, row }) => ({
      id: `hedge-${kind.toLowerCase().replace(/_/g, "-")}`,
      kind,
      sourcePrice: row.strike,
      call: row.call,
      put: row.put,
      net: row.net,
      dominantExpiry: dominantExpiry(aggregated.expiryRows, row.strike),
      label: hedgeLevelLabel(kind, cumulative.regime),
    }));

  return {
    levels,
    strikeInterval: Number.isFinite(strikeInterval) ? strikeInterval : 0,
    regime: cumulative.regime,
    allCrossings: cumulative.crossings,
    flip: cumulative.flip,
    flipNote: cumulative.flip === null ? "no flip in this surface" : null,
    contested: cumulative.crossings.length > 1,
    expiryScope: aggregated.scope,
    signConvention: HEDGE_LEVELS_SIGN_CONVENTION,
  };
}

export function convertHedgeLevels(
  result: HedgeSurfaceResult,
  scale: number,
  tickSize = 0.25,
) {
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const tick = Number.isFinite(tickSize) && tickSize > 0 ? tickSize : 0.25;
  const round = (value: number) => Math.round(value / tick) * tick;
  const levels: HedgeChartLevel[] = result.levels.map((level) => {
    const price = round(level.sourcePrice * scale);
    const width = HEDGE_LEVEL_ZONE_WIDTHS[level.kind];
    return {
      ...level,
      price,
      zoneLow: round(price - width),
      zoneHigh: round(price + width),
      signLine: level.kind === "FLIP"
        ? "cumulative gamma changes sign here"
        : level.net >= 0
          ? "dealers long gamma here — flows oppose price"
          : "dealers short gamma here — flows chase price",
    };
  });
  return {
    levels,
    strikeInterval: round(result.strikeInterval * scale),
    allCrossings: result.allCrossings.map((price) => round(price * scale)),
    flip: result.flip === null ? null : round(result.flip * scale),
  };
}

export function staleHedgeLevelsPayload(payload: HedgeLevelsPayload, now = Date.now()): HedgeLevelsPayload {
  return {
    ...payload,
    stale: true,
    dataAge: Math.max(payload.dataAge, now - Date.parse(payload.generatedAt)),
  };
}

function compactAge(ageMs: number) {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

export function hedgeFreshnessPill(payload: HedgeLevelsPayload, now = Date.now()) {
  if (payload.stale) return `stale ${compactAge(Math.max(payload.dataAge, now - Date.parse(payload.generatedAt)))}`;
  if (payload.frozen) {
    const timestamp = payload.frozenAt ? Date.parse(payload.frozenAt) : Number.NaN;
    const time = Number.isFinite(timestamp)
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(timestamp)
      : "EOD";
    return `frozen ${time} ET`;
  }
  return "live · 60s";
}

export function hedgeLevelMovement(
  previous: HedgeChartLevel[] | null,
  next: HedgeChartLevel[],
  strikeInterval: number,
) {
  const previousById = new Map((previous ?? []).map((level) => [level.id, level]));
  const pulseIds = next.flatMap((level) => {
    const old = previousById.get(level.id);
    return old && Math.abs(old.price - level.price) > strikeInterval ? [level.id] : [];
  });
  return { levels: next, pulseIds };
}

export function staggerHedgeLabels(
  rows: Array<{ id: string; y: number }>,
  labelHeight = 14,
) {
  let previousY = Number.NEGATIVE_INFINITY;
  return [...rows]
    .sort((left, right) => left.y - right.y || left.id.localeCompare(right.id))
    .map((row) => {
      const labelY = Math.max(row.y, previousY + labelHeight);
      previousY = labelY;
      return { ...row, labelY };
    });
}

export function renderableHedgeLevels(enabled: boolean, levels: HedgeChartLevel[]) {
  return enabled ? levels : [];
}
