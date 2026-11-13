import assert from "node:assert/strict";
import test from "node:test";
import { CHART_INDICATOR_BY_ID } from "../src/lib/chartIndicatorCatalog.ts";
import { normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";

test("Important Levels is retired from the catalogue and saved charts", () => {
  assert.equal(CHART_INDICATOR_BY_ID.has("important-levels"), false);

  const restored = normalizePaneIndicatorState({
    pane: [
      { instanceId: "retired", indicatorId: "important-levels", enabled: true, settings: { days: 3 } },
      { instanceId: "retained", indicatorId: "big-trades", enabled: true },
    ],
  });

  assert.deepEqual(restored.pane.map(({ instanceId }) => instanceId), ["retained"]);
});
