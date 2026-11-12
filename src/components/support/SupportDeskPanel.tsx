"use client";
/* eslint-disable @next/next/no-img-element -- Local screenshot previews must not trigger paid image optimization. */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, ExternalLink, ImagePlus, LifeBuoy, Loader2, RefreshCw, Send, X } from "lucide-react";
import KwantSelect from "@/components/ui/KwantSelect";
import { SUPPORT_AREAS, supportAreaForLocation, supportAreaLabel } from "@/lib/supportAreas";
type Session = {
    user: {
        id: string;
        email: string;
        label: string;
    };
    role: "owner" | "staff" | null;
    aiAvailable: boolean;
    monthlyAiCapUsd: number;
};
type Ticket = {
    id: string;
    reference: string;
    subject: string;
    category: string;
    status: string;
    page: string;
    createdAt: string;
    updatedAt: string;
    unread?: boolean;
    email?: string;
    emailConsent?: boolean;
    contactEmail?: string;
    emailConsentAt?: string | null;
    label?: string;
};
type Message = {
    role: "user" | "assistant";
    content: string;
};
type Thread = {
    canManageContact?: boolean;
    ticket: Ticket;
    messages: {
        id: number;
        role: string;
        body: string;
        createdAt: string;
    }[];
    hasAttachment: boolean;
    context: {
        browser: string;
        viewport: string;
        conversation?: Message[];
    };
};
type Team = {
    staff: {
        id: string;
        email: string;
        role: string;
    }[];
    invites: {
        email: string;
    }[];
};
type Tab = "help" | "report" | "reports" | "inbox" | "team";
const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none disabled:opacity-40";
const button = "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[12px] font-semibold text-foreground hover:bg-background disabled:opacity-40";
const primary = "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-on-primary disabled:opacity-40";
const stamp = (v: string) => new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const status = (v: string, staff = false) => v === "waiting" ? (staff ? "Waiting for customer" : "Waiting for you") : v === "resolved" ? "Resolved" : "Open";
const greeting: Message = { role: "assistant", content: "How can I help with KwantDesk? Ask a product question, or report a problem for the support team." };
async function api<T>(path: string, input?: unknown): Promise<T> { const r = await fetch("/api/support/" + path, { method: input === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(30000), ...(input === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }) }); const data = (r.headers.get("content-type") || "").includes("json") ? await r.json() : {}; if (!r.ok)
    throw Object.assign(Error(data.error || "Support could not be reached. Please try again."), { status: r.status }); return data as T; }
export default function SupportDeskPanel({ onClose, page = false, sourcePath }: {
    onClose?: () => void;
    page?: boolean;
    sourcePath?: string;
}) {
    const reportPath = () => sourcePath ?? (page ? new URLSearchParams(location.search).get("from") || "/support" : location.pathname);
    const [session, setSession] = useState<Session | null>(null), [authNeeded, setAuthNeeded] = useState(false), [opening, setOpening] = useState(true), [tab, setTab] = useState<Tab>("help"), [error, setError] = useState(""), [busy, setBusy] = useState(false);
    const [messages, setMessages] = useState<Message[]>([greeting]), [question, setQuestion] = useState(""), [subject, setSubject] = useState(""), [description, setDescription] = useState(""), [category, setCategory] = useState(() => sourcePath ? supportAreaForLocation(sourcePath) : typeof location === "undefined" ? "other" : supportAreaForLocation(reportPath(), location.search)), [picture, setPicture] = useState(""), [includeChat, setIncludeChat] = useState(true);
    const [tickets, setTickets] = useState<Ticket[]>([]), [next, setNext] = useState<string | null>(null), [filter, setFilter] = useState(""), [search, setSearch] = useState(""), [debouncedSearch, setDebouncedSearch] = useState(""), [thread, setThread] = useState<Thread | null>(null), [reply, setReply] = useState(""), [claim, setClaim] = useState(""), [team, setTeam] = useState<Team>({ staff: [], invites: [] }), [invite, setInvite] = useState("");
    const [emailConsent, setEmailConsent] = useState(false);
    const clientId = useRef(""), identity = useRef(""), lastRead = useRef(0), content = useRef<HTMLDivElement>(null);
    const loadSession = useCallback(async () => { setError(""); setOpening(true); try {
        const v = await api<Session>("session");
        if (identity.current !== v.user.id) {
            let saved: Message[] = [greeting];
            try {
                const value = JSON.parse(sessionStorage.getItem("kwantdesk-support-chat:" + v.user.id) || "null");
                if (Array.isArray(value) && value.length)
                    saved = value.filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string").slice(-11);
            }
            catch { /* Start a fresh conversation. */ }
            identity.current = v.user.id;
            setMessages(saved);
        }
        setSession(v);
        setAuthNeeded(false);
    }
    catch (e) {
        if ((e as {
            status?: number;
        }).status === 401) {
            setSession(null);
            setAuthNeeded(true);
        }
        else
            setError(e instanceof Error ? e.message : "Support could not be reached.");
    }
    finally {
        setOpening(false);
    } }, []);
    useEffect(() => { void loadSession(); if (page) {
        const v = new URLSearchParams(location.hash.slice(1)).get("claim");
        try {
            if (v) {
                sessionStorage.setItem("kwantdesk-support-owner-claim", v);
                history.replaceState(null, "", location.pathname + location.search);
            }
            setClaim(sessionStorage.getItem("kwantdesk-support-owner-claim") || "");
        }
        catch {
            if (v)
                setClaim(v);
        }
    } }, [loadSession, page]);
    useEffect(() => { if (!session)
        return; try {
        sessionStorage.setItem("kwantdesk-support-chat:" + session.user.id, JSON.stringify(messages.slice(-11)));
    }
    catch { /* Support works without browser storage. */ } }, [session, messages]);
    useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(timer); }, [search]);
    const list = useCallback(async (more = false) => { const q = new URLSearchParams(); if (tab === "inbox") {
        q.set("staff", "1");
        if (filter)
            q.set("status", filter);
        if (debouncedSearch.trim())
            q.set("search", debouncedSearch.trim());
    } if (more && next)
        q.set("before", next); const data = await api<{
        tickets: Ticket[];
        next: string | null;
    }>("tickets?" + q); setTickets(current => more ? [...current, ...data.tickets.filter(t => !current.some(c => c.id === t.id))] : data.tickets); setNext(data.next); }, [tab, filter, debouncedSearch, next]);
    const threadId = thread?.ticket.id;
    useEffect(() => { if (content.current) content.current.scrollTop = tab === "help" ? content.current.scrollHeight : 0; }, [messages, tab, threadId]);
    useEffect(() => { if (!session || !["reports", "inbox"].includes(tab))
        return; let active = true; const refresh = async () => { try {
        if (threadId) {
            const data = await api<Thread>("tickets/" + threadId);
            if (active)
                setThread(data);
        }
        else {
            const q = new URLSearchParams();
            if (tab === "inbox") {
                q.set("staff", "1");
                if (filter)
                    q.set("status", filter);
                if (debouncedSearch.trim())
                    q.set("search", debouncedSearch.trim());
            }
            const data = await api<{
                tickets: Ticket[];
                next: string | null;
            }>("tickets?" + q);
            if (active) {
                setTickets(data.tickets);
                setNext(data.next);
            }
        }
    }
    catch (e) {
        if (active)
            setError(e instanceof Error ? e.message : "Reports could not be loaded.");
    } }; void refresh(); const timer = setInterval(() => { if (document.visibilityState === "visible")
        void refresh(); }, 20000); return () => { active = false; clearInterval(timer); }; }, [session, tab, threadId, filter, debouncedSearch]);
    const latestMessage = thread?.messages.at(-1)?.id;
    useEffect(() => { if (!threadId || !latestMessage || lastRead.current === latestMessage)
        return; lastRead.current = latestMessage; void api("tickets/" + threadId + "/read", {}).catch(() => { }); }, [threadId, latestMessage]);
    useEffect(() => { if (tab === "team" && session?.role === "owner")
        void api<Team>("staff").then(setTeam).catch(e => setError(e.message)); }, [tab, session?.role]);
    function changeTab(value: Tab) { setTab(value); setThread(null); setError(""); setNext(null); }
    async function action(run: () => Promise<void>) { if (busy)
        return; setBusy(true); setError(""); try {
        await run();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "The request could not be completed.");
    }
    finally {
        setBusy(false);
    } }
    function ask() { const value = question.trim(); if (!value || busy)
        return; const history = [...messages, { role: "user" as const, content: value }].slice(-10); setMessages(history); setQuestion(""); void action(async () => { const data = await api<{
        response: string;
    }>("ai", { messages: history, page: location.pathname }); setMessages([...history, { role: "assistant", content: data.response }]); }); }
    function sendReport() { if (!session) return; void action(async () => { clientId.current ||= crypto.randomUUID(); const data = await api<Thread>("tickets", { clientId: clientId.current, subject, description, category, emailConsent, page: reportPath(), browser: navigator.userAgent, viewport: `${innerWidth} × ${innerHeight}`, conversation: includeChat ? messages : [], screenshot: picture || undefined }); clientId.current = ""; setSubject(""); setDescription(""); setPicture(""); setEmailConsent(false); setTab("reports"); setThread(data); }); }
    function choosePicture(file?: File) { if (!file)
        return; if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 1024 * 1024) {
        setError("Choose a PNG, JPEG or WebP screenshot up to 1 MB.");
        return;
    } setError(""); const reader = new FileReader(); reader.onload = () => setPicture(String(reader.result)); reader.readAsDataURL(file); }
    function viewPicture() { if (!thread)
        return; void action(async () => { const r = await fetch(`/api/support/tickets/${thread.ticket.id}/attachment`, { credentials: "same-origin", cache: "no-store" }); if (!r.ok)
        throw Error("The screenshot could not be loaded."); const url = URL.createObjectURL(await r.blob()), a = document.createElement("a"); a.href = url; a.download = thread.ticket.reference + "-screenshot." + (r.headers.get("content-type")?.split("/")[1] || "png"); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }); }
    const tabs: [
        Tab,
        string
    ][] = [["help", "AI help"], ["report", "Report a problem"], ["reports", "My reports"]];
    if (session?.role)
        tabs.push(["inbox", "Support inbox"]);
    if (session?.role === "owner")
        tabs.push(["team", "Team"]);
    return <section aria-label="KwantDesk support" className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-panel text-foreground shadow-2xl ${page ? "h-full" : "h-[min(680px,calc(100dvh-88px))] w-[420px] max-w-[calc(100vw-24px)]"}`}>
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3"><div className="flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-primary"/><div><h2 className="text-[13px] font-semibold">KwantDesk support</h2><p className="text-[10px] text-muted">AI product help · real support follow-up</p></div></div><div className="flex gap-1">{!page && <a className="rounded-lg p-2 text-muted hover:text-foreground" href={"/support?from=" + encodeURIComponent(typeof location === "undefined" ? "/" : location.pathname)} title="Open support centre"><ExternalLink size={15}/></a>}{onClose && <button onClick={onClose} className="rounded-lg p-2 text-muted hover:text-foreground" aria-label="Close support"><X size={17}/></button>}</div></header>
    {!authNeeded && <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2" aria-label="Support sections">{tabs.map(([id, label]) => <button key={id} onClick={() => changeTab(id)} className={`shrink-0 rounded-lg px-2 py-2 text-[11px] font-semibold ${tab === id ? "bg-primary text-on-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}>{label}</button>)}</nav>}
    <div ref={content} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 text-[12px] leading-relaxed">
      {error && <div className="mb-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-foreground" role="alert">{error}<button className="ml-2 underline" onClick={() => session ? changeTab("report") : void loadSession()}>{session ? "Report a problem instead" : "Try again"}</button></div>}
      {authNeeded ? <div className="space-y-4"><h3 className="font-semibold">Sign in to contact support</h3><p className="text-muted">Your account keeps reports and staff replies private and available when you return.</p><a href="/login?returnTo=%2Fsupport" className={primary}>Continue to sign in</a></div> : <>
        {claim && session && session.role !== "owner" && <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3"><p className="mb-2 font-semibold">Owner inbox setup</p><p className="mb-3 text-muted">Claim the support inbox for {session.user.email}. Only use this if you own KwantDesk.</p><button className={primary} disabled={busy} onClick={() => void action(async () => { await api("claim", { token: claim }); sessionStorage.removeItem("kwantdesk-support-owner-claim"); setClaim(""); await loadSession(); setTab("inbox"); })}>Claim owner inbox</button></div>}
        {tab === "help" && <div className="space-y-3">{messages.map((m, i) => <div key={i} className={`whitespace-pre-wrap break-words rounded-xl p-3 ${m.role === "user" ? "ml-7 bg-primary/10" : "mr-4 bg-surface"}`}><p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-muted">{m.role === "assistant" ? "AI assistant" : "You"}</p>{m.content}</div>)}{session && !session?.aiAvailable && <p className="text-muted">AI is currently unavailable. You can still report a problem and speak with the team.</p>}<p className="text-[10px] text-muted">Need a person? Use Report a problem. Replies appear under My reports.</p><button className="text-[11px] text-muted underline" onClick={() => setMessages([greeting])}>New AI conversation</button></div>}
        {tab === "report" && <form id="support-report" className="space-y-3" onSubmit={e => { e.preventDefault(); sendReport(); }}><p className="text-muted">Tell us what happened. After submission you’ll receive a reference and the team can reply here.</p><label className="block space-y-1"><span>Subject</span><input className={field} required minLength={4} maxLength={120} value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. NQ CVD stopped updating"/></label><label className="block space-y-1"><span>Area</span><KwantSelect aria-label="Report area" className={field} value={category} onChange={e => setCategory(e.target.value)}>{SUPPORT_AREAS.map(area => <option key={area.id} value={area.id}>{area.label}</option>)}</KwantSelect></label><label className="block space-y-1"><span>What happened?</span><textarea className={field + " min-h-32 resize-y"} required minLength={15} maxLength={6000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Steps to reproduce, expected behaviour, instrument, timeframe and time…"/></label><div className="rounded-xl bg-surface p-3"><label className="flex items-start gap-2 text-[11px]"><input type="checkbox" className="mt-0.5 accent-primary" checked={emailConsent} onChange={e => setEmailConsent(e.target.checked)}/>Allow KwantDesk support to email me about this report</label><p className="mt-1 text-[10px] text-muted">Optional. Replies are always available in My reports. You can turn email permission off later.</p>{emailConsent && <label className="mt-2 block space-y-1 text-[11px]"><span>Reply email — your verified sign-in account</span><input type="email" aria-label="Support reply email" className={field} readOnly value={session?.user.email || ""} placeholder="Your account email appears after sign-in is checked"/></label>}</div><label className={button + " cursor-pointer"}><ImagePlus size={14}/>Add screenshot<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => choosePicture(e.target.files?.[0])}/></label><p className="text-[10px] text-muted">PNG, JPEG or WebP · up to 1 MB. Current page and basic browser details will be included.</p>{picture && <div className="flex items-start gap-2"><img src={picture} alt="Screenshot to include with the report" className="max-h-32 rounded-lg border border-border"/><button type="button" aria-label="Remove screenshot" onClick={() => setPicture("")}><X size={15}/></button></div>}{messages.length > 1 && <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" className="accent-primary" checked={includeChat} onChange={e => setIncludeChat(e.target.checked)}/>Include this AI conversation</label>}</form>}
        {["reports", "inbox"].includes(tab) && (thread ? <div className="space-y-3"><button className="inline-flex items-center gap-1 text-muted" onClick={() => { setThread(null); void action(() => list()); }}><ArrowLeft size={14}/>Back to reports</button><div><p className="text-[10px] font-semibold text-primary">{thread.ticket.reference} · {status(thread.ticket.status, tab === "inbox")}</p><h3 className="text-[15px] font-semibold">{thread.ticket.subject}</h3><p className="text-[10px] text-muted">{stamp(thread.ticket.createdAt)} · {supportAreaLabel(thread.ticket.category)} · {thread.ticket.page}</p>{session?.role && <p className="text-[11px] text-muted">{thread.ticket.label} · {thread.ticket.email}</p>}</div>{thread.canManageContact && <label className="flex items-start gap-2 rounded-xl bg-surface p-3 text-[11px]"><input type="checkbox" className="mt-0.5 accent-primary" checked={Boolean(thread.ticket.emailConsent)} disabled={busy} onChange={e => { const allowed = e.target.checked, previous = thread; setThread({ ...thread, ticket: { ...thread.ticket, emailConsent: allowed } }); void action(async () => { try { setThread(await api<Thread>(`tickets/${thread.ticket.id}/contact`, { emailConsent: allowed })); } catch (error) { setThread(previous); throw error; } }); }}/>Allow email follow-up for this report</label>}{session?.role && <div className="rounded-xl bg-surface p-3 text-[11px]">{thread.ticket.emailConsent && thread.ticket.contactEmail ? <><p className="mb-2 text-muted">Customer permits email follow-up about this report.</p><a className={button} href={`mailto:${encodeURIComponent(thread.ticket.contactEmail)}?subject=${encodeURIComponent(`Re: [${thread.ticket.reference}] ${thread.ticket.subject.replace(/[\r\n]/g, " ")}`)}`}>Email customer</a></> : <p className="text-muted">Email permission has not been given. Reply in KwantDesk.</p>}</div>}{session?.role && <details className="rounded-xl bg-surface p-3 text-[11px]"><summary className="cursor-pointer font-semibold">Report context</summary><p className="mt-2 break-words">{thread.context.browser} · {thread.context.viewport}</p>{thread.context.conversation?.map((m, i) => <p key={i} className="mt-2 whitespace-pre-wrap"><strong>{m.role}: </strong>{m.content}</p>)}</details>}{thread.hasAttachment && <button className={button} onClick={viewPicture}>Download screenshot</button>}{thread.messages.map(m => <div key={m.id} className={`rounded-xl p-3 ${m.role === "staff" ? "bg-primary/10" : "bg-surface"}`}><p className="mb-1 text-[10px] font-semibold text-muted">{m.role === "staff" ? "KwantDesk support" : m.role === "system" ? "Update" : "Customer"} · {stamp(m.createdAt)}</p><p className="whitespace-pre-wrap break-words">{m.body}</p></div>)}{session?.role && <div className="flex flex-wrap gap-2">{["open", "waiting", "resolved"].map(s => <button key={s} className={button} disabled={busy || thread.ticket.status === s} onClick={() => void action(async () => setThread(await api<Thread>(`tickets/${thread.ticket.id}/status`, { status: s })))}>Mark {s}</button>)}</div>}</div> : <div className="space-y-2">{tab === "inbox" && <div className="mb-3 flex gap-2"><input className={field + " min-w-0 flex-1"} placeholder="Search subject or email" aria-label="Search reports" maxLength={100} value={search} onChange={e => setSearch(e.target.value)}/><KwantSelect className={field + " !w-auto"} aria-label="Report status filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All</option><option value="open">Open</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option></KwantSelect></div>}<div className="flex items-center justify-between"><h3 className="font-semibold">{tab === "inbox" ? "Customer reports" : "Your reports"}</h3><button aria-label="Refresh reports" onClick={() => void action(() => list())} className="p-2 text-muted"><RefreshCw size={14}/></button></div>{opening && <p className="text-muted">Checking your account…</p>}{!opening && !tickets.length && <p className="rounded-xl bg-surface p-4 text-muted">No reports here yet.</p>}{tickets.map(t => <button key={t.id} onClick={() => void action(async () => { setThread(await api<Thread>("tickets/" + t.id)); setReply(""); })} className="block w-full rounded-xl border border-border p-3 text-left hover:bg-surface"><div className="flex items-center gap-2">{t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary"/>}<strong className="min-w-0 flex-1 truncate">{t.subject}</strong></div><p className="mt-1 text-[10px] text-muted">{t.reference} · {status(t.status, tab === "inbox")} · {stamp(t.updatedAt)}</p>{tab === "inbox" && <p className="truncate text-[10px] text-muted">{t.email}</p>}</button>)}{next && <button className={button} onClick={() => void action(() => list(true))} disabled={busy}>Load more</button>}</div>)}
        {tab === "team" && session?.role === "owner" && <div className="space-y-3"><h3 className="font-semibold">Support team</h3><p className="text-muted">Invite a staff member’s verified sign-in email. They use their own account to reply from Support inbox.</p><form className="flex gap-2" onSubmit={e => { e.preventDefault(); void action(async () => { setTeam(await api<Team>("staff", { email: invite })); setInvite(""); }); }}><input className={field + " min-w-0 flex-1"} type="email" required placeholder="staff@example.com" aria-label="Staff email" value={invite} onChange={e => setInvite(e.target.value)}/><button className={primary} disabled={busy}>Invite</button></form>{[...team.staff.map(s => ({ ...s, pending: false })), ...team.invites.map(s => ({ ...s, role: "staff", pending: true, id: s.email }))].map(s => <div key={s.id} className="flex items-center gap-2 rounded-xl bg-surface p-3"><span className="min-w-0 flex-1 break-all">{s.email}<small className="block text-muted">{s.pending ? "Invite pending" : s.role}</small></span>{s.role !== "owner" && <button className="text-danger" disabled={busy} onClick={() => void action(async () => setTeam(await api<Team>("staff", { action: "revoke", email: s.email })))}>Remove</button>}</div>)}<p className="text-[10px] text-muted">AI help has a ${session.monthlyAiCapUsd.toFixed(2)} monthly cap. Reports and human replies keep working if it is reached.</p></div>}
      </>}
    </div>
    {!authNeeded && <footer className="shrink-0 border-t border-border p-3">{tab === "help" ? <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); ask(); }}><textarea className={field + " min-h-11 max-h-24 flex-1 resize-none"} aria-label="Ask support AI" placeholder="Ask about KwantDesk…" maxLength={1800} rows={2} value={question} disabled={busy || !session?.aiAvailable} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        ask();
    } }}/><button className={primary} aria-label="Send AI question" disabled={busy || !question.trim() || !session?.aiAvailable}>{busy ? <Loader2 size={16} className="animate-spin"/> : <ArrowUp size={16}/>}</button></form> : tab === "report" ? <button form="support-report" className={primary + " w-full"} disabled={busy || !session || subject.trim().length < 4 || description.trim().length < 15}>{busy ? <Loader2 size={15} className="animate-spin"/> : <Send size={14}/>}Submit report</button> : thread ? <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); void action(async () => { setThread(await api<Thread>(`tickets/${thread.ticket.id}/messages`, { body: reply })); setReply(""); }); }}><textarea className={field + " min-h-16 flex-1 resize-none"} aria-label="Reply to report" maxLength={6000} placeholder="Write a reply…" value={reply} disabled={busy} onChange={e => setReply(e.target.value)}/><button className={primary} aria-label="Send reply" disabled={busy || !reply.trim()}><Send size={15}/></button></form> : <p className="text-[10px] text-muted">Reports and team replies stay here when you return.</p>}</footer>}
  </section>;
}
