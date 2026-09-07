import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogPath = new URL("../src/lib/chartIndicatorCatalog.ts", import.meta.url);
const workspacePath = new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url);

test("indicator level names distinguish Kwant levels from Kwant zones", async () => {
  const [catalog, workspace] = await Promise.all([
    readFile(catalogPath, "utf8"),
    readFile(workspacePath, "utf8"),
  ]);

  assert.match(
    catalog,
    /indicator\("Kwant Levels",[\s\S]*?"Kwantify", "Gamma Levels"\)/,
    "the renamed gamma indicator must preserve its gamma-levels storage id",
  );
  assert.match(workspace, /id: "gamma",\s*label: "Kwant levels"/);
  assert.match(workspace, /id: "kwant",\s*label: "Kwant zones"/);
});
