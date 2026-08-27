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
 * Per-strike provider figures for one expiration.
 *
 * `callExposure` / `putExposure` are QuantData's signed dollar exposure and
 * carry its structural convention (calls positive, puts negative). Open
 * interest is unsigned contract count.
 */
export type ProviderStrikeRow = {
  strike: number;
  callExposure: number;
  putExposure: number;
  callOpenInterest: number;
  putOpenInterest: number;
};

/**
 * Dollar gamma of ONE contract, always positive.
 *
 * Backed out of the provider's own figures rather than recomputed from an
 * option pricer: dividing the provider's dollar exposure by the open interest
 * behind it returns the per-contract dollar gamma the provider itself used.
 * That keeps v2 on the same greeks and the same spot as v1 rather than
 * introducing a second, silently different volatility surface - if the two
 * disagreed, every difference between v1 and v2 would be uninterpretable.
 *
 * The provider's put sign is dropped deliberately. A long put and a long call
 * both have positive gamma; call-positive/put-negative is a structural
 * convention about assumed dealer positioning, and assuming it here would bake
 * in the very thing this engine exists to measure.
 */
export function perContractDollarGamma(row: ProviderStrikeRow): { call: number; put: number } {
  const call = row.callOpenInterest > 0 ? Math.abs(row.callExposure) / row.callOpenInterest : 0;
  const put = row.putOpenInterest > 0 ? Math.abs(row.putExposure) / row.putOpenInterest : 0;
  return {
    call: Number.isFinite(call) ? call : 0,
    put: Number.isFinite(put) ? put : 0,
  };
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
  expiration: string;
  strike: number;
  right: OptionRight;
  contracts: number;
  dealerSign: -1 | 0 | 1;
  /** Probability a dealer, rather than another customer, took the other side. */
  dealerCounterpartyProbability: number;
  /** 0 for a duplicate parent/child record; reduced when the role is unclear. */
  economicTradeWeight: number;
  /** Reduced for a leg of a spread or roll whose partner offsets it. */
  complexLegWeight: number;
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
    * clamp01(trade.complexLegWeight)
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
  rows: readonly ProviderStrikeRow[];
  /** Expirations in scope, matching the panel's own filter. */
  expirations: readonly string[];
  spot: number;
  representation: GexRepresentation;
  /** Unit the provider's exposure figures arrived in. */
  providerRepresentation: GexRepresentation;
}): DealerGexFrame {
  const scale = representationScale(input.providerRepresentation, input.representation, input.spot);
  const byStrike = new Map<number, DealerGexNode>();

  for (const row of input.rows) {
    const gamma = perContractDollarGamma(row);
    let callContracts = 0;
    let putContracts = 0;
    for (const expiration of input.expirations) {
      callContracts += input.state.contracts[contractKey(expiration, row.strike, "call")] ?? 0;
      putContracts += input.state.contracts[contractKey(expiration, row.strike, "put")] ?? 0;
    }
    if (callContracts === 0 && putContracts === 0) continue;
    const callNet = callContracts * gamma.call * scale;
    const putNet = putContracts * gamma.put * scale;
    byStrike.set(row.strike, {
      strike: row.strike,
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
 * A multi-leg print is one side of a spread whose other legs offset much of the
 * gamma it appears to add. Without the partner legs in hand the honest response
 * is to let it move the state less, not to take it at face value.
 */
const MULTI_LEG_TRADE_TYPES = new Set(["MULTI_AUTO_COB", "M2S_AUTO"]);

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

  const consolidation = CONSOLIDATION_WEIGHT[String(raw.tradeConsolidationType ?? "").toUpperCase()] ?? 0.6;
  const multiLeg = MULTI_LEG_TRADE_TYPES.has(String(raw.tradeType ?? "").toUpperCase());

  return {
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
    complexLegWeight: multiLeg ? 0.5 : 1,
    quoteConfidence: side.quoteConfidence,
  };
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
