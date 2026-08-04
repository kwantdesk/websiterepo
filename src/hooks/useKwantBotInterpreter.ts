"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildContextChangeMessage,
  buildKwantBotBriefing,
  createKwantBotRuntime,
  interpretKwantBotTick,
  KWANTBOT_RESPONSE_COOLDOWN_MS,
  KWANTBOT_TOUCH_COOLDOWN_MS,
  kwantBotInterpreterId,
  normalizeKwantBotInterpreterMessage,
  normalizeKwantBotMarketContext,
  normalizeKwantBotMemoryEvent,
  pruneKwantBotMemory,
  type KwantBotContextState,
  type KwantBotFeedState,
  type KwantBotInterpreterMessage,
  type KwantBotMarketContext,
  type KwantBotMarketRoot,
  type KwantBotMemoryEvent,
  type KwantBotRuntimeState,
} from "@/lib/kwantBotInterpreter";
import {
  loadKwantBotMarketState,
  saveKwantBotMarketState,
} from "@/lib/kwantBotMarketStore";
import {
  buildKwantBotLearningReview,
  mergeKwantBotLearningReviews,
  type KwantBotLearningCalibration,
  type KwantBotLearningReview,
  type KwantBotLearningSyncState,
} from "@/lib/kwantBotLearning";
import {
  DATABENTO_LIVE_STATUS_EVENT,
  DATABENTO_LIVE_TICK_EVENT,
  readDatabentoLiveStatus,
  type DatabentoLiveStatus,
} from "@/lib/chartLiveEvents";

const ROOTS: KwantBotMarketRoot[] = ["NQ", "ES"];
const MESSAGE_LIMIT = 2_000;
const MEMORY_LIMIT = 5_000;
const INITIAL_LOCAL_MESSAGE_LIMIT = 500;
const INITIAL_LOCAL_MEMORY_LIMIT = 1_000;

type ArchivePageState = {
  messages: { hasMore: boolean; before: string | null };
  memory: { hasMore: boolean; before: string | null };
  contexts: { hasMore: boolean; before: string | null };
};

type ArchivePayload = {
  configured?: boolean;
  messages?: KwantBotInterpreterMessage[];
  memory?: KwantBotMemoryEvent[];
  contexts?: KwantBotMarketContext[];
  page?: ArchivePageState;
};

type RootRecord<T> = Record<KwantBotMarketRoot, T>;

const emptyMessages = (): RootRecord<KwantBotInterpreterMessage[]> => ({ NQ: [], ES: [] });
const emptyMemory = (): RootRecord<KwantBotMemoryEvent[]> => ({ NQ: [], ES: [] });

function objectErrorMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const message = (value as { error?: unknown }).error;
  return typeof message === "string" ? message : "";
}

function normalizedMessages(value: unknown, root: KwantBotMarketRoot) {
  return (Array.isArray(value) ? value : [])
    .map(normalizeKwantBotInterpreterMessage)
    .filter((item): item is KwantBotInterpreterMessage => item?.root === root);
}

function normalizedMemory(value: unknown, root: KwantBotMarketRoot) {
  return (Array.isArray(value) ? value : [])
    .map(normalizeKwantBotMemoryEvent)
    .filter((item): item is KwantBotMemoryEvent => item?.root === root);
}

function mergeById<T extends { id: string; createdAt: string }>(
  local: T[],
  remote: T[],
  limit: number,
) {
  const merged = new Map<string, T>();
  [...remote, ...local].forEach((item) => merged.set(item.id, item));
  return [...merged.values()]
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .slice(-limit);
}

function contextSnapshotKey(context: KwantBotMarketContext) {
  const generatedAt = Date.parse(context.generatedAt);
  const fiveMinuteBucket = Number.isFinite(generatedAt)
    ? Math.floor(generatedAt / (5 * 60_000))
    : Math.floor(Date.now() / (5 * 60_000));
  return `${context.root}:${fiveMinuteBucket}`;
}

function messageCooldownMs(message: KwantBotInterpreterMessage) {
  if (message.kind === "touch") return KWANTBOT_TOUCH_COOLDOWN_MS;
  if (message.kind === "rejection" || message.kind === "acceptance") {
    return KWANTBOT_RESPONSE_COOLDOWN_MS;
  }
  return null;
}

export type UseKwantBotInterpreterResult = {
  selectedRoot: KwantBotMarketRoot;
  selectRoot: (root: KwantBotMarketRoot, channel?: "kwantbot" | "options") => void;
  messages: RootRecord<KwantBotInterpreterMessage[]>;
  memory: RootRecord<KwantBotMemoryEvent[]>;
  learningReviews: KwantBotLearningReview[];
  learningCalibration: RootRecord<KwantBotLearningCalibration | null>;
  learningSyncState: KwantBotLearningSyncState;
  archiveSyncState: KwantBotLearningSyncState;
  archiveHasMore: boolean;
  archiveLoadingOlder: boolean;
  contexts: RootRecord<KwantBotMarketContext | null>;
  contextStates: RootRecord<KwantBotContextState>;
  contextErrors: RootRecord<string | null>;
  livePrices: RootRecord<number | null>;
  lastTickAt: RootRecord<number | null>;
  feedState: KwantBotFeedState;
  unread: RootRecord<number>;
  unreadTotal: number;
  optionsUnread: RootRecord<number>;
  optionsUnreadTotal: number;
  requestBrief: (root?: KwantBotMarketRoot) => void;
  refreshContext: (root: KwantBotMarketRoot) => Promise<void>;
  loadOlderArchive: () => Promise<void>;
};

export function useKwantBotInterpreter(args: {
  initialRoot?: KwantBotMarketRoot;
  panelOpen: boolean;
  optionsPanelOpen?: boolean;
  enabled?: boolean;
}): UseKwantBotInterpreterResult {
  const runtimeEnabled = args.enabled !== false;
  const [selectedRoot, setSelectedRoot] = useState<KwantBotMarketRoot>(args.initialRoot ?? "NQ");
  const [messages, setMessages] = useState<RootRecord<KwantBotInterpreterMessage[]>>(emptyMessages);
  const [memory, setMemory] = useState<RootRecord<KwantBotMemoryEvent[]>>(emptyMemory);
  const [learningReviews, setLearningReviews] = useState<KwantBotLearningReview[]>([]);
  const [learningCalibration, setLearningCalibration] = useState<RootRecord<KwantBotLearningCalibration | null>>({
    NQ: null,
    ES: null,
  });
  const [learningSyncState, setLearningSyncState] = useState<KwantBotLearningSyncState>("local");
  const [archiveSyncState, setArchiveSyncState] = useState<KwantBotLearningSyncState>("local");
  const [archiveHasMore, setArchiveHasMore] = useState(false);
  const [archiveLoadingOlder, setArchiveLoadingOlder] = useState(false);
  const [archiveSyncPulse, setArchiveSyncPulse] = useState(0);
  const [contexts, setContexts] = useState<RootRecord<KwantBotMarketContext | null>>({
    NQ: null,
    ES: null,
  });
  const [contextStates, setContextStates] = useState<RootRecord<KwantBotContextState>>({
    NQ: "loading",
    ES: "loading",
  });
  const [contextErrors, setContextErrors] = useState<RootRecord<string | null>>({
    NQ: null,
    ES: null,
  });
  const [livePrices, setLivePrices] = useState<RootRecord<number | null>>({ NQ: null, ES: null });
  const [lastTickAt, setLastTickAt] = useState<RootRecord<number | null>>({ NQ: null, ES: null });
  const [feedState, setFeedState] = useState<KwantBotFeedState>("connecting");
  const [unread, setUnread] = useState<RootRecord<number>>({ NQ: 0, ES: 0 });
  const [optionsUnread, setOptionsUnread] = useState<RootRecord<number>>({ NQ: 0, ES: 0 });
  const [storeReady, setStoreReady] = useState(false);

  const selectedRootRef = useRef(selectedRoot);
  const panelOpenRef = useRef(args.panelOpen);
  const optionsPanelOpenRef = useRef(Boolean(args.optionsPanelOpen));
  const messagesRef = useRef(messages);
  const memoryRef = useRef(memory);
  const learningReviewsRef = useRef(learningReviews);
  const contextsRef = useRef(contexts);
  const runtimeRef = useRef<RootRecord<KwantBotRuntimeState>>({
    NQ: createKwantBotRuntime(),
    ES: createKwantBotRuntime(),
  });
  const minuteBucketRef = useRef<RootRecord<number | null>>({ NQ: null, ES: null });
  const pendingPricesRef = useRef<RootRecord<number | null>>({ NQ: null, ES: null });
  const pendingTickAtRef = useRef<RootRecord<number | null>>({ NQ: null, ES: null });
  const animationFrameRef = useRef<number | null>(null);
  const contextInFlightRef = useRef<RootRecord<boolean>>({ NQ: false, ES: false });
  const contextFetchedAtRef = useRef<RootRecord<number>>({ NQ: 0, ES: 0 });
  const cloudLearningReadyRef = useRef(false);
  const cloudArchiveReadyRef = useRef(false);
  const archiveSyncInFlightRef = useRef(false);
  const archivedMessageIdsRef = useRef(new Set<string>());
  const archivedMemoryIdsRef = useRef(new Set<string>());
  const archivedContextKeysRef = useRef(new Set<string>());
  const archivePageRef = useRef<ArchivePageState | null>(null);
  const storeHydrationStartedRef = useRef(false);
  const cloudArchiveHydratedRef = useRef(false);
  const cloudLearningHydratedRef = useRef(false);

  useEffect(() => {
    selectedRootRef.current = selectedRoot;
  }, [selectedRoot]);

  useEffect(() => {
    panelOpenRef.current = args.panelOpen;
  }, [args.panelOpen]);

  useEffect(() => {
    optionsPanelOpenRef.current = Boolean(args.optionsPanelOpen);
  }, [args.optionsPanelOpen]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);

  useEffect(() => {
    learningReviewsRef.current = learningReviews;
  }, [learningReviews]);

  useEffect(() => {
    contextsRef.current = contexts;
  }, [contexts]);

  const appendMessages = useCallback((
    root: KwantBotMarketRoot,
    candidates: KwantBotInterpreterMessage[],
  ) => {
    if (!candidates.length) return;
    const recent = [...messagesRef.current[root].slice(-160)];
    const unique = candidates.filter((item) => {
      const previous = [...recent].reverse().find((candidate) => candidate.dedupeKey === item.dedupeKey);
      if (previous) {
        const cooldownMs = messageCooldownMs(item);
        if (cooldownMs === null) return false;
        const previousAt = Date.parse(previous.createdAt);
        const nextAt = Date.parse(item.createdAt);
        if (
          !Number.isFinite(previousAt)
          || !Number.isFinite(nextAt)
          || nextAt - previousAt < cooldownMs
        ) return false;
      }
      recent.push(item);
      return true;
    });
    if (!unique.length) return;

    const nextRootMessages = [...messagesRef.current[root], ...unique].slice(-MESSAGE_LIMIT);
    const nextState = { ...messagesRef.current, [root]: nextRootMessages };
    messagesRef.current = nextState;
    setMessages(nextState);

    const kwantBotCount = unique.filter((item) => item.kind !== "options").length;
    const optionsCount = unique.length - kwantBotCount;
    if (kwantBotCount && (!panelOpenRef.current || selectedRootRef.current !== root)) {
      setUnread((current) => ({
        ...current,
        [root]: Math.min(99, current[root] + kwantBotCount),
      }));
    }
    if (optionsCount && (!optionsPanelOpenRef.current || selectedRootRef.current !== root)) {
      setOptionsUnread((current) => ({
        ...current,
        [root]: Math.min(99, current[root] + optionsCount),
      }));
    }
  }, []);

  const appendMemory = useCallback((
    root: KwantBotMarketRoot,
    candidates: KwantBotMemoryEvent[],
    now = Date.now(),
  ) => {
    if (!candidates.length) return;
    const nextRootMemory = pruneKwantBotMemory(
      [...memoryRef.current[root], ...candidates],
      now,
    );
    const nextState = { ...memoryRef.current, [root]: nextRootMemory };
    memoryRef.current = nextState;
    setMemory(nextState);

    const knownReviewIds = new Set(learningReviewsRef.current.map((review) => review.id));
    const generated = candidates
      .filter((event) => event.type === "outcome" && !knownReviewIds.has(`review-${event.id}`))
      .map((outcome) => buildKwantBotLearningReview({
        outcome,
        memory: nextRootMemory,
        messages: messagesRef.current[root],
        context: contextsRef.current[root],
      }))
      .filter((review): review is KwantBotLearningReview => review !== null);
    if (generated.length) {
      const nextReviews = mergeKwantBotLearningReviews(learningReviewsRef.current, generated);
      learningReviewsRef.current = nextReviews;
      setLearningReviews(nextReviews);
      setLearningSyncState(cloudLearningReadyRef.current ? "syncing" : "local");
    }
  }, []);

  useEffect(() => {
    if (!runtimeEnabled || storeReady || storeHydrationStartedRef.current) return;
    storeHydrationStartedRef.current = true;
    let cancelled = false;
    let settled = false;
    loadKwantBotMarketState()
      .then((stored) => {
        if (cancelled || !stored || stored.version !== 1) return;
        const restoredMessages = {
          NQ: mergeById(
            normalizedMessages(stored.messages?.NQ, "NQ"),
            messagesRef.current.NQ,
            INITIAL_LOCAL_MESSAGE_LIMIT,
          ),
          ES: mergeById(
            normalizedMessages(stored.messages?.ES, "ES"),
            messagesRef.current.ES,
            INITIAL_LOCAL_MESSAGE_LIMIT,
          ),
        };
        const restoredMemory = {
          NQ: pruneKwantBotMemory(mergeById(
            normalizedMemory(stored.memory?.NQ, "NQ"),
            memoryRef.current.NQ,
            INITIAL_LOCAL_MEMORY_LIMIT,
          )).slice(-INITIAL_LOCAL_MEMORY_LIMIT),
          ES: pruneKwantBotMemory(mergeById(
            normalizedMemory(stored.memory?.ES, "ES"),
            memoryRef.current.ES,
            INITIAL_LOCAL_MEMORY_LIMIT,
          )).slice(-INITIAL_LOCAL_MEMORY_LIMIT),
        };
        messagesRef.current = restoredMessages;
        memoryRef.current = restoredMemory;
        setMessages(restoredMessages);
        setMemory(restoredMemory);
        const restoredReviews = Array.isArray(stored.learningReviews)
          ? stored.learningReviews
          : [];
        const knownReviewIds = new Set(restoredReviews.map((review) => review.id));
        const backfilled = ROOTS.flatMap((root) =>
          restoredMemory[root]
            .filter((event) => event.type === "outcome" && !knownReviewIds.has(`review-${event.id}`))
            .map((outcome) => buildKwantBotLearningReview({
              outcome,
              memory: restoredMemory[root],
              messages: restoredMessages[root],
              context: null,
            }))
            .filter((review): review is KwantBotLearningReview => review !== null));
        const nextReviews = mergeKwantBotLearningReviews(restoredReviews, backfilled);
        learningReviewsRef.current = nextReviews;
        setLearningReviews(nextReviews);
        if (stored.selectedRoot === "NQ" || stored.selectedRoot === "ES") {
          selectedRootRef.current = stored.selectedRoot;
          setSelectedRoot(stored.selectedRoot);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        settled = true;
        if (!cancelled) setStoreReady(true);
      });
    return () => {
      cancelled = true;
      if (!settled) storeHydrationStartedRef.current = false;
    };
  }, [runtimeEnabled, storeReady]);

  useEffect(() => {
    if (!runtimeEnabled || !storeReady) return;
    const timer = window.setTimeout(() => {
      saveKwantBotMarketState({
        version: 1,
        selectedRoot,
        messages,
        memory,
        learningReviews,
      }).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [learningReviews, memory, messages, runtimeEnabled, selectedRoot, storeReady]);

  const mergeArchivePage = useCallback((body: ArchivePayload) => {
    const remoteMessages = (Array.isArray(body.messages) ? body.messages : [])
      .map(normalizeKwantBotInterpreterMessage)
      .filter((item): item is KwantBotInterpreterMessage => item !== null);
    const remoteMemory = (Array.isArray(body.memory) ? body.memory : [])
      .map(normalizeKwantBotMemoryEvent)
      .filter((item): item is KwantBotMemoryEvent => item !== null);
    const remoteContexts = (Array.isArray(body.contexts) ? body.contexts : [])
      .map((context) => normalizeKwantBotMarketContext(context))
      .filter((context): context is KwantBotMarketContext => context !== null);
    remoteMessages.forEach((item) => archivedMessageIdsRef.current.add(item.id));
    remoteMemory.forEach((item) => archivedMemoryIdsRef.current.add(item.id));
    remoteContexts.forEach((item) => archivedContextKeysRef.current.add(contextSnapshotKey(item)));

    const nextMessages: RootRecord<KwantBotInterpreterMessage[]> = {
      NQ: mergeById(
        messagesRef.current.NQ,
        remoteMessages.filter((item) => item.root === "NQ"),
        MESSAGE_LIMIT,
      ),
      ES: mergeById(
        messagesRef.current.ES,
        remoteMessages.filter((item) => item.root === "ES"),
        MESSAGE_LIMIT,
      ),
    };
    const nextMemory: RootRecord<KwantBotMemoryEvent[]> = {
      NQ: pruneKwantBotMemory(mergeById(
        memoryRef.current.NQ,
        remoteMemory.filter((item) => item.root === "NQ"),
        MEMORY_LIMIT,
      )).slice(-MEMORY_LIMIT),
      ES: pruneKwantBotMemory(mergeById(
        memoryRef.current.ES,
        remoteMemory.filter((item) => item.root === "ES"),
        MEMORY_LIMIT,
      )).slice(-MEMORY_LIMIT),
    };
    messagesRef.current = nextMessages;
    memoryRef.current = nextMemory;
    setMessages(nextMessages);
    setMemory(nextMemory);
    if (body.page) {
      archivePageRef.current = body.page;
      setArchiveHasMore(
        body.page.messages.hasMore
        || body.page.memory.hasMore
        || body.page.contexts.hasMore,
      );
    }
  }, []);

  useEffect(() => {
    if (!runtimeEnabled || !storeReady || cloudArchiveHydratedRef.current) return;
    cloudArchiveHydratedRef.current = true;
    let cancelled = false;
    let settled = false;
    fetch("/api/kwantbot/archive", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        const body = await response.json() as ArchivePayload;
        if (!response.ok || !body.configured) throw new Error("Cloud archive unavailable.");
        if (cancelled) return;
        mergeArchivePage(body);
        cloudArchiveReadyRef.current = true;
        setArchiveSyncState("synced");
        setArchiveSyncPulse((value) => value + 1);
        settled = true;
      })
      .catch(() => {
        if (cancelled) return;
        settled = true;
        cloudArchiveHydratedRef.current = false;
        cloudArchiveReadyRef.current = false;
        setArchiveSyncState("local");
      });
    return () => {
      cancelled = true;
      if (!settled) cloudArchiveHydratedRef.current = false;
    };
  }, [mergeArchivePage, runtimeEnabled, storeReady]);

  const loadOlderArchive = useCallback(async () => {
    const page = archivePageRef.current;
    if (!page || archiveLoadingOlder || !(
      page.messages.hasMore
      || page.memory.hasMore
      || page.contexts.hasMore
    )) return;

    setArchiveLoadingOlder(true);
    try {
      const params = new URLSearchParams({
        messageLimit: "180",
        memoryLimit: "600",
        contextLimit: "24",
        messagesBefore: page.messages.hasMore && page.messages.before
          ? page.messages.before
          : "1970-01-01T00:00:00.000Z",
        memoryBefore: page.memory.hasMore && page.memory.before
          ? page.memory.before
          : "1970-01-01T00:00:00.000Z",
        contextsBefore: page.contexts.hasMore && page.contexts.before
          ? page.contexts.before
          : "1970-01-01T00:00:00.000Z",
      });
      const response = await fetch(`/api/kwantbot/archive?${params.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = await response.json() as ArchivePayload;
      if (!response.ok || !body.configured) throw new Error("Cloud archive unavailable.");
      mergeArchivePage(body);
    } catch {
      setArchiveSyncState("error");
    } finally {
      setArchiveLoadingOlder(false);
    }
  }, [archiveLoadingOlder, mergeArchivePage]);

  useEffect(() => {
    if (!runtimeEnabled || !storeReady || !cloudArchiveReadyRef.current || archiveSyncInFlightRef.current) return;

    const pendingMessages = ROOTS
      .flatMap((root) => messages[root])
      .filter((item) => !archivedMessageIdsRef.current.has(item.id));
    const pendingMemory = ROOTS
      .flatMap((root) => memory[root])
      .filter((item) => !archivedMemoryIdsRef.current.has(item.id));
    const pendingContexts = ROOTS
      .map((root) => contexts[root])
      .filter((context): context is KwantBotMarketContext => context !== null)
      .map((context) => ({
        snapshotKey: contextSnapshotKey(context),
        context,
      }))
      .filter((item) => !archivedContextKeysRef.current.has(item.snapshotKey));

    if (!pendingMessages.length && !pendingMemory.length && !pendingContexts.length) {
      setArchiveSyncState("synced");
      return;
    }

    const timer = window.setTimeout(() => {
      archiveSyncInFlightRef.current = true;
      setArchiveSyncState("syncing");

      const sync = async () => {
        const messageQueue = [...pendingMessages];
        const memoryQueue = [...pendingMemory];
        const contextQueue = [...pendingContexts];

        while (messageQueue.length || memoryQueue.length || contextQueue.length) {
          const messageBatch = messageQueue.splice(0, 500);
          const memoryBatch = memoryQueue.splice(0, 1_000);
          const contextBatch = contextQueue.splice(0, 24);
          const response = await fetch("/api/kwantbot/archive", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: messageBatch,
              memory: memoryBatch,
              contexts: contextBatch,
            }),
          });
          const body = await response.json() as {
            configured?: boolean;
            ids?: {
              messages?: string[];
              memory?: string[];
              contexts?: string[];
            };
          };
          if (!response.ok || !body.configured) throw new Error("Cloud archive unavailable.");
          (body.ids?.messages ?? messageBatch.map((item) => item.id))
            .forEach((id) => archivedMessageIdsRef.current.add(id));
          (body.ids?.memory ?? memoryBatch.map((item) => item.id))
            .forEach((id) => archivedMemoryIdsRef.current.add(id));
          (body.ids?.contexts ?? contextBatch.map((item) => item.snapshotKey))
            .forEach((id) => archivedContextKeysRef.current.add(id));
        }
      };

      void sync()
        .then(() => setArchiveSyncState("synced"))
        .catch(() => setArchiveSyncState("error"))
        .finally(() => {
          archiveSyncInFlightRef.current = false;
          setArchiveSyncPulse((value) => value + 1);
        });
    }, 1_200);

    return () => window.clearTimeout(timer);
  }, [archiveSyncPulse, contexts, memory, messages, runtimeEnabled, storeReady]);

  useEffect(() => {
    if (!runtimeEnabled || !storeReady || cloudLearningHydratedRef.current) return;
    cloudLearningHydratedRef.current = true;
    let cancelled = false;
    let settled = false;
    fetch("/api/kwantbot/learning-reviews", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        const body = await response.json() as {
          configured?: boolean;
          reviews?: KwantBotLearningReview[];
          calibration?: KwantBotLearningCalibration[];
        };
        if (!response.ok || !body.configured) throw new Error("Cloud learning journal unavailable.");
        if (cancelled) return;
        cloudLearningReadyRef.current = true;
        const nextReviews = mergeKwantBotLearningReviews(
          learningReviewsRef.current,
          Array.isArray(body.reviews) ? body.reviews : [],
        );
        learningReviewsRef.current = nextReviews;
        setLearningReviews(nextReviews);
        if (Array.isArray(body.calibration)) {
          const byRoot: RootRecord<KwantBotLearningCalibration | null> = { NQ: null, ES: null };
          body.calibration.forEach((entry) => {
            if (entry?.root === "NQ" || entry?.root === "ES") byRoot[entry.root] = entry;
          });
          setLearningCalibration(byRoot);
        }
        setLearningSyncState("synced");
        settled = true;
      })
      .catch(() => {
        if (cancelled) return;
        settled = true;
        cloudLearningHydratedRef.current = false;
        cloudLearningReadyRef.current = false;
        setLearningSyncState("local");
      });
    return () => {
      cancelled = true;
      if (!settled) cloudLearningHydratedRef.current = false;
    };
  }, [runtimeEnabled, storeReady]);

  useEffect(() => {
    if (!runtimeEnabled || !storeReady || !cloudLearningReadyRef.current) return;
    const pending = learningReviews.filter((review) => review.syncState === "local").slice(-500);
    if (!pending.length) return;
    setLearningSyncState("syncing");
    const timer = window.setTimeout(() => {
      fetch("/api/kwantbot/learning-reviews", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews: pending }),
      })
        .then(async (response) => {
          const body = await response.json() as {
            configured?: boolean;
            ids?: string[];
            calibration?: KwantBotLearningCalibration[];
          };
          if (!response.ok || !body.configured) throw new Error("Cloud learning journal unavailable.");
          const savedIds = new Set(body.ids ?? pending.map((review) => review.id));
          const nextReviews = learningReviewsRef.current.map((review) =>
            savedIds.has(review.id) ? { ...review, syncState: "synced" as const } : review);
          learningReviewsRef.current = nextReviews;
          setLearningReviews(nextReviews);
          if (Array.isArray(body.calibration)) {
            setLearningCalibration((current) => {
              const next = { ...current };
              body.calibration?.forEach((entry) => {
                if (entry?.root === "NQ" || entry?.root === "ES") next[entry.root] = entry;
              });
              return next;
            });
          }
          setLearningSyncState("synced");
        })
        .catch(() => {
          cloudLearningReadyRef.current = false;
          const pendingIds = new Set(pending.map((review) => review.id));
          const nextReviews = learningReviewsRef.current.map((review) =>
            pendingIds.has(review.id) ? { ...review, syncState: "error" as const } : review);
          learningReviewsRef.current = nextReviews;
          setLearningReviews(nextReviews);
          setLearningSyncState("error");
        });
    }, 1_200);
    return () => window.clearTimeout(timer);
  }, [learningReviews, runtimeEnabled, storeReady]);

  const fetchContext = useCallback(async (root: KwantBotMarketRoot) => {
    if (contextInFlightRef.current[root]) return;
    contextInFlightRef.current[root] = true;
    contextFetchedAtRef.current[root] = Date.now();
    if (!contextsRef.current[root]) {
      setContextStates((current) => ({ ...current, [root]: "loading" }));
    }
    try {
      const response = await fetch(`/api/kwantbot/context?root=${root}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const rawBody = await response.json() as unknown;
      const errorMessage = objectErrorMessage(rawBody);
      if (!response.ok) throw new Error(errorMessage || `Unable to load ${root} market context.`);
      const body = normalizeKwantBotMarketContext(rawBody, root);
      if (!body) throw new Error(`Invalid ${root} market context was ignored while the feed reconnects.`);

      const previous = contextsRef.current[root];
      const nextContexts = { ...contextsRef.current, [root]: body };
      contextsRef.current = nextContexts;
      setContexts(nextContexts);
      setContextStates((current) => ({
        ...current,
        [root]: body.status === "LIVE" && body.futuresStatus !== "UNAVAILABLE" ? "live" : "stale",
      }));
      setContextErrors((current) => ({ ...current, [root]: null }));

      const now = Date.now();
      const contextMessage = buildContextChangeMessage(previous, body, now);
      if (contextMessage) {
        appendMessages(root, [contextMessage]);
        appendMemory(root, [{
          id: kwantBotInterpreterId("memory-context"),
          root,
          type: "context",
          createdAt: new Date(now).toISOString(),
          price: pendingPricesRef.current[root] ?? body.currentPrice ?? undefined,
          detail: `${body.options.gammaStateLabel}; ${body.oneLiner}`,
        }], now);
      }
    } catch (error) {
      setContextStates((current) => ({
        ...current,
        [root]: contextsRef.current[root] ? "stale" : "error",
      }));
      setContextErrors((current) => ({
        ...current,
        [root]: error instanceof Error ? error.message : `Unable to load ${root} market context.`,
      }));
    } finally {
      contextFetchedAtRef.current[root] = Date.now();
      contextInFlightRef.current[root] = false;
    }
  }, [appendMemory, appendMessages]);

  useEffect(() => {
    if (!runtimeEnabled) return;
    ROOTS.forEach((root) => void fetchContext(root));
    const timer = window.setInterval(() => {
      const now = Date.now();
      ROOTS.forEach((root) => {
        const refreshWindow = selectedRootRef.current === root ? 20_000 : 60_000;
        if (now - contextFetchedAtRef.current[root] >= refreshWindow) {
          void fetchContext(root);
        }
      });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [fetchContext, runtimeEnabled]);

  const flushLivePrices = useCallback(() => {
    animationFrameRef.current = null;
    setLivePrices((current) => ({
      NQ: pendingPricesRef.current.NQ ?? current.NQ,
      ES: pendingPricesRef.current.ES ?? current.ES,
    }));
    setLastTickAt((current) => ({
      NQ: pendingTickAtRef.current.NQ ?? current.NQ,
      ES: pendingTickAtRef.current.ES ?? current.ES,
    }));
  }, []);

  useEffect(() => {
    if (!runtimeEnabled) return;
    const currentStatus = readDatabentoLiveStatus();
    if (currentStatus) setFeedState(currentStatus);

    const receiveTick = (event: Event) => {
      const tick = (event as CustomEvent<{
        instrument?: string;
        mid?: number;
        bid?: number;
        ask?: number;
      }>).detail;
      if (!tick) return;
      const instrument = String(tick.instrument ?? "").toUpperCase();
      const root: KwantBotMarketRoot | null = instrument.startsWith("NQ")
        ? "NQ"
        : instrument.startsWith("ES")
          ? "ES"
          : null;
      const price = Number(tick.mid ?? (Number(tick.bid) + Number(tick.ask)) / 2);
      if (!root || !Number.isFinite(price) || price <= 0) return;

      setFeedState("live");
      const now = Date.now();
      pendingPricesRef.current[root] = price;
      pendingTickAtRef.current[root] = now;
      if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame(flushLivePrices);
      }

      const additions: KwantBotMemoryEvent[] = [];
      const minuteBucket = Math.floor(now / 60_000);
      if (minuteBucketRef.current[root] !== minuteBucket) {
        minuteBucketRef.current[root] = minuteBucket;
        additions.push({
          id: kwantBotInterpreterId("memory-price"),
          root,
          type: "price",
          createdAt: new Date(now).toISOString(),
          price,
        });
      }

      const result = interpretKwantBotTick({
        root,
        price,
        now,
        context: contextsRef.current[root],
        memory: memoryRef.current[root],
        runtime: runtimeRef.current[root],
      });
      runtimeRef.current[root] = result.runtime;
      appendMessages(root, result.messages);
      appendMemory(root, [...additions, ...result.memory], now);
    };

    const receiveStatus = (event: Event) => {
      const status = (event as CustomEvent<DatabentoLiveStatus>).detail;
      if (status === "live" || status === "connecting" || status === "reconnecting") {
        setFeedState(status);
      }
    };

    window.addEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
    window.addEventListener(DATABENTO_LIVE_STATUS_EVENT, receiveStatus);
    return () => {
      window.removeEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
      window.removeEventListener(DATABENTO_LIVE_STATUS_EVENT, receiveStatus);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [appendMemory, appendMessages, flushLivePrices, runtimeEnabled]);

  const selectRoot = useCallback((
    root: KwantBotMarketRoot,
    channel: "kwantbot" | "options" = "kwantbot",
  ) => {
    selectedRootRef.current = root;
    setSelectedRoot(root);
    if (channel === "options") {
      setOptionsUnread((current) => ({ ...current, [root]: 0 }));
    } else {
      setUnread((current) => ({ ...current, [root]: 0 }));
    }
    if (Date.now() - contextFetchedAtRef.current[root] >= 10_000) {
      void fetchContext(root);
    }
  }, [fetchContext]);

  useEffect(() => {
    if (!args.panelOpen) return;
    setUnread((current) => ({ ...current, [selectedRoot]: 0 }));
  }, [args.panelOpen, selectedRoot]);

  useEffect(() => {
    if (!args.optionsPanelOpen) return;
    setOptionsUnread((current) => ({ ...current, [selectedRoot]: 0 }));
  }, [args.optionsPanelOpen, selectedRoot]);

  const requestBrief = useCallback((root = selectedRootRef.current) => {
    const context = contextsRef.current[root];
    const price = pendingPricesRef.current[root] ?? context?.currentPrice ?? null;
    if (!context || price === null) return;
    const now = Date.now();
    appendMessages(root, [
      buildKwantBotBriefing({
        root,
        context,
        memory: memoryRef.current[root],
        price,
        now,
        manual: true,
      }),
    ]);
  }, [appendMessages]);

  const unreadTotal = useMemo(() => unread.NQ + unread.ES, [unread]);
  const optionsUnreadTotal = useMemo(
    () => optionsUnread.NQ + optionsUnread.ES,
    [optionsUnread],
  );

  return {
    selectedRoot,
    selectRoot,
    messages,
    memory,
    learningReviews,
    learningCalibration,
    learningSyncState,
    archiveSyncState,
    archiveHasMore,
    archiveLoadingOlder,
    contexts,
    contextStates,
    contextErrors,
    livePrices,
    lastTickAt,
    feedState,
    unread,
    unreadTotal,
    optionsUnread,
    optionsUnreadTotal,
    requestBrief,
    refreshContext: fetchContext,
    loadOlderArchive,
  };
}
