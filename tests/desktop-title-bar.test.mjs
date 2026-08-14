import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const desktopMain = fs.readFileSync(new URL("../desktop/main.cjs", import.meta.url), "utf8");
const manifest = fs.readFileSync(new URL("../src/app/manifest.ts", import.meta.url), "utf8");
const rootLayout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

test("desktop title bar remains neutral grey in every focus state", () => {
  assert.match(desktopMain, /const TITLE_BAR_COLOR = "#303238"/);
  assert.match(desktopMain, /titleBarStyle: "hidden"/);
  assert.match(desktopMain, /titleBarOverlay:\s*\{[\s\S]*color: TITLE_BAR_COLOR/);
  assert.match(desktopMain, /overrideBrowserWindowOptions:\s*\{[\s\S]*\.\.\.desktopWindowChrome/);
});

test("installed web app metadata uses the same neutral grey", () => {
  assert.match(manifest, /theme_color: "#303238"/);
  assert.match(rootLayout, /name="theme-color" content="#303238"/);
});
