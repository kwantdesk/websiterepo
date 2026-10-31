import type { GexMapPanelPayload } from "./gexMap";
const mergedHeads = new WeakMap<GexMapPanelPayload, WeakMap<GexMapPanelPayload["frames"], { candles: GexMapPanelPayload["candles"]; payload: GexMapPanelPayload }>>();
const parents = new WeakMap<GexMapPanelPayload["frames"], { frames: WeakRef<GexMapPanelPayload["frames"]>; dirtyFrom: number }>();
export function bounceGexMapHistoryParent(frames: GexMapPanelPayload["frames"]) { return parents.get(frames); }
const sameRows = (a: GexMapPanelPayload["latestStrikes"], b: GexMapPanelPayload["latestStrikes"]) =>
  a.length === b.length && a.every((r, i) => r.strike === b[i].strike && r.net === b[i].net && r.call === b[i].call && r.put === b[i].put);

/** Compact map responses contain comparison checkpoints, not a session tape. */
export function mergeBounceGexMapHistory(history: GexMapPanelPayload, head: GexMapPanelPayload): GexMapPanelPayload {
  if (history.symbol !== head.symbol || history.sessionDate !== head.sessionDate || history.greekMode !== head.greekMode
    || history.scope !== head.scope || history.representation !== head.representation || history.model !== head.model) return head;
  let variants = mergedHeads.get(head);
  const cached = variants?.get(history.frames);
  if (cached?.candles === history.candles) return cached.payload;
  const latest = head.frames.at(-1), last = history.frames.at(-1)?.timestamp ?? 0;
  let frames = history.frames, dirtyFrom = frames.length;
  const changeFrames = () => { if (frames === history.frames) frames = [...history.frames]; };
  // A compact checkpoint can refresh a REAL recorded minute, but cannot
  // create a historical observation at a synthetic lookback timestamp.
  for (const f of head.frames) {
    const index = history.frames.findIndex((v) => v.timestamp === f.timestamp);
    if (index >= 0 && !sameRows(history.frames[index].updates, f.updates)) {
      changeFrames(); frames[index] = f; dirtyFrom = Math.min(dirtyFrom, index);
    } else if (f === latest && f.timestamp > last) { changeFrames(); frames.push(f); }
  }
  let candles = history.candles;
  let mergedCandles: Map<number, GexMapPanelPayload["candles"][number]> | null = null;
  for (const c of head.candles) {
    const old = candles.find((v) => v.timestamp === c.timestamp);
    if (old?.close === c.close) continue;
    if (!mergedCandles) mergedCandles = new Map(candles.map((v) => [v.timestamp, v]));
    mergedCandles.set(c.timestamp, c);
    const index = frames.findIndex((f) => f.timestamp >= c.timestamp);
    if (index >= 0) { changeFrames(); dirtyFrom = Math.min(dirtyFrom, index); }
  }
  if (mergedCandles) candles = [...mergedCandles.values()].sort((a, b) => a.timestamp - b.timestamp);
  if (frames !== history.frames) parents.set(frames, { frames: new WeakRef(history.frames), dirtyFrom });
  const payload = { ...head, frames, candles };
  if (!variants) { variants = new WeakMap(); mergedHeads.set(head, variants); }
  variants.set(history.frames, { candles: history.candles, payload });
  return payload;
}
