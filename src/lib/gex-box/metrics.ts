import type { NormalizedOptionContract, StrikeExposure } from "@/lib/gex-box/domain";

export const GEX_BOX_FORMULA_VERSION = "kwantdesk-gex-box-v1";

export function dexExposure(contract: NormalizedOptionContract, spot: number) {
  if (contract.delta === null) return null;
  return contract.multiplier * contract.delta * contract.openInterest * spot;
}

export function gexExposure(contract: NormalizedOptionContract, spot: number) {
  if (contract.gamma === null) return null;
  return contract.multiplier * contract.gamma * contract.openInterest * spot * spot * 0.01;
}

export function charmExposure(contract: NormalizedOptionContract, spot: number) {
  if (contract.charm === null) return null;
  return contract.multiplier * contract.charm * contract.openInterest * spot / (365 * 24);
}

export function negativeVannaExposure(contract: NormalizedOptionContract, spot: number) {
  if (contract.vanna === null || contract.impliedVolatility === null) return null;
  return contract.multiplier * contract.vanna * contract.openInterest * spot * -contract.impliedVolatility;
}

export function majorPositive(strikes: StrikeExposure[], basis: "volume" | "openInterest" = "openInterest") {
  const value = basis === "volume" ? "volumeExposure" : "openInterestExposure";
  return strikes.reduce<StrikeExposure | null>((best, row) => !best || row[value] > best[value] ? row : best, null);
}

export function majorNegative(strikes: StrikeExposure[], basis: "volume" | "openInterest" = "openInterest") {
  const value = basis === "volume" ? "volumeExposure" : "openInterestExposure";
  return strikes.reduce<StrikeExposure | null>((best, row) => !best || row[value] < best[value] ? row : best, null);
}

export function zeroGamma(strikes: StrikeExposure[], basis: "volume" | "openInterest" = "openInterest") {
  const value = basis === "volume" ? "volumeExposure" : "openInterestExposure";
  const sorted = [...strikes].sort((a, b) => a.strike - b.strike);
  let cumulative = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const previous = cumulative;
    cumulative += sorted[index][value];
    if (index === 0 || previous === 0) continue;
    if ((previous < 0 && cumulative >= 0) || (previous > 0 && cumulative <= 0)) {
      const priorStrike = sorted[index - 1].strike;
      const nextStrike = sorted[index].strike;
      const denominator = Math.abs(previous) + Math.abs(cumulative);
      const ratio = denominator === 0 ? 0.5 : Math.abs(previous) / denominator;
      return priorStrike + (nextStrike - priorStrike) * ratio;
    }
  }
  return null;
}

export function maxChangeAtOrBefore<T extends { timestamp: number; strikes: StrikeExposure[] }>(
  history: T[],
  now: number,
  windowMinutes: 1 | 5 | 10 | 15 | 30,
) {
  const latest = [...history].filter((frame) => frame.timestamp <= now).sort((a, b) => b.timestamp - a.timestamp)[0];
  const prior = [...history]
    .filter((frame) => frame.timestamp <= now - windowMinutes * 60_000)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (!latest || !prior) return null;
  const priorByStrike = new Map(prior.strikes.map((row) => [row.strike, row.openInterestExposure]));
  return latest.strikes.reduce<{ strike: number; change: number } | null>((best, row) => {
    const previous = priorByStrike.get(row.strike);
    if (previous === undefined) return best;
    const change = row.openInterestExposure - previous;
    return !best || Math.abs(change) > Math.abs(best.change) ? { strike: row.strike, change } : best;
  }, null);
}
