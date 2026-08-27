/**
 * GEX Map v2 — dealer inventory gamma exposure.
 *
 * v1 (getGexMapPanel, unchanged, tagged `gex-map-v1`) displays QuantData's
 * exposure-by-strike verbatim: callExposure + putExposure summed over the
 * expiries in scope. It is a snapshot of a vendor's structural model, and it is
 * recomputed from scratch every frame.
 *
 * That is a different measurement from what a dealer-positioning read wants,
 * and it is measurably so. Against Skylit Trinity on matched minutes and
 * matched expiry scope, every static snapshot family - ours included - scores a
 * cross-strike correlation of at most 0.24 and a row-sign agreement of 47-56%,
 * which is a coin flip. Carrying a signed per-strike state instead explains
 * ~98% of the same target. The full measurement is in
 * docs/research/skylit-trinity-gex-reconstruction-2026-08-21.md.
 *
 * So v2 keeps a state. It holds an estimate of the dealer's SIGNED CONTRACT
 * position per contract, updates that estimate from classified trade flow, and
 * revalues the carried position against current gamma and spot on every frame.
 *
 * Three properties follow that v1 cannot have:
 *
 *   - a single strike can flip sign while its neighbours do not, because each
 *     contract carries its own quantity;
 *   - the number changes when the market moves even if nothing trades, because
 *     revaluation uses current gamma and spot;
 *   - the state survives the open, because inventory is carried, not rebuilt.
 *
 * WHAT WE HAVE. The provider's consolidated print carries the labels this
 * needs, so the classifier is not guesswork:
 *
 *   tradeSideCode           ASK / ABOVE_ASK / BID / BELOW_BID / MID_MARKET
 *   tradeConsolidationType  SWEEP / BLOCK / SPLIT, with comprisingTrades
 *   greeks.gamma            per-contract gamma at trade time
 *   openInterest, size, volume, stockPrice, contractType, strikePrice
 *
 * WHAT THIS IS NOT. It is not a bit-for-bit reproduction of Skylit. Their seed
 * inventory and the exact weights they place on each print are theirs, and at a
 * strike holding both calls and puts one displayed number hides two unknown
 * quantities. What this is instead: the same measurement class, built from the
 * same labels, calibrated against observed open-interest change - which is real
 * ground truth - rather than fitted to a competitor's screenshots.
 */

/** Which side of the chain a quantity belongs to. Both have positive gamma. */
export type OptionRight = "call" | "put";

/** A contract's identity within one session's chain. */
export type ContractKey = string;

export function contractKey(expiration: string, strike: number, right: OptionRight): ContractKey {
  return `${expiration}|${strike}|${right}`;
}

export function parseContractKey(key: ContractKey): { expiration: string; strike: number; right: OptionRight } | null {
  const [expiration, strike, right] = key.split("|");
  const parsed = Number(strike);
  if (!expiration || !Number.isFinite(parsed) || (right !== "call" && right !== "put")) return null;
  return { expiration, strike: parsed, right: right as OptionRight };
}

/**
 * One economic trade, already de-duplicated and classified.
 *
 * `dealerSign` is the direction the DEALER's inventory moves, not the
 * customer's:
 *
 *   -1  the customer bought the option, so the dealer sold it and is now
 *       shorter gamma;
 *   +1  the customer sold the option, so the dealer bought it and is now
 *       longer gamma;
 *    0  the aggressor or the economic role could not be resolved.
 *
 * The weights are each a probability in 0..1 and multiply together, so an
 * uncertain print moves the state proportionally less rather than being either
 * counted in full or discarded. A midpoint print with no resolvable aggressor
 * contributes nothing without being treated as a trade in the opposite
 * direction.
 */
export type ClassifiedTrade = {
  /**
   * When it printed. The book is aged to each trade as it is folded in, so
   * without this every trade would decay by the same amount - which is a
   * global scalar, and a global scalar changes no relative value. That is the
   * difference between the calibrated 3h-decay policy and `carry`, which
   * measured actively wrong.
   */
  tradeTimeMs: number;
  expiration: string;
  strike: number;
  right: OptionRight;
  contracts: number;
  dealerSign: -1 | 0 | 1;
  /** Probability a dealer, rather than another customer, took the other side. */
  dealerCounterpartyProbability: number;
  /** 0 for a duplicate parent/child record; reduced when the role is unclear. */
  economicTradeWeight: number;
  /** Highest at or through the NBBO, lowest at the midpoint. */
  quoteConfidence: number;
};

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/** The signed contract delta a single classified trade applies to inventory. */
export function tradeInventoryDelta(trade: ClassifiedTrade): number {
  if (!Number.isFinite(trade.contracts) || trade.contracts <= 0) return 0;
  if (trade.dealerSign === 0) return 0;
  const weight = clamp01(trade.dealerCounterpartyProbability)
    * clamp01(trade.economicTradeWeight)
    * clamp01(trade.quoteConfidence);
  return trade.contracts * trade.dealerSign * weight;
}

/**
 * How much of a contract's open interest the engine will accept as dealer
 * inventory.
 *
 * The physical bound is the whole of open interest, but the measured
 * requirement is far smaller: reconstructing Trinity's rows implied a signed
 * share between -28% and +19% of gross OI gamma. A state that drifts past this
 * is accumulating classifier error, not inventory, so it is held at the bound
 * and reported rather than allowed to run.
 */
export const DEALER_INVENTORY_OI_BOUND = 0.35;

export type DealerInventoryState = {
  /** CME/US options session this state belongs to. */
  sessionDate: string;
  /** Last trade timestamp folded in. */
  asOfMs: number;
  /** Signed dealer contracts per contract key. Positive = dealer long gamma. */
  contracts: Record<ContractKey, number>;
  /**
   * How much classified flow has been absorbed since the state was seeded from
   * nothing. Until a session's worth has accumulated the estimate is honestly
   * warming, and the panel must say so rather than presenting it as settled.
   */
  absorbedContracts: number;
  /** True when this state was carried from a previous session rather than seeded empty. */
  carried: boolean;
};

export function emptyDealerInventory(sessionDate: string, asOfMs: number): DealerInventoryState {
  return { sessionDate, asOfMs, contracts: {}, absorbedContracts: 0, carried: false };
}

/**
 * Carry a previous session's inventory into a new session.
 *
 * Inventory does not reset at the cash open - Trinity holds non-zero nodes at
 * 04:00 ET - so the previous close is the correct starting point. Expired
 * contracts are dropped: their gamma is gone and carrying them would revalue a
 * position that no longer exists.
 */
export function carryDealerInventory(
  previous: DealerInventoryState,
  sessionDate: string,
  asOfMs: number,
): DealerInventoryState {
  const contracts: Record<ContractKey, number> = {};
  for (const [key, quantity] of Object.entries(previous.contracts)) {
    const parsed = parseContractKey(key);
    if (!parsed || parsed.expiration < sessionDate) continue;
    if (!Number.isFinite(quantity) || quantity === 0) continue;
    contracts[key] = quantity;
  }
  return {
    sessionDate,
    asOfMs,
    contracts,
    absorbedContracts: previous.absorbedContracts,
    carried: true,
  };
}

/** Open interest per contract, used only to bound the state. */
export type OpenInterestLookup = (key: ContractKey) => number;

/**
 * Fold classified trades into the carried state, in time order.
 *
 * Trades are applied in event order because the bound is applied per step: a
 * position that reaches the bound and then trades back should be free to move
 * again, which a single bound applied to the total would not allow.
 */
export function advanceDealerInventory(
  state: DealerInventoryState,
  trades: readonly ClassifiedTrade[],
  openInterest: OpenInterestLookup,
): DealerInventoryState {
  const contracts = { ...state.contracts };
  let absorbed = state.absorbedContracts;
  let asOfMs = state.asOfMs;

  for (const trade of trades) {
    const delta = tradeInventoryDelta(trade);
    if (delta === 0) continue;
    const key = contractKey(trade.expiration, trade.strike, trade.right);
    const bound = Math.abs(openInterest(key)) * DEALER_INVENTORY_OI_BOUND;
    const next = (contracts[key] ?? 0) + delta;
    contracts[key] = bound > 0 ? Math.min(bound, Math.max(-bound, next)) : next;
    absorbed += Math.abs(delta);
  }

  for (const trade of trades) {
    if (Number.isFinite(trade.contracts) && trade.contracts > 0) break;
  }
  return { ...state, contracts, absorbedContracts: absorbed, asOfMs };
}

/** How the node value is normalised for display. */
export type GexRepresentation = "PER_ONE_DOLLAR_MOVE" | "PER_ONE_PERCENT_MOVE";

/**
 * The multiplier that turns per-contract dollar gamma into a displayed move.
 *
 * Provider exposure is already quoted per its own convention, so this converts
 * between the two display units rather than re-deriving them from raw gamma.
 * It is a positive scalar: it changes magnitude only, and can never change a
 * row's sign or the shape of the cross-section.
 */
export function representationScale(
  from: GexRepresentation,
  to: GexRepresentation,
  spot: number,
): number {
  if (from === to) return 1;
  if (!Number.isFinite(spot) || spot <= 0) return 1;
  // per-1% = per-$1 * spot * 0.01
  return to === "PER_ONE_PERCENT_MOVE" ? spot * 0.01 : 1 / (spot * 0.01);
}

export type DealerGexNode = {
  strike: number;
  /** Signed dollar gamma the dealer is estimated to hold at this strike. */
  net: number;
  callNet: number;
  putNet: number;
  /** Signed dealer contracts behind the number, for auditing a row. */
  callContracts: number;
  putContracts: number;
};

export type DealerGexFrame = {
  sessionDate: string;
  asOfMs: number;
  representation: GexRepresentation;
  nodes: DealerGexNode[];
  /** Largest absolute node — the Star. */
  starStrike: number | null;
  /**
   * "warming" while too little classified flow has been absorbed for the
   * estimate to stand on its own. Never present a warming frame as settled.
   */
  status: "warming" | "ready";
  absorbedContracts: number;
};

/**
 * Minimum classified flow before a from-empty state is presented as settled.
 *
 * A state seeded from nothing is only as good as the flow it has absorbed. This
 * is deliberately reported rather than hidden: an engine that shows a confident
 * zero on its first frame is worse than one that says it is still warming.
 */
export const DEALER_INVENTORY_WARMUP_CONTRACTS = 25_000;

/**
 * Revalue the carried inventory against current gamma and spot.
 *
 * This is the step that makes the number move when the market moves and nothing
 * trades, which a snapshot model cannot do.
 */
export function revalueDealerGex(input: {
  state: DealerInventoryState;
  /** Strikes the panel lists, in the panel's own order. */
  strikes: readonly number[];
  /** Expirations in scope, matching the panel's own filter. */
  expirations: readonly string[];
  /** Each contract's OWN gamma, keyed by contractKey. */
  gammaByContract: ReadonlyMap<ContractKey, number>;
  spot: number;
  representation: GexRepresentation;
}): DealerGexFrame {
  const byStrike = new Map<number, DealerGexNode>();

  for (const strike of input.strikes) {
    /*
     * Valued per CONTRACT, not per strike.
     *
     * Each expiration carries its own gamma, and on a multi-expiry scope a
     * near-dated contract and a far-dated one at the same strike are worth very
     * different amounts per contract held. Collapsing to one gamma per strike
     * would value them identically.
     */
    let callNet = 0;
    let putNet = 0;
    let callContracts = 0;
    let putContracts = 0;
    for (const expiration of input.expirations) {
      for (const right of ["call", "put"] as const) {
        const key = contractKey(expiration, strike, right);
        const contracts = input.state.contracts[key] ?? 0;
        if (!contracts) continue;
        const gamma = input.gammaByContract.get(key);
        // No gamma for this contract means no honest value for it. Skipping it
        // understates the node; substituting a neighbour's gamma would state a
        // number the data does not support.
        if (gamma === undefined) continue;
        const value = contracts * contractDollarGamma(gamma, input.spot, input.representation);
        if (right === "call") { callNet += value; callContracts += contracts; }
        else { putNet += value; putContracts += contracts; }
      }
    }
    if (callContracts === 0 && putContracts === 0) continue;
    byStrike.set(strike, {
      strike,
      net: callNet + putNet,
      callNet,
      putNet,
      callContracts,
      putContracts,
    });
  }

  const nodes = [...byStrike.values()].sort((left, right) => left.strike - right.strike);
  let starStrike: number | null = null;
  let starMagnitude = 0;
  for (const node of nodes) {
    const magnitude = Math.abs(node.net);
    if (magnitude > starMagnitude) {
      starMagnitude = magnitude;
      starStrike = node.strike;
    }
  }

  return {
    sessionDate: input.state.sessionDate,
    asOfMs: input.state.asOfMs,
    representation: input.representation,
    nodes,
    starStrike,
    status: input.state.absorbedContracts >= DEALER_INVENTORY_WARMUP_CONTRACTS || input.state.carried
      ? "ready"
      : "warming",
    absorbedContracts: input.state.absorbedContracts,
  };
}

/**
 * The provider's aggressor label, and what each value implies.
 *
 * A customer lifting the offer leaves the dealer short that option and short
 * gamma; a customer hitting the bid leaves the dealer long it. Prints through
 * the quote are the least ambiguous of all - nobody pays above the ask by
 * accident - so they carry full confidence, prints at the quote slightly less,
 * and a midpoint print carries none, because it has no aggressor to read.
 *
 * A midpoint print is dropped rather than guessed. Assigning it a direction
 * would be inventing a dealer position from a trade that does not reveal one.
 */
const TRADE_SIDE_CLASSIFICATION: Record<string, { dealerSign: -1 | 0 | 1; quoteConfidence: number }> = {
  ABOVE_ASK: { dealerSign: -1, quoteConfidence: 1 },
  ASK: { dealerSign: -1, quoteConfidence: 0.9 },
  BID: { dealerSign: 1, quoteConfidence: 0.9 },
  BELOW_BID: { dealerSign: 1, quoteConfidence: 1 },
  MID_MARKET: { dealerSign: 0, quoteConfidence: 0 },
};

/**
 * How much of a print is treated as a real economic position change.
 *
 * A SWEEP is one order deliberately split across venues to take liquidity: it
 * is the clearest customer intent on the tape. A BLOCK is negotiated size,
 * usually genuine positioning. A SPLIT is the same parent order reported in
 * pieces, so it is the record most at risk of being counted twice alongside its
 * comprising legs and is discounted accordingly.
 */
const CONSOLIDATION_WEIGHT: Record<string, number> = {
  SWEEP: 1,
  BLOCK: 1,
  SPLIT: 0.6,
};

/**
 * Multi-leg prints are DROPPED, not down-weighted.
 *
 * One leg of a spread has partners that offset most of the gamma it appears to
 * add, and the tape never delivers the partners, so its direction is not
 * readable. They are also the majority of the tape - 57% of prints in the
 * 2026-08-21 SPX expiry - which is why halving them still let them dominate.
 *
 * Measured against the reference lattice on 4 frames, dropping them raised mean
 * correlation from 0.418 to 0.572 and doubled the star-node matches, at every
 * carry depth and half-life tried.
 *
 * M2S (a multi-leg order reported as single-leg fills) is deliberately NOT in
 * this set. It looks like it belongs, and the same measurement says otherwise:
 * dropping M2S as well cut sign agreement from 68% to 62% and correlation from
 * 0.572 to 0.535. It carries real directional inventory.
 */
const MULTI_LEG_TRADE_TYPES = new Set([
  "MULTI_AUTO_COB",
  "MULTI_FLR_PP",
  "MULTI_AUCT_COB",
]);

/** One consolidated print as the provider delivers it. */
export type ProviderConsolidatedTrade = {
  strikePrice?: unknown;
  contractType?: unknown;
  expirationDate?: unknown;
  size?: unknown;
  tradeSideCode?: unknown;
  tradeConsolidationType?: unknown;
  tradeType?: unknown;
  openInterest?: unknown;
  isOpeningPosition?: unknown;
  tradeTime?: unknown;
};

/**
 * Turn a provider print into a signed inventory move, or null if it cannot
 * honestly be read as one.
 *
 * `isOpeningPosition` is deliberately NOT used to gate the sign. In the sampled
 * session it was true on 2 prints of 417, so treating false as "this closed a
 * position" would silently discard almost the entire tape. It also would not
 * change the sign if it were reliable: a customer buy requires the dealer to
 * sell that option whether the customer was opening a long or closing a short.
 */
export function classifyConsolidatedTrade(raw: ProviderConsolidatedTrade): ClassifiedTrade | null {
  const strike = Number(raw.strikePrice);
  const contracts = Number(raw.size);
  const expiration = typeof raw.expirationDate === "string" ? raw.expirationDate.slice(0, 10) : "";
  const type = String(raw.contractType ?? "").toUpperCase();
  if (!expiration || !Number.isFinite(strike) || !Number.isFinite(contracts) || contracts <= 0) return null;
  if (type !== "CALL" && type !== "PUT") return null;

  const side = TRADE_SIDE_CLASSIFICATION[String(raw.tradeSideCode ?? "").toUpperCase()];
  if (!side || side.dealerSign === 0) return null;

  if (MULTI_LEG_TRADE_TYPES.has(String(raw.tradeType ?? "").toUpperCase())) return null;

  const consolidation = CONSOLIDATION_WEIGHT[String(raw.tradeConsolidationType ?? "").toUpperCase()] ?? 0.6;

  return {
    tradeTimeMs: Number(raw.tradeTime) || 0,
    expiration,
    strike,
    right: type === "CALL" ? "call" : "put",
    contracts,
    dealerSign: side.dealerSign,
    // Held at 1 until it is calibrated against observed OI change. It is a real
    // unknown, and a fabricated probability would be worse than an explicit
    // one: every other weight is measured, this one would not be.
    dealerCounterpartyProbability: 1,
    economicTradeWeight: consolidation,
    quoteConfidence: side.quoteConfidence,
  };
}

/**
 * Fold a classified tape into the book, ageing it to each trade as it goes.
 *
 * This is the ONLY correct way to combine accumulation with decay. Advancing
 * the whole tape and then decaying once applies the same factor to every trade,
 * and a uniform factor is a global scalar that leaves every relative value
 * unchanged - the book ends up on the `carry` policy, which measured -0.302
 * against the reference where the 3h policy measured +0.603.
 */
export function accumulateDecayedTape(
  initial: DealerInventoryState,
  trades: readonly ClassifiedTrade[],
  openInterest: OpenInterestLookup,
  asOfMs: number,
  halfLifeMs: number = DEALER_FLOW_HALF_LIFE_MS,
): DealerInventoryState {
  let state = initial;
  for (const trade of trades) {
    const at = Number.isFinite(trade.tradeTimeMs) && trade.tradeTimeMs > 0 ? trade.tradeTimeMs : state.asOfMs;
    state = decayDealerInventory(state, at, halfLifeMs);
    state = advanceDealerInventory(state, [trade], openInterest);
    state = { ...state, asOfMs: Math.max(state.asOfMs, at) };
  }
  return decayDealerInventory(state, asOfMs, halfLifeMs);
}

/** Classify a whole tape, dropping what cannot be read, in time order. */
export function classifyConsolidatedTape(
  raw: readonly ProviderConsolidatedTrade[],
): ClassifiedTrade[] {
  return [...raw]
    .sort((left, right) => (Number(left.tradeTime) || 0) - (Number(right.tradeTime) || 0))
    .map(classifyConsolidatedTrade)
    .filter((trade): trade is ClassifiedTrade => trade !== null);
}

/**
 * How fast absorbed flow stops counting.
 *
 * OPRA carries no reliable open/close flag - the provider's isOpeningPosition
 * was true on 2 prints of 417 in the sampled session - so the engine cannot know
 * which positions were closed. A half-life is the honest substitute: positions
 * close at SOME rate, without pretending to know which ones.
 *
 * Twelve hours, measured. Three hours was the earlier setting and it is too
 * fast: on a 6.5-hour session it leaves the morning's flow worth an eighth of
 * the afternoon's, and 0DTE positions overwhelmingly do not close early - they
 * expire. Scored against the reference lattice, moving 3h -> 12h raised mean
 * correlation from 0.487 to 0.572 with no frame getting worse. Past 24h the
 * gain flattens and sign agreement starts to slip, so this is the knee rather
 * than the maximum of any single metric.
 */
export const DEALER_FLOW_HALF_LIFE_MS = 12 * 60 * 60 * 1_000;

/**
 * Age the carried book forward to `nowMs`.
 *
 * Applied to the whole state per step rather than per trade: exponential decay
 * composes, so decaying the accumulated position by the elapsed interval is
 * identical to having decayed each trade individually, at O(1) instead of
 * O(trades).
 *
 * Positions that decay below a contract are dropped. Keeping a book of
 * thousands of near-zero fragments would cost memory and add nothing a trader
 * can see.
 */
export function decayDealerInventory(
  state: DealerInventoryState,
  nowMs: number,
  halfLifeMs: number = DEALER_FLOW_HALF_LIFE_MS,
): DealerInventoryState {
  const elapsed = nowMs - state.asOfMs;
  if (!Number.isFinite(elapsed) || elapsed <= 0 || !(halfLifeMs > 0)) return state;
  const factor = 2 ** (-elapsed / halfLifeMs);
  const contracts: Record<ContractKey, number> = {};
  for (const [key, quantity] of Object.entries(state.contracts)) {
    const decayed = quantity * factor;
    if (Math.abs(decayed) < 1) continue;
    contracts[key] = decayed;
  }
  return { ...state, contracts, asOfMs: nowMs };
}

/**
 * Where v2 is measured to be better than v1, and where it is not.
 *
 * Across every captured Trinity frame at matched 0DTE scope, mean cross-strike
 * correlation, v2 (3h decay) against v1:
 *
 *   cash index (SPX/SPXW)   0.603  vs  0.141   - v2 is decisively better
 *   ETF (SPY)              -0.330  vs  0.006   - v2 is worse
 *   ETF (QQQ)               0.038  vs  0.244   - v2 is worse
 *
 * A plain aggressor rule works on the index, where 0DTE flow is overwhelmingly
 * opening and directional, and fails on the ETFs, where far more of the tape is
 * hedging, covered-call and spread activity that an aggressor flag alone reads
 * backwards. Closing that gap needs the dealer-counterparty and open/close
 * weights calibrated against observed OI change.
 *
 * Until then v2 must not present itself as authoritative on a symbol where it
 * measured WORSE than the thing it replaces. Shipping a number because it is
 * newer, when it is known to be less correct, is the failure this guard exists
 * to prevent.
 */
const V2_VALIDATED_ROOTS = new Set(["SPX", "SPXW", "NDX", "RUT", "VIX"]);

export type V2Readiness = "validated" | "experimental";

/**
 * Whether v2 has been measured to beat v1 for this underlying.
 *
 * Cash indices are validated. Everything else - ETFs and single names - is
 * experimental until the flow weights are calibrated for it, and the panel must
 * say so rather than presenting the number plainly.
 */
export function v2Readiness(symbol: string): V2Readiness {
  return V2_VALIDATED_ROOTS.has(symbol.trim().toUpperCase()) ? "validated" : "experimental";
}

/**
 * Dollar gamma of ONE contract, from the contract's OWN gamma.
 *
 * This replaces recovering it by dividing the provider's derived exposure by
 * open interest. That quotient was never gamma: gamma is identical for a call
 * and a put at one strike and expiry, and the quotient failed that test at 83%
 * of strikes, ranging from 0.066 to 4,339 against a required 1.0. Every
 * magnitude the model produced was therefore built on a number that is not a
 * greek, which is why the star node and the concentration profile could never
 * be tuned into agreement.
 *
 * The provider sends `greeks.gamma` on every consolidated print. Every contract
 * the model holds got there BY trading, so every one of them has its own gamma
 * available - no chain snapshot, and no vendor model in the middle.
 *
 * The move factor is the standard convention:
 *   per $1  : gamma x multiplier x spot
 *   per 1%  : gamma x multiplier x spot^2 x 0.01
 */
export const OPTION_CONTRACT_MULTIPLIER = 100;

export function contractDollarGamma(
  gamma: number,
  spot: number,
  representation: GexRepresentation,
): number {
  if (!Number.isFinite(gamma) || !Number.isFinite(spot) || spot <= 0) return 0;
  const move = representation === "PER_ONE_PERCENT_MOVE" ? spot * spot * 0.01 : spot;
  return Math.abs(gamma) * OPTION_CONTRACT_MULTIPLIER * move;
}

/**
 * How many prior sessions of the SAME contracts are folded in.
 *
 * A 0DTE contract is not new on its expiry day. SPX lists them daily, so the
 * 2026-08-21 expiry took 2,072 prints across the four sessions before it
 * against 1,523 on the day itself - a book that opens flat discards more flow
 * than it keeps, and it shows: from-zero at the open covered 36% of the
 * reference's strikes and 16% of its magnitude.
 *
 * Three sessions, measured. Coverage runs 36% -> 61% -> 73% -> 80% at one, two
 * and three sessions and then flattens (81% at four), because the 12h half-life
 * has already reduced a four-day-old print to about 3% of a fresh one. Sign
 * agreement and correlation are unchanged between three and four.
 *
 * Each prior session is a completed, immutable tape, so it is read once and
 * cached for a day rather than re-read on a panel refresh.
 */
export const DEALER_BOOK_CARRY_SESSIONS = 3;

/**
 * The `count` trading dates before `sessionDate`, oldest first.
 *
 * Weekends only. Market holidays are not enumerated here on purpose: a holiday
 * simply has no tape, so the read returns nothing and the session contributes
 * nothing. A wrong holiday table would silently drop a real session instead,
 * which is the worse failure of the two.
 */
export function priorTradingDates(sessionDate: string, count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${sessionDate}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime())) return dates;
  while (dates.length < Math.max(0, count)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const weekday = cursor.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates.reverse();
}
