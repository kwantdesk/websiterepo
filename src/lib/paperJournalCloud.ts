import { applyJournalAccountResets, type JournalState } from "./journal";

const acknowledged = new Map<string, Set<string>>();
const pending = new Map<string, Promise<boolean>>();

/** Upload new demo evidence while trading, not only when Journal is opened.
 * The endpoint inserts missing rows only: an older laptop cannot overwrite
 * journal edits. Failed batches remain unacknowledged for the next retry.
 */
export async function syncPaperJournalCloud(owner: string, rawState: JournalState): Promise<boolean> {
  if (!owner || owner === "local") return false;
  const previous = pending.get(owner);
  if (previous) await previous;
  const task = (async () => {
    const state = applyJournalAccountResets(rawState);
    const known = acknowledged.get(owner) ?? new Set<string>();
    acknowledged.set(owner, known);
    for (const account of state.accounts.filter(row => !row.archivedAt && (row.source === "paper"
      || state.trades.some(trade => trade.account === row.name && trade.id.startsWith("paper:"))))) {
      const accountKey = `account:${account.id}`;
      const trades = state.trades.filter(trade => trade.account === account.name && trade.id.startsWith("paper:") && !known.has(trade.id));
      if (known.has(accountKey) && !trades.length) continue;
      const chunks = Math.max(1, Math.ceil(trades.length / 500));
      for (let index = 0; index < chunks; index++) {
        const rows = trades.slice(index * 500, (index + 1) * 500);
        try {
          const response = await fetch("/api/journal", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "append-paper", ownerId: owner, account: account.name, accountId: account.id, trades: rows }),
          });
          const result = await response.json() as { cloud?: boolean };
          if (!response.ok || !result.cloud) return false;
          known.add(accountKey);
          for (const trade of rows) known.add(trade.id);
        } catch { return false; }
      }
    }
    return true;
  })();
  pending.set(owner, task);
  try { return await task; }
  finally { if (pending.get(owner) === task) pending.delete(owner); }
}
