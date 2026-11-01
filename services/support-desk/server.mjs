import { createServer } from 'node:http';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { SupportDesk, SupportError } from './core.mjs';
export function signature(secret, method, path, actor, expires, body) { return createHmac('sha256', secret).update(JSON.stringify([method, path, actor, expires, createHash('sha256').update(body).digest('hex')])).digest('hex'); }
export function supportServer(desk, secret) {
    if (!secret || secret.length < 32)
        throw Error('Support service credential is required.');
    return createServer({ requestTimeout: 30000, headersTimeout: 10000, maxHeaderSize: 8192 }, async (req, res) => {
        const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(value)); };
        try {
            const actorEncoded = String(req.headers['x-support-actor'] || ''), expires = String(req.headers['x-support-expires'] || ''), provided = String(req.headers['x-support-signature'] || '');
            if (!/^\d+$/.test(expires) || Number(expires) < Date.now() || Number(expires) > Date.now() + 60000 || !/^[a-f0-9]{64}$/.test(provided))
                throw new SupportError(401, 'Support authentication required.');
            const chunks = [];
            let size = 0;
            for await (const chunk of req) {
                size += chunk.length;
                if (size > 1600000)
                    throw new SupportError(413, 'This request is too large.');
                chunks.push(chunk);
            }
            const bytes = Buffer.concat(chunks);
            const path = req.url || '/';
            const expected = signature(secret, req.method, path, actorEncoded, expires, bytes);
            if (!/^\d+$/.test(expires) || Number(expires) < Date.now() || Number(expires) > Date.now() + 60000 || !/^[a-f0-9]{64}$/.test(provided) || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected)))
                throw new SupportError(401, 'Support authentication required.');
            const actor = JSON.parse(Buffer.from(actorEncoded, 'base64url').toString());
            if (!/^[a-f0-9-]{36}$/i.test(actor.id) || typeof actor.email !== 'string' || typeof actor.label !== 'string')
                throw new SupportError(401, 'A signed-in account is required.');
            const url = new URL(path, 'http://support'), parts = url.pathname.replace(/^\/support\/v1\/?/, '').split('/').filter(Boolean), input = bytes.length ? JSON.parse(bytes.toString()) : {};
            let result;
            if (req.method === 'GET' && parts[0] === 'health')
                result = desk.health();
            else if (req.method === 'GET' && parts[0] === 'session')
                result = desk.session(actor);
            else if (req.method === 'POST' && parts[0] === 'claim')
                result = desk.claim(actor, input.token);
            else if (req.method === 'GET' && parts[0] === 'staff')
                result = desk.staffList(actor);
            else if (req.method === 'POST' && parts[0] === 'staff')
                result = input.action === 'revoke' ? desk.revoke(actor, input.email) : desk.invite(actor, input.email);
            else if (req.method === 'GET' && parts[0] === 'tickets' && parts.length === 1)
                result = desk.list(actor, { staff: url.searchParams.get('staff') === '1', status: url.searchParams.get('status') || '', search: url.searchParams.get('search') || '', before: url.searchParams.get('before') || '' });
            else if (req.method === 'POST' && parts[0] === 'tickets' && parts.length === 1)
                result = desk.create(actor, input);
            else if (req.method === 'GET' && parts[0] === 'tickets' && parts.length === 2)
                result = desk.thread(actor, parts[1]);
            else if (req.method === 'POST' && parts[0] === 'tickets' && parts[2] === 'messages')
                result = desk.reply(actor, parts[1], input.body);
            else if (req.method === 'POST' && parts[0] === 'tickets' && parts[2] === 'contact')
                result = desk.contact(actor, parts[1], input.emailConsent);
            else if (req.method === 'POST' && parts[0] === 'tickets' && parts[2] === 'status')
                result = desk.status(actor, parts[1], input.status);
            else if (req.method === 'POST' && parts[0] === 'tickets' && parts[2] === 'read')
                result = desk.read(actor, parts[1]);
            else if (req.method === 'GET' && parts[0] === 'tickets' && parts[2] === 'attachment') {
                const row = desk.attachment(actor, parts[1]);
                res.writeHead(200, { 'content-type': row.mime, 'content-length': row.bytes.length, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" });
                res.end(Buffer.from(row.bytes));
                return;
            }
            else if (req.method === 'POST' && parts[0] === 'ai')
                result = await desk.answer(actor, input, input.providerKey);
            else
                throw new SupportError(404, 'Support action not found.');
            send(200, result);
        }
        catch (e) {
            const known = e instanceof SupportError;
            send(known ? e.status : 503, { error: known ? e.message : 'Support is temporarily unavailable. Your existing reports are preserved.', code: known ? e.code : 'SUPPORT_UNAVAILABLE' });
        }
    });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const desk = new SupportDesk(process.env.SUPPORT_DATABASE || '/data/support.db', { bootstrapHash: process.env.SUPPORT_BOOTSTRAP_HASH, bootstrapExpires: process.env.SUPPORT_BOOTSTRAP_EXPIRES, monthlyCapMicro: Number(process.env.SUPPORT_AI_MONTHLY_MICRO) || 2000000 });
    const server = supportServer(desk, process.env.SUPPORT_SERVICE_SECRET);
    server.listen(Number(process.env.PORT) || 8797, '0.0.0.0');
    process.on('SIGTERM', () => server.close(() => { desk.close(); process.exit(0); }));
}
