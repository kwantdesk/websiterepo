export type UnderlyingHistoryCoverage = {
  partial: boolean;
  unverifiedBars?: number;
  requestedFrom: number;
  requestedTo: number;
  availableFrom: number | null;
  availableTo: number | null;
};
