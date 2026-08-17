import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/WorkspaceHome.tsx", import.meta.url),
  "utf8",
);

test("home preserves the particle terrain beneath a four-column workspace launcher", () => {
  assert.match(source, /<ParticleTerrain onReady=\{revealHero\} \/>/);
  assert.match(source, /aria-label="Workspace launcher"/);
  assert.match(source, /lg:grid-cols-4/);
  assert.match(source, /backdrop-blur-\[18px\]/);
  assert.match(source, /hover:border-primary\/65/);
});

test("home launcher exposes the complete primary workspace set with visual previews", () => {
  const destinations = [
    "/",
    "/charts",
    "/gamvue",
    "/gex-cal",
    "/gex-flow",
    "/gamma",
    "/gexmap",
    "/liqmap",
    "/levelz",
    "/gameplan",
    "/zyon",
    "/news",
    "/socials",
    "/journal",
    "/backtesting",
    "/accounts",
  ];

  for (const href of destinations) {
    assert.match(source, new RegExp(`href: "${href.replaceAll("/", "\\/")}"`));
  }

  assert.match(source, /<WorkspacePreview type=\{destination\.preview\} \/>/);
  assert.match(source, /group-hover:scale-\[1\.035\]/);
});
