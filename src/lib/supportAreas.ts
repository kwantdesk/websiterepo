import areas from "../../services/support-desk/areas.json";

/** Shared with the report service so every selectable area is accepted there. */
export const SUPPORT_AREAS = areas;
export const supportAreaLabel = (id: string) => areas.find(area => area.id === id)?.label ?? id;

export function supportAreaForLocation(path: string, search = ""): string {
  const parameters = new URLSearchParams(search);
  const matches = areas.filter(area => area.path &&
    (path === area.path || (area.path !== "/" && path.startsWith(area.path + "/"))) &&
    [...new URLSearchParams(area.query)].every(([key, value]) => parameters.get(key) === value));
  return matches.sort((a, b) => b.path.length - a.path.length || b.query.length - a.query.length)[0]?.id ?? "other";
}
