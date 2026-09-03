"use client";

import { FormEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUp,
  Bot,
  Grip,
  LifeBuoy,
  MessageSquareText,
  Minimize2,
  Sparkles,
  X,
} from "lucide-react";

type SupportMessage = {
  role: "user" | "assistant";
  content: string;
};

const STORAGE_MESSAGES = "kwantify-support-widget-messages";
const STORAGE_OPEN = "kwantify-support-widget-open";
const STORAGE_DOCK = "kwantify-support-widget-dock";

type WidgetDock = "bottom-right" | "bottom-left" | "top-right" | "top-left";

const dockClasses: Record<WidgetDock, string> = {
  "bottom-right": "bottom-6 right-6",
  "bottom-left": "bottom-6 left-6",
  "top-right": "top-6 right-6",
  "top-left": "top-6 left-6",
};

function suggestionsForPath(pathname: string) {
  if (pathname.startsWith("/connector/cfds")) {
    return ["How do I connect MT5?", "How do test trades work?", "What does this seat status mean?"];
  }
  if (pathname.startsWith("/trade-syncer")) {
    return ["How does copy trading work here?", "What should I set up first?", "How do accounts and templates fit together?"];
  }
  return ["What can Kwantify do?", "How do alerts connect to execution?", "Where should I start first?"];
}

export default function SupportAssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dock, setDock] = useState<WidgetDock>("bottom-right");
  const [messages, setMessages] = useState<SupportMessage[]>([
    {
      role: "assistant",
      content:
        "Hey — I’m the Kwantify assistant. I can help with charts, alerts, connectors, journal flows, or just getting you to the right place fast.",
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  const hiddenOnPath = pathname?.startsWith("/login") || pathname === "/ai";
  const suggestions = useMemo(() => suggestionsForPath(pathname || "/"), [pathname]);

  useEffect(() => {
    if (hiddenOnPath) return;
    try {
      const savedMessages = window.sessionStorage.getItem(STORAGE_MESSAGES);
      const savedOpen = window.sessionStorage.getItem(STORAGE_OPEN);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as SupportMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
      if (savedOpen === "1") {
        setOpen(true);
      }
      const savedDock = window.sessionStorage.getItem(STORAGE_DOCK);
      if (
        savedDock === "bottom-right" ||
        savedDock === "bottom-left" ||
        savedDock === "top-right" ||
        savedDock === "top-left"
      ) {
        setDock(savedDock);
      }
    } catch {
      // Ignore session storage issues and keep defaults.
    }
  }, [hiddenOnPath]);

  useEffect(() => {
    if (hiddenOnPath) return;
    window.sessionStorage.setItem(STORAGE_MESSAGES, JSON.stringify(messages));
  }, [hiddenOnPath, messages]);

  useEffect(() => {
    if (hiddenOnPath) return;
    window.sessionStorage.setItem(STORAGE_OPEN, open ? "1" : "0");
  }, [hiddenOnPath, open]);

  useEffect(() => {
    if (hiddenOnPath) return;
    window.sessionStorage.setItem(STORAGE_DOCK, dock);
  }, [dock, hiddenOnPath]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  if (hiddenOnPath) return null;

  function resolveDockFromPoint(clientX: number, clientY: number) {
    const horizontal = clientX <= window.innerWidth / 2 ? "left" : "right";
    const vertical = clientY <= window.innerHeight / 2 ? "top" : "bottom";
    return `${vertical}-${horizontal}` as WidgetDock;
  }

  function startDockDrag(event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();

    const handleMouseUp = (upEvent: MouseEvent) => {
      const nextDock = resolveDockFromPoint(upEvent.clientX, upEvent.clientY);
      setDock(nextDock);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mouseup", handleMouseUp);
  }

  const dockClassName = dockClasses[dock];

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    const nextMessages: SupportMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathname,
          messages: nextMessages,
        }),
      });
      const data = await res.json();
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            data.response ||
            "I’m here. Ask me about charts, alerts, connectors, journaling, or where to go next in the platform.",
        },
      ]);
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            "I hit a connection issue just then. Ask again in a second and we’ll keep moving.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <>
      {!open ? (
        <div
          className={`fixed ${dockClassName} z-[130] flex items-center gap-3 rounded-full border border-primary/25 bg-panel/95 px-4 py-3 text-left shadow-2xl shadow-black/40 backdrop-blur transition hover:border-primary/40 hover:bg-panel`}
        >
          <button
            type="button"
            onMouseDown={startDockDrag}
            onClick={(event) => event.stopPropagation()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface/80 text-muted transition hover:text-foreground"
            title="Move assistant"
          >
            <Grip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              <div className="text-[13px] font-semibold text-foreground">Ask Kwantify</div>
              <div className="text-[11px] text-muted">Support, setup, and product help</div>
            </div>
          </button>
        </div>
      ) : (
        <div className={`fixed ${dockClassName} z-[130] flex h-[620px] w-[390px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl border border-border bg-panel/95 shadow-2xl shadow-black/50 backdrop-blur`}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onMouseDown={startDockDrag}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface/80 text-muted transition hover:text-foreground"
                title="Move assistant"
              >
                <Grip className="h-4 w-4" />
              </button>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-foreground">Kwantify Assistant</div>
                <div className="truncate text-[11px] text-muted">Product support, onboarding, and workflow help</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-surface hover:text-foreground"
                title="Minimize"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setMessages([
                    {
                      role: "assistant",
                      content:
                        "Hey — I’m the Kwantify assistant. I can help with charts, alerts, connectors, journal flows, or just getting you to the right place fast.",
                    },
                  ]);
                  window.sessionStorage.removeItem(STORAGE_MESSAGES);
                  window.sessionStorage.removeItem(STORAGE_OPEN);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-surface hover:text-foreground"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-border px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
              <LifeBuoy className="h-3.5 w-3.5" />
              Quick help
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] text-muted transition hover:border-primary/35 hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex gap-3"}>
                {message.role === "assistant" ? (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                ) : null}
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[82%] rounded-2xl bg-surface px-4 py-3 text-[13px] leading-6 text-foreground"
                      : "max-w-[88%] rounded-2xl border border-border bg-card px-4 py-3 text-[13px] leading-6 text-muted"
                  }
                >
                  {message.role === "assistant" ? (
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">Kwantify</div>
                  ) : null}
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex gap-3">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </div>
                <div className="rounded-2xl border border-border bg-card px-4 py-3 text-[13px] text-muted">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">Kwantify</div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border p-4">
            <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface p-2 focus-within:border-primary/35">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Ask about charts, alerts, connectors, pricing, or where to start..."
                className="max-h-28 w-full resize-none bg-transparent px-2 py-1 text-[13px] leading-6 text-foreground outline-none placeholder:text-muted/65"
              />
              <div className="flex items-center justify-between px-1 pt-1">
                <div className="text-[11px] text-muted">Built for product help, not trading advice</div>
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary transition disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
