"use client";

import Image from "next/image";
import {
  Activity,
  Bot,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  CircleGauge,
  FileText,
  Folder,
  FolderOpen,
  ImagePlus,
  Loader2,
  MessageSquareText,
  Paperclip,
  Plus,
  Radio,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import type { UseKwantBotInterpreterResult } from "@/hooks/useKwantBotInterpreter";
import { formatKwantBotPrice } from "@/lib/kwantBotInterpreter";
import {
  isZyonModelKey,
  ZYON_MODELS,
  zyonId,
  type ZyonAttachment,
  type ZyonJournalEntry,
  type ZyonMarketRoot,
  type ZyonMessage,
  type ZyonModelKey,
} from "@/lib/zyon";
import { loadZyonState, saveZyonState } from "@/lib/zyonStore";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;
const WELCOME_MESSAGE: ZyonMessage = {
  id: "zyon-welcome",
  role: "assistant",
  content: "I’m ZYON. I can compare your discretionary read with live KwantBot context, inspect chart screenshots, challenge confirmation bias, and keep the useful parts in your trading journal.",
  createdAt: "",
  model: "opus-5",
};

const QUICK_PROMPTS = [
  {
    label: "Review a chart",
    prompt: "Review the attached chart. Separate observation, interpretation, trade condition, and invalidation.",
    icon: ImagePlus,
  },
  {
    label: "Check my thesis",
    prompt: "Challenge my current trade thesis against the live KwantBot context. Tell me what confirms it and what invalidates it.",
    icon: ShieldCheck,
  },
  {
    label: "Journal a trade",
    prompt: "Journal this trade for me: ",
    icon: FileText,
  },
  {
    label: "Build scenarios",
    prompt: "Build a concise bull, bear, and no-trade scenario from the current market context.",
    icon: BrainCircuit,
  },
] as const;

function isImage(attachment: ZyonAttachment) {
  return attachment.type.startsWith("image/");
}

function fileToAttachment(file: File) {
  return new Promise<ZyonAttachment>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: zyonId("zyon-file"),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      dataUrl: typeof reader.result === "string" ? reader.result : "",
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function mergeJournal(local: ZyonJournalEntry[], remote: ZyonJournalEntry[]) {
  const entries = new Map<string, ZyonJournalEntry>();
  [...local, ...remote].forEach((entry) => {
    const previous = entries.get(entry.id);
    entries.set(entry.id, previous
      ? { ...previous, ...entry, cloudSaved: previous.cloudSaved || entry.cloudSaved }
      : entry);
  });
  return [...entries.values()]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 500);
}

function messageAttachments(attachments: ZyonAttachment[] | undefined) {
  if (!attachments?.length) return null;
  return (
    <div className={`mb-2 grid gap-2 ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.dataUrl}
          download={attachment.name}
          className="group overflow-hidden rounded-xl border border-border/80 bg-background/35"
        >
          {isImage(attachment) ? (
            <Image
              src={attachment.dataUrl}
              alt={attachment.name}
              width={620}
              height={420}
              unoptimized
              className="max-h-64 w-full object-cover transition duration-300 group-hover:scale-[1.01]"
            />
          ) : (
            <span className="flex min-h-16 items-center gap-3 px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-medium text-foreground">{attachment.name}</span>
                <span className="mt-0.5 block text-[9px] text-muted">{Math.max(1, Math.round(attachment.size / 1024))} KB</span>
              </span>
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

export default function ZyonWorkspace({
  interpreter,
}: {
  interpreter: UseKwantBotInterpreterResult;
}) {
  const [model, setModel] = useState<ZyonModelKey>(() => {
    if (typeof window === "undefined") return "opus-5";
    const saved = window.localStorage.getItem("kwantdesk:zyon:model");
    return isZyonModelKey(saved) ? saved : "opus-5";
  });
  const [online, setOnline] = useState(true);
  const [messages, setMessages] = useState<ZyonMessage[]>([]);
  const [journal, setJournal] = useState<ZyonJournalEntry[]>([]);
  const [storeReady, setStoreReady] = useState(false);
  const [cloudJournal, setCloudJournal] = useState<"checking" | "synced" | "local">("checking");
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ZyonAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [journalSearch, setJournalSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<{ inputTokens: number | null; outputTokens: number | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedRoot = interpreter.selectedRoot;
  const context = interpreter.contexts[selectedRoot];
  const currentPrice = interpreter.livePrices[selectedRoot] ?? context?.currentPrice ?? null;
  const contextState = interpreter.contextStates[selectedRoot];
  const rootMessages = interpreter.messages[selectedRoot];
  const rootMemory = interpreter.memory[selectedRoot];
  const learningReviews = interpreter.learningReviews.filter((review) => review.root === selectedRoot);

  useEffect(() => {
    let active = true;
    loadZyonState()
      .then((saved) => {
        if (!active) return;
        setMessages(saved?.messages?.length ? saved.messages : [WELCOME_MESSAGE]);
        setJournal(Array.isArray(saved?.journal) ? saved.journal : []);
      })
      .catch(() => {
        if (active) setMessages([WELCOME_MESSAGE]);
      })
      .finally(() => {
        if (active) setStoreReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!storeReady) return;
    void saveZyonState({
      messages: messages.slice(-120),
      journal: journal.slice(0, 500),
    });
  }, [journal, messages, storeReady]);

  useEffect(() => {
    let active = true;
    fetch("/api/zyon/journal", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as {
          entries?: ZyonJournalEntry[];
          cloud?: boolean;
        };
        if (!response.ok) throw new Error();
        if (!active) return;
        if (Array.isArray(payload.entries)) {
          setJournal((current) => mergeJournal(current, payload.entries ?? []));
        }
        setCloudJournal(payload.cloud ? "synced" : "local");
      })
      .catch(() => {
        if (active) setCloudJournal("local");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("kwantdesk:zyon:model", model);
  }, [model]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, sending]);

  const filteredJournal = useMemo(() => {
    const query = journalSearch.trim().toLowerCase();
    if (!query) return journal;
    return journal.filter((entry) =>
      `${entry.title} ${entry.summary} ${entry.body} ${entry.tags.join(" ")} ${entry.root}`
        .toLowerCase()
        .includes(query),
    );
  }, [journal, journalSearch]);

  const journalByDay = useMemo(() => {
    const grouped = new Map<string, ZyonJournalEntry[]>();
    filteredJournal.forEach((entry) => {
      const current = grouped.get(entry.sessionDate) ?? [];
      current.push(entry);
      grouped.set(entry.sessionDate, current);
    });
    return [...grouped.entries()].sort(([left], [right]) => right.localeCompare(left));
  }, [filteredJournal]);

  const selectedDayEntries = journalByDay.find(([day]) => day === selectedDay)?.[1] ?? [];
  const selectedEntry = journal.find((entry) => entry.id === selectedEntryId) ?? selectedDayEntries[0] ?? null;
  const nearestLevels = useMemo(() => {
    if (!context || currentPrice === null) return [];
    return [...context.levels]
      .map((level) => ({
        ...level,
        distance: Math.min(
          Math.abs(currentPrice - level.zone[0]),
          Math.abs(currentPrice - level.zone[1]),
        ),
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 3);
  }, [context, currentPrice]);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    setAttachmentError("");
    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      setAttachmentError("Remove an attachment before adding another.");
      return;
    }
    const selected = files.slice(0, remaining);
    const oversized = selected.find((file) => file.size > MAX_ATTACHMENT_SIZE);
    if (oversized) {
      setAttachmentError(`${oversized.name} is larger than 10 MB.`);
      return;
    }
    try {
      const next = await Promise.all(selected.map(fileToAttachment));
      setAttachments((current) => [...current, ...next].slice(0, MAX_ATTACHMENTS));
      if (files.length > remaining) {
        setAttachmentError("You can attach up to four files to one message.");
      }
    } catch {
      setAttachmentError("One of those files could not be attached.");
    }
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim().slice(0, 6_000);
    if (!online || sending || (!text && !attachments.length)) return;
    const userMessage: ZyonMessage = {
      id: zyonId("zyon-user"),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
      attachments: attachments.length ? attachments : undefined,
    };
    const conversation = [...messages.slice(-23), userMessage];
    setMessages((current) => [...current.slice(-119), userMessage]);
    setDraft("");
    setAttachments([]);
    setAttachmentError("");
    setSendError("");
    setSending(true);

    try {
      const response = await fetch("/api/zyon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          root: selectedRoot,
          messages: conversation.map((message) => ({
            role: message.role,
            content: message.content,
            attachments: message.attachments,
          })),
          context: {
            root: selectedRoot,
            currentPrice,
            lastTickAt: interpreter.lastTickAt[selectedRoot],
            feedState: interpreter.feedState,
            market: context,
            recentKwantBotMessages: rootMessages.slice(-14),
            recentMemory: rootMemory.slice(-18),
            learningReviews: learningReviews.slice(-8),
          },
        }),
      });
      const payload = await response.json().catch(() => null) as {
        text?: unknown;
        error?: unknown;
        model?: unknown;
        journalEntry?: ZyonJournalEntry | null;
        usage?: { inputTokens?: number | null; outputTokens?: number | null };
      } | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error
            : "ZYON could not reply.",
        );
      }
      const content = typeof payload?.text === "string" ? payload.text.trim() : "";
      if (!content) throw new Error("ZYON returned an empty reply.");
      const reply: ZyonMessage = {
        id: zyonId("zyon-assistant"),
        role: "assistant",
        content: content.slice(0, 12_000),
        createdAt: new Date().toISOString(),
        model: isZyonModelKey(payload?.model) ? payload.model : model,
      };
      setMessages((current) => [...current.slice(-119), reply]);
      if (payload?.journalEntry) {
        const journalEntry: ZyonJournalEntry = {
          ...payload.journalEntry,
          attachments: userMessage.attachments?.map((attachment) => ({
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            dataUrl: attachment.dataUrl,
          })) ?? payload.journalEntry.attachments,
        };
        setJournal((current) => mergeJournal(current, [journalEntry]));
        setSelectedDay(journalEntry.sessionDate);
        setSelectedEntryId(journalEntry.id);
        if (journalEntry.cloudSaved) setCloudJournal("synced");
      }
      setLastUsage({
        inputTokens: payload?.usage?.inputTokens ?? null,
        outputTokens: payload?.usage?.outputTokens ?? null,
      });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "ZYON could not reply.");
    } finally {
      setSending(false);
      window.requestAnimationFrame(() => composerRef.current?.focus());
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-border bg-panel px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_24px_color-mix(in_srgb,var(--primary)_12%,transparent)]">
          <Sparkles className="h-[17px] w-[17px]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold tracking-[0.12em] text-foreground">ZYON</h1>
            <span className="rounded-full border border-primary/20 bg-primary/[0.07] px-2 py-0.5 text-[7px] font-semibold uppercase tracking-[0.15em] text-primary">
              Trading intelligence
            </span>
          </div>
          <p className="mt-0.5 truncate text-[9px] text-muted">Discretionary confirmation · KwantBot aware · journal linked</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-border bg-surface/60 p-0.5">
            {(["NQ", "ES"] as ZyonMarketRoot[]).map((root) => (
              <button
                key={root}
                type="button"
                onClick={() => interpreter.selectRoot(root)}
                className={`rounded-lg px-3 py-1.5 font-mono text-[10px] font-semibold transition ${
                  selectedRoot === root
                    ? "bg-primary/12 text-primary shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_9%,transparent)]"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {root}
              </button>
            ))}
          </div>
          <KwantSelect
            value={model}
            onChange={(event) => {
              if (isZyonModelKey(event.target.value)) setModel(event.target.value);
            }}
            menuLabel="ZYON model"
            className="h-8 min-w-[132px] rounded-xl border border-border bg-surface/60 px-3 text-[10px] font-semibold text-foreground"
            aria-label="Select ZYON model"
          >
            {Object.entries(ZYON_MODELS).map(([key, item]) => (
              <option key={key} value={key}>{item.label} · {item.tier}</option>
            ))}
          </KwantSelect>
          <button
            type="button"
            onClick={() => setOnline((current) => !current)}
            className={`flex h-8 items-center gap-2 rounded-xl border px-3 text-[9px] font-semibold uppercase tracking-[0.12em] transition ${
              online
                ? "border-primary/25 bg-primary/[0.08] text-primary"
                : "border-border bg-surface text-muted"
            }`}
            title={online ? "Pause ZYON" : "Bring ZYON online"}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${online ? "animate-pulse bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted"}`} />
            {online ? "Online" : "Paused"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[252px] shrink-0 flex-col border-r border-border bg-panel/70 lg:flex">
          <div className="border-b border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground">Journal</div>
                <div className="mt-0.5 text-[8px] text-muted">{journal.length} entries · daily folders</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraft("Journal this trade for me: ");
                  composerRef.current?.focus();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-primary/30 hover:text-primary"
                title="New journal note"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <label className="mt-3 flex h-8 items-center gap-2 rounded-xl border border-border bg-background/35 px-3 focus-within:border-primary/30">
              <Search className="h-3.5 w-3.5 text-muted" />
              <input
                value={journalSearch}
                onChange={(event) => setJournalSearch(event.target.value)}
                placeholder="Search journal"
                className="min-w-0 flex-1 bg-transparent text-[10px] text-foreground outline-none placeholder:text-muted/50"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {!journalByDay.length ? (
              <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                <Folder className="h-8 w-8 text-muted/35" />
                <p className="mt-3 text-[10px] leading-5 text-muted">Tell ZYON about a trade or setup. It will create the first daily folder automatically.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {journalByDay.map(([day, entries]) => {
                  const active = selectedDay === day;
                  return (
                    <div key={day}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDay(day);
                          setSelectedEntryId(entries[0]?.id ?? null);
                        }}
                        className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                          active
                            ? "border-primary/25 bg-primary/[0.07] text-foreground"
                            : "border-transparent text-muted hover:border-border hover:bg-surface/60 hover:text-foreground"
                        }`}
                      >
                        {active ? <FolderOpen className="h-4 w-4 shrink-0 text-primary" /> : <Folder className="h-4 w-4 shrink-0" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] font-medium">{formatDay(day)}</span>
                          <span className="mt-0.5 block text-[8px] text-muted">{entries.length} {entries.length === 1 ? "entry" : "entries"}</span>
                        </span>
                        <ChevronRight className={`h-3.5 w-3.5 transition ${active ? "rotate-90 text-primary" : ""}`} />
                      </button>
                      {active ? (
                        <div className="ml-4 mt-1 space-y-1 border-l border-border pl-2">
                          {entries.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => setSelectedEntryId(entry.id)}
                              className={`w-full rounded-lg px-2.5 py-2 text-left transition ${
                                selectedEntry?.id === entry.id
                                  ? "bg-surface text-foreground"
                                  : "text-muted hover:bg-surface/60 hover:text-foreground"
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[7px] font-semibold text-primary">{entry.kind}</span>
                                <span className="text-[7px] text-muted">{formatTime(entry.createdAt)}</span>
                              </span>
                              <span className="mt-1 block truncate text-[9px] font-medium">{entry.title}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-border px-3 py-2.5">
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.12em] text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${cloudJournal === "synced" ? "bg-primary" : "bg-muted"}`} />
              {cloudJournal === "checking" ? "Checking journal" : cloudJournal === "synced" ? "Account journal synced" : "Local journal active"}
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--primary)_5%,transparent),transparent_38%)]">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7">
            <div className="mx-auto flex min-h-full max-w-[880px] flex-col">
              {messages.length <= 1 ? (
                <div className="mb-6 rounded-2xl border border-border bg-panel/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,.12)]">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <Bot className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[13px] font-semibold text-foreground">Start with evidence</h2>
                        <span className="rounded-full bg-surface px-2 py-0.5 text-[7px] uppercase tracking-[0.13em] text-muted">{selectedRoot} context attached</span>
                      </div>
                      <p className="mt-1 max-w-2xl text-[10px] leading-5 text-muted">Send a screenshot, explain what you see, or ask ZYON to compare your discretionary idea with live Gameplan, gamma, options flow, and KwantBot memory.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {QUICK_PROMPTS.map((prompt) => {
                      const Icon = prompt.icon;
                      return (
                        <button
                          key={prompt.label}
                          type="button"
                          onClick={() => {
                            setDraft(prompt.prompt);
                            composerRef.current?.focus();
                          }}
                          className="flex items-center gap-2.5 rounded-xl border border-border bg-background/30 px-3 py-2.5 text-left text-[10px] text-muted transition hover:border-primary/25 hover:bg-primary/[0.04] hover:text-foreground"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                          {prompt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                {messages.map((message) => {
                  const assistant = message.role === "assistant";
                  return (
                    <div key={message.id} className={`flex gap-3 ${assistant ? "justify-start" : "justify-end"}`}>
                      {assistant ? (
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                          <Sparkles className="h-3.5 w-3.5" />
                        </div>
                      ) : null}
                      <div className={`max-w-[84%] ${assistant ? "" : "order-first"}`}>
                        <div className={`overflow-hidden rounded-2xl border px-4 py-3 ${
                          assistant
                            ? "border-border bg-panel/80 shadow-[0_12px_36px_rgba(0,0,0,.1)]"
                            : "border-primary/20 bg-primary/[0.09]"
                        }`}>
                          {messageAttachments(message.attachments)}
                          <p className="whitespace-pre-wrap text-[11px] leading-[1.75] text-foreground">{message.content}</p>
                        </div>
                        <div className={`mt-1.5 flex items-center gap-2 px-1 text-[8px] text-muted ${assistant ? "" : "justify-end"}`}>
                          <span>{assistant ? "ZYON" : "YOU"}</span>
                          {message.model ? <span>{ZYON_MODELS[message.model].label}</span> : null}
                          {message.createdAt ? <span>{formatTime(message.createdAt)}</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sending ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-border bg-panel/80 px-4 py-3 text-[10px] text-muted">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      {ZYON_MODELS[model].label} is checking your read against live context
                    </div>
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-panel/88 px-4 py-3 backdrop-blur-xl sm:px-7">
            <form onSubmit={sendMessage} className="mx-auto max-w-[880px]">
              {attachments.length ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="relative flex h-14 max-w-[190px] items-center gap-2 overflow-hidden rounded-xl border border-border bg-background/50 pr-7">
                      {isImage(attachment) ? (
                        <Image src={attachment.dataUrl} alt={attachment.name} width={56} height={56} unoptimized className="h-14 w-14 shrink-0 object-cover" />
                      ) : (
                        <span className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-4 w-4" /></span>
                      )}
                      <span className="min-w-0 truncate text-[9px] text-foreground">{attachment.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-muted hover:text-foreground"
                        aria-label={`Remove ${attachment.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className={`rounded-2xl border bg-background/55 p-2 shadow-[0_18px_55px_rgba(0,0,0,.18)] transition focus-within:border-primary/35 ${
                online ? "border-border" : "border-border opacity-65"
              }`}>
                <textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, 6_000))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  disabled={!online || sending}
                  placeholder={online ? `Message ZYON about ${selectedRoot}…` : "ZYON is paused"}
                  rows={2}
                  className="max-h-36 min-h-12 w-full resize-none bg-transparent px-2 py-1 text-[11px] leading-5 text-foreground outline-none placeholder:text-muted/45"
                />
                <div className="flex items-center gap-2 border-t border-border/70 pt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/markdown,text/csv,application/json"
                    onChange={(event) => void handleFiles(event)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!online || sending || attachments.length >= MAX_ATTACHMENTS}
                    className="flex h-8 items-center gap-2 rounded-xl px-2.5 text-[9px] text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-35"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Attach
                  </button>
                  <span className="hidden text-[8px] text-muted sm:inline">Images · PDF · notes · max 4 files</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="hidden text-[8px] text-muted sm:inline">Trading scope only</span>
                    <button
                      type="submit"
                      disabled={!online || sending || (!draft.trim() && !attachments.length)}
                      className="flex h-8 items-center gap-2 rounded-xl bg-primary px-3.5 text-[9px] font-semibold text-background transition hover:brightness-110 disabled:cursor-default disabled:opacity-30"
                    >
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send
                    </button>
                  </div>
                </div>
              </div>
              {attachmentError || sendError ? (
                <p role="alert" className="mt-2 text-[9px] text-danger">{attachmentError || sendError}</p>
              ) : (
                <div className="mt-2 flex items-center justify-between text-[8px] text-muted">
                  <span>Research and decision support only · no order execution</span>
                  {lastUsage ? <span className="font-mono">{lastUsage.inputTokens ?? "—"} in · {lastUsage.outputTokens ?? "—"} out</span> : null}
                </div>
              )}
            </form>
          </div>
        </main>

        <aside className="hidden w-[284px] shrink-0 flex-col border-l border-border bg-panel/70 xl:flex">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">Live context</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-foreground">
                  {selectedRoot}
                  <span className={`h-1.5 w-1.5 rounded-full ${contextState === "live" ? "bg-primary shadow-[0_0_7px_var(--primary)]" : "bg-muted"}`} />
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[16px] font-semibold text-foreground">
                  {currentPrice === null ? "—" : formatKwantBotPrice(selectedRoot, currentPrice)}
                </div>
                <div className="mt-0.5 text-[7px] uppercase tracking-[0.12em] text-muted">{interpreter.feedState}</div>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            <section className="rounded-2xl border border-border bg-background/30 p-3">
              <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">
                <MessageSquareText className="h-3.5 w-3.5 text-primary" />
                Gameplan
              </div>
              <p className="mt-2 text-[10px] leading-5 text-foreground">{context?.oneLiner || "Waiting for current Gameplan context."}</p>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <section className="rounded-2xl border border-border bg-background/30 p-3">
                <CircleGauge className="h-3.5 w-3.5 text-primary" />
                <div className="mt-2 text-[7px] uppercase tracking-[0.12em] text-muted">Gamma</div>
                <div className="mt-1 text-[9px] font-semibold text-foreground">{context?.options.gammaStateLabel || "—"}</div>
              </section>
              <section className="rounded-2xl border border-border bg-background/30 p-3">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <div className="mt-2 text-[7px] uppercase tracking-[0.12em] text-muted">Volatility</div>
                <div className="mt-1 text-[9px] font-semibold text-foreground">{context?.options.volatilityState || "—"}</div>
              </section>
            </div>

            <section className="rounded-2xl border border-border bg-background/30 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">
                  <Radio className="h-3.5 w-3.5 text-primary" />
                  Nearest levels
                </div>
                <span className="text-[7px] text-muted">{nearestLevels.length}</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {nearestLevels.length ? nearestLevels.map((level) => (
                  <div key={level.id} className="rounded-xl border border-border/70 bg-panel/60 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[9px] font-medium text-foreground">{level.name}</span>
                      <span className="font-mono text-[8px] text-primary">{formatKwantBotPrice(selectedRoot, level.zone[0])}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[7px] text-muted">
                      <span>{level.role}</span>
                      <span>{level.distance.toFixed(2)} pts</span>
                    </div>
                  </div>
                )) : <p className="py-3 text-center text-[9px] text-muted">Level map is loading.</p>}
              </div>
            </section>

            {selectedEntry ? (
              <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-primary">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Journal focus
                  </div>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[7px] font-semibold text-primary">{selectedEntry.kind}</span>
                </div>
                <h3 className="mt-2 text-[10px] font-semibold text-foreground">{selectedEntry.title}</h3>
                {selectedEntry.summary ? <p className="mt-1 text-[9px] leading-4 text-muted">{selectedEntry.summary}</p> : null}
                {selectedEntry.attachments.some((attachment) => attachment.dataUrl) ? (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {selectedEntry.attachments
                      .filter((attachment) => attachment.dataUrl)
                      .slice(0, 4)
                      .map((attachment) => (
                        <a
                          key={`${selectedEntry.id}:${attachment.name}`}
                          href={attachment.dataUrl}
                          download={attachment.name}
                          className="overflow-hidden rounded-lg border border-border"
                        >
                          {attachment.type.startsWith("image/") ? (
                            <Image
                              src={attachment.dataUrl as string}
                              alt={attachment.name}
                              width={180}
                              height={120}
                              unoptimized
                              className="h-20 w-full object-cover"
                            />
                          ) : (
                            <span className="flex h-20 items-center justify-center px-2 text-center text-[8px] text-muted">{attachment.name}</span>
                          )}
                        </a>
                      ))}
                  </div>
                ) : null}
                <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-border/70 pt-2 text-[9px] leading-4 text-foreground/85">{selectedEntry.body}</p>
              </section>
            ) : null}
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2 text-[8px] text-muted">
              <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />
              {rootMessages.length} KwantBot notes · {rootMemory.length} memory events · {learningReviews.length} reviews
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
