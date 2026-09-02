/**
 * Choosing which contract a request means.
 *
 * A micro root aliases to its parent so that a request for MNQ can still be
 * answered from NQ's book - a micro tracks its parent tick for tick, and for a
 * long time the micros were not subscribed at all. The aliasing runs in one
 * direction only in intent, but the match it produces is symmetric: NQ aliases
 * to root NQ and so does MNQ. So the moment the micros WERE subscribed, both
 * NQU6 and MNQU6 became candidates for a plain NQ request, and MNQU6 sorted
 * first.
 *
 * Measured live: /v1/market-data/history?symbol=NQ returned symbol MNQU6 with
 * 27 five-minute candles, against 809 for NQU6 over the same window. The micro
 * had only been recorded since the morning it was subscribed, so every NQ
 * timeframe showed about forty minutes and looked like the archive had been
 * wiped - while the bars were on disk the whole time.
 */

const STATUS_RANK = { LIVE: 2, STALE: 1 };

/**
 * Order candidates so the contract actually asked for wins.
 *
 * `ownRoot` is the requested root BEFORE micro aliasing: "NQ" for NQ, "MNQ"
 * for MNQ. A candidate carrying that exact root outranks one that only matched
 * through aliasing, so NQ resolves to NQU6 and MNQ to MNQU6 - and MNQ still
 * falls back to NQU6 when no micro contract is in the book, which is the whole
 * point of the aliasing.
 *
 * Status breaks the remaining ties: a live book beats a stale one.
 */
export function compareInstrumentCandidates(left, right, ownRoot, rootOf) {
  const ownRank = (row) => (rootOf(row.symbol) === ownRoot ? 1 : 0);
  const statusRank = (row) => STATUS_RANK[row.status] ?? 0;
  return ownRank(right) - ownRank(left) || statusRank(right) - statusRank(left);
}

/**
 * The contract a request resolves to, or undefined when the book has none.
 *
 * An exact symbol match always wins: asking for NQZ6 by name must never be
 * answered with the front month just because it is the livelier book.
 */
export function resolveInstrumentCandidate(candidates, { requestedSymbol, ownRoot, rootOf }) {
  const ranked = [...candidates].sort((left, right) =>
    compareInstrumentCandidates(left, right, ownRoot, rootOf));
  return ranked.find((row) => row.symbol === requestedSymbol) ?? ranked[0];
}
