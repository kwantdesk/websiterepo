import { applyJournalAccountResets, latestZyonJournalReset, type JournalState } from "./journal.ts";

/** Identity merges retain outcomes; explicit tombstones, not omission, delete. */
export function mergeJournalSnapshots(older: JournalState, newer: JournalState): JournalState {
  const merge = <T extends { id: string }>(a: T[], b: T[]) => [...new Map([...a, ...b].map(row => [row.id, row])).values()];
  const previousAccounts = new Map(older.accounts.map(row => [row.id, row]));
  return applyJournalAccountResets({ ...older, ...newer,
    deletedTradeIds: [...new Set([...(older.deletedTradeIds ?? []), ...(newer.deletedTradeIds ?? [])])],
    zyonResetAt: latestZyonJournalReset(older.zyonResetAt, newer.zyonResetAt),
    accounts: merge(older.accounts, newer.accounts).map(account => ({ ...account,
      resetAt: latestZyonJournalReset(previousAccounts.get(account.id)?.resetAt, account.resetAt),
    })),
    trades: merge(older.trades, newer.trades),
    imports: merge(older.imports, newer.imports),
    evidence: merge(older.evidence, newer.evidence),
  });
}

/** A late load cannot overwrite edits/additions made after that load started. */
export function mergeJournalHydration(loaded: JournalState, current: JournalState, atStart: JournalState) {
  const changed = <T extends { id: string }>(rows: T[], baseline: T[]) => {
    const old = new Map(baseline.map(row => [row.id, row]));
    return rows.filter(row => old.get(row.id) !== row);
  };
  return mergeJournalSnapshots(loaded, { ...current,
    accounts: changed(current.accounts, atStart.accounts),
    trades: changed(current.trades, atStart.trades),
    imports: changed(current.imports, atStart.imports),
    evidence: changed(current.evidence, atStart.evidence),
  });
}
