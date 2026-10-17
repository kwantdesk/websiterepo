export type UnderlyingHistoryCoverage = {
  partial: boolean;
  requestedFrom: number;
  requestedTo: number;
  availableFrom: number | null;
  availableTo: number | null;
};
