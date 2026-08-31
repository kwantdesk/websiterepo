import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  dailyPaperTradeRows, paperTradeRowsToCsv, paperDailyExportFileName,
} = await import("../src/lib/paperTradeExport.ts");
const { dailyRealizedPaperPnl, paperPnlDayKey } = await import("../src/lib/paperTrading.ts");
const { journalHeaderScore, parseDelimited } = await import("../src/lib/journal.ts");

/**
 * The day's closed trades, as a file another journal will accept.
 *
 * The list has to explain the number printed beside it, so it reads the same
 * New York day and the same exit fills the daily P&L is summed from. And it has
 * to be portable: there is no single standard between the hosted journals, so
 * what makes a file work everywhere is carrying the whole round trip under
 * ordinary column names that a mapping step can point at.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// 2026-08-31, 13:45 UTC = 09:45 New York.
const TODAY = Date.UTC(2026, 7, 31, 13, 45);
const HOUR = 3_600_000;

const fill = (over = {}) => ({
  id: "f1", orderId: "o1", positionId: "p1", accountId: "acc1", symbol: "NQ",
  side: "buy", quantity: 2, price: 20000, timestamp: TODAY - HOUR, role: "entry",
  realizedPnl: 0, label: "", ...over,
});
const ledgerAccount = (fills) => ({
  accountId: "acc1", startingBalance: 50000, cashBalance: 50000, realizedPnl: 0,
  positions: [], orders: [], fills, updatedAt: 0,
});

const roundTrip = [
  fill(),
  fill({ id: "f2", side: "sell", role: "take_profit", price: 20100, timestamp: TODAY, realizedPnl: 4000 }),
];

check("only today's closed trades are exported", () => {
  const yesterday = TODAY - 24 * HOUR;
  const account = ledgerAccount([
    ...roundTrip,
    fill({ id: "old-entry", positionId: "p0", timestamp: yesterday - HOUR }),
    fill({ id: "old-exit", positionId: "p0", side: "sell", role: "stop_loss", price: 19900, timestamp: yesterday, realizedPnl: -4000 }),
  ]);
  const rows = dailyPaperTradeRows(account, "Demo One", TODAY);
  assert.equal(rows.length, 1, "a trade from another day was exported");
  assert.equal(rows[0].exitPrice, 20100);
});

check("the rows sum to the daily figure printed beside them", () => {
  /*
   * The list exists to explain that number. If the two ever drew a different
   * boundary or applied a different rule, the file would contradict the screen.
   */
  const account = ledgerAccount([
    ...roundTrip,
    fill({ id: "f3", positionId: "p2", timestamp: TODAY - 2 * HOUR }),
    fill({ id: "f4", positionId: "p2", side: "sell", role: "stop_loss", price: 19950, timestamp: TODAY - HOUR, realizedPnl: -1000 }),
  ]);
  const rows = dailyPaperTradeRows(account, "Demo One", TODAY);
  const summed = rows.reduce((total, row) => total + row.netPnl, 0);
  assert.equal(summed, dailyRealizedPaperPnl(account, TODAY));
  assert.equal(summed, 3000);
});

check("an entry on its own is never a row", () => {
  // Nothing has been realised, and the daily figure ignores it for the same reason.
  const rows = dailyPaperTradeRows(ledgerAccount([fill()]), "Demo One", TODAY);
  assert.equal(rows.length, 0);
  assert.equal(dailyRealizedPaperPnl(ledgerAccount([fill()]), TODAY), 0);
});

check("clearing the fills empties the export", () => {
  // Both read the same place, so this needs no separate reset.
  assert.deepEqual(dailyPaperTradeRows(ledgerAccount([]), "Demo One", TODAY), []);
  assert.deepEqual(dailyPaperTradeRows(null, "Demo One", TODAY), []);
});

check("a long is the one closed by a sell", () => {
  const [long] = dailyPaperTradeRows(ledgerAccount(roundTrip), "Demo One", TODAY);
  assert.equal(long.side, "Long");
  const [short] = dailyPaperTradeRows(ledgerAccount([
    fill({ side: "sell" }),
    fill({ id: "f2", side: "buy", role: "take_profit", price: 19900, timestamp: TODAY, realizedPnl: 4000 }),
  ]), "Demo One", TODAY);
  assert.equal(short.side, "Short");
});

check("our own journal importer recognises the file", () => {
  /*
   * The point of the column choice. If this platform's own importer cannot read
   * its own export, no hosted one is going to do better.
   *
   * parseDelimited picks the header row by score and keys the data off it, so
   * getting named fields back at all is the importer agreeing.
   */
  const csv = paperTradeRowsToCsv(dailyPaperTradeRows(ledgerAccount(roundTrip), "Demo One", TODAY));
  const headerLine = csv.split(String.fromCharCode(13, 10))[0];
  const score = journalHeaderScore(headerLine.split(","));
  assert.ok(score >= 9, `the header scored ${score}; the importer would not trust it`);
  const [row] = parseDelimited(csv);
  assert.equal(row.Symbol, "NQ", "the importer did not key off our header row");
});

check("the columns a mapping importer expects are all present", () => {
  const csv = paperTradeRowsToCsv(dailyPaperTradeRows(ledgerAccount(roundTrip), "Demo One", TODAY));
  const [row] = parseDelimited(csv);
  for (const column of [
    "Symbol", "Side", "Quantity", "Entry Price", "Exit Price",
    "Entry DateTime", "Exit DateTime", "Duration",
    "Gross PnL", "Commission", "Net PnL", "Account Name", "Setup",
  ]) {
    assert.ok(column in row, `missing column: ${column}`);
  }
  assert.equal(row.Symbol, "NQ");
  assert.equal(row.Quantity, "2");
  assert.equal(row["Entry Price"], "20000");
  assert.equal(row["Net PnL"], "4000.00");
  assert.equal(row.Setup, "Target");
  assert.equal(row.Duration, "01:00:00");
});

check("dates are written so they cannot be misread", () => {
  /*
   * "31/08/2026" is August to one importer and a 31st month to another. An ISO
   * timestamp has one reading everywhere.
   */
  const csv = paperTradeRowsToCsv(dailyPaperTradeRows(ledgerAccount(roundTrip), "Demo One", TODAY));
  const [row] = parseDelimited(csv);
  const exitAt = row["Exit DateTime"];
  assert.match(exitAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, `not ISO 8601: ${exitAt}`);
  assert.equal(Date.parse(exitAt), TODAY);
});

check("a comma in an account name cannot break the file", () => {
  const csv = paperTradeRowsToCsv(dailyPaperTradeRows(ledgerAccount(roundTrip), 'Prop, "Sim"', TODAY));
  const [row] = parseDelimited(csv);
  // Reading back exactly what went in proves the quoting held; a broken escape
  // would have spilled into the next column instead.
  assert.equal(row["Account Name"], 'Prop, "Sim"');
  assert.equal(row.Symbol, "NQ");
});

check("no commission is invented for a simulated fill", () => {
  const [row] = dailyPaperTradeRows(ledgerAccount(roundTrip), "Demo One", TODAY);
  assert.equal(row.commission, 0);
  assert.equal(row.grossPnl, row.netPnl);
});

check("the file is named for the account and the session date", () => {
  const name = paperDailyExportFileName("Prop Sim #1", TODAY);
  assert.equal(name, `kwantdesk-prop-sim-1-trades-${paperPnlDayKey(TODAY)}.csv`);
  assert.match(paperDailyExportFileName("", TODAY), /^kwantdesk-demo-trades-/);
});

check("the button sits with the figure and reuses the download helper", () => {
  const workspace = readFileSync(
    new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
  );
  assert.match(workspace, /onClick=\{downloadPaperDailyTrades\}/);
  assert.match(workspace, /disabled=\{!selectedPaperDailyTradeRows\.length\}/, "the export is offered with nothing to export");
  /*
   * The shared helper revokes the object URL on a timeout. Revoking it
   * immediately after the click cancels the download in some browsers, which is
   * why this must not grow its own copy of the same few lines.
   */
  const start = workspace.indexOf("const downloadPaperDailyTrades");
  const handler = workspace.slice(start, workspace.indexOf("};", start));
  assert.ok(start > -1, "the export handler is gone");
  assert.ok(handler.includes("downloadLevelFile("), "the shared download helper is not used");
  assert.ok(
    handler.includes("paperDailyExportFileName(name, paperValuationTimestamp)"),
    "the file is not named for the account and session date",
  );
  assert.ok(!handler.includes("URL.revokeObjectURL"), "the handler revokes the URL itself");
  assert.ok(!workspace.includes(String.fromCharCode(0xFEFF)), "a literal byte order mark is sitting in the source");
});

console.log(`\npaper trade export: ${passed}/${passed} checks passed`);
