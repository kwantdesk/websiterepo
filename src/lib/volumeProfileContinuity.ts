import type { InstitutionalVolumeProfile } from "@/lib/institutionalMarketData";

export type VolumeProfileContinuityScope = {
  root: string;
  contractSymbol: string;
  dailyEnabled: boolean;
  weeklyEnabled: boolean;
  compositeEnabled: boolean;
  dailyTradingDates: ReadonlySet<string>;
  dailySessionIds: ReadonlySet<string>;
};

export type OwnedVolumeProfileContinuityScope = {
  root: string;
  contractSymbol: string;
  ownerInstanceIds: ReadonlySet<string>;
};

const normalizeSymbol = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Decide whether an already-painted execution profile still belongs to the
 * active chart/study scope while its exact replacement is being calculated.
 *
 * Calculation inputs (rolling start/end, filters, grouping and value-area
 * percentage) deliberately do not participate here. Those values identify a
 * replacement response, not whether the last valid frame should be erased.
 */
export function shouldRetainLastGoodVolumeProfile(
  profile: InstitutionalVolumeProfile,
  scope: VolumeProfileContinuityScope,
  dailyTradingDate: string,
) {
  if (profile.root !== scope.root) return false;
  if (normalizeSymbol(profile.contractSymbol) !== normalizeSymbol(scope.contractSymbol)) return false;

  if (profile.period === "daily") {
    return scope.dailyEnabled
      && scope.dailyTradingDates.has(dailyTradingDate)
      && scope.dailySessionIds.has(profile.sessionId ?? "");
  }
  if (profile.period === "weekly") return scope.weeklyEnabled;
  return profile.period === "custom" && scope.compositeEnabled;
}

/** Keep an owned variant until the same study instance publishes a new key. */
export function shouldRetainLastGoodOwnedVolumeProfile(
  profile: InstitutionalVolumeProfile,
  scope: OwnedVolumeProfileContinuityScope,
) {
  return Boolean(profile.ownerInstanceId)
    && scope.ownerInstanceIds.has(profile.ownerInstanceId!)
    && normalizeSymbol(profile.root) === normalizeSymbol(scope.root)
    && normalizeSymbol(profile.contractSymbol) === normalizeSymbol(scope.contractSymbol);
}
