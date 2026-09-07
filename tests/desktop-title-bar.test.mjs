import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const desktopMain = fs.readFileSync(new URL("../desktop/main.cjs", import.meta.url), "utf8");
const manifest = fs.readFileSync(new URL("../src/app/manifest.ts", import.meta.url), "utf8");
const rootLayout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const loginPage = fs.readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");

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

test("browser and login copy describe the customer trading platform", () => {
  const description = "Professional trading platform for charts, order flow, options analytics, market intelligence and execution.";
  assert.ok(rootLayout.includes(description));
  assert.ok(manifest.includes(description));
  assert.ok(loginPage.includes("Access your Kwant Desk trading platform."));
  for (const source of [rootLayout, manifest, loginPage]) {
    assert.doesNotMatch(source, /private quantitative research workspace/i);
  }
});
