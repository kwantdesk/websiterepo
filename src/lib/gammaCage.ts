import type { ExposureSummary } from "@/lib/optionsFlow";

export const GAMMA_CAGE_SIGN_CONVENTION = "callExposure >= 0, putExposure <= 0, net = call + put; positive net is dealer long gamma and negative net is dealer short gamma.";

export type GammaCageRegime = "POSITIVE" | "NEGATIVE" | "UNKNOWN";
export type GammaCageExpiryScope = "NEAR_TERM_7D" | "FULL_CHAIN" | "ZERO_DTE";

export type GammaCageObject = {
  strike: number;
  net: number;
  dominantExpiry: string | null;
};

export type GammaCageDerivation = {
  callWall: number | null;
  putWall: number | null;
  gammaHvl: number | null;
  gammaMagnet: number | null;
  gammaAccelerator: number | null;
  gammaCenter: number | null;
  majorPositiveOi: GammaCageObject | null;
  gammaFlip: number | null;
  gammaCrossings: number[];
  flipNote: string | null;
  regime: GammaCageRegime;
  expiryScope: GammaCageExpiryScope;
  dominantExpiry: Record<string, string | null>;
  signConvention: typeof GAMMA_CAGE_SIGN_CONVENTION;
};

const EMPTY = (expiryScope: GammaCageExpiryScope): GammaCageDerivation => ({
  callWall: null,
  putWall: null,
  gammaHvl: null,
  gammaMagnet: null,
  gammaAccelerator: null,
  gammaCenter: null,
  majorPositiveOi: null,
  gammaFlip: null,
  gammaCrossings: [],
  flipNote: "no flip exists in this surface",
  regime: "UNKNOWN",
  expiryScope,
  dominantExpiry: {},
  signConvention: GAMMA_CAGE_SIGN_CONVENTION,
});

function dominantExpiryAt(exposure: ExposureSummary, strike: number | null) {
  if (strike === null) return null;
  const rows = exposure.expiryStrikes?.filter((row) => row.strike === strike) ?? [];
  if (!rows.length) return null;
  return rows.reduce((best, row) => Math.abs(row.net) > Math.abs(best.net) ? row : best).expiration;
}

function cumulativeCrossings(exposure: ExposureSummary) {
  const rows = [...exposure.strikes]
    .filter((row) => Number.isFinite(row.strike) && Number.isFinite(row.net))
    .sort((left, right) => left.strike - right.strike);
  if (!rows.length) return [];
  const crossings: number[] = [];
  let previousStrike = rows[0].strike;
  let previousCumulative = rows[0].net;
  if (previousCumulative === 0) crossings.push(previousStrike);
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const cumulative = previousCumulative + row.net;
    if (cumulative === 0) crossings.push(row.strike);
    else if (previousCumulative !== 0 && Math.sign(previousCumulative) !== Math.sign(cumulative)) {
      const distance = row.strike - previousStrike;
      const weight = Math.abs(previousCumulative) / (Math.abs(previousCumulative) + Math.abs(cumulative));
      crossings.push(previousStrike + distance * weight);
    }
    previousStrike = row.strike;
    previousCumulative = cumulative;
  }
  return [...new Set(crossings.map((value) => Number(value.toFixed(6))))];
}

function regimeAtSpot(exposure: ExposureSummary, spot: number | null): GammaCageRegime {
  if (spot === null || !Number.isFinite(spot)) return "UNKNOWN";
  const cumulative = exposure.strikes
    .filter((row) => row.strike <= spot)
    .reduce((sum, row) => sum + row.net, 0);
  if (!Number.isFinite(cumulative) || cumulative === 0) return "UNKNOWN";
  return cumulative > 0 ? "POSITIVE" : "NEGATIVE";
}

/** The single sign-aware derivation used by chart Gamma levels and Gameplan. */
export function deriveGammaCage(
  exposure: ExposureSummary | null,
  spot: number | null,
  expiryScope: GammaCageExpiryScope = "NEAR_TERM_7D",
): GammaCageDerivation {
  if (!exposure?.strikes.length) return EMPTY(expiryScope);
  const ordered = [...exposure.strikes].sort((left, right) => left.strike - right.strike);
  const relevant = spot === null
    ? ordered
    : ordered.filter((row) => row.strike >= spot * 0.97 && row.strike <= spot * 1.03);

  const callRows = relevant.filter((row) => row.call > 0);
  const putRows = relevant.filter((row) => row.put < 0);
  const callWall = callRows.length ? callRows.reduce((best, row) => row.call > best.call ? row : best).strike : null;
  const putWall = putRows.length ? putRows.reduce((best, row) => Math.abs(row.put) > Math.abs(best.put) ? row : best).strike : null;
  const positive = relevant.filter((row) => row.net > 0);
  const negative = relevant.filter((row) => row.net < 0);
  const magnetRow = positive.length ? positive.reduce((best, row) => row.net > best.net ? row : best) : null;
  const acceleratorRow = negative.length ? negative.reduce((best, row) => row.net < best.net ? row : best) : null;

  const smoothed = ordered.map((row, index) => {
    const from = Math.max(0, index - 1);
    const to = Math.min(ordered.length - 1, index + 1);
    const net = ordered.slice(from, to + 1).reduce((sum, item) => sum + item.net, 0) / (to - from + 1);
    return { strike: row.strike, net };
  });
  const slopes = smoothed.slice(1, -1).map((row, index) => {
    const left = smoothed[index];
    const right = smoothed[index + 2];
    return { strike: row.strike, slope: (right.net - left.net) / Math.max(right.strike - left.strike, 1e-9) };
  });
  const hvlRows = slopes
    .filter((row) => spot === null || Math.abs(row.strike - spot) / spot <= 0.03)
    .sort((left, right) => Math.abs(right.slope) - Math.abs(left.slope)
      || (spot === null ? left.strike - right.strike : Math.abs(left.strike - spot) - Math.abs(right.strike - spot)));
  const gammaHvl = Math.abs(hvlRows[0]?.slope ?? 0) > 0 ? hvlRows[0].strike : null;
  const totalWeight = relevant.reduce((sum, row) => sum + Math.abs(row.net), 0);
  const gammaCenter = totalWeight > 0
    ? relevant.reduce((sum, row) => sum + row.strike * Math.abs(row.net), 0) / totalWeight
    : null;
  const majorPositive = ordered.filter((row) => row.net > 0);
  const majorPositiveRow = majorPositive.length
    ? majorPositive.reduce((best, row) => row.net > best.net ? row : best)
    : null;
  const gammaCrossings = cumulativeCrossings(exposure);
  const gammaFlip = gammaCrossings.length
    ? gammaCrossings.reduce((best, value) => spot === null || Math.abs(value - spot) < Math.abs(best - spot) ? value : best)
    : null;
  const dominantExpiry: Record<string, string | null> = {
    callWall: dominantExpiryAt(exposure, callWall),
    putWall: dominantExpiryAt(exposure, putWall),
    gammaHvl: dominantExpiryAt(exposure, gammaHvl),
    gammaMagnet: dominantExpiryAt(exposure, magnetRow?.strike ?? null),
    gammaAccelerator: dominantExpiryAt(exposure, acceleratorRow?.strike ?? null),
    gammaFlip: dominantExpiryAt(exposure, gammaFlip),
  };

  return {
    callWall,
    putWall,
    gammaHvl,
    gammaMagnet: magnetRow?.strike ?? null,
    gammaAccelerator: acceleratorRow?.strike ?? null,
    gammaCenter,
    majorPositiveOi: majorPositiveRow ? {
      strike: majorPositiveRow.strike,
      net: majorPositiveRow.net,
      dominantExpiry: dominantExpiryAt(exposure, majorPositiveRow.strike),
    } : null,
    gammaFlip,
    gammaCrossings,
    flipNote: gammaCrossings.length
      ? gammaCrossings.length > 1 ? `${gammaCrossings.length} cumulative gamma crossings; contested book` : null
      : "no flip exists in this surface",
    regime: regimeAtSpot(exposure, spot),
    expiryScope,
    dominantExpiry,
    signConvention: GAMMA_CAGE_SIGN_CONVENTION,
  };
}

export function operationalGammaFlip(nativeZeroGamma: number | null, computedFlip: number | null, tolerance = 0.5) {
  if (nativeZeroGamma === null) return { price: computedFlip, source: computedFlip === null ? "NONE" as const : "COMPUTED" as const };
  return {
    price: nativeZeroGamma,
    source: "NATIVE" as const,
    withinTolerance: computedFlip === null || Math.abs(nativeZeroGamma - computedFlip) <= tolerance,
  };
}

export function gammaCageLabel(
  kind: "CALL_WALL" | "PUT_WALL" | "GAMMA_MAGNET" | "GAMMA_ACCELERATOR" | "ZERO_GAMMA",
  regime: GammaCageRegime,
) {
  if (kind === "GAMMA_ACCELERATOR") return "Accelerator";
  if (kind === "ZERO_GAMMA") return "Flip — cage switch";
  if (kind === "GAMMA_MAGNET") return regime === "NEGATIVE" ? "Magnet — weak glue" : "Magnet — glue, exits only";
  if (kind === "CALL_WALL") return regime === "NEGATIVE" ? "Major call — rail" : "Major call — cage ceiling";
  return regime === "NEGATIVE" ? "Major put — rail" : "Major put — cage floor";
}

export function gammaCageNarrative(kind: string, regime: GammaCageRegime) {
  if (kind === "GAMMA_ACCELERATOR") return {
    visit: "Do not fade this strike. Dealer-short-gamma hedging can chase price through it.",
    hold: "Acceptance beyond the accelerator keeps pro-cyclical hedge pressure active.",
    break: "A failed acceleration only matters after price reclaims the strike and holds back inside the prior range.",
  };
  if (regime === "NEGATIVE") return {
    visit: "Treat this strike as a rail, not a cage wall; test for continuation rather than an automatic fade.",
    hold: "Acceptance along the rail keeps dealer hedging aligned with the move toward the next strike.",
    break: "A reclaim back across the rail weakens the momentum path and can rotate price toward the flip.",
  };
  return {
    visit: "Treat the first visit as a cage-edge test and confirm that counter-move hedging is defending it.",
    hold: "A clean defence preserves the cage and favours rotation back toward the magnet.",
    break: "Acceptance beyond the cage edge invalidates a blind fade and opens the next positioning strike.",
  };
}

export function isGammaCageGameplanLevel(kind: string) {
  return kind !== "EXPECTED_MOVE_MAX" && kind !== "EXPECTED_MOVE_MIN";
}

export function staggerGammaLabels(rows: Array<{ id: string; y: number }>, labelHeight = 16) {
  let priorDisplayY = Number.NEGATIVE_INFINITY;
  return [...rows]
    .sort((left, right) => left.y - right.y || left.id.localeCompare(right.id))
    .map((row) => {
      const displayY = Math.max(row.y, priorDisplayY + labelHeight);
      priorDisplayY = displayY;
      return { ...row, displayY };
    });
}

function calendarDte(sessionDate: string, expiration: string) {
  const start = Date.parse(`${sessionDate}T00:00:00.000Z`);
  const end = Date.parse(`${expiration}T00:00:00.000Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 86_400_000) : null;
}

/** Aggregates the near-term cage without discarding the full structural chain. */
export function filterGammaExposureHorizon(
  exposure: ExposureSummary | null,
  sessionDate: string,
  maxCalendarDte = 7,
): ExposureSummary | null {
  if (!exposure) return null;
  const expiryRows = exposure.expiryStrikes?.filter((row) => {
    const dte = calendarDte(sessionDate, row.expiration);
    return dte !== null && dte >= 0 && dte <= maxCalendarDte;
  }) ?? [];
  if (!expiryRows.length) {
    const allExpiriesInScope = exposure.expiries.length > 0 && exposure.expiries.every((row) => {
      const dte = calendarDte(sessionDate, row.expiration);
      return dte !== null && dte >= 0 && dte <= maxCalendarDte;
    });
    return allExpiriesInScope ? exposure : null;
  }

  const byStrike = new Map<number, { call: number; put: number; net: number }>();
  for (const row of expiryRows) {
    const current = byStrike.get(row.strike) ?? { call: 0, put: 0, net: 0 };
    current.call += row.call;
    current.put += row.put;
    current.net += row.net;
    byStrike.set(row.strike, current);
  }
  const strikes = [...byStrike.entries()]
    .map(([strike, row]) => ({ strike, ...row }))
    .sort((left, right) => left.strike - right.strike);
  const expirationSet = new Set(expiryRows.map((row) => row.expiration));
  return {
    ...exposure,
    net: strikes.reduce((sum, row) => sum + row.net, 0),
    gross: strikes.reduce((sum, row) => sum + Math.abs(row.call) + Math.abs(row.put), 0),
    strikes,
    expiries: exposure.expiries.filter((row) => expirationSet.has(row.expiration)),
    expiryStrikes: expiryRows,
  };
}
