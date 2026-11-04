// Negative control: no live-pane seed or completed history reuse.
export const createChartWarmHistory = () => ({ get: () => undefined, put: () => {} });
export const createChartDuplicateSeeds = () => ({ register: () => () => {}, copy: () => false, peek: () => null, discard: () => {} });
