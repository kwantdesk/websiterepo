// Reversible product archive. Keep implementations, routes and saved data;
// remove launch surfaces and prevent restored panels from starting archived UI.
// To restore a feature, remove its ID here and rerun the archive tests.
export const ARCHIVED_WORKSPACE_FEATURES: ReadonlySet<string> = new Set([
  "gameplan", "zyon", "optionstape",
]);

export function isWorkspaceFeatureArchived(id: unknown): boolean {
  return typeof id === "string" && ARCHIVED_WORKSPACE_FEATURES.has(id);
}

export function activeWorkspaceSection<T extends string>(section: T): T | "charts" {
  return isWorkspaceFeatureArchived(section) ? "charts" : section;
}
