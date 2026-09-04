import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INDICATOR_LIBRARY_FAVORITES_CATEGORY,
  indicatorMatchesLibraryCategory,
  sortIndicatorLibraryAlphabetically,
} from "../src/lib/indicatorLibrary.ts";

const entries = [
  { id: "z", name: "Zulu", category: "Trend" },
  { id: "a", name: "alpha", category: "Order Flow" },
  { id: "b", name: "Bravo", category: "Trend" },
];
const favorites = new Set(["z", "a"]);

assert.deepEqual(
  sortIndicatorLibraryAlphabetically(entries).map((entry) => entry.id),
  ["a", "b", "z"],
  "All browse results must be alphabetical rather than favorite-first",
);
assert.deepEqual(
  sortIndicatorLibraryAlphabetically(
    entries.filter((entry) => indicatorMatchesLibraryCategory(
      entry,
      INDICATOR_LIBRARY_FAVORITES_CATEGORY,
      favorites,
    )),
  ).map((entry) => entry.id),
  ["a", "z"],
  "Favorites must contain only starred indicators and remain alphabetical",
);
assert.deepEqual(
  entries.filter((entry) => indicatorMatchesLibraryCategory(entry, "Trend", favorites)).map((entry) => entry.id),
  ["z", "b"],
  "Existing indicator categories must keep their filtering contract",
);

const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
assert.match(
  control,
  /\["All", INDICATOR_LIBRARY_FAVORITES_CATEGORY, \.\.\.CHART_INDICATOR_CATEGORIES\]/,
  "Favorites must appear directly below All",
);
assert.match(
  control,
  /category === INDICATOR_LIBRARY_FAVORITES_CATEGORY\s*\? indicatorMatchesLibraryCategory/,
  "Searching inside Favorites must remain limited to starred indicators",
);
assert.doesNotMatch(
  control,
  /Number\(favourites\.includes\(right\.id\)\)\s*-\s*Number\(favourites\.includes\(left\.id\)\)/,
  "All must not promote favorites ahead of alphabetical order",
);
assert.match(control, /No favorite indicators yet\./, "Favorites needs a clear empty state");

console.log("indicator library favorites tests passed");
