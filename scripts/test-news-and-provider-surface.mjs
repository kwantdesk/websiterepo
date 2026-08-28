import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const { themePresets } = await import("../src/lib/themePresets.ts");
const { isRed } = await import("../src/lib/outcomeColors.ts");

/**
 * What a trading surface is allowed to say, and what colour it says it in.
 *
 * Two separate faults, both about a surface deferring to something it should
 * not have: the news calendar deferred its impact colours to the theme, and the
 * market-data proxy deferred its error text to the vendor.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const news = read("../src/components/news/NewsWorkspace.tsx");
const proxy = read("../src/app/api/institutional-market-data/[...path]/route.ts");

check("high impact is red on every theme, not the theme's danger", () => {
  /*
   * `danger` is whatever the palette chose. Ten of the forty-four are not red -
   * Kwant Desk's is blue, Solar Flare's is cyan - so a high-impact release
   * rendered blue on them. Red for high is a convention every economic calendar
   * shares and a trader reads before the word beside it.
   */
  const nonRedDanger = themePresets.filter((preset) => !isRed(preset.colors.danger));
  assert.ok(nonRedDanger.length > 0, "no theme has a non-red danger, so this guards nothing");

  const high = /const IMPACT_HIGH = "(#[0-9A-Fa-f]{6})"/.exec(news);
  assert.ok(high, "high impact has no fixed colour");
  assert.ok(isRed(high[1]), `high impact is ${high[1]}, which is not red`);
});

check("medium impact is orange, not the theme's accent", () => {
  const medium = /const IMPACT_MEDIUM = "(#[0-9A-Fa-f]{6})"/.exec(news);
  assert.ok(medium, "medium impact has no fixed colour");
  // Orange sits between red and yellow; anything else is not the convention.
  const hex = medium[1];
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  assert.ok(r > 200 && g > 100 && g < 200 && b < 100, `medium impact ${hex} is not orange`);
});

check("no impact colour is taken from the theme any more", () => {
  const impactBlock = news.slice(news.indexOf("function impactClasses"), news.indexOf("function eventRelevance"));
  assert.doesNotMatch(impactBlock, /text-danger|bg-danger|border-danger/, "high impact still follows the theme");
  assert.doesNotMatch(impactBlock, /text-primary|bg-primary|border-primary/, "medium impact still follows the theme");
  // Low keeps the theme deliberately: "no strong colour" is what muted means.
  assert.match(impactBlock, /text-muted/, "low impact should stay muted");
});

check("the proxy never forwards a provider's refusal verbatim", () => {
  /*
   * Every response below the check forwards `upstream.body` untouched, which is
   * right for data and wrong for an error: the vendor's body carries its own
   * account state - usage limits, billing cases, entitlement names - and the
   * gamma page rendered it word for word.
   */
  assert.match(proxy, /if \(!upstream\.ok\)/, "error statuses are still forwarded as-is");
  assert.match(proxy, /providerErrorMessage\(new Error\(raw\), "Market data"\)/, "the refusal is not sanitised");
  assert.match(proxy, /logProviderError\(/, "the provider's real words never reach the log");

  // And it must be decided BEFORE the streaming branches, or an error status
  // gets streamed instead of answered.
  const guardAt = proxy.indexOf("if (!upstream.ok)");
  const streamAt = proxy.indexOf("return new Response(upstream.body");
  assert.ok(guardAt > 0 && streamAt > guardAt, "an error can still be streamed to the browser");
});

check("a page-level loader fills the page it stands in for", () => {
  /*
   * A loader returned in place of a workspace root that carried its own height
   * fell back to the height of its own words - a band across the top with the
   * page showing through underneath.
   */
  const loader = read("../src/components/KwantLoader.tsx");
  assert.match(loader, /page \? "h-full w-full grow self-stretch min-h-\[70vh\]"/, "there is no page variant");
  for (const path of [
    "../src/components/news/NewsWorkspace.tsx",
    "../src/components/news/MacroWorkspace.tsx",
    "../src/components/gexdesk/GexDeskWorkspace.tsx",
  ]) {
    assert.match(read(path), /<KwantLoader\s+page\b|KwantLoader page /, `${path.split("/").pop()} still sizes its loader by hand`);
  }
});

check("the vendor is not named on a gamma surface", () => {
  // The owner asked for the word gone from the page, and a vendor name is not
  // something a trader can act on.
  const gexdesk = readdirSync(new URL("../src/components/gexdesk/", import.meta.url))
    .filter((name) => name.endsWith(".tsx"));
  const offenders = [];
  for (const name of gexdesk) {
    const source = read(`../src/components/gexdesk/${name}`);
    // Comments explaining provenance are fine; rendered text is not.
    const rendered = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    if (/KwantData/.test(rendered)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], `the vendor is still named on: ${offenders.join(", ")}`);
});

console.log(`\nnews and provider surface: ${passed}/${passed} checks passed`);
