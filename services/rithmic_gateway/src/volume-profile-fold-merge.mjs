/**
 * Treat a folded profile as an immutable checkpoint and append the live-ring
 * suffix that arrived after it. The strict timestamp boundary prevents the
 * last folded print being counted twice.
 */
export function volumeProfileTailTrades(profileTrades, foldedProfile) {
  if (!foldedProfile) return profileTrades;
  const foldedEnd = Number(foldedProfile.coverageEndMs);
  if (!Number.isFinite(foldedEnd)) return profileTrades;
  return profileTrades.filter((trade) => Number(trade.timestampMs) > foldedEnd);
}

export function combinedVolumeProfileCoverage(foldedProfile, tailTrades) {
  const starts = [foldedProfile?.coverageStartMs, tailTrades[0]?.timestampMs]
    .map(Number)
    .filter(Number.isFinite);
  const ends = [foldedProfile?.coverageEndMs, tailTrades.at(-1)?.timestampMs]
    .map(Number)
    .filter(Number.isFinite);
  return {
    coverageStartMs: starts.length ? Math.min(...starts) : null,
    coverageEndMs: ends.length ? Math.max(...ends) : null,
  };
}

export function volumeProfileSourcesHaveGap(foldedProfile, tailTrades, toleranceMs = 5 * 60_000) {
  const foldedEnd = Number(foldedProfile?.coverageEndMs);
  const tailStart = Number(tailTrades[0]?.timestampMs);
  return Number.isFinite(foldedEnd)
    && Number.isFinite(tailStart)
    && tailStart - foldedEnd > Math.max(0, Number(toleranceMs) || 0);
}
