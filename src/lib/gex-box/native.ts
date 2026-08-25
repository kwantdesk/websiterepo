import type { GexMapFrame, GexMapPanelPayload } from "@/lib/gexMap";
import type { ExposureStrike, OptionsCandle } from "@/lib/optionsFlow";
import type {
  GexBotMajorsFrame,
  GexBotMaxChangeFrame,
  GexBotOrderflowFrame,
  GexBotProfileFrame,
} from "@/lib/gexBotTypes";

export const NATIVE_GEX_BOX_FORMULA_VERSION = "kwantdesk-gex-box-native-v1";

export type NativePricePoint = { timestamp: number; price: number };

type CompleteSurface = {
  timestamp: number;
  sourceSpot: number;
  rows: ExposureStrike[];
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function latestAtOrBefore<T extends { timestamp: number }>(rows: readonly T[], timestamp: number): T | null {
  let selected: T | null = null;
  for (const row of rows) {
    if (row.timestamp > timestamp) break;
    selected = row;
  }
  return selected;
}

function candleCloseAtOrBefore(candles: readonly OptionsCandle[], timestamp: number) {
  return latestAtOrBefore(candles, timestamp)?.close ?? null;
}

function completeSurfaces(panel: GexMapPanelPayload): CompleteSurface[] {
  const frames = [...panel.frames].sort((left, right) => left.timestamp - right.timestamp);
  const candles = [...panel.candles].sort((left, right) => left.timestamp - right.timestamp);
  const byStrike = new Map<number, ExposureStrike>();
  const completed: CompleteSurface[] = [];

  for (const frame of frames) {
    for (const update of frame.updates) byStrike.set(update.strike, { ...update });
    const sourceSpot = candleCloseAtOrBefore(candles, frame.timestamp) ?? panel.stockPrice;
    if (!finite(sourceSpot) || sourceSpot <= 0 || byStrike.size === 0) continue;
    completed.push({
      timestamp: frame.timestamp,
      sourceSpot,
      rows: [...byStrike.values()].sort((left, right) => left.strike - right.strike),
    });
  }

  if (!completed.length && panel.latestStrikes.length) {
    const timestamp = Date.parse(panel.asOf);
    const sourceSpot = panel.stockPrice;
    if (Number.isFinite(timestamp) && finite(sourceSpot) && sourceSpot > 0) {
      completed.push({
        timestamp,
        sourceSpot,
        rows: [...panel.latestStrikes].sort((left, right) => left.strike - right.strike),
      });
    }
  }
  return completed;
}

/**
 * The strike where cumulative dealer Gamma changes sign.
 *
 * A cumulative curve can cross zero several times across a wide strike
 * ladder, and this used to return the first crossing found scanning strikes
 * upward — the lowest one, wherever price happened to be. On a deep ladder
 * that is routinely thousands of points below spot, and the level jumped
 * whenever a far crossing appeared or vanished, which is not a Gamma flip
 * moving but the scan selecting a different crossing.
 *
 * The flip that describes the market is the one price is sitting next to:
 * the boundary between the regime it is in and the opposite one. So collect
 * every crossing and take the one nearest spot. Without a usable spot the
 * old first-crossing answer is kept, so callers that have no price reference
 * behave exactly as before.
 */
/**
 * How much of the chain around spot the flip is looked for in, counted in
 * strikes rather than percent.
 *
 * The listed chain runs far past anything the market trades — on NDX it spans
 * 8,000 to 40,000 against a spot near 29,000 — and those far strikes carry
 * enough notional to drag the balance point thousands of points away from any
 * price that traded. Scoping the scan to the near-money strikes cut the
 * crossing's day range from 19,224 points to 544 over a session where spot
 * moved 264.
 *
 * Counted in strikes because a percentage does not travel between
 * instruments: half a percent is 35 strikes of NDX at ten-point spacing but
 * about six of SPY at a dollar. Forty keeps a real sample of the chain on
 * either shape. Narrower windows track price more and more closely — at eight
 * strikes a side the correlation reaches 0.93 — but that is the level
 * collapsing onto spot and reporting the price back as if it were structure,
 * which is worse than useless. At forty the flip still moves about twice as
 * far as spot, so it stays a level of its own.
 */
const ZERO_GAMMA_STRIKE_SAMPLE = 40;

/**
 * The price at which aggregate dealer Gamma flips sign.
 *
 * Net dealer Gamma at a hypothetical spot S is the exposure resting below S
 * against the exposure above it — the sum over strikes of exposure×sign(S−k),
 * which is 2·cumulative(S) − total. That is zero where the running total
 * reaches HALF the chain's total, not where it reaches zero.
 *
 * Searching for zero, as this did, asks a different question: "above which
 * price is the exposure below it nil". On a chain whose total is one-signed
 * the running sum never returns to zero and there is simply no answer —
 * measured across a full NDX session, 145 of 405 one-minute surfaces (36%)
 * produced no crossing at all, every one of them because cumulative Gamma
 * stayed negative from the bottom strike to the top. Those were the holes in
 * the chart's trail, and they are why the line could not paint alongside
 * price the way the GEX BOX Classic surface does. The half-total crossing
 * always exists, because the running sum starts near zero and ends at the
 * total, so it has to pass halfway.
 *
 * The flip that describes the market is the one price is sitting next to, so
 * where the profile balances more than once the crossing nearest spot wins.
 * Without a usable spot the first crossing is kept, so callers with no price
 * reference behave as they did.
 */
function zeroCrossing(rows: Array<{ strike: number; exposure: number }>, spot?: number | null) {
  const usableSpot = Number.isFinite(spot) && (spot as number) > 0 ? (spot as number) : null;
  const scoped = usableSpot === null
    ? rows
    : [...rows]
      .sort((left, right) => Math.abs(left.strike - usableSpot) - Math.abs(right.strike - usableSpot))
      .slice(0, ZERO_GAMMA_STRIKE_SAMPLE);
  const sorted = [...scoped].sort((left, right) => left.strike - right.strike);
  if (sorted.length < 2) return null;
  let total = 0;
  for (const row of sorted) total += row.exposure;
  const target = total / 2;
  const crossings: number[] = [];
  let cumulative = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const previous = cumulative;
    cumulative += sorted[index].exposure;
    if (index === 0) continue;
    if ((previous < target && cumulative >= target) || (previous > target && cumulative <= target)) {
      const span = cumulative - previous;
      const ratio = span === 0 ? 0.5 : (target - previous) / span;
      crossings.push(sorted[index - 1].strike + (sorted[index].strike - sorted[index - 1].strike) * ratio);
    }
  }
  if (!crossings.length) return null;
  if (usableSpot === null) return crossings[0];
  return crossings.reduce((best, crossing) =>
    Math.abs(crossing - usableSpot) < Math.abs(best - usableSpot) ? crossing : best);
}

function strongest(rows: Array<[number, number]>, direction: "positive" | "negative") {
  const eligible = rows.filter(([, value]) => direction === "positive" ? value > 0 : value < 0);
  if (!eligible.length) return null;
  return eligible.reduce((best, row) => direction === "positive"
    ? row[1] > best[1] ? row : best
    : row[1] < best[1] ? row : best);
}

function mappedPriceAt(
  surface: CompleteSurface,
  displayPrices: readonly NativePricePoint[],
) {
  const point = latestAtOrBefore(displayPrices, surface.timestamp);
  const displaySpot = point?.price ?? surface.sourceSpot;
  const ratio = surface.sourceSpot > 0 && displaySpot > 0 ? displaySpot / surface.sourceSpot : 1;
  return { displaySpot, ratio };
}

/**
 * Convert QuantData's timestamped interval-map updates into the renderer's
 * established profile-frame transport. Open-interest exposure is the complete
 * native surface. Volume exposure is the change from the session's opening
 * surface, so no synthetic provider values are introduced.
 */
export function nativeProfileFrames(
  panel: GexMapPanelPayload,
  ticker: string,
  displayPrices: readonly NativePricePoint[] = [],
): GexBotProfileFrame[] {
  const surfaces = completeSurfaces(panel);
  const opening = new Map(surfaces[0]?.rows.map((row) => [row.strike, row.net]) ?? []);
  const trails = new Map<number, number[]>();

  return surfaces.map((surface) => {
    const { displaySpot, ratio } = mappedPriceAt(surface, displayPrices);
    const volumePairs: Array<[number, number]> = [];
    const oiPairs: Array<[number, number]> = [];
    const strikes = surface.rows.map((row) => {
      const mappedStrike = row.strike * ratio;
      const openingValue = opening.get(row.strike) ?? row.net;
      const volumeExposure = row.net - openingValue;
      const prior = trails.get(row.strike) ?? [];
      const priors = prior.slice(-3).reverse();
      trails.set(row.strike, [...prior.slice(-2), row.net]);
      volumePairs.push([mappedStrike, volumeExposure]);
      oiPairs.push([mappedStrike, row.net]);
      return [mappedStrike, volumeExposure, row.net, priors] as GexBotProfileFrame["strikes"][number];
    });
    const positiveVolume = strongest(volumePairs, "positive");
    const negativeVolume = strongest(volumePairs, "negative");
    const positiveOi = strongest(oiPairs, "positive");
    const negativeOi = strongest(oiPairs, "negative");
    return {
      timestamp: surface.timestamp,
      ticker,
      spot: displaySpot,
      zero_gamma: zeroCrossing(oiPairs.map(([strike, exposure]) => ({ strike, exposure })), displaySpot),
      major_pos_vol: positiveVolume?.[0] ?? null,
      major_pos_oi: positiveOi?.[0] ?? null,
      major_neg_vol: negativeVolume?.[0] ?? null,
      major_neg_oi: negativeOi?.[0] ?? null,
      strikes,
      sum_gex_vol: volumePairs.reduce((sum, [, value]) => sum + value, 0),
      sum_gex_oi: oiPairs.reduce((sum, [, value]) => sum + value, 0),
    };
  });
}

function totalSurface(frame: GexBotProfileFrame | null | undefined) {
  return frame?.strikes.reduce((sum, row) => sum + row[2], 0) ?? 0;
}

function grossSurface(frame: GexBotProfileFrame | null | undefined) {
  return frame?.strikes.reduce((sum, row) => sum + Math.abs(row[2]), 0) ?? 0;
}

function profileAtOrBefore(frames: readonly GexBotProfileFrame[], timestamp: number) {
  return latestAtOrBefore(frames, timestamp);
}

/** Align native Gamma/Delta/Vanna/Charm histories without ever reading ahead. */
export function nativeOrderflowFrames(args: {
  ticker: string;
  gamma: GexBotProfileFrame[];
  delta: GexBotProfileFrame[];
  vanna: GexBotProfileFrame[];
  charm: GexBotProfileFrame[];
}): GexBotOrderflowFrame[] {
  let previous: GexBotOrderflowFrame | null = null;
  return args.gamma.map((gamma) => {
    const delta = profileAtOrBefore(args.delta, gamma.timestamp);
    const vanna = profileAtOrBefore(args.vanna, gamma.timestamp);
    const charm = profileAtOrBefore(args.charm, gamma.timestamp);
    const netGamma = totalSurface(gamma);
    const netDelta = totalSurface(delta);
    const netVanna = totalSurface(vanna);
    const netCharm = totalSurface(charm);
    const convexity = grossSurface(gamma);
    const next: GexBotOrderflowFrame = {
      ...gamma,
      ticker: args.ticker,
      zgr: netGamma,
      ogr: previous?.zgr ?? null,
      zcvr: convexity,
      ocvr: previous?.zcvr ?? null,
      zvanna: -netVanna,
      ovanna: previous?.zvanna ?? null,
      zcharm: netCharm,
      ocharm: previous?.zcharm ?? null,
      agg_dex: netDelta,
      one_agg_dex: previous?.agg_dex ?? null,
      net_dex: netDelta,
      one_net_dex: previous?.net_dex ?? null,
      gexoflow: netGamma - (previous?.zgr ?? netGamma),
      one_gexoflow: previous?.gexoflow ?? null,
      dexoflow: netDelta - (previous?.agg_dex ?? netDelta),
      one_dexoflow: previous?.dexoflow ?? null,
      cvroflow: convexity - (previous?.zcvr ?? convexity),
      one_cvroflow: previous?.cvroflow ?? null,
    };
    previous = next;
    return next;
  });
}

export function nativeMajors(frame: GexBotProfileFrame | null): GexBotMajorsFrame | null {
  if (!frame) return null;
  return {
    timestamp: frame.timestamp,
    ticker: frame.ticker,
    spot: frame.spot,
    zero_gamma: frame.zero_gamma,
    mpos_vol: frame.major_pos_vol,
    mpos_oi: frame.major_pos_oi,
    mneg_vol: frame.major_neg_vol,
    mneg_oi: frame.major_neg_oi,
    net_gex_vol: frame.sum_gex_vol,
    net_gex_oi: frame.sum_gex_oi,
  };
}

function maxChange(frames: readonly GexBotProfileFrame[], windowMinutes: number) {
  const latest = frames.at(-1);
  if (!latest) return null;
  const prior = [...frames].reverse().find((frame) => frame.timestamp <= latest.timestamp - windowMinutes * 60_000);
  if (!prior) return null;
  const priorByStrike = new Map(prior.strikes.map((row) => [row[0], row[2]]));
  let best: [number, number] | null = null;
  for (const row of latest.strikes) {
    const previous = priorByStrike.get(row[0]);
    if (previous === undefined) continue;
    const change = row[2] - previous;
    if (!best || Math.abs(change) > Math.abs(best[1])) best = [row[0], change];
  }
  return best;
}

export function nativeMaxChange(frames: readonly GexBotProfileFrame[]): GexBotMaxChangeFrame | null {
  const latest = frames.at(-1);
  if (!latest) return null;
  return {
    timestamp: latest.timestamp,
    ticker: latest.ticker,
    current: latest.major_pos_oi === null ? null : [latest.major_pos_oi, latest.sum_gex_oi ?? 0],
    one: maxChange(frames, 1),
    five: maxChange(frames, 5),
    ten: maxChange(frames, 10),
    fifteen: maxChange(frames, 15),
    thirty: maxChange(frames, 30),
  };
}

export function nativeGreekForCategory(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("delta") || normalized.includes("dex")) return "DELTA" as const;
  if (normalized.includes("vanna")) return "VANNA" as const;
  if (normalized.includes("charm")) return "CHARM" as const;
  return "GAMMA" as const;
}

export function replayWindow(frames: readonly GexMapFrame[]) {
  const ordered = [...frames].sort((left, right) => left.timestamp - right.timestamp);
  const first = ordered[0]?.timestamp;
  const last = ordered.at(-1)?.timestamp;
  return first === undefined || last === undefined ? null : {
    start: new Date(first - 5 * 60_000).toISOString(),
    end: new Date(last + 5 * 60_000).toISOString(),
  };
}
