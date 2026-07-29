"use client";

import {
  Activity,
  Archive,
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  Bookmark,
  Camera,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Compass,
  Eye,
  EyeOff,
  Flame,
  Gauge,
  Globe2,
  Image as ImageIcon,
  Layers3,
  LockKeyhole,
  Medal,
  MessageCircle,
  Network,
  Plus,
  Radar,
  Repeat2,
  Search,
  Send,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  Trophy,
  Upload,
  UserPlus,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import KwantSelect from "@/components/ui/KwantSelect";
import SocialProfileView from "@/components/socials/SocialProfileView";
import {
  buildDefaultProfile,
  calculateReasoningScore,
  calculateReceiptClassification,
  calculateReceiptScores,
  CALLING_CARD_CATALOG,
  normalizeSocialProfile,
  PROCESS_STATUSES,
  profileScoreAverage,
  socialId,
  todayKey,
  type SocialCardPayload,
  type SocialCommentPayload,
  type SocialConsensusPayload,
  type SocialDeskMemberPayload,
  type SocialDeskPayload,
  type SocialObject,
  type SocialPrecordPayload,
  type SocialPostPayload,
  type SocialProcessStatus,
  type SocialProfilePayload,
  type SocialProgressPayload,
  type SocialReactionPayload,
  type SocialReceiptPayload,
  type SocialScope,
  type SocialState,
} from "@/lib/socials";
import { buildExecutionComparison } from "@/lib/socials";
import { SOCIAL_RECORD_COPY, SOCIAL_RECORD_RULES } from "@/lib/socialRecordConfig";
import {
  GAMEPLAN_SESSIONS,
  gameplanSessionLabel,
  type GameplanPayload,
  type GameplanSession,
} from "@/lib/gameplan";
import { loadSocialState, normalizeSocialState, saveSocialState } from "@/lib/socialsStore";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SocialTab = "today" | "precords" | "desks" | "rankings" | "cards" | "profile";
type FeedFilter = "all" | "live" | "proven" | "mine";
type AvatarCropDraft = {
  sourceUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

const AVATAR_CROP_SIZE = 288;
const AVATAR_OUTPUT_SIZE = 512;
const MAX_AVATAR_SOURCE_BYTES = 12_000_000;

function avatarCropScale(draft: AvatarCropDraft, zoom = draft.zoom) {
  return Math.max(
    AVATAR_CROP_SIZE / draft.naturalWidth,
    AVATAR_CROP_SIZE / draft.naturalHeight,
  ) * zoom;
}

function clampAvatarOffset(draft: AvatarCropDraft, offsetX: number, offsetY: number, zoom = draft.zoom) {
  const scale = avatarCropScale(draft, zoom);
  const maxX = Math.max(0, (draft.naturalWidth * scale - AVATAR_CROP_SIZE) / 2);
  const maxY = Math.max(0, (draft.naturalHeight * scale - AVATAR_CROP_SIZE) / 2);
  return {
    offsetX: Math.max(-maxX, Math.min(maxX, offsetX)),
    offsetY: Math.max(-maxY, Math.min(maxY, offsetY)),
  };
}

const SOCIAL_TABS: Array<{ id: SocialTab; label: string; icon: typeof Activity }> = [
  { id: "today", label: "Record", icon: Activity },
  { id: "precords", label: "Community", icon: Network },
  { id: "desks", label: "Desks", icon: UsersRound },
  { id: "rankings", label: "Reputation", icon: Trophy },
  { id: "cards", label: "Calling Cards", icon: Award },
  { id: "profile", label: "Profile", icon: Radar },
];

const SCORE_LABELS: Array<[keyof SocialProfilePayload["scores"], string]> = [
  ["preparation", "Preparation"],
  ["confirmation", "Confirmation"],
  ["review", "Review Integrity"],
  ["calibration", "Calibration"],
  ["patience", "Patience"],
  ["contribution", "Community Value"],
  ["consistency", "Consistency"],
  ["research", "Research"],
];

const PROGRESS_STEPS: Array<{ key: keyof Pick<SocialProgressPayload, "prepare" | "map" | "observe" | "review" | "improve">; label: string }> = [
  { key: "prepare", label: "Prepare" },
  { key: "map", label: "Map" },
  { key: "observe", label: "Observe" },
  { key: "review", label: "Review" },
  { key: "improve", label: "Improve" },
];

const EMPTY_PROGRESS = (): SocialProgressPayload => ({
  sessionDate: todayKey(),
  prepare: false,
  map: false,
  observe: false,
  review: false,
  improve: false,
  noTrade: false,
  graceDay: false,
});

const EMPTY_RECEIPT = {
  actualDirection: "LONG" as "LONG" | "SHORT",
  actualEntry: "",
  entryTime: "",
  actualStop: "",
  actualExit: "",
  exitTime: "",
  size: "",
  maximumActualRisk: "",
  fill2Price: "",
  fill2Size: "",
  fill2Time: "",
  exit2Price: "",
  exit2Size: "",
  exit2Time: "",
  partialExits: "",
  fees: "",
  confirmationsAppeared: "",
  deviationReason: "",
  deviationDetail: "",
  outcomeReview: "",
  nextTimeRule: "",
  evidenceName: "",
  evidenceDataUrl: "",
  noTrade: false,
};

const EMPTY_POST = {
  kind: "LIVE OBSERVATION" as SocialPostPayload["kind"],
  instrument: "NQ",
  title: "",
  body: "",
  context: "",
  condition: "",
  invalidation: "",
  scope: "community" as SocialScope,
};

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatDate(value: string, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", includeTime
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "KD";
}

function objectKey(object: Pick<SocialObject, "userId" | "id">) {
  return `${object.userId}:${object.id}`;
}

function typedPayload<T>(object: SocialObject | undefined | null) {
  return (object?.payload ?? null) as T | null;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-panel ${className}`}>{children}</div>;
}

function Avatar({ label, active = false, size = "md" }: { label: string; active?: boolean; size?: "sm" | "md" | "lg" }) {
  const classes = size === "lg" ? "h-14 w-14 text-[14px]" : size === "sm" ? "h-7 w-7 text-[8px]" : "h-9 w-9 text-[10px]";
  return (
    <span className={`relative flex shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 font-semibold text-primary ${classes}`}>
      {initials(label)}
      {active ? <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-panel bg-primary" /> : null}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[8px]">
        <span className="text-muted">{label}</span>
        <span className="font-mono font-semibold text-foreground">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function ScopeBadge({ scope }: { scope: SocialScope }) {
  const Icon = scope === "private" ? EyeOff : scope === "community" ? Globe2 : scope === "desk" ? UsersRound : Eye;
  return <span className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.1em] text-muted"><Icon className="h-3 w-3" />{scope}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const active = ["LIVE", "ENTRY TRIGGERED", "UNDER REVIEW"].includes(status);
  const completed = ["PROVEN", "ADAPTED", "NO TRIGGER", "NO TRADE"].includes(status);
  return (
    <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[7px] font-semibold tracking-[0.08em] ${active ? "border-primary/30 bg-primary/10 text-primary" : completed ? "border-accent/30 bg-accent/10 text-accent" : "border-border bg-surface text-muted"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "animate-pulse bg-primary" : completed ? "bg-accent" : "bg-muted"}`} />
      {status}
    </span>
  );
}

function ProgressRing({ value }: { value: number }) {
  const degrees = Math.round(value * 3.6);
  return (
    <div className="relative flex h-24 w-24 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${degrees}deg, color-mix(in srgb, var(--surface) 92%, transparent) ${degrees}deg)` }}>
      <div className="absolute inset-[7px] rounded-full border border-border bg-panel" />
      <div className="relative text-center">
        <div className="font-mono text-[22px] font-semibold text-foreground">{value}%</div>
        <div className="text-[7px] uppercase tracking-[0.14em] text-muted">Full loop</div>
      </div>
    </div>
  );
}

function buildLocalObject<T extends Record<string, unknown>>(args: {
  id?: string;
  userId: string;
  authorLabel: string;
  objectType: SocialObject["objectType"];
  scope: SocialScope;
  deskId?: string | null;
  parentId?: string | null;
  payload: T;
}): SocialObject<T> {
  const now = new Date().toISOString();
  return {
    id: args.id ?? socialId(args.objectType),
    userId: args.userId,
    authorLabel: args.authorLabel,
    objectType: args.objectType,
    scope: args.scope,
    deskId: args.deskId ?? null,
    parentId: args.parentId ?? null,
    payload: args.payload,
    createdAt: now,
    updatedAt: now,
    cloudSaved: false,
  };
}

export default function SocialsWorkspace({
  accountKey,
  accountLabel,
  initialProfileHandle = "",
  onOpenProfile,
  onCloseProfile,
  onMessageProfile,
}: {
  accountKey: string;
  accountLabel: string;
  initialProfileHandle?: string;
  onOpenProfile?: (handle: string) => void;
  onCloseProfile?: () => void;
  onMessageProfile?: (userId: string) => void;
}) {
  const resolvedAccountKey = accountKey || "local";
  const resolvedLabel = accountLabel || "Kwant Trader";
  const [state, setState] = useState<SocialState>(() => ({
    version: 1,
    objects: [
      buildLocalObject({
        id: "profile",
        userId: resolvedAccountKey,
        authorLabel: resolvedLabel,
        objectType: "profile",
        scope: "community",
        payload: buildDefaultProfile(resolvedLabel),
      }),
    ],
    cloud: false,
    loadedAt: "",
  }));
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<"loading" | "saved" | "local" | "error">("loading");
  const [tab, setTab] = useState<SocialTab>(initialProfileHandle ? "profile" : "today");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [query, setQuery] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const [showReceiptFor, setShowReceiptFor] = useState<string | null>(null);
  const [showDeskModal, setShowDeskModal] = useState(false);
  const [gameplanInstrument, setGameplanInstrument] = useState<"NQ" | "ES">("NQ");
  const [gameplanSession, setGameplanSession] = useState<GameplanSession>("newyork");
  const [gameplan, setGameplan] = useState<GameplanPayload | null>(null);
  const [gameplanState, setGameplanState] = useState<"loading" | "ready" | "error">("loading");
  const [recordScope, setRecordScope] = useState<SocialScope>("private");
  const [assessmentState, setAssessmentState] = useState<"idle" | "reviewing">("idle");
  const [receiptDraft, setReceiptDraft] = useState(EMPTY_RECEIPT);
  const [postDraft, setPostDraft] = useState(EMPTY_POST);
  const [deskDraft, setDeskDraft] = useState({
    name: "",
    description: "",
    markets: "NQ",
    session: "New York",
    timezone: "Australia/Brisbane",
    objective: "",
    privacy: "REQUEST" as SocialDeskPayload["privacy"],
    capacity: "8",
    weeklyMission: "Complete five preparation loops and three honest reviews.",
  });
  const [profileDraft, setProfileDraft] = useState<SocialProfilePayload>(() => buildDefaultProfile(resolvedLabel));
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaveState, setProfileSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [avatarCrop, setAvatarCrop] = useState<AvatarCropDraft | null>(null);
  const [avatarCropSaving, setAvatarCropSaving] = useState(false);
  const [selectedProfileRecord, setSelectedProfileRecord] = useState<SocialObject | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentKinds, setCommentKinds] = useState<Record<string, SocialCommentPayload["kind"]>>({});
  const [consensusDraft, setConsensusDraft] = useState({
    instrument: "NQ",
    level: "Primary positioning wall",
    interpretation: "",
    bullConfirmation: "",
    bearConfirmation: "",
    invalidation: "",
    enoughEvidence: false,
  });
  const [notice, setNotice] = useState("");
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarCropSourceRef = useRef<string | null>(null);
  const avatarDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const upsertObject = useCallback((object: SocialObject, replaceKey?: string) => {
    setState((current) => ({
      ...current,
      objects: [
        object,
        ...current.objects.filter((candidate) => {
          if (replaceKey && objectKey(candidate) === replaceKey) return false;
          return objectKey(candidate) !== objectKey(object);
        }),
      ].slice(0, 5_000),
    }));
  }, []);

  const saveObject = useCallback(async (object: SocialObject) => {
    const optimisticKey = objectKey(object);
    upsertObject(object);
    setSaveState("loading");
    try {
      const response = await fetch("/api/socials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object: {
            id: object.id,
            objectType: object.objectType,
            scope: object.scope,
            deskId: object.deskId,
            parentId: object.parentId,
            authorLabel: object.authorLabel,
            payload: object.payload,
          },
        }),
      });
      const payload = await response.json() as { object?: SocialObject; cloud?: boolean; error?: string };
      if (!response.ok || !payload.object) {
        setState((current) => ({ ...current, cloud: false }));
        setSaveState("local");
        if (payload.error && response.status !== 503) setNotice(payload.error);
        return object;
      }
      const saved = { ...payload.object, cloudSaved: true };
      upsertObject(saved, optimisticKey);
      setState((current) => ({ ...current, cloud: true }));
      setSaveState("saved");
      return saved;
    } catch {
      setState((current) => ({ ...current, cloud: false }));
      setSaveState("local");
      return object;
    }
  }, [upsertObject]);

  const removeObject = useCallback(async (object: SocialObject) => {
    setState((current) => ({
      ...current,
      objects: current.objects.filter((candidate) => objectKey(candidate) !== objectKey(object)),
    }));
    try {
      const response = await fetch("/api/socials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: object.id }),
      });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error || "That Socials item could not be removed.");
      }
      return true;
    } catch (reason) {
      upsertObject(object);
      setNotice(reason instanceof Error ? reason.message : "That Socials item could not be removed.");
      return false;
    }
  }, [upsertObject]);

  useEffect(() => {
    let active = true;
    setState({
      version: 1,
      objects: [
        buildLocalObject({
          id: "profile",
          userId: resolvedAccountKey,
          authorLabel: resolvedLabel,
          objectType: "profile",
          scope: "community",
          payload: buildDefaultProfile(resolvedLabel),
        }),
      ],
      cloud: false,
      loadedAt: "",
    });
    setReady(false);
    setSaveState("loading");
    void (async () => {
      const local = await loadSocialState(resolvedAccountKey);
      if (!active) return;
      let next = local;
      try {
        const response = await fetch("/api/socials", { cache: "no-store" });
        const payload = await response.json() as { objects?: SocialObject[]; cloud?: boolean; viewerId?: string };
        if (response.ok && payload.cloud && Array.isArray(payload.objects)) {
          const remoteKeys = new Set(payload.objects.map(objectKey));
          next = normalizeSocialState({
            version: 1,
            cloud: true,
            loadedAt: new Date().toISOString(),
            objects: [
              ...payload.objects.map((object) => ({ ...object, cloudSaved: true })),
              ...local.objects.filter((object) => !object.cloudSaved && !remoteKeys.has(objectKey(object))),
            ],
          });
        }
      } catch {
        next = { ...local, cloud: false };
      }
      if (!active) return;
      const hasProfile = next.objects.some((object) => object.objectType === "profile" && object.userId === resolvedAccountKey);
      if (!hasProfile) {
        next = {
          ...next,
          objects: [
            buildLocalObject({
              id: "profile",
              userId: resolvedAccountKey,
              authorLabel: resolvedLabel,
              objectType: "profile",
              scope: "community",
              payload: buildDefaultProfile(resolvedLabel),
            }),
            ...next.objects,
          ],
        };
      }
      setState(next);
      setReady(true);
      setSaveState(next.cloud ? "saved" : "local");
    })();
    return () => {
      active = false;
    };
  }, [resolvedAccountKey, resolvedLabel]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      void saveSocialState(resolvedAccountKey, state);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [ready, resolvedAccountKey, state]);

  const profiles = useMemo(() => state.objects.filter((object) => object.objectType === "profile"), [state.objects]);
  const posts = useMemo(() => state.objects.filter((object) => object.objectType === "post").sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)), [state.objects]);
  const precords = useMemo(() => state.objects.filter((object) => object.objectType === "precord").sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)), [state.objects]);
  const receipts = useMemo(() => state.objects.filter((object) => object.objectType === "receipt"), [state.objects]);
  const desks = useMemo(() => state.objects.filter((object) => object.objectType === "desk"), [state.objects]);
  const memberships = useMemo(() => state.objects.filter((object) => object.objectType === "desk-member"), [state.objects]);
  const comments = useMemo(() => state.objects.filter((object) => object.objectType === "comment"), [state.objects]);
  const reactions = useMemo(() => state.objects.filter((object) => object.objectType === "reaction"), [state.objects]);
  const follows = useMemo(() => state.objects.filter((object) => object.objectType === "follow"), [state.objects]);
  const cards = useMemo(() => state.objects.filter((object) => object.objectType === "card"), [state.objects]);
  const consensus = useMemo(() => state.objects.filter((object) => object.objectType === "consensus"), [state.objects]);
  const currentProfileObject = profiles.find((object) => object.userId === resolvedAccountKey);
  const currentProfile = normalizeSocialProfile(currentProfileObject?.payload, resolvedLabel);
  const requestedProfileHandle = initialProfileHandle.trim().toLowerCase().replace(/^@/, "");
  const viewedProfileObject = requestedProfileHandle
    ? profiles.find((object) => normalizeSocialProfile(object.payload, object.authorLabel).handle === requestedProfileHandle)
    : currentProfileObject;
  const viewedProfile = viewedProfileObject
    ? normalizeSocialProfile(viewedProfileObject.payload, viewedProfileObject.authorLabel)
    : null;
  const viewingOwnProfile = Boolean(viewedProfileObject && viewedProfileObject.userId === resolvedAccountKey);
  const viewedGameplans = viewedProfileObject
    ? precords.filter((object) =>
        object.userId === viewedProfileObject.userId
        && typedPayload<SocialPrecordPayload>(object)?.source === "GAMEPLAN")
    : [];
  const savedGameplanIds = new Set(
    reactions
      .filter((reaction) => reaction.userId === resolvedAccountKey && typedPayload<SocialReactionPayload>(reaction)?.kind === "SAVED")
      .map((reaction) => reaction.parentId)
      .filter((id): id is string => Boolean(id)),
  );
  const repostedGameplanIds = new Set(
    posts
      .filter((post) => post.userId === resolvedAccountKey && typedPayload<SocialPostPayload>(post)?.isRepost)
      .map((post) => typedPayload<SocialPostPayload>(post)?.relatedPrecordId)
      .filter((id): id is string => Boolean(id)),
  );
  const todayProgressObject = state.objects.find((object) =>
    object.objectType === "progress"
    && object.userId === resolvedAccountKey
    && typedPayload<SocialProgressPayload>(object)?.sessionDate === todayKey());
  const todayProgress = typedPayload<SocialProgressPayload>(todayProgressObject) ?? EMPTY_PROGRESS();
  const completedProgress = PROGRESS_STEPS.filter((step) => todayProgress[step.key]).length;
  const progressPercent = Math.round(completedProgress / PROGRESS_STEPS.length * 100);
  const currentMemberships = memberships.filter((object) => object.userId === resolvedAccountKey);
  const currentDeskIds = new Set(currentMemberships.map((object) => object.deskId).filter(Boolean));
  const myDesks = desks.filter((object) => currentDeskIds.has(object.id) || object.userId === resolvedAccountKey);
  const availableDesks = desks.filter((object) => !currentDeskIds.has(object.id) && object.userId !== resolvedAccountKey);
  const todayConsensus = consensus.find((object) =>
    object.userId === resolvedAccountKey
    && typedPayload<SocialConsensusPayload>(object)?.sessionDate === todayKey());

  useEffect(() => {
    setProfileDraft(currentProfile);
  }, [currentProfileObject?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profileEditing) setProfileSaveState("idle");
  }, [profileEditing]);

  useEffect(() => {
    if (!initialProfileHandle) return;
    setTab("profile");
    setProfileEditing(false);
    setSelectedProfileRecord(null);
  }, [initialProfileHandle]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setGameplanState("loading");
    void (async () => {
      try {
        const response = await fetch(`/api/gameplan?root=${gameplanInstrument}&session=${gameplanSession}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as GameplanPayload & { error?: string };
        if (!response.ok || !payload.plan) throw new Error(payload.error || "Gameplan unavailable");
        if (!active) return;
        setGameplan(payload);
        setGameplanState("ready");
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setGameplan(null);
        setGameplanState("error");
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [gameplanInstrument, gameplanSession]);

  const currentGameplanId = gameplan
    ? `${gameplan.instrument}:${gameplanSession}:${gameplan.generated_at}`
    : "";
  const lockedCurrentGameplan = precords.find((object) => {
    if (object.userId !== resolvedAccountKey) return false;
    const payload = typedPayload<SocialPrecordPayload>(object);
    return Boolean(payload && payload.source === "GAMEPLAN" && payload.sourceGameplanId === currentGameplanId);
  });

  const visiblePrecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return precords.filter((object) => {
      const payload = typedPayload<SocialPrecordPayload>(object);
      if (!payload) return false;
      const receipt = receipts.find((candidate) => candidate.parentId === object.id);
      if (feedFilter === "mine" && object.userId !== resolvedAccountKey) return false;
      if (feedFilter === "live" && receipt) return false;
      if (feedFilter === "proven" && !receipt) return false;
      if (normalizedQuery && ![
        payload.instrument,
        payload.marketContext,
        payload.confirmation,
        payload.invalidation,
        object.authorLabel,
      ].some((value) => value.toLowerCase().includes(normalizedQuery))) return false;
      return true;
    });
  }, [feedFilter, precords, query, receipts, resolvedAccountKey]);

  const rankedProfiles = useMemo(() => profiles
    .map((object) => ({ object, profile: normalizeSocialProfile(object.payload, object.authorLabel) }))
    .sort((left, right) => profileScoreAverage(right.profile) - profileScoreAverage(left.profile)), [profiles]);

  const notificationItems = useMemo(() => {
    const mine = new Set(precords.filter((object) => object.userId === resolvedAccountKey).map((object) => object.id));
    const openReceipts = precords.filter((object) => object.userId === resolvedAccountKey && !receipts.some((receipt) => receipt.parentId === object.id));
    const reviewComments = comments.filter((comment) => comment.parentId && mine.has(comment.parentId) && comment.userId !== resolvedAccountKey);
    return [
      ...openReceipts.slice(0, 2).map((precord) => ({
        id: `receipt:${precord.id}`,
        title: `${typedPayload<SocialPrecordPayload>(precord)?.instrument ?? "Plan"} is waiting for its receipt`,
        detail: "Complete the outcome or record No Trigger.",
      })),
      ...reviewComments.slice(0, 2).map((comment) => ({
        id: comment.id,
        title: `${comment.authorLabel} reviewed your record`,
        detail: typedPayload<SocialCommentPayload>(comment)?.body ?? "",
      })),
      ...(myDesks.length ? [{ id: "desk-mission", title: "Your Desk mission is active", detail: "One completed review moves the shared standard forward." }] : []),
    ];
  }, [comments, myDesks.length, precords, receipts, resolvedAccountKey]);

  const saveProgressPatch = async (patch: Partial<SocialProgressPayload>) => {
    const currentProgress = typedPayload<SocialProgressPayload>(state.objects.find((object) =>
      object.objectType === "progress"
      && object.userId === resolvedAccountKey
      && typedPayload<SocialProgressPayload>(object)?.sessionDate === todayKey(),
    )) ?? EMPTY_PROGRESS();
    const payload = { ...currentProgress, ...patch };
    return saveObject(buildLocalObject({
      id: `progress:${todayKey()}`,
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "progress",
      scope: "private",
      payload,
    }));
  };

  const updateProgress = (key: keyof SocialProgressPayload, value: boolean) => {
    void saveProgressPatch({ [key]: value });
  };

  const updateStatus = (status: SocialProcessStatus) => {
    const profile = { ...currentProfile, processStatus: status };
    setProfileDraft(profile);
    void saveObject(buildLocalObject({
      id: "profile",
      userId: resolvedAccountKey,
      authorLabel: profile.displayName,
      objectType: "profile",
      scope: profile.visibility.profile,
      payload: profile,
    }));
  };

  const lockCurrentGameplan = async () => {
    if (!gameplan || gameplanState !== "ready") {
      setNotice("The current Gameplan must finish loading before it can be locked.");
      return;
    }
    if (lockedCurrentGameplan) {
      setNotice("This exact Gameplan is already locked and awaiting its outcome.");
      return;
    }
    if (recordScope === "desk" && !myDesks.length) {
      setNotice("Create or join a Desk before using Desk visibility.");
      return;
    }

    const trade = gameplan.plan.one_trade;
    const context = [
      gameplan.plan.one_liner,
      gameplan.plan.environment.tape.plain,
      gameplan.plan.environment.flow.plain,
    ].filter(Boolean).join(" ");
    const confirmation = [
      `Long permission: ${trade.long_side.permission}`,
      `Short permission: ${trade.short_side.permission}`,
    ].join("\n");
    const invalidation = [
      `No trade if: ${trade.not_a_trade_if}`,
      `Long stop: ${trade.long_side.stop}`,
      `Short stop: ${trade.short_side.stop}`,
    ].join("\n");
    const snapshot = {
      edition: gameplan.plan.edition,
      environment: gameplan.plan.environment,
      oneLiner: gameplan.plan.one_liner,
      oneTrade: {
        zone: trade.zone,
        longSide: {
          permission: trade.long_side.permission,
          stop: trade.long_side.stop,
          targets: trade.long_side.targets,
        },
        shortSide: {
          permission: trade.short_side.permission,
          stop: trade.short_side.stop,
          targets: trade.short_side.targets,
        },
        notATradeIf: trade.not_a_trade_if,
      },
      ladder: gameplan.plan.ladder.slice(0, 12).map((level) => ({
        zone: level.zone,
        name: level.name,
        role: level.role,
        strength: level.strength,
        why: level.why,
      })),
    };
    const base = {
      instrument: gameplan.instrument,
      session: gameplanSessionLabel(gameplanSession),
      direction: "BOTH" as const,
      marketContext: context,
      plannedEntryLow: trade.zone[0],
      plannedEntryHigh: trade.zone[1],
      plannedStop: null,
      plannedTarget: null,
      plannedSize: null,
      maximumRisk: null,
      plannedRiskReward: null,
      bullCondition: trade.long_side.permission,
      bearCondition: trade.short_side.permission,
      confirmation,
      invalidation,
      expiryAt: null,
      source: "GAMEPLAN" as const,
      sourceGameplanId: currentGameplanId,
      sourceGameplanVersion: gameplan.plan.edition.published_at,
      sourceGeneratedAt: gameplan.generated_at,
      gameplanSnapshot: snapshot,
      scoreModelVersion: SOCIAL_RECORD_RULES.scoreModelVersion,
      evidenceState: "PLATFORM TIMESTAMPED" as const,
    };
    const now = new Date().toISOString();
    const object = buildLocalObject({
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "precord",
      scope: recordScope,
      deskId: recordScope === "desk" ? myDesks[0]?.id ?? null : null,
      payload: {
        ...base,
        lockedAt: now,
        reasoningScore: calculateReasoningScore(base),
        status: "LOCKED",
        lifecycle: [{
          status: "LOCKED",
          at: now,
          source: "PLATFORM",
          note: "Immutable Gameplan snapshot placed on record.",
        }],
      } satisfies SocialPrecordPayload,
    });
    await saveObject(object);
    if (!cards.some((card) => card.userId === resolvedAccountKey && typedPayload<SocialCardPayload>(card)?.code === "first-on-record")) {
      const definition = CALLING_CARD_CATALOG[0];
      await saveObject(buildLocalObject({
        id: `card:${definition.code}`,
        userId: resolvedAccountKey,
        authorLabel: currentProfile.displayName,
        objectType: "card",
        scope: "community",
        payload: {
          code: definition.code,
          name: definition.name,
          family: definition.family,
          description: definition.description,
          earnedAt: now,
          active: true,
          equipped: false,
          public: true,
        } satisfies SocialCardPayload,
      }));
    }
    await saveProgressPatch({ prepare: true, map: true });
    setNotice(`${gameplan.instrument} Gameplan locked. The source plan and its reasoning can no longer be rewritten.`);
  };

  const submitReceipt = async () => {
    const parent = precords.find((object) => object.id === showReceiptFor);
    if (!parent) return;
    const plan = typedPayload<SocialPrecordPayload>(parent);
    if (!plan) return;
    setAssessmentState("reviewing");
    const draftExecution = {
      actualDirection: receiptDraft.noTrade ? null : receiptDraft.actualDirection,
      actualEntry: numberOrNull(receiptDraft.actualEntry),
      entryTime: receiptDraft.entryTime ? new Date(receiptDraft.entryTime).toISOString() : null,
      actualStop: numberOrNull(receiptDraft.actualStop),
      actualExit: numberOrNull(receiptDraft.actualExit),
      exitTime: receiptDraft.exitTime ? new Date(receiptDraft.exitTime).toISOString() : null,
      size: numberOrNull(receiptDraft.size),
      maximumActualRisk: numberOrNull(receiptDraft.maximumActualRisk),
      confirmationsAppeared: receiptDraft.confirmationsAppeared.trim(),
      deviationReason: receiptDraft.deviationReason,
      deviationDetail: receiptDraft.deviationDetail.trim(),
      outcomeReview: receiptDraft.outcomeReview.trim(),
      nextTimeRule: receiptDraft.nextTimeRule.trim(),
      noTrade: receiptDraft.noTrade,
      hasEvidence: Boolean(receiptDraft.evidenceDataUrl),
    };
    const localClassification = calculateReceiptClassification(
      receiptDraft.deviationReason,
      receiptDraft.deviationDetail,
      receiptDraft.confirmationsAppeared,
      Boolean(receiptDraft.evidenceDataUrl),
      receiptDraft.noTrade,
    );
    let comparison = buildExecutionComparison(plan, draftExecution);
    let assessment: NonNullable<SocialReceiptPayload["assessment"]> = {
      classification: localClassification,
      explanation: receiptDraft.noTrade
        ? "The stated confirmation did not create an execution. This is a valid process-complete result."
        : "The actual execution was compared with the immutable Gameplan using the current Kwant process rules.",
      evidenceUsed: ["Locked Gameplan", receiptDraft.confirmationsAppeared ? "Recorded confirmation" : ""].filter(Boolean),
      evidenceMissing: receiptDraft.evidenceDataUrl ? [] : ["Broker-verified execution evidence"],
      confidence: receiptDraft.evidenceDataUrl ? 0.74 : 0.52,
      evaluator: "RULES",
      modelVersion: SOCIAL_RECORD_RULES.scoreModelVersion,
      rubricVersion: SOCIAL_RECORD_RULES.assessmentRubricVersion,
      assessedAt: new Date().toISOString(),
      appealAvailable: true,
    };
    try {
      const response = await fetch("/api/socials/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, execution: draftExecution }),
      });
      const reviewed = await response.json() as {
        comparison?: SocialReceiptPayload["comparison"];
        assessment?: SocialReceiptPayload["assessment"];
      };
      if (response.ok && reviewed.comparison?.length) comparison = reviewed.comparison;
      if (response.ok && reviewed.assessment) assessment = reviewed.assessment;
    } catch {
      // The rules-based assessment remains explicit and usable if ZYON is unavailable.
    }
    const classification = assessment.classification;
    const scores = calculateReceiptScores({
      classification,
      confirmations: receiptDraft.confirmationsAppeared,
      review: receiptDraft.outcomeReview,
      nextTimeRule: receiptDraft.nextTimeRule,
      hasEvidence: Boolean(receiptDraft.evidenceDataUrl),
      noTrade: receiptDraft.noTrade,
    });
    const fillTwoPrice = numberOrNull(receiptDraft.fill2Price);
    const exitTwoPrice = numberOrNull(receiptDraft.exit2Price);
    const retrospective = Boolean(draftExecution.entryTime && Date.parse(draftExecution.entryTime) < Date.parse(plan.lockedAt));
    const payload: SocialReceiptPayload = {
      actualDirection: draftExecution.actualDirection,
      actualEntry: draftExecution.actualEntry,
      entryTime: draftExecution.entryTime,
      actualStop: draftExecution.actualStop,
      actualExit: draftExecution.actualExit,
      exitTime: draftExecution.exitTime,
      size: draftExecution.size,
      maximumActualRisk: draftExecution.maximumActualRisk,
      partialExits: receiptDraft.partialExits.trim(),
      fees: numberOrNull(receiptDraft.fees),
      confirmationsAppeared: draftExecution.confirmationsAppeared,
      deviationReason: receiptDraft.deviationReason,
      deviationDetail: draftExecution.deviationDetail,
      outcomeReview: draftExecution.outcomeReview,
      nextTimeRule: draftExecution.nextTimeRule,
      evidenceName: receiptDraft.evidenceName,
      evidenceDataUrl: receiptDraft.evidenceDataUrl,
      noTrade: receiptDraft.noTrade,
      classification,
      scores,
      addedAt: new Date().toISOString(),
      fills: [
        { price: draftExecution.actualEntry, size: draftExecution.size, time: draftExecution.entryTime },
        ...(fillTwoPrice === null ? [] : [{
          price: fillTwoPrice,
          size: numberOrNull(receiptDraft.fill2Size),
          time: receiptDraft.fill2Time ? new Date(receiptDraft.fill2Time).toISOString() : null,
        }]),
      ],
      exits: [
        { price: draftExecution.actualExit, size: draftExecution.size, time: draftExecution.exitTime },
        ...(exitTwoPrice === null ? [] : [{
          price: exitTwoPrice,
          size: numberOrNull(receiptDraft.exit2Size),
          time: receiptDraft.exit2Time ? new Date(receiptDraft.exit2Time).toISOString() : null,
        }]),
      ],
      comparison,
      retrospective,
      evidenceState: "SELF REPORTED",
      assessment,
      scoreSnapshot: {
        reasoning: plan.reasoningScore,
        reasoningModelVersion: plan.scoreModelVersion ?? SOCIAL_RECORD_RULES.scoreModelVersion,
        postExecutionModelVersion: SOCIAL_RECORD_RULES.scoreModelVersion,
        createdAt: new Date().toISOString(),
      },
    };
    await saveObject(buildLocalObject({
      id: `receipt:${parent.id}`,
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "receipt",
      scope: parent.scope,
      deskId: parent.deskId,
      parentId: parent.id,
      payload,
    }));
    await saveProgressPatch({
      review: true,
      improve: Boolean(payload.nextTimeRule),
      noTrade: payload.noTrade,
    });
    setReceiptDraft(EMPTY_RECEIPT);
    setShowReceiptFor(null);
    setAssessmentState("idle");
    setNotice(payload.noTrade ? "No Trigger recorded. Discipline counts even when no trade was placed." : "Execution receipt added without altering the original plan.");
  };

  const createDesk = async () => {
    if (!deskDraft.name.trim() || !deskDraft.objective.trim()) {
      setNotice("A Desk needs a name and a shared objective.");
      return;
    }
    const payload: SocialDeskPayload = {
      name: deskDraft.name.trim(),
      description: deskDraft.description.trim(),
      markets: deskDraft.markets.split(",").map((market) => market.trim().toUpperCase()).filter(Boolean).slice(0, 8),
      session: deskDraft.session,
      timezone: deskDraft.timezone,
      objective: deskDraft.objective.trim(),
      privacy: deskDraft.privacy,
      capacity: Math.max(2, Math.min(12, Number(deskDraft.capacity) || 8)),
      weeklyMission: deskDraft.weeklyMission.trim(),
    };
    const desk = buildLocalObject({
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "desk",
      scope: "community",
      payload,
    });
    upsertObject(desk);
    const member = buildLocalObject({
      id: `desk-member:${desk.id}`,
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "desk-member",
      scope: "desk",
      deskId: desk.id,
      parentId: desk.id,
      payload: { role: "OWNER", status: currentProfile.processStatus, joinedAt: new Date().toISOString() } satisfies SocialDeskMemberPayload,
    });
    upsertObject(member);
    await saveObject(desk);
    setShowDeskModal(false);
    setNotice("Desk created. Invite compatible traders after the cloud membership is confirmed.");
  };

  const followTrader = (trader: SocialObject) => {
    if (trader.userId === resolvedAccountKey) return;
    if (follows.some((follow) => follow.userId === resolvedAccountKey && typedPayload<{ targetUserId: string }>(follow)?.targetUserId === trader.userId)) {
      setNotice(`You already follow ${trader.authorLabel}.`);
      return;
    }
    void saveObject(buildLocalObject({
      id: `follow:${trader.userId}`,
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "follow",
      scope: "community",
      parentId: trader.userId,
      payload: { targetUserId: trader.userId, followedAt: new Date().toISOString() },
    }));
    setNotice(`Following ${trader.authorLabel}. Their structured work now enters your Friends view.`);
  };

  const joinDesk = async (desk: SocialObject) => {
    const payload = typedPayload<SocialDeskPayload>(desk);
    if (!payload || currentDeskIds.has(desk.id)) return;
    if (payload.privacy === "PRIVATE") {
      setNotice("This Desk is private. An owner or steward must invite you.");
      return;
    }
    const member = buildLocalObject({
      id: `desk-member:${desk.id}`,
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "desk-member",
      scope: "desk",
      deskId: desk.id,
      parentId: desk.id,
      payload: { role: "MEMBER", status: currentProfile.processStatus, joinedAt: new Date().toISOString() } satisfies SocialDeskMemberPayload,
    });
    const saved = await saveObject(member);
    setNotice(saved.cloudSaved ? `You joined ${payload.name}.` : `Your request for ${payload.name} is saved locally and will sync when account storage is ready.`);
  };

  const saveProfile = async () => {
    if (profileSaveState === "saving") return;
    const profile = normalizeSocialProfile({
      ...profileDraft,
      displayName: profileDraft.displayName.trim() || "Kwant Trader",
      handle: profileDraft.handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "trader",
      markets: [...new Set(profileDraft.markets.map((market) => market.trim().toUpperCase()).filter(Boolean))].slice(0, 8),
    }, resolvedLabel);
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(profile.handle)) {
      setProfileSaveState("error");
      setNotice("Your handle must be 3–24 characters, start with a letter, and only use letters, numbers or underscores.");
      return;
    }
    setProfileSaveState("saving");
    const saveStartedAt = Date.now();
    try {
      const identityResponse = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "identity",
          displayName: profile.displayName,
          handle: profile.handle,
        }),
      });
      const identityResult = await identityResponse.json() as { error?: string };
      if (!identityResponse.ok) {
        throw new Error(identityResult.error || "Trader identity could not be saved.");
      }
    } catch (reason) {
      setProfileSaveState("error");
      setNotice(reason instanceof Error ? reason.message : "Trader identity could not be saved.");
      return;
    }
    const saved = await saveObject(buildLocalObject({
      id: "profile",
      userId: resolvedAccountKey,
      authorLabel: profile.displayName,
      objectType: "profile",
      scope: profile.visibility.profile,
      payload: profile,
    }));
    if (!saved.cloudSaved) {
      setProfileSaveState("error");
      setNotice("Profile not saved. Account storage is unavailable, so your editor has stayed open.");
      return;
    }
    const remainingFeedbackTime = Math.max(0, 420 - (Date.now() - saveStartedAt));
    if (remainingFeedbackTime) {
      await new Promise((resolve) => window.setTimeout(resolve, remainingFeedbackTime));
    }
    setProfileDraft(profile);
    setTab("profile");
    setProfileEditing(false);
    setProfileSaveState("idle");
    setNotice("Profile saved to your account.");
    if (requestedProfileHandle !== profile.handle) onOpenProfile?.(profile.handle);
  };

  const publishStructuredPost = async () => {
    if (postDraft.scope === "desk" && !myDesks.length) {
      setNotice("Create or join a Desk before publishing to Desk visibility.");
      return;
    }
    const requiresCondition = postDraft.kind === "MAP" || postDraft.kind === "LIVE OBSERVATION";
    const requiresInvalidation = postDraft.kind === "MAP";
    if (!postDraft.instrument.trim() || !postDraft.body.trim() || !postDraft.context.trim()) {
      setNotice("A structured update needs an instrument, the update itself, and the context behind it.");
      return;
    }
    if (requiresCondition && !postDraft.condition.trim()) {
      setNotice(`${postDraft.kind === "MAP" ? "A Map" : "A Live Observation"} needs a condition or evidence threshold.`);
      return;
    }
    if (requiresInvalidation && !postDraft.invalidation.trim()) {
      setNotice("A Map needs an invalidation so other traders can audit it without guessing.");
      return;
    }
    const object = buildLocalObject({
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "post",
      scope: postDraft.scope,
      deskId: postDraft.scope === "desk" ? myDesks[0]?.id ?? null : null,
      payload: {
        kind: postDraft.kind,
        instrument: postDraft.instrument.trim().toUpperCase(),
        title: postDraft.title.trim(),
        body: postDraft.body.trim(),
        context: postDraft.context.trim(),
        condition: postDraft.condition.trim(),
        invalidation: postDraft.invalidation.trim(),
        relatedPrecordId: null,
        observedAt: new Date().toISOString(),
      } satisfies SocialPostPayload,
    });
    await saveObject(object);
    await saveProgressPatch(postDraft.kind === "MAP" ? { map: true } : postDraft.kind === "LIVE OBSERVATION" ? { observe: true } : {});
    setPostDraft(EMPTY_POST);
    setShowPostModal(false);
    setTab("today");
    setNotice(`${typedPayload<SocialPostPayload>(object)?.kind ?? "Update"} published with context attached.`);
  };

  const addReaction = (precord: SocialObject, kind: SocialReactionPayload["kind"]) => {
    if (reactions.some((reaction) => reaction.userId === resolvedAccountKey && reaction.parentId === precord.id && typedPayload<SocialReactionPayload>(reaction)?.kind === kind)) return;
    void saveObject(buildLocalObject({
      id: `reaction:${precord.id}:${kind}`,
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "reaction",
      scope: precord.scope,
      deskId: precord.deskId,
      parentId: precord.id,
      payload: { kind } satisfies SocialReactionPayload,
    }));
  };

  const addComment = (precord: SocialObject) => {
    const body = commentDrafts[precord.id]?.trim() ?? "";
    if (!body) return;
    void saveObject(buildLocalObject({
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "comment",
      scope: precord.scope,
      deskId: precord.deskId,
      parentId: precord.id,
      payload: {
        kind: commentKinds[precord.id] ?? "REVIEW",
        body,
        helpful: false,
      } satisfies SocialCommentPayload,
    }));
    setCommentDrafts((current) => ({ ...current, [precord.id]: "" }));
  };

  const toggleGameplanSave = async (record: SocialObject) => {
    const existing = reactions.find((reaction) =>
      reaction.userId === resolvedAccountKey
      && reaction.parentId === record.id
      && typedPayload<SocialReactionPayload>(reaction)?.kind === "SAVED");
    if (existing) {
      await removeObject(existing);
      setNotice("Removed from your saved Gameplans.");
      return;
    }
    await saveObject(buildLocalObject({
      id: `reaction:${record.id}:SAVED`,
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "reaction",
      scope: "private",
      parentId: record.id,
      payload: { kind: "SAVED" } satisfies SocialReactionPayload,
    }));
    setNotice("Gameplan saved privately to your account.");
  };

  const toggleGameplanRepost = async (record: SocialObject) => {
    const existing = posts.find((post) =>
      post.userId === resolvedAccountKey
      && typedPayload<SocialPostPayload>(post)?.isRepost
      && typedPayload<SocialPostPayload>(post)?.relatedPrecordId === record.id);
    if (existing) {
      await removeObject(existing);
      setNotice("Repost removed from your profile.");
      return;
    }
    const payload = typedPayload<SocialPrecordPayload>(record);
    if (!payload) return;
    await saveObject(buildLocalObject({
      id: `repost:${record.id}`,
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "post",
      scope: record.scope === "private" ? "friends" : record.scope,
      deskId: record.deskId,
      parentId: record.id,
      payload: {
        kind: "MAP",
        instrument: payload.instrument,
        title: `Reposted ${record.authorLabel}'s Gameplan`,
        body: payload.marketContext,
        context: payload.confirmation,
        condition: payload.bullCondition || payload.bearCondition,
        invalidation: payload.invalidation,
        relatedPrecordId: record.id,
        observedAt: new Date().toISOString(),
        isRepost: true,
        repostOfUserId: record.userId,
      } satisfies SocialPostPayload,
    }));
    setNotice("Gameplan reposted to your Social profile.");
  };

  const shareUrl = async (url: string, title: string, text: string) => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setNotice("Share link copied.");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setNotice("The share link could not be opened.");
    }
  };

  const shareProfile = () => {
    if (!viewedProfile) return;
    const url = `${window.location.origin}/socials/${encodeURIComponent(viewedProfile.handle)}`;
    void shareUrl(url, `${viewedProfile.displayName} on Kwant Desk`, `View @${viewedProfile.handle}'s Gameplan record.`);
  };

  const shareGameplan = (record: SocialObject) => {
    const authorProfileObject = profiles.find((profile) => profile.userId === record.userId);
    const authorProfile = authorProfileObject
      ? normalizeSocialProfile(authorProfileObject.payload, authorProfileObject.authorLabel)
      : viewedProfile;
    if (!authorProfile) return;
    const payload = typedPayload<SocialPrecordPayload>(record);
    const url = `${window.location.origin}/socials/${encodeURIComponent(authorProfile.handle)}?gameplan=${encodeURIComponent(record.id)}`;
    void shareUrl(url, `${payload?.instrument ?? "Gameplan"} by ${authorProfile.displayName}`, "View this timestamped Kwant Desk Gameplan.");
  };

  const closeAvatarCrop = useCallback(() => {
    if (avatarCropSourceRef.current) {
      URL.revokeObjectURL(avatarCropSourceRef.current);
      avatarCropSourceRef.current = null;
    }
    avatarDragRef.current = null;
    setAvatarCrop(null);
    setAvatarCropSaving(false);
  }, []);

  useEffect(() => () => {
    if (avatarCropSourceRef.current) URL.revokeObjectURL(avatarCropSourceRef.current);
  }, []);

  const handleAvatar = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Choose a PNG, JPG, WEBP, or GIF profile image.");
      return;
    }
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      setNotice("Choose a profile photo smaller than 12 MB.");
      return;
    }
    const sourceUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        URL.revokeObjectURL(sourceUrl);
        setNotice("That profile photo has no usable image data.");
        return;
      }
      if (avatarCropSourceRef.current) URL.revokeObjectURL(avatarCropSourceRef.current);
      avatarCropSourceRef.current = sourceUrl;
      setAvatarCrop({
        sourceUrl,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      });
      setNotice("");
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      setNotice("That profile photo could not be read.");
    };
    image.src = sourceUrl;
  };

  const updateAvatarZoom = (zoom: number) => {
    setAvatarCrop((current) => {
      if (!current) return current;
      const nextZoom = Math.max(1, Math.min(3, zoom));
      const clamped = clampAvatarOffset(current, current.offsetX, current.offsetY, nextZoom);
      return { ...current, zoom: nextZoom, ...clamped };
    });
  };

  const beginAvatarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!avatarCrop) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    avatarDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: avatarCrop.offsetX,
      originY: avatarCrop.offsetY,
    };
  };

  const moveAvatarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = avatarDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setAvatarCrop((current) => {
      if (!current) return current;
      const next = clampAvatarOffset(
        current,
        drag.originX + event.clientX - drag.startX,
        drag.originY + event.clientY - drag.startY,
      );
      return { ...current, ...next };
    });
  };

  const endAvatarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (avatarDragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    avatarDragRef.current = null;
  };

  const saveCroppedAvatar = async () => {
    const crop = avatarCrop;
    if (!crop) return;
    setAvatarCropSaving(true);
    try {
      const image = new window.Image();
      image.src = crop.sourceUrl;
      await image.decode();

      const scale = avatarCropScale(crop);
      const sourceSize = AVATAR_CROP_SIZE / scale;
      const sourceX = crop.naturalWidth / 2 - (AVATAR_CROP_SIZE / 2 + crop.offsetX) / scale;
      const sourceY = crop.naturalHeight / 2 - (AVATAR_CROP_SIZE / 2 + crop.offsetY) / scale;
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_OUTPUT_SIZE;
      canvas.height = AVATAR_OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#090909";
      context.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        AVATAR_OUTPUT_SIZE,
        AVATAR_OUTPUT_SIZE,
      );
      const avatarUrl = canvas.toDataURL("image/jpeg", 0.88);
      if (avatarUrl.length > 700_000) throw new Error("The cropped photo is still too large.");
      setProfileDraft((current) => ({ ...current, avatarUrl }));
      closeAvatarCrop();
      setNotice("Profile photo cropped. Save your profile to publish it.");
    } catch {
      setAvatarCropSaving(false);
      setNotice("That photo could not be cropped. Try another image.");
    }
  };

  const commitConsensus = () => {
    if (!consensusDraft.interpretation.trim() || !consensusDraft.invalidation.trim()) {
      setNotice("Record your interpretation and invalidation before revealing the Desk comparison.");
      return;
    }
    void saveObject(buildLocalObject({
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "consensus",
      scope: myDesks.length ? "desk" : "private",
      deskId: myDesks[0]?.id ?? null,
      payload: {
        sessionDate: todayKey(),
        instrument: consensusDraft.instrument,
        level: consensusDraft.level,
        interpretation: consensusDraft.interpretation.trim(),
        bullConfirmation: consensusDraft.bullConfirmation.trim(),
        bearConfirmation: consensusDraft.bearConfirmation.trim(),
        invalidation: consensusDraft.invalidation.trim(),
        enoughEvidence: consensusDraft.enoughEvidence,
        committedAt: new Date().toISOString(),
      } satisfies SocialConsensusPayload,
    }));
    setNotice("View committed. Consensus can no longer anchor your original interpretation.");
  };

  const handleEvidence = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2_000_000) {
      setNotice("Receipt evidence must be an image no larger than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setReceiptDraft((current) => ({
      ...current,
      evidenceName: file.name,
      evidenceDataUrl: typeof reader.result === "string" ? reader.result : "",
    }));
    reader.onerror = () => setNotice("That image could not be read.");
    reader.readAsDataURL(file);
  };

  const renderPrecordCard = (object: SocialObject) => {
    const payload = typedPayload<SocialPrecordPayload>(object);
    if (!payload) return null;
    const receiptObject = receipts.find((receipt) => receipt.parentId === object.id);
    const receipt = typedPayload<SocialReceiptPayload>(receiptObject);
    const objectComments = comments.filter((comment) => comment.parentId === object.id);
    const objectReactions = reactions.filter((reaction) => reaction.parentId === object.id);
    const own = object.userId === resolvedAccountKey;
    const profileObject = profiles.find((candidate) => candidate.userId === object.userId);
    const profile = profileObject ? normalizeSocialProfile(profileObject.payload, profileObject.authorLabel) : null;
    const status = receipt ? receipt.noTrade ? "NO TRIGGER" : receipt.classification === "JUSTIFIED ADAPTATION" ? "ADAPTED" : receipt.classification === "UNJUSTIFIED DEVIATION" ? "INVALIDATED" : "PARTIALLY PROVEN" : payload.status;
    return (
      <Card key={objectKey(object)} className="overflow-hidden">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <Avatar label={object.authorLabel} active={profile?.processStatus !== "AWAY"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => profile && onOpenProfile?.(profile.handle)} className="text-[10px] font-semibold text-foreground hover:text-primary">{object.authorLabel}</button>
              {profile ? <span className="text-[8px] text-muted">@{profile.handle}</span> : null}
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[7px] font-semibold text-primary">{profile?.strongestDiscipline || "Independent trader"}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[8px] text-muted">
              <span>{formatDate(payload.lockedAt, true)}</span>
              <span>·</span>
              <LockKeyhole className="h-3 w-3 text-primary" />
              <span>Platform timestamped · original reasoning locked</span>
            </div>
          </div>
          {!own ? <button type="button" onClick={() => followTrader(object)} className="flex h-8 items-center gap-1.5 rounded-xl border border-border px-2.5 text-[8px] font-semibold text-muted hover:text-foreground"><UserPlus className="h-3.5 w-3.5" />{follows.some((follow) => follow.userId === resolvedAccountKey && typedPayload<{ targetUserId: string }>(follow)?.targetUserId === object.userId) ? "Following" : "Follow"}</button> : null}
          <ScopeBadge scope={object.scope} />
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[18px] font-semibold text-foreground">{payload.instrument}</span>
            <span className="rounded-lg border border-border bg-surface px-2 py-1 text-[8px] font-semibold text-muted">{payload.session}</span>
            <span className={`rounded-lg px-2 py-1 text-[8px] font-semibold ${payload.direction === "LONG" ? "bg-primary/10 text-primary" : payload.direction === "SHORT" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`}>{payload.direction}</span>
            <StatusBadge status={status} />
            <span className="ml-auto flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/[0.06] px-2.5 py-1.5 text-[8px] text-primary"><Gauge className="h-3.5 w-3.5" /><strong className="font-mono">{payload.reasoningScore}</strong> reasoning</span>
          </div>
          <p className="mt-4 text-[11px] leading-5 text-foreground">{payload.marketContext}</p>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-background/35 p-3">
              <div className="text-[7px] font-semibold uppercase tracking-[0.13em] text-primary">Bull permission</div>
              <p className="mt-2 text-[9px] leading-4 text-muted">{payload.bullCondition || "Not specified"}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/35 p-3">
              <div className="text-[7px] font-semibold uppercase tracking-[0.13em] text-danger">Bear permission</div>
              <p className="mt-2 text-[9px] leading-4 text-muted">{payload.bearCondition || "Not specified"}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/35 p-3">
              <div className="text-[7px] font-semibold uppercase tracking-[0.13em] text-warning">Invalidation</div>
              <p className="mt-2 text-[9px] leading-4 text-muted">{payload.invalidation}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-xl border border-border bg-surface/35 p-3">
              <div className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.13em] text-muted"><Radar className="h-3 w-3" />Confirmation required</div>
              <p className="mt-2 text-[9px] leading-4 text-foreground">{payload.confirmation}</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[8px]">
              <div className="rounded-xl border border-border bg-surface/35 p-2"><div className="text-muted">Entry</div><div className="mt-1 font-mono text-foreground">{payload.plannedEntryLow ?? "—"}{payload.plannedEntryHigh && payload.plannedEntryHigh !== payload.plannedEntryLow ? `–${payload.plannedEntryHigh}` : ""}</div></div>
              <div className="rounded-xl border border-border bg-surface/35 p-2"><div className="text-muted">Stop</div><div className="mt-1 font-mono text-foreground">{payload.plannedStop ?? "—"}</div></div>
              <div className="rounded-xl border border-border bg-surface/35 p-2"><div className="text-muted">Target</div><div className="mt-1 font-mono text-foreground">{payload.plannedTarget ?? "—"}</div></div>
              <div className="rounded-xl border border-border bg-surface/35 p-2"><div className="text-muted">Max risk</div><div className="mt-1 font-mono text-foreground">{payload.maximumRisk === null ? "—" : `$${payload.maximumRisk}`}</div></div>
            </div>
          </div>
          {receipt ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-accent/25 bg-accent/[0.045]">
              <div className="flex flex-wrap items-center gap-2 border-b border-accent/15 px-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                <span className="text-[9px] font-semibold text-foreground">Actual Execution</span>
                <span className="rounded-lg bg-accent/10 px-2 py-1 text-[7px] font-semibold text-accent">{receipt.classification}</span>
                <span className="ml-auto font-mono text-[11px] font-semibold text-accent">{receipt.scores.final} final</span>
              </div>
              {receipt.retrospective ? <div className="border-b border-warning/20 bg-warning/[0.07] px-3 py-2 text-[8px] font-semibold text-warning">RETROSPECTIVE · execution predates the plan lock and is excluded from proof-based rewards.</div> : null}
              <div className="p-3">
                <div className="overflow-x-auto rounded-xl border border-border">
                  <div className="grid min-w-[720px] grid-cols-[112px_1fr_1fr_1fr_110px] border-b border-border bg-background/45 px-3 py-2 text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">
                    <span>Dimension</span><span>Locked plan</span><span>Actual</span><span>Difference</span><span>Status</span>
                  </div>
                  {(receipt.comparison ?? buildExecutionComparison(payload, receipt)).map((row) => (
                    <div key={row.dimension} className="grid min-w-[720px] grid-cols-[112px_1fr_1fr_1fr_110px] border-b border-border/60 px-3 py-2.5 text-[8px] last:border-b-0">
                      <span className="font-semibold text-foreground">{row.dimension}</span>
                      <span className="pr-3 text-muted">{row.planned}</span>
                      <span className="pr-3 text-foreground">{row.actual}</span>
                      <span className="pr-3 text-muted">{row.difference}</span>
                      <span className={`font-semibold ${["MATCHED", "MET", "VALID", "SAFER"].includes(row.status) ? "text-accent" : ["RETROSPECTIVE", "RISKIER", "DEVIATED", "UNMET"].includes(row.status) ? "text-warning" : "text-primary"}`}>{row.status}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_220px]">
                  <div><div className="text-[7px] uppercase tracking-[0.12em] text-muted">What happened</div><p className="mt-1.5 text-[9px] leading-4 text-foreground">{receipt.outcomeReview || (receipt.noTrade ? "Confirmation did not print. No trade was taken." : "Outcome review not supplied.")}</p></div>
                  <div><div className="text-[7px] uppercase tracking-[0.12em] text-muted">ZYON adaptation review</div><p className="mt-1.5 text-[9px] leading-4 text-foreground">{receipt.assessment?.explanation || receipt.nextTimeRule || "Assessment pending."}</p><div className="mt-2 text-[7px] text-muted">{receipt.assessment ? `${receipt.assessment.evaluator} · ${Math.round(receipt.assessment.confidence * 100)}% confidence · ${receipt.assessment.rubricVersion}` : "Rules-based review"}</div></div>
                  <div className="grid grid-cols-2 gap-1 text-[7px]">
                    <div className="rounded-lg border border-primary/20 bg-primary/[0.05] p-2"><div className="text-muted">Reasoning · fixed</div><div className="mt-1 font-mono text-primary">{payload.reasoningScore}</div></div>
                    {Object.entries(receipt.scores).slice(0, 5).map(([label, value]) => <div key={label} className="rounded-lg border border-border/70 bg-background/25 p-2"><div className="capitalize text-muted">{label}</div><div className="mt-1 font-mono text-foreground">{value}</div></div>)}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-[7px] text-muted">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <span>{receipt.evidenceState ?? "SELF REPORTED"}</span>
                  <span>·</span>
                  <span>Original reasoning retained under {receipt.scoreSnapshot?.reasoningModelVersion ?? payload.scoreModelVersion ?? SOCIAL_RECORD_RULES.scoreModelVersion}</span>
                  <span>·</span>
                  <span>Factual assessment errors can be appealed.</span>
                </div>
              </div>
            </div>
          ) : own ? (
            <button type="button" onClick={() => setShowReceiptFor(object.id)} className="mt-4 flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-3 text-[9px] font-semibold text-primary hover:bg-primary/10"><Plus className="h-3.5 w-3.5" />Add Actual Execution</button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-background/20 px-4 py-2.5">
          {(["USEFUL", "CLEAR", "EVIDENCE"] as const).map((kind) => {
            const active = objectReactions.some((reaction) => reaction.userId === resolvedAccountKey && typedPayload<SocialReactionPayload>(reaction)?.kind === kind);
            const count = objectReactions.filter((reaction) => typedPayload<SocialReactionPayload>(reaction)?.kind === kind).length;
            return <button key={kind} type="button" onClick={() => addReaction(object, kind)} className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[7px] font-semibold ${active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}><Star className="h-3 w-3" />{kind}{count ? ` ${count}` : ""}</button>;
          })}
          <button type="button" onClick={() => void toggleGameplanRepost(object)} className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[7px] font-semibold hover:bg-surface ${repostedGameplanIds.has(object.id) ? "text-primary" : "text-muted hover:text-foreground"}`}><Repeat2 className="h-3 w-3" />Repost</button>
          <button type="button" onClick={() => void toggleGameplanSave(object)} className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[7px] font-semibold hover:bg-surface ${savedGameplanIds.has(object.id) ? "text-primary" : "text-muted hover:text-foreground"}`}><Bookmark className={`h-3 w-3 ${savedGameplanIds.has(object.id) ? "fill-current" : ""}`} />Save</button>
          <button type="button" onClick={() => shareGameplan(object)} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[7px] font-semibold text-muted hover:bg-surface hover:text-foreground"><Share2 className="h-3 w-3" />Share</button>
          <span className="ml-auto flex items-center gap-1.5 text-[8px] text-muted"><MessageCircle className="h-3.5 w-3.5" />{objectComments.length} reviews</span>
        </div>
        {objectComments.length ? (
          <div className="space-y-2 border-t border-border px-4 py-3">
            {objectComments.slice(-4).map((comment) => {
              const commentPayload = typedPayload<SocialCommentPayload>(comment);
              return <div key={objectKey(comment)} className="flex gap-2"><Avatar label={comment.authorLabel} size="sm" /><div className="min-w-0 flex-1 rounded-xl border border-border bg-surface/35 px-3 py-2"><div className="flex items-center gap-2 text-[7px]"><span className="font-semibold text-foreground">{comment.authorLabel}</span><span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{commentPayload?.kind}</span><span className="ml-auto text-muted">{formatDate(comment.createdAt, true)}</span></div><p className="mt-1 text-[8px] leading-4 text-muted">{commentPayload?.body}</p></div></div>;
            })}
          </div>
        ) : null}
        <div className="grid gap-2 border-t border-border px-4 py-3 sm:grid-cols-[112px_minmax(0,1fr)_34px]">
          <KwantSelect value={commentKinds[object.id] ?? "REVIEW"} onChange={(event) => setCommentKinds((current) => ({ ...current, [object.id]: event.target.value as SocialCommentPayload["kind"] }))} className="h-8 rounded-lg border border-border bg-surface px-2 text-[8px] text-muted outline-none">
            <option value="REVIEW">Review</option>
            <option value="QUESTION">Question</option>
            <option value="COUNTERCASE">Countercase</option>
            <option value="LESSON">Lesson</option>
          </KwantSelect>
          <input value={commentDrafts[object.id] ?? ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [object.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") addComment(object); }} placeholder="Add evidence, a condition, or a focused question…" className="h-8 rounded-lg border border-border bg-background px-3 text-[8px] text-foreground outline-none placeholder:text-muted/55 focus:border-primary/40" />
          <button type="button" onClick={() => addComment(object)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-background"><Send className="h-3.5 w-3.5" /></button>
        </div>
      </Card>
    );
  };

  const renderStructuredPost = (object: SocialObject) => {
    const payload = typedPayload<SocialPostPayload>(object);
    if (!payload) return null;
    const objectComments = comments.filter((comment) => comment.parentId === object.id);
    const objectReactions = reactions.filter((reaction) => reaction.parentId === object.id);
    const profileObject = profiles.find((candidate) => candidate.userId === object.userId);
    const profile = profileObject ? normalizeSocialProfile(profileObject.payload, profileObject.authorLabel) : null;
    const kindTone = payload.kind === "MAP"
      ? "text-primary bg-primary/10 border-primary/20"
      : payload.kind === "LIVE OBSERVATION"
        ? "text-accent bg-accent/10 border-accent/20"
        : payload.kind === "REVIEW REQUEST"
          ? "text-warning bg-warning/10 border-warning/20"
          : "text-foreground bg-surface border-border";
    return (
      <Card key={objectKey(object)} className="overflow-hidden">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <Avatar label={object.authorLabel} active={profile?.processStatus !== "AWAY"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => profile && onOpenProfile?.(profile.handle)} className="text-[10px] font-semibold hover:text-primary">{object.authorLabel}</button>
              {profile ? <span className="text-[8px] text-muted">@{profile.handle}</span> : null}
              <span className={`rounded-lg border px-2 py-1 text-[7px] font-semibold ${kindTone}`}>{payload.kind}</span>
            </div>
            <div className="mt-1 text-[7px] text-muted">{formatDate(payload.observedAt, true)} · {payload.instrument}</div>
          </div>
          <ScopeBadge scope={object.scope} />
        </div>
        <div className="p-4">
          {payload.title ? <h3 className="text-[13px] font-semibold tracking-[-0.015em]">{payload.title}</h3> : null}
          <p className="mt-2 text-[10px] leading-5 text-foreground">{payload.body}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Context</div><p className="mt-2 text-[8px] leading-4 text-foreground">{payload.context}</p></div>
            <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Condition / evidence</div><p className="mt-2 text-[8px] leading-4 text-foreground">{payload.condition || "Not required for this update type."}</p></div>
            <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Invalidation</div><p className="mt-2 text-[8px] leading-4 text-foreground">{payload.invalidation || "No forecast claim attached."}</p></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-background/20 px-4 py-2.5">
          {(["USEFUL", "CLEAR", "EVIDENCE"] as const).map((kind) => {
            const active = objectReactions.some((reaction) => reaction.userId === resolvedAccountKey && typedPayload<SocialReactionPayload>(reaction)?.kind === kind);
            const count = objectReactions.filter((reaction) => typedPayload<SocialReactionPayload>(reaction)?.kind === kind).length;
            return <button key={kind} type="button" onClick={() => addReaction(object, kind)} className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[7px] font-semibold ${active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}><Star className="h-3 w-3" />{kind}{count ? ` ${count}` : ""}</button>;
          })}
          <span className="ml-auto flex items-center gap-1.5 text-[8px] text-muted"><MessageCircle className="h-3.5 w-3.5" />{objectComments.length} responses</span>
        </div>
        {objectComments.length ? (
          <div className="space-y-2 border-t border-border px-4 py-3">
            {objectComments.slice(-3).map((comment) => {
              const payloadComment = typedPayload<SocialCommentPayload>(comment);
              return <div key={objectKey(comment)} className="flex gap-2"><Avatar label={comment.authorLabel} size="sm" /><div className="min-w-0 flex-1 rounded-xl border border-border bg-surface/35 px-3 py-2"><div className="flex items-center gap-2 text-[7px]"><span className="font-semibold">{comment.authorLabel}</span><span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{payloadComment?.kind}</span></div><p className="mt-1 text-[8px] leading-4 text-muted">{payloadComment?.body}</p></div></div>;
            })}
          </div>
        ) : null}
        <div className="grid gap-2 border-t border-border px-4 py-3 sm:grid-cols-[112px_minmax(0,1fr)_34px]">
          <KwantSelect value={commentKinds[object.id] ?? "QUESTION"} onChange={(event) => setCommentKinds((current) => ({ ...current, [object.id]: event.target.value as SocialCommentPayload["kind"] }))} className="h-8 rounded-lg border border-border bg-surface px-2 text-[8px] text-muted outline-none"><option value="QUESTION">Question</option><option value="REVIEW">Review</option><option value="COUNTERCASE">Countercase</option><option value="LESSON">Lesson</option></KwantSelect>
          <input value={commentDrafts[object.id] ?? ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [object.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") addComment(object); }} placeholder="Respond with context, evidence, or a focused question…" className="h-8 rounded-lg border border-border bg-background px-3 text-[8px] outline-none placeholder:text-muted/55 focus:border-primary/40" />
          <button type="button" onClick={() => addComment(object)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-background"><Send className="h-3.5 w-3.5" /></button>
        </div>
      </Card>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-panel">
        <div className="flex min-h-[64px] flex-wrap items-center gap-3 px-4 py-3">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Network className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-panel bg-primary" />
          </span>
          <div>
            <div className="flex items-center gap-2"><h1 className="text-[14px] font-semibold">{SOCIAL_RECORD_COPY.section}</h1><span className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[6px] font-semibold uppercase tracking-[0.13em] text-muted">Working title</span></div>
            <p className="mt-0.5 text-[9px] text-muted">{SOCIAL_RECORD_COPY.tagline} · Build a record that survives review.</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className={`flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 text-[8px] ${saveState === "error" ? "text-danger" : "text-muted"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${saveState === "saved" ? "bg-primary" : saveState === "loading" ? "animate-pulse bg-warning" : "bg-accent"}`} />
              {saveState === "saved" ? "Network synced" : saveState === "loading" ? "Syncing" : "Local resilience"}
            </span>
            <button type="button" onClick={() => { setTab("profile"); setProfileEditing(false); onOpenProfile?.(currentProfile.handle); }} className="flex h-8 items-center gap-2 rounded-xl border border-border bg-surface px-2.5 text-[8px] font-semibold text-muted hover:text-foreground"><Avatar label={currentProfile.displayName} size="sm" />@{currentProfile.handle}</button>
            <button type="button" onClick={() => setTab("precords")} className="flex h-8 items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/[0.06] px-3 text-[8px] font-semibold text-primary hover:bg-primary/10"><MessageCircle className="h-3.5 w-3.5" />Community review</button>
            <button type="button" onClick={() => setTab("today")} className="flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-[8px] font-semibold text-background hover:brightness-110"><LockKeyhole className="h-3.5 w-3.5" />{SOCIAL_RECORD_COPY.lockAction}</button>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto px-3" aria-label="Socials views">
          {SOCIAL_TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => { if (initialProfileHandle && id !== "profile") { onCloseProfile?.(); return; } setTab(id); if (id === "profile") setProfileEditing(false); }} className={`relative flex h-10 shrink-0 items-center gap-1.5 px-3 text-[10px] font-semibold ${tab === id ? "text-primary" : "text-muted hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />{label}
              {id === "today" && notificationItems.length ? <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[7px] text-white">{notificationItems.length}</span> : null}
              {tab === id ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" /> : null}
            </button>
          ))}
        </nav>
      </header>

      {notice ? <div className="flex shrink-0 items-center gap-2 border-b border-primary/15 bg-primary/[0.055] px-4 py-2 text-[8px] text-primary"><Sparkles className="h-3.5 w-3.5" /><span className="min-w-0 flex-1">{notice}</span><button type="button" onClick={() => setNotice("")}><X className="h-3.5 w-3.5" /></button></div> : null}

      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === "today" ? (
          <div className="grid min-h-full gap-3 p-3 xl:grid-cols-[230px_minmax(0,1fr)_290px]">
            <div className="space-y-3">
              <Card className="p-4">
                <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><h2 className="text-[10px] font-semibold">Today’s operating loop</h2></div>
                <div className="mt-5 flex justify-center"><ProgressRing value={progressPercent} /></div>
                <div className="mt-5 space-y-1.5">
                  {PROGRESS_STEPS.map((step, index) => (
                    <button key={step.key} type="button" onClick={() => updateProgress(step.key, !todayProgress[step.key])} className={`flex h-9 w-full items-center gap-2 rounded-xl border px-2.5 text-left text-[8px] font-semibold ${todayProgress[step.key] ? "border-primary/25 bg-primary/[0.07] text-primary" : "border-border bg-surface/30 text-muted hover:text-foreground"}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-lg ${todayProgress[step.key] ? "bg-primary text-background" : "bg-surface text-muted"}`}>{todayProgress[step.key] ? <Check className="h-3 w-3" /> : index + 1}</span>
                      {step.label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => updateProgress("noTrade", !todayProgress.noTrade)} className={`mt-3 flex w-full items-center gap-2 rounded-xl border p-3 text-left ${todayProgress.noTrade ? "border-accent/25 bg-accent/[0.07]" : "border-border bg-background/30"}`}>
                  <ShieldCheck className={`h-4 w-4 ${todayProgress.noTrade ? "text-accent" : "text-muted"}`} />
                  <span><span className="block text-[8px] font-semibold text-foreground">No trade is a result</span><span className="mt-0.5 block text-[7px] leading-3 text-muted">Preserve the loop when permission never prints.</span></span>
                </button>
              </Card>
              <Card className="p-4">
                <div className="text-[7px] font-semibold uppercase tracking-[0.14em] text-muted">Current process status</div>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {PROCESS_STATUSES.map((status) => <button key={status.id} type="button" onClick={() => updateStatus(status.id)} className={`rounded-lg border px-2 py-2 text-[7px] font-semibold ${currentProfile.processStatus === status.id ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-surface/35 text-muted hover:text-foreground"}`}>{status.label}</button>)}
                </div>
              </Card>
            </div>

            <div className="space-y-3">
              <Card className="relative overflow-hidden p-5">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_0%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_42%)]" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-primary"><Zap className="h-3.5 w-3.5" />The proof loop</div>
                  <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.045em]">{SOCIAL_RECORD_COPY.loop}</h2>
                  <p className="mt-2 max-w-2xl text-[11px] leading-5 text-muted">The plan is recorded before the result. The execution is added afterward. Kwant preserves the difference so improvement cannot be rewritten with hindsight.</p>
                  <div className="mt-5 grid gap-2 md:grid-cols-3">
                    {[
                      { number: "01", label: "PLAN", title: "Lock the real Gameplan", detail: "A platform-timestamped snapshot of what was known before the outcome.", icon: LockKeyhole },
                      { number: "02", label: "PROVE", title: "Add what actually happened", detail: "Fills, exits, risk, confirmation, evidence—or an honest no trade.", icon: ShieldCheck },
                      { number: "03", label: "REVIEW", title: "Compare without hindsight", detail: "Exact differences, ZYON adaptation review and append-only scores.", icon: SlidersHorizontal },
                    ].map(({ number, label, title, detail, icon: Icon }) => (
                      <div key={number} className="group rounded-2xl border border-border bg-background/45 p-4 transition-colors hover:border-primary/25">
                        <div className="flex items-center justify-between"><span className="font-mono text-[8px] text-muted">{number}</span><Icon className="h-4 w-4 text-primary" /></div>
                        <div className="mt-4 text-[7px] font-semibold tracking-[0.16em] text-primary">{label}</div>
                        <div className="mt-1 text-[11px] font-semibold text-foreground">{title}</div>
                        <p className="mt-2 text-[8px] leading-4 text-muted">{detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden border-primary/20">
                <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background/25 px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Archive className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><h3 className="text-[12px] font-semibold">Today’s source Gameplan</h3><p className="mt-0.5 text-[8px] text-muted">This is the existing Kwant Gameplan—not another plan builder.</p></div>
                  <div className="flex rounded-xl border border-border bg-surface p-1">
                    {(["NQ", "ES"] as const).map((instrument) => <button key={instrument} type="button" onClick={() => setGameplanInstrument(instrument)} className={`h-7 rounded-lg px-3 font-mono text-[8px] font-semibold ${gameplanInstrument === instrument ? "bg-primary text-background" : "text-muted hover:text-foreground"}`}>{instrument}</button>)}
                  </div>
                  <KwantSelect value={gameplanSession} onChange={(event) => setGameplanSession(event.target.value as GameplanSession)} className="h-9 rounded-xl border border-border bg-surface px-3 text-[8px] outline-none">
                    {GAMEPLAN_SESSIONS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                  </KwantSelect>
                </div>
                {gameplanState === "loading" ? (
                  <div className="flex min-h-[280px] items-center justify-center">
                    <div className="text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /><div className="mt-3 text-[9px] font-semibold text-foreground">Loading the current Gameplan</div><div className="mt-1 text-[8px] text-muted">Preserving the source version and timestamp.</div></div>
                  </div>
                ) : gameplanState === "error" || !gameplan ? (
                  <div className="flex min-h-[280px] items-center justify-center p-6 text-center"><div><CircleAlert className="mx-auto h-6 w-6 text-warning" /><div className="mt-3 text-[10px] font-semibold">The current Gameplan is unavailable.</div><p className="mt-2 max-w-sm text-[8px] leading-4 text-muted">Socials will never fabricate a plan. Resolve the Gameplan data source, then return here to place it on record.</p></div></div>
                ) : (
                  <>
                    <div className="p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <div>
                          <div className="flex items-center gap-2"><span className="font-mono text-[26px] font-semibold">{gameplan.instrument}</span><span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[7px] font-semibold text-primary">{gameplan.status}</span></div>
                          <div className="mt-1 text-[7px] text-muted">Generated {formatDate(gameplan.generated_at, true)} · {gameplan.plan.edition.data_basis}</div>
                        </div>
                        <div className="ml-auto text-right"><div className="font-mono text-[22px] font-semibold text-foreground">{gameplan.current_price?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "—"}</div><div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-muted">Current futures price</div></div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/[0.045] p-4">
                        <div className="text-[7px] font-semibold uppercase tracking-[0.15em] text-primary">Market in one line</div>
                        <p className="mt-2 text-[12px] leading-5 text-foreground">{gameplan.plan.one_liner}</p>
                      </div>
                      <div className="mt-3 grid gap-2 lg:grid-cols-[180px_1fr_1fr]">
                        <div className="rounded-xl border border-border bg-surface/30 p-3"><div className="text-[7px] uppercase tracking-[0.12em] text-muted">Decision zone</div><div className="mt-2 font-mono text-[16px] font-semibold text-foreground">{gameplan.plan.one_trade.zone[0].toLocaleString()} – {gameplan.plan.one_trade.zone[1].toLocaleString()}</div><div className="mt-2 text-[7px] leading-4 text-muted">The record locks both sides. Direction remains the trader’s decision.</div></div>
                        <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-3"><div className="text-[7px] font-semibold uppercase tracking-[0.12em] text-primary">Long permission</div><p className="mt-2 text-[8px] leading-4 text-foreground">{gameplan.plan.one_trade.long_side.permission}</p><div className="mt-3 font-mono text-[7px] text-muted">STOP {gameplan.plan.one_trade.long_side.stop} · TARGETS {gameplan.plan.one_trade.long_side.targets.join(" / ")}</div></div>
                        <div className="rounded-xl border border-danger/20 bg-danger/[0.025] p-3"><div className="text-[7px] font-semibold uppercase tracking-[0.12em] text-danger">Short permission</div><p className="mt-2 text-[8px] leading-4 text-foreground">{gameplan.plan.one_trade.short_side.permission}</p><div className="mt-3 font-mono text-[7px] text-muted">STOP {gameplan.plan.one_trade.short_side.stop} · TARGETS {gameplan.plan.one_trade.short_side.targets.join(" / ")}</div></div>
                      </div>
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/[0.04] p-3 text-[8px] leading-4 text-muted"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /><span><strong className="text-warning">No-trade condition:</strong> {gameplan.plan.one_trade.not_a_trade_if}</span></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background/25 px-4 py-3">
                      <div className="flex items-center gap-2 text-[8px] text-muted"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Platform timestamped · source version retained</div>
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        <KwantSelect value={recordScope} onChange={(event) => setRecordScope(event.target.value as SocialScope)} disabled={Boolean(lockedCurrentGameplan)} className="h-9 rounded-xl border border-border bg-surface px-3 text-[8px] outline-none disabled:opacity-60">
                          <option value="private">Private</option>
                          <option value="friends">Friends</option>
                          <option value="desk">My Desk</option>
                          <option value="community">Community</option>
                        </KwantSelect>
                        {lockedCurrentGameplan ? (
                          receipts.some((receipt) => receipt.parentId === lockedCurrentGameplan.id)
                            ? <button type="button" onClick={() => setTab("precords")} className="flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 text-[9px] font-semibold text-primary"><CheckCircle2 className="h-3.5 w-3.5" />View completed record</button>
                            : <><span className="flex h-9 items-center gap-2 rounded-xl border border-accent/25 bg-accent/[0.06] px-3 text-[8px] font-semibold text-accent"><LockKeyhole className="h-3.5 w-3.5" />{SOCIAL_RECORD_COPY.lockedState}</span><button type="button" onClick={() => setShowReceiptFor(lockedCurrentGameplan.id)} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background"><Plus className="h-3.5 w-3.5" />Add Actual Execution</button></>
                        ) : <button type="button" onClick={() => void lockCurrentGameplan()} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background hover:brightness-110"><LockKeyhole className="h-3.5 w-3.5" />{SOCIAL_RECORD_COPY.lockAction}</button>}
                      </div>
                    </div>
                  </>
                )}
              </Card>

              {visiblePrecords.slice(0, 2).map(renderPrecordCard)}
              {!precords.length ? <Card className="border-dashed p-8 text-center"><LockKeyhole className="mx-auto h-7 w-7 text-muted" /><div className="mt-3 text-[10px] font-semibold">Your record starts before the outcome.</div><div className="mx-auto mt-1 max-w-md text-[8px] leading-4 text-muted">Lock the current source Gameplan above. The platform preserves its version and timestamp without creating another plan.</div></Card> : null}
            </div>

            <div className="space-y-3">
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Target className="h-4 w-4 text-primary" /><div><h3 className="text-[10px] font-semibold">Daily mission</h3><p className="mt-0.5 text-[7px] text-muted">Discipline creates progress without requiring a trade.</p></div></div>
                <div className="p-4">
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3"><div className="text-[7px] font-semibold uppercase tracking-[0.13em] text-primary">WAITED FOR PERMISSION</div><p className="mt-2 text-[9px] leading-4 text-foreground">Define one condition that makes today a no-trade session, then record the result honestly.</p></div>
                  <div className="mt-3 flex items-center justify-between text-[7px] text-muted"><span>{todayProgress.noTrade ? "Mission complete" : "No trade count required"}</span><span className="font-mono text-primary">{todayProgress.noTrade ? "1 / 1" : "0 / 1"}</span></div>
                </div>
              </Card>
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3"><UsersRound className="h-4 w-4 text-primary" /><h3 className="text-[10px] font-semibold">Live on your Desk</h3><span className="ml-auto text-[7px] text-muted">{currentMemberships.length ? `${currentMemberships.length} memberships` : "No Desk yet"}</span></div>
                <div className="p-3">
                  {myDesks.length ? myDesks.slice(0, 2).map((desk) => {
                    const payload = typedPayload<SocialDeskPayload>(desk);
                    const deskMembers = memberships.filter((member) => member.deskId === desk.id);
                    return <button key={objectKey(desk)} type="button" onClick={() => setTab("desks")} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-border bg-surface/35 p-3 text-left hover:border-primary/25"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Network className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-semibold">{payload?.name}</span><span className="mt-1 block truncate text-[7px] text-muted">{payload?.objective}</span></span><span className="font-mono text-[8px] text-primary">{deskMembers.length}/{payload?.capacity ?? 12}</span></button>;
                  }) : <div className="rounded-xl border border-dashed border-border p-5 text-center"><div className="text-[9px] font-semibold">Find the people who trade your hours.</div><div className="mt-1 text-[7px] leading-4 text-muted">Desks are intentionally small: compatible markets, session, timezone, and improvement objective.</div><button type="button" onClick={() => setShowDeskModal(true)} className="mt-3 rounded-lg border border-primary/25 bg-primary/[0.07] px-3 py-2 text-[8px] font-semibold text-primary">Create a Desk</button></div>}
                </div>
              </Card>
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Bell className="h-4 w-4 text-primary" /><h3 className="text-[10px] font-semibold">Unfinished value</h3>{notificationItems.length ? <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[7px] text-white">{notificationItems.length}</span> : null}</div>
                <div className="divide-y divide-border/60">
                  {notificationItems.map((item) => <div key={item.id} className="px-4 py-3"><div className="text-[8px] font-semibold text-foreground">{item.title}</div><div className="mt-1 text-[7px] leading-3 text-muted">{item.detail}</div></div>)}
                  {!notificationItems.length ? <div className="flex items-center gap-2 px-4 py-8 text-[8px] text-muted"><Check className="h-4 w-4 text-primary" />Nothing is demanding urgency.</div> : null}
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="text-[10px] font-semibold">This week’s story</h3></div>
                <p className="mt-3 text-[8px] leading-4 text-muted">{completedProgress
                  ? `You completed ${completedProgress} of five process steps today. ${todayProgress.noTrade ? "You protected the record by recognising a no-trade condition." : "Your next leverage point is completing the outcome review."}`
                  : "Your development story begins with one complete plan-to-review loop. Profit is not required for the record to improve."}</p>
              </Card>
            </div>
          </div>
        ) : null}

        {tab === "precords" ? (
          <div className="mx-auto max-w-6xl space-y-3 p-3">
            <Card className="relative overflow-hidden p-5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,color-mix(in_srgb,var(--primary)_13%,transparent),transparent_40%)]" />
              <div className="relative flex flex-wrap items-end gap-4">
                <div className="max-w-2xl"><div className="text-[7px] font-semibold uppercase tracking-[0.15em] text-primary">Evidence-backed community</div><h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em]">Share the complete decision—not a naked prediction.</h2><p className="mt-2 text-[9px] leading-5 text-muted">Every published record carries its source Gameplan, immutable timestamp, actual execution, evidence state and review context. The next decision remains individual.</p></div>
                <div className="ml-auto flex flex-wrap gap-2"><button type="button" onClick={() => { setPostDraft((current) => ({ ...current, kind: "REVIEW REQUEST" })); setShowPostModal(true); }} className="flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 text-[8px] font-semibold text-primary"><MessageCircle className="h-3.5 w-3.5" />Request a review</button><button type="button" onClick={() => setTab("today")} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background"><ArrowRight className="h-3.5 w-3.5" />Open today’s Gameplan</button></div>
              </div>
            </Card>
            <Card className="flex flex-wrap items-center gap-2 p-3">
              <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records by instrument, context, evidence or trader" className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-[8px] outline-none focus:border-primary/40" /></div>
              {(["all", "live", "proven", "mine"] as FeedFilter[]).map((filter) => <button key={filter} type="button" onClick={() => setFeedFilter(filter)} className={`h-8 rounded-lg px-3 text-[8px] font-semibold capitalize ${feedFilter === filter ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}>{filter}</button>)}
            </Card>
            <div className="mx-auto max-w-4xl space-y-3">
              {visiblePrecords.map(renderPrecordCard)}
              {!visiblePrecords.length ? <Card className="border-dashed p-14 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-muted" /><h2 className="mt-4 text-[13px] font-semibold">No Decision Records match this view.</h2><p className="mx-auto mt-2 max-w-md text-[8px] leading-4 text-muted">Records begin with the existing Gameplan, then gain their execution and evidence after the outcome.</p><button type="button" onClick={() => setTab("today")} className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-[8px] font-semibold text-background">Open today’s Gameplan</button></Card> : null}
              {feedFilter === "all" ? posts.filter((post) => post.scope !== "private" || post.userId === resolvedAccountKey).slice(0, 6).map(renderStructuredPost) : null}
            </div>
          </div>
        ) : null}

        {tab === "desks" ? (
          <div className="mx-auto max-w-6xl space-y-3 p-3">
            <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                <Card className="relative overflow-hidden p-5"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_36%)]" /><div className="relative flex flex-wrap items-center gap-4"><div><div className="text-[7px] font-semibold uppercase tracking-[0.15em] text-primary">Small groups · repeated contact · shared standards</div><h2 className="mt-2 text-[21px] font-semibold tracking-[-0.03em]">A feed gives reach. A Desk creates belonging.</h2><p className="mt-2 max-w-2xl text-[9px] leading-5 text-muted">Five to twelve compatible traders preparing, observing, and reviewing the same session without copying each other’s decisions.</p></div><button type="button" onClick={() => setShowDeskModal(true)} className="ml-auto flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background"><Plus className="h-3.5 w-3.5" />Create a Desk</button></div></Card>
                {myDesks.map((desk) => {
                  const payload = typedPayload<SocialDeskPayload>(desk);
                  const deskMembers = memberships.filter((member) => member.deskId === desk.id);
                  return <Card key={objectKey(desk)} className="overflow-hidden"><div className="flex items-start gap-3 border-b border-border p-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Network className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-semibold">{payload?.name}</h3><span className="rounded-lg border border-border bg-surface px-2 py-1 text-[7px] text-muted">{payload?.privacy}</span></div><p className="mt-1 text-[8px] leading-4 text-muted">{payload?.description || payload?.objective}</p></div><span className="font-mono text-[10px] text-primary">{deskMembers.length}/{payload?.capacity ?? 12}</span></div><div className="grid gap-3 p-4 md:grid-cols-[1fr_220px]"><div><div className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Weekly objective</div><div className="mt-2 rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-[9px] leading-4 text-foreground">{payload?.weeklyMission}</div><div className="mt-4 grid grid-cols-3 gap-2">{deskMembers.slice(0, 6).map((member) => { const memberPayload = typedPayload<SocialDeskMemberPayload>(member); return <div key={objectKey(member)} className="flex items-center gap-2 rounded-xl border border-border bg-surface/30 p-2"><Avatar label={member.authorLabel} size="sm" active={memberPayload?.status !== "AWAY"} /><span className="min-w-0"><span className="block truncate text-[8px] font-semibold">{member.authorLabel}</span><span className="block text-[7px] text-muted">{memberPayload?.status}</span></span></div>; })}</div></div><div className="space-y-3"><ScoreBar label="Preparation completion" value={deskMembers.length ? 72 : 0} /><ScoreBar label="Review integrity" value={deskMembers.length ? 64 : 0} /><ScoreBar label="Helpful reviews" value={deskMembers.length ? 58 : 0} /><div className="rounded-xl border border-border bg-background/30 p-3 text-[7px] leading-4 text-muted">Desk rankings measure shared process. P&amp;L is not part of the score.</div></div></div></Card>;
                })}
                {!myDesks.length ? <Card className="border-dashed p-14 text-center"><UsersRound className="mx-auto h-9 w-9 text-muted" /><h2 className="mt-4 text-[13px] font-semibold">Your Desk has not formed yet.</h2><p className="mx-auto mt-2 max-w-md text-[8px] leading-4 text-muted">Start with market, session, timezone, and one shared development objective. Capacity is deliberately capped at twelve.</p><button type="button" onClick={() => setShowDeskModal(true)} className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-[8px] font-semibold text-background">Create the first Desk</button></Card> : null}
                {availableDesks.length ? (
                  <Card className="overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                      <Compass className="h-4 w-4 text-primary" />
                      <div>
                        <h3 className="text-[10px] font-semibold">Compatible Desks</h3>
                        <p className="mt-0.5 text-[7px] text-muted">Small groups visible through market, session, timezone, and objective—not follower count.</p>
                      </div>
                    </div>
                    <div className="divide-y divide-border/70">
                      {availableDesks.slice(0, 6).map((desk) => {
                        const payload = typedPayload<SocialDeskPayload>(desk);
                        const memberCount = memberships.filter((member) => member.deskId === desk.id).length;
                        return (
                          <div key={objectKey(desk)} className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Network className="h-4 w-4" /></span>
                            <div className="min-w-[180px] flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[9px] font-semibold">{payload?.name ?? "Kwant Desk"}</span>
                                <span className="text-[7px] text-muted">{payload?.markets.join(" / ")} · {payload?.session}</span>
                              </div>
                              <p className="mt-1 truncate text-[7px] text-muted">{payload?.objective}</p>
                            </div>
                            <span className="font-mono text-[8px] text-muted">{memberCount}/{payload?.capacity ?? 12}</span>
                            <button type="button" onClick={() => void joinDesk(desk)} className="h-8 rounded-xl border border-primary/25 bg-primary/[0.07] px-3 text-[8px] font-semibold text-primary hover:bg-primary/10">{payload?.privacy === "PRIVATE" ? "Invite only" : "Join Desk"}</button>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ) : null}
              </div>
              <div className="space-y-3">
                <Card className="p-4"><div className="flex items-center gap-2"><Compass className="h-4 w-4 text-primary" /><h3 className="text-[10px] font-semibold">Compatibility matching</h3></div><div className="mt-4 space-y-2">{[["Market", currentProfile.markets.join(", ")], ["Session", currentProfile.session], ["Timezone", currentProfile.timezone], ["Objective", currentProfile.improvementObjective]].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface/30 p-3 text-[8px]"><span className="text-muted">{label}</span><span className="text-right text-foreground">{value}</span></div>)}</div><button type="button" onClick={() => { setTab("profile"); setProfileEditing(true); }} className="mt-3 w-full rounded-xl border border-border py-2.5 text-[8px] font-semibold text-muted hover:text-foreground">Refine matching profile</button></Card>
                <Card className="p-4"><div className="text-[7px] font-semibold uppercase tracking-[0.13em] text-primary">Desk rule</div><p className="mt-3 text-[9px] leading-5 text-foreground">Preparation can be shared. The next decision remains individual.</p><div className="mt-3 rounded-xl border border-border bg-background/30 p-3 text-[7px] leading-4 text-muted">Directional status is never shown publicly. Members appear as Preparing, Mapping, Waiting, Observing, Reviewing, or Away.</div></Card>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "rankings" ? (
          <div className="mx-auto max-w-6xl space-y-3 p-3">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3"><Trophy className="h-4 w-4 text-primary" /><div><h2 className="text-[11px] font-semibold">Process rankings</h2><p className="mt-0.5 text-[8px] text-muted">Friends and Desk first. Global visibility second. P&amp;L never enters the score.</p></div><div className="ml-auto flex gap-1">{["My Desk", "Friends", "This season"].map((label, index) => <button key={label} type="button" className={`rounded-lg px-3 py-2 text-[8px] font-semibold ${index === 0 ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface"}`}>{label}</button>)}</div></div>
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[52px_220px_repeat(8,1fr)_72px] border-b border-border px-4 py-2 text-[7px] font-semibold uppercase tracking-[0.09em] text-muted"><span>Rank</span><span>Trader</span>{SCORE_LABELS.map(([, label]) => <span key={label} className="text-center">{label.split(" ")[0]}</span>)}<span className="text-right">Index</span></div>
                  {rankedProfiles.map(({ object, profile }, index) => (
                    <div key={objectKey(object)} className="grid grid-cols-[52px_220px_repeat(8,1fr)_72px] items-center border-b border-border/55 px-4 py-3 text-[8px] hover:bg-surface/25">
                      <span className={`font-mono text-[12px] font-semibold ${index < 3 ? "text-primary" : "text-muted"}`}>{String(index + 1).padStart(2, "0")}</span>
                      <div className="flex items-center gap-2"><Avatar label={profile.displayName} size="sm" active={profile.processStatus !== "AWAY"} /><span className="min-w-0"><span className="block truncate font-semibold">{profile.displayName}</span><span className="block truncate text-[7px] text-muted">@{profile.handle} · {profile.markets.join("/")}</span></span></div>
                      {SCORE_LABELS.map(([key]) => <span key={key} className="text-center font-mono text-muted">{profile.scores[key] || "—"}</span>)}
                      <span className="text-right font-mono text-[11px] font-semibold text-primary">{profileScoreAverage(profile) || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <div className="grid gap-3 md:grid-cols-3">
              {[["Preparation", "Complete both sides before the selected session."], ["Patience", "Recognise when permission or quality never arrives."], ["Community Value", "Give reviews that materially improve another record."]].map(([title, detail], index) => <Card key={title} className="p-4"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">{index === 0 ? <CalendarDays className="h-4 w-4" /> : index === 1 ? <ShieldCheck className="h-4 w-4" /> : <UsersRound className="h-4 w-4" />}</span><h3 className="text-[10px] font-semibold">{title}</h3></div><p className="mt-3 text-[8px] leading-4 text-muted">{detail}</p></Card>)}
            </div>
          </div>
        ) : null}

        {tab === "cards" ? (
          <div className="mx-auto max-w-6xl space-y-3 p-3">
            <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
              <div className="space-y-3">
                <Card className="relative overflow-hidden p-5">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_50%)]" />
                  <div className="relative">
                    <div className="flex items-center gap-2 text-[7px] font-semibold uppercase tracking-[0.15em] text-primary"><Flame className="h-3.5 w-3.5" />Active state</div>
                    <div className="mt-5 flex h-44 flex-col justify-between rounded-2xl border border-primary/25 bg-black/35 p-4 shadow-[0_0_30px_color-mix(in_srgb,var(--primary)_9%,transparent)]">
                      <div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Flame className="h-5 w-5" /></span><span className="text-[7px] uppercase tracking-[0.16em] text-muted">Momentum · temporary</span></div>
                      <div><div className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">No active state</div><div className="mt-1 text-[8px] text-muted">Verified current form equips automatically.</div></div>
                    </div>
                    <p className="mt-3 text-[7px] leading-4 text-muted">An active state disappears when the condition ends. The first achievement remains permanently collectible.</p>
                  </div>
                </Card>
                <Card className="p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h3 className="text-[10px] font-semibold">Private correction track</h3></div><div className="mt-3 rounded-xl border border-border bg-background/30 p-3"><div className="text-[8px] font-semibold text-foreground">No unstable process detected</div><p className="mt-1 text-[7px] leading-4 text-muted">Corrective diagnoses are private, evidence-backed, appealable, and paired with a path to transformation.</p></div></Card>
              </div>
              <div className="space-y-3">
                <Card className="p-4"><div className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /><div><h2 className="text-[11px] font-semibold">Calling Card collection</h2><p className="mt-0.5 text-[8px] text-muted">{cards.filter((card) => card.userId === resolvedAccountKey).length} earned · origin, mastery, contribution, and transformation</p></div></div></Card>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {CALLING_CARD_CATALOG.map((definition) => {
                    const earnedObject = cards.find((card) => card.userId === resolvedAccountKey && typedPayload<SocialCardPayload>(card)?.code === definition.code);
                    const earned = typedPayload<SocialCardPayload>(earnedObject);
                    const hidden = definition.family === "HIDDEN" && !earned;
                    return (
                      <Card key={definition.code} className={`relative min-h-[210px] overflow-hidden p-4 ${earned ? "border-primary/30" : ""}`}>
                        <div className={`pointer-events-none absolute inset-0 ${earned ? "bg-[radial-gradient(circle_at_80%_0%,color-mix(in_srgb,var(--primary)_15%,transparent),transparent_45%)]" : "bg-gradient-to-br from-transparent to-surface/25"}`} />
                        <div className="relative flex h-full flex-col">
                          <div className="flex items-start justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${earned ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-surface text-muted"}`}>{hidden ? <EyeOff className="h-4 w-4" /> : definition.family === "MOMENTUM" ? <Flame className="h-4 w-4" /> : definition.family === "CONTRIBUTION" ? <UsersRound className="h-4 w-4" /> : definition.family === "MASTERY" ? <Medal className="h-4 w-4" /> : <Award className="h-4 w-4" />}</span><span className="rounded-lg border border-border bg-background/35 px-2 py-1 text-[6px] font-semibold uppercase tracking-[0.12em] text-muted">{definition.family}</span></div>
                          <div className="mt-5 text-[16px] font-semibold tracking-[-0.02em]">{hidden ? "Undiscovered" : definition.name}</div>
                          <p className="mt-2 text-[8px] leading-4 text-muted">{hidden ? "The requirement is revealed only after the positive behaviour is completed." : definition.description}</p>
                          <div className="mt-auto border-t border-border/70 pt-3 text-[7px] text-muted">{earned ? `Earned ${formatDate(earned.earnedAt)}` : definition.requirement}</div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "profile" ? (
          profileEditing && viewingOwnProfile ? (
          <div className="mx-auto grid max-w-6xl gap-3 p-3 lg:grid-cols-[360px_1fr]">
            <div className="space-y-3">
              <Card className="relative overflow-hidden p-5">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_0%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_48%)]" />
                <div className="relative">
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => avatarInputRef.current?.click()} className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-primary/10 text-[16px] font-semibold text-primary">
                      {profileDraft.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profileDraft.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : initials(profileDraft.displayName)}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/65 opacity-0 transition-opacity group-hover:opacity-100"><Camera className="h-4 w-4 text-white" /></span>
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => { handleAvatar(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} />
                    <div className="min-w-0"><h2 className="truncate text-[18px] font-semibold">{profileDraft.displayName}</h2><div className="mt-1 text-[9px] text-primary">@{profileDraft.handle}</div><button type="button" onClick={() => avatarInputRef.current?.click()} className="mt-2 text-[7px] font-semibold text-muted hover:text-primary">Change profile photo</button><div className="mt-2 flex flex-wrap gap-1">{profileDraft.markets.map((market) => <span key={market} className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[7px] font-semibold text-primary">{market}</span>)}</div></div>
                  </div>
                  <p className="mt-5 text-[9px] leading-5 text-muted">{profileDraft.bio || `${profileDraft.session} · ${profileDraft.style}`}</p>
                  <div className="mt-4 rounded-xl border border-border bg-background/30 p-3"><div className="text-[7px] uppercase tracking-[0.13em] text-muted">Current focus</div><div className="mt-2 text-[9px] leading-4 text-foreground">{profileDraft.improvementObjective}</div></div>
                  <div className="mt-4 flex items-center justify-between"><div><div className="font-mono text-[28px] font-semibold text-primary">{profileScoreAverage(profileDraft) || "—"}</div><div className="text-[7px] text-muted">Process index</div></div><div className="text-right"><div className="text-[8px] font-semibold text-foreground">{profileDraft.strongestDiscipline}</div><div className="mt-1 text-[7px] text-muted">Strongest discipline</div></div></div>
                </div>
              </Card>
              <Card className="p-4"><div className="text-[8px] font-semibold text-foreground">Professional record, not a biography.</div><p className="mt-2 text-[7px] leading-4 text-muted">Identity is earned through preparation, receipts, reviews, and contribution. One profitable screenshot cannot create reputation.</p></Card>
            </div>
            <div className="space-y-3">
              <Card className="p-5">
                <div className="flex items-center gap-2"><Radar className="h-4 w-4 text-primary" /><div><h2 className="text-[11px] font-semibold">Trader identity</h2><p className="mt-0.5 text-[8px] text-muted">Controls matching, profile context, and what other traders are allowed to see.</p></div></div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {[["Display name", "displayName"], ["Handle", "handle"], ["Markets — comma separated", "markets"], ["Session", "session"], ["Timezone", "timezone"], ["Experience", "experience"], ["Trading style", "style"], ["Favourite theme", "favouriteTheme"], ["Strongest discipline", "strongestDiscipline"], ["Current blind spot", "currentBlindSpot"]].map(([label, key]) => <label key={key} className="block"><span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</span><input value={key === "markets" ? profileDraft.markets.join(", ") : String(profileDraft[key as keyof SocialProfilePayload])} onChange={(event) => setProfileDraft((current) => ({ ...current, [key]: key === "markets" ? event.target.value.split(",").map((market) => market.trim()) : event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" /></label>)}
                  <label className="block md:col-span-2"><span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Current improvement objective</span><textarea value={profileDraft.improvementObjective} onChange={(event) => setProfileDraft((current) => ({ ...current, improvementObjective: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/40" /></label>
                  <label className="block md:col-span-2"><span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Short professional context</span><textarea value={profileDraft.bio} onChange={(event) => setProfileDraft((current) => ({ ...current, bio: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/40" /></label>
                  <label className="block"><span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Contact email</span><input type="email" value={profileDraft.contactEmail ?? ""} onChange={(event) => setProfileDraft((current) => ({ ...current, contactEmail: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" /></label>
                  <label className="block"><span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Website</span><input type="url" placeholder="https://" value={profileDraft.websiteUrl ?? ""} onChange={(event) => setProfileDraft((current) => ({ ...current, websiteUrl: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" /></label>
                  <label className="flex items-center gap-3 rounded-xl border border-border bg-background/35 p-3 md:col-span-2"><input type="checkbox" checked={Boolean(profileDraft.showContactEmail)} onChange={(event) => setProfileDraft((current) => ({ ...current, showContactEmail: event.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /><span><span className="block text-[8px] font-semibold text-foreground">Show contact email publicly</span><span className="mt-0.5 block text-[7px] text-muted">Leave this off if messages should stay inside Kwant Desk.</span></span></label>
                  <label className="block md:col-span-2">
                    <span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Calling Card banner</span>
                    <KwantSelect value={profileDraft.callingCardCode ?? ""} onChange={(event) => setProfileDraft((current) => ({ ...current, callingCardCode: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none">
                      <option value="">Automatic / latest earned card</option>
                      {cards.filter((card) => card.userId === resolvedAccountKey).map((card) => typedPayload<SocialCardPayload>(card)).filter((card): card is SocialCardPayload => card !== null).filter((card) => card.public !== false).map((card) => <option key={card.code} value={card.code}>{card.name}</option>)}
                    </KwantSelect>
                  </label>
                  <div className="space-y-2 md:col-span-2">
                    <div className="text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Profile links</div>
                    {[0, 1, 2].map((index) => {
                      const link = profileDraft.profileLinks?.[index] ?? { label: "", url: "" };
                      return (
                        <div key={index} className="grid gap-2 sm:grid-cols-[150px_1fr]">
                          <input value={link.label} onChange={(event) => setProfileDraft((current) => { const links = [...(current.profileLinks ?? [])]; links[index] = { label: event.target.value, url: links[index]?.url ?? "" }; return { ...current, profileLinks: links }; })} placeholder="Label" className="h-9 rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" />
                          <input value={link.url} onChange={(event) => setProfileDraft((current) => { const links = [...(current.profileLinks ?? [])]; links[index] = { label: links[index]?.label ?? "", url: event.target.value }; return { ...current, profileLinks: links }; })} placeholder="https://" className="h-9 rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
              <div className="grid gap-3 md:grid-cols-2">
                <Card className="p-4"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><h3 className="text-[10px] font-semibold">Process dimensions</h3></div><div className="mt-4 space-y-3">{SCORE_LABELS.map(([key, label]) => <ScoreBar key={key} label={label} value={profileDraft.scores[key]} />)}</div><div className="mt-4 rounded-xl border border-border bg-background/30 p-3 text-[7px] leading-4 text-muted">Scores remain empty until verified platform activity supplies enough evidence. No vanity numbers are invented.</div></Card>
                <Card className="p-4"><div className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /><h3 className="text-[10px] font-semibold">Privacy controls</h3></div><div className="mt-4 space-y-3">{([["profile", "Identity card"], ["activity", "Activity"], ["scores", "Process scores"], ["cards", "Calling Cards"]] as Array<[keyof SocialProfilePayload["visibility"], string]>).map(([key, label]) => <div key={key} className="flex items-center gap-3"><span className="min-w-0 flex-1 text-[8px] text-muted">{label}</span><KwantSelect value={profileDraft.visibility[key]} onChange={(event) => setProfileDraft((current) => ({ ...current, visibility: { ...current.visibility, [key]: event.target.value as SocialScope } }))} className="h-8 rounded-lg border border-border bg-surface px-2 text-[8px] outline-none"><option value="private">Private</option><option value="friends">Friends</option><option value="desk">My Desk</option><option value="community">Community</option></KwantSelect></div>)}</div><div className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-[7px] leading-4 text-muted"><ShieldCheck className="mb-2 h-4 w-4 text-primary" />Evidence remains private unless the record explicitly shares it. Broker credentials are never stored here.</div></Card>
              </div>
              <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-border bg-panel/95 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1" aria-live="polite">
                  <div className={`flex items-center gap-2 text-[8px] font-semibold ${profileSaveState === "error" ? "text-danger" : profileSaveState === "saving" ? "text-primary" : "text-foreground"}`}>
                    {profileSaveState === "saving" ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
                    ) : profileSaveState === "error" ? (
                      <CircleAlert className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    )}
                    {profileSaveState === "saving"
                      ? "Saving changes to your account…"
                      : profileSaveState === "error"
                        ? "Your changes have not been saved."
                        : "Your profile and photo will be saved to your account."}
                  </div>
                  <p className="mt-1 text-[7px] text-muted">
                    {profileSaveState === "saving"
                      ? "Checking your handle and syncing the finished profile."
                      : profileSaveState === "error"
                        ? "Review the message above, then try again."
                        : "After saving, you’ll return to your public profile."}
                  </p>
                </div>
                <div className="flex shrink-0 justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDraft(currentProfile);
                      setProfileEditing(false);
                      setProfileSaveState("idle");
                    }}
                    disabled={profileSaveState === "saving"}
                    className="h-11 rounded-xl border border-border bg-surface px-5 text-[9px] font-semibold text-muted transition-all hover:border-primary/20 hover:text-foreground active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={profileSaveState === "saving"}
                    className="flex h-11 min-w-[142px] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[9px] font-semibold text-background shadow-[0_0_28px_color-mix(in_srgb,var(--primary)_24%,transparent)] transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.96] disabled:cursor-wait disabled:translate-y-0 disabled:opacity-75"
                  >
                    {profileSaveState === "saving" ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {profileSaveState === "saving" ? "Saving profile…" : "Save profile"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          ) : viewedProfileObject && viewedProfile ? (
            <SocialProfileView
              profileObject={viewedProfileObject}
              profile={viewedProfile}
              gameplans={viewedGameplans}
              cards={cards}
              comments={comments}
              isOwnProfile={viewingOwnProfile}
              savedIds={savedGameplanIds}
              repostedIds={repostedGameplanIds}
              onBack={initialProfileHandle
                ? () => {
                    if (viewingOwnProfile) onCloseProfile?.();
                    else onOpenProfile?.(currentProfile.handle);
                  }
                : undefined}
              backLabel={viewingOwnProfile ? "Back to Socials" : "Back to profile"}
              onEdit={() => setProfileEditing(true)}
              onMessage={() => onMessageProfile?.(viewedProfileObject.userId)}
              onOpenGameplan={setSelectedProfileRecord}
              onSave={(record) => void toggleGameplanSave(record)}
              onRepost={(record) => void toggleGameplanRepost(record)}
              onShareGameplan={shareGameplan}
              onShareProfile={shareProfile}
            />
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
              <Radar className="h-8 w-8 text-muted" />
              <div className="mt-3 text-[11px] font-semibold text-foreground">Profile unavailable</div>
              <p className="mt-2 max-w-sm text-[8px] leading-4 text-muted">This profile does not exist or its owner has limited who can view it.</p>
              {onCloseProfile ? <button type="button" onClick={onCloseProfile} className="mt-4 rounded-xl border border-border bg-surface px-4 py-2 text-[8px] font-semibold text-muted hover:text-foreground">Back to Socials</button> : null}
            </div>
          )
        ) : null}
      </main>

      {selectedProfileRecord ? (
        <div className="fixed inset-0 z-[1150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProfileRecord(null); }}>
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/70">
            <div className="flex h-12 shrink-0 items-center border-b border-border px-4"><div className="text-[10px] font-semibold text-foreground">Gameplan post</div><div className="ml-2 text-[8px] text-muted">Comments, reposts, shares and saves remain attached to the original record.</div><button type="button" onClick={() => setSelectedProfileRecord(null)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{renderPrecordCard(selectedProfileRecord)}</div>
          </div>
        </div>
      ) : null}

      {avatarCrop ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !avatarCropSaving) closeAvatarCrop();
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/70">
            <div className="flex items-start gap-3 border-b border-border p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Camera className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-[14px] font-semibold text-foreground">Crop profile photo</h2>
                <p className="mt-1 text-[8px] leading-4 text-muted">Drag to reposition, then use the slider to resize your photo.</p>
              </div>
              <button
                type="button"
                onClick={closeAvatarCrop}
                disabled={avatarCropSaving}
                aria-label="Close profile photo editor"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col items-center px-5 py-6">
              <div
                className="relative h-72 w-72 touch-none select-none overflow-hidden rounded-full border border-primary/35 bg-black shadow-[0_0_42px_color-mix(in_srgb,var(--primary)_14%,transparent)] cursor-grab active:cursor-grabbing"
                onPointerDown={beginAvatarDrag}
                onPointerMove={moveAvatarDrag}
                onPointerUp={endAvatarDrag}
                onPointerCancel={endAvatarDrag}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarCrop.sourceUrl}
                  alt="Profile photo crop preview"
                  draggable={false}
                  className="pointer-events-none absolute max-w-none select-none"
                  style={{
                    width: avatarCrop.naturalWidth * avatarCropScale(avatarCrop),
                    height: avatarCrop.naturalHeight * avatarCropScale(avatarCrop),
                    left: `calc(50% + ${avatarCrop.offsetX}px)`,
                    top: `calc(50% + ${avatarCrop.offsetY}px)`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/25" />
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/[0.08]" />
                <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/[0.08]" />
              </div>

              <div className="mt-6 flex w-full max-w-sm items-center gap-3">
                <span className="text-[16px] leading-none text-muted">−</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={avatarCrop.zoom}
                  onChange={(event) => updateAvatarZoom(Number(event.target.value))}
                  aria-label="Resize profile photo"
                  className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[var(--primary)]"
                />
                <Plus className="h-4 w-4 text-muted" />
              </div>
              <div className="mt-2 flex w-full max-w-sm items-center justify-between text-[7px] text-muted">
                <span>Resize</span>
                <button
                  type="button"
                  onClick={() => setAvatarCrop((current) => current ? { ...current, zoom: 1, offsetX: 0, offsetY: 0 } : current)}
                  className="font-semibold text-muted transition-colors hover:text-primary"
                >
                  Reset position
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-background/20 px-5 py-4">
              <button
                type="button"
                onClick={closeAvatarCrop}
                disabled={avatarCropSaving}
                className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted hover:text-foreground disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveCroppedAvatar()}
                disabled={avatarCropSaving}
                className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-60"
              >
                {avatarCropSaving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/30 border-t-background" /> : <Check className="h-3.5 w-3.5" />}
                {avatarCropSaving ? "Preparing photo…" : "Use this photo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPostModal ? (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPostModal(false); }}>
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/60">
            <div className="flex items-start gap-3 border-b border-border p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="h-4 w-4" /></span>
              <div><h2 className="text-[14px] font-semibold">Share a structured update</h2><p className="mt-1 text-[8px] text-muted">The format carries the context. A claim without a reason, condition, timestamp, or focused question cannot enter the feed.</p></div>
              <button type="button" onClick={() => setShowPostModal(false)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid gap-3 md:grid-cols-3">
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Update type</span><KwantSelect value={postDraft.kind} onChange={(event) => setPostDraft((current) => ({ ...current, kind: event.target.value as SocialPostPayload["kind"] }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"><option value="MAP">Map</option><option value="LIVE OBSERVATION">Live Observation</option><option value="REVIEW REQUEST">Review Request</option><option value="LESSON">Lesson</option><option value="QUESTION">Question</option></KwantSelect></label>
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Instrument</span><input value={postDraft.instrument} onChange={(event) => setPostDraft((current) => ({ ...current, instrument: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/40" /></label>
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Visibility</span><KwantSelect value={postDraft.scope} onChange={(event) => setPostDraft((current) => ({ ...current, scope: event.target.value as SocialScope }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"><option value="private">Private</option><option value="friends">Friends</option><option value="desk">My Desk</option><option value="community">Community</option></KwantSelect></label>
              </div>
              <label className="mt-4 block"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Title</span><input value={postDraft.title} onChange={(event) => setPostDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Optional concise headline" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none placeholder:text-muted/55 focus:border-primary/40" /></label>
              <label className="mt-4 block"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">{postDraft.kind === "QUESTION" ? "Focused question *" : postDraft.kind === "LESSON" ? "Lesson *" : "What changed or matters? *"}</span><textarea value={postDraft.body} onChange={(event) => setPostDraft((current) => ({ ...current, body: event.target.value }))} rows={4} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-5 outline-none focus:border-primary/40" /></label>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Context / reason *</span><textarea value={postDraft.context} onChange={(event) => setPostDraft((current) => ({ ...current, context: event.target.value }))} rows={4} placeholder="What evidence or market state makes this relevant?" className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none placeholder:text-muted/55 focus:border-primary/40" /></label>
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Condition / evidence{postDraft.kind === "MAP" || postDraft.kind === "LIVE OBSERVATION" ? " *" : ""}</span><textarea value={postDraft.condition} onChange={(event) => setPostDraft((current) => ({ ...current, condition: event.target.value }))} rows={4} placeholder="What would confirm this observation?" className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none placeholder:text-muted/55 focus:border-primary/40" /></label>
                <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Invalidation{postDraft.kind === "MAP" ? " *" : ""}</span><textarea value={postDraft.invalidation} onChange={(event) => setPostDraft((current) => ({ ...current, invalidation: event.target.value }))} rows={3} placeholder="What would make this interpretation wrong?" className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none placeholder:text-muted/55 focus:border-primary/40" /></label>
              </div>
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-[8px] leading-4 text-muted"><strong className="text-primary">{postDraft.kind}:</strong> {postDraft.kind === "MAP" ? "Share the structure, both the confirming condition and the invalidation." : postDraft.kind === "LIVE OBSERVATION" ? "Timestamp the observation and show what evidence would sustain it." : postDraft.kind === "REVIEW REQUEST" ? "Ask for one precise form of feedback rather than broad approval." : postDraft.kind === "LESSON" ? "Anchor the lesson in a specific context another trader can recognise." : "Give enough context for a useful answer."}</div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-background/20 px-5 py-4"><button type="button" onClick={() => setShowPostModal(false)} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted">Cancel</button><button type="button" onClick={() => void publishStructuredPost()} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background"><Send className="h-3.5 w-3.5" />Publish structured update</button></div>
          </div>
        </div>
      ) : null}

      {showReceiptFor ? (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowReceiptFor(null); }}>
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/60">
            <div className="flex items-start gap-3 border-b border-border p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent"><CheckCircle2 className="h-4 w-4" /></span><div><h2 className="text-[14px] font-semibold">Add Actual Execution</h2><p className="mt-1 text-[8px] text-muted">Complete the record beneath the locked plan. The original remains unchanged.</p></div><button type="button" onClick={() => setShowReceiptFor(null)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface"><X className="h-4 w-4" /></button></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <label className="flex items-center gap-3 rounded-xl border border-border bg-surface/35 p-3"><input type="checkbox" checked={receiptDraft.noTrade} onChange={(event) => setReceiptDraft((current) => ({ ...current, noTrade: event.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /><span><span className="block text-[9px] font-semibold">No Trigger / no trade taken</span><span className="mt-0.5 block text-[7px] text-muted">This can complete the operating loop when confirmation never appeared.</span></span></label>
              {!receiptDraft.noTrade ? (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Executed side</span><KwantSelect value={receiptDraft.actualDirection} onChange={(event) => setReceiptDraft((current) => ({ ...current, actualDirection: event.target.value as "LONG" | "SHORT" }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"><option value="LONG">Long</option><option value="SHORT">Short</option></KwantSelect></label>
                    {[["Average entry", "actualEntry", "number"], ["Entry time", "entryTime", "datetime-local"], ["Actual stop", "actualStop", "number"], ["Final exit", "actualExit", "number"], ["Exit time", "exitTime", "datetime-local"], ["Total size", "size", "number"], ["Maximum actual risk", "maximumActualRisk", "number"], ["Fees", "fees", "number"]].map(([label, key, type]) => <label key={key}><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">{label}</span><input type={type} step={type === "number" ? "any" : undefined} value={receiptDraft[key as keyof typeof receiptDraft] as string} onChange={(event) => setReceiptDraft((current) => ({ ...current, [key]: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" /></label>)}
                  </div>
                  <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-surface/25 p-4 md:grid-cols-3">
                    <div className="md:col-span-3"><div className="text-[8px] font-semibold text-foreground">Additional fill</div><div className="mt-0.5 text-[7px] text-muted">Preserve a second fill instead of hiding it inside one average.</div></div>
                    {[["Fill price", "fill2Price", "number"], ["Fill size", "fill2Size", "number"], ["Fill time", "fill2Time", "datetime-local"]].map(([label, key, type]) => <label key={key}><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">{label}</span><input type={type} step={type === "number" ? "any" : undefined} value={receiptDraft[key as keyof typeof receiptDraft] as string} onChange={(event) => setReceiptDraft((current) => ({ ...current, [key]: event.target.value }))} className="h-9 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>)}
                    <div className="md:col-span-3 mt-1 border-t border-border pt-3"><div className="text-[8px] font-semibold text-foreground">Additional partial exit</div></div>
                    {[["Exit price", "exit2Price", "number"], ["Exit size", "exit2Size", "number"], ["Exit time", "exit2Time", "datetime-local"]].map(([label, key, type]) => <label key={key}><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">{label}</span><input type={type} step={type === "number" ? "any" : undefined} value={receiptDraft[key as keyof typeof receiptDraft] as string} onChange={(event) => setReceiptDraft((current) => ({ ...current, [key]: event.target.value }))} className="h-9 w-full rounded-xl border border-border bg-background px-3 text-[8px] outline-none focus:border-primary/40" /></label>)}
                  </div>
                </>
              ) : null}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">What changed?</span><KwantSelect value={receiptDraft.deviationReason} onChange={(event) => setReceiptDraft((current) => ({ ...current, deviationReason: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"><option value="">No material deviation</option><option>CONFIRMATION ARRIVED LATER</option><option>ENTRY USED A DEFINED ZONE</option><option>ORDER-FLOW CONDITIONS IMPROVED</option><option>ORIGINAL PRICE WAS MISSED</option><option>MARKET STRUCTURE CHANGED</option><option>IMPULSIVE DEVIATION</option><option>OTHER</option></KwantSelect></label>
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Partial exits</span><input value={receiptDraft.partialExits} onChange={(event) => setReceiptDraft((current) => ({ ...current, partialExits: event.target.value }))} placeholder="Optional sizes and prices" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" /></label>
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Confirmations that appeared</span><textarea value={receiptDraft.confirmationsAppeared} onChange={(event) => setReceiptDraft((current) => ({ ...current, confirmationsAppeared: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/40" /></label>
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Justification detail</span><textarea value={receiptDraft.deviationDetail} onChange={(event) => setReceiptDraft((current) => ({ ...current, deviationDetail: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/40" /></label>
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Outcome review</span><textarea value={receiptDraft.outcomeReview} onChange={(event) => setReceiptDraft((current) => ({ ...current, outcomeReview: event.target.value }))} rows={4} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/40" /></label>
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Next-time rule</span><textarea value={receiptDraft.nextTimeRule} onChange={(event) => setReceiptDraft((current) => ({ ...current, nextTimeRule: event.target.value }))} rows={4} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/40" /></label>
              </div>
              <button type="button" onClick={() => evidenceInputRef.current?.click()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/30 px-4 py-5 text-[8px] font-semibold text-muted hover:border-primary/35 hover:text-foreground"><ImageIcon className="h-4 w-4 text-primary" />{receiptDraft.evidenceName || "Attach chart or broker evidence · image up to 2 MB"}</button>
              <input ref={evidenceInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => { handleEvidence(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} />
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3 text-[7px] leading-4 text-muted"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span>Attachments remain private. Until a broker import verifies the execution, the public record is explicitly labelled <strong className="text-foreground">self reported</strong>.</span></div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-background/20 px-5 py-4"><button type="button" onClick={() => setShowReceiptFor(null)} disabled={assessmentState === "reviewing"} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted disabled:opacity-50">Cancel</button><button type="button" onClick={() => void submitReceipt()} disabled={assessmentState === "reviewing"} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-60">{assessmentState === "reviewing" ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/30 border-t-background" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{assessmentState === "reviewing" ? "ZYON reviewing…" : "Complete Decision Record"}</button></div>
          </div>
        </div>
      ) : null}

      {showDeskModal ? (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDeskModal(false); }}>
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/60">
            <div className="flex items-start gap-3 border-b border-border p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><UsersRound className="h-4 w-4" /></span><div><h2 className="text-[14px] font-semibold">Create a Kwant Desk</h2><p className="mt-1 text-[8px] text-muted">A persistent group of 5–12 compatible traders.</p></div><button type="button" onClick={() => setShowDeskModal(false)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface"><X className="h-4 w-4" /></button></div>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {[["Desk name", "name"], ["Markets — comma separated", "markets"], ["Session", "session"], ["Timezone", "timezone"], ["Capacity — maximum 12", "capacity"]].map(([label, key]) => <label key={key}><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">{label}</span><input value={String(deskDraft[key as keyof typeof deskDraft])} onChange={(event) => setDeskDraft((current) => ({ ...current, [key]: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" /></label>)}
              <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Joining</span><KwantSelect value={deskDraft.privacy} onChange={(event) => setDeskDraft((current) => ({ ...current, privacy: event.target.value as SocialDeskPayload["privacy"] }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"><option value="REQUEST">Request to join</option><option value="PRIVATE">Private invite</option></KwantSelect></label>
              <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Shared development objective *</span><textarea value={deskDraft.objective} onChange={(event) => setDeskDraft((current) => ({ ...current, objective: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] outline-none focus:border-primary/40" /></label>
              <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Desk description</span><textarea value={deskDraft.description} onChange={(event) => setDeskDraft((current) => ({ ...current, description: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] outline-none focus:border-primary/40" /></label>
              <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">First weekly mission</span><input value={deskDraft.weeklyMission} onChange={(event) => setDeskDraft((current) => ({ ...current, weeklyMission: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-background/20 px-5 py-4"><button type="button" onClick={() => setShowDeskModal(false)} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted">Cancel</button><button type="button" onClick={createDesk} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background"><UsersRound className="h-3.5 w-3.5" />Create Desk</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
