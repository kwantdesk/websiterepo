export type IndicatorSettingsDraftState = {
  instanceId: string;
  enabled: boolean;
  settings?: Record<string, number | string | boolean>;
};

export type IndicatorSettingsSnapshot = {
  instanceId: string;
  enabled: boolean;
  settings: Record<string, number | string | boolean>;
};

/**
 * One shared save/discard baseline for every chart indicator.
 *
 * Keeping this outside individual settings panels makes the contract apply to
 * every indicator added to the catalogue in future. The clone is deliberate:
 * live preview edits must never mutate the baseline they are compared with.
 */
export function captureIndicatorSettingsSnapshot(
  instance: IndicatorSettingsDraftState,
): IndicatorSettingsSnapshot {
  return {
    instanceId: instance.instanceId,
    enabled: instance.enabled,
    settings: { ...(instance.settings ?? {}) },
  };
}

function settingsEqual(
  left: Record<string, number | string | boolean>,
  right: Record<string, number | string | boolean>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key) || !Object.is(left[key], right[key])) {
      return false;
    }
  }
  return true;
}

export function indicatorSettingsAreDirty(
  snapshot: IndicatorSettingsSnapshot | null,
  instance: IndicatorSettingsDraftState | null,
): boolean {
  if (!snapshot || !instance || snapshot.instanceId !== instance.instanceId) return false;
  return snapshot.enabled !== instance.enabled
    || !settingsEqual(snapshot.settings, instance.settings ?? {});
}
