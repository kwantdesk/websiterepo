import type { UserPreferenceSnapshot } from './userPreferences';
import { CHART_DRAWING_PREFERENCE_KEY, mergeChartDrawingPreferences } from './chartDrawingPreferences';
import { normalizePaperTradingLedger, paperAccountJournalFills, type PaperAccountLedger, type PaperPosition, type PaperTradeFill, type PaperTradingLedger } from './paperTrading';

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
    // Terminal execution policies must run even when the local object equals
    // the baseline; a stale peer may be the side that changed it backwards.
    if (!same(item, old) || (other && choose)) result.set(item.id, other && choose ? choose(item, other) : item);
  }
  for (const old of base) if (!local.some(item => item.id === old.id) && same(result.get(old.id), old)) result.delete(old.id);
  return [...result.values()];
}

/** Concurrent quote marks never win over a changed stop, fill or closed position. */
function executionConflict(known: PaperAccountLedger, incoming: PaperAccountLedger) {
  const knownFills = paperAccountJournalFills(known);
  const entered = new Map<string, number>(), exited = new Map<string, number>();
  for (const fill of knownFills) {
    const totals = fill.role === 'entry' ? entered : exited;
    totals.set(fill.positionId, (totals.get(fill.positionId) ?? 0) + fill.quantity);
  }
  const closed = new Set(known.positions.filter(p => p.status === 'closed' || p.remainingQuantity <= 0).map(p => p.id));
  if (incoming.positions.some(p => {
    const previous = known.positions.find(position => position.id === p.id);
    const recordedRemaining = entered.has(p.id) ? Math.max(0, entered.get(p.id)! - (exited.get(p.id) ?? 0)) : Infinity;
    return p.status === 'open' && (closed.has(p.id)
      || p.remainingQuantity > Math.min(previous?.remainingQuantity ?? Infinity, recordedRemaining) + 1e-9);
  })) return true;
  const finalOrders = new Set(known.orders.filter(order => ['filled', 'cancelled', 'rejected'].includes(order.status)).map(order => order.id));
  if (incoming.orders.some(order => order.status === 'working' && finalOrders.has(order.id))) return true;
  const fills = new Map(knownFills.map(fill => [fill.id, fill]));
  return paperAccountJournalFills(incoming).some(fill => {
    const recorded = fills.get(fill.id);
    return recorded && (recorded.price !== fill.price || recorded.quantity !== fill.quantity
      || recorded.role !== fill.role || recorded.timestamp !== fill.timestamp || recorded.realizedPnl !== fill.realizedPnl);
  });
}

function mergeTradingAccount(base: PaperAccountLedger | undefined, local: PaperAccountLedger, remote: PaperAccountLedger): PaperAccountLedger {
  const clearedFillIds = [...new Set([...(local.clearedFillIds ?? []), ...(remote.clearedFillIds ?? [])])].sort();
  const cleared = new Set(clearedFillIds);
  const finish = (account: PaperAccountLedger): PaperAccountLedger => clearedFillIds.length
    ? { ...account, clearedFillIds, fills: account.fills.filter(fill => !cleared.has(fill.id)) } : account;
  const localChanged = !same(base && executionAccount(base), executionAccount(local));
  const remoteChanged = !same(base && executionAccount(base), executionAccount(remote));
  const conflict = executionConflict(local, remote) || executionConflict(remote, local);
  if (!localChanged && !remoteChanged) return finish(local);
  if (!localChanged && !conflict) return finish(remote);
  if (!remoteChanged && !conflict) return finish(local);
  const baselineFills = new Map(base ? paperAccountJournalFills(base).map(fill => [fill.id, fill]) : []);
  const allFills = new Map<string, PaperTradeFill>();
  for (const fill of [...paperAccountJournalFills(remote), ...paperAccountJournalFills(local)]) {
    const previous = allFills.get(fill.id);
    // Recorded fills are immutable. Before acknowledgement, the first actual
    // exit wins; a later stale-peer protective fill cannot reprice that exit.
    const first = previous && (previous.timestamp < fill.timestamp
      || (previous.timestamp === fill.timestamp && JSON.stringify(previous) < JSON.stringify(fill))) ? previous : fill;
    allFills.set(fill.id, baselineFills.get(fill.id) ?? first);
  }
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
    // Protection is independent intent, not part of a whole-position winner.
    // A partial fill or target edit can carry the baseline's null/older stop.
    // Only an actual stop edit may replace the peer's changed stop (including
    // an explicit removal); do not infer intent from quote/account timestamps.
    const stopLoss = original && same(a.stopLoss, original.stopLoss) ? b.stopLoss : a.stopLoss;
    const takeProfits = mergeById(original?.takeProfits ?? [], a.takeProfits, b.takeProfits, (left, right) => {
      const previous = original?.takeProfits.find(target => target.id === left.id);
      return { ...left,
        price: previous && same(left.price, previous.price) ? right.price : left.price,
        quantity: previous && same(left.quantity, previous.quantity) ? right.quantity : left.quantity,
        filledQuantity: Math.max(left.filledQuantity, right.filledQuantity),
      };
    });
    return { ...chosen, stopLoss, takeProfits: takeProfits.map(target => ({ ...target,
      filledQuantity: Math.max(target.filledQuantity,
        a.takeProfits.find(t => t.id === target.id)?.filledQuantity ?? 0,
        b.takeProfits.find(t => t.id === target.id)?.filledQuantity ?? 0) })) };
  }).filter(position => !base?.positions.some(p => p.id === position.id)
    || (local.positions.some(p => p.id === position.id) && remote.positions.some(p => p.id === position.id)))
  .map(position => {
    const remainingQuantity = position.status === 'closed' ? 0
      : Math.min(position.remainingQuantity, Math.max(0, position.quantity - (exited.get(position.id) ?? 0)));
    return { ...position, remainingQuantity, status: remainingQuantity > 0 ? 'open' as const : 'closed' as const };
  });
  // A position absent after a known local/remote reset cannot be resurrected
  // merely by a stale marking packet.
  const orders = mergeById(base?.orders ?? [], local.orders, remote.orders, (a, b) =>
    b.status === 'filled' || (a.status === 'working' && (b.status === 'cancelled' || b.status === 'rejected')) ? b : a)
    .filter(order => !base?.orders.some(o => o.id === order.id)
      || (local.orders.some(o => o.id === order.id) && remote.orders.some(o => o.id === order.id)));
  const baselinePnl = [...baselineFills.values()].reduce((sum, fill) => sum + fill.realizedPnl, 0);
  const expectedPnl = (account: PaperAccountLedger) => paperAccountJournalFills(account)
    .reduce((sum, fill) => sum + fill.realizedPnl, -baselinePnl);
  const localAdjustment = local.cashBalance - baseCash - expectedPnl(local);
  const remoteAdjustment = remote.cashBalance - baseCash - expectedPnl(remote);
  const adjustment = localAdjustment !== 0 ? localAdjustment : remoteAdjustment;
  const localRealizedAdjustment = local.realizedPnl - baseRealized - expectedPnl(local);
  const remoteRealizedAdjustment = remote.realizedPnl - baseRealized - expectedPnl(remote);
  const realizedAdjustment = localRealizedAdjustment !== 0 ? localRealizedAdjustment : remoteRealizedAdjustment;
  return finish({ ...remote, startingBalance: local.startingBalance !== base?.startingBalance ? local.startingBalance : remote.startingBalance,
    cashBalance: baseCash + newPnl + adjustment, realizedPnl: baseRealized + newPnl + realizedAdjustment,
    positions, orders,
    fills: mergeById(base?.fills ?? [], local.fills, remote.fills).filter(fill => acceptedIds.has(fill.id)).map(fill => allFills.get(fill.id)!),
    journalFills: accepted, updatedAt: Math.max(local.updatedAt, remote.updatedAt) });
}

/** Storage/hydration can carry an older peer; reconcile against live execution state. */
export function mergePaperTradingLedgerUpdate(current: PaperTradingLedger, incoming: PaperTradingLedger): PaperTradingLedger {
  const accounts = { ...incoming.accounts };
  for (const [id, account] of Object.entries(current.accounts)) {
    if (accounts[id]) accounts[id] = mergeTradingAccount(account, account, accounts[id]);
  }
  return { ...incoming, accounts };
}

export function mergeAccountPreferenceChanges(base: UserPreferenceSnapshot, local: UserPreferenceSnapshot, remote: UserPreferenceSnapshot): UserPreferenceSnapshot {
  const values = { ...remote.values };
  const keys = new Set([...Object.keys(base.values), ...Object.keys(local.values)]);
  for (const key of keys) {
    if (preferenceValueFingerprint(key, base.values[key]) === preferenceValueFingerprint(key, local.values[key])
      && !(key === PAPER_LEDGER_KEY && local.values[key] && remote.values[key])) continue;
    if (local.values[key] === undefined) delete values[key];
    else if (key === CHART_DRAWING_PREFERENCE_KEY) {
      const merged = mergeChartDrawingPreferences(base.values[key], local.values[key], remote.values[key]);
      if (merged !== undefined) values[key] = merged;
    } else if (key === PAPER_LEDGER_KEY && remote.values[key]) {
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
