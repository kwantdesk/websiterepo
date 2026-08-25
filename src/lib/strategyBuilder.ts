import { writeProtectedItem } from "./browserStorageQuota.ts";

export type StrategyBuilderMode = "research" | "pro" | "fast";

export type StrategyBuilderStoredMessage = {
  role: "user" | "assistant";
  content: string;
  meta?: Record<string, unknown>;
};

export type StrategyBuilderThread = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  model: StrategyBuilderMode;
  messages: StrategyBuilderStoredMessage[];
};

export type StrategyBuilderWorkspace = {
  currentThreadId: string | null;
  threads: StrategyBuilderThread[];
};

const STRATEGY_BUILDER_STORAGE_PREFIX = "kwantify-strategy-builder";
export const LOCAL_STRATEGY_BUILDER_ACCOUNT_ID = "local-default";

function sortThreadsNewestFirst(threads: StrategyBuilderThread[]) {
  return [...threads].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function hasWindow() {
  return typeof window !== "undefined";
}

function storageKey(accountId: string) {
  return `${STRATEGY_BUILDER_STORAGE_PREFIX}:${accountId}:workspace`;
}

function summarizeThread(messages: StrategyBuilderStoredMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content?.trim() ?? "";
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")
    ?.content?.replace(/\s+/g, " ")
    .trim() ?? "";

  const titleSource = firstUserMessage || "New strategy chat";
  const previewSource = latestAssistant || firstUserMessage || "Start building a strategy.";

  return {
    title: titleSource.length > 64 ? `${titleSource.slice(0, 61)}...` : titleSource,
    preview: previewSource.length > 96 ? `${previewSource.slice(0, 93)}...` : previewSource,
  };
}

export function createStrategyBuilderThread(model: StrategyBuilderMode): StrategyBuilderThread {
  return {
    id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "New strategy chat",
    preview: "Start building a strategy.",
    updatedAt: new Date().toISOString(),
    model,
    messages: [],
  };
}

export function loadStrategyBuilderWorkspace(
  accountId = LOCAL_STRATEGY_BUILDER_ACCOUNT_ID,
): StrategyBuilderWorkspace | null {
  if (!hasWindow()) return null;

  try {
    const raw = window.localStorage.getItem(storageKey(accountId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StrategyBuilderWorkspace>;
    if (!Array.isArray(parsed.threads)) {
      return null;
    }

    const threads = parsed.threads
      .filter((thread): thread is StrategyBuilderThread => Boolean(thread && typeof thread.id === "string"))
      .map((thread) => ({
        id: thread.id,
        title: typeof thread.title === "string" ? thread.title : "New strategy chat",
        preview: typeof thread.preview === "string" ? thread.preview : "Start building a strategy.",
        updatedAt: typeof thread.updatedAt === "string" ? thread.updatedAt : new Date().toISOString(),
        model:
          thread.model === "research" || thread.model === "pro" || thread.model === "fast"
            ? thread.model
            : "pro",
        messages: Array.isArray(thread.messages)
          ? thread.messages.filter(
              (message): message is StrategyBuilderStoredMessage =>
                Boolean(
                  message &&
                    (message.role === "user" || message.role === "assistant") &&
                    typeof message.content === "string",
                ),
            )
          : [],
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return {
      currentThreadId:
        typeof parsed.currentThreadId === "string" && threads.some((thread) => thread.id === parsed.currentThreadId)
          ? parsed.currentThreadId
          : threads[0]?.id ?? null,
      threads,
    };
  } catch {
    return null;
  }
}

export function saveStrategyBuilderWorkspace(
  workspace: StrategyBuilderWorkspace,
  accountId = LOCAL_STRATEGY_BUILDER_ACCOUNT_ID,
) {
  if (!hasWindow()) return;
  writeProtectedItem(storageKey(accountId), JSON.stringify(workspace));
}

export function updateStrategyBuilderThread(
  threads: StrategyBuilderThread[],
  threadId: string,
  messages: StrategyBuilderStoredMessage[],
  model: StrategyBuilderMode,
) {
  const summary = summarizeThread(messages);
  const updatedThread: StrategyBuilderThread = {
    id: threadId,
    title: summary.title,
    preview: summary.preview,
    updatedAt: new Date().toISOString(),
    model,
    messages,
  };

  const nextThreads = sortThreadsNewestFirst([updatedThread, ...threads.filter((thread) => thread.id !== threadId)]);

  return nextThreads;
}
