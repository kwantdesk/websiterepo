#!/usr/bin/env node
/**
 * Which accumulation policy should v2 ship with?
 *
 * A single classified trade tells you the dealer took the other side. It does
 * not tell you whether that position is still open an hour later, and OPRA has
 * no reliable per-print open/close flag - the provider's isOpeningPosition was
 * true on 2 records out of 417 in the sampled session, far too sparse to gate
 * on. So the engine needs a policy for how long absorbed flow keeps counting.
 *
 * Three candidates, each a different assumption about that:
 *
 *   carry     every classified trade counts forever. Assumes nothing closes.
 *   session   only today's flow counts. Assumes everything closes overnight.
 *   decay     a trade's weight halves every H hours. Assumes positions close at
 *             some rate, without pretending to know which ones.
 *
 * An ad-hoc run on one frame put "session" far ahead on SPXW (r=0.716 against
 * v1's 0.141). One frame is one minute of one session, which is exactly how a
 * policy gets fitted to noise, so this scores every captured frame and reports
 * the mean. A policy that only wins on one frame is not a policy.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TAPE = fileURLToPath(new URL("../tmp/trinity-inventory-tape-2026-08-17-to-2026-08-21.json", import.meta.url));
const INPUTS = fileURLToPath(new URL("../tmp/trinity-dealer-inventory-inputs-2026-08-21.json", import.meta.url));
const TRINITY = fileURLToPath(new URL("./trinity-extra-lattices-2026-08-21.json", import.meta.url));

for (const path of [TAPE, INPUTS, TRINITY]) {
  if (!existsSync(path)) {
    console.log(`skipped: ${path} is not in this working tree.`);
    process.exit(0);
  }
}

const tape = JSON.parse(readFileSync(TAPE, "utf8"));
const inputs = JSON.parse(readFileSync(INPUTS, "utf8"));
const lattices = JSON.parse(readFileSync(TRINITY, "utf8"));

const ZERO_DTE = "2026-08-21";
const SESSION_OPEN = Date.parse("2026-08-21T09:30:00-04:00");
const SYMBOLS = { SPXW: "SPX", SPY: "SPY", QQQ: "QQQ" };
/** v1's measured correlation at matched 0DTE scope — the number to beat. */
const V1_R = { SPXW: 0.141, SPY: 0.006, QQQ: 0.244 };
const OI_BOUND = 0.35;
const HOUR = 3_600_000;

const POLICIES = [
  { name: "carry", weight: () => 1 },
  { name: "session", weight: (age, ts) => (ts >= SESSION_OPEN ? 1 : 0) },
  ...[1, 3, 6, 12, 24].map((hours) => ({
    name: `decay ${hours}h`,
    weight: (age) => 2 ** (-age / (hours * HOUR)),
  })),
];

function pearson(rows, f, g) {
  const n = rows.length;
  if (n < 3) return Number.NaN;
  const mf = rows.reduce((s, k) => s + f(k), 0) / n;
  const mg = rows.reduce((s, k) => s + g(k), 0) / n;
  let cov = 0;
  let vf = 0;
  let vg = 0;
  for (const k of rows) {
    const a = f(k) - mf;
    const b = g(k) - mg;
    cov += a * b;
    vf += a * a;
    vg += b * b;
  }
  return vf && vg ? cov / Math.sqrt(vf * vg) : Number.NaN;
}

/** Score one policy for one symbol at one frame. */
function score(symbol, frameIso, policy) {
  const chain = inputs[SYMBOLS[symbol]];
  const trades = tape[SYMBOLS[symbol]];
  const target = lattices[frameIso]?.[symbol]?.values;
  if (!chain || !trades || !target) return null;
  const cutoff = Date.parse(frameIso);

  const oi = (strike, right) => {
    const cell = chain.oi[strike.toFixed(1)] ?? chain.oi[String(strike)];
    if (!cell) return 0;
    return (right === "call" ? cell.callOpenInterest : cell.putOpenInterest) || 0;
  };

  const quantity = new Map();
  for (const trade of trades) {
    if (trade.timestamp > cutoff || trade.expiration !== ZERO_DTE) continue;
    const dealerSign = trade.side === "BUY" ? -1 : trade.side === "SELL" ? 1 : 0;
    if (!dealerSign) continue;
    const weight = policy.weight(cutoff - trade.timestamp, trade.timestamp);
    if (weight <= 0) continue;
    const right = trade.type === "CALL" ? "call" : "put";
    const key = `${right}:${trade.strike}`;
    const bound = oi(trade.strike, right) * OI_BOUND;
    const next = (quantity.get(key) ?? 0) + trade.size * dealerSign * weight;
    quantity.set(key, bound > 0 ? Math.min(bound, Math.max(-bound, next)) : next);
  }

  const node = new Map();
  for (const [strikeKey, exposure] of Object.entries(chain.exposure)) {
    const strike = Number(strikeKey);
    const callOi = oi(strike, "call");
    const putOi = oi(strike, "put");
    const callQty = quantity.get(`call:${strike}`) ?? 0;
    const putQty = quantity.get(`put:${strike}`) ?? 0;
    if (!callQty && !putQty) continue;
    node.set(
      strike,
      callQty * (callOi > 0 ? Math.abs(exposure.callExposure || 0) / callOi : 0)
      + putQty * (putOi > 0 ? Math.abs(exposure.putExposure || 0) / putOi : 0),
    );
  }

  const rows = Object.keys(target).map(Number).filter((k) => node.has(k));
  if (rows.length < 8) return null;
  return {
    r: pearson(rows, (k) => target[k], (k) => node.get(k)),
    signMatch: rows.filter((k) => Math.sign(target[k]) === Math.sign(node.get(k))).length / rows.length,
    rows: rows.length,
  };
}

const frames = Object.keys(lattices).sort();
console.log(`Frames scored: ${frames.length} (${frames[0]} .. ${frames[frames.length - 1]})\n`);

const mean = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : Number.NaN);

for (const symbol of Object.keys(SYMBOLS)) {
  console.log(`${symbol}   (v1 r = ${V1_R[symbol].toFixed(3)})`);
  console.log("  policy        frames   mean r   worst r   mean sign   beats v1");
  const ranked = [];
  for (const policy of POLICIES) {
    const scored = frames.map((frame) => score(symbol, frame, policy)).filter(Boolean);
    if (!scored.length) continue;
    const rs = scored.map((s) => s.r).filter(Number.isFinite);
    if (!rs.length) continue;
    const meanR = mean(rs);
    // Worst frame matters more than the average: a policy that is strong on
    // three frames and inverted on the fourth is not usable on a live desk.
    const worst = rs.reduce((low, r) => (Math.abs(r) < Math.abs(low) || Math.sign(r) !== Math.sign(meanR) ? r : low), rs[0]);
    ranked.push({ policy: policy.name, meanR, worst, sign: mean(scored.map((s) => s.signMatch)), frames: rs.length });
  }
  ranked.sort((a, b) => b.meanR - a.meanR);
  for (const row of ranked) {
    console.log(
      `  ${row.policy.padEnd(12)} ${String(row.frames).padStart(6)}`
      + `  ${row.meanR.toFixed(3).padStart(7)}  ${row.worst.toFixed(3).padStart(8)}`
      + `  ${(row.sign * 100).toFixed(0).padStart(10)}%   ${row.meanR > V1_R[symbol] ? "yes" : "no"}`,
    );
  }
  console.log();
}

console.log(
  "A policy is only worth shipping if it beats v1 on the MEAN and holds its\n"
  + "sign on the worst frame. Anything that wins on one frame and inverts on\n"
  + "another is noise that happened to line up once.",
);
