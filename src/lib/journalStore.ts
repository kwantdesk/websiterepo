import {
  EMPTY_JOURNAL_STATE,
  type JournalState,
} from "./journal.ts";

const DATABASE_NAME = "kwantdesk-journal";
const DATABASE_VERSION = 1;
const STORE_NAME = "account-journals";
const memoryStore = new Map<string, JournalState>();
const deletionMemoryStore = new Map<string, JournalAccountDeletion[]>();
let databasePromise: Promise<IDBDatabase> | null = null;

export type JournalAccountDeletion = {
  id: string;
  name: string;
  deletedAt: string;
};

function storageKey(accountKey: string) {
  return `kwantdesk:journal:${accountKey || "local"}:v1`;
}

function deletionStorageKey(accountKey: string) {
  return `kwantdesk:journal:${accountKey || "local"}:deleted-accounts:v1`;
}

function normalizedAccountName(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeDeletions(value: unknown): JournalAccountDeletion[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, JournalAccountDeletion>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Partial<JournalAccountDeletion>;
    const id = typeof row.id === "string" ? row.id.trim().slice(0, 180) : "";
    const name = typeof row.name === "string" ? row.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    if (!id && !name) continue;
    const deletedAt = typeof row.deletedAt === "string" && Number.isFinite(Date.parse(row.deletedAt))
      ? row.deletedAt
      : new Date(0).toISOString();
    unique.set(id || normalizedAccountName(name), { id, name, deletedAt });
  }
  return [...unique.values()].slice(-500);
}

export function loadJournalAccountDeletions(accountKey: string) {
  const key = deletionStorageKey(accountKey);
  const memory = deletionMemoryStore.get(key);
  if (memory) return memory;
  try {
    const deletions = normalizeDeletions(JSON.parse(window.localStorage.getItem(key) ?? "[]"));
    deletionMemoryStore.set(key, deletions);
    return deletions;
  } catch {
    return [];
  }
}

function saveJournalAccountDeletions(accountKey: string, deletions: JournalAccountDeletion[]) {
  const key = deletionStorageKey(accountKey);
  const normalized = normalizeDeletions(deletions);
  deletionMemoryStore.set(key, normalized);
  try {
    window.localStorage.setItem(key, JSON.stringify(normalized));
  } catch {
    // The in-memory tombstone still protects this browser session.
  }
  return normalized;
}

export function markJournalAccountDeleted(accountKey: string, account: { id: string; name: string }) {
  const current = loadJournalAccountDeletions(accountKey);
  const normalizedName = normalizedAccountName(account.name);
  return saveJournalAccountDeletions(accountKey, [
    ...current.filter((row) => row.id !== account.id && normalizedAccountName(row.name) !== normalizedName),
    { id: account.id, name: account.name, deletedAt: new Date().toISOString() },
  ]);
}

export function clearJournalAccountDeletion(accountKey: string, account: { id?: string; name: string }) {
  const normalizedName = normalizedAccountName(account.name);
  return saveJournalAccountDeletions(
    accountKey,
    loadJournalAccountDeletions(accountKey).filter((row) => (
      (!account.id || row.id !== account.id)
      && normalizedAccountName(row.name) !== normalizedName
    )),
  );
}

export function journalAccountWasDeleted(
  deletions: readonly JournalAccountDeletion[],
  account: { id?: string; name: string },
) {
  const normalizedName = normalizedAccountName(account.name);
  return deletions.some((row) => (
    Boolean(account.id && row.id === account.id)
    || normalizedAccountName(row.name) === normalizedName
  ));
}

export function purgeDeletedJournalAccounts(
  state: JournalState,
  deletions: readonly JournalAccountDeletion[],
): JournalState {
  if (!deletions.length) return state;
  const deletedNames = new Set(deletions.map((row) => normalizedAccountName(row.name)));
  const deletedIds = new Set(deletions.map((row) => row.id).filter(Boolean));
  const keepName = (name: string) => !deletedNames.has(normalizedAccountName(name));
  const next = {
    ...state,
    accounts: state.accounts.filter((account) => !deletedIds.has(account.id) && keepName(account.name)),
    trades: state.trades.filter((trade) => keepName(trade.account)),
    evidence: state.evidence.filter((item) => keepName(item.account)),
    imports: state.imports.filter((batch) => keepName(batch.account)),
  };
  if (
    next.accounts.length === state.accounts.length
    && next.trades.length === state.trades.length
    && next.evidence.length === state.evidence.length
    && next.imports.length === state.imports.length
  ) return state;
  return next;
}
function normalizeState(value: unknown): JournalState {
  if (!value || typeof value !== "object") return { ...EMPTY_JOURNAL_STATE };
  const candidate = value as Partial<JournalState>;
  return {
    version: 1,
    accounts: Array.isArray(candidate.accounts) ? candidate.accounts : [],
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
