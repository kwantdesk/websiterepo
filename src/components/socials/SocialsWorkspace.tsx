"use client";

import {
  Activity,
  Archive,
  ArrowRight,
  Award,
  BarChart3,
  BrainCircuit,
  Bookmark,
  Camera,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock3,
  Compass,
  CornerUpLeft,
  Eye,
  EyeOff,
  Flame,
  Gauge,
  Globe2,
  Heart,
  Image as ImageIcon,
  Layers3,
  LockKeyhole,
  Medal,
  MessageCircle,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  Pin,
  Radar,
  Repeat2,
  Scale,
  Search,
  Send,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  Trophy,
  Trash2,
  Upload,
  UserPlus,
  UsersRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import KwantLoader from "@/components/KwantLoader";
import KwantSelect from "@/components/ui/KwantSelect";
import WorkspaceSubnav from "@/components/ui/WorkspaceSubnav";
import SocialProfileView from "@/components/socials/SocialProfileView";
import ActivityStreakBadge from "@/components/socials/ActivityStreakBadge";
import CallingCardVisual from "@/components/socials/CallingCardVisual";
import ReasoningOutcomeChart from "@/components/socials/ReasoningOutcomeChart";
import TradePostChart from "@/components/socials/TradePostChart";
import DeskWorkspace from "@/components/socials/DeskWorkspace";
import UserAvatar from "@/components/socials/UserAvatar";
import { cacheProfileIdentity } from "@/lib/profileIdentityCache";
import { normalizeSharedTradeMessage } from "@/lib/sharedTrades";
import { isValidProfileHandle, PROFILE_HANDLE_REQUIREMENTS } from "@/lib/profileHandle";
import {
  buildDefaultProfile,
  buildExecutionComparison,
  calculateReceiptClassification,
  calculateReceiptScores,
  CALLING_CARD_CATALOG,
  normalizeSocialProfile,
  profileScoreAverage,
  reasoningScoreFromReceipts,
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
  type SocialProfilePayload,
  type SocialProgressPayload,
  type SocialReactionPayload,
  type SocialTradeSnapshot,
  type SocialReceiptPayload,
  type SocialScope,
  type SocialState,
} from "@/lib/socials";
import {
  zyonGameplanMissingFields,
  zyonTradingAccountLabel,
  type ZyonGameplanDraft,
  type ZyonTradingAccount,
  type ZyonTradingAccountMode,
  type ZyonTradingAccountPhase,
} from "@/lib/zyon";
import { SOCIAL_RECORD_COPY, SOCIAL_RECORD_RULES } from "@/lib/socialRecordConfig";
import {
  effectivePresenceStatus,
  presenceOption,
  type FriendSummary,
  type FriendsPayload,
} from "@/lib/friends";
import { loadSocialState, normalizeSocialState, saveSocialState } from "@/lib/socialsStore";
import {
  DESK_CREATED_EVENT,
  DESK_NETWORK_CHANGED_EVENT,
  EMPTY_DESK_NETWORK,
  type CreatedDeskPayload,
  type DeskNetworkPayload,
} from "@/lib/desks";
import {
  calculateProcessReputation,
  compareProcessReputation,
  processReputationSeason,
  PROCESS_REPUTATION_VERSION,
} from "@/lib/socialReputation";
import { encodeCanvasImage, prepareSharedImage } from "@/lib/clientImageProcessing";
import type { SocialFollowListItem, SocialFollowRecommendation, SocialFollowResponse } from "@/lib/socialFollows";
import {
  loadSocialProfilePreview,
  type SocialProfilePreview,
} from "@/lib/socialProfilePreview";
import {
  Activity as ReactActivity,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { zyonGameplanLaunchHref } from "@/lib/zyonGameplanLaunch";
import {
  buildGameplanScoringRecord,
  persistGameplanScoringRecord,
  writePendingScoringTransition,
} from "@/lib/gameplanScoringTransition";

type SocialTab = "today" | "reasoning" | "precords" | "desks" | "feed" | "rankings" | "cards" | "profile";
type FeedFilter = "all" | "proven" | "mine";
type SocialFeedMode = "following" | "recommended" | "latest";
type SocialFeedCollection = "feed" | "posts" | "liked" | "reposts" | "saved";
type RankingScope = "desk" | "friends" | "season";
type AvatarCropDraft = {
  sourceUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
};
type DeskNameCheckState = {
  state: "idle" | "checking" | "available" | "taken" | "invalid" | "error";
  message: string;
};
type RequestedProfileState = "idle" | "loading" | "ready" | "missing" | "error";

function ProfileOpeningState({
  preview,
  failed = false,
  onBack,
}: {
  preview: SocialProfilePreview | null;
  failed?: boolean;
  onBack?: () => void;
}) {
  if (failed) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
        <Radar className="h-8 w-8 text-muted" />
        <div className="mt-3 text-[11px] font-semibold text-foreground">Profile could not load</div>
        <p className="mt-2 max-w-sm text-[8px] leading-4 text-muted">
          The account is available, but its profile data could not be reached. Try opening it again.
        </p>
        {onBack ? (
          <button type="button" onClick={onBack} className="mt-4 rounded-xl border border-border bg-surface px-4 py-2 text-[8px] font-semibold text-muted hover:text-foreground">
            Back to Socials
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-3 sm:p-4" aria-label="Opening profile">
      <section className="overflow-hidden rounded-3xl border border-border bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="relative h-40 overflow-hidden border-b border-border sm:h-48">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_35%),radial-gradient(circle_at_82%_70%,color-mix(in_srgb,var(--accent)_12%,transparent),transparent_38%),linear-gradient(125deg,color-mix(in_srgb,var(--surface)_78%,black),var(--background))]" />
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(color-mix(in_srgb,var(--primary)_18%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--primary)_18%,transparent)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-primary shadow-[0_0_18px_var(--primary)]" />
        </div>
        <div className="relative px-4 pb-6 sm:px-7">
          <div className="-mt-12 flex items-end gap-4">
            <UserAvatar
              label={preview?.displayName ?? "Kwant Desk user"}
              avatarUrl={preview?.avatarUrl}
              size="xl"
              active={preview?.isOnline}
              className="rounded-full border-[5px] border-panel shadow-2xl"
            />
            <div className="min-w-0 flex-1 pb-1">
              <div className="truncate text-[22px] font-semibold tracking-[-0.03em] text-foreground">
                {preview?.displayName ?? "Opening profile"}
              </div>
              <div className="mt-1 text-[10px] text-primary">
                {preview ? `@${preview.handle}` : "Loading account details"}
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-2">
              <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-surface" />
              <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-surface" />
            </div>
            <div className="h-16 animate-pulse rounded-2xl border border-border bg-background/35" />
          </div>
          <KwantLoader
            title={preview ? `Opening ${preview.displayName}` : "Opening profile"}
            detail="Loading this account's public record."
            icon={UsersRound}
            compact
            className="mt-5 min-h-[150px] rounded-2xl border border-border"
          />
        </div>
      </section>
    </div>
  );
}

const AVATAR_CROP_SIZE = 288;
const AVATAR_OUTPUT_SIZE = 1080;
const MAX_AVATAR_SOURCE_BYTES = 20_000_000;

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

const SOCIAL_TABS: Array<{ id: SocialTab; label: string; description: string; icon: typeof Activity }> = [
  { id: "feed", label: "Feed", description: "Following and posts", icon: Heart },
  { id: "desks", label: "Desks", description: "Your trading groups", icon: UsersRound },
  { id: "rankings", label: "Reputation", description: "Rankings and trust", icon: Trophy },
  { id: "today", label: "Record", description: "Your live process", icon: Activity },
  { id: "profile", label: "Profile", description: "Your public identity", icon: Radar },
  { id: "cards", label: "Calling Cards", description: "Identity rewards", icon: Award },
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

const GAMEPLAN_PROCESS_STEPS: Array<{
  label: string;
  detail: string;
  icon: typeof Activity;
}> = [
  { label: "Make Gameplan", detail: "Build the structured plan with ZYON.", icon: BrainCircuit },
  { label: "Publish Gameplan", detail: "Review the holding record and lock it in.", icon: Send },
  { label: "Waiting for trade info", detail: "The locked plan stays here until the real execution is reported.", icon: Clock3 },
  { label: "Gameplan finalised", detail: "The outcome and Reasoning Score are preserved.", icon: CheckCircle2 },
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
  kind: "POST" as SocialPostPayload["kind"],
  instrument: "NQ",
  title: "",
  body: "",
  context: "",
  condition: "",
  invalidation: "",
  imageDataUrl: "",
  imageName: "",
  scope: "community" as SocialScope,
};

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function tradingAccountForMode(
  mode: ZyonTradingAccountMode,
  current?: ZyonTradingAccount | null,
): ZyonTradingAccount {
  return {
    mode,
    provider: current?.provider ?? "",
    program: current?.program ?? "",
    phase: mode === "PROP" ? "EVALUATION" : mode === "LIVE" ? "LIVE" : "SIMULATION",
    size: current?.size ?? null,
    currency: current?.currency ?? "USD",
  };
}

function formatDate(value: string, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", includeTime
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function tradeMoney(value: number, signed = true) {
  const absolute = Math.abs(value).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  if (!signed || value === 0) return absolute;
  return `${value > 0 ? "+" : "-"}${absolute}`;
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

function commentThreadRootId(comment: SocialObject, comments: SocialObject[]) {
  let current = comment;
  const visited = new Set<string>();
  for (let depth = 0; depth < 12; depth += 1) {
    const replyTo = typedPayload<SocialCommentPayload>(current)?.replyToCommentId;
    if (!replyTo || visited.has(replyTo)) return current.id;
    visited.add(replyTo);
    const parent = comments.find((candidate) => candidate.id === replyTo);
    if (!parent) return current.id;
    current = parent;
  }
  return current.id;
}

function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <div id={id} className={`rounded-2xl border border-border bg-panel ${className}`}>{children}</div>;
}

function Avatar({
  label,
  avatarUrl,
  active = false,
  statusClassName = "",
  size = "md",
}: {
  label: string;
  avatarUrl?: string | null;
  active?: boolean;
  statusClassName?: string;
  size?: "sm" | "md" | "lg";
}) {
  return <UserAvatar label={label} avatarUrl={avatarUrl} active={active} statusClassName={statusClassName} size={size} />;
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

function ReasoningScoreBar({ value, waiting = false }: { value: number | null; waiting?: boolean }) {
  const normalized = value === null ? 0 : Math.max(0, Math.min(100, value));
  const tone = waiting || value === null
    ? "var(--warning)"
    : normalized < 25
      ? "var(--danger)"
      : normalized < 65
        ? "var(--warning)"
        : "var(--accent)";
  return (
    <div className="rounded-2xl border border-border bg-background/35 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-semibold uppercase tracking-[0.13em] text-muted">Reasoning score</span>
        <span className="font-mono text-[16px] font-semibold" style={{ color: tone }}>{value === null ? "WAITING" : `${normalized}%`}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${value === null ? 42 : Math.max(3, normalized)}%`,
            background: tone,
            boxShadow: `0 0 16px ${tone}`,
          }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[6px] text-muted"><span>0</span><span>25</span><span>50</span><span>65</span><span>100</span></div>
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
  onOpenGameplanScoring,
}: {
  accountKey: string;
  accountLabel: string;
  initialProfileHandle?: string;
  onOpenProfile?: (handle: string) => void;
  onCloseProfile?: () => void;
  onMessageProfile?: (userId: string) => void;
  onOpenGameplanScoring?: () => void;
}) {
  const router = useRouter();
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
  const [, setSaveState] = useState<"loading" | "saved" | "local" | "error">("loading");
  const [tab, setTab] = useState<SocialTab>(initialProfileHandle ? "profile" : "today");
  const [sectionUnread, setSectionUnread] = useState({ feed: 0, desks: 0 });
  const activityLoadingRef = useRef(false);
  const activeTabRef = useRef<SocialTab>(initialProfileHandle ? "profile" : "today");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [socialFeedMode, setSocialFeedMode] = useState<SocialFeedMode>("following");
  const [socialFeedCollection, setSocialFeedCollection] = useState<SocialFeedCollection>("feed");
  const [followingUsers, setFollowingUsers] = useState<SocialFollowListItem[]>([]);
  const [followingState, setFollowingState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [followRecommendations, setFollowRecommendations] = useState<SocialFollowRecommendation[]>([]);
  const [recommendationState, setRecommendationState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const [followActionUserIds, setFollowActionUserIds] = useState<Set<string>>(() => new Set());
  const followRefreshTimerRef = useRef<number | null>(null);
  const [rankingScope, setRankingScope] = useState<RankingScope>("desk");
  const [rankingFriends, setRankingFriends] = useState<FriendSummary[]>([]);
  const [deskNetwork, setDeskNetwork] = useState<DeskNetworkPayload>(EMPTY_DESK_NETWORK);
  const [tradeSendObject, setTradeSendObject] = useState<SocialObject | null>(null);
  const [tradeSendFriends, setTradeSendFriends] = useState<FriendSummary[]>([]);
  const [tradeSendDeskTargets, setTradeSendDeskTargets] = useState<Array<{ deskId: string; deskName: string; channelId: string; channelName: string }>>([]);
  const [tradeSendFriendIds, setTradeSendFriendIds] = useState<string[]>([]);
  const [tradeSendDeskIds, setTradeSendDeskIds] = useState<string[]>([]);
  const [tradeSendQuery, setTradeSendQuery] = useState("");
  const [tradeSendState, setTradeSendState] = useState<"idle" | "loading" | "sending" | "error">("idle");
  const [tradeSendError, setTradeSendError] = useState("");
  const shareRecipientsLoadedRef = useRef(false);
  const shareRecipientsPromiseRef = useRef<Promise<void> | null>(null);
  const [rankingObjects, setRankingObjects] = useState<SocialObject[]>([]);
  const [rankingDeskId, setRankingDeskId] = useState("");
  const [rankingDirectoryState, setRankingDirectoryState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const rankingRefreshPromiseRef = useRef<Promise<void> | null>(null);
  const rankingLastLoadedAtRef = useRef(0);
  const [query, setQuery] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const [showOneLinerModal, setShowOneLinerModal] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [oneLinerPublishing, setOneLinerPublishing] = useState(false);
  const [postImagePreparing, setPostImagePreparing] = useState(false);
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const [showReceiptFor, setShowReceiptFor] = useState<string | null>(null);
  const [showDeskModal, setShowDeskModal] = useState(false);
  const [deskCreating, setDeskCreating] = useState(false);
  const [deskNameCheck, setDeskNameCheck] = useState<DeskNameCheckState>({ state: "idle", message: "" });
  const [zyonGameplanDraft, setZyonGameplanDraft] = useState<ZyonGameplanDraft | null>(null);
  const [zyonDraftState, setZyonDraftState] = useState<"loading" | "ready" | "missing" | "migration">("loading");
  const [zyonDraftLocking, setZyonDraftLocking] = useState(false);
  const [zyonTargetsInput, setZyonTargetsInput] = useState("");
  const [zyonConfluencesInput, setZyonConfluencesInput] = useState("");
  const [assessmentState, setAssessmentState] = useState<"idle" | "reviewing">("idle");
  const [receiptDraft, setReceiptDraft] = useState(EMPTY_RECEIPT);
  const [postDraft, setPostDraft] = useState(EMPTY_POST);
  const [oneLinerDraft, setOneLinerDraft] = useState({ body: "", scope: "community" as SocialScope });
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
  const [requestedProfileState, setRequestedProfileState] = useState<RequestedProfileState>(
    initialProfileHandle ? "loading" : "idle",
  );
  const [requestedProfilePreview, setRequestedProfilePreview] = useState<SocialProfilePreview | null>(
    () => loadSocialProfilePreview(initialProfileHandle),
  );
  const [requestedProfilePostId, setRequestedProfilePostId] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentKinds, setCommentKinds] = useState<Record<string, SocialCommentPayload["kind"]>>({});
  const [commentPanelPostId, setCommentPanelPostId] = useState<string | null>(null);
  const [commentReplyToId, setCommentReplyToId] = useState<string | null>(null);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState("");
  const [commentEditSaving, setCommentEditSaving] = useState(false);
  const [collapsedCommentThreads, setCollapsedCommentThreads] = useState<Set<string>>(() => new Set());
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

  useEffect(() => {
    router.prefetch("/gameplan?tab=scoring");
    void import("@/components/gameplan/GameplanWorkspace");
  }, [router]);

  useEffect(() => {
    activeTabRef.current = tab;
  }, [tab]);

  const markSectionRead = useCallback(async (section: "feed" | "desks") => {
    setSectionUnread((current) => current[section] === 0 ? current : { ...current, [section]: 0 });
    try {
      await fetch("/api/socials/activity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      });
    } catch {
      // The optimistic clear keeps navigation immediate; the next refresh reconciles cloud state.
    }
  }, []);

  const refreshSectionUnread = useCallback(async () => {
    if (activityLoadingRef.current || document.visibilityState !== "visible") return;
    activityLoadingRef.current = true;
    try {
      const response = await fetch("/api/socials/activity", { cache: "no-store" });
      const result = await response.json() as { configured?: boolean; feed?: number; desks?: number };
      if (!response.ok || result.configured === false) return;
      const next = {
        feed: Math.max(0, Number(result.feed) || 0),
        desks: Math.max(0, Number(result.desks) || 0),
      };
      const active = activeTabRef.current;
      if (active === "feed" && next.feed > 0) {
        next.feed = 0;
        void markSectionRead("feed");
      }
      if (active === "desks" && next.desks > 0) {
        next.desks = 0;
        void markSectionRead("desks");
      }
      setSectionUnread(next);
    } catch {
      // Badges are supplemental and must never interrupt Socials navigation.
    } finally {
      activityLoadingRef.current = false;
    }
  }, [markSectionRead]);

  useEffect(() => {
    void refreshSectionUnread();
    const refresh = () => void refreshSectionUnread();
    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("kwantdesk:social-post-created", refresh);
    window.addEventListener(DESK_NETWORK_CHANGED_EVENT, refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("kwantdesk:social-post-created", refresh);
      window.removeEventListener(DESK_NETWORK_CHANGED_EVENT, refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refreshSectionUnread]);

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
    if (!openCommentMenuId) return;
    const closeCommentMenu = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpenCommentMenuId(null);
        return;
      }
      const target = event.target;
      if (target instanceof Element) {
        const menu = target.closest("[data-comment-menu]");
        if (menu?.getAttribute("data-comment-menu") === openCommentMenuId) return;
      }
      setOpenCommentMenuId(null);
    };
    window.addEventListener("pointerdown", closeCommentMenu);
    window.addEventListener("keydown", closeCommentMenu);
    return () => {
      window.removeEventListener("pointerdown", closeCommentMenu);
      window.removeEventListener("keydown", closeCommentMenu);
    };
  }, [openCommentMenuId]);

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
    shareRecipientsLoadedRef.current = false;
    shareRecipientsPromiseRef.current = null;
    setTradeSendFriends([]);
    setTradeSendDeskTargets([]);
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

  const loadFollowingUsers = useCallback(async (quiet = false) => {
    if (!quiet) setFollowingState("loading");
    try {
      const collected: SocialFollowListItem[] = [];
      let offset = 0;
      for (let page = 0; page < 5; page += 1) {
        const response = await fetch(
          `/api/socials/follows?profileUserId=${encodeURIComponent(resolvedAccountKey)}&list=following&offset=${offset}&limit=100`,
          { cache: "no-store" },
        );
        const result = await response.json() as SocialFollowResponse;
        if (!response.ok || !result.list) {
          throw new Error(result.error || "Following could not be loaded.");
        }
        collected.push(...result.list.items);
        if (result.list.nextOffset === null) break;
        offset = result.list.nextOffset;
      }
      setFollowingUsers(collected);
      setFollowingState("ready");
    } catch {
      setFollowingState("unavailable");
    }
  }, [resolvedAccountKey]);

  useEffect(() => {
    if (!ready) return;
    void loadFollowingUsers();
    // A burst of follows should reconcile once after it settles, rather than
    // downloading the complete following list after every individual click.
    const refresh = () => {
      if (followRefreshTimerRef.current !== null) window.clearTimeout(followRefreshTimerRef.current);
      followRefreshTimerRef.current = window.setTimeout(() => {
        followRefreshTimerRef.current = null;
        void loadFollowingUsers(true);
      }, 350);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const channel = "BroadcastChannel" in window
      ? new BroadcastChannel("kwantdesk-social-follows")
      : null;
    window.addEventListener("kwantdesk:social-follow-changed", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    channel?.addEventListener("message", refresh);
    return () => {
      window.removeEventListener("kwantdesk:social-follow-changed", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      channel?.removeEventListener("message", refresh);
      channel?.close();
      if (followRefreshTimerRef.current !== null) window.clearTimeout(followRefreshTimerRef.current);
    };
  }, [loadFollowingUsers, ready]);

  const loadFollowRecommendations = useCallback(async () => {
    setRecommendationState("loading");
    try {
      const response = await fetch("/api/socials/follows?recommendations=1&limit=8", { cache: "no-store" });
      const result = await response.json() as SocialFollowResponse;
      if (!response.ok || !result.recommendations) throw new Error(result.error || "Connections could not be calculated.");
      setFollowRecommendations(result.recommendations);
      setRecommendationState("ready");
    } catch {
      setFollowRecommendations([]);
      setRecommendationState("fallback");
    }
  }, []);

  useEffect(() => {
    if (!ready || tab !== "feed" || recommendationState !== "idle") return;
    void loadFollowRecommendations();
  }, [loadFollowRecommendations, ready, recommendationState, tab]);

  const loadDeskNetwork = useCallback(async (quiet = false) => {
    try {
      const response = await fetch("/api/socials/desks", { cache: "no-store" });
      const result = await response.json() as DeskNetworkPayload & { error?: string };
      if (!response.ok || !result.ready) throw new Error(result.error || "Desks could not be loaded.");
      setDeskNetwork(result);
      const membershipDeskIds = new Set(
        result.members
          .filter((member) => member.userId === resolvedAccountKey)
          .map((member) => member.deskId),
      );
      const availableDeskIds = result.workspaces
        .filter((workspace) => !workspace.archivedAt && (workspace.ownerId === resolvedAccountKey || membershipDeskIds.has(workspace.deskId)))
        .map((workspace) => workspace.deskId);
      const savedDeskId = window.localStorage.getItem("kwantdesk-active-desk") ?? "";
      setRankingDeskId((current) => availableDeskIds.includes(current)
        ? current
        : availableDeskIds.includes(savedDeskId)
          ? savedDeskId
          : availableDeskIds[0] ?? "");
      return true;
    } catch {
      if (!quiet) {
        setDeskNetwork(EMPTY_DESK_NETWORK);
        setRankingDeskId("");
      }
      return false;
    }
  }, [resolvedAccountKey]);

  useEffect(() => {
    if (!ready) return;
    void loadDeskNetwork();
    const refresh = () => void loadDeskNetwork(true);
    const refreshVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener(DESK_CREATED_EVENT, refresh);
    window.addEventListener(DESK_NETWORK_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.removeEventListener(DESK_CREATED_EVENT, refresh);
      window.removeEventListener(DESK_NETWORK_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [loadDeskNetwork, ready]);

  const loadRankingDirectory = useCallback(async (quiet = false) => {
    if (rankingRefreshPromiseRef.current) return rankingRefreshPromiseRef.current;
    if (quiet && Date.now() - rankingLastLoadedAtRef.current < 1_500) return;
    if (!quiet) setRankingDirectoryState("loading");

    const refresh = (async () => {
      const [friendsLoaded, desksLoaded, evidenceLoaded] = await Promise.all([
        (async () => {
          try {
            const response = await fetch("/api/friends", { cache: "no-store" });
            const result = await response.json() as FriendsPayload & { error?: string };
            if (!response.ok || !result.cloud) throw new Error(result.error || "Friends could not be loaded.");
            setRankingFriends(result.friends ?? []);
            return true;
          } catch {
            if (!quiet) setRankingFriends([]);
            return false;
          }
        })(),
        loadDeskNetwork(quiet),
        (async () => {
          try {
            const response = await fetch("/api/socials?types=profile,precord,receipt,comment,progress", { cache: "no-store" });
            const result = await response.json() as { objects?: SocialObject[]; cloud?: boolean; error?: string };
            if (!response.ok || !result.cloud) throw new Error(result.error || "Reputation evidence could not be loaded.");
            setRankingObjects(result.objects ?? []);
            return true;
          } catch {
            if (!quiet) setRankingObjects([]);
            return false;
          }
        })(),
      ]);
      const loadedSource = friendsLoaded || desksLoaded || evidenceLoaded;
      if (loadedSource) rankingLastLoadedAtRef.current = Date.now();
      setRankingDirectoryState(loadedSource ? "ready" : "unavailable");
    })().finally(() => {
      rankingRefreshPromiseRef.current = null;
    });

    rankingRefreshPromiseRef.current = refresh;
    return refresh;
  }, [loadDeskNetwork]);

  useEffect(() => {
    if (!ready || tab !== "rankings") return;
    void loadRankingDirectory();
    const refresh = () => void loadRankingDirectory(true);
    const refreshVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(refresh, 7_500);
    window.addEventListener("focus", refresh);
    window.addEventListener(DESK_CREATED_EVENT, refresh);
    window.addEventListener(DESK_NETWORK_CHANGED_EVENT, refresh);
    window.addEventListener("kwantdesk:social-follow-changed", refresh);
    document.addEventListener("visibilitychange", refreshVisible);
    const followChannel = "BroadcastChannel" in window
      ? new BroadcastChannel("kwantdesk-social-follows")
      : null;
    followChannel?.addEventListener("message", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DESK_CREATED_EVENT, refresh);
      window.removeEventListener(DESK_NETWORK_CHANGED_EVENT, refresh);
      window.removeEventListener("kwantdesk:social-follow-changed", refresh);
      document.removeEventListener("visibilitychange", refreshVisible);
      followChannel?.removeEventListener("message", refresh);
      followChannel?.close();
    };
  }, [loadRankingDirectory, ready, tab]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      void saveSocialState(resolvedAccountKey, state);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [ready, resolvedAccountKey, state]);

  useEffect(() => {
    const receiveStreak = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (!detail) return;
      const currentStreak = Math.max(0, Math.floor(Number(detail.currentStreak) || 0));
      const longestStreak = Math.max(currentStreak, Math.floor(Number(detail.longestStreak) || 0));
      const lastActivityDate = typeof detail.lastActivityDate === "string" ? detail.lastActivityDate : "";
      const lastSeenAt = typeof detail.lastSeenAt === "string" ? detail.lastSeenAt : new Date().toISOString();
      setState((current) => ({
        ...current,
        objects: current.objects.map((object) => object.objectType === "profile" && object.userId === resolvedAccountKey
          ? {
              ...object,
              payload: {
                ...(object.payload as Record<string, unknown>),
                activityStreak: currentStreak,
                longestActivityStreak: longestStreak,
                lastActivityDate,
                lastSeenAt,
              },
              updatedAt: lastSeenAt,
            }
          : object),
      }));
    };
    window.addEventListener("kwantdesk:activity-streak-changed", receiveStreak);
    return () => window.removeEventListener("kwantdesk:activity-streak-changed", receiveStreak);
  }, [resolvedAccountKey]);

  const profiles = useMemo(() => state.objects.filter((object) => object.objectType === "profile"), [state.objects]);
  const posts = useMemo(() => state.objects.filter((object) => object.objectType === "post").sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)), [state.objects]);
  const precords = useMemo(() => state.objects.filter((object) => object.objectType === "precord").sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)), [state.objects]);
  const receipts = useMemo(() => state.objects.filter((object) => object.objectType === "receipt"), [state.objects]);
  const myReasoningRecords = useMemo(
    () => precords.filter((object) => object.userId === resolvedAccountKey),
    [precords, resolvedAccountKey],
  );
  const myReasoningScore = useMemo(
    () => reasoningScoreFromReceipts(receipts, resolvedAccountKey),
    [receipts, resolvedAccountKey],
  );
  const desks = useMemo(() => state.objects.filter((object) => object.objectType === "desk"), [state.objects]);
  const memberships = useMemo(() => state.objects.filter((object) => object.objectType === "desk-member"), [state.objects]);
  const comments = useMemo(() => state.objects.filter((object) => object.objectType === "comment"), [state.objects]);
  const reactions = useMemo(() => state.objects.filter((object) => object.objectType === "reaction"), [state.objects]);
  const commentPanelPost = useMemo(
    () => posts.find((post) => post.id === commentPanelPostId) ?? null,
    [commentPanelPostId, posts],
  );
  const commentPanelComments = useMemo(() => {
    if (!commentPanelPost) return [];
    const pinnedId = typedPayload<SocialPostPayload>(commentPanelPost)?.pinnedCommentId;
    return comments
      .filter((comment) => comment.parentId === commentPanelPost.id)
      .sort((left, right) => {
        if (left.id === pinnedId) return -1;
        if (right.id === pinnedId) return 1;
        return Date.parse(left.createdAt) - Date.parse(right.createdAt);
      });
  }, [commentPanelPost, comments]);
  const cards = useMemo(() => state.objects.filter((object) => object.objectType === "card"), [state.objects]);
  const earnedCardCodes = useMemo(() => new Set([
    "origin-signal",
    ...cards
      .filter((card) => card.userId === resolvedAccountKey)
      .map((card) => typedPayload<SocialCardPayload>(card)?.code)
      .filter((code): code is string => Boolean(code)),
  ]), [cards, resolvedAccountKey]);
  const consensus = useMemo(() => state.objects.filter((object) => object.objectType === "consensus"), [state.objects]);
  const profileByUserId = useMemo(() => new Map(
    profiles.map((profile) => [
      profile.userId,
      normalizeSocialProfile(profile.payload, profile.authorLabel),
    ]),
  ), [profiles]);
  const currentProfileObject = profiles.find((object) => object.userId === resolvedAccountKey);
  const currentProfile = normalizeSocialProfile(currentProfileObject?.payload, resolvedLabel);
  const equippedCallingCard = CALLING_CARD_CATALOG.find((definition) => definition.code === currentProfile.callingCardCode)
    ?? CALLING_CARD_CATALOG.find((definition) => definition.starter)
    ?? CALLING_CARD_CATALOG[0];
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
        && receipts.some((receipt) => receipt.parentId === object.id)
        && ["GAMEPLAN", "ZYON"].includes(typedPayload<SocialPrecordPayload>(object)?.source ?? ""))
    : [];
  const profileCollectionContent = [...posts, ...precords.filter((record) =>
    receipts.some((receipt) => receipt.parentId === record.id))];
  const viewedProfilePosts = viewedProfileObject
    ? posts.filter((post) => post.userId === viewedProfileObject.userId && !typedPayload<SocialPostPayload>(post)?.isRepost)
    : [];
  const viewedProfileReposts = viewedProfileObject
    ? posts.filter((post) => post.userId === viewedProfileObject.userId && typedPayload<SocialPostPayload>(post)?.isRepost)
    : [];
  const viewedReactionCollection = (kind: "LIKE" | "SAVED") => {
    if (!viewedProfileObject) return [];
    const targetIds = new Set(reactions
      .filter((reaction) => reaction.userId === viewedProfileObject.userId && typedPayload<SocialReactionPayload>(reaction)?.kind === kind)
      .map((reaction) => reaction.parentId)
      .filter((id): id is string => Boolean(id)));
    return profileCollectionContent.filter((object) => targetIds.has(object.id));
  };
  const viewedProfileLiked = viewedReactionCollection("LIKE");
  const viewedProfileSaved = viewedReactionCollection("SAVED");
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
  const currentMemberships = memberships.filter((object) => object.userId === resolvedAccountKey);
  const currentDeskIds = new Set(currentMemberships.map((object) => object.deskId).filter(Boolean));
  const myDesks = desks.filter((object) => currentDeskIds.has(object.id) || object.userId === resolvedAccountKey);
  const availableDesks = desks.filter((object) => !currentDeskIds.has(object.id) && object.userId !== resolvedAccountKey);
  const liveDeskMembershipIds = new Set(
    deskNetwork.members
      .filter((member) => member.userId === resolvedAccountKey)
      .map((member) => member.deskId),
  );
  const myLiveDesks = deskNetwork.workspaces.filter((workspace) =>
    !workspace.archivedAt
    && (workspace.ownerId === resolvedAccountKey || liveDeskMembershipIds.has(workspace.deskId)));
  const todayConsensus = consensus.find((object) =>
    object.userId === resolvedAccountKey
    && typedPayload<SocialConsensusPayload>(object)?.sessionDate === todayKey());

  useEffect(() => {
    if (!initialProfileHandle || typeof window === "undefined") {
      setRequestedProfilePostId("");
      return;
    }
    setRequestedProfilePostId(new URLSearchParams(window.location.search).get("post")?.trim() ?? "");
  }, [initialProfileHandle]);

  const closeTradeSend = () => {
    if (tradeSendState === "sending") return;
    setTradeSendObject(null);
    setTradeSendFriendIds([]);
    setTradeSendDeskIds([]);
    setTradeSendQuery("");
    setTradeSendError("");
    setTradeSendState("idle");
  };

  const loadShareRecipients = useCallback((showLoading = false) => {
    if (shareRecipientsLoadedRef.current) return Promise.resolve();
    if (showLoading) setTradeSendState("loading");
    if (shareRecipientsPromiseRef.current) return shareRecipientsPromiseRef.current;

    const request = (async () => {
      try {
        const friendsRequest = fetch("/api/friends", { cache: "no-store" });
        const desksRequest = fetch("/api/socials/desks", { cache: "no-store" });

        const friendsResponse = await friendsRequest;
        const friendsBody = await friendsResponse.json() as FriendsPayload & { error?: string };
        if (!friendsResponse.ok || !friendsBody.cloud) {
          throw new Error(friendsBody.error || "Friends could not be loaded.");
        }
        setTradeSendFriends(friendsBody.friends ?? []);
        shareRecipientsLoadedRef.current = true;
        // Friends are the common target. Reveal them before resolving every
        // Desk channel instead of keeping the whole picker behind a loader.
        setTradeSendState("idle");

        try {
          const desksResponse = await desksRequest;
          const desksBody = await desksResponse.json() as DeskNetworkPayload & { error?: string };
          if (desksResponse.ok && desksBody.ready) {
            setDeskNetwork(desksBody);
            const membershipIds = new Set(desksBody.members.filter((member) => member.userId === resolvedAccountKey).map((member) => member.deskId));
            const available = desksBody.workspaces.filter((workspace) => !workspace.archivedAt && (workspace.ownerId === resolvedAccountKey || membershipIds.has(workspace.deskId)));
            const targetResults = await Promise.all(available.map(async (workspace) => {
              try {
                const response = await fetch(`/api/socials/desks?deskId=${encodeURIComponent(workspace.deskId)}`, { cache: "no-store" });
                const detail = await response.json() as DeskNetworkPayload & { error?: string };
                if (!response.ok || !detail.ready) return null;
                const role = detail.members.find((member) => member.deskId === workspace.deskId && member.userId === resolvedAccountKey)?.role ?? "member";
                const canLead = workspace.ownerId === resolvedAccountKey || role === "owner" || role === "moderator";
                const channel = [...detail.channels]
                  .filter((candidate) => candidate.deskId === workspace.deskId && candidate.channelType === "text")
                  .filter((candidate) => canLead || (!candidate.readOnly && !candidate.reactionOnly))
                  .sort((left, right) => left.position - right.position)[0];
                return channel ? {
                  deskId: workspace.deskId,
                  deskName: workspace.name,
                  channelId: channel.id,
                  channelName: channel.name,
                } : null;
              } catch {
                return null;
              }
            }));
            setTradeSendDeskTargets(targetResults.filter((target): target is NonNullable<typeof target> => Boolean(target)));
          }
        } catch {
          // Friends remain immediately usable even if Desk discovery is down.
        }
        shareRecipientsLoadedRef.current = true;
      } catch (reason) {
        setTradeSendError(reason instanceof Error ? reason.message : "Recipients could not be loaded.");
        setTradeSendState("error");
      } finally {
        shareRecipientsPromiseRef.current = null;
      }
    })();
    shareRecipientsPromiseRef.current = request;
    return request;
  }, [resolvedAccountKey]);

  const openTradeSend = (object: SocialObject) => {
    const payload = typedPayload<SocialPostPayload>(object);
    const canSend = (payload?.kind === "TRADE" && payload.trade) || payload?.kind === "ONE-LINER";
    if (!canSend) return;
    setTradeSendObject(object);
    setTradeSendFriendIds([]);
    setTradeSendDeskIds([]);
    setTradeSendQuery("");
    setTradeSendError("");
    setTradeSendState(shareRecipientsLoadedRef.current ? "idle" : "loading");
    void loadShareRecipients(true);
  };

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => void loadShareRecipients(false), 250);
    return () => window.clearTimeout(timer);
  }, [loadShareRecipients, ready]);

  const sendTradeToRecipients = async () => {
    const postPayload = typedPayload<SocialPostPayload>(tradeSendObject);
    if (!tradeSendObject || !postPayload) return;
    const isTrade = postPayload.kind === "TRADE" && Boolean(postPayload.trade);
    const isOneLiner = postPayload.kind === "ONE-LINER";
    if (!isTrade && !isOneLiner) return;
    if (!tradeSendFriendIds.length && !tradeSendDeskIds.length) {
      setTradeSendError("Choose at least one friend or Desk.");
      return;
    }
    const ownerUserId = postPayload.repostOfUserId || tradeSendObject.userId;
    const ownerPostId = postPayload.repostOfPostId || tradeSendObject.id;
    const ownerProfileObject = profiles.find((candidate) => candidate.userId === ownerUserId);
    const ownerProfile = ownerProfileObject
      ? normalizeSocialProfile(ownerProfileObject.payload, ownerProfileObject.authorLabel)
      : normalizeSocialProfile({}, tradeSendObject.authorLabel);
    const sharedTrade = isTrade ? normalizeSharedTradeMessage({
      kind: "trade-share",
      version: 1,
      postId: ownerPostId,
      ownerUserId,
      ownerHandle: ownerProfile.handle,
      ownerDisplayName: ownerProfile.displayName,
      trade: postPayload.trade!,
    }) : null;
    if (isTrade && !sharedTrade) {
      setTradeSendError("This trade could not be prepared for messaging.");
      return;
    }
    const sharedBody = isOneLiner
      ? `${postPayload.body}\n\n${window.location.origin}/socials/${encodeURIComponent(ownerProfile.handle)}?post=${encodeURIComponent(ownerPostId)}`
      : "";

    setTradeSendState("sending");
    setTradeSendError("");
    const friendRequests = tradeSendFriendIds.map(async (targetUserId) => {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          targetUserId,
          body: sharedBody,
          sharedTrade: sharedTrade ?? undefined,
          clientMessageId: crypto.randomUUID(),
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "A friend message could not be sent.");
    });
    const deskRequests = tradeSendDeskIds.map(async (deskId) => {
      const target = tradeSendDeskTargets.find((candidate) => candidate.deskId === deskId);
      if (!target) throw new Error("A selected Desk no longer has an available text channel.");
      const response = await fetch("/api/socials/desks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send-message",
          deskId: target.deskId,
          channelId: target.channelId,
          message: sharedBody,
          sharedTrade: sharedTrade ?? undefined,
          clientMessageId: crypto.randomUUID(),
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || `The trade could not be sent to ${target.deskName}.`);
    });
    const results = await Promise.allSettled([...friendRequests, ...deskRequests]);
    const sentCount = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (!sentCount) {
      setTradeSendState("error");
      setTradeSendError(failed[0]?.reason instanceof Error ? failed[0].reason.message : "The trade could not be sent.");
      return;
    }
    setTradeSendObject(null);
    setTradeSendState("idle");
    setNotice(`${isOneLiner ? "One-liner" : "Trade"} sent to ${sentCount} ${sentCount === 1 ? "conversation" : "conversations"}${failed.length ? ` · ${failed.length} could not be reached` : ""}.`);
    window.dispatchEvent(new CustomEvent(DESK_NETWORK_CHANGED_EVENT));
  };

  useEffect(() => {
    setProfileDraft(currentProfile);
  }, [currentProfileObject?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || cards.some((card) => card.userId === resolvedAccountKey && typedPayload<SocialCardPayload>(card)?.code === "origin-signal")) return;
    const definition = CALLING_CARD_CATALOG.find((card) => card.code === "origin-signal");
    if (!definition) return;
    void saveObject(buildLocalObject({
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
        earnedAt: new Date().toISOString(),
        active: true,
        equipped: true,
        public: true,
      } satisfies SocialCardPayload,
    }));
  }, [cards, currentProfile.displayName, ready, resolvedAccountKey, saveObject]);

  useEffect(() => {
    if (profileEditing) setProfileSaveState("idle");
  }, [profileEditing]);

  useEffect(() => {
    if (!showDeskModal) {
      setDeskNameCheck({ state: "idle", message: "" });
      return;
    }
    const name = deskDraft.name.trim().replace(/\s+/g, " ");
    if (name.length < 3) {
      setDeskNameCheck({
        state: name.length ? "invalid" : "idle",
        message: name.length ? "Use at least 3 characters." : "Desk names are unique across Kwant Desk.",
      });
      return;
    }
    const controller = new AbortController();
    setDeskNameCheck({ state: "checking", message: "Checking Desk name..." });
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/socials/desks?nameAvailable=${encodeURIComponent(name)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as { available?: boolean; reason?: string; error?: string };
        if (!response.ok) throw new Error(payload.error || "Desk name could not be checked.");
        setDeskNameCheck(payload.available
          ? { state: "available", message: "Desk name is available." }
          : { state: "taken", message: payload.reason || "This Desk already exists." });
      } catch (reason) {
        if (controller.signal.aborted) return;
        setDeskNameCheck({
          state: "error",
          message: reason instanceof Error ? reason.message : "Desk name could not be checked.",
        });
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [deskDraft.name, showDeskModal]);

  useEffect(() => {
    if (!initialProfileHandle) return;
    setTab("profile");
    setProfileEditing(false);
    setSelectedProfileRecord(null);
  }, [initialProfileHandle]);

  useEffect(() => {
    if (!requestedProfileHandle) {
      setRequestedProfileState("idle");
      setRequestedProfilePreview(null);
      return;
    }

    let active = true;
    const controller = new AbortController();
    setRequestedProfilePreview(loadSocialProfilePreview(requestedProfileHandle));
    setRequestedProfileState("loading");
    void (async () => {
      try {
        const response = await fetch(
          `/api/socials?profileHandle=${encodeURIComponent(requestedProfileHandle)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = await response.json() as {
          objects?: SocialObject[];
          cloud?: boolean;
          profileFound?: boolean;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "This profile could not be loaded.");
        if (!payload.cloud) throw new Error("Account storage is unavailable.");
        if (payload.profileFound === false) {
          if (active) setRequestedProfileState("missing");
          return;
        }
        if (!payload.profileFound || !Array.isArray(payload.objects)) {
          throw new Error("This profile could not be loaded.");
        }
        const incomingObjects = payload.objects.map((object) => ({ ...object, cloudSaved: true }));
        const incomingKeys = new Set(incomingObjects.map(objectKey));
        if (!active) return;
        setState((current) => ({
          ...current,
          cloud: true,
          objects: [
            ...incomingObjects,
            ...current.objects.filter((object) => !incomingKeys.has(objectKey(object))),
          ].slice(0, 5_000),
        }));
        setRequestedProfileState("ready");
      } catch (reason) {
        if (!active || (reason instanceof DOMException && reason.name === "AbortError")) return;
        setRequestedProfileState("error");
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [requestedProfileHandle]);

  useEffect(() => {
    let active = true;
    let requestNumber = 0;
    const loadDraft = async (showLoading = false) => {
      const currentRequest = ++requestNumber;
      if (showLoading) setZyonDraftState("loading");
      try {
        const response = await fetch(`/api/zyon/gameplan-draft?localDate=${todayKey()}`, {
          cache: "no-store",
        });
        const payload = await response.json() as {
          draft?: ZyonGameplanDraft | null;
          migrationRequired?: boolean;
        };
        if (!active || currentRequest !== requestNumber) return;
        if (payload.migrationRequired) {
          setZyonGameplanDraft(null);
          setZyonTargetsInput("");
          setZyonConfluencesInput("");
          setZyonDraftState("migration");
          return;
        }
        setZyonGameplanDraft(payload.draft ?? null);
        setZyonTargetsInput(payload.draft?.targets.join(", ") ?? "");
        setZyonConfluencesInput(payload.draft?.confluences.join("\n") ?? "");
        setZyonDraftState(payload.draft ? "ready" : "missing");
      } catch (error) {
        if (!active || currentRequest !== requestNumber) return;
        setZyonGameplanDraft(null);
        setZyonTargetsInput("");
        setZyonConfluencesInput("");
        setZyonDraftState("missing");
      }
    };
    const refreshDraft = () => void loadDraft(false);
    const refreshVisibleDraft = () => {
      if (document.visibilityState === "visible") refreshDraft();
    };
    void loadDraft(true);
    window.addEventListener("kwantdesk:zyon-gameplan-sent", refreshDraft);
    window.addEventListener("kwantdesk:zyon-gameplan-draft-updated", refreshDraft);
    window.addEventListener("focus", refreshDraft);
    document.addEventListener("visibilitychange", refreshVisibleDraft);
    return () => {
      active = false;
      window.removeEventListener("kwantdesk:zyon-gameplan-sent", refreshDraft);
      window.removeEventListener("kwantdesk:zyon-gameplan-draft-updated", refreshDraft);
      window.removeEventListener("focus", refreshDraft);
      document.removeEventListener("visibilitychange", refreshVisibleDraft);
    };
  }, []);

  const currentGameplanId = zyonGameplanDraft?.id ?? "";
  const lockedCurrentGameplan = precords.find((object) => {
    if (object.userId !== resolvedAccountKey) return false;
    const payload = typedPayload<SocialPrecordPayload>(object);
    return Boolean(payload && payload.sourceGameplanId === currentGameplanId);
  });
  const latestGameplanRecord = myReasoningRecords.find((object) => {
    const payload = typedPayload<SocialPrecordPayload>(object);
    return payload?.source === "ZYON" || payload?.source === "GAMEPLAN";
  }) ?? null;
  const gameplanProcessRecord = lockedCurrentGameplan ?? latestGameplanRecord;
  const gameplanProcessPlan = typedPayload<SocialPrecordPayload>(gameplanProcessRecord);
  const gameplanProcessReceiptObject = gameplanProcessRecord
    ? receipts.find((receipt) => receipt.parentId === gameplanProcessRecord.id) ?? null
    : null;
  const gameplanProcessReceipt = typedPayload<SocialReceiptPayload>(gameplanProcessReceiptObject);
  const gameplanProcessIndex = zyonGameplanDraft
    ? 1
    : gameplanProcessRecord
      ? gameplanProcessReceipt ? 3 : 2
      : 0;
  const gameplanProcessPercent = gameplanProcessIndex === 3 ? 100 : Math.round(gameplanProcessIndex / 3 * 100);
  const gameplanProcessLabel = zyonGameplanDraft?.title
    ?? (typeof gameplanProcessPlan?.gameplanSnapshot?.title === "string" ? gameplanProcessPlan.gameplanSnapshot.title : "")
    ?? "";
  const gameplanProcessTimestamp = zyonGameplanDraft?.updatedAt
    ?? gameplanProcessReceipt?.addedAt
    ?? gameplanProcessPlan?.lockedAt
    ?? "";

  const visiblePrecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return precords.filter((object) => {
      const payload = typedPayload<SocialPrecordPayload>(object);
      if (!payload) return false;
      const receipt = receipts.find((candidate) => candidate.parentId === object.id);
      if (!receipt) return false;
      if (feedFilter === "mine" && object.userId !== resolvedAccountKey) return false;
      if (feedFilter === "proven" && !receipt) return false;
      if (normalizedQuery && ![
        payload.instrument,
        payload.marketContext,
        payload.confirmation,
        payload.invalidation,
        payload.traderNotes ?? "",
        object.authorLabel,
      ].some((value) => value.toLowerCase().includes(normalizedQuery))) return false;
      return true;
    });
  }, [feedFilter, precords, query, receipts, resolvedAccountKey]);

  const followingUserIds = useMemo(
    () => new Set(followingUsers.map((item) => item.userId)),
    [followingUsers],
  );
  const socialFeedObjects = useMemo(() => {
    const completedGameplans = precords.filter((record) =>
      receipts.some((receipt) => receipt.parentId === record.id));
    const availableObjects = [...posts, ...completedGameplans];
    if (socialFeedCollection === "posts") {
      return availableObjects
        .filter((object) => object.userId === resolvedAccountKey && (object.objectType !== "post" || !typedPayload<SocialPostPayload>(object)?.isRepost))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    }
    if (socialFeedCollection === "reposts") {
      return posts
        .filter((post) => post.userId === resolvedAccountKey && typedPayload<SocialPostPayload>(post)?.isRepost)
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    }
    if (socialFeedCollection === "liked" || socialFeedCollection === "saved") {
      const reactionKind = socialFeedCollection === "liked" ? "LIKE" : "SAVED";
      const selectedIds = new Set(reactions
        .filter((reaction) => reaction.userId === resolvedAccountKey && typedPayload<SocialReactionPayload>(reaction)?.kind === reactionKind)
        .map((reaction) => reaction.parentId)
        .filter((id): id is string => Boolean(id)));
      return availableObjects
        .filter((object) => selectedIds.has(object.id))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    }
    return availableObjects
      .filter((object) => {
        if (object.scope === "private" && object.userId !== resolvedAccountKey) return false;
        if (socialFeedMode === "following") {
          return object.userId === resolvedAccountKey || followingUserIds.has(object.userId);
        }
        if (socialFeedMode === "recommended") {
          return object.scope === "community"
            && object.userId !== resolvedAccountKey
            && !followingUserIds.has(object.userId);
        }
        return true;
      })
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }, [followingUserIds, posts, precords, reactions, receipts, resolvedAccountKey, socialFeedCollection, socialFeedMode]);
  const suggestedProfiles = useMemo<SocialFollowRecommendation[]>(() => {
    if (recommendationState === "idle" || recommendationState === "loading") return [];
    if (followRecommendations.length) return followRecommendations.slice(0, 5);
    const ownDeskIds = new Set(deskNetwork.members
      .filter((member) => member.userId === resolvedAccountKey)
      .map((member) => member.deskId));
    const friendIds = new Set(rankingFriends.map((friend) => friend.userId));
    const ownMarkets = new Set(currentProfile.markets.map((market) => market.toUpperCase()));
    return profiles
      .filter((object) => object.userId !== resolvedAccountKey && !followingUserIds.has(object.userId))
      .map((object) => {
        const profile = normalizeSocialProfile(object.payload, object.authorLabel);
        const marketOverlapCount = profile.markets.filter((market) => ownMarkets.has(market.toUpperCase())).length;
        const sharedDeskCount = new Set(deskNetwork.members
          .filter((member) => member.userId === object.userId && ownDeskIds.has(member.deskId))
          .map((member) => member.deskId)).size;
        const friend = friendIds.has(object.userId);
        return {
          userId: object.userId,
          displayName: profile.displayName,
          handle: profile.handle,
          avatarUrl: profile.avatarUrl ?? "",
          bio: profile.bio,
          mutualFollowCount: 0,
          sharedDeskCount,
          marketOverlapCount,
          recentlyViewedAt: null,
          followsViewer: false,
          viewerFollows: false,
          relevanceScore: sharedDeskCount * 30 + marketOverlapCount * 14 + (friend ? 24 : 0) + profileScoreAverage(profile) / 10,
          reason: sharedDeskCount
            ? "Trades in your Desk network"
            : friend
              ? "A friend active on Socials"
              : marketOverlapCount ? "Shared markets and trading focus" : "Active in the Kwant Desk network",
        } satisfies SocialFollowRecommendation;
      })
      .sort((left, right) => right.relevanceScore - left.relevanceScore)
      .slice(0, 5);
  }, [currentProfile.markets, deskNetwork.members, followRecommendations, followingUserIds, profiles, rankingFriends, recommendationState, resolvedAccountKey]);

  const rankingDeskOptions = useMemo(() => {
    const memberDeskIds = new Set(
      deskNetwork.members
        .filter((member) => member.userId === resolvedAccountKey)
        .map((member) => member.deskId),
    );
    return deskNetwork.workspaces.filter((workspace) =>
      !workspace.archivedAt
      && (workspace.ownerId === resolvedAccountKey || memberDeskIds.has(workspace.deskId)));
  }, [deskNetwork.members, deskNetwork.workspaces, resolvedAccountKey]);
  const rankingSourceObjects = useMemo(() => {
    const byObjectId = new Map<string, SocialObject>();
    for (const object of [...rankingObjects, ...state.objects]) {
      const current = byObjectId.get(object.id);
      if (!current || Date.parse(object.updatedAt) >= Date.parse(current.updatedAt)) {
        byObjectId.set(object.id, object);
      }
    }
    return [...byObjectId.values()];
  }, [rankingObjects, state.objects]);
  const rankingProfiles = useMemo(() => {
    const byUserId = new Map<string, SocialProfilePayload>();
    for (const object of rankingSourceObjects.filter((item) => item.objectType === "profile")) {
      byUserId.set(object.userId, normalizeSocialProfile(object.payload, object.authorLabel));
    }
    for (const friend of rankingFriends) {
      if (byUserId.has(friend.userId)) continue;
      byUserId.set(friend.userId, normalizeSocialProfile({
        ...buildDefaultProfile(friend.displayName),
        displayName: friend.displayName,
        handle: friend.handle,
        avatarUrl: friend.avatarUrl,
        presenceStatus: friend.presenceStatus,
        lastSeenAt: friend.lastSeenAt ?? "",
        activityStreak: friend.activityStreak,
        longestActivityStreak: friend.longestActivityStreak,
        lastActivityDate: friend.lastActivityDate,
      }, friend.displayName));
    }
    for (const memberProfile of deskNetwork.profiles) {
      if (byUserId.has(memberProfile.userId)) continue;
      byUserId.set(memberProfile.userId, normalizeSocialProfile({
        ...buildDefaultProfile(memberProfile.displayName),
        displayName: memberProfile.displayName,
        handle: memberProfile.handle,
        avatarUrl: memberProfile.avatarUrl,
        presenceStatus: memberProfile.presenceStatus,
        lastSeenAt: memberProfile.lastSeenAt ?? "",
        activityStreak: memberProfile.activityStreak,
        longestActivityStreak: memberProfile.longestActivityStreak,
        lastActivityDate: memberProfile.lastActivityDate,
      }, memberProfile.displayName));
    }
    return [...byUserId.entries()].map(([userId, profile]) => ({ userId, profile }));
  }, [deskNetwork.profiles, rankingFriends, rankingSourceObjects]);
  const allSeasonRankings = useMemo(() => rankingProfiles
    .map(({ userId, profile }) => ({
      userId,
      profile,
      reputation: calculateProcessReputation(userId, rankingSourceObjects, profile),
    }))
    .sort(compareProcessReputation), [rankingProfiles, rankingSourceObjects]);
  const rankedProfiles = useMemo(() => {
    if (rankingScope === "friends") {
      const friendIds = new Set(rankingFriends.map((friend) => friend.userId));
      return allSeasonRankings.filter((entry) => friendIds.has(entry.userId));
    }
    if (rankingScope === "desk") {
      if (!rankingDeskId) return [];
      const memberIds = new Set(
        deskNetwork.members
          .filter((member) => member.deskId === rankingDeskId)
          .map((member) => member.userId),
      );
      const desk = deskNetwork.workspaces.find((workspace) => workspace.deskId === rankingDeskId);
      if (desk?.ownerId) memberIds.add(desk.ownerId);
      return allSeasonRankings.filter((entry) => memberIds.has(entry.userId));
    }
    return allSeasonRankings;
  }, [allSeasonRankings, deskNetwork.members, deskNetwork.workspaces, rankingDeskId, rankingFriends, rankingScope]);
  const rankingSeason = useMemo(() => processReputationSeason(), []);

  const notificationItems = useMemo(() => {
    const mine = new Set(precords.filter((object) => object.userId === resolvedAccountKey).map((object) => object.id));
    const openReceipts = precords.filter((object) => object.userId === resolvedAccountKey && !receipts.some((receipt) => receipt.parentId === object.id));
    const reviewComments = comments.filter((comment) => comment.parentId && mine.has(comment.parentId) && comment.userId !== resolvedAccountKey);
    return [
      ...openReceipts.slice(0, 2).map((precord) => ({
        id: `receipt:${precord.id}`,
        title: `${typedPayload<SocialPrecordPayload>(precord)?.instrument ?? "Plan"} is waiting for trade info`,
        detail: "Open Game Plan → Scoring to timestamp the real entry and outcome.",
      })),
      ...reviewComments.slice(0, 2).map((comment) => ({
        id: comment.id,
        title: `${comment.authorLabel} reviewed your record`,
        detail: typedPayload<SocialCommentPayload>(comment)?.body ?? "",
      })),
      ...(myLiveDesks.length ? [{ id: "desk-mission", title: "Your Desk mission is active", detail: "One completed review moves the shared standard forward." }] : []),
    ];
  }, [comments, myLiveDesks.length, precords, receipts, resolvedAccountKey]);

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
      scope: currentProfile.visibility.saves,
      payload,
    }));
  };

  const lockCurrentGameplan = async () => {
    if (!zyonGameplanDraft) {
      setNotice("Send a Gameplan from ZYON before locking it into Scoring.");
      return;
    }
    if (lockedCurrentGameplan) {
      setNotice("This Gameplan is already locked in Scoring and waiting for trade information.");
      return;
    }
    const missing = zyonGameplanMissingFields(zyonGameplanDraft);
    if (missing.length) {
      setNotice(`Complete the holding Gameplan before locking it: ${missing.join(", ")}.`);
      return;
    }

    const draft = {
      ...zyonGameplanDraft,
      entryLow: Math.min(zyonGameplanDraft.entryLow, zyonGameplanDraft.entryHigh),
      entryHigh: Math.max(zyonGameplanDraft.entryLow, zyonGameplanDraft.entryHigh),
    };
    const optimisticRecord = buildGameplanScoringRecord(draft, {
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
    });

    setZyonDraftLocking(true);
    setNotice("");
    writePendingScoringTransition({ record: optimisticRecord, state: "saving" });
    window.localStorage.setItem("kwantdesk:gameplan-page-tab", "scoring");
    onOpenGameplanScoring?.();

    try {
      const draftResponse = await fetch("/api/zyon/gameplan-draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const draftPayload = await draftResponse.json().catch(() => null) as { error?: string; recordMode?: "LIVE" | "HISTORICAL" } | null;
      if (!draftResponse.ok) throw new Error(draftPayload?.error || "The edited holding Gameplan could not be saved.");

      const recordMode = draftPayload?.recordMode ?? draft.recordMode ?? "LIVE";
      const record = buildGameplanScoringRecord(draft, {
        id: optimisticRecord.id,
        userId: resolvedAccountKey,
        authorLabel: currentProfile.displayName,
        recordMode,
        createdAt: optimisticRecord.createdAt,
      });
      const savedRecord = await persistGameplanScoringRecord(record);

      writePendingScoringTransition({
        record: savedRecord as SocialObject<SocialPrecordPayload>,
        state: "saved",
      });
      window.dispatchEvent(new CustomEvent("kwantdesk:gameplan-locked", {
        detail: { recordId: savedRecord.id, object: savedRecord },
      }));
      setZyonGameplanDraft(null);
      setZyonTargetsInput("");
      setZyonConfluencesInput("");
      setZyonDraftState("missing");
      setNotice(recordMode === "HISTORICAL"
        ? `${draft.instrument} historical Gameplan locked and sent to Scoring for outcome review.`
        : `${draft.instrument} Gameplan locked. When a trade is logged in Scoring, its fill can be no more than 10 minutes old.`);

      void (async () => {
        try {
          if (!cards.some((card) => card.userId === resolvedAccountKey && typedPayload<SocialCardPayload>(card)?.code === "first-on-record")) {
            const definition = CALLING_CARD_CATALOG.find((card) => card.code === "first-on-record");
            if (definition) {
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
                  earnedAt: optimisticRecord.createdAt,
                  active: true,
                  equipped: false,
                  public: true,
                } satisfies SocialCardPayload,
              }));
            }
          }
          await saveProgressPatch({ prepare: true, map: true });
        } catch {
          // The scoring record is already safe; auxiliary progress can catch up later.
        }
      })();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "The edited Gameplan could not be locked. It remains safely in holding; try again.";
      writePendingScoringTransition({ record: optimisticRecord, state: "failed", error: message });
      window.dispatchEvent(new CustomEvent("kwantdesk:gameplan-lock-failed", {
        detail: { record: optimisticRecord, error: message },
      }));
      setNotice(message);
    } finally {
      setZyonDraftLocking(false);
    }
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
    const savedReceipt = await saveObject(buildLocalObject({
      id: `receipt:${parent.id}`,
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "receipt",
      scope: parent.scope,
      deskId: parent.deskId,
      parentId: parent.id,
      payload,
    }));
    if (savedReceipt.cloudSaved) {
      window.dispatchEvent(new CustomEvent("kwantdesk:gameplan-scored", {
        detail: { recordId: parent.id, score: payload.scores.final },
      }));
    }
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
    if (deskNameCheck.state !== "available") {
      setNotice(deskNameCheck.message || "Wait for the Desk name check to finish.");
      return;
    }
    setDeskCreating(true);
    try {
      const response = await fetch("/api/socials/desks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: deskDraft.name.trim().replace(/\s+/g, " "),
          description: deskDraft.description.trim(),
          markets: deskDraft.markets.split(",").map((market) => market.trim().toUpperCase()).filter(Boolean).slice(0, 8),
          session: deskDraft.session,
          timezone: deskDraft.timezone,
          objective: deskDraft.objective.trim(),
          privacy: deskDraft.privacy,
          capacity: Math.max(2, Math.min(50, Number(deskDraft.capacity) || 8)),
          weeklyMission: deskDraft.weeklyMission.trim(),
        }),
      });
      const result = await response.json() as {
        code?: string;
        error?: string;
        created?: CreatedDeskPayload;
      };
      if (!response.ok || !result.created) {
        if (response.status === 409 || result.code === "DESK_NAME_TAKEN") {
          setDeskNameCheck({ state: "taken", message: "This Desk already exists." });
        }
        throw new Error(result.error || "The Desk could not be created.");
      }
      window.dispatchEvent(new CustomEvent<CreatedDeskPayload>(DESK_CREATED_EVENT, {
        detail: result.created,
      }));
      setShowDeskModal(false);
      setDeskDraft((current) => ({
        ...current,
        name: "",
        description: "",
        objective: "",
      }));
      setNotice("Desk created. Its channels, roles and owner controls are ready.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "The Desk could not be created.");
    } finally {
      setDeskCreating(false);
    }
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
    if (!isValidProfileHandle(profile.handle)) {
      setProfileSaveState("error");
      setNotice(PROFILE_HANDLE_REQUIREMENTS);
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
          avatarUrl: profile.avatarUrl,
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
    if (profile.visibility.saves !== currentProfile.visibility.saves) {
      await Promise.all(reactions
        .filter((reaction) => reaction.userId === resolvedAccountKey && typedPayload<SocialReactionPayload>(reaction)?.kind === "SAVED")
        .map((reaction) => saveObject({ ...reaction, scope: profile.visibility.saves, updatedAt: new Date().toISOString() })));
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
    cacheProfileIdentity(resolvedAccountKey, {
      avatarUrl: profile.avatarUrl,
      displayName: profile.displayName,
      handle: profile.handle,
    });
    window.dispatchEvent(new CustomEvent("kwantdesk:profile-updated", {
      detail: {
        avatarUrl: profile.avatarUrl,
        displayName: profile.displayName,
        handle: profile.handle,
      },
    }));
    if (requestedProfileHandle !== profile.handle) onOpenProfile?.(profile.handle);
  };

  const equipCallingCard = async (definition: (typeof CALLING_CARD_CATALOG)[number]) => {
    const earned = definition.starter || cards.some((card) =>
      card.userId === resolvedAccountKey
      && typedPayload<SocialCardPayload>(card)?.code === definition.code);
    if (!earned) {
      setNotice(definition.requirement);
      return;
    }
    const profile = { ...currentProfile, callingCardCode: definition.code };
    setProfileDraft(profile);
    const saved = await saveObject(buildLocalObject({
      id: "profile",
      userId: resolvedAccountKey,
      authorLabel: profile.displayName,
      objectType: "profile",
      scope: profile.visibility.profile,
      payload: profile,
    }));
    setNotice(saved.cloudSaved ? `${definition.name} is now your profile banner.` : "The banner is selected locally and will sync when account storage reconnects.");
  };

  const openNewPost = (kind: SocialPostPayload["kind"] = "POST") => {
    setEditingPostId(null);
    setPostDraft({ ...EMPTY_POST, kind });
    setShowPostModal(true);
  };

  const openOneLinerComposer = () => {
    setEditingPostId(null);
    setOneLinerDraft({ body: "", scope: "community" });
    setShowOneLinerModal(true);
  };

  const closeOneLinerComposer = () => {
    if (oneLinerPublishing) return;
    setShowOneLinerModal(false);
    setEditingPostId(null);
    setOneLinerDraft({ body: "", scope: "community" });
  };

  const closePostComposer = () => {
    setShowPostModal(false);
    setEditingPostId(null);
    setPostDraft(EMPTY_POST);
  };

  const openPostEditor = (post: SocialObject) => {
    const payload = typedPayload<SocialPostPayload>(post);
    if (!payload || post.userId !== resolvedAccountKey) return;
    setEditingPostId(post.id);
    if (payload.kind === "ONE-LINER") {
      setOneLinerDraft({ body: payload.body, scope: post.scope });
      setOpenPostMenuId(null);
      setShowOneLinerModal(true);
      return;
    }
    setPostDraft({
      kind: payload.kind,
      instrument: payload.instrument,
      title: payload.title,
      body: payload.body,
      context: payload.context,
      condition: payload.condition,
      invalidation: payload.invalidation,
      imageDataUrl: payload.imageDataUrl ?? "",
      imageName: payload.imageName ?? "",
      scope: post.scope,
    });
    setOpenPostMenuId(null);
    setShowPostModal(true);
  };

  const preparePostImage = async (file: File | null) => {
    if (!file) return;
    setPostImagePreparing(true);
    try {
      const image = await prepareSharedImage(file, { maximumEdge: 1920, maxBytes: 900_000 });
      setPostDraft((current) => ({
        ...current,
        imageDataUrl: image.dataUrl,
        imageName: image.name,
      }));
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "That image could not be prepared.");
    } finally {
      setPostImagePreparing(false);
    }
  };

  const deleteStructuredPost = async (post: SocialObject) => {
    if (post.userId !== resolvedAccountKey) return;
    setOpenPostMenuId(null);
    const removed = await removeObject(post);
    setNotice(removed ? "Post deleted from your feed." : "That post could not be deleted.");
  };

  const publishOneLiner = async () => {
    const body = oneLinerDraft.body.replace(/\s+/g, " ").trim().slice(0, 280);
    if (!body) {
      setNotice("Write your one-liner first.");
      return;
    }
    if (oneLinerDraft.scope === "desk" && !myDesks.length) {
      setNotice("Create or join a Desk before publishing to Desk visibility.");
      return;
    }
    const existingPost = editingPostId
      ? posts.find((post) => post.id === editingPostId && post.userId === resolvedAccountKey)
      : null;
    setOneLinerPublishing(true);
    try {
      let object = buildLocalObject({
        id: existingPost?.id,
        userId: resolvedAccountKey,
        authorLabel: currentProfile.displayName,
        objectType: "post",
        scope: oneLinerDraft.scope,
        deskId: oneLinerDraft.scope === "desk" ? myDesks[0]?.id ?? null : null,
        payload: {
          kind: "ONE-LINER",
          instrument: "",
          title: "",
          body,
          context: "",
          condition: "",
          invalidation: "",
          relatedPrecordId: null,
          observedAt: existingPost
            ? typedPayload<SocialPostPayload>(existingPost)?.observedAt ?? existingPost.createdAt
            : new Date().toISOString(),
        } satisfies SocialPostPayload,
      });
      if (existingPost) {
        object = {
          ...object,
          parentId: existingPost.parentId,
          createdAt: existingPost.createdAt,
          updatedAt: new Date().toISOString(),
        };
      }
      await saveObject(object);
      setShowOneLinerModal(false);
      setEditingPostId(null);
      setOneLinerDraft({ body: "", scope: "community" });
      setTab("feed");
      setNotice(existingPost ? "One-liner updated." : "One-liner posted to your feed.");
    } finally {
      setOneLinerPublishing(false);
    }
  };

  const updateFeedFollow = async (targetUserId: string, currentlyFollowing: boolean) => {
    if (followActionUserIds.has(targetUserId)) return;
    const previousItem = followingUsers.find((item) => item.userId === targetUserId) ?? null;
    setFollowActionUserIds((current) => new Set(current).add(targetUserId));
    if (currentlyFollowing) {
      setFollowingUsers((current) => current.filter((item) => item.userId !== targetUserId));
    } else {
      const recommendation = suggestedProfiles.find((item) => item.userId === targetUserId);
      const profile = profileByUserId.get(targetUserId);
      setFollowingUsers((current) => current.some((item) => item.userId === targetUserId) ? current : [...current, {
        userId: targetUserId,
        displayName: recommendation?.displayName || profile?.displayName || "Kwant User",
        handle: recommendation?.handle || profile?.handle || "",
        avatarUrl: recommendation?.avatarUrl || profile?.avatarUrl || "",
        bio: recommendation?.bio || profile?.bio || "",
        viewerFollows: true,
        followsViewer: recommendation?.followsViewer ?? false,
        notificationsEnabled: false,
        followedAt: new Date().toISOString(),
      }]);
    }
    try {
      const response = await fetch("/api/socials/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: currentlyFollowing ? "unfollow" : "follow",
          targetUserId,
        }),
      });
      const result = await response.json() as SocialFollowResponse;
      if (!response.ok) throw new Error(result.error || "That follow could not be saved.");
      window.dispatchEvent(new CustomEvent("kwantdesk:social-follow-changed", {
        detail: { targetUserId, optimistic: true },
      }));
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("kwantdesk-social-follows");
        channel.postMessage({ type: "follow-changed", targetUserId });
        channel.close();
      }
      setNotice(currentlyFollowing ? "Unfollowed. Their new posts will leave your Following feed." : "Following. Their new posts will now appear in your feed.");
    } catch (reason) {
      // Roll back only this target so another follow completed during the same
      // burst is never erased by an unrelated failed request.
      setFollowingUsers((current) => {
        const withoutTarget = current.filter((item) => item.userId !== targetUserId);
        return currentlyFollowing && previousItem ? [...withoutTarget, previousItem] : withoutTarget;
      });
      setNotice(reason instanceof Error ? reason.message : "That follow could not be saved.");
    } finally {
      setFollowActionUserIds((current) => {
        const next = new Set(current);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  const publishStructuredPost = async () => {
    if (postDraft.scope === "desk" && !myDesks.length) {
      setNotice("Create or join a Desk before publishing to Desk visibility.");
      return;
    }
    const requiresCondition = postDraft.kind === "MAP" || postDraft.kind === "LIVE OBSERVATION";
    const requiresInvalidation = postDraft.kind === "MAP";
    const requiresContext = postDraft.kind !== "POST" && postDraft.kind !== "QUESTION";
    if (!postDraft.instrument.trim() || !postDraft.body.trim() || (requiresContext && !postDraft.context.trim())) {
      setNotice(requiresContext ? "This update needs an instrument, the update itself, and the context behind it." : "Add an instrument and write your post first.");
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
    const existingPost = editingPostId
      ? posts.find((post) => post.id === editingPostId && post.userId === resolvedAccountKey)
      : null;
    let object = buildLocalObject({
      id: existingPost?.id,
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
        observedAt: existingPost
          ? typedPayload<SocialPostPayload>(existingPost)?.observedAt ?? existingPost.createdAt
          : new Date().toISOString(),
        imageDataUrl: postDraft.imageDataUrl,
        imageName: postDraft.imageName,
      } satisfies SocialPostPayload,
    });
    if (existingPost) {
      object = {
        ...object,
        parentId: existingPost.parentId,
        createdAt: existingPost.createdAt,
        updatedAt: new Date().toISOString(),
      };
    }
    await saveObject(object);
    await saveProgressPatch(postDraft.kind === "MAP" ? { map: true } : postDraft.kind === "LIVE OBSERVATION" ? { observe: true } : {});
    setPostDraft(EMPTY_POST);
    setEditingPostId(null);
    setShowPostModal(false);
    setTab("feed");
    setNotice(existingPost ? "Post updated." : `${typedPayload<SocialPostPayload>(object)?.kind ?? "Update"} published to your feed.`);
  };

  const addReaction = async (precord: SocialObject, kind: SocialReactionPayload["kind"]) => {
    const existing = reactions.find((reaction) =>
      reaction.userId === resolvedAccountKey
      && reaction.parentId === precord.id
      && typedPayload<SocialReactionPayload>(reaction)?.kind === kind);
    if (existing) {
      await removeObject(existing);
      return;
    }
    await saveObject(buildLocalObject({
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

  const addComment = (precord: SocialObject, replyToCommentId: string | null = null) => {
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
        kind: commentKinds[precord.id]
          ?? (precord.userId === resolvedAccountKey ? "TRADER NOTE" : "REVIEW"),
        body,
        helpful: false,
        replyToCommentId,
      } satisfies SocialCommentPayload,
    }));
    setCommentDrafts((current) => ({ ...current, [precord.id]: "" }));
    setCommentReplyToId(null);
  };

  const deletePostComment = async (post: SocialObject, comment: SocialObject) => {
    setOpenCommentMenuId(null);
    if (editingCommentId === comment.id) {
      setEditingCommentId(null);
      setEditingCommentDraft("");
    }
    const previous = state.objects;
    setState((current) => ({
      ...current,
      objects: current.objects.filter((candidate) => objectKey(candidate) !== objectKey(comment)),
    }));
    try {
      const response = await fetch("/api/socials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: comment.id, parentId: post.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "That comment could not be deleted.");
      const postPayload = typedPayload<SocialPostPayload>(post);
      if (postPayload?.pinnedCommentId === comment.id) {
        await saveObject({
          ...post,
          payload: { ...postPayload, pinnedCommentId: undefined },
          updatedAt: new Date().toISOString(),
        });
      }
      setNotice("Comment deleted.");
    } catch (reason) {
      setState((current) => ({ ...current, objects: previous }));
      setNotice(reason instanceof Error ? reason.message : "That comment could not be deleted.");
    }
  };

  const togglePinnedComment = async (post: SocialObject, commentId: string) => {
    if (post.userId !== resolvedAccountKey) return;
    const payload = typedPayload<SocialPostPayload>(post);
    if (!payload) return;
    const pinnedCommentId = payload.pinnedCommentId === commentId ? undefined : commentId;
    const saved = await saveObject({
      ...post,
      payload: { ...payload, pinnedCommentId },
      updatedAt: new Date().toISOString(),
    });
    setNotice(typedPayload<SocialPostPayload>(saved)?.pinnedCommentId ? "Comment pinned to the top." : "Comment unpinned.");
  };

  const beginEditingComment = (comment: SocialObject) => {
    const payload = typedPayload<SocialCommentPayload>(comment);
    if (comment.userId !== resolvedAccountKey || !payload) return;
    setOpenCommentMenuId(null);
    setEditingCommentId(comment.id);
    setEditingCommentDraft(payload.body);
  };

  const cancelEditingComment = () => {
    if (commentEditSaving) return;
    setEditingCommentId(null);
    setEditingCommentDraft("");
  };

  const saveEditedComment = async (comment: SocialObject) => {
    const originalPayload = typedPayload<SocialCommentPayload>(comment);
    const body = editingCommentDraft.trim();
    if (comment.userId !== resolvedAccountKey || !originalPayload) return;
    if (!body) {
      setNotice("A comment cannot be empty.");
      return;
    }
    const objectId = objectKey(comment);
    const optimisticComment: SocialObject = {
      ...comment,
      payload: { ...originalPayload, body },
      updatedAt: new Date().toISOString(),
    };
    setCommentEditSaving(true);
    setState((current) => ({
      ...current,
      objects: current.objects.map((candidate) => objectKey(candidate) === objectId ? optimisticComment : candidate),
    }));
    try {
      const response = await fetch("/api/socials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object: {
            id: optimisticComment.id,
            objectType: optimisticComment.objectType,
            scope: optimisticComment.scope,
            deskId: optimisticComment.deskId,
            parentId: optimisticComment.parentId,
            authorLabel: optimisticComment.authorLabel,
            payload: optimisticComment.payload,
          },
        }),
      });
      const result = await response.json() as { object?: SocialObject; error?: string };
      if (!response.ok || !result.object) throw new Error(result.error || "That comment could not be updated.");
      const saved = { ...result.object, cloudSaved: true };
      setState((current) => ({
        ...current,
        cloud: true,
        objects: current.objects.map((candidate) => objectKey(candidate) === objectId ? saved : candidate),
      }));
      setEditingCommentId(null);
      setEditingCommentDraft("");
      setNotice("Comment updated.");
    } catch (reason) {
      setState((current) => ({
        ...current,
        objects: current.objects.map((candidate) => objectKey(candidate) === objectId ? comment : candidate),
      }));
      setNotice(reason instanceof Error ? reason.message : "That comment could not be updated.");
    } finally {
      setCommentEditSaving(false);
    }
  };

  const renderCommentBody = (comment: SocialObject, className: string) => {
    const payload = typedPayload<SocialCommentPayload>(comment);
    if (editingCommentId !== comment.id) {
      return <p className={className}>{payload?.body}</p>;
    }
    return (
      <div className="mt-2 space-y-2">
        <textarea
          autoFocus
          value={editingCommentDraft}
          onChange={(event) => setEditingCommentDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelEditingComment();
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void saveEditedComment(comment);
          }}
          rows={3}
          className="min-h-[68px] w-full resize-y rounded-xl border border-primary/35 bg-background px-3 py-2 text-[8px] leading-4 text-foreground outline-none focus:border-primary"
        />
        <div className="flex justify-end gap-2">
          <button type="button" disabled={commentEditSaving} onClick={cancelEditingComment} className="h-7 rounded-lg px-3 text-[7px] font-semibold text-muted hover:bg-surface hover:text-foreground disabled:opacity-50">Cancel</button>
          <button type="button" disabled={commentEditSaving || !editingCommentDraft.trim()} onClick={() => void saveEditedComment(comment)} className="h-7 rounded-lg bg-primary px-3 text-[7px] font-semibold text-background hover:brightness-110 disabled:opacity-50">{commentEditSaving ? "Saving..." : "Save edit"}</button>
        </div>
      </div>
    );
  };

  const renderCommentMenu = (post: SocialObject, comment: SocialObject) => {
    const ownsComment = comment.userId === resolvedAccountKey;
    const ownsPost = post.userId === resolvedAccountKey;
    if (!ownsComment && !ownsPost) return null;
    return (
      <div className="relative shrink-0" data-comment-menu={comment.id}>
        <button
          type="button"
          onClick={() => setOpenCommentMenuId((current) => current === comment.id ? null : comment.id)}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
          aria-label="Comment options"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        {openCommentMenuId === comment.id ? (
          <div className="absolute right-0 top-7 z-50 w-36 overflow-hidden rounded-xl border border-border bg-panel p-1 shadow-2xl shadow-black/60">
            {ownsComment ? <button type="button" onClick={() => beginEditingComment(comment)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[8px] text-muted hover:bg-surface hover:text-foreground"><Pencil className="h-3.5 w-3.5" />Edit comment</button> : null}
            <button type="button" onClick={() => void deletePostComment(post, comment)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[8px] text-danger hover:bg-danger/10"><Trash2 className="h-3.5 w-3.5" />{ownsComment ? "Delete comment" : "Remove comment"}</button>
          </div>
        ) : null}
      </div>
    );
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
    setNotice(currentProfile.visibility.saves === "community" ? "Gameplan saved to your public profile collection." : "Gameplan saved privately to your account.");
  };

  const toggleStructuredPostSave = async (post: SocialObject) => {
    const existing = reactions.find((reaction) =>
      reaction.userId === resolvedAccountKey
      && reaction.parentId === post.id
      && typedPayload<SocialReactionPayload>(reaction)?.kind === "SAVED");
    if (existing) {
      await removeObject(existing);
      setNotice("Removed from your saved posts.");
      return;
    }
    await saveObject(buildLocalObject({
      id: `reaction:${post.id}:SAVED`,
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "reaction",
      scope: currentProfile.visibility.saves,
      parentId: post.id,
      payload: { kind: "SAVED" } satisfies SocialReactionPayload,
    }));
    setNotice(currentProfile.visibility.saves === "community" ? "Post saved to your public profile collection." : "Post saved privately to your account.");
  };

  const updateCollectionVisibility = async (
    key: "likes" | "reposts" | "saves",
    visibility: "private" | "community",
  ) => {
    const nextProfile: SocialProfilePayload = {
      ...currentProfile,
      visibility: { ...currentProfile.visibility, [key]: visibility },
    };
    setProfileDraft(nextProfile);
    await saveObject(buildLocalObject({
      id: "profile",
      userId: resolvedAccountKey,
      authorLabel: nextProfile.displayName,
      objectType: "profile",
      scope: nextProfile.visibility.profile,
      payload: nextProfile,
    }));
    if (key === "saves") {
      await Promise.all(reactions
        .filter((reaction) => reaction.userId === resolvedAccountKey && typedPayload<SocialReactionPayload>(reaction)?.kind === "SAVED")
        .map((reaction) => saveObject({ ...reaction, scope: visibility, updatedAt: new Date().toISOString() })));
    }
    const label = key === "likes" ? "Liked posts" : key === "reposts" ? "Reposts" : "Saved posts";
    setNotice(`${label} are now ${visibility === "community" ? "visible on your profile" : "private"}.`);
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

  const shareStructuredPost = (post: SocialObject) => {
    const payload = typedPayload<SocialPostPayload>(post);
    const authorProfile = profileByUserId.get(post.userId);
    const handle = authorProfile?.handle || currentProfile.handle;
    const url = `${window.location.origin}/socials/${encodeURIComponent(handle)}?post=${encodeURIComponent(post.id)}`;
    void shareUrl(url, payload?.title || `${post.authorLabel} on Kwant Desk`, payload?.body || "View this Kwant Desk post.");
  };

  const toggleStructuredPostRepost = async (post: SocialObject) => {
    const existing = posts.find((candidate) =>
      candidate.userId === resolvedAccountKey
      && typedPayload<SocialPostPayload>(candidate)?.isRepost
      && typedPayload<SocialPostPayload>(candidate)?.repostOfPostId === post.id);
    if (existing) {
      await removeObject(existing);
      setNotice("Repost removed from your feed.");
      return;
    }
    const payload = typedPayload<SocialPostPayload>(post);
    if (!payload) return;
    await saveObject(buildLocalObject({
      id: `repost:${post.id}`,
      userId: resolvedAccountKey,
      authorLabel: currentProfile.displayName,
      objectType: "post",
      scope: post.scope === "private" ? "friends" : post.scope,
      deskId: post.deskId,
      parentId: post.id,
      payload: {
        ...payload,
        title: payload.title || `Reposted from ${post.authorLabel}`,
        observedAt: new Date().toISOString(),
        isRepost: true,
        repostOfUserId: post.userId,
        repostOfPostId: post.id,
        pinnedCommentId: undefined,
      } satisfies SocialPostPayload,
    }));
    setNotice("Post shared to your feed.");
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
      const prepared = await encodeCanvasImage(canvas, {
        maxBytes: 1_100_000,
        initialQuality: 0.94,
        minimumQuality: 0.78,
      });
      setProfileDraft((current) => ({ ...current, avatarUrl: prepared.dataUrl }));
      closeAvatarCrop();
      setNotice("Profile photo prepared at 1080 × 1080. Save your profile to publish it.");
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
          <Avatar
            label={object.authorLabel}
            avatarUrl={profile?.avatarUrl}
            statusClassName={profile ? presenceOption(effectivePresenceStatus(profile.presenceStatus, profile.lastSeenAt)).dotClassName : ""}
          />
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
          {!own && profile ? <button type="button" onClick={() => onOpenProfile?.(profile.handle)} className="flex h-8 items-center gap-1.5 rounded-xl border border-border px-2.5 text-[8px] font-semibold text-muted hover:text-foreground"><Radar className="h-3.5 w-3.5" />View profile</button> : null}
          <ScopeBadge scope={object.scope} />
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[18px] font-semibold text-foreground">{payload.instrument}</span>
            <span className="rounded-lg border border-border bg-surface px-2 py-1 text-[8px] font-semibold text-muted">{payload.session}</span>
            <span className={`rounded-lg px-2 py-1 text-[8px] font-semibold ${payload.direction === "LONG" ? "bg-primary/10 text-primary" : payload.direction === "SHORT" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`}>{payload.direction}</span>
            <StatusBadge status={status} />
            {payload.tradingAccount ? <span className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[0.06] px-2 py-1 text-[8px] font-semibold text-primary"><WalletCards className="h-3 w-3" />{zyonTradingAccountLabel(payload.tradingAccount)}</span> : null}
            <span className="ml-auto flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/[0.06] px-2.5 py-1.5 text-[8px] text-primary"><Gauge className="h-3.5 w-3.5" /><strong className="font-mono">{payload.reasoningScore}</strong> reasoning</span>
          </div>
          <p className="mt-4 text-[11px] leading-5 text-foreground">{payload.marketContext}</p>
          {payload.traderNotes ? <div className="mt-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3"><div className="text-[7px] font-semibold uppercase tracking-[0.13em] text-primary">Trader notes</div><p className="mt-2 whitespace-pre-wrap text-[9px] leading-4 text-muted">{payload.traderNotes}</p></div> : null}
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
              <div className="rounded-xl border border-border bg-surface/35 p-2"><div className="text-muted">Entry</div><div className="mt-1 font-mono text-foreground">{payload.plannedEntryLow ?? "—"}{payload.plannedEntryHigh && payload.plannedEntryHigh !== payload.plannedEntryLow ? `–${payload.plannedEntryHigh}` : ""}</div>{payload.plannedEntryTime ? <div className="mt-1 truncate font-mono text-[6px] text-muted">{payload.plannedEntryTime}</div> : null}</div>
              <div className="rounded-xl border border-border bg-surface/35 p-2"><div className="text-muted">Stop</div><div className="mt-1 font-mono text-foreground">{payload.plannedStop ?? "—"}</div></div>
              <div className="rounded-xl border border-border bg-surface/35 p-2"><div className="text-muted">Targets</div><div className="mt-1 font-mono text-foreground">{payload.plannedTargets?.length ? payload.plannedTargets.join(" / ") : payload.plannedTarget ?? "—"}</div></div>
              <div className="rounded-xl border border-border bg-surface/35 p-2"><div className="text-muted">Max risk</div><div className="mt-1 font-mono text-foreground">{payload.maximumRisk === null ? "—" : `${payload.maximumRisk} ${payload.riskUnit ?? "DOLLARS"}`}</div></div>
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
            <button type="button" onClick={() => { window.localStorage.setItem("kwantdesk:gameplan-page-tab", "scoring"); router.push("/gameplan?tab=scoring"); }} className="mt-4 flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-3 text-[9px] font-semibold text-primary hover:bg-primary/10"><Plus className="h-3.5 w-3.5" />Open Scoring to add execution</button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-background/20 px-4 py-2.5">
          {(["USEFUL", "CLEAR", "EVIDENCE"] as const).map((kind) => {
            const active = objectReactions.some((reaction) => reaction.userId === resolvedAccountKey && typedPayload<SocialReactionPayload>(reaction)?.kind === kind);
            const count = objectReactions.filter((reaction) => typedPayload<SocialReactionPayload>(reaction)?.kind === kind).length;
            return <button key={kind} type="button" onClick={() => void addReaction(object, kind)} className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[7px] font-semibold ${active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}><Star className="h-3 w-3" />{kind}{count ? ` ${count}` : ""}</button>;
          })}
          {([
            ["FIRE", "🔥"],
            ["TARGET", "🎯"],
            ["BRAIN", "🧠"],
            ["APPLAUSE", "👏"],
          ] as const).map(([kind, label]) => {
            const active = objectReactions.some((reaction) => reaction.userId === resolvedAccountKey && typedPayload<SocialReactionPayload>(reaction)?.kind === kind);
            const count = objectReactions.filter((reaction) => typedPayload<SocialReactionPayload>(reaction)?.kind === kind).length;
            return <button key={kind} type="button" onClick={() => void addReaction(object, kind)} className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] ${active ? "bg-primary/10 ring-1 ring-primary/25" : "hover:bg-surface"}`}>{label}{count ? <span className="font-mono text-[7px] text-muted">{count}</span> : null}</button>;
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
              const traderNote = commentPayload?.kind === "TRADER NOTE" && comment.userId === object.userId;
              return <div key={objectKey(comment)} className="flex gap-2"><Avatar label={comment.authorLabel} avatarUrl={profileByUserId.get(comment.userId)?.avatarUrl} size="sm" /><div className={`min-w-0 flex-1 rounded-xl rounded-bl-sm border px-3 py-2 ${traderNote ? "border-primary/25 bg-primary/[0.07]" : "border-border bg-surface/35"}`}><div className="flex items-center gap-2 text-[7px]"><span className="font-semibold text-foreground">{comment.authorLabel}</span><span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{commentPayload?.kind}</span><span className="ml-auto text-muted">{formatDate(comment.createdAt, true)}</span>{renderCommentMenu(object, comment)}</div>{renderCommentBody(comment, `mt-1 whitespace-pre-wrap break-words text-[8px] leading-4 ${traderNote ? "text-foreground" : "text-muted"}`)}</div></div>;
            })}
          </div>
        ) : null}
        <div className="grid gap-2 border-t border-border px-4 py-3 sm:grid-cols-[112px_minmax(0,1fr)_34px]">
          <KwantSelect value={commentKinds[object.id] ?? (own ? "TRADER NOTE" : "REVIEW")} onChange={(event) => setCommentKinds((current) => ({ ...current, [object.id]: event.target.value as SocialCommentPayload["kind"] }))} className="h-8 rounded-lg border border-border bg-surface px-2 text-[8px] text-muted outline-none">
            {own ? <option value="TRADER NOTE">Trader note</option> : null}
            <option value="REVIEW">Review</option>
            <option value="QUESTION">Question</option>
            <option value="COUNTERCASE">Countercase</option>
            <option value="LESSON">Lesson</option>
          </KwantSelect>
          <input value={commentDrafts[object.id] ?? ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [object.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") addComment(object); }} placeholder={own ? "Add your speech-bubble note…" : "Leave a focused comment…"} className="h-8 rounded-lg border border-border bg-background px-3 text-[8px] text-foreground outline-none placeholder:text-muted/55 focus:border-primary/40" />
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
    const own = object.userId === resolvedAccountKey;
    const oneLiner = payload.kind === "ONE-LINER";
    const trade = payload.kind === "TRADE" ? payload.trade ?? null : null;
    const tradeOpenedAt = trade ? Date.parse(trade.openedAt) : Number.NaN;
    const tradeClosedAt = trade?.closedAt ? Date.parse(trade.closedAt) : Number.NaN;
    const tradeHasExactTimes = Boolean(
      trade
      && trade.entryTimeKnown !== false
      && trade.exitTimeKnown !== false
      && Number.isFinite(tradeOpenedAt)
      && Number.isFinite(tradeClosedAt)
      && tradeClosedAt >= tradeOpenedAt,
    );
    const liked = objectReactions.some((reaction) => reaction.userId === resolvedAccountKey && typedPayload<SocialReactionPayload>(reaction)?.kind === "LIKE");
    const saved = objectReactions.some((reaction) => reaction.userId === resolvedAccountKey && typedPayload<SocialReactionPayload>(reaction)?.kind === "SAVED");
    const likeCount = objectReactions.filter((reaction) => typedPayload<SocialReactionPayload>(reaction)?.kind === "LIKE").length;
    const reposts = posts.filter((post) => typedPayload<SocialPostPayload>(post)?.repostOfPostId === object.id);
    const reposted = reposts.some((post) => post.userId === resolvedAccountKey);
    const profileObject = profiles.find((candidate) => candidate.userId === object.userId);
    const profile = profileObject ? normalizeSocialProfile(profileObject.payload, profileObject.authorLabel) : null;
    const kindTone = payload.kind === "TRADE"
      ? "text-primary bg-primary/10 border-primary/20"
      : payload.kind === "MAP"
      ? "text-primary bg-primary/10 border-primary/20"
      : payload.kind === "ONE-LINER"
        ? "text-primary bg-primary/10 border-primary/20"
      : payload.kind === "LIVE OBSERVATION"
        ? "text-accent bg-accent/10 border-accent/20"
        : payload.kind === "REVIEW REQUEST"
          ? "text-warning bg-warning/10 border-warning/20"
          : "text-foreground bg-surface border-border";
    return (
      <Card key={objectKey(object)} className="relative overflow-hidden">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <Avatar
            label={object.authorLabel}
            avatarUrl={profile?.avatarUrl}
            statusClassName={profile ? presenceOption(effectivePresenceStatus(profile.presenceStatus, profile.lastSeenAt)).dotClassName : ""}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => profile && onOpenProfile?.(profile.handle)} className="text-[10px] font-semibold hover:text-primary">{object.authorLabel}</button>
              {profile ? <span className="text-[8px] text-muted">@{profile.handle}</span> : null}
              {oneLiner ? <span className="text-[8px] text-muted">just {payload.isRepost ? "reposted" : "posted"}</span> : <span className={`rounded-lg border px-2 py-1 text-[7px] font-semibold ${kindTone}`}>{payload.kind}</span>}
            </div>
            <div className="mt-1 text-[7px] text-muted">{formatDate(payload.observedAt, true)}{payload.instrument ? ` · ${payload.instrument}` : ""}</div>
            {payload.isRepost ? <div className="mt-1 flex items-center gap-1 text-[7px] text-primary"><Repeat2 className="h-3 w-3" />Reposted to this feed</div> : null}
          </div>
          <ScopeBadge scope={object.scope} />
          {own ? (
            <div className="relative">
              <button type="button" onClick={() => setOpenPostMenuId((current) => current === object.id ? null : object.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground" aria-label="Post options"><MoreHorizontal className="h-4 w-4" /></button>
              {openPostMenuId === object.id ? <div className="absolute right-0 top-9 z-30 w-36 overflow-hidden rounded-xl border border-border bg-panel p-1 shadow-2xl">{payload.kind !== "TRADE" ? <button type="button" onClick={() => openPostEditor(object)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[8px] text-muted hover:bg-surface hover:text-foreground"><SlidersHorizontal className="h-3.5 w-3.5" />Edit post</button> : null}<button type="button" onClick={() => void deleteStructuredPost(object)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[8px] text-danger hover:bg-danger/10"><Trash2 className="h-3.5 w-3.5" />Delete post</button></div> : null}
            </div>
          ) : null}
        </div>
        <div className="p-4">
          {oneLiner ? (
            <div className="kwant-one-liner-glow relative overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_9%,var(--background)),color-mix(in_srgb,var(--panel)_92%,transparent))] px-5 py-6 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--primary)_10%,transparent)]">
              <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/[0.08] blur-3xl" />
              <p className="relative whitespace-pre-wrap break-words text-[14px] font-medium leading-7 tracking-[-0.015em] text-foreground">{payload.body}</p>
            </div>
          ) : trade ? (
            <div className="space-y-4">
              {payload.body ? <p className="whitespace-pre-wrap break-words text-[11px] leading-6 text-foreground">{payload.body}</p> : null}
              <div className="relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(145deg,color-mix(in_srgb,var(--primary)_7%,var(--panel)),var(--background))] p-4">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/[0.07] blur-3xl" />
                <div className="relative flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={`rounded-lg px-2 py-1 text-[7px] font-semibold ${trade.side === "LONG" ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>{trade.side}</span><span className="font-mono text-[13px] font-semibold text-foreground">{trade.instrument}</span></div><div className="mt-2 truncate text-[9px] text-muted">Journal trade · {trade.entryTimeKnown !== false && Number.isFinite(tradeOpenedAt) ? formatDate(trade.openedAt, true) : "Entry time not recorded"}</div></div>
                  <div className="text-right"><div className="text-[7px] font-semibold uppercase tracking-[0.14em] text-muted">Net P&amp;L</div><div className={`mt-1 font-mono text-[24px] font-semibold tracking-[-0.04em] ${trade.netPnl >= 0 ? "text-accent" : "text-danger"}`}>{tradeMoney(trade.netPnl)}</div></div>
                </div>
                <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[["Entry", trade.entryPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"], ["Exit", trade.exitPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"], ["Risk", trade.initialRisk === null ? "Not recorded" : tradeMoney(trade.initialRisk, false)], ["R : R", trade.rMultiple === null ? "Not recorded" : `${trade.rMultiple.toFixed(2)}R`]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-background/55 p-3"><div className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</div><div className="mt-1 font-mono text-[10px] font-semibold text-foreground">{value}</div></div>)}
                </div>
              </div>
              {tradeHasExactTimes ? <TradePostChart trade={trade as SocialTradeSnapshot} /> : null}
            </div>
          ) : (
            <>
              {payload.title ? <h3 className="text-[13px] font-semibold tracking-[-0.015em]">{payload.title}</h3> : null}
              <p className="mt-2 text-[10px] leading-5 text-foreground">{payload.body}</p>
              {payload.imageDataUrl ? <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-black"><img src={payload.imageDataUrl} alt={payload.imageName || payload.title || "Social post attachment"} className="max-h-[560px] w-full object-contain" /></div> : null}
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Context</div><p className="mt-2 text-[8px] leading-4 text-foreground">{payload.context}</p></div>
                <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Condition / evidence</div><p className="mt-2 text-[8px] leading-4 text-foreground">{payload.condition || "Not required for this update type."}</p></div>
                <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Invalidation</div><p className="mt-2 text-[8px] leading-4 text-foreground">{payload.invalidation || "No forecast claim attached."}</p></div>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-background/20 px-4 py-2.5">
          <button type="button" onClick={() => void addReaction(object, "LIKE")} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[8px] font-semibold ${liked ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}><Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />Like{likeCount ? ` ${likeCount}` : ""}</button>
          <button type="button" onClick={() => trade ? (setCommentPanelPostId(object.id), setCommentReplyToId(null)) : document.getElementById(`comment:${object.id}`)?.focus()} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[8px] font-semibold text-muted hover:bg-surface hover:text-foreground"><MessageCircle className="h-3.5 w-3.5" />Comment{objectComments.length ? ` ${objectComments.length}` : ""}</button>
          <button type="button" onClick={() => shareStructuredPost(object)} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[8px] font-semibold text-muted hover:bg-surface hover:text-foreground"><Share2 className="h-3.5 w-3.5" />Share</button>
          {trade || oneLiner ? <button type="button" onClick={() => openTradeSend(object)} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[8px] font-semibold text-muted hover:bg-surface hover:text-foreground"><Send className="h-3.5 w-3.5" />Send</button> : null}
          <button type="button" onClick={() => void toggleStructuredPostRepost(object)} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[8px] font-semibold ${reposted ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}><Repeat2 className="h-3.5 w-3.5" />Repost{reposts.length ? ` ${reposts.length}` : ""}</button>
          <button type="button" onClick={() => void toggleStructuredPostSave(object)} className={`ml-auto flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[8px] font-semibold ${saved ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}><Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />{saved ? "Saved" : "Save"}</button>
        </div>
        {!trade && objectComments.length ? (
          <div className="space-y-2 border-t border-border px-4 py-3">
            {objectComments.slice(-3).map((comment) => {
              const payloadComment = typedPayload<SocialCommentPayload>(comment);
              return <div key={objectKey(comment)} className="flex gap-2"><Avatar label={comment.authorLabel} avatarUrl={profileByUserId.get(comment.userId)?.avatarUrl} size="sm" /><div className="min-w-0 flex-1 rounded-xl border border-border bg-surface/35 px-3 py-2"><div className="flex items-center gap-2 text-[7px]"><span className="font-semibold">{comment.authorLabel}</span><span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{payloadComment?.kind}</span><span className="ml-auto text-muted">{formatDate(comment.createdAt, true)}</span>{renderCommentMenu(object, comment)}</div>{renderCommentBody(comment, "mt-1 whitespace-pre-wrap break-words text-[8px] leading-4 text-muted")}</div></div>;
            })}
          </div>
        ) : null}
        {!trade ? <div className="grid gap-2 border-t border-border px-4 py-3 sm:grid-cols-[112px_minmax(0,1fr)_34px]">
          <KwantSelect value={commentKinds[object.id] ?? "QUESTION"} onChange={(event) => setCommentKinds((current) => ({ ...current, [object.id]: event.target.value as SocialCommentPayload["kind"] }))} className="h-8 rounded-lg border border-border bg-surface px-2 text-[8px] text-muted outline-none"><option value="QUESTION">Question</option><option value="REVIEW">Review</option><option value="COUNTERCASE">Countercase</option><option value="LESSON">Lesson</option></KwantSelect>
          <input id={`comment:${object.id}`} value={commentDrafts[object.id] ?? ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [object.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") addComment(object); }} placeholder="Respond with context, evidence, or a focused question…" className="h-8 rounded-lg border border-border bg-background px-3 text-[8px] outline-none placeholder:text-muted/55 focus:border-primary/40" />
          <button type="button" onClick={() => addComment(object)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-background"><Send className="h-3.5 w-3.5" /></button>
        </div> : null}
      </Card>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="shrink-0 bg-panel">
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
            <button type="button" onClick={() => { setTab("profile"); setProfileEditing(false); onOpenProfile?.(currentProfile.handle); }} className="flex h-8 items-center gap-2 rounded-xl border border-border bg-surface px-2.5 text-[8px] font-semibold text-muted hover:text-foreground"><Avatar label={currentProfile.displayName} avatarUrl={currentProfile.avatarUrl} size="sm" />@{currentProfile.handle}</button>
          </div>
        </div>
        <WorkspaceSubnav
          items={SOCIAL_TABS.map((item) => {
            const count = item.id === "feed"
              ? sectionUnread.feed
              : item.id === "desks"
                ? sectionUnread.desks
                : item.id === "today"
                  ? notificationItems.length
                  : 0;
            return count ? { ...item, badge: count > 99 ? "99+" : count } : item;
          })}
          value={tab}
          onChange={(id) => {
            if (initialProfileHandle && id !== "profile") {
              onCloseProfile?.();
              return;
            }
            setTab(id);
            if (id === "feed" || id === "desks") void markSectionRead(id);
            if (id === "profile") setProfileEditing(false);
          }}
          ariaLabel="Socials views"
          className="lg:[&>div]:justify-center"
        />
      </header>

      {notice ? <div className="flex shrink-0 items-center gap-2 border-b border-primary/15 bg-primary/[0.055] px-4 py-2 text-[8px] text-primary"><Sparkles className="h-3.5 w-3.5" /><span className="min-w-0 flex-1">{notice}</span><button type="button" onClick={() => setNotice("")}><X className="h-3.5 w-3.5" /></button></div> : null}

      <main className={`min-h-0 flex-1 ${tab === "desks" ? "overflow-hidden" : "overflow-y-auto"}`}>
        {tab === "today" ? (
          <div className="grid min-h-full gap-3 p-3 xl:grid-cols-[230px_minmax(0,1fr)_290px]">
            <div className="space-y-3">
              <Card className="relative overflow-hidden p-4">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_42%)]" />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <h2 className="text-[10px] font-semibold">Automatic Gameplan process</h2>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[6px] font-semibold uppercase tracking-[0.13em] text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${zyonDraftState === "loading" ? "animate-pulse bg-warning" : "bg-primary shadow-[0_0_8px_var(--primary)]"}`} />
                    {zyonDraftState === "loading" ? "Syncing account state" : "Updates from your live record"}
                  </div>

                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-primary shadow-[0_0_12px_var(--primary)] transition-[width] duration-500" style={{ width: `${gameplanProcessPercent}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between font-mono text-[6px] text-muted">
                    <span>{gameplanProcessPercent}%</span>
                    <span>AUTOMATIC</span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {GAMEPLAN_PROCESS_STEPS.map((step, index) => {
                      const complete = gameplanProcessIndex === 3 ? index <= 3 : index < gameplanProcessIndex;
                      const active = index === gameplanProcessIndex;
                      const Icon = step.icon;
                      return (
                        <div key={step.label} className={`relative flex gap-2.5 rounded-xl border p-2.5 transition-colors ${active ? "border-primary/30 bg-primary/[0.075]" : complete ? "border-primary/15 bg-primary/[0.025]" : "border-border bg-background/25"}`} aria-current={active ? "step" : undefined}>
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${complete ? "border-primary bg-primary text-background" : active ? "border-primary/35 bg-primary/10 text-primary shadow-[0_0_13px_color-mix(in_srgb,var(--primary)_22%,transparent)]" : "border-border bg-surface text-muted"}`}>
                            {complete ? <Check className="h-3.5 w-3.5" /> : <Icon className={`h-3.5 w-3.5 ${active && index === 2 ? "animate-pulse" : ""}`} />}
                          </span>
                          <span className="min-w-0 pt-0.5">
                            <span className={`block text-[8px] font-semibold ${active || complete ? "text-foreground" : "text-muted"}`}>{step.label}</span>
                            <span className="mt-1 block text-[6.5px] leading-3 text-muted">{step.detail}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
                    <div className="text-[7px] font-semibold text-foreground">
                      {gameplanProcessLabel || (gameplanProcessIndex === 0 ? "No active Gameplan" : `${gameplanProcessPlan?.instrument ?? "Gameplan"} record`)}
                    </div>
                    <div className="mt-1 text-[6.5px] leading-3 text-muted">
                      {gameplanProcessIndex === 0
                        ? "Start with ZYON. The process will advance without manual status controls."
                        : gameplanProcessIndex === 1
                          ? `Waiting for your review in holding${gameplanProcessTimestamp ? ` · ${formatDate(gameplanProcessTimestamp, true)}` : ""}.`
                          : gameplanProcessIndex === 2
                            ? `Published and waiting for trade info${gameplanProcessTimestamp ? ` · ${formatDate(gameplanProcessTimestamp, true)}` : ""}.`
                            : `${gameplanProcessReceipt?.scores.final !== undefined ? `Final score ${gameplanProcessReceipt.scores.final}/100` : "Final scoring saved"}${gameplanProcessTimestamp ? ` · ${formatDate(gameplanProcessTimestamp, true)}` : ""}.`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (gameplanProcessIndex === 0) router.push(zyonGameplanLaunchHref());
                      else if (gameplanProcessIndex === 1) document.getElementById("gameplan-holding")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      else if (gameplanProcessIndex === 2) onOpenGameplanScoring?.();
                      else setTab("reasoning");
                    }}
                    className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.07] text-[8px] font-semibold text-primary hover:bg-primary/10"
                  >
                    {gameplanProcessIndex === 0 ? <Sparkles className="h-3.5 w-3.5" /> : gameplanProcessIndex === 1 ? <Archive className="h-3.5 w-3.5" /> : gameplanProcessIndex === 2 ? <Clock3 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {gameplanProcessIndex === 0 ? "Make Gameplan" : gameplanProcessIndex === 1 ? "Review and publish" : gameplanProcessIndex === 2 ? "Open scoring" : "View finalised record"}
                  </button>
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

              <Card id="gameplan-holding" className="gameplan-holding-editable scroll-mt-3 overflow-hidden border-primary/20">
                <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background/25 px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Archive className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><h3 className="text-[12px] font-semibold">Gameplan holding page</h3><p className="mt-0.5 text-[8px] text-muted">ZYON fills the complete plan from your conversation. Review or change any field, add optional notes, then lock it into Scoring.</p></div>
                  <span className={`rounded-xl border px-3 py-2 text-[7px] font-semibold uppercase tracking-[0.13em] ${zyonGameplanDraft ? "border-warning/20 bg-warning/[0.05] text-warning" : "border-border bg-surface/40 text-muted"}`}>{zyonGameplanDraft ? "One plan awaiting approval" : "Holding is clear"}</span>
                </div>
                {zyonDraftState === "loading" ? (
                  <KwantLoader
                    className="min-h-[280px]"
                    compact
                    icon={BrainCircuit}
                    title="Checking ZYON's holding record"
                    detail="Nothing is posted to your Profile automatically."
                  />
                ) : zyonGameplanDraft ? (
                  <>
                    <div className="p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[26px] font-semibold">{zyonGameplanDraft.instrument}</span>
                            <span className="rounded-lg border border-warning/25 bg-warning/10 px-2 py-1 text-[7px] font-semibold text-warning">AWAITING YOUR APPROVAL</span>
                          </div>
                          <div className="mt-1 text-[7px] text-muted">Pre-filled by ZYON · last generated {formatDate(zyonGameplanDraft.updatedAt, true)} · {zyonGameplanDraft.recordMode === "HISTORICAL" ? "historical test · " : ""}editable until locked</div>
                        </div>
                        <div className="ml-auto rounded-xl border border-primary/15 bg-primary/[0.035] px-3 py-2 text-right"><div className="text-[8px] font-semibold text-primary">DRAFT</div><div className="mt-1 text-[7px] text-muted">Nothing is public or scored yet</div></div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted sm:col-span-2">Plan name<input value={zyonGameplanDraft.title} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, title: event.target.value.slice(0, 120) } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none focus:border-primary/40" /></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Market root<KwantSelect value={zyonGameplanDraft.root} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, root: event.target.value as ZyonGameplanDraft["root"] } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"><option value="NQ">NQ</option><option value="ES">ES</option></KwantSelect></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Trading date<input type="date" value={zyonGameplanDraft.sessionDate} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, sessionDate: event.target.value } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/40" /></label>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Instrument<input value={zyonGameplanDraft.instrument} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, instrument: event.target.value.toUpperCase().slice(0, 16) } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[10px] text-foreground outline-none focus:border-primary/40" /></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Direction<KwantSelect value={zyonGameplanDraft.direction} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, direction: event.target.value as ZyonGameplanDraft["direction"] } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"><option value="LONG">Long</option><option value="SHORT">Short</option></KwantSelect></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Session<input value={zyonGameplanDraft.session} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, session: event.target.value } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none focus:border-primary/40" /></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Entry time · optional<input value={zyonGameplanDraft.entryTime} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, entryTime: event.target.value.slice(0, 80) } : current)} placeholder="Leave blank until triggered" title="Future conditional plans do not need a time. Historical trades still require their exact original timestamp and timezone." className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/40" /></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Risk<input type="number" value={zyonGameplanDraft.riskAmount ?? ""} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, riskAmount: numberOrNull(event.target.value) } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/40" /></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Risk unit<KwantSelect value={zyonGameplanDraft.riskUnit} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, riskUnit: event.target.value as ZyonGameplanDraft["riskUnit"] } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"><option value="DOLLARS">Dollars</option><option value="POINTS">Points</option><option value="TICKS">Ticks</option><option value="PERCENT">Percent</option></KwantSelect></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Position size<input type="number" min="0" step="any" value={zyonGameplanDraft.size ?? ""} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, size: numberOrNull(event.target.value) } : current)} placeholder="Contracts" className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/40" /></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Plan expiry<input value={zyonGameplanDraft.expiryAt ?? ""} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, expiryAt: event.target.value.slice(0, 60) || null } : current)} placeholder="Optional ISO time" className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[8px] text-foreground outline-none focus:border-primary/40" /></label>
                      </div>
                      <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/[0.035] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><WalletCards className="h-4 w-4" /></span>
                          <div>
                            <div className="text-[8px] font-semibold text-foreground">Trading account</div>
                            <div className="mt-0.5 text-[7px] text-muted">Record the environment actually carrying this plan. Never enter an account number or login.</div>
                          </div>
                          <span className="ml-auto rounded-xl border border-primary/20 bg-background/45 px-3 py-1.5 text-[8px] font-semibold text-primary">{zyonTradingAccountLabel(zyonGameplanDraft.tradingAccount)}</span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                          <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">
                            Environment
                            <KwantSelect
                              value={zyonGameplanDraft.tradingAccount?.mode ?? ""}
                              onChange={(event) => setZyonGameplanDraft((current) => current ? {
                                ...current,
                                tradingAccount: tradingAccountForMode(
                                  event.target.value as ZyonTradingAccountMode,
                                  current.tradingAccount,
                                ),
                              } : current)}
                              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"
                            >
                              <option value="" disabled>Select account</option>
                              <option value="LIVE">Personal live</option>
                              <option value="SIM">Simulation</option>
                              <option value="PROP">Prop firm</option>
                            </KwantSelect>
                          </label>
                          <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">
                            Provider / firm
                            <input
                              value={zyonGameplanDraft.tradingAccount?.provider ?? ""}
                              onChange={(event) => setZyonGameplanDraft((current) => current ? {
                                ...current,
                                tradingAccount: {
                                  ...tradingAccountForMode(current.tradingAccount?.mode ?? "SIM", current.tradingAccount),
                                  provider: event.target.value.slice(0, 80),
                                },
                              } : current)}
                              placeholder="Traderify / Lucid / broker"
                              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none placeholder:text-muted/55 focus:border-primary/40"
                            />
                          </label>
                          <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">
                            Programme
                            <input
                              value={zyonGameplanDraft.tradingAccount?.program ?? ""}
                              onChange={(event) => setZyonGameplanDraft((current) => current ? {
                                ...current,
                                tradingAccount: {
                                  ...tradingAccountForMode(current.tradingAccount?.mode ?? "SIM", current.tradingAccount),
                                  program: event.target.value.slice(0, 80),
                                },
                              } : current)}
                              placeholder="Flex / Standard"
                              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none placeholder:text-muted/55 focus:border-primary/40"
                            />
                          </label>
                          <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">
                            Phase
                            <KwantSelect
                              value={zyonGameplanDraft.tradingAccount?.phase ?? ""}
                              onChange={(event) => setZyonGameplanDraft((current) => current ? {
                                ...current,
                                tradingAccount: {
                                  ...tradingAccountForMode(current.tradingAccount?.mode ?? "SIM", current.tradingAccount),
                                  phase: event.target.value as ZyonTradingAccountPhase,
                                },
                              } : current)}
                              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"
                            >
                              <option value="" disabled>Select phase</option>
                              {zyonGameplanDraft.tradingAccount?.mode === "LIVE" ? <option value="LIVE">Live</option> : null}
                              {zyonGameplanDraft.tradingAccount?.mode === "SIM" ? <option value="SIMULATION">Simulation</option> : null}
                              {zyonGameplanDraft.tradingAccount?.mode === "PROP" ? <><option value="EVALUATION">Evaluation</option><option value="FUNDED">Funded</option></> : null}
                            </KwantSelect>
                          </label>
                          <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">
                            Account size
                            <input
                              type="number"
                              min="1"
                              step="1000"
                              value={zyonGameplanDraft.tradingAccount?.size ?? ""}
                              onChange={(event) => setZyonGameplanDraft((current) => current ? {
                                ...current,
                                tradingAccount: {
                                  ...tradingAccountForMode(current.tradingAccount?.mode ?? "SIM", current.tradingAccount),
                                  size: numberOrNull(event.target.value),
                                },
                              } : current)}
                              placeholder="50000"
                              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none placeholder:text-muted/55 focus:border-primary/40"
                            />
                          </label>
                          <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">
                            Currency
                            <KwantSelect
                              value={zyonGameplanDraft.tradingAccount?.currency ?? "USD"}
                              onChange={(event) => setZyonGameplanDraft((current) => current ? {
                                ...current,
                                tradingAccount: {
                                  ...tradingAccountForMode(current.tradingAccount?.mode ?? "SIM", current.tradingAccount),
                                  currency: event.target.value as ZyonTradingAccount["currency"],
                                },
                              } : current)}
                              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"
                            >
                              {["USD", "AUD", "GBP", "EUR", "CAD"].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                            </KwantSelect>
                          </label>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Entry low<input type="number" value={zyonGameplanDraft.entryLow} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, entryLow: Number(event.target.value) } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/40" /></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Entry high<input type="number" value={zyonGameplanDraft.entryHigh} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, entryHigh: Number(event.target.value) } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/40" /></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Stop<input type="number" value={zyonGameplanDraft.stop} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, stop: Number(event.target.value) } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-danger/25 bg-background px-3 font-mono text-[9px] outline-none focus:border-danger/50" /></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Take profits<input value={zyonTargetsInput} onChange={(event) => { const value = event.target.value; setZyonTargetsInput(value); setZyonGameplanDraft((current) => current ? { ...current, targets: value.split(",").map((target) => target.trim()).filter(Boolean).map(Number).filter(Number.isFinite).slice(0, 8) } : current); }} placeholder="TP1, TP2, TP3" className="mt-1.5 h-10 w-full rounded-xl border border-primary/25 bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/50" /></label>
                      </div>
                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Reasoning<textarea value={zyonGameplanDraft.reasoning} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, reasoning: event.target.value } : current)} rows={5} className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-5 text-foreground outline-none focus:border-primary/40" /></label>
                        <div className="grid gap-2">
                          <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Confirmation<textarea value={zyonGameplanDraft.confirmation} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, confirmation: event.target.value } : current)} rows={2} className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/40" /></label>
                          <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Invalidation<textarea value={zyonGameplanDraft.invalidation} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, invalidation: event.target.value } : current)} rows={2} className="mt-1.5 w-full resize-none rounded-xl border border-danger/20 bg-background p-3 text-[9px] leading-4 outline-none focus:border-danger/40" /></label>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Confluences<textarea value={zyonConfluencesInput} onChange={(event) => { const value = event.target.value; setZyonConfluencesInput(value); setZyonGameplanDraft((current) => current ? { ...current, confluences: value.split(/\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 12) } : current); }} rows={4} placeholder="One confluence per line" className="mt-1.5 w-full resize-y rounded-xl border border-border bg-background p-3 text-[9px] leading-4 text-foreground outline-none focus:border-primary/40" /></label>
                        <label className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Additional notes <span className="normal-case tracking-normal">· optional</span><textarea value={zyonGameplanDraft.notes} onChange={(event) => setZyonGameplanDraft((current) => current ? { ...current, notes: event.target.value.slice(0, 4_000) } : current)} rows={4} placeholder="Add anything ZYON did not capture, personal reminders, execution rules or context." className="mt-1.5 w-full resize-y rounded-xl border border-primary/15 bg-primary/[0.025] p-3 text-[9px] leading-4 text-foreground outline-none placeholder:text-muted/50 focus:border-primary/40" /></label>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background/25 px-4 py-3">
                      <div className="flex items-center gap-2 text-[8px] text-muted"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Actual fills: five-minute window · future limit orders allowed</div>
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        <span className="flex h-9 items-center rounded-xl border border-warning/20 bg-warning/[0.05] px-3 text-[8px] font-semibold text-warning"><Scale className="mr-2 h-3.5 w-3.5" />SCORING</span>
                        {lockedCurrentGameplan ? <button type="button" onClick={onOpenGameplanScoring} className="flex h-9 items-center gap-2 rounded-xl border border-warning/25 bg-warning/[0.06] px-4 text-[9px] font-semibold text-warning"><Clock3 className="h-3.5 w-3.5" />Sent to Scoring</button> : <button type="button" disabled={zyonDraftLocking} onClick={() => void lockCurrentGameplan()} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background shadow-[0_0_22px_color-mix(in_srgb,var(--primary)_20%,transparent)] hover:brightness-110 disabled:cursor-wait disabled:opacity-55">{zyonDraftLocking ? <Clock3 className="h-3.5 w-3.5 animate-spin" /> : <LockKeyhole className="h-3.5 w-3.5" />}{zyonDraftLocking ? "Locking into Scoring" : "Lock today's game plan"}</button>}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden p-6 text-center">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--primary)_8%,transparent),transparent_48%)]" />
                    <div className="relative max-w-md">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface/55 text-muted"><Archive className="h-5 w-5" /></span>
                      <div className="mt-4 text-[11px] font-semibold text-foreground">No Gameplan is waiting for approval.</div>
                      <p className="mt-2 text-[8px] leading-4 text-muted">Build the next plan with ZYON and press Send Gameplan. Its completed fields will appear here automatically for your review.</p>
                      <button type="button" onClick={() => router.push(zyonGameplanLaunchHref())} className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 text-[8px] font-semibold text-primary hover:bg-primary/10"><Sparkles className="h-3.5 w-3.5" />Make Gameplan</button>
                    </div>
                  </div>
                )}
              </Card>

              {visiblePrecords.slice(0, 2).map(renderPrecordCard)}
              {!precords.length ? <Card className="border-dashed p-8 text-center"><LockKeyhole className="mx-auto h-7 w-7 text-muted" /><div className="mt-3 text-[10px] font-semibold">Your record starts before the outcome.</div><div className="mx-auto mt-1 max-w-md text-[8px] leading-4 text-muted">Send a plan from ZYON, review its pre-filled holding form, then lock it into Scoring. The platform preserves the approved version and timestamp.</div></Card> : null}
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
                <div className="flex items-center gap-2 border-b border-border px-4 py-3"><UsersRound className="h-4 w-4 text-primary" /><h3 className="text-[10px] font-semibold">Live on your Desk</h3><span className="ml-auto text-[7px] text-muted">{myLiveDesks.length ? `${myLiveDesks.length} active Desk${myLiveDesks.length === 1 ? "" : "s"}` : deskNetwork.ready ? "No active Desk" : "Syncing Desks"}</span></div>
                <div className="p-3">
                  {myLiveDesks.length ? myLiveDesks.slice(0, 2).map((desk) => {
                    const memberCount = new Set(deskNetwork.members.filter((member) => member.deskId === desk.deskId).map((member) => member.userId)).size;
                    return <button key={desk.deskId} type="button" onClick={() => setTab("desks")} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-border bg-surface/35 p-3 text-left hover:border-primary/25"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Network className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-semibold">{desk.name}</span><span className="mt-1 block truncate text-[7px] text-muted">{desk.objective}</span></span><span className="font-mono text-[8px] text-primary">{memberCount}/{desk.capacity}</span></button>;
                  }) : deskNetwork.ready ? <div className="rounded-xl border border-dashed border-border p-5 text-center"><div className="text-[9px] font-semibold">Find the people who trade your hours.</div><div className="mt-1 text-[7px] leading-4 text-muted">Desks are intentionally small: compatible markets, session, timezone, and improvement objective.</div><button type="button" onClick={() => setShowDeskModal(true)} className="mt-3 rounded-lg border border-primary/25 bg-primary/[0.07] px-3 py-2 text-[8px] font-semibold text-primary">Create a Desk</button></div> : <div className="rounded-xl border border-border bg-surface/30 p-5 text-center text-[8px] text-muted">Connecting your active Desks...</div>}
                </div>
              </Card>
            </div>
          </div>
        ) : null}

        {tab === "reasoning" ? (
          <div className="mx-auto max-w-6xl space-y-3 p-3">
            <Card className="relative overflow-hidden p-5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_0%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_42%)]" />
              <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
                <div>
                  <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-primary"><BrainCircuit className="h-4 w-4" />My Reasoning</div>
                  <h2 className="mt-3 text-[26px] font-semibold tracking-[-0.04em] text-foreground">Every thesis, measured against what price did next.</h2>
                  <p className="mt-2 max-w-2xl text-[10px] leading-5 text-muted">Orange records are still live. Completed records turn green and contribute to the account’s Reasoning Score using plan quality, directional progress, adverse excursion, capture efficiency, realised R and target completion.</p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-border bg-background/35 p-3"><div className="font-mono text-[19px] font-semibold text-foreground">{myReasoningRecords.length}</div><div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-muted">All plans</div></div>
                    <div className="rounded-xl border border-warning/20 bg-warning/[0.035] p-3"><div className="font-mono text-[19px] font-semibold text-warning">{myReasoningRecords.filter((record) => !receipts.some((receipt) => receipt.parentId === record.id)).length}</div><div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-muted">In progress</div></div>
                    <div className="rounded-xl border border-accent/20 bg-accent/[0.035] p-3"><div className="font-mono text-[19px] font-semibold text-accent">{myReasoningRecords.filter((record) => receipts.some((receipt) => receipt.parentId === record.id)).length}</div><div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-muted">Complete</div></div>
                  </div>
                </div>
                <ReasoningScoreBar value={myReasoningScore} waiting={myReasoningScore === null} />
              </div>
            </Card>

            {myReasoningRecords.length ? myReasoningRecords.map((record) => {
              const plan = typedPayload<SocialPrecordPayload>(record);
              const receipt = typedPayload<SocialReceiptPayload>(receipts.find((candidate) => candidate.parentId === record.id));
              const metrics = receipt?.pathMetrics;
              if (!plan) return null;
              return (
                <div key={`reasoning:${objectKey(record)}`} className={`rounded-2xl border ${receipt ? "border-accent/25 shadow-[0_0_24px_color-mix(in_srgb,var(--accent)_7%,transparent)]" : "border-warning/25 shadow-[0_0_24px_color-mix(in_srgb,var(--warning)_6%,transparent)]"}`}>
                  <div className={`flex flex-wrap items-center gap-2 rounded-t-2xl border-b px-4 py-2.5 ${receipt ? "border-accent/15 bg-accent/[0.04]" : "border-warning/15 bg-warning/[0.04]"}`}>
                    <span className={`h-2 w-2 rounded-full ${receipt ? "bg-accent shadow-[0_0_10px_var(--accent)]" : "animate-pulse bg-warning shadow-[0_0_10px_var(--warning)]"}`} />
                    <span className={`text-[8px] font-semibold uppercase tracking-[0.14em] ${receipt ? "text-accent" : "text-warning"}`}>{receipt ? "Complete" : "In progress"}</span>
                    {metrics ? <div className="ml-auto flex flex-wrap gap-3 font-mono text-[7px] text-muted"><span>{metrics.pointsInDirection.toFixed(2)} pts</span><span>{metrics.adverseExcursion.toFixed(2)} MAE</span><span>{metrics.ticksCaught.toFixed(0)} ticks</span><span>{metrics.realisedR.toFixed(2)}R</span><span>{Math.round(metrics.durationSeconds / 60)} min</span></div> : <span className="ml-auto text-[7px] text-muted">Waiting for entry, target, or stop evidence</span>}
                  </div>
                  <div className="bg-panel p-3 pb-0">
                    <ReasoningOutcomeChart
                      instrument={plan.instrument}
                      lockedAt={plan.lockedAt}
                      entryLow={plan.plannedEntryLow}
                      entryHigh={plan.plannedEntryHigh}
                      stop={plan.plannedStop}
                      targets={plan.plannedTargets?.length ? plan.plannedTargets : plan.plannedTarget === null ? [] : [plan.plannedTarget]}
                      height={190}
                    />
                  </div>
                  {renderPrecordCard(record)}
                </div>
              );
            }) : (
              <Card className="border-dashed p-10 text-center">
                <BrainCircuit className="mx-auto h-8 w-8 text-muted" />
                <div className="mt-3 text-[11px] font-semibold text-foreground">No reasoning records yet</div>
                <p className="mx-auto mt-2 max-w-md text-[8px] leading-4 text-muted">Press Send Gameplan in ZYON. Review the pre-filled holding form, adjust anything required, then lock it into Scoring.</p>
                <button type="button" onClick={() => setTab("today")} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-[8px] font-semibold text-background">Open holding page</button>
              </Card>
            )}
          </div>
        ) : null}

        {tab === "precords" ? (
          <div className="mx-auto max-w-6xl space-y-3 p-3">
            <Card className="relative overflow-hidden p-5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,color-mix(in_srgb,var(--primary)_13%,transparent),transparent_40%)]" />
              <div className="relative flex flex-wrap items-end gap-4">
                <div className="max-w-2xl"><div className="text-[7px] font-semibold uppercase tracking-[0.15em] text-primary">Evidence-backed community</div><h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em]">Share the complete decision—not a naked prediction.</h2><p className="mt-2 text-[9px] leading-5 text-muted">Every published record carries its source Gameplan, immutable timestamp, actual execution, evidence state and review context. The next decision remains individual.</p></div>
                <div className="ml-auto flex flex-wrap gap-2"><button type="button" onClick={() => openNewPost("REVIEW REQUEST")} className="flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 text-[8px] font-semibold text-primary"><MessageCircle className="h-3.5 w-3.5" />Request a review</button><button type="button" onClick={() => setTab("today")} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background"><ArrowRight className="h-3.5 w-3.5" />Open today’s Gameplan</button></div>
              </div>
            </Card>
            <Card className="flex flex-wrap items-center gap-2 p-3">
              <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records by instrument, context, evidence or trader" className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-[8px] outline-none focus:border-primary/40" /></div>
              {(["all", "proven", "mine"] as FeedFilter[]).map((filter) => <button key={filter} type="button" onClick={() => setFeedFilter(filter)} className={`h-8 rounded-lg px-3 text-[8px] font-semibold capitalize ${feedFilter === filter ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}>{filter}</button>)}
            </Card>
            <div className="mx-auto max-w-4xl space-y-3">
              {visiblePrecords.map(renderPrecordCard)}
              {!visiblePrecords.length ? <Card className="border-dashed p-14 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-muted" /><h2 className="mt-4 text-[13px] font-semibold">No Decision Records match this view.</h2><p className="mx-auto mt-2 max-w-md text-[8px] leading-4 text-muted">Records begin with the existing Gameplan, then gain their execution and evidence after the outcome.</p><button type="button" onClick={() => setTab("today")} className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-[8px] font-semibold text-background">Open today’s Gameplan</button></Card> : null}
              {feedFilter === "all" ? posts.filter((post) => post.scope !== "private" || post.userId === resolvedAccountKey).slice(0, 6).map(renderStructuredPost) : null}
            </div>
          </div>
        ) : null}

        {tab === "feed" ? (
          <div className="mx-auto grid max-w-7xl gap-3 p-3 xl:grid-cols-[minmax(0,820px)_320px]">
            <div className="min-w-0 space-y-3">
              <Card className="relative overflow-hidden p-5">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_0%,color-mix(in_srgb,var(--primary)_15%,transparent),transparent_42%)]" />
                <div className="relative flex flex-wrap items-end gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[7px] font-semibold uppercase tracking-[0.16em] text-primary"><Heart className="h-3.5 w-3.5" />Your market network</div>
                    <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em]">Gameplans, observations and traders worth following.</h2>
                    <p className="mt-2 max-w-2xl text-[9px] leading-5 text-muted">Following controls this feed only. Friend requests remain separate and unlock private chat and Desk invitations.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openNewPost()} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background hover:brightness-110"><Plus className="h-3.5 w-3.5" />Create post</button>
                    <button type="button" onClick={openOneLinerComposer} className="flex h-10 items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 text-[8px] font-semibold text-primary transition-colors hover:bg-primary/10"><Zap className="h-3.5 w-3.5" />Create one-liner</button>
                  </div>
                </div>
                <div className="relative mt-4 grid grid-cols-3 gap-1 rounded-xl border border-border bg-background/35 p-1 sm:grid-cols-5">
                  {([
                    ["feed", "Feed", Compass],
                    ["posts", "My posts", MessageCircle],
                    ["liked", "Liked", Heart],
                    ["reposts", "Reposts", Repeat2],
                    ["saved", "Saved", Bookmark],
                  ] as Array<[SocialFeedCollection, string, typeof Compass]>).map(([collection, label, Icon]) => (
                    <button key={collection} type="button" onClick={() => setSocialFeedCollection(collection)} className={`flex h-9 items-center justify-center gap-2 rounded-lg px-2 text-[8px] font-semibold transition-colors ${socialFeedCollection === collection ? "bg-primary/12 text-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_12%,transparent)]" : "text-muted hover:bg-surface hover:text-foreground"}`}>
                      <Icon className={`h-3.5 w-3.5 ${collection === "liked" && socialFeedCollection === collection ? "fill-current" : ""}`} />{label}
                    </button>
                  ))}
                </div>
                {socialFeedCollection === "feed" ? (
                  <div className="relative mt-2 flex gap-1 rounded-xl border border-border bg-background/35 p-1">
                    {(["following", "recommended", "latest"] as SocialFeedMode[]).map((mode) => <button key={mode} type="button" onClick={() => setSocialFeedMode(mode)} className={`flex h-8 flex-1 items-center justify-center rounded-lg px-3 text-[8px] font-semibold capitalize transition-colors ${socialFeedMode === mode ? "bg-primary/12 text-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_10%,transparent)]" : "text-muted hover:bg-surface hover:text-foreground"}`}>{mode}</button>)}
                  </div>
                ) : null}
                {socialFeedCollection === "liked" || socialFeedCollection === "reposts" || socialFeedCollection === "saved" ? (() => {
                  const visibilityKey: "likes" | "reposts" | "saves" = socialFeedCollection === "liked" ? "likes" : socialFeedCollection === "saved" ? "saves" : "reposts";
                  const visibility = currentProfile.visibility[visibilityKey];
                  return (
                    <div className="relative mt-2 flex items-center gap-3 rounded-xl border border-border bg-background/35 px-3 py-2">
                      {visibility === "community" ? <Globe2 className="h-3.5 w-3.5 text-primary" /> : <LockKeyhole className="h-3.5 w-3.5 text-muted" />}
                      <div className="min-w-0 flex-1"><div className="text-[8px] font-semibold text-foreground">Show {socialFeedCollection} on my profile</div><div className="mt-0.5 text-[7px] text-muted">{visibility === "community" ? "Anyone can open this collection." : "Only you can see this collection."}</div></div>
                      <button type="button" onClick={() => void updateCollectionVisibility(visibilityKey, visibility === "community" ? "private" : "community")} className={`h-8 rounded-lg border px-3 text-[7px] font-semibold transition-colors ${visibility === "community" ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-surface text-muted hover:text-foreground"}`}>{visibility === "community" ? "Public" : "Only me"}</button>
                    </div>
                  );
                })() : null}
              </Card>

              <Card className="flex items-center gap-3 p-3">
                <Avatar label={currentProfile.displayName} avatarUrl={currentProfile.avatarUrl} />
                <button type="button" onClick={() => openNewPost()} className="h-10 min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 text-left text-[9px] text-muted transition-colors hover:border-primary/30 hover:text-foreground">Share a market observation, chart or question…</button>
                <button type="button" onClick={() => openNewPost("MAP")} className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-[8px] font-semibold text-muted hover:text-foreground"><ImageIcon className="h-3.5 w-3.5" />Chart post</button>
              </Card>

              {followingState === "unavailable" ? <Card className="border-warning/25 bg-warning/[0.04] p-4 text-[8px] leading-4 text-warning">Follower storage is not available in this Supabase project yet. Community posts remain visible under Latest while the account-backed follow migration is applied.</Card> : null}

              <div className="space-y-3">
                {socialFeedObjects.map((object) => object.objectType === "precord" ? renderPrecordCard(object) : renderStructuredPost(object))}
                {!socialFeedObjects.length ? (
                  <Card className="border-dashed p-12 text-center">
                    <Heart className="mx-auto h-8 w-8 text-muted" />
                    <h3 className="mt-4 text-[12px] font-semibold">{socialFeedCollection === "feed" ? (socialFeedMode === "following" ? "Your Following feed is ready." : "No posts match this view yet.") : `Your ${socialFeedCollection} collection is empty.`}</h3>
                    <p className="mx-auto mt-2 max-w-md text-[8px] leading-4 text-muted">{socialFeedCollection === "feed" ? (socialFeedMode === "following" ? "Follow traders from Recommended or open a profile and press Follow. Their new posts and completed Gameplans will appear here automatically." : "Create the first structured market post or return when the network has new activity.") : `Items appear here automatically when you ${socialFeedCollection === "posts" ? "publish them" : socialFeedCollection === "liked" ? "like them" : socialFeedCollection === "reposts" ? "repost them" : "save them"}.`}</p>
                    <div className="mt-5 flex justify-center gap-2">{socialFeedCollection === "feed" ? <button type="button" onClick={() => setSocialFeedMode("recommended")} className="rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-2.5 text-[8px] font-semibold text-primary">Find traders</button> : <button type="button" onClick={() => setSocialFeedCollection("feed")} className="rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-2.5 text-[8px] font-semibold text-primary">Back to feed</button>}<button type="button" onClick={() => openNewPost()} className="rounded-xl bg-primary px-4 py-2.5 text-[8px] font-semibold text-background">Create post</button></div>
                  </Card>
                ) : null}
              </div>
            </div>

            <aside className="space-y-3 xl:sticky xl:top-3 xl:self-start">
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3"><UsersRound className="h-4 w-4 text-primary" /><div><h3 className="text-[10px] font-semibold">Connections for you</h3><p className="mt-0.5 text-[7px] text-muted">Ranked by mutuals, shared Desks, markets and profiles you revisited.</p></div></div>
                <div className="divide-y divide-border/60">
                  {suggestedProfiles.map((recommendation) => {
                    const isFollowing = followingUserIds.has(recommendation.userId);
                    const profile = profileByUserId.get(recommendation.userId);
                    return (
                    <div key={recommendation.userId} className="flex items-center gap-2.5 p-3">
                      <button type="button" onClick={() => onOpenProfile?.(recommendation.handle)}><Avatar label={recommendation.displayName} avatarUrl={recommendation.avatarUrl} size="sm" statusClassName={profile ? presenceOption(effectivePresenceStatus(profile.presenceStatus, profile.lastSeenAt)).dotClassName : undefined} /></button>
                      <button type="button" onClick={() => onOpenProfile?.(recommendation.handle)} className="min-w-0 flex-1 text-left"><span className="block truncate text-[8px] font-semibold text-foreground">{recommendation.displayName}</span><span className="mt-0.5 block truncate text-[7px] text-muted">@{recommendation.handle}</span><span className="mt-1 block truncate text-[6.5px] font-medium text-primary/80">{recommendation.reason}</span></button>
                      <button type="button" onClick={() => void updateFeedFollow(recommendation.userId, isFollowing)} disabled={followActionUserIds.has(recommendation.userId)} aria-busy={followActionUserIds.has(recommendation.userId)} className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[7px] font-semibold transition-colors disabled:cursor-default ${isFollowing ? "border-border bg-surface text-muted hover:text-foreground" : "border-primary/25 bg-primary/[0.07] text-primary"}`}>{isFollowing ? <Check className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}{isFollowing ? "Following" : "Follow"}</button>
                    </div>
                    );
                  })}
                  {recommendationState === "loading" ? <div className="flex items-center justify-center gap-2 p-5 text-[8px] text-muted"><span className="h-3.5 w-3.5 animate-spin rounded-full border border-primary/25 border-t-primary" />Calculating relevant connections…</div> : null}
                  {recommendationState !== "loading" && !suggestedProfiles.length ? <div className="p-5 text-center text-[8px] leading-4 text-muted">No relevant connection suggestions yet. Mutuals and profile activity will refine this automatically.</div> : null}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-[7px] font-semibold uppercase tracking-[0.14em] text-primary">Two different connections</div>
                <div className="mt-3 space-y-3 text-[8px] leading-4 text-muted"><p><strong className="text-foreground">Follow</strong> — see public posts and Gameplans in this feed. Either trader can follow or unfollow independently.</p><p><strong className="text-foreground">Friend</strong> — a two-way accepted relationship for private messages, group chats and quick Desk invitations.</p></div>
              </Card>
            </aside>
          </div>
        ) : null}

        <ReactActivity mode={tab === "desks" ? "visible" : "hidden"}>
          <div className="h-full min-h-0 p-3">
            <DeskWorkspace
              viewerId={resolvedAccountKey}
              viewerProfile={currentProfile}
              onCreateDesk={() => setShowDeskModal(true)}
              onNotice={setNotice}
              onOpenProfile={onOpenProfile}
              onMessageProfile={onMessageProfile}
            />
          </div>
        </ReactActivity>

        {false ? (
          <div className="mx-auto max-w-6xl space-y-3 p-3">
            <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                <Card className="relative overflow-hidden p-5"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_36%)]" /><div className="relative flex flex-wrap items-center gap-4"><div><div className="text-[7px] font-semibold uppercase tracking-[0.15em] text-primary">Small groups · repeated contact · shared standards</div><h2 className="mt-2 text-[21px] font-semibold tracking-[-0.03em]">A feed gives reach. A Desk creates belonging.</h2><p className="mt-2 max-w-2xl text-[9px] leading-5 text-muted">Five to twelve compatible traders preparing, observing, and reviewing the same session without copying each other’s decisions.</p></div><button type="button" onClick={() => setShowDeskModal(true)} className="ml-auto flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background"><Plus className="h-3.5 w-3.5" />Create a Desk</button></div></Card>
                {myDesks.map((desk) => {
                  const payload = typedPayload<SocialDeskPayload>(desk);
                  const deskMembers = memberships.filter((member) => member.deskId === desk.id);
                  return <Card key={objectKey(desk)} className="overflow-hidden"><div className="flex items-start gap-3 border-b border-border p-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Network className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-semibold">{payload?.name}</h3><span className="rounded-lg border border-border bg-surface px-2 py-1 text-[7px] text-muted">{payload?.privacy}</span></div><p className="mt-1 text-[8px] leading-4 text-muted">{payload?.description || payload?.objective}</p></div><span className="font-mono text-[10px] text-primary">{deskMembers.length}/{payload?.capacity ?? 12}</span></div><div className="grid gap-3 p-4 md:grid-cols-[1fr_220px]"><div><div className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Weekly objective</div><div className="mt-2 rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-[9px] leading-4 text-foreground">{payload?.weeklyMission}</div><div className="mt-4 grid grid-cols-3 gap-2">{deskMembers.slice(0, 6).map((member) => { const memberPayload = typedPayload<SocialDeskMemberPayload>(member); const memberProfile = profileByUserId.get(member.userId); return <div key={objectKey(member)} className="flex items-center gap-2 rounded-xl border border-border bg-surface/30 p-2"><Avatar label={member.authorLabel} avatarUrl={memberProfile?.avatarUrl} size="sm" statusClassName={memberProfile ? presenceOption(effectivePresenceStatus(memberProfile.presenceStatus, memberProfile.lastSeenAt)).dotClassName : "bg-zinc-500"} /><span className="min-w-0"><span className="block truncate text-[8px] font-semibold">{member.authorLabel}</span><span className="block text-[7px] text-muted">{memberPayload?.status}</span></span></div>; })}</div></div><div className="space-y-3"><ScoreBar label="Preparation completion" value={deskMembers.length ? 72 : 0} /><ScoreBar label="Review integrity" value={deskMembers.length ? 64 : 0} /><ScoreBar label="Helpful reviews" value={deskMembers.length ? 58 : 0} /><div className="rounded-xl border border-border bg-background/30 p-3 text-[7px] leading-4 text-muted">Desk rankings measure shared process. P&amp;L is not part of the score.</div></div></div></Card>;
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
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
                <Trophy className="h-4 w-4 text-primary" />
                <div>
                  <h2 className="text-[11px] font-semibold">Process rankings</h2>
                  <p className="mt-0.5 text-[8px] text-muted">Verified process evidence from this season. P&amp;L never enters the score.</p>
                </div>
                <div className="ml-auto flex gap-1">
                  {([['desk', 'My Desk'], ['friends', 'Friends'], ['season', 'This season']] as Array<[RankingScope, string]>).map(([scope, label]) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setRankingScope(scope)}
                      className={`rounded-lg px-3 py-2 text-[8px] font-semibold transition-colors ${rankingScope === scope ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-surface/20 px-4 py-2">
                {rankingScope === "desk" && rankingDeskOptions.length > 1 ? (
                  <KwantSelect
                    value={rankingDeskId}
                    onChange={(event) => {
                      setRankingDeskId(event.target.value);
                      window.localStorage.setItem("kwantdesk-active-desk", event.target.value);
                    }}
                    className="h-8 min-w-[180px] rounded-lg border border-border bg-background px-3 text-[8px] font-semibold outline-none"
                    aria-label="Select Desk ranking"
                  >
                    {rankingDeskOptions.map((workspace) => <option key={workspace.deskId} value={workspace.deskId}>{workspace.name}</option>)}
                  </KwantSelect>
                ) : null}
                <span className="text-[7px] text-muted">
                  {rankingScope === "desk"
                    ? `${rankingDeskOptions.find((workspace) => workspace.deskId === rankingDeskId)?.name ?? "No Desk selected"} · current members only`
                    : rankingScope === "friends"
                      ? `${rankingFriends.length} accepted friend${rankingFriends.length === 1 ? "" : "s"}`
                      : `Platform-wide · ${rankingSeason.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${rankingSeason.end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
                </span>
                <span className="ml-auto text-[6px] uppercase tracking-[0.1em] text-muted/70">
                  {rankingDirectoryState === "loading" ? "Syncing membership" : rankingDirectoryState === "unavailable" ? "Directory reconnecting" : PROCESS_REPUTATION_VERSION}
                </span>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[52px_240px_repeat(8,1fr)_72px] border-b border-border px-4 py-2 text-[7px] font-semibold uppercase tracking-[0.09em] text-muted"><span>Rank</span><span>Trader</span>{SCORE_LABELS.map(([, label]) => <span key={label} className="text-center">{label.split(" ")[0]}</span>)}<span className="text-right">Index</span></div>
                  {rankedProfiles.map(({ userId, profile, reputation }, index) => (
                    <div key={userId} className="grid grid-cols-[52px_240px_repeat(8,1fr)_72px] items-center border-b border-border/55 px-4 py-3 text-[8px] transition-colors hover:bg-surface/25">
                      <span className={`font-mono text-[12px] font-semibold ${index < 3 ? "text-primary" : "text-muted"}`}>{String(index + 1).padStart(2, "0")}</span>
                      <button
                        type="button"
                        onClick={() => onOpenProfile?.(profile.handle)}
                        className="group flex min-w-0 items-center gap-3 rounded-xl py-1 pr-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                        title={`View @${profile.handle}`}
                      >
                        <UserAvatar
                          label={profile.displayName}
                          avatarUrl={profile.avatarUrl}
                          size="md"
                          statusClassName={presenceOption(effectivePresenceStatus(
                            profile.presenceStatus,
                            profile.lastSeenAt,
                          )).dotClassName}
                          className="rounded-full ring-1 ring-primary/15 transition group-hover:ring-primary/45"
                        />
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[9px] font-semibold text-foreground group-hover:text-primary">{profile.displayName}</span>
                            <ActivityStreakBadge streak={profile.activityStreak} lastSeenAt={profile.lastSeenAt} timeZone={profile.timezone} compact />
                          </span>
                          <span className="mt-0.5 block truncate text-[7px] text-muted">@{profile.handle} · {profile.markets.join("/")}</span>
                          <span className="mt-0.5 block text-[6px] uppercase tracking-[0.1em] text-muted/70">
                            {presenceOption(effectivePresenceStatus(profile.presenceStatus, profile.lastSeenAt)).label} · {reputation.completedRecords} completed · {reputation.lockedPlans} plans
                          </span>
                        </span>
                      </button>
                      {SCORE_LABELS.map(([key]) => <span key={key} className="text-center font-mono text-muted">{reputation.scores[key] || "—"}</span>)}
                      <span className="text-right font-mono text-[11px] font-semibold text-primary">{reputation.index || "—"}</span>
                    </div>
                  ))}
                  {rankedProfiles.length === 0 ? (
                    <div className="flex min-h-32 items-center justify-center px-6 text-center text-[8px] leading-5 text-muted">
                      {rankingScope === "desk"
                        ? rankingDeskId ? "This Desk has no current members to rank." : "Join or create a Desk to see its current member ranking."
                        : rankingScope === "friends"
                          ? "Accepted friends will appear here once connected."
                          : "No eligible platform profiles are available for this season yet."}
                    </div>
                  ) : null}
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
            <Card className="relative overflow-hidden p-5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_0%,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_42%)]" />
              <div className="relative flex flex-wrap items-end gap-4"><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[7px] font-semibold uppercase tracking-[0.16em] text-primary"><Award className="h-3.5 w-3.5" />Calling Card collection</div><h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em]">Your trading identity, earned on record.</h2><p className="mt-2 max-w-2xl text-[9px] leading-5 text-muted">Every account begins with Origin Signal. The remaining cards unlock from verifiable process, discipline, contribution and adaptation—not a single profit screenshot.</p></div><div className="rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3 text-right"><div className="font-mono text-[22px] font-semibold text-primary">{earnedCardCodes.size}/10</div><div className="mt-1 text-[7px] uppercase tracking-[0.13em] text-muted">Unlocked</div></div></div>
            </Card>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
              <Card className="overflow-hidden p-4">
                <div className="flex items-center gap-2 pb-3"><Sparkles className="h-4 w-4 text-primary" /><div><h3 className="text-[10px] font-semibold">Active profile banner</h3><p className="mt-0.5 text-[7px] text-muted">This animated card is shown across the top of your public profile.</p></div></div>
                <CallingCardVisual definition={equippedCallingCard} ownerName={currentProfile.displayName} />
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h3 className="text-[10px] font-semibold">How cards work</h3></div>
                <div className="mt-4 space-y-3 text-[8px] leading-4 text-muted"><p><strong className="text-foreground">Identity layer.</strong> The card becomes the banner on your profile and travels with your public record.</p><p><strong className="text-foreground">Verified unlocks.</strong> Rules are calculated from account-backed Gameplans, receipts, streaks and accepted reviews.</p><p><strong className="text-foreground">Generated artwork.</strong> New artwork can be produced from a reference image and dropped into this same 3D motion shell.</p></div>
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-[7px] leading-4 text-muted"><strong className="text-primary">Origin Signal</strong> is permanent and can always be re-equipped.</div>
              </Card>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {CALLING_CARD_CATALOG.map((definition) => {
                const earnedObject = cards.find((card) => card.userId === resolvedAccountKey && typedPayload<SocialCardPayload>(card)?.code === definition.code);
                const earned = typedPayload<SocialCardPayload>(earnedObject);
                const unlocked = earnedCardCodes.has(definition.code);
                const selected = equippedCallingCard.code === definition.code;
                return (
                  <Card key={definition.code} className={`overflow-hidden p-3 ${selected ? "border-primary/35 shadow-[0_0_24px_color-mix(in_srgb,var(--primary)_8%,transparent)]" : unlocked ? "border-primary/20" : ""}`}>
                    <CallingCardVisual definition={definition} ownerName={currentProfile.displayName} locked={!unlocked} earnedLabel={earned ? `EARNED ${formatDate(earned.earnedAt).toUpperCase()}` : definition.starter ? "FOUNDING ISSUE" : ""} />
                    <div className="flex items-center gap-3 px-1 pb-1 pt-3"><div className="min-w-0 flex-1"><div className="text-[9px] font-semibold text-foreground">{definition.name}</div><div className="mt-1 text-[7px] leading-4 text-muted">{unlocked ? definition.description : definition.requirement}</div></div>{unlocked ? <button type="button" onClick={() => void equipCallingCard(definition)} disabled={selected} className={`h-8 shrink-0 rounded-lg px-3 text-[7px] font-semibold ${selected ? "border border-primary/25 bg-primary/10 text-primary" : "bg-primary text-background hover:brightness-110"}`}>{selected ? "On profile" : "Use banner"}</button> : <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[7px] font-semibold text-muted"><LockKeyhole className="h-3 w-3" />Locked</span>}</div>
                  </Card>
                );
              })}
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
                    <div className="min-w-0"><h2 className="truncate text-[18px] font-semibold">{profileDraft.displayName}</h2><div className="mt-1 text-[9px] text-primary">@{profileDraft.handle}</div><button type="button" onClick={() => avatarInputRef.current?.click()} className="mt-2 text-[7px] font-semibold text-muted hover:text-primary">Change profile photo</button><div className="mt-1 text-[7px] text-muted">Cropped and published at 1080 × 1080.</div><div className="mt-2 flex flex-wrap gap-1">{profileDraft.markets.map((market) => <span key={market} className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[7px] font-semibold text-primary">{market}</span>)}</div></div>
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
                  {[["Display name", "displayName"], ["Handle", "handle"], ["Where you live — optional", "location"], ["Occupation or role — optional", "occupation"], ["Interests — optional", "interests"], ["Markets — comma separated", "markets"], ["Session", "session"], ["Timezone", "timezone"], ["Experience", "experience"], ["Trading style", "style"], ["Favourite theme", "favouriteTheme"], ["Strongest discipline", "strongestDiscipline"], ["Current blind spot", "currentBlindSpot"]].map(([label, key]) => <label key={key} className="block"><span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</span><input value={key === "markets" ? profileDraft.markets.join(", ") : String(profileDraft[key as keyof SocialProfilePayload])} onChange={(event) => setProfileDraft((current) => ({ ...current, [key]: key === "markets" ? event.target.value.split(",").map((market) => market.trim()) : event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" /></label>)}
                  <label className="block md:col-span-2"><span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Current improvement objective</span><textarea value={profileDraft.improvementObjective} onChange={(event) => setProfileDraft((current) => ({ ...current, improvementObjective: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/40" /></label>
                  <label className="block md:col-span-2"><span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Bio / about you</span><textarea value={profileDraft.bio} onChange={(event) => setProfileDraft((current) => ({ ...current, bio: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/40" /></label>
                  <label className="block"><span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Contact email</span><input type="email" value={profileDraft.contactEmail ?? ""} onChange={(event) => setProfileDraft((current) => ({ ...current, contactEmail: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" /></label>
                  <label className="block"><span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Website</span><input type="url" placeholder="https://" value={profileDraft.websiteUrl ?? ""} onChange={(event) => setProfileDraft((current) => ({ ...current, websiteUrl: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" /></label>
                  <label className="flex items-center gap-3 rounded-xl border border-border bg-background/35 p-3 md:col-span-2"><input type="checkbox" checked={Boolean(profileDraft.showContactEmail)} onChange={(event) => setProfileDraft((current) => ({ ...current, showContactEmail: event.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /><span><span className="block text-[8px] font-semibold text-foreground">Show contact email publicly</span><span className="mt-0.5 block text-[7px] text-muted">Leave this off if messages should stay inside Kwant Desk.</span></span></label>
                  <label className="block md:col-span-2">
                    <span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Calling Card banner</span>
                    <KwantSelect value={profileDraft.callingCardCode ?? ""} onChange={(event) => setProfileDraft((current) => ({ ...current, callingCardCode: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none">
                      <option value="origin-signal">Origin Signal · default</option>
                      {cards.filter((card) => card.userId === resolvedAccountKey).map((card) => typedPayload<SocialCardPayload>(card)).filter((card): card is SocialCardPayload => card !== null).filter((card) => card.public !== false && card.code !== "origin-signal").map((card) => <option key={card.code} value={card.code}>{card.name}</option>)}
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
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <h3 className="text-[10px] font-semibold">Privacy controls</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {([
                      ["profile", "Identity card"],
                      ["activity", "Activity"],
                      ["scores", "Process scores"],
                      ["cards", "Calling Cards"],
                    ] as Array<["profile" | "activity" | "scores" | "cards", string]>).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 text-[8px] text-muted">{label}</span>
                        <KwantSelect
                          value={profileDraft.visibility[key]}
                          onChange={(event) => setProfileDraft((current) => ({
                            ...current,
                            visibility: {
                              ...current.visibility,
                              [key]: event.target.value as SocialScope,
                            },
                          }))}
                          className="h-8 rounded-lg border border-border bg-surface px-2 text-[8px] outline-none"
                        >
                          <option value="private">Private</option>
                          <option value="friends">Friends</option>
                          <option value="desk">My Desk</option>
                          <option value="community">Community</option>
                        </KwantSelect>
                      </div>
                    ))}
                  </div>
                  <div className="my-4 h-px bg-border" />
                  <div className="space-y-3">
                    {([
                      ["followers", "Who follows me"],
                      ["following", "Who I follow"],
                    ] as Array<["followers" | "following", string]>).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 text-[8px] text-muted">{label}</span>
                        <KwantSelect
                          value={profileDraft.visibility[key]}
                          onChange={(event) => setProfileDraft((current) => ({
                            ...current,
                            visibility: {
                              ...current.visibility,
                              [key]: event.target.value === "private" ? "private" : "community",
                            },
                          }))}
                          className="h-8 rounded-lg border border-border bg-surface px-2 text-[8px] outline-none"
                        >
                          <option value="community">Visible</option>
                          <option value="private">Private</option>
                        </KwantSelect>
                      </div>
                    ))}
                    <p className="text-[7px] leading-4 text-muted">Follower and following counts always remain public. These controls only hide the account lists.</p>
                  </div>
                  <div className="my-4 h-px bg-border" />
                  <div className="space-y-3">
                    <div className="text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Social collections</div>
                    {([
                      ["likes", "Liked posts"],
                      ["reposts", "Reposts"],
                      ["saves", "Saved posts"],
                    ] as Array<["likes" | "reposts" | "saves", string]>).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 text-[8px] text-muted">{label}</span>
                        <KwantSelect
                          value={profileDraft.visibility[key]}
                          onChange={(event) => setProfileDraft((current) => ({
                            ...current,
                            visibility: { ...current.visibility, [key]: event.target.value === "community" ? "community" : "private" },
                          }))}
                          className="h-8 rounded-lg border border-border bg-surface px-2 text-[8px] outline-none"
                        >
                          <option value="community">Public</option>
                          <option value="private">Only me</option>
                        </KwantSelect>
                      </div>
                    ))}
                    <p className="text-[7px] leading-4 text-muted">Each collection can be shown on your public profile or kept visible only to you.</p>
                  </div>
                  <div className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-[7px] leading-4 text-muted">
                    <ShieldCheck className="mb-2 h-4 w-4 text-primary" />
                    Evidence remains private unless the record explicitly shares it. Broker credentials are never stored here.
                  </div>
                </Card>
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
              receipts={receipts}
              cards={cards}
              comments={comments}
              collections={{
                posts: viewedProfilePosts,
                liked: viewedProfileLiked,
                reposts: viewedProfileReposts,
                saved: viewedProfileSaved,
              }}
              reasoningScore={reasoningScoreFromReceipts(receipts, viewedProfileObject.userId)}
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
              onOpenProfile={onOpenProfile}
              onCollectionVisibilityChange={(key, visibility) => void updateCollectionVisibility(key, visibility)}
              initialPostId={requestedProfilePostId}
            />
          ) : requestedProfileHandle && requestedProfileState === "error" ? (
            <ProfileOpeningState
              preview={requestedProfilePreview}
              failed
              onBack={onCloseProfile}
            />
          ) : requestedProfileHandle && requestedProfileState !== "missing" ? (
            <ProfileOpeningState
              preview={requestedProfilePreview}
              onBack={onCloseProfile}
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

      {commentPanelPost ? (
        <div className="fixed inset-0 z-[1170] bg-black/48 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) { setCommentPanelPostId(null); setCommentReplyToId(null); } }}>
          <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-[470px] flex-col border-l border-border bg-panel shadow-2xl shadow-black/70">
            <div className="flex items-start gap-3 border-b border-border px-4 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><MessageCircle className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><h2 className="text-[12px] font-semibold text-foreground">Trade comments</h2><p className="mt-1 text-[8px] text-muted">{commentPanelComments.length} comment{commentPanelComments.length === 1 ? "" : "s"} · replies stay attached to their thread</p></div>
              <button type="button" onClick={() => { setCommentPanelPostId(null); setCommentReplyToId(null); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="border-b border-border bg-background/25 px-4 py-3">
              <div className="flex items-center gap-2"><span className="font-mono text-[10px] font-semibold text-foreground">{typedPayload<SocialPostPayload>(commentPanelPost)?.trade?.instrument}</span><span className="text-[8px] text-muted">{typedPayload<SocialPostPayload>(commentPanelPost)?.title}</span><span className={`ml-auto font-mono text-[11px] font-semibold ${(typedPayload<SocialPostPayload>(commentPanelPost)?.trade?.netPnl ?? 0) >= 0 ? "text-accent" : "text-danger"}`}>{tradeMoney(typedPayload<SocialPostPayload>(commentPanelPost)?.trade?.netPnl ?? 0)}</span></div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {commentPanelComments.filter((comment) => !typedPayload<SocialCommentPayload>(comment)?.replyToCommentId).map((comment) => {
                const payload = typedPayload<SocialCommentPayload>(comment);
                const replies = commentPanelComments.filter((candidate) => candidate.id !== comment.id && commentThreadRootId(candidate, commentPanelComments) === comment.id);
                const collapsed = collapsedCommentThreads.has(comment.id);
                const ownComment = comment.userId === resolvedAccountKey;
                const ownsPost = commentPanelPost.userId === resolvedAccountKey;
                const pinned = typedPayload<SocialPostPayload>(commentPanelPost)?.pinnedCommentId === comment.id;
                return <div key={objectKey(comment)} className={`mb-3 rounded-2xl border ${pinned ? "border-primary/35 bg-primary/[0.065]" : "border-border bg-background/30"}`}>
                  <div className="flex gap-2.5 p-3"><Avatar label={comment.authorLabel} avatarUrl={profileByUserId.get(comment.userId)?.avatarUrl} size="sm" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={`text-[8px] font-semibold ${ownComment ? "text-primary" : "text-foreground"}`}>{comment.authorLabel}</span>{pinned ? <span className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[6px] font-semibold text-primary"><Pin className="h-2.5 w-2.5 fill-current" />PINNED</span> : null}<span className="ml-auto text-[6.5px] text-muted">{formatDate(comment.createdAt, true)}</span>{renderCommentMenu(commentPanelPost, comment)}</div>{renderCommentBody(comment, `mt-1.5 whitespace-pre-wrap break-words text-[9px] leading-4 ${ownComment ? "text-foreground" : "text-muted"}`)}<div className="mt-2 flex items-center gap-1"><button type="button" onClick={() => setCommentReplyToId(comment.id)} className="flex h-6 items-center gap-1 rounded-lg px-2 text-[7px] font-semibold text-muted hover:bg-surface hover:text-primary"><CornerUpLeft className="h-3 w-3" />Reply</button>{ownsPost ? <button type="button" onClick={() => void togglePinnedComment(commentPanelPost, comment.id)} className={`flex h-6 items-center gap-1 rounded-lg px-2 text-[7px] font-semibold ${pinned ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-primary"}`}><Pin className="h-3 w-3" />{pinned ? "Unpin" : "Pin"}</button> : null}</div></div></div>
                  {replies.length ? <div className="border-t border-border/70 px-3 py-2"><button type="button" onClick={() => setCollapsedCommentThreads((current) => { const next = new Set(current); if (next.has(comment.id)) next.delete(comment.id); else next.add(comment.id); return next; })} className="flex h-7 items-center gap-1.5 text-[7px] font-semibold text-muted hover:text-primary">{collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}{collapsed ? `Show ${replies.length} repl${replies.length === 1 ? "y" : "ies"}` : `Hide ${replies.length} repl${replies.length === 1 ? "y" : "ies"}`}</button>{!collapsed ? <div className="mt-1 space-y-2 border-l border-primary/15 pl-3">{replies.map((reply) => { const ownReply = reply.userId === resolvedAccountKey; return <div key={objectKey(reply)} className={`rounded-xl border px-3 py-2 ${ownReply ? "border-primary/25 bg-primary/[0.055]" : "border-border bg-surface/35"}`}><div className="flex items-center gap-2"><Avatar label={reply.authorLabel} avatarUrl={profileByUserId.get(reply.userId)?.avatarUrl} size="sm" /><span className={`text-[7px] font-semibold ${ownReply ? "text-primary" : "text-foreground"}`}>{reply.authorLabel}</span><span className="ml-auto text-[6px] text-muted">{formatDate(reply.createdAt, true)}</span>{renderCommentMenu(commentPanelPost, reply)}</div>{renderCommentBody(reply, "mt-1.5 whitespace-pre-wrap break-words text-[8px] leading-4 text-muted")}<div className="mt-1.5 flex gap-1"><button type="button" onClick={() => setCommentReplyToId(comment.id)} className="flex h-6 items-center gap-1 rounded-lg px-2 text-[7px] text-muted hover:bg-surface hover:text-primary"><CornerUpLeft className="h-3 w-3" />Reply</button></div></div>; })}</div> : null}</div> : null}
                </div>;
              })}
              {!commentPanelComments.length ? <div className="flex min-h-[320px] flex-col items-center justify-center text-center"><MessageCircle className="h-7 w-7 text-muted" /><h3 className="mt-3 text-[10px] font-semibold text-foreground">Start the conversation</h3><p className="mt-1 max-w-xs text-[8px] leading-4 text-muted">Ask about the execution, leave feedback, or add context to the trade.</p></div> : null}
            </div>
            <div className="border-t border-border bg-background/25 p-4">
              {commentReplyToId ? <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.055] px-3 py-2 text-[7px] text-muted"><CornerUpLeft className="h-3 w-3 text-primary" /><span>Replying to {commentPanelComments.find((comment) => comment.id === commentReplyToId)?.authorLabel ?? "this thread"}</span><button type="button" onClick={() => setCommentReplyToId(null)} className="ml-auto text-muted hover:text-foreground"><X className="h-3 w-3" /></button></div> : null}
              <div className="flex items-center gap-2"><input autoFocus value={commentDrafts[commentPanelPost.id] ?? ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [commentPanelPost.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") addComment(commentPanelPost, commentReplyToId); }} placeholder={commentReplyToId ? "Write a reply…" : "Add a comment…"} className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-panel px-3 text-[9px] text-foreground outline-none placeholder:text-muted/55 focus:border-primary/40" /><button type="button" onClick={() => addComment(commentPanelPost, commentReplyToId)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-background hover:brightness-110"><Send className="h-4 w-4" /></button></div>
            </div>
          </aside>
        </div>
      ) : null}

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

      {tradeSendObject ? (() => {
        const payload = typedPayload<SocialPostPayload>(tradeSendObject);
        const trade = payload?.kind === "TRADE" ? payload.trade ?? null : null;
        const oneLiner = payload?.kind === "ONE-LINER" ? payload.body : "";
        const shareLabel = oneLiner ? "one-liner" : "trade";
        const normalizedQuery = tradeSendQuery.trim().toLowerCase();
        const visibleFriends = tradeSendFriends.filter((friend) => !normalizedQuery || `${friend.displayName} ${friend.handle}`.toLowerCase().includes(normalizedQuery));
        const visibleDesks = tradeSendDeskTargets.filter((target) => !normalizedQuery || `${target.deskName} ${target.channelName}`.toLowerCase().includes(normalizedQuery));
        const selectedCount = tradeSendFriendIds.length + tradeSendDeskIds.length;
        return (
          <div className="fixed inset-0 z-[1160] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTradeSend(); }}>
            <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/70">
              <div className="flex items-start gap-3 border-b border-border p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Send className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><h2 className="text-[14px] font-semibold">Send this {shareLabel}</h2><p className="mt-1 text-[8px] text-muted">Choose multiple friends and Desks. Each conversation receives the post with a direct link back to its place in the feed.</p></div>
                <button type="button" onClick={closeTradeSend} disabled={tradeSendState === "sending"} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground disabled:opacity-40" aria-label="Close"><X className="h-4 w-4" /></button>
              </div>

              {trade ? (
                <div className="flex flex-wrap items-center gap-3 border-b border-border bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_6%,var(--background)),var(--background))] px-5 py-3">
                  <span className={`rounded-lg px-2 py-1 text-[7px] font-semibold ${trade.side === "SHORT" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`}>{trade.side}</span>
                  <span className="font-mono text-[11px] font-semibold text-foreground">{trade.instrument}</span>
                  <span className="text-[7px] text-muted">Entry {trade.entryPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"} · Exit {trade.exitPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"}</span>
                  <span className={`ml-auto font-mono text-[15px] font-semibold ${trade.netPnl >= 0 ? "text-accent" : "text-danger"}`}>{tradeMoney(trade.netPnl)}</span>
                </div>
              ) : oneLiner ? (
                <div className="kwant-one-liner-glow relative overflow-hidden border-b border-border bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_7%,var(--background)),var(--background))] px-5 py-4">
                  <p className="relative whitespace-pre-wrap break-words text-[11px] font-medium leading-5 text-foreground">{oneLiner}</p>
                </div>
              ) : null}

              <div className="shrink-0 border-b border-border px-5 py-3">
                <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-primary/40"><Search className="h-3.5 w-3.5 text-muted" /><input autoFocus value={tradeSendQuery} onChange={(event) => setTradeSendQuery(event.target.value)} placeholder="Search friends or Desks" className="min-w-0 flex-1 bg-transparent text-[9px] text-foreground outline-none placeholder:text-muted/55" /></label>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {tradeSendState === "loading" ? (
                  <KwantLoader compact icon={Send} title="Opening conversations" detail="Loading your friends. Desk channels continue resolving in the background." className="min-h-[260px] rounded-2xl border border-border" />
                ) : (
                  <div className="space-y-5">
                    {tradeSendError ? <div className="rounded-xl border border-danger/25 bg-danger/[0.055] px-3 py-2 text-[8px] text-danger">{tradeSendError}</div> : null}
                    <section>
                      <div className="mb-2 flex items-center gap-2"><UsersRound className="h-3.5 w-3.5 text-primary" /><h3 className="text-[8px] font-semibold uppercase tracking-[0.13em] text-muted">Friends</h3><span className="ml-auto text-[7px] text-muted">{tradeSendFriends.length} available</span></div>
                      {visibleFriends.length ? <div className="grid gap-2 sm:grid-cols-2">{visibleFriends.map((friend) => {
                        const selected = tradeSendFriendIds.includes(friend.userId);
                        return <button key={friend.userId} type="button" onClick={() => setTradeSendFriendIds((current) => selected ? current.filter((id) => id !== friend.userId) : [...current, friend.userId])} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? "border-primary/45 bg-primary/[0.075] shadow-[0_0_22px_color-mix(in_srgb,var(--primary)_9%,transparent)]" : "border-border bg-background/35 hover:border-primary/25"}`}><Avatar label={friend.displayName} avatarUrl={friend.avatarUrl} statusClassName={presenceOption(friend.presenceStatus).dotClassName} /><span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-semibold text-foreground">{friend.displayName}</span><span className="mt-0.5 block truncate text-[7px] text-muted">@{friend.handle}</span></span><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-background" : "border-border text-transparent"}`}><Check className="h-3 w-3" /></span></button>;
                      })}</div> : <div className="rounded-2xl border border-dashed border-border p-5 text-center text-[8px] text-muted">{normalizedQuery ? "No friends match that search." : `Connect with a friend to send this ${shareLabel} privately.`}</div>}
                    </section>

                    <section>
                      <div className="mb-2 flex items-center gap-2"><Network className="h-3.5 w-3.5 text-primary" /><h3 className="text-[8px] font-semibold uppercase tracking-[0.13em] text-muted">Desks</h3><span className="ml-auto text-[7px] text-muted">Posts to the first available text channel</span></div>
                      {visibleDesks.length ? <div className="grid gap-2 sm:grid-cols-2">{visibleDesks.map((target) => {
                        const selected = tradeSendDeskIds.includes(target.deskId);
                        return <button key={target.deskId} type="button" onClick={() => setTradeSendDeskIds((current) => selected ? current.filter((id) => id !== target.deskId) : [...current, target.deskId])} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? "border-primary/45 bg-primary/[0.075] shadow-[0_0_22px_color-mix(in_srgb,var(--primary)_9%,transparent)]" : "border-border bg-background/35 hover:border-primary/25"}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Network className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-semibold text-foreground">{target.deskName}</span><span className="mt-0.5 block truncate text-[7px] text-muted">#{target.channelName}</span></span><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-background" : "border-border text-transparent"}`}><Check className="h-3 w-3" /></span></button>;
                      })}</div> : <div className="rounded-2xl border border-dashed border-border p-5 text-center text-[8px] text-muted">{normalizedQuery ? "No Desks match that search." : "No writable Desk text channel is available yet."}</div>}
                    </section>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-border bg-background/25 px-5 py-4">
                <div className="min-w-0 flex-1 text-[8px] text-muted">{selectedCount ? `${selectedCount} ${selectedCount === 1 ? "conversation" : "conversations"} selected` : `Select the conversations that should receive this ${shareLabel}.`}</div>
                <button type="button" onClick={closeTradeSend} disabled={tradeSendState === "sending"} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted disabled:opacity-40">Cancel</button>
                <button type="button" onClick={() => void sendTradeToRecipients()} disabled={!selectedCount || tradeSendState === "loading" || tradeSendState === "sending"} className="flex h-9 min-w-[112px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background shadow-[0_0_24px_color-mix(in_srgb,var(--primary)_18%,transparent)] disabled:opacity-40">{tradeSendState === "sending" ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/30 border-t-background" /> : <Send className="h-3.5 w-3.5" />}{tradeSendState === "sending" ? "Sending…" : `Send ${shareLabel}`}</button>
              </div>
            </div>
          </div>
        );
      })() : null}

      {showOneLinerModal ? (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) closeOneLinerComposer(); }}>
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/60">
            <div className="flex items-start gap-3 border-b border-border p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Zap className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><h2 className="text-[14px] font-semibold">{editingPostId ? "Edit one-liner" : "Create one-liner"}</h2><p className="mt-1 text-[8px] text-muted">One clear thought. No form, chart or extra context required.</p></div>
              <button type="button" onClick={closeOneLinerComposer} disabled={oneLinerPublishing} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface disabled:opacity-40"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <Avatar label={currentProfile.displayName} avatarUrl={currentProfile.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2"><span className="text-[9px] font-semibold text-foreground">{currentProfile.displayName}</span><span className="text-[8px] text-muted">@{currentProfile.handle}</span></div>
                  <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_8%,var(--background)),var(--background))] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--primary)_10%,transparent)] focus-within:border-primary/50">
                    <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/[0.08] blur-3xl" />
                    <textarea autoFocus value={oneLinerDraft.body} maxLength={280} onChange={(event) => setOneLinerDraft((current) => ({ ...current, body: event.target.value.replace(/[\r\n]+/g, " ") }))} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void publishOneLiner(); }} rows={4} placeholder="What’s on your mind?" className="relative min-h-28 w-full resize-none bg-transparent px-4 py-4 text-[13px] leading-6 text-foreground outline-none placeholder:text-muted/55" />
                    <div className="relative flex items-center justify-between border-t border-border/70 px-4 py-2"><span className="text-[7px] text-muted">Ctrl/⌘ + Enter to post</span><span className={`font-mono text-[7px] ${oneLinerDraft.body.length > 250 ? "text-warning" : "text-muted"}`}>{oneLinerDraft.body.length}/280</span></div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/30 p-3">
                <div className="min-w-0 flex-1"><div className="text-[8px] font-semibold text-foreground">Who can see this?</div><div className="mt-0.5 text-[7px] text-muted">Community is shown across the public feed.</div></div>
                <KwantSelect value={oneLinerDraft.scope} onChange={(event) => setOneLinerDraft((current) => ({ ...current, scope: event.target.value as SocialScope }))} className="h-9 min-w-36 rounded-xl border border-border bg-background px-3 text-[8px] outline-none"><option value="community">Community</option><option value="friends">Friends</option><option value="desk">My Desk</option><option value="private">Private</option></KwantSelect>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-background/20 px-5 py-4">
              <button type="button" onClick={closeOneLinerComposer} disabled={oneLinerPublishing} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted disabled:opacity-40">Cancel</button>
              <button type="button" onClick={() => void publishOneLiner()} disabled={!oneLinerDraft.body.trim() || oneLinerPublishing} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-45">{oneLinerPublishing ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/30 border-t-background" /> : <Send className="h-3.5 w-3.5" />}{oneLinerPublishing ? "Posting…" : editingPostId ? "Save changes" : "Post one-liner"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showPostModal ? (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) closePostComposer(); }}>
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/60">
            <div className="flex items-start gap-3 border-b border-border p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="h-4 w-4" /></span>
              <div><h2 className="text-[14px] font-semibold">{editingPostId ? "Edit your post" : "Create a feed post"}</h2><p className="mt-1 text-[8px] text-muted">Share the observation and enough market context for another trader to understand it.</p></div>
              <button type="button" onClick={closePostComposer} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid gap-3 md:grid-cols-3">
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Update type</span><KwantSelect value={postDraft.kind} onChange={(event) => setPostDraft((current) => ({ ...current, kind: event.target.value as SocialPostPayload["kind"] }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"><option value="POST">Post</option><option value="MAP">Map</option><option value="LIVE OBSERVATION">Live Observation</option><option value="REVIEW REQUEST">Review Request</option><option value="LESSON">Lesson</option><option value="QUESTION">Question</option></KwantSelect></label>
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Instrument</span><input value={postDraft.instrument} onChange={(event) => setPostDraft((current) => ({ ...current, instrument: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/40" /></label>
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Visibility</span><KwantSelect value={postDraft.scope} onChange={(event) => setPostDraft((current) => ({ ...current, scope: event.target.value as SocialScope }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"><option value="private">Private</option><option value="friends">Friends</option><option value="desk">My Desk</option><option value="community">Community</option></KwantSelect></label>
              </div>
              <label className="mt-4 block"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Title</span><input value={postDraft.title} onChange={(event) => setPostDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Optional concise headline" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none placeholder:text-muted/55 focus:border-primary/40" /></label>
              <label className="mt-4 block"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">{postDraft.kind === "QUESTION" ? "Focused question *" : postDraft.kind === "LESSON" ? "Lesson *" : "What changed or matters? *"}</span><textarea value={postDraft.body} onChange={(event) => setPostDraft((current) => ({ ...current, body: event.target.value }))} rows={4} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-5 outline-none focus:border-primary/40" /></label>
              <div className="mt-4 overflow-hidden rounded-2xl border border-dashed border-border bg-background/30">
                {postDraft.imageDataUrl ? <div className="relative border-b border-border bg-black"><img src={postDraft.imageDataUrl} alt={postDraft.imageName || "Post attachment preview"} className="max-h-[360px] w-full object-contain" /><button type="button" onClick={() => setPostDraft((current) => ({ ...current, imageDataUrl: "", imageName: "" }))} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white"><X className="h-4 w-4" /></button></div> : null}
                <label className="flex cursor-pointer items-center justify-center gap-2 px-4 py-4 text-[8px] font-semibold text-muted hover:text-foreground"><ImageIcon className="h-4 w-4 text-primary" />{postImagePreparing ? "Preparing image…" : postDraft.imageDataUrl ? "Replace chart or image" : "Add chart or image"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={postImagePreparing} className="hidden" onChange={(event) => { void preparePostImage(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} /></label>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Context / reason{postDraft.kind === "POST" || postDraft.kind === "QUESTION" ? "" : " *"}</span><textarea value={postDraft.context} onChange={(event) => setPostDraft((current) => ({ ...current, context: event.target.value }))} rows={4} placeholder="What evidence or market state makes this relevant?" className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none placeholder:text-muted/55 focus:border-primary/40" /></label>
                <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Condition / evidence{postDraft.kind === "MAP" || postDraft.kind === "LIVE OBSERVATION" ? " *" : ""}</span><textarea value={postDraft.condition} onChange={(event) => setPostDraft((current) => ({ ...current, condition: event.target.value }))} rows={4} placeholder="What would confirm this observation?" className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none placeholder:text-muted/55 focus:border-primary/40" /></label>
                <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Invalidation{postDraft.kind === "MAP" ? " *" : ""}</span><textarea value={postDraft.invalidation} onChange={(event) => setPostDraft((current) => ({ ...current, invalidation: event.target.value }))} rows={3} placeholder="What would make this interpretation wrong?" className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none placeholder:text-muted/55 focus:border-primary/40" /></label>
              </div>
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-[8px] leading-4 text-muted"><strong className="text-primary">{postDraft.kind}:</strong> {postDraft.kind === "MAP" ? "Share the structure, both the confirming condition and the invalidation." : postDraft.kind === "LIVE OBSERVATION" ? "Timestamp the observation and show what evidence would sustain it." : postDraft.kind === "REVIEW REQUEST" ? "Ask for one precise form of feedback rather than broad approval." : postDraft.kind === "LESSON" ? "Anchor the lesson in a specific context another trader can recognise." : "Give enough context for a useful answer."}</div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-background/20 px-5 py-4"><button type="button" onClick={closePostComposer} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted">Cancel</button><button type="button" onClick={() => void publishStructuredPost()} disabled={postImagePreparing} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-50"><Send className="h-3.5 w-3.5" />{editingPostId ? "Save changes" : "Publish to feed"}</button></div>
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
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !deskCreating) setShowDeskModal(false); }}>
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/60">
            <div className="flex items-start gap-3 border-b border-border p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><UsersRound className="h-4 w-4" /></span><div><h2 className="text-[14px] font-semibold">Create a Kwant Desk</h2><p className="mt-1 text-[8px] text-muted">A persistent trading group with its own standards, channels and roles.</p></div><button type="button" onClick={() => setShowDeskModal(false)} disabled={deskCreating} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface disabled:opacity-40"><X className="h-4 w-4" /></button></div>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Unique Desk name *</span>
                <div className="relative">
                  <input
                    value={deskDraft.name}
                    maxLength={60}
                    onChange={(event) => setDeskDraft((current) => ({ ...current, name: event.target.value }))}
                    aria-describedby="desk-name-status"
                    className={`h-10 w-full rounded-xl border bg-background px-3 pr-10 text-[9px] outline-none ${
                      deskNameCheck.state === "available"
                        ? "border-primary/55"
                        : deskNameCheck.state === "taken" || deskNameCheck.state === "invalid" || deskNameCheck.state === "error"
                          ? "border-danger/55"
                          : "border-border focus:border-primary/40"
                    }`}
                    placeholder="e.g. New York Index Desk"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    {deskNameCheck.state === "checking" ? <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" /> : null}
                    {deskNameCheck.state === "available" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                    {deskNameCheck.state === "taken" || deskNameCheck.state === "invalid" || deskNameCheck.state === "error" ? <CircleAlert className="h-4 w-4 text-danger" /> : null}
                  </span>
                </div>
                <span
                  id="desk-name-status"
                  className={`mt-1.5 block text-[7px] ${
                    deskNameCheck.state === "available"
                      ? "text-primary"
                      : deskNameCheck.state === "taken" || deskNameCheck.state === "invalid" || deskNameCheck.state === "error"
                        ? "text-danger"
                        : "text-muted"
                  }`}
                >
                  {deskNameCheck.message || "Desk names are unique across the platform."}
                </span>
              </label>
              <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Markets — comma separated</span><input value={deskDraft.markets} onChange={(event) => setDeskDraft((current) => ({ ...current, markets: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" placeholder="NQ, ES" /></label>
              <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Session</span><KwantSelect value={deskDraft.session} onChange={(event) => setDeskDraft((current) => ({ ...current, session: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"><option value="Globex">Globex</option><option value="Tokyo">Tokyo</option><option value="Frankfurt">Frankfurt</option><option value="London">London</option><option value="New York">New York</option></KwantSelect></label>
              <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Timezone</span><input value={deskDraft.timezone} onChange={(event) => setDeskDraft((current) => ({ ...current, timezone: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" placeholder="Australia/Brisbane" /></label>
              <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Capacity — maximum 50</span><input type="number" min={2} max={50} value={deskDraft.capacity} onChange={(event) => setDeskDraft((current) => ({ ...current, capacity: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" /></label>
              <label><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Joining</span><KwantSelect value={deskDraft.privacy} onChange={(event) => setDeskDraft((current) => ({ ...current, privacy: event.target.value as SocialDeskPayload["privacy"] }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none"><option value="PUBLIC">Public · instant join</option><option value="REQUEST">Request to join</option><option value="PRIVATE">Private invite</option></KwantSelect></label>
              <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Shared development objective *</span><textarea value={deskDraft.objective} onChange={(event) => setDeskDraft((current) => ({ ...current, objective: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] outline-none focus:border-primary/40" /></label>
              <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">Desk description</span><textarea value={deskDraft.description} onChange={(event) => setDeskDraft((current) => ({ ...current, description: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] outline-none focus:border-primary/40" /></label>
              <label className="md:col-span-2"><span className="mb-1.5 block text-[7px] uppercase tracking-[0.1em] text-muted">First weekly mission</span><input value={deskDraft.weeklyMission} onChange={(event) => setDeskDraft((current) => ({ ...current, weeklyMission: event.target.value }))} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/40" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-background/20 px-5 py-4"><button type="button" onClick={() => setShowDeskModal(false)} disabled={deskCreating} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted disabled:opacity-40">Cancel</button><button type="button" onClick={() => void createDesk()} disabled={deskCreating || deskNameCheck.state !== "available" || !deskDraft.objective.trim()} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40">{deskCreating ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/30 border-t-background" /> : <UsersRound className="h-3.5 w-3.5" />}{deskCreating ? "Creating Desk…" : "Create Desk"}</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
