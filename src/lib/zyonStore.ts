import type { ZyonChat, ZyonJournalEntry, ZyonMessage } from "@/lib/zyon";

const DB_NAME = "kwantdesk-zyon";
const DB_VERSION = 1;
const STORE_NAME = "workspace";
const STATE_KEY = "primary";

export type ZyonStoredState = {
  messages: ZyonMessage[];
  journal: ZyonJournalEntry[];
  chats?: ZyonChat[];
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

export async function loadZyonState() {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  const database = await openDatabase();
  try {
    return await new Promise<ZyonStoredState | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve(
        (request.result as ZyonStoredState | undefined) ?? null,
      );
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function saveZyonState(state: ZyonStoredState) {
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
