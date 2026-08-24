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

// --- a click confirms; it never sends straight away ---
{
  assert.ok(workspace.includes("setPendingChartOrder({ ...armed, price })"),
    "a chart click must open a confirmation");
  assert.ok(workspace.includes("Place {pendingChartOrder.type} order?"), "the dialog states the intent");
  assert.ok(workspace.includes("Yes, place it"), "and needs an explicit yes");
  // Arming ends at the pick, so one arm places one order.
  const pick = workspace.slice(workspace.indexOf("onArmedOrderPick={(price) => {"));
  assert.ok(pick.slice(0, 400).includes("setArmedOrder(null)"),
    "picking must disarm, so one arm places one order");
  // Cancelling must not leave the chart armed or the dialog open.
  assert.ok(workspace.includes("onClick={() => setPendingChartOrder(null)}"), "cancel closes it");
  assert.ok(workspace.includes("onArmedOrderCancel={() => setArmedOrder(null)}"), "escape disarms");
}

// --- the confirmed price is carried on the intent, not through the field ---
{
  assert.ok(workspace.includes("price: order.price,"), "the picked price is sent with the order");
  const submit = workspace.slice(workspace.indexOf("const submitPaperOrder = (intent?: {"));
  assert.ok(submit.slice(0, 900).includes("price?: number;"), "the intent carries a price");
  assert.ok(workspace.includes("intent?.price != null"),
    "a chart-picked price must not depend on the ticket field having re-rendered");
}

// --- arming is offered only where a resting order makes sense ---
{
  // The button lives inside the limit/stop price block, which only renders
  // when the type is not market - a market order has no level to pick.
  // Scoped to the LIVE ticket. There is a second, disabled copy behind
  // `false &&` whose price field is uncontrolled; asserting against that one
  // would pass while the real ticket had no button at all.
  const priceBlock = workspace.slice(workspace.indexOf("value={orderPrice} onChange="));
  const scoped = priceBlock.slice(0, priceBlock.indexOf("</div>}") + 7);
  assert.ok(!workspace.slice(0, workspace.indexOf("value={orderPrice} onChange="))
    .includes("Place on chart"), "the button must not be on the disabled ticket");
  assert.ok(scoped.includes("Place on chart"), "arming belongs with the resting-order price");
  assert.ok(scoped.includes("disabled={!tradingUnlocked}"), "a locked ticket cannot arm");
  assert.ok(scoped.includes("type: orderType"), "it arms the type the ticket is set to");
  assert.ok(scoped.includes("quantity: selectedOrderQuantity"), "with the contracts typed in");
}

console.log("Chart limit placement tests passed.");
