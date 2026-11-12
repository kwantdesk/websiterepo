import type { InstitutionalVolumeProfile } from "./institutionalMarketData";

type Instance = { instanceId: string; indicatorId: string; enabled: boolean };

/** New variants carry ownership; old saved/provider profiles keep their routing. */
export function resolveVolumeProfileOwner<T extends Instance>(
  profile: Pick<InstitutionalVolumeProfile, "period" | "ownerInstanceId">,
  indicators: readonly T[],
): T | undefined {
  if (profile.ownerInstanceId) {
    // A disabled/deleted owner cannot silently hand its data to Composite.
    return indicators.find(instance => instance.enabled && instance.instanceId === profile.ownerInstanceId);
  }
  const ids = profile.period === "weekly" ? ["weekly-volume-profile"]
    : profile.period === "custom" ? ["composite-volume-profile"]
      : ["kwant-profile", "ask-bid-volume-profile", "delta-profile"];
  return indicators.find(instance => instance.enabled && ids.includes(instance.indicatorId));
}

export function volumeProfileOwnerKey(profile: Pick<InstitutionalVolumeProfile, "ownerInstanceId" | "root" | "period">): string {
  return profile.ownerInstanceId
    ? JSON.stringify([profile.ownerInstanceId, profile.root, profile.period])
    : `${profile.root}:${profile.period}`;
}

/** A split daily profile occupies one window for one indicator instance. */
export function isSameDailyVolumeProfileWindow(
  candidate: Pick<InstitutionalVolumeProfile, "ownerInstanceId" | "sessionId">,
  replacement: Pick<InstitutionalVolumeProfile, "ownerInstanceId" | "sessionId">,
  candidateTradingDate: string,
  replacementTradingDate: string,
): boolean {
  return candidate.ownerInstanceId === replacement.ownerInstanceId
    && (candidate.sessionId ?? "") === (replacement.sessionId ?? "")
    && candidateTradingDate === replacementTradingDate;
}
