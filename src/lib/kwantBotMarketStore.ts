"use client";

import type {
  KwantBotInterpreterMessage,
  KwantBotMarketRoot,
  KwantBotMemoryEvent,
} from "@/lib/kwantBotInterpreter";
import type { KwantBotLearningReview } from "@/lib/kwantBotLearning";

const DB_NAME = "kwantdesk-market-intelligence";
const DB_VERSION = 1;
const STORE_NAME = "state";
const STATE_KEY = "kwantbot-interpreter-v1";

export type KwantBotPersistedState = {
  version: 1;
  selectedRoot: KwantBotMarketRoot;
  messages: Record<KwantBotMarketRoot, KwantBotInterpreterMessage[]>;
  memory: Record<KwantBotMarketRoot, KwantBotMemoryEvent[]>;
  learningReviews?: KwantBotLearningReview[];
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadKwantBotMarketState() {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  const database = await openDatabase();
  try {
    return await new Promise<KwantBotPersistedState | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve((request.result as KwantBotPersistedState | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function saveKwantBotMarketState(state: KwantBotPersistedState) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(state, STATE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
