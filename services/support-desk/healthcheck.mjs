import { signature } from './server.mjs';
const path = '/support/v1/health', actor = Buffer.from(JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', email: '', label: 'Health check', verified: false })).toString('base64url'), expires = String(Date.now() + 30000);
const response = await fetch('http://127.0.0.1:8797' + path, { signal: AbortSignal.timeout(5000), headers: { 'x-support-actor': actor, 'x-support-expires': expires, 'x-support-signature': signature(process.env.SUPPORT_SERVICE_SECRET, 'GET', path, actor, expires, '') } });
const data = await response.json();
if (!response.ok || !data.ok || !data.database)
    process.exit(1);
