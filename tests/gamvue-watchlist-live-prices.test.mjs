import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceSource = fs.readFileSync(
  path.join(root, "src", "components", "KwantifyWorkspace.tsx"),
  "utf8",
);

test("GEX VUE enables active and inactive watchlist quote refreshers", () => {
  const routeGuard = 'if (section !== "charts" && section !== "gamvue") return;';
  const occurrences = workspaceSource.split(routeGuard).length - 1;

  assert.ok(
    occurrences >= 2,
    "both active-feed and inactive-feed watchlist refreshers must run in GEX VUE",
  );
  assert.match(
    workspaceSource,
    /activeChartBrokerLabel === "Market Index"[\s\S]*?\/api\/market-indices\?snapshot=1/,
    "the active watchlist refresher must retain the options-underlying snapshot route",
  );
  assert.match(
    workspaceSource,
    /brokers\.map\(async \(broker\)[\s\S]*?broker === "Market Index"[\s\S]*?\/api\/market-indices\?snapshot=1/,
    "the inactive watchlist refresher must retain Market Index quotes alongside futures",
  );
});
