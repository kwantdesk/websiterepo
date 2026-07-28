export type TradeSyncerExecutionMode = {
  id: string;
  title: string;
  summary: string;
  bestFor: string;
  tradeoff: string;
};

export type TradeSyncerConnectionLane = {
  venue: string;
  type: string;
  status: "ready" | "planned" | "research";
  summary: string;
  whyItMatters: string;
};

export type TradeSyncerPolicyOption = {
  category: string;
  title: string;
  detail: string;
};

export type TradeSyncerSurfaceBlock = {
  title: string;
  detail: string;
  includes: string[];
};

export type TradeSyncerObservedRoute = {
  section: string;
  label: string;
  route: string;
  purpose: string;
};

export type TradeSyncerSetupStep = {
  step: string;
  title: string;
  detail: string;
};

export type TradeSyncerControlGroup = {
  title: string;
  detail: string;
  controls: string[];
};

export type TradeSyncerRiskType = {
  title: string;
  useCase: string;
  detail: string;
};

export type TradeSyncerCopierStatus = {
  title: string;
  detail: string;
  operatorMeaning: string;
};

export type TradeSyncerAccountTab = {
  title: string;
  detail: string;
};

export type TradeSyncerPremiumFeature = {
  title: string;
  summary: string;
  price: string;
  whyItMatters: string;
};

export type TradeSyncerFailureMode = {
  title: string;
  cause: string;
  fix: string;
};

export const tradeSyncerExecutionModes: TradeSyncerExecutionMode[] = [
  {
    id: "exact-order",
    title: "Exact Order Copy",
    summary: "Mirror the leader's order lifecycle as faithfully as possible, including pending and protective order intent.",
    bestFor: "Smaller account groups, clean broker support, and traders who need order-shape parity.",
    tradeoff: "More fragile under rate limits, modify storms, and broker mismatch.",
  },
  {
    id: "fill-based",
    title: "Fill-Based Copy",
    summary: "Copy the leader's executed fills to followers and let followers enter with simpler market-driven logic.",
    bestFor: "Larger prop-account fanout and safer scale on venues like Tradovate.",
    tradeoff: "Followers may not preserve the exact pending-order graph used by the leader.",
  },
  {
    id: "protection-only",
    title: "Follower Protection Mode",
    summary: "Watch for drift and flatten or repair follower accounts whenever leader state and follower state diverge.",
    bestFor: "Prop-style risk containment and operational safety.",
    tradeoff: "Can override user expectations if they want looser copier behavior.",
  },
];

export const tradeSyncerConnectionLanes: TradeSyncerConnectionLane[] = [
  {
    venue: "Tradovate",
    type: "Direct futures API",
    status: "ready",
    summary: "Retail futures lane with partner/public-app ambition, account discovery, routing, and copier fanout.",
    whyItMatters: "This is the most obvious first path for prop-firm-heavy users and mirrors what many copy-trading products target.",
  },
  {
    venue: "Rithmic",
    type: "Direct futures execution backbone",
    status: "ready",
    summary: "Higher-seriousness backbone for prop-style execution and lifecycle precision.",
    whyItMatters: "Better fit for more advanced order management and a strong second pillar for Trade Syncer credibility.",
  },
  {
    venue: "MT5 / CFD bridge",
    type: "Terminal bridge",
    status: "planned",
    summary: "Potential later lane for CFD or terminal-bound users through the kwantify MT5 bridge.",
    whyItMatters: "Useful expansion path, but not the first master/follower futures spine.",
  },
  {
    venue: "Every other broker/platform",
    type: "Expansion matrix",
    status: "research",
    summary: "Possible later through curated adapters, not via a fake universal connector promise.",
    whyItMatters: "The honest product path is a curated integration matrix, not 'works with everything'.",
  },
];

export const tradeSyncerPolicyOptions: TradeSyncerPolicyOption[] = [
  {
    category: "Risk",
    title: "Leader to follower sizing",
    detail: "Support fixed quantity, ratio scaling, balance/risk multipliers, contract alignment, lot refinement, min/max force, and per-follower max caps.",
  },
  {
    category: "Orders",
    title: "Protection and pending behavior",
    detail: "Control whether stop loss, take profit, pending orders, expiry times, and refined protective distances are copied or downgraded.",
  },
  {
    category: "Behavior",
    title: "Reverse, delay, strict close",
    detail: "Support reverse copy, fixed/random delay, copy existing open trades on attach, strict-close logic, and custom trade comments.",
  },
  {
    category: "Filters",
    title: "Signal filters",
    detail: "Filter by symbol, strategy, comment, side, master lot size, and other lead-account metadata before a follower is allowed to trade.",
  },
  {
    category: "Safety",
    title: "Follower protection and drift repair",
    detail: "When the leader is flat, followers must be checked, repaired, or flattened if they remain exposed or are missing protection.",
  },
  {
    category: "Infrastructure",
    title: "Dedicated environment",
    detail: "Premium users may need isolated workers, dedicated IP, and higher-trust infrastructure for prop-style use.",
  },
];

export const tradeSyncerSurfaceBlocks: TradeSyncerSurfaceBlock[] = [
  {
    title: "Connections",
    detail: "Broker and platform connections should be added, tested, and health-checked before they ever join a sync group.",
    includes: [
      "OAuth / API connection status",
      "connected broker accounts",
      "account labels and environment",
      "test login / test connection",
      "account health and entitlement notes",
    ],
  },
  {
    title: "Sync Groups",
    detail: "This is the heart of the product: pick the leader, attach followers, and control how the group behaves.",
    includes: ["leader account selector", "follower account list", "group status", "copy mode", "default risk policy"],
  },
  {
    title: "Policies",
    detail: "Every follower should be able to inherit or override sizing, filters, delay, and protection behavior.",
    includes: ["risk type", "risk setting", "pending order policy", "strict close", "filters and overrides"],
  },
  {
    title: "Live Sync",
    detail: "Operators should see the real-time state of sync groups, not just whether a group exists.",
    includes: [
      "leader open positions",
      "follower match status",
      "copy lag / delay",
      "rejections and partial fills",
      "group-level enable / pause / flatten controls",
    ],
  },
  {
    title: "Drift + Repair Center",
    detail: "A serious copier has to admit when a follower is wrong and show how that gets corrected.",
    includes: ["missing protection warnings", "leader flat but follower open", "follower qty mismatch", "repair actions", "manual review queue"],
  },
  {
    title: "Journal + Analytics",
    detail: "The product needs durable visibility into what happened, what copied, what failed, and why.",
    includes: ["open positions", "closed positions", "trade ticket lookup", "account analytics", "copy event history"],
  },
];

export const tradeSyncerObservedRoutes: TradeSyncerObservedRoute[] = [
  {
    section: "General",
    label: "Dashboard",
    route: "/dashboard",
    purpose: "Portfolio metrics, copier overview, copier logs snapshot, connected account table, and analytics teasers.",
  },
  {
    section: "General",
    label: "Account Configuration",
    route: "/accounts",
    purpose: "Primary account onboarding screen where users add, edit, label, and remove broker accounts.",
  },
  {
    section: "General",
    label: "Account Trades",
    route: "/account-trades",
    purpose: "Open and closed trade ledger with ticket search, visible columns, and export behavior.",
  },
  {
    section: "TC Copier",
    label: "Copier Engine",
    route: "/trade-copier/copier-settings",
    purpose: "Main master/slave management view with Add Master Copier, Add Slave, pause, delete, and live status.",
  },
  {
    section: "TC Copier",
    label: "Copier Templates",
    route: "/trade-copier/templates",
    purpose: "Reusable copier presets for risk, SL/TP copy, pending-order policy, and template editing.",
  },
  {
    section: "TC Copier",
    label: "Copier Logs",
    route: "/trade-copier/copier-logs",
    purpose: "Detailed success/error history with master/slave pairing, lots, times, and profit outcomes.",
  },
  {
    section: "Trading Tools",
    label: "Market News",
    route: "/tools/market-news",
    purpose: "News feed with tabs, sort controls, search, impact filters, and bookmarks.",
  },
  {
    section: "Trading Tools",
    label: "Economic Calendar",
    route: "/economic-calendar",
    purpose: "Calendar table with country/impact/date filters and alert handling.",
  },
  {
    section: "Trading Tools",
    label: "Sentiments",
    route: "/sentiments",
    purpose: "Market sentiment dashboards with Overview, Listing, and Brokers tabs.",
  },
  {
    section: "Trading Tools",
    label: "Integrations",
    route: "/integration",
    purpose: "Premium add-ons and notification/infrastructure integrations such as dedicated environment and email.",
  },
];

export const tradeSyncerSetupSteps: TradeSyncerSetupStep[] = [
  {
    step: "01",
    title: "Connect broker accounts",
    detail: "Start in Accounts, pick the platform, and link the login. For Tradovate this is an OAuth redirect, then account selection and naming the login.",
  },
  {
    step: "02",
    title: "Confirm connected accounts",
    detail: "Return to the account table and confirm each account is connected, labeled correctly, and showing the expected balance/equity state.",
  },
  {
    step: "03",
    title: "Create the master",
    detail: "Open Copier Engine, add a master copier, and nominate the leader account that will broadcast trade events.",
  },
  {
    step: "04",
    title: "Attach followers",
    detail: "Add follower accounts one by one, choosing risk type, risk setting, and whether the follower inherits protections and pending order behavior.",
  },
  {
    step: "05",
    title: "Apply template or overrides",
    detail: "Use a copier template or manual overrides for SL/TP copy, contract alignment, trade delay, filters, comment handling, and strict-close behavior.",
  },
  {
    step: "06",
    title: "Test and monitor",
    detail: "Place a test trade, then watch Copier Logs, open/closed trades, and follower drift before trusting live sizing at scale.",
  },
];

export const tradeSyncerControlGroups: TradeSyncerControlGroup[] = [
  {
    title: "Basic Settings",
    detail: "The core leader/follower relationship is defined here.",
    controls: ["Copy From Account", "Copy To Account", "Risk Type", "Risk Setting"],
  },
  {
    title: "SL and TP Settings",
    detail: "The product exposes both inherited and synthetic protection handling.",
    controls: [
      "Copy Stop Loss",
      "Copy Take Profit",
      "Copy Pending Orders",
      "Fixed Stop Loss",
      "Fixed Take Profit",
      "Stop Loss Refinement",
      "Take Profit Refinement",
      "Copy Expiry Time",
    ],
  },
  {
    title: "Advanced Settings",
    detail: "This is where the copier becomes operationally nuanced rather than basic.",
    controls: [
      "Force Minimum Lot Size",
      "Force Maximum Lot Size",
      "Reverse Trade",
      "Copy Existing Trades",
      "Contract Alignment",
      "Strict Close",
      "Copy Trade Comment",
      "Custom Comment",
      "Lot Refiner",
      "Trade Delay (fixed or random ms)",
    ],
  },
  {
    title: "Trade Filters",
    detail: "Leader trades can be selectively copied instead of blindly mirrored.",
    controls: [
      "Filter by magic number",
      "Filter by comment",
      "Filter by trade side",
      "Filter by master lot size range",
    ],
  },
];

export const tradeSyncerRiskTypes: TradeSyncerRiskType[] = [
  {
    title: "Fixed Lot",
    useCase: "Every follower trade should open at one static size.",
    detail: "Follower ignores master sizing and always uses the exact fixed lot value entered in the copier.",
  },
  {
    title: "Lot Multiplier",
    useCase: "Follower size should be a percentage of the master lot size.",
    detail: "100% means one-to-one lot copying, 50% halves the master size, and 150% increases it by half.",
  },
  {
    title: "Balance Multiplier",
    useCase: "Follower risk should scale off account balance percentage rather than raw lot size.",
    detail: "100% aims to mirror percentage balance risk from master to follower instead of matching lots directly.",
  },
  {
    title: "Fixed Balance Multiplier",
    useCase: "Follower should compound while the master reference balance stays fixed.",
    detail: "The copier uses a fixed notional master balance for calculations so the follower can scale as its own balance changes.",
  },
  {
    title: "Fixed % Risk (Beta)",
    useCase: "Follower should risk a fixed percentage of follower balance on each trade.",
    detail: "Requires a stop loss on the master trade because the copier needs stop distance to calculate follower position size.",
  },
];

export const tradeSyncerCopierStatuses: TradeSyncerCopierStatus[] = [
  {
    title: "Enabled",
    detail: "All leader trade actions are copied.",
    operatorMeaning: "Use for active live sync when the group is trusted and fully configured.",
  },
  {
    title: "Disabled - Monitor Existing",
    detail: "Ignore new leader entries, but keep managing already copied follower trades until they close.",
    operatorMeaning: "Use as a soft pause when the operator wants to stop fresh entries without abandoning trades already open.",
  },
  {
    title: "Disabled",
    detail: "Ignore all trade actions for that copier.",
    operatorMeaning: "Use for hard pause / off state when the group should not act at all.",
  },
];

export const tradeSyncerAccountTabs: TradeSyncerAccountTab[] = [
  {
    title: "Overview",
    detail: "Broker, balance, equity, leverage, support details, and account metadata like owner, reports, server, and timezone.",
  },
  {
    title: "Account Management",
    detail: "Editable account label, password update, and the 'Consider Account Balance' control.",
  },
  {
    title: "Equity Protector",
    detail: "Maximum equity, minimum equity, and the enable toggle for equity-protection rules.",
  },
  {
    title: "Trading Symbols",
    detail: "Search, toggle all symbols, and set per-symbol enabled state plus min/max lot bounds.",
  },
];

export const tradeSyncerPremiumFeatures: TradeSyncerPremiumFeature[] = [
  {
    title: "Dedicated Environment (MetaTrader)",
    summary: "Dedicated trading environment inside Traders Connect infrastructure.",
    price: "$30/mo",
    whyItMatters: "They sell infrastructure isolation as a premium execution feature, which strongly suggests dedicated IP / isolated workers matter to serious prop-style users.",
  },
  {
    title: "Email Notifications",
    summary: "Notification channel for open trades, closed trades, and copier configuration changes.",
    price: "Free",
    whyItMatters: "Notifications are treated as part of the operator system, not an afterthought.",
  },
  {
    title: "Telegram Notifications",
    summary: "Messaging-channel notifications for trade and copier events.",
    price: "Coming soon",
    whyItMatters: "They are clearly pushing the copier into a full operator ecosystem with external alert delivery.",
  },
];

export const tradeSyncerFailureModes: TradeSyncerFailureMode[] = [
  {
    title: "Copier disabled",
    cause: "Master or slave status is not enabled.",
    fix: "Check both master and slave statuses before expecting any new leader trades to copy.",
  },
  {
    title: "Symbol mismatch",
    cause: "Leader symbol name and follower broker symbol name do not match.",
    fix: "Use symbol mapping so leader and follower symbols are explicitly paired.",
  },
  {
    title: "Symbol disabled",
    cause: "The symbol is turned off under account trading symbols.",
    fix: "Enable the symbol on the account configuration screen before copying it.",
  },
  {
    title: "Invalid volume",
    cause: "Follower lot size is below minimum or above maximum lot rules for that broker symbol.",
    fix: "Use force-minimum sizing, max-lot guards, and sane risk settings instead of assuming one size fits all brokers.",
  },
  {
    title: "Slave stays open after leader exit",
    cause: "Strict Close is enabled or follower protection is missing.",
    fix: "Use follower protection / flatten-on-drift and be careful with Strict Close because it changes how close events are handled.",
  },
];

export const tradeSyncerBuildSteps = [
  {
    step: "01",
    title: "Add Trade Syncer as a first-class connector product",
    detail: "It should live beside Futures and CFDs, not as a buried utility screen.",
  },
  {
    step: "02",
    title: "Define sync groups and copy policies",
    detail: "Get the leader/follower domain model, execution modes, and policy overrides stable before real fanout.",
  },
  {
    step: "03",
    title: "Simulate sync before routing live",
    detail: "Use a journaled local sync engine first so we can hammer drift, rejects, and repair behavior safely.",
  },
  {
    step: "04",
    title: "Wire Tradovate and Rithmic fanout",
    detail: "Only after the simulated sync contract is solid should we dispatch follower actions to live backends.",
  },
  {
    step: "05",
    title: "Harden with repair, analytics, and premium infra",
    detail: "Follower protection, event audit, and dedicated environment options are what turn this into a paid product.",
  },
];

export type TradeSyncerVenue =
  | "tradovate"
  | "rithmic"
  | "metatrader5"
  | "metatrader4"
  | "ctrader"
  | "dxtrade"
  | "matchtrader"
  | "tradelocker"
  | "projectx"
  | "quantower";

export type TradeSyncerEnvironment = "demo" | "live" | "staging";

export type TradeSyncerAccountConnectionState =
  | "connected"
  | "needs_reauth"
  | "review"
  | "draft";

export type TradeSyncerAccountSyncStatus =
  | "enabled"
  | "review"
  | "paused";

export type TradeSyncerTemplateStatus = "enabled" | "draft";

export type TradeSyncerGroupStatus =
  | "enabled"
  | "monitor_existing"
  | "disabled";

export type TradeSyncerDelayMode = "immediate" | "fixed_delay" | "random_delay";

export type TradeSyncerLogSeverity = "success" | "warning" | "error" | "info";

export type TradeSyncerRepairState = "healthy" | "monitoring" | "manual_review";
export type TradeSyncerDispatchReadiness = "ready" | "review" | "blocked";
export type TradeSyncerDispatchOrderType = "market" | "limit" | "stop" | "stop_limit";
export type TradeSyncerDispatchTif = "day" | "gtc";

export type TradeSyncerFollowerHealth =
  | "healthy"
  | "monitoring"
  | "drift_detected"
  | "repairing"
  | "flattened";

export type TradeSyncerRepairAction =
  | "pause_group"
  | "restage_protection"
  | "flatten_followers"
  | "mark_healthy";

export type TradeSyncerFollowerRepairAction =
  | "pause_follower"
  | "restage_follower_protection"
  | "flatten_follower"
  | "mark_follower_healthy";

export type TradeSyncerFollowerRepairEvent = {
  id: string;
  action: string;
  outcome: "logged" | "in_progress" | "resolved";
  detail: string;
  occurredAt: string;
};

export type TradeSyncerMasterTradeEvent = {
  groupId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  orderType: TradeSyncerDispatchOrderType;
  tif: TradeSyncerDispatchTif;
  limitPrice: number | null;
  stopPrice: number | null;
  stopLossTicks: number | null;
  takeProfitTicks: number | null;
  source: "dispatch_preview" | "simulated_master_fill";
  triggeredAt: string;
};

export type TradeSyncerFollowerDispatchIntent = {
  followerId: string;
  followerLabel: string;
  venue: TradeSyncerVenue;
  brokerAccountRef: string;
  groupStatus: TradeSyncerGroupStatus;
  followerStatus: TradeSyncerGroupStatus;
  healthState: TradeSyncerFollowerHealth;
  executionModeId: string;
  readiness: TradeSyncerDispatchReadiness;
  readinessReason: string;
  warnings: string[];
  routeProfileId: string | null;
  routeLabel: string | null;
  managedAccountId: string | null;
  managedAccountLabel: string | null;
  followerSymbol: string | null;
  requestedQuantity: number | null;
  quantityDetail: string;
  copyStopLoss: boolean;
  copyTakeProfit: boolean;
  copyPendingOrders: boolean;
  dispatchPayload: {
    venue: TradeSyncerVenue;
    accountId: string | null;
    symbol: string | null;
    side: "buy" | "sell";
    quantityMode: "fixed_contracts";
    quantity: number | null;
    orderType: TradeSyncerDispatchOrderType;
    tif: TradeSyncerDispatchTif;
    limitPrice: number | null;
    stopPrice: number | null;
    stopLossTicks: number | null;
    takeProfitTicks: number | null;
  } | null;
};

export type TradeSyncerDispatchPreview = {
  generatedAt: string;
  sourceEvent: TradeSyncerMasterTradeEvent;
  groupId: string;
  groupLabel: string;
  leadAccountId: string;
  leadAccountLabel: string;
  readyFollowers: number;
  reviewFollowers: number;
  blockedFollowers: number;
  intents: TradeSyncerFollowerDispatchIntent[];
  notes: string[];
};

export type TradeSyncerDispatchDryRunState =
  | "preview_ready"
  | "staged"
  | "review"
  | "blocked"
  | "failed";

export type TradeSyncerFollowerDispatchDryRun = {
  followerId: string;
  followerLabel: string;
  venue: TradeSyncerVenue;
  readiness: TradeSyncerDispatchReadiness;
  dryRunState: TradeSyncerDispatchDryRunState;
  dryRunReason: string;
  routeLabel: string | null;
  managedAccountLabel: string | null;
  signalId: string | null;
  warnings: string[];
  requestBody: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
};

export type TradeSyncerDispatchDryRunResult = {
  generatedAt: string;
  sourceEvent: TradeSyncerMasterTradeEvent;
  groupId: string;
  groupLabel: string;
  readyFollowers: number;
  reviewFollowers: number;
  blockedFollowers: number;
  failedFollowers: number;
  stagedFollowers: number;
  intents: TradeSyncerFollowerDispatchDryRun[];
  notes: string[];
};

export type TradeSyncerDispatchStageState =
  | "queued"
  | "review"
  | "blocked"
  | "failed";

export type TradeSyncerFollowerDispatchStageResult = {
  followerId: string;
  followerLabel: string;
  venue: TradeSyncerVenue;
  readiness: TradeSyncerDispatchReadiness;
  stageState: TradeSyncerDispatchStageState;
  stageReason: string;
  routeLabel: string | null;
  managedAccountLabel: string | null;
  signalId: string | null;
  warnings: string[];
  requestBody: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
};

export type TradeSyncerDispatchStageResult = {
  generatedAt: string;
  sourceEvent: TradeSyncerMasterTradeEvent;
  groupId: string;
  groupLabel: string;
  readyFollowers: number;
  reviewFollowers: number;
  blockedFollowers: number;
  failedFollowers: number;
  queuedFollowers: number;
  intents: TradeSyncerFollowerDispatchStageResult[];
  notes: string[];
};

export type TradeSyncerDispatchExecutionSimulationState =
  | "protected_open"
  | "partial_fill"
  | "drifted"
  | "filled"
  | "rejected"
  | "skipped";

export type TradeSyncerDispatchExecutionScenario =
  | "happy_path"
  | "reject_branch"
  | "partial_fill_branch"
  | "drift_after_fill";

export type TradeSyncerFollowerDispatchExecutionSimulationResult = {
  followerId: string;
  followerLabel: string;
  venue: TradeSyncerVenue;
  finalState: TradeSyncerDispatchExecutionSimulationState;
  finalReason: string;
  routeLabel: string | null;
  managedAccountLabel: string | null;
  signalId: string | null;
  commandId: string | null;
  executionPath: string[];
  warnings: string[];
  simulatedQuantity: number | null;
  simulatedProtectionState: TradeSyncerFollowerProtectionState | null;
  simulatedHealthState: TradeSyncerFollowerHealth | null;
};

export type TradeSyncerDispatchExecutionSimulationResult = {
  generatedAt: string;
  sourceEvent: TradeSyncerMasterTradeEvent;
  scenario: TradeSyncerDispatchExecutionScenario;
  groupId: string;
  groupLabel: string;
  queuedFollowers: number;
  protectedFollowers: number;
  filledFollowers: number;
  partialFollowers: number;
  driftedFollowers: number;
  rejectedFollowers: number;
  skippedFollowers: number;
  intents: TradeSyncerFollowerDispatchExecutionSimulationResult[];
  notes: string[];
};

export type TradeSyncerVenueDispatchState =
  | "accepted"
  | "rejected"
  | "partial_fill"
  | "drift_review"
  | "review"
  | "blocked"
  | "failed";

export type TradeSyncerFollowerVenueDispatchResult = {
  followerId: string;
  followerLabel: string;
  venue: TradeSyncerVenue;
  dispatchState: TradeSyncerVenueDispatchState;
  dispatchReason: string;
  routeLabel: string | null;
  managedAccountLabel: string | null;
  signalId: string | null;
  venueOrderState: string | null;
  venueReconciliationState: string | null;
  requestBody: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
  warnings: string[];
};

export type TradeSyncerVenueDispatchResult = {
  generatedAt: string;
  sourceEvent: TradeSyncerMasterTradeEvent;
  scenario: TradeSyncerDispatchExecutionScenario;
  groupId: string;
  groupLabel: string;
  acceptedFollowers: number;
  rejectedFollowers: number;
  partialFollowers: number;
  driftReviewFollowers: number;
  reviewFollowers: number;
  blockedFollowers: number;
  failedFollowers: number;
  intents: TradeSyncerFollowerVenueDispatchResult[];
  notes: string[];
};

export type TradeSyncerTradovateLiveBridgeState =
  | "submitted"
  | "rejected"
  | "review"
  | "blocked"
  | "failed"
  | "skipped";

export type TradeSyncerFollowerTradovateLiveBridgeResult = {
  followerId: string;
  followerLabel: string;
  venue: TradeSyncerVenue;
  bridgeState: TradeSyncerTradovateLiveBridgeState;
  bridgeReason: string;
  routeLabel: string | null;
  managedAccountLabel: string | null;
  signalId: string | null;
  venueOrderState: string | null;
  venueReconciliationState: string | null;
  requestBody: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
  warnings: string[];
};

export type TradeSyncerTradovateLiveBridgeResult = {
  generatedAt: string;
  sourceEvent: TradeSyncerMasterTradeEvent;
  groupId: string;
  groupLabel: string;
  submittedFollowers: number;
  rejectedFollowers: number;
  reviewFollowers: number;
  blockedFollowers: number;
  failedFollowers: number;
  skippedFollowers: number;
  intents: TradeSyncerFollowerTradovateLiveBridgeResult[];
  notes: string[];
};

export type TradeSyncerAccountRecord = {
  id: string;
  label: string;
  brokerAccountRef: string;
  venue: TradeSyncerVenue;
  environment: TradeSyncerEnvironment;
  managedFuturesAccountId: string | null;
  connectionState: TradeSyncerAccountConnectionState;
  syncStatus: TradeSyncerAccountSyncStatus;
  balance: number;
  equity: number;
  timezone: string;
  enabledSymbols: string[];
  healthNote: string;
  lastHeartbeatAt: string | null;
};

export type TradeSyncerTemplateRecord = {
  id: string;
  label: string;
  status: TradeSyncerTemplateStatus;
  riskType: string;
  riskSetting: string;
  copyStopLoss: boolean;
  copyTakeProfit: boolean;
  copyPendingOrders: boolean;
  copyExpiryTime: boolean;
  strictClose: boolean;
  contractAlignment: boolean;
  customComment: string;
  delayMode: TradeSyncerDelayMode;
  allowedSymbols: string[];
  commentFilter: string | null;
  directionFilter: "both" | "long_only" | "short_only";
  masterLotRange: string;
};

export type TradeSyncerFollowerOverride = {
  copyStopLoss?: boolean;
  copyTakeProfit?: boolean;
  copyPendingOrders?: boolean;
  delayMode?: TradeSyncerDelayMode;
};

export type TradeSyncerFollowerPositionState =
  | "flat"
  | "entry_working"
  | "open"
  | "partial_exit"
  | "flattening";

export type TradeSyncerFollowerProtectionState =
  | "none"
  | "staged"
  | "protected"
  | "restaging"
  | "missing";

export type TradeSyncerFollowerPositionSnapshot = {
  symbol: string;
  side: "long" | "short" | "flat";
  quantity: number;
  avgEntryPrice: number | null;
  state: TradeSyncerFollowerPositionState;
  updatedAt: string | null;
};

export type TradeSyncerFollowerProtectionSnapshot = {
  stopLossState: "working" | "missing" | "not_needed";
  takeProfitState: "working" | "missing" | "not_needed";
  workingLegCount: number;
  lastRestagedAt: string | null;
  state: TradeSyncerFollowerProtectionState;
};

export type TradeSyncerFollowerRecord = {
  id: string;
  accountId: string;
  riskType: string;
  riskSetting: string;
  templateId: string | null;
  status: TradeSyncerGroupStatus;
  healthState: TradeSyncerFollowerHealth;
  currentDrift: string | null;
  lastDriftAt: string | null;
  positionSnapshot: TradeSyncerFollowerPositionSnapshot;
  protectionSnapshot: TradeSyncerFollowerProtectionSnapshot;
  override: TradeSyncerFollowerOverride | null;
  repairHistory: TradeSyncerFollowerRepairEvent[];
};

export type TradeSyncerSymbolMapping = {
  leaderSymbol: string;
  followerSymbol: string;
};

export type TradeSyncerSyncGroupRecord = {
  id: string;
  label: string;
  leadAccountId: string;
  executionModeId: string;
  status: TradeSyncerGroupStatus;
  followerRecords: TradeSyncerFollowerRecord[];
  symbolMappings: TradeSyncerSymbolMapping[];
  openPositions: number;
  medianCopyLagMs: number;
  repairState: TradeSyncerRepairState;
  lastEventAt: string | null;
};

export type TradeSyncerLogEntry = {
  id: string;
  occurredAt: string;
  groupId: string | null;
  accountId: string | null;
  severity: TradeSyncerLogSeverity;
  title: string;
  detail: string;
  status: string;
};

export type TradeSyncerAuditEntry = {
  id: string;
  kind:
    | "account_added"
    | "account_updated"
    | "template_added"
    | "template_updated"
    | "sync_group_added"
    | "sync_group_updated"
    | "log_recorded";
  detail: string;
  occurredAt: string;
};

export type TradeSyncerStore = {
  updatedAt: string;
  accounts: TradeSyncerAccountRecord[];
  templates: TradeSyncerTemplateRecord[];
  syncGroups: TradeSyncerSyncGroupRecord[];
  logs: TradeSyncerLogEntry[];
  auditTrail: TradeSyncerAuditEntry[];
};

export const tradeSyncerSeedAccounts: TradeSyncerAccountRecord[] = [
  {
    id: "ts_account_tradovate_demo_lead",
    label: "Tradovate-Demo-Lead",
    brokerAccountRef: "SIM778201",
    venue: "tradovate",
    environment: "demo",
    managedFuturesAccountId: "tradovate-demo-sim-001",
    connectionState: "connected",
    syncStatus: "enabled",
    balance: 12450,
    equity: 12450,
    timezone: "Broker local",
    enabledSymbols: ["MNQ", "NQ", "ES", "GC"],
    healthNote: "Primary lead account for MNQ propagation tests.",
    lastHeartbeatAt: "2026-05-24T08:42:18.000Z",
  },
  {
    id: "ts_account_tradovate_prop_a",
    label: "Tradovate-Prop-A",
    brokerAccountRef: "PA-22014",
    venue: "tradovate",
    environment: "live",
    managedFuturesAccountId: "tradovate-live-prop-001",
    connectionState: "connected",
    syncStatus: "enabled",
    balance: 51200,
    equity: 50980,
    timezone: "Broker local",
    enabledSymbols: ["MNQ", "NQ", "MGC", "MES"],
    healthNote: "Healthy follower lane.",
    lastHeartbeatAt: "2026-05-24T08:41:04.000Z",
  },
  {
    id: "ts_account_tradovate_prop_b",
    label: "Tradovate-Prop-B",
    brokerAccountRef: "PA-22027",
    venue: "tradovate",
    environment: "live",
    managedFuturesAccountId: "tradovate-live-prop-002",
    connectionState: "connected",
    syncStatus: "enabled",
    balance: 49860,
    equity: 49710,
    timezone: "Broker local",
    enabledSymbols: ["MNQ", "NQ", "MES"],
    healthNote: "Follower lane sharing the main prop template.",
    lastHeartbeatAt: "2026-05-24T08:40:31.000Z",
  },
  {
    id: "ts_account_rithmic_sim_lead",
    label: "Rithmic-Sim-Lead",
    brokerAccountRef: "RIT-MNQ-01",
    venue: "rithmic",
    environment: "staging",
    managedFuturesAccountId: null,
    connectionState: "connected",
    syncStatus: "enabled",
    balance: 25000,
    equity: 25000,
    timezone: "Broker local",
    enabledSymbols: ["MNQ", "NQ", "M2K"],
    healthNote: "Lead lane staged through the non-live Rithmic gateway contract.",
    lastHeartbeatAt: "2026-05-24T08:31:11.000Z",
  },
  {
    id: "ts_account_rithmic_follower_a",
    label: "Rithmic-Follower-A",
    brokerAccountRef: "RIT-MNQ-02",
    venue: "rithmic",
    environment: "staging",
    managedFuturesAccountId: "rithmic-live-prop-001",
    connectionState: "connected",
    syncStatus: "enabled",
    balance: 18000,
    equity: 17910,
    timezone: "Broker local",
    enabledSymbols: ["MNQ", "NQ"],
    healthNote: "Follower lane bound to the managed Rithmic route for non-live dispatch validation.",
    lastHeartbeatAt: "2026-05-24T08:29:44.000Z",
  },
];

export const tradeSyncerSeedTemplates: TradeSyncerTemplateRecord[] = [
  {
    id: "ts_template_mnq_eval_safe",
    label: "MNQ Eval Safe",
    status: "enabled",
    riskType: "Fixed % Risk (Beta)",
    riskSetting: "1.0%",
    copyStopLoss: true,
    copyTakeProfit: true,
    copyPendingOrders: false,
    copyExpiryTime: false,
    strictClose: false,
    contractAlignment: true,
    customComment: "KWANTIFY-EVAL",
    delayMode: "immediate",
    allowedSymbols: ["MNQ", "NQ"],
    commentFilter: null,
    directionFilter: "both",
    masterLotRange: "0.25 - 2.00",
  },
  {
    id: "ts_template_prop_fanout_fast",
    label: "Prop Fanout Fast",
    status: "enabled",
    riskType: "Lot Multiplier",
    riskSetting: "0.50x",
    copyStopLoss: true,
    copyTakeProfit: true,
    copyPendingOrders: true,
    copyExpiryTime: true,
    strictClose: false,
    contractAlignment: true,
    customComment: "KWANTIFY-FANOUT",
    delayMode: "immediate",
    allowedSymbols: ["MNQ", "NQ", "MES"],
    commentFilter: null,
    directionFilter: "both",
    masterLotRange: "0.25 - 5.00",
  },
  {
    id: "ts_template_rithmic_ladder_base",
    label: "Rithmic Ladder Base",
    status: "draft",
    riskType: "Fixed Lot",
    riskSetting: "1 contract",
    copyStopLoss: true,
    copyTakeProfit: true,
    copyPendingOrders: false,
    copyExpiryTime: false,
    strictClose: true,
    contractAlignment: true,
    customComment: "KWANTIFY-RITHMIC",
    delayMode: "fixed_delay",
    allowedSymbols: ["MNQ", "NQ", "M2K"],
    commentFilter: null,
    directionFilter: "both",
    masterLotRange: "1 - 3",
  },
];

export const tradeSyncerSeedSyncGroups: TradeSyncerSyncGroupRecord[] = [
  {
    id: "ts_group_mnq_prop_fanout",
    label: "MNQ Prop Fanout",
    leadAccountId: "ts_account_tradovate_demo_lead",
    executionModeId: "fill-based",
    status: "enabled",
    followerRecords: [
      {
        id: "ts_follower_prop_a",
        accountId: "ts_account_tradovate_prop_a",
        riskType: "Lot Multiplier",
        riskSetting: "1.00x",
        templateId: "ts_template_prop_fanout_fast",
        status: "enabled",
        healthState: "healthy",
        currentDrift: null,
        lastDriftAt: null,
        positionSnapshot: {
          symbol: "MNQ",
          side: "long",
          quantity: 1,
          avgEntryPrice: 18452.25,
          state: "open",
          updatedAt: "2026-05-24T08:42:18.000Z",
        },
        protectionSnapshot: {
          stopLossState: "working",
          takeProfitState: "working",
          workingLegCount: 2,
          lastRestagedAt: null,
          state: "protected",
        },
        override: null,
        repairHistory: [],
      },
      {
        id: "ts_follower_prop_b",
        accountId: "ts_account_tradovate_prop_b",
        riskType: "Lot Multiplier",
        riskSetting: "0.75x",
        templateId: "ts_template_prop_fanout_fast",
        status: "enabled",
        healthState: "monitoring",
        currentDrift: null,
        lastDriftAt: "2026-05-24T08:39:04.000Z",
        positionSnapshot: {
          symbol: "MNQ",
          side: "long",
          quantity: 1,
          avgEntryPrice: 18452.5,
          state: "open",
          updatedAt: "2026-05-24T08:39:04.000Z",
        },
        protectionSnapshot: {
          stopLossState: "working",
          takeProfitState: "working",
          workingLegCount: 2,
          lastRestagedAt: "2026-05-24T08:39:04.000Z",
          state: "protected",
        },
        override: { delayMode: "fixed_delay" },
        repairHistory: [
          {
            id: "ts_follower_hist_prop_b_1",
            action: "restage_protection",
            outcome: "resolved",
            detail: "Protection legs were restaged after a follower modify rejection on the stop order.",
            occurredAt: "2026-05-24T08:39:04.000Z",
          },
        ],
      },
    ],
    symbolMappings: [
      { leaderSymbol: "MNQ", followerSymbol: "MNQ" },
      { leaderSymbol: "NQ", followerSymbol: "NQ" },
    ],
    openPositions: 2,
    medianCopyLagMs: 118,
    repairState: "healthy",
    lastEventAt: "2026-05-24T08:42:18.000Z",
  },
  {
    id: "ts_group_rithmic_test_ladder",
    label: "Rithmic Test Ladder",
    leadAccountId: "ts_account_rithmic_sim_lead",
    executionModeId: "exact-order",
    status: "enabled",
    followerRecords: [
      {
        id: "ts_follower_rithmic_a",
        accountId: "ts_account_rithmic_follower_a",
        riskType: "Fixed Lot",
        riskSetting: "1 contract",
        templateId: "ts_template_rithmic_ladder_base",
        status: "enabled",
        healthState: "monitoring",
        currentDrift: null,
        lastDriftAt: null,
        positionSnapshot: {
          symbol: "MNQ",
          side: "flat",
          quantity: 0,
          avgEntryPrice: null,
          state: "flat",
          updatedAt: "2026-05-24T08:31:11.000Z",
        },
        protectionSnapshot: {
          stopLossState: "not_needed",
          takeProfitState: "not_needed",
          workingLegCount: 0,
          lastRestagedAt: null,
          state: "none",
        },
        override: { copyPendingOrders: true },
        repairHistory: [
          {
            id: "ts_follower_hist_rithmic_a_1",
            action: "mark_follower_healthy",
            outcome: "resolved",
            detail: "Rithmic follower ladder was revalidated and returned to monitored healthy state for non-live dispatch testing.",
            occurredAt: "2026-05-25T07:18:11.000Z",
          },
        ],
      },
    ],
    symbolMappings: [
      { leaderSymbol: "MNQ", followerSymbol: "MNQ" },
      { leaderSymbol: "M2K", followerSymbol: "M2K" },
    ],
    openPositions: 0,
    medianCopyLagMs: 146,
    repairState: "healthy",
    lastEventAt: "2026-05-25T07:18:11.000Z",
  },
];

export const tradeSyncerSeedLogs: TradeSyncerLogEntry[] = [
  {
    id: "ts_log_1",
    occurredAt: "2026-05-24T08:42:18.000Z",
    groupId: "ts_group_mnq_prop_fanout",
    accountId: null,
    severity: "success",
    title: "Copied buy to 2 followers",
    detail: "MNQ Prop Fanout mirrored a filled buy into the active Tradovate follower set.",
    status: "success",
  },
  {
    id: "ts_log_2",
    occurredAt: "2026-05-24T08:39:04.000Z",
    groupId: "ts_group_mnq_prop_fanout",
    accountId: "ts_account_tradovate_prop_b",
    severity: "warning",
    title: "Protection legs reattached after modify rejection",
    detail: "Follower protection rules restaged SL/TP after a modify rejection on Tradovate-Prop-B.",
    status: "warning",
  },
  {
    id: "ts_log_3",
    occurredAt: "2026-05-25T07:18:11.000Z",
    groupId: "ts_group_rithmic_test_ladder",
    accountId: "ts_account_rithmic_sim_lead",
    severity: "success",
    title: "Rithmic ladder restored for non-live dispatch testing",
    detail: "Rithmic Test Ladder was returned to enabled monitoring so the venue-specific copy path can be exercised safely.",
    status: "healthy",
  },
  {
    id: "ts_log_4",
    occurredAt: "2026-05-24T08:20:44.000Z",
    groupId: "ts_group_mnq_prop_fanout",
    accountId: "ts_account_tradovate_prop_a",
    severity: "error",
    title: "Follower skipped because symbol mapping missing",
    detail: "A follower route rejected an instrument without an explicit symbol map.",
    status: "error",
  },
];

export function createTradeSyncerSeedStore(): TradeSyncerStore {
  return {
    updatedAt: new Date().toISOString(),
    accounts: structuredClone(tradeSyncerSeedAccounts),
    templates: structuredClone(tradeSyncerSeedTemplates),
    syncGroups: structuredClone(tradeSyncerSeedSyncGroups),
    logs: structuredClone(tradeSyncerSeedLogs),
    auditTrail: [],
  };
}
