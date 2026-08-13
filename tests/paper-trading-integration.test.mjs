import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const accounts = readFileSync(new URL("../src/app/accounts/page.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../src/components/AppSidebar.tsx", import.meta.url), "utf8");
const engine = readFileSync(new URL("../src/lib/paperTrading.ts", import.meta.url), "utf8");

test("the right rail exposes Trade below Watchlist and before Live GEX", () => {
  assert.match(workspace, /id: "watchlist" as const[\s\S]{0,140}id: "order" as const[\s\S]{0,140}id: "gex" as const/);
  assert.match(workspace, /title: "Trade"/);
});

test("the top-right trades control matches primary navigation sizing without all-caps text", () => {
  assert.match(navigation, /className=\{`\$\{tradesActive \? horizontalItemActive : horizontalItemInactive\} normal-case`\}/);
  assert.match(navigation, /style=\{\{ textTransform: "none" \}\}/);
  assert.match(navigation, /<span>trades<\/span>/);
});

test("paper orders use the live futures quote and persist through the ledger", () => {
  assert.match(workspace, /placePaperOrder\(/);
  assert.match(workspace, /processPaperQuote\(/);
  assert.match(workspace, /savePaperTradingLedger\(paperLedger\)/);
  assert.match(workspace, /onClick=\{tradingUnlocked \? submitPaperOrder/);
  assert.match(engine, /workingOrderFillPrice/);
  assert.match(engine, /Math\.min\(order\.price, executablePrice\)/);
  assert.match(engine, /Math\.max\(order\.price, executablePrice\)/);
});

test("futures contract sizing covers the principal CME products", () => {
  for (const symbol of ["MNQ", "NQ", "MES", "ES", "M2K", "RTY", "MYM", "YM", "MGC", "GC", "MCL", "CL", "MBT", "BTC", "MET", "ETH"]) {
    assert.match(engine, new RegExp(`\\b${symbol}:`));
  }
  assert.match(engine, /const POINT_VALUES/);
  assert.match(engine, /const TICK_SIZES/);
  assert.match(engine, /marginUsed/);
});

test("chart receives paper positions, fills, and draggable bracket updates", () => {
  assert.match(chart, /paperPositions\?: PaperPosition\[\]/);
  assert.match(chart, /paperFills\?: PaperTradeFill\[\]/);
  assert.match(chart, /startPaperProtectionDrag/);
  assert.match(chart, /kind: "stop_loss"/);
  assert.match(chart, /kind: "take_profit"/);
  assert.match(workspace, /onUpdatePaperProtection=\{handlePaperProtectionUpdate\}/);
  assert.match(chart, /onClosePaperPosition\?: \(position: PaperPosition\)/);
  assert.match(workspace, /onClosePaperPosition=\{handleFlattenPaperPosition\}/);
  assert.match(workspace, /handleFlattenPaperAccount/);
  assert.match(workspace, /Flatten all/);
});

test("execution accounting remains tick accurate and gap-aware", () => {
  assert.match(engine, /\(exitPrice - position\.entryPrice\) \* direction \* paperPointValue\(position\.symbol\) \* quantity/);
  assert.match(engine, /const stopFillPrice = position\.side === "buy"/);
  assert.match(engine, /Math\.min\(position\.stopLoss!, quote\.bid\)/);
  assert.match(engine, /Math\.max\(position\.stopLoss!, quote\.ask\)/);
  assert.match(workspace, /Tick size/);
  assert.match(workspace, /1-point value/);
});

test("trade panel reports live open P&L and today's realized P&L instead of recent fills", () => {
  assert.match(engine, /export function dailyRealizedPaperPnl/);
  assert.match(engine, /fill\.role === "entry"/);
  assert.match(engine, /paperPnlDayKey\(fill\.timestamp\)/);
  assert.match(workspace, /selectedPaperOpenPnl = selectedPaperSummary\?\.unrealizedPnl/);
  assert.match(workspace, /selectedPaperDailyPnl = dailyRealizedPaperPnl/);
  assert.match(workspace, /Open P&amp;L/);
  assert.match(workspace, /Daily P&amp;L/);
  assert.doesNotMatch(workspace, /Recent fills/);
});

test("Accounts is a top-level destination after Backtesting and creates CME demo accounts", () => {
  assert.match(navigation, /key: "backtesting"[\s\S]{0,180}key: "accounts"/);
  assert.match(accounts, /orientation="horizontal"/);
  assert.match(accounts, /All CME Futures/);
  assert.match(accounts, /NQ \/ MNQ/);
  assert.match(accounts, /ES \/ MES/);
});
