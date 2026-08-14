import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspace = fs.readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const indicators = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
const sourceIndicators = fs.readFileSync(new URL("../src/components/SourceCodeIndicatorsControl.tsx", import.meta.url), "utf8");
const timezone = fs.readFileSync(new URL("../src/components/ui/TimeZoneSelect.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("chart command-row controls use one compact visual contract", () => {
  assert.match(styles, /\.kwant-chart-command-deck \.kwant-chart-row-control\s*\{[\s\S]*?height:\s*28px;[\s\S]*?border-radius:\s*3px/);
  assert.match(indicators, /kwant-chart-row-control flex h-7/);
  assert.match(sourceIndicators, /kwant-chart-row-control flex h-7/);
  assert.match(timezone, /compact \? "kwant-chart-row-control h-7/);
  assert.equal((workspace.match(/kwant-chart-row-control flex h-7 w-7/g) ?? []).length, 2);
});

test("download and account triggers are square rather than legacy pills", () => {
  const commandRow = workspace.slice(
    workspace.indexOf("<ChartIndicatorsControl"),
    workspace.indexOf("</header>", workspace.indexOf("<ChartIndicatorsControl")),
  );
  assert.match(commandRow, /title="Export chart levels"[\s\S]*?kwant-chart-row-control flex h-7 w-7[\s\S]*?rounded-\[3px\]/);
  assert.doesNotMatch(commandRow, /rounded-full border border-border bg-surface/);
});
