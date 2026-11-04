type Entry = { group: string; before: unknown; after: unknown; restore: (value: unknown) => void };
/** One chronological history across the drawing renderers in a single pane. */
export class DrawingEditHistory {
  private past: Entry[] = [];
  private future: Entry[] = [];
  private gesture = 0;
  private restoring = false;
  clear() { this.past = []; this.future = []; this.beginGesture(); }
  beginGesture() { this.gesture += 1; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  record<T>(engine: string, before: T, after: T, restore: (value: T) => void) {
    if (this.restoring || JSON.stringify(before) === JSON.stringify(after)) return;
    const group = `${this.gesture}:${engine}`, last = this.past.at(-1);
    if (last?.group === group && this.future.length === 0) last.after = structuredClone(after);
    else {
      this.past.push({ group, before: structuredClone(before), after: structuredClone(after), restore: value => restore(value as T) });
      if (this.past.length > 100) this.past.shift();
    }
    this.future = [];
  }
  step(redo = false) {
    const source = redo ? this.future : this.past, target = redo ? this.past : this.future;
    const entry = source.at(-1); if (!entry) return false;
    this.restoring = true;
    try { entry.restore(structuredClone(redo ? entry.after : entry.before)); }
    finally { this.restoring = false; }
    source.pop(); target.push(entry); this.beginGesture(); return true;
  }
}
