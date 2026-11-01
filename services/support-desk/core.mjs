import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
export class SupportError extends Error {
    constructor(status, message, code = 'SUPPORT_ERROR') { super(message); this.status = status; this.code = code; }
}
const fail = (status, message, code) => { throw new SupportError(status, message, code); };
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const iso = () => new Date().toISOString();
const CATEGORIES = new Set(JSON.parse(readFileSync(new URL('./areas.json', import.meta.url), 'utf8')).map(area => area.id));
function contactDetails(actor, allowed) {
    if (allowed !== undefined && typeof allowed !== 'boolean')
        fail(400, 'Choose whether support may email you.');
    if (allowed && (!actor.verified || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actor.email)))
        fail(400, 'Email follow-up requires a verified sign-in email.');
    return { allowed: allowed === true, email: allowed ? actor.email.toLowerCase() : '', at: allowed ? iso() : null };
}
export function pagePath(value) { return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value.split(/[?#]/)[0].slice(0, 180) : '/'; }
export function screenshot(value) {
    if (!value)
        return null;
    const match = typeof value === 'string' && /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
    if (!match)
        fail(400, 'Use a PNG, JPEG or WebP screenshot.');
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 1024 * 1024 || bytes.length < 12)
        fail(400, 'Screenshots must be 1 MB or smaller.');
    const valid = match[1] === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : match[1] === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
    if (!valid)
        fail(400, 'The screenshot format does not match its contents.');
    return { mime: match[1], bytes };
}
export class SupportDesk {
    constructor(path, { bootstrapHash = '', bootstrapExpires = '', monthlyCapMicro = 2000000, fetcher = fetch, knowledge = readFileSync(new URL('./knowledge.md', import.meta.url), 'utf8') } = {}) {
        this.db = new DatabaseSync(path);
        this.fetcher = fetcher;
        this.knowledge = knowledge;
        this.bootstrapHash = bootstrapHash;
        this.bootstrapExpires = bootstrapExpires;
        this.monthlyCapMicro = monthlyCapMicro;
        this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY,client_id TEXT NOT NULL,user_id TEXT NOT NULL,email TEXT NOT NULL,label TEXT NOT NULL,subject TEXT NOT NULL,category TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',page TEXT NOT NULL,context TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(user_id,client_id));
      CREATE INDEX IF NOT EXISTS ticket_owner ON tickets(user_id,updated_at DESC);
      CREATE INDEX IF NOT EXISTS ticket_updated ON tickets(updated_at DESC);
      CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,ticket_id TEXT NOT NULL REFERENCES tickets(id),user_id TEXT NOT NULL,role TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS messages_ticket ON messages(ticket_id,id);
      CREATE TABLE IF NOT EXISTS attachments(ticket_id TEXT PRIMARY KEY REFERENCES tickets(id),mime TEXT NOT NULL,bytes BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS staff(user_id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,role TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS invites(email TEXT PRIMARY KEY,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reads(ticket_id TEXT NOT NULL,user_id TEXT NOT NULL,last_message INTEGER NOT NULL,PRIMARY KEY(ticket_id,user_id));
      CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rate_events(user_id TEXT NOT NULL,kind TEXT NOT NULL,at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS rate_lookup ON rate_events(user_id,kind,at);
      CREATE TABLE IF NOT EXISTS ai_budget(month TEXT PRIMARY KEY,spent_micro INTEGER NOT NULL);`);
        // Existing reports remain in-app only until their customer opts in.
        const columns = new Set(this.db.prepare('PRAGMA table_info(tickets)').all().map(column => column.name));
        for (const [name, definition] of [['contact_email', "TEXT NOT NULL DEFAULT ''"], ['email_consent', 'INTEGER NOT NULL DEFAULT 0'], ['email_consent_at', 'TEXT']]) {
            if (!columns.has(name)) this.db.exec(`ALTER TABLE tickets ADD COLUMN ${name} ${definition}`);
        }
    }
    close() { this.db.close(); }
    transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try {
        const out = fn();
        this.db.exec('COMMIT');
        return out;
    }
    catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
    } }
    role(actor) {
        const row = this.db.prepare('SELECT role FROM staff WHERE user_id=?').get(actor.id);
        if (row)
            return row.role;
        if (actor.verified && actor.email && this.db.prepare('SELECT email FROM invites WHERE email=?').get(actor.email.toLowerCase())) {
            this.db.prepare("INSERT INTO staff(user_id,email,role) VALUES(?,?,'staff') ON CONFLICT(user_id) DO NOTHING").run(actor.id, actor.email.toLowerCase());
            this.db.prepare('DELETE FROM invites WHERE email=?').run(actor.email.toLowerCase());
            return 'staff';
        }
        return null;
    }
    rate(actor, kind, limit, windowMs) { const at = Date.now(); const count = this.db.prepare('SELECT count(*) AS n FROM rate_events WHERE user_id=? AND kind=? AND at>?').get(actor.id, kind, at - windowMs).n; if (count >= limit)
        fail(429, 'Please wait before sending another request.', 'RATE_LIMIT'); this.db.prepare('INSERT INTO rate_events VALUES(?,?,?)').run(actor.id, kind, at); this.db.prepare('DELETE FROM rate_events WHERE at<?').run(at - 32 * 86400000); }
    claim(actor, token) {
        if (!actor.verified || !actor.email)
            fail(403, 'Sign in with a verified email to claim the inbox.');
        const actual = hash(text(token, 200)), expected = this.bootstrapHash;
        if (expected.length !== 64 || actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected)) || (!Number.isFinite(Date.parse(this.bootstrapExpires)) || Date.parse(this.bootstrapExpires) < Date.now()))
            fail(403, 'This owner setup link is invalid or expired.');
        this.transaction(() => { if (this.db.prepare("SELECT 1 FROM kv WHERE key='owner_claimed'").get() || this.db.prepare("SELECT 1 FROM staff WHERE role='owner'").get())
            fail(409, 'The owner inbox has already been claimed.'); this.db.prepare("INSERT INTO staff VALUES(?,?,'owner')").run(actor.id, actor.email.toLowerCase()); this.db.prepare("INSERT INTO kv VALUES('owner_claimed','1')").run(); });
        return { claimed: true };
    }
    staffList(actor) { if (this.role(actor) !== 'owner')
        fail(403, 'Only the owner can manage support staff.'); return { staff: this.db.prepare('SELECT user_id AS id,email,role FROM staff ORDER BY role,email').all(), invites: this.db.prepare('SELECT email,created_at AS createdAt FROM invites ORDER BY email').all() }; }
    invite(actor, email) { if (this.role(actor) !== 'owner')
        fail(403, 'Only the owner can invite support staff.'); email = text(email, 180).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail(400, 'Enter a valid staff email.'); this.db.prepare('INSERT INTO invites VALUES(?,?) ON CONFLICT(email) DO NOTHING').run(email, iso()); return this.staffList(actor); }
    revoke(actor, email) { if (this.role(actor) !== 'owner')
        fail(403, 'Only the owner can manage support staff.'); email = text(email, 180).toLowerCase(); if (this.db.prepare("SELECT 1 FROM staff WHERE email=? AND role='owner'").get(email))
        fail(400, 'The owner cannot be removed here.'); this.transaction(() => { this.db.prepare('DELETE FROM staff WHERE email=?').run(email); this.db.prepare('DELETE FROM invites WHERE email=?').run(email); }); return this.staffList(actor); }
    visible(actor, id) { if (!uuid(id))
        fail(404, 'Report not found.'); const row = this.db.prepare('SELECT * FROM tickets WHERE id=?').get(id); if (!row || (row.user_id !== actor.id && !this.role(actor)))
        fail(404, 'Report not found.'); return row; }
    format(row) { return { id: row.id, reference: 'KD-' + row.id.replaceAll('-', '').slice(0, 12).toUpperCase(), subject: row.subject, category: row.category, status: row.status, page: row.page, createdAt: row.created_at, updatedAt: row.updated_at, ...(row.email ? { email: row.email, label: row.label } : {}), emailConsent: row.email_consent === 1, contactEmail: row.email_consent === 1 ? row.contact_email : '', emailConsentAt: row.email_consent_at, unread: Boolean(row.unread) }; }
    list(actor, { staff = false, status = '', before = '', search = '' } = {}) {
        if (staff && !this.role(actor))
            fail(403, 'Support staff access required.');
        const where = ['1=1'], args = [actor.id, actor.id];
        if (!staff) {
            where.push('t.user_id=?');
            args.push(actor.id);
        }
        if (['open', 'waiting', 'resolved'].includes(status)) {
            where.push('t.status=?');
            args.push(status);
        }
        if (before) {
            const [at, id] = before.split('|');
            if (!/^\d{4}-\d\d-\d\dT/.test(at) || !uuid(id))
                fail(400, 'Invalid page cursor.');
            where.push('(t.updated_at<? OR (t.updated_at=? AND t.id<?))');
            args.push(at, at, id);
        }
        if (search) {
            where.push("(t.subject LIKE ? ESCAPE '\\' OR t.email LIKE ? ESCAPE '\\')");
            const q = '%' + text(search, 100).replace(/[\\%_]/g, '\\$&') + '%';
            args.push(q, q);
        }
        const rows = this.db.prepare(`SELECT t.*, EXISTS(SELECT 1 FROM messages m LEFT JOIN reads r ON r.ticket_id=t.id AND r.user_id=? WHERE m.ticket_id=t.id AND m.user_id<>? AND m.id>COALESCE(r.last_message,0)) AS unread FROM tickets t WHERE ${where.join(' AND ')} ORDER BY t.updated_at DESC,t.id DESC LIMIT 26`).all(...args);
        return { tickets: rows.slice(0, 25).map(r => this.format(r)), next: rows.length > 25 ? rows[24].updated_at + '|' + rows[24].id : null };
    }
    session(actor) { return { user: { id: actor.id, email: actor.email, label: actor.label }, role: this.role(actor), monthlyAiCapUsd: this.monthlyCapMicro / 1e6 }; }
    thread(actor, id) { const row = this.visible(actor, id); return { ticket: this.format(row), canManageContact: row.user_id === actor.id, context: JSON.parse(row.context), messages: this.db.prepare('SELECT id,role,body,created_at AS createdAt FROM messages WHERE ticket_id=? ORDER BY id LIMIT 200').all(id), hasAttachment: Boolean(this.db.prepare('SELECT 1 FROM attachments WHERE ticket_id=?').get(id)) }; }
    read(actor, id) { this.visible(actor, id); const n = this.db.prepare('SELECT COALESCE(max(id),0) AS id FROM messages WHERE ticket_id=?').get(id).id; this.db.prepare('INSERT INTO reads VALUES(?,?,?) ON CONFLICT(ticket_id,user_id) DO UPDATE SET last_message=excluded.last_message').run(id, actor.id, n); return { ok: true }; }
    create(actor, input) {
        if (!uuid(input.clientId))
            fail(400, 'A report request ID is required.');
        const existing = this.db.prepare('SELECT * FROM tickets WHERE user_id=? AND client_id=?').get(actor.id, input.clientId);
        if (existing)
            return this.thread(actor, existing.id);
        const subject = text(input.subject, 120), body = text(input.description, 6000);
        if (subject.length < 4 || body.length < 15)
            fail(400, 'Add a subject and a description of at least 15 characters.');
        const picture = screenshot(input.screenshot);
        const contact = contactDetails(actor, input.emailConsent);
        const conversation = Array.isArray(input.conversation) ? input.conversation.slice(-12).filter(m => m && typeof m === 'object').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: text(m.content, 1500) })) : [];
        const context = { page: pagePath(input.page), browser: text(input.browser, 300), viewport: text(input.viewport, 40), conversation };
        const id = randomUUID(), now = iso();
        this.transaction(() => { this.rate(actor, 'ticket', 12, 86400000); if (picture && this.db.prepare('SELECT COALESCE(sum(length(bytes)),0) AS n FROM attachments').get().n + picture.bytes.length > 250 * 1024 * 1024)
            fail(413, 'Screenshot storage is full. Submit the report without the screenshot.'); this.db.prepare('INSERT INTO tickets(id,client_id,user_id,email,label,subject,category,page,context,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id, input.clientId, actor.id, actor.email, actor.label, subject, CATEGORIES.has(input.category) ? input.category : 'other', context.page, JSON.stringify(context), now, now); this.db.prepare("INSERT INTO messages(ticket_id,user_id,role,body,created_at) VALUES(?,?,'customer',?,?)").run(id, actor.id, body, now); if (picture)
            this.db.prepare('INSERT INTO attachments VALUES(?,?,?)').run(id, picture.mime, picture.bytes); this.db.prepare('UPDATE tickets SET contact_email=?,email_consent=?,email_consent_at=? WHERE id=?').run(contact.email, contact.allowed ? 1 : 0, contact.at, id); });
        return this.thread(actor, id);
    }
    contact(actor, id, allowed) {
        const row = this.visible(actor, id);
        if (row.user_id !== actor.id) fail(403, 'Only the customer can change email permission.');
        if (typeof allowed !== 'boolean') fail(400, 'Choose whether support may email you.');
        const contact = contactDetails(actor, allowed);
        if (Boolean(row.email_consent) === contact.allowed && row.contact_email === contact.email) return this.thread(actor, id);
        this.transaction(() => {
            // Bound audit-message growth without ever blocking withdrawal.
            if (allowed) this.rate(actor, 'email-contact', 20, 3600000);
            const now = iso();
            this.db.prepare('UPDATE tickets SET contact_email=?,email_consent=?,email_consent_at=?,updated_at=? WHERE id=?').run(contact.email, contact.allowed ? 1 : 0, contact.at, now, id);
            this.db.prepare("INSERT INTO messages(ticket_id,user_id,role,body,created_at) VALUES(?,?,'system',?,?)").run(id, actor.id, contact.allowed ? 'Customer allowed email follow-up for this report.' : 'Customer turned off email follow-up. Reply in KwantDesk.', now);
        });
        return this.thread(actor, id);
    }
    reply(actor, id, body) { this.visible(actor, id); body = text(body, 6000); if (!body)
        fail(400, 'Write a reply first.'); const staff = Boolean(this.role(actor)); this.transaction(() => { this.rate(actor, 'message', 60, 3600000); if (this.db.prepare('SELECT count(*) AS n FROM messages WHERE ticket_id=?').get(id).n >= 200)
        fail(409, 'This conversation is full. Please open a new report with this reference.'); const now = iso(); this.db.prepare('INSERT INTO messages(ticket_id,user_id,role,body,created_at) VALUES(?,?,?,?,?)').run(id, actor.id, staff ? 'staff' : 'customer', body, now); this.db.prepare('UPDATE tickets SET status=?,updated_at=? WHERE id=?').run(staff ? 'waiting' : 'open', now, id); }); return this.thread(actor, id); }
    status(actor, id, status) { this.visible(actor, id); if (!this.role(actor))
        fail(403, 'Only support can change report status.'); if (!['open', 'waiting', 'resolved'].includes(status))
        fail(400, 'Choose a valid report status.'); this.transaction(() => { this.db.prepare('UPDATE tickets SET status=?,updated_at=? WHERE id=?').run(status, iso(), id); this.db.prepare("INSERT INTO messages(ticket_id,user_id,role,body,created_at) VALUES(?,?,'system',?,?)").run(id, actor.id, `Support marked this report ${status}.`, iso()); }); return this.thread(actor, id); }
    attachment(actor, id) { this.visible(actor, id); const row = this.db.prepare('SELECT * FROM attachments WHERE ticket_id=?').get(id); if (!row)
        fail(404, 'Screenshot not found.'); return row; }
    async answer(actor, input, providerKey) {
        if (!providerKey)
            fail(503, 'AI help is unavailable. You can still report a problem.', 'AI_UNAVAILABLE');
        const messages = Array.isArray(input.messages) ? input.messages.slice(-10).filter(m => m && typeof m === 'object').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: text(m.content, 1800) })).filter(m => m.content) : [];
        while (messages[0]?.role === 'assistant')
            messages.shift();
        if (!messages.length || messages.at(-1).role !== 'user')
            fail(400, 'Ask a question first.');
        const system = this.knowledge + '\nCurrent page: ' + pagePath(input.page);
        const bytes = Buffer.byteLength(system + JSON.stringify(messages));
        if (bytes > 16000)
            fail(400, 'This conversation is too long. Start a new AI conversation or submit a report.');
        const month = iso().slice(0, 7), reserved = bytes + 2048 + 500 * 5;
        this.transaction(() => { this.rate(actor, 'ai-minute', 6, 60000); this.rate(actor, 'ai-day', 12, 86400000); this.db.prepare('INSERT INTO ai_budget VALUES(?,0) ON CONFLICT(month) DO NOTHING').run(month); const used = this.db.prepare('SELECT spent_micro AS n FROM ai_budget WHERE month=?').get(month).n; if (used + reserved > this.monthlyCapMicro)
            fail(429, 'AI help has reached its usage limit. You can still report a problem.', 'AI_BUDGET'); this.db.prepare('UPDATE ai_budget SET spent_micro=spent_micro+? WHERE month=?').run(reserved, month); });
        // Fixed, priced model; never accept a caller-controlled model, URL or token budget.
        // Failed/unknown calls keep their conservative reservation to avoid overspend.
        const response = await this.fetcher('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(22000), headers: { 'content-type': 'application/json', 'x-api-key': providerKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, temperature: 0.2, system, messages }) });
        if (!response.ok)
            fail(503, 'AI help is temporarily unavailable. You can still send a report.', 'AI_UNAVAILABLE');
        const data = await response.json();
        const answer = Array.isArray(data.content) ? data.content.filter(c => c.type === 'text').map(c => c.text).join('\n').slice(0, 8000) : '';
        if (!answer)
            fail(503, 'AI help could not answer. You can still send a report.', 'AI_UNAVAILABLE');
        const cost = Math.max(0, Number(data.usage?.input_tokens) || 0) + Math.max(0, Number(data.usage?.output_tokens) || 0) * 5;
        if (cost > 0 && cost < reserved)
            this.db.prepare('UPDATE ai_budget SET spent_micro=spent_micro-? WHERE month=?').run(reserved - cost, month);
        return { response: answer };
    }
    health() { return { ok: true, database: this.db.prepare('PRAGMA quick_check').get().quick_check === 'ok', ownerSetupPending: !this.db.prepare("SELECT 1 FROM staff WHERE role='owner'").get(), monthlyAiCapUsd: this.monthlyCapMicro / 1e6 }; }
}
