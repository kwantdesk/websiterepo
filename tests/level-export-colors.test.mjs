import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeLevelExportColor } from "../src/lib/levelExportColors.ts";

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const platformSerializer = readFileSync(new URL("../src/lib/platformLevelExport.ts", import.meta.url), "utf8");
const deepChartsSerializer = readFileSync(new URL("../src/lib/deepChartsExport.ts", import.meta.url), "utf8");

test("level export colours normalize every colour syntax used by KwantDesk", () => {
  assert.equal(normalizeLevelExportColor("#0fc"), "#00FFCC");
  assert.equal(normalizeLevelExportColor("rgb(22, 199, 206)"), "#16C7CE");
  assert.equal(normalizeLevelExportColor("rgb(255 31 120 / 50%)", "#020304"), "#81113E");
  assert.equal(normalizeLevelExportColor("#11223380", "#000000"), "#09111A");
  assert.equal(normalizeLevelExportColor("color(srgb 1 0.5 0)"), "#FF8000");
});

test("all level export formats receive the resolved visible chart colour", () => {
  assert.match(workspace, /const exportRows = rows\.map\(\(row\) => \(\{[\s\S]*?resolveLevelExportColor\(row\.color, chartSettings\.backgroundColor\)/);
  assert.match(workspace, /levels: exportRows/);
  assert.match(workspace, /serializeDeepChartsXml\(exportRows/);
  assert.match(workspace, /serializePlatformLevels\(levelExportFormat, exportRows\)/);
  assert.match(platformSerializer, /normalizeLevelExportColor\(value\)/);
  assert.match(deepChartsSerializer, /normalizeLevelExportColor\(value\)/);
});
