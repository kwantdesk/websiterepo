import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SupportDesk, screenshot, pagePath } from './core.mjs';
import { supportServer, signature } from './server.mjs';
const a = { id: '11111111-1111-4111-8111-111111111111', email: 'a@example.invalid', label: 'A', verified: true }, b = { id: '22222222-2222-4222-8222-222222222222', email: 'b@example.invalid', label: 'B', verified: true }, owner = { id: '33333333-3333-4333-8333-333333333333', email: 'owner@example.invalid', label: 'Owner', verified: true };
const token = 'one-time-private-test-token';
const options = { bootstrapHash: createHash('sha256').update(token).digest('hex'), bootstrapExpires: new Date(Date.now() + 3600000).toISOString() };
const report = () => ({ clientId: randomUUID(), subject: 'CVD stopped updating', description: 'The NQ chart CVD stopped updating at 09:35 ET.', category: 'charts', page: '/charts?secret=do-not-store#private' });
function desk() { return new SupportDesk(':memory:', options); }
test('reports are idempotent, durable and private to their account', () => { const dir = mkdtempSync(join(tmpdir(), 'kwantdesk-support-test-')), path = join(dir, 'support.db'); let d = new SupportDesk(path, options); try {
    const input = report(), first = d.create(a, input);
    assert.equal(d.create(a, input).ticket.id, first.ticket.id);
    assert.equal(d.list(a).tickets.length, 1);
    assert.equal(d.list(b).tickets.length, 0);
    assert.throws(() => d.thread(b, first.ticket.id), e => e.status === 404);
    assert.equal(first.ticket.page, '/charts');
    d.close();
    d = new SupportDesk(path, options);
    assert.equal(d.thread(a, first.ticket.id).messages[0].body, input.description);
}
finally {
    d.close();
    rmSync(dir, { recursive: true, force: true });
} });
test('owner setup is one-time; staff require verified invited identity and can be revoked', () => { const d = desk(); try {
    assert.throws(() => d.claim(a, 'wrong'), e => e.status === 403);
    assert.throws(() => d.claim({ ...a, verified: false }, token), e => e.status === 403);
    d.claim(owner, token);
    assert.throws(() => d.claim(a, token), e => e.status === 409);
    assert.throws(() => d.invite(a, b.email), e => e.status === 403);
    d.invite(owner, b.email);
    assert.equal(d.role({ ...b, verified: false }), null);
    assert.equal(d.role(b), 'staff');
    assert.throws(() => d.revoke(owner, owner.email), e => e.status === 400);
    d.revoke(owner, b.email);
    assert.equal(d.role(b), null);
}
finally {
    d.close();
} });
test('staff receives reports, replies persist, statuses and unread state work', () => { const d = desk(); try {
    d.claim(owner, token);
    const id = d.create(a, report()).ticket.id;
    assert.equal(d.list(owner, { staff: true }).tickets[0].unread, true);
    assert.throws(() => d.list(b, { staff: true }), e => e.status === 403);
    d.read(owner, id);
    assert.equal(d.list(owner, { staff: true }).tickets[0].unread, false);
    d.reply(owner, id, 'We are investigating this report.');
    assert.equal(d.thread(a, id).ticket.status, 'waiting');
    assert.equal(d.list(a).tickets[0].unread, true);
    d.read(a, id);
    assert.equal(d.list(a).tickets[0].unread, false);
    assert.throws(() => d.status(a, id, 'resolved'), e => e.status === 403);
    d.status(owner, id, 'resolved');
    assert.equal(d.thread(a, id).ticket.status, 'resolved');
    d.reply(a, id, 'I can reproduce it again.');
    assert.equal(d.thread(a, id).ticket.status, 'open');
}
finally {
    d.close();
} });
test('screenshots are typed, bounded and protected by ticket ownership', () => { const d = desk(); try {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
    assert.equal(screenshot(png).mime, 'image/png');
    assert.throws(() => screenshot('data:image/svg+xml;base64,PHN2Zz4='), e => e.status === 400);
    assert.throws(() => screenshot('data:image/png;base64,' + Buffer.alloc(1048577).toString('base64')), e => e.status === 400);
    const id = d.create(a, { ...report(), screenshot: png }).ticket.id;
    assert.equal(d.thread(a, id).hasAttachment, true);
    assert.throws(() => d.attachment(b, id), e => e.status === 404);
    assert.equal(d.attachment(a, id).mime, 'image/png');
}
finally {
    d.close();
} });
test('report rate limit is durable and retries do not duplicate reports', () => { const d = desk(); try {
    const first = report();
    for (let i = 0; i < 12; i++)
        d.create(a, i === 0 ? first : report());
    assert.equal(d.create(a, first).ticket.subject, first.subject);
    assert.throws(() => d.create(a, report()), e => e.status === 429);
}
finally {
    d.close();
} });
test('AI calls the fixed model, removes the initial greeting and settles its budget', async () => { let call; const d = new SupportDesk(':memory:', { ...options, fetcher: async (url, input) => { call = { url, body: JSON.parse(input.body) }; return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Use Report a problem to contact the team.' }], usage: { input_tokens: 100, output_tokens: 20 } }), { headers: { 'content-type': 'application/json' } }); } }); try {
    const answer = await d.answer(a, { messages: [{ role: 'assistant', content: 'Welcome' }, { role: 'user', content: 'How do I report this?' }], model: 'other' }, 'private-provider-key');
    assert.match(answer.response, /Report/);
    assert.equal(call.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(call.body.model, 'claude-haiku-4-5-20251001');
    assert.equal(call.body.max_tokens, 500);
    assert.equal(call.body.messages[0].role, 'user');
    assert.equal(d.db.prepare('SELECT spent_micro AS n FROM ai_budget').get().n, 200);
    assert.ok(!JSON.stringify(answer).includes('private-provider-key'));
}
finally {
    d.close();
} });
test('AI budget blocks provider spending and does not block human reports', async () => { let calls = 0; const d = new SupportDesk(':memory:', { ...options, monthlyCapMicro: 10, fetcher: async () => { calls++; throw Error('must not call'); } }); try {
    await assert.rejects(() => d.answer(a, { messages: [{ role: 'user', content: 'Help' }] }, 'key'), e => e.code === 'AI_BUDGET');
    assert.equal(calls, 0);
    assert.ok(d.create(a, report()).ticket.id);
}
finally {
    d.close();
} });
test('failed AI calls retain a conservative reservation and never expose provider errors', async () => { const d = new SupportDesk(':memory:', { ...options, fetcher: async () => new Response('secret failure', { status: 401 }) }); try {
    await assert.rejects(() => d.answer(a, { messages: [{ role: 'user', content: 'Help' }] }, 'key'), e => e.code === 'AI_UNAVAILABLE' && !e.message.includes('secret'));
    assert.ok(d.db.prepare('SELECT spent_micro AS n FROM ai_budget').get().n > 0);
}
finally {
    d.close();
} });
test('signed HTTP boundary rejects missing, tampered and expired identities', async () => { const d = desk(), secret = 'a'.repeat(64), server = supportServer(d, secret); await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = 'http://127.0.0.1:' + server.address().port; try {
    assert.equal((await fetch(origin + '/support/v1/session')).status, 401);
    const path = '/support/v1/session', encoded = Buffer.from(JSON.stringify(a)).toString('base64url'), expires = String(Date.now() + 30000), sig = signature(secret, 'GET', path, encoded, expires, '');
    const headers = { 'x-support-actor': encoded, 'x-support-expires': expires, 'x-support-signature': sig };
    assert.equal((await fetch(origin + path, { headers })).status, 200);
    assert.equal((await fetch(origin + path, { headers: { ...headers, 'x-support-actor': Buffer.from(JSON.stringify(owner)).toString('base64url') } })).status, 401);
    assert.equal((await fetch(origin + path, { headers: { ...headers, 'x-support-expires': '1' } })).status, 401);
}
finally {
    await new Promise(r => server.close(r));
    d.close();
} });
test('page diagnostics cannot capture query credentials or external URLs', () => { assert.equal(pagePath('/charts?token=secret#stuff'), '/charts'); assert.equal(pagePath('https://outside.example'), '/'); assert.equal(pagePath('//outside.example'), '/'); });
test('staff pagination keeps equal-time reports and search escapes SQL wildcards', () => { const d = desk(); try {
    d.claim(owner, token);
    for (let i = 0; i < 31; i++)
        d.create({ ...a, id: randomUUID() }, { ...report(), subject: i === 0 ? 'Literal 100% _ issue' : 'Chart report ' + i });
    d.db.prepare('UPDATE tickets SET updated_at=?').run('2026-11-01T00:00:00.000Z');
    const first = d.list(owner, { staff: true }), second = d.list(owner, { staff: true, before: first.next });
    assert.equal(first.tickets.length, 25);
    assert.equal(second.tickets.length, 6);
    assert.equal(new Set([...first.tickets, ...second.tickets].map(t => t.id)).size, 31);
    assert.equal(d.list(owner, { staff: true, search: '100% _' }).tickets.length, 1);
    assert.throws(() => d.list(owner, { staff: true, before: '2026-11-01Tbad' }), e => e.status === 400);
}
finally {
    d.close();
} });

test('every website area is accepted and remains attached to the report', async () => {
    const { readFileSync } = await import('node:fs');
    const areas = JSON.parse(readFileSync(new URL('./areas.json', import.meta.url), 'utf8'));
    const d = desk(); try {
        const ids = new Set(areas.map(area => area.id));
        assert.equal(ids.size, areas.length);
        for (const id of ['home','charts','gex-view','gex-data','kwanty','kwanty-state','kwanty-orderflow','news-financial-info','news-options-expirations','news-futures-expirations','settings','support']) assert.ok(ids.has(id), id);
        for (const area of areas) {
            const customer = { ...a, id: randomUUID() };
            assert.equal(d.create(customer, { ...report(), category: area.id }).ticket.category, area.id);
        }
    } finally { d.close(); }
});

test('email permission is explicit, verified, durable and cannot nominate another address', () => {
    const d = desk(); try {
        const ordinary = d.create(a, { ...report(), contactEmail: 'someone-else@example.invalid' });
        assert.equal(ordinary.ticket.emailConsent, false);
        assert.equal(ordinary.ticket.contactEmail, '');
        const input = { ...report(), emailConsent: true, contactEmail: 'someone-else@example.invalid', emailConsentAt: 'invented' };
        const opted = d.create(a, input);
        assert.equal(opted.ticket.contactEmail, a.email);
        assert.equal(opted.ticket.emailConsent, true);
        assert.ok(Number.isFinite(Date.parse(opted.ticket.emailConsentAt)));
        assert.deepEqual(d.create(a, input).ticket, opted.ticket);
        assert.throws(() => d.create({ ...b, verified: false }, { ...report(), emailConsent: true }), e => e.status === 400);
        assert.throws(() => d.create(b, { ...report(), emailConsent: 'yes' }), e => e.status === 400);
    } finally { d.close(); }
});

test('only the report customer can grant or withdraw email permission; in-app replies survive withdrawal', () => {
    const d = desk(); try {
        d.claim(owner, token);
        const id = d.create(a, { ...report(), emailConsent: true }).ticket.id;
        assert.equal(d.thread(owner, id).canManageContact, false);
        assert.throws(() => d.contact(owner, id, false), e => e.status === 403);
        assert.throws(() => d.contact(b, id, false), e => e.status === 404);
        assert.throws(() => d.contact(a, id, undefined), e => e.status === 400);
        const revoked = d.contact(a, id, false);
        assert.equal(revoked.ticket.emailConsent, false);
        assert.equal(revoked.ticket.contactEmail, '');
        assert.equal(revoked.ticket.emailConsentAt, null);
        assert.equal(revoked.canManageContact, true);
        d.reply(owner, id, 'We can continue helping inside KwantDesk.');
        assert.ok(d.thread(a, id).messages.some(message => message.body === 'We can continue helping inside KwantDesk.'));
        assert.equal(d.contact(a, id, true).ticket.contactEmail, a.email);
    } finally { d.close(); }
});

test('legacy report migration preserves messages and defaults email permission to off', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kwantdesk-support-migration-')), path = join(dir, 'support.db');
    let d = new SupportDesk(path, options); try {
        const id = d.create(a, report()).ticket.id;
        for (const column of ['contact_email','email_consent','email_consent_at']) d.db.exec('ALTER TABLE tickets DROP COLUMN ' + column);
        d.close(); d = new SupportDesk(path, options);
        const migrated = d.thread(a, id);
        assert.equal(migrated.ticket.emailConsent, false);
        assert.equal(migrated.ticket.contactEmail, '');
        assert.equal(migrated.messages[0].body, report().description);
        d.close(); d = new SupportDesk(path, options);
        assert.equal(d.thread(a, id).messages.length, 1);
    } finally { d.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('repeated opt-ins are bounded while withdrawal always remains available', () => {
    const d = desk(); try {
        const id = d.create(a, report()).ticket.id;
        for (let i = 0; i < 20; i++) { d.contact(a, id, true); d.contact(a, id, false); }
        assert.throws(() => d.contact(a, id, true), e => e.status === 429);
        assert.equal(d.contact(a, id, false).ticket.emailConsent, false);
        assert.equal(d.thread(a, id).messages.length, 41);
    } finally { d.close(); }
});
