import type { SupabaseClient, User } from "@supabase/supabase-js";
import { applyTheme } from "./theme.ts";

const USER_PREFERENCES_TABLE = "user_preferences";
const USER_PREFERENCES_METADATA_KEY = "kwantdesk_preferences";
const LEGACY_PREFERENCES_OWNER_KEY = "kwantdesk:legacy-preferences-owner:v1";
const ACTIVE_PREFERENCES_OWNER_KEY = "kwantdesk:active-preferences-owner:v1";
const SOCIAL_OBJECTS_TABLE = "social_objects";
const SOCIAL_PREFERENCES_ID = "account-preferences";

const TRACKED_STORAGE_KEYS = new Set([
  "olisa-theme",
  "olisa-chart-settings",
  "kwantdesk:chart-workspace-settings:v1",
  "olisa-chart-defaults",
  "olisa-recent-colors",
  "olisa-chart-templates",
  "olisa-chart-workspace-layout",
  "olisa-chart-workspace-locked",
  "olisa-chart-workspace-split-ratio",
  "olisa-chart-workspace-quad-split",
  "olisa-chart-workspace-panes",
  "olisa-chart-workspace-tree",
  "olisa-chart-workspace-floating-windows",
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
  "kwantdesk-source-code-indicators:v1",
  "kwantdesk:chart-gamma-levels-enabled:v1",
  "kwantdesk:chart-value-area-levels-enabled:v1",
  "kwantdesk:chart-pane-level-visibility:v1",
  "kwantdesk:gex-map-palette:v1",
  "kwantdesk:gex-map-zoom:v1",
  "kwantdesk:gex-map-price-lock:v1",
  "kwantdesk:gex-map:star-preferences:v1",
  "kwantdesk:chart-crosshair-style:v1",
  "kwantdesk:chart-toolbar-pinned:v1",
  "kwantdesk:chart-drawtools:v1",
  "kwantdesk:chart-drawtool-templates:v1",
  "kwantdesk:gameplan-chart-overlays:v1",
  "kwantdesk-right-panel-state",
  "kwantdesk-bottom-panel-minimized",
  "kwantdesk-settings-toggles",
  "kwantdesk-settings-font-size",
  "kwantdesk:economic-calendar-timezone:v1",
  "kwantdesk:liquidity-map-settings:v1",
  "kwantdesk:liquidity-map-tabs:v1",
  "kwantdesk:liquidity-map-instrument:v1",
  "kwantdesk-kwantbot-messages",
  "kwantdesk:zyon:model",
  "kwantdesk:zyon:root",
  "kwantify-chart-alerts",
  "kwantify-chart-tool-favorites",
  "kwantify-chart-toolbar-dock",
  "kwantify-chart-toolbar-collapsed",
  "kwantify:options-flow:chart-timeframe",
]);

const TRACKED_STORAGE_PREFIXES = [
  "kwantdesk:gamma-charting:",
  "kwantify-chart-drawings:",
  "kwantdesk:position-drawings:v1:",
  "kwantdesk:chart-toolbar-pinned:v1:",
  "kwantdesk:precision-tools:v1:",
  "kwantdesk:precision-tool-configs:v1:",
  "kwantdesk:precision-toolbar:v1:",
];

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

  const { data: socialFallback, error: socialFallbackError } = await supabase
    .from(SOCIAL_OBJECTS_TABLE)
    .select("payload, updated_at")
    .eq("user_id", user.id)
    .eq("id", SOCIAL_PREFERENCES_ID)
    .maybeSingle();
  if (!socialFallbackError && socialFallback?.payload) {
    const payload = socialFallback.payload as Record<string, unknown>;
    const snapshot = normalizeSnapshot(
      payload.preferences ?? payload,
      socialFallback.updated_at,
    );
    if (snapshot) return snapshot;
  }

  const metadataSnapshot = normalizeSnapshot(user.user_metadata?.[USER_PREFERENCES_METADATA_KEY]);
  return metadataSnapshot ? { ...metadataSnapshot, complete: false } : null;
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

  const { error: socialFallbackError } = await supabase
    .from(SOCIAL_OBJECTS_TABLE)
    .upsert(
      {
        user_id: userId,
        id: SOCIAL_PREFERENCES_ID,
        author_label: "Kwant Desk account",
        object_type: "progress",
        scope: "private",
        desk_id: null,
        parent_id: null,
        payload: { preferences: snapshot },
        updated_at: snapshot.updatedAt,
      },
      { onConflict: "user_id,id" },
    );
  if (!socialFallbackError) return;

  // Never put workspace preferences into Supabase auth metadata. The SSR
  // client serialises the complete user object into its session cookie; chart
  // layouts, indicators and liquidity-map state can then grow the request
  // header beyond Vercel's hard limit. Local scoped storage remains the
  // offline fallback and the database is retried by the sync hook.
  console.warn("Account preferences could not be saved to either database store.");
}

export async function compactLegacyAuthPreferenceMetadata(
  supabase: SupabaseClient,
  user: User,
) {
  const metadata = user.user_metadata ?? {};
  const legacyKeys = [
    USER_PREFERENCES_METADATA_KEY,
    "chartSettings",
    "chart_settings",
  ] as const;
  if (!legacyKeys.some((key) => metadata[key] !== undefined && metadata[key] !== null)) {
    return false;
  }
  const { error } = await supabase.auth.updateUser({
    data: Object.fromEntries(legacyKeys.map((key) => [key, null])),
  });
  if (error) throw error;
  return true;
}

export async function hydrateUserPreferences(
  supabase: SupabaseClient,
  user: User,
) {
  const current = captureBrowserPreferences();
  const themeAtHydrationStart = current.values["olisa-theme"];
  const activePreferenceOwner = window.localStorage.getItem(ACTIVE_PREFERENCES_OWNER_KEY);
  const legacyPreferenceOwner = window.localStorage.getItem(LEGACY_PREFERENCES_OWNER_KEY);
  const localThemeBelongsToUser = Boolean(
    themeAtHydrationStart
    && (
      activePreferenceOwner === user.id
      || (!activePreferenceOwner && legacyPreferenceOwner === user.id)
    ),
  );
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
  } else if (
    activePreferenceOwner === user.id
    && scoped
    && !(cloud && Date.parse(cloud.updatedAt) > Date.parse(scoped.updatedAt))
    && preferenceSnapshotFingerprint(current) !== preferenceSnapshotFingerprint(selected)
  ) {
    // This browser is the account's active preference owner and no other
    // device has written a newer account snapshot since this browser last
    // synced. Any difference in live storage is therefore unsynced local work
    // — for example a workspace quick-saved moments before the app closed,
    // before the debounced upload could complete. Applying the older snapshot
    // would destroy that work, so keep the live state and upload it instead.
    selected = { ...current, updatedAt: new Date().toISOString() };
    await saveUserPreferences(supabase, user.id, selected);
  }

  // A theme click is an immediate user decision. If it happened while the
  // account snapshot was loading, do not let the slower response repaint an
  // older colour scheme over it.
  const latest = captureBrowserPreferences();
  if (latest.values["olisa-theme"] !== themeAtHydrationStart) {
    selected = {
      ...selected,
      updatedAt: latest.updatedAt,
      values: {
        ...selected.values,
        ...(latest.values["olisa-theme"]
          ? { "olisa-theme": latest.values["olisa-theme"] }
          : {}),
      },
    };
  } else if (localThemeBelongsToUser && themeAtHydrationStart) {
    // The already-painted local theme is the last skin this same account used
    // on this browser. Do not let an older cloud snapshot repaint it during
    // every refresh; new browsers still receive the account-backed theme.
    selected = {
      ...selected,
      values: {
        ...selected.values,
        "olisa-theme": themeAtHydrationStart,
      },
    };
  }

  const changed = preferenceSnapshotFingerprint(current) !== preferenceSnapshotFingerprint(selected);
  applyBrowserPreferences(selected);
  applyTheme();
  window.localStorage.setItem(ACTIVE_PREFERENCES_OWNER_KEY, user.id);
  saveScopedPreferences(user.id, selected);
  return { changed, snapshot: selected };
}
