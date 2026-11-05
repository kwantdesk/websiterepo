const library = "kwantdesk-chart-workspace-presets";
const keys = new Set([library, "kwantdesk:gamma-charting:" + library, "kwantdesk:algo-charting:" + library, "kwantdesk:workspace-preset-deletions:v1"]);
type ConfirmedValue = { value: string; blockedLocalValue: string | null };
const confirmed = new Map<string, Map<string, ConfirmedValue>>();
export const isWorkspaceLibraryPreference = (key: string) => keys.has(key);
export function recordConfirmedWorkspacePreference(userId: string, key: string, value: string | undefined, locallyStored: boolean) {
  if (!isWorkspaceLibraryPreference(key)) return;
  if (locallyStored || value === undefined) { confirmed.get(userId)?.delete(key); return; }
  let values = confirmed.get(userId);
  if (!values) { values = new Map(); confirmed.set(userId, values); }
  values.set(key, { value, blockedLocalValue: typeof window === "undefined" ? null : window.localStorage.getItem(key) });
}
function confirmedValue(userId: string, key: string, localValue: string | null) {
  const entry = confirmed.get(userId)?.get(key);
  if (!entry) return undefined;
  // Another tab may have succeeded locally since our quota refusal. Its new
  // explicit edit must not be shadowed indefinitely by this confirmed copy.
  if (entry.blockedLocalValue !== localValue) { confirmed.get(userId)?.delete(key); return undefined; }
  return entry.value;
}
export function confirmedWorkspacePreferences(userId: string) {
  return Object.fromEntries([...confirmed.get(userId)?.keys() ?? []].flatMap(key => {
    const value = confirmedValue(userId, key, typeof window === "undefined" ? null : window.localStorage.getItem(key));
    return value === undefined ? [] : [[key, value]];
  }));
}
export function clearConfirmedWorkspacePreferences(userId: string) { confirmed.delete(userId); }
export function readWorkspacePreferenceValue(key: string) {
  if (typeof window === "undefined") return null;
  const owner = window.localStorage.getItem("kwantdesk:active-preferences-owner:v1");
  const localValue = window.localStorage.getItem(key);
  return (owner ? confirmedValue(owner, key, localValue) : undefined) ?? localValue;
}
