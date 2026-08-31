import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A loader that stands in for a whole page fills the page.
 *
 * `KwantLoader` is used two ways. Inside a panel that already has a size it
 * inherits one. Returned INSTEAD of a workspace root, it has nothing to
 * inherit from, so `h-full` collapses to the height of the words inside it and
 * `flex-1` inside a `min-h-[520px]` wrapper gives exactly 520px - a band
 * across the top with black underneath, on a viewport of any height. That is
 * what "the loading screen is cut off halfway down" was, reported on Gamma and
 * reachable by loading any index.
 *
 * The `page` prop exists for this and claims the height itself, covering a
 * sized parent, a flex parent and a parent that offers neither.
 *
 * This list is the route-level workspaces - the components a page renders
 * directly, whose loader IS the page. A new workspace belongs here. It is
 * written out rather than detected because "returns a KwantLoader" also
 * matches panels that legitimately size themselves, and a check that cries
 * wolf gets deleted.
 */

const PAGE_WORKSPACES = [
  "src/components/options-flow/GammaWorkspace.tsx",
  "src/components/gamma-bot/GammaBotWorkspace.tsx",
  "src/components/heatmap/OptionsHeatmapWorkspace.tsx",
  "src/components/journal/JournalWorkspace.tsx",
  "src/components/gameplan/GameplanWorkspace.tsx",
  "src/components/gexdesk/GexDeskWorkspace.tsx",
  "src/components/news/MacroWorkspace.tsx",
  "src/components/news/NewsWorkspace.tsx",
];

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

check("every route-level workspace has a page loader", () => {
  const missing = PAGE_WORKSPACES.filter((path) => {
    const source = read(path);
    // The loader that replaces the page must carry `page` among its props.
    return !/<KwantLoader\s+[\s\S]{0,40}?\bpage\b/.test(source);
  });
  assert.deepEqual(missing, [], `these show a loader in place of a page without filling it:\n  ${missing.join("\n  ")}`);
});

check("no page workspace pins its loader to a fixed pixel band", () => {
  /*
   * The specific shape of the bug: a wrapper with a fixed minimum and nothing
   * telling it to grow. It looks sized, so it survives review, and it is the
   * same height whatever the viewport is.
   */
  const banded = [];
  for (const path of PAGE_WORKSPACES) {
    const source = read(path);
    const pattern = /<div className="([^"]*min-h-\[\d+px\][^"]*)"><Loading/g;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      if (!/flex-1|grow|h-full/.test(match[1])) banded.push(`${path}: ${match[1]}`);
    }
  }
  assert.deepEqual(banded, [], `these wrap a page loader in a fixed band:\n  ${banded.join("\n  ")}`);
});

check("the page prop fills and has a floor", () => {
  /*
   * `h-full` needs a sized parent, `grow`/`self-stretch` need a flex one, and
   * the minimum covers a parent that offers neither - which is the case that
   * produced the band.
   */
  const loader = read("src/components/KwantLoader.tsx");
  assert.match(
    loader,
    /page \? "h-full w-full grow self-stretch min-h-\[\d+vh\]" : ""/,
    "the page variant no longer fills or no longer has a floor",
  );
});

check("Gamma specifically, which is the one that was reported", () => {
  const gamma = read("src/components/options-flow/GammaWorkspace.tsx");
  const start = gamma.indexOf("function LoadingScreen()");
  assert.ok(start > 0, "the Gamma loading screen is gone");
  assert.match(
    gamma.slice(start, start + 260),
    /<KwantLoader\s*\n\s*page\b/,
    "Gamma's loader is not a page loader",
  );
});

check("panel loaders are left alone", () => {
  /*
   * The opposite failure: `page` carries a 70vh floor, so putting it on a
   * loader that lives inside a small panel would blow that panel open. These
   * three are panels and must NOT have it.
   */
  for (const path of [
    "src/components/friends/FriendsPanel.tsx",
    "src/components/gexdesk/GexDeskDepthPanels.tsx",
    "src/components/gex-map/GexMapWorkspace.tsx",
  ]) {
    const source = read(path);
    assert.ok(
      !/<KwantLoader\s+page\b/.test(source) && !/<KwantLoader\s*\n\s*page\b/.test(source),
      `${path} made a panel loader fill the viewport`,
    );
  }
});

console.log(`\npage loaders: ${passed}/${passed} checks passed`);
