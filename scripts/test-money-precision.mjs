import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  paperContractSpec, paperProjectedPnl, snapPaperPrice, summarizePaperAccount,
} = await import("../src/lib/paperTrading.ts");
const { formatMoney } = await import("../src/lib/paperAccounts.ts");

/**
 * Money is exact, to the cent, everywhere it is shown.
 *
 * P&L that appears to "round" is usually the CONTRACT: one NQ moves in $5.00
 * steps because a tick is 0.25 of a $20 point, so $2,343 is not a number that
 * trade could produce. That is arithmetic, not a rounding bug - and these
 * checks pin it down so the difference stays provable rather than argued.
 *
 * What must never happen is the maths or the display quietly losing cents on
 * an instrument that can produce them.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("each contract's smallest P&L step is its tick value", () => {
  const expected = {
    NQ: 5, MNQ: 0.5, ES: 12.5, MES: 1.25, GC: 10, MGC: 1, CL: 10, MCL: 1,
  };
  for (const [symbol, step] of Object.entries(expected)) {
    const spec = paperContractSpec(symbol);
    assert.equal(spec.pointValue * spec.tickSize, step, `${symbol} tick value`);
  }
});

check("a whole-dollar NQ result is the contract, not a rounded number", () => {
  /*
   * One tick on NQ is $5.00. A P&L of $2,343 would need 117.15 points, and
   * price does not exist between ticks - so it is unreachable, while $2,345 is
   * 117.25 points exactly.
   */
  const entry = snapPaperPrice("NQ", 20000);
  const exit = snapPaperPrice("NQ", 20117.25);
  assert.equal(paperProjectedPnl("NQ", "buy", entry, exit, 1), 2345);
  // Nothing between the neighbouring ticks exists to land on.
  const oneTickLower = snapPaperPrice("NQ", 20117);
  assert.equal(paperProjectedPnl("NQ", "buy", entry, oneTickLower, 1), 2340);
});

check("instruments that can make cents do make cents", () => {
  // If these ever came back whole, THAT would be the rounding bug.
  const mnq = paperProjectedPnl("MNQ", "buy", snapPaperPrice("MNQ", 20000), snapPaperPrice("MNQ", 20000.25), 1);
  assert.equal(mnq, 0.5, `MNQ one tick should be $0.50, got ${mnq}`);
  const mes = paperProjectedPnl("MES", "buy", snapPaperPrice("MES", 5000), snapPaperPrice("MES", 5000.25), 1);
  assert.equal(mes, 1.25, `MES one tick should be $1.25, got ${mes}`);
  // And they survive being summed rather than being rounded on the way.
  assert.equal(paperProjectedPnl("MES", "buy", 5000, 5000.75, 3), 11.25);
});

check("the P&L maths never rounds", () => {
  const source = readFileSync(new URL("../src/lib/paperTrading.ts", import.meta.url), "utf8");
  const start = source.indexOf("export function paperProjectedPnl");
  const body = source.slice(start, source.indexOf("\n}", start));
  for (const rounder of ["Math.round", "Math.floor", "Math.trunc", "toFixed"]) {
    assert.ok(!body.includes(rounder), `paperProjectedPnl uses ${rounder}`);
  }
  // The ONE rounding in the file is snapping a price to its tick, which is
  // required - a futures price cannot sit between ticks.
  const snapStart = source.indexOf("export function snapPaperPrice");
  assert.ok(source.slice(snapStart, snapStart + 400).includes("Math.round(price / tick)"));
});

check("an account summary carries the cents through", () => {
  const ledger = {
    version: 1,
    accounts: {
      a1: {
        accountId: "a1", startingBalance: 50_000, cashBalance: 50_011.25,
        realizedPnl: 11.25, positions: [], orders: [], fills: [], updatedAt: 0,
      },
    },
  };
  const summary = summarizePaperAccount(ledger, { id: "a1", name: "Demo", balance: 50_000, leverage: "1:1" });
  assert.equal(summary.realizedPnl, 11.25, "realised P&L lost its cents");
  assert.equal(summary.balance % 1, 0.25, "the balance was rounded");
});

check("every money formatter shows two decimals", () => {
  assert.match(formatMoney(2345), /2,345\.00/);
  assert.match(formatMoney(11.25), /11\.25/);

  const workspace = readFileSync(
    new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
  );
  // The daily P&L readout.
  assert.match(workspace, /minimumFractionDigits: 2, maximumFractionDigits: 2/);
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  // The on-chart position and protection labels.
  assert.match(chart, /Math\.abs\(value\)\.toFixed\(2\)/);
});

check("the compact fallback keeps cents below a thousand", () => {
  /*
   * That form only appears when the full figure will not fit its card.
   * Shortening a K or an M reads as the approximation it is; turning $234.75
   * into "$235" does not - it looks exact, and it is wrong.
   */
  const journal = readFileSync(
    new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url), "utf8",
  );
  const start = journal.indexOf("function compact(value: number)");
  const body = journal.slice(start, journal.indexOf("\n}", start));
  assert.ok(body.includes("absolute.toFixed(2)"), "the compact form still drops cents");
  assert.ok(!body.includes("absolute.toFixed(0)"), "a money value is still shown whole");
});

console.log(`\nmoney precision: ${passed}/${passed} checks passed`);
