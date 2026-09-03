"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  tradeSyncerCopierStatuses,
  type TradeSyncerDispatchExecutionScenario,
  type TradeSyncerDispatchDryRunResult,
  type TradeSyncerDispatchExecutionSimulationResult,
  type TradeSyncerDispatchStageResult,
  type TradeSyncerTradovateLiveBridgeResult,
  type TradeSyncerVenueDispatchResult,
  tradeSyncerExecutionModes,
  tradeSyncerRiskTypes,
  type TradeSyncerAccountRecord,
  type TradeSyncerDispatchPreview,
  type TradeSyncerSyncGroupRecord,
  type TradeSyncerTemplateRecord,
} from "@/lib/tradeSyncer";
import {
  TradeSyncerField,
  TradeSyncerModal,
  TradeSyncerSelect,
} from "@/components/trade-syncer/TradeSyncerControls";

const masterSetupSections = [
  "General",
  "Risk Settings",
  "SL and TP Settings",
  "Advanced Settings",
  "Trade Filters",
] as const;

const executionScenarioOptions: Array<{
  value: TradeSyncerDispatchExecutionScenario;
  label: string;
  detail: string;
}> = [
  {
    value: "happy_path",
    label: "Happy Path",
    detail: "Clean queue, fill, and protected-open follower state.",
  },
  {
    value: "reject_branch",
    label: "Reject Branch",
    detail: "Force a follower-side venue rejection after queue acceptance.",
  },
  {
    value: "partial_fill_branch",
    label: "Partial Fill",
    detail: "Force a smaller follower fill with imperfect protection state.",
  },
  {
    value: "drift_after_fill",
    label: "Drift After Fill",
    detail: "Force post-fill protection drift so repair tools get exercised.",
  },
];

function actionHref(action: string, groupId: string) {
  return `/trade-syncer/copier-engine?action=${encodeURIComponent(action)}&group=${encodeURIComponent(groupId)}`;
}

function displayGroupStatus(status: TradeSyncerSyncGroupRecord["status"]) {
  return status
    .split("_")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

function displayRepairState(state: TradeSyncerSyncGroupRecord["repairState"]) {
  return state
    .split("_")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

function displayFollowerHealth(state: TradeSyncerSyncGroupRecord["followerRecords"][number]["healthState"]) {
  return state
    .split("_")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

function TradeSyncerCopierEngineWorkspaceContent({
  accounts,
  syncGroups,
  templates,
}: {
  accounts: TradeSyncerAccountRecord[];
  syncGroups: TradeSyncerSyncGroupRecord[];
  templates: TradeSyncerTemplateRecord[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modal = searchParams.get("modal");
  const action = searchParams.get("action");
  const groupId = searchParams.get("group") ?? syncGroups[0]?.id;
  const result = searchParams.get("result");
  const group = syncGroups.find((item) => item.id === groupId) ?? syncGroups[0];
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [showOperatorLab, setShowOperatorLab] = useState(false);
  const [masterSetupSection, setMasterSetupSection] = useState<(typeof masterSetupSections)[number]>(
    "General"
  );
  const [dispatchPreview, setDispatchPreview] = useState<TradeSyncerDispatchPreview | null>(null);
  const [dispatchDryRun, setDispatchDryRun] = useState<TradeSyncerDispatchDryRunResult | null>(null);
  const [dispatchStage, setDispatchStage] = useState<TradeSyncerDispatchStageResult | null>(null);
  const [dispatchExecutionSim, setDispatchExecutionSim] = useState<TradeSyncerDispatchExecutionSimulationResult | null>(null);
  const [venueDispatchSim, setVenueDispatchSim] = useState<TradeSyncerVenueDispatchResult | null>(null);
  const [tradovateLiveBridge, setTradovateLiveBridge] = useState<TradeSyncerTradovateLiveBridgeResult | null>(null);
  const [executionScenario, setExecutionScenario] = useState<TradeSyncerDispatchExecutionScenario>("happy_path");
  const [liveBridgeArmed, setLiveBridgeArmed] = useState(false);
  const [liveBridgePhrase, setLiveBridgePhrase] = useState("");
  const [masterForm, setMasterForm] = useState({
    label: "MNQ Prop Fanout",
    leadAccountId: accounts[0]?.id ?? "",
    status: "Enabled",
    mode: tradeSyncerExecutionModes[0]?.id ?? "exact-order",
  });
  const [slaveForm, setSlaveForm] = useState({
    accountId: accounts.find((account) => account.id !== group?.leadAccountId)?.id ?? "",
    riskType: "Fixed Lot",
    riskSetting: "1.00x",
    templateId: "",
  });
  const [overrideForm, setOverrideForm] = useState({
    followerId: group?.followerRecords[0]?.id ?? "",
    riskType: group?.followerRecords[0]?.riskType ?? "Lot Multiplier",
    riskSetting: group?.followerRecords[0]?.riskSetting ?? "0.75x",
    copyStopLoss: "On",
    copyTakeProfit: "On",
    copyPendingOrders: "Off",
    delayMode: "Immediate",
  });
  const [mappingForm, setMappingForm] = useState({
    leaderSymbol: group?.symbolMappings[0]?.leaderSymbol ?? "MNQ",
    followerSymbol: group?.symbolMappings[0]?.followerSymbol ?? "MNQ",
  });

  const engineMetrics = [
    {
      label: "Portfolio value",
      value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
        accounts.reduce((sum, account) => sum + account.equity, 0)
      ),
      detail: "Across linked groups",
    },
    { label: "Masters", value: String(syncGroups.length), detail: `${syncGroups.filter((item) => item.status === "enabled").length} active lead account${syncGroups.filter((item) => item.status === "enabled").length === 1 ? "" : "s"}` },
    { label: "Slaves", value: String(syncGroups.reduce((total, item) => total + item.followerRecords.length, 0)), detail: "Follower accounts linked" },
    { label: "Open positions", value: String(syncGroups.reduce((total, item) => total + item.openPositions, 0)), detail: "Copied positions live" },
  ];

  const groupRows = syncGroups.map((item) => {
    const lead = accountMap.get(item.leadAccountId);
    const firstFollower = item.followerRecords[0];
    return {
      id: item.id,
      name: item.label,
      lead: lead?.label ?? "Unknown lead",
      riskType: firstFollower?.riskType ?? "No followers yet",
      riskSetting: firstFollower?.riskSetting ?? "-",
      status: displayGroupStatus(item.status),
      hasFollowers: item.followerRecords.length > 0,
    };
  });

  if (!group) {
    return null;
  }

  const followerOptions = group.followerRecords.map((follower) => ({
    followerId: follower.id,
    label: accountMap.get(follower.accountId)?.label ?? follower.accountId,
  }));
  const selectedOverrideFollower =
    group.followerRecords.find((follower) => follower.id === overrideForm.followerId) ?? group.followerRecords[0];
  const selectedOverrideFollowerLabel = selectedOverrideFollower
    ? accountMap.get(selectedOverrideFollower.accountId)?.label ?? selectedOverrideFollower.accountId
    : "";
  const selectedExecutionScenario =
    executionScenarioOptions.find((option) => option.value === executionScenario) ?? executionScenarioOptions[0];

  const handleCreateMaster = () => {
    setSubmitError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/trade-syncer/sync-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: masterForm.label,
            leadAccountId: masterForm.leadAccountId,
            executionModeId: masterForm.mode,
            status:
              masterForm.status === "Enabled"
                ? "enabled"
                : masterForm.status === "Disabled - Monitor Existing"
                  ? "monitor_existing"
                  : "disabled",
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to create Trade Syncer group.");
        }
        router.push(`/trade-syncer/copier-engine?group=${encodeURIComponent(payload.syncGroup.id)}&result=created`);
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to create Trade Syncer group.");
      }
    });
  };

  const handleGroupStatusUpdate = (nextStatus: "enabled" | "monitor_existing" | "disabled") => {
    setSubmitError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/trade-syncer/sync-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: group.id,
            status: nextStatus,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to update Trade Syncer group status.");
        }
        router.push(`/trade-syncer/copier-engine?group=${encodeURIComponent(group.id)}&result=saved`);
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to update Trade Syncer group status.");
      }
    });
  };

  const handleSimulation = (scenario: "fanout_success" | "drift_detected" | "flatten_followers") => {
    setSubmitError(null);
    setSimMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/trade-syncer/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: group.id,
            scenario,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to run Trade Syncer simulation.");
        }
        setSimMessage(payload.logEntry?.detail ?? "Simulation completed.");
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to run Trade Syncer simulation.");
      }
    });
  };

  const handleRepairAction = (action: "pause_group" | "restage_protection" | "flatten_followers" | "mark_healthy") => {
    setSubmitError(null);
    setSimMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/trade-syncer/repair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: group.id,
            action,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to run Trade Syncer repair action.");
        }
        setSimMessage(payload.logEntry?.detail ?? "Repair action completed.");
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to run Trade Syncer repair action.");
      }
    });
  };

  const handleFollowerRepairAction = (
    followerId: string,
    action:
      | "pause_follower"
      | "restage_follower_protection"
      | "flatten_follower"
      | "mark_follower_healthy"
  ) => {
    setSubmitError(null);
    setSimMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/trade-syncer/follower-repair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: group.id,
            followerId,
            action,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to run follower repair action.");
        }
        setSimMessage(payload.logEntry?.detail ?? "Follower repair action completed.");
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to run follower repair action.");
      }
    });
  };

  const handleAddFollower = () => {
    setSubmitError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/trade-syncer/followers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: group.id,
            accountId: slaveForm.accountId,
            riskType: slaveForm.riskType,
            riskSetting: slaveForm.riskSetting,
            templateId: slaveForm.templateId || null,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to add follower.");
        }
        router.push(`/trade-syncer/copier-engine?group=${encodeURIComponent(group.id)}&result=saved`);
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to add follower.");
      }
    });
  };

  const handleDispatchPreview = () => {
    setSubmitError(null);
    setSimMessage(null);
    startTransition(async () => {
      try {
        const sourceSymbol = group.symbolMappings[0]?.leaderSymbol ?? "MNQ";
        const response = await fetch("/api/trade-syncer/dispatch-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceEvent: {
              groupId: group.id,
              symbol: sourceSymbol,
              side: "buy",
              quantity: 1,
              orderType: "market",
              tif: "day",
              limitPrice: null,
              stopPrice: null,
              stopLossTicks: 20,
              takeProfitTicks: 40,
              source: "dispatch_preview",
              triggeredAt: new Date().toISOString(),
            },
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to build Trade Syncer dispatch preview.");
        }
        setDispatchPreview(payload.preview ?? null);
        setSimMessage("Dispatch preview refreshed from the current Trade Syncer group and futures connector bindings.");
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to build Trade Syncer dispatch preview.");
      }
    });
  };

  const handleDispatchDryRun = () => {
    setSubmitError(null);
    setSimMessage(null);
    startTransition(async () => {
      try {
        const sourceSymbol = group.symbolMappings[0]?.leaderSymbol ?? "MNQ";
        const response = await fetch("/api/trade-syncer/dispatch-dry-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceEvent: {
              groupId: group.id,
              symbol: sourceSymbol,
              side: "buy",
              quantity: 1,
              orderType: "market",
              tif: "day",
              limitPrice: null,
              stopPrice: null,
              stopLossTicks: 20,
              takeProfitTicks: 40,
              source: "dispatch_preview",
              triggeredAt: new Date().toISOString(),
            },
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to run Trade Syncer dispatch dry run.");
        }
        setDispatchDryRun(payload.result ?? null);
        setSimMessage("Dispatch dry run handed the current follower intents into the futures connector preview/staging seam.");
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to run Trade Syncer dispatch dry run.");
      }
    });
  };

  const handleDispatchStage = () => {
    setSubmitError(null);
    setSimMessage(null);
    startTransition(async () => {
      try {
        const sourceSymbol = group.symbolMappings[0]?.leaderSymbol ?? "MNQ";
        const response = await fetch("/api/trade-syncer/dispatch-stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceEvent: {
              groupId: group.id,
              symbol: sourceSymbol,
              side: "buy",
              quantity: 1,
              orderType: "market",
              tif: "day",
              limitPrice: null,
              stopPrice: null,
              stopLossTicks: 20,
              takeProfitTicks: 40,
              source: "dispatch_preview",
              triggeredAt: new Date().toISOString(),
            },
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to stage Trade Syncer copied-order handoff.");
        }
        setDispatchStage(payload.result ?? null);
        setSimMessage("Copied-order staging handed ready followers into the futures connector inbox without placing live broker orders.");
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to stage Trade Syncer copied-order handoff.");
      }
    });
  };

  const handleDispatchExecutionSimulation = () => {
    setSubmitError(null);
    setSimMessage(null);
    startTransition(async () => {
      try {
        const sourceSymbol = group.symbolMappings[0]?.leaderSymbol ?? "MNQ";
        const response = await fetch("/api/trade-syncer/dispatch-execution-sim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceEvent: {
              groupId: group.id,
              symbol: sourceSymbol,
              side: "buy",
              quantity: 1,
              orderType: "market",
              tif: "day",
              limitPrice: null,
              stopPrice: null,
              stopLossTicks: 20,
              takeProfitTicks: 40,
              source: "simulated_master_fill",
              triggeredAt: new Date().toISOString(),
            },
            scenario: executionScenario,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to run copied-order execution simulation.");
        }
        setDispatchExecutionSim(payload.result ?? null);
        setSimMessage(`${selectedExecutionScenario.label} simulation ran through the copied-order path so we can inspect follower behavior without live broker risk.`);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to run copied-order execution simulation.");
      }
    });
  };

  const handleVenueDispatchSimulation = () => {
    setSubmitError(null);
    setSimMessage(null);
    startTransition(async () => {
      try {
        const sourceSymbol = group.symbolMappings[0]?.leaderSymbol ?? "MNQ";
        const response = await fetch("/api/trade-syncer/dispatch-venue-sim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceEvent: {
              groupId: group.id,
              symbol: sourceSymbol,
              side: "buy",
              quantity: 1,
              orderType: "market",
              tif: "day",
              limitPrice: null,
              stopPrice: null,
              stopLossTicks: 20,
              takeProfitTicks: 40,
              source: "simulated_master_fill",
              triggeredAt: new Date().toISOString(),
            },
            scenario: executionScenario,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to run venue-specific dispatch simulation.");
        }
        setVenueDispatchSim(payload.result ?? null);
        setSimMessage(
          `${selectedExecutionScenario.label} venue simulation ran through the Tradovate/Rithmic handoff seams without touching live broker money.`
        );
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to run venue-specific dispatch simulation.");
      }
    });
  };

  const handleTradovateLiveBridge = () => {
    setSubmitError(null);
    setSimMessage(null);
    startTransition(async () => {
      try {
        const sourceSymbol = group.symbolMappings[0]?.leaderSymbol ?? "MNQ";
        const response = await fetch("/api/trade-syncer/dispatch-tradovate-live-bridge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            liveApproved: liveBridgeArmed,
            confirmationPhrase: liveBridgePhrase.trim(),
            sourceEvent: {
              groupId: group.id,
              symbol: sourceSymbol,
              side: "buy",
              quantity: 1,
              orderType: "market",
              tif: "day",
              limitPrice: null,
              stopPrice: null,
              stopLossTicks: 20,
              takeProfitTicks: 40,
              source: "trade_syncer_live_bridge",
              triggeredAt: new Date().toISOString(),
            },
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to run the Tradovate live bridge.");
        }
        setTradovateLiveBridge(payload.result ?? null);
        setSimMessage(
          "Tradovate live bridge reused the real broker submit seam for ready Tradovate followers. Review the bridge result before trusting live copied execution at scale."
        );
        setLiveBridgeArmed(false);
        setLiveBridgePhrase("");
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to run the Tradovate live bridge.");
      }
    });
  };

  const handleOverrideSave = () => {
    setSubmitError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/trade-syncer/followers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: group.id,
            followerId: overrideForm.followerId,
            riskType: overrideForm.riskType,
            riskSetting: overrideForm.riskSetting,
            copyStopLoss: overrideForm.copyStopLoss === "On",
            copyTakeProfit: overrideForm.copyTakeProfit === "On",
            copyPendingOrders: overrideForm.copyPendingOrders === "On",
            delayMode:
              overrideForm.delayMode === "Immediate"
                ? "immediate"
                : overrideForm.delayMode === "Fixed Delay"
                  ? "fixed_delay"
                  : "random_delay",
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to save follower override.");
        }
        router.push(`/trade-syncer/copier-engine?group=${encodeURIComponent(group.id)}&result=saved`);
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to save follower override.");
      }
    });
  };

  const handleSymbolMappingSave = () => {
    setSubmitError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/trade-syncer/symbol-mappings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: group.id,
            leaderSymbol: mappingForm.leaderSymbol,
            followerSymbol: mappingForm.followerSymbol,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to save symbol mapping.");
        }
        router.push(`/trade-syncer/copier-engine?group=${encodeURIComponent(group.id)}&result=saved`);
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to save symbol mapping.");
      }
    });
  };

  const handleDeleteGroup = () => {
    setSubmitError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/trade-syncer/sync-groups?groupId=${encodeURIComponent(group.id)}`, {
          method: "DELETE",
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to delete sync group.");
        }
        router.push("/trade-syncer/copier-engine");
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to delete sync group.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-border bg-panel px-6 py-6">
        <div>
          <div className="text-[24px] font-semibold tracking-tight text-foreground">Copier Engine</div>
          <div className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            Manage master and follower groups, pause copy behavior, and inspect the sizing logic that sits behind each sync relationship.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/trade-syncer/copier-logs"
            className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
          >
            Copier Alerts
          </Link>
          <div className="rounded-xl border border-border bg-background/40 px-3.5 py-2 text-[12px] text-muted">
            Lead/follower groups and copy actions
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {engineMetrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border bg-panel px-5 py-4">
            <div className="text-[12px] text-muted">{metric.label}</div>
            <div className="mt-4 text-[18px] font-semibold text-foreground">{metric.value}</div>
            <div className="mt-2 text-[12px] text-muted">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-border bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <div className="text-[18px] font-semibold text-foreground">Trade Copiers</div>
            <div className="mt-1 text-[12px] text-muted">Lead/follower groups with the core copy settings visible in one scan.</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOperatorLab((current) => !current)}
              className="rounded-xl border border-border bg-background/40 px-3.5 py-2 text-[12px] text-muted transition-colors hover:border-primary/30 hover:text-primary"
            >
              {showOperatorLab ? "Hide Operator Lab" : "Show Operator Lab"}
            </button>
            <Link
              href="/trade-syncer/copier-engine?modal=new-master"
              className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-on-primary"
            >
              Add Master Copier
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto px-6 py-4">
          <table className="min-w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
              <tr className="border-b border-border">
                {["Account Name", "Copy From", "Risk Type", "Risk Setting", "Status", "Actions"].map((head) => (
                  <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupRows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="py-4 pr-4 font-medium text-foreground">{row.name}</td>
                  <td className="py-4 pr-4 text-muted">{row.lead}</td>
                  <td className="py-4 pr-4 text-muted">{row.riskType}</td>
                  <td className="py-4 pr-4 text-muted">{row.riskSetting}</td>
                  <td className="py-4 pr-4">
                    <Link
                      href={actionHref("Status", row.id)}
                      className="inline-flex rounded-full border border-border bg-background/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted transition-colors hover:border-primary/30 hover:text-primary"
                    >
                      {row.status}
                    </Link>
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      {(row.hasFollowers
                        ? ["Edit", "Symbol Mapping", "Override", "Pause", "Time", "Delete"]
                        : ["Add Slave", "Pause", "Delete"]
                      ).map((item) => (
                        <Link
                          key={`${row.id}-${item}`}
                          href={actionHref(item, row.id)}
                          className="rounded-xl border border-border bg-background/40 px-3 py-1.5 text-[12px] text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                        >
                          {item}
                        </Link>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showOperatorLab ? (
      <>
      <section className="rounded-3xl border border-border bg-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[18px] font-semibold text-foreground">Advanced Dispatch Lab</div>
            <div className="mt-1 text-[12px] text-muted">
              Translate one simulated master event into follower-specific Tradovate or Rithmic dispatch intents before we trust live copy routing.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDispatchPreview}
              disabled={isPending}
              className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-[13px] font-semibold text-primary disabled:opacity-60"
            >
              {isPending ? "Building..." : "Build Dispatch Preview"}
            </button>
            <button
              type="button"
              onClick={handleDispatchDryRun}
              disabled={isPending}
              className="rounded-xl border border-border bg-background/40 px-4 py-2.5 text-[13px] font-semibold text-foreground disabled:opacity-60"
            >
              {isPending ? "Running..." : "Run Dry-Run Handoff"}
            </button>
            <button
              type="button"
              onClick={handleDispatchStage}
              disabled={isPending}
              className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-[13px] font-semibold text-primary disabled:opacity-60"
            >
              {isPending ? "Staging..." : "Stage Copied Orders"}
            </button>
            <div className="min-w-[220px]">
              <TradeSyncerSelect
                label="Execution Scenario"
                options={executionScenarioOptions.map((option) => option.label)}
                value={selectedExecutionScenario.label}
                onChange={(next) => {
                  const matched = executionScenarioOptions.find((option) => option.label === next);
                  if (matched) {
                    setExecutionScenario(matched.value);
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleDispatchExecutionSimulation}
              disabled={isPending}
              className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-on-primary disabled:opacity-60"
            >
              {isPending ? "Simulating..." : "Simulate Copied Execution"}
            </button>
            <button
              type="button"
              onClick={handleVenueDispatchSimulation}
              disabled={isPending}
              className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-[13px] font-semibold text-primary disabled:opacity-60"
            >
              {isPending ? "Routing..." : "Run Venue Dispatch"}
            </button>
            <button
              type="button"
              onClick={handleTradovateLiveBridge}
              disabled={isPending || !liveBridgeArmed || liveBridgePhrase.trim() !== "BRIDGE TRADOVATE LIVE"}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-[13px] font-semibold text-emerald-300 disabled:opacity-60"
            >
              {isPending ? "Bridging..." : "Bridge Tradovate Live"}
            </button>
          </div>
        </div>
        <div className="mt-3 text-[12px] leading-5 text-muted">
          <span className="font-medium text-foreground">{selectedExecutionScenario.label}:</span>{" "}
          {selectedExecutionScenario.detail}
        </div>

        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="text-[13px] font-semibold text-foreground">Tradovate live bridge safety gate</div>
          <div className="mt-1 text-[12px] leading-5 text-muted">
            This bridge can hit the real Tradovate broker seam for ready followers. Arm it deliberately and type
            <span className="mx-1 font-semibold text-foreground">BRIDGE TRADOVATE LIVE</span>
            before the live bridge button unlocks.
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[auto,1fr] md:items-end">
            <label className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2 text-[12px] text-foreground">
              <input
                type="checkbox"
                checked={liveBridgeArmed}
                onChange={(event) => setLiveBridgeArmed(event.target.checked)}
                className="h-4 w-4 rounded border-border bg-background"
              />
              Arm live bridge
            </label>
            <TradeSyncerField
              label="Confirmation Phrase"
              value={liveBridgePhrase}
              onChange={setLiveBridgePhrase}
              placeholder="BRIDGE TRADOVATE LIVE"
            />
          </div>
        </div>

        {dispatchPreview ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Source</div>
                <div className="mt-2 text-[16px] font-semibold text-foreground">
                  {dispatchPreview.sourceEvent.side.toUpperCase()} {dispatchPreview.sourceEvent.symbol}
                </div>
                <div className="mt-1 text-[12px] text-muted">
                  {dispatchPreview.sourceEvent.quantity} contract · {dispatchPreview.sourceEvent.orderType} · {dispatchPreview.sourceEvent.tif.toUpperCase()}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Ready</div>
                <div className="mt-2 text-[16px] font-semibold text-foreground">{dispatchPreview.readyFollowers}</div>
                <div className="mt-1 text-[12px] text-muted">Followers ready for broker translation</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Review</div>
                <div className="mt-2 text-[16px] font-semibold text-foreground">{dispatchPreview.reviewFollowers}</div>
                <div className="mt-1 text-[12px] text-muted">Followers needing review before dispatch</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Blocked</div>
                <div className="mt-2 text-[16px] font-semibold text-foreground">{dispatchPreview.blockedFollowers}</div>
                <div className="mt-1 text-[12px] text-muted">Followers blocked by state, mapping, or binding gaps</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  <tr className="border-b border-border">
                    {["Follower", "Readiness", "Venue / Route", "Symbol / Qty", "Policy", "Reason"].map((head) => (
                      <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dispatchPreview.intents.map((intent) => (
                    <tr key={intent.followerId} className="border-b border-border/60 last:border-0">
                      <td className="py-4 pr-4">
                        <div className="font-medium text-foreground">{intent.followerLabel}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.brokerAccountRef}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.readiness}</div>
                        <div className="mt-1 text-[12px] text-muted">
                          {intent.groupStatus} / {intent.followerStatus} / {intent.healthState}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.venue}</div>
                        <div className="mt-1 text-[12px] text-muted">
                          {intent.routeLabel ?? "No route"}{intent.managedAccountLabel ? ` · ${intent.managedAccountLabel}` : ""}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">
                          {intent.followerSymbol ?? "No map"} / {intent.requestedQuantity ?? "-"}
                        </div>
                        <div className="mt-1 text-[12px] text-muted">{intent.quantityDetail}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">
                          SL {intent.copyStopLoss ? "On" : "Off"} · TP {intent.copyTakeProfit ? "On" : "Off"}
                        </div>
                        <div className="mt-1 text-[12px] text-muted">
                          Pending {intent.copyPendingOrders ? "On" : "Off"} · {intent.executionModeId}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-foreground">{intent.readinessReason}</div>
                        {intent.warnings.length ? (
                          <div className="mt-2 space-y-1 text-[12px] text-muted">
                            {intent.warnings.map((warning) => (
                              <div key={warning}>{warning}</div>
                            ))}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4 text-[13px] leading-6 text-muted">
            Build a preview to see which followers can already translate into broker-specific dispatch payloads and which ones still need binding, repair, or symbol-map work.
          </div>
        )}

        {dispatchDryRun ? (
          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold text-foreground">Dry-Run Handoff Result</div>
                <div className="mt-1 text-[12px] text-muted">
                  Ready followers are now handed into the futures connector preview/staging seam without placing live orders.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px] md:grid-cols-4">
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Staged</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchDryRun.stagedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Review</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchDryRun.reviewFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Blocked</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchDryRun.blockedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Failed</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchDryRun.failedFollowers}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  <tr className="border-b border-border">
                    {["Follower", "Dry-Run State", "Venue / Route", "Signal", "Connector Detail"].map((head) => (
                      <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dispatchDryRun.intents.map((intent) => (
                    <tr key={`dryrun-${intent.followerId}`} className="border-b border-border/60 last:border-0">
                      <td className="py-4 pr-4">
                        <div className="font-medium text-foreground">{intent.followerLabel}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.managedAccountLabel ?? "No managed lane"}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.dryRunState}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.dryRunReason}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.venue}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.routeLabel ?? "No route"}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.signalId ?? "Not built"}</div>
                        <div className="mt-1 text-[12px] text-muted">
                          {intent.warnings.length ? `${intent.warnings.length} connector note${intent.warnings.length === 1 ? "" : "s"}` : "No extra warnings"}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-[12px] leading-6 text-muted">
                          {intent.responseBody ? JSON.stringify(intent.responseBody) : "No connector response payload."}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {dispatchStage ? (
          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold text-foreground">Copied-Order Stage Result</div>
                <div className="mt-1 text-[12px] text-muted">
                  Ready followers are now queued into the managed futures inbox without placing live broker orders.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px] md:grid-cols-5">
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Queued</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchStage.queuedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Ready</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchStage.readyFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Review</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchStage.reviewFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Blocked</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchStage.blockedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Failed</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchStage.failedFollowers}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  <tr className="border-b border-border">
                    {["Follower", "Stage State", "Venue / Route", "Signal", "Connector Detail"].map((head) => (
                      <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dispatchStage.intents.map((intent) => (
                    <tr key={`stage-${intent.followerId}`} className="border-b border-border/60 last:border-0">
                      <td className="py-4 pr-4">
                        <div className="font-medium text-foreground">{intent.followerLabel}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.managedAccountLabel ?? "No managed lane"}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.stageState}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.stageReason}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.venue}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.routeLabel ?? "No route"}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.signalId ?? "Not built"}</div>
                        <div className="mt-1 text-[12px] text-muted">
                          {intent.warnings.length ? `${intent.warnings.length} connector note${intent.warnings.length === 1 ? "" : "s"}` : "No extra warnings"}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-[12px] leading-6 text-muted">
                          {intent.responseBody ? JSON.stringify(intent.responseBody) : "No connector queue response payload."}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {dispatchExecutionSim ? (
          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold text-foreground">Copied-Order Execution Simulation</div>
                <div className="mt-1 text-[12px] text-muted">
                  This runs the copied-order branch engine, not just the clean fill case. Use it to pressure-test follower failures before any live routing trust.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px] md:grid-cols-6">
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Queued</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchExecutionSim.queuedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Protected</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchExecutionSim.protectedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Filled</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchExecutionSim.filledFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Partial</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchExecutionSim.partialFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Drifted</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchExecutionSim.driftedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Rejected</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchExecutionSim.rejectedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Skipped</div>
                  <div className="mt-1 font-semibold text-foreground">{dispatchExecutionSim.skippedFollowers}</div>
                </div>
              </div>
            </div>
            <div className="mt-3 text-[12px] leading-5 text-muted">
              <span className="font-medium text-foreground">Scenario:</span>{" "}
              {executionScenarioOptions.find((option) => option.value === dispatchExecutionSim.scenario)?.label ?? dispatchExecutionSim.scenario}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  <tr className="border-b border-border">
                    {["Follower", "Final State", "Venue / Route", "Signal / Command", "Lifecycle", "State Detail"].map((head) => (
                      <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dispatchExecutionSim.intents.map((intent) => (
                    <tr key={`exec-sim-${intent.followerId}`} className="border-b border-border/60 last:border-0">
                      <td className="py-4 pr-4">
                        <div className="font-medium text-foreground">{intent.followerLabel}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.managedAccountLabel ?? "No managed lane"}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.finalState}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.finalReason}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.venue}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.routeLabel ?? "No route"}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.signalId ?? "Not built"}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.commandId ?? "No queued command"}</div>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-2 text-[12px] text-muted">
                          {intent.executionPath.map((step) => (
                            <span key={`${intent.followerId}-${step}`} className="rounded-full border border-border px-2.5 py-1">
                              {step}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-[12px] leading-6 text-muted">
                          Qty {intent.simulatedQuantity ?? 0} · Protection {intent.simulatedProtectionState ?? "n/a"} · Health {intent.simulatedHealthState ?? "n/a"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {venueDispatchSim ? (
          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold text-foreground">Venue Dispatch Simulation</div>
                <div className="mt-1 text-[12px] text-muted">
                  This is the first venue-specific non-live handoff. Tradovate runs through its order preview contract and Rithmic runs through its adapter and reconciliation chain.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px] md:grid-cols-6">
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Accepted</div>
                  <div className="mt-1 font-semibold text-foreground">{venueDispatchSim.acceptedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Rejected</div>
                  <div className="mt-1 font-semibold text-foreground">{venueDispatchSim.rejectedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Partial</div>
                  <div className="mt-1 font-semibold text-foreground">{venueDispatchSim.partialFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Drift Review</div>
                  <div className="mt-1 font-semibold text-foreground">{venueDispatchSim.driftReviewFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Review</div>
                  <div className="mt-1 font-semibold text-foreground">{venueDispatchSim.reviewFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Failed / Blocked</div>
                  <div className="mt-1 font-semibold text-foreground">{venueDispatchSim.failedFollowers + venueDispatchSim.blockedFollowers}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  <tr className="border-b border-border">
                    {["Follower", "Venue Result", "Route / Lane", "Broker State", "Reconciliation", "Response"].map((head) => (
                      <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {venueDispatchSim.intents.map((intent) => (
                    <tr key={`venue-${intent.followerId}`} className="border-b border-border/60 last:border-0">
                      <td className="py-4 pr-4">
                        <div className="font-medium text-foreground">{intent.followerLabel}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.signalId ?? "No signal built"}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.dispatchState}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.dispatchReason}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.venue}</div>
                        <div className="mt-1 text-[12px] text-muted">
                          {intent.routeLabel ?? "No route"}{intent.managedAccountLabel ? ` · ${intent.managedAccountLabel}` : ""}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.venueOrderState ?? "n/a"}</div>
                        <div className="mt-1 text-[12px] text-muted">
                          {intent.warnings.length ? `${intent.warnings.length} warning${intent.warnings.length === 1 ? "" : "s"}` : "No extra warnings"}
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-muted">{intent.venueReconciliationState ?? "n/a"}</td>
                      <td className="py-4">
                        <div className="max-w-[380px] text-[12px] leading-6 text-muted">
                          {intent.responseBody ? JSON.stringify(intent.responseBody) : "No venue response payload."}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tradovateLiveBridge ? (
          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold text-foreground">Tradovate Live Bridge</div>
                <div className="mt-1 text-[12px] text-muted">
                  This is the first execution-safe live handoff. Ready Tradovate followers reuse the real submit contract instead of staying in simulation only.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px] md:grid-cols-6">
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Submitted</div>
                  <div className="mt-1 font-semibold text-foreground">{tradovateLiveBridge.submittedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Rejected</div>
                  <div className="mt-1 font-semibold text-foreground">{tradovateLiveBridge.rejectedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Review</div>
                  <div className="mt-1 font-semibold text-foreground">{tradovateLiveBridge.reviewFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Blocked</div>
                  <div className="mt-1 font-semibold text-foreground">{tradovateLiveBridge.blockedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Failed</div>
                  <div className="mt-1 font-semibold text-foreground">{tradovateLiveBridge.failedFollowers}</div>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <div className="text-muted">Skipped</div>
                  <div className="mt-1 font-semibold text-foreground">{tradovateLiveBridge.skippedFollowers}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  <tr className="border-b border-border">
                    {["Follower", "Bridge Result", "Route / Lane", "Broker State", "Reconciliation", "Response"].map((head) => (
                      <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tradovateLiveBridge.intents.map((intent) => (
                    <tr key={`tradovate-bridge-${intent.followerId}`} className="border-b border-border/60 last:border-0">
                      <td className="py-4 pr-4">
                        <div className="font-medium text-foreground">{intent.followerLabel}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.signalId ?? "No signal built"}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.bridgeState}</div>
                        <div className="mt-1 text-[12px] text-muted">{intent.bridgeReason}</div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.venue}</div>
                        <div className="mt-1 text-[12px] text-muted">
                          {intent.routeLabel ?? "No route"}{intent.managedAccountLabel ? ` · ${intent.managedAccountLabel}` : ""}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="text-foreground">{intent.venueOrderState ?? "n/a"}</div>
                        <div className="mt-1 text-[12px] text-muted">
                          {intent.warnings.length ? `${intent.warnings.length} warning${intent.warnings.length === 1 ? "" : "s"}` : "No extra warnings"}
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-muted">{intent.venueReconciliationState ?? "n/a"}</td>
                      <td className="py-4">
                        <div className="max-w-[380px] text-[12px] leading-6 text-muted">
                          {intent.responseBody ? JSON.stringify(intent.responseBody) : "No live bridge response payload."}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-3xl border border-border bg-panel p-6">
          <div className="text-[18px] font-semibold text-foreground">Execution Modes</div>
          <div className="mt-4 space-y-3">
            {tradeSyncerExecutionModes.map((mode) => (
              <div key={mode.id} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="font-medium text-foreground">{mode.title}</div>
                <div className="mt-1 text-[12px] leading-5 text-muted">{mode.summary}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-panel p-6">
          <div className="text-[18px] font-semibold text-foreground">Status Logic</div>
          <div className="mt-4 space-y-3">
            {tradeSyncerCopierStatuses.map((status) => (
              <div key={status.title} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="font-medium text-foreground">{status.title}</div>
                <div className="mt-1 text-[12px] leading-5 text-muted">{status.operatorMeaning}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-panel p-6">
          <div className="text-[18px] font-semibold text-foreground">Sizing Modes</div>
          <div className="mt-4 space-y-3">
            {tradeSyncerRiskTypes.slice(0, 3).map((risk) => (
              <div key={risk.title} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="font-medium text-foreground">{risk.title}</div>
                <div className="mt-1 text-[12px] leading-5 text-muted">{risk.useCase}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
      </>
      ) : null}

      {showOperatorLab ? (
      <>
      <section className="rounded-3xl border border-border bg-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-semibold text-foreground">Simulation and Repair Control</div>
            <div className="mt-1 text-[12px] text-muted">Run follower fanout, drift, flatten, and repair actions against the selected group before we touch live broker dispatch.</div>
          </div>
          <div className="text-[12px] text-muted">{group.label}</div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-border bg-background/40 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Status</div>
            <div className="mt-2 text-[14px] font-medium text-foreground">{displayGroupStatus(group.status)}</div>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Repair State</div>
            <div className="mt-2 text-[14px] font-medium text-foreground">{displayRepairState(group.repairState)}</div>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Open Positions</div>
            <div className="mt-2 text-[14px] font-medium text-foreground">{group.openPositions}</div>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Median Lag</div>
            <div className="mt-2 text-[14px] font-medium text-foreground">{group.medianCopyLagMs}ms</div>
          </div>
        </div>
        {submitError ? (
          <div className="mt-4 rounded-2xl border border-danger/20 bg-danger/5 p-4 text-[13px] leading-6 text-danger">
            {submitError}
          </div>
        ) : null}
        {simMessage ? (
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-primary">
            {simMessage}
          </div>
        ) : null}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <button type="button" onClick={() => handleSimulation("fanout_success")} disabled={isPending} className="rounded-xl border border-border bg-background/40 px-4 py-3 text-[13px] text-foreground disabled:opacity-60">
            Simulate Fanout
          </button>
          <button type="button" onClick={() => handleSimulation("drift_detected")} disabled={isPending} className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-[13px] text-warning disabled:opacity-60">
            Simulate Drift
          </button>
          <button type="button" onClick={() => handleSimulation("flatten_followers")} disabled={isPending} className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger disabled:opacity-60">
            Flatten Followers
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <button type="button" onClick={() => handleRepairAction("pause_group")} disabled={isPending} className="rounded-xl border border-border bg-background/40 px-4 py-3 text-[13px] text-foreground disabled:opacity-60">
            Pause Group
          </button>
          <button type="button" onClick={() => handleRepairAction("restage_protection")} disabled={isPending} className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[13px] text-primary disabled:opacity-60">
            Restage Protection
          </button>
          <button type="button" onClick={() => handleRepairAction("mark_healthy")} disabled={isPending} className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[13px] text-primary disabled:opacity-60">
            Mark Healthy
          </button>
          <button type="button" onClick={() => handleRepairAction("flatten_followers")} disabled={isPending} className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger disabled:opacity-60">
            Flatten and Hold
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-border bg-panel">
          <div className="border-b border-border px-6 py-5">
            <div className="text-[18px] font-semibold text-foreground">Follower Drift Detail</div>
            <div className="mt-1 text-[12px] text-muted">
              We now track follower health, active drift reason, and the last repair attempt per slave account.
            </div>
          </div>
          <div className="overflow-x-auto px-6 py-4">
            <table className="min-w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
                <tr className="border-b border-border">
                {["Follower", "Health", "Position", "Protection", "Current Drift", "Last Repair", "Actions"].map((head) => (
                    <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.followerRecords.map((follower) => {
                  const account = accountMap.get(follower.accountId);
                  const lastRepair = follower.repairHistory[0];
                  return (
                    <tr key={follower.id} className="border-b border-border/60 last:border-0">
                      <td className="py-4 pr-4 font-medium text-foreground">{account?.label ?? follower.accountId}</td>
                      <td className="py-4 pr-4">
                        <span className="inline-flex rounded-full border border-border bg-background/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                          {displayFollowerHealth(follower.healthState)}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-muted">
                        <div className="text-foreground">
                          {follower.positionSnapshot.side === "flat"
                            ? "Flat"
                            : `${follower.positionSnapshot.side} ${follower.positionSnapshot.quantity}`}
                        </div>
                        <div className="mt-1 text-[12px] text-muted">
                          {follower.positionSnapshot.symbol} / {follower.positionSnapshot.state}
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-muted">
                        <div className="text-foreground">{follower.protectionSnapshot.state}</div>
                        <div className="mt-1 text-[12px] text-muted">
                          SL {follower.protectionSnapshot.stopLossState} | TP {follower.protectionSnapshot.takeProfitState} | {follower.protectionSnapshot.workingLegCount} leg{follower.protectionSnapshot.workingLegCount === 1 ? "" : "s"}
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-muted">
                        {follower.currentDrift ?? `${follower.riskType} / ${follower.riskSetting}`}
                      </td>
                      <td className="py-4 text-muted">
                        {lastRepair ? (
                          <>
                            <div className="text-foreground">{lastRepair.action}</div>
                            <div className="mt-1 text-[12px] text-muted">{lastRepair.detail}</div>
                          </>
                        ) : (
                          "No repair history yet"
                        )}
                      </td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleFollowerRepairAction(follower.id, "pause_follower")}
                            disabled={isPending}
                            className="rounded-xl border border-border bg-background/40 px-3 py-1.5 text-[12px] text-foreground disabled:opacity-60"
                          >
                            Pause
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFollowerRepairAction(follower.id, "restage_follower_protection")}
                            disabled={isPending}
                            className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-[12px] text-primary disabled:opacity-60"
                          >
                            Restage
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFollowerRepairAction(follower.id, "mark_follower_healthy")}
                            disabled={isPending}
                            className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-[12px] text-primary disabled:opacity-60"
                          >
                            Healthy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFollowerRepairAction(follower.id, "flatten_follower")}
                            disabled={isPending}
                            className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-1.5 text-[12px] text-danger disabled:opacity-60"
                          >
                            Flatten
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-panel p-6">
          <div className="text-[18px] font-semibold text-foreground">Repair Timeline</div>
          <div className="mt-1 text-[12px] text-muted">
            Latest follower repair events for the selected group, newest first.
          </div>
          <div className="mt-5 space-y-3">
            {group.followerRecords
              .flatMap((follower) =>
                follower.repairHistory.map((entry) => ({
                  followerId: follower.id,
                  followerLabel: accountMap.get(follower.accountId)?.label ?? follower.accountId,
                  entry,
                }))
              )
              .sort((left, right) => Date.parse(right.entry.occurredAt) - Date.parse(left.entry.occurredAt))
              .slice(0, 8)
              .map(({ followerId, followerLabel, entry }) => (
                <div key={`${followerId}-${entry.id}`} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-foreground">{entry.action}</div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted">{entry.outcome}</div>
                  </div>
                  <div className="mt-2 text-[12px] text-muted">{followerLabel}</div>
                  <div className="mt-2 text-[13px] leading-6 text-muted">{entry.detail}</div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted">{entry.occurredAt}</div>
                </div>
              ))}
          </div>
        </div>
      </section>
      </>
      ) : null}

      {modal === "new-master" ? (
        <TradeSyncerModal
          title="Add Master Copier"
          description="Create the lead copier first, then attach follower accounts and templates underneath it."
          onClose={() => router.push("/trade-syncer/copier-engine")}
        >
          {submitError ? (
            <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/5 p-4 text-[13px] leading-6 text-danger">
              {submitError}
            </div>
          ) : null}
          {result ? (
            <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-primary">
              {result === "tested"
                ? "Group validation complete. The lead account, default mode, and status look ready for followers."
                : "Master copier created in draft form. Next step is to add slaves and apply a template."}
            </div>
          ) : null}
          <div className="mb-5 inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background/40 p-1">
            {masterSetupSections.map((section) => {
              const active = masterSetupSection === section;
              return (
                <button
                  key={section}
                  type="button"
                  onClick={() => setMasterSetupSection(section)}
                  className={`rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
                  }`}
                >
                  {section}
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {masterSetupSection === "General" ? (
              <>
                <TradeSyncerSelect label="Template" options={["None", ...templates.map((template) => template.label)]} value="None" />
                <TradeSyncerSelect label="Copy From Account" options={accounts.map((account) => account.label)} value={accountMap.get(masterForm.leadAccountId)?.label ?? accounts[0]?.label ?? ""} onChange={(next) => {
                  const matched = accounts.find((account) => account.label === next);
                  setMasterForm((current) => ({ ...current, leadAccountId: matched?.id ?? current.leadAccountId }));
                }} />
                <TradeSyncerField label="Master Name" placeholder="MNQ Prop Fanout" value={masterForm.label} onChange={(next) => setMasterForm((current) => ({ ...current, label: next }))} />
                <TradeSyncerSelect label="Copy To Account" options={["Attach followers after save"]} value="Attach followers after save" />
              </>
            ) : masterSetupSection === "Risk Settings" ? (
              <>
                <TradeSyncerSelect label="Default Mode" options={tradeSyncerExecutionModes.map((mode) => mode.title)} value={tradeSyncerExecutionModes.find((mode) => mode.id === masterForm.mode)?.title ?? tradeSyncerExecutionModes[0]?.title ?? ""} onChange={(next) => {
                  const matched = tradeSyncerExecutionModes.find((mode) => mode.title === next);
                  setMasterForm((current) => ({ ...current, mode: matched?.id ?? current.mode }));
                }} />
                <TradeSyncerSelect label="Status" options={["Enabled", "Disabled - Monitor Existing", "Disabled"]} value={masterForm.status} onChange={(next) => setMasterForm((current) => ({ ...current, status: next }))} />
                <TradeSyncerSelect label="Default Risk Type" options={tradeSyncerRiskTypes.map((risk) => risk.title)} value={tradeSyncerRiskTypes[0]?.title ?? "Fixed Lot"} />
                <TradeSyncerField label="Default Risk Setting" placeholder="1.00x" value={slaveForm.riskSetting} onChange={(next) => setSlaveForm((current) => ({ ...current, riskSetting: next }))} />
              </>
            ) : masterSetupSection === "SL and TP Settings" ? (
              <>
                <TradeSyncerSelect label="Copy Stop Loss" options={["On", "Off"]} value="On" />
                <TradeSyncerSelect label="Copy Take Profit" options={["On", "Off"]} value="On" />
                <TradeSyncerSelect label="Copy Pending Orders" options={["On", "Off"]} value="Off" />
                <TradeSyncerSelect label="Strict Protection Sync" options={["On", "Off"]} value="On" />
              </>
            ) : masterSetupSection === "Advanced Settings" ? (
              <>
                <TradeSyncerSelect label="Delay Mode" options={["Immediate", "Fixed Delay", "Random Delay"]} value="Immediate" />
                <TradeSyncerField label="Comment Tag" placeholder="KWANTIFY-FANOUT" />
                <TradeSyncerSelect label="Close On Master Exit" options={["On", "Off"]} value="On" />
                <TradeSyncerSelect label="Suspend On Drift" options={["On", "Off"]} value="On" />
              </>
            ) : (
              <>
                <TradeSyncerField label="Allowed Symbols" placeholder="MNQ, NQ, ES" />
                <TradeSyncerField label="Comment Filter" placeholder="Optional comment match" />
                <TradeSyncerSelect label="Direction" options={["Both", "Long only", "Short only"]} value="Both" />
                <TradeSyncerField label="Master Lot Range" placeholder="0.50 - 5.00" />
              </>
            )}
          </div>
          <div className="mt-5 flex gap-3">
            <Link href="/trade-syncer/copier-engine?modal=new-master&result=tested" className="flex-1 rounded-xl border border-border bg-background/40 py-3 text-center text-[13px] text-foreground">
              Test Group
            </Link>
            <button type="button" onClick={handleCreateMaster} disabled={isPending} className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary disabled:opacity-60">
              {isPending ? "Creating..." : "Create Master"}
            </button>
          </div>
        </TradeSyncerModal>
      ) : null}

      {action ? (
        <TradeSyncerModal
          title={`${action} / ${group.label}`}
          description="This mirrors the compact utility flows Traders Connect exposes directly from the copier table."
          onClose={() => router.push("/trade-syncer/copier-engine")}
        >
          {submitError ? (
            <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/5 p-4 text-[13px] leading-6 text-danger">
              {submitError}
            </div>
          ) : null}
          {result ? (
            <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-primary">
              {action === "Delete"
                ? `${group.label} is queued for removal. In the real engine this would soft-delete the group after safety checks.`
                : `${action} updated for ${group.label}. This keeps the side-by-side flow alive while we wire the real backend.`}
            </div>
          ) : null}
          <div className="space-y-4">
            {action === "Add Slave" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <TradeSyncerSelect
                  label="Follower Account"
                  options={accounts.filter((account) => account.id !== group.leadAccountId).map((account) => account.label)}
                  value={accountMap.get(slaveForm.accountId)?.label ?? accounts.find((account) => account.id !== group.leadAccountId)?.label ?? ""}
                  onChange={(next) => {
                    const matched = accounts.find((account) => account.label === next);
                    setSlaveForm((current) => ({ ...current, accountId: matched?.id ?? current.accountId }));
                  }}
                />
                <TradeSyncerSelect label="Risk Type" options={["Fixed Lot", "Lot Multiplier", "Fixed % Risk (Beta)"]} value={slaveForm.riskType} onChange={(next) => setSlaveForm((current) => ({ ...current, riskType: next }))} />
                <TradeSyncerField label="Risk Setting" placeholder="1.00x" value={slaveForm.riskSetting} onChange={(next) => setSlaveForm((current) => ({ ...current, riskSetting: next }))} />
                <TradeSyncerSelect label="Template" options={["None", ...templates.map((template) => template.label)]} value={templates.find((template) => template.id === slaveForm.templateId)?.label ?? "None"} onChange={(next) => {
                  const matched = templates.find((template) => template.label === next);
                  setSlaveForm((current) => ({ ...current, templateId: matched?.id ?? "" }));
                }} />
              </div>
            ) : action === "Symbol Mapping" ? (
              <div className="grid gap-3">
                {group.symbolMappings.map((mapping) => (
                  <div key={`${mapping.leaderSymbol}-${mapping.followerSymbol}`} className="grid gap-3 rounded-2xl border border-border bg-background/40 p-4 md:grid-cols-[1fr_auto_1fr]">
                    <div className="text-[13px] text-foreground">{mapping.leaderSymbol}</div>
                    <div className="text-center text-[12px] text-muted">maps to</div>
                    <div className="text-[13px] text-foreground">{mapping.followerSymbol}</div>
                  </div>
                ))}
                <div className="grid gap-4 md:grid-cols-2">
                  <TradeSyncerField label="Leader Symbol" placeholder="MNQ" value={mappingForm.leaderSymbol} onChange={(next) => setMappingForm((current) => ({ ...current, leaderSymbol: next }))} />
                  <TradeSyncerField label="Follower Symbol" placeholder="MNQ" value={mappingForm.followerSymbol} onChange={(next) => setMappingForm((current) => ({ ...current, followerSymbol: next }))} />
                </div>
              </div>
            ) : action === "Override" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <TradeSyncerSelect
                  label="Follower"
                  options={followerOptions.map((option) => option.label)}
                  value={selectedOverrideFollowerLabel}
                  onChange={(next) => {
                    const matchedOption = followerOptions.find((option) => option.label === next);
                    const matchedFollower = group.followerRecords.find((follower) => follower.id === matchedOption?.followerId);
                    setOverrideForm((current) => ({
                      ...current,
                      followerId: matchedFollower?.id ?? current.followerId,
                      riskType: matchedFollower?.riskType ?? current.riskType,
                      riskSetting: matchedFollower?.riskSetting ?? current.riskSetting,
                      copyStopLoss:
                        matchedFollower?.override?.copyStopLoss === false ? "Off" : "On",
                      copyTakeProfit:
                        matchedFollower?.override?.copyTakeProfit === false ? "Off" : "On",
                      copyPendingOrders:
                        matchedFollower?.override?.copyPendingOrders ? "On" : "Off",
                      delayMode:
                        matchedFollower?.override?.delayMode === "fixed_delay"
                          ? "Fixed Delay"
                          : matchedFollower?.override?.delayMode === "random_delay"
                            ? "Random Delay"
                            : "Immediate",
                    }));
                  }}
                />
                <TradeSyncerSelect label="Risk Type" options={["Fixed Lot", "Lot Multiplier", "Balance Multiplier", "Fixed % Risk (Beta)"]} value={overrideForm.riskType} onChange={(next) => setOverrideForm((current) => ({ ...current, riskType: next }))} />
                <TradeSyncerField label="Risk Setting" placeholder="0.75%" value={overrideForm.riskSetting} onChange={(next) => setOverrideForm((current) => ({ ...current, riskSetting: next }))} />
                <TradeSyncerSelect label="Copy Stop Loss" options={["On", "Off"]} value={overrideForm.copyStopLoss} onChange={(next) => setOverrideForm((current) => ({ ...current, copyStopLoss: next }))} />
                <TradeSyncerSelect label="Copy Take Profit" options={["On", "Off"]} value={overrideForm.copyTakeProfit} onChange={(next) => setOverrideForm((current) => ({ ...current, copyTakeProfit: next }))} />
                <TradeSyncerSelect label="Copy Pending Orders" options={["On", "Off"]} value={overrideForm.copyPendingOrders} onChange={(next) => setOverrideForm((current) => ({ ...current, copyPendingOrders: next }))} />
                <TradeSyncerSelect label="Delay Mode" options={["Immediate", "Fixed Delay", "Random Delay"]} value={overrideForm.delayMode} onChange={(next) => setOverrideForm((current) => ({ ...current, delayMode: next }))} />
              </div>
            ) : action === "Time" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <TradeSyncerField label="Session Start" placeholder="09:30" />
                <TradeSyncerField label="Session End" placeholder="16:00" />
                <TradeSyncerSelect label="Timezone" options={["Broker local", "New York", "UTC"]} />
                <TradeSyncerSelect label="Delay Mode" options={["Immediate", "Fixed Delay", "Random Delay"]} />
              </div>
            ) : action === "Status" ? (
              <div className="grid gap-3">
                {tradeSyncerCopierStatuses.map((status) => {
                  const nextStatus =
                    status.title === "Enabled"
                      ? "enabled"
                      : status.title === "Disabled - Monitor Existing"
                        ? "monitor_existing"
                        : "disabled";
                  return (
                  <button
                    key={status.title}
                    type="button"
                    onClick={() => handleGroupStatusUpdate(nextStatus)}
                    className="rounded-2xl border border-border bg-background/40 px-4 py-3 transition-colors hover:border-primary/30"
                  >
                    <div className="font-medium text-foreground">{status.title}</div>
                    <div className="mt-1 text-[12px] leading-5 text-muted">{status.operatorMeaning}</div>
                  </button>
                )})}
              </div>
            ) : action === "Delete" ? (
              <div className="rounded-2xl border border-danger/20 bg-danger/5 p-4 text-[13px] leading-6 text-danger">
                Delete is a high-friction utility in Traders Connect too. We keep it explicit here so removing a copier group never feels casual.
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-background/40 p-4 text-[13px] leading-6 text-muted">
                {action} should open a compact operator flow here instead of leaving the button dead. This pass gives us the clickable skeleton and the right product rhythm.
              </div>
            )}
            <div className="flex gap-3">
              <Link href="/trade-syncer/copier-engine" className="flex-1 rounded-xl border border-border bg-background/40 py-3 text-center text-[13px] text-foreground">
                {action === "Status" ? "Close" : "Cancel"}
              </Link>
              {action === "Status" ? null : action === "Add Slave" ? (
                <button
                  type="button"
                  onClick={handleAddFollower}
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary disabled:opacity-60"
                >
                  {isPending ? "Saving..." : "Save"}
                </button>
              ) : action === "Override" ? (
                <button
                  type="button"
                  onClick={handleOverrideSave}
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary disabled:opacity-60"
                >
                  {isPending ? "Saving..." : "Save"}
                </button>
              ) : action === "Symbol Mapping" ? (
                <button
                  type="button"
                  onClick={handleSymbolMappingSave}
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary disabled:opacity-60"
                >
                  {isPending ? "Saving..." : "Save"}
                </button>
              ) : action === "Delete" ? (
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-danger py-3 text-center text-[13px] font-semibold text-on-danger disabled:opacity-60"
                >
                  {isPending ? "Deleting..." : "Confirm Delete"}
                </button>
              ) : (
                <Link
                  href={`/trade-syncer/copier-engine?action=${encodeURIComponent(action)}&group=${encodeURIComponent(group.id)}&result=saved`}
                  className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary"
                >
                  Save
                </Link>
              )}
            </div>
          </div>
        </TradeSyncerModal>
      ) : null}
    </div>
  );
}

export default function TradeSyncerCopierEngineWorkspace(props: {
  accounts: TradeSyncerAccountRecord[];
  syncGroups: TradeSyncerSyncGroupRecord[];
  templates: TradeSyncerTemplateRecord[];
}) {
  return (
    <Suspense fallback={null}>
      <TradeSyncerCopierEngineWorkspaceContent {...props} />
    </Suspense>
  );
}
