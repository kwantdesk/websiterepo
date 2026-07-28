"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BellRing,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Mail,
  MessageSquareText,
  Smartphone,
  Volume2,
  Webhook,
  X,
} from "lucide-react";
import {
  type ChartAlertDelivery,
  type ChartAlertExpiration,
  type ChartAlertPriceOperator,
  type ChartAlertRecord,
  type ChartAlertStrategyEvent,
  type ChartAlertStrategyOption,
  type ChartAlertTriggerMode,
  getPriceOperatorLabel,
  getStrategyEventLabel,
} from "@/lib/chartAlerts";

type Props = {
  isOpen: boolean;
  instrument: string;
  displayInstrument?: string;
  timeframe: string;
  strategies: ChartAlertStrategyOption[];
  defaultPrice?: string;
  initialAlert?: ChartAlertRecord | null;
  onClose: () => void;
  onCreate: (alert: ChartAlertRecord) => void;
};

type DetailView = "main" | "message" | "notifications";
type OpenMenu = null | "condition" | "strategyMode" | "priceOperator" | "interval" | "trigger" | "expiration";

const DEFAULT_WEBHOOK_URL = "https://www.kwantify.co/api/webhooks/tradingview";
const DEFAULT_DELIVERY: ChartAlertDelivery = {
  inApp: false,
  toast: false,
  email: false,
  webhook: true,
  sound: false,
  plainText: false,
};

const priceOperators: ChartAlertPriceOperator[] = [
  "crossing",
  "crossing_up",
  "crossing_down",
  "greater_than",
  "less_than",
];

const strategyModes: ChartAlertStrategyEvent[] = [
  "order_fill_and_alert",
  "order_fill",
  "alert_function",
];

const triggerModes: { value: ChartAlertTriggerMode; label: string }[] = [
  { value: "once", label: "Once only" },
  { value: "once_per_bar", label: "Once per bar" },
  { value: "once_per_bar_close", label: "Once per bar close" },
];

const expirationModes: { value: ChartAlertExpiration; label: string; subtitle: string }[] = [
  { value: "open_ended", label: "Open-ended", subtitle: "Won't expire" },
  { value: "end_of_day", label: "End of day", subtitle: "Ends tonight" },
  { value: "end_of_week", label: "1 week", subtitle: "Ends in 7 days" },
  { value: "end_of_month", label: "1 month", subtitle: "Ends in 30 days" },
];

const intervalModes = [
  { value: "same", label: "Same as chart", detail: "" },
  { value: "1m", label: "1 minute", detail: "" },
  { value: "3m", label: "3 minutes", detail: "" },
  { value: "5m", label: "5 minutes", detail: "" },
  { value: "15m", label: "15 minutes", detail: "" },
  { value: "30m", label: "30 minutes", detail: "" },
  { value: "45m", label: "45 minutes", detail: "" },
  { value: "1h", label: "1 hour", detail: "" },
  { value: "4h", label: "4 hours", detail: "" },
  { value: "1D", label: "1 day", detail: "" },
];

function getPrettyTimeframe(timeframe: string) {
  const map: Record<string, string> = {
    "1m": "1 minute",
    "3m": "3 minutes",
    "5m": "5 minutes",
    "15m": "15 minutes",
    "30m": "30 minutes",
    "45m": "45 minutes",
    "1h": "1 hour",
    "4h": "4 hours",
    "1D": "1 day",
  };
  return map[timeframe] ?? timeframe;
}

function getStrategyModeLabel(mode: ChartAlertStrategyEvent) {
  switch (mode) {
    case "order_fill_and_alert":
      return "Order fills and alert() function calls";
    case "order_fill":
      return "Order fills only";
    case "alert_function":
      return "alert() function calls only";
    case "entry_signal":
      return "Entry alerts only";
    case "exit_signal":
      return "Exit alerts only";
    case "take_profit":
      return "Take profit only";
    case "stop_loss":
      return "Stop loss only";
    case "any_event":
      return "Any strategy event";
  }
}

function getNotificationSummary(delivery: ChartAlertDelivery) {
  const parts: string[] = [];
  if (delivery.webhook) parts.push("Webhook");
  if (delivery.inApp) parts.push("Notify in app");
  if (delivery.toast) parts.push("Toast");
  if (delivery.email) parts.push("Email");
  if (delivery.sound) parts.push("Sound");
  if (delivery.plainText) parts.push("Plain text");
  return parts.join(" + ") || "None";
}

function buildDefaultMessage({
  instrument,
  conditionKey,
  priceOperator,
  targetValue,
  strategyName,
  strategyEvent,
}: {
  instrument: string;
  conditionKey: string;
  priceOperator: ChartAlertPriceOperator;
  targetValue: string;
  strategyName?: string;
  strategyEvent: ChartAlertStrategyEvent;
}) {
  if (conditionKey === "price") {
    return `${instrument} ${getPriceOperatorLabel(priceOperator)} ${targetValue}`;
  }

  if (strategyEvent === "order_fill") {
    return `${strategyName}: order {{strategy.order.action}} @ {{strategy.order.price}} · {{strategy.order.alert_message}}`;
  }

  if (strategyEvent === "alert_function") {
    return `${strategyName}: {{strategy.order.alert_message}}`;
  }

  return `${strategyName}: ${getStrategyEventLabel(strategyEvent)} · {{strategy.order.alert_message}}`;
}

function buildAlertName({
  instrument,
  conditionKey,
  strategyName,
  priceOperator,
  targetValue,
}: {
  instrument: string;
  conditionKey: string;
  strategyName?: string;
  priceOperator: ChartAlertPriceOperator;
  targetValue: string;
}) {
  if (conditionKey === "price") {
    return `${instrument} ${getPriceOperatorLabel(priceOperator)} ${targetValue}`;
  }

  return strategyName ?? instrument;
}

function MenuButton({
  value,
  secondary,
  onClick,
  isOpen,
  fullWidth = true,
}: {
  value: string;
  secondary?: string;
  onClick: () => void;
  isOpen?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[54px] items-center justify-between rounded-2xl border px-4 text-left transition-colors ${
        isOpen ? "border-primary/55 bg-surface" : "border-border bg-surface hover:border-border/80"
      } ${fullWidth ? "w-full" : ""}`}
    >
      <div className="min-w-0">
        <div className="truncate text-[16px] font-medium text-foreground">{value}</div>
      </div>
      <div className="ml-4 flex items-center gap-3">
        {secondary ? <span className="whitespace-nowrap text-[14px] text-muted">{secondary}</span> : null}
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>
    </button>
  );
}

function RowLabel({ children }: { children: ReactNode }) {
  return <div className="pt-4 text-[14px] text-muted">{children}</div>;
}

function InlineMenu({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl">
      {children}
    </div>
  );
}

function MenuOption({
  selected,
  onClick,
  label,
  detail,
}: {
  selected?: boolean;
  onClick: () => void;
  label: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-3 text-left text-[15px] transition-colors ${
        selected ? "bg-white text-black" : "text-foreground hover:bg-surface"
      }`}
    >
      <span className="truncate">{label}</span>
      {detail ? <span className={`ml-4 whitespace-nowrap text-[13px] ${selected ? "text-black/70" : "text-muted"}`}>{detail}</span> : null}
    </button>
  );
}

function NotificationRow({
  checked,
  onChange,
  icon,
  title,
  description,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <label className="block rounded-2xl border border-border bg-surface px-4 py-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-5 w-5 rounded border-border bg-panel"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[17px] font-medium text-foreground">
            {icon}
            <span>{title}</span>
          </div>
          <p className="mt-1 text-[14px] leading-6 text-muted">{description}</p>
          {children}
        </div>
      </div>
    </label>
  );
}

export default function ChartCreateAlertModal({
  isOpen,
  instrument,
  displayInstrument,
  timeframe,
  strategies,
  defaultPrice,
  initialAlert,
  onClose,
  onCreate,
}: Props) {
  const instrumentLabel = displayInstrument ?? instrument;
  const wasOpenRef = useRef(false);
  const [detailView, setDetailView] = useState<DetailView>("main");
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [conditionKey, setConditionKey] = useState("price");
  const [priceOperator, setPriceOperator] = useState<ChartAlertPriceOperator>("crossing");
  const [targetValue, setTargetValue] = useState(defaultPrice ?? "");
  const [strategyEvent, setStrategyEvent] = useState<ChartAlertStrategyEvent>("order_fill");
  const [triggerMode, setTriggerMode] = useState<ChartAlertTriggerMode>("once");
  const [intervalMode, setIntervalMode] = useState("same");
  const [expiration, setExpiration] = useState<ChartAlertExpiration>("open_ended");
  const [delivery, setDelivery] = useState<ChartAlertDelivery>(DEFAULT_DELIVERY);
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK_URL);
  const [alertName, setAlertName] = useState("");
  const [message, setMessage] = useState("");
  const [messageEdited, setMessageEdited] = useState(false);
  const [nameEdited, setNameEdited] = useState(false);

  const [alertNameDraft, setAlertNameDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [deliveryDraft, setDeliveryDraft] = useState<ChartAlertDelivery>(DEFAULT_DELIVERY);
  const [webhookUrlDraft, setWebhookUrlDraft] = useState(DEFAULT_WEBHOOK_URL);

  const conditionOptions = useMemo(() => {
    const strategyOptions = strategies.map((strategy) => ({ value: strategy.id, label: strategy.name }));
    if (
      initialAlert?.conditionKind === "strategy" &&
      initialAlert.strategyId &&
      initialAlert.strategyName &&
      !strategyOptions.some((option) => option.value === initialAlert.strategyId)
    ) {
      strategyOptions.unshift({ value: initialAlert.strategyId, label: initialAlert.strategyName });
    }
    return [{ value: "price", label: "Price" }, ...strategyOptions];
  }, [initialAlert, strategies]);

  const selectedStrategy = strategies.find((strategy) => strategy.id === conditionKey);
  const usingStrategy = conditionKey !== "price";

  const generatedName = useMemo(
    () =>
      buildAlertName({
        instrument: instrumentLabel,
        conditionKey,
        strategyName: selectedStrategy?.name,
        priceOperator,
        targetValue,
      }),
    [conditionKey, instrumentLabel, priceOperator, selectedStrategy?.name, targetValue],
  );

  const generatedMessage = useMemo(
    () =>
      buildDefaultMessage({
        instrument: instrumentLabel,
        conditionKey,
        priceOperator,
        targetValue,
        strategyName: selectedStrategy?.name,
        strategyEvent,
      }),
    [conditionKey, instrumentLabel, priceOperator, selectedStrategy?.name, strategyEvent, targetValue],
  );

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    if (wasOpenRef.current) return;

    wasOpenRef.current = true;
    const firstStrategy = strategies[0];
    const nextConditionKey = initialAlert
      ? initialAlert.conditionKind === "strategy"
        ? initialAlert.strategyId ?? (firstStrategy ? firstStrategy.id : "price")
        : "price"
      : firstStrategy
        ? firstStrategy.id
        : "price";
    const nextDelivery = initialAlert ? { ...initialAlert.delivery } : { ...DEFAULT_DELIVERY };
    const nextTimeframeMode = initialAlert
      ? initialAlert.timeframe === timeframe
        ? "same"
        : initialAlert.timeframe
      : "same";

    setDetailView("main");
    setOpenMenu(null);
    setConditionKey(nextConditionKey);
    setPriceOperator(initialAlert?.priceOperator ?? "crossing");
    setTargetValue(initialAlert?.targetValue ?? defaultPrice ?? "");
    setStrategyEvent(initialAlert?.strategyEvent ?? "order_fill");
    setTriggerMode(initialAlert?.triggerMode ?? "once");
    setIntervalMode(nextTimeframeMode);
    setExpiration(initialAlert?.expiration ?? "open_ended");
    setDelivery(nextDelivery);
    setWebhookUrl(initialAlert?.webhookUrl ?? DEFAULT_WEBHOOK_URL);
    setAlertName(initialAlert?.name ?? "");
    setMessage(initialAlert?.message ?? "");
    setMessageEdited(Boolean(initialAlert?.message));
    setNameEdited(Boolean(initialAlert?.name));
    setAlertNameDraft(initialAlert?.name ?? "");
    setMessageDraft(initialAlert?.message ?? "");
    setDeliveryDraft(nextDelivery);
    setWebhookUrlDraft(initialAlert?.webhookUrl ?? DEFAULT_WEBHOOK_URL);
  }, [defaultPrice, initialAlert, isOpen, strategies, timeframe]);

  useEffect(() => {
    if (!isOpen || nameEdited) return;
    setAlertName(generatedName);
  }, [generatedName, isOpen, nameEdited]);

  useEffect(() => {
    if (!isOpen || messageEdited) return;
    setMessage(generatedMessage);
  }, [generatedMessage, isOpen, messageEdited]);

  if (!isOpen) return null;

  const effectiveTimeframe = intervalMode === "same" ? timeframe : intervalMode;
  const canCreate = usingStrategy ? Boolean(selectedStrategy) : Boolean(targetValue.trim());
  const expirationOption = expirationModes.find((option) => option.value === expiration);
  const intervalOption = intervalModes.find((option) => option.value === intervalMode);
  const messageRowLabel = (alertName || generatedName || message || generatedMessage).trim();

  const openMessageDetail = () => {
    setOpenMenu(null);
    setAlertNameDraft(alertName || generatedName);
    setMessageDraft(message || generatedMessage);
    setDetailView("message");
  };

  const openNotificationsDetail = () => {
    setOpenMenu(null);
    setDeliveryDraft({ ...delivery });
    setWebhookUrlDraft(webhookUrl);
    setDetailView("notifications");
  };

  const handleCreate = () => {
    if (!canCreate) return;
    const now = new Date().toISOString();
    const conditionLabel = usingStrategy
      ? `${selectedStrategy?.name} · ${getStrategyModeLabel(strategyEvent)}`
      : `${instrumentLabel} ${getPriceOperatorLabel(priceOperator)} ${targetValue}`;

    onCreate({
      id: initialAlert?.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `alert_${Date.now()}`),
      createdAt: initialAlert?.createdAt ?? now,
      updatedAt: now,
      state: initialAlert?.state ?? "active",
      name: alertName.trim() || generatedName,
      instrument,
      timeframe: effectiveTimeframe,
      conditionKind: usingStrategy ? "strategy" : "price",
      conditionLabel,
      triggerMode,
      expiration,
      message: message || generatedMessage,
      delivery,
      webhookUrl: delivery.webhook ? webhookUrl : undefined,
      targetValue: usingStrategy ? undefined : targetValue,
      priceOperator: usingStrategy ? undefined : priceOperator,
      strategyId: usingStrategy ? selectedStrategy?.id : undefined,
      strategyName: usingStrategy ? selectedStrategy?.name : undefined,
      strategyEvent: usingStrategy ? strategyEvent : undefined,
    });
    onClose();
  };

  const mainView = (
    <>
      <div className="border-b border-border px-8 py-6">
        <div className="grid grid-cols-[150px_1fr] gap-x-6 gap-y-5">
          <RowLabel>Condition</RowLabel>
          <div className="space-y-3">
            <div className="relative">
              <MenuButton
                value={conditionOptions.find((option) => option.value === conditionKey)?.label ?? "Price"}
                onClick={() => setOpenMenu((current) => (current === "condition" ? null : "condition"))}
                isOpen={openMenu === "condition"}
              />
              {openMenu === "condition" ? (
                <InlineMenu>
                  {conditionOptions.map((option) => (
                    <MenuOption
                      key={option.value}
                      selected={conditionKey === option.value}
                      label={option.label}
                      onClick={() => {
                        setConditionKey(option.value);
                        setOpenMenu(null);
                      }}
                    />
                  ))}
                </InlineMenu>
              ) : null}
            </div>

            {usingStrategy ? (
              <div className="relative">
                <MenuButton
                  value={getStrategyModeLabel(strategyEvent)}
                  onClick={() => setOpenMenu((current) => (current === "strategyMode" ? null : "strategyMode"))}
                  isOpen={openMenu === "strategyMode"}
                />
                {openMenu === "strategyMode" ? (
                  <InlineMenu>
                    {strategyModes.map((mode) => (
                      <MenuOption
                        key={mode}
                        selected={strategyEvent === mode}
                        label={getStrategyModeLabel(mode)}
                        onClick={() => {
                          setStrategyEvent(mode);
                          setOpenMenu(null);
                        }}
                      />
                    ))}
                  </InlineMenu>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-3">
                <div className="relative">
                  <MenuButton
                    value={getPriceOperatorLabel(priceOperator)}
                    onClick={() => setOpenMenu((current) => (current === "priceOperator" ? null : "priceOperator"))}
                    isOpen={openMenu === "priceOperator"}
                  />
                  {openMenu === "priceOperator" ? (
                    <InlineMenu>
                      {priceOperators.map((operator) => (
                        <MenuOption
                          key={operator}
                          selected={priceOperator === operator}
                          label={getPriceOperatorLabel(operator)}
                          onClick={() => {
                            setPriceOperator(operator);
                            setOpenMenu(null);
                          }}
                        />
                      ))}
                    </InlineMenu>
                  ) : null}
                </div>
                <input
                  value={targetValue}
                  onChange={(event) => setTargetValue(event.target.value)}
                  className="h-[54px] rounded-2xl border border-border bg-surface px-4 text-[16px] text-foreground outline-none transition-colors focus:border-primary/50"
                />
              </div>
            )}
          </div>

          <RowLabel>Interval</RowLabel>
          <div className="relative">
            <MenuButton
              value={intervalOption?.label ?? "Same as chart"}
              secondary={intervalMode === "same" ? getPrettyTimeframe(timeframe) : undefined}
              onClick={() => setOpenMenu((current) => (current === "interval" ? null : "interval"))}
              isOpen={openMenu === "interval"}
            />
            {openMenu === "interval" ? (
              <InlineMenu>
                {intervalModes.map((mode) => (
                  <MenuOption
                    key={mode.value}
                    selected={intervalMode === mode.value}
                    label={mode.label}
                    detail={mode.value === "same" ? getPrettyTimeframe(timeframe) : undefined}
                    onClick={() => {
                      setIntervalMode(mode.value);
                      setOpenMenu(null);
                    }}
                  />
                ))}
              </InlineMenu>
            ) : null}
          </div>
        </div>

        <div className="ml-[176px] mt-5 flex items-center gap-2 text-[15px] text-muted/45">
          <span className="text-[24px] leading-none">+</span>
          <span>Add condition</span>
          <HelpCircle className="h-4 w-4" />
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="grid grid-cols-[150px_1fr] gap-x-6 gap-y-5">
          {!usingStrategy ? (
            <>
              <RowLabel>Trigger</RowLabel>
              <div className="relative">
                <MenuButton
                  value={triggerModes.find((mode) => mode.value === triggerMode)?.label ?? "Once only"}
                  onClick={() => setOpenMenu((current) => (current === "trigger" ? null : "trigger"))}
                  isOpen={openMenu === "trigger"}
                />
                {openMenu === "trigger" ? (
                  <InlineMenu>
                    {triggerModes.map((mode) => (
                      <MenuOption
                        key={mode.value}
                        selected={triggerMode === mode.value}
                        label={mode.label}
                        onClick={() => {
                          setTriggerMode(mode.value);
                          setOpenMenu(null);
                        }}
                      />
                    ))}
                  </InlineMenu>
                ) : null}
              </div>
            </>
          ) : null}

          <RowLabel>Expiration</RowLabel>
          <div className="relative">
            <MenuButton
              value={expirationOption?.label ?? "Open-ended"}
              secondary={expirationOption?.subtitle}
              onClick={() => setOpenMenu((current) => (current === "expiration" ? null : "expiration"))}
              isOpen={openMenu === "expiration"}
            />
            {openMenu === "expiration" ? (
              <InlineMenu>
                {expirationModes.map((mode) => (
                  <MenuOption
                    key={mode.value}
                    selected={expiration === mode.value}
                    label={mode.label}
                    detail={mode.subtitle}
                    onClick={() => {
                      setExpiration(mode.value);
                      setOpenMenu(null);
                    }}
                  />
                ))}
              </InlineMenu>
            ) : null}
          </div>

          <RowLabel>Message</RowLabel>
          <button
            type="button"
            onClick={openMessageDetail}
            className="flex min-h-[54px] items-center justify-between rounded-2xl border border-border bg-surface px-4 text-left transition-colors hover:border-border/80"
          >
            <span className="truncate text-[16px] text-foreground">{messageRowLabel}</span>
            <ChevronRight className="ml-4 h-4 w-4 shrink-0 text-muted" />
          </button>

          <RowLabel>Notifications</RowLabel>
          <button
            type="button"
            onClick={openNotificationsDetail}
            className="flex min-h-[54px] items-center justify-between rounded-2xl border border-border bg-surface px-4 text-left transition-colors hover:border-border/80"
          >
            <span className="truncate text-[16px] text-foreground">{getNotificationSummary(delivery)}</span>
            <ChevronRight className="ml-4 h-4 w-4 shrink-0 text-muted" />
          </button>
        </div>
      </div>
    </>
  );

  const messageView = (
    <div className="px-8 py-6">
      <div className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-[15px] text-muted">Alert name</span>
          <input
            value={alertNameDraft}
            onChange={(event) => setAlertNameDraft(event.target.value)}
            className="h-[54px] w-full rounded-2xl border border-border bg-surface px-4 text-[16px] text-foreground outline-none transition-colors focus:border-primary/50"
          />
        </label>

        <label className="block">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[15px] text-muted">Message</span>
            <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[11px] font-semibold text-yellow-400">!</span>
          </div>
          <textarea
            rows={10}
            value={messageDraft}
            onChange={(event) => setMessageDraft(event.target.value)}
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-[16px] leading-7 text-foreground outline-none transition-colors focus:border-primary/50"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {["{{ticker}}", "{{interval}}", "{{strategy.order.action}}", "{{strategy.order.alert_message}}"].map((placeholder) => (
            <button
              key={placeholder}
              type="button"
              onClick={() => setMessageDraft((current) => `${current}${current ? " " : ""}${placeholder}`)}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] text-muted transition-colors hover:text-foreground"
            >
              {placeholder}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const notificationsView = (
    <div className="px-8 py-6">
      <div className="space-y-4">
        <NotificationRow
          checked={!!deliveryDraft.inApp}
          onChange={(checked) => setDeliveryDraft((current) => ({ ...current, inApp: checked }))}
          icon={<Smartphone className="h-4 w-4 text-muted" />}
          title="Notify in app"
          description="Provides a push notification inside kwantify."
        />

        <NotificationRow
          checked={!!deliveryDraft.toast}
          onChange={(checked) => setDeliveryDraft((current) => ({ ...current, toast: checked }))}
          icon={<BellRing className="h-4 w-4 text-muted" />}
          title="Show toast notification"
          description="Displays an onsite notification in the page corner."
        />

        <NotificationRow
          checked={!!deliveryDraft.email}
          onChange={(checked) => setDeliveryDraft((current) => ({ ...current, email: checked }))}
          icon={<Mail className="h-4 w-4 text-muted" />}
          title="Send email"
          description="Provides an email notification to the address in your account settings."
        />

        <NotificationRow
          checked={!!deliveryDraft.webhook}
          onChange={(checked) => setDeliveryDraft((current) => ({ ...current, webhook: checked }))}
          icon={<Webhook className="h-4 w-4 text-muted" />}
          title="Webhook URL"
          description="Sends a POST request to your specified URL when the alert triggers."
        >
          {deliveryDraft.webhook ? (
            <input
              value={webhookUrlDraft}
              onChange={(event) => setWebhookUrlDraft(event.target.value)}
              className="mt-3 h-[50px] w-full rounded-2xl border border-border bg-panel px-4 font-mono text-[14px] text-foreground outline-none transition-colors focus:border-primary/50"
            />
          ) : null}
        </NotificationRow>

        <NotificationRow
          checked={!!deliveryDraft.sound}
          onChange={(checked) => setDeliveryDraft((current) => ({ ...current, sound: checked }))}
          icon={<Volume2 className="h-4 w-4 text-muted" />}
          title="Play sound"
          description="Plays an audio cue when your alert triggers."
        />

        <NotificationRow
          checked={!!deliveryDraft.plainText}
          onChange={(checked) => setDeliveryDraft((current) => ({ ...current, plainText: checked }))}
          icon={<MessageSquareText className="h-4 w-4 text-muted" />}
          title="Send plain text"
          description="Sends plain text to an alternate destination."
        />
      </div>
    </div>
  );

  const pageTitle =
    detailView === "message"
      ? "Edit message"
      : detailView === "notifications"
        ? "Notifications"
        : "Create alert on";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[760px] overflow-hidden rounded-[26px] border border-border bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-8 py-5">
          <div className="flex min-w-0 items-center gap-4">
            {detailView !== "main" ? (
              <button
                type="button"
                onClick={() => {
                  setDetailView("main");
                  setOpenMenu(null);
                }}
                className="text-muted transition-colors hover:text-foreground"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
            ) : null}

            <div className="flex min-w-0 items-center gap-4">
              <h2 className="text-[30px] font-semibold tracking-tight text-foreground">{pageTitle}</h2>
              {detailView === "main" ? (
                <>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-[12px] font-semibold text-primary">
                    {instrumentLabel.slice(0, 3)}
                  </span>
                  <div className="flex min-w-0 items-center gap-1 text-[18px] font-medium text-foreground">
                    <span className="truncate">{instrumentLabel}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-muted transition-colors hover:text-foreground"
          >
            <X className="h-8 w-8" />
          </button>
        </div>

        {detailView === "main" ? mainView : null}
        {detailView === "message" ? messageView : null}
        {detailView === "notifications" ? notificationsView : null}

        <div className="flex items-center justify-end gap-4 border-t border-border px-8 py-5">
          {detailView === "main" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-border bg-surface px-7 py-3 text-[18px] font-medium text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canCreate}
                className="rounded-2xl bg-white px-7 py-3 text-[18px] font-semibold text-black disabled:opacity-40"
              >
                {initialAlert ? "Save" : "Create"}
              </button>
            </>
          ) : detailView === "message" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDetailView("main");
                  setAlertNameDraft(alertName || generatedName);
                  setMessageDraft(message || generatedMessage);
                }}
                className="rounded-2xl border border-border bg-surface px-7 py-3 text-[18px] font-medium text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextName = alertNameDraft.trim() || generatedName;
                  const nextMessage = messageDraft.trim() || generatedMessage;
                  setAlertName(nextName);
                  setMessage(nextMessage);
                  setNameEdited(nextName !== generatedName);
                  setMessageEdited(nextMessage !== generatedMessage);
                  setDetailView("main");
                }}
                className="rounded-2xl bg-white px-7 py-3 text-[18px] font-semibold text-black"
              >
                Apply
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setDetailView("main");
                  setDeliveryDraft({ ...delivery });
                  setWebhookUrlDraft(webhookUrl);
                }}
                className="rounded-2xl border border-border bg-surface px-7 py-3 text-[18px] font-medium text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setDelivery({ ...deliveryDraft });
                  setWebhookUrl(webhookUrlDraft);
                  setDetailView("main");
                }}
                className="rounded-2xl bg-white px-7 py-3 text-[18px] font-semibold text-black"
              >
                Apply
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
