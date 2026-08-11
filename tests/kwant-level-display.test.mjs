import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("ranked proprietary levels use KWANT names without conversion suffixes", async () => {
  const [workspace, quantData, nativeGamma] = await Promise.all([
    read("../src/components/KwantifyWorkspace.tsx"),
    read("../src/lib/quantData.server.ts"),
    read("../src/lib/databentoGamma.server.ts"),
  ]);

  assert.match(quantData, /label: `KWANT \$\{index \+ 1\}`/);
  assert.match(nativeGamma, /level\(kind, `KWANT \$\{i \+ 1\}`/);
  assert.match(quantData, /label: "KWANT center"/);
  assert.match(workspace, /label: level\.label,/);
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

test("Kwant levels stay stale outside the New York options session", async () => {
  const [workspace, classicProfile] = await Promise.all([
    read("../src/components/KwantifyWorkspace.tsx"),
    read("../src/lib/classicGexProfile.ts"),
  ]);

  assert.match(workspace, /stale: !payload\.marketOpen/);
  assert.match(workspace, /payload\.marketOpen \? "LIVE NY OPTIONS" : "STALE"/);
  assert.match(classicProfile, /if \(!args\.marketOpen\) return "STALE"/);
});
