import type { Candle } from "@/lib/backtester";
import {
  enrichCandlesWithInstitutionalTrades,
  type InstitutionalTrade,
} from "@/lib/institutionalMarketData";

function carriesVerifiedFlow(candle: Candle) {
  return Number(candle.askVolume ?? 0) + Number(candle.bidVolume ?? 0) > 0;
}

/**
 * Repair missing event-bar flow without replacing authoritative bar totals.
 *
 * Range, volume, tick and Renko candles are built from the full ordered tape,
 * so their baked ask/bid/delta fields are authoritative. A later indicator
 * tape is bounded and may contain aggregated `flowOnly` buckets; those must
 * never overwrite the exact event-bar CVD.
 */
export function mergeMissingEventBarOrderFlow(
  candles: Candle[],
  executionTape: InstitutionalTrade[],
) {
  if (!candles.length || candles.every(carriesVerifiedFlow)) return candles;
  const exactTape = executionTape.filter((record) => !record.flowOnly);
  if (!exactTape.length) return candles;
  const enriched = enrichCandlesWithInstitutionalTrades(candles, exactTape, candles.length);
  let changed = false;
  const merged = candles.map((candle, index) => {
    if (carriesVerifiedFlow(candle)) return candle;
    const repaired = enriched[index];
    if (!repaired || !carriesVerifiedFlow(repaired)) return candle;
    changed = true;
    return repaired;
  });
  return changed ? merged : candles;
}
