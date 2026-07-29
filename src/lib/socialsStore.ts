import {
  EMPTY_SOCIAL_STATE,
  SOCIAL_OBJECT_TYPES,
  SOCIAL_SCOPES,
  normalizeSocialProfile,
  type SocialObject,
  type SocialState,
} from "@/lib/socials";

const DATABASE_NAME = "kwantdesk-socials";
const DATABASE_VERSION = 1;
const STORE_NAME = "account-socials";
const memoryStore = new Map<string, SocialState>();
let databasePromise: Promise<IDBDatabase> | null = null;
const STORAGE_TIMEOUT_MS = 1_200;

function storageKey(accountKey: string) {
  return `kwantdesk:socials:${accountKey || "local"}:v1`;
}

function normalizeObject(value: unknown): SocialObject | null {
  if (!value || typeof value !== "object") return null;
  const object = value as Partial<SocialObject>;
  if (
    typeof object.id !== "string"
    || typeof object.userId !== "string"
    || typeof object.objectType !== "string"
    || !SOCIAL_OBJECT_TYPES.includes(object.objectType as SocialObject["objectType"])
    || typeof object.scope !== "string"
    || !SOCIAL_SCOPES.includes(object.scope as SocialObject["scope"])
    || !object.payload
    || typeof object.payload !== "object"
  ) return null;
  return {
    id: object.id,
    userId: object.userId,
    authorLabel: typeof object.authorLabel === "string" ? object.authorLabel : "Kwant Trader",
    objectType: object.objectType as SocialObject["objectType"],
    scope: object.scope as SocialObject["scope"],
    deskId: typeof object.deskId === "string" ? object.deskId : null,
    parentId: typeof object.parentId === "string" ? object.parentId : null,
    payload: object.objectType === "profile"
      ? normalizeSocialProfile(object.payload, typeof object.authorLabel === "string" ? object.authorLabel : "Kwant Trader")
      : object.payload as Record<string, unknown>,
    createdAt: typeof object.createdAt === "string" ? object.createdAt : new Date(0).toISOString(),
    updatedAt: typeof object.updatedAt === "string" ? object.updatedAt : new Date(0).toISOString(),
    cloudSaved: Boolean(object.cloudSaved),
  };
}

export function normalizeSocialState(value: unknown): SocialState {
  if (!value || typeof value !== "object") return { ...EMPTY_SOCIAL_STATE };
  const candidate = value as Partial<SocialState>;
  return {
    version: 1,
    objects: Array.isArray(candidate.objects)
      ? candidate.objects.map(normalizeObject).filter((object): object is SocialObject => Boolean(object)).slice(0, 5_000)
      : [],
    cloud: Boolean(candidate.cloud),
    loadedAt: typeof candidate.loadedAt === "string" ? candidate.loadedAt : "",
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
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("Unable to open Socials storage."));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Socials storage is busy."));
    };
  });
  return databasePromise;
}

function withStorageTimeout<T>(operation: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Socials storage timed out.")), STORAGE_TIMEOUT_MS);
    operation.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        window.clearTimeout(timer);
        reject(reason);
      },
    );
  });
}

export async function loadSocialState(accountKey: string) {
  const key = storageKey(accountKey);
  const memory = memoryStore.get(key);
  if (memory) return normalizeSocialState(memory);
  try {
    const database = await withStorageTimeout(openDatabase());
    const stored = await withStorageTimeout(new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to read Socials storage."));
    }));
    const normalized = normalizeSocialState(stored);
    memoryStore.set(key, normalized);
    return normalized;
  } catch {
    try {
      const fallback = window.localStorage.getItem(key);
      return normalizeSocialState(fallback ? JSON.parse(fallback) : null);
    } catch {
      return { ...EMPTY_SOCIAL_STATE };
    }
  }
}

export async function saveSocialState(accountKey: string, state: SocialState) {
  const key = storageKey(accountKey);
  const normalized = normalizeSocialState(state);
  memoryStore.set(key, normalized);
  try {
    const database = await withStorageTimeout(openDatabase());
    await withStorageTimeout(new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(normalized, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save Socials storage."));
    }));
    return true;
  } catch {
    try {
      const compact = {
        ...normalized,
        objects: normalized.objects.map((object) => ({
          ...object,
          payload: object.objectType === "receipt" && typeof object.payload.evidenceDataUrl === "string"
            ? { ...object.payload, evidenceDataUrl: "" }
            : object.objectType === "receipt-evidence" && typeof object.payload.dataUrl === "string"
              ? { ...object.payload, dataUrl: "" }
              : object.payload,
        })).slice(0, 800),
      };
      window.localStorage.setItem(key, JSON.stringify(compact));
      return true;
    } catch {
      return false;
    }
  }
}
