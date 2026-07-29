import {
  EMPTY_JOURNAL_STATE,
  type JournalState,
} from "@/lib/journal";

const DATABASE_NAME = "kwantdesk-journal";
const DATABASE_VERSION = 1;
const STORE_NAME = "account-journals";
const memoryStore = new Map<string, JournalState>();
let databasePromise: Promise<IDBDatabase> | null = null;

function storageKey(accountKey: string) {
  return `kwantdesk:journal:${accountKey || "local"}:v1`;
}
function normalizeState(value: unknown): JournalState {
  if (!value || typeof value !== "object") return { ...EMPTY_JOURNAL_STATE };
  const candidate = value as Partial<JournalState>;
  return {
    version: 1,
    trades: Array.isArray(candidate.trades) ? candidate.trades : [],
    evidence: Array.isArray(candidate.evidence) ? candidate.evidence : [],
    imports: Array.isArray(candidate.imports) ? candidate.imports : [],
  };
}

function openDatabase() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is unavailable."));
  }
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the journal database."));
  });
  return databasePromise;
}

export async function loadJournalState(accountKey: string) {
  const key = storageKey(accountKey);
  const memory = memoryStore.get(key);
  if (memory) return normalizeState(memory);
  try {
    const database = await openDatabase();
    const stored = await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to read the journal."));
    });
    const normalized = normalizeState(stored);
    memoryStore.set(key, normalized);
    return normalized;
  } catch {
    try {
      const fallback = window.localStorage.getItem(key);
      return normalizeState(fallback ? JSON.parse(fallback) : null);
    } catch {
      return { ...EMPTY_JOURNAL_STATE };
    }
  }
}

export async function saveJournalState(accountKey: string, state: JournalState) {
  const key = storageKey(accountKey);
  const normalized = normalizeState(state);
  memoryStore.set(key, normalized);
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(normalized, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save the journal."));
    });
    return true;
  } catch {
    try {
      window.localStorage.setItem(key, JSON.stringify({
        ...normalized,
        evidence: normalized.evidence.filter((item) => item.size <= 350_000).slice(0, 12),
      }));
      return true;
    } catch {
      return false;
    }
  }
}
