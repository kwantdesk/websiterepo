export const INDICATOR_LIBRARY_FAVORITES_CATEGORY = "Favorites" as const;

type IndicatorLibraryEntry = {
  id: string;
  name: string;
  category: string;
};

export function indicatorMatchesLibraryCategory(
  definition: IndicatorLibraryEntry,
  category: string,
  favoriteIds: ReadonlySet<string>,
) {
  if (category === "All") return true;
  if (category === INDICATOR_LIBRARY_FAVORITES_CATEGORY) {
    return favoriteIds.has(definition.id);
  }
  return definition.category === category;
}

export function sortIndicatorLibraryAlphabetically<T extends Pick<IndicatorLibraryEntry, "name">>(
  definitions: readonly T[],
) {
  return [...definitions].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
}
