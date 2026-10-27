import type { JournalTrade } from './journal';

/** P&L can establish an outcome, never an execution path or position size. */
export function journalManualOutcome(draft: {
  netPnl: string; symbol: string; side: string; quantity: string;
  openedAt: string; closedAt: string;
}, bookingDate: string): Pick<JournalTrade, 'netPnl' | 'symbol' | 'side' | 'quantity' |
  'openedAt' | 'closedAt' | 'entryTimeKnown' | 'exitTimeKnown' | 'durationMs'> {
  const netPnl = Number(draft.netPnl);
  if (!draft.netPnl.trim() || !Number.isFinite(netPnl)) throw new Error('Enter a valid net profit or loss. Use minus for a loss.');
  const quantity = draft.quantity.trim() ? Number(draft.quantity) : 0;
  if (!Number.isFinite(quantity) || (draft.quantity.trim() && quantity <= 0)) throw new Error('Contracts must be positive when supplied.');
  const entryTimeKnown = Boolean(draft.openedAt.trim());
  const exitTimeKnown = Boolean(draft.closedAt.trim());
  const closed = exitTimeKnown ? Date.parse(draft.closedAt) : null;
  // A reporting date is not a claimed entry time. Noon avoids DST midnight seams.
  const opened = entryTimeKnown ? Date.parse(draft.openedAt) : closed ?? Date.parse(`${bookingDate}T12:00:00`);
  if (!Number.isFinite(opened) || (closed !== null && !Number.isFinite(closed))) throw new Error('Choose a valid trade date or execution time.');
  if (entryTimeKnown && closed !== null && closed < opened) throw new Error('Exit time cannot be before entry time.');
  return {
    netPnl, quantity, symbol: draft.symbol.trim().toUpperCase().slice(0, 32) || 'UNSPECIFIED',
    side: draft.side === 'LONG' || draft.side === 'SHORT' ? draft.side : 'UNKNOWN',
    openedAt: new Date(opened).toISOString(), closedAt: closed === null ? null : new Date(closed).toISOString(),
    entryTimeKnown, exitTimeKnown, durationMs: entryTimeKnown && closed !== null ? closed - opened : null,
  };
}
