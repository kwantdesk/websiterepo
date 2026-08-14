import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const accounts = readFileSync(new URL("../src/app/accounts/page.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../src/components/AppSidebar.tsx", import.meta.url), "utf8");
const engine = readFileSync(new URL("../src/lib/paperTrading.ts", import.meta.url), "utf8");
const databento = readFileSync(new URL("../src/lib/databento.ts", import.meta.url), "utf8");

function numericRecord(name) {
  const match = engine.match(new RegExp(`const ${name}: Record<string, number> = (\\{[\\s\\S]*?\\n\\});`));
  assert.ok(match, `${name} must remain a directly auditable numeric contract table`);
  return runInNewContext(`(${match[1]})`);
}

test("the right rail exposes Trade below Watchlist and before Live GEX", () => {
  assert.match(workspace, /id: "watchlist" as const[\s\S]{0,140}id: "order" as const[\s\S]{0,140}id: "gex" as const/);
  assert.match(workspace, /title: "Trade"/);
});

test("trade Buy and Sell controls inherit the active chart candle colours", () => {
  assert.match(workspace, /color: chartSettings\.downColor/);
  assert.match(workspace, /color: chartSettings\.upColor/);
  assert.match(workspace, /colorWithAlpha\(chartSettings\.downColor, orderSide === "sell"/);
  assert.match(workspace, /colorWithAlpha\(chartSettings\.upColor, orderSide === "buy"/);
  assert.match(workspace, /backgroundColor: orderSide === "buy" \? chartSettings\.upColor : chartSettings\.downColor/);
  assert.doesNotMatch(workspace, /style=\{\{ color: "#EF4444" \}\}>\{orderPanelBidLabel\}/);
  assert.doesNotMatch(workspace, /style=\{\{ color: "#22C55E" \}\}>\{orderPanelAskLabel\}/);
});

test("the top-right Trade control uses the exact primary navigation control without a separate underline", () => {
  assert.match(navigation, /const horizontalItemBase =\s*\n\s*"kwant-primary-nav-control /);
  assert.match(navigation, /className=\{tradesActive \? horizontalItemActive : horizontalItemInactive\}/);
  assert.match(navigation, /title="Trade"/);
  assert.match(navigation, /aria-label="Open trade menu"/);
  assert.match(navigation, /<span>Trade<\/span>/);
  assert.doesNotMatch(navigation, /<span>Trade<\/span>\s*\{tradesActive \? <ActiveUnderline/);
  assert.doesNotMatch(navigation, /horizontalItemInactive\} normal-case/);
});

test("paper orders use the live futures quote and persist through the ledger", () => {
  assert.match(workspace, /placePaperOrder\(/);
  assert.match(workspace, /processPaperQuote\(/);
  assert.match(workspace, /savePaperTradingLedger\(paperLedger\)/);
  assert.match(workspace, /onClick=\{tradingUnlocked \? submitPaperOrder/);
  assert.match(workspace, /activePaneId === pane\.id \|\| paperExecutionTrackedSymbols\.has\(normalizePaperSymbol\(pane\.symbol\)\)/);
  assert.match(workspace, /activeChartExecutionQuoteRef\.current/);
  assert.match(workspace, /Waiting for the active chart's live executable price\. No market order was sent\./);
  assert.match(workspace, /bid: activeQuote\.bid, ask: activeQuote\.ask, timestamp: Date\.now\(\)/);
  assert.match(engine, /workingOrderFillPrice/);
  assert.match(engine, /Math\.min\(order\.price, executablePrice\)/);
  assert.match(engine, /Math\.max\(order\.price, executablePrice\)/);
});

test("new 50K and 100K sim accounts cannot be shadowed by a zero-balance ledger placeholder", () => {
  assert.match(engine, /const isZeroBalancePlaceholder = existing\.startingBalance <= 0/);
  assert.match(engine, /account!\.orders\.some\(\(order\) => order\.status !== "rejected"\)/);
  assert.match(engine, /startingBalance,[\s\S]{0,80}cashBalance: startingBalance/);
  assert.match(engine, /const recordBalance = Math\.max\(0, parseMoney\(accountRecord\.balance\)\)/);
  assert.match(workspace, /const nextLedger = ensurePaperAccountLedger\(paperLedgerRef\.current, nextAccount\)/);
  assert.match(workspace, /savePaperTradingLedger\(nextLedger\)/);
  assert.match(accounts, /savePaperTradingLedger\(reconciledLedger\)/);
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

test("every futures instrument exposed by the platform has an explicit point and tick value", () => {
  const pointValues = numericRecord("POINT_VALUES");
  const tickSizes = numericRecord("TICK_SIZES");
  const futuresBlock = databento.match(/export const DATABENTO_FUTURES[\s\S]*?\n\];/)?.[0] ?? "";
  const roots = [...futuresBlock.matchAll(/symbol: "([A-Z0-9]+)\.v\.0"/g)].map((match) => match[1]);
  assert.ok(roots.length > 40, "the public CME futures universe should be covered by the audit");
  for (const root of roots) {
    assert.ok(Number.isFinite(pointValues[root]), `${root} is missing its point value`);
    assert.ok(Number.isFinite(tickSizes[root]), `${root} is missing its tick size`);
    assert.ok(pointValues[root] > 0, `${root} point value must be positive`);
    assert.ok(tickSizes[root] > 0, `${root} tick size must be positive`);
  }
});

test("index mini and micro P&L matches CME point and tick values", () => {
  const pointValues = numericRecord("POINT_VALUES");
  const tickSizes = numericRecord("TICK_SIZES");
  const expected = {
    NQ: { point: 20, tick: 0.25, tickUsd: 5 },
    MNQ: { point: 2, tick: 0.25, tickUsd: 0.5 },
    ES: { point: 50, tick: 0.25, tickUsd: 12.5 },
    MES: { point: 5, tick: 0.25, tickUsd: 1.25 },
    RTY: { point: 50, tick: 0.1, tickUsd: 5 },
    M2K: { point: 5, tick: 0.1, tickUsd: 0.5 },
    YM: { point: 5, tick: 1, tickUsd: 5 },
    MYM: { point: 0.5, tick: 1, tickUsd: 0.5 },
  };
  for (const [root, spec] of Object.entries(expected)) {
    assert.equal(pointValues[root], spec.point, `${root} dollars per point`);
    assert.equal(tickSizes[root], spec.tick, `${root} tick size`);
    assert.equal(pointValues[root] * tickSizes[root], spec.tickUsd, `${root} dollars per tick`);
    assert.equal((100 - 101) * pointValues[root], -spec.point, `${root} one-contract one-point long loss`);
    assert.equal((101 - 100) * -1 * pointValues[root], -spec.point, `${root} one-contract one-point short loss`);
  }
});

test("rates, FX, grain and livestock risk uses displayed-price contract conventions", () => {
  const pointValues = numericRecord("POINT_VALUES");
  const tickSizes = numericRecord("TICK_SIZES");
  const expectedTicks = {
    QM: 12.5,
    TN: 15.625,
    UB: 31.25,
    "10Y": 1,
    "6A": 5,
    "6C": 5,
    "6S": 6.25,
    "6N": 5,
    ZC: 12.5,
    ZS: 12.5,
    ZW: 12.5,
    ZL: 6,
    ZM: 10,
    LE: 10,
    HE: 10,
    GF: 12.5,
  };
  for (const [root, tickUsd] of Object.entries(expectedTicks)) {
    assert.equal(pointValues[root] * tickSizes[root], tickUsd, `${root} dollars per tick`);
  }
});

test("order tickets distinguish contract classes while chart labels use signed quantities", () => {
  assert.match(engine, /const MINI_FUTURES = new Set\(\["NQ", "ES", "RTY", "YM", "QM", "QG"\]\)/);
  assert.match(engine, /quantityLabel: isMicro \? "Micros" : isMini \? "Minis"/);
  assert.match(chart, /return `\$\{side === "buy" \? "\+" : "-"\}\$\{absoluteQuantity\.toLocaleString\("en-US"\)\}`/);
  assert.doesNotMatch(chart, /absoluteQuantity === 1 \? "contract"/);
  assert.match(workspace, /selectedPaperContract\.isMini[\s\S]{0,120}mini/);
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
  assert.match(chart, /paperPositionSizeLabel/);
  assert.match(chart, /paperProtectionSizeLabel/);
  assert.match(chart, /positionSide === "buy" \? "sell" : "buy"/);
  assert.match(chart, /SL · \$\{paperProtectionSizeLabel\(position\.side, position\.remainingQuantity\)\}/);
  assert.match(chart, /TP\$\{position\.takeProfits\.length > 1[\s\S]*?paperProtectionSizeLabel\(position\.side, target\.quantity - target\.filledQuantity\)/);
  assert.match(chart, /side === "buy" \? "\+" : "-"/);
  assert.match(chart, /absolute right-0 z-\[32\][^\n]*tabular-nums/);
  assert.match(chart, /aria-label=\{`Entry price \$\{level\.position\.entryPrice\.toFixed\(priceFormat\.precision\)\}`\}/);
  assert.doesNotMatch(chart, /\? "LONG" : "SHORT"\} · \$\{level\.livePosition\.quantity\}/);
  assert.match(chart, /SL ·/);
  assert.match(chart, /TP\$\{position\.takeProfits\.length > 1/);
  assert.match(chart, /requestAnimationFrame\(flushPreview\)/);
  assert.match(chart, /paper-position-overlay-label[^\n]*absolute right-1 flex h-4 w-\[164px\]/);
  assert.match(chart, /paper-protection-overlay-label[^\n]*absolute right-1[^\n]*h-4 w-\[164px\]/);
  assert.match(chart, /class PaperPositionOverlayPrimitive/);
  assert.match(chart, /candleSeries\.attachPrimitive\(paperPositionOverlayPrimitive\)/);
  assert.match(chart, /context\.fillRect\(labelX, labelTop, labelWidth, labelHeight\)/);
  assert.match(chart, /const labelWidth = 164/);
  assert.doesNotMatch(chart, /paper-protection-draft-label/);
  assert.match(chart, /onPaperProtectionDragStateChange\?\.\(level\.position\.id, true\)/);
  assert.match(chart, /updatePreview\(upEvent\.clientY\)/);
  assert.match(workspace, /suspendedPaperProtectionIdsRef/);
  assert.match(workspace, /constrainDraggedPaperStop\(position, update\.price, quote\)/);
  assert.match(workspace, /if \(update\.kind === "stop_loss" \|\| update\.price == null\) \{\s*commitPaperLedger\(result\.ledger\);\s*return;/);
  assert.match(workspace, /marketableProtectionPositionIds: new Set\(\[positionId\]\)/);
  assert.doesNotMatch(chart, /paper-(?:position|protection)(?:-draft)?-overlay-label[^\n]*absolute left-/);
});

test("an unprotected fill exposes chart-native SL and TP drag handles that create working protection", () => {
  assert.match(chart, /startNewPaperProtectionDrag/);
  assert.match(chart, /Add stop loss to \$\{level\.position\.symbol\} position/);
  assert.match(chart, /Add take profit to \$\{level\.position\.symbol\} position/);
  assert.match(chart, /level\.position\.stopLoss === null/);
  assert.match(chart, /!level\.position\.takeProfits\.some/);
  assert.match(chart, /quantity: position\.remainingQuantity/);
  assert.match(chart, /snapPaperPrice\(position\.symbol, rawPrice\)/);
  assert.match(chart, /paperProjectedPnl\(/);
  assert.match(engine, /targetId\?: string/);
  assert.match(engine, /return addPaperTakeProfit\(/);
});

test("active stop-loss and take-profit labels can be removed and recreated from the entry handles", () => {
  assert.match(chart, /const removePaperProtection/);
  assert.match(chart, /kind: "stop_loss",[\s\S]*?price: null/);
  assert.match(chart, /kind: "take_profit",[\s\S]*?targetId: level\.targetId,[\s\S]*?price: null/);
  assert.match(chart, /Remove \$\{level\.kind === "stop_loss" \? "stop loss" : "take profit"\}/);
  assert.match(engine, /takeProfits: position\.takeProfits\.filter\(\(target\) => target\.id !== update\.targetId\)/);
  assert.match(workspace, /update\.kind === "stop_loss" \|\| update\.price == null/);
});

test("paper fills render as persistent candle-anchored entry and exit arrows", () => {
  assert.match(engine, /export function paperFillCandleTimestamp/);
  assert.match(chart, /paperFillCandleTimestamp\(candles, fill\.timestamp\)/);
  assert.match(chart, /class PaperFillMarkersPrimitive/);
  assert.match(chart, /candleSeries\.attachPrimitive\(paperFillMarkersPrimitive\)/);
  assert.match(chart, /const entry = marker\.role === "entry"/);
  assert.match(chart, /side: fill\.side/);
  assert.match(chart, /marker\.side === "buy" \? "#22e887" : "#ff3b5c"/);
  assert.match(chart, /#22e887/);
  assert.match(chart, /#ff3b5c/);
  assert.match(chart, /context\.moveTo\(x - 6, y - 4\)/);
  assert.match(chart, /context\.moveTo\(x \+ 6, y - 4\)/);
  assert.match(chart, /Remove all fills/);
  assert.match(workspace, /kwantify-hidden-paper-fill-markers-v1/);
  assert.match(workspace, /onRemovePaperFills=\{handleRemovePaperFillMarkers\}/);
  assert.doesNotMatch(chart, /fill\.side === "buy" \? "▲" : "▼"/);
});

test("removing all fills also resets the selected account's daily P&L", () => {
  assert.match(engine, /export function clearPaperAccountFills/);
  assert.match(engine, /fills: \[\]/);
  assert.match(workspace, /clearPaperAccountFills\(paperLedgerRef\.current, accountId\)/);
  assert.match(workspace, /fills removed .* Daily P&L reset/);
  assert.match(workspace, /selectedPaperDailyPnl = dailyRealizedPaperPnl\(selectedPaperAccountLedger\)/);
});

test("the chart can reset the selected sim account's trades, fills, orders, and P&L", () => {
  assert.match(chart, /Reset all trades and fills/);
  assert.match(chart, /Open and daily P&amp;L will return to zero/);
  assert.match(chart, /onResetPaperTrading\?\.\(\)/);
  assert.match(workspace, /onResetPaperTrading=\{selectedPaperTradingAccount \? handleResetPaperTrading : undefined\}/);
  assert.match(workspace, /resetPaperAccountLedger\(paperLedgerRef\.current, accountId\)/);
  assert.match(engine, /export function resetPaperAccountLedger/);
  assert.match(engine, /cashBalance: account\.startingBalance/);
  assert.match(engine, /realizedPnl: 0/);
  assert.match(engine, /positions: \[\]/);
  assert.match(engine, /orders: \[\]/);
  assert.match(engine, /fills: \[\]/);
});

test("execution accounting remains tick accurate and protection is deterministic", () => {
  assert.match(engine, /export function paperProjectedPnl/);
  assert.match(engine, /paperProjectedPnl\(position\.symbol, position\.side, position\.entryPrice, exitPrice, quantity\)/);
  assert.match(engine, /suspendedProtectionPositionIds/);
  assert.match(engine, /marketableProtectionPositionIds/);
  assert.match(engine, /: position\.stopLoss!/);
  assert.match(engine, /const targetFillPrice = options\.marketableProtectionPositionIds/);
  assert.match(engine, /export function constrainDraggedPaperStop/);
  assert.match(engine, /Math\.min\(requested, snapPaperPrice\(position\.symbol, quote\.bid - tick\)\)/);
  assert.match(engine, /Math\.max\(requested, snapPaperPrice\(position\.symbol, quote\.ask \+ tick\)\)/);
  assert.doesNotMatch(engine, /must remain below the live market/);
  assert.doesNotMatch(engine, /must remain above the live market/);
  assert.match(workspace, /Tick size/);
  assert.match(workspace, /1-point value/);
});

test("trade panel reports live open P&L and today's realized P&L instead of recent fills", () => {
  assert.match(engine, /export function dailyRealizedPaperPnl/);
  assert.match(engine, /fill\.role === "entry"/);
  assert.match(engine, /paperPnlDayKey\(fill\.timestamp\)/);
  assert.doesNotMatch(workspace, /selectedPaperOpenPnl = selectedPaperSummary\?\.unrealizedPnl/);
  assert.match(workspace, /selectedPaperDailyPnl = dailyRealizedPaperPnl/);
  assert.match(workspace, /Open P&amp;L/);
  assert.match(workspace, /Daily P&amp;L/);
  assert.match(workspace, /publishLiveExecutionQuote\(quote\)/);
  assert.match(workspace, /liveExecutionQuotesBySymbol\.set\(normalizePaperSymbol\(quote\.symbol\), quote\)/);
  assert.match(workspace, /position\.side === "buy" \? quote\.bid : quote\.ask/);
  assert.match(workspace, /paperExecutionTrackedSymbols\.has\(normalizePaperSymbol\(pane\.symbol\)\)/);
  assert.match(workspace, /function LivePaperPositionPnl/);
  assert.match(workspace, /function LivePaperOpenPnl/);
  assert.match(workspace, /<LivePaperOpenPnl positions=\{selectedPaperOpenPositions\} \/>/);
  assert.match(chart, /paperPositionOverlayPrimitiveRef\.current\?\.updateMarkPrice\(candle\.close\)/);
  assert.match(chart, /updateMarkPrice\(price: number\)/);
  assert.match(chart, /const renderedLabel = livePnl === null/);
  assert.doesNotMatch(workspace, /Recent fills/);
});

test("Accounts is a top-level destination after Backtesting and creates CME demo accounts", () => {
  assert.match(navigation, /key: "backtesting"[\s\S]{0,180}key: "accounts"/);
  assert.match(accounts, /orientation="horizontal"/);
  assert.match(accounts, /All CME Futures/);
  assert.match(accounts, /NQ \/ MNQ/);
  assert.match(accounts, /ES \/ MES/);
});
