import type { UserPreferenceSnapshot } from './userPreferences';
import { normalizePaperTradingLedger, paperAccountJournalFills, type PaperAccountLedger, type PaperPosition, type PaperTradeFill } from './paperTrading';

export const PAPER_LEDGER_KEY = 'kwantify-paper-trading-ledger-v1';
const PAPER_ACCOUNTS_KEY = 'kwantify-paper-trading-accounts';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const parse = (text?: string) => { try { return JSON.parse(text ?? 'null'); } catch { return null; } };

function executionPosition(position: PaperPosition) {
  const { markPrice: _mark, unrealizedPnl: _pnl, protectionMarkPrice: _protection,
    protectionQuoteAt: _clock, bestPrice: _best, worstPrice: _worst, ...intent } = position;
  return intent;
}
function executionAccount(account: PaperAccountLedger) {
  const { updatedAt: _updated, ...state } = account;
  return { ...state, positions: account.positions.map(executionPosition) };
}
export function preferenceValueFingerprint(key: string, value?: string) {
  if (key.startsWith('kwantdesk:precision-tools:v1:') && value !== undefined) {
    const document = parse(value);
    if (document) { const { savedAt: _saved, ...content } = document; return JSON.stringify(content); }
  }
  if (key !== PAPER_LEDGER_KEY || value === undefined) return value;
  const ledger = normalizePaperTradingLedger(parse(value));
  return JSON.stringify(Object.fromEntries(Object.entries(ledger.accounts)
    .sort(([a], [b]) => a.localeCompare(b)).map(([id, account]) => [id, executionAccount(account)])));
}
export function accountPreferenceFingerprint(snapshot: UserPreferenceSnapshot) {
  return JSON.stringify(Object.keys(snapshot.values).sort().map(key => [key, preferenceValueFingerprint(key, snapshot.values[key])]));
}

function mergeById<T extends { id: string }>(base: T[], local: T[], remote: T[], choose?: (a: T, b: T) => T) {
  const originals = new Map(base.map(item => [item.id, item]));
  const result = new Map(remote.map(item => [item.id, item]));
  for (const item of local) {
    const old = originals.get(item.id), other = result.get(item.id);
    if (old && !other) continue; // A peer explicitly removed this existing object.
    if (!same(item, old)) result.set(item.id, other && choose ? choose(item, other) : item);
  }
  for (const old of base) if (!local.some(item => item.id === old.id) && same(result.get(old.id), old)) result.delete(old.id);
  return [...result.values()];
}

/** Concurrent quote marks never win over a changed stop, fill or closed position. */
function mergeTradingAccount(base: PaperAccountLedger | undefined, local: PaperAccountLedger, remote: PaperAccountLedger): PaperAccountLedger {
  const localChanged = !same(base && executionAccount(base), executionAccount(local));
  const remoteChanged = !same(base && executionAccount(base), executionAccount(remote));
  if (!localChanged) return remote;
  if (!remoteChanged) return local;
  const allFills = new Map<string, PaperTradeFill>();
  for (const fill of [...paperAccountJournalFills(remote), ...paperAccountJournalFills(local)]) allFills.set(fill.id, fill);
  // Both browsers can observe the same protective touch. Admit no more than
  // the position's actual entry quantity, in real source-time order.
  const positionsById = new Map([...remote.positions, ...local.positions].map(p => [p.id, p]));
  const exited = new Map<string, number>();
  const entries = new Map<string, PaperTradeFill>();
  const accepted: PaperTradeFill[] = [];
  for (const fill of [...allFills.values()].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))) {
    if (fill.role === 'entry') {
      const key = fill.orderId;
      if (!entries.has(key)) { entries.set(key, fill); accepted.push(fill); }
      continue;
    }
    const position = positionsById.get(fill.positionId);
    const entry = [...entries.values()].find(item => item.positionId === fill.positionId);
    const capacity = position?.quantity ?? entry?.quantity;
    const used = exited.get(fill.positionId) ?? 0;
    if (capacity !== undefined && used + fill.quantity > capacity + 1e-9) continue;
    accepted.push(fill); exited.set(fill.positionId, used + fill.quantity);
  }
  const acceptedIds = new Set(accepted.map(fill => fill.id));
  const baselineIds = new Set(base ? paperAccountJournalFills(base).map(fill => fill.id) : []);
  const newPnl = accepted.filter(fill => !baselineIds.has(fill.id)).reduce((sum, fill) => sum + fill.realizedPnl, 0);
  const baseCash = base?.cashBalance ?? local.startingBalance;
  const baseRealized = base?.realizedPnl ?? 0;
  const positions = mergeById(base?.positions ?? [], local.positions, remote.positions, (a, b) => {
    if (b.status === 'closed') return b;
    if (a.status === 'closed') return a;
    const original = base?.positions.find(p => p.id === a.id);
    const chosen = original && same(executionPosition(a), executionPosition(original)) ? b : a;
    return { ...chosen, takeProfits: chosen.takeProfits.map(target => ({ ...target,
      filledQuantity: Math.max(target.filledQuantity,
        a.takeProfits.find(t => t.id === target.id)?.filledQuantity ?? 0,
        b.takeProfits.find(t => t.id === target.id)?.filledQuantity ?? 0) })) };
  }).filter(position => !base?.positions.some(p => p.id === position.id)
    || (local.positions.some(p => p.id === position.id) && remote.positions.some(p => p.id === position.id)))
  .map(position => {
    const remainingQuantity = Math.min(position.remainingQuantity, Math.max(0, position.quantity - (exited.get(position.id) ?? 0)));
    return { ...position, remainingQuantity, status: remainingQuantity > 0 ? 'open' as const : 'closed' as const };
  });
  // A position absent after a known local/remote reset cannot be resurrected
  // merely by a stale marking packet.
  const orders = mergeById(base?.orders ?? [], local.orders, remote.orders, (a, b) =>
    b.status === 'filled' || (b.status === 'cancelled' && a.status === 'working') ? b : a)
    .filter(order => !base?.orders.some(o => o.id === order.id)
      || (local.orders.some(o => o.id === order.id) && remote.orders.some(o => o.id === order.id)));
  const expectedPnl = (account: PaperAccountLedger) => paperAccountJournalFills(account)
    .filter(fill => !baselineIds.has(fill.id)).reduce((sum, fill) => sum + fill.realizedPnl, 0);
  const localAdjustment = local.cashBalance - baseCash - expectedPnl(local);
  const remoteAdjustment = remote.cashBalance - baseCash - expectedPnl(remote);
  const adjustment = localAdjustment !== 0 ? localAdjustment : remoteAdjustment;
  const localRealizedAdjustment = local.realizedPnl - baseRealized - expectedPnl(local);
  const remoteRealizedAdjustment = remote.realizedPnl - baseRealized - expectedPnl(remote);
  const realizedAdjustment = localRealizedAdjustment !== 0 ? localRealizedAdjustment : remoteRealizedAdjustment;
  return { ...remote, startingBalance: local.startingBalance !== base?.startingBalance ? local.startingBalance : remote.startingBalance,
    cashBalance: baseCash + newPnl + adjustment, realizedPnl: baseRealized + newPnl + realizedAdjustment,
    positions, orders,
    fills: mergeById(base?.fills ?? [], local.fills, remote.fills).filter(fill => acceptedIds.has(fill.id)),
    journalFills: accepted, updatedAt: Math.max(local.updatedAt, remote.updatedAt) };
}

export function mergeAccountPreferenceChanges(base: UserPreferenceSnapshot, local: UserPreferenceSnapshot, remote: UserPreferenceSnapshot): UserPreferenceSnapshot {
  const values = { ...remote.values };
  const keys = new Set([...Object.keys(base.values), ...Object.keys(local.values)]);
  for (const key of keys) {
    if (preferenceValueFingerprint(key, base.values[key]) === preferenceValueFingerprint(key, local.values[key])) continue;
    if (local.values[key] === undefined) delete values[key];
    else if (key === PAPER_LEDGER_KEY && remote.values[key]) {
      const b = normalizePaperTradingLedger(parse(base.values[key]));
      const l = normalizePaperTradingLedger(parse(local.values[key]));
      const r = normalizePaperTradingLedger(parse(remote.values[key]));
      const accounts = { ...r.accounts };
      for (const [id, account] of Object.entries(l.accounts)) {
        if (!r.accounts[id] && b.accounts[id]) continue;
        accounts[id] = r.accounts[id] ? mergeTradingAccount(b.accounts[id], account, r.accounts[id]) : account;
      }
      for (const id of Object.keys(b.accounts)) if (!l.accounts[id]) delete accounts[id];
      values[key] = JSON.stringify({ version: 1, accounts });
    } else if (key === PAPER_ACCOUNTS_KEY && Array.isArray(parse(remote.values[key]))) {
      values[key] = JSON.stringify(mergeById(parse(base.values[key]) ?? [], parse(local.values[key]) ?? [], parse(remote.values[key]) ?? []));
    } else values[key] = local.values[key];
  }
  return { version: 1, complete: true, updatedAt: same(values, remote.values) ? remote.updatedAt : new Date().toISOString(), values };
}
