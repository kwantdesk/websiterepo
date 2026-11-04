/** One-shot, memory-only transfer from an already mounted chart to its copy. */
export function createChartDuplicateSeeds<T>() {
  const providers = new Map<string, () => T | null>();
  const pending = new Map<string, T>();
  return {
    register(id: string, provider: () => T | null) {
      providers.set(id, provider);
      return () => { if (providers.get(id) === provider) providers.delete(id); };
    },
    copy(source: string, destination: string) {
      const value = providers.get(source)?.();
      if (!value) return false;
      pending.set(destination, value);
      while (pending.size > 8) pending.delete(pending.keys().next().value!);
      return true;
    },
    peek(id: string) { return pending.get(id) ?? null; },
    discard(id: string) { pending.delete(id); },
  };
}
