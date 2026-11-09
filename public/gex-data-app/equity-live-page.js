/** Merge acquired first-page prints without losing the older loaded pages.
 * Only canonical latest-first trade-time selections use this delivery path.
 * Identity comes from the provider ID, never price/time guesses.
 */
export function mergeEquityLivePage(previous, incoming, maximumRows = 20000) {
  if (!Array.isArray(previous) || !Array.isArray(incoming)) throw Error('Invalid equity tape rows.');
  const byId = new Map();
  for (const row of [...previous, ...incoming]) {
    if (!row || !['string', 'number'].includes(typeof row.id)) throw Error('Equity print identity is unavailable.');
    byId.set(typeof row.id + ':' + row.id, row);
  }
  if (byId.size > maximumRows) throw Error('The retained equity tape is full. Refresh to return to the latest trades.');
  return [...byId.values()].sort((a, b) => Number(b.tradeTime) - Number(a.tradeTime));
}
