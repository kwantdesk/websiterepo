// Offline bridge/UI QA only. No provider calls or real market data.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('public');
const html=`<!doctype html><meta charset="utf-8"><title>Options tool panel bridge QA</title>
<style>body{margin:0;background:#080c14;color:#dce7f5;font:13px Arial}header{padding:8px}main{display:grid;grid-template-columns:1fr 1fr;gap:6px;height:calc(100vh - 80px)}section{min-width:0;border:1px solid #28364c;display:flex;flex-direction:column}iframe{width:100%;border:0;flex:1;min-height:0}select,button{background:#182239;color:#dce7f5;padding:6px;border:1px solid #28364c}output{float:right;color:#4fb3ff}</style>
<header>LOCAL OFFLINE UI FIXTURE — no market data. Separate panel hosts, source controls and storage.
<p><button id="theme">Toggle light/dark</button><button id="pause">Pause/resume panels</button></p></header>
<main><section><label>GEX DATA <select id="dataTool"><option value="iv-rank">Implied Volatility Rank</option><option value="interval-map">Interval Map</option><option value="stock-price-over-time">Stock Price / Time</option></select><output id="dataSaved">0 saved keys</output></label><iframe id="data" title="GEX DATA isolated panel"></iframe></section>
<section><label>KWANTY <select id="botTool"><option value="classic">Positioning Classic</option><option value="state">Positioning State</option><option value="orderflow">Positioning Orderflow</option></select><output id="botSaved">0 saved keys</output></label><iframe id="bot" title="KWANTY isolated panel"></iframe></section></main>
<script>
let light=false,active=true;const store={data:{},bot:{}};
const theme=()=>light?{background:'#f4f7fc',panel:'#ffffff',surface:'#e4ebf6',foreground:'#15273e',muted:'#50617a',border:'#9aaec9',primary:'#2255cc',danger:'#b52150'}:{background:'#080c14',panel:'#111a29',surface:'#182239',foreground:'#dce7f5',muted:'#8294ad',border:'#28364c',primary:'#4fb3ff',danger:'#ff607f'};
window.__kwantOptionsToolHosts=Object.fromEntries(['data','bot'].map(id=>[id,{active,theme,timezone:()=> 'America/New_York',instruments:()=>[['SPX','SPX'],['NDX','NDX'],['SPY','SPY'],['QQQ','QQQ']],
read:key=>store[id][key]??null,write:(key,value)=>{if(value===null)delete store[id][key];else store[id][key]=value;document.getElementById(id+'Saved').textContent=Object.keys(store[id]).length+' saved keys';},snapshot:()=>({...store[id]}),restore:value=>Object.assign(store[id],value),
request:async url=>new Response(JSON.stringify(url.includes('catalog')?{tickers:['SPX','NDX','QQQ','SPY']}:url.includes('status')?{authenticated:true,connected:true,market:{open:false,optionsOpen:false,equitiesOpen:false,sessionDate:'2026-10-16',optionsSessionDate:'2026-10-16'}}:{error:'Offline UI fixture: no market-data request was made.'}),{status:url.includes('catalog')||url.includes('status')?200:503,headers:{'Content-Type':'application/json'}})}]));
function open(){document.getElementById('data').src='/gex-data-app/index.html?embed=1&instance=panel&hostId=data&c_ticker=QQQ#tool='+document.getElementById('dataTool').value;document.getElementById('bot').src='/kwanty-app/index.html?hostId=bot&ticker=SPX#'+document.getElementById('botTool').value;}
function send(kind){for(const id of ['data','bot'])document.getElementById(id).contentWindow.postMessage({type:(id==='data'?'gex-data':'kwanty')+'-site-'+kind,active},location.origin);}
document.getElementById('dataTool').onchange=open;document.getElementById('botTool').onchange=open;
document.getElementById('theme').onclick=()=>{light=!light;send('theme');};document.getElementById('pause').onclick=()=>{active=!active;Object.values(window.__kwantOptionsToolHosts).forEach(host=>host.active=active);send('activity');};open();
</script>`;
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:3439');
    if(url.pathname==='/')return res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html);
    const path=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!path.startsWith(root+sep))return res.writeHead(403).end();
    const body=await readFile(path);
    res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf'})[extname(path)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404).end();}
}).listen(3439,'127.0.0.1',()=>console.log('Offline options tool bridge: http://127.0.0.1:3439'));
