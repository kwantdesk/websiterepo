/** Short-lived decoded history reuse for same-contract sibling charts. */
export function createChartWarmHistory<T>(weight: (value: T) => number, now = Date.now) {
  const entries = new Map<string, { value: T; until: number; weight: number }>();
  const prune = () => {
    let total = 0;
    for (const [key, entry] of entries) {
      if (entry.until <= now()) entries.delete(key);
      else total += entry.weight;
    }
    while (entries.size > 4 || total > 120_000) {
      const key = entries.keys().next().value;
      if (key === undefined) break;
      total -= entries.get(key)!.weight;
      entries.delete(key);
    }
  };
  return {
    get(key: string): T | undefined { prune(); return entries.get(key)?.value; },
    put(key: string, value: T) {
      entries.delete(key);
      entries.set(key, { value, until: now() + 10_000, weight: Math.max(0, weight(value)) });
      prune();
    },
  };
}
