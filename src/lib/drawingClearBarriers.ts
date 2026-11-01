/** Clear intent travels with account preferences, separately from drawing data.
 * Older snapshots must acknowledge the clear before their drawings can merge.
 * The existing tracked prefix also keeps this metadata on older clients. */
export const DRAWING_CLEAR_BARRIERS_KEY = "kwantdesk:chart-drawings:v1:clear-barriers";
type Barrier = { at: number; token: string };
type Values = Record<string, string>;

function parse(value?: string): Record<string, Barrier> {
  try {
    const entries = Object.entries(JSON.parse(value ?? "{}"));
    return Object.fromEntries(entries.filter((entry): entry is [string, Barrier] => Boolean(entry[1]) && typeof entry[1] === "object"
      && Number.isFinite((entry[1] as Barrier).at) && typeof (entry[1] as Barrier).token === "string"));
  } catch { return {}; }
}

export function chartDrawingPaneDocumentKey(storageKey: string, pane: string) {
  return `pane:${JSON.stringify([storageKey, pane])}`;
}

export function drawingClearToken(documentKey: string): string | undefined {
  if (typeof window === "undefined") return;
  try { return parse(window.localStorage.getItem(DRAWING_CLEAR_BARRIERS_KEY) ?? undefined)[documentKey]?.token; }
  catch { return; }
}

export function markDrawingDocumentCleared(documentKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const ledger = parse(window.localStorage.getItem(DRAWING_CLEAR_BARRIERS_KEY) ?? undefined);
    const at = Math.max(Date.now(), (ledger[documentKey]?.at ?? 0) + 1);
    ledger[documentKey] = { at, token: crypto.randomUUID() };
    window.localStorage.setItem(DRAWING_CLEAR_BARRIERS_KEY, JSON.stringify(ledger));
  } catch { /* The chart's generation guard still protects this session. */ }
}

/** Apply after ordinary preference merging, including unchanged local documents:
 * an old remote row must not undo an already acknowledged local clear. */
export function mergeDrawingClearBarriers(local: Values, remote: Values, merged: Values): Values {
  const left = parse(local[DRAWING_CLEAR_BARRIERS_KEY]);
  const right = parse(remote[DRAWING_CLEAR_BARRIERS_KEY]);
  const ledger = { ...right };
  const values = { ...merged };
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const l = left[key], r = right[key];
    const localWins = Boolean(l && (!r || l.at > r.at || (l.at === r.at && l.token > r.token)));
    ledger[key] = localWins ? l : r;
    if (l?.token === r?.token) continue;
    const authoritative = localWins ? local : remote;
    if (key.startsWith("pane:")) {
      try {
        const [storageKey, pane] = JSON.parse(key.slice(5)) as [string, string];
        const source = JSON.parse(authoritative[storageKey] ?? "{}");
        const result = JSON.parse(values[storageKey] ?? "{}");
        result[pane] = Array.isArray(source[pane]) ? source[pane] : [];
        values[storageKey] = JSON.stringify(result);
      } catch { /* Malformed documents are handled by their normal validator. */ }
    } else if (authoritative[key] !== undefined) values[key] = authoritative[key];
    else delete values[key];
  }
  if (Object.keys(ledger).length) values[DRAWING_CLEAR_BARRIERS_KEY] = JSON.stringify(ledger);
  return values;
}
