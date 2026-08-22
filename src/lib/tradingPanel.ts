/**
 * Order model for the trading panel.
 *
 * The shape follows ATAS's connector layer, which solves the same problem we
 * have: one panel driving brokers with different capabilities.
 *
 * Three ideas are taken from it directly.
 *
 * 1. OCO is a GROUP ID carried on an order, not an order type. Any number of
 *    orders can share one, and filling any member cancels the rest. Modelling
 *    it as a "one-cancels-other order" only ever works for pairs and falls
 *    apart the moment a bracket has both a stop and a target alongside a
 *    working entry.
 *
 * 2. Whether the broker enforces that grouping is a CAPABILITY, not an
 *    assumption — ATAS exposes it as IsSupportedServerOCO. When the broker
 *    honours the group we send it and stop; when it does not we have to cancel
 *    the siblings ourselves the moment a fill lands, or the trader ends up
 *    holding the opposite position on a stop that should have died with its
 *    target.
 *
 * 3. Order options sit behind per-connector capability interfaces
 *    (IOrderOptionReduceOnly, IOrderOptionPostOnly, IOrderOptionCloseOnTrigger).
 *    A panel that shows a toggle the broker will ignore is worse than one that
 *    hides it: the trader believes a protection is in force when it is not. We
 *    resolve every option against the connector and report what was dropped.
 */

export type OrderDirection = "buy" | "sell";

export type OrderType = "market" | "limit" | "stop" | "stopLimit";

/** Matches the ATAS lifecycle: nothing sent, working, partly done, done, dead. */
export type OrderStatus = "none" | "placed" | "partlyFilled" | "filled" | "canceled";

export type TimeInForce = "gtc" | "day" | "ioc" | "fok" | "gtd";

export const TIME_IN_FORCE_OPTIONS: { id: TimeInForce; label: string; hint: string }[] = [
  { id: "gtc", label: "GTC", hint: "Good till cancelled" },
  { id: "day", label: "DAY", hint: "Expires at the session close" },
  { id: "ioc", label: "IOC", hint: "Fill what can be filled now, cancel the rest" },
  { id: "fok", label: "FOK", hint: "Fill all of it now or none of it" },
  { id: "gtd", label: "GTD", hint: "Good till a chosen date" },
];

/** What a given broker connection can actually honour. */
export type ConnectorCapabilities = {
  serverOco: boolean;
  reduceOnly: boolean;
  postOnly: boolean;
  closeOnTrigger: boolean;
  timeInForce: TimeInForce[];
};

/** A conservative default: assume nothing until a connector says otherwise. */
export const NO_CAPABILITIES: ConnectorCapabilities = {
  serverOco: false,
  reduceOnly: false,
  postOnly: false,
  closeOnTrigger: false,
  timeInForce: ["gtc"],
};

export type OrderOptions = {
  reduceOnly?: boolean;
  postOnly?: boolean;
  closeOnTrigger?: boolean;
};

export type WorkingOrder = {
  id: string;
  direction: OrderDirection;
  type: OrderType;
  quantity: number;
  /** Filled so far. Between 1 and quantity means partlyFilled. */
  filled: number;
  price: number | null;
  triggerPrice: number | null;
  status: OrderStatus;
  timeInForce: TimeInForce;
  /** Orders sharing this cancel each other. Null means standalone. */
  ocoGroup: string | null;
  options: OrderOptions;
};

export type Position = {
  quantity: number;
  averagePrice: number;
};

export const isWorking = (order: WorkingOrder) =>
  order.status === "placed" || order.status === "partlyFilled";

/**
 * Strip options the connector cannot honour, and say which were dropped.
 *
 * Silently sending an unsupported flag is the dangerous case: a reduce-only
 * order that the broker treats as ordinary can open an opposite position
 * instead of closing one.
 */
export function resolveOrderOptions(
  requested: OrderOptions,
  capabilities: ConnectorCapabilities,
): { options: OrderOptions; dropped: string[] } {
  const options: OrderOptions = {};
  const dropped: string[] = [];
  const consider = (
    key: keyof OrderOptions,
    supported: boolean,
    label: string,
  ) => {
    if (!requested[key]) return;
    if (supported) options[key] = true;
    else dropped.push(label);
  };
  consider("reduceOnly", capabilities.reduceOnly, "Reduce-only");
  consider("postOnly", capabilities.postOnly, "Post-only");
  consider("closeOnTrigger", capabilities.closeOnTrigger, "Close-on-trigger");
  return { options, dropped };
}

export function resolveTimeInForce(
  requested: TimeInForce,
  capabilities: ConnectorCapabilities,
): { timeInForce: TimeInForce; substituted: boolean } {
  if (capabilities.timeInForce.includes(requested)) {
    return { timeInForce: requested, substituted: false };
  }
  // GTC is the safest fallback: it neither expires early nor cancels an
  // unfilled remainder the trader expected to stay working.
  const fallback = capabilities.timeInForce[0] ?? "gtc";
  return { timeInForce: fallback, substituted: true };
}

/**
 * Orders in `group` that must die because `filledId` filled.
 *
 * Returned rather than applied so the caller decides whether the broker is
 * doing this for us. When the connector reports server-side OCO we send the
 * group and let the venue enforce it; otherwise these are the cancels we owe.
 *
 * A PARTIAL fill counts. The position has already moved, so leaving the
 * opposite protection working is what puts a trader on the wrong side of an
 * exit they thought was one-or-the-other.
 */
export function ocoSiblingsToCancel(
  orders: WorkingOrder[],
  filledId: string,
): WorkingOrder[] {
  const filledOrder = orders.find((order) => order.id === filledId);
  if (!filledOrder?.ocoGroup) return [];
  return orders.filter((order) =>
    order.id !== filledId
    && order.ocoGroup === filledOrder.ocoGroup
    && isWorking(order));
}

/**
 * Apply a fill and return the resulting book, honouring OCO locally.
 *
 * `serverOco` mirrors ATAS's IsSupportedServerOCO: when true the venue has
 * already cancelled the siblings and doing it again would race its own
 * confirmations, so the book is left for the broker feed to update.
 */
export function applyFill(
  orders: WorkingOrder[],
  filledId: string,
  quantity: number,
  options: { serverOco: boolean },
): WorkingOrder[] {
  const target = orders.find((order) => order.id === filledId);
  if (!target || !isWorking(target)) return orders;
  const filled = Math.min(target.quantity, target.filled + Math.max(0, quantity));
  const status: OrderStatus = filled >= target.quantity ? "filled" : "partlyFilled";
  const updated = orders.map((order) =>
    order.id === filledId ? { ...order, filled, status } : order);
  if (options.serverOco) return updated;
  const doomed = new Set(ocoSiblingsToCancel(updated, filledId).map((order) => order.id));
  if (!doomed.size) return updated;
  return updated.map((order) =>
    doomed.has(order.id) ? { ...order, status: "canceled" as const } : order);
}

/**
 * Which working orders a "Cancel Bids" / "Cancel Asks" / "Cancel All" hits.
 *
 * Side is read from the order's own direction rather than from whether it sits
 * below the market: a working buy is a bid whether it is an entry limit or a
 * stop covering a short.
 */
export function ordersToCancel(
  orders: WorkingOrder[],
  scope: "bids" | "asks" | "all",
): WorkingOrder[] {
  return orders.filter((order) => {
    if (!isWorking(order)) return false;
    if (scope === "all") return true;
    return scope === "bids" ? order.direction === "buy" : order.direction === "sell";
  });
}

/**
 * The order that flattens a position: same size, opposite way.
 *
 * Reduce-only is requested wherever the connector supports it, so a flatten
 * racing a fill cannot overshoot into a new position the other way.
 */
export function flattenIntent(
  position: Position,
  capabilities: ConnectorCapabilities,
): { direction: OrderDirection; quantity: number; options: OrderOptions } | null {
  if (!position.quantity) return null;
  return {
    direction: position.quantity > 0 ? "sell" : "buy",
    quantity: Math.abs(position.quantity),
    options: capabilities.reduceOnly ? { reduceOnly: true } : {},
  };
}

/**
 * The order that reverses a position: twice the size, opposite way.
 *
 * Deliberately NOT reduce-only — the whole point is to end up the other way
 * round, and a reduce-only reversal would stop at flat.
 */
export function reverseIntent(
  position: Position,
): { direction: OrderDirection; quantity: number } | null {
  if (!position.quantity) return null;
  return {
    direction: position.quantity > 0 ? "sell" : "buy",
    quantity: Math.abs(position.quantity) * 2,
  };
}

/**
 * Where a break-even stop belongs.
 *
 * The entry price itself, adjusted by any per-side cost the caller passes, and
 * snapped to the instrument's tick AWAY from the market so the stop can never
 * be placed at a price that is already through. A stop that rounds the wrong
 * way turns a break-even into a small loss on every use.
 */
export function breakevenStopPrice(
  position: Position,
  tickSize: number,
  costPerUnit = 0,
): number | null {
  if (!position.quantity || !(tickSize > 0)) return null;
  const long = position.quantity > 0;
  const raw = long
    ? position.averagePrice + costPerUnit
    : position.averagePrice - costPerUnit;
  const ticks = raw / tickSize;
  const snapped = long ? Math.ceil(ticks) : Math.floor(ticks);
  // Guard the floating-point residue that turns 29_400.0000000001 into an
  // extra tick on instruments with fractional ticks.
  const rounded = Math.abs(ticks - Math.round(ticks)) < 1e-9 ? Math.round(ticks) : snapped;
  return Number((rounded * tickSize).toFixed(10));
}

/** Open profit in points, signed by the position's direction. */
export function openPnlPoints(position: Position, lastPrice: number): number {
  if (!position.quantity || !Number.isFinite(lastPrice)) return 0;
  const move = lastPrice - position.averagePrice;
  return position.quantity > 0 ? move : -move;
}

export function openPnlCurrency(
  position: Position,
  lastPrice: number,
  pointValue: number,
): number {
  return openPnlPoints(position, lastPrice) * Math.abs(position.quantity) * pointValue;
}

let ocoCounter = 0;
/**
 * A fresh OCO group id.
 *
 * Deterministic rather than random so a workspace snapshot replays identically;
 * uniqueness only has to hold within one browser session, which a counter and
 * the caller's own prefix already guarantee.
 */
export function nextOcoGroupId(prefix = "oco"): string {
  ocoCounter += 1;
  return `${prefix}-${ocoCounter}`;
}

/** Test seam: reset the counter so ids are predictable per test. */
export function resetOcoGroupIds() {
  ocoCounter = 0;
}
