import { strToU8, strFromU8, zlibSync, unzlibSync } from "fflate";
const PREFIX = "kwantdesk:packed-preference-cache:v1:";
const MAX_BYTES = 32 * 1024 * 1024;
/** Local acknowledged-account cache only. Cloud rows and workspace files stay plain JSON. */
export function packPreferenceCache(raw: string) {
  if (raw.startsWith(PREFIX) || raw.length < 32_768) return raw;
  const bytes = strToU8(raw);
  if (bytes.length > MAX_BYTES) return raw;
  const packed = zlibSync(bytes, { level: 1 });
  let binary = "";
  for (let i = 0; i < packed.length; i += 8192) binary += String.fromCharCode(...packed.subarray(i, i + 8192));
  const value = PREFIX + bytes.length + ":" + btoa(binary);
  return value.length < raw.length ? value : raw;
}
export function unpackPreferenceCache(value: string) {
  if (!value.startsWith(PREFIX)) return value;
  const separator = value.indexOf(":", PREFIX.length);
  const length = Number(value.slice(PREFIX.length, separator));
  if (separator < 0 || !Number.isSafeInteger(length) || length <= 0 || length > MAX_BYTES) throw Error("Invalid preference cache");
  const binary = atob(value.slice(separator + 1));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const decoded = unzlibSync(bytes, { out: new Uint8Array(length) });
  const raw = strFromU8(decoded);
  if (strToU8(raw).length !== length) throw Error("Incomplete preference cache");
  return raw;
}
/** Lossless migration in place, never removal of a workspace, ledger or drawing. */
export function compactScopedPreferenceCaches(store: Storage) {
  const keys: string[] = [];
  try { for (let i = 0; i < store.length; i++) { const key = store.key(i); if (key && /^kwantdesk:user-preferences:.+:v1$/.test(key)) keys.push(key); } } catch { return 0; }
  let reclaimedBytes = 0;
  for (const key of keys) {
    try {
      const previous = store.getItem(key);
      if (!previous || previous.startsWith(PREFIX)) continue;
      const packed = packPreferenceCache(previous);
      if (packed === previous) continue;
      // Read back and verify before replacing the original acknowledged copy.
      if (unpackPreferenceCache(packed) !== previous) continue;
      store.setItem(key, packed);
      reclaimedBytes += (previous.length - packed.length) * 2;
    } catch { /* The old cache remains intact on a refused write. */ }
  }
  return reclaimedBytes;
}
