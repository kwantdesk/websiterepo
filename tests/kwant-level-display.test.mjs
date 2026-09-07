import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("GEX structures use accurate names and generic ranks become support or resistance", async () => {
  const [workspace, quantData, nativeGamma, settings] = await Promise.all([
    read("../src/components/KwantifyWorkspace.tsx"),
    read("../src/lib/quantData.server.ts"),
    read("../src/lib/databentoGamma.server.ts"),
    read("../src/lib/kwantLevels.ts"),
  ]);

  assert.match(quantData, /label: `GEX \$\{index \+ 1\}`/);
  assert.match(nativeGamma, /level\(kind, `GEX \$\{i \+ 1\}`/);
  assert.match(quantData, /label: "GEX Centre"/);
  assert.match(settings, /label = `GEX Resistance \$\{\+\+resistance\}`/);
  assert.match(settings, /label = `GEX Support \$\{\+\+support\}`/);
  assert.match(workspace, /labelGexLevels\(selectKwantLevels\(filterGexLevels/);
  assert.doesNotMatch(workspace, /label: `\$\{level\.label\}[^`]*conversion\.(?:source|target)/);
});

test("accelerators omit grease and no-fades language", async () => {
  const [gammaCage, hedgeLevels, quantData] = await Promise.all([
    read("../src/lib/gammaCage.ts"),
    read("../src/lib/hedgeLevels.ts"),
    read("../src/lib/quantData.server.ts"),
  ]);

  assert.match(gammaCage, /GAMMA_ACCELERATOR"\) return "Accelerator"/);
  assert.match(hedgeLevels, /ACCELERATOR"\) return "accelerator"/);
  assert.match(quantData, /label: "0DTE accelerator"/);
  assert.doesNotMatch(`${gammaCage}\n${hedgeLevels}\n${quantData}`, /grease|no fades/i);
});

test("GEX levels freeze at New York EOD and wake for the next session", async () => {
  const [workspace, classicProfile] = await Promise.all([
    read("../src/components/KwantifyWorkspace.tsx"),
    read("../src/lib/classicGexProfile.ts"),
  ]);

  assert.match(workspace, /stale: !payload\.marketOpen/);
  assert.match(workspace, /payload\.marketOpen \? "LIVE" : "NEW YORK EOD"/);
  assert.match(workspace, /finalEndOfDaySnapshot/);
  assert.match(workspace, /millisecondsUntilNextNewYorkOptionsOpen\(\)/);
  assert.match(classicProfile, /if \(!args\.marketOpen\) return "STALE"/);
});
