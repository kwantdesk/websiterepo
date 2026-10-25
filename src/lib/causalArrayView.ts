/** Read-only prefix view: O(1) clock advance, no quadratic history copies. */
export function causalArrayView<T>(source: T[], length: () => number): T[] {
  const size = () => Math.max(0, Math.min(source.length, Math.floor(length())));
  const index = (key: PropertyKey) => typeof key === "string" && /^(0|[1-9]\d*)$/.test(key) ? Number(key) : null;
  return new Proxy(source, {
    get(target, key, receiver) {
      if (key === "length") return size();
      const at = index(key);
      return at !== null && at >= size() ? undefined : Reflect.get(target, key, receiver);
    },
    has(target, key) { const at = index(key); return at !== null && at >= size() ? false : Reflect.has(target, key); },
    ownKeys(target) { return Reflect.ownKeys(target).filter(key => { const at = index(key); return at === null || at < size(); }); },
    getOwnPropertyDescriptor(target, key) {
      const at = index(key);
      if (at !== null && at >= size()) return undefined;
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      return key === "length" && descriptor ? { ...descriptor, value: size() } : descriptor;
    },
    set() { throw new Error("Backtest history is read-only."); },
    defineProperty() { throw new Error("Backtest history is read-only."); },
    deleteProperty() { throw new Error("Backtest history is read-only."); },
  });
}
