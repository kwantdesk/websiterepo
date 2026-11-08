import type { OptionsVwapEvent } from './optionsVwap';

type Group = { members: Map<string, OptionsVwapEvent>; notional: number; contracts: number; latest: number; side: number; received: number };
const valid = (event: OptionsVwapEvent) => event.length === 5 && event.every(Number.isFinite)
  && event[0] >= 1e12 && event[1] > 0 && Number.isInteger(event[2]) && event[2] > 0 && Math.abs(event[3]) === 1;
const sameTrade = (a: OptionsVwapEvent, b: OptionsVwapEvent) => a.slice(0, 4).every((value, index) => value === b[index]);

/** Shared exact ledger, rendered as one-second weighted groups.
 * Grouping preserves sum(price*contracts) and sum(contracts), not a sample
 * cap. Raw IDs remain available for duplicate/correction/cancellation checks.
 * The enclosing dated subscription releases the ledger on day/range changes.
 */
export class OptionsVwapLedger {
  private records = new Map<string, { event: OptionsVwapEvent; key: string }>();
  private groups = new Map<string, Group>();
  private cancelled = new Set<string>();
  private revision = 0;
  private outputRevision = -1;
  private output: { ids: string[]; events: OptionsVwapEvent[] } = { ids: [], events: [] };

  get size() { return this.records.size; }
  private remove(id: string) {
    const previous = this.records.get(id);
    if (!previous) return false;
    const group = this.groups.get(previous.key)!;
    group.members.delete(id);
    group.contracts -= previous.event[2];
    group.notional -= previous.event[1] * previous.event[2];
    if (!group.members.size) this.groups.delete(previous.key);
    else if (group.latest === previous.event[0]) {
      group.latest = 0;
      for (const event of group.members.values()) group.latest = Math.max(group.latest, event[0]);
    }
    this.records.delete(id);
    this.revision++;
    return true;
  }
  cancel(id: string) { this.cancelled.add(id); return this.remove(id); }
  upsert(id: string, value: OptionsVwapEvent) {
    if (!id || this.cancelled.has(id) || !valid(value)) return false;
    let event = value;
    const previous = this.records.get(id)?.event;
    if (previous) {
      if (sameTrade(previous, event)) {
        if (previous[4] <= event[4]) return false;
        event = [...event.slice(0, 4), Math.min(previous[4], event[4])] as OptionsVwapEvent;
      } else if (event[4] < previous[4]) return false;
      this.remove(id);
    }
    const key = `${Math.floor(event[0] / 1000)}|${event[3]}|${event[4]}`;
    let group = this.groups.get(key);
    if (!group) { group = { members: new Map(), notional: 0, contracts: 0, latest: event[0], side: event[3], received: event[4] }; this.groups.set(key, group); }
    group.members.set(id, event);
    group.contracts += event[2];
    group.notional += event[1] * event[2];
    group.latest = Math.max(group.latest, event[0]);
    this.records.set(id, { event, key });
    this.revision++;
    return true;
  }
  snapshot() {
    if (this.outputRevision === this.revision) return this.output;
    const rows = [...this.groups.entries()].sort((a, b) => a[1].latest - b[1].latest);
    this.output = { ids: rows.map(([key]) => `second:${key}`), events: rows.map(([, group]): OptionsVwapEvent => [group.latest, group.notional / group.contracts, group.contracts, group.side, group.received]) };
    this.outputRevision = this.revision;
    return this.output;
  }
}
