import assert from "node:assert/strict";
import test from "node:test";
import { normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { resolveMarketSessions } from "../src/lib/marketSessions.ts";

test("Sessions overlay uses the same exchange-time hand-off contract", () => {
  const restored = normalizePaneIndicatorState({ pane: [{
    instanceId: "legacy-sessions",
    indicatorId: "sessions",
    enabled: true,
    settings: { tokyoStart: "09:00", londonEnd: "17:00", sessionsSettingsVersion: 1 },
  }] }).pane[0];
  const sessions = resolveMarketSessions(restored.settings).filter((session) => session.key !== "sydney");
  assert.deepEqual(sessions.map(({ label, timezone, start, end }) => ({ label, timezone, start, end })), [
    { label: "Asia", timezone: "America/New_York", start: "16:00", end: "03:00" },
    { label: "London", timezone: "America/New_York", start: "03:00", end: "09:30" },
    { label: "New York", timezone: "America/New_York", start: "09:30", end: "16:00" },
  ]);
  assert.equal(restored.settings.allowSessionOverlap, false);
});
