const DB_NAME = "kwantdesk-chat";
const DB_VERSION = 1;
const STORE_NAME = "conversations";
const CONVERSATION_KEY = "kwantbot";
const LEGACY_OWNER_KEY = "kwantdesk:kwantbot-cache-owner:v1";

function accountConversationKey(accountKey: string) {
  return `${CONVERSATION_KEY}:${accountKey.trim() || "local"}`;
}

function openChatDatabase() {
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

export async function loadKwantBotConversation<T>(accountKey: string) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  const database = await openChatDatabase();
  try {
    const scoped = await new Promise<T | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(accountConversationKey(accountKey));
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    if (scoped !== null) return scoped;

    const legacyOwner = window.localStorage.getItem(LEGACY_OWNER_KEY);
    if (legacyOwner && legacyOwner !== accountKey) return null;
    const legacy = await new Promise<T | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(CONVERSATION_KEY);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    if (legacy === null) return null;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(legacy, accountConversationKey(accountKey));
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

export async function saveKwantBotConversation<T>(accountKey: string, conversation: T) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const database = await openChatDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(conversation, accountConversationKey(accountKey));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
