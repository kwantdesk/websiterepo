/** Merge acquired first-page tape events without losing older loaded pages.
 * Only canonical latest-first trade-time selections use this delivery path.
 * Identity comes from the provider ID, never price/time guesses.
 */
export function mergeLiveTapePage(previous, incoming, {maximumRows = 20000, timeField = 'tradeTime'} = {}) {
  if (!Array.isArray(previous) || !Array.isArray(incoming)) throw Error('Invalid live tape rows.');
  const byId = new Map();
  for (const row of [...previous, ...incoming]) {
    if (!row || !['string', 'number'].includes(typeof row.id)) throw Error('Live tape event identity is unavailable.');
    byId.set(typeof row.id + ':' + row.id, row);
  }
  if (byId.size > maximumRows) throw Error('The retained tape is full. Refresh to return to the latest events.');
  const time = row => typeof row[timeField] === 'number' || /^\d+$/.test(String(row[timeField])) ? Number(row[timeField]) : Date.parse(row[timeField]);
  const rows=[...byId.values()];
  if(rows.some(row=>!Number.isFinite(time(row))))throw Error('Live tape timestamp is unavailable.');
  return rows.sort((a, b) => time(b) - time(a));
}

export const mergeEquityLivePage = (previous,incoming,maximumRows=20000) => mergeLiveTapePage(previous,incoming,{maximumRows});
