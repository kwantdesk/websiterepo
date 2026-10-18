// Local synthetic UI QA only; no account, vendor request, paid Actor or production route.
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import FinancialInfoWorkspace from './src/components/news/FinancialInfoWorkspace';
const mode=new URLSearchParams(location.search).get('mode');
const data={source:'FinancialJuice RSS',mode:'scheduled-rss',configured:mode!=='setup',status:mode==='setup'?'not_configured':'connected',stale:false,collectedAt:new Date().toISOString(),checkedAt:new Date().toISOString(),refreshAfterMs:60000,note:'Local synthetic preview only — not real news.',items:mode==='setup'?[]:[{id:'a'.repeat(24),title:'Preview fixture: central bank policy announcement',publishedAt:new Date().toISOString(),url:'https://www.financialjuice.com/News/123',categories:['Macro']},{id:'b'.repeat(24),title:'Preview fixture: equities headline and market context',publishedAt:new Date(Date.now()-3600000).toISOString(),url:'https://www.financialjuice.com/News/124',categories:['Equities']}]};
window.fetch=async()=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});createRoot(document.getElementById('root')).render(<FinancialInfoWorkspace/>);`;
const bundle = execFileSync('C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', 'npx --yes esbuild --bundle --loader=tsx --jsx=automatic --format=iife --platform=browser --alias:@=./src'], { input: entry, maxBuffer: 8_000_000, windowsHide: true });
const css = readdirSync('.next/static', { recursive: true }).filter(file => file.endsWith('.css')).map(file => readFileSync(join('.next/static', file), 'utf8')).join('\n');
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Financial Info synthetic QA</title><link rel="stylesheet" href="/style.css"><style>:root{--background:#080c14;--foreground:#dce7f5;--primary:#4fb3ff;--muted:#8294ad;--surface:#111a29;--border:#28364c}html,body,#root{height:100%;margin:0}body{background:var(--background);color:var(--foreground)}button{cursor:pointer}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
http.createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1:3124').pathname;
  const body = path === '/' ? html : path === '/bundle.js' ? bundle : path === '/style.css' ? css : null;
  if (body === null) return response.writeHead(404).end();
  response.writeHead(200, { 'Content-Type': path === '/' ? 'text/html' : path === '/style.css' ? 'text/css' : 'text/javascript' }); response.end(body);
}).listen(3124, '127.0.0.1', () => console.log('Synthetic Financial Info QA: http://127.0.0.1:3124'));
