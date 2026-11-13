export type RightStudyLane = { id: string; width: number };

export function layoutRightStudyLanes(
  availableWidth: number,
  requested: readonly RightStudyLane[],
): RightStudyLane[] {
  const budget = Math.max(0, Math.min(Math.floor(availableWidth * 0.55), Math.floor(availableWidth - 160)));
  const total = requested.reduce((sum, lane) => sum + lane.width, 0);
  if (!total || !budget) return [];
  return requested.flatMap(({ id, width }) => {
    const fitted = Math.floor(width * Math.min(1, budget / total));
    return fitted > 0 ? [{ id, width: fitted }] : [];
  });
}

export function volumeProfileUsesOuterRightDock(indicatorId: string, snapMode: unknown) {
  return snapMode === "right" && indicatorId !== "kwant-profile" && indicatorId !== "weekly-volume-profile";
}

export const VOLUME_PROFILE_DOCK_IDS = new Set([
  "composite-volume-profile", "ask-bid-volume-profile", "delta-profile",
  "monthly-volume-profile", "session-volume-profile", "visible-range-volume-profile",
]);
