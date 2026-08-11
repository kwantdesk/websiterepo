import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutPath = new URL("../src/app/(workspace)/layout.tsx", import.meta.url);

test("the account-backed terminal does not hydrate server defaults over saved browser state", async () => {
  const layout = await readFile(layoutPath, "utf8");

  assert.match(layout, /dynamic\(\(\) => import\("@\/components\/KwantifyWorkspace"\), \{[\s\S]*?ssr: false/);
  assert.doesNotMatch(layout, /import KwantifyWorkspace,/);
});
