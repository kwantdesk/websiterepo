export type PaperTradingAccountRecord = {
  id: string;
  name: string;
  balance: string;
  equity: string;
  leverage: string;
  strategy: string;
  instrument: string;
  running: boolean;
  change: string;
  pnl: string;
  positions: string;
  today: string;
  trades: number;
  created: string;
  points: string;
};

export const PAPER_TRADING_ACCOUNTS_STORAGE_KEY = "kwantify-paper-trading-accounts";
export const PAPER_TRADING_ACCOUNTS_EVENT = "kwantify-paper-trading-accounts-change";

const defaultSparkline = "5,36 20,28 35,32 50,18 65,24 80,16 95,22 115,14";

export function loadPaperTradingAccounts(): PaperTradingAccountRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PAPER_TRADING_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value): PaperTradingAccountRecord[] => {
      if (!value || typeof value !== "object") return [];
      const account = value as Partial<PaperTradingAccountRecord> & { balance?: unknown; equity?: unknown };
      if (!account.id || !account.name) return [];
      const balance = Math.max(0, parseMoney(account.balance));
      const parsedEquity = parseMoney(account.equity);
      const equity = parsedEquity > 0 ? parsedEquity : balance;
      return [{
        id: String(account.id),
        name: String(account.name),
        balance: formatMoney(balance),
        equity: formatMoney(equity),
        leverage: String(account.leverage || "1:1"),
        strategy: String(account.strategy || "Manual / No Strategy"),
        instrument: String(account.instrument || "All CME Futures"),
        running: Boolean(account.running),
        change: String(account.change || "+0.00%"),
        pnl: String(account.pnl || "$0.00"),
        positions: String(account.positions || "0 open positions"),
        today: String(account.today || "$0.00"),
        trades: Math.max(0, Number(account.trades) || 0),
        created: String(account.created || ""),
        points: String(account.points || defaultSparkline),
      }];
    });
  } catch {
    return [];
  }
}

export function savePaperTradingAccounts(accounts: PaperTradingAccountRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAPER_TRADING_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  window.dispatchEvent(new CustomEvent(PAPER_TRADING_ACCOUNTS_EVENT, { detail: accounts }));
}

export function createPaperTradingAccount(input: {
  name: string;
  balance: number;
  leverage: string;
  instrument: string;
  strategy?: string;
}): PaperTradingAccountRecord {
  const createdAt = new Date();
  const balanceLabel = formatMoney(input.balance);
  return {
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `paper-${crypto.randomUUID()}`
      : `paper-${createdAt.getTime()}-${Math.random().toString(36).slice(2, 9)}`,
    name: input.name.trim(),
    balance: balanceLabel,
    equity: balanceLabel,
    leverage: input.leverage,
    strategy: input.strategy?.trim() || "Manual / No Strategy",
    instrument: input.instrument,
    running: false,
    change: "+0.00%",
    pnl: "$0.00",
    positions: "0 open positions",
    today: "$0.00",
    trades: 0,
    created: createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    points: defaultSparkline,
  };
}

export function parseMoney(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return 0;
  const negative = normalized.startsWith("(") && normalized.endsWith(")");
  const multiplier = normalized.endsWith("k")
    ? 1_000
    : normalized.endsWith("m")
      ? 1_000_000
      : 1;
  // `Intl.NumberFormat` may emit "$100,000.00", "USD 100,000.00", or a
  // locale-specific currency token. Keep only the numeric sign/decimal after
  // reading a compact K/M suffix so every stored display format round-trips.
  const parsed = Number(normalized.replace(/[^0-9.+-]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return (negative ? -Math.abs(parsed) : parsed) * multiplier;
}

export function formatMoney(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
