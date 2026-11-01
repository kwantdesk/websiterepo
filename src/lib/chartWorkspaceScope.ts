export type ChartWorkspaceScope = "charts" | "gamma" | "algo";

export const workspaceStoragePrefix = (scope: ChartWorkspaceScope) =>
  scope === "algo" ? "kwantdesk:algo-charting:" : scope === "gamma" ? "kwantdesk:gamma-charting:" : "";

export const workspaceScopeStorageKey = (scope: ChartWorkspaceScope, key: string) =>
  workspaceStoragePrefix(scope) + key;

export const viewportSyncGroupForScope = (scope: ChartWorkspaceScope) =>
  scope === "algo" ? "algo-linked-viewport" : scope === "gamma" ? "gex-vue-linked-viewport" : "charts-linked-viewport";

// Charts and GEX Vue retain their existing shared template library.
export const workspaceTemplateStorageKey = (scope: ChartWorkspaceScope, key: string) =>
  workspaceScopeStorageKey(scope === "algo" ? "algo" : "charts", key);

export const workspaceChartInstanceId = (scope: ChartWorkspaceScope, paneId: string) =>
  scope === "algo" ? `algo:${paneId}` : paneId;

export const chartDrawingPersistenceInstrument = (instrument: string, chartInstanceId: string) =>
  `${instrument}::${chartInstanceId.startsWith("algo:") ? "algo:" : ""}${chartInstanceId.slice(-16)}`;
