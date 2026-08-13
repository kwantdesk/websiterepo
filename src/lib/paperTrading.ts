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
  "6S": 125_000,
  MSF: 12_500,
  "6M": 500_000,
  M6M: 50_000,
  ZC: 5_000,
  ZS: 5_000,
  ZW: 5_000,
  ZL: 60_000,
  ZM: 100,
  LE: 40_000,
  HE: 40_000,
  GF: 50_000,
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
  SR3: 0.0025,
  "6E": 0.00005,
  M6E: 0.0001,
  "6B": 0.0001,
  M6B: 0.0001,
  "6J": 0.0000005,
  MJY: 0.000001,
  "6A": 0.0001,
  M6A: 0.0001,
  "6C": 0.0001,
  M6C: 0.0001,
  "6S": 0.0001,
  MSF: 0.0001,
  "6M": 0.00001,
  M6M: 0.00001,
  ZC: 0.0025,
  ZS: 0.0025,
  ZW: 0.0025,
  ZL: 0.0001,
  ZM: 0.1,
  LE: 0.00025,
  HE: 0.00025,
  GF: 0.00025,
};

const MICRO_FUTURES = new Set(["MNQ", "MES", "M2K", "MYM", "MGC", "SIL", "MCL", "MBT", "MET", "MHG", "M6E", "M6B", "MJY", "M6A", "M6C", "MSF", "M6M"]);

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
  const futureMatch = normalized.match(/^(MNQ|NQ|MES|ES|M2K|RTY|MYM|YM|MGC|GC|SIL|SI|MCL|CL|MBT|BTC|MET|ETH|MHG|HG|PL|PA|QG|NG|RB|HO|SR3|ZB|ZN|ZF|ZT|M6E|6E|M6B|6B|MJY|6J|M6A|6A|M6C|6C|MSF|6S|M6M|6M|ZC|ZS|ZW|ZL|ZM|LE|HE|GF)/);
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
  return {
    root,
    isFutures,
    isMicro,
    pointValue,
    tickSize,
    tickValue: pointValue * tickSize,
    quantityLabel: isMicro ? "Micro contracts" : isFutures ? "Contracts" : "Units",
  };
}

export function paperContractNotional(symbol: string, price: number, quantity: number) {
  return Math.max(0, finite(price)) * Math.max(0, finite(quantity)) * paperPointValue(symbol);
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

function calculatePnl(position: Pick<PaperPosition, "symbol" | "side" | "entryPrice">, exitPrice: number, quantity: number) {
  const direction = position.side === "buy" ? 1 : -1;
  return (exitPrice - position.entryPrice) * direction * paperPointValue(position.symbol) * quantity;
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
  const takeProfits = order.takeProfits
    .filter((target) => positive(target.price) > 0)
    .map((target, index) => ({
      id: uid(`paper-tp-${index + 1}`),
      price: snapPaperPrice(order.symbol, target.price),
      quantity: Math.min(quantity, positive(target.quantity, quantity)),
      filledQuantity: 0,
    }));
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
        snapPaperPrice(order.symbol, quoteFillPrice(order.side, quote)),
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

      const stopHit = position.stopLoss != null && (
        position.side === "buy" ? quote.bid <= position.stopLoss : quote.ask >= position.stopLoss
      );
      if (stopHit) {
        account = closePositionQuantity(
          account,
          position,
          position.remainingQuantity,
          position.stopLoss!,
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
        account = closePositionQuantity(
          account,
          position,
          closeQuantity,
          target.price,
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
  update:
    | { kind: "stop_loss"; price: number | null }
    | { kind: "take_profit"; targetId: string; price: number; quantity?: number },
): { ledger: PaperTradingLedger; error?: string } {
  const account = ledger.accounts[accountId];
  const position = account?.positions.find((candidate) => candidate.id === positionId);
  if (!account || !position || position.status !== "open") return { ledger, error: "Open position not found" };
  if (update.kind === "stop_loss") {
    const price = update.price == null ? null : snapPaperPrice(position.symbol, update.price);
    const marketPrice = position.markPrice > 0 ? position.markPrice : position.entryPrice;
    if (price != null && (position.side === "buy" ? price >= marketPrice : price <= marketPrice)) {
      return {
        ledger,
        error: position.side === "buy"
          ? "A long stop can trail above breakeven, but it must remain below the live market"
          : "A short stop can trail below breakeven, but it must remain above the live market",
      };
    }
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

  const price = snapPaperPrice(position.symbol, update.price);
  if (position.side === "buy" ? price <= position.entryPrice : price >= position.entryPrice) {
    return { ledger, error: position.side === "buy" ? "A long target must remain above entry" : "A short target must remain below entry" };
  }
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
  if (position.side === "buy" ? snappedPrice <= position.entryPrice : snappedPrice >= position.entryPrice) {
    return { ledger, error: position.side === "buy" ? "A long target must remain above entry" : "A short target must remain below entry" };
  }
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

