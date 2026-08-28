import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The header wordmark must read as the same logo as the mark on the charts.
 *
 * It was set with `letter-spacing: -.055em`, which squeezes "kwant desk" about
 * 10% narrower than the letters are drawn - enough that the header looked like
 * a different logo from the wordmark the charts and the liquidity map carry.
 *
 * Measured in the browser with Inter actually loaded, nothing needed that
 * space. Natural width is 97px against a 110px brand box on desktop, 86
 * against 110 on tablet, and 76 against 84 on mobile. The tracking was buying
 * room that already existed.
 */

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

/** The declarations inside one rule, by selector. */
function rule(selector) {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at > 0, `${selector} is missing`);
  return css.slice(at, css.indexOf("}", at));
}

check("the wordmark is not condensed", () => {
  const wordmark = rule(".kwant-primary-brand-wordmark");
  assert.match(wordmark, /letter-spacing:\s*normal/, "the wordmark is tracked away from its natural width");
  assert.doesNotMatch(wordmark, /letter-spacing:\s*-/, "negative tracking came back");
});

check("it is not condensed at the smaller breakpoints either", () => {
  /*
   * The responsive rules only change font-size. If one of them ever set its own
   * tracking the header would be squished on a laptop and correct on a desktop,
   * which is harder to notice than being wrong everywhere.
   */
  let from = 0;
  let seen = 0;
  for (;;) {
    const at = css.indexOf(".kwant-primary-brand-wordmark {", from);
    if (at < 0) break;
    seen += 1;
    const body = css.slice(at, css.indexOf("}", at));
    assert.doesNotMatch(body, /letter-spacing:\s*-/, `a breakpoint re-condenses the wordmark: ${body.trim().slice(0, 80)}`);
    from = at + 1;
  }
  assert.ok(seen >= 2, `expected responsive overrides, found ${seen}`);
});

check("the brand box still has room for the natural width", () => {
  /*
   * Removing the tracking is only safe while the box is wider than the letters.
   * The container is fixed and clips, so a future narrowing would silently cut
   * the wordmark rather than wrap it.
   */
  const brand = rule(".kwant-primary-brand");
  const width = Number(/width:\s*(\d+)px/.exec(brand)?.[1]);
  assert.ok(Number.isFinite(width), "the brand box has no fixed width to check");
  // 97px measured at the 18px desktop size, with Inter loaded.
  assert.ok(width >= 100, `brand box is ${width}px, too narrow for a 97px wordmark`);
});

check("the mark on the charts is unchanged", () => {
  // The owner said the chart logo is already right; this is only the header.
  const shared = readFileSync(new URL("../src/lib/chartWatermark.ts", import.meta.url), "utf8");
  assert.match(shared, /CHART_WATERMARK_ASPECT = 1911 \/ 305/, "the chart mark's aspect moved");
});

console.log(`\nbrand wordmark: ${passed}/${passed} checks passed`);
