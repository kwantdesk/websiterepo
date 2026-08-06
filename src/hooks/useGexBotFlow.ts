"use client";

import { useSyncExternalStore } from "react";

import { GEXBOT_FLOW_POLL_MS, type GexBotFlowPayload } from "@/lib/gexBotFlow";

type StoreSnapshot = {
  payload: GexBotFlowPayload | null;
  error: string | null;
  loading: boolean;
};

let snapshot: StoreSnapshot = { payload: null, error: null, loading: false };
let inFlight: Promise<void> | null = null;
let timer: number | null = null;
const listeners = new Set<() => void>();

function emit(next: StoreSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

async function refresh() {
  if (inFlight) return inFlight;
  if (!snapshot.payload) emit({ ...snapshot, loading: true });
  inFlight = fetch("/api/gexbot-flow", { cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({})) as GexBotFlowPayload & { error?: string };
      if (!response.ok && !payload.sample) throw new Error(payload.error ?? "GEX Bot flow is unavailable.");
      emit({ payload, error: payload.error ?? null, loading: false });
    })
    .catch((error) => {
      emit({
        payload: snapshot.payload,
        error: error instanceof Error ? error.message : "GEX Bot flow is unavailable.",
        loading: false,
      });
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refresh();
    timer = window.setInterval(() => void refresh(), GEXBOT_FLOW_POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  return snapshot;
}

const serverSnapshot: StoreSnapshot = { payload: null, error: null, loading: false };

export function useGexBotFlow(enabled = true) {
  const state = useSyncExternalStore(
    enabled ? subscribe : () => () => undefined,
    getSnapshot,
    () => serverSnapshot,
  );
  return {
    ...state,
    refresh,
  };
}
