"use client";

import Image from "next/image";
import {
  Activity,
  Bot,
  BrainCircuit,
  CalendarDays,
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
  Paperclip,
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
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import KwantSelect from "@/components/ui/KwantSelect";
import type { UseKwantBotInterpreterResult } from "@/hooks/useKwantBotInterpreter";
import { formatKwantBotPrice } from "@/lib/kwantBotInterpreter";
import {
  isZyonModelKey,
  ZYON_CONVERSATION_TAG,
  ZYON_CUSTOM_FOLDER_LIMIT,
  ZYON_DAILY_ROOT_FOLDER_ID,
  ZYON_MODELS,
  zyonConversationRole,
  zyonEntryFolderId,
  zyonId,
  type ZyonAttachment,
  type ZyonFolder,
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

function messagesFromJournal(entries: ZyonJournalEntry[]) {
  return entries
    .filter((entry) => entry.tags.includes(ZYON_CONVERSATION_TAG))
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

function folderRows(folders: ZyonFolder[]) {
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
      visit(folder.id, depth + 1);
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
}: {
  interpreter: UseKwantBotInterpreterResult;
  compact?: boolean;
}) {
  const [model, setModel] = useState<ZyonModelKey>(() => {
    if (typeof window === "undefined") return "opus-5";
    const saved = window.localStorage.getItem("kwantdesk:zyon:model");
    return isZyonModelKey(saved) ? saved : "opus-5";
  });
  const [online, setOnline] = useState(true);
  const [messages, setMessages] = useState<ZyonMessage[]>([]);
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
    () => `zyon-folder-day-${localSessionDate()}`,
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
        setMessages((current) => mergeMessages(
          saved?.messages?.length ? saved.messages : [WELCOME_MESSAGE],
          current,
        ));
        setJournal((current) => mergeJournal(
          Array.isArray(saved?.journal) ? saved.journal : [],
          current,
        ));
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
      journal: journal.slice(0, 5_000),
    });
  }, [journal, messages, storeReady]);

  useEffect(() => {
    let active = true;
    fetch("/api/zyon/journal", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as {
          entries?: ZyonJournalEntry[];
          folders?: ZyonFolder[];
          cloud?: boolean;
        };
        if (!response.ok) throw new Error();
        if (!active) return;
        if (Array.isArray(payload.entries)) {
          setJournal((current) => mergeJournal(current, payload.entries ?? []));
          setMessages((current) => mergeMessages(
            current,
            messagesFromJournal(payload.entries ?? []),
          ));
        }
        if (Array.isArray(payload.folders)) {
          setFolders((current) => mergeFolders(current, payload.folders ?? []));
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

  const displayFolders = useMemo(() => {
    const now = new Date().toISOString();
    const next = mergeFolders([], folders);
    if (!next.some((folder) => folder.id === ZYON_DAILY_ROOT_FOLDER_ID)) {
      next.push({
        id: ZYON_DAILY_ROOT_FOLDER_ID,
        name: "Daily conversations",
        parentId: null,
        kind: "system",
        sessionDate: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    const dates = new Set(journal.map((entry) => entry.sessionDate));
    dates.forEach((sessionDate) => {
      const id = `zyon-folder-day-${sessionDate}`;
      if (next.some((folder) => folder.id === id)) return;
      const entries = journal.filter((entry) => entry.sessionDate === sessionDate);
      next.push({
        id,
        name: sessionDate,
        parentId: ZYON_DAILY_ROOT_FOLDER_ID,
        kind: "daily",
        sessionDate,
        createdAt: entries.at(-1)?.createdAt ?? now,
        updatedAt: entries[0]?.createdAt ?? now,
      });
    });
    return next;
  }, [folders, journal]);
  const flattenedFolders = useMemo(() => folderRows(displayFolders), [displayFolders]);
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
  const selectedEntry = journal.find((entry) => entry.id === selectedEntryId)
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

  const createFolder = async (event: FormEvent) => {
    event.preventDefault();
    if (!folderName.trim() || folderActionBusy) return;
    setFolderActionBusy(true);
    setFolderActionError("");
    try {
      const response = await fetch("/api/zyon/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: folderName,
          parentId: folderParentId || null,
          root: selectedRoot,
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
      setSelectedEntryId(null);
      setFolderDialogOpen(false);
      setFolderName("");
      setFolderParentId("");
      setCloudJournal("synced");
    } catch (error) {
      setFolderActionError(error instanceof Error ? error.message : "The folder could not be created.");
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
        const entryFolderId = zyonEntryFolderId(entry);
        if (entryFolderId && removedIds.has(entryFolderId)) return false;
        return !(folderToDelete.kind === "daily" && entry.sessionDate === folderToDelete.sessionDate);
      }));
      setSelectedFolderId(ZYON_DAILY_ROOT_FOLDER_ID);
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
            id: message.id,
            role: message.role,
            content: message.content,
            attachments: message.attachments,
          })),
          localDate: localSessionDate(),
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
          id: ZYON_DAILY_ROOT_FOLDER_ID,
          name: "Daily conversations",
          parentId: null,
          kind: "system",
          sessionDate: null,
          createdAt: now,
          updatedAt: now,
        };
        const dailyFolder: ZyonFolder = {
          id: payload.folder.id,
          name: payload.folder.sessionDate,
          parentId: selectedFolder?.kind === "custom"
            ? selectedFolder.id
            : ZYON_DAILY_ROOT_FOLDER_ID,
          kind: "daily",
          sessionDate: payload.folder.sessionDate,
          createdAt: now,
          updatedAt: now,
        };
        setFolders((current) => mergeFolders(current, [systemFolder, dailyFolder]));
        setSelectedFolderId(dailyFolder.id);
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

  if (compact) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <header className="shrink-0 border-b border-border bg-panel">
          <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_22px_color-mix(in_srgb,var(--primary)_12%,transparent)]">
              <Sparkles className="h-4 w-4" />
            </span>
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

        <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--primary)_5%,transparent),transparent_38%)] px-3 py-4">
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
                      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <Sparkles className="h-3 w-3" />
                      </span>
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
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <Sparkles className="h-3 w-3 animate-pulse" />
                  </span>
                  <span className="flex items-center gap-2 rounded-2xl border border-border bg-panel/85 px-3 py-2.5 text-[9px] text-muted">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ZYON is analysing
                  </span>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
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
              disabled={!online || sending}
              placeholder={online ? `Message ZYON about ${selectedRoot}…` : "ZYON is paused"}
              rows={2}
              className="max-h-28 min-h-10 w-full resize-none bg-transparent px-2 py-1 text-[10px] leading-5 text-foreground outline-none placeholder:text-muted/45"
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
                disabled={!online || sending || attachments.length >= MAX_ATTACHMENTS}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-primary disabled:opacity-35"
                title="Attach a chart, image or file"
                aria-label="Attach a chart, image or file"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <span className="text-[8px] text-muted">Images and files</span>
              <button
                type="submit"
                disabled={!online || sending || (!draft.trim() && !attachments.length)}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background transition hover:brightness-110 disabled:opacity-30"
                title="Send to ZYON"
                aria-label="Send to ZYON"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          {attachmentError || sendError ? (
            <p role="alert" className="mt-1.5 px-1 text-[8px] leading-3 text-danger">{attachmentError || sendError}</p>
          ) : (
            <p className="mt-1.5 px-1 text-[7px] text-muted">Shared with the full ZYON page and account journal</p>
          )}
        </form>

        <ZyonImagePreviewDialog imagePreview={imagePreview} onClose={() => setImagePreview(null)} />
      </div>
    );
  }

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
                <div className="mt-0.5 text-[8px] text-muted">{journal.length} summaries · {customFolderCount}/{ZYON_CUSTOM_FOLDER_LIMIT} folders</div>
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
                  const entries = active ? selectedFolderEntries : [];
                  return (
                    <div key={folder.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFolderId(folder.id);
                          if (folder.sessionDate) setSelectedDay(folder.sessionDate);
                          setSelectedEntryId(entries[0]?.id ?? null);
                        }}
                        className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                          active
                            ? "border-primary/25 bg-primary/[0.07] text-foreground"
                            : "border-transparent text-muted hover:border-border hover:bg-surface/60 hover:text-foreground"
                        }`}
                        style={{ paddingLeft: `${10 + Math.min(depth, 4) * 12}px` }}
                      >
                        {active ? <FolderOpen className="h-4 w-4 shrink-0 text-primary" /> : <Folder className="h-4 w-4 shrink-0" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] font-medium">
                            {folder.kind === "daily" && folder.sessionDate ? formatDay(folder.sessionDate) : folder.name}
                          </span>
                          <span className="mt-0.5 block text-[8px] text-muted">
                            {folder.kind === "system"
                              ? "Automatic archive"
                              : folder.kind === "custom"
                                ? "Custom folder"
                                : `${entries.length || journal.filter((entry) => entry.sessionDate === folder.sessionDate).length} summaries`}
                          </span>
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
