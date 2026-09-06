import type { CalculatedIndicatorSeries } from "@/lib/chartIndicatorEngine";

export type PublishedChartAnnotation = {
  indicatorId: string;
  instanceId: string;
  series: CalculatedIndicatorSeries[];
};

const registry = new Map<string, PublishedChartAnnotation[]>();
const listeners = new Set<() => void>();

const announce = () => listeners.forEach((listener) => listener());

export function publishChartAnnotations(chartId: string, entries: PublishedChartAnnotation[]) {
  if (!chartId) return;
  registry.set(chartId, entries);
  announce();
}

export function removeChartAnnotations(chartId: string) {
  if (!registry.delete(chartId)) return;
  announce();
}

export function readChartAnnotations(chartId: string, indicatorReference: string) {
  const entries = registry.get(chartId) ?? [];
  const reference = indicatorReference.trim().toLowerCase();
  if (!reference) return [];
  const entry = entries.find((candidate) => candidate.instanceId.toLowerCase() === reference)
    ?? entries.find((candidate) => candidate.indicatorId.toLowerCase() === reference);
  return entry?.series ?? [];
}

export function subscribeChartAnnotations(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function listChartAnnotationSources() {
  return [...registry.entries()].map(([chartId, entries]) => ({ chartId, entries }));
}
