// Undo the earlier default reset without touching feeds/accounts/trades.
export const DISPLAY_ROLLBACK = '20261029-restore-backed-display';
export const DISPLAY_BACKUP_KEY = 'kwantdesk:liquidity-map-display-backup:20261029';
const DEFAULT_RESET = '20261029-oct25';
export function restoreLegacyDisplay(saved, defaults, storage, key) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return saved;
  // Existing custom settings must never be replaced with stock defaults.
  if (saved.displayRollback !== DEFAULT_RESET) return saved;
  let backup;
  try { backup = JSON.parse(storage.getItem(DISPLAY_BACKUP_KEY) || 'null'); } catch { return saved; }
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) return saved;
  const restored = { ...saved, displayRollback: DISPLAY_ROLLBACK };
  for (const [name, defaultValue] of Object.entries(defaults)) {
    if (name === 'uiTheme' || name === 'autoCenter' || !(name in backup)) continue;
    const value = backup[name];
    // Preserve later changes that differ from the default imposed by reset.
    // Values deliberately set back to that exact default are indistinguishable.
    if (saved[name] === defaultValue && (value === null || ['string', 'number', 'boolean'].includes(typeof value))) restored[name] = value;
  }
  try { storage.setItem(key, JSON.stringify(restored)); } catch { return saved; }
  return restored;
}
