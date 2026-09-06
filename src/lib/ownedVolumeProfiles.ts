import {
  applyInstitutionalTradesToVolumeProfile,
  isExecutionBackedVolumeProfile,
  type InstitutionalTrade,
  type InstitutionalVolumeProfile,
} from "./institutionalMarketData";
import { runProfileVariantJobs, type ProfileVariantJob } from "./profileVariantJobs";

export type OwnedProfileResult =
  | { status: "ready"; job: ProfileVariantJob; profile: InstitutionalVolumeProfile }
  | { status: "unavailable"; job: ProfileVariantJob; reason: string };

const symbolKey = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const almostEqual = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-9;

/** New profiles fail closed on mismatched source, settings and requested span. */
export function validateOwnedVolumeProfile(job: ProfileVariantJob, profile: InstitutionalVolumeProfile | null): OwnedProfileResult {
  const unavailable = (reason: string): OwnedProfileResult => ({ status: "unavailable", job, reason });
  // The current timestamp-range endpoint cannot encode five disjoint RTH
  // windows by merely forwarding a filter flag. Do not label it as filtered.
  if (job.request.filterMode && job.request.filterMode !== "none") return unavailable("Session-filtered monthly history requires disjoint execution windows.");
  if (!profile || !isExecutionBackedVolumeProfile(profile) || profile.complete !== true) return unavailable("Complete execution history is not available for this profile window.");
  if (profile.period !== "custom" || symbolKey(profile.root) !== symbolKey(job.request.symbol)
    || (job.request.contractSymbol && symbolKey(profile.contractSymbol) !== symbolKey(job.request.contractSymbol))) {
    return unavailable("Profile source does not match the requested instrument and contract.");
  }
  if (profile.startMs !== job.startMs || profile.endMs !== job.endMs
    || !Number.isFinite(profile.coverageStartMs) || !Number.isFinite(profile.coverageEndMs)
    || Number(profile.coverageStartMs) > Number(profile.coverageEndMs)
    || Number(profile.coverageStartMs) < job.startMs || Number(profile.coverageEndMs) >= job.endMs) {
    return unavailable("Profile boundaries do not match the requested execution window.");
  }
  if (profile.groupTicks !== (job.request.groupTicks ?? 1)
    || profile.minTradeVolume !== (job.request.minTradeVolume ?? 0)
    || profile.maxTradeVolume !== (job.request.maxTradeVolume ?? 0)
    || !almostEqual(profile.valueAreaPercent, job.request.valueAreaPercent ?? 70)) {
    return unavailable("The returned profile does not match the requested data settings.");
  }
  if (!(profile.tickSize > 0) || !Number.isFinite(profile.tickSize)
    || !Array.isArray(profile.developingPoc)
    || ![profile.poc, profile.vah, profile.val, profile.vwap, profile.standardDeviation].every(Number.isFinite)) {
    return unavailable("Invalid profile calculation values.");
  }
  let volume = 0, ask = 0, bid = 0, trades = 0, previous = -Infinity;
  for (const row of profile.levels) {
    if (![row.price, row.volume, row.askVolume, row.bidVolume, row.trades, row.delta].every(Number.isFinite)
      || row.price <= previous || row.volume < 0 || row.askVolume < 0 || row.bidVolume < 0 || row.trades < 0
      || !almostEqual(row.delta, row.askVolume - row.bidVolume)
      || row.askVolume + row.bidVolume > row.volume + 1e-8) return unavailable("Invalid execution-volume ladder.");
    previous = row.price;
    volume += row.volume; ask += row.askVolume; bid += row.bidVolume; trades += row.trades;
  }
  if (!(volume > 0) || !almostEqual(volume, profile.totalVolume) || !almostEqual(ask, profile.askVolume)
    || !almostEqual(bid, profile.bidVolume) || !almostEqual(ask - bid, profile.delta)
    || !almostEqual(trades, profile.trades)) return unavailable("Profile totals do not reconcile with its execution ladder.");
  // Local ownership is attached only after validation; never trust an upstream
  // owner identifier to route a response into another user's study instance.
  return { status: "ready", job, profile: { ...profile, ownerInstanceId: job.ownerId } };
}

/** Adapter uses existing cached/exact readers; no new endpoint or feed. */
export async function loadOwnedVolumeProfiles(args: {
  jobs: readonly ProfileVariantJob[];
  readCached: (job: ProfileVariantJob) => Promise<InstitutionalVolumeProfile | null>;
  readExact: (job: ProfileVariantJob) => Promise<InstitutionalVolumeProfile | null>;
  publish: (result: OwnedProfileResult) => void;
  isCurrent: () => boolean;
}): Promise<void> {
  await runProfileVariantJobs({
    jobs: args.jobs,
    isCurrent: args.isCurrent,
    read: async job => {
      if (job.request.filterMode && job.request.filterMode !== "none") return validateOwnedVolumeProfile(job, null);
      let cached: InstitutionalVolumeProfile | null = null;
      try { cached = await args.readCached(job); } catch { /* Cache failure must not prevent the exact source. */ }
      if (!args.isCurrent()) return validateOwnedVolumeProfile(job, null);
      const cachedResult = validateOwnedVolumeProfile(job, cached);
      if (cachedResult.status === "ready") args.publish(cachedResult);
      if (!args.isCurrent()) return cachedResult;
      const exact = validateOwnedVolumeProfile(job, await args.readExact(job));
      // A failed refresh cannot erase a complete same-window cache. Surface
      // the failure separately to the caller, which owns freshness messaging.
      return exact;
    },
    publish: (_job, result) => args.publish(result),
    failed: (job) => args.publish({ status: "unavailable", job, reason: "Execution history request failed; existing valid data was not removed." }),
  });
}

/**
 * A frozen profile must not absorb the next month. For developing profiles
 * the caller supplies a verified month boundary plus actual execution clock.
 * No records after replay clock, no wall-time or synthetic price extension.
 */
export function developOwnedVolumeProfile(args: {
  profile: InstitutionalVolumeProfile;
  records: InstitutionalTrade[];
  endBoundaryMs: number;
  clockMs: number;
}): InstitutionalVolumeProfile {
  const { profile, records, endBoundaryMs, clockMs } = args;
  if (!profile.ownerInstanceId || !isExecutionBackedVolumeProfile(profile)
    || !Number.isFinite(endBoundaryMs) || !Number.isFinite(clockMs)) return profile;
  const bounded = records.filter(record => record.timestamp >= profile.startMs
    && record.timestamp < endBoundaryMs && record.timestamp <= clockMs);
  if (!bounded.length) return profile;
  let lastTime = -Infinity;
  for (const record of bounded) lastTime = Math.max(lastTime, record.timestamp);
  if (lastTime <= Number(profile.coverageEndMs)) return profile;
  const growing = { ...profile, endMs: Math.min(endBoundaryMs, Math.max(profile.endMs, lastTime + 1)) };
  return applyInstitutionalTradesToVolumeProfile(growing, bounded);
}
