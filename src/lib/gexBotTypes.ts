export type GexBotStrike = [
  strike: number,
  volumeExposure: number,
  openInterestExposure: number,
  priors: number[],
];

export type GexBotProfileFrame = {
  timestamp: number;
  ticker: string;
  min_dte?: string | number | null;
  sec_min_dte?: string | number | null;
  spot: number;
  zero_gamma: number | null;
  major_pos_vol: number | null;
  major_pos_oi: number | null;
  major_neg_vol: number | null;
  major_neg_oi: number | null;
  strikes: GexBotStrike[];
  sum_gex_vol: number | null;
  sum_gex_oi: number | null;
  delta_risk_reversal?: number | null;
  max_priors?: Array<[number, number]>;
};

export type GexBotMajorsFrame = {
  timestamp?: number;
  ticker?: string;
  spot?: number;
  zero_gamma?: number | null;
  mpos_vol?: number | null;
  mpos_oi?: number | null;
  mneg_vol?: number | null;
  mneg_oi?: number | null;
  net_gex_vol?: number | null;
  net_gex_oi?: number | null;
};

export type GexBotMaxChangeFrame = {
  timestamp?: number;
  ticker?: string;
  current?: [number, number] | null;
  one?: [number, number] | null;
  five?: [number, number] | null;
  ten?: [number, number] | null;
  fifteen?: [number, number] | null;
  thirty?: [number, number] | null;
};

export type GexBotOrderflowFrame = GexBotProfileFrame & {
  z_mlgamma?: number | null;
  z_msgamma?: number | null;
  o_mlgamma?: number | null;
  o_msgamma?: number | null;
  zero_mcall?: number | null;
  zero_mput?: number | null;
  one_mcall?: number | null;
  one_mput?: number | null;
  zcvr?: number | null;
  ocvr?: number | null;
  zgr?: number | null;
  ogr?: number | null;
  zvanna?: number | null;
  ovanna?: number | null;
  zcharm?: number | null;
  ocharm?: number | null;
  agg_dex?: number | null;
  one_agg_dex?: number | null;
  agg_call_dex?: number | null;
  one_agg_call_dex?: number | null;
  agg_put_dex?: number | null;
  one_agg_put_dex?: number | null;
  net_dex?: number | null;
  one_net_dex?: number | null;
  net_call_dex?: number | null;
  one_net_call_dex?: number | null;
  net_put_dex?: number | null;
  one_net_put_dex?: number | null;
  dexoflow?: number | null;
  gexoflow?: number | null;
  cvroflow?: number | null;
  one_dexoflow?: number | null;
  one_gexoflow?: number | null;
  one_cvroflow?: number | null;
};

export type GexBotTerminalEnvelope<TFrame> = {
  ok: boolean;
  view: "classic" | "state" | "orderflow";
  ticker: string;
  category: string;
  session: "LIVE_RTH" | "FROZEN_NEW_YORK_CLOSE" | "DELAYED";
  marketOpen: boolean;
  checkedAt: number;
  frame: TFrame | null;
  history?: TFrame[] | null;
  historyDate?: string | null;
  historyStatus?: "LOADED" | "UNAVAILABLE" | "NOT_REQUESTED";
  historyError?: string;
  majors: GexBotMajorsFrame | null;
  maxChange: GexBotMaxChangeFrame | null;
  error?: string;
  entitlementRequired?: boolean;
};
