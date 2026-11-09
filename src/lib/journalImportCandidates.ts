import { isZyonJournalAccountName, journalTradeIdentity, uniqueJournalOutcomes, type JournalTrade } from './journal';

/** Journal copies and separately imported files can have different row IDs
 * for the same outcome. Apply both identity and existing import fingerprints. */
export function journalImportableTrades(trades: JournalTrade[], destination: string) {
  const identities = new Set<string>();
  const fingerprints = new Set<string>();
  for (const trade of trades) if (trade.account === destination) {
    identities.add(journalTradeIdentity(trade));
    if (trade.fingerprint) fingerprints.add(trade.fingerprint);
  }
  return uniqueJournalOutcomes(trades).filter(trade => {
    if (trade.account === destination || isZyonJournalAccountName(trade.account)
      || trade.sourceImportId?.startsWith('zyon:')) return false;
    const identity = journalTradeIdentity(trade);
    if (identities.has(identity) || (trade.fingerprint && fingerprints.has(trade.fingerprint))) return false;
    identities.add(identity);
    if (trade.fingerprint) fingerprints.add(trade.fingerprint);
    return true;
  });
}
