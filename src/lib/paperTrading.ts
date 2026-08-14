import {
  parseMoney,
  type PaperTradingAccountRecord,
} from "@/lib/paperAccounts";

export type PaperOrderSide = "buy" | "sell";
export type PaperOrderType = "market" | "limit" | "stop";
export type PaperOrderStatus = "working" | "filled" | "cancelled" | "rejected";
export type PaperFillRole = "entry" | "take_profit" | "stop_loss" | "manual_close";

export type PaperQuote = {
  bid: number;
  ask: number;
  timestamp: number;
};

export type PaperQuoteProcessingOptions = {
  /** Protection is deliberately inactive while the trader is holding a drag handle. */
  suspendedProtectionPositionIds?: ReadonlySet<string>;
  /** A newly dropped marketable level exits at the current executable price. */
  marketableProtectionPositionIds?: ReadonlySet<string>;
};

export type PaperTakeProfit = {
  id: string;
  price: number;
  quantity: number;
  filledQuantity: number;
};

export type PaperPosition = {
  id: string;
  accountId: string;
  symbol: string;
  side: PaperOrderSide;
  quantity: number;
  remainingQuantity: number;
  entryPrice: number;
  openedAt: number;
  markPrice: number;
  unrealizedPnl: number;
  marginUsed: number;
  leverage: number;
  stopLoss: number | null;
  takeProfits: PaperTakeProfit[];
  status: "open" | "closed";
  closedAt?: number;
};

export type PaperProtectionUpdate =
  | { kind: "stop_loss"; price: number | null }
  | { kind: "take_profit"; targetId?: string; price: number | null; quantity?: number };

export type PaperOrder = {
  id: string;
  accountId: string;
  symbol: string;
  side: PaperOrderSide;
  type: PaperOrderType;
  quantity: number;
  price: number | null;
  status: PaperOrderStatus;
  createdAt: number;
  filledAt?: number;
  filledPrice?: number;
  positionId?: string;
  stopLoss: number | null;
  takeProfits: Array<Pick<PaperTakeProfit, "price" | "quantity">>;
  rejectionReason?: string;
};

export type PaperTradeFill = {
  id: string;
  orderId: string;
  positionId: string;
  accountId: string;
  symbol: string;
  side: PaperOrderSide;
  quantity: number;
  price: number;
  timestamp: number;
  role: PaperFillRole;
  realizedPnl: number;
  label: string;
};

export function paperFillCandleTimestamp(
  candles: Array<{ timestamp: number }>,
  fillTimestamp: number,
): number | null {
  if (!candles.length || !Number.isFinite(fillTimestamp)) return null;
  if (fillTimestamp < candles[0].timestamp) return null;
  let low = 0;
  let high = candles.length - 1;
  let candleIndex = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (candles[middle].timestamp <= fillTimestamp) {
      candleIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return Math.floor(candles[candleIndex].timestamp / 1_000);
}

export type PaperAccountLedger = {
  accountId: string;
  startingBalance: number;
  cashBalance: number;
  realizedPnl: number;
  positions: PaperPosition[];
  orders: PaperOrder[];
  fills: PaperTradeFill[];
  updatedAt: number;
};

export type PaperTradingLedger = {
  version: 1;
  accounts: Record<string, PaperAccountLedger>;
};

const PAPER_PNL_TIME_ZONE = "America/New_York";
const paperPnlDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PAPER_PNL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function paperPnlDayKey(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "";
  const parts = paperPnlDayFormatter.formatToParts(new Date(timestamp));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function dailyRealizedPaperPnl(
  account: PaperAccountLedger | null | undefined,
  timestamp = Date.now(),
): number {
  if (!account) return 0;
  const activeDay = paperPnlDayKey(timestamp);
  if (!activeDay) return 0;
  return account.fills.reduce((total, fill) => {
    if (fill.role === "entry" || paperPnlDayKey(fill.timestamp) !== activeDay) return total;
    return total + (Number.isFinite(fill.realizedPnl) ? fill.realizedPnl : 0);
  }, 0);
}

export type PaperOrderDraft = {
  accountId: string;
  symbol: string;
  side: PaperOrderSide;
  type: PaperOrderType;
  quantity: number;
  price?: number | null;
  stopLoss?: number | null;
  takeProfits?: Array<{ price: number; quantity: number }>;
};

export type PaperAccountSummary = {
  startingBalance: number;
  balance: number;
  equity: number;
  unrealizedPnl: number;
  realizedPnl: number;
  marginUsed: number;
  availableFunds: number;
  openPositions: number;
  workingOrders: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
};

export const PAPER_TRADING_LEDGER_STORAGE_KEY = "kwantify-paper-trading-ledger-v1";
export const PAPER_TRADING_LEDGER_EVENT = "kwantify-paper-trading-ledger-change";

const POINT_VALUES: Record<string, number> = {
  MNQ: 2,
  NQ: 20,
  MES: 5,
  ES: 50,
  M2K: 5,
  RTY: 50,
  MYM: 0.5,
  YM: 5,
  MGC: 10,
  GC: 100,
  SIL: 1_000,
  SI: 5_000,
  MCL: 100,
  CL: 1_000,
  QM: 500,
  MBT: 0.1,
  BTC: 5,
  MET: 0.1,
  ETH: 50,
  HG: 25_000,
  MHG: 2_500,
  PL: 50,
  PA: 100,
  NG: 10_000,
  QG: 2_500,
  RB: 42_000,
  HO: 42_000,
  ZB: 1_000,
  ZN: 1_000,
  ZF: 1_000,
  ZT: 2_000,
  TN: 1_000,
  UB: 1_000,
  "10Y": 1_000,
  SR3: 2_500,
  "6E": 125_000,
  M6E: 12_500,
  "6B": 62_500,
  M6B: 6_250,
  "6J": 12_500_000,
  MJY: 1_250_000,
  "6A": 100_000,
  M6A: 10_000,
  "6C": 100_000,
  M6C: 10_000,
  MCD: 10_000,
  "6S": 125_000,
  MSF: 12_500,
  "6M": 500_000,
  M6M: 50_000,
  "6N": 100_000,
  // Databento/CME grain prices are displayed in cents, so these values are
  // dollars per displayed chart point (not the raw physical unit multiplier).
  ZC: 50,
  ZS: 50,
  ZW: 50,
  ZL: 600,
  ZM: 100,
  LE: 400,
  HE: 400,
  GF: 500,
};

const TICK_SIZES: Record<string, number> = {
  MNQ: 0.25,
  NQ: 0.25,
  MES: 0.25,
  ES: 0.25,
  M2K: 0.1,
  RTY: 0.1,
  MYM: 1,
  YM: 1,
  MGC: 0.1,
  GC: 0.1,
  SIL: 0.005,
  SI: 0.005,
  MCL: 0.01,
  CL: 0.01,
  QM: 0.025,
  MBT: 5,
  BTC: 5,
  MET: 0.5,
  ETH: 0.5,
  HG: 0.0005,
  MHG: 0.0005,
  PL: 0.1,
  PA: 0.1,
  NG: 0.001,
  QG: 0.005,
  RB: 0.0001,
  HO: 0.0001,
  ZB: 1 / 32,
  ZN: 1 / 64,
  ZF: 1 / 128,
  ZT: 1 / 256,
  TN: 1 / 64,
  UB: 1 / 32,
  "10Y": 0.001,
  SR3: 0.0025,
  "6E": 0.00005,
  M6E: 0.0001,
  "6B": 0.0001,
  M6B: 0.0001,
  "6J": 0.0000005,
  MJY: 0.000001,
  "6A": 0.00005,
  M6A: 0.0001,
  "6C": 0.00005,
  M6C: 0.0001,
  MCD: 0.0001,
  "6S": 0.00005,
  MSF: 0.0001,
  "6M": 0.00001,
  M6M: 0.00001,
  "6N": 0.00005,
  ZC: 0.25,
  ZS: 0.25,
  ZW: 0.25,
  ZL: 0.01,
  ZM: 0.1,
  LE: 0.025,
  HE: 0.025,
  GF: 0.025,
};

const MICRO_FUTURES = new Set(["MNQ", "MES", "M2K", "MYM", "MGC", "SIL", "MCL", "MBT", "MET", "MHG", "10Y", "M6E", "M6B", "MJY", "M6A", "M6C", "MCD", "MSF", "M6M"]);
const MINI_FUTURES = new Set(["NQ", "ES", "RTY", "YM", "QM", "QG"]);

function finite(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value: unknown, fallback = 1) {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
}

function uid(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizePaperSymbol(symbol: string) {
  const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const futureMatch = normalized.match(/^(MNQ|NQ|MES|ES|M2K|RTY|MYM|YM|MGC|GC|SIL|SI|MCL|CL|QM|MBT|BTC|MET|ETH|MHG|HG|PL|PA|QG|NG|RB|HO|SR3|10Y|TN|UB|ZB|ZN|ZF|ZT|M6E|6E|M6B|6B|MJY|6J|M6A|6A|M6C|MCD|6C|MSF|6S|M6M|6M|6N|ZC|ZS|ZW|ZL|ZM|LE|HE|GF)/);
  return futureMatch?.[1] ?? normalized;
}

export function paperPointValue(symbol: string) {
  return POINT_VALUES[normalizePaperSymbol(symbol)] ?? 1;
}

export function paperTickSize(symbol: string) {
  return TICK_SIZES[normalizePaperSymbol(symbol)] ?? 0.01;
}

export function paperContractSpec(symbol: string) {
  const root = normalizePaperSymbol(symbol);
  const pointValue = POINT_VALUES[root] ?? 1;
  const tickSize = TICK_SIZES[root] ?? 0.01;
  const isFutures = root in POINT_VALUES;
  const isMicro = isFutures && MICRO_FUTURES.has(root);
  const isMini = isFutures && MINI_FUTURES.has(root);
  return {
    root,
    isFutures,
    isMicro,
    isMini,
    pointValue,
    tickSize,
    tickValue: pointValue * tickSize,
    quantityLabel: isMicro ? "Micros" : isMini ? "Minis" : isFutures ? "Contracts" : "Units",
  };
}

export function paperContractNotional(symbol: string, price: number, quantity: number) {
  return Math.max(0, finite(price)) * Math.max(0, finite(quantity)) * paperPointValue(symbol);
}

export function paperProjectedPnl(
  symbol: string,
  side: PaperOrderSide,
  entryPrice: number,
  exitPrice: number,
  quantity: number,
) {
  const direction = side === "buy" ? 1 : -1;
  return (finite(exitPrice) - finite(entryPrice))
    * direction
    * paperPointValue(symbol)
    * Math.max(0, finite(quantity));
}

export function paperOrderQuantity(symbol: string, value: unknown, fallback = 1) {
  const quantity = positive(value, fallback);
  return paperContractSpec(symbol).isFutures ? Math.max(1, Math.floor(quantity)) : quantity;
}

export function snapPaperPrice(symbol: string, price: number) {
  const tick = paperTickSize(symbol);
  const snapped = Math.round(price / tick) * tick;
  const tickText = tick.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  const precision = tickText.includes(".") ? tickText.split(".")[1].length : 0;
  return Number(snapped.toFixed(Math.min(8, precision)));
}

/**
 * Arms a dragged stop on the protective side of the current executable market.
 * A pointer release is a placement action, not an instruction to cross the
 * market and close the position immediately.
 */
export function constrainDraggedPaperStop(
  position: Pick<PaperPosition, "symbol" | "side">,
  requestedPrice: number,
  quote: Pick<PaperQuote, "bid" | "ask">,
) {
  const requested = snapPaperPrice(position.symbol, requestedPrice);
  const tick = paperTickSize(position.symbol);
  if (position.side === "buy") {
    return Math.min(requested, snapPaperPrice(position.symbol, quote.bid - tick));
  }
  return Math.max(requested, snapPaperPrice(position.symbol, quote.ask + tick));
}

export function parseLeverage(value: string | undefined) {
  const match = String(value ?? "1:1").match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
  if (!match) return 1;
  const left = positive(match[1], 1);
  const right = positive(match[2], 1);
  return Math.max(1, left === 1 ? right : right === 1 ? left : left / right);
}

export function emptyPaperTradingLedger(): PaperTradingLedger {
  return { version: 1, accounts: {} };
}

function normalizePosition(value: Partial<PaperPosition>): PaperPosition | null {
  if (!value.id || !value.accountId || !value.symbol || (value.side !== "buy" && value.side !== "sell")) return null;
  const quantity = positive(value.quantity);
  const remainingQuantity = Math.max(0, Math.min(quantity, finite(value.remainingQuantity, quantity)));
  return {
    id: value.id,
    accountId: value.accountId,
    symbol: value.symbol,
    side: value.side,
    quantity,
    remainingQuantity,
    entryPrice: positive(value.entryPrice),
    openedAt: positive(value.openedAt, Date.now()),
    markPrice: positive(value.markPrice, positive(value.entryPrice)),
    unrealizedPnl: finite(value.unrealizedPnl),
    marginUsed: Math.max(0, finite(value.marginUsed)),
    leverage: positive(value.leverage),
    stopLoss: value.stopLoss == null ? null : positive(value.stopLoss),
    takeProfits: Array.isArray(value.takeProfits)
      ? value.takeProfits
          .filter((target): target is PaperTakeProfit => Boolean(target?.id) && positive(target?.price) > 0)
          .map((target) => ({
            id: target.id,
            price: positive(target.price),
            quantity: positive(target.quantity),
            filledQuantity: Math.max(0, finite(target.filledQuantity)),
          }))
      : [],
    status: remainingQuantity > 0 && value.status !== "closed" ? "open" : "closed",
    closedAt: value.closedAt,
  };
}

export function normalizePaperTradingLedger(value: unknown): PaperTradingLedger {
  if (!value || typeof value !== "object") return emptyPaperTradingLedger();
  const source = value as Partial<PaperTradingLedger>;
  const rawAccounts = source.accounts && typeof source.accounts === "object" ? source.accounts : {};
  const accounts = Object.fromEntries(
    Object.entries(rawAccounts).flatMap(([accountId, raw]) => {
      if (!raw || typeof raw !== "object") return [];
      const account = raw as Partial<PaperAccountLedger>;
      return [[accountId, {
        accountId,
        startingBalance: Math.max(0, finite(account.startingBalance)),
        cashBalance: Math.max(0, finite(account.cashBalance, finite(account.startingBalance))),
        realizedPnl: finite(account.realizedPnl),
        positions: Array.isArray(account.positions)
          ? account.positions.map(normalizePosition).filter((position): position is PaperPosition => Boolean(position))
          : [],
        orders: Array.isArray(account.orders) ? account.orders as PaperOrder[] : [],
        fills: Array.isArray(account.fills) ? account.fills as PaperTradeFill[] : [],
        updatedAt: positive(account.updatedAt, Date.now()),
      } satisfies PaperAccountLedger]];
    }),
  );
  return { version: 1, accounts };
}

export function loadPaperTradingLedger(): PaperTradingLedger {
  if (typeof window === "undefined") return emptyPaperTradingLedger();
  try {
    return normalizePaperTradingLedger(JSON.parse(window.localStorage.getItem(PAPER_TRADING_LEDGER_STORAGE_KEY) ?? "null"));
  } catch {
    return emptyPaperTradingLedger();
  }
}

export function savePaperTradingLedger(ledger: PaperTradingLedger) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAPER_TRADING_LEDGER_STORAGE_KEY, JSON.stringify(ledger));
  window.dispatchEvent(new CustomEvent(PAPER_TRADING_LEDGER_EVENT, { detail: ledger }));
}

export function ensurePaperAccountLedger(
  ledger: PaperTradingLedger,
  account: PaperTradingAccountRecord,
): PaperTradingLedger {
  if (ledger.accounts[account.id]) return ledger;
  const startingBalance = Math.max(0, parseMoney(account.balance));
  return {
    ...ledger,
    accounts: {
      ...ledger.accounts,
      [account.id]: {
        accountId: account.id,
        startingBalance,
        cashBalance: startingBalance,
        realizedPnl: 0,
        positions: [],
        orders: [],
        fills: [],
        updatedAt: Date.now(),
      },
    },
  };
}

export function resetPaperAccountLedger(
  ledger: PaperTradingLedger,
  accountId: string,
  timestamp = Date.now(),
): PaperTradingLedger {
  const account = ledger.accounts[accountId];
  if (!account) return ledger;
  return {
    ...ledger,
    accounts: {
      ...ledger.accounts,
      [accountId]: {
        accountId,
        startingBalance: account.startingBalance,
        cashBalance: account.startingBalance,
        realizedPnl: 0,
        positions: [],
        orders: [],
        fills: [],
        updatedAt: timestamp,
      },
    },
  };
}

export function clearPaperAccountFills(
  ledger: PaperTradingLedger,
  accountId: string,
  timestamp = Date.now(),
): PaperTradingLedger {
  const account = ledger.accounts[accountId];
  if (!account || account.fills.length === 0) return ledger;
  return {
    ...ledger,
    accounts: {
      ...ledger.accounts,
      [accountId]: {
        ...account,
        // Daily P&L is calculated from today's exit fills, so deleting the
        // account's fill history must clear that readout at the same time.
        // Open positions and working orders remain untouched.
        fills: [],
        updatedAt: timestamp,
      },
    },
  };
}

function calculatePnl(position: Pick<PaperPosition, "symbol" | "side" | "entryPrice">, exitPrice: number, quantity: number) {
  return paperProjectedPnl(position.symbol, position.side, position.entryPrice, exitPrice, quantity);
}

function createEntryPosition(
  account: PaperAccountLedger,
  order: PaperOrder,
  fillPrice: number,
  timestamp: number,
  leverage: number,
): PaperAccountLedger {
  const positionId = uid("paper-position");
  const quantity = positive(order.quantity);
  let unallocatedQuantity = quantity;
  const takeProfits = order.takeProfits
    .filter((target) => positive(target.price) > 0)
    .flatMap((target, index) => {
      if (unallocatedQuantity <= 0) return [];
      const targetQuantity = Math.min(unallocatedQuantity, positive(target.quantity, quantity));
      unallocatedQuantity = Math.max(0, unallocatedQuantity - targetQuantity);
      return [{
        id: uid(`paper-tp-${index + 1}`),
        price: snapPaperPrice(order.symbol, target.price),
        quantity: targetQuantity,
        filledQuantity: 0,
      }];
    });
  const position: PaperPosition = {
    id: positionId,
    accountId: order.accountId,
    symbol: order.symbol,
    side: order.side,
    quantity,
    remainingQuantity: quantity,
    entryPrice: fillPrice,
    openedAt: timestamp,
    markPrice: fillPrice,
    unrealizedPnl: 0,
    marginUsed: paperContractNotional(order.symbol, fillPrice, quantity) / Math.max(1, leverage),
    leverage,
    stopLoss: order.stopLoss == null ? null : snapPaperPrice(order.symbol, order.stopLoss),
    takeProfits,
    status: "open",
  };
  const filledOrder: PaperOrder = {
    ...order,
    status: "filled",
    filledAt: timestamp,
    filledPrice: fillPrice,
    positionId,
  };
  const fill: PaperTradeFill = {
    id: uid("paper-fill"),
    orderId: order.id,
    positionId,
    accountId: order.accountId,
    symbol: order.symbol,
    side: order.side,
    quantity,
    price: fillPrice,
    timestamp,
    role: "entry",
    realizedPnl: 0,
    label: order.side === "buy" ? "BUY" : "SELL",
  };
  return {
    ...account,
    positions: [...account.positions, position],
    orders: account.orders.map((candidate) => candidate.id === order.id ? filledOrder : candidate),
    fills: [...account.fills, fill],
    updatedAt: timestamp,
  };
}

function quoteFillPrice(side: PaperOrderSide, quote: PaperQuote) {
  return side === "buy" ? quote.ask : quote.bid;
}

function workingOrderFillPrice(order: PaperOrder, quote: PaperQuote) {
  const executablePrice = quoteFillPrice(order.side, quote);
  if (order.type !== "limit" || order.price == null) return executablePrice;
  // A limit order can receive price improvement, but it can never fill beyond its limit.
  return order.side === "buy"
    ? Math.min(order.price, executablePrice)
    : Math.max(order.price, executablePrice);
}

function orderTriggered(order: PaperOrder, quote: PaperQuote) {
  if (order.status !== "working" || order.price == null) return false;
  if (order.type === "limit") {
    return order.side === "buy" ? quote.ask <= order.price : quote.bid >= order.price;
  }
  if (order.type === "stop") {
    return order.side === "buy" ? quote.ask >= order.price : quote.bid <= order.price;
  }
  return false;
}

function protectionValid(
  side: PaperOrderSide,
  entryPrice: number,
  stopLoss: number | null,
  takeProfits: Array<{ price: number }>,
) {
  if (stopLoss != null && (side === "buy" ? stopLoss >= entryPrice : stopLoss <= entryPrice)) return false;
  return takeProfits.every((target) => side === "buy" ? target.price > entryPrice : target.price < entryPrice);
}

export function placePaperOrder(
  ledger: PaperTradingLedger,
  accounts: PaperTradingAccountRecord[],
  draft: PaperOrderDraft,
  quote: PaperQuote,
): { ledger: PaperTradingLedger; order: PaperOrder; error?: string } {
  const accountRecord = accounts.find((account) => account.id === draft.accountId);
  const fallbackOrder: PaperOrder = {
    id: uid("paper-order"),
    accountId: draft.accountId,
    symbol: draft.symbol,
    side: draft.side,
    type: draft.type,
    quantity: paperOrderQuantity(draft.symbol, draft.quantity),
    price: draft.type === "market" ? null : draft.price == null ? null : snapPaperPrice(draft.symbol, draft.price),
    status: "rejected",
    createdAt: quote.timestamp,
    stopLoss: draft.stopLoss == null ? null : snapPaperPrice(draft.symbol, draft.stopLoss),
    takeProfits: (draft.takeProfits ?? []).map((target) => ({
      price: snapPaperPrice(draft.symbol, target.price),
      quantity: paperOrderQuantity(draft.symbol, target.quantity),
    })),
  };
  if (!accountRecord) return { ledger, order: { ...fallbackOrder, rejectionReason: "Demo account not found" }, error: "Demo account not found" };
  if (!(quote.bid > 0 && quote.ask > 0)) return { ledger, order: { ...fallbackOrder, rejectionReason: "Live quote unavailable" }, error: "Live quote unavailable" };
  if (fallbackOrder.type !== "market" && !(fallbackOrder.price && fallbackOrder.price > 0)) {
    return { ledger, order: { ...fallbackOrder, rejectionReason: "Enter a valid order price" }, error: "Enter a valid order price" };
  }
  const estimatedEntry = fallbackOrder.type === "market" ? quoteFillPrice(fallbackOrder.side, quote) : fallbackOrder.price!;
  if (!protectionValid(fallbackOrder.side, estimatedEntry, fallbackOrder.stopLoss, fallbackOrder.takeProfits)) {
    return {
      ledger,
      order: { ...fallbackOrder, rejectionReason: "TP and SL must remain on the correct side of entry" },
      error: "TP and SL must remain on the correct side of entry",
    };
  }
  let nextLedger = ensurePaperAccountLedger(ledger, accountRecord);
  let account = nextLedger.accounts[draft.accountId];
  const leverage = parseLeverage(accountRecord.leverage);
  const requiredMargin = paperContractNotional(fallbackOrder.symbol, estimatedEntry, fallbackOrder.quantity) / leverage;
  const summary = summarizePaperAccount(nextLedger, accountRecord);
  if (requiredMargin > summary.availableFunds) {
    const rejectedOrder = { ...fallbackOrder, rejectionReason: "Insufficient available funds" };
    account = { ...account, orders: [...account.orders, rejectedOrder], updatedAt: quote.timestamp };
    nextLedger = { ...nextLedger, accounts: { ...nextLedger.accounts, [account.accountId]: account } };
    return { ledger: nextLedger, order: rejectedOrder, error: rejectedOrder.rejectionReason };
  }

  const workingOrder: PaperOrder = { ...fallbackOrder, status: "working" };
  account = { ...account, orders: [...account.orders, workingOrder], updatedAt: quote.timestamp };
  if (workingOrder.type === "market") {
    account = createEntryPosition(account, workingOrder, snapPaperPrice(workingOrder.symbol, quoteFillPrice(workingOrder.side, quote)), quote.timestamp, leverage);
  }
  nextLedger = { ...nextLedger, accounts: { ...nextLedger.accounts, [account.accountId]: account } };
  return {
    ledger: nextLedger,
    order: account.orders.find((order) => order.id === workingOrder.id) ?? workingOrder,
  };
}

function closePositionQuantity(
  account: PaperAccountLedger,
  position: PaperPosition,
  quantity: number,
  price: number,
  timestamp: number,
  role: Exclude<PaperFillRole, "entry">,
  orderId = "protective",
  label = role === "stop_loss" ? "SL" : role === "take_profit" ? "TP" : "CLOSE",
) {
  const closeQuantity = Math.min(position.remainingQuantity, positive(quantity));
  const pnl = calculatePnl(position, price, closeQuantity);
  const remainingQuantity = Math.max(0, position.remainingQuantity - closeQuantity);
  const nextPosition: PaperPosition = {
    ...position,
    remainingQuantity,
    markPrice: price,
    unrealizedPnl: remainingQuantity > 0 ? calculatePnl(position, price, remainingQuantity) : 0,
    status: remainingQuantity > 0 ? "open" : "closed",
    closedAt: remainingQuantity > 0 ? undefined : timestamp,
  };
  const fill: PaperTradeFill = {
    id: uid("paper-fill"),
    orderId,
    positionId: position.id,
    accountId: position.accountId,
    symbol: position.symbol,
    side: position.side === "buy" ? "sell" : "buy",
    quantity: closeQuantity,
    price,
    timestamp,
    role,
    realizedPnl: pnl,
    label,
  };
  return {
    ...account,
    cashBalance: account.cashBalance + pnl,
    realizedPnl: account.realizedPnl + pnl,
    positions: account.positions.map((candidate) => candidate.id === position.id ? nextPosition : candidate),
    fills: [...account.fills, fill],
    updatedAt: timestamp,
  };
}

export function processPaperQuote(
  ledger: PaperTradingLedger,
  accounts: PaperTradingAccountRecord[],
  symbol: string,
  quote: PaperQuote,
  options: PaperQuoteProcessingOptions = {},
): PaperTradingLedger {
  if (!(quote.bid > 0 && quote.ask > 0)) return ledger;
  let changed = false;
  const normalizedSymbol = normalizePaperSymbol(symbol);
  const nextAccounts = { ...ledger.accounts };

  for (const [accountId, original] of Object.entries(ledger.accounts)) {
    const accountRecord = accounts.find((candidate) => candidate.id === accountId);
    if (!accountRecord) continue;
    let account = original;
    const workingOrders = account.orders.filter((order) =>
      normalizePaperSymbol(order.symbol) === normalizedSymbol && orderTriggered(order, quote));
    for (const order of workingOrders) {
      account = createEntryPosition(
        account,
        order,
        snapPaperPrice(order.symbol, workingOrderFillPrice(order, quote)),
        quote.timestamp,
        parseLeverage(accountRecord.leverage),
      );
      changed = true;
    }

    const openPositions = account.positions.filter((position) =>
      position.status === "open" && normalizePaperSymbol(position.symbol) === normalizedSymbol);
    for (const originalPosition of openPositions) {
      let position = account.positions.find((candidate) => candidate.id === originalPosition.id) ?? originalPosition;
      const markPrice = position.side === "buy" ? quote.bid : quote.ask;
      const unrealizedPnl = calculatePnl(position, markPrice, position.remainingQuantity);
      if (position.markPrice !== markPrice || position.unrealizedPnl !== unrealizedPnl) {
        position = { ...position, markPrice, unrealizedPnl };
        account = {
          ...account,
          positions: account.positions.map((candidate) => candidate.id === position.id ? position : candidate),
          updatedAt: quote.timestamp,
        };
        changed = true;
      }

      const protectionIsSuspended = options.suspendedProtectionPositionIds?.has(position.id) === true
        && options.marketableProtectionPositionIds?.has(position.id) !== true;
      if (protectionIsSuspended) continue;

      const stopHit = position.stopLoss != null && (
        position.side === "buy" ? quote.bid <= position.stopLoss : quote.ask >= position.stopLoss
      );
      if (stopHit) {
        // A working simulated stop fills at its configured tick. When a trader
        // releases a dragged stop beyond the current market it is already
        // marketable, so that one release fills at the executable bid/ask.
        const stopFillPrice = options.marketableProtectionPositionIds?.has(position.id)
          ? markPrice
          : position.stopLoss!;
        account = closePositionQuantity(
          account,
          position,
          position.remainingQuantity,
          snapPaperPrice(position.symbol, stopFillPrice),
          quote.timestamp,
          "stop_loss",
          `sl-${position.id}`,
          "SL",
        );
        changed = true;
        continue;
      }

      const targets = [...position.takeProfits].sort((a, b) =>
        position.side === "buy" ? a.price - b.price : b.price - a.price);
      for (const target of targets) {
        position = account.positions.find((candidate) => candidate.id === originalPosition.id) ?? position;
        if (position.status !== "open") break;
        const remainingTargetQuantity = Math.max(0, target.quantity - target.filledQuantity);
        const targetHit = remainingTargetQuantity > 0 && (
          position.side === "buy" ? quote.bid >= target.price : quote.ask <= target.price
        );
        if (!targetHit) continue;
        const closeQuantity = Math.min(position.remainingQuantity, remainingTargetQuantity);
        const targetFillPrice = options.marketableProtectionPositionIds?.has(position.id)
          ? markPrice
          : target.price;
        account = closePositionQuantity(
          account,
          position,
          closeQuantity,
          snapPaperPrice(position.symbol, targetFillPrice),
          quote.timestamp,
          "take_profit",
          `tp-${target.id}`,
          `TP${Math.max(1, targets.findIndex((candidate) => candidate.id === target.id) + 1)}`,
        );
        account = {
          ...account,
          positions: account.positions.map((candidate) =>
            candidate.id === position.id
              ? {
                  ...candidate,
                  takeProfits: candidate.takeProfits.map((candidateTarget) =>
                    candidateTarget.id === target.id
                      ? { ...candidateTarget, filledQuantity: candidateTarget.filledQuantity + closeQuantity }
                      : candidateTarget),
                }
              : candidate),
        };
        changed = true;
      }
    }
    if (account !== original) nextAccounts[accountId] = account;
  }

  return changed ? { ...ledger, accounts: nextAccounts } : ledger;
}

export function updatePaperProtection(
  ledger: PaperTradingLedger,
  accountId: string,
  positionId: string,
  update: PaperProtectionUpdate,
): { ledger: PaperTradingLedger; error?: string } {
  const account = ledger.accounts[accountId];
  const position = account?.positions.find((candidate) => candidate.id === positionId);
  if (!account || !position || position.status !== "open") return { ledger, error: "Open position not found" };
  if (update.kind === "stop_loss") {
    const price = update.price == null ? null : snapPaperPrice(position.symbol, update.price);
    if (price != null && !(price > 0)) return { ledger, error: "Enter a valid stop-loss price" };
    const nextPosition = { ...position, stopLoss: price };
    return {
      ledger: {
        ...ledger,
        accounts: {
          ...ledger.accounts,
          [accountId]: {
            ...account,
            positions: account.positions.map((candidate) => candidate.id === positionId ? nextPosition : candidate),
            updatedAt: Date.now(),
          },
        },
      },
    };
  }

  if (!update.targetId) {
    if (update.price == null) return { ledger, error: "Take-profit level not found" };
    return addPaperTakeProfit(
      ledger,
      accountId,
      positionId,
      update.price,
      update.quantity ?? position.remainingQuantity,
    );
  }

  if (update.price == null) {
    const targetExists = position.takeProfits.some((target) => target.id === update.targetId);
    if (!targetExists) return { ledger, error: "Take-profit level not found" };
    const nextPosition = {
      ...position,
      takeProfits: position.takeProfits.filter((target) => target.id !== update.targetId),
    };
    return {
      ledger: {
        ...ledger,
        accounts: {
          ...ledger.accounts,
          [accountId]: {
            ...account,
            positions: account.positions.map((candidate) => candidate.id === positionId ? nextPosition : candidate),
            updatedAt: Date.now(),
          },
        },
      },
    };
  }

  const price = snapPaperPrice(position.symbol, update.price);
  if (!(price > 0)) return { ledger, error: "Enter a valid take-profit price" };
  const currentTarget = position.takeProfits.find((target) => target.id === update.targetId);
  if (!currentTarget) return { ledger, error: "Take-profit level not found" };
  const allocatedElsewhere = position.takeProfits.reduce(
    (total, target) => target.id === update.targetId
      ? total
      : total + Math.max(0, target.quantity - target.filledQuantity),
    0,
  );
  const availableQuantity = Math.max(
    currentTarget.filledQuantity,
    currentTarget.filledQuantity + Math.max(0, position.remainingQuantity - allocatedElsewhere),
  );
  const requestedQuantity = positive(update.quantity, currentTarget.quantity);
  const nextPosition = {
    ...position,
    takeProfits: position.takeProfits.map((target) =>
      target.id === update.targetId
        ? {
            ...target,
            price,
            quantity: Math.max(target.filledQuantity, Math.min(availableQuantity, requestedQuantity)),
          }
        : target),
  };
  return {
    ledger: {
      ...ledger,
      accounts: {
        ...ledger.accounts,
        [accountId]: {
          ...account,
          positions: account.positions.map((candidate) => candidate.id === positionId ? nextPosition : candidate),
          updatedAt: Date.now(),
        },
      },
    },
  };
}

export function addPaperTakeProfit(
  ledger: PaperTradingLedger,
  accountId: string,
  positionId: string,
  price: number,
  quantity: number,
) {
  const account = ledger.accounts[accountId];
  const position = account?.positions.find((candidate) => candidate.id === positionId);
  if (!account || !position || position.status !== "open") return { ledger, error: "Open position not found" };
  const snappedPrice = snapPaperPrice(position.symbol, price);
  if (!(snappedPrice > 0)) return { ledger, error: "Enter a valid take-profit price" };
  const allocatedQuantity = position.takeProfits.reduce(
    (total, target) => total + Math.max(0, target.quantity - target.filledQuantity),
    0,
  );
  const availableQuantity = Math.max(0, position.remainingQuantity - allocatedQuantity);
  if (availableQuantity < 1) {
    return { ledger, error: "All open contracts are already allocated across take-profit levels" };
  }
  const target: PaperTakeProfit = {
    id: uid(`paper-tp-${position.takeProfits.length + 1}`),
    price: snappedPrice,
    quantity: Math.min(availableQuantity, positive(quantity)),
    filledQuantity: 0,
  };
  return {
    ledger: {
      ...ledger,
      accounts: {
        ...ledger.accounts,
        [accountId]: {
          ...account,
          positions: account.positions.map((candidate) =>
            candidate.id === positionId ? { ...candidate, takeProfits: [...candidate.takeProfits, target] } : candidate),
          updatedAt: Date.now(),
        },
      },
    },
    target,
  };
}

export function closePaperPosition(
  ledger: PaperTradingLedger,
  accountId: string,
  positionId: string,
  quote: PaperQuote,
  quantity?: number,
) {
  const account = ledger.accounts[accountId];
  const position = account?.positions.find((candidate) => candidate.id === positionId);
  if (!account || !position || position.status !== "open") return { ledger, error: "Open position not found" };
  if (!(quote.bid > 0 && quote.ask > 0)) return { ledger, error: "Live quote unavailable" };
  const exitPrice = snapPaperPrice(position.symbol, position.side === "buy" ? quote.bid : quote.ask);
  const nextAccount = closePositionQuantity(
    account,
    position,
    quantity ?? position.remainingQuantity,
    exitPrice,
    quote.timestamp,
    "manual_close",
    `manual-${uid("paper-close")}`,
    "FLAT",
  );
  return {
    ledger: {
      ...ledger,
      accounts: {
        ...ledger.accounts,
        [accountId]: nextAccount,
      },
    },
  };
}

export function flattenPaperAccount(
  ledger: PaperTradingLedger,
  accountId: string,
  resolveQuote: (symbol: string) => PaperQuote | null,
) {
  const account = ledger.accounts[accountId];
  if (!account) return { ledger, closed: 0, errors: ["Demo account not found"] };
  let nextLedger = ledger;
  let closed = 0;
  const errors: string[] = [];
  for (const position of account.positions.filter((candidate) => candidate.status === "open" && candidate.remainingQuantity > 0)) {
    const quote = resolveQuote(position.symbol);
    if (!quote || !(quote.bid > 0 && quote.ask > 0)) {
      errors.push(`${position.symbol}: live quote unavailable`);
      continue;
    }
    const result = closePaperPosition(nextLedger, accountId, position.id, quote);
    nextLedger = result.ledger;
    if (result.error) errors.push(`${position.symbol}: ${result.error}`);
    else closed += 1;
  }
  const finalAccount = nextLedger.accounts[accountId];
  const cancelled = finalAccount.orders.filter((order) => order.status === "working").length;
  if (cancelled > 0) {
    nextLedger = {
      ...nextLedger,
      accounts: {
        ...nextLedger.accounts,
        [accountId]: {
          ...finalAccount,
          orders: finalAccount.orders.map((order): PaperOrder =>
            order.status === "working" ? { ...order, status: "cancelled" } : order),
          updatedAt: Date.now(),
        },
      },
    };
  }
  return { ledger: nextLedger, closed, cancelled, errors };
}

export function cancelPaperOrder(ledger: PaperTradingLedger, accountId: string, orderId: string): PaperTradingLedger {
  const account = ledger.accounts[accountId];
  if (!account) return ledger;
  return {
    ...ledger,
    accounts: {
      ...ledger.accounts,
      [accountId]: {
        ...account,
        orders: account.orders.map((order): PaperOrder =>
          order.id === orderId && order.status === "working" ? { ...order, status: "cancelled" } : order),
        updatedAt: Date.now(),
      },
    },
  };
}

export function clearPaperTradeHistory(ledger: PaperTradingLedger, accountId: string) {
  const account = ledger.accounts[accountId];
  if (!account) return ledger;
  const openPositionIds = new Set(account.positions.filter((position) => position.status === "open").map((position) => position.id));
  return {
    ...ledger,
    accounts: {
      ...ledger.accounts,
      [accountId]: {
        ...account,
        positions: account.positions.filter((position) => position.status === "open"),
        orders: account.orders.filter((order) => order.status === "working" || (order.positionId && openPositionIds.has(order.positionId))),
        fills: account.fills.filter((fill) => openPositionIds.has(fill.positionId)),
        updatedAt: Date.now(),
      },
    },
  };
}

export function summarizePaperAccount(
  ledger: PaperTradingLedger,
  accountRecord: PaperTradingAccountRecord,
): PaperAccountSummary {
  const account = ledger.accounts[accountRecord.id];
  const startingBalance = account?.startingBalance ?? Math.max(0, parseMoney(accountRecord.balance));
  const balance = account?.cashBalance ?? startingBalance;
  const openPositions = account?.positions.filter((position) => position.status === "open") ?? [];
  const unrealizedPnl = openPositions.reduce((sum, position) => sum + position.unrealizedPnl, 0);
  const marginUsed = openPositions.reduce(
    (sum, position) =>
      sum + paperContractNotional(position.symbol, position.entryPrice, position.remainingQuantity) / Math.max(1, position.leverage),
    0,
  );
  const closedFills = account?.fills.filter((fill) => fill.role !== "entry") ?? [];
  const wins = closedFills.filter((fill) => fill.realizedPnl > 0).length;
  const losses = closedFills.filter((fill) => fill.realizedPnl < 0).length;
  const closedTrades = closedFills.length;
  const equity = balance + unrealizedPnl;
  return {
    startingBalance,
    balance,
    equity,
    unrealizedPnl,
    realizedPnl: account?.realizedPnl ?? 0,
    marginUsed,
    availableFunds: Math.max(0, equity - marginUsed),
    openPositions: openPositions.length,
    workingOrders: account?.orders.filter((order) => order.status === "working").length ?? 0,
    closedTrades,
    wins,
    losses,
    winRate: closedTrades ? wins / closedTrades * 100 : 0,
  };
}
