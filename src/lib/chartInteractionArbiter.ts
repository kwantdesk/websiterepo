"use client";

export type ChartInteractionOwner = "chart" | "legacy-tools" | "precision-tools";

type OwnerListener = (owner: ChartInteractionOwner) => void;

let currentOwner: ChartInteractionOwner = "chart";
const listeners = new Set<OwnerListener>();

export function getChartInteractionOwner(): ChartInteractionOwner {
  return currentOwner;
}

export function claimChartInteraction(owner: ChartInteractionOwner): void {
  if (owner === currentOwner) return;
  currentOwner = owner;
  listeners.forEach((listener) => listener(owner));
}

export function releaseChartInteraction(owner: ChartInteractionOwner): void {
  if (currentOwner !== owner) return;
  claimChartInteraction("chart");
}

export function subscribeChartInteractionOwner(listener: OwnerListener): () => void {
  listeners.add(listener);
  listener(currentOwner);
  return () => listeners.delete(listener);
}
