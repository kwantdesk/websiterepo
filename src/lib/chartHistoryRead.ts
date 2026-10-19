/** Start a read now, but consume its result later without unhandled rejection.
 * Used to overlap candle history with optional cache/seam hydration. */
export function beginChartHistoryRead<T>(read: () => Promise<T>): () => Promise<T> {
  const settled = (async () => read())().then(
    value => ({ ok: true as const, value }),
    error => ({ ok: false as const, error }),
  );
  return async () => {
    const result = await settled;
    if (!result.ok) throw result.error;
    return result.value;
  };
}

/** Browser persistence is optional. A busy/blocked IndexedDB must not hold
 * authoritative network history behind an indefinitely pending cache read. */
export async function readChartCacheWithin<T>(
  read: () => Promise<T>, fallback: T, waitMs = 250,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => read())().catch(() => fallback),
      new Promise<T>(resolve => { timer = setTimeout(() => resolve(fallback), waitMs); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
