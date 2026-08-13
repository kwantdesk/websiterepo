import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspaceSource = fs.readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);

test("detached workspace windows expose every edge and corner as resize handles", () => {
  for (const direction of ["n", "ne", "e", "se", "s", "sw", "w", "nw"]) {
    assert.match(
      workspaceSource,
      new RegExp(`startFloatingWorkspaceResize\\(floating\\.paneId, "${direction}", event\\)`),
    );
  }
});

test("left and top resizing update the floating window origin as well as its size", () => {
  assert.match(workspaceSource, /x: left, y: top, width: right - left, height: bottom - top/);
  assert.match(workspaceSource, /startingRight - minimumWidth/);
  assert.match(workspaceSource, /startingBottom - minimumHeight/);
});

test("panel header locks are pane-scoped instead of toggling the global workspace lock", () => {
  assert.match(workspaceSource, /onClick=\{\(\) => toggleWorkspacePaneLock\(pane\.id\)\}/);
  assert.match(workspaceSource, /paneMoveLocked = workspaceLocked \|\| pane\.locked/);
  assert.match(workspaceSource, /pane\.id === paneId \? \{ \.\.\.pane, locked: !pane\.locked \} : pane/);
});

test("a floating lock blocks movement but keeps manual edge resizing available", () => {
  const moveStart = workspaceSource.indexOf("const startFloatingWorkspaceMove");
  const resizeStart = workspaceSource.indexOf("const startFloatingWorkspaceResize");
  const closeStart = workspaceSource.indexOf("const closeWorkspacePane");
  assert.ok(moveStart >= 0 && resizeStart > moveStart && closeStart > resizeStart);
  assert.match(workspaceSource.slice(moveStart, resizeStart), /floating\.locked/);
  assert.doesNotMatch(workspaceSource.slice(resizeStart, closeStart), /floating\.locked/);
});
