import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync("src/components/options-flow/GammaWorkspace.tsx", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

test("gamma workspace owns the cockpit type system", () => {
  assert.match(workspace, /kwant-gamma-workspace/);
  assert.match(styles, /\.kwant-gamma-workspace[\s\S]*font-family: "Rajdhani"/);
});

test("gamma numbers and timestamps use one tabular numeric face", () => {
  assert.match(workspace, /data-gamma-number="true"/);
  assert.match(workspace, /data-gamma-time="true"/);
  assert.match(styles, /\.kwant-gamma-workspace \[data-gamma-number="true"\]/);
  assert.match(styles, /\.kwant-gamma-workspace \[data-gamma-time="true"\]/);
  assert.match(styles, /font-family: "JetBrains Mono"/);
  assert.match(styles, /font-variant-numeric: tabular-nums slashed-zero/);
});
