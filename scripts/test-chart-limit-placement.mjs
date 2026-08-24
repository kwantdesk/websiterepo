import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Placing a resting order by pointing at the level.
 *
 * Arm the ticket, the chart follows the cursor with the order's own line, a
 * click picks the price, a confirmation opens, and yes sends it. The order
 * then rests until price reaches it, at which point the stop and target drag
 * on the chart exactly as they do for any other position.
 */
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

// --- the chart follows the cursor while an order is armed ---
{
  assert.ok(chart.includes("armedOrder?: { side:"), "the chart has to know an order is armed");
  const block = chart.slice(chart.indexOf("Arming a resting order on the chart"));
  const body = block.slice(0, block.indexOf("const primitive = paperPositionOverlayPrimitiveRef"));
  assert.ok(body.includes('container.addEventListener("pointermove", follow)'),
    "the line must track the cursor");
  assert.ok(body.includes("series.coordinateToPrice"), "and read a real price from the scale");
  // A picked level must be a price that can actually rest on the book.
  assert.ok(body.includes("snapPaperPrice(instrument, raw)"), "the price must snap to the tick");
  // The click belongs to placement alone; the drawing and crosshair layers
  // must not also act on it.
  assert.ok(body.includes('container.addEventListener("click", pick, true)'), "capture phase");
  assert.ok(body.includes("event.stopPropagation()") && body.includes("event.preventDefault()"),
    "the chart owns the click while armed");
  assert.ok(body.includes('event.key === "Escape"'), "Escape must disarm");
  // Listeners must not outlive the armed state.
  assert.ok(body.includes('container.removeEventListener("pointermove", follow)'), "cleanup");
  assert.ok(body.includes('container.removeEventListener("click", pick, true)'), "cleanup");
}

// --- the armed line is drawn on the existing position overlay ---
{
  assert.ok(chart.includes('id: "armed-order"'), "the armed line is an overlay level");
  assert.ok(chart.includes("click to place"), "and says what a click will do");
  // It must clear when the order is disarmed, or a stale line stays behind.
  assert.ok(chart.includes("if (!armedOrder) setArmedOrderPrice(null);"),
    "disarming must clear the line");
}

// --- choosing limit arms the chart; there is no second button to press ---
{
  const armed = workspace.slice(workspace.indexOf("const armedOrder = useMemo("));
  const body = armed.slice(0, armed.indexOf("],") + 2);
  assert.ok(body.includes('orderType === "limit" || orderType === "stop"'),
    "the TYPE is the intent - selecting limit must arm the chart on its own");
  assert.ok(body.includes("tradingUnlocked"), "a locked ticket must not arm");
  assert.ok(body.includes('rightPanel === "order"'),
    "a closed ticket must not leave the chart armed behind it");
  assert.ok(body.includes("pendingChartOrder === null"),
    "a second click must not stack another dialog on the first");
  // The chart subscribes listeners on this identity, so it has to be stable.
  assert.ok(body.includes("useMemo("), "the armed order must be memoised, not rebuilt each render");

  // A fresh choice of type or side is a fresh intent, so it resumes placement.
  assert.ok(workspace.includes("setOrderType(type); setChartPlacementSuspended(false);"),
    "changing type must re-arm");
  assert.ok(workspace.includes('setOrderSide("buy"); setChartPlacementSuspended(false);'),
    "changing side must re-arm");
}

// --- a click confirms; it never sends straight away ---
{
  assert.ok(workspace.includes("setPendingChartOrder({ ...armed, price })"),
    "a chart click must open a confirmation");
  assert.ok(workspace.includes("Place {pendingChartOrder.type} order?"), "the dialog states the intent");
  assert.ok(workspace.includes("Yes, place it"), "and needs an explicit yes");
  assert.ok(workspace.includes("onClick={() => setPendingChartOrder(null)}"), "cancel closes it");
  assert.ok(workspace.includes("onArmedOrderCancel={() => setChartPlacementSuspended(true)}"),
    "Escape suspends placement");
}

// --- the confirmed price is carried on the intent, not through the field ---
{
  assert.ok(workspace.includes("price: order.price,"), "the picked price is sent with the order");
  const submit = workspace.slice(workspace.indexOf("const submitPaperOrder = (intent?: {"));
  assert.ok(submit.slice(0, 900).includes("price?: number;"), "the intent carries a price");
  assert.ok(workspace.includes("intent?.price != null"),
    "a chart-picked price must not depend on the ticket field having re-rendered");
}

// --- the chart re-attaches once it is ready ---
{
  // Arming before the series exists used to return early and never re-attach,
  // which looks exactly like the feature not working.
  assert.ok(
    chart.includes("}, [armedOrder, chartReadyRevision, instrument, onArmedOrderCancel, onArmedOrderPick]);"),
    "the listeners must re-attach when the chart becomes ready",
  );
}

console.log("Chart limit placement tests passed.");
