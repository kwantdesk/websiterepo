export type ChartAlertConditionKind = "price" | "strategy";

export type ChartAlertPriceOperator =
  | "crossing"
  | "crossing_up"
  | "crossing_down"
  | "greater_than"
  | "less_than";

export type ChartAlertStrategyEvent =
  | "order_fill_and_alert"
  | "alert_function"
  | "entry_signal"
  | "exit_signal"
  | "order_fill"
  | "take_profit"
  | "stop_loss"
  | "any_event";

export type ChartAlertTriggerMode = "once" | "once_per_bar" | "once_per_bar_close";

export type ChartAlertExpiration = "open_ended" | "end_of_day" | "end_of_week" | "end_of_month";

export type ChartAlertState = "active" | "paused" | "triggered";

export type ChartAlertDelivery = {
  inApp: boolean;
  toast?: boolean;
  webhook: boolean;
  email: boolean;
  sound?: boolean;
  plainText?: boolean;
};

export type ChartAlertRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  state: ChartAlertState;
  name?: string;
  instrument: string;
  timeframe: string;
  conditionKind: ChartAlertConditionKind;
  conditionLabel: string;
  triggerMode: ChartAlertTriggerMode;
  expiration: ChartAlertExpiration;
  message: string;
  delivery: ChartAlertDelivery;
  webhookUrl?: string;
  targetValue?: string;
  priceOperator?: ChartAlertPriceOperator;
  strategyId?: string;
  strategyName?: string;
  strategyEvent?: ChartAlertStrategyEvent;
};

export type ChartAlertStrategyOption = {
  id: string;
  name: string;
};

const STORAGE_KEY = "kwantify-chart-alerts";

export function loadChartAlerts(): ChartAlertRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChartAlerts(alerts: ChartAlertRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

export function upsertChartAlert(alert: ChartAlertRecord) {
  const current = loadChartAlerts();
  const next = [alert, ...current.filter((item) => item.id !== alert.id)];
  saveChartAlerts(next);
  return next;
}

export function getPriceOperatorLabel(operator: ChartAlertPriceOperator) {
  switch (operator) {
    case "crossing":
      return "Crossing";
    case "crossing_up":
      return "Crossing Up";
    case "crossing_down":
      return "Crossing Down";
    case "greater_than":
      return "Greater Than";
    case "less_than":
      return "Less Than";
  }
}

export function getStrategyEventLabel(event: ChartAlertStrategyEvent) {
  switch (event) {
    case "order_fill_and_alert":
      return "Order fills and alert() calls";
    case "alert_function":
      return "alert() calls only";
    case "entry_signal":
      return "Entry Signal";
    case "exit_signal":
      return "Exit Signal";
    case "order_fill":
      return "Order Fill";
    case "take_profit":
      return "Take Profit Hit";
    case "stop_loss":
      return "Stop Loss Hit";
    case "any_event":
      return "Any Strategy Event";
  }
}

export function getTriggerModeLabel(mode: ChartAlertTriggerMode) {
  switch (mode) {
    case "once":
      return "Once only";
    case "once_per_bar":
      return "Once per bar";
    case "once_per_bar_close":
      return "Once per bar close";
  }
}

export function getExpirationLabel(expiration: ChartAlertExpiration) {
  switch (expiration) {
    case "open_ended":
      return "Open-ended";
    case "end_of_day":
      return "End of day";
    case "end_of_week":
      return "End of week";
    case "end_of_month":
      return "End of month";
  }
}
