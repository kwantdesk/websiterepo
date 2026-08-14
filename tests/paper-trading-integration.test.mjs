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

test("the top-right TRADE control uses the exact primary navigation typography", () => {
  assert.match(navigation, /className=\{tradesActive \? horizontalItemActive : horizontalItemInactive\}/);
  assert.match(navigation, /title="Trade"/);
  assert.match(navigation, /aria-label="Open trade menu"/);
  assert.match(navigation, /<span>TRADE<\/span>/);
  assert.doesNotMatch(navigation, /horizontalItemInactive\} normal-case/);
});

test("paper orders use the live futures quote and persist through the ledger", () => {
  assert.match(workspace, /placePaperOrder\(/);
  assert.match(workspace, /processPaperQuote\(/);
  assert.match(workspace, /savePaperTradingLedger\(paperLedger\)/);
  assert.match(workspace, /onClick=\{tradingUnlocked \? submitPaperOrder/);
  assert.match(workspace, /onLiveExecutionQuote=\{activePaneId === pane\.id \? handleActiveChartExecutionQuote : undefined\}/);
  assert.match(workspace, /activeChartExecutionQuoteRef\.current/);
  assert.match(workspace, /Waiting for the active chart's live executable price\. No market order was sent\./);
  assert.match(workspace, /bid: activeQuote\.bid, ask: activeQuote\.ask, timestamp: Date\.now\(\)/);
  assert.match(engine, /workingOrderFillPrice/);
  assert.match(engine, /Math\.min\(order\.price, executablePrice\)/);
  assert.match(engine, /Math\.max\(order\.price, executablePrice\)/);
});

test("the chart execution bridge rejects incoherent books instead of filling away from visible price", () => {
  assert.match(workspace, /const bookIsCoherent = Number\.isFinite\(rawBid\)/);
  assert.match(workspace, /rawAsk - rawBid <= tickSize \* 8/);
  assert.match(workspace, /bid: bookIsCoherent \? snapPaperPrice\(pane\.symbol, rawBid\) : mid/);
  assert.match(workspace, /ask: bookIsCoherent \? snapPaperPrice\(pane\.symbol, rawAsk\) : mid/);
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
  assert.match(chart, /paperProjectedPnl/);
  assert.match(chart, /SL ·/);
  assert.match(chart, /TP\$\{position\.takeProfits\.length > 1/);
  assert.match(chart, /requestAnimationFrame\(flushPreview\)/);
  assert.match(chart, /paper-position-overlay-label[^\n]*absolute right-1 flex h-4/);
  assert.match(chart, /paper-protection-overlay-label[^\n]*absolute right-1 h-4/);
  assert.match(chart, /paper-protection-draft-label[^\n]*absolute right-1 h-4/);
  assert.doesNotMatch(chart, /paper-(?:position|protection)(?:-draft)?-overlay-label[^\n]*absolute left-/);
});

test("an unprotected fill exposes chart-native SL and TP drag handles that create working protection", () => {
  assert.match(chart, /startNewPaperProtectionDrag/);
  assert.match(chart, /Add stop loss to \$\{level\.position\.symbol\} position/);
  assert.match(chart, /Add take profit to \$\{level\.position\.symbol\} position/);
  assert.match(chart, /level\.position\.stopLoss === null/);
  assert.match(chart, /!level\.position\.takeProfits\.some/);
  assert.match(chart, /quantity: position\.remainingQuantity/);
  assert.match(chart, /paperTickSize\(position\.symbol\)/);
  assert.match(chart, /paperProjectedPnl\(/);
  assert.match(engine, /targetId\?: string/);
  assert.match(engine, /return addPaperTakeProfit\(/);
});

test("paper fills render as persistent candle-anchored entry and exit arrows", () => {
  assert.match(engine, /export function paperFillCandleTimestamp/);
  assert.match(chart, /paperFillCandleTimestamp\(candles, fill\.timestamp\)/);
  assert.match(chart, /fill\.role === "entry"/);
  assert.match(chart, /#22e887/);
  assert.match(chart, /#ff3b5c/);
  assert.match(chart, /M0\.75 0\.75 L12\.25 4\.5 L0\.75 8\.25 Z/);
  assert.match(chart, /M12\.25 0\.75 L0\.75 4\.5 L12\.25 8\.25 Z/);
  assert.doesNotMatch(chart, /M0\.75 1\.25 H8\.25/);
  assert.doesNotMatch(chart, /stroke="rgba\(0,0,0,0\.72\)"/);
  assert.match(chart, /Hide fill markers/);
  assert.match(workspace, /kwantify-hidden-paper-fill-markers-v1/);
  assert.match(workspace, /onRemovePaperFills=\{handleRemovePaperFillMarkers\}/);
  assert.doesNotMatch(chart, /fill\.side === "buy" \? "▲" : "▼"/);
});

test("the chart can reset the selected sim account's trades, fills, orders, and P&L", () => {
  assert.match(chart, /Reset all trades and fills/);
  assert.match(chart, /Open and daily P&amp;L will return to zero/);
  assert.match(chart, /onResetPaperTrading\?\.\(\)/);
  assert.match(workspace, /onResetPaperTrading=\{selectedPaperTradingAccount \? handleResetPaperTrading : undefined\}/);
  assert.match(workspace, /resetPaperAccountLedger\(current, accountId\)/);
  assert.match(engine, /export function resetPaperAccountLedger/);
  assert.match(engine, /cashBalance: account\.startingBalance/);
  assert.match(engine, /realizedPnl: 0/);
  assert.match(engine, /positions: \[\]/);
  assert.match(engine, /orders: \[\]/);
  assert.match(engine, /fills: \[\]/);
});

test("execution accounting remains tick accurate and gap-aware", () => {
  assert.match(engine, /export function paperProjectedPnl/);
  assert.match(engine, /paperProjectedPnl\(position\.symbol, position\.side, position\.entryPrice, exitPrice, quantity\)/);
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
