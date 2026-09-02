import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { readableTextOn, contrastRatio, parseResolvedColor, legibleOn } =
  await import("../src/lib/readableContrast.ts");

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const gexMap = readFileSync(
  new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8",
);

/**
 * The entry, stop and target chips are readable on every theme.
 *
 * They were painted with the chart's OWN background and the side colour as
 * text: on a pale theme that reads as a white box, and on any theme it puts a
 * thin coloured glyph on a surface of nearly the same brightness. The chip is
 * now the inverse of the chart - background whichever of black or white can be
 * read against the chart background, text the chart background itself.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the contrast maths has one home, not two", () => {
  /*
   * It was written inside the GEX Map component. A second copy in the chart
   * would drift, and the two would then disagree about the same colour.
   */
  assert.match(gexMap, /from "@\/lib\/readableContrast"/, "GEX Map no longer shares the helper");
  assert.ok(
    !/^function readableTextOn\(/m.test(gexMap),
    "GEX Map has its own copy of readableTextOn again",
  );
  assert.match(chart, /import \{ readableTextOn \} from "@\/lib\/readableContrast";/);
});

check("the chip is the inverse of the chart background", () => {
  assert.match(
    chart,
    /const paperLabelInk = readableTextOn\(settings\.backgroundColor\);/,
    "the chip ink is no longer derived from the chart background",
  );
  // All three chips - entry, protection and the drag preview.
  const inverted = chart.match(/backgroundColor: paperLabelInk,/g) ?? [];
  assert.equal(inverted.length, 3, `expected 3 inverted chips, found ${inverted.length}`);
  const asText = chart.match(/color: settings\.backgroundColor,\n\s+backgroundColor: paperLabelInk,/g) ?? [];
  assert.equal(asText.length, 3, "a chip does not use the chart background as its text");
});

check("the side is still legible", () => {
  /*
   * Inverting the fill removes green/red from the text, so the border and the
   * price line have to keep carrying it or a stop and a target look identical.
   */
  const borders = chart.match(/borderColor: level\.color,\n\s+color: settings\.backgroundColor,/g) ?? [];
  assert.equal(borders.length, 3, "the chips lost their up/down border colour");
  assert.match(chart, /borderTopColor: level\.color,/, "the price line lost its side colour");
});

check("a dark chart gets a light chip, a light chart a dark one", () => {
  assert.equal(readableTextOn("#000000"), "#FFFFFF");
  assert.equal(readableTextOn("#050607"), "#FFFFFF");
  assert.equal(readableTextOn("#FFFFFF"), "#000000");
  assert.equal(readableTextOn("#F5F5F5"), "#000000");
});

check("every theme background clears the WCAG body-text bar", () => {
  /*
   * The point of the change. 4.5:1 is the readable threshold; the old scheme
   * could sit near 1:1 because the text and the surface were both derived
   * from the same theme colour.
   */
  const backgrounds = [
    "#050607", "#000000", "#0B0F14", "#111827", "#1E1E1E", "#FFFFFF",
    "#F8FAFC", "#FDF6E3", "#2E3440", "#282A36", "#3B2F2F", "#0F172A",
  ];
  for (const background of backgrounds) {
    const chip = readableTextOn(background);
    const ratio = contrastRatio(parseResolvedColor(chip), parseResolvedColor(background));
    assert.ok(ratio >= 4.5, `${background} on ${chip} is only ${ratio.toFixed(2)}:1`);
  }
});

check("an unparseable colour still yields something readable", () => {
  // A theme token that has not resolved must not produce an invisible chip.
  assert.equal(readableTextOn("not-a-colour"), "#FFFFFF");
});

check("rgb() and hex forms agree", () => {
  assert.equal(readableTextOn("rgb(0, 0, 0)"), readableTextOn("#000000"));
  assert.equal(readableTextOn("rgb(255, 255, 255)"), readableTextOn("#FFFFFF"));
});

console.log(`\npaper label contrast: ${passed}/${passed} checks passed`);


/**
 * The order ticket's Buy and Sell buttons survive any theme.
 *
 * Both took their border, their fill AND their label from one chart colour, so
 * on a theme whose down colour sits close to the panel there was nothing left
 * to see at all - the control read as MISSING rather than unreadable, which is
 * exactly how it was reported: "the sell button is missing from side panel".
 */
{
  const workspace = readFileSync(
    new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
  );
  for (const side of ["downColor", "upColor"]) {
    // Border AND label: if either is left raw the button can still vanish.
    const uses = workspace.split(`legibleOn(chartSettings.${side}, orderTicketSurface)`).length - 1;
    assert.ok(
      uses >= 2,
      `the order ticket paints ${side} raw ${uses} of the times it should check it`,
    );
  }
  assert.ok(
    workspace.includes('getPropertyValue("--surface")'),
    "the ticket does not read the surface it is actually drawn on",
  );

  // The reported failure: a pale down colour on a near-white panel.
  const palePanel = "#F7F7FA";
  for (const chosen of ["#FDE7EF", "#FFFFFF", "#F7F7FA", "#FFF0F5"]) {
    const resolved = legibleOn(chosen, palePanel);
    const ratio = contrastRatio(parseResolvedColor(resolved), parseResolvedColor(palePanel));
    assert.ok(
      ratio >= 3,
      `${chosen} on ${palePanel} resolved to ${resolved} at ${ratio.toFixed(2)}:1 - still invisible`,
    );
  }
  // ...and the same on a dark theme, where it has to lighten instead.
  const darkPanel = "#0B0B0D";
  for (const chosen of ["#101014", "#000000", "#0B0B0D"]) {
    const resolved = legibleOn(chosen, darkPanel);
    const ratio = contrastRatio(parseResolvedColor(resolved), parseResolvedColor(darkPanel));
    assert.ok(ratio >= 3, `${chosen} on ${darkPanel} resolved to ${resolved} at ${ratio.toFixed(2)}:1`);
  }
  // A colour that is already legible is left exactly as the user chose it.
  assert.equal(legibleOn("#E11D48", "#FFFFFF"), "#E11D48", "a usable colour was altered");
  console.log("  ok  order ticket Buy/Sell stay visible on any theme");
}
