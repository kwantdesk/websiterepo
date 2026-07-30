import type { ZyonChat, ZyonFolder, ZyonJournalEntry, ZyonMessage } from "@/lib/zyon";

const DB_NAME = "kwantdesk-zyon";
const DB_VERSION = 1;
const STORE_NAME = "workspace";
const STATE_KEY = "primary";
const LEGACY_OWNER_KEY = "kwantdesk:zyon-cache-owner:v1";

function accountStateKey(accountKey: string) {
  return `${STATE_KEY}:${accountKey.trim() || "local"}`;
}

export type ZyonStoredState = {
  messages: ZyonMessage[];
  journal: ZyonJournalEntry[];
  chats?: ZyonChat[];
  folders?: ZyonFolder[];
  activeChatId?: string;
  messagesByChat?: Record<string, ZyonMessage[]>;
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

export async function loadZyonState(accountKey: string) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  const database = await openDatabase();
  try {
    const scoped = await new Promise<ZyonStoredState | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(accountStateKey(accountKey));
      request.onsuccess = () => resolve(
        (request.result as ZyonStoredState | undefined) ?? null,
      );
      request.onerror = () => reject(request.error);
    });
    if (scoped !== null) return scoped;

    const legacyOwner = window.localStorage.getItem(LEGACY_OWNER_KEY);
    if (legacyOwner && legacyOwner !== accountKey) return null;
    const legacy = await new Promise<ZyonStoredState | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve(
        (request.result as ZyonStoredState | undefined) ?? null,
      );
      request.onerror = () => reject(request.error);
    });
    if (legacy === null) return null;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(legacy, accountStateKey(accountKey));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    window.localStorage.setItem(LEGACY_OWNER_KEY, accountKey);
    return legacy;
  } finally {
    database.close();
  }
}

export async function saveZyonState(accountKey: string, state: ZyonStoredState) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(state, accountStateKey(accountKey));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
