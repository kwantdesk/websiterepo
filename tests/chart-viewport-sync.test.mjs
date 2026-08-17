import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();

async function loadViewportSync() {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "kwantdesk-viewport-"));
  const sourcePath = "src/lib/chartViewportSync.ts";
  const source = await readFile(path.join(root, sourcePath), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: sourcePath,
  });
  const outputPath = path.join(outputDirectory, "chartViewportSync.mjs");
  await writeFile(outputPath, result.outputText, "utf8");
  return import(`${new URL(`file:///${outputPath.replaceAll("\\", "/")}`).href}?v=${Date.now()}`);
}

const viewport = await loadViewportSync();

function snapshot(overrides = {}) {
  return {
    groupId: "gex-vue",
    sourceChartId: "spx",
    instrument: "SPX",
    timeframe: "5m",
    visibleTimeRange: { from: 1, to: 2 },
    priceRange: { from: 5_250, to: 5_350 },
    anchorPrice: 5_300,
    updatedAt: 1,
    ...overrides,
  };
}

test("linked price height preserves both percentage offsets across differently priced instruments", () => {
  const range = viewport.resolveLinkedPriceRange(snapshot(), "SPY", 530);
  assert.ok(Math.abs(range.from - 525) < 1e-9);
  assert.ok(Math.abs(range.to - 535) < 1e-9);
});

test("the same instrument keeps its exact manually selected vertical range", () => {
  const range = viewport.resolveLinkedPriceRange(snapshot(), "SPX", 5_310);
  assert.deepEqual(range, { from: 5_250, to: 5_350 });
});
