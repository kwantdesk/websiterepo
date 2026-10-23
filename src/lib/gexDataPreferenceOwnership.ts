/** Preserve only a verified account's GEX edits made while cloud sync waited. */
export function inFlightGexWorkspace(before: unknown, after: unknown, userId: string): string | null {
  if (!userId || typeof after !== "string" || after === before || after.length > 1_500_000) return null;
  try {
    const workspace = JSON.parse(after);
    if (workspace?.accountKey !== userId || !workspace.values || typeof workspace.values !== "object" || Array.isArray(workspace.values)) return null;
    const entries = Object.entries(workspace.values);
    if (entries.length > 500 || entries.some(([key, value]) => !key.startsWith("gex-data") || key.length > 200 || typeof value !== "string")) return null;
    return after;
  } catch { return null; }
}
