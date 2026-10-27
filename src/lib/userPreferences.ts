import type { SupabaseClient, User } from "@supabase/supabase-js";
import { applyTheme } from "./theme.ts";
import { retainLocalChartAppearance } from "./chartSettings.ts";
import { writeProtectedItem } from "./browserStorageQuota.ts";
import { inFlightGexWorkspace } from "./gexDataPreferenceOwnership.ts";
import { accountPreferenceFingerprint } from "./accountPreferenceMerge";
import { CHART_DRAWING_PREFERENCE_KEY, mergeChartDrawingPreferences } from "./chartDrawingPreferences";

const USER_PREFERENCES_TABLE = "user_preferences";
const USER_PREFERENCES_METADATA_KEY = "kwantdesk_preferences";
const LEGACY_PREFERENCES_OWNER_KEY = "kwantdesk:legacy-preferences-owner:v1";
const ACTIVE_PREFERENCES_OWNER_KEY = "kwantdesk:active-preferences-owner:v1";

/** Read-only chart startup may use this account's cache while cloud sync runs. */
export function canDisplayOwnedWorkspace(userId: string) {
  if (!userId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ACTIVE_PREFERENCES_OWNER_KEY) === userId
      && readScopedPreferences(userId)?.complete === true;
  } catch { return false; }
}
const SOCIAL_OBJECTS_TABLE = "social_objects";
const SOCIAL_PREFERENCES_ID = "account-preferences";
const ACCOUNT_TEMPLATE_STORAGE_KEYS = [
  "kwantdesk:custom-themes:v1",
  "kwantdesk:indicator-templates:v1",
  "kwantdesk:footprint:templates:v1",
  "kwantdesk:tpo-user-presets:v1",
  "kwantdesk:gex-interval-map-presets:v1",
  "kwantdesk:favourite-intervals:v1",
  "kwantdesk:favourite-instruments:v1",
  "olisa-chart-workspace-linked-panes",
  "kwantify-selected-paper-account",
  "kwantify-hidden-paper-fill-markers-v1",
] as const;

const TRACKED_STORAGE_KEYS = new Set([
  "kwantdesk:custom-themes:v1",
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
  "olisa-chart-workspace-linked-panes",
  "kwantdesk:favourite-intervals:v1",
  "kwantdesk:favourite-instruments:v1",
  "olisa-chart-favourite-intervals",
  "olisa-watchlist-favorites",
  "olisa-watchlist-flags",
  "olisa-watchlist-sections",
  "olisa-right-panel-width",
  "olisa-bottom-panel-height",
  "kwantdesk-chart-workspace-presets",
  "kwantdesk:levelz-workspaces:v1",
  "kwantdesk:gex-data:workspace:v1",
  "kwantdesk:kwanty:workspace:v1",
  "kwantdesk:options-expiration-calendar:v1",
  "kwantdesk-chart-workspace-active-preset",
  "kwantdesk-chart-indicators",
  "kwantdesk-chart-indicator-favourites",
  "kwantdesk-source-code-indicators:v1",
  "kwantdesk:chart-gamma-levels-enabled:v1",
  "kwantdesk:chart-value-area-levels-enabled:v1",
  "kwantdesk:chart-pane-level-visibility:v1",
  "kwantdesk:volume-profile-templates:v1",
  "kwantdesk:indicator-templates:v1",
  "kwantdesk:footprint:templates:v1",
  "kwantdesk:tpo-user-presets:v1",
  "kwantdesk:gex-interval-map-presets:v1",
  "kwantdesk:gex-map-palette:v1",
  "kwantdesk:gex-map-zoom:v1",
  "kwantdesk:gex-map-future:v1",
  "kwantdesk:gex-map-future-zoom:v1",
  "kwantdesk:gex-map-time-horizon:v1",
  "kwantdesk:gex-map-price-lock:v1",
  "kwantdesk:gex-map:star-preferences:v1",
  "kwantdesk:chart-crosshair-style:v1",
  "kwantdesk:chart-toolbar-pinned:v1",
  "kwantdesk:chart-drawtools:v1",
  "kwantdesk:chart-drawtool-templates:v1",
  "kwantdesk:chart-magnet:v1",
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
  /*
   * Paper trading belongs to the trader, not to the browser.
   *
   * These two were never synced, so an account and everything traded in it
   * lived in one browser's localStorage: a different machine, a cleared cache
   * or a private window and the accounts were simply gone, which is why they
   * had to be recreated on almost every sign-in.
   *
   * They are a record of decisions someone made, not a cache that can be
   * fetched again, so they belong with the workspaces and drawings.
   */
  "kwantify-paper-trading-accounts",
  "kwantify-paper-trading-ledger-v1",
  "kwantify-selected-paper-account",
  "kwantify-hidden-paper-fill-markers-v1",
]);

const TRACKED_STORAGE_PREFIXES = [
  "kwantdesk:gamma-charting:",
  "kwantify-chart-drawings:",
  "kwantdesk:chart-drawings:v1:",
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

export function isTrackedStorageKey(key: string) {
  return TRACKED_STORAGE_KEYS.has(key)
    || TRACKED_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function normalizeSnapshot(value: unknown, fallbackUpdatedAt?: string): UserPreferenceSnapshot | null {
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

export function readScopedPreferences(userId: string) {
  if (typeof window === "undefined") return null;
  try {
    return normalizeSnapshot(JSON.parse(window.localStorage.getItem(scopedPreferenceKey(userId)) ?? "null"));
  } catch {
    return null;
  }
}

export function saveScopedPreferences(userId: string, snapshot: UserPreferenceSnapshot) {
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

/**
 * Signing in replaces local state, and everything reading it has to be told.
 *
 * Hydration writes the account's saved values straight into local storage. The
 * surfaces that read those values - the paper accounts in the trade menu, the
 * order ticket's account picker, the accounts page - each read ONCE and then
 * listen only for their own change events, which a hydration never fires. So
 * the trader's demo accounts were restored correctly and stayed invisible until
 * a manual refresh, which reads exactly like they were never saved.
 */
export const PREFERENCES_HYDRATED_EVENT = "kwantdesk:preferences-hydrated";

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
    // Preferences are the trader's own state — layouts, panes, drawings. A
    // full quota gives up cache before it gives up any of this.
    writeProtectedItem(key, value);
  }
  window.dispatchEvent(new CustomEvent(PREFERENCES_HYDRATED_EVENT));
}

export async function loadCloudPreferences(
  supabase: SupabaseClient,
  user: User,
): Promise<UserPreferenceSnapshot | null> {
  const signal = AbortSignal.timeout(8_000);
  const { data, error } = await supabase
    .from(USER_PREFERENCES_TABLE)
    .select("preferences, updated_at")
    .eq("user_id", user.id)
    .abortSignal(signal).maybeSingle();

  if (!error && data?.preferences) {
    return normalizeSnapshot(data.preferences, data.updated_at);
  }

  const { data: socialFallback, error: socialFallbackError } = await supabase
    .from(SOCIAL_OBJECTS_TABLE)
    .select("payload, updated_at")
    .eq("user_id", user.id)
    .eq("id", SOCIAL_PREFERENCES_ID)
    .abortSignal(signal).maybeSingle();
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
  base = readScopedPreferences(userId) ?? { version: 1 as const, complete: true, updatedAt: new Date(0).toISOString(), values: {} },
) {
  const { exchangeAccountPreferences } = await import("./accountPreferenceCloud");
  const saved = await exchangeAccountPreferences(supabase, userId, base, snapshot, true);
  saveScopedPreferences(userId, saved.snapshot);
  return saved.snapshot;
}

/** Apply a received account revision without reloading chart history. */
export function receiveAccountPreferences(userId: string, snapshot: UserPreferenceSnapshot, acknowledged = snapshot) {
  if (typeof window === "undefined") return;
  const owner = window.localStorage.getItem(ACTIVE_PREFERENCES_OWNER_KEY);
  if (owner && owner !== userId) return;
  // The caller has verified this identity; an empty new-device store can bind
  // on its first successful receive after a temporary initial hydration fault.
  if (!owner) writeProtectedItem(ACTIVE_PREFERENCES_OWNER_KEY, userId);
  const previous = captureBrowserPreferences();
  const keys = [...new Set([...Object.keys(previous.values), ...Object.keys(snapshot.values)])]
    .filter(key => previous.values[key] !== snapshot.values[key]);
  if (!keys.length) { saveScopedPreferences(userId, acknowledged); return; }
  // Write first, then notify every mounted consumer about the same revision.
  for (const key of keys) {
    const value = snapshot.values[key];
    if (value === undefined) window.localStorage.removeItem(key);
    else writeProtectedItem(key, value);
  }
  saveScopedPreferences(userId, acknowledged);
  if (keys.includes("olisa-theme")) applyTheme();
  window.dispatchEvent(new CustomEvent(PREFERENCES_HYDRATED_EVENT, { detail: { source: "remote", userId, keys } }));
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
  let acknowledged = cloud ?? scoped ?? { version: 1 as const, complete: true, updatedAt: new Date(0).toISOString(), values: {} };
  const persist = async (snapshot: UserPreferenceSnapshot, baseline = acknowledged) => {
    acknowledged = await saveUserPreferences(supabase, user.id, snapshot, baseline);
    return acknowledged;
  };
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
      writeProtectedItem(LEGACY_PREFERENCES_OWNER_KEY, user.id);
    } else {
      selected = {
        version: 1,
        complete: true,
        updatedAt: new Date().toISOString(),
        values: {},
      };
    }
    selected = await persist(selected);
  } else if (
    activePreferenceOwner === user.id
    && scoped
    && accountPreferenceFingerprint(current) !== accountPreferenceFingerprint(scoped)
  ) {
    // Rebase unsent local work against the last acknowledged snapshot, even
    // when another device updated a different key while this browser closed.
    selected = await persist({ ...current, updatedAt: new Date().toISOString() }, scoped);
  }

  // These template stores were historically browser-only. On the first
  // release that tracks them, preserve a store already belonging to this
  // account when the older cloud snapshot has no copy yet, then upload the
  // migrated snapshot immediately. Never merge when another account owns the
  // browser state: shared-computer templates must not cross users.
  const localPreferencesBelongToUser = activePreferenceOwner === user.id
    || (!activePreferenceOwner && legacyPreferenceOwner === user.id);
  const migratedTemplateValues: Record<string, string> = {};
  if (selected && localPreferencesBelongToUser) {
    for (const key of ACCOUNT_TEMPLATE_STORAGE_KEYS) {
      if (current.values[key] && !selected.values[key]) {
        migratedTemplateValues[key] = current.values[key];
      }
    }
    for (const [key, value] of Object.entries(current.values)) {
      if (key.startsWith("kwantdesk:chart-drawings:v1:") && !selected.values[key]) migratedTemplateValues[key] = value;
    }
  }
  if (selected && Object.keys(migratedTemplateValues).length) {
    selected = {
      ...selected,
      updatedAt: new Date().toISOString(),
      values: { ...selected.values, ...migratedTemplateValues },
    };
    selected = await persist(selected);
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
        ...retainLocalChartAppearance(selected.values, latest.values),
        ...(latest.values["olisa-theme"]
          ? { "olisa-theme": latest.values["olisa-theme"] }
          : {}),
      },
    };
  } else if (localThemeBelongsToUser && themeAtHydrationStart
    && !(cloud && (!scoped || Date.parse(cloud.updatedAt) > Date.parse(scoped.updatedAt)))) {
    // The already-painted local theme is the last skin this same account used
    // on this browser. Do not let an older cloud snapshot repaint it during
    // every refresh; new browsers still receive the account-backed theme.
    selected = {
      ...selected,
      values: {
        ...retainLocalChartAppearance(selected.values, current.values),
        "olisa-theme": themeAtHydrationStart,
      },
    };
  }

  // Naming a theme while the account snapshot is in flight is also a user
  // decision. Preserve that new library, but never import another owner's.
  const libraryKey = "kwantdesk:custom-themes:v1";
  if ((localPreferencesBelongToUser || (!activePreferenceOwner && !legacyPreferenceOwner))
    && latest.values[libraryKey] && latest.values[libraryKey] !== current.values[libraryKey]) {
    selected = { ...selected, updatedAt: latest.updatedAt,
      values: { ...selected.values, [libraryKey]: latest.values[libraryKey] } };
  }

  // GEX can start after verified identity, before optional cloud sync settles.
  // Do not let the late snapshot erase new same-account workspace edits.
  const gexKey = "kwantdesk:gex-data:workspace:v1";
  const gexWorkspace = inFlightGexWorkspace(current.values[gexKey], latest.values[gexKey], user.id);
  if (gexWorkspace) selected = { ...selected, updatedAt: latest.updatedAt,
    values: { ...selected.values, [gexKey]: gexWorkspace } };

  // Cached charts can be used while this same owner's cloud snapshot loads.
  // Keep drawings placed/edited/deleted during that request, merged by ID so
  // independent remote drawings survive too. Never import another owner's.
  if (localPreferencesBelongToUser
    && latest.values[CHART_DRAWING_PREFERENCE_KEY] !== current.values[CHART_DRAWING_PREFERENCE_KEY]) {
    const drawings = mergeChartDrawingPreferences(
      current.values[CHART_DRAWING_PREFERENCE_KEY],
      latest.values[CHART_DRAWING_PREFERENCE_KEY],
      selected.values[CHART_DRAWING_PREFERENCE_KEY],
    );
    if (drawings !== undefined) selected = { ...selected, updatedAt: latest.updatedAt,
      values: { ...selected.values, [CHART_DRAWING_PREFERENCE_KEY]: drawings } };
  }

  const changed = preferenceSnapshotFingerprint(current) !== preferenceSnapshotFingerprint(selected);
  applyBrowserPreferences(selected);
  applyTheme();
  writeProtectedItem(ACTIVE_PREFERENCES_OWNER_KEY, user.id);
  saveScopedPreferences(user.id, acknowledged);
  return { changed, snapshot: selected };
}
