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

const defaultSparkline = "5,36 20,28 35,32 50,18 65,24 80,16 95,22 115,14";

export function loadPaperTradingAccounts(): PaperTradingAccountRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PAPER_TRADING_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PaperTradingAccountRecord[]) : [];
  } catch {
    return [];
  }
}

export function savePaperTradingAccounts(accounts: PaperTradingAccountRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAPER_TRADING_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
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
    id: `paper-${createdAt.getTime()}`,
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

export function parseMoney(value: string) {
  return Number(value.replace(/[$,]/g, "")) || 0;
}

export function formatMoney(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
