import { majorNegative, majorPositive, zeroGamma } from "./metrics.ts";
import { GEX_BOX_INSTRUMENTS, type LadderFrame, type SourceStamp, type StrikeExposure } from "./domain.ts";
import type { GexBotProfileFrame, GexBotTerminalEnvelope } from "../gexBotTypes.ts";

export function normalizeGexBotEnvelope(envelope: GexBotTerminalEnvelope<GexBotProfileFrame>): LadderFrame | null {
  const frame = envelope.frame;
  if (!frame) return null;
  const instrument = GEX_BOX_INSTRUMENTS.find((item) => item.providerTicker === envelope.ticker) ?? GEX_BOX_INSTRUMENTS[0];
  const receivedAt = envelope.checkedAt;
  const source: SourceStamp = {
    provider: "gexbot",
    providerTimestamp: frame.timestamp,
    receivedAt,
    session: envelope.session,
    freshnessMs: Math.max(0, receivedAt - frame.timestamp),
    formulaVersion: null,
    simulated: envelope.historySimulated === true,
  };
  const strikes: StrikeExposure[] = frame.strikes.map(([strike, volumeExposure, openInterestExposure, priors]) => ({
    strike,
    volumeExposure,
    openInterestExposure,
    priorOpenInterestExposure: priors,
    changeByWindow: {},
  }));
  const calculatedPositive = majorPositive(strikes);
  const calculatedNegative = majorNegative(strikes);
  const calculatedZero = zeroGamma(strikes);
  const providerZero = frame.zero_gamma;
  const providerPositive = frame.major_pos_oi;
  const providerNegative = frame.major_neg_oi;
  return {
    timestamp: frame.timestamp,
    instrument,
    spot: frame.spot,
    strikes,
    totals: { volume: frame.sum_gex_vol ?? 0, openInterest: frame.sum_gex_oi ?? 0 },
    levels: {
      timestamp: frame.timestamp,
      zeroGamma: providerZero !== null
        ? { kind: "zero_gamma", price: providerZero, exposure: null, basis: "provider" }
        : calculatedZero === null ? null : { kind: "zero_gamma", price: calculatedZero, exposure: null, basis: "calculated" },
      majorPositive: providerPositive !== null
        ? { kind: "major_positive", price: providerPositive, exposure: null, basis: "provider" }
        : calculatedPositive ? { kind: "major_positive", price: calculatedPositive.strike, exposure: calculatedPositive.openInterestExposure, basis: "calculated" } : null,
      majorNegative: providerNegative !== null
        ? { kind: "major_negative", price: providerNegative, exposure: null, basis: "provider" }
        : calculatedNegative ? { kind: "major_negative", price: calculatedNegative.strike, exposure: calculatedNegative.openInterestExposure, basis: "calculated" } : null,
    },
    source,
  };
}
