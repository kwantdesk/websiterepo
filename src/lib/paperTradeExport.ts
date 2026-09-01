import {
  paperPnlDayKey,
  type PaperAccountLedger,
  type PaperTradeFill,
} from "@/lib/paperTrading";

/**
 * The day's closed trades, as a file another journal will accept.
 *
 * This exports the trades BEHIND the daily P&L figure - the same CME trading day
 * and the same exit fills the figure is summed from, so the list always
 * explains the number sitting next to it. Clearing the account's fills empties
 * both at once, because both read the same place.
 *
 * The columns are chosen to be understood twice over: every header normalises
 * to one this platform's own journal importer already recognises, and they are
 * the conventional names the hosted journals (TradeZella, Tradervue,
 * TraderSync and the rest) offer in their column mapping. There is no single
 * standard between those tools - what makes a file portable is carrying the
 * whole round trip under ordinary names, so a mapping step has something
 * obvious to point at for every field.
 */

export type PaperExportRow = {
  symbol: string;
  side: "Long" | "Short";
  quantity: number;
  entryPrice: number | null;
  exitPrice: number;
  entryAt: number | null;
  exitAt: number;
  grossPnl: number;
  commission: number;
  netPnl: number;
  accountName: string;
  setup: string;
};

const COLUMNS: ReadonlyArray<readonly [string, (row: PaperExportRow) => string]> = [
  ["Symbol", (row) => row.symbol],
  ["Side", (row) => row.side],
  ["Quantity", (row) => String(row.quantity)],
  ["Entry Price", (row) => (row.entryPrice === null ? "" : String(row.entryPrice))],
  ["Exit Price", (row) => String(row.exitPrice)],
  ["Entry DateTime", (row) => (row.entryAt === null ? "" : new Date(row.entryAt).toISOString())],
  ["Exit DateTime", (row) => new Date(row.exitAt).toISOString()],
  ["Duration", (row) => (row.entryAt === null ? "" : formatDuration(row.exitAt - row.entryAt))],
  ["Gross PnL", (row) => row.grossPnl.toFixed(2)],
  ["Commission", (row) => row.commission.toFixed(2)],
  ["Net PnL", (row) => row.netPnl.toFixed(2)],
  ["Account Name", (row) => row.accountName],
  ["Setup", (row) => row.setup],
];

/**
 * ISO 8601 throughout.
 *
 * A bare "31/08/2026 09:45" is read as August by one importer and as the 31st
 * month by another. An offset-bearing timestamp cannot be misread, and every
 * tool that accepts dates at all accepts this one.
 */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const total = Math.floor(ms / 1_000);
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function exitSetup(role: PaperTradeFill["role"]): string {
  if (role === "take_profit") return "Target";
  if (role === "stop_loss") return "Stop";
  return "Manual close";
}

function entryFillFor(account: PaperAccountLedger, exit: PaperTradeFill) {
  return account.fills.find(
    (candidate) => candidate.positionId === exit.positionId && candidate.role === "entry",
  ) ?? null;
}

/**
 * Today's closed trades for one account, oldest first.
 *
 * An entry fill is not a trade - nothing has been realised - which is the same
 * rule the daily P&L applies, so the rows sum to the figure exactly.
 */
export function dailyPaperTradeRows(
  account: PaperAccountLedger | null | undefined,
  accountName: string,
  timestamp = Date.now(),
): PaperExportRow[] {
  if (!account) return [];
  const today = paperPnlDayKey(timestamp);
  if (!today) return [];

  return account.fills
    .filter((fill) => fill.role !== "entry" && paperPnlDayKey(fill.timestamp) === today)
    .map((fill) => {
      const entry = entryFillFor(account, fill);
      const netPnl = Number.isFinite(fill.realizedPnl) ? fill.realizedPnl : 0;
      return {
        symbol: fill.symbol,
        // The fill's side is the side of the EXIT, so a long is closed by a sell.
        side: fill.side === "sell" ? "Long" : "Short",
        quantity: fill.quantity,
        entryPrice: entry && Number.isFinite(entry.price) ? entry.price : null,
        exitPrice: fill.price,
        entryAt: entry?.timestamp ?? null,
        exitAt: fill.timestamp,
        // Simulated fills carry no commission. Reporting a made-up one would
        // misstate every result in whatever journal this lands in.
        grossPnl: netPnl,
        commission: 0,
        netPnl,
        accountName,
        setup: exitSetup(fill.role),
      } satisfies PaperExportRow;
    })
    .sort((left, right) => left.exitAt - right.exitAt);
}

function csvField(value: string): string {
  // An account name may carry a comma, and a quote inside a quoted field is
  // written twice. Everything else passes through untouched.
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function paperTradeRowsToCsv(rows: readonly PaperExportRow[]): string {
  const header = COLUMNS.map(([name]) => name).join(",");
  const body = rows.map((row) => COLUMNS.map(([, read]) => csvField(read(row))).join(","));
  // A trailing newline: some importers drop the final record without one.
  return [header, ...body].join("\r\n") + "\r\n";
}

export function paperDailyExportFileName(accountName: string, timestamp = Date.now()): string {
  const day = paperPnlDayKey(timestamp) || "session";
  const safeName = accountName.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `kwantdesk-${safeName || "demo"}-trades-${day}.csv`;
}
