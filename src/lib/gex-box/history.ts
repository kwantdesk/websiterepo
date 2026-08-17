export type GexHistoryView = "classic" | "state" | "orderflow";

/**
 * The live Classic API uses gex_full/gex_zero/gex_one while the signed
 * archive service uses full/zero/one. Keep that provider inconsistency at
 * this boundary so UI categories and saved workspaces remain unchanged.
 */
export function providerHistoryCategory(view: GexHistoryView, category: string) {
  const normalized = category.trim().toLowerCase();
  if (view === "classic") {
    if (normalized === "gex_full" || normalized === "full") return "full";
    if (normalized === "gex_zero" || normalized === "zero") return "zero";
    if (normalized === "gex_one" || normalized === "one") return "one";
  }
  if (view === "orderflow") return "orderflow";
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFrame(value: unknown) {
  if (!isRecord(value)) return false;
  return ("spot" in value || "strikes" in value)
    && ("timestamp" in value || "time" in value || "datetime" in value);
}

function timestampFromKey(key: string) {
  if (/^\d{10,13}$/.test(key)) return Number(key);
  const parsed = Date.parse(key);
  return Number.isFinite(parsed) ? parsed : null;
}

function attachTimestamp(value: unknown, timestamp: unknown) {
  if (!isRecord(value) || value.timestamp !== undefined) return value;
  return { ...value, timestamp };
}

/** Decodes direct arrays plus the envelope variants used by signed archives. */
export function historyRowsFromPayload(payload: unknown, depth = 0): unknown[] | null {
  if (depth > 5) return null;
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed || /^https:\/\//i.test(trimmed)) return null;
    try { return historyRowsFromPayload(JSON.parse(trimmed) as unknown, depth + 1); }
    catch { return null; }
  }
  if (Array.isArray(payload)) {
    if (!payload.length) return [];
    if (payload.length === 2 && (typeof payload[0] === "number" || typeof payload[0] === "string") && isRecord(payload[1])) {
      return [attachTimestamp(payload[1], payload[0])];
    }
    if (payload.some((value) => typeof value === "string" && /^https:\/\//i.test(value))) return null;
    return payload.flatMap((entry) => {
      if (isRecord(entry) && isRecord(entry.frame)) {
        return [attachTimestamp(entry.frame, entry.timestamp ?? entry.time ?? entry.datetime)];
      }
      return [entry];
    });
  }
  if (!isRecord(payload)) return null;
  if (isFrame(payload)) return [payload];

  for (const key of ["data", "history", "frames", "results", "payload", "records", "items", "snapshots", "archive"]) {
    if (payload[key] === undefined) continue;
    const rows = historyRowsFromPayload(payload[key], depth + 1);
    if (rows !== null) return rows;
  }

  const timestamped = Object.entries(payload).flatMap(([key, value]) => {
    const timestamp = timestampFromKey(key);
    return timestamp !== null && isRecord(value) ? [attachTimestamp(value, timestamp)] : [];
  });
  return timestamped.length ? timestamped : null;
}

/** Finds a provider-signed download URL without depending on one envelope. */
export function signedHistoryUrlFromPayload(payload: unknown, depth = 0): string | null {
  if (depth > 5) return null;
  if (typeof payload === "string") return /^https:\/\//i.test(payload.trim()) ? payload.trim() : null;
  if (Array.isArray(payload)) {
    for (const value of payload) {
      const found = signedHistoryUrlFromPayload(value, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(payload)) return null;
  for (const key of ["url", "download_url", "signed_url", "href", "location"]) {
    const value = payload[key];
    if (typeof value === "string" && /^https:\/\//i.test(value.trim())) return value.trim();
  }
  for (const key of ["data", "payload", "result", "archive", "download"]) {
    const found = signedHistoryUrlFromPayload(payload[key], depth + 1);
    if (found) return found;
  }
  return null;
}
