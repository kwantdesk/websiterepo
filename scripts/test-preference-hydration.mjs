import assert from "node:assert/strict";

/**
 * Regression tests for account preference hydration. A workspace quick-saved
 * moments before the app closes exists only in this browser's localStorage
 * until the debounced upload completes. Hydration on the next sign-in must
 * never roll that unsynced work back to an older account snapshot — while a
 * genuinely newer snapshot written by another device must still win.
 */

function createLocalStorageStub() {
  const store = new Map();
  return {
    get length() { return store.size; },
    key(index) { return [...store.keys()][index] ?? null; },
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
  };
}

const localStorage = createLocalStorageStub();
const styleStub = { setProperty() {}, backgroundColor: "", color: "" };
globalThis.window = {
  localStorage,
  dispatchEvent() {},
  requestAnimationFrame(callback) { callback(); return 0; },
};
globalThis.document = {
  documentElement: { style: styleStub, dataset: {} },
  querySelector() { return null; },
};
globalThis.requestAnimationFrame = (callback) => { callback(); return 0; };
globalThis.CustomEvent = globalThis.CustomEvent ?? class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};

const { hydrateUserPreferences } = await import("../src/lib/userPreferences.ts");

const USER_ID = "user-1";
const ACTIVE_OWNER_KEY = "kwantdesk:active-preferences-owner:v1";
const SCOPED_KEY = `kwantdesk:user-preferences:${USER_ID}:v1`;
const PRESETS_KEY = "kwantdesk-chart-workspace-presets";
const LAYOUT_KEY = "olisa-chart-workspace-layout";
const INDICATOR_TEMPLATES_KEY = "kwantdesk:indicator-templates:v1";

function createSupabaseStub(cloudSnapshot) {
  const upserts = [];
  return {
    upserts,
    from(table) {
      return {
        select() {
          const chain = {
            eq() { return chain; },
            async maybeSingle() {
              if (table === "user_preferences" && cloudSnapshot) {
                return { data: { preferences: cloudSnapshot, updated_at: cloudSnapshot.updatedAt }, error: null };
              }
              return { data: null, error: null };
            },
          };
          return chain;
        },
        async upsert(row) {
          upserts.push({ table, row });
          return { error: null };
        },
      };
    },
  };
}

const user = { id: USER_ID, user_metadata: {} };
const T1 = "2026-08-17T20:00:00.000Z";
const T2 = "2026-08-18T02:00:00.000Z";
const snapshotAt = (updatedAt, values) => ({ version: 1, complete: true, updatedAt, values });

// 1. Same-owner browser, no newer cloud write: the unsynced local preset must
//    survive hydration and be uploaded, not rolled back.
localStorage.clear();
localStorage.setItem(ACTIVE_OWNER_KEY, USER_ID);
localStorage.setItem(SCOPED_KEY, JSON.stringify(snapshotAt(T1, { [LAYOUT_KEY]: "single" })));
localStorage.setItem(LAYOUT_KEY, "single");
localStorage.setItem(PRESETS_KEY, JSON.stringify([{ id: "p1", name: "My workspace" }]));
{
  const supabase = createSupabaseStub(snapshotAt(T1, { [LAYOUT_KEY]: "single" }));
  const { changed } = await hydrateUserPreferences(supabase, user);
  assert.equal(changed, false, "unsynced local work must not be reported as replaced");
  assert.ok(localStorage.getItem(PRESETS_KEY)?.includes("My workspace"), "quick-saved workspace must survive sign-in");
  const uploaded = supabase.upserts.find(({ table }) => table === "user_preferences");
  assert.ok(uploaded, "the fresher local state must be uploaded to the account store");
  assert.ok(
    JSON.stringify(uploaded.row.preferences.values[PRESETS_KEY] ?? "").includes("My workspace"),
    "the uploaded snapshot must contain the quick-saved workspace",
  );
}

// 2. Another device wrote a newer account snapshot: it must still win.
localStorage.clear();
localStorage.setItem(ACTIVE_OWNER_KEY, USER_ID);
localStorage.setItem(SCOPED_KEY, JSON.stringify(snapshotAt(T1, { [LAYOUT_KEY]: "single" })));
localStorage.setItem(LAYOUT_KEY, "single");
localStorage.setItem(PRESETS_KEY, JSON.stringify([{ id: "p1", name: "Stale local" }]));
{
  const supabase = createSupabaseStub(snapshotAt(T2, { [LAYOUT_KEY]: "quad" }));
  const { changed } = await hydrateUserPreferences(supabase, user);
  assert.equal(changed, true);
  assert.equal(localStorage.getItem(LAYOUT_KEY), "quad", "the newer cross-device snapshot must apply");
  assert.equal(localStorage.getItem(PRESETS_KEY), null, "keys absent from the newer snapshot are removed");
}

// 3. A fresh browser with no owner receives the account snapshot unchanged.
localStorage.clear();
localStorage.setItem(PRESETS_KEY, JSON.stringify([{ id: "px", name: "Foreign leftovers" }]));
{
  const supabase = createSupabaseStub(snapshotAt(T2, { [LAYOUT_KEY]: "quad" }));
  const { changed } = await hydrateUserPreferences(supabase, user);
  assert.equal(changed, true);
  assert.equal(localStorage.getItem(LAYOUT_KEY), "quad");
  assert.equal(localStorage.getItem(PRESETS_KEY), null);
  assert.equal(localStorage.getItem(ACTIVE_OWNER_KEY), USER_ID);
}

// 4. Template stores that pre-date account sync are merged into this user's
//    newer cloud snapshot once, instead of disappearing during the upgrade.
localStorage.clear();
localStorage.setItem(ACTIVE_OWNER_KEY, USER_ID);
localStorage.setItem(SCOPED_KEY, JSON.stringify(snapshotAt(T1, { [LAYOUT_KEY]: "single" })));
localStorage.setItem(LAYOUT_KEY, "single");
localStorage.setItem(INDICATOR_TEMPLATES_KEY, JSON.stringify({ volume: [{ id: "t1", name: "Shared profile", settings: { width: 42 } }] }));
{
  const supabase = createSupabaseStub(snapshotAt(T2, { [LAYOUT_KEY]: "quad" }));
  await hydrateUserPreferences(supabase, user);
  assert.ok(localStorage.getItem(INDICATOR_TEMPLATES_KEY)?.includes("Shared profile"));
  const uploaded = supabase.upserts.find(({ table, row }) => (
    table === "user_preferences" && row.preferences.values[INDICATOR_TEMPLATES_KEY]
  ));
  assert.ok(uploaded, "legacy local templates must be uploaded into the signed-in account snapshot");
  assert.equal(uploaded.row.preferences.values[LAYOUT_KEY], "quad", "newer unrelated cloud settings remain authoritative");
}

console.log("Preference hydration tests passed.");
