import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePaperPriceInput } from "../src/lib/paperTrading.ts";

/**
 * A limit order has to be placeable, and then has to fill on its own price.
 *
 * The engine already did the second half. What the ticket did not do was send
 * the order: there was no keyboard path at all, so typing a limit price, a
 * stop and a target and pressing Enter did nothing - which reads as the limit
 * price being ignored rather than the order never having been sent.
 */

// --- prices are read the way a trader writes them ---
{
  assert.equal(parsePaperPriceInput("29096.25"), 29096.25);
  // The chart's own price axis prints NQ with a thousands separator, so this
  // is the obvious thing to type. Number() returns NaN for it, and the ticket
  // then refused the order with "a live price is required".
  assert.equal(parsePaperPriceInput("29,096.25"), 29096.25);
  assert.equal(parsePaperPriceInput(" 29096.25 "), 29096.25);
  assert.equal(parsePaperPriceInput("29 096.25"), 29096.25);
  assert.equal(parsePaperPriceInput(".5"), 0.5);
  assert.equal(parsePaperPriceInput(29096.25), 29096.25);
}

// --- and refused, never guessed at, when they are not prices ---
{
  for (const bad of ["", "   ", "abc", "29096.25.5", "1e5x", "--5", null, undefined, Number.NaN]) {
    assert.equal(parsePaperPriceInput(bad), null, `${String(bad)} must not parse`);
  }
  // Zero and negatives are not tradeable prices.
  assert.equal(parsePaperPriceInput("0"), null);
  assert.equal(parsePaperPriceInput("-10"), null);
  // Exponent form is deliberately refused: nobody types 2.9e4 into a ticket,
  // and accepting it would let "1e999" through as Infinity.
  assert.equal(parsePaperPriceInput("2.9e4"), null);
  assert.equal(parsePaperPriceInput("1e999"), null);
}

// --- the ticket sends on Enter, and does not substitute a price ---
{
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("handleOrderTicketKeyDown"), "the ticket needs a keyboard path");
  assert.ok(workspace.includes('onKeyDown={handleOrderTicketKeyDown}'), "and it must be attached");
  assert.ok(workspace.includes('event.key !== "Enter"'), "Enter is the key that sends");
  // A multi-line field must not fire it, and an IME composition must not
  // either - Enter is how you accept a candidate.
  assert.ok(workspace.includes("event.shiftKey"), "Shift+Enter must not send");
  assert.ok(workspace.includes("isComposing"), "an IME confirmation must not send");
  assert.ok(workspace.includes("if (!tradingUnlocked) return;"), "a locked ticket must not send");

  // A mistyped limit price must be refused, not quietly replaced by the mid -
  // that would turn a fat-fingered limit into a market order.
  assert.ok(workspace.includes("is not a valid ${submitType} price"),
    "a bad limit price must be reported, not substituted");
  assert.ok(!workspace.includes("Number(orderPrice || selectedMidPrice)"),
    "the bare Number() parse must be gone");
}

// --- the broker block collapses, and starts collapsed ---
{
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const [showBrokerAccount, setShowBrokerAccount] = useState(false)"),
    "the broker account block must start collapsed");
  assert.ok(workspace.includes("setShowBrokerAccount((value) => !value)"), "and be toggleable");
  assert.ok(workspace.includes("{showBrokerAccount && <div"), "its body must be conditional");
  // Collapsing it is only worth anything if the position actions move up.
  const ticket = workspace.slice(workspace.indexOf("Broker account"));
  const actionsIndex = ticket.indexOf("Cancel Bids");
  assert.ok(actionsIndex > 0 && actionsIndex < 12_000,
    "cancel bids/asks/all, reverse and break even sit below it and come into view");
}

console.log("Paper limit order ticket tests passed.");

// ---------------------------------------------------------------------------
// The whole point: a limit order rests, fills on its own price, and the stop
// and target it was placed with then manage the position.
// ---------------------------------------------------------------------------
{
  const { placePaperOrder, processPaperQuote } = await import("../src/lib/paperTrading.ts");

  const account = {
    id: "acct-1", name: "Sim", balance: "5000000", equity: "5000000", leverage: "1:1",
    strategy: "", instrument: "NQ", running: true, change: "0", pnl: "0",
    positions: "0", today: "0", trades: 0, created: "", points: "0",
  };
  const accounts = [account];
  const quote = (bid, ask, t) => ({ bid, ask, timestamp: t });
  const authorized = { executionAuthorized: true };
  let ledger = { version: 1, accounts: {} };

  // Buy limit 100 points BELOW the market, with a stop under it and a target
  // above - exactly the ticket's three fields.
  const placed = placePaperOrder(ledger, accounts, {
    accountId: "acct-1", symbol: "NQ", side: "buy", type: "limit", quantity: 2,
    price: 29000, stopLoss: 28950, takeProfits: [{ price: 29100, quantity: 2 }],
  }, quote(29100, 29100.25, 1_000));
  assert.equal(placed.error, undefined, `placement was refused: ${placed.error}`);
  assert.equal(placed.order.status, "working", "a limit order rests; it does not fill on placement");
  ledger = placed.ledger;
  assert.equal(ledger.accounts["acct-1"].positions.length, 0, "no position until it is touched");

  // Price drifts down but does NOT reach the limit.
  ledger = processPaperQuote(ledger, accounts, "NQ", quote(29010, 29010.25, 2_000), authorized);
  assert.equal(ledger.accounts["acct-1"].positions.length, 0, "must not fill above the limit");

  // Price touches the limit.
  ledger = processPaperQuote(ledger, accounts, "NQ", quote(28999.75, 29000, 3_000), authorized);
  const positions = ledger.accounts["acct-1"].positions;
  assert.equal(positions.length, 1, "the limit fills when price reaches it");
  const position = positions[0];
  assert.equal(position.quantity, 2, "it fills the contracts that were ordered");
  assert.ok(position.entryPrice <= 29000, "and never worse than the limit");
  // The stop and target placed with the order have to survive onto the
  // position, or the trade is live and unprotected.
  assert.equal(position.stopLoss, 28950, "the stop follows the fill");
  assert.equal(position.takeProfits.length, 1, "and so does the target");
  assert.equal(position.takeProfits[0].price, 29100);

  // Target hit -> the position closes for a profit.
  const won = processPaperQuote(ledger, accounts, "NQ", quote(29100, 29100.25, 4_000), authorized);
  const wonPosition = won.accounts["acct-1"].positions.find((p) => p.id === position.id);
  assert.equal(wonPosition.status, "closed", "the take profit closes it");
  const tpFill = won.accounts["acct-1"].fills.find((f) => f.role === "take_profit");
  assert.ok(tpFill, "a take-profit fill is recorded");
  assert.ok(tpFill.realizedPnl > 0, `the target must pay: ${tpFill.realizedPnl}`);

  // And from the same filled state, the stop instead -> a loss.
  const lost = processPaperQuote(ledger, accounts, "NQ", quote(28949.75, 28950, 4_000), authorized);
  const lostPosition = lost.accounts["acct-1"].positions.find((p) => p.id === position.id);
  assert.equal(lostPosition.status, "closed", "the stop closes it");
  const slFill = lost.accounts["acct-1"].fills.find((f) => f.role === "stop_loss");
  assert.ok(slFill, "a stop-loss fill is recorded");
  assert.ok(slFill.realizedPnl < 0, `the stop must cost: ${slFill.realizedPnl}`);
}

// --- a sell limit is the mirror ---
{
  const { placePaperOrder, processPaperQuote } = await import("../src/lib/paperTrading.ts");
  const account = {
    id: "acct-2", name: "Sim", balance: "5000000", equity: "5000000", leverage: "1:1",
    strategy: "", instrument: "NQ", running: true, change: "0", pnl: "0",
    positions: "0", today: "0", trades: 0, created: "", points: "0",
  };
  const accounts = [account];
  const quote = (bid, ask, t) => ({ bid, ask, timestamp: t });
  let ledger = { version: 1, accounts: {} };
  const placed = placePaperOrder(ledger, accounts, {
    accountId: "acct-2", symbol: "NQ", side: "sell", type: "limit", quantity: 1,
    price: 29200, stopLoss: 29250, takeProfits: [{ price: 29100, quantity: 1 }],
  }, quote(29100, 29100.25, 1_000));
  assert.equal(placed.order.status, "working");
  ledger = placed.ledger;
  // Below the limit must not fill a sell limit.
  ledger = processPaperQuote(ledger, accounts, "NQ", quote(29150, 29150.25, 2_000), { executionAuthorized: true });
  assert.equal(ledger.accounts["acct-2"].positions.length, 0);
  ledger = processPaperQuote(ledger, accounts, "NQ", quote(29200, 29200.25, 3_000), { executionAuthorized: true });
  assert.equal(ledger.accounts["acct-2"].positions.length, 1, "a sell limit fills when bid reaches it");
  assert.ok(ledger.accounts["acct-2"].positions[0].entryPrice >= 29200, "never worse than the limit");
}

console.log("Paper limit order engine tests passed.");
