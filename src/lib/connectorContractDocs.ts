export const cfdPayloadFieldDocs = {
  heartbeat: [
    ["connectorId", "string", "Required", "The internal connector record id in kwantify. Used to bind the heartbeat to the correct MT5 bridge."],
    ["kwantId", "string", "Required", "The user-facing KWANT ID configured inside the EA. Must match the connector registry exactly."],
    ["authToken", "string", "Required", "Shared-secret token proving this terminal has been paired and authenticated for the connector seat."],
    ["occurredAt", "ISO datetime", "Required", "Terminal-side timestamp when the heartbeat was sent."],
    ["latencyMs", "number", "Required", "Elapsed request latency measured by the EA for the heartbeat call."],
    ["terminalStatus", "`ready | busy | offline`", "Required", "Whether the EA is idle and ready, currently handling work, or unable to trade."],
    ["chartSymbol", "string", "Required", "The chart symbol the EA is currently attached to in MT5."],
    ["eaVersion", "string", "Required", "The EA build/version string running in the terminal."],
    ["pendingSignals", "number", "Required", "Local count of unprocessed commands still waiting on the terminal side."],
    ["lastErrorCode", "string", "Optional", "Last terminal-side error code if the EA recently encountered a failure."],
    ["lastErrorMessage", "string", "Optional", "Human-readable last error detail for operator review."],
  ],
  claim: [
    ["connectorId", "string", "Required", "Internal connector record id. Used to scope which mailbox the EA may read from."],
    ["kwantId", "string", "Required", "Configured KWANT ID. Acts like the seat identity for this MT5 terminal."],
    ["authToken", "string", "Required", "Shared-secret token for this paired terminal. The connector should reject claim calls without it."],
    ["maxCommands", "number", "Optional", "How many pending commands the EA wants in one pull request. Default is 1."],
  ],
  ack: [
    ["connectorId", "string", "Required", "Internal connector record id acknowledging a claimed command."],
    ["kwantId", "string", "Required", "Configured KWANT ID proving the correct MT5 seat is acknowledging the command."],
    ["authToken", "string", "Required", "Shared-secret token proving the acknowledgement came from the paired terminal."],
    ["signalId", "string", "Required", "Original platform signal id being acknowledged for execution."],
    ["claimToken", "string", "Required", "Unique claim token returned by the claim route. Prevents stale or duplicated acknowledgements."],
  ],
  report: [
    ["connectorId", "string", "Required", "Internal connector record id returning the execution result."],
    ["kwantId", "string", "Required", "Configured KWANT ID proving the report belongs to the correct connector seat."],
    ["authToken", "string", "Required", "Shared-secret token proving the report came from the paired terminal."],
    ["signalId", "string", "Required", "The original signal id from kwantify. Used to reconcile the report with the pending command."],
    ["status", "`accepted | placed | filled | shadow_armed | shadow_triggered | reduced | rejected | closed | modified | cancelled | disabled | enabled`", "Required", "The execution lifecycle state being reported back from MT5."],
    ["occurredAt", "ISO datetime", "Required", "Terminal-side timestamp for the reported execution event."],
    ["terminalSymbol", "string", "Required", "The actual broker/terminal symbol used by MT5 after mapping."],
    ["orderTicket", "string", "Optional", "Broker order ticket if MT5 has already created one."],
    ["positionTicket", "string", "Optional", "Broker position ticket if the order became a live position."],
    ["executedPrice", "number", "Optional", "Execution price for a fill, reduction, or close event."],
    ["remainingVolume", "number", "Optional", "Remaining live position volume after a partial reduction on hedging accounts."],
    ["stopLoss", "number|null", "Optional", "Stop level currently attached to the order/position after execution."],
    ["takeProfit", "number|null", "Optional", "Target level currently attached to the order/position after execution."],
    ["errorCode", "string", "Optional", "MT5/broker error code when the command is rejected or fails."],
    ["errorMessage", "string", "Optional", "Human-readable rejection/failure explanation."],
    ["terminalComment", "string", "Optional", "EA-side order comment saved into MT5 for traceability."],
  ],
} as const;

export const cfdClaimedCommandFieldDocs = [
  ["schemaVersion", "string", "Required", "Bridge schema version the EA must honor for this claimed command."],
  ["connectorId", "string", "Required", "Internal connector record id. Used to keep the command scoped to the correct MT5 bridge."],
  ["kwantId", "string", "Required", "The KWANT ID seat the command belongs to. The EA should reject commands for any other seat."],
  ["signal.signalId", "string", "Required", "Original platform signal id. Use this for local idempotency and duplicate protection."],
  ["action", "`open_long | open_short | partial_close_position | close_position | flatten_all`", "Required", "Normalized execution intent the EA should follow instead of guessing from the raw signal side."],
  ["terminalSymbol", "string", "Required", "Exact MT5 broker symbol to execute. Do not remap it again inside the EA."],
  ["quantityMode", "`lots`", "Required", "Current size interpretation. In v1.2 the bridge sends lots only."],
  ["normalizedQuantity", "number", "Required", "Prevalidated lot quantity already checked against the connector symbol map."],
  ["stopInstruction", "{ mode, value }", "Required", "Stop instruction the EA must honor exactly. `value=null` means no stop should be attached."],
  ["targetInstruction", "{ mode, value }", "Required", "Target instruction the EA must honor exactly. `value=null` means no target should be attached."],
  ["duplicateWindowSeconds", "number", "Required", "Minimum duplicate-protection window the EA should respect before considering a signal reusable."],
  ["maxOpenPositions", "number", "Required", "Maximum allowed open positions for the route when this command was generated."],
  ["reductionPolicy", "`disabled | hedging_only`", "Required", "Whether the route allows partial reduction at all, and if so under what broad account-mode expectation."],
  ["minReductionLot", "number|null", "Required", "Minimum reduction size allowed by the route. The MT5 side should reject smaller reductions even if the raw signal slipped through another layer."],
  ["minRemainingLot", "number|null", "Required", "Minimum post-reduction live size expected by the route. This is included so the MT5 side can validate live remaining volume before reporting `reduced`."],
  ["magic", "number", "Required", "MT5 order grouping number reserved by kwantify for this connector flow."],
  ["comment", "string", "Required", "Traceable terminal comment to preserve strategy/version lineage inside MT5."],
  ["claimToken", "string|null", "Required", "Unique claim token for this current claim lease. The EA should echo it back when acknowledging the claim."],
  ["claimExpiresAt", "ISO datetime|null", "Required", "Deadline for acknowledging or completing this claim before the backend may recycle the command."],
  ["acknowledgedAt", "ISO datetime|null", "Required", "Timestamp when the EA explicitly confirmed it has started working the command."],
  ["retryCount", "number", "Required", "How many times the connector has had to recycle this command after a stale claim."],
] as const;

export const cfdPairingFieldDocs = [
  ["connectorId", "string", "Required", "Internal connector record id being paired to the MT5 terminal."],
  ["kwantId", "string", "Required", "User-facing KWANT ID assigned to the connector seat."],
  ["pairingCode", "string", "Required", "One-time pairing code shown in the platform and entered into the EA setup."],
  ["terminalInstanceId", "string", "Required", "Stable terminal/host instance id used to bind this MT5 installation to the connector."],
  ["terminalAlias", "string", "Required", "Human-readable terminal nickname shown in the platform for operators."],
  ["eaVersion", "string", "Required", "EA build/version being paired."],
  ["chartSymbol", "string", "Required", "Chart symbol the EA is attached to during pairing."],
] as const;

export const cfdSemanticRules = [
  {
    title: "Schema version pinning",
    detail:
      "The CFD bridge now declares `kwantify-cfd-connector/v1.2`. The EA should validate the version before executing and fail truthfully if the bridge version is unsupported.",
  },
  {
    title: "Pairing and authentication",
    detail:
      "The EA should not call heartbeat, claim, or report routes until the pairing code has been redeemed and the shared-secret auth token has been issued for that connector seat.",
  },
  {
    title: "Normalized action over raw side",
    detail:
      "The EA should key off the claimed command `action` field first. Raw signal sides still exist for traceability, but `action` is the final execution intent after connector policy has normalized the trade.",
  },
  {
    title: "Quantity interpretation",
    detail:
      "In v1.2, quantity is interpreted only as `lots`. The backend validates the lot step and min/max constraints before the EA sees the command, so the EA should execute `normalizedQuantity` exactly unless the broker rejects it.",
  },
  {
    title: "Close and flatten discipline",
    detail:
      "Partial reduce, close, and flatten instructions are market-only in v1.2 and must not carry stop-loss or take-profit values. Partial reduction is intended for hedging-aware MT5 flows; richer reduce semantics should still version forward if we add more nuance later.",
  },
  {
    title: "Reduction policy must be explicit",
    detail:
      "A CFD route should opt into reduction behavior intentionally. In the current bridge, routes can disable reduction entirely or allow it as a hedging-first feature rather than silently inheriting partial-close behavior.",
  },
  {
    title: "Reduction guardrails belong to the route",
    detail:
      "Route profiles can now define a minimum reduction size and a minimum remaining size policy. The platform can validate the minimum reduction at intake, while the MT5 side remains responsible for confirming the live remaining-volume truth before reporting success.",
  },
  {
    title: "Claim lease and acknowledgement",
    detail:
      "A claimed command now carries a short-lived claim token and expiry timestamp. The EA should acknowledge the claim immediately after taking responsibility so the backend can distinguish an active execution from a dead claim.",
  },
] as const;

export const cfdLifecycleRules = [
  {
    title: "Pair before polling",
    detail:
      "A connector seat should start in `pending` or `unpaired` state. The EA first redeems the pairing code, stores the returned shared-secret auth token locally, and only then begins heartbeat and claim loops.",
  },
  {
    title: "Heartbeat cadence",
    detail:
      "The EA should POST a heartbeat on startup, then on a steady loop every 3 seconds while attached and healthy. If the terminal becomes blocked or trading is disabled, send a heartbeat anyway with `terminalStatus=busy` or `offline` so the operator surface goes stale honestly instead of going silent.",
  },
  {
    title: "Claim behavior",
    detail:
      "The EA should only call the claim endpoint when it is initialized, authenticated, and allowed to trade. A claimed command means the terminal has accepted responsibility for processing it. Commands should be claimed one at a time by default to reduce duplicate execution risk.",
  },
  {
    title: "Acknowledge claimed work",
    detail:
      "After claiming a command, the EA should POST an acknowledgement with the returned claim token before it begins local execution. This lets the backend know the terminal is alive and the claim should not be recycled prematurely.",
  },
  {
    title: "Stale claim recovery",
    detail:
      "If a claim lease expires without acknowledgement or a later execution report, the backend may reset that command to pending and increment its retry count. The EA should treat expired claim tokens as invalid and re-claim the command cleanly if it still appears in the mailbox.",
  },
  {
    title: "Execution report sequence",
    detail:
      "The first execution callback should usually be `accepted` once MT5 has a valid ticket, then `filled` once the order is actually live. If broker-native protections are attached afterward, report `modified`; if Shadow Targets is enabled instead, report `shadow_armed` and later `shadow_triggered` when the hidden stop/target closes the trade. Use `reduced` for a successful partial close and `closed` when the position exits fully. If the broker rejects the command or MT5 cannot submit it, report `rejected` with `errorCode` and `errorMessage`.",
  },
  {
    title: "Duplicate protection",
    detail:
      "The EA must treat `signalId` as idempotent. If the same signal appears again after a claim or execution report has already been sent, the EA should not execute it twice. The backend already uses `signalId`; the EA should mirror that discipline locally.",
  },
  {
    title: "Symbol mapping rule",
    detail:
      "The EA should never guess symbols. It should execute only against the mapped `terminalSymbol` returned through the command contract, so broker suffixes and aliases stay centralized in kwantify rather than being hardcoded across different terminals.",
  },
  {
    title: "Stops and targets interpretation",
    detail:
      "For this first bridge version, `stopMode` and `targetMode` must be honored exactly as sent. If they are `points`, the EA converts points to terminal prices using the mapped symbol. If they are `price`, the EA should send the exact price without reinterpretation.",
  },
  {
    title: "Shadow targets",
    detail:
      "When Shadow Targets is enabled in the EA, the bridge can accept one-package stop/target intent, place the market order, store the intended protection locally, and close the MT5 position when the shadow level is hit. This is separate from broker-native SL/TP attachment and should be surfaced distinctly in operator logs.",
  },
  {
    title: "Error truthfulness",
    detail:
      "If MT5 lacks permission, the market is closed, volume is invalid, symbol mapping is missing, or stops are illegal, the EA should report that exact failure back through `rejected` rather than silently retrying or hiding the problem from the operator surface.",
  },
] as const;

export const cfdEaSetupChecklist = [
  {
    title: "EA Inputs",
    detail:
      "Define `connectorId`, `kwantId`, `authToken`, `apiBaseUrl`, polling interval, and terminal alias as first-class EA inputs so each MT5 seat can be paired and audited independently.",
  },
  {
    title: "Allowed URLs",
    detail:
      "The MT5 host must whitelist the kwantify API base URL before the bridge can pair, heartbeat, claim, or report. Treat missing URL permission as a setup blocker, not a recoverable runtime surprise.",
  },
  {
    title: "Local Idempotency",
    detail:
      "Persist the latest claimed and reported `signalId` values locally inside the EA so duplicate platform deliveries or reclaims never turn into duplicate fills.",
  },
  {
    title: "Symbol Mapping Discipline",
    detail:
      "Execute only the mapped `terminalSymbol` returned by kwantify. Keep broker suffix/prefix translation centralized in the platform rather than duplicating symbol logic per EA build.",
  },
] as const;

export const cfdEaPollingLoop = [
  {
    step: "1",
    title: "Startup + Pair",
    detail:
      "Load EA inputs, verify Algo Trading is enabled, confirm URL whitelist access, then redeem the pairing code once if the seat is still pending or revoked.",
  },
  {
    step: "2",
    title: "Heartbeat",
    detail:
      "Send a heartbeat every 3 seconds with terminal status, chart symbol, EA version, and local pending count so the website has a truthful live view of the seat.",
  },
  {
    step: "3",
    title: "Claim",
    detail:
      "Only when the terminal is ready and not already working a command, poll `/claim` for a single command. Respect `connectorId`, `kwantId`, schema version, and claim token exactly.",
  },
  {
    step: "4",
    title: "Acknowledge",
    detail:
      "Immediately POST `/ack` with the `signalId` and `claimToken` as soon as the EA accepts responsibility. This protects the command from being recycled while the terminal is working it.",
  },
  {
    step: "5",
    title: "Execute Locally",
    detail:
      "Apply the mapped symbol, normalized quantity, action, stop instruction, and target instruction without reinterpretation. If the broker rejects anything, report that exact truth back to kwantify.",
  },
  {
    step: "6",
    title: "Report Lifecycle",
    detail:
      "Return `accepted`, `filled`, `rejected`, and `closed` reports as they happen so the operator journal, dead-letter lane, and retry model stay aligned with terminal truth.",
  },
] as const;

export const cfdEaMql5Guardrails = [
  {
    title: "WebRequest Is Synchronous",
    detail:
      "Design the EA loop so HTTP calls are short, controlled, and one-at-a-time. The bridge should avoid chatty bursts that can block terminal responsiveness.",
  },
  {
    title: "No Silent Retries",
    detail:
      "If a call fails, keep the failure explicit. The platform already owns retry semantics for claims; the EA should not invent hidden retry loops that blur what really happened.",
  },
  {
    title: "Truth Over Optimism",
    detail:
      "If trading is disabled, volume is invalid, the market is closed, or stops are illegal, emit a `rejected` report with the exact terminal/broker reason instead of pretending the command is still in progress.",
  },
  {
    title: "One Active Command Per Seat",
    detail:
      "For the first bridge version, keep each seat single-threaded: one claimed command, one acknowledgement, one execution path. That keeps duplicate fills and state drift much easier to reason about.",
  },
] as const;
