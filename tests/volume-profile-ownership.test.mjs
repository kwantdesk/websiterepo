import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveVolumeProfileOwner, volumeProfileOwnerKey } from "../src/lib/volumeProfileOwnership.ts";
const indicators = [
  { instanceId: "d", indicatorId: "kwant-profile", enabled: true, settings: { profileWidth: 9 } },
  { instanceId: "w", indicatorId: "weekly-volume-profile", enabled: true, settings: { profileWidth: 18 } },
  { instanceId: "c", indicatorId: "composite-volume-profile", enabled: true, settings: { profileWidth: 20 } },
  { instanceId: "m", indicatorId: "monthly-volume-profile", enabled: true, settings: { profileWidth: 4 } },
];
test("existing daily weekly and composite profiles keep exact settings owners", () => {
  for (const [period, index] of [["daily", 0], ["weekly", 1], ["custom", 2]]) {
    assert.equal(resolveVolumeProfileOwner({ period }, indicators), indicators[index]);
  }
});
test("custom-period variants cannot inherit Composite settings or newest-level identity", () => {
  const profile = { root: "NQ", period: "custom", ownerInstanceId: "m" };
  assert.equal(resolveVolumeProfileOwner(profile, indicators), indicators[3]);
  assert.notEqual(volumeProfileOwnerKey(profile), volumeProfileOwnerKey({ ...profile, ownerInstanceId: "c" }));
  assert.notEqual(volumeProfileOwnerKey(profile), volumeProfileOwnerKey({ ...profile, ownerInstanceId: undefined }));
});
test("disabled removed or unknown owners are never reassigned to another profile", () => {
  assert.equal(resolveVolumeProfileOwner({ period: "custom", ownerInstanceId: "removed" }, indicators), undefined);
  assert.equal(resolveVolumeProfileOwner({ period: "custom", ownerInstanceId: "m" }, indicators.map(i => ({ ...i, enabled: i.instanceId !== "m" }))), undefined);
});

test("the right-docked Composite body renders outside the plot", async () => {
  const { renderProfile } = await import("./helpers/volume-profile-render-harness.mjs");
  const composite = renderProfile({ period: "custom", snapMode: "right", outerRightDock: true, mode: "volume", visualStyle: "solid" });
  assert.equal(composite.paths.length, 0);
  assert.ok(composite.drawDock().some(path => path.commands.some(([op, x]) => op === "rect" && x >= 0 && x < 140)));
  for (const period of ["daily", "weekly"]) {
    const profile = renderProfile({ period, snapMode: "right", mode: "volume", visualStyle: "solid" });
    assert.ok(profile.paths.length > 0);
    assert.equal(profile.drawDock().length, 0);
  }
});
