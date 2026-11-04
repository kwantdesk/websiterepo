// Source984770 Term Structure metadata: arbitrary multi-expiry/strike filters,
// empty arrays mean unrestricted. Public contract: /api/docs/endpoints/term-structure.
// Prices are public dollars, not the private app's integer-cent strike keys.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const strikeOf = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '')
  && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const list = value => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',').map(value => value.trim()).filter(Boolean) : [];
const uniqueDates = values => [...new Set(values)].sort();
const uniqueStrikes = values => [...new Set(values)].sort((a, b) => a - b);

/**
 * The selected arrays are FILTERS: [] means All, never hidden-all. Keep unknown
 * persisted selections intact so a source changing shape cannot broaden them.
 * Resolved visible arrays are just the current payload's matching choices.
 * New arrays deliberately override older range controls, including [] reset.
 */
export function termSelectionState(payload, controls = {}) {
  const data = record(payload?.data) ? payload.data : {};
  const expirations = Object.keys(data).filter(date => validDate(date) && record(data[date])).sort();
  const strikes = uniqueStrikes(expirations.flatMap(date => Object.keys(data[date]).map(strikeOf).filter(value => value !== null)));
  const newExpirations = controls.termExpirations !== undefined;
  const newStrikes = controls.termStrikes !== undefined;
  if (newExpirations && !Array.isArray(controls.termExpirations) || newStrikes && !Array.isArray(controls.termStrikes)) throw Error('Term selections must be arrays.');
  const dateValues = newExpirations ? controls.termExpirations : list(controls.expiry);
  if (dateValues.some(date => !validDate(date))) throw Error('Choose valid Term expiration dates.');
  const selectedExpirations = uniqueDates(dateValues);
  const strikeValues = newStrikes ? controls.termStrikes.map(strikeOf) : [];
  if (strikeValues.some(value => value === null)) throw Error('Choose valid Term strikes in dollars.');
  const selectedStrikes = uniqueStrikes(strikeValues);
  const expiryStart = !newExpirations && controls.expiryStart ? controls.expiryStart : null;
  const expiryEnd = !newExpirations && controls.expiryEnd ? controls.expiryEnd : null;
  if (expiryStart && !validDate(expiryStart) || expiryEnd && !validDate(expiryEnd)
    || expiryStart && expiryEnd && expiryEnd < expiryStart) throw Error('Choose a valid legacy expiration range.');
  const min = !newStrikes && controls.minStrike != null && controls.minStrike !== '' ? strikeOf(controls.minStrike) : null;
  const max = !newStrikes && controls.maxStrike != null && controls.maxStrike !== '' ? strikeOf(controls.maxStrike) : null;
  if (!newStrikes && (controls.minStrike != null && controls.minStrike !== '' && min === null
    || controls.maxStrike != null && controls.maxStrike !== '' && max === null) || min !== null && max !== null && max < min) throw Error('Choose a valid legacy strike range.');
  const visibleExpirations = expirations.filter(date => (!selectedExpirations.length || selectedExpirations.includes(date)) && (!expiryStart || date >= expiryStart) && (!expiryEnd || date <= expiryEnd));
  const visibleStrikes = strikes.filter(strike => (!selectedStrikes.length || selectedStrikes.includes(strike)) && (min === null || strike >= min) && (max === null || strike <= max));
  return { expirations, strikes, selectedExpirations, selectedStrikes, visibleExpirations, visibleStrikes,
    allExpirations: !selectedExpirations.length && !expiryStart && !expiryEnd,
    allStrikes: !selectedStrikes.length && min === null && max === null };
}
