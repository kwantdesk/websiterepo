export type InstitutionalTrade = {
  eventId?: string;
  recordIndex: number;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  trades: number;
  volume: number;
  bidVolume: number;
  askVolume: number;
  delta: number;
  aggressor: "BUY" | "SELL" | "UNKNOWN";
  sideSemanticsVersion?: number;
};
