// One-time, reversible display rollback. Never changes accounts, trades, feeds,
// instruments, execution quotes or indicator data.
export const DISPLAY_ROLLBACK = '20261029-oct25';
export const DISPLAY_BACKUP_KEY = 'kwantdesk:liquidity-map-display-backup:20261029';
export function restoreLegacyDisplay(saved, defaults, storage, key) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return saved;
  if (saved.displayRollback === DISPLAY_ROLLBACK) return saved;
  // Do not discard the trader's saved configuration if backup storage fails.
  try {
    if (!storage.getItem(DISPLAY_BACKUP_KEY)) storage.setItem(DISPLAY_BACKUP_KEY, JSON.stringify(saved));
  } catch { return saved; }
  const restored = { ...saved, ...defaults, displayRollback: DISPLAY_ROLLBACK };
  delete restored.uiTheme;
  delete restored.autoCenter;
  try { storage.setItem(key, JSON.stringify(restored)); } catch { return saved; }
  return restored;
}
