"use client";

import Image from "next/image";
import {
  Activity,
  Bot,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Download,
  FileText,
  Folder,
  FolderDown,
  FolderOpen,
  FolderPlus,
  ImagePlus,
  Loader2,
  Maximize2,
  MessageSquareText,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Radio,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import KwantLoader from "@/components/KwantLoader";
import KwantSelect from "@/components/ui/KwantSelect";
import type { UseKwantBotInterpreterResult } from "@/hooks/useKwantBotInterpreter";
import { useSpeechDictation } from "@/hooks/useSpeechDictation";
import { formatKwantBotPrice } from "@/lib/kwantBotInterpreter";
import {
  isZyonModelKey,
  ZYON_CHAT_LIMIT,
  ZYON_CONVERSATION_TAG,
  ZYON_CUSTOM_FOLDER_LIMIT,
  ZYON_DEFAULT_CHAT_ID,
  ZYON_MODELS,
  zyonConversationRole,
  zyonDailyFolderId,
  zyonDailyRootFolderId,
  zyonEntryChatId,
  zyonEntryFolderId,
  zyonId,
  type ZyonAttachment,
  type ZyonChat,
  type ZyonFolder,
  type ZyonGameplanDraft,
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
const PRIMARY_CHAT: ZyonChat = {
  id: ZYON_DEFAULT_CHAT_ID,
  name: "Primary chat",
  createdAt: "",
  updatedAt: "",
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

function localSessionDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    .slice(0, 5_000);
}

function mergeFolders(local: ZyonFolder[], remote: ZyonFolder[]) {
  const folders = new Map<string, ZyonFolder>();
  [...local, ...remote].forEach((folder) => folders.set(folder.id, {
    ...folders.get(folder.id),
    ...folder,
  }));
  return [...folders.values()].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt));
}

function mergeChats(local: ZyonChat[], remote: ZyonChat[]) {
  const chats = new Map<string, ZyonChat>();
  [...local, ...remote].forEach((chat) => chats.set(chat.id, {
    ...chats.get(chat.id),
    ...chat,
  }));
  return [...chats.values()].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt));
}

function messagesFromJournal(entries: ZyonJournalEntry[], chatId: string) {
  return entries
    .filter((entry) =>
      entry.tags.includes(ZYON_CONVERSATION_TAG)
      && zyonEntryChatId(entry) === chatId)
    .map((entry): ZyonMessage | null => {
      const role = zyonConversationRole(entry);
      if (!role) return null;
      const attachments = entry.attachments.flatMap((attachment, index) =>
        attachment.dataUrl ? [{
          id: `${entry.id}-attachment-${index}`,
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          dataUrl: attachment.dataUrl,
        }] : []);
      return {
        id: entry.id,
        role,
        content: entry.body,
        createdAt: entry.createdAt,
        attachments: attachments.length ? attachments : undefined,
      };
    })
    .filter((message): message is ZyonMessage => Boolean(message))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

function messagesByChatFromJournal(entries: ZyonJournalEntry[], chats: ZyonChat[]) {
  const chatIds = new Set([
    ZYON_DEFAULT_CHAT_ID,
    ...chats.map((chat) => chat.id),
    ...entries.map(zyonEntryChatId),
  ]);
  return [...chatIds].reduce<Record<string, ZyonMessage[]>>((grouped, chatId) => {
    grouped[chatId] = messagesFromJournal(entries, chatId);
    return grouped;
  }, {});
}

function mergeMessages(local: ZyonMessage[], cloud: ZyonMessage[]) {
  const merged = [...local];
  for (const message of cloud) {
    const duplicate = merged.some((candidate) =>
      candidate.role === message.role
      && candidate.content === message.content
      && Math.abs(Date.parse(candidate.createdAt) - Date.parse(message.createdAt)) < 15_000);
    if (!duplicate) merged.push(message);
  }
  return merged
    .sort((left, right) => {
      if (!left.createdAt) return -1;
      if (!right.createdAt) return 1;
      return Date.parse(left.createdAt) - Date.parse(right.createdAt);
    })
    .slice(-120);
}

function folderRows(folders: ZyonFolder[], expandedFolderIds?: ReadonlySet<string>) {
  const byParent = new Map<string | null, ZyonFolder[]>();
  folders.forEach((folder) => {
    const children = byParent.get(folder.parentId) ?? [];
    children.push(folder);
    byParent.set(folder.parentId, children);
  });
  byParent.forEach((children) => children.sort((left, right) => {
    if (left.kind === "system") return -1;
    if (right.kind === "system") return 1;
    if (left.kind === "daily" && right.kind === "daily") {
      return (right.sessionDate ?? "").localeCompare(left.sessionDate ?? "");
    }
    return left.name.localeCompare(right.name);
  }));
  const rows: Array<{ folder: ZyonFolder; depth: number }> = [];
  const visited = new Set<string>();
  const visit = (parentId: string | null, depth: number) => {
    for (const folder of byParent.get(parentId) ?? []) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      rows.push({ folder, depth });
      if (!expandedFolderIds || expandedFolderIds.has(folder.id)) {
        visit(folder.id, depth + 1);
      }
    }
  };
  visit(null, 0);
  folders.forEach((folder) => {
    if (!visited.has(folder.id)) rows.push({ folder, depth: 0 });
  });
  return rows;
}

function descendantFolderIds(folders: ZyonFolder[], folderId: string) {
  const ids = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    folders.forEach((folder) => {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    });
  }
  return ids;
}

function escapeArchiveHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeArchiveName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "zyon-folder";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function portableAttachmentSource(source: string) {
  if (source.startsWith("data:")) return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error("Attachment download failed.");
  return blobDataUrl(await response.blob());
}

function ZyonAvatar({
  size = "md",
  animated = false,
  speaking = false,
  online = false,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  speaking?: boolean;
  online?: boolean;
}) {
  const frame = size === "sm"
    ? "h-7 w-7"
    : size === "lg"
      ? "h-12 w-12"
      : size === "xl"
        ? "h-16 w-16"
        : "h-9 w-9";
  const imageSize = size === "sm" ? "28px" : size === "lg" ? "48px" : size === "xl" ? "64px" : "36px";
  return (
    <span
      className={`zyon-avatar relative inline-flex shrink-0 overflow-hidden rounded-full border border-primary/25 bg-black shadow-[0_0_22px_color-mix(in_srgb,var(--primary)_13%,transparent)] ${frame} ${
        animated ? "zyon-avatar-animated" : ""
      } ${speaking ? "zyon-avatar-speaking" : ""}`}
      aria-label="ZYON profile picture"
    >
      <span className="zyon-avatar-halo pointer-events-none absolute inset-0 z-10 rounded-full" />
      <Image
        src="/images/zyon-avatar.jpg"
        alt="ZYON, AI Quant Analyst"
        fill
        sizes={imageSize}
        className="zyon-avatar-image object-cover"
      />
      <span className="pointer-events-none absolute inset-0 z-20 rounded-full ring-1 ring-inset ring-white/[0.08]" />
      {online ? (
        <span className="absolute bottom-[6%] right-[6%] z-30 h-[20%] w-[20%] rounded-full border-2 border-panel bg-primary shadow-[0_0_8px_var(--primary)]" />
      ) : null}
    </span>
  );
}

function ZyonLoadingState({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className={`flex h-[58px] shrink-0 items-center gap-3 border-b border-border bg-panel ${compact ? "px-3" : "px-4"}`}>
        <ZyonAvatar animated />
        <div>
          <div className="text-[12px] font-semibold tracking-[0.12em] text-foreground">ZYON</div>
          <div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-muted">Restoring conversation</div>
        </div>
      </header>
      <KwantLoader
        className="min-h-0 flex-1"
        compact={compact}
        icon={Sparkles}
        title="Opening ZYON"
        detail="Placing you at the latest message."
      />
    </div>
  );
}

type SpeechDictationControl = ReturnType<typeof useSpeechDictation>;

function ZyonSpeechButton({
  speech,
  showLabel = false,
}: {
  speech: SpeechDictationControl;
  showLabel?: boolean;
}) {
  const title = !speech.supported
    ? "Speech input is not supported by this browser"
    : speech.listening
      ? "Stop dictation"
      : "Dictate a message";

  return (
    <button
      type="button"
      onClick={speech.toggle}
      disabled={!speech.supported}
      aria-label={title}
      aria-pressed={speech.listening}
      title={title}
      className={`flex h-8 shrink-0 items-center justify-center gap-2 rounded-xl px-2.5 text-[9px] transition disabled:cursor-not-allowed disabled:opacity-30 ${
        speech.listening
          ? "bg-primary/15 text-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
          : "text-muted hover:bg-surface hover:text-primary"
      }`}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        {speech.listening ? <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" /> : null}
        <Mic className="relative h-3.5 w-3.5" />
      </span>
      {showLabel ? <span>{speech.listening ? "Listening…" : "Dictate"}</span> : null}
    </button>
  );
}

type ZyonImagePreview = Pick<ZyonAttachment, "name" | "dataUrl">;

function messageAttachments(
  attachments: ZyonAttachment[] | undefined,
  onPreviewImage: (attachment: ZyonImagePreview) => void,
) {
  if (!attachments?.length) return null;
  return (
    <div className={`mb-2 grid gap-2 ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {attachments.map((attachment) => (
        isImage(attachment) ? (
          <button
            key={attachment.id}
            type="button"
            onClick={() => onPreviewImage(attachment)}
            className="group relative overflow-hidden rounded-xl border border-border/80 bg-background/35 text-left"
            aria-label={`Open ${attachment.name} full screen`}
          >
            <Image
              src={attachment.dataUrl}
              alt={attachment.name}
              width={620}
              height={420}
              unoptimized
              className="max-h-64 w-full object-cover transition duration-300 group-hover:scale-[1.01]"
            />
            <span className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/60 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
              <Maximize2 className="h-3.5 w-3.5" />
            </span>
          </button>
        ) : (
          <a
            key={attachment.id}
            href={attachment.dataUrl}
            download={attachment.name}
            className="group overflow-hidden rounded-xl border border-border/80 bg-background/35"
          >
            <span className="flex min-h-16 items-center gap-3 px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-medium text-foreground">{attachment.name}</span>
                <span className="mt-0.5 block text-[9px] text-muted">{Math.max(1, Math.round(attachment.size / 1024))} KB</span>
              </span>
            </span>
          </a>
        )
      ))}
    </div>
  );
}

function ZyonImagePreviewDialog({
  imagePreview,
  onClose,
}: {
  imagePreview: ZyonImagePreview | null;
  onClose: () => void;
}) {
  if (!imagePreview || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Image preview: ${imagePreview.name}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              const response = await fetch(imagePreview.dataUrl);
              if (!response.ok) throw new Error();
              downloadBlob(await response.blob(), imagePreview.name);
            } catch {
              window.open(imagePreview.dataUrl, "_blank", "noopener,noreferrer");
            }
          }}
          className="flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 text-[11px] font-medium text-white shadow-xl backdrop-blur transition hover:bg-white/15"
        >
          <Download className="h-4 w-4" />
          Save image
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white shadow-xl backdrop-blur transition hover:bg-white/15"
          aria-label="Close image preview"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="absolute inset-x-4 bottom-14 top-16 sm:inset-x-8 sm:bottom-16 sm:top-20">
        <Image
          src={imagePreview.dataUrl}
          alt={imagePreview.name}
          fill
          sizes="100vw"
          unoptimized
          priority
          className="select-none object-contain"
        />
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-4 truncate text-center text-[10px] text-white/60">
        {imagePreview.name}
      </div>
    </div>,
    document.body,
  );
}

export default function ZyonWorkspace({
  interpreter,
  compact = false,
  viewerName = "",
  accountKey = "",
}: {
  interpreter: UseKwantBotInterpreterResult;
  compact?: boolean;
  viewerName?: string;
  accountKey?: string;
}) {
  const [model, setModel] = useState<ZyonModelKey>(() => {
    if (typeof window === "undefined") return "opus-5";
    const saved = window.localStorage.getItem("kwantdesk:zyon:model");
    return isZyonModelKey(saved) ? saved : "opus-5";
  });
  const [online, setOnline] = useState(true);
  const [chats, setChats] = useState<ZyonChat[]>([PRIMARY_CHAT]);
  const [activeChatId, setActiveChatId] = useState(ZYON_DEFAULT_CHAT_ID);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ZyonMessage[]>>({
    [ZYON_DEFAULT_CHAT_ID]: [WELCOME_MESSAGE],
  });
  const [journal, setJournal] = useState<ZyonJournalEntry[]>([]);
  const [folders, setFolders] = useState<ZyonFolder[]>([]);
  const [storeReady, setStoreReady] = useState(false);
  const [cloudJournal, setCloudJournal] = useState<"checking" | "synced" | "local">("checking");
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ZyonAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [journalSearch, setJournalSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState(localSessionDate);
  const [selectedFolderId, setSelectedFolderId] = useState(
    () => zyonDailyFolderId(ZYON_DEFAULT_CHAT_ID, localSessionDate()),
  );
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set([
      zyonDailyRootFolderId(ZYON_DEFAULT_CHAT_ID),
      zyonDailyFolderId(ZYON_DEFAULT_CHAT_ID, localSessionDate()),
    ]),
  );
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<{ inputTokens: number | null; outputTokens: number | null } | null>(null);
  const [imagePreview, setImagePreview] = useState<ZyonImagePreview | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderParentId, setFolderParentId] = useState<string>("");
  const [folderActionError, setFolderActionError] = useState("");
  const [folderActionBusy, setFolderActionBusy] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<ZyonFolder | null>(null);
  const [exportingFolderId, setExportingFolderId] = useState<string | null>(null);
  const [gameplanSendState, setGameplanSendState] = useState<"ready" | "checking" | "needs-info" | "sent">("ready");
  const [gameplansSentToday, setGameplansSentToday] = useState(0);
  const [pendingGameplanId, setPendingGameplanId] = useState<string | null>(null);
  const [chatActionBusy, setChatActionBusy] = useState(false);
  const [chatActionError, setChatActionError] = useState("");
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [chatNameDraft, setChatNameDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const speechDictation = useSpeechDictation({
    value: draft,
    onChange: setDraft,
    disabled: sending,
    maxLength: 6_000,
  });
  const messages = messagesByChat[activeChatId] ?? [WELCOME_MESSAGE];
  const setMessages = useCallback((update: SetStateAction<ZyonMessage[]>) => {
    setMessagesByChat((current) => {
      const previous = current[activeChatId] ?? [WELCOME_MESSAGE];
      const next = typeof update === "function" ? update(previous) : update;
      return { ...current, [activeChatId]: next };
    });
  }, [activeChatId]);

  const resizeComposer = useCallback(() => {
    const composer = composerRef.current;
    if (!composer) return;
    const conversation = messagesScrollRef.current;
    const keepConversationPinned = conversation
      ? conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight < 72
      : false;
    const minimumHeight = compact ? 40 : 48;
    const viewportLimit = Math.floor(window.innerHeight * (compact ? 0.42 : 0.48));
    const maximumHeight = Math.max(
      minimumHeight,
      Math.min(compact ? 340 : 460, viewportLimit),
    );
    composer.style.height = "0px";
    const contentHeight = composer.scrollHeight;
    composer.style.height = `${Math.max(minimumHeight, Math.min(contentHeight, maximumHeight))}px`;
    composer.style.overflowY = contentHeight > maximumHeight ? "auto" : "hidden";
    if (conversation && keepConversationPinned) {
      conversation.scrollTop = conversation.scrollHeight;
    }
  }, [compact]);

  const selectedRoot = interpreter.selectedRoot;
  const context = interpreter.contexts[selectedRoot];
  const currentPrice = interpreter.livePrices[selectedRoot] ?? context?.currentPrice ?? null;
  const contextState = interpreter.contextStates[selectedRoot];
  const rootMessages = interpreter.messages[selectedRoot];
  const rootMemory = interpreter.memory[selectedRoot];
  const learningReviews = interpreter.learningReviews.filter((review) => review.root === selectedRoot);
  const conversationReady = storeReady && cloudJournal !== "checking";
  const conversationStarted = messages.some((message) => message.role === "user");
  const greetingName = viewerName.trim().split(/\s+/)[0] || "Trader";

  const refreshGameplanStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/zyon/gameplan-draft?localDate=${localSessionDate()}`, {
        cache: "no-store",
      });
      const payload = await response.json() as {
        pendingDraft?: ZyonGameplanDraft | null;
        sentToday?: number;
      };
      if (!response.ok) return;
      const pending = payload.pendingDraft ?? null;
      setPendingGameplanId(pending?.id ?? null);
      setGameplansSentToday(Number.isFinite(payload.sentToday) ? Number(payload.sentToday) : 0);
      setGameplanSendState((current) => pending ? "sent" : current === "sent" ? "ready" : current);
    } catch {
      // The conversation remains available if status synchronization is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    if (!accountKey) return;
    let active = true;
    setStoreReady(false);
    loadZyonState(accountKey)
      .then((saved) => {
        if (!active) return;
        const savedChats = Array.isArray(saved?.chats) && saved.chats.length
          ? mergeChats([PRIMARY_CHAT], saved.chats)
          : [PRIMARY_CHAT];
        const savedMessagesByChat = saved?.messagesByChat
          && typeof saved.messagesByChat === "object"
          ? saved.messagesByChat
          : {
            [ZYON_DEFAULT_CHAT_ID]: saved?.messages?.length
              ? saved.messages
              : [WELCOME_MESSAGE],
          };
        setChats(savedChats);
        setMessagesByChat((current) => {
          const next = { ...current };
          Object.entries(savedMessagesByChat).forEach(([chatId, chatMessages]) => {
            next[chatId] = mergeMessages(
              Array.isArray(chatMessages) && chatMessages.length ? chatMessages : [WELCOME_MESSAGE],
              current[chatId] ?? [],
            );
          });
          return next;
        });
        if (
          typeof saved?.activeChatId === "string"
          && savedChats.some((chat) => chat.id === saved.activeChatId)
        ) {
          setActiveChatId(saved.activeChatId);
        }
        setJournal((current) => mergeJournal(
          Array.isArray(saved?.journal) ? saved.journal : [],
          current,
        ));
        if (Array.isArray(saved?.folders)) {
          setFolders((current) => mergeFolders(saved.folders ?? [], current));
        }
      })
      .catch(() => {
        if (active) {
          setMessagesByChat({ [ZYON_DEFAULT_CHAT_ID]: [WELCOME_MESSAGE] });
        }
      })
      .finally(() => {
        if (active) setStoreReady(true);
      });
    return () => {
      active = false;
    };
  }, [accountKey]);

  useEffect(() => {
    if (!storeReady || !accountKey) return;
    void saveZyonState(accountKey, {
      messages: messages.slice(-120),
      journal: journal.slice(0, 5_000),
      chats,
      folders,
      activeChatId,
      messagesByChat: Object.fromEntries(
        Object.entries(messagesByChat).map(([chatId, chatMessages]) => [
          chatId,
          chatMessages.slice(-120),
        ]),
      ),
    });
  }, [accountKey, activeChatId, chats, folders, journal, messages, messagesByChat, storeReady]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    fetch("/api/zyon/journal", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as {
          entries?: ZyonJournalEntry[];
          folders?: ZyonFolder[];
          chats?: ZyonChat[];
          cloud?: boolean;
        };
        if (!response.ok) throw new Error();
        if (!active) return;
        if (Array.isArray(payload.entries)) {
          setJournal((current) => mergeJournal(current, payload.entries ?? []));
          const remoteChats = mergeChats(
            [PRIMARY_CHAT],
            Array.isArray(payload.chats) ? payload.chats : [],
          );
          const cloudMessagesByChat = messagesByChatFromJournal(
            payload.entries ?? [],
            remoteChats,
          );
          setMessagesByChat((current) => {
            const next = { ...current };
            Object.entries(cloudMessagesByChat).forEach(([chatId, chatMessages]) => {
              next[chatId] = mergeMessages(current[chatId] ?? [WELCOME_MESSAGE], chatMessages);
            });
            return next;
          });
        }
        if (Array.isArray(payload.chats)) {
          setChats((current) => mergeChats(current, [PRIMARY_CHAT, ...(payload.chats ?? [])]));
        }
        if (Array.isArray(payload.folders)) {
          setFolders((current) => mergeFolders(current, payload.folders ?? []));
        }
        setCloudJournal(payload.cloud ? "synced" : "local");
      })
      .catch(() => {
        if (active) setCloudJournal("local");
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("kwantdesk:zyon:model", model);
  }, [model]);

  useEffect(() => {
    const today = localSessionDate();
    const rootFolderId = zyonDailyRootFolderId(activeChatId);
    const todayFolderId = zyonDailyFolderId(activeChatId, today);
    setSelectedDay(today);
    setSelectedFolderId(todayFolderId);
    setExpandedFolderIds(new Set([rootFolderId, todayFolderId]));
    setSelectedEntryId(null);
  }, [activeChatId]);

  useEffect(() => {
    void refreshGameplanStatus();
    const refresh = () => void refreshGameplanStatus();
    window.addEventListener("focus", refresh);
    window.addEventListener("kwantdesk:gameplan-posted", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("kwantdesk:gameplan-posted", refresh);
    };
  }, [refreshGameplanStatus]);

  useEffect(() => {
    if (!imagePreview) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImagePreview(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [imagePreview]);

  useLayoutEffect(() => {
    if (!conversationReady) return;
    const container = messagesScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [activeChatId, compact, conversationReady, messages.length, sending]);

  useLayoutEffect(() => {
    resizeComposer();
  }, [draft, resizeComposer]);

  useEffect(() => {
    window.addEventListener("resize", resizeComposer);
    return () => window.removeEventListener("resize", resizeComposer);
  }, [resizeComposer]);

  const activeJournal = useMemo(
    () => journal.filter((entry) => zyonEntryChatId(entry) === activeChatId),
    [activeChatId, journal],
  );
  const orderedChats = useMemo(
    () => [...chats].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [chats],
  );
  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? PRIMARY_CHAT;
  const activeRootFolderId = zyonDailyRootFolderId(activeChatId);
  const filteredJournal = useMemo(() => {
    const query = journalSearch.trim().toLowerCase();
    if (!query) return activeJournal;
    return activeJournal.filter((entry) =>
      `${entry.title} ${entry.summary} ${entry.body} ${entry.tags.join(" ")} ${entry.root}`
        .toLowerCase()
        .includes(query),
    );
  }, [activeJournal, journalSearch]);

  const displayFolders = useMemo(() => {
    const now = new Date().toISOString();
    const next = mergeFolders([], folders.filter((folder) => folder.chatId === activeChatId));
    if (!next.some((folder) => folder.id === activeRootFolderId)) {
      next.push({
        id: activeRootFolderId,
        chatId: activeChatId,
        name: "Daily conversations",
        parentId: null,
        kind: "system",
        sessionDate: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    const dates = new Set(activeJournal.map((entry) => entry.sessionDate));
    dates.forEach((sessionDate) => {
      const id = zyonDailyFolderId(activeChatId, sessionDate);
      if (next.some((folder) => folder.id === id)) return;
      const entries = activeJournal.filter((entry) => entry.sessionDate === sessionDate);
      next.push({
        id,
        chatId: activeChatId,
        name: sessionDate,
        parentId: activeRootFolderId,
        kind: "daily",
        sessionDate,
        createdAt: entries.at(-1)?.createdAt ?? now,
        updatedAt: entries[0]?.createdAt ?? now,
      });
    });
    return next;
  }, [activeChatId, activeJournal, activeRootFolderId, folders]);
  const flattenedFolders = useMemo(
    () => folderRows(displayFolders, expandedFolderIds),
    [displayFolders, expandedFolderIds],
  );
  const selectedFolder = displayFolders.find((folder) => folder.id === selectedFolderId)
    ?? displayFolders.find((folder) => folder.kind === "daily" && folder.sessionDate === selectedDay)
    ?? displayFolders[0]
    ?? null;
  const selectedFolderEntries = useMemo(() => {
    if (!selectedFolder) return [];
    const descendantIds = descendantFolderIds(displayFolders, selectedFolder.id);
    return filteredJournal
      .filter((entry) => {
        const entryFolderId = zyonEntryFolderId(entry);
        if (entryFolderId && descendantIds.has(entryFolderId)) return true;
        return selectedFolder.kind === "daily" && entry.sessionDate === selectedFolder.sessionDate;
      })
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }, [displayFolders, filteredJournal, selectedFolder]);
  const selectedEntry = activeJournal.find((entry) => entry.id === selectedEntryId)
    ?? selectedFolderEntries[0]
    ?? null;
  const customFolderCount = displayFolders.filter((folder) => folder.kind === "custom").length;
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

  const openChat = useCallback((chatId: string) => {
    const today = localSessionDate();
    const rootFolderId = zyonDailyRootFolderId(chatId);
    const todayFolderId = zyonDailyFolderId(chatId, today);
    setActiveChatId(chatId);
    setMessagesByChat((current) => current[chatId]
      ? current
      : { ...current, [chatId]: [WELCOME_MESSAGE] });
    setSelectedDay(today);
    setSelectedFolderId(todayFolderId);
    setExpandedFolderIds(new Set([rootFolderId, todayFolderId]));
    setSelectedEntryId(null);
    setJournalSearch("");
    setDraft("");
    setAttachments([]);
    setAttachmentError("");
    setSendError("");
  }, []);

  const createChat = useCallback(async () => {
    if (chatActionBusy || chats.length >= ZYON_CHAT_LIMIT) return;
    const now = new Date().toISOString();
    const chat: ZyonChat = {
      id: zyonId("zyon-chat"),
      name: "New chat",
      createdAt: now,
      updatedAt: now,
    };
    const rootFolder: ZyonFolder = {
      id: zyonDailyRootFolderId(chat.id),
      chatId: chat.id,
      name: "Daily conversations",
      parentId: null,
      kind: "system",
      sessionDate: null,
      createdAt: now,
      updatedAt: now,
    };
    setChats((current) => mergeChats(current, [chat]));
    setFolders((current) => mergeFolders(current, [rootFolder]));
    openChat(chat.id);
    setRenamingChatId(chat.id);
    setChatNameDraft(chat.name);
    setChatActionBusy(true);
    setChatActionError("");
    try {
      const response = await fetch("/api/zyon/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-chat",
          chatId: chat.id,
          name: chat.name,
          root: selectedRoot,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        chat?: ZyonChat;
        folder?: ZyonFolder;
        error?: string;
      } | null;
      if (!response.ok || !payload?.chat) {
        throw new Error(payload?.error || "The chat could not be created.");
      }
      setChats((current) => mergeChats(current, [payload.chat!]));
      if (payload.folder) setFolders((current) => mergeFolders(current, [payload.folder!]));
      setCloudJournal("synced");
    } catch {
      // Keep the optimistic chat available in IndexedDB so a temporary cloud
      // storage problem never blocks the trader from starting a conversation.
      setCloudJournal("local");
    } finally {
      setChatActionBusy(false);
    }
  }, [chatActionBusy, chats.length, openChat, selectedRoot]);

  const renameChat = useCallback(async (chatId: string) => {
    const name = chatNameDraft.replace(/\s+/g, " ").trim().slice(0, 60);
    const existing = chats.find((chat) => chat.id === chatId);
    if (!name || !existing || chatActionBusy) {
      setRenamingChatId(null);
      setChatNameDraft("");
      return;
    }
    if (existing.name === name) {
      setRenamingChatId(null);
      setChatNameDraft("");
      return;
    }
    const previousName = existing.name;
    const updatedAt = new Date().toISOString();
    setChats((current) => current.map((chat) =>
      chat.id === chatId ? { ...chat, name, updatedAt } : chat));
    setRenamingChatId(null);
    setChatNameDraft("");
    setChatActionBusy(true);
    setChatActionError("");
    try {
      const response = await fetch("/api/zyon/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename-chat",
          chatId,
          name,
          root: selectedRoot,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        chat?: ZyonChat;
        error?: string;
      } | null;
      if (!response.ok || !payload?.chat) {
        throw new Error(payload?.error || "The chat could not be renamed.");
      }
      setChats((current) => mergeChats(current, [payload.chat!]));
      setCloudJournal("synced");
    } catch (error) {
      setChats((current) => current.map((chat) =>
        chat.id === chatId ? { ...chat, name: previousName } : chat));
      setChatActionError(error instanceof Error ? error.message : "The chat could not be renamed.");
    } finally {
      setChatActionBusy(false);
    }
  }, [chatActionBusy, chatNameDraft, chats, selectedRoot]);

  const createFolder = async (event: FormEvent) => {
    event.preventDefault();
    if (!folderName.trim() || folderActionBusy) return;
    const name = folderName.replace(/\s+/g, " ").trim().slice(0, 60);
    const now = new Date().toISOString();
    const folder: ZyonFolder = {
      id: zyonId("zyon-folder"),
      chatId: activeChatId,
      name,
      parentId: folderParentId || null,
      kind: "custom",
      sessionDate: null,
      createdAt: now,
      updatedAt: now,
    };
    setFolders((current) => mergeFolders(current, [folder]));
    setSelectedFolderId(folder.id);
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (folder.parentId) next.add(folder.parentId);
      next.add(folder.id);
      return next;
    });
    setSelectedEntryId(null);
    setFolderDialogOpen(false);
    setFolderName("");
    setFolderParentId("");
    setFolderActionBusy(true);
    setFolderActionError("");
    try {
      const response = await fetch("/api/zyon/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: folder.id,
          name: folder.name,
          parentId: folder.parentId,
          root: selectedRoot,
          chatId: activeChatId,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        folder?: ZyonFolder;
        error?: string;
      } | null;
      if (!response.ok || !payload?.folder) {
        throw new Error(payload?.error || "The folder could not be created.");
      }
      setFolders((current) => mergeFolders(current, [payload.folder as ZyonFolder]));
      setSelectedFolderId(payload.folder.id);
      setExpandedFolderIds((current) => {
        const next = new Set(current);
        if (payload.folder?.parentId) next.add(payload.folder.parentId);
        next.add(payload.folder!.id);
        return next;
      });
      setCloudJournal("synced");
    } catch {
      // The local folder remains usable and is persisted with the account's
      // local ZYON workspace until cloud storage is available again.
      setCloudJournal("local");
    } finally {
      setFolderActionBusy(false);
    }
  };

  const deleteFolder = async () => {
    if (!folderToDelete || folderActionBusy) return;
    setFolderActionBusy(true);
    setFolderActionError("");
    try {
      const response = await fetch("/api/zyon/journal", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folderToDelete.id }),
      });
      const payload = await response.json().catch(() => null) as {
        folderIds?: string[];
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "The folder could not be deleted.");
      }
      const removedIds = new Set(payload?.folderIds ?? [folderToDelete.id]);
      setFolders((current) => current.filter((folder) => !removedIds.has(folder.id)));
      setJournal((current) => current.filter((entry) => {
        if (zyonEntryChatId(entry) !== activeChatId) return true;
        const entryFolderId = zyonEntryFolderId(entry);
        if (entryFolderId && removedIds.has(entryFolderId)) return false;
        return !(folderToDelete.kind === "daily" && entry.sessionDate === folderToDelete.sessionDate);
      }));
      setSelectedFolderId(activeRootFolderId);
      setExpandedFolderIds((current) => {
        const next = new Set([...current].filter((id) => !removedIds.has(id)));
        next.add(activeRootFolderId);
        return next;
      });
      setSelectedEntryId(null);
      setFolderToDelete(null);
      setCloudJournal("synced");
    } catch (error) {
      setFolderActionError(error instanceof Error ? error.message : "The folder could not be deleted.");
    } finally {
      setFolderActionBusy(false);
    }
  };

  const exportFolder = async (folder: ZyonFolder) => {
    setExportingFolderId(folder.id);
    setFolderActionError("");
    try {
      const descendantIds = descendantFolderIds(displayFolders, folder.id);
      const entries = journal
        .filter((entry) => {
          const entryFolderId = zyonEntryFolderId(entry);
          if (entryFolderId && descendantIds.has(entryFolderId)) return true;
          return folder.kind === "daily" && entry.sessionDate === folder.sessionDate;
        })
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
      const sections = (await Promise.all(entries.map(async (entry) => {
        const attachmentsHtml = (await Promise.all(entry.attachments
          .filter((attachment) => attachment.dataUrl)
          .map(async (attachment) => {
            const source = await portableAttachmentSource(attachment.dataUrl as string);
            const image = attachment.type.startsWith("image/")
              ? `<img src="${source}" alt="${escapeArchiveHtml(attachment.name)}">`
              : "";
            return `<figure>${image}<figcaption>${escapeArchiveHtml(attachment.name)} · <a href="${source}" download="${escapeArchiveHtml(attachment.name)}">Download attachment</a></figcaption></figure>`;
          }))).join("");
        return `<article>
          <div class="meta">${escapeArchiveHtml(new Date(entry.createdAt).toLocaleString())} · ${escapeArchiveHtml(entry.root)} · ${escapeArchiveHtml(entry.kind)}</div>
          <h2>${escapeArchiveHtml(entry.title)}</h2>
          <p class="summary">${escapeArchiveHtml(entry.summary)}</p>
          <pre>${escapeArchiveHtml(entry.body)}</pre>
          ${attachmentsHtml}
        </article>`;
      }))).join("");
      const archive = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeArchiveHtml(folder.name)} · ZYON archive</title>
<style>
body{margin:0;background:#090909;color:#f5f5f5;font:14px Inter,Arial,sans-serif}main{max-width:900px;margin:auto;padding:48px 24px}
h1{font-size:28px;margin:0 0 8px}.lead,.meta{color:#999}.lead{margin-bottom:32px}article{border-top:1px solid #292929;padding:26px 0}
h2{font-size:17px;margin:7px 0}.summary{color:#d7bd70}pre{white-space:pre-wrap;font:13px/1.7 Inter,Arial,sans-serif;color:#ddd}
figure{margin:18px 0;padding:12px;border:1px solid #292929;border-radius:14px}img{display:block;max-width:100%;max-height:720px;margin:auto;border-radius:9px}
figcaption{margin-top:9px;color:#999;font-size:12px}a{color:#d7bd70}
</style></head><body><main><h1>${escapeArchiveHtml(folder.name)}</h1>
<p class="lead">ZYON conversation archive · ${entries.length} summarised ${entries.length === 1 ? "entry" : "entries"} · exported ${escapeArchiveHtml(new Date().toLocaleString())}</p>
${sections || "<p>No conversation summaries are stored in this folder yet.</p>"}
</main></body></html>`;
      downloadBlob(
        new Blob([archive], { type: "text/html;charset=utf-8" }),
        `${safeArchiveName(folder.name)}-zyon-archive.html`,
      );
    } catch {
      setFolderActionError("The folder archive could not be prepared.");
    } finally {
      setExportingFolderId(null);
    }
  };

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

  const sendMessage = async (
    event?: FormEvent,
    overrideText?: string,
    gameplanRequest = false,
  ) => {
    event?.preventDefault();
    const text = (overrideText ?? draft).trim().slice(0, 6_000);
    const outgoingAttachments = overrideText ? [] : attachments;
    const gameplanExchange = gameplanRequest
      || gameplanSendState === "needs-info"
      || /\b(?:send|save|submit|start|begin|build|prepare|create)\b[\s\S]{0,40}\bgame\s*plan\b/i.test(text)
      || /\bgame\s*plan\b[\s\S]{0,40}\b(?:send|save|submit|start|begin|build|prepare|create)\b/i.test(text);
    if (sending || (!text && !outgoingAttachments.length)) return;
    if (!online) setOnline(true);
    if (gameplanExchange) setGameplanSendState("checking");
    const userMessage: ZyonMessage = {
      id: zyonId("zyon-user"),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
      attachments: outgoingAttachments.length ? outgoingAttachments : undefined,
    };
    const conversation = [...messages.slice(-23), userMessage];
    setMessages((current) => [...current.slice(-119), userMessage]);
    setChats((current) => current.map((chat) =>
      chat.id === activeChatId
        ? { ...chat, updatedAt: userMessage.createdAt }
        : chat));
    if (!overrideText) {
      setDraft("");
      setAttachments([]);
    }
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
          chatId: activeChatId,
          messages: conversation.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            attachments: message.attachments,
          })),
          localDate: localSessionDate(),
          clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          folderId: selectedFolder?.kind === "custom" ? selectedFolder.id : null,
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
        journalEntries?: ZyonJournalEntry[];
        gameplanDraft?: ZyonGameplanDraft | null;
        pendingGameplanDraftId?: string | null;
        folder?: { id?: string; sessionDate?: string; cloudSaved?: boolean };
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
      if (payload?.gameplanDraft?.cloudSaved) {
        setPendingGameplanId(payload.gameplanDraft.id);
        setGameplanSendState("sent");
        void refreshGameplanStatus();
      } else if (payload?.pendingGameplanDraftId) {
        setPendingGameplanId(payload.pendingGameplanDraftId);
        setGameplanSendState("sent");
      } else if (gameplanExchange) {
        setGameplanSendState("needs-info");
      }
      const returnedEntries = Array.isArray(payload?.journalEntries)
        ? payload.journalEntries
        : payload?.journalEntry ? [payload.journalEntry] : [];
      if (returnedEntries.length) {
        const hydratedEntries = returnedEntries.map((entry) => {
          const role = zyonConversationRole(entry);
          return role === "user" && userMessage.attachments?.length
            ? {
              ...entry,
              attachments: userMessage.attachments.map((attachment) => ({
                name: attachment.name,
                type: attachment.type,
                size: attachment.size,
                dataUrl: attachment.dataUrl,
              })),
            }
            : entry;
        });
        setJournal((current) => mergeJournal(current, hydratedEntries));
        const latestEntry = hydratedEntries.at(-1);
        if (latestEntry) {
          setSelectedDay(latestEntry.sessionDate);
          setSelectedEntryId(latestEntry.id);
        }
        if (hydratedEntries.some((entry) => entry.cloudSaved)) setCloudJournal("synced");
      }
      if (payload?.folder?.id && payload.folder.sessionDate) {
        const now = new Date().toISOString();
        const systemFolder: ZyonFolder = {
          id: activeRootFolderId,
          chatId: activeChatId,
          name: "Daily conversations",
          parentId: null,
          kind: "system",
          sessionDate: null,
          createdAt: now,
          updatedAt: now,
        };
        const dailyFolder: ZyonFolder = {
          id: payload.folder.id,
          chatId: activeChatId,
          name: payload.folder.sessionDate,
          parentId: selectedFolder?.kind === "custom"
            ? selectedFolder.id
            : activeRootFolderId,
          kind: "daily",
          sessionDate: payload.folder.sessionDate,
          createdAt: now,
          updatedAt: now,
        };
        setFolders((current) => mergeFolders(current, [systemFolder, dailyFolder]));
        setSelectedFolderId(dailyFolder.id);
        setExpandedFolderIds((current) => {
          const next = new Set(current);
          next.add(activeRootFolderId);
          next.add(dailyFolder.id);
          return next;
        });
      }
      setLastUsage({
        inputTokens: payload?.usage?.inputTokens ?? null,
        outputTokens: payload?.usage?.outputTokens ?? null,
      });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "ZYON could not reply.");
      if (gameplanExchange) setGameplanSendState("needs-info");
    } finally {
      setSending(false);
      window.requestAnimationFrame(() => composerRef.current?.focus());
    }
  };

  const requestGameplan = () => {
    if (pendingGameplanId || gameplanSendState === "sent") {
      window.location.href = "/socials";
      return;
    }
    void sendMessage(
      undefined,
      "Send Gameplan. Use our conversation for the reasoning and ask me only for the required information that is still missing.",
      true,
    );
  };
  const gameplanButtonLabel = gameplanSendState === "checking"
    ? "ZYON CHECKING"
    : gameplanSendState === "needs-info"
      ? "ZYON NEEDS INFO"
      : gameplanSendState === "sent"
        ? "SENT · OPEN HOLDING"
        : "SEND GAMEPLAN";
  const gameplanButtonTone = gameplanSendState === "needs-info"
    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.12)]"
    : gameplanSendState === "sent"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-border bg-surface/60 text-foreground hover:border-primary/35 hover:text-primary";

  if (!conversationReady) {
    return <ZyonLoadingState compact={compact} />;
  }

  if (compact) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <header className="shrink-0 border-b border-border bg-panel">
          <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
            <ZyonAvatar animated online={online} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-semibold tracking-[0.12em] text-foreground">ZYON</h2>
                <span className={`h-1.5 w-1.5 rounded-full ${online ? "animate-pulse bg-primary shadow-[0_0_7px_var(--primary)]" : "bg-muted"}`} />
              </div>
              <div className="mt-0.5 truncate text-[8px] text-muted">
                {selectedRoot} intelligence · {contextState} · {cloudJournal === "synced" ? "journal synced" : "local journal"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { window.location.href = "/zyon"; }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-primary/30 hover:text-primary"
              title="Open the full ZYON workspace"
              aria-label="Open the full ZYON workspace"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 border-t border-border/70 px-3 py-2">
            <div className="flex shrink-0 items-center rounded-xl border border-border bg-surface/60 p-0.5">
              {(["NQ", "ES"] as ZyonMarketRoot[]).map((root) => (
                <button
                  key={root}
                  type="button"
                  onClick={() => interpreter.selectRoot(root)}
                  className={`rounded-lg px-2.5 py-1.5 font-mono text-[9px] font-semibold transition ${
                    selectedRoot === root ? "bg-primary/12 text-primary" : "text-muted hover:text-foreground"
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
              className="h-8 min-w-0 flex-1 rounded-xl border border-border bg-surface/60 px-2 text-[9px] font-semibold text-foreground"
              aria-label="Select ZYON model"
            >
              {Object.entries(ZYON_MODELS).map(([key, item]) => (
                <option key={key} value={key}>{item.label}</option>
              ))}
            </KwantSelect>
            <button
              type="button"
              onClick={() => setOnline((current) => !current)}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition ${
                online
                  ? "border-primary/25 bg-primary/[0.08] text-primary"
                  : "border-border bg-surface text-muted"
              }`}
              title={online ? "Pause ZYON" : "Bring ZYON online"}
              aria-label={online ? "Pause ZYON" : "Bring ZYON online"}
            >
              <Radio className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 border-t border-border/70 px-3 py-2">
            <button
              type="button"
              onClick={requestGameplan}
              disabled={sending}
              className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-[8px] font-semibold uppercase tracking-[0.1em] transition disabled:opacity-45 ${gameplanButtonTone}`}
            >
              {gameplanSendState === "checking"
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : gameplanSendState === "sent"
                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : <Send className="h-3.5 w-3.5" />}
              {gameplanButtonLabel}
            </button>
            <span className="shrink-0 text-right font-mono text-[7px] leading-3 text-muted">
              {gameplansSentToday}<br />today
            </span>
          </div>

          <div className="grid grid-cols-2 border-t border-border/70 text-[8px]">
            <div className="border-r border-border/70 px-3 py-2">
              <span className="block uppercase tracking-[0.12em] text-muted">Live price</span>
              <span className="mt-1 block font-mono text-[10px] text-foreground">
                {currentPrice === null ? "—" : formatKwantBotPrice(selectedRoot, currentPrice)}
              </span>
            </div>
            <div className="px-3 py-2">
              <span className="block uppercase tracking-[0.12em] text-muted">Context</span>
              <span className="mt-1 block truncate text-[9px] font-semibold text-foreground">
                {context?.options.gammaRegime ?? "Waiting"}
              </span>
            </div>
          </div>
        </header>

        <div ref={messagesScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--primary)_5%,transparent),transparent_38%)] px-3 py-4">
          <div className="flex min-h-full flex-col justify-end">
            <div className="mb-4 flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted/70">
              <span className="h-px flex-1 bg-border" />
              Shared ZYON conversation
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-3">
              {messages.map((message) => {
                const assistant = message.role === "assistant";
                return (
                  <div key={message.id} className={`flex gap-2 ${assistant ? "justify-start" : "justify-end"}`}>
                    {assistant ? (
                      <span className="mt-1"><ZyonAvatar size="sm" /></span>
                    ) : null}
                    <div className="max-w-[84%]">
                      <div className={`overflow-hidden rounded-[17px] border px-3 py-2.5 ${
                        assistant
                          ? "rounded-bl-[6px] border-border bg-panel/85"
                          : "rounded-br-[6px] border-primary/20 bg-primary/[0.09]"
                      }`}>
                        {messageAttachments(message.attachments, setImagePreview)}
                        <p className="whitespace-pre-wrap text-[10px] leading-[1.65] text-foreground">{message.content}</p>
                      </div>
                      <div className={`mt-1 flex items-center gap-1.5 px-1 text-[7px] uppercase tracking-[0.08em] text-muted ${assistant ? "" : "justify-end"}`}>
                        <span>{assistant ? "ZYON" : "YOU"}</span>
                        {message.createdAt ? <span>{formatTime(message.createdAt)}</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              {sending ? (
                <div className="flex items-center gap-2">
                  <ZyonAvatar size="sm" speaking />
                  <span className="flex items-center gap-2 rounded-2xl border border-border bg-panel/85 px-3 py-2.5 text-[9px] text-muted">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ZYON is analysing
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <form onSubmit={sendMessage} className="shrink-0 border-t border-border bg-panel p-2.5">
          {attachments.length ? (
            <div className="mb-2 flex gap-2 overflow-x-auto">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="relative flex h-12 min-w-0 max-w-[160px] items-center gap-2 overflow-hidden rounded-xl border border-border bg-background/50 pr-7">
                  {isImage(attachment) ? (
                    <Image src={attachment.dataUrl} alt={attachment.name} width={48} height={48} unoptimized className="h-12 w-12 shrink-0 object-cover" />
                  ) : (
                    <span className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-3.5 w-3.5" /></span>
                  )}
                  <span className="min-w-0 truncate text-[8px] text-foreground">{attachment.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/85 text-muted hover:text-foreground"
                    aria-label={`Remove ${attachment.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="rounded-[18px] border border-border bg-background/55 p-1.5 transition focus-within:border-primary/35">
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
              disabled={sending}
              placeholder={online ? `Message ZYON about ${selectedRoot}…` : "ZYON is paused"}
              rows={2}
              className="min-h-10 w-full resize-none overflow-y-hidden bg-transparent px-2 py-1 text-[10px] leading-5 text-foreground outline-none placeholder:text-muted/45"
            />
            <div className="flex items-center gap-1 border-t border-border/70 pt-1.5">
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
                disabled={sending || attachments.length >= MAX_ATTACHMENTS}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-primary disabled:opacity-35"
                title="Attach a chart, image or file"
                aria-label="Attach a chart, image or file"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <ZyonSpeechButton speech={speechDictation} />
              <span className="text-[8px] text-muted">
                {speechDictation.listening ? "Listening…" : "Images and files"}
              </span>
              <button
                type="submit"
                disabled={sending || (!draft.trim() && !attachments.length)}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background transition hover:brightness-110 disabled:opacity-30"
                title="Send to ZYON"
                aria-label="Send to ZYON"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          {attachmentError || sendError || speechDictation.error ? (
            <p role="alert" className="mt-1.5 px-1 text-[8px] leading-3 text-danger">{attachmentError || sendError || speechDictation.error}</p>
          ) : null}
          <p className="mt-1.5 px-1 text-[7px] leading-3 text-muted">
            ZYON provides general information only, not financial advice. You remain solely responsible for all trading decisions; to the extent permitted by law, Kwant Desk and ZYON accept no liability for financial loss or trading outcomes.
          </p>
        </form>

        <ZyonImagePreviewDialog imagePreview={imagePreview} onClose={() => setImagePreview(null)} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-border bg-panel px-4">
        <ZyonAvatar animated online={online} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold tracking-[0.12em] text-foreground">ZYON</h1>
            <span className="rounded-full border border-primary/20 bg-primary/[0.07] px-2 py-0.5 text-[7px] font-semibold uppercase tracking-[0.15em] text-primary">
              AI Quant Analyst
            </span>
          </div>
          <p className="mt-0.5 truncate text-[9px] text-muted">Live Futures and Options Aware</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <KwantSelect
            value={activeChatId}
            onChange={(event) => openChat(event.target.value)}
            menuLabel="ZYON chat"
            className="h-8 min-w-[118px] rounded-xl border border-border bg-surface/60 px-3 text-[9px] font-semibold text-foreground lg:hidden"
            aria-label="Select ZYON chat"
          >
            {orderedChats.map((chat) => (
              <option key={chat.id} value={chat.id}>{chat.name}</option>
            ))}
          </KwantSelect>
          <button
            type="button"
            onClick={() => void createChat()}
            disabled={chatActionBusy || chats.length >= ZYON_CHAT_LIMIT}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface/60 text-muted transition hover:border-primary/30 hover:text-primary disabled:opacity-40 lg:hidden"
            title="New chat"
          >
            {chatActionBusy
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Plus className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={requestGameplan}
            disabled={sending}
            className={`flex h-8 items-center gap-2 rounded-xl border px-3 text-[8px] font-semibold uppercase tracking-[0.1em] transition disabled:opacity-45 ${gameplanButtonTone}`}
            title={`${gameplansSentToday} Gameplans sent today`}
          >
            {gameplanSendState === "checking"
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : gameplanSendState === "sent"
                ? <CheckCircle2 className="h-3.5 w-3.5" />
                : <Send className="h-3.5 w-3.5" />}
            {gameplanButtonLabel}
            <span className="rounded-md border border-current/15 px-1.5 py-0.5 font-mono text-[7px]">
              {gameplansSentToday} today
            </span>
          </button>
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
        <aside className="hidden w-[184px] shrink-0 flex-col border-r border-border bg-background/55 lg:flex">
          <div className="border-b border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground">Chats</div>
                <div className="mt-0.5 text-[8px] text-muted">{chats.length}/{ZYON_CHAT_LIMIT} workspaces</div>
              </div>
              <button
                type="button"
                onClick={() => void createChat()}
                disabled={chatActionBusy || chats.length >= ZYON_CHAT_LIMIT}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.07] text-primary transition hover:border-primary/40 hover:bg-primary/10 disabled:opacity-40"
                title="New chat"
              >
                {chatActionBusy
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Plus className="h-3.5 w-3.5" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void createChat()}
              disabled={chatActionBusy || chats.length >= ZYON_CHAT_LIMIT}
              className="mt-3 flex h-8 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface/60 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted transition hover:border-primary/30 hover:text-primary disabled:opacity-40"
            >
              <MessageSquareText className="h-3.5 w-3.5" />
              New chat
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {orderedChats.map((chat) => {
                const selected = chat.id === activeChatId;
                const chatMessages = messagesByChat[chat.id] ?? [];
                const lastMessage = [...chatMessages]
                  .reverse()
                  .find((message) => message.id !== WELCOME_MESSAGE.id);
                const renaming = renamingChatId === chat.id;
                return (
                  <div
                    key={chat.id}
                    className={`group rounded-xl border transition ${
                      selected
                        ? "border-primary/25 bg-primary/[0.07]"
                        : "border-transparent hover:border-border hover:bg-surface/50"
                    }`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openChat(chat.id)}
                      onDoubleClick={() => {
                        setRenamingChatId(chat.id);
                        setChatNameDraft(chat.name);
                      }}
                      onKeyDown={(event) => {
                        if ((event.key === "Enter" || event.key === " ") && !renaming) {
                          event.preventDefault();
                          openChat(chat.id);
                        }
                      }}
                      className="flex w-full items-start gap-2 px-2.5 py-2.5 text-left"
                    >
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                        selected
                          ? "border-primary/25 bg-primary/10 text-primary"
                          : "border-border bg-background/40 text-muted"
                      }`}>
                        <MessageSquareText className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        {renaming ? (
                          <input
                            value={chatNameDraft}
                            onChange={(event) => setChatNameDraft(event.target.value.slice(0, 60))}
                            onClick={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => event.stopPropagation()}
                            onBlur={() => void renameChat(chat.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                event.currentTarget.blur();
                              }
                              if (event.key === "Escape") {
                                setChatNameDraft(chat.name);
                                event.currentTarget.blur();
                              }
                            }}
                            autoFocus
                            className="h-5 w-full rounded-md border border-primary/30 bg-background px-1.5 text-[9px] font-medium text-foreground outline-none"
                            aria-label="Rename chat"
                          />
                        ) : (
                          <span className={`block truncate text-[9px] font-medium ${
                            selected ? "text-foreground" : "text-muted group-hover:text-foreground"
                          }`}>
                            {chat.name}
                          </span>
                        )}
                        <span className="mt-1 block truncate text-[7px] text-muted/70">
                          {lastMessage?.content || "Start a new conversation"}
                        </span>
                      </span>
                      {!renaming ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setRenamingChatId(chat.id);
                            setChatNameDraft(chat.name);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              setRenamingChatId(chat.id);
                              setChatNameDraft(chat.name);
                            }
                          }}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-surface hover:text-foreground ${
                            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          }`}
                          title="Rename chat"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="border-t border-border px-3 py-2.5">
            {chatActionError ? (
              <p className="text-[8px] leading-3 text-danger">{chatActionError}</p>
            ) : (
              <p className="truncate text-[8px] text-muted">{activeChat.name}</p>
            )}
          </div>
        </aside>

        <aside className="hidden w-[252px] shrink-0 flex-col border-r border-border bg-panel/70 lg:flex">
          <div className="border-b border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground">Journal</div>
                <div className="mt-0.5 text-[8px] text-muted">{activeJournal.length} summaries · {customFolderCount}/{ZYON_CUSTOM_FOLDER_LIMIT} folders</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setFolderParentId(selectedFolder?.id ?? "");
                    setFolderName("");
                    setFolderActionError("");
                    setFolderDialogOpen(true);
                  }}
                  disabled={customFolderCount >= ZYON_CUSTOM_FOLDER_LIMIT}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-primary/30 hover:text-primary disabled:opacity-35"
                  title="Create folder"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
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
            {selectedFolder ? (
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void exportFolder(selectedFolder)}
                  disabled={exportingFolderId === selectedFolder.id}
                  className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background/35 text-[8px] font-medium text-muted transition hover:border-primary/25 hover:text-primary disabled:opacity-50"
                >
                  {exportingFolderId === selectedFolder.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <FolderDown className="h-3 w-3" />}
                  Download folder
                </button>
                {selectedFolder.kind !== "system" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFolderActionError("");
                      setFolderToDelete(selectedFolder);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/35 text-muted transition hover:border-danger/30 hover:text-danger"
                    aria-label={`Delete ${selectedFolder.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {!flattenedFolders.length ? (
              <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                <Folder className="h-8 w-8 text-muted/35" />
                <p className="mt-3 text-[10px] leading-5 text-muted">Tell ZYON about a trade or setup. It will create the first daily folder automatically.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {flattenedFolders.map(({ folder, depth }) => {
                  const active = selectedFolder?.id === folder.id;
                  const expanded = expandedFolderIds.has(folder.id);
                  const descendantIds = expanded ? descendantFolderIds(displayFolders, folder.id) : new Set<string>();
                  const entries = expanded
                    ? filteredJournal
                      .filter((entry) => {
                        const entryFolderId = zyonEntryFolderId(entry);
                        if (entryFolderId && descendantIds.has(entryFolderId)) return true;
                        return folder.kind === "daily" && entry.sessionDate === folder.sessionDate;
                      })
                      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
                    : [];
                  return (
                    <div key={folder.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFolderId(folder.id);
                          if (folder.sessionDate) setSelectedDay(folder.sessionDate);
                          setExpandedFolderIds((current) => {
                            const next = new Set(current);
                            if (next.has(folder.id)) next.delete(folder.id);
                            else next.add(folder.id);
                            return next;
                          });
                          if (!active) setSelectedEntryId(null);
                        }}
                        className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                          active
                            ? "border-primary/25 bg-primary/[0.07] text-foreground"
                            : "border-transparent text-muted hover:border-border hover:bg-surface/60 hover:text-foreground"
                        }`}
                        style={{ paddingLeft: `${10 + Math.min(depth, 4) * 12}px` }}
                      >
                        {expanded ? <FolderOpen className="h-4 w-4 shrink-0 text-primary" /> : <Folder className="h-4 w-4 shrink-0" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] font-medium">
                            {folder.kind === "daily" && folder.sessionDate ? formatDay(folder.sessionDate) : folder.name}
                          </span>
                          <span className="mt-0.5 block text-[8px] text-muted">
                            {folder.kind === "system"
                              ? "Automatic archive"
                              : folder.kind === "custom"
                                ? "Custom folder"
                                : `${entries.length || activeJournal.filter((entry) => entry.sessionDate === folder.sessionDate).length} summaries`}
                          </span>
                        </span>
                        <ChevronRight className={`h-3.5 w-3.5 transition ${expanded ? "rotate-90 text-primary" : ""}`} />
                      </button>
                      {expanded && entries.length ? (
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
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[7px] font-semibold text-primary">
                                  {zyonConversationRole(entry)?.toUpperCase() ?? entry.kind}
                                </span>
                                <span className="text-[7px] text-muted">{formatTime(entry.createdAt)}</span>
                              </span>
                              <span className="mt-1 block truncate text-[9px] font-medium">{entry.summary || entry.title}</span>
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
            {folderActionError && !folderDialogOpen && !folderToDelete ? (
              <p className="mb-2 text-[8px] leading-3 text-danger">{folderActionError}</p>
            ) : null}
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.12em] text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${cloudJournal === "synced" ? "bg-primary" : "bg-muted"}`} />
              {cloudJournal === "synced" ? "Account journal synced" : "Local journal active"}
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--primary)_5%,transparent),transparent_38%)]">
          <div ref={messagesScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7">
            <div className={`mx-auto flex min-h-full max-w-[880px] flex-col ${conversationStarted ? "zyon-chat-enter" : "justify-center"}`}>
              {!conversationStarted ? (
                <div className="zyon-first-message-enter mx-auto flex w-full max-w-[720px] flex-col items-center justify-center py-8 text-center">
                  <ZyonAvatar size="xl" animated online={online} />
                  <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">ZYON · {selectedRoot} intelligence ready</div>
                  <h2 className="mt-2 text-[27px] font-semibold tracking-[-0.04em] text-foreground sm:text-[32px]">
                    Hello, {greetingName}. What&apos;s today&apos;s game plan?
                  </h2>
                  <p className="mt-2 max-w-xl text-[10px] leading-5 text-muted">
                    Start with your read, attach a chart, or ask ZYON to challenge the plan against live market context.
                  </p>

                  <form onSubmit={sendMessage} className="mt-7 w-full text-left">
                    {attachments.length ? (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {attachments.map((attachment) => (
                          <div key={attachment.id} className="relative flex h-14 max-w-[190px] items-center gap-2 overflow-hidden rounded-xl border border-border bg-panel/80 pr-7">
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
                    <div className={`rounded-3xl border bg-panel/80 p-2.5 text-left shadow-[0_24px_90px_rgba(0,0,0,.28)] backdrop-blur-xl transition focus-within:border-primary/40 focus-within:shadow-[0_24px_90px_rgba(0,0,0,.28),0_0_32px_color-mix(in_srgb,var(--primary)_10%,transparent)] ${
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
                        disabled={sending}
                        placeholder={online ? "Describe your plan, levels, conditions, or attach a chart…" : "ZYON is paused"}
                        rows={2}
                        autoFocus
                        className="min-h-14 w-full resize-none overflow-y-hidden bg-transparent px-2 py-2 text-[12px] leading-5 text-foreground outline-none placeholder:text-muted/45"
                      />
                      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2">
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
                          disabled={sending || attachments.length >= MAX_ATTACHMENTS}
                          className="flex h-9 items-center gap-2 rounded-xl px-3 text-[9px] text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-35"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          Attach
                        </button>
                        <ZyonSpeechButton speech={speechDictation} showLabel />
                        <KwantSelect
                          value={model}
                          onChange={(event) => {
                            if (isZyonModelKey(event.target.value)) setModel(event.target.value);
                          }}
                          menuLabel="ZYON model"
                          className="h-9 min-w-[138px] rounded-xl border border-border bg-surface/60 px-3 text-[9px] font-semibold text-foreground"
                          aria-label="Select ZYON model"
                        >
                          {Object.entries(ZYON_MODELS).map(([key, item]) => (
                            <option key={key} value={key}>{item.label}</option>
                          ))}
                        </KwantSelect>
                        <span className="hidden text-[8px] text-muted sm:inline">{selectedRoot} live context attached</span>
                        <button
                          type="submit"
                          disabled={sending || (!draft.trim() && !attachments.length)}
                          className="ml-auto flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background transition hover:brightness-110 disabled:cursor-default disabled:opacity-30"
                        >
                          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Start
                        </button>
                      </div>
                    </div>
                    {attachmentError || sendError || speechDictation.error ? (
                      <p role="alert" className="mt-2 text-center text-[9px] text-danger">{attachmentError || sendError || speechDictation.error}</p>
                    ) : null}
                  </form>

                  <div className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1">
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
                          className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border bg-background/35 px-3 text-[9px] text-muted transition hover:border-primary/25 hover:bg-primary/[0.04] hover:text-foreground"
                        >
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          {prompt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
              <div className="space-y-4">
                {messages.map((message) => {
                  const assistant = message.role === "assistant";
                  return (
                    <div key={message.id} className={`flex gap-3 ${assistant ? "justify-start" : "justify-end"}`}>
                      {assistant ? (
                        <span className="mt-1"><ZyonAvatar size="md" /></span>
                      ) : null}
                      <div className={`max-w-[84%] ${assistant ? "" : "order-first"}`}>
                        <div className={`overflow-hidden rounded-2xl border px-4 py-3 ${
                          assistant
                            ? "border-border bg-panel/80 shadow-[0_12px_36px_rgba(0,0,0,.1)]"
                            : "border-primary/20 bg-primary/[0.09]"
                        }`}>
                          {messageAttachments(message.attachments, setImagePreview)}
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
                    <ZyonAvatar size="md" speaking />
                    <div className="flex items-center gap-2 rounded-2xl border border-border bg-panel/80 px-4 py-3 text-[10px] text-muted">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      {ZYON_MODELS[model].label} is checking your read against live context
                    </div>
                  </div>
                ) : null}
              </div>
              )}
            </div>
          </div>

          {conversationStarted ? (
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
                  disabled={sending}
                  placeholder={online ? `Message ZYON about ${selectedRoot}…` : "ZYON is paused"}
                  rows={2}
                  className="min-h-12 w-full resize-none overflow-y-hidden bg-transparent px-2 py-1 text-[11px] leading-5 text-foreground outline-none placeholder:text-muted/45"
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
                    disabled={sending || attachments.length >= MAX_ATTACHMENTS}
                    className="flex h-8 items-center gap-2 rounded-xl px-2.5 text-[9px] text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-35"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Attach
                  </button>
                  <ZyonSpeechButton speech={speechDictation} showLabel />
                  <span className="hidden text-[8px] text-muted sm:inline">Images · PDF · notes · max 4 files</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="hidden text-[8px] text-muted sm:inline">Trading scope only</span>
                    <button
                      type="submit"
                      disabled={sending || (!draft.trim() && !attachments.length)}
                      className="flex h-8 items-center gap-2 rounded-xl bg-primary px-3.5 text-[9px] font-semibold text-background transition hover:brightness-110 disabled:cursor-default disabled:opacity-30"
                    >
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send
                    </button>
                  </div>
                </div>
              </div>
              {attachmentError || sendError || speechDictation.error ? (
                <p role="alert" className="mt-2 text-[9px] text-danger">{attachmentError || sendError || speechDictation.error}</p>
              ) : null}
              <div className="mt-2 flex items-start justify-between gap-4 text-[8px] text-muted">
                <span className="max-w-[680px] leading-3">
                  ZYON provides general information only, not financial advice. You remain solely responsible for all trading decisions; to the extent permitted by law, Kwant Desk and ZYON accept no liability for financial loss or trading outcomes.
                </span>
                {lastUsage ? <span className="shrink-0 font-mono">{lastUsage.inputTokens ?? "—"} in · {lastUsage.outputTokens ?? "—"} out</span> : null}
              </div>
            </form>
          </div>
          ) : null}
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
                        <button
                          key={`${selectedEntry.id}:${attachment.name}`}
                          type="button"
                          onClick={() => {
                            if (attachment.type.startsWith("image/") && attachment.dataUrl) {
                              setImagePreview({
                                name: attachment.name,
                                dataUrl: attachment.dataUrl,
                              });
                            } else if (attachment.dataUrl) {
                              const link = document.createElement("a");
                              link.href = attachment.dataUrl;
                              link.download = attachment.name;
                              link.click();
                            }
                          }}
                          className="overflow-hidden rounded-lg border border-border"
                          aria-label={attachment.type.startsWith("image/") ? `Open ${attachment.name} full screen` : attachment.name}
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
                        </button>
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
      {folderDialogOpen ? (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={(event) => void createFolder(event)}
            className="w-full max-w-[390px] rounded-2xl border border-border bg-panel p-5 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-foreground">Create ZYON folder</h2>
                <p className="mt-1 text-[9px] leading-4 text-muted">Folders are backed up to this Google account and can contain other folders.</p>
              </div>
              <button
                type="button"
                onClick={() => setFolderDialogOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
                aria-label="Close folder dialog"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <label className="mt-5 block">
              <span className="text-[8px] font-semibold uppercase tracking-[0.13em] text-muted">Folder name</span>
              <input
                value={folderName}
                onChange={(event) => setFolderName(event.target.value.slice(0, 60))}
                autoFocus
                placeholder="e.g. London session reviews"
                className="mt-2 h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-[11px] text-foreground outline-none placeholder:text-muted/45 focus:border-primary/40"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-[8px] font-semibold uppercase tracking-[0.13em] text-muted">Place inside</span>
              <KwantSelect
                value={folderParentId}
                onChange={(event) => setFolderParentId(event.target.value)}
                menuLabel="Parent folder"
                className="mt-2 h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-[10px] text-foreground"
              >
                <option value="">Top level</option>
                {flattenedFolders.map(({ folder, depth }) => (
                  <option key={folder.id} value={folder.id}>
                    {"— ".repeat(Math.min(depth, 4))}{folder.kind === "daily" && folder.sessionDate ? formatDay(folder.sessionDate) : folder.name}
                  </option>
                ))}
              </KwantSelect>
            </label>
            {folderActionError ? <p className="mt-3 text-[9px] text-danger">{folderActionError}</p> : null}
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-[8px] text-muted">{customFolderCount}/{ZYON_CUSTOM_FOLDER_LIMIT} custom folders used</span>
              <button
                type="submit"
                disabled={!folderName.trim() || folderActionBusy}
                className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background disabled:opacity-40"
              >
                {folderActionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
                Create folder
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {folderToDelete ? (
        <div className="fixed inset-0 z-[910] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[380px] rounded-2xl border border-danger/25 bg-panel p-5 shadow-2xl shadow-black/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger">
              <Trash2 className="h-4 w-4" />
            </div>
            <h2 className="mt-4 text-[14px] font-semibold text-foreground">Delete “{folderToDelete.name}”?</h2>
            <p className="mt-2 text-[9px] leading-4 text-muted">This permanently removes the folder, its nested folders, conversation summaries, and retained images from your account.</p>
            {folderActionError ? <p className="mt-3 text-[9px] text-danger">{folderActionError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                disabled={folderActionBusy}
                className="h-9 rounded-xl border border-border px-4 text-[9px] font-medium text-muted hover:text-foreground"
              >
                Keep folder
              </button>
              <button
                type="button"
                onClick={() => void deleteFolder()}
                disabled={folderActionBusy}
                className="flex h-9 items-center gap-2 rounded-xl bg-danger px-4 text-[9px] font-semibold text-white disabled:opacity-40"
              >
                {folderActionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ZyonImagePreviewDialog imagePreview={imagePreview} onClose={() => setImagePreview(null)} />
    </div>
  );
}
