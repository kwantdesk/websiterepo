"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildContextChangeMessage,
  buildKwantBotBriefing,
  createKwantBotRuntime,
  interpretKwantBotTick,
  kwantBotInterpreterId,
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

const ROOTS: KwantBotMarketRoot[] = ["NQ", "ES"];
const MESSAGE_LIMIT = 500;

type RootRecord<T> = Record<KwantBotMarketRoot, T>;

const emptyMessages = (): RootRecord<KwantBotInterpreterMessage[]> => ({ NQ: [], ES: [] });
const emptyMemory = (): RootRecord<KwantBotMemoryEvent[]> => ({ NQ: [], ES: [] });

export type UseKwantBotInterpreterResult = {
  selectedRoot: KwantBotMarketRoot;
  selectRoot: (root: KwantBotMarketRoot) => void;
  messages: RootRecord<KwantBotInterpreterMessage[]>;
  memory: RootRecord<KwantBotMemoryEvent[]>;
  contexts: RootRecord<KwantBotMarketContext | null>;
  contextStates: RootRecord<KwantBotContextState>;
  contextErrors: RootRecord<string | null>;
  livePrices: RootRecord<number | null>;
  lastTickAt: RootRecord<number | null>;
  feedState: KwantBotFeedState;
  unread: RootRecord<number>;
  unreadTotal: number;
  requestBrief: (root?: KwantBotMarketRoot) => void;
};

export function useKwantBotInterpreter(args: {
  initialRoot?: KwantBotMarketRoot;
  panelOpen: boolean;
}): UseKwantBotInterpreterResult {
  const [selectedRoot, setSelectedRoot] = useState<KwantBotMarketRoot>(args.initialRoot ?? "NQ");
  const [messages, setMessages] = useState<RootRecord<KwantBotInterpreterMessage[]>>(emptyMessages);
  const [memory, setMemory] = useState<RootRecord<KwantBotMemoryEvent[]>>(emptyMemory);
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
  const [storeReady, setStoreReady] = useState(false);

  const selectedRootRef = useRef(selectedRoot);
  const panelOpenRef = useRef(args.panelOpen);
  const messagesRef = useRef(messages);
  const memoryRef = useRef(memory);
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

  useEffect(() => {
    selectedRootRef.current = selectedRoot;
  }, [selectedRoot]);

  useEffect(() => {
    panelOpenRef.current = args.panelOpen;
  }, [args.panelOpen]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);

  useEffect(() => {
    contextsRef.current = contexts;
  }, [contexts]);

  const appendMessages = useCallback((
    root: KwantBotMarketRoot,
    candidates: KwantBotInterpreterMessage[],
  ) => {
    if (!candidates.length) return;
    const recentKeys = new Set(messagesRef.current[root].slice(-160).map((item) => item.dedupeKey));
    const unique = candidates.filter((item) => {
      if (recentKeys.has(item.dedupeKey)) return false;
      recentKeys.add(item.dedupeKey);
      return true;
    });
    if (!unique.length) return;

    const nextRootMessages = [...messagesRef.current[root], ...unique].slice(-MESSAGE_LIMIT);
    const nextState = { ...messagesRef.current, [root]: nextRootMessages };
    messagesRef.current = nextState;
    setMessages(nextState);

    if (!panelOpenRef.current || selectedRootRef.current !== root) {
      setUnread((current) => ({
        ...current,
        [root]: Math.min(99, current[root] + unique.length),
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadKwantBotMarketState()
      .then((stored) => {
        if (cancelled || !stored || stored.version !== 1) return;
        const restoredMessages = {
          NQ: Array.isArray(stored.messages?.NQ) ? stored.messages.NQ.slice(-MESSAGE_LIMIT) : [],
          ES: Array.isArray(stored.messages?.ES) ? stored.messages.ES.slice(-MESSAGE_LIMIT) : [],
        };
        const restoredMemory = {
          NQ: pruneKwantBotMemory(Array.isArray(stored.memory?.NQ) ? stored.memory.NQ : []),
          ES: pruneKwantBotMemory(Array.isArray(stored.memory?.ES) ? stored.memory.ES : []),
        };
        messagesRef.current = restoredMessages;
        memoryRef.current = restoredMemory;
        setMessages(restoredMessages);
        setMemory(restoredMemory);
        if (stored.selectedRoot === "NQ" || stored.selectedRoot === "ES") {
          selectedRootRef.current = stored.selectedRoot;
          setSelectedRoot(stored.selectedRoot);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setStoreReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storeReady) return;
    const timer = window.setTimeout(() => {
      saveKwantBotMarketState({
        version: 1,
        selectedRoot,
        messages,
        memory,
      }).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [memory, messages, selectedRoot, storeReady]);

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
      const body = await response.json() as KwantBotMarketContext & { error?: string };
      if (!response.ok) throw new Error(body.error || `Unable to load ${root} market context.`);

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
    if (!storeReady) return;
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
  }, [fetchContext, storeReady]);

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
    if (!storeReady) return;
    let source: EventSource | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setFeedState((current) => current === "live" ? "reconnecting" : "connecting");
      source = new EventSource("/api/databento/live?symbols=NQ.v.0%2CES.v.0");
      source.addEventListener("status", () => setFeedState("live"));
      source.addEventListener("feed-error", () => setFeedState("reconnecting"));
      source.onerror = () => setFeedState("reconnecting");
      source.onmessage = (event) => {
        let tick: {
          instrument?: string;
          mid?: number;
          bid?: number;
          ask?: number;
        };
        try {
          tick = JSON.parse(event.data) as typeof tick;
        } catch {
          return;
        }
        const instrument = String(tick.instrument ?? "").toUpperCase();
        const root: KwantBotMarketRoot | null = instrument.startsWith("NQ")
          ? "NQ"
          : instrument.startsWith("ES")
            ? "ES"
            : null;
        const price = Number(tick.mid ?? (Number(tick.bid) + Number(tick.ask)) / 2);
        if (!root || !Number.isFinite(price) || price <= 0) return;

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
    };

    connect();
    return () => {
      cancelled = true;
      source?.close();
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [appendMemory, appendMessages, flushLivePrices, storeReady]);

  const selectRoot = useCallback((root: KwantBotMarketRoot) => {
    selectedRootRef.current = root;
    setSelectedRoot(root);
    setUnread((current) => ({ ...current, [root]: 0 }));
    if (Date.now() - contextFetchedAtRef.current[root] >= 10_000) {
      void fetchContext(root);
    }
  }, [fetchContext]);

  useEffect(() => {
    if (!args.panelOpen) return;
    setUnread((current) => ({ ...current, [selectedRoot]: 0 }));
  }, [args.panelOpen, selectedRoot]);

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

  return {
    selectedRoot,
    selectRoot,
    messages,
    memory,
    contexts,
    contextStates,
    contextErrors,
    livePrices,
    lastTickAt,
    feedState,
    unread,
    unreadTotal,
    requestBrief,
  };
}
