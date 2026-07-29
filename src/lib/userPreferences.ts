import type { SupabaseClient, User } from "@supabase/supabase-js";

const USER_PREFERENCES_TABLE = "user_preferences";
const USER_PREFERENCES_METADATA_KEY = "kwantdesk_preferences";
const LEGACY_PREFERENCES_OWNER_KEY = "kwantdesk:legacy-preferences-owner:v1";

const TRACKED_STORAGE_KEYS = new Set([
  "olisa-theme",
  "olisa-chart-settings",
  "olisa-chart-defaults",
  "olisa-recent-colors",
  "olisa-chart-templates",
  "olisa-chart-workspace-layout",
  "olisa-chart-workspace-locked",
  "olisa-chart-workspace-split-ratio",
  "olisa-chart-workspace-quad-split",
  "olisa-chart-workspace-panes",
  "olisa-chart-workspace-tree",
  "olisa-chart-workspace-active-pane",
  "olisa-chart-favourite-intervals",
  "olisa-watchlist-favorites",
  "olisa-watchlist-flags",
  "olisa-watchlist-sections",
  "olisa-right-panel-width",
  "olisa-bottom-panel-height",
  "kwantdesk-chart-workspace-presets",
  "kwantdesk-chart-workspace-active-preset",
  "kwantdesk-chart-indicators",
  "kwantdesk-chart-indicator-favourites",
  "kwantdesk:chart-gamma-levels-enabled:v1",
  "kwantdesk:gameplan-chart-overlays:v1",
  "kwantdesk-right-panel-state",
  "kwantdesk-bottom-panel-minimized",
  "kwantdesk-settings-toggles",
  "kwantdesk-settings-font-size",
  "kwantdesk:economic-calendar-timezone:v1",
  "kwantify-chart-alerts",
  "kwantify-chart-tool-favorites",
  "kwantify-chart-toolbar-dock",
  "kwantify-chart-toolbar-collapsed",
  "kwantify:options-flow:chart-timeframe",
]);

const TRACKED_STORAGE_PREFIXES = [
  "kwantify-chart-drawings:",
];

const METADATA_FALLBACK_KEYS = new Set([
  "olisa-theme",
  "olisa-chart-settings",
  "olisa-chart-defaults",
  "olisa-chart-favourite-intervals",
  "kwantdesk-chart-indicators",
  "kwantdesk-chart-indicator-favourites",
  "kwantdesk:chart-gamma-levels-enabled:v1",
  "kwantify-chart-tool-favorites",
  "kwantify-chart-toolbar-dock",
  "kwantify-chart-toolbar-collapsed",
  "kwantdesk-settings-toggles",
  "kwantdesk-settings-font-size",
  "kwantdesk:economic-calendar-timezone:v1",
]);

export type UserPreferenceSnapshot = {
  version: 1;
  complete: boolean;
  updatedAt: string;
  values: Record<string, string>;
};

function isTrackedStorageKey(key: string) {
  return TRACKED_STORAGE_KEYS.has(key)
    || TRACKED_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function normalizeSnapshot(value: unknown, fallbackUpdatedAt?: string): UserPreferenceSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<UserPreferenceSnapshot>;
  if (!candidate.values || typeof candidate.values !== "object" || Array.isArray(candidate.values)) return null;
  const values = Object.fromEntries(
    Object.entries(candidate.values)
      .filter(([key, item]) => isTrackedStorageKey(key) && typeof item === "string")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  return {
    version: 1,
    complete: candidate.complete !== false,
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt
        ? candidate.updatedAt
        : fallbackUpdatedAt ?? new Date(0).toISOString(),
    values,
  };
}

function scopedPreferenceKey(userId: string) {
  return `kwantdesk:user-preferences:${userId}:v1`;
}

function readScopedPreferences(userId: string) {
  if (typeof window === "undefined") return null;
  try {
    return normalizeSnapshot(JSON.parse(window.localStorage.getItem(scopedPreferenceKey(userId)) ?? "null"));
  } catch {
    return null;
  }
}

function saveScopedPreferences(userId: string, snapshot: UserPreferenceSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scopedPreferenceKey(userId), JSON.stringify(snapshot));
  } catch {
    // Cloud persistence remains authoritative when browser storage is full.
  }
}

export function captureBrowserPreferences(): UserPreferenceSnapshot {
  const values: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
      window.localStorage.key(index))
      .filter((key): key is string => key !== null && isTrackedStorageKey(key))
      .sort();
    for (const key of keys) {
      const value = window.localStorage.getItem(key);
      if (value !== null) values[key] = value;
    }
  }
  return {
    version: 1,
    complete: true,
    updatedAt: new Date().toISOString(),
    values,
  };
}

export function preferenceSnapshotFingerprint(snapshot: UserPreferenceSnapshot) {
  return JSON.stringify(snapshot.values);
}

function applyBrowserPreferences(snapshot: UserPreferenceSnapshot) {
  if (typeof window === "undefined") return;
  if (snapshot.complete) {
    const keysToRemove = Array.from({ length: window.localStorage.length }, (_, index) =>
      window.localStorage.key(index))
      .filter((key): key is string =>
        key !== null
        && isTrackedStorageKey(key)
        && !(key in snapshot.values));
    for (const key of keysToRemove) window.localStorage.removeItem(key);
  }
  for (const [key, value] of Object.entries(snapshot.values)) {
    window.localStorage.setItem(key, value);
  }
}

async function loadCloudPreferences(
  supabase: SupabaseClient,
  user: User,
): Promise<UserPreferenceSnapshot | null> {
  const { data, error } = await supabase
    .from(USER_PREFERENCES_TABLE)
    .select("preferences, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!error && data?.preferences) {
    return normalizeSnapshot(data.preferences, data.updated_at);
  }

  const metadataSnapshot = normalizeSnapshot(user.user_metadata?.[USER_PREFERENCES_METADATA_KEY]);
  return metadataSnapshot ? { ...metadataSnapshot, complete: false } : null;
}

function metadataFallbackSnapshot(snapshot: UserPreferenceSnapshot): UserPreferenceSnapshot {
  return {
    ...snapshot,
    complete: false,
    values: Object.fromEntries(
      Object.entries(snapshot.values).filter(([key]) => METADATA_FALLBACK_KEYS.has(key)),
    ),
  };
}

export async function saveUserPreferences(
  supabase: SupabaseClient,
  userId: string,
  snapshot: UserPreferenceSnapshot,
) {
  saveScopedPreferences(userId, snapshot);
  const { error } = await supabase
    .from(USER_PREFERENCES_TABLE)
    .upsert(
      {
        user_id: userId,
        preferences: snapshot,
        updated_at: snapshot.updatedAt,
      },
      { onConflict: "user_id" },
    );

  if (!error) return;

  await supabase.auth.updateUser({
    data: {
      [USER_PREFERENCES_METADATA_KEY]: metadataFallbackSnapshot(snapshot),
    },
  });
}

export async function hydrateUserPreferences(
  supabase: SupabaseClient,
  user: User,
) {
  const current = captureBrowserPreferences();
  const cloud = await loadCloudPreferences(supabase, user);
  const scoped = readScopedPreferences(user.id);
  let selected = cloud;

  if (scoped && selected && !selected.complete) {
    selected = {
      version: 1,
      complete: true,
      updatedAt:
        Date.parse(scoped.updatedAt) >= Date.parse(selected.updatedAt)
          ? scoped.updatedAt
          : selected.updatedAt,
      values: {
        ...scoped.values,
        ...selected.values,
      },
    };
  } else if (
    scoped
    && (
      !selected
      || Date.parse(scoped.updatedAt) >= Date.parse(selected.updatedAt)
    )
  ) {
    selected = scoped;
  } else if (selected && !selected.complete) {
    selected = { ...selected, complete: true };
  }

  if (!selected) {
    const legacyOwner = window.localStorage.getItem(LEGACY_PREFERENCES_OWNER_KEY);
    if (!legacyOwner || legacyOwner === user.id) {
      selected = current;
      window.localStorage.setItem(LEGACY_PREFERENCES_OWNER_KEY, user.id);
    } else {
      selected = {
        version: 1,
        complete: true,
        updatedAt: new Date().toISOString(),
        values: {},
      };
    }
    await saveUserPreferences(supabase, user.id, selected);
  }

  const changed = preferenceSnapshotFingerprint(current) !== preferenceSnapshotFingerprint(selected);
  applyBrowserPreferences(selected);
  saveScopedPreferences(user.id, selected);
  return { changed, snapshot: selected };
}
