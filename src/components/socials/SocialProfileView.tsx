"use client";

import {
  Bookmark,
  Check,
  ExternalLink,
  Grid3X3,
  Link2,
  Mail,
  MessageCircle,
  Pencil,
  Repeat2,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  CALLING_CARD_CATALOG,
  profileScoreAverage,
  type SocialCardPayload,
  type SocialObject,
  type SocialPrecordPayload,
  type SocialProfilePayload,
} from "@/lib/socials";

type SocialProfileViewProps = {
  profileObject: SocialObject;
  profile: SocialProfilePayload;
  gameplans: SocialObject[];
  cards: SocialObject[];
  comments: SocialObject[];
  isOwnProfile: boolean;
  savedIds: Set<string>;
  repostedIds: Set<string>;
  onBack?: () => void;
  backLabel?: string;
  onEdit: () => void;
  onMessage: () => void;
  onOpenGameplan: (record: SocialObject) => void;
  onSave: (record: SocialObject) => void;
  onRepost: (record: SocialObject) => void;
  onShareGameplan: (record: SocialObject) => void;
  onShareProfile: () => void;
};

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "KD";
}

function payloadOf<T>(object: SocialObject | undefined) {
  return (object?.payload ?? null) as T | null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function zoneLabel(payload: SocialPrecordPayload) {
  if (payload.plannedEntryLow === null && payload.plannedEntryHigh === null) return "Decision map";
  const low = payload.plannedEntryLow?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "—";
  const high = payload.plannedEntryHigh?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? low;
  return low === high ? low : `${low}–${high}`;
}

export default function SocialProfileView({
  profileObject,
  profile,
  gameplans,
  cards,
  comments,
  isOwnProfile,
  savedIds,
  repostedIds,
  onBack,
  backLabel = "Back to Socials",
  onEdit,
  onMessage,
  onOpenGameplan,
  onSave,
  onRepost,
  onShareGameplan,
  onShareProfile,
}: SocialProfileViewProps) {
  const earnedCards = cards
    .filter((card) => card.userId === profileObject.userId)
    .map((card) => payloadOf<SocialCardPayload>(card))
    .filter((card): card is SocialCardPayload => Boolean(card));
  const selectedCard = earnedCards.find((card) => card.code === profile.callingCardCode && card.public !== false)
    ?? earnedCards.find((card) => card.equipped && card.public !== false)
    ?? earnedCards.find((card) => card.public !== false);
  const cardDefinition = CALLING_CARD_CATALOG.find((definition) => definition.code === selectedCard?.code);
  const receivedComments = comments.filter((comment) => gameplans.some((record) => record.id === comment.parentId)).length;
  const links = [
    ...(profile.websiteUrl ? [{ label: "Website", url: profile.websiteUrl }] : []),
    ...(profile.profileLinks ?? []),
  ].slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-6xl p-3 sm:p-4">
      {onBack ? (
        <button type="button" onClick={onBack} className="mb-3 flex h-8 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-[8px] font-semibold text-muted hover:text-foreground">
          ← {backLabel}
        </button>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-border bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="relative h-40 overflow-hidden border-b border-border sm:h-48">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_35%),radial-gradient(circle_at_82%_70%,color-mix(in_srgb,var(--accent)_12%,transparent),transparent_38%),linear-gradient(125deg,color-mix(in_srgb,var(--surface)_78%,black),var(--background))]" />
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(color-mix(in_srgb,var(--primary)_18%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--primary)_18%,transparent)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-primary shadow-[0_0_18px_var(--primary)]" />
          <div className="absolute right-5 top-5 max-w-[250px] rounded-2xl border border-primary/25 bg-black/35 px-4 py-3 text-right backdrop-blur-md">
            <div className="flex items-center justify-end gap-1.5 text-[7px] font-semibold uppercase tracking-[0.16em] text-primary"><Sparkles className="h-3 w-3" />Calling Card</div>
            <div className="mt-2 text-[15px] font-semibold text-foreground">{selectedCard?.name ?? cardDefinition?.name ?? "Building the record"}</div>
            <div className="mt-1 text-[7px] leading-4 text-muted">{selectedCard?.description ?? cardDefinition?.description ?? "Verified Gameplans will unlock a permanent identity card."}</div>
          </div>
        </div>

        <div className="relative px-4 pb-5 sm:px-7">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-[5px] border-panel bg-surface text-[24px] font-semibold text-foreground shadow-2xl">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt={`${profile.displayName} profile`} className="h-full w-full object-cover" />
              ) : initials(profile.displayName)}
              <span className="absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full border-2 border-panel bg-primary" />
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold tracking-[-0.03em] text-foreground">{profile.displayName}</h1>
                <span className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[7px] font-semibold text-primary"><ShieldCheck className="h-3 w-3" />On record</span>
              </div>
              <div className="mt-1 text-[10px] text-primary">@{profile.handle}</div>
            </div>

            <div className="flex flex-wrap gap-2 pb-1">
              {isOwnProfile ? (
                <button type="button" onClick={onEdit} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background"><Pencil className="h-3.5 w-3.5" />Edit profile</button>
              ) : (
                <button type="button" onClick={onMessage} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background"><Send className="h-3.5 w-3.5" />Message</button>
              )}
              <button type="button" onClick={onShareProfile} className="flex h-9 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-[9px] font-semibold text-muted hover:text-foreground"><Share2 className="h-3.5 w-3.5" />Share profile</button>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <p className="max-w-2xl text-[10px] leading-5 text-muted">{profile.bio || `${profile.session} · ${profile.style}`}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.markets.map((market) => <span key={market} className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[7px] font-semibold text-primary">{market}</span>)}
                <span className="rounded-lg border border-border bg-surface px-2 py-1 text-[7px] text-muted">{profile.session}</span>
                <span className="rounded-lg border border-border bg-surface px-2 py-1 text-[7px] text-muted">{profile.timezone}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                {profile.showContactEmail && profile.contactEmail ? <a href={`mailto:${profile.contactEmail}`} className="flex items-center gap-1.5 text-[8px] text-muted hover:text-primary"><Mail className="h-3.5 w-3.5" />{profile.contactEmail}</a> : null}
                {links.map((link) => <a key={`${link.label}:${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[8px] text-muted hover:text-primary"><Link2 className="h-3.5 w-3.5" />{link.label}<ExternalLink className="h-3 w-3" /></a>)}
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-background/35">
              <div className="p-3 text-center"><div className="font-mono text-[18px] font-semibold text-foreground">{gameplans.length}</div><div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-muted">Gameplans</div></div>
              <div className="p-3 text-center"><div className="font-mono text-[18px] font-semibold text-foreground">{receivedComments}</div><div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-muted">Reviews</div></div>
              <div className="p-3 text-center"><div className="font-mono text-[18px] font-semibold text-primary">{profileScoreAverage(profile) || "—"}</div><div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-muted">Process</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-3xl border border-border bg-panel">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
          <Grid3X3 className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-[11px] font-semibold text-foreground">Gameplan record</h2>
            <p className="mt-0.5 text-[7px] text-muted">Only timestamped Gameplans appear on the profile grid.</p>
          </div>
          <span className="ml-auto rounded-lg border border-border bg-surface px-2 py-1 font-mono text-[7px] text-muted">{gameplans.length} posts</span>
        </div>

        {gameplans.length ? (
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {gameplans.map((record) => {
              const payload = payloadOf<SocialPrecordPayload>(record);
              if (!payload) return null;
              const commentCount = comments.filter((comment) => comment.parentId === record.id).length;
              const saved = savedIds.has(record.id);
              const reposted = repostedIds.has(record.id);
              return (
                <article key={`${record.userId}:${record.id}`} className="group relative flex min-h-[255px] flex-col overflow-hidden bg-panel p-4">
                  <button type="button" onClick={() => onOpenGameplan(record)} className="absolute inset-0 z-0 text-left" aria-label={`Open ${payload.instrument} Gameplan`} />
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_srgb,var(--primary)_13%,transparent),transparent_48%)]" />
                  <div className="relative z-10 flex items-start justify-between pointer-events-none">
                    <span className="rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-[9px] font-semibold text-primary">{payload.instrument}</span>
                    <span className="text-[7px] text-muted">{formatDate(record.createdAt)}</span>
                  </div>
                  <div className="relative z-10 mt-9 pointer-events-none">
                    <div className="text-[7px] font-semibold uppercase tracking-[0.16em] text-muted">{payload.session} · {payload.direction}</div>
                    <div className="mt-2 font-mono text-[24px] font-semibold tracking-[-0.04em] text-foreground">{zoneLabel(payload)}</div>
                    <p className="mt-3 line-clamp-3 text-[9px] leading-5 text-muted">{payload.marketContext}</p>
                  </div>
                  <div className="relative z-20 mt-auto flex items-center gap-1 border-t border-border/70 pt-3">
                    <button type="button" onClick={() => onOpenGameplan(record)} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[7px] text-muted hover:bg-surface hover:text-foreground"><MessageCircle className="h-3.5 w-3.5" />{commentCount}</button>
                    <button type="button" onClick={() => onRepost(record)} className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[7px] hover:bg-surface ${reposted ? "text-primary" : "text-muted hover:text-foreground"}`}><Repeat2 className="h-3.5 w-3.5" />{reposted ? <Check className="h-3 w-3" /> : "Repost"}</button>
                    <button type="button" onClick={() => onSave(record)} className={`ml-auto flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface ${saved ? "text-primary" : "text-muted hover:text-foreground"}`} title={saved ? "Saved" : "Save Gameplan"}><Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} /></button>
                    <button type="button" onClick={() => onShareGameplan(record)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground" title="Share Gameplan"><Share2 className="h-3.5 w-3.5" /></button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
            <Grid3X3 className="h-7 w-7 text-muted" />
            <div className="mt-3 text-[10px] font-semibold text-foreground">No public Gameplans yet</div>
            <p className="mt-2 max-w-sm text-[8px] leading-4 text-muted">When this trader places a Gameplan on the Social record, it will appear here automatically.</p>
          </div>
        )}
      </section>
    </div>
  );
}
